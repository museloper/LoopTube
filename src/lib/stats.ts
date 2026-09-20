export interface Summary {
  count: number;
  p50: number;
  p95: number;
  max: number;
  min: number;
  mean: number;
}

export function summarize(values: number[]): Summary | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1]!,
    min: sorted[0]!,
    mean: sorted.reduce((sum, v) => sum + v, 0) / sorted.length,
  };
}

/** `sorted` must already be ascending. */
function percentile(sorted: number[], q: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index]!;
}
