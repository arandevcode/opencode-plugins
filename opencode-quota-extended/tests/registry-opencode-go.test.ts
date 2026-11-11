import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG, type CardsPluginConfig } from "../src/config/defaults.js";
import type { ProviderQuota } from "../src/lib/types.js";

const mocks = vi.hoisted(() => {
  const reading = (id: string, label: string): ProviderQuota => ({
    id,
    label,
    status: "ok",
    windows: [{ id: "5h", label: "5h", percentRemaining: 75 }],
    fetchedAt: new Date().toISOString(),
  });

  return {
    discover: vi.fn(),
    resolve: vi.fn(),
    baseFetch: vi.fn(async () => reading("opencode-go", "OpenCode Go")),
    create: vi.fn((opts: { id: string; label: string }) => ({
      id: opts.id,
      defaultLabel: opts.label,
      isAvailable: async () => true,
      fetch: async () => reading(opts.id, opts.label),
    })),
  };
});

vi.mock("../src/lib/opencode-go-config.js", () => ({
  discoverOpenCodeGoInstances: mocks.discover,
  resolveOpenCodeGoInstanceCached: mocks.resolve,
}));

vi.mock("../src/providers/openai.js", () => ({
  openaiProvider: {
    id: "openai",
    defaultLabel: "OpenAI",
    isAvailable: async () => false,
    fetch: async () => {
      throw new Error("unused");
    },
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
    isAvailable: async () =>
      (await mocks.resolve("opencode-go")).state === "configured",
    unavailableHint: async () =>
      'no API key. Set OPENCODE_GO_API_KEY or put {"apiKey":"oc_sk_..."} in ~/.config/opencode/opencode-quota/opencode-go.json',
    fetch: mocks.baseFetch,
  },
  createOpenCodeGoProvider: mocks.create,
}));

import { collectSnapshot } from "../src/providers/registry.js";

const config: CardsPluginConfig = {
  ...DEFAULT_CONFIG,
  enabledProviders: ["opencode-go"],
};

beforeEach(() => {
  mocks.discover.mockReset().mockResolvedValue([]);
  mocks.resolve.mockReset().mockResolvedValue({ state: "none" });
  mocks.baseFetch.mockClear();
  mocks.create.mockClear();
});

describe("collectSnapshot with OpenCode Go accounts", () => {
  it("keeps the setup hint when the default account is the only one", async () => {
    const snapshot = await collectSnapshot(config);

    expect(snapshot.providers).toHaveLength(1);
    const base = snapshot.providers[0]!;
    expect(base.id).toBe("opencode-go");
    expect(base.status).toBe("skipped");
    expect(base.hint).toContain("OPENCODE_GO_API_KEY");
  });

  it("hides the unconfigured default when named accounts exist", async () => {
    mocks.discover.mockResolvedValue([
      { id: "opencode-go-aran", label: "Opencode GO (aran)" },
      { id: "opencode-go-work", label: "Opencode GO (work)" },
    ]);

    const snapshot = await collectSnapshot(config);

    expect(snapshot.providers.map((p) => p.id)).toEqual([
      "opencode-go-aran",
      "opencode-go-work",
    ]);
    expect(snapshot.providers.every((p) => p.status === "ok")).toBe(true);
  });

  it("keeps the default when it is configured alongside named accounts", async () => {
    mocks.discover.mockResolvedValue([
      { id: "opencode-go-work", label: "Opencode GO (work)" },
    ]);
    mocks.resolve.mockResolvedValue({
      state: "configured",
      config: { auth: "api-key", apiKey: "oc_sk_test" },
      source: "test",
    });

    const snapshot = await collectSnapshot(config);

    expect(snapshot.providers.map((p) => p.id)).toEqual([
      "opencode-go",
      "opencode-go-work",
    ]);
  });
});
