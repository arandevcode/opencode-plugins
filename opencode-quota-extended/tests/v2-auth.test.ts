import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as auth from "../src/lib/auth.js";
import { openaiProvider } from "../src/providers/openai.js";

const FUTURE = Date.now() + 3_600_000;

function jwt(claims: object): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${enc({ alg: "none" })}.${enc(claims)}.sig`;
}

beforeEach(() => auth.clearAuthCache());
afterEach(() => {
  auth.setV2CredentialLoader(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("mapV2Credentials", () => {
  it("maps openai oauth with accountID metadata and prefers the active entry", () => {
    const mapped = auth.mapV2Credentials([
      { integrationID: "openai", active: false, value: { type: "oauth", access: "old", expires: 1 } },
      {
        integrationID: "openai",
        active: true,
        value: { type: "oauth", access: "new", expires: FUTURE, metadata: { accountID: "acc-1" } },
      },
    ]);
    expect(mapped.openai).toMatchObject({ type: "oauth", access: "new", expires: FUTURE, accountId: "acc-1" });
  });

  it("falls back to the JWT chatgpt_account_id claim", () => {
    const mapped = auth.mapV2Credentials([
      { integrationID: "openai", active: true, value: { type: "oauth", access: jwt({ chatgpt_account_id: "acc-jwt" }) } },
    ]);
    expect(mapped.openai?.accountId).toBe("acc-jwt");
  });

  it("maps copilot oauth and ignores external credentials", () => {
    const mapped = auth.mapV2Credentials([
      { integrationID: "github-copilot", active: true, value: { type: "oauth", access: "gh" } },
      { integrationID: "openai", active: true, value: { type: "external" } },
    ]);
    expect(mapped["github-copilot"]?.access).toBe("gh");
    expect(mapped.openai).toBeUndefined();
  });
});

describe("credential source selection", () => {
  it("uses OpenCode 2 credentials over auth.json when the loader returns them", async () => {
    auth.setV2CredentialLoader(async () => [
      { integrationID: "openai", active: true, value: { type: "oauth", access: "v2tok", expires: FUTURE } },
    ]);
    const file = await auth.readAuthFile();
    expect(file?.openai?.access).toBe("v2tok");
    expect(auth.describeAuthSource(file?.openai)).toBe("OpenCode 2 credentials");
  });

  it("falls back to auth.json when the loader fails or is empty", async () => {
    for (const loader of [async () => { throw new Error("boom"); }, async () => [], async () => null]) {
      auth.setV2CredentialLoader(loader as never);
      const file = await auth.readAuthFile();
      expect(file?.openai?.access ?? undefined).not.toBe("v2tok");
    }
  });

  it("names no source outside OpenCode 2", () => {
    expect(auth.describeAuthSource({})).toBe("");
  });

  it("names OpenCode 1.x as the source for entries not provided by V2", async () => {
    auth.setV2CredentialLoader(async () => []);
    expect(auth.describeAuthSource({ access: "x" })).toBe("OpenCode 1.x credentials");
  });
});

describe("openai expiry message", () => {
  it("is unchanged on V1", async () => {
    vi.spyOn(auth, "readAuthFileCached").mockResolvedValue({
      openai: { type: "oauth", access: "t", expires: 1 },
    });
    const r = await openaiProvider.fetch({ requestTimeoutMs: 1000 });
    expect(r.error).toBe("Token expired");
  });

  it("names the OpenCode 1.x fallback source on V2", async () => {
    auth.setV2CredentialLoader(async () => []);
    vi.spyOn(auth, "readAuthFileCached").mockResolvedValue({
      openai: { type: "oauth", access: "t", expires: 1 },
    });
    const r = await openaiProvider.fetch({ requestTimeoutMs: 1000 });
    expect(r.error).toContain("OpenCode 1.x credentials");
  });

  it("uses a fresh V2 token and sends the account id", async () => {
    auth.setV2CredentialLoader(async () => [
      { integrationID: "openai", active: true, value: { type: "oauth", access: "v2tok", expires: FUTURE, metadata: { accountID: "acc" } } },
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ plan_type: "plus", rate_limit: { primary_window: { used_percent: 5 } } }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await openaiProvider.fetch({ requestTimeoutMs: 1000 });
    expect(r.status).toBe("ok");
    const headers = (fetchMock.mock.calls[0]![1] as { headers: Record<string, string> }).headers;
    expect(headers["ChatGPT-Account-Id"]).toBe("acc");
  });
});
