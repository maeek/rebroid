import { Injectable } from '@nestjs/common';
import { PassThrough } from 'node:stream';
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
    const result = await this.engine.longOperation(
      'container_exec',
      `Execute command in container ${containerId}`,
      async (docker, signal) => {
        options.deadline?.throwIfExpired();
        const container = docker.getContainer(containerId);
        const exec = await container.exec({
          Cmd: command,
          AttachStdout: true,
          AttachStderr: true,
          ...(options.deadline ? { abortSignal: signal } : {}),
        });
        options.deadline?.throwIfExpired();
        signal.throwIfAborted();
        const stream = await exec.start({ abortSignal: signal });
        const stdout = new PassThrough();
        const stderr = new PassThrough();
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        const abort = () =>
          stream.destroy(
            new Error(`Container exec aborted: ${command.join(' ')}`),
          );

        signal.addEventListener('abort', abort, { once: true });
        stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
        stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
        docker.modem.demuxStream(stream, stdout, stderr);

        try {
          await new Promise<void>((resolve, reject) => {
            stream.on('end', resolve);
            stream.on('error', reject);
            if (signal.aborted) abort();
          });
        } finally {
          signal.removeEventListener('abort', abort);
        }

        const inspect = options.deadline
          ? await exec.inspect({ abortSignal: signal })
          : await exec.inspect();
        return {
          inspect,
          stdoutText: Buffer.concat(stdoutChunks).toString('utf-8'),
          stderrText: Buffer.concat(stderrChunks).toString('utf-8'),
        };
      },
      options.timeoutMs,
      options.deadline ? { waitForCleanup: true } : undefined,
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
