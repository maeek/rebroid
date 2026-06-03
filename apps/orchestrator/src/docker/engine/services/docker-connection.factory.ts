import { Injectable } from '@nestjs/common';
import Dockerode from 'dockerode';
import { DockerEngineConfigService } from '../../../config/docker-engine-config.service';

export interface DockerConnection {
  options: Dockerode.DockerOptions;
  transport: 'local-socket' | 'remote';
}

export const dockerConnectionOptions = (
  dockerHost: string | undefined,
  socketPath: string,
  remoteRequestTimeoutMs: number,
  timerFree = false,
): DockerConnection => {
  const normalizedHost = dockerHost?.trim();
  if (!normalizedHost) {
    return { options: { socketPath }, transport: 'local-socket' };
  }

  if (normalizedHost.startsWith('unix://')) {
    const url = new URL(normalizedHost);
    return {
      options: { socketPath: decodeURIComponent(url.pathname) },
      transport: 'local-socket',
    };
  }

  const requestOptions = timerFree ? {} : { timeout: remoteRequestTimeoutMs };
  if (
    normalizedHost.startsWith('tcp://') ||
    normalizedHost.startsWith('http://') ||
    normalizedHost.startsWith('https://')
  ) {
    const url = new URL(
      normalizedHost.startsWith('tcp://')
        ? `http://${normalizedHost.slice('tcp://'.length)}`
        : normalizedHost,
    );
    const protocol: Dockerode.DockerOptions['protocol'] =
      url.protocol === 'https:' ? 'https' : 'http';

    return {
      options: {
        protocol,
        host: url.hostname,
        port: url.port ? Number(url.port) : undefined,
        ...requestOptions,
      },
      transport: 'remote',
    };
  }

  return {
    options: { host: normalizedHost, ...requestOptions },
    transport: 'remote',
  };
};

@Injectable()
export class DockerConnectionFactory {
  constructor(private readonly config: DockerEngineConfigService) {}

  create() {
    const dockerHost = process.env.DOCKER_HOST;
    const socketPath = this.config.socketPath;
    const remoteRequestTimeoutMs = this.config.requestTimeoutMs;
    const connection = dockerConnectionOptions(
      dockerHost,
      socketPath,
      remoteRequestTimeoutMs,
    );
    return {
      docker: new Dockerode(connection.options),
      streamDocker: new Dockerode(
        dockerConnectionOptions(
          dockerHost,
          socketPath,
          remoteRequestTimeoutMs,
          true,
        ).options,
      ),
      transport: connection.transport,
      remoteRequestTimeoutMs,
    };
  }
}
