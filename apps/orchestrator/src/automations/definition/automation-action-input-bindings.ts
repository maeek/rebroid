import {
  actionInputBinding,
  actionInputBindingType,
  hasActionInputBinding,
} from '@rebroid/automation-core/command-registry';
import type { AutomationStepOutputRef } from '@rebroid/automation-core/definition';
import { BadRequestException } from '@nestjs/common';
import type { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import type {
  AvailableStepOutputs,
  AutomationConditionService,
} from '../condition/automation-condition.service';
import { isRecord } from './automation-definition-normalizer.utils';

export const normalizeActionInputs = (
  registry: AutomationCommandRegistryService,
  conditions: AutomationConditionService,
  uses: string,
  input: Record<string, unknown>,
  scope: AvailableStepOutputs,
  path: string,
) => {
  const entries = Object.entries(input);
  const references = entries.filter(([, value]) =>
    hasActionInputBinding(value),
  );
  if (!references.length) return registry.normalizeInput(uses, input);
  const { properties } = registry.inputSchemaFor(uses);
  const bindings = references.map(([key, value]) => {
    const ref = actionInputBinding(value);
    const fieldPath = `${path}.${key}`;
    if (!ref) {
      throw new BadRequestException(
        `${fieldPath}.$ref must identify a step output.`,
      );
    }
    const type = actionInputBindingType(
      uses,
      key,
      isRecord(properties) ? properties[key] : undefined,
    );
    if (!type) {
      throw new BadRequestException(
        `${fieldPath} does not accept a step output.`,
      );
    }
    const output = conditions.validateValueRef(ref, scope, `${fieldPath}.$ref`);
    if (output?.type !== type) {
      throw new BadRequestException(
        `${fieldPath} needs a ${type} output. "${ref.outputKey}" is ${output?.type ?? 'unknown'}.`,
      );
    }
    return [key, { $ref: ref }] as const;
  });
  const literals = Object.fromEntries(
    entries.filter(([, value]) => !hasActionInputBinding(value)),
  );
  const normalized = registry.normalizeInput(
    uses,
    literals,
    bindings.map(([key]) => key),
  );
  return { ...normalized, ...Object.fromEntries(bindings) };
};

export const resolveActionInputBindings = (
  input: Record<string, unknown>,
  resolve: (ref: AutomationStepOutputRef) => unknown,
) =>
  Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (!hasActionInputBinding(value)) return [key, value];
      const ref = actionInputBinding(value);
      if (!ref)
        throw new BadRequestException(
          `Invalid step output reference for "${key}".`,
        );
      const resolved = resolve(ref);
      if (resolved === undefined || resolved === null) {
        throw new BadRequestException(
          `Input "${key}" requires "${ref.stepId}.${ref.outputKey}", but the step returned no value.`,
        );
      }
      return [key, resolved];
    }),
  );
