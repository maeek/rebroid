import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DockerEngineConfigService {
  constructor(private readonly config: ConfigService) {}

  get socketPath() {
    return this.config.getOrThrow<string>('app.docker.socketPath');
  }

  get requestTimeoutMs() {
    return this.config.getOrThrow<number>('app.docker.requestTimeoutMs');
  }

  get resourcePrefix() {
    return this.config.getOrThrow<string>('app.docker.resourcePrefix');
  }

  get orchestratorContainerId() {
    return this.config.get<string>('app.docker.orchestratorContainerId');
  }

  get maxConcurrentReads() {
    return this.config.getOrThrow<number>('app.docker.maxConcurrentReads');
  }

  get maxConcurrentLongOperations() {
    return this.config.getOrThrow<number>(
      'app.docker.maxConcurrentLongOperations',
    );
  }

  get slowRequestWarningMs() {
    return this.config.getOrThrow<number>('app.docker.slowRequestWarningMs');
  }

  get longOperationTimeoutMs() {
    return this.config.getOrThrow<number>('app.docker.longOperationTimeoutMs');
  }
}
