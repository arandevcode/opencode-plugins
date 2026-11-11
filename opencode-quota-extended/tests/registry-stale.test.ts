import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG, type CardsPluginConfig } from "../src/config/defaults.js";
import type { CardsSnapshot, ProviderQuota } from "../src/lib/types.js";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  isAvailable: vi.fn(),
  unavailableHint: vi.fn(),
}));

vi.mock("../src/providers/openai.js", () => ({
  openaiProvider: {
    id: "openai",
    defaultLabel: "OpenAI",
    isAvailable: mocks.isAvailable,
    unavailableHint: mocks.unavailableHint,
    fetch: mocks.fetch,
  },
}));

vi.mock("../src/providers/copilot.js", () => ({
  copilotProvider: {
    id: "github-copilot",
    defaultLabel: "GitHub Copilot",
    isAvailable: async () => false,
    fetch: async () => {
      throw new Error("unused");
    },
  },
}));

vi.mock("../src/providers/opencode-go.js", () => ({
  opencodeGoProvider: {
    id: "opencode-go",
    defaultLabel: "OpenCode Go",
    isAvailable: async () => false,
    fetch: async () => {
      throw new Error("unused");
    },
  },
  createOpenCodeGoProvider: vi.fn(),
}));

vi.mock("../src/lib/opencode-go-config.js", () => ({
  discoverOpenCodeGoInstances: async () => [],
  resolveOpenCodeGoInstanceCached: async () => ({ state: "none" }),
}));

import { collectSnapshot } from "../src/providers/registry.js";

const config: CardsPluginConfig = {
  ...DEFAULT_CONFIG,
  enabledProviders: ["openai"],
};

const OLD_READING = "2026-11-10T10:00:00.000Z";

function previousSnapshot(overrides: Partial<ProviderQuota> = {}): CardsSnapshot {
  return {
    generatedAt: OLD_READING,
    providers: [
      {
        id: "openai",
        label: "OpenAI (Pro)",
        status: "ok",
        windows: [
          {
            id: "5h",
            label: "5h",
            percentRemaining: 42,
            resetTimeIso: "2026-11-10T15:00:00.000Z",
          },
        ],
        fetchedAt: OLD_READING,
        balance: {
          availableMicroCents: "125000000",
          useBalance: true,
        },
        ...overrides,
      },
    ],
  };
}

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.isAvailable.mockReset().mockResolvedValue(true);
  mocks.unavailableHint.mockReset();
});

describe("collectSnapshot stale fallback", () => {
  it("keeps the previous reading when a fetch returns a credential error", async () => {
    const previous = previousSnapshot();
    mocks.unavailableHint.mockResolvedValue(
      "no ChatGPT login found (run /connect, choose ChatGPT)",
    );
    mocks.fetch.mockResolvedValue({
      id: "openai",
      label: "OpenAI",
      status: "error",
      error: "OpenAI API error 401: unauthorized",
      windows: [],
      fetchedAt: new Date().toISOString(),
    });

    const result = await collectSnapshot(config, previous);
    const provider = result.providers[0]!;

    expect(provider.status).toBe("stale");
    expect(provider.label).toBe("OpenAI (Pro)");
    expect(provider.fetchedAt).toBe(OLD_READING);
    expect(provider.windows).toEqual(previous.providers[0]!.windows);
    expect(provider.balance).toEqual(previous.providers[0]!.balance);
    expect(provider.error).toContain("401");
    expect(provider.hint).toBe(
      "no ChatGPT login found (run /connect, choose ChatGPT)",
    );
    expect(mocks.unavailableHint).toHaveBeenCalledOnce();
  });

  it("keeps the previous reading when a fetch throws a network error", async () => {
    mocks.fetch.mockRejectedValue(new Error("socket hang up"));

    const result = await collectSnapshot(config, previousSnapshot());
    const provider = result.providers[0]!;

    expect(provider.status).toBe("stale");
    expect(provider.fetchedAt).toBe(OLD_READING);
    expect(provider.windows).toHaveLength(1);
    expect(provider.error).toBe("socket hang up");
    expect(provider.hint).toBeUndefined();
    expect(mocks.unavailableHint).not.toHaveBeenCalled();
  });

  it("does not attach a setup hint to a non-credential failure", async () => {
    mocks.fetch.mockResolvedValue({
      id: "openai",
      label: "OpenAI",
      status: "error",
      error: "OpenAI API error 500: boom",
      windows: [],
      fetchedAt: new Date().toISOString(),
    });

    const result = await collectSnapshot(config, previousSnapshot());
    const provider = result.providers[0]!;

    expect(provider.status).toBe("stale");
    expect(provider.hint).toBeUndefined();
    expect(mocks.unavailableHint).not.toHaveBeenCalled();
  });

  it("still reports a plain error when there is no previous reading", async () => {
    mocks.fetch.mockRejectedValue(new Error("socket hang up"));

    const result = await collectSnapshot(config);
    const provider = result.providers[0]!;

    expect(provider.status).toBe("error");
    expect(provider.windows).toEqual([]);
    expect(provider.error).toBe("socket hang up");
  });
});
