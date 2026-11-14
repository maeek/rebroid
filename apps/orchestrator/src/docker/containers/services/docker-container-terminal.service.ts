import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Duplex } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import type Dockerode from 'dockerode';
import type {
  DockerContainerTerminal,
  DockerContainerTerminalPort,
} from '../../contracts/docker-container-terminal.port';
import { DockerEngineService } from '../../docker-engine.service';

// Docker has no per-exec signal operation. Match this exec inside the target
// PID namespace and signal it using the same container user that started it.
const terminateShell = `
for process in /proc/[0-9]*; do
  if (tr '\\000' '\\n' < "$process/environ") 2>/dev/null | grep -Fxq "REBROID_TERMINAL_EXEC=$1"; then
    kill -KILL "\${process##*/}" 2>/dev/null || :
  fi
done
`;

@Injectable()
export class DockerContainerTerminalService implements DockerContainerTerminalPort {
  constructor(private readonly engine: DockerEngineService) {}

  async open(
    containerId: string,
    startedAt: string,
    user: string | undefined,
    signal: AbortSignal,
  ): Promise<DockerContainerTerminal> {
    const container = this.engine.streamDocker.getContainer(containerId);
    const setup = AbortSignal.any([signal, AbortSignal.timeout(5_000)]);
    const current = await container.inspect({ abortSignal: setup });
    if (
      current.Id !== containerId ||
      !current.State.Running ||
      current.State.Paused ||
      current.State.Restarting ||
      current.State.StartedAt !== startedAt ||
      (current.HostConfig.PidMode && current.HostConfig.PidMode !== 'private')
    ) {
      throw new Error('Container runtime changed.');
    }
    const marker = randomUUID();
    // The guest timeout also bounds a shell when the orchestrator dies before cleanup.
    const exec = await container.exec({
      Cmd: ['timeout', '-k', '5s', '1800s', 'sh', '-i'],
      User: user,
      Env: ['TERM=xterm-256color', `REBROID_TERMINAL_EXEC=${marker}`],
      Tty: true,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Privileged: false,
      abortSignal: setup,
    });
    setup.throwIfAborted();

    let stream: Duplex | undefined;
    let closing: Promise<number | null> | undefined;
    let attached = false;
    const close = () => {
      stream?.destroy();
      closing ??= this.terminate(
        container,
        exec,
        user,
        marker,
        startedAt,
        attached,
      );
      return closing;
    };
    try {
      const attachment = await exec.start({
        hijack: true,
        stdin: true,
        Tty: true,
        abortSignal: setup,
      });
      if (!(attachment instanceof Duplex)) {
        throw new Error('Docker did not return an interactive stream.');
      }
      stream = attachment;
      attached = true;
      stream.pause();
      // docker-modem can emit an error between upgrade and consumer attachment.
      stream.on('error', () => undefined);
      setup.throwIfAborted();
      return {
        stream,
        resize: async (cols, rows) => {
          try {
            await exec.resize({
              w: cols,
              h: rows,
              abortSignal: AbortSignal.timeout(2_000),
            });
          } catch (error) {
            // The Podman compatibility endpoint returns Created on success.
            if (dockerStatus(error) !== 201) throw error;
          }
        },
        close,
      };
    } catch (error) {
      await close();
      throw error;
    }
  }

  private async terminate(
    container: Dockerode.Container,
    exec: Dockerode.Exec,
    user: string | undefined,
    marker: string,
    startedAt: string,
    attached: boolean,
  ): Promise<number | null> {
    const signal = AbortSignal.timeout(4_000);
    for (let attempt = 0; attempt < 8; attempt++) {
      const state = await exec
        .inspect({ abortSignal: signal })
        .catch(ignoreMissingExec);
      if (!state) return null;
      if (
        !state.Running &&
        state.ExitCode !== null &&
        (attached || state.ExitCode !== 0)
      ) {
        return state.ExitCode;
      }
      if (state.Running && (attempt === 0 || attempt === 3 || attempt === 6)) {
        const current = await container
          .inspect({ abortSignal: signal })
          .catch(ignoreMissingExec);
        if (
          !current ||
          !current.State.Running ||
          current.State.StartedAt !== startedAt
        )
          return null;
        const cleanup = await container.exec({
          Cmd: [
            'timeout',
            '-k',
            '1s',
            '2s',
            'sh',
            '-c',
            terminateShell,
            'rebroid-terminal-cleanup',
            marker,
          ],
          User: user,
          abortSignal: signal,
        });
        await cleanup.start({ Detach: true, abortSignal: signal });
      }
      // A hijacked start can acknowledge before the process is visible in /proc.
      await delay(150, undefined, { signal });
    }
    const state = await exec
      .inspect({ abortSignal: signal })
      .catch(ignoreMissingExec);
    if (state?.Running)
      throw new Error('Terminal process exit could not be verified.');
    return state?.ExitCode ?? null;
  }
}

const dockerStatus = (error: unknown) =>
  typeof error === 'object' && error !== null && 'statusCode' in error
    ? error.statusCode
    : undefined;

const ignoreMissingExec = (error: unknown) => {
  if (dockerStatus(error) === 404) return null;
  throw error;
};
