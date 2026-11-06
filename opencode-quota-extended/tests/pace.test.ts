import { describe, it, expect } from "vitest";

import { formatPace, quotaPace, windowDurationMs } from "../src/lib/pace.js";
import type { QuotaWindow } from "../src/lib/types.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function window_(over: Partial<QuotaWindow>): QuotaWindow {
  return { id: "weekly", label: "Weekly", percentRemaining: 50, ...over };
}

describe("windowDurationMs", () => {
  it("maps a 5h window", () => {
    expect(windowDurationMs({ id: "5h", label: "5h" })).toBe(5 * HOUR_MS);
  });

  it("maps a weekly window", () => {
    expect(windowDurationMs({ id: "weekly", label: "Weekly" })).toBe(7 * DAY_MS);
  });

  it("maps a monthly window", () => {
    expect(windowDurationMs({ id: "monthly", label: "Monthly" })).toBe(30 * DAY_MS);
  });

  it("returns null for an unknown schedule", () => {
    expect(windowDurationMs({ id: "code-review", label: "Code Review" })).toBeNull();
    expect(windowDurationMs({ id: "primary", label: "Primary" })).toBeNull();
  });
});

describe("quotaPace", () => {
  it("reads margin when more quota remains than time", () => {
    const now = 0;
    const reset = new Date(now + 3.5 * DAY_MS).toISOString();
    const reading = quotaPace(window_({ percentRemaining: 80, resetTimeIso: reset }), now);
    expect(reading).toEqual({ pace: "buffer", deltaPercent: 30, deltaMs: 0.3 * 7 * DAY_MS });
  });

  it("reads ahead when quota is spent faster than time", () => {
    const now = 0;
    const reset = new Date(now + DAY_MS).toISOString();
    const reading = quotaPace(window_({ percentRemaining: 5, resetTimeIso: reset }), now);
    expect(reading).toEqual({ pace: "burn", deltaPercent: -9, deltaMs: 56_160_000 });
  });

  it("reads on pace when both are level", () => {
    const now = 0;
    const reset = new Date(now + 3.5 * DAY_MS).toISOString();
    const reading = quotaPace(window_({ percentRemaining: 50, resetTimeIso: reset }), now);
    expect(reading).toEqual({ pace: "on-pace", deltaPercent: 0, deltaMs: 0 });
  });

  it("returns null without a reset time", () => {
    expect(quotaPace(window_({ percentRemaining: 80 }), 0)).toBeNull();
  });

  it("returns null for a window with no known schedule", () => {
    const reset = new Date(DAY_MS).toISOString();
    expect(
      quotaPace(window_({ id: "code-review", label: "Code Review", resetTimeIso: reset }), 0),
    ).toBeNull();
  });
});

describe("formatPace", () => {
  const now = 0;

  it("formats margin with percent and window time", () => {
    const reset = new Date(now + 3.5 * DAY_MS).toISOString();
    expect(formatPace(window_({ percentRemaining: 80, resetTimeIso: reset }), now)).toBe(
      "margin +30% · 2d 2h",
    );
  });

  it("formats ahead with percent and window time", () => {
    const reset = new Date(now + DAY_MS).toISOString();
    expect(formatPace(window_({ percentRemaining: 5, resetTimeIso: reset }), now)).toBe(
      "ahead -9% · 15h 36m",
    );
  });

  it("formats a level reading", () => {
    const reset = new Date(now + 3.5 * DAY_MS).toISOString();
    expect(formatPace(window_({ percentRemaining: 50, resetTimeIso: reset }), now)).toBe("on pace");
  });

  it("formats a 5h window gap in hours", () => {
    const reset = new Date(now + 2.5 * HOUR_MS).toISOString();
    expect(formatPace(window_({ id: "5h", label: "5h", percentRemaining: 90, resetTimeIso: reset }), now)).toBe(
      "margin +40% · 2h 0m",
    );
  });

  it("returns an empty string when there is nothing to compare", () => {
    expect(formatPace(window_({ percentRemaining: 80 }), now)).toBe("");
  });
});
