import { PassThrough } from 'node:stream';
import type Dockerode from 'dockerode';
import { OperationDeadline } from '../../../common/operation-deadline';
import { DockerEngineService } from '../../docker-engine.service';
import { DockerOperationExecutor } from '../../engine/services/docker-operation-executor.service';
import { DockerErrorClassifier } from '../../engine/services/docker-error-classifier.service';
import { DockerMetricsObserver } from '../../engine/services/docker-metrics-observer.service';
import { MetricsService } from '../../../metrics/metrics.service';
import type { DockerOperationOptions } from '../../contracts/docker-operation-options';
import { DockerContainerExecService } from './docker-container-exec.service';

function setup() {
  const stream = new PassThrough();
  const exec = {
    start: jest.fn(async (options: { abortSignal: AbortSignal }) => {
      options.abortSignal.throwIfAborted();
      return stream;
    }),
    inspect: jest.fn().mockResolvedValue({ ExitCode: 0, Running: false }),
  };
  const create = jest.fn().mockResolvedValue(exec);
  const docker = {
    getContainer: () => ({ exec: create }),
    modem: { demuxStream: () => stream.resume() },
  } as unknown as Dockerode;
  const errors = new DockerErrorClassifier();
  const executor = new DockerOperationExecutor(
    errors,
    new DockerMetricsObserver(new MetricsService(), errors),
  );
  executor.configure({
    transport: 'local-socket',
    maxConcurrentReads: 1,
    maxConcurrentLongOperations: 1,
    slowRequestWarningMs: 60_000,
    longOperationTimeoutMs: 30_000,
    remoteRequestTimeoutMs: 15_000,
  });
  const engine = {
    longOperation: <T>(
      name: string,
      description: string,
      operation: (docker: Dockerode, signal: AbortSignal) => Promise<T>,
      timeoutMs?: number,
      options?: DockerOperationOptions & { waitForCleanup?: boolean },
    ) =>
      executor.longOperation(
        name,
        description,
        docker,
        operation,
        timeoutMs,
        options,
      ),
  } as unknown as DockerEngineService;
  return {
    service: new DockerContainerExecService(engine),
    executor,
    docker,
    create,
    exec,
    stream,
  };
}

describe('Docker exec startup deadlines', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('computes a bounded guest command from the budget left after queue residence', async () => {
    const { service, executor, docker, create, stream } = setup();
    let release!: () => void;
    const first = executor.longOperation(
      'first',
      'First',
      docker,
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await jest.advanceTimersByTimeAsync(0);
    const onDispatched = jest.fn();
    const command = service.execInContainer(
      'container',
      ['sh', '-lc', 'start adbd'],
      {
        deadline: new OperationDeadline(10_000),
        guestTimeoutMs: 10_000,
        onDispatched,
      },
    );
    await jest.advanceTimersByTimeAsync(2_000);
    expect(create).not.toHaveBeenCalled();
    expect(onDispatched).not.toHaveBeenCalled();
    release();
    await first;
    await jest.advanceTimersByTimeAsync(0);
    expect(onDispatched).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].Cmd).toEqual([
      'timeout',
      '-k',
      '1s',
      '7s',
      'sh',
      '-lc',
      'start adbd',
    ]);
    stream.end();
    await command;
  });

  it('keeps a cancelled admitted guest mutation owned until its stream exits', async () => {
    const { service, exec, stream } = setup();
    const controller = new AbortController();
    let settled = false;
    const command = service.execInContainer(
      'container',
      ['sh', '-lc', 'start adbd'],
      {
        guestTimeoutMs: 1_000,
        signal: controller.signal,
      },
    );
    const result = command
      .catch((error: unknown) => error)
      .finally(() => {
        settled = true;
      });
    await jest.advanceTimersByTimeAsync(0);
    const reason = new Error('cancelled');
    controller.abort(reason);
    await jest.advanceTimersByTimeAsync(100);
    expect(exec.start.mock.calls[0][0].abortSignal.aborted).toBe(false);
    expect(settled).toBe(false);
    stream.end();
    expect(await result).toBe(reason);
  });

  it('bounds an uncertain guest start and drains its guest kill allowance', async () => {
    const { service, exec } = setup();
    exec.start.mockImplementation(
      ({ abortSignal }) =>
        new Promise((_resolve, reject) => {
          abortSignal.addEventListener(
            'abort',
            () => reject(abortSignal.reason),
            { once: true },
          );
        }),
    );
    let settled = false;
    const command = service.execInContainer(
      'container',
      ['sh', '-lc', 'start adbd'],
      { guestTimeoutMs: 1_000 },
    );
    const result = command
      .catch((error: unknown) => error)
      .finally(() => {
        settled = true;
      });
    await jest.advanceTimersByTimeAsync(3_000);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(2_000);
    expect(await result).toBeInstanceOf(Error);
    expect(settled).toBe(true);
  });
});

it('keeps timeoutMs-only exec execution-scoped for legacy callers', async () => {
  jest.useFakeTimers();
  try {
    const { service, executor, docker, create, stream } = setup();
    let release!: () => void;
    const first = executor.longOperation(
      'first',
      'First',
      docker,
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await jest.advanceTimersByTimeAsync(0);
    const command = service.execInContainer('container', ['legacy-command'], {
      timeoutMs: 1_000,
    });
    const result = expect(command).resolves.toBeUndefined();
    await jest.advanceTimersByTimeAsync(2_000);
    expect(create).not.toHaveBeenCalled();
    release();
    await first;
    await jest.advanceTimersByTimeAsync(500);
    expect(create.mock.calls[0][0].Cmd).toEqual(['legacy-command']);
    stream.end();
    await result;
  } finally {
    jest.useRealTimers();
  }
});
