/**
 * OpenCode Go quota provider.
 *
 * Fetches usage data by scraping the opencode.ai workspace dashboard.
 * Requires a workspace ID and auth cookie (either via env vars
 * OPENCODE_GO_WORKSPACE_ID / OPENCODE_GO_AUTH_COOKIE, or a sidecar file at
 * ~/.config/opencode/opencode-quota/opencode-go.json).
 * Returns up to 3 windows: 5h (rolling), Weekly, Monthly.
 */
import type { Provider } from "./types.js";
export declare const opencodeGoProvider: Provider;
//# sourceMappingURL=opencode-go.d.ts.map