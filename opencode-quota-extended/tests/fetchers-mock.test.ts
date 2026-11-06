import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import * as auth from "../src/lib/auth.js";
import * as opencodeGoConfig from "../src/lib/opencode-go-config.js";
import { openaiProvider } from "../src/providers/openai.js";
import { opencodeGoProvider } from "../src/providers/opencode-go.js";
import { copilotProvider } from "../src/providers/copilot.js";

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function textResponse(body: string, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  auth.clearAuthCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("openaiProvider", () => {
  it("returns ok with two windows when auth and response are valid", async () => {
    vi.spyOn(auth, "readAuthFileCached").mockResolvedValue({
      openai: { type: "oauth", access: "tok" },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        plan_type: "pro",
        rate_limit: {
          primary_window: { used_percent: 10, reset_after_seconds: 18000 },
          secondary_window: { used_percent: 30, reset_at: 1735689600 },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await openaiProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.status).toBe("ok");
    expect(result.windows.length).toBe(2);
    expect(result.windows[0]?.id).toBe("5h");
    expect(result.windows[1]?.id).toBe("weekly");
  });

  it("labels the secondary window from limit_window_seconds", async () => {
    vi.spyOn(auth, "readAuthFileCached").mockResolvedValue({
      openai: { type: "oauth", access: "tok" },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        plan_type: "team",
        rate_limit: {
          primary_window: { used_percent: 10, limit_window_seconds: 18_000 },
          secondary_window: { used_percent: 20, limit_window_seconds: 2_592_000 },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await openaiProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.status).toBe("ok");
    expect(result.windows[0]?.label).toBe("5h");
    expect(result.windows[1]?.label).toBe("Monthly");
  });

  it("returns no-auth when there are no credentials", async () => {
    vi.spyOn(auth, "readAuthFileCached").mockResolvedValue({});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await openaiProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.status).toBe("no-auth");
    expect(result.windows.length).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("opencodeGoProvider", () => {
  it("parses the go/status JSON into three windows", async () => {
    vi.spyOn(opencodeGoConfig, "resolveOpenCodeGoInstanceCached").mockResolvedValue({
      state: "configured",
      config: { auth: "cookie", workspaceId: "wrk_123", authCookie: "cookie-abc" },
      source: "test",
    });
    const payload = {
      product: "go",
      access: {
        startsAt: "2026-09-01T00:00:00.000Z",
        endsAt: "2026-10-01T00:00:00.000Z",
        meters: {
          fiveHour: {
            resetsAt: "2026-09-24T12:00:00.000Z",
            limitMicroCents: "1000000",
            usedMicroCents: "250000",
          },
          week: {
            resetsAt: "2026-09-30T00:00:00.000Z",
            limitMicroCents: "1000000",
            usedMicroCents: "300000",
          },
          month: { limitMicroCents: "1000000", usedMicroCents: "10000" },
        },
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(textResponse(JSON.stringify(payload)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await opencodeGoProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.status).toBe("ok");
    expect(result.windows.map((w) => w.id)).toEqual(["5h", "weekly", "monthly"]);
    expect(result.windows[0]?.percentRemaining).toBe(75);
    expect(result.windows[1]?.percentRemaining).toBe(70);
    expect(result.windows[2]?.percentRemaining).toBe(99);
    expect(result.windows[0]?.resetTimeIso).toBe("2026-09-24T12:00:00.000Z");
    expect(result.windows[2]?.resetTimeIso).toBe("2026-10-01T00:00:00.000Z");
    expect(result.windows[0]?.spentMicroCents).toBe("250000");
    expect(result.windows[0]?.limitMicroCents).toBe("1000000");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://opencode.ai/console/api/go/status");
    expect((init.headers as Record<string, string>)["x-org-id"]).toBe("wrk_123");
    expect((init.headers as Record<string, string>).Cookie).toBe("auth=cookie-abc");
  });

  it("accepts numeric microCents values", async () => {
    vi.spyOn(opencodeGoConfig, "resolveOpenCodeGoInstanceCached").mockResolvedValue({
      state: "configured",
      config: { auth: "cookie", workspaceId: "wrk_123", authCookie: "cookie-abc" },
      source: "test",
    });
    const payload = {
      access: {
        endsAt: "2026-10-01T00:00:00.000Z",
        meters: {
          fiveHour: { limitMicroCents: 1000000, usedMicroCents: 500000 },
        },
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(textResponse(JSON.stringify(payload)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await opencodeGoProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.status).toBe("ok");
    expect(result.windows[0]?.percentRemaining).toBe(50);
  });

  it("sends the __Host-console_session cookie when the value is st_-prefixed", async () => {
    vi.spyOn(opencodeGoConfig, "resolveOpenCodeGoInstanceCached").mockResolvedValue({
      state: "configured",
      config: { auth: "cookie", workspaceId: "wrk_123", authCookie: "st_abc" },
      source: "test",
    });
    const payload = {
      access: {
        endsAt: "2026-10-01T00:00:00.000Z",
        meters: { fiveHour: { limitMicroCents: "1000000", usedMicroCents: "0" } },
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(textResponse(JSON.stringify(payload)));
    vi.stubGlobal("fetch", fetchMock);

    await opencodeGoProvider.fetch({ requestTimeoutMs: 1000 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Cookie).toBe(
      "__Host-console_session=st_abc",
    );
  });

  it("uses a bearer token and no cookie for an API-key config", async () => {
    vi.spyOn(opencodeGoConfig, "resolveOpenCodeGoInstanceCached").mockResolvedValue({
      state: "configured",
      config: { auth: "api-key", apiKey: "oc_sk_test" },
      source: "test",
    });
    const payload = {
      access: {
        endsAt: "2026-10-01T00:00:00.000Z",
        meters: {
          fiveHour: { limitMicroCents: "1000000", usedMicroCents: "250000" },
        },
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(textResponse(JSON.stringify(payload)));
    vi.stubGlobal("fetch", fetchMock);

    await opencodeGoProvider.fetch({ requestTimeoutMs: 1000 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer oc_sk_test");
    expect(headers.Cookie).toBeUndefined();
    expect(headers["x-org-id"]).toBeUndefined();
  });

  it("returns an error when there is no active subscription", async () => {
    vi.spyOn(opencodeGoConfig, "resolveOpenCodeGoInstanceCached").mockResolvedValue({
      state: "configured",
      config: { auth: "cookie", workspaceId: "wrk_123", authCookie: "cookie-abc" },
      source: "test",
    });
    const fetchMock = vi.fn().mockResolvedValue(textResponse(JSON.stringify({ access: null })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await opencodeGoProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.status).toBe("error");
    expect(result.error).toContain("No active OpenCode Go subscription");
  });

  it("surfaces a 401 when the auth cookie is expired", async () => {
    vi.spyOn(opencodeGoConfig, "resolveOpenCodeGoInstanceCached").mockResolvedValue({
      state: "configured",
      config: { auth: "cookie", workspaceId: "wrk_123", authCookie: "stale" },
      source: "test",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(textResponse('{"_tag":"Unauthorized"}', { ok: false, status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await opencodeGoProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.status).toBe("error");
    expect(result.error).toContain("401");
  });
});

describe("copilotProvider", () => {
  it("returns ok with the premium_interactions snapshot", async () => {
    vi.spyOn(auth, "readAuthFileCached").mockResolvedValue({
      "github-copilot": { type: "oauth", access: "tok" },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        quota_snapshots: {
          premium_interactions: {
            entitlement: 100,
            remaining: 75,
            percent_remaining: 75,
            reset_date: "2026-12-31T00:00:00Z",
          },
        },
        copilot_plan: "pro",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await copilotProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.status).toBe("ok");
    expect(result.windows[0]?.id).toBe("primary");
    expect(result.windows[0]?.percentRemaining).toBe(75);
    expect(result.label).toBe("GitHub Copilot (Pro)");
  });

  it("returns ok for the individual plan with 1500 entitlement from quota_reset_date_utc", async () => {
    vi.spyOn(auth, "readAuthFileCached").mockResolvedValue({
      "github-copilot": { type: "oauth", access: "tok" },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        copilot_plan: "individual",
        quota_snapshots: {
          premium_interactions: {
            entitlement: 1500,
            remaining: 1498,
            percent_remaining: 99.8,
          },
        },
        quota_reset_date_utc: "2026-07-01T00:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await copilotProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.status).toBe("ok");
    expect(result.label).toBe("GitHub Copilot (Individual)");
    expect(result.windows[0]?.percentRemaining).toBe(99);
    expect(result.windows[0]?.resetTimeIso).toBe("2026-07-01T00:00:00.000Z");
  });

  it("surfaces API error when GitHub returns 401 (expired/invalid token)", async () => {
    vi.spyOn(auth, "readAuthFileCached").mockResolvedValue({
      "github-copilot": { type: "oauth", access: "tok" },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ message: "Bad credentials" }, { ok: false, status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await copilotProvider.fetch({ requestTimeoutMs: 1000 });

    expect(result.status).toBe("error");
    expect(result.error).toContain("401");
  });
});
