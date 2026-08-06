import { openaiProvider } from "./openai.js";
import { copilotProvider } from "./copilot.js";
import { createOpenCodeGoProvider, opencodeGoProvider, } from "./opencode-go.js";
import { discoverOpenCodeGoInstances } from "../lib/opencode-go-config.js";
const ALL_PROVIDERS = [
    openaiProvider,
    copilotProvider,
    opencodeGoProvider,
];
export function getProvider(id) {
    return ALL_PROVIDERS.find((p) => p.id === id);
}
export function listProviders() {
    return ALL_PROVIDERS.slice();
}
function isOpenCodeGoId(id) {
    return id === "opencode-go" || id.startsWith("opencode-go-");
}
/** Build a ProviderContext for a specific provider id. */
export function buildContext(config, providerId) {
    const requestTimeoutMs = isOpenCodeGoId(providerId)
        ? config.opencodeGoTimeoutMs
        : config.requestTimeoutMs;
    return { requestTimeoutMs };
}
/**
 * Stable ordering for providers. Base providers follow the configured
 * `enabledProviders` order; extra OpenCode Go instances are appended right
 * after the base "opencode-go" entry.
 */
function providerOrder(config, id) {
    const idx = config.enabledProviders.indexOf(id);
    if (idx !== -1)
        return idx;
    if (isOpenCodeGoId(id)) {
        const goIdx = config.enabledProviders.indexOf("opencode-go");
        return goIdx !== -1 ? goIdx + 1 : config.enabledProviders.length;
    }
    return config.enabledProviders.length;
}
/**
 * Collect a snapshot by fanning out fetches in parallel for all
 * enabled providers that are available.
 */
export async function collectSnapshot(config) {
    const providers = [];
    const defs = [];
    for (const id of config.enabledProviders) {
        const provider = getProvider(id);
        if (!provider)
            continue;
        defs.push({ provider });
        if (id === "opencode-go") {
            const extras = await discoverOpenCodeGoInstances();
            for (const instance of extras) {
                defs.push({ provider: createOpenCodeGoProvider(instance) });
            }
        }
    }
    const tasks = defs.map(async ({ provider }) => {
        const ctx = buildContext(config, provider.id);
        let available = false;
        try {
            available = await provider.isAvailable(ctx);
        }
        catch {
            available = false;
        }
        if (!available) {
            providers.push({
                id: provider.id,
                label: provider.defaultLabel,
                status: "skipped",
                windows: [],
                fetchedAt: new Date().toISOString(),
            });
            return;
        }
        try {
            const quota = await provider.fetch(ctx);
            providers.push(quota);
        }
        catch (err) {
            providers.push({
                id: provider.id,
                label: provider.defaultLabel,
                status: "error",
                error: err instanceof Error ? err.message : String(err),
                windows: [],
                fetchedAt: new Date().toISOString(),
            });
        }
    });
    await Promise.all(tasks);
    providers.sort((a, b) => {
        const orderA = providerOrder(config, a.id);
        const orderB = providerOrder(config, b.id);
        if (orderA !== orderB)
            return orderA - orderB;
        return a.id.localeCompare(b.id);
    });
    return {
        generatedAt: new Date().toISOString(),
        providers,
    };
}
//# sourceMappingURL=registry.js.map