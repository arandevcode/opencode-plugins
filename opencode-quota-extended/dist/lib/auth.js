/**
 * OpenCode auth.json reader.
 *
 * Reads ~/.local/share/opencode/auth.json (or platform equivalent) and
 * returns the parsed object, or null if not found.
 */
import { homedir } from "os";
import { join } from "path";
import { readFile } from "fs/promises";
import { xdgCache, xdgConfig, xdgData, xdgState } from "xdg-basedir";
function dedupe(list) {
    const out = [];
    const seen = new Set();
    for (const item of list) {
        if (!item || seen.has(item))
            continue;
        seen.add(item);
        out.push(item);
    }
    return out;
}
function getAuthPathCandidates() {
    const home = homedir();
    const dataBase = process.env.XDG_DATA_HOME?.trim() || xdgData || join(home, ".local", "share");
    const configBase = process.env.XDG_CONFIG_HOME?.trim() || xdgConfig || join(home, ".config");
    const cacheBase = process.env.XDG_CACHE_HOME?.trim() || xdgCache || join(home, ".cache");
    const stateBase = process.env.XDG_STATE_HOME?.trim() || xdgState || join(home, ".local", "state");
    const primary = join(dataBase, "opencode");
    const configPrimary = join(configBase, "opencode");
    const statePrimary = join(stateBase, "opencode");
    const cachePrimary = join(cacheBase, "opencode");
    const list = [primary, configPrimary, statePrimary, cachePrimary];
    if (process.platform === "darwin") {
        list.push(join(home, "Library", "Application Support", "opencode"));
    }
    else {
        list.push(join(home, ".local", "share", "opencode"));
        list.push(join(home, ".config", "opencode"));
    }
    return dedupe(list.map((d) => join(d, "auth.json")));
}
let cached = null;
const DEFAULT_CACHE_MAX_AGE_MS = 5_000;
export async function readAuthFile() {
    for (const path of getAuthPathCandidates()) {
        try {
            const content = await readFile(path, "utf-8");
            return JSON.parse(content);
        }
        catch {
            // try next
        }
    }
    return null;
}
export async function readAuthFileCached(maxAgeMs = DEFAULT_CACHE_MAX_AGE_MS) {
    const now = Date.now();
    if (cached && now - cached.at <= maxAgeMs) {
        return cached.value;
    }
    const value = await readAuthFile();
    cached = { value, at: now };
    return value;
}
export function clearAuthCache() {
    cached = null;
}
//# sourceMappingURL=auth.js.map