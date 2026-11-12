import { DataSource, type Repository } from 'typeorm';
import { InitializeSqliteSchema1800000005000 } from '../../database/migrations/1800000005000-initialize-sqlite-schema';
import { ContainerImageBuildJob } from '../entities/container-image-build-job.entity';
import { ContainerImageBuildJobService } from './container-image-build-job.service';

describe('ContainerImageBuildJobService', () => {
  it('prunes old build logs and results while keeping the latest result per image and active jobs', async () => {
    const database = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [ContainerImageBuildJob],
      migrations: [InitializeSqliteSchema1800000005000],
      migrationsRun: true,
    }).initialize();
    try {
      const repository = database.getRepository(ContainerImageBuildJob);
      const older = '2026-09-01 00:00:00.000';
      const old = '2026-09-02 00:00:00.000';
      const cutoff = '2026-10-01 00:00:00.000';
      const service = new ContainerImageBuildJobService(repository);
      const rows = [
        ['old-success', 'succeeded', older],
        ['old-failure', 'failed', older],
        ['latest-result', 'failed', old],
        ['active-cancellation', 'cancelled', older],
        ['queued', 'queued', null],
        ['running', 'running', null],
        ['legacy', 'failed', null],
        ['only-result', 'cancelled', old, 'test:other'],
        ['at-cutoff', 'failed', cutoff, 'test:new'],
        ['newer-result', 'succeeded', '2026-10-02 00:00:00.000', 'test:new'],
      ];
      for (const [id, status, finishedAt, targetImage = 'test:image'] of rows) {
        await database.query(
          `INSERT INTO container_image_build_jobs
            (id, status, finishedAt, targetImage, baseImage, dockerfile, logTail, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, 'test:base', 'FROM test:base', 'Build output.', ?, ?)`,
          [id, status, finishedAt, targetImage, older, older],
        );
      }

      await expect(
        service.pruneHistory(new Date('2026-10-01T00:00:00Z'), [
          'active-cancellation',
        ]),
      ).resolves.toBe(3);
      const remaining = await repository.find({ order: { id: 'ASC' } });
      expect(remaining.map((job) => job.id)).toEqual([
        'active-cancellation',
        'at-cutoff',
        'latest-result',
        'newer-result',
        'only-result',
        'queued',
        'running',
      ]);
    } finally {
      await database.destroy();
    }
  });

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
