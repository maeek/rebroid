import type { Repository } from 'typeorm';
import { ContainerImageBuildJob } from '../entities/container-image-build-job.entity';
import { ContainerImageBuildJobService } from './container-image-build-job.service';

describe('ContainerImageBuildJobService', () => {
  it('selects the oldest queued GApps patch job', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as Repository<ContainerImageBuildJob>;
    const service = new ContainerImageBuildJobService(repository);

    await service.findNextQueuedGappsJob();

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { status: 'queued', buildKind: 'redroid_gapps_patch' },
      order: { createdAt: 'ASC' },
    });
  });

  it('marks interrupted running GApps jobs failed after restart', async () => {
    const interrupted = {
      id: 'job-1',
      status: 'running',
      phase: 'building_gapps',
      logTail: 'running',
      finishedAt: null,
      error: null,
    } as ContainerImageBuildJob;
    const repository = {
      find: jest.fn().mockResolvedValue([interrupted]),
      findOneBy: jest.fn().mockResolvedValue(interrupted),
      update: jest.fn(
        async (_criteria: unknown, patch: Partial<ContainerImageBuildJob>) => {
          Object.assign(interrupted, patch);
          return { affected: 1, raw: [], generatedMaps: [] };
        },
      ),
    } as unknown as Repository<ContainerImageBuildJob>;
    const service = new ContainerImageBuildJobService(repository);

    await service.failInterruptedGappsJobs();

    expect(interrupted.status).toBe('failed');
    expect(interrupted.error).toBe(
      'Build interrupted by orchestrator restart.',
    );
    expect(interrupted.finishedAt).toBeInstanceOf(Date);
  });

  it('moves successful jobs to the complete phase', async () => {
    const job = {
      id: 'job-2',
      status: 'running',
      phase: 'validating_image',
      logTail: '',
    } as ContainerImageBuildJob;
    const repository = {
      findOneBy: jest.fn().mockImplementation(async () => job),
      update: jest.fn(
        async (_criteria: unknown, patch: Partial<ContainerImageBuildJob>) => {
          Object.assign(job, patch);
          return { affected: 1, raw: [], generatedMaps: [] };
        },
      ),
    } as unknown as Repository<ContainerImageBuildJob>;
    const service = new ContainerImageBuildJobService(repository);

    await service.markSucceeded(job, 'sha256:image');

    expect(job.status).toBe('succeeded');
    expect(job.phase).toBe('complete');
    expect(job.imageId).toBe('sha256:image');
  });
});
