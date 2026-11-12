import { describe, it, expect } from "vitest";

import {
  isActiveGoProvider,
  tickBar,
  windowPaceText,
  windowTickBar,
} from "../src/lib/cli-format.js";
import type { QuotaWindow } from "../src/lib/types.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function window_(over: Partial<QuotaWindow>): QuotaWindow {
  return { id: "weekly", label: "Weekly", percentRemaining: 50, ...over };
}

describe("tickBar", () => {
  it("keeps the width: the tick replaces a cell", () => {
    const bar = tickBar(60, 20, 30);
    expect(bar.tick).toBe("│");
    expect((bar.before + bar.tick + bar.after).length).toBe(20);
  });

  it("puts the tick where the pace line is", () => {
    const bar = tickBar(100, 11, 50);
    expect(bar.before.length).toBe(5);
    expect(bar.after.length).toBe(5);
  });

  it("pins the tick to the first and last cell at 0 and 100", () => {
    expect(tickBar(50, 10, 0).before).toBe("");
    expect(tickBar(50, 10, 100).after).toBe("");
  });

  it("clamps a marker outside 0-100", () => {
    expect(tickBar(50, 10, 250).after).toBe("");
    expect(tickBar(50, 10, -40).before).toBe("");
  });

  it("draws no tick without a marker", () => {
    const bar = tickBar(40, 10, null);
    expect(bar.tick).toBe("");
    expect(bar.before).toBe("▓▓▓▓░░░░░░");
    expect(bar.after).toBe("");
  });

  it("fills as many cells as the quota left", () => {
    const bar = tickBar(80, 10, null);
    expect(bar.before).toBe("▓▓▓▓▓▓▓▓░░");
  });
});

describe("windowTickBar", () => {
  const now = Date.UTC(2026, 10, 12, 12, 0, 0);

  it("has a tick when the window carries a reset time and a known length", () => {
    const reset = new Date(now + 3.5 * DAY_MS).toISOString();
    const bar = windowTickBar(window_({ resetTimeIso: reset }), 20, now);
    expect(bar.tick).toBe("│");
    expect((bar.before + bar.tick + bar.after).length).toBe(20);
  });

  it("has no tick without a reset time", () => {
    expect(windowTickBar(window_({}), 20, now).tick).toBe("");
  });

  it("has no tick for a window of unknown length", () => {
    const reset = new Date(now + DAY_MS).toISOString();
    const bar = windowTickBar(window_({ id: "monthly", label: "Code Review" }), 20, now);
    expect(bar.tick).toBe("");
    expect(reset).toBeTruthy();
  });
});

describe("windowPaceText", () => {
  const now = Date.UTC(2026, 10, 12, 12, 0, 0);

  it("is green with margin when the quota left is ahead of the clock", () => {
    const reset = new Date(now + 3.5 * DAY_MS).toISOString(); // 50% of the week left
    const pace = windowPaceText(window_({ percentRemaining: 80, resetTimeIso: reset }), now);
    expect(pace?.tone).toBe("ok");
    expect(pace?.text.startsWith("margin +30%")).toBe(true);
  });

  it("is red when the quota is being spent faster than the clock", () => {
    const reset = new Date(now + 3.5 * DAY_MS).toISOString();
    const pace = windowPaceText(window_({ percentRemaining: 20, resetTimeIso: reset }), now);
    expect(pace?.tone).toBe("error");
    expect(pace?.text.startsWith("ahead -30%")).toBe(true);
  });

  it("is dim when on pace", () => {
    const reset = new Date(now + 3.5 * DAY_MS).toISOString();
    const pace = windowPaceText(window_({ percentRemaining: 50, resetTimeIso: reset }), now);
    expect(pace).toEqual({ text: "on pace", tone: "dim" });
  });

  it("is null without schedule data", () => {
    expect(windowPaceText(window_({ percentRemaining: 50 }), now)).toBeNull();
  });
});

describe("isActiveGoProvider", () => {
  it("matches the active named account ignoring case", () => {
    expect(isActiveGoProvider("opencode-go-aRaN", "aran")).toBe(true);
    expect(isActiveGoProvider("opencode-go-aran", "aRaN")).toBe(true);
  });

  it("does not match another account or another provider", () => {
    expect(isActiveGoProvider("opencode-go-work", "aRaN")).toBe(false);
    expect(isActiveGoProvider("github-copilot", "aRaN")).toBe(false);
  });

  it("does not mark the base card, and marks nothing without an active account", () => {
    expect(isActiveGoProvider("opencode-go", "aRaN")).toBe(false);
    expect(isActiveGoProvider("opencode-go-aRaN", undefined)).toBe(false);
    expect(isActiveGoProvider("opencode-go-aRaN", "  ")).toBe(false);
  });
});
