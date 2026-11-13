import { Injectable } from '@nestjs/common';
import { PassThrough } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { OperationDeadline } from '../../../common/operation-deadline';
import { dockerOperationScope } from '../../engine/utils/docker-operation-scope';
import { DockerEngineService } from '../../docker-engine.service';
import {
  ContainerCommandFailedException,
  ContainerCommandResult,
} from '../../docker.types';
import { formatContainerCommandFailureMessage } from '../../utils/docker-engine.utils';
import type {
  DockerContainerExecOptions,
  DockerContainerExecPort,
} from '../../contracts/docker-container-exec.port';

@Injectable()
export class DockerContainerExecService implements DockerContainerExecPort {
  constructor(private readonly engine: DockerEngineService) {}

  async execInContainer(
    containerId: string,
    command: string[],
    options: DockerContainerExecOptions = {},
  ) {
    await this.execInContainerWithOutput(containerId, command, options);
  }

  async execInContainerWithOutput(
    containerId: string,
    command: string[],
    options: DockerContainerExecOptions = {},
  ): Promise<ContainerCommandResult> {
    const configuredTimeoutMs = options.timeoutMs ?? options.guestTimeoutMs;
    const budgetMs = Math.min(
      configuredTimeoutMs ?? Infinity,
      options.deadline?.remainingMs() ?? Infinity,
    );
    const scoped =
      options.deadline !== undefined || options.guestTimeoutMs !== undefined;
    const deadline =
      scoped && Number.isFinite(budgetMs)
        ? new OperationDeadline(budgetMs)
        : undefined;
    const result = await this.engine.longOperation(
      'container_exec',
      `Execute command in container ${containerId}`,
      async (docker, signal) => {
        deadline?.throwIfExpired();
        signal.throwIfAborted();
        const container = docker.getContainer(containerId);
        const guestTimeoutMs =
          options.guestTimeoutMs === undefined
            ? undefined
            : Math.max(
                1,
                Math.min(
                  options.guestTimeoutMs,
                  deadline?.remainingMs() ?? options.guestTimeoutMs,
                ),
              );
        const guestCommand =
          guestTimeoutMs === undefined
            ? command
            : [
                'timeout',
                '-k',
                '1s',
                `${Math.max(1, guestTimeoutMs - 1_000) / 1_000}s`,
                ...command,
              ];
        const exec = await container.exec({
          Cmd: guestCommand,
          AttachStdout: true,
          AttachStderr: true,
          abortSignal: signal,
        });
        deadline?.throwIfExpired();
        signal.throwIfAborted();
        const guestScope =
          guestTimeoutMs === undefined
            ? undefined
            : dockerOperationScope({
                deadline: new OperationDeadline(guestTimeoutMs + 2_000),
              });
        const executionSignal = guestScope?.signal ?? signal;
        let guestDrainUntil = 0;
        let startRequested = false;
        let guestExited = false;
        try {
          startRequested = true;
          // Once a bounded guest mutation starts, its stream must remain owned
          // until exit. A client-side abort does not stop that guest process.
          const stream = await exec.start({ abortSignal: executionSignal });
          if (guestTimeoutMs !== undefined)
            guestDrainUntil = performance.now() + guestTimeoutMs + 1_000;
          const stdout = new PassThrough();
          const stderr = new PassThrough();
          const stdoutChunks: Buffer[] = [];
          const stderrChunks: Buffer[] = [];
          const abort = () =>
            stream.destroy(new Error('Container exec aborted.'));
          executionSignal.addEventListener('abort', abort, { once: true });
          stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
          stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
          docker.modem.demuxStream(stream, stdout, stderr);
          try {
            await new Promise<void>((resolve, reject) => {
              stream.on('end', resolve);
              stream.on('error', reject);
              if (executionSignal.aborted) abort();
            });
          } finally {
            executionSignal.removeEventListener('abort', abort);
          }
          // Stream completion confirms guest exit before the result inspection.
          guestExited = true;
          guestDrainUntil = 0;
          const inspect =
            guestTimeoutMs !== undefined
              ? await exec.inspect({ abortSignal: AbortSignal.timeout(1_000) })
              : await exec.inspect({ abortSignal: signal });
          return {
            inspect,
            stdoutText: Buffer.concat(stdoutChunks).toString('utf-8'),
            stderrText: Buffer.concat(stderrChunks).toString('utf-8'),
          };
        } catch (error) {
          if (guestTimeoutMs !== undefined && startRequested && !guestExited) {
            // An uncertain start or broken stream can leave the command running.
            // Retain ownership through its bounded guest kill allowance.
            if (guestDrainUntil === 0)
              guestDrainUntil = performance.now() + guestTimeoutMs + 1_000;
            await delay(Math.max(0, guestDrainUntil - performance.now()));
          }
          throw error;
        } finally {
          guestScope?.dispose();
        }
      },
      configuredTimeoutMs,
      {
        deadline,
        signal: options.signal,
        onDispatched: options.onDispatched,
        waitForCleanup: true,
      },
    );
    const stdoutText = result.stdoutText;
    const stderrText = result.stderrText;
    const exitCode = result.inspect.ExitCode ?? 0;

    if (exitCode !== 0) {
      throw new ContainerCommandFailedException({
        message: formatContainerCommandFailureMessage({
          command,
          exitCode,
          stdout: stdoutText,
          stderr: stderrText,
        }),
        command,
        exitCode,
        stdout: stdoutText,
        stderr: stderrText,
      });
    }

    return { stdout: stdoutText, stderr: stderrText, exitCode };
  }
}
