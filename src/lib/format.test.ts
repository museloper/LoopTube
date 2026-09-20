import { describe, expect, it } from "vitest";
import { formatTime } from "./format";

describe("formatTime", () => {
  it("shows tenths, which is the resolution loop points are nudged at", () => {
    expect(formatTime(83.4)).toBe("1:23.4");
  });

  it("adds an hours field only when needed", () => {
    expect(formatTime(3723.9)).toBe("1:02:03.9");
    expect(formatTime(59.9)).toBe("0:59.9");
  });

  it("can drop the tenths for durations", () => {
    expect(formatTime(83.4, false)).toBe("1:23");
  });

  it.each([-5, NaN, Infinity])("clamps %s to zero", (value) => {
    expect(formatTime(value)).toBe("0:00.0");
  });
});

describe("formatTime rounding", () => {
  it("does not lose a tenth to floating point", () => {
    expect(formatTime(59.9)).toBe("0:59.9");
    expect(formatTime(0.3)).toBe("0:00.3");
    expect(formatTime(10.7)).toBe("0:10.7");
  });

  it("carries into the next second instead of printing .10", () => {
    expect(formatTime(59.96)).toBe("1:00.0");
    expect(formatTime(3599.99)).toBe("1:00:00.0");
  });
});
