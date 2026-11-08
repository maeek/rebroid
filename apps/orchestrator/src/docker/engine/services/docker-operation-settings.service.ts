import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SettingsService } from '../../../settings/settings.service';
import { DockerEngineService } from '../../docker-engine.service';
import type { DockerOperationLimits } from '../../contracts/docker-operation-limits';

@Injectable()
export class DockerOperationSettingsService
  implements OnModuleInit, OnModuleDestroy
{
  private unsubscribe?: () => void;
  private readonly defaults: DockerOperationLimits;

  constructor(
    private readonly settings: SettingsService,
    private readonly engine: DockerEngineService,
  ) {
    this.defaults = engine.getOperationLimits();
  }

  async onModuleInit() {
    this.unsubscribe = this.settings.subscribeDockerOperationLimits((limits) =>
      this.apply(limits),
    );
    this.apply(await this.settings.getDockerOperationLimits());
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }

  getLimits() {
    return this.engine.getOperationLimits();
  }

  async updateLimits(limits: DockerOperationLimits) {
    await this.settings.updateDockerOperationLimits(limits);
    return this.getLimits();
  }

  private apply(limits: DockerOperationLimits | undefined) {
    this.engine.setOperationLimits(limits ?? this.defaults);
  }
}
