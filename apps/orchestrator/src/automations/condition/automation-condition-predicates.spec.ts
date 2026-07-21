import { conditionOperators } from '@rebroid/automation-core/metadata';
import { evaluateConditionPredicate } from './automation-condition-predicates';

describe('evaluateConditionPredicate', () => {
  const cases = [
    ['exists', 'value', undefined, true],
    ['doesNotExist', null, undefined, true],
    ['isEmpty', [], undefined, true],
    ['isNotEmpty', { key: true }, undefined, true],
    ['isTrue', true, undefined, true],
    ['isFalse', false, undefined, true],
    ['equals', 'same', 'same', true],
    ['notEquals', 1, '1', true],
    ['contains', 'rebroid', 'broid', true],
    ['doesNotContain', 'rebroid', 'other', true],
    ['matches', 'app-123', '^app-\\d+$', true],
    ['greaterThan', 3, 2, true],
    ['greaterThanOrEqual', 3, 3, true],
    ['lessThan', 2, 3, true],
    ['lessThanOrEqual', 3, 3, true],
    ['lengthEquals', ['a', 'b'], 2, true],
    ['lengthGreaterThan', 'abc', 2, true],
    ['lengthLessThan', [], 1, true],
  ] as const;

  it.each(cases)(
    '%s evaluates its supported input',
    (operator, value, compare, expected) => {
      expect(evaluateConditionPredicate(operator, value, compare)).toBe(
        expected,
      );
    },
  );

  it('covers every declared condition operator', () => {
    expect(cases.map(([operator]) => operator).sort()).toEqual(
      [...conditionOperators].sort(),
    );
  });

  it('returns false for invalid regular expressions and incomparable lengths', () => {
    expect(evaluateConditionPredicate('matches', 'value', '[')).toBe(false);
    expect(evaluateConditionPredicate('lengthEquals', {}, 0)).toBe(false);
  });
});
