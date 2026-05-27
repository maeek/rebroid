import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AndroidApplication } from '../../../android-apps/android-application.entity';
import { DockerPlatformContainersService } from '../../../docker/containers/services/docker-platform-containers.service';
import { PlatformContainer } from '../../../docker/docker.types';

@ApiTags('docker-maintenance')
@Controller('docker-maintenance/containers')
export class DockerMaintenanceContainersController {
  constructor(
    private readonly containers: DockerPlatformContainersService,
    @InjectRepository(AndroidApplication)
    private readonly applications: Repository<AndroidApplication>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List Docker containers visible to the platform.' })
  @ApiOkResponse({
    schema: {
      example: [
        {
          id: 'f00ba4...',
          shortId: 'f00ba4',
          names: ['rebroid-example-runtime'],
          image: 'redroid/redroid:13.0.0-latest',
          state: 'running',
          status: 'Up 2 minutes',
          managed: true,
          applicationId: 'android-application-id',
          networks: ['rebroid-example'],
        },
      ],
    },
  })
  async listContainers() {
    return this.markOrphaned(await this.containers.listPlatformContainers());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read Docker container details and relationships.' })
  async getContainer(@Param('id') id: string) {
    const details = await this.containers.getPlatformContainerDetails(id);
    const [container] = await this.markOrphaned([details.container]);
    return { ...details, container };
  }

  @Get(':id/logs')
  @ApiOperation({
    summary: 'Read recent Docker logs for a platform container.',
  })
  getContainerLogs(@Param('id') id: string, @Query('tail') tail?: string) {
    return this.containers.getPlatformContainerLogs(
      id,
      tail ? Number(tail) : undefined,
    );
  }

  @Post(':id/stop')
  @ApiOperation({ summary: 'Stop a Docker container.' })
  stopContainer(@Param('id') id: string) {
    return this.containers.stopPlatformContainer(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a Docker container.' })
  removeContainer(@Param('id') id: string, @Query('force') force?: string) {
    return this.containers.removePlatformContainer(id, force === 'true');
  }

  private async markOrphaned(containers: PlatformContainer[]) {
    const appIds = [
      ...new Set(
        containers
          .filter((container) => container.managed && container.applicationId)
          .map((container) => container.applicationId as string),
      ),
    ];
    if (!appIds.length) {
      return containers;
    }

    const existing = new Set(
      (
        await this.applications.find({
          select: { id: true },
          where: { id: In(appIds) },
        })
      ).map((app) => app.id),
    );

    return containers.map((container) => ({
      ...container,
      orphaned:
        container.managed &&
        Boolean(container.applicationId) &&
        !existing.has(container.applicationId as string),
    }));
  }
}
