import { BadRequestException } from '@nestjs/common';
import {
  cloneAvailableStepOutputs,
  isControlStepType,
  isRecord,
  normalizePositiveInteger,
  normalizeStepId,
  outputKeysForUses,
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

  it('clones available output sets without sharing nested sets', () => {
    const source = new Map([['step-1', new Set(['summary'])]]);
    const clone = cloneAvailableStepOutputs(source);

    clone.get('step-1')?.add('result');

    expect([...source.get('step-1')!]).toEqual(['summary']);
    expect([...clone.get('step-1')!]).toEqual(['summary', 'result']);
  });

  it('returns control step output keys by automation command use', () => {
    expect(outputKeysForUses('flow.condition').has('matched')).toBe(true);
    expect(outputKeysForUses('unknown.command').size).toBe(0);
  });
});
