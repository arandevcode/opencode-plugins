/**
 * OpenCode Go quota provider.
 *
 * Fetches usage data by scraping the opencode.ai workspace dashboard.
 * Requires a workspace ID and auth cookie (either via env vars
 * OPENCODE_GO_WORKSPACE_ID / OPENCODE_GO_AUTH_COOKIE, or a sidecar file at
 * ~/.config/opencode/opencode-quota/opencode-go.json).
 * Additional instances can be configured via opencode-go-<suffix>.json files,
 * each rendered as its own "Opencode Go <suffix>" section.
 * Returns up to 3 windows: 5h (rolling), Weekly, Monthly.
 */
import type { Provider } from "./types.js";
/** Options to create a named OpenCode Go provider instance. */
export interface OpenCodeGoProviderOptions {
    id: string;
    label: string;
}
export declare function createOpenCodeGoProvider(opts: OpenCodeGoProviderOptions): Provider;
export declare const opencodeGoProvider: Provider;
//# sourceMappingURL=opencode-go.d.ts.map