import { describe, it, expect } from "vitest";

import { clampPercent, formatDuration, formatResetRelative } from "../src/lib/reset-format.js";

describe("clampPercent", () => {
  it("returns the value when in range", () => {
    expect(clampPercent(50)).toBe(50);
  });

  it("clamps negative values to 0", () => {
    expect(clampPercent(-10)).toBe(0);
  });

  it("clamps values above 100 to 100", () => {
    expect(clampPercent(150)).toBe(100);
  });

  it("rounds non-integer values", () => {
    expect(clampPercent(33.4)).toBe(33);
  });

  it("returns 0 for NaN", () => {
    expect(clampPercent(NaN)).toBe(0);
  });
});

describe("formatDuration", () => {
  it("returns 0s for 0", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats seconds under a minute", () => {
    expect(formatDuration(45_000)).toBe("45s");
  });

  it("formats exactly one hour", () => {
    expect(formatDuration(3_600_000)).toBe("1h 0m");
  });

  it("formats one day and one hour", () => {
    expect(formatDuration(86_400_000 + 3_600_000)).toBe("1d 1h");
  });
});

describe("formatResetRelative", () => {
  it("returns empty string for undefined", () => {
    expect(formatResetRelative(undefined)).toBe("");
  });

  it("returns empty string for an unparseable date", () => {
    expect(formatResetRelative("not-a-date")).toBe("");
  });

  it("formats a date one hour in the future", () => {
    const now = new Date("2025-01-01T00:00:00.000Z");
    const oneHourLater = new Date("2025-01-01T01:00:00.000Z").toISOString();
    expect(formatResetRelative(oneHourLater, now)).toBe("in 1h 0m");
  });
});
