import { openaiProvider } from "./openai.js";
import { copilotProvider } from "./copilot.js";
import { createOpenCodeGoProvider, opencodeGoProvider, } from "./opencode-go.js";
import { discoverOpenCodeGoInstances } from "../lib/opencode-go-config.js";
import { isCredentialError } from "../lib/freshness.js";
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
 * Build a stale result from the previous successful reading when the
 * current fetch failed. Returns undefined when there is no usable data.
 */
async function staleFromPrevious(provider, ctx, previous, message) {
    const prev = previous?.providers.find((p) => p.id === provider.id && p.windows.length > 0);
    if (!prev)
        return undefined;
    let hint;
    if (isCredentialError(message)) {
        try {
            hint = await provider.unavailableHint?.(ctx);
        }
        catch {
            hint = undefined;
        }
    }
    const effectiveHint = hint ?? prev.hint;
    return {
        id: provider.id,
        label: prev.label,
        status: "stale",
        error: message,
        windows: prev.windows,
        fetchedAt: prev.fetchedAt,
        ...(effectiveHint ? { hint: effectiveHint } : {}),
        ...(prev.balance ? { balance: prev.balance } : {}),
    };
}
/**
 * Collect a snapshot by fanning out fetches in parallel for all
 * enabled providers that are available. When `previous` is supplied,
 * a failed fetch keeps that provider's last successful reading and is
 * reported as "stale" instead of losing the card.
 */
export async function collectSnapshot(config, previous) {
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
            let hint;
            try {
                hint = await provider.unavailableHint?.(ctx);
            }
            catch {
                hint = undefined;
            }
            providers.push({
                id: provider.id,
                label: provider.defaultLabel,
                status: "skipped",
                hint,
                windows: [],
                fetchedAt: new Date().toISOString(),
            });
            return;
        }
        try {
            const quota = await provider.fetch(ctx);
            if (quota.status === "error") {
                const message = quota.error ?? "fetch failed";
                const stale = await staleFromPrevious(provider, ctx, previous, message);
                providers.push(stale ?? quota);
                return;
            }
            providers.push(quota);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const stale = await staleFromPrevious(provider, ctx, previous, message);
            providers.push(stale ?? {
                id: provider.id,
                label: provider.defaultLabel,
                status: "error",
                error: message,
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