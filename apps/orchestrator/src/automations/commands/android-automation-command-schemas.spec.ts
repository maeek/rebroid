import { swipeNormalizedSchema } from './android-automation-command-schemas';

describe('android automation command schemas', () => {
  it('uses start and end points and defaults the swipe duration', () => {
    expect(
      swipeNormalizedSchema.parse({
        start: { x: 0.5, y: 0.9 },
        end: { x: 0.5, y: 0.2 },
      }),
    ).toEqual({
      start: { x: 0.5, y: 0.9 },
      end: { x: 0.5, y: 0.2 },
      durationMs: 300,
    });
  });

  it('rejects flat swipe coordinates', () => {
    expect(() =>
      swipeNormalizedSchema.parse({
        startX: 0.5,
        startY: 0.9,
        endX: 0.5,
        endY: 0.2,
      }),
    ).toThrow();
  });
});
