import assert from 'node:assert/strict';
import { normalizedPointToPixels } from './vision-geometry';

it('normalizedPointToPixels clamps normalized coordinates', () => {
  assert.deepEqual(
    normalizedPointToPixels({ x: 2, y: -1 }, { width: 100, height: 200 }),
    { x: 99, y: 0 },
  );
});
