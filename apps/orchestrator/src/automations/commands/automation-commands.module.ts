import { Module } from '@nestjs/common';
import { AiAutomationCommandsService } from './ai-automation-commands.service';
import { AndroidAutomationCommandsService } from './android-automation-commands.service';
import { AutomationCommandRegistryService } from './automation-command-registry.service';
import { ContainerNetworkAutomationCommandsService } from './container-network-automation-commands.service';
import { GenericAutomationCommandsService } from './generic-automation-commands.service';

@Module({
  providers: [
    AndroidAutomationCommandsService,
    AiAutomationCommandsService,
    ContainerNetworkAutomationCommandsService,
    GenericAutomationCommandsService,
    AutomationCommandRegistryService,
  ],
  exports: [AutomationCommandRegistryService],
})
export class AutomationCommandsModule {}
