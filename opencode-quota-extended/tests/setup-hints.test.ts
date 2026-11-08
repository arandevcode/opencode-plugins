import { describe, it, expect, vi, afterEach } from "vitest";

import * as opencodeGoConfig from "../src/lib/opencode-go-config.js";
import { opencodeGoProvider } from "../src/providers/opencode-go.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function respond(body: string, status: number): Response {
  return { ok: status < 400, status, text: async () => body } as unknown as Response;
}

describe("opencodeGoProvider setup hints", () => {
  it("tells the user how to configure when nothing is set up", async () => {
    vi.spyOn(opencodeGoConfig, "resolveOpenCodeGoInstanceCached").mockResolvedValue({
      state: "none",
    });
    const hint = await opencodeGoProvider.unavailableHint!({ requestTimeoutMs: 1000 });
    expect(hint).toContain("OPENCODE_GO_API_KEY");
    expect(hint).toContain("opencode-go.json");
  });

  it("names the missing field for an incomplete config", async () => {
    vi.spyOn(opencodeGoConfig, "resolveOpenCodeGoInstanceCached").mockResolvedValue({
      state: "incomplete",
      source: "/tmp/opencode-go.json",
      missing: "apiKey",
    });
    const hint = await opencodeGoProvider.unavailableHint!({ requestTimeoutMs: 1000 });
    expect(hint).toBe("missing apiKey in /tmp/opencode-go.json");
  });

  it("points at key permissions on a 403 with an API key", async () => {
    vi.spyOn(opencodeGoConfig, "resolveOpenCodeGoInstanceCached").mockResolvedValue({
      state: "configured",
      config: { auth: "api-key", apiKey: "oc_sk_test" },
      source: "test",
    });
    vi.stubGlobal("fetch", vi.fn(async () => respond('{"_tag":"Forbidden"}', 403)));
    const q = await opencodeGoProvider.fetch({ requestTimeoutMs: 1000 });
    expect(q.status).toBe("error");
    expect(q.error).toContain("403");
    expect(q.error).toContain("All permissions");
  });

  it("does not add the key tip for other errors", async () => {
    vi.spyOn(opencodeGoConfig, "resolveOpenCodeGoInstanceCached").mockResolvedValue({
      state: "configured",
      config: { auth: "api-key", apiKey: "oc_sk_test" },
      source: "test",
    });
    vi.stubGlobal("fetch", vi.fn(async () => respond("boom", 500)));
    const q = await opencodeGoProvider.fetch({ requestTimeoutMs: 1000 });
    expect(q.error).not.toContain("All permissions");
  });
});
