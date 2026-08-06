import { readFile, readdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { xdgConfig } from "xdg-basedir";
const SIDECAR_DIR = "opencode-quota";
const DEFAULT_FILE = "opencode-go.json";
const EXTRA_PREFIX = "opencode-go-";
const EXTRA_LABEL_PREFIX = "Opencode GO";
const DEFAULT_ID = "opencode-go";
const DEFAULT_LABEL = "OpenCode Go";
function getConfigDirCandidates() {
    const dirs = [];
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
function getSidecarDirCandidates() {
    return getConfigDirCandidates().map((d) => join(d, SIDECAR_DIR));
}
function getDefaultCandidatePaths() {
    return getSidecarDirCandidates().map((d) => join(d, DEFAULT_FILE));
}
function getInstanceCandidatePaths(id) {
    if (id === DEFAULT_ID)
        return getDefaultCandidatePaths();
    if (!id.startsWith(EXTRA_PREFIX))
        return [];
    const suffix = id.slice(EXTRA_PREFIX.length);
    if (!suffix)
        return [];
    return getSidecarDirCandidates().map((d) => join(d, `${EXTRA_PREFIX}${suffix}.json`));
}
function fromEnv() {
    const workspaceId = process.env.OPENCODE_GO_WORKSPACE_ID?.trim();
    const authCookie = process.env.OPENCODE_GO_AUTH_COOKIE?.trim();
    if (!workspaceId && !authCookie)
        return { state: "none" };
    if (workspaceId && authCookie) {
        return { state: "configured", config: { workspaceId, authCookie }, source: "env" };
    }
    return {
        state: "incomplete",
        source: "env",
        missing: workspaceId ? "authCookie" : "workspaceId",
    };
}
/**
 * Read a single sidecar file and parse it into a resolution.
 * Returns null when the file does not exist.
 */
async function readFileResolution(path) {
    let raw;
    try {
        raw = await readFile(path, "utf8");
    }
    catch (err) {
        if (err.code === "ENOENT")
            return null;
        return {
            state: "invalid",
            source: path,
            error: err instanceof Error ? err.message : String(err),
        };
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (err) {
        return {
            state: "invalid",
            source: path,
            error: err instanceof Error ? err.message : String(err),
        };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { state: "invalid", source: path, error: "Config must be a JSON object" };
    }
    const obj = parsed;
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
async function resolveFromPaths(paths) {
    for (const path of paths) {
        const resolution = await readFileResolution(path);
        if (resolution === null)
            continue;
        return resolution;
    }
    return { state: "none" };
}
/** Resolve the default OpenCode Go config (env vars, then opencode-go.json). */
export async function resolveOpenCodeGoConfig() {
    const envResult = fromEnv();
    if (envResult.state !== "none")
        return envResult;
    return resolveFromPaths(getDefaultCandidatePaths());
}
/** Resolve the config for a specific instance id. */
export async function resolveOpenCodeGoInstance(id) {
    return resolveFromPaths(getInstanceCandidatePaths(id));
}
/**
 * Discover additional OpenCode Go instances from opencode-go-<suffix>.json
 * files present in the sidecar directory. Returns stable, deduplicated
 * instance descriptors (first directory with a matching file wins).
 */
export async function discoverOpenCodeGoInstances() {
    const seen = new Set();
    const instances = [];
    for (const dir of getSidecarDirCandidates()) {
        let entries;
        try {
            entries = await readdir(dir);
        }
        catch {
            continue;
        }
        entries.sort();
        for (const name of entries) {
            if (!name.startsWith(EXTRA_PREFIX))
                continue;
            if (!name.endsWith(".json"))
                continue;
            const suffix = name.slice(EXTRA_PREFIX.length, -".json".length);
            if (!suffix || seen.has(suffix))
                continue;
            seen.add(suffix);
            instances.push({
                id: `${EXTRA_PREFIX}${suffix}`,
                label: `${EXTRA_LABEL_PREFIX} (${suffix})`,
            });
        }
    }
    return instances;
}
let cached = null;
const CACHE_MAX_AGE_MS = 30_000;
export async function resolveOpenCodeGoConfigCached() {
    const now = Date.now();
    if (cached && now - cached.at < CACHE_MAX_AGE_MS)
        return cached.value;
    const value = await resolveOpenCodeGoConfig();
    cached = { at: now, value };
    return value;
}
const instanceCache = new Map();
export async function resolveOpenCodeGoInstanceCached(id) {
    const now = Date.now();
    const hit = instanceCache.get(id);
    if (hit && now - hit.at < CACHE_MAX_AGE_MS)
        return hit.value;
    const value = await resolveOpenCodeGoInstance(id);
    instanceCache.set(id, { at: now, value });
    return value;
}
/** Clear all cached OpenCode Go config resolutions (used by tests). */
export function clearOpenCodeGoConfigCache() {
    cached = null;
    instanceCache.clear();
}
//# sourceMappingURL=opencode-go-config.js.map