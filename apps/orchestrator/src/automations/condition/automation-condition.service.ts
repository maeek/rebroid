import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AutomationConditionExpression,
  AutomationConditionOperator,
  AutomationConditionRule,
  AutomationValueRef,
} from '@rebroid/automation-core/definition';
import {
  conditionOperators,
  runContextOutputs,
  unaryOperators,
} from '@rebroid/automation-core/metadata';
import { evaluateConditionPredicate } from './automation-condition-predicates';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const conditionOperatorSet = new Set<AutomationConditionOperator>(
  conditionOperators,
);

export interface AutomationConditionRuntimeState {
  runId: string;
  trigger: string;
  targetProfileMode: string | null;
  targetProfileName: string | null;
  app: Record<string, unknown>;
  outputsByStepId: Map<string, Record<string, unknown> | null>;
}

@Injectable()
export class AutomationConditionService {
  normalizeExpression(
    value: unknown,
    path: string,
  ): AutomationConditionExpression {
    if (!isRecord(value) || !Array.isArray(value.groups)) {
      throw new BadRequestException(`${path}.groups must be an array.`);
    }
    if (value.groups.length === 0) {
      throw new BadRequestException(`${path}.groups must not be empty.`);
    }

    return {
      groups: value.groups.map((group, groupIndex) => {
        if (!isRecord(group) || !Array.isArray(group.conditions)) {
          throw new BadRequestException(
            `${path}.groups[${groupIndex}].conditions must be an array.`,
          );
        }
        if (group.conditions.length === 0) {
          throw new BadRequestException(
            `${path}.groups[${groupIndex}].conditions must not be empty.`,
          );
        }
        return {
          conditions: group.conditions.map((condition, conditionIndex) =>
            this.normalizeRule(
              condition,
              `${path}.groups[${groupIndex}].conditions[${conditionIndex}]`,
            ),
          ),
        };
      }),
    };
  }

  evaluate(
    expression: AutomationConditionExpression,
    state: AutomationConditionRuntimeState,
  ) {
    return expression.groups.some((group) =>
      group.conditions.every((condition) =>
        this.evaluateRule(condition, state),
      ),
    );
  }

  resolveValueRef(
    ref: AutomationValueRef,
    state: AutomationConditionRuntimeState,
  ) {
    if (ref.source === 'literal') {
      return ref.value;
    }
    if (ref.source === 'runContext') {
      return this.valueAtPath(
        {
          runId: state.runId,
          trigger: state.trigger,
          targetApplicationId: state.app.id,
          targetProfileMode: state.targetProfileMode,
          targetProfileName: state.targetProfileName,
          app: state.app,
        },
        ref.key,
      );
    }
    return this.valueAtPath(
      state.outputsByStepId.get(ref.stepId) ?? undefined,
      ref.outputKey,
    );
  }

  validateExpressionReferences(
    expression: AutomationConditionExpression,
    availableStepOutputs: Map<string, Set<string>>,
    path: string,
  ) {
    expression.groups.forEach((group, groupIndex) => {
      group.conditions.forEach((condition, conditionIndex) => {
        const conditionPath = `${path}.groups[${groupIndex}].conditions[${conditionIndex}]`;
        this.validateValueRef(
          condition.value,
          availableStepOutputs,
          `${conditionPath}.value`,
        );
        if (condition.compare) {
          this.validateValueRef(
            condition.compare,
            availableStepOutputs,
            `${conditionPath}.compare`,
          );
        }
      });
    });
  }

  private normalizeRule(value: unknown, path: string): AutomationConditionRule {
    if (!isRecord(value)) {
      throw new BadRequestException(`${path} must be an object.`);
    }
    if (
      typeof value.operator !== 'string' ||
      !conditionOperatorSet.has(value.operator as AutomationConditionOperator)
    ) {
      throw new BadRequestException(`${path}.operator is invalid.`);
    }
    const operator = value.operator as AutomationConditionOperator;
    return {
      value: this.normalizeValueRef(value.value, `${path}.value`),
      operator,
      ...(unaryOperators.has(operator)
        ? {}
        : {
            compare: this.normalizeValueRef(value.compare, `${path}.compare`),
          }),
    };
  }

  private normalizeValueRef(value: unknown, path: string): AutomationValueRef {
    if (!isRecord(value)) {
      throw new BadRequestException(`${path} must be an object.`);
    }
    if (value.source === 'literal') {
      return { source: 'literal', value: value.value };
    }
    if (value.source === 'runContext') {
      if (typeof value.key !== 'string' || !value.key.trim()) {
        throw new BadRequestException(`${path}.key is required.`);
      }
      return { source: 'runContext', key: value.key.trim() };
    }
    if (value.source === 'stepOutput') {
      if (typeof value.stepId !== 'string' || !value.stepId.trim()) {
        throw new BadRequestException(`${path}.stepId is required.`);
      }
      if (typeof value.outputKey !== 'string' || !value.outputKey.trim()) {
        throw new BadRequestException(`${path}.outputKey is required.`);
      }
      return {
        source: 'stepOutput',
        stepId: value.stepId.trim(),
        outputKey: value.outputKey.trim(),
      };
    }
    throw new BadRequestException(`${path}.source is invalid.`);
  }

  private validateValueRef(
    ref: AutomationValueRef,
    availableStepOutputs: Map<string, Set<string>>,
    path: string,
  ) {
    if (ref.source === 'literal') return;
    if (ref.source === 'runContext') {
      if (!runContextOutputs.some((output) => output.key === ref.key)) {
        throw new BadRequestException(`${path}.key "${ref.key}" is unknown.`);
      }
      return;
    }

    const outputs = availableStepOutputs.get(ref.stepId);
    if (!outputs) {
      throw new BadRequestException(
        `${path}.stepId "${ref.stepId}" must reference an earlier step.`,
      );
    }
    if (!outputs.has(ref.outputKey)) {
      throw new BadRequestException(
        `${path}.outputKey "${ref.outputKey}" is not available on step "${ref.stepId}".`,
      );
    }
  }

  private evaluateRule(
    condition: AutomationConditionRule,
    state: AutomationConditionRuntimeState,
  ) {
    const value = this.resolveValueRef(condition.value, state);
    const compare = condition.compare
      ? this.resolveValueRef(condition.compare, state)
      : undefined;

    return evaluateConditionPredicate(condition.operator, value, compare);
  }

  private valueAtPath(value: unknown, path?: string) {
    if (!path) {
      return value;
    }
    return path.split('.').reduce<unknown>((current, segment) => {
      if (current === undefined || current === null) {
        return undefined;
      }
      if (Array.isArray(current) && /^\d+$/.test(segment)) {
        return current[Number(segment)];
      }
      if (typeof current === 'object') {
        return (current as Record<string, unknown>)[segment];
      }
      return undefined;
    }, value);
  }
}
