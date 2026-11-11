import type { ConfigService } from '@nestjs/config';
import type Dockerode from 'dockerode';
import { PassThrough } from 'node:stream';
import type { DockerEnginePort } from '../../contracts/docker-engine.port';
import type { DockerGappsWorkerRequest } from '../../contracts/docker-gapps-worker.port';
import { DockerOperationExecutor } from '../../engine/services/docker-operation-executor.service';
import { DockerGappsWorkerService } from './docker-gapps-worker.service';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const setup = (timeoutMs = 60_000) => {
  const logs = new PassThrough();
  const archive = new PassThrough();
  const container = {
    id: 'worker',
    start: jest.fn().mockResolvedValue(undefined),
    logs: jest.fn().mockResolvedValue(logs),
    wait: jest.fn().mockResolvedValue({ StatusCode: 0 }),
    getArchive: jest.fn().mockResolvedValue(archive),
    kill: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const createContainer = jest.fn().mockResolvedValue(container);
  const docker = { createContainer } as unknown as Dockerode;
  const executor = new DockerOperationExecutor(
    {} as never,
    {
      configure: jest.fn(),
      queueDockerOperation: jest.fn(),
      observe: (...args: unknown[]) =>
        (args.at(-1) as () => Promise<unknown>)(),
    } as never,
  );
  executor.configure({
    transport: 'local-socket',
    maxConcurrentReads: 1,
    maxConcurrentLongOperations: 1,
    slowRequestWarningMs: 60_000,
    longOperationTimeoutMs: timeoutMs,
    remoteRequestTimeoutMs: 60_000,
  });
  const engine: Pick<DockerEnginePort, 'longOperation' | 'isDockerNotFound'> = {
    longOperation: (name, description, operation, _timeout, options) =>
      executor.longOperation(
        name,
        description,
        docker,
        operation,
        timeoutMs,
        options,
      ),
    isDockerNotFound: () => false,
  };
  const worker = new DockerGappsWorkerService(
    engine as DockerEnginePort,
    {
      getOrThrow: () => 60_000,
    } as unknown as ConfigService,
  );
  const cancellation = new AbortController();
  const request: DockerGappsWorkerRequest = {
    image: 'worker:test',
    jobId: 'job-1',
    sourceRepository: 'repo',
    sourceRevision: 'revision',
    signal: cancellation.signal,
    onLog: jest.fn(),
    consumeArchive: jest.fn(),
  };
  return {
    worker,
    request,
    container,
    logs,
    archive,
    createContainer,
    cancellation,
    executor,
    docker,
  };
};

describe('DockerGappsWorkerService cancellation and cleanup', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not create a container after cancellation before admission', async () => {
    const { worker, request, cancellation, createContainer } = setup();
    cancellation.abort(new Error('job cancelled'));
    await expect(worker.run(request)).rejects.toThrow('job cancelled');
    expect(createContainer).not.toHaveBeenCalled();
  });

  it('holds its operation slot until a late create is removed after timeout', async () => {
    jest.useFakeTimers();
    const { worker, request, container, createContainer, executor, docker } =
      setup(10);
    const entered = deferred();
    const release = deferred();
    createContainer.mockImplementation(async () => {
      entered.resolve();
      await release.promise;
      return container;
    });
    const rejected = expect(worker.run(request)).rejects.toThrow(
      'timed out after 10ms',
    );
    await entered.promise;
    await jest.advanceTimersByTimeAsync(10);
    const nextOperation = jest.fn().mockResolvedValue(undefined);
    const next = executor.longOperation(
      'next',
      'Next operation',
      docker,
      nextOperation,
    );
    expect(executor.hasPendingDockerWork).toBe(true);
    expect(nextOperation).not.toHaveBeenCalled();
    release.resolve();
    await rejected;
    await next;
    expect(container.start).not.toHaveBeenCalled();
    expect(container.remove).toHaveBeenCalledWith(
      expect.objectContaining({ force: true }),
    );
    expect(container.remove.mock.invocationCallOrder[0]).toBeLessThan(
      nextOperation.mock.invocationCallOrder[0],
    );
  });

  it('force-removes the worker when cancellation interrupts wait and kill fails', async () => {
    const { worker, request, cancellation, container, logs } = setup();
    const entered = deferred();
    container.kill.mockRejectedValue(new Error('kill failed'));
    container.wait.mockImplementation(() => {
      entered.resolve();
      return new Promise(() => undefined);
    });
    const rejected = expect(worker.run(request)).rejects.toThrow(
      'job cancelled',
    );
    await entered.promise;
    cancellation.abort(new Error('job cancelled'));
    await rejected;
    expect(container.kill).toHaveBeenCalled();
    expect(container.remove).toHaveBeenCalledWith(
      expect.objectContaining({ force: true }),
    );
    expect(logs.destroyed).toBe(true);
    expect(container.getArchive).not.toHaveBeenCalled();
  });

  it('closes the archive and removes the container on cancellation during transfer', async () => {
    const { worker, request, cancellation, container, archive } = setup();
    const entered = deferred();
    request.consumeArchive = (_stream, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        });
        entered.resolve();
      });
    const rejected = expect(worker.run(request)).rejects.toThrow(
      'job cancelled',
    );
    await entered.promise;
    cancellation.abort(new Error('job cancelled'));
    await rejected;
    expect(archive.destroyed).toBe(true);
    expect(container.remove).toHaveBeenCalledWith(
      expect.objectContaining({ force: true }),
    );
  });

  it('reports a force-cleanup failure after a successful worker exit', async () => {
    const { worker, request, container } = setup();
    container.remove.mockRejectedValue(new Error('cleanup failed'));
    await expect(worker.run(request)).rejects.toThrow('cleanup failed');
    expect(request.consumeArchive).toHaveBeenCalled();
  });
});
