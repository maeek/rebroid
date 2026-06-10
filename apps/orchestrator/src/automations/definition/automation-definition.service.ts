import { BadRequestException, Injectable } from '@nestjs/common';
import { parse, stringify } from 'yaml';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationConditionService } from '../condition/automation-condition.service';
import { normalizeAutomationTags } from '../tags/automation-tags';
import { controlStepOutputs } from '@rebroid/automation-core/metadata';
import {
  AUTOMATION_API_VERSION,
  AUTOMATION_KIND,
  AutomationDefinition,
  AutomationDefinitionStep,
  AutomationDefinitionMetadata,
  AutomationSwitchCase,
} from '@rebroid/automation-core/definition';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const controlTypes = new Set(['condition', 'switch', 'repeat']);

const stableStepId = (base: string, index: number) =>
  `${base.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'step'}-${index + 1}`;

@Injectable()
export class AutomationDefinitionService {
  constructor(
    private readonly registry: AutomationCommandRegistryService,
    private readonly conditions: AutomationConditionService,
  ) {}

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
    const steps = this.normalizeSteps(
      spec.steps,
      seenIds,
      'spec.steps',
      new Map(),
    );

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
    availableStepOutputs: Map<string, Set<string>>,
  ): AutomationDefinitionStep[] {
    const steps: AutomationDefinitionStep[] = [];
    for (const [index, rawStep] of rawSteps.entries()) {
      const step = this.normalizeStep(
        rawStep,
        index,
        seenIds,
        `${path}[${index}]`,
        availableStepOutputs,
      );
      steps.push(step);
      availableStepOutputs.set(step.id, this.outputKeysForStep(step));
    }
    return steps;
  }

  private normalizeStep(
    rawStep: unknown,
    index: number,
    seenIds: Set<string>,
    path: string,
    availableStepOutputs: Map<string, Set<string>>,
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
      return this.normalizeConditionStep(
        rawStep,
        id,
        path,
        seenIds,
        availableStepOutputs,
      );
    }

    if (type === 'switch') {
      return this.normalizeSwitchStep(
        rawStep,
        id,
        path,
        seenIds,
        availableStepOutputs,
      );
    }

    if (type === 'repeat') {
      return this.normalizeRepeatStep(
        rawStep,
        id,
        path,
        seenIds,
        availableStepOutputs,
      );
    }

    if (typeof rawStep.uses !== 'string' || !rawStep.uses.trim()) {
      throw new BadRequestException(`Step ${index + 1} must define uses.`);
    }
    return this.normalizeActionStep(rawStep, id);
  }

  private normalizeConditionStep(
    rawStep: Record<string, unknown>,
    id: string,
    path: string,
    seenIds: Set<string>,
    availableStepOutputs: Map<string, Set<string>>,
  ) {
    const condition = this.conditions.normalizeExpression(
      rawStep.condition,
      `${path}.condition`,
    );
    this.conditions.validateExpressionReferences(
      condition,
      availableStepOutputs,
      `${path}.condition`,
    );
    const branchOutputs = cloneAvailableStepOutputs(availableStepOutputs);
    branchOutputs.set(id, outputKeysForUses('flow.condition'));
    return {
      id,
      type: 'condition' as const,
      condition,
      then: this.normalizeNestedSteps(
        rawStep.then,
        seenIds,
        `${path}.then`,
        id,
        cloneAvailableStepOutputs(branchOutputs),
      ),
      ...(rawStep.else === undefined
        ? {}
        : {
            else: this.normalizeNestedSteps(
              rawStep.else,
              seenIds,
              `${path}.else`,
              id,
              cloneAvailableStepOutputs(branchOutputs),
            ),
          }),
    };
  }

  private normalizeSwitchStep(
    rawStep: Record<string, unknown>,
    id: string,
    path: string,
    seenIds: Set<string>,
    availableStepOutputs: Map<string, Set<string>>,
  ) {
    if (!Array.isArray(rawStep.cases)) {
      throw new BadRequestException(`Step "${id}" cases must be an array.`);
    }
    const caseOutputs = cloneAvailableStepOutputs(availableStepOutputs);
    caseOutputs.set(id, outputKeysForUses('flow.switch'));
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
            cloneAvailableStepOutputs(caseOutputs),
          ),
        };
      },
    );
    return {
      id,
      type: 'switch' as const,
      value: this.normalizeSwitchValueRef(
        rawStep.value,
        `${path}.value`,
        availableStepOutputs,
      ),
      cases,
      ...(rawStep.default === undefined
        ? {}
        : {
            default: this.normalizeNestedSteps(
              rawStep.default,
              seenIds,
              `${path}.default`,
              id,
              cloneAvailableStepOutputs(caseOutputs),
            ),
          }),
    };
  }

  private normalizeRepeatStep(
    rawStep: Record<string, unknown>,
    id: string,
    path: string,
    seenIds: Set<string>,
    availableStepOutputs: Map<string, Set<string>>,
  ) {
    const count =
      rawStep.count === undefined
        ? undefined
        : this.normalizePositiveInteger(rawStep.count, `Step "${id}" count`);
    const predicate =
      rawStep.while === undefined
        ? undefined
        : this.conditions.normalizeExpression(rawStep.while, `${path}.while`);
    if (predicate) {
      this.conditions.validateExpressionReferences(
        predicate,
        availableStepOutputs,
        `${path}.while`,
      );
    }
    if (count === undefined && predicate === undefined) {
      throw new BadRequestException(`Step "${id}" must define count or while.`);
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
      type: 'repeat' as const,
      ...(count === undefined ? {} : { count }),
      ...(predicate === undefined ? {} : { while: predicate }),
      maxIterations,
      steps: this.normalizeNestedSteps(
        rawStep.steps,
        seenIds,
        `${path}.steps`,
        id,
        cloneAvailableStepOutputs(availableStepOutputs),
      ),
    };
  }

  private normalizeActionStep(rawStep: Record<string, unknown>, id: string) {
    const uses = typeof rawStep.uses === 'string' ? rawStep.uses.trim() : '';
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
    availableStepOutputs: Map<string, Set<string>>,
  ) {
    if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
      throw new BadRequestException(`Step "${id}" ${path} must contain steps.`);
    }
    return this.normalizeSteps(rawSteps, seenIds, path, availableStepOutputs);
  }

  private normalizeSwitchValueRef(
    value: unknown,
    path: string,
    availableStepOutputs: Map<string, Set<string>>,
  ) {
    const ref = this.conditions.normalizeExpression(
      {
        groups: [
          {
            conditions: [
              {
                value,
                operator: 'exists',
              },
            ],
          },
        ],
      },
      path,
    ).groups[0].conditions[0].value;
    this.conditions.validateExpressionReferences(
      {
        groups: [{ conditions: [{ value: ref, operator: 'exists' }] }],
      },
      availableStepOutputs,
      path,
    );
    return ref;
  }

  private outputKeysForStep(step: AutomationDefinitionStep) {
    if ('uses' in step) {
      return new Set(
        this.registry.outputsFor(step.uses).map((output) => output.key),
      );
    }
    return outputKeysForUses(`flow.${step.type}`);
  }

  private normalizePositiveInteger(value: unknown, label: string) {
    if (!Number.isInteger(value) || typeof value !== 'number' || value < 1) {
      throw new BadRequestException(`${label} must be a positive integer.`);
    }
    return value;
  }
}

const outputKeysForUses = (uses: string) =>
  new Set((controlStepOutputs[uses] ?? []).map((output) => output.key));

const cloneAvailableStepOutputs = (source: Map<string, Set<string>>) =>
  new Map(
    [...source.entries()].map(([stepId, outputs]) => [
      stepId,
      new Set(outputs),
    ]),
  );
