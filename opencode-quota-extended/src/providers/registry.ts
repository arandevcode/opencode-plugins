/**
 * Provider registry.
 *
 * Holds the list of available providers and exposes a single
 * `collectSnapshot()` that fans out fetches in parallel and returns
 * a CardsSnapshot suitable for the TUI sidebar and the server tool.
 *
 * OpenCode Go is dynamic: besides the base "opencode-go" instance, any
 * opencode-go-<suffix>.json sidecar file adds an extra "Opencode Go <suffix>"
 * provider.
 */
import type { CardsPluginConfig } from "../config/defaults.js";
import type { Provider, ProviderContext } from "./types.js";
import type { CardsSnapshot, ProviderQuota } from "../lib/types.js";

import { openaiProvider } from "./openai.js";
import { copilotProvider } from "./copilot.js";
import {
  createOpenCodeGoProvider,
  opencodeGoProvider,
} from "./opencode-go.js";
import { discoverOpenCodeGoInstances } from "../lib/opencode-go-config.js";

const ALL_PROVIDERS: Provider[] = [
  openaiProvider,
  copilotProvider,
  opencodeGoProvider,
];

export function getProvider(id: string): Provider | undefined {
  return ALL_PROVIDERS.find((p) => p.id === id);
}

export function listProviders(): Provider[] {
  return ALL_PROVIDERS.slice();
}

function isOpenCodeGoId(id: string): boolean {
  return id === "opencode-go" || id.startsWith("opencode-go-");
}

/** Build a ProviderContext for a specific provider id. */
export function buildContext(
  config: CardsPluginConfig,
  providerId: string,
): ProviderContext {
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
function providerOrder(config: CardsPluginConfig, id: string): number {
  const idx = config.enabledProviders.indexOf(
    id as (typeof config.enabledProviders)[number],
  );
  if (idx !== -1) return idx;
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
export async function collectSnapshot(
  config: CardsPluginConfig,
): Promise<CardsSnapshot> {
  const providers: ProviderQuota[] = [];

  const defs: Array<{ provider: Provider }> = [];
  for (const id of config.enabledProviders) {
    const provider = getProvider(id);
    if (!provider) continue;
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
    } catch {
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
    } catch (err) {
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
    if (orderA !== orderB) return orderA - orderB;
    return a.id.localeCompare(b.id);
  });

  return {
    generatedAt: new Date().toISOString(),
    providers,
  };
}
