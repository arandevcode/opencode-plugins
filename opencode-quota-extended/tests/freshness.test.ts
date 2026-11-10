import { describe, expect, it } from "vitest";

import {
  actionableHint,
  formatAge,
  formatReadingAge,
  isCredentialError,
  isReadingStale,
  readingAgeMs,
  staleAfterMs,
  windowResetSinceReading,
} from "../src/lib/freshness.js";

const NOW = Date.parse("2026-11-10T12:00:00.000Z");
const MINUTE = 60_000;

function iso(msAgo: number): string {
  return new Date(NOW - msAgo).toISOString();
}

describe("reading age", () => {
  it("formats recent and older readings with the shared duration helper", () => {
    expect(formatAge(0)).toBe("just now");
    expect(formatAge(59_000)).toBe("just now");
    expect(formatAge(MINUTE)).toBe("1m ago");
    expect(formatAge(5 * MINUTE)).toBe("5m ago");
    expect(formatAge(65 * MINUTE)).toBe("1h 5m ago");
    expect(formatReadingAge(iso(5 * MINUTE), NOW)).toBe("read 5m ago");
  });

  it("clamps future or invalid readings to just now", () => {
    expect(readingAgeMs(new Date(NOW + MINUTE).toISOString(), NOW)).toBe(0);
    expect(formatAge(Number.NaN)).toBe("just now");
    expect(formatReadingAge("not-a-date", NOW)).toBe("read just now");
  });
});

describe("stale threshold", () => {
  it("is three polling intervals at the default interval", () => {
    expect(staleAfterMs(60_000)).toBe(180_000);
    expect(isReadingStale(iso(179_999), NOW, 60_000)).toBe(false);
    expect(isReadingStale(iso(180_000), NOW, 60_000)).toBe(true);
  });

  it("follows a non-default configured interval", () => {
    expect(staleAfterMs(30_000)).toBe(90_000);
    expect(isReadingStale(iso(89_999), NOW, 30_000)).toBe(false);
    expect(isReadingStale(iso(90_000), NOW, 30_000)).toBe(true);
    expect(isReadingStale(iso(3 * MINUTE), NOW, 5 * MINUTE)).toBe(false);
  });

  it("treats an invalid reading time as fresh rather than stale", () => {
    expect(isReadingStale("not-a-date", NOW, 60_000)).toBe(false);
  });
});

describe("window reset since reading", () => {
  const fetchedAt = iso(10 * MINUTE);

  it("is true when the reset happened after the reading but before now", () => {
    expect(windowResetSinceReading(iso(MINUTE), fetchedAt, NOW)).toBe(true);
  });

  it("is false when the reset was already covered by the reading", () => {
    expect(windowResetSinceReading(iso(20 * MINUTE), fetchedAt, NOW)).toBe(false);
  });

  it("is false for future or missing reset times", () => {
    expect(windowResetSinceReading(new Date(NOW + MINUTE).toISOString(), fetchedAt, NOW)).toBe(false);
    expect(windowResetSinceReading(undefined, fetchedAt, NOW)).toBe(false);
    expect(windowResetSinceReading("not-a-date", fetchedAt, NOW)).toBe(false);
  });
});

describe("credential and hint helpers", () => {
  it("recognizes credential failures without flagging network errors", () => {
    expect(isCredentialError("OpenAI API error 401: unauthorized")).toBe(true);
    expect(isCredentialError("Copilot API error 403: forbidden")).toBe(true);
    expect(isCredentialError("Token expired (using OpenCode 2 credentials)")).toBe(true);
    expect(isCredentialError("OpenCode Go API error 403. Key rejected")).toBe(true);
    expect(isCredentialError("socket hang up")).toBe(false);
    expect(isCredentialError("OpenAI API error 500: boom")).toBe(false);
    expect(isCredentialError(undefined)).toBe(false);
  });

  it("filters placeholder hints", () => {
    expect(actionableHint("not available")).toBeUndefined();
    expect(actionableHint("  ")).toBeUndefined();
    expect(actionableHint("  run /connect, choose ChatGPT ")).toBe(
      "run /connect, choose ChatGPT",
    );
  });
});
