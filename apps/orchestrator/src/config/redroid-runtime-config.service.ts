import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedroidRuntimeConfigService {
  constructor(private readonly config: ConfigService) {}

  get adbPort() {
    return this.config.getOrThrow<number>('app.redroid.adbPort');
  }

  get dataMountPath() {
    return this.config.getOrThrow<string>('app.redroid.dataMountPath');
  }

  get privileged() {
    return this.config.getOrThrow<boolean>('app.redroid.privileged');
  }

  get securityOptions() {
    return this.config.getOrThrow<string[]>('app.redroid.securityOptions');
  }

  get cgroupnsMode() {
    return this.config.get<string>('app.redroid.cgroupnsMode');
  }

  get devices() {
    return this.config.getOrThrow<string[]>('app.redroid.devices');
  }

  get optionalDevices() {
    return this.config.getOrThrow<string[]>('app.redroid.optionalDevices');
  }
}
