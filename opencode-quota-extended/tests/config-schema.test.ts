import { describe, it, expect } from "vitest";
import { z } from "zod";

import { parseCardsConfig } from "../src/config/schema.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

function fullConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    cardsSidebar: {
      ...DEFAULT_CONFIG.cardsSidebar,
      ...((overrides.cardsSidebar as Record<string, unknown> | undefined) ?? {}),
    },
  };
}

describe("parseCardsConfig", () => {
  it("throws when given an empty object", () => {
    expect(() => parseCardsConfig({})).toThrow(z.ZodError);
  });

  it("succeeds with all default values", () => {
    const parsed = parseCardsConfig(fullConfig());
    expect(parsed.enabled).toBe(true);
  });

  it("throws on an unknown provider id", () => {
    expect(() => parseCardsConfig(fullConfig({ enabledProviders: ["unknown"] }))).toThrow(z.ZodError);
  });

  it("throws on an invalid opencodeGoWindows entry", () => {
    expect(() =>
      parseCardsConfig(fullConfig({ opencodeGoWindows: ["5h", "invalid"] })),
    ).toThrow(z.ZodError);
  });

  it("coerces refreshIntervalMs from a string", () => {
    const parsed = parseCardsConfig(fullConfig({ refreshIntervalMs: "60000" }));
    expect(parsed.refreshIntervalMs).toBe(60_000);
  });

  it("passes through extra keys", () => {
    const parsed = parseCardsConfig(
      fullConfig({
        cardsSidebar: { enabled: true, order: 145, collapsedDefault: true },
        _comment: "x",
      }),
    );
    expect((parsed as Record<string, unknown>)._comment).toBe("x");
  });
});
