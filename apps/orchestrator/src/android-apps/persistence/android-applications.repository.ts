import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AndroidApplication } from '../android-application.entity';
import { AndroidApplicationStatus } from '../contracts/android-application-status';
import { ListAndroidApplicationsDto } from '../common/dto/list-android-applications.dto';

@Injectable()
export class AndroidApplicationsRepository {
  constructor(
    @InjectRepository(AndroidApplication)
    private readonly applications: Repository<AndroidApplication>,
  ) {}

  create(values: Partial<AndroidApplication>) {
    return this.applications.create(values);
  }

  save(app: AndroidApplication) {
    return this.applications.save(app);
  }

  remove(app: AndroidApplication) {
    return this.applications.remove(app);
  }

  updateLifecycle(
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
    return this.applications.update(applicationId, patch);
  }

  findForList(query: ListAndroidApplicationsDto) {
    return this.applications.find({
      where: query.ownerUserId ? { ownerUserId: query.ownerUserId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  findAll() {
    return this.applications.find();
  }

  findById(id: string) {
    return this.applications.findOneBy({ id });
  }

  findByStatus(status: AndroidApplicationStatus) {
    return this.applications.findBy({ status });
  }

  async findExistingIds(ids: string[]) {
    if (!ids.length) {
      return new Set<string>();
    }

    const applications = await this.applications.find({
      select: { id: true },
      where: { id: In(ids) },
    });
    return new Set(applications.map((app) => app.id));
  }

  findRunningWithNetworkPolicy() {
    return this.applications.find({
      where: {
        status: AndroidApplicationStatus.Running,
        networkPolicyEnabled: true,
      },
    });
  }

  countUsingUploadedApk(uploadedApkId: string) {
    return this.applications.countBy({ uploadedApkId });
  }

  async findReferencedUploadedApkIds(uploadedApkIds: string[]) {
    if (!uploadedApkIds.length) {
      return new Set<string>();
    }

    const applications = await this.applications.find({
      select: { uploadedApkId: true },
      where: { uploadedApkId: In(uploadedApkIds) },
    });
    return new Set(
      applications.map((app) => app.uploadedApkId).filter(Boolean),
    );
  }
}
