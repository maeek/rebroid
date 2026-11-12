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

  it('recovers the offline transport when a replacement reuses the same address', async () => {
    exec
      .mockResolvedValueOnce(success())
      .mockResolvedValueOnce(success(connect))
      .mockResolvedValueOnce(success(device))
      .mockResolvedValueOnce(success())
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
      expect.stringContaining('net.createConnection'),
      expect.stringContaining(`adb connect '${target}'`),
      expect.stringContaining(`adb -s '${target}' get-state`),
      expect.stringContaining(`adb -s '${target}' shell`),
      expect.stringContaining('net.createConnection'),
      expect.stringContaining(`adb connect '${target}'`),
      expect.stringContaining(`adb -s '${target}' get-state`),
      expect.stringContaining(`adb -s '${target}' wait-for-device`),
      expect.stringContaining(`adb -s '${target}' shell`),
    ]);
    expect(commands()[7]).toContain(`adb disconnect '${target}'`);
    expect(commands().join('\n')).not.toMatch(
      /adb (kill-server|start-server|reconnect)/,
    );
  });

  it('retries a timed out connect before preparing the display', async () => {
    exec
      .mockResolvedValueOnce(success())
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(success(`${connect}\n${device}`))
      .mockResolvedValueOnce(success());

    await expect(prepare()).resolves.toMatchObject({ connected: true });
    expect(commands()[2]).toContain(`adb -s '${target}' wait-for-device`);
    expect(commands()[3]).toContain(`adb -s '${target}' shell`);
  });

  it('returns a retryable error if the recovery also times out', async () => {
    exec
      .mockResolvedValueOnce(success())
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(timeout);

    await expect(prepare()).resolves.toMatchObject({
      connected: false,
      error: { code: 'adb_unreachable', retryable: true, exitCode: 124 },
    });
    expect(exec).toHaveBeenCalledTimes(3);
  });

  it('drains the admitted connect step and skips later ADB work after the deadline', async () => {
    jest.useFakeTimers();
    try {
      exec
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
      expect(commands()[1]).toContain('timeout -k 1s 9s sh -lc');
      expect(exec).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
