import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { xdgConfig } from "xdg-basedir";

const SIDECAR_DIR = "opencode-quota";
const SIDECAR_FILE = "opencode-go.json";

export type OpenCodeGoConfig = { workspaceId: string; authCookie: string };

export type OpenCodeGoConfigResolution =
  | { state: "configured"; config: OpenCodeGoConfig; source: string }
  | { state: "incomplete"; source: string; missing: "workspaceId" | "authCookie" }
  | { state: "invalid"; source: string; error: string }
  | { state: "none" };

function getConfigDirCandidates(): string[] {
  const dirs: string[] = [];
  if (process.env.OPENCODE_CONFIG_DIR) {
    dirs.push(process.env.OPENCODE_CONFIG_DIR);
  }
  if (xdgConfig) {
    dirs.push(xdgConfig);
    dirs.push(join(xdgConfig, "opencode"));
  }
  dirs.push(join(homedir(), ".config", "opencode"));
  return Array.from(new Set(dirs));
}

function getConfigCandidatePaths(): string[] {
  return getConfigDirCandidates().map((d) => join(d, SIDECAR_DIR, SIDECAR_FILE));
}

function fromEnv(): OpenCodeGoConfigResolution {
  const workspaceId = process.env.OPENCODE_GO_WORKSPACE_ID?.trim();
  const authCookie = process.env.OPENCODE_GO_AUTH_COOKIE?.trim();
  if (!workspaceId && !authCookie) return { state: "none" };
  if (workspaceId && authCookie) {
    return { state: "configured", config: { workspaceId, authCookie }, source: "env" };
  }
  return {
    state: "incomplete",
    source: "env",
    missing: workspaceId ? "authCookie" : "workspaceId",
  };
}

export async function resolveOpenCodeGoConfig(): Promise<OpenCodeGoConfigResolution> {
  const envResult = fromEnv();
  if (envResult.state !== "none") return envResult;

  for (const path of getConfigCandidatePaths()) {
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
      return {
        state: "invalid",
        source: path,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return {
        state: "invalid",
        source: path,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { state: "invalid", source: path, error: "Config must be a JSON object" };
    }
    const obj = parsed as Record<string, unknown>;
    const workspaceId = typeof obj.workspaceId === "string" ? obj.workspaceId.trim() : "";
    const authCookie = typeof obj.authCookie === "string" ? obj.authCookie.trim() : "";
    if (workspaceId && authCookie) {
      return { state: "configured", config: { workspaceId, authCookie }, source: path };
    }
    return {
      state: "incomplete",
      source: path,
      missing: workspaceId ? "authCookie" : "workspaceId",
    };
  }
  return { state: "none" };
}

let cached: { at: number; value: OpenCodeGoConfigResolution } | null = null;
const CACHE_MAX_AGE_MS = 30_000;

export async function resolveOpenCodeGoConfigCached(): Promise<OpenCodeGoConfigResolution> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MAX_AGE_MS) return cached.value;
  const value = await resolveOpenCodeGoConfig();
  cached = { at: now, value };
  return value;
}
