/**
 * Provider registry.
 *
 * Holds the list of available providers and exposes a single
 * `collectSnapshot()` that fans out fetches in parallel and returns
 * a CardsSnapshot suitable for the TUI sidebar and the server tool.
 */
import type { CardsPluginConfig } from "../config/defaults.js";
import type { Provider, ProviderContext } from "./types.js";
import type { CardsSnapshot } from "../lib/types.js";
export declare function getProvider(id: string): Provider | undefined;
export declare function listProviders(): Provider[];
/** Build a ProviderContext for a specific provider id. */
export declare function buildContext(config: CardsPluginConfig, providerId: string): ProviderContext;
/**
 * Collect a snapshot by fanning out fetches in parallel for all
 * enabled providers that are available.
 */
export declare function collectSnapshot(config: CardsPluginConfig): Promise<CardsSnapshot>;
//# sourceMappingURL=registry.d.ts.map