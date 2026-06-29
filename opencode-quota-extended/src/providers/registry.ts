/**
 * Provider registry.
 *
 * Holds the list of available providers and exposes a single
 * `collectSnapshot()` that fans out fetches in parallel and returns
 * a CardsSnapshot suitable for the TUI sidebar and the server tool.
 */
import type { CardsPluginConfig } from "../config/defaults.js";
import type { Provider, ProviderContext } from "./types.js";
import type { CardsSnapshot, ProviderQuota } from "../lib/types.js";

import { openaiProvider } from "./openai.js";
import { copilotProvider } from "./copilot.js";
import { opencodeGoProvider } from "./opencode-go.js";

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

/** Build a ProviderContext for a specific provider id. */
export function buildContext(
  config: CardsPluginConfig,
  providerId: string,
): ProviderContext {
  const requestTimeoutMs =
    providerId === "opencode-go"
      ? config.opencodeGoTimeoutMs
      : config.requestTimeoutMs;
  return { requestTimeoutMs };
}

/**
 * Collect a snapshot by fanning out fetches in parallel for all
 * enabled providers that are available.
 */
export async function collectSnapshot(
  config: CardsPluginConfig,
): Promise<CardsSnapshot> {
  const providers: ProviderQuota[] = [];

  const tasks = config.enabledProviders.map(async (id) => {
    const provider = getProvider(id);
    if (!provider) return;
    const ctx = buildContext(config, id);
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
    const order = config.enabledProviders.indexOf(
      a.id as (typeof config.enabledProviders)[number],
    );
    const orderB = config.enabledProviders.indexOf(
      b.id as (typeof config.enabledProviders)[number],
    );
    return order - orderB;
  });

  return {
    generatedAt: new Date().toISOString(),
    providers,
  };
}
