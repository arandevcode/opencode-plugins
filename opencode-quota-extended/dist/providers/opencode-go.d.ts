/**
 * OpenCode Go quota provider.
 *
 * Fetches usage data from the opencode.ai console API:
 *   GET https://opencode.ai/console/api/go/status
 *
 * Preferred auth: a personal API key (`oc_sk_...`) with All permissions, sent
 * as `Authorization: Bearer`. It also unlocks dollar spend and the credit
 * balance. A legacy browser session cookie is still accepted for backwards
 * compatibility: `{ workspaceId, authCookie }` sent as `x-org-id` + Cookie.
 *
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