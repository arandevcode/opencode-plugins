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
async function readV1AuthFile() {
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
let v2Loader = null;
/** Entries that came from OpenCode 2 (identity-tracked so providers can name the source). */
const v2Entries = new WeakSet();
/** Register (or clear with null) the OpenCode 2 credential loader. Only the V2 path calls this. */
export function setV2CredentialLoader(loader) {
    v2Loader = loader;
    cached = null;
}
function jwtAccountId(token) {
    try {
        const part = token.split(".")[1];
        if (!part)
            return undefined;
        const claims = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
        const id = claims.chatgpt_account_id ??
            claims["https://api.openai.com/auth"]?.chatgpt_account_id ??
            claims.organizations?.[0]?.id;
        return typeof id === "string" && id ? id : undefined;
    }
    catch {
        return undefined;
    }
}
/** Map OpenCode 2 credentials onto the AuthFile shape the providers already read. */
export function mapV2Credentials(entries) {
    const out = {};
    const pick = (id) => {
        const all = entries.filter((e) => e?.integrationID === id && e.value);
        return all.find((e) => e.active) ?? all[0];
    };
    const openai = pick("openai");
    const ov = openai?.value;
    if (ov?.type === "oauth" && typeof ov.access === "string" && ov.access) {
        const meta = ov.metadata ?? {};
        const metaId = typeof meta.accountID === "string" ? meta.accountID : undefined;
        out.openai = {
            type: "oauth",
            access: ov.access,
            expires: ov.expires,
            accountId: metaId ?? jwtAccountId(ov.access),
        };
        v2Entries.add(out.openai);
    }
    const copilot = pick("github-copilot");
    const cv = copilot?.value;
    if (cv?.type === "oauth" && typeof cv.access === "string" && cv.access) {
        out["github-copilot"] = { type: "oauth", access: cv.access, expires: cv.expires };
        v2Entries.add(out["github-copilot"]);
    }
    else if (cv?.type === "key" && typeof cv.key === "string" && cv.key) {
        const entry = { type: "api", key: cv.key };
        out["github-copilot"] = entry;
        v2Entries.add(entry);
    }
    return out;
}
/**
 * Where an auth entry came from, for user-facing messages.
 * Returns "" outside OpenCode 2 (V1 behaviour and messages stay unchanged).
 */
export function describeAuthSource(entry) {
    if (!v2Loader || !entry)
        return "";
    return v2Entries.has(entry) ? "OpenCode 2 credentials" : "OpenCode 1.x credentials";
}
/**
 * Read credentials. Inside OpenCode 2 the host's own credentials win; the
 * OpenCode 1.x auth.json is only a per-provider fallback.
 */
export async function readAuthFile() {
    const v1 = await readV1AuthFile();
    if (!v2Loader)
        return v1;
    let v2 = {};
    try {
        const entries = await v2Loader();
        if (Array.isArray(entries))
            v2 = mapV2Credentials(entries);
    }
    catch {
        // V2 credentials unavailable: fall back to auth.json below.
    }
    if (Object.keys(v2).length === 0)
        return v1;
    return { ...(v1 ?? {}), ...v2 };
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