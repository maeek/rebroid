import { normalizeDockerOperationLimits } from './docker-operation-limits-settings';

const valid = {
  maxConcurrentReads: 8,
  maxConcurrentLongOperations: 4,
  slowRequestWarningMs: 5000,
  longOperationTimeoutMs: 1_800_000,
};

it('preserves valid stored operation limits and ignores malformed values', () => {
  expect(normalizeDockerOperationLimits(valid)).toEqual(valid);
  for (const value of [
    null,
    {},
    { ...valid, maxConcurrentReads: 0 },
    { ...valid, maxConcurrentLongOperations: 99 },
    { ...valid, slowRequestWarningMs: '5000' },
    { ...valid, longOperationTimeoutMs: Infinity },
  ]) {
    expect(normalizeDockerOperationLimits(value)).toBeUndefined();
  }
});
