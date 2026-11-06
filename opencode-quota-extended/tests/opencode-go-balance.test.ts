import { describe, it, expect, vi, afterEach } from "vitest";

import * as opencodeGoConfig from "../src/lib/opencode-go-config.js";
import { opencodeGoProvider } from "../src/providers/opencode-go.js";

const GO_STATUS = "https://opencode.ai/console/api/go/status";
const BILLING = "https://opencode.ai/console/api/billing/status";
const RECHARGE = "https://opencode.ai/console/api/billing/auto-recharge";

const goPayload = (useBalance?: unknown) => ({
  product: "go",
  ...(useBalance === undefined ? {} : { useBalance }),
  access: {
    endsAt: "2026-10-01T00:00:00.000Z",
    meters: { fiveHour: { limitMicroCents: "1000000", usedMicroCents: "0" } },
  },
});

function respond(body: unknown, ok = true, status = 200): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return { ok, status, text: async () => text } as unknown as Response;
}

/** Route each console URL to its own simulated response. */
function stubConsole(routes: Record<string, () => Promise<Response>>) {
  const fetchMock = vi.fn(async (url: string) => {
    const handler = routes[url];
    if (!handler) throw new Error(`unexpected url ${url}`);
    return handler();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function configure() {
  vi.spyOn(opencodeGoConfig, "resolveOpenCodeGoInstanceCached").mockResolvedValue({
    state: "configured",
    config: { auth: "cookie", workspaceId: "wrk_123", authCookie: "st_secret" },
    source: "test",
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("opencodeGoProvider balance", () => {
  it("reads balance with a personal API key", async () => {
    vi.spyOn(opencodeGoConfig, "resolveOpenCodeGoInstanceCached").mockResolvedValue({
      state: "configured",
      config: { auth: "api-key", apiKey: "oc_sk_test" },
      source: "test",
    });
    const fetchMock = stubConsole({
      [GO_STATUS]: async () => respond(goPayload(true)),
      [BILLING]: async () => respond({ availableMicroCents: "500000000" }),
      [RECHARGE]: async () => respond({ enabled: false }),
    });

    const result = await opencodeGoProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.status).toBe("ok");
    expect(result.balance).toEqual({
      availableMicroCents: "500000000",
      useBalance: true,
      autoRecharge: { enabled: false },
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer oc_sk_test",
    );
  });

  it("adds balance, useBalance and auto-recharge when the lookups succeed", async () => {
    configure();
    stubConsole({
      [GO_STATUS]: async () => respond(goPayload(true)),
      [BILLING]: async () =>
        respond({ availableMicroCents: "918377629", creditLimitMicroCents: null }),
      [RECHARGE]: async () =>
        respond({ enabled: true, thresholdDollars: 5, rechargeAmountDollars: 20, pending: false }),
    });

    const result = await opencodeGoProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.status).toBe("ok");
    expect(result.windows.map((w) => w.id)).toEqual(["5h"]);
    expect(result.balance).toEqual({
      availableMicroCents: "918377629",
      useBalance: true,
      autoRecharge: { enabled: true, thresholdDollars: 5, rechargeAmountDollars: 20 },
    });
  });

  it("omits the auto-recharge sub-field when only that lookup fails", async () => {
    configure();
    stubConsole({
      [GO_STATUS]: async () => respond(goPayload(false)),
      [BILLING]: async () => respond({ availableMicroCents: 500000000 }),
      [RECHARGE]: async () => respond("boom", false, 500),
    });

    const result = await opencodeGoProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.status).toBe("ok");
    expect(result.balance).toEqual({ availableMicroCents: "500000000", useBalance: false });
  });

  it("keeps the provider ok without balance when billing/status fails", async () => {
    configure();
    stubConsole({
      [GO_STATUS]: async () => respond(goPayload()),
      [BILLING]: async () => respond("nope", false, 403),
      [RECHARGE]: async () => respond({ enabled: false }),
    });

    const result = await opencodeGoProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.status).toBe("ok");
    expect(result.windows.length).toBe(1);
    expect(result).not.toHaveProperty("balance");
  });

  it("omits balance when billing/status returns invalid JSON", async () => {
    configure();
    stubConsole({
      [GO_STATUS]: async () => respond(goPayload(true)),
      [BILLING]: async () => respond("<html>not json</html>"),
      [RECHARGE]: async () => respond({ enabled: false }),
    });

    const result = await opencodeGoProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.status).toBe("ok");
    expect(result).not.toHaveProperty("balance");
  });

  it("omits balance when availableMicroCents is not a number", async () => {
    configure();
    stubConsole({
      [GO_STATUS]: async () => respond(goPayload(true)),
      [BILLING]: async () => respond({ availableMicroCents: "lots" }),
      [RECHARGE]: async () => respond({ enabled: false }),
    });

    const result = await opencodeGoProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result).not.toHaveProperty("balance");
  });

  it("reports useBalance as null when go/status does not carry it", async () => {
    configure();
    stubConsole({
      [GO_STATUS]: async () => respond(goPayload()),
      [BILLING]: async () => respond({ availableMicroCents: "1" }),
      [RECHARGE]: async () => respond({ enabled: false }),
    });

    const result = await opencodeGoProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.balance).toEqual({
      availableMicroCents: "1",
      useBalance: null,
      autoRecharge: { enabled: false },
    });
  });
});
