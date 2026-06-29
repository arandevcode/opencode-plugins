import { access, readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { xdgConfig } from "xdg-basedir";
import { DEFAULT_CONFIG, SIDECAR_FILENAME, } from "./defaults.js";
import { parseCardsConfig } from "./schema.js";
function getOpencodeConfigDir() {
    if (process.env.OPENCODE_CONFIG_DIR) {
        return process.env.OPENCODE_CONFIG_DIR;
    }
    if (xdgConfig) {
        return join(xdgConfig, "opencode");
    }
    return join(homedir(), ".config", "opencode");
}
async function fileExists(filePath) {
    try {
        await access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
async function tryLoad(filePath, source) {
    try {
        const raw = await readFile(filePath, "utf8");
        const parsed = JSON.parse(raw);
        const config = parseCardsConfig(parsed);
        return { ok: true, result: { config, source, path: filePath } };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: `${source}: ${message}` };
    }
}
export async function loadCardsConfig() {
    const errors = [];
    const candidates = [];
    const envPath = process.env.OPENCODE_QUOTA_CARDS_CONFIG;
    if (envPath) {
        candidates.push({ path: envPath, source: "env-override" });
    }
    candidates.push({
        path: join(process.cwd(), SIDECAR_FILENAME),
        source: "cwd",
    });
    const opencodeConfigDir = getOpencodeConfigDir();
    if (opencodeConfigDir) {
        candidates.push({
            path: join(opencodeConfigDir, SIDECAR_FILENAME),
            source: "opencode-config",
        });
    }
    if (xdgConfig) {
        candidates.push({
            path: join(xdgConfig, SIDECAR_FILENAME),
            source: "xdg-config",
        });
    }
    else {
        candidates.push({
            path: join(homedir(), ".config", SIDECAR_FILENAME),
            source: "xdg-config-fallback",
        });
    }
    for (const candidate of candidates) {
        if (!(await fileExists(candidate.path)))
            continue;
        const attempt = await tryLoad(candidate.path, candidate.source);
        if (attempt.ok) {
            if (errors.length > 0) {
                return { ...attempt.result, error: errors.join("; ") };
            }
            return attempt.result;
        }
        errors.push(attempt.error);
    }
    if (errors.length > 0) {
        return {
            config: DEFAULT_CONFIG,
            source: "defaults",
            path: null,
            error: errors.join("; "),
        };
    }
    return { config: DEFAULT_CONFIG, source: "defaults", path: null };
}
//# sourceMappingURL=loader.js.map