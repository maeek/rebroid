import { BadRequestException, Injectable } from '@nestjs/common';
import { parse, stringify } from 'yaml';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import {
  AUTOMATION_API_VERSION,
  AUTOMATION_KIND,
  AutomationDefinition,
  AutomationDefinitionMetadata,
} from './automation-definition.types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeLabels = (value: unknown) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new BadRequestException('metadata.labels must be an object.');
  }
  const labels: Record<string, string> = {};
  for (const [key, label] of Object.entries(value)) {
    if (typeof label !== 'string') {
      throw new BadRequestException('metadata.labels values must be strings.');
    }
    labels[key] = label;
  }
  return labels;
};

const stableStepId = (uses: string, index: number) =>
  `${uses.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'step'}-${index + 1}`;

@Injectable()
export class AutomationDefinitionService {
  constructor(private readonly registry: AutomationCommandRegistryService) {}

  parseYaml(yaml: string) {
    let parsed: unknown;
    try {
      parsed = parse(yaml);
    } catch (error) {
      throw new BadRequestException(
        `Automation YAML is invalid: ${error instanceof Error ? error.message : 'parse error'}`,
      );
    }

    return this.normalize(parsed);
  }

  normalize(raw: unknown): AutomationDefinition {
    if (!isRecord(raw)) {
      throw new BadRequestException('Automation definition must be an object.');
    }
    if (raw.apiVersion !== AUTOMATION_API_VERSION) {
      throw new BadRequestException(
        `apiVersion must be ${AUTOMATION_API_VERSION}.`,
      );
    }
    if (raw.kind !== AUTOMATION_KIND) {
      throw new BadRequestException(`kind must be ${AUTOMATION_KIND}.`);
    }

    const metadata = this.normalizeMetadata(raw.metadata);
    const spec = isRecord(raw.spec) ? raw.spec : null;
    if (!spec || !Array.isArray(spec.steps) || spec.steps.length === 0) {
      throw new BadRequestException(
        'spec.steps must contain at least one step.',
      );
    }

    const seenIds = new Set<string>();
    const steps = spec.steps.map((rawStep, index) => {
      if (!isRecord(rawStep)) {
        throw new BadRequestException(`Step ${index + 1} must be an object.`);
      }
      if (typeof rawStep.uses !== 'string' || !rawStep.uses.trim()) {
        throw new BadRequestException(`Step ${index + 1} must define uses.`);
      }

      const uses = rawStep.uses.trim();
      const id =
        typeof rawStep.id === 'string' && rawStep.id.trim()
          ? rawStep.id.trim()
          : stableStepId(uses, index);
      if (seenIds.has(id)) {
        throw new BadRequestException(`Duplicate step id "${id}".`);
      }
      seenIds.add(id);

      const input = rawStep.with === undefined ? {} : rawStep.with;
      if (!isRecord(input)) {
        throw new BadRequestException(`Step "${id}" with must be an object.`);
      }

      return {
        id,
        uses,
        with: this.registry.normalizeInput(uses, input),
      };
    });

    return {
      apiVersion: AUTOMATION_API_VERSION,
      kind: AUTOMATION_KIND,
      metadata,
      spec: { steps },
    };
  }

  toYaml(definition: AutomationDefinition) {
    return stringify(definition, { indent: 2 });
  }

  validateYaml(yaml: string) {
    try {
      const definition = this.parseYaml(yaml);
      return {
        valid: true,
        definition,
        yaml: this.toYaml(definition),
        errors: [],
      };
    } catch (error) {
      return {
        valid: false,
        definition: null,
        yaml: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  private normalizeMetadata(value: unknown): AutomationDefinitionMetadata {
    if (!isRecord(value)) {
      throw new BadRequestException('metadata must be an object.');
    }
    if (typeof value.name !== 'string' || !value.name.trim()) {
      throw new BadRequestException('metadata.name is required.');
    }
    const description =
      typeof value.description === 'string' && value.description.trim()
        ? value.description.trim()
        : undefined;
    const labels = normalizeLabels(value.labels);
    return {
      name: value.name.trim(),
      ...(description ? { description } : {}),
      ...(labels ? { labels } : {}),
    };
  }
}
