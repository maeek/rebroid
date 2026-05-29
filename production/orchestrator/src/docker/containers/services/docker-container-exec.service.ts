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
    const container = this.engine.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({});
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    this.engine.docker.modem.demuxStream(stream, stdout, stderr);

    await new Promise<void>((resolve, reject) => {
      const timeout =
        options.timeoutMs && options.timeoutMs > 0
          ? setTimeout(() => {
              stream.destroy(
                new Error(
                  `Container exec timed out after ${options.timeoutMs}ms: ${command.join(' ')}`,
                ),
              );
            }, options.timeoutMs)
          : null;
      const cleanup = () => {
        if (timeout) {
          clearTimeout(timeout);
        }
      };

      stream.on('end', () => {
        cleanup();
        resolve();
      });
      stream.on('error', (error) => {
        cleanup();
        reject(error);
      });
    });

    const result = await exec.inspect();
    const stdoutText = Buffer.concat(stdoutChunks).toString('utf-8');
    const stderrText = Buffer.concat(stderrChunks).toString('utf-8');
    const exitCode = result.ExitCode ?? 0;

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
