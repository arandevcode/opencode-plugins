import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

type ConfigModule = typeof import("../src/lib/opencode-go-config.js");

let mod: ConfigModule;
let dir: string;
const savedEnv: Record<string, string | undefined> = {};

const ENV_KEYS = [
  "OPENCODE_CONFIG_DIR",
  "XDG_CONFIG_HOME",
  "HOME",
  "OPENCODE_GO_WORKSPACE_ID",
  "OPENCODE_GO_AUTH_COOKIE",
  "OPENCODE_GO_API_KEY",
] as const;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "oq-go-config-"));
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  process.env.OPENCODE_CONFIG_DIR = dir;
  process.env.XDG_CONFIG_HOME = dir;
  process.env.HOME = dir;
  delete process.env.OPENCODE_GO_WORKSPACE_ID;
  delete process.env.OPENCODE_GO_AUTH_COOKIE;
  delete process.env.OPENCODE_GO_API_KEY;
  await mkdir(join(dir, "opencode-quota"), { recursive: true });
  vi.resetModules();
  mod = await import("../src/lib/opencode-go-config.js");
  mod.clearOpenCodeGoConfigCache();
});

afterEach(async () => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(dir, { recursive: true, force: true });
});

describe("readActiveOpenCodeGoAccount", () => {
  it("reads the account name from the sidecar helper file", async () => {
    await writeFile(
      join(dir, "opencode-quota", "opencode-go-active.json"),
      JSON.stringify({ account: "aRaN", switchedAt: "2026-11-08T12:43:51+01:00" }),
    );

    expect(await mod.readActiveOpenCodeGoAccount()).toBe("aRaN");
  });

  it("returns undefined when the file is missing or malformed", async () => {
    expect(await mod.readActiveOpenCodeGoAccount()).toBeUndefined();

    await writeFile(
      join(dir, "opencode-quota", "opencode-go-active.json"),
      JSON.stringify({ switchedAt: "2026-11-08T12:43:51+01:00" }),
    );
    expect(await mod.readActiveOpenCodeGoAccount()).toBeUndefined();
  });
});

describe("discoverOpenCodeGoInstances", () => {
  it("returns an instance per opencode-go-<suffix>.json file", async () => {
    await writeFile(
      join(dir, "opencode-quota", "opencode-go-work.json"),
      JSON.stringify({ workspaceId: "ws-work", authCookie: "cookie-work" }),
    );
    await writeFile(
      join(dir, "opencode-quota", "opencode-go-personal.json"),
      JSON.stringify({ workspaceId: "ws-personal", authCookie: "cookie-personal" }),
    );

    const instances = await mod.discoverOpenCodeGoInstances();

    expect(instances).toEqual([
      { id: "opencode-go-personal", label: "Opencode GO (personal)" },
      { id: "opencode-go-work", label: "Opencode GO (work)" },
    ]);
  });

  it("ignores active and -key helper files", async () => {
    await writeFile(
      join(dir, "opencode-quota", "opencode-go-active.json"),
      JSON.stringify({ account: "work", keySha256: "abc" }),
    );
    await writeFile(
      join(dir, "opencode-quota", "opencode-go-work-key.json"),
      JSON.stringify("oc_sk_work"),
    );
    await writeFile(
      join(dir, "opencode-quota", "opencode-go-work.json"),
      JSON.stringify({ apiKey: "oc_sk_work" }),
    );

    expect(await mod.discoverOpenCodeGoInstances()).toEqual([
      { id: "opencode-go-work", label: "Opencode GO (work)" },
    ]);
  });

  it("ignores the base opencode-go.json and unrelated files", async () => {
    await writeFile(
      join(dir, "opencode-quota", "opencode-go.json"),
      JSON.stringify({ workspaceId: "ws", authCookie: "cookie" }),
    );
    await writeFile(
      join(dir, "opencode-quota", "quota-toast.json"),
      JSON.stringify({ foo: "bar" }),
    );

    expect(await mod.discoverOpenCodeGoInstances()).toEqual([]);
  });
});

describe("resolveOpenCodeGoInstance", () => {
  it("resolves the base instance from opencode-go.json", async () => {
    await writeFile(
      join(dir, "opencode-quota", "opencode-go.json"),
      JSON.stringify({ workspaceId: "ws", authCookie: "cookie" }),
    );

    const r = await mod.resolveOpenCodeGoInstance("opencode-go");
    expect(r.state).toBe("configured");
    if (r.state === "configured") {
      expect(r.config).toEqual({
        auth: "cookie",
        workspaceId: "ws",
        authCookie: "cookie",
      });
    }
  });

  it("resolves an extra instance from its opencode-go-<suffix>.json file", async () => {
    await writeFile(
      join(dir, "opencode-quota", "opencode-go-work.json"),
      JSON.stringify({ workspaceId: "ws-work", authCookie: "cookie-work" }),
    );

    const r = await mod.resolveOpenCodeGoInstanceCached("opencode-go-work");
    expect(r.state).toBe("configured");
    if (r.state === "configured") {
      expect(r.config).toEqual({
        auth: "cookie",
        workspaceId: "ws-work",
        authCookie: "cookie-work",
      });
    }
  });

  it("returns none when the instance file is missing", async () => {
    const r = await mod.resolveOpenCodeGoInstance("opencode-go-missing");
    expect(r.state).toBe("none");
  });
});

describe("API-key configs", () => {
  it("resolves an apiKey object without a cookie", async () => {
    await writeFile(
      join(dir, "opencode-quota", "opencode-go-work.json"),
      JSON.stringify({ apiKey: "oc_sk_work" }),
    );

    const r = await mod.resolveOpenCodeGoInstance("opencode-go-work");
    expect(r.state).toBe("configured");
    if (r.state === "configured") {
      expect(r.config).toEqual({ auth: "api-key", apiKey: "oc_sk_work" });
    }
  });

  it("resolves a raw JSON string as an API key", async () => {
    await writeFile(
      join(dir, "opencode-quota", "opencode-go-personal.json"),
      JSON.stringify("oc_sk_personal"),
    );

    const r = await mod.resolveOpenCodeGoInstance("opencode-go-personal");
    expect(r.state).toBe("configured");
    if (r.state === "configured") {
      expect(r.config).toEqual({ auth: "api-key", apiKey: "oc_sk_personal" });
    }
  });

  it("reads OPENCODE_GO_API_KEY from the environment", async () => {
    process.env.OPENCODE_GO_API_KEY = "oc_sk_env";
    const r = await mod.resolveOpenCodeGoConfig();
    expect(r.state).toBe("configured");
    if (r.state === "configured") {
      expect(r.config).toEqual({ auth: "api-key", apiKey: "oc_sk_env" });
      expect(r.source).toBe("env");
    }
  });

  it("reports missing apiKey when the file is empty", async () => {
    await writeFile(join(dir, "opencode-quota", "opencode-go.json"), "{}");
    const r = await mod.resolveOpenCodeGoConfig();
    expect(r.state).toBe("incomplete");
    if (r.state === "incomplete") expect(r.missing).toBe("apiKey");
  });
});

describe("default instance honours the documented environment variables", () => {
  it("reads OPENCODE_GO_API_KEY for the default instance", async () => {
    process.env.OPENCODE_GO_API_KEY = "oc_sk_from_env";
    mod.clearOpenCodeGoConfigCache();
    const r = await mod.resolveOpenCodeGoInstanceCached("opencode-go");
    expect(r.state).toBe("configured");
    if (r.state === "configured") {
      expect(r.source).toBe("env");
      expect(r.config).toEqual({ auth: "api-key", apiKey: "oc_sk_from_env" });
    }
  });

  it("falls back to opencode-go.json when the variable is not set", async () => {
    await writeFile(join(dir, "opencode-quota", "opencode-go.json"), JSON.stringify({ apiKey: "oc_sk_from_file" }));
    mod.clearOpenCodeGoConfigCache();
    const r = await mod.resolveOpenCodeGoInstanceCached("opencode-go");
    expect(r.state).toBe("configured");
    if (r.state === "configured") expect(r.config).toEqual({ auth: "api-key", apiKey: "oc_sk_from_file" });
  });

  it("does not apply the variable to extra instances", async () => {
    process.env.OPENCODE_GO_API_KEY = "oc_sk_from_env";
    mod.clearOpenCodeGoConfigCache();
    const r = await mod.resolveOpenCodeGoInstanceCached("opencode-go-work");
    expect(r.state).toBe("none");
  });
});
