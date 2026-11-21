// All three viewer renderers use nearest-rank percentiles for presentation gaps.
export function summarizeFrameGaps(gaps: number[]) {
  // Sample order is no longer needed when an interval is reported.
  gaps.sort((left, right) => left - right);
  const length = gaps.length;
  return {
    frameGapP50Ms: gaps.at(Math.ceil(length * 0.5) - 1),
    frameGapP95Ms: gaps.at(Math.ceil(length * 0.95) - 1),
    frameGapP99Ms: gaps.at(Math.ceil(length * 0.99) - 1),
    frameGapMaxMs: gaps.at(-1),
  };
}
