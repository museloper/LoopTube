import { describe, expect, it } from "vitest";
import { summarize } from "./stats";

describe("summarize", () => {
  it("returns null with nothing to summarize", () => {
    expect(summarize([])).toBeNull();
  });

  it("reports the percentiles the accuracy target is stated in", () => {
    const summary = summarize(Array.from({ length: 100 }, (_, i) => i + 1))!;
    expect(summary).toMatchObject({ count: 100, p50: 50, p95: 95, min: 1, max: 100 });
  });

  it("handles a single sample", () => {
    expect(summarize([7])).toMatchObject({ p50: 7, p95: 7, max: 7, min: 7 });
  });

  it("leaves the caller's array alone", () => {
    const input = [3, 1, 2];
    summarize(input);
    expect(input).toEqual([3, 1, 2]);
  });
});
