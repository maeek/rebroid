import { Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { SerializedSqliteDataSource } from '../../database/serialized-sqlite-data-source';
import { InitializeSqliteSchema1800000005000 } from '../../database/migrations/1800000005000-initialize-sqlite-schema';
import { ContainerImageBuildJob } from '../entities/container-image-build-job.entity';
import { ContainerImageBuildRecipe } from '../entities/container-image-build-recipe.entity';
import { ContainerImageBuildJobService } from './container-image-build-job.service';

const openDatabase = () =>
  new SerializedSqliteDataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [ContainerImageBuildJob, ContainerImageBuildRecipe],
    migrations: [InitializeSqliteSchema1800000005000],
    migrationsRun: true,
  }).initialize();

const insertJob = (
  database: SerializedSqliteDataSource,
  id: string,
  status: ContainerImageBuildJob['status'],
  buildKind: ContainerImageBuildJob['buildKind'] = 'dockerfile_overlay',
  createdAt = '2026-09-01 00:00:00.000',
) =>
  database.query(
    `INSERT INTO container_image_build_jobs
      (id, status, buildKind, targetImage, baseImage, dockerfile, logTail, createdAt, updatedAt)
     VALUES (?, ?, ?, 'test:image', 'test:base', 'FROM test:base', 'Build queued.', ?, ?)`,
    [id, status, buildKind, createdAt, createdAt],
  );

describe('ContainerImageBuildJobService', () => {
  it('persists build definitions using their repository defaults', async () => {
    const database = await openDatabase();
    try {
      const definition = {
        targetImage: 'test:image',
        baseImage: 'test:base',
        dockerfile: 'FROM test:base',
      };
      const recipes = database.getRepository(ContainerImageBuildRecipe);
      const recipe = await recipes.save({ ...definition, name: 'test recipe' });
      const jobs = database.getRepository(ContainerImageBuildJob);
      const job = await jobs.save({ ...definition, recipeId: recipe.id });

      await expect(
        recipes.findOneByOrFail({ id: recipe.id }),
      ).resolves.toMatchObject({
        contextFileIdsJson: '[]',
      });
      await expect(jobs.findOneByOrFail({ id: job.id })).resolves.toMatchObject(
        {
          contextFileIdsJson: '[]',
          logTail: '',
          validationResults: {},
        },
      );
    } finally {
      await database.destroy();
    }
  });

  it('prunes old build logs and results while keeping the latest result per image and active jobs', async () => {
    const database = await openDatabase();
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

  it('finds the latest build of a kind outside the recent builds window', async () => {
    const database = await openDatabase();
    try {
      const service = new ContainerImageBuildJobService(
        database.getRepository(ContainerImageBuildJob),
      );
      await expect(
        service.findLatestJob('redroid_gapps_patch'),
      ).resolves.toBeNull();
      await insertJob(database, 'gapps', 'queued', 'redroid_gapps_patch');
      for (let index = 0; index < 50; index += 1) {
        await insertJob(
          database,
          `overlay-${index}`,
          'succeeded',
          'dockerfile_overlay',
          '2026-09-02 00:00:00.000',
        );
      }

      await expect(
        service.findLatestJob('redroid_gapps_patch'),
      ).resolves.toMatchObject({ id: 'gapps', status: 'queued' });
      await expect(
        service.findLatestJob('dockerfile_overlay'),
      ).resolves.toMatchObject({ id: 'overlay-49' });
    } finally {
      await database.destroy();
    }
  });

  it('keeps concurrent and later progress when a build is terminalized', async () => {
    const database = await openDatabase();
    try {
      const service = new ContainerImageBuildJobService(
        database.getRepository(ContainerImageBuildJob),
      );
      await insertJob(database, 'build', 'queued');
      const queued = await service.getJob('build');
      await service.markRunning(queued);
      const running = await service.getJob('build');
      await Promise.all([
        service.appendLog('build', 'First progress update'),
        service.appendLog('build', 'Second progress update'),
      ]);
      const result = await service.markSucceeded(running, 'sha256:image');
      expect(result).toMatchObject({
        status: 'succeeded',
        phase: 'complete',
        imageId: 'sha256:image',
        logTail: [
          'Build queued.',
          'Build started.',
          'First progress update',
          'Second progress update',
          'Build succeeded: sha256:image',
        ].join('\n'),
      });

      await service.appendLog('build', 'Too late');
      await expect(service.getJob('build')).resolves.toMatchObject({
        logTail: result.logTail,
      });
    } finally {
      await database.destroy();
    }
  });

  it('claims a queued job once and keeps cancellation terminal', async () => {
    const database = await openDatabase();
    try {
      const service = new ContainerImageBuildJobService(
        database.getRepository(ContainerImageBuildJob),
      );
      await insertJob(database, 'build', 'queued');
      const queued = await service.getJob('build');
      await expect(service.markRunning(queued)).resolves.toBe(true);
      await expect(service.markRunning(queued)).resolves.toBe(false);
      await service.updateBuildDetails(queued.id, {
        phase: 'validating_payload',
        mindTheGappsRevision: 'source-revision',
        validationResults: { payload: { valid: true } },
      });
      await expect(service.markCancelled(queued)).resolves.toMatchObject({
        status: 'cancelled',
      });
      await expect(
        service.updateBuildDetails(queued.id, { phase: 'building_image' }),
      ).rejects.toThrow('no longer running');
      await expect(service.markRunning(queued)).resolves.toBe(false);
      await expect(
        service.markSucceeded(queued, 'sha256:ignored'),
      ).resolves.toMatchObject({
        status: 'cancelled',
        phase: 'validating_payload',
        mindTheGappsRevision: 'source-revision',
        validationResults: { payload: { valid: true } },
        imageId: null,
      });
    } finally {
      await database.destroy();
    }
  });

  it('fails interrupted builds on restart, keeps queued GApps jobs, and bounds the log tail', async () => {
    const database = await openDatabase();
    try {
      const service = new ContainerImageBuildJobService(
        database.getRepository(ContainerImageBuildJob),
      );
      await insertJob(database, 'job-1', 'running', 'redroid_gapps_patch');
      await insertJob(
        database,
        'queued-gapps',
        'queued',
        'redroid_gapps_patch',
      );
      await insertJob(database, 'queued-overlay', 'queued');
      await insertJob(database, 'running-overlay', 'running');
      await insertJob(database, 'completed-overlay', 'succeeded');
      await service.appendLog('job-1', '🙂'.repeat(31_000));

      await service.failInterruptedJobs();

      const interrupted = await service.getJob('job-1');
      expect(interrupted.status).toBe('failed');
      expect(interrupted.error).toBe(
        'Build interrupted by orchestrator restart.',
      );
      expect(interrupted.finishedAt).toBeInstanceOf(Date);
      expect(interrupted.logTail).toHaveLength(60_000);
      expect(interrupted.logTail).toMatch(
        /Build failed: Build interrupted by orchestrator restart\.$/,
      );
      for (const id of ['queued-overlay', 'running-overlay']) {
        await expect(service.getJob(id)).resolves.toMatchObject({
          status: 'failed',
          error: interrupted.error,
          finishedAt: expect.any(Date),
        });
      }
      await expect(service.findNextQueuedGappsJob()).resolves.toMatchObject({
        id: 'queued-gapps',
      });
      await expect(service.getJob('completed-overlay')).resolves.toMatchObject({
        status: 'succeeded',
      });
    } finally {
      await database.destroy();
    }
  });

  it('reports a failed background progress write without rejecting the callback', async () => {
    const service = new ContainerImageBuildJobService(
      {} as Repository<ContainerImageBuildJob>,
    );
    const appendLog = jest
      .spyOn(service, 'appendLog')
      .mockRejectedValue(new Error('SQLite write failed'));
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    try {
      expect(service.recordProgress('build', 'Step 1')).toBeUndefined();
      await Promise.resolve();
      expect(appendLog).toHaveBeenCalledWith('build', 'Step 1');
      expect(warn).toHaveBeenCalledWith(
        'Could not save progress for image build build: SQLite write failed',
      );
    } finally {
      warn.mockRestore();
    }
  });
});
