import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ZodError, toJSONSchema } from 'zod';
import { AutomationCommandDto } from '../dto/automation-command.dto';
import {
  AutomationCommandContext,
  AutomationCommandDefinition,
} from './automation-command.types';
import {
  buildCommandEditorMetadata,
  normalizeCommandOutputs,
} from '@rebroid/automation-core/command-registry';
import { AndroidAutomationCommandsService } from './android-automation-commands.service';
import { AiAutomationCommandsService } from './ai-automation-commands.service';
import { ContainerNetworkAutomationCommandsService } from './container-network-automation-commands.service';
import { GenericAutomationCommandsService } from './generic-automation-commands.service';
import { VisionAutomationCommandsService } from './vision-automation-commands.service';

@Injectable()
export class AutomationCommandRegistryService implements OnModuleInit {
  private readonly commands = new Map<string, AutomationCommandDefinition>();

  constructor(
    private readonly androidCommands: AndroidAutomationCommandsService,
    private readonly networkCommands: ContainerNetworkAutomationCommandsService,
    private readonly genericCommands: GenericAutomationCommandsService,
    private readonly visionCommands: VisionAutomationCommandsService,
    private readonly aiCommands: AiAutomationCommandsService,
  ) {}

  onModuleInit() {
    for (const command of [
      ...this.androidCommands.list(),
      ...this.networkCommands.list(),
      ...this.genericCommands.list(),
      ...this.visionCommands.list(),
      ...this.aiCommands.list(),
    ]) {
      if (this.commands.has(command.uses)) {
        throw new Error(`Duplicate automation command "${command.uses}".`);
      }
      this.commands.set(command.uses, command);
    }
  }

  listCommands(): AutomationCommandDto[] {
    return [...this.commands.values()]
      .map(
        ({
          uses,
          label,
          description,
          requiredPermissions,
          outputs,
          editor,
        }) => {
          const inputSchema = normalizeDefaultedJsonSchemaRequired(
            toJSONSchema(this.get(uses).schema, {
              unrepresentable: 'any',
            }) as Record<string, unknown>,
          );

          return {
            uses,
            label,
            description,
            requiredPermissions,
            inputSchema,
            outputs: normalizeCommandOutputs(outputs),
            editor: buildCommandEditorMetadata(inputSchema, editor),
          };
        },
      )
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

  outputsFor(uses: string) {
    return normalizeCommandOutputs(this.get(uses).outputs);
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

const normalizeDefaultedJsonSchemaRequired = (
  schema: unknown,
): Record<string, unknown> => {
  const normalized = normalizeJsonSchemaNode(schema);
  return isRecord(normalized) ? normalized : {};
};

const normalizeJsonSchemaNode = (schema: unknown): unknown => {
  if (Array.isArray(schema)) {
    return schema.map((item) => normalizeJsonSchemaNode(item));
  }
  if (!isRecord(schema)) {
    return schema;
  }

  const normalized = Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [
      key,
      normalizeJsonSchemaNode(value),
    ]),
  );
  if (!isRecord(normalized.properties)) {
    return normalized;
  }

  const defaultedProperties = new Set(
    Object.entries(normalized.properties)
      .filter(
        ([, propertySchema]) =>
          isRecord(propertySchema) &&
          Object.prototype.hasOwnProperty.call(propertySchema, 'default'),
      )
      .map(([propertyName]) => propertyName),
  );
  if (defaultedProperties.size === 0 || !Array.isArray(normalized.required)) {
    return normalized;
  }

  return {
    ...normalized,
    required: normalized.required.filter(
      (propertyName) =>
        typeof propertyName !== 'string' ||
        !defaultedProperties.has(propertyName),
    ),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
