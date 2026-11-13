import { Logger } from '@nestjs/common';
import {
  OperationDeadline,
  OperationDeadlineExceededError,
} from '../../../common/operation-deadline';
import type { DockerContainerExecService } from '../../containers/services/docker-container-exec.service';
import type { DockerEngineService } from '../../docker-engine.service';
import {
  ContainerCommandFailedException,
  type ContainerCommandResult,
} from '../../docker.types';
import { DockerSidecarAdbService } from './docker-sidecar-adb.service';

const success = (stdout = ''): ContainerCommandResult => ({
  stdout,
  stderr: '',
  exitCode: 0,
});

const target = '172.20.0.3:5555';
const connect = 'connected to ' + target;
const device = 'device\n';
const timeout = new ContainerCommandFailedException({
  message: 'ADB command timed out',
  command: ['adb', 'connect', target],
  exitCode: 124,
  stdout: '',
  stderr: '',
});
const missing = new ContainerCommandFailedException({
  message: 'ADB device not found',
  command: ['adb', '-s', target, 'get-state'],
  exitCode: 1,
  stdout: '',
  stderr: `error: device '${target}' not found`,
});

describe(DockerSidecarAdbService.name, () => {
  const exec = jest.fn<
    ReturnType<DockerContainerExecService['execInContainerWithOutput']>,
    Parameters<DockerContainerExecService['execInContainerWithOutput']>
  >();
  const service = new DockerSidecarAdbService(
    { errorMessage: String } as unknown as DockerEngineService,
    {
      execInContainerWithOutput: exec,
    } as unknown as DockerContainerExecService,
  );
  const prepare = () => service.prepareTarget('sidecar', '172.20.0.3', 5555);
  const commands = () =>
    exec.mock.calls.map(([, command]) => command.join(' '));

  beforeEach(() => exec.mockReset());
  afterEach(() => jest.restoreAllMocks());

  it('does not wake the screen or change settings for transport-only preparation', async () => {
    exec.mockResolvedValueOnce(success(device));
    await expect(
      service.prepareTarget(
        'sidecar',
        '172.20.0.3',
        5555,
        undefined,
        undefined,
        'transport',
      ),
    ).resolves.toMatchObject({ connected: true });
    expect(commands()).toEqual([
      expect.stringContaining(`adb -s ${target} get-state`),
    ]);
  });

  it('reuses a healthy transport and records timings without a deadline', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});
    exec
      .mockResolvedValueOnce(success(device))
      .mockResolvedValueOnce(success());

    await expect(prepare()).resolves.toMatchObject({ connected: true });
    expect(commands()).toEqual([
      expect.stringContaining(`adb -s ${target} get-state`),
      expect.stringContaining(`adb -s '${target}' shell`),
    ]);
    expect(log).toHaveBeenCalledWith({
      event: 'display_sidecar_adb_preparation',
      target,
      outcome: 'reused',
      stepMs: { initialState: expect.any(Number), display: expect.any(Number) },
      elapsedMs: expect.any(Number),
    });
  });

  it('connects and verifies a missing transport without disconnecting first', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});
    exec
      .mockRejectedValueOnce(missing)
      .mockResolvedValueOnce(success())
      .mockResolvedValueOnce(success(connect))
      .mockResolvedValueOnce(success(device))
      .mockResolvedValueOnce(success());

    await expect(prepare()).resolves.toMatchObject({ connected: true });
    expect(commands()).toEqual([
      expect.stringContaining(`adb -s ${target} get-state`),
      expect.stringContaining('net.createConnection'),
      expect.stringContaining(`adb connect '${target}'`),
      expect.stringContaining(`adb -s '${target}' get-state`),
      expect.stringContaining(`adb -s '${target}' shell`),
    ]);
    expect(commands().join('\n')).not.toContain('adb disconnect');
    expect(log).toHaveBeenCalledWith({
      event: 'display_sidecar_adb_preparation',
      target,
      outcome: 'reconnected',
      stepMs: {
        initialState: expect.any(Number),
        tcp: expect.any(Number),
        connect: expect.any(Number),
        state: expect.any(Number),
        display: expect.any(Number),
      },
      elapsedMs: expect.any(Number),
    });
  });

  it('recovers the offline transport when a replacement reuses the same address', async () => {
    exec
      .mockResolvedValueOnce(success(device))
      .mockResolvedValueOnce(success())
      .mockResolvedValueOnce(success('offline'))
      .mockResolvedValueOnce(success())
      .mockResolvedValueOnce(success('already connected to ' + target))
      .mockRejectedValueOnce(
        new ContainerCommandFailedException({
          message: 'ADB device offline',
          command: ['adb', '-s', target, 'get-state'],
          exitCode: 1,
          stdout: 'error: device offline',
          stderr: '',
        }),
      )
      .mockResolvedValueOnce(success(`${connect}\n${device}`))
      .mockResolvedValueOnce(success());

    await expect(prepare()).resolves.toMatchObject({ connected: true });
    await expect(prepare()).resolves.toMatchObject({ connected: true });

    expect(commands()).toEqual([
      expect.stringContaining(`adb -s ${target} get-state`),
      expect.stringContaining(`adb -s '${target}' shell`),
      expect.stringContaining(`adb -s ${target} get-state`),
      expect.stringContaining('net.createConnection'),
      expect.stringContaining(`adb connect '${target}'`),
      expect.stringContaining(`adb -s '${target}' get-state`),
      expect.stringContaining(`adb -s '${target}' wait-for-device`),
      expect.stringContaining(`adb -s '${target}' shell`),
    ]);
    expect(commands()[6]).toContain(`adb disconnect '${target}'`);
    expect(commands().join('\n')).not.toMatch(
      /adb (kill-server|start-server|reconnect)/,
    );
    expect(
      exec.mock.calls.map(([, , options]) => options?.guestTimeoutMs),
    ).toEqual([
      undefined,
      15_000,
      undefined,
      undefined,
      20_000,
      undefined,
      40_000,
      15_000,
    ]);
  });

  it('retries a timed out connect before preparing the display', async () => {
    exec
      .mockRejectedValueOnce(missing)
      .mockResolvedValueOnce(success())
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(success(`${connect}\n${device}`))
      .mockResolvedValueOnce(success());

    await expect(prepare()).resolves.toMatchObject({ connected: true });
    expect(commands()[3]).toContain(`adb -s '${target}' wait-for-device`);
    expect(commands()[4]).toContain(`adb -s '${target}' shell`);
  });

  it('returns a retryable error if the recovery also times out', async () => {
    exec
      .mockRejectedValueOnce(missing)
      .mockResolvedValueOnce(success())
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(timeout);

    await expect(prepare()).resolves.toMatchObject({
      connected: false,
      error: { code: 'adb_unreachable', retryable: true, exitCode: 124 },
    });
    expect(exec).toHaveBeenCalledTimes(4);
  });

  it('drains the admitted connect step and skips later ADB work after the deadline', async () => {
    jest.useFakeTimers();
    try {
      exec
        .mockRejectedValueOnce(missing)
        .mockResolvedValueOnce(success())
        .mockImplementationOnce(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve(success(connect)), 10_001),
            ),
        );
      const deadline = new OperationDeadline(10_000);
      const result = expect(
        service.prepareTarget('sidecar', '172.20.0.3', 5555, deadline),
      ).rejects.toBeInstanceOf(OperationDeadlineExceededError);
      await jest.advanceTimersByTimeAsync(10_001);
      await result;
      expect(commands()[2]).toContain(`adb connect '${target}'`);
      expect(exec.mock.calls[2]?.[2]).toMatchObject({
        deadline,
        guestTimeoutMs: 20_000,
      });
      expect(exec).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('drains an admitted ADB step before propagating cancellation and skips remaining commands', async () => {
    const controller = new AbortController();
    let release!: (result: ContainerCommandResult) => void;
    exec
      .mockRejectedValueOnce(missing)
      .mockResolvedValueOnce(success())
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
    const pending = service.prepareTarget(
      'sidecar',
      '172.20.0.3',
      5555,
      undefined,
      controller.signal,
    );
    let settled = false;
    void pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    for (let turn = 0; turn < 20; turn++) await Promise.resolve();
    expect(exec).toHaveBeenCalledTimes(3);
    controller.abort(new Error('cancelled'));
    await Promise.resolve();
    expect(settled).toBe(false);
    release(success());
    await expect(pending).rejects.toThrow('cancelled');
    expect(exec).toHaveBeenCalledTimes(3);
    expect(exec.mock.calls[2]?.[2]).toMatchObject({
      signal: controller.signal,
      guestTimeoutMs: 20_000,
    });
  });
});
