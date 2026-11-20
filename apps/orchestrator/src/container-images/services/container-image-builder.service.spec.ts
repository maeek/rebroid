import { ContainerImageBuilderService } from './container-image-builder.service';
import type { ContainerImageBuildJob } from '../entities/container-image-build-job.entity';
import type { ContainerImageBuildJobService } from './container-image-build-job.service';

it('fails and releases a Dockerfile build if the initial phase write fails', async () => {
  const job = {
    id: 'job-1',
    status: 'queued',
  } as ContainerImageBuildJob;
  const jobs = {
    createQueuedJob: jest.fn().mockResolvedValue(job),
    getJob: jest.fn().mockResolvedValue(job),
    markRunning: jest.fn(async () => {
      job.status = 'running';
      return job;
    }),
    updateGappsDetails: jest
      .fn()
      .mockRejectedValue(new Error('phase write failed')),
    markFailed: jest.fn(async () => {
      job.status = 'failed';
      return job;
    }),
  } satisfies Partial<ContainerImageBuildJobService>;
  const builder = new ContainerImageBuilderService(
    jobs as unknown as ContainerImageBuildJobService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { assertEnabled: jest.fn() } as never,
  );

  await builder.startBuild({
    name: 'Test build',
    targetImage: 'local/target:latest',
    baseImage: 'local/base:latest',
    dockerfile: 'FROM local/base:latest',
  });
  await new Promise<void>((resolve) => setImmediate(resolve));

  expect(jobs.markFailed).toHaveBeenCalledWith(job, 'phase write failed');
  expect(job.status).toBe('failed');
  expect(builder.activeBuildIds()).toEqual([]);
});
