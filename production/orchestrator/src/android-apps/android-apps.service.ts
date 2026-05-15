import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { Repository } from 'typeorm';
import { throwNotFound } from '../common/not-found';
import { DockerService } from '../docker/docker.service';
import { NetworkIsolationService } from '../network-isolation/network-isolation.service';
import { AndroidApplication } from './android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
  ScrcpyTransport,
} from './android-application-status';
import { CreateAndroidApplicationDto } from './dto/create-android-application.dto';
import { ListAndroidApplicationsDto } from './dto/list-android-applications.dto';
import { RemoveAndroidApplicationDto } from './dto/remove-android-application.dto';
import { ScrcpySessionDto } from './dto/scrcpy-session.dto';
import { UpdateAndroidApplicationDto } from './dto/update-android-application.dto';

@Injectable()
export class AndroidAppsService {
  private readonly logger = new Logger(AndroidAppsService.name);

  constructor(
    @InjectRepository(AndroidApplication)
    private readonly applications: Repository<AndroidApplication>,
    private readonly config: ConfigService,
    private readonly docker: DockerService,
    private readonly networkIsolation: NetworkIsolationService,
  ) {}

  async create(dto: CreateAndroidApplicationDto, apk?: Express.Multer.File) {
    const app = this.applications.create({
      name: dto.name,
      ownerUserId: dto.ownerUserId ?? null,
      status: AndroidApplicationStatus.Provisioning,
      lifecycleStage: AndroidApplicationLifecycleStage.Queued,
      statusMessage: 'Provisioning has been queued.',
      redroidImage: dto.redroidImage ?? this.config.getOrThrow<string>('app.redroid.image'),
      containerName: 'pending',
      networkName: 'pending',
      volumeName: 'pending',
      containerId: null,
      apkFilePath: null,
      apkOriginalName: null,
      scrcpyTransport: dto.scrcpyTransport ?? ScrcpyTransport.WebSocket,
      adbPort: this.config.getOrThrow<number>('app.redroid.adbPort'),
      inactivityTimeoutSeconds:
        dto.inactivityTimeoutSeconds ??
        this.config.getOrThrow<number>('app.redroid.defaultInactivityTimeoutSeconds'),
      lastScrcpyActivityAt: null,
      lastStartedAt: null,
      lastStoppedAt: null,
      provisioningStartedAt: null,
      provisioningCompletedAt: null,
      lastError: null,
    });

    await this.applications.save(app);

    const names = this.networkIsolation.namesFor(app.id, app.name);
    Object.assign(app, names);

    if (apk) {
      const savedApk = await this.saveApkFile(app.id, apk);
      app.apkFilePath = savedApk.path;
      app.apkOriginalName = apk.originalname;
    }

    await this.applications.save(app);

    void this.provision(app.id);

    return app;
  }

  async list(query: ListAndroidApplicationsDto) {
    return this.applications.find({
      where: query.ownerUserId ? { ownerUserId: query.ownerUserId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async get(id: string) {
    return (await this.applications.findOneBy({ id })) ?? throwNotFound('Application', id);
  }

  async update(id: string, dto: UpdateAndroidApplicationDto) {
    const app = await this.get(id);

    if (dto.name !== undefined) {
      app.name = dto.name;
    }
    if (dto.ownerUserId !== undefined) {
      app.ownerUserId = dto.ownerUserId;
    }
    if (dto.inactivityTimeoutSeconds !== undefined) {
      app.inactivityTimeoutSeconds = dto.inactivityTimeoutSeconds;
    }

    return this.applications.save(app);
  }

  async start(id: string) {
    const app = await this.get(id);
    this.assertRunnable(app);

    await this.setLifecycle(app.id, {
      status: AndroidApplicationStatus.Provisioning,
      lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
      statusMessage: 'Starting redroid container.',
      lastError: null,
    });

    if (!(await this.docker.imageExists(app.redroidImage))) {
      await this.setLifecycle(app.id, {
        lifecycleStage: AndroidApplicationLifecycleStage.ImagePulling,
        statusMessage: `Docker image "${app.redroidImage}" is not available locally. Pulling it now.`,
      });
      await this.docker.pullImage(app.redroidImage, (message) => {
        void this.setLifecycle(app.id, {
          statusMessage: message || `Pulling ${app.redroidImage}.`,
        });
      });
    }

    if (!app.containerId) {
      await this.networkIsolation.createBoundary(app.id, {
        containerName: app.containerName,
        networkName: app.networkName,
        volumeName: app.volumeName,
      });
      const container = await this.docker.createRedroidContainer({
        applicationId: app.id,
        containerName: app.containerName,
        networkName: app.networkName,
        volumeName: app.volumeName,
        image: app.redroidImage,
        dataMountPath: this.config.getOrThrow<string>('app.redroid.dataMountPath'),
        adbPort: app.adbPort,
        privileged: this.config.getOrThrow<boolean>('app.redroid.privileged'),
      });
      app.containerId = container.id;
      await this.applications.save(app);
    }

    await this.docker.startContainer(app.containerId);

    app.status = AndroidApplicationStatus.Running;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Ready;
    app.statusMessage = 'Application is running.';
    app.lastStartedAt = new Date();
    app.lastError = null;
    return this.applications.save(app);
  }

  async stop(id: string) {
    const app = await this.get(id);

    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopping;
    app.statusMessage = 'Stopping redroid container.';
    await this.applications.save(app);

    if (app.containerId) {
      await this.docker.stopContainer(app.containerId);
    }

    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
    app.statusMessage = 'Application is stopped.';
    app.lastStoppedAt = new Date();
    return this.applications.save(app);
  }

  async updateApk(id: string, apk: Express.Multer.File) {
    if (!apk) {
      throw new ConflictException('An APK file is required.');
    }

    const app = await this.get(id);
    this.assertRunnable(app);

    const savedApk = await this.saveApkFile(app.id, apk);
    app.apkFilePath = savedApk.path;
    app.apkOriginalName = apk.originalname;
    await this.applications.save(app);

    if (app.status === AndroidApplicationStatus.Running) {
      await this.setLifecycle(app.id, {
        lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
        statusMessage: 'Installing updated APK.',
      });
      await this.installApk(app);
      await this.setLifecycle(app.id, {
        lifecycleStage: AndroidApplicationLifecycleStage.Ready,
        statusMessage: 'Application is running.',
      });
    }

    return this.applications.save(app);
  }

  async remove(id: string, query: RemoveAndroidApplicationDto) {
    const app = await this.get(id);
    app.status = AndroidApplicationStatus.Removing;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Removing;
    app.statusMessage = 'Removing redroid container and network resources.';
    await this.applications.save(app);

    if (app.containerId) {
      await this.docker.removeContainer(app.containerId);
      app.containerId = null;
    }

    await this.docker.removeNetwork(app.networkName);
    const removeData = query.removeData ?? true;
    if (removeData) {
      await this.docker.removeVolume(app.volumeName);
    }

    await this.applications.remove(app);

    return {
      id,
      deleted: true,
      removedData: removeData,
    };
  }

  async touchScrcpyActivity(id: string) {
    const app = await this.get(id);
    app.lastScrcpyActivityAt = new Date();
    return this.applications.save(app);
  }

  async scrcpySession(id: string, publicBaseUrl?: string): Promise<ScrcpySessionDto> {
    const app = await this.get(id);
    this.assertRunnable(app);

    if (app.status !== AndroidApplicationStatus.Running) {
      throw new ConflictException('Application must be running before opening scrcpy.');
    }

    const baseUrl = publicBaseUrl?.replace(/\/$/, '') ?? '';
    return {
      applicationId: app.id,
      transport: app.scrcpyTransport,
      websocketUrl: `${baseUrl}/scrcpy?applicationId=${app.id}`,
      adbHost: app.containerName,
      adbPort: app.adbPort,
    };
  }

  async findInactiveRunningApplications(now = new Date()) {
    const running = await this.applications.findBy({
      status: AndroidApplicationStatus.Running,
    });

    return running.filter((app) => {
      const lastActivity = app.lastScrcpyActivityAt ?? app.lastStartedAt;
      if (!lastActivity) {
        return false;
      }

      const inactiveSeconds = (now.getTime() - lastActivity.getTime()) / 1000;
      return inactiveSeconds >= app.inactivityTimeoutSeconds;
    });
  }

  private async provision(applicationId: string) {
    try {
      await this.setLifecycle(applicationId, {
        status: AndroidApplicationStatus.Provisioning,
        lifecycleStage: AndroidApplicationLifecycleStage.ImageChecking,
        statusMessage: 'Checking whether the redroid image is available locally.',
        provisioningStartedAt: new Date(),
        lastError: null,
      });

      const app = await this.get(applicationId);

      if (!(await this.docker.imageExists(app.redroidImage))) {
        await this.setLifecycle(applicationId, {
          lifecycleStage: AndroidApplicationLifecycleStage.ImagePulling,
          statusMessage: `Docker image "${app.redroidImage}" is not available locally. Pulling it now.`,
        });

        await this.docker.pullImage(app.redroidImage, (message) => {
          void this.setLifecycle(applicationId, {
            statusMessage: message || `Pulling ${app.redroidImage}.`,
          });
        });
      }

      await this.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.VolumeCreating,
        statusMessage: `Creating persistent data volume ${app.volumeName}.`,
      });
      await this.docker.createVolume(app.id, app.volumeName);

      await this.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.NetworkCreating,
        statusMessage: `Creating isolated internal network ${app.networkName}.`,
      });
      await this.docker.createIsolatedNetwork(app.id, app.networkName);

      await this.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.OrchestratorNetworkConnecting,
        statusMessage: 'Connecting orchestrator to the isolated app network.',
      });
      await this.docker.connectOrchestratorToNetwork(app.networkName);

      await this.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.ContainerCreating,
        statusMessage: `Creating redroid container ${app.containerName}.`,
      });
      const container = await this.docker.createRedroidContainer({
        applicationId: app.id,
        containerName: app.containerName,
        networkName: app.networkName,
        volumeName: app.volumeName,
        image: app.redroidImage,
        dataMountPath: this.config.getOrThrow<string>('app.redroid.dataMountPath'),
        adbPort: app.adbPort,
        privileged: this.config.getOrThrow<boolean>('app.redroid.privileged'),
      });

      await this.applications.update(app.id, {
        containerId: container.id,
      });

      await this.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
        statusMessage: 'Starting redroid container.',
      });
      await this.docker.startContainer(container.id);
      await this.applications.update(app.id, {
        lastStartedAt: new Date(),
      });

      if (app.apkFilePath) {
        await this.setLifecycle(applicationId, {
          lifecycleStage: AndroidApplicationLifecycleStage.AndroidBooting,
          statusMessage: 'Waiting for Android to finish booting before APK install.',
        });
        await this.installApk({ ...app, containerId: container.id });
      }

      await this.setLifecycle(applicationId, {
        status: AndroidApplicationStatus.Running,
        lifecycleStage: AndroidApplicationLifecycleStage.Ready,
        statusMessage: 'Application is running.',
        provisioningCompletedAt: new Date(),
        lastError: null,
      });
    } catch (error) {
      const message = this.errorMessage(error);
      this.logger.error(`Provisioning failed for ${applicationId}: ${message}`);
      await this.setLifecycle(applicationId, {
        status: AndroidApplicationStatus.Error,
        lifecycleStage: AndroidApplicationLifecycleStage.Error,
        statusMessage: message,
        lastError: message,
      });
    }
  }

  private async saveApkFile(applicationId: string, apk: Express.Multer.File) {
    const uploadsDir = this.config.getOrThrow<string>('app.uploadsDir');
    await mkdir(uploadsDir, { recursive: true });

    const extension = extname(apk.originalname) || '.apk';
    const path = join(uploadsDir, `${applicationId}-${randomUUID()}${extension}`);
    await writeFile(path, apk.buffer);

    return { path };
  }

  private async installApk(app: AndroidApplication) {
    if (!app.containerId || !app.apkFilePath) {
      throw new InternalServerErrorException('Container and APK are required.');
    }

    const targetDir = '/data/local/tmp';
    const targetName = `${app.id}.apk`;

    await this.docker.copyFileToContainer(app.containerId, app.apkFilePath, targetDir, targetName);
    await this.waitForAndroidBoot(app.containerId);
    await this.setLifecycle(app.id, {
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
      statusMessage: 'Installing APK inside Android.',
    });
    await this.docker.execInContainer(app.containerId, [
      'sh',
      '-lc',
      `pm install -r ${targetDir}/${targetName}`,
    ]);
  }

  private async waitForAndroidBoot(containerId: string) {
    await this.docker.execInContainer(containerId, [
      'sh',
      '-lc',
      'i=0; while [ "$i" -lt 60 ]; do [ "$(getprop sys.boot_completed 2>/dev/null)" = "1" ] && exit 0; i=$((i+1)); sleep 2; done; exit 1',
    ]);
  }

  private assertRunnable(app: AndroidApplication) {
    if (app.status === AndroidApplicationStatus.Removed) {
      throw new ConflictException('Removed applications cannot be started or updated.');
    }
  }

  private async setLifecycle(
    applicationId: string,
    patch: Partial<
      Pick<
        AndroidApplication,
        | 'status'
        | 'lifecycleStage'
        | 'statusMessage'
        | 'lastError'
        | 'provisioningStartedAt'
        | 'provisioningCompletedAt'
      >
    >,
  ) {
    await this.applications.update(applicationId, patch);
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    this.logger.error(error);
    return 'Unknown error';
  }
}
