import { spawnSync } from 'node:child_process';
import {
  OperationDeadline,
  OperationDeadlineExceededError,
} from '../../../common/operation-deadline';
import type { DockerContainerExecPort } from '../../../docker/contracts/docker-container-exec.port';
import type { DockerEnginePort } from '../../../docker/contracts/docker-engine.port';
import { AndroidAppsTcpAdbService } from './android-apps-tcp-adb.service';

jest.mock('node:timers/promises', () => ({
  setTimeout: (
    ms: number,
    _value: unknown,
    options?: { signal?: AbortSignal },
  ) =>
    new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(options?.signal?.reason);
      };
      const timer = setTimeout(() => {
        options?.signal?.removeEventListener('abort', abort);
        resolve();
      }, ms);
      options?.signal?.addEventListener('abort', abort, { once: true });
      if (options?.signal?.aborted) abort();
    }),
}));

const target = { containerId: 'container-1', adbPort: 5555 };
const ready = { stdout: 'ready', stderr: '', exitCode: 0 };
const setup = () => {
  const exec = {
    execInContainerWithOutput: jest.fn().mockResolvedValue(ready),
  };
  const engine = {
    isTransientDockerTransportError: jest.fn().mockReturnValue(false),
  };
  return {
    exec,
    engine,
    preparation: new AndroidAppsTcpAdbService(
      exec as unknown as DockerContainerExecPort,
      engine as unknown as DockerEnginePort,
    ),
  };
};

describe('shared Android TCP ADB preparation', () => {
  afterEach(() => jest.useRealTimers());

  it.each([
    { persist: '5555', service: '', state: 'running', mutations: '' },
    { persist: '', service: '5555', state: 'running', mutations: '' },
    {
      persist: '5554',
      service: '5554',
      state: 'running',
      mutations:
        'setprop persist.adb.tcp.port 5555\nsetprop service.adb.tcp.port 5555\nstop adbd\nstart adbd\n',
    },
    {
      persist: '5555',
      service: '5555',
      state: 'stopped',
      mutations:
        'setprop persist.adb.tcp.port 5555\nsetprop service.adb.tcp.port 5555\nstart adbd\n',
    },
  ])(
    'keeps guest repair idempotent for $state adbd ($persist/$service)',
    async ({ persist, service, state, mutations }) => {
      const { preparation, exec } = setup();
      const deadline = new OperationDeadline(10_000);
      const signal = new AbortController().signal;
      await preparation.prepare(target, deadline, signal);
      const [, command, options] =
        exec.execInContainerWithOutput.mock.calls[0]!;
      const result = spawnSync(
        'sh',
        [
          '-c',
          [
            `getprop() { case "$1" in persist.adb.tcp.port) printf '%s' '${persist}';; service.adb.tcp.port) printf '%s' '${service}';; init.svc.adbd) printf '%s' '${state}';; esac; }`,
            'setprop() { printf "setprop %s %s\\n" "$1" "$2" >&2; }',
            'stop() { printf "stop %s\\n" "$1" >&2; }',
            'start() { printf "start %s\\n" "$1" >&2; }',
            command.at(-1),
          ].join('\n'),
        ],
        { encoding: 'utf8' },
      );
      expect(result.status).toBe(0);
      expect(result.stderr).toBe(mutations);
      expect(result.stdout).toContain(
        mutations ? 'restarted' : 'already enabled',
      );
      expect(options).toEqual({ deadline, signal, guestTimeoutMs: 10_000 });
    },
  );

  it('does not stop or start adbd after property setup fails', async () => {
    const { preparation, exec } = setup();
    await preparation.prepare(target, new OperationDeadline(10_000));
    const [, command] = exec.execInContainerWithOutput.mock.calls[0]!;
    const result = spawnSync(
      'sh',
      [
        '-c',
        [
          'getprop() { if [ "$1" = init.svc.adbd ]; then printf running; fi; }',
          'setprop() { return 13; }',
          'stop() { printf stopped; }',
          'start() { printf started; }',
          command.at(-1),
        ].join('\n'),
      ],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(13);
    expect(result.stdout).toBe('');
  });

  it('retries transient failures at most three times inside one deadline', async () => {
    jest.useFakeTimers();
    const { preparation, exec, engine } = setup();
    const failure = new Error('connection reset');
    exec.execInContainerWithOutput.mockRejectedValue(failure);
    engine.isTransientDockerTransportError.mockReturnValue(true);
    const pending = preparation.prepare(target, new OperationDeadline(10_000));
    const rejected = expect(pending).rejects.toBe(failure);
    await jest.advanceTimersByTimeAsync(2_000);
    await rejected;
    expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(3);
  });

  it('returns the shared preparation result after a transient retry', async () => {
    jest.useFakeTimers();
    const { preparation, exec, engine } = setup();
    exec.execInContainerWithOutput.mockRejectedValueOnce(new Error('reset'));
    engine.isTransientDockerTransportError.mockReturnValue(true);
    const pending = preparation.prepare(target, new OperationDeadline(10_000));
    await jest.advanceTimersByTimeAsync(500);
    await expect(pending).resolves.toEqual(ready);
    expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(2);
  });

  it('does not retry a permanent command failure', async () => {
    const { preparation, exec } = setup();
    exec.execInContainerWithOutput.mockRejectedValue(
      new Error('setprop denied'),
    );
    await expect(
      preparation.prepare(target, new OperationDeadline(10_000)),
    ).rejects.toThrow('setprop denied');
    expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(1);
  });

  it('stops retry admission when the deadline expires during backoff', async () => {
    jest.useFakeTimers();
    const { preparation, exec, engine } = setup();
    exec.execInContainerWithOutput.mockRejectedValue(new Error('reset'));
    engine.isTransientDockerTransportError.mockReturnValue(true);
    const pending = preparation.prepare(target, new OperationDeadline(200));
    const rejected = expect(pending).rejects.toBeInstanceOf(
      OperationDeadlineExceededError,
    );
    await jest.advanceTimersByTimeAsync(200);
    await rejected;
    expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(1);
  });

  it('withdraws retry wait when the caller cancels', async () => {
    jest.useFakeTimers();
    const { preparation, exec, engine } = setup();
    exec.execInContainerWithOutput.mockRejectedValue(new Error('reset'));
    engine.isTransientDockerTransportError.mockReturnValue(true);
    const controller = new AbortController();
    const pending = preparation.prepare(
      target,
      new OperationDeadline(10_000),
      controller.signal,
    );
    const rejected = expect(pending).rejects.toThrow('cancelled');
    await jest.advanceTimersByTimeAsync(1);
    controller.abort(new Error('cancelled'));
    await rejected;
    await jest.advanceTimersByTimeAsync(2_000);
    expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch cancelled or expired preparation', async () => {
    const { preparation, exec } = setup();
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));
    await expect(
      preparation.prepare(
        target,
        new OperationDeadline(10_000),
        controller.signal,
      ),
    ).rejects.toThrow('cancelled');
    await expect(
      preparation.prepare(target, new OperationDeadline(0)),
    ).rejects.toBeInstanceOf(OperationDeadlineExceededError);
    expect(exec.execInContainerWithOutput).not.toHaveBeenCalled();
  });

  it.each([0, 65536, 3.5, Number.NaN])(
    'rejects invalid port %s before guest execution',
    async (adbPort) => {
      const { preparation, exec } = setup();
      await expect(
        preparation.prepare(
          { ...target, adbPort },
          new OperationDeadline(10_000),
        ),
      ).rejects.toThrow('valid TCP ADB port');
      expect(exec.execInContainerWithOutput).not.toHaveBeenCalled();
    },
  );
});
