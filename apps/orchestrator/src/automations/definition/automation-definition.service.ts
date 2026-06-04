import { BadRequestException, Injectable } from '@nestjs/common';
import { parse, stringify } from 'yaml';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { normalizeAutomationTags } from '../tags/automation-tags';
import {
  AUTOMATION_API_VERSION,
  AUTOMATION_KIND,
  AutomationDefinition,
  AutomationDefinitionStep,
  AutomationDefinitionMetadata,
  AutomationPredicate,
  AutomationPredicateOperator,
  AutomationSwitchCase,
  AutomationValueRef,
} from './automation-definition.types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const controlTypes = new Set(['condition', 'switch', 'repeat']);

const predicateOperators = new Set<AutomationPredicateOperator>([
  'equals',
  'notEquals',
  'contains',
  'exists',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'matches',
]);

const stableStepId = (base: string, index: number) =>
  `${base.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'step'}-${index + 1}`;

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
    const steps = this.normalizeSteps(spec.steps, seenIds, 'spec.steps');

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
    const tags = normalizeAutomationTags(value.tags, 'metadata.tags');
    return {
      name: value.name.trim(),
      ...(description ? { description } : {}),
      ...(tags ? { tags } : {}),
    };
  }

  private normalizeSteps(
    rawSteps: unknown[],
    seenIds: Set<string>,
    path: string,
  ): AutomationDefinitionStep[] {
    return rawSteps.map((rawStep, index) =>
      this.normalizeStep(rawStep, index, seenIds, `${path}[${index}]`),
    );
  }

  private normalizeStep(
    rawStep: unknown,
    index: number,
    seenIds: Set<string>,
    path: string,
  ): AutomationDefinitionStep {
    if (!isRecord(rawStep)) {
      throw new BadRequestException(`Step ${index + 1} must be an object.`);
    }

    const type =
      typeof rawStep.type === 'string' && controlTypes.has(rawStep.type)
        ? rawStep.type
        : null;
    const id = this.normalizeStepId(rawStep.id, type ?? rawStep.uses, index);
    if (seenIds.has(id)) {
      throw new BadRequestException(`Duplicate step id "${id}".`);
    }
    seenIds.add(id);

    if (type === 'condition') {
      return {
        id,
        type,
        condition: this.normalizePredicate(
          rawStep.condition,
          `${path}.condition`,
        ),
        then: this.normalizeNestedSteps(
          rawStep.then,
          seenIds,
          `${path}.then`,
          id,
        ),
        ...(rawStep.else === undefined
          ? {}
          : {
              else: this.normalizeNestedSteps(
                rawStep.else,
                seenIds,
                `${path}.else`,
                id,
              ),
            }),
      };
    }

    if (type === 'switch') {
      if (!Array.isArray(rawStep.cases)) {
        throw new BadRequestException(`Step "${id}" cases must be an array.`);
      }
      const cases: AutomationSwitchCase[] = rawStep.cases.map(
        (rawCase, caseIndex) => {
          if (!isRecord(rawCase)) {
            throw new BadRequestException(
              `Step "${id}" case ${caseIndex + 1} must be an object.`,
            );
          }
          return {
            value: rawCase.value,
            steps: this.normalizeNestedSteps(
              rawCase.steps,
              seenIds,
              `${path}.cases[${caseIndex}].steps`,
              id,
            ),
          };
        },
      );
      return {
        id,
        type,
        value: this.normalizeValueRef(rawStep.value, `${path}.value`),
        cases,
        ...(rawStep.default === undefined
          ? {}
          : {
              default: this.normalizeNestedSteps(
                rawStep.default,
                seenIds,
                `${path}.default`,
                id,
              ),
            }),
      };
    }

    if (type === 'repeat') {
      const count =
        rawStep.count === undefined
          ? undefined
          : this.normalizePositiveInteger(rawStep.count, `Step "${id}" count`);
      const predicate =
        rawStep.while === undefined
          ? undefined
          : this.normalizePredicate(rawStep.while, `${path}.while`);
      if (count === undefined && predicate === undefined) {
        throw new BadRequestException(
          `Step "${id}" must define count or while.`,
        );
      }
      if (count !== undefined && predicate !== undefined) {
        throw new BadRequestException(
          `Step "${id}" cannot define both count and while.`,
        );
      }
      const maxIterations = this.normalizePositiveInteger(
        rawStep.maxIterations ?? count,
        `Step "${id}" maxIterations`,
      );
      if (maxIterations > 1000) {
        throw new BadRequestException(
          `Step "${id}" maxIterations must be 1000 or fewer.`,
        );
      }
      return {
        id,
        type,
        ...(count === undefined ? {} : { count }),
        ...(predicate === undefined ? {} : { while: predicate }),
        maxIterations,
        steps: this.normalizeNestedSteps(
          rawStep.steps,
          seenIds,
          `${path}.steps`,
          id,
        ),
      };
    }

    if (typeof rawStep.uses !== 'string' || !rawStep.uses.trim()) {
      throw new BadRequestException(`Step ${index + 1} must define uses.`);
    }
    const uses = rawStep.uses.trim();
    const input = rawStep.with === undefined ? {} : rawStep.with;
    if (!isRecord(input)) {
      throw new BadRequestException(`Step "${id}" with must be an object.`);
    }

    return {
      id,
      uses,
      with: this.registry.normalizeInput(uses, input),
    };
  }

  private normalizeStepId(rawId: unknown, rawBase: unknown, index: number) {
    const id =
      typeof rawId === 'string' && rawId.trim()
        ? rawId.trim()
        : stableStepId(typeof rawBase === 'string' ? rawBase : 'step', index);
    if (id.length > 120) {
      throw new BadRequestException(`Step id "${id}" is too long.`);
    }
    return id;
  }

  private normalizeNestedSteps(
    rawSteps: unknown,
    seenIds: Set<string>,
    path: string,
    id: string,
  ) {
    if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
      throw new BadRequestException(`Step "${id}" ${path} must contain steps.`);
    }
    return this.normalizeSteps(rawSteps, seenIds, path);
  }

  private normalizeValueRef(value: unknown, path: string): AutomationValueRef {
    if (!isRecord(value)) {
      throw new BadRequestException(`${path} must be an object.`);
    }
    if (
      value.source !== 'literal' &&
      value.source !== 'context' &&
      value.source !== 'step'
    ) {
      throw new BadRequestException(`${path}.source is invalid.`);
    }
    if (value.source === 'literal') {
      return { source: value.source, value: value.value };
    }
    if (typeof value.path !== 'string' || !value.path.trim()) {
      throw new BadRequestException(`${path}.path is required.`);
    }
    if (value.source === 'step') {
      if (typeof value.stepId !== 'string' || !value.stepId.trim()) {
        throw new BadRequestException(`${path}.stepId is required.`);
      }
      return {
        source: value.source,
        stepId: value.stepId.trim(),
        path: value.path.trim(),
      };
    }
    return { source: value.source, path: value.path.trim() };
  }

  private normalizePredicate(
    value: unknown,
    path: string,
  ): AutomationPredicate {
    if (!isRecord(value)) {
      throw new BadRequestException(`${path} must be an object.`);
    }
    if (
      typeof value.operator !== 'string' ||
      !predicateOperators.has(value.operator as AutomationPredicateOperator)
    ) {
      throw new BadRequestException(`${path}.operator is invalid.`);
    }
    const operator = value.operator as AutomationPredicateOperator;
    return {
      left: this.normalizeValueRef(value.left, `${path}.left`),
      operator,
      ...(operator === 'exists'
        ? {}
        : { right: this.normalizeValueRef(value.right, `${path}.right`) }),
    };
  }

  private normalizePositiveInteger(value: unknown, label: string) {
    if (!Number.isInteger(value) || typeof value !== 'number' || value < 1) {
      throw new BadRequestException(`${label} must be a positive integer.`);
    }
    return value;
  }
}
