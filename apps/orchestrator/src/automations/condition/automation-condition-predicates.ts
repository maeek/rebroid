import type { AutomationConditionOperator } from '@rebroid/automation-core/definition';

type ConditionPredicate = (value: unknown, compare: unknown) => boolean;

const isEmpty = (value: unknown) => {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' || Array.isArray(value)) {
    return value.length === 0;
  }
  return typeof value === 'object' && Object.keys(value).length === 0;
};

const lengthOf = (value: unknown) =>
  typeof value === 'string' || Array.isArray(value) ? value.length : Number.NaN;

const matches = (value: unknown, compare: unknown) => {
  try {
    return new RegExp(String(compare ?? '')).test(String(value ?? ''));
  } catch {
    return false;
  }
};

const predicates: Record<AutomationConditionOperator, ConditionPredicate> = {
  exists: (value) => value !== undefined && value !== null,
  doesNotExist: (value) => value === undefined || value === null,
  isEmpty,
  isNotEmpty: (value) => !isEmpty(value),
  isTrue: (value) => value === true,
  isFalse: (value) => value === false,
  equals: (value, compare) => Object.is(value, compare),
  notEquals: (value, compare) => !Object.is(value, compare),
  contains: (value, compare) =>
    String(value ?? '').includes(String(compare ?? '')),
  doesNotContain: (value, compare) =>
    !String(value ?? '').includes(String(compare ?? '')),
  matches,
  greaterThan: (value, compare) => Number(value) > Number(compare),
  greaterThanOrEqual: (value, compare) => Number(value) >= Number(compare),
  lessThan: (value, compare) => Number(value) < Number(compare),
  lessThanOrEqual: (value, compare) => Number(value) <= Number(compare),
  lengthEquals: (value, compare) => lengthOf(value) === Number(compare),
  lengthGreaterThan: (value, compare) => lengthOf(value) > Number(compare),
  lengthLessThan: (value, compare) => lengthOf(value) < Number(compare),
};

export const evaluateConditionPredicate = (
  operator: AutomationConditionOperator,
  value: unknown,
  compare?: unknown,
) => predicates[operator](value, compare);
