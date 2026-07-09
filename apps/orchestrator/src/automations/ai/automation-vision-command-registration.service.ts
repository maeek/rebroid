import { Injectable, OnModuleInit } from '@nestjs/common';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { VisionAutomationCommandsService } from '../commands/vision-automation-commands.service';

@Injectable()
export class AutomationVisionCommandRegistrationService implements OnModuleInit {
  constructor(
    private readonly registry: AutomationCommandRegistryService,
    private readonly commands: VisionAutomationCommandsService,
  ) {}

  onModuleInit() {
    this.registry.register(this.commands.list());
  }
}
