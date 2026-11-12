import { BadRequestException } from '@nestjs/common';
import {
  isControlStepType,
  isRecord,
  normalizePositiveInteger,
  normalizeStepId,
  stableStepId,
} from './automation-definition-normalizer.utils';

describe('automation definition normalizer utils', () => {
  it('detects plain records and known control step types', () => {
    expect(isRecord({ value: true })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isControlStepType('condition')).toBe(true);
    expect(isControlStepType('action')).toBe(false);
  });

  it('builds stable step ids and preserves explicit ids', () => {
    expect(stableStepId('android.tap', 1)).toBe('android-tap-2');
    expect(stableStepId('***', 0)).toBe('step-1');
    expect(normalizeStepId(' custom ', 'android.tap', 0)).toBe('custom');
    expect(normalizeStepId(undefined, 'android.tap', 0)).toBe('android-tap-1');
  });

  it('rejects invalid step ids and positive integers with descriptive errors', () => {
    expect(() => normalizeStepId('x'.repeat(121), 'step', 0)).toThrow(
      BadRequestException,
    );
    expect(() => normalizePositiveInteger(0, 'count')).toThrow(
      BadRequestException,
    );
    expect(normalizePositiveInteger(3, 'count')).toBe(3);
  });
});
