import { BadRequestException } from '@nestjs/common';
import { controlStepOutputs } from '@rebroid/automation-core/metadata';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const controlTypes = new Set(['condition', 'switch', 'repeat']);

export const isControlStepType = (
  value: unknown,
): value is 'condition' | 'switch' | 'repeat' =>
  typeof value === 'string' && controlTypes.has(value);

export const stableStepId = (base: string, index: number) =>
  `${base.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'step'}-${index + 1}`;

export const normalizeStepId = (
  rawId: unknown,
  rawBase: unknown,
  index: number,
) => {
  const id =
    typeof rawId === 'string' && rawId.trim()
      ? rawId.trim()
      : stableStepId(typeof rawBase === 'string' ? rawBase : 'step', index);
  if (id.length > 120) {
    throw new BadRequestException(`Step id "${id}" is too long.`);
  }
  return id;
};

export const normalizePositiveInteger = (value: unknown, label: string) => {
  if (!Number.isInteger(value) || typeof value !== 'number' || value < 1) {
    throw new BadRequestException(`${label} must be a positive integer.`);
  }
  return value;
};

export const outputKeysForUses = (uses: string) =>
  new Set((controlStepOutputs[uses] ?? []).map((output) => output.key));

export const cloneAvailableStepOutputs = (source: Map<string, Set<string>>) =>
  new Map(
    [...source.entries()].map(([stepId, outputs]) => [
      stepId,
      new Set(outputs),
    ]),
  );
