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
import type { CardsSnapshot } from "../lib/types.js";
export declare function getProvider(id: string): Provider | undefined;
export declare function listProviders(): Provider[];
/** Build a ProviderContext for a specific provider id. */
export declare function buildContext(config: CardsPluginConfig, providerId: string): ProviderContext;
/**
 * Collect a snapshot by fanning out fetches in parallel for all
 * enabled providers that are available. When `previous` is supplied,
 * a failed fetch keeps that provider's last successful reading and is
 * reported as "stale" instead of losing the card.
 */
export declare function collectSnapshot(config: CardsPluginConfig, previous?: CardsSnapshot): Promise<CardsSnapshot>;
//# sourceMappingURL=registry.d.ts.map