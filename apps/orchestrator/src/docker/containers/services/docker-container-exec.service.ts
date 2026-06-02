import { Injectable } from '@nestjs/common';
import { PassThrough } from 'node:stream';
import { DockerEngineService } from '../../docker-engine.service';
import {
  ContainerCommandFailedException,
  ContainerCommandResult,
} from '../../docker.types';
import { formatContainerCommandFailureMessage } from '../../utils/docker-engine.utils';

@Injectable()
export class DockerContainerExecService {
  constructor(private readonly engine: DockerEngineService) {}

  async execInContainer(
    containerId: string,
    command: string[],
    options: { timeoutMs?: number } = {},
  ) {
    await this.execInContainerWithOutput(containerId, command, options);
  }

  async execInContainerWithOutput(
    containerId: string,
    command: string[],
    options: { timeoutMs?: number } = {},
  ): Promise<ContainerCommandResult> {
    const result = await this.engine.longOperation(
      'container_exec',
      `Execute command in container ${containerId}`,
      async (docker, signal) => {
        const container = docker.getContainer(containerId);
        const exec = await container.exec({
          Cmd: command,
          AttachStdout: true,
          AttachStderr: true,
        });
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
          });
        } finally {
          signal.removeEventListener('abort', abort);
        }

        const inspect = await exec.inspect();
        return {
          inspect,
          stdoutText: Buffer.concat(stdoutChunks).toString('utf-8'),
          stderrText: Buffer.concat(stderrChunks).toString('utf-8'),
        };
      },
      options.timeoutMs,
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
