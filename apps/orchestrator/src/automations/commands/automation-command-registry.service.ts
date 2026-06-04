import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ZodError, toJSONSchema } from 'zod';
import { AutomationCommandDto } from '../dto/automation.dto';
import {
  AutomationCommandContext,
  AutomationCommandDefinition,
} from './automation-command.types';
import { AndroidAutomationCommandsService } from './android-automation-commands.service';
import { ContainerNetworkAutomationCommandsService } from './container-network-automation-commands.service';
import { GenericAutomationCommandsService } from './generic-automation-commands.service';

@Injectable()
export class AutomationCommandRegistryService implements OnModuleInit {
  private readonly commands = new Map<string, AutomationCommandDefinition>();

  constructor(
    private readonly androidCommands: AndroidAutomationCommandsService,
    private readonly networkCommands: ContainerNetworkAutomationCommandsService,
    private readonly genericCommands: GenericAutomationCommandsService,
  ) {}

  onModuleInit() {
    for (const command of [
      ...this.androidCommands.list(),
      ...this.networkCommands.list(),
      ...this.genericCommands.list(),
    ]) {
      if (this.commands.has(command.uses)) {
        throw new Error(`Duplicate automation command "${command.uses}".`);
      }
      this.commands.set(command.uses, command);
    }
  }

  listCommands(): AutomationCommandDto[] {
    return [...this.commands.values()]
      .map(({ uses, label, description, requiredPermissions }) => ({
        uses,
        label,
        description,
        requiredPermissions,
        inputSchema: toJSONSchema(this.get(uses).schema, {
          unrepresentable: 'any',
        }) as Record<string, unknown>,
      }))
      .sort((left, right) => left.uses.localeCompare(right.uses));
  }

  normalizeInput(uses: string, input: Record<string, unknown>) {
    const command = this.get(uses);
    try {
      return command.schema.parse(input) as Record<string, unknown>;
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(
          `Invalid input for ${uses}: ${error.issues.map((issue) => issue.message).join(', ')}`,
        );
      }
      throw error;
    }
  }

  requiredPermissionsFor(uses: string) {
    return this.get(uses).requiredPermissions;
  }

  async execute(
    uses: string,
    input: Record<string, unknown>,
    context: AutomationCommandContext,
  ) {
    const command = this.get(uses);
    return command.execute(command.schema.parse(input), context);
  }

  private get(uses: string) {
    const command = this.commands.get(uses);
    if (!command) {
      throw new BadRequestException(
        `Unsupported automation command "${uses}".`,
      );
    }
    return command;
  }
}
