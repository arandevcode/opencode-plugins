/**
 * OpenCode Quota Cards — server plugin (minimal, dual V1/V2).
 *
 * This plugin is primarily a TUI sidebar plugin. The server module
 * is kept registered for compatibility but provides no additional
 * tools or commands.
 *
 * Both `index.ts` (root) and this `./server` entry export the same object.
 * V1's `oc-plugin: ["server"]` loads it and calls `server`; V2 resolves the
 * `./server` subpath first for dual packages and reads `id` + `setup`. Keeping
 * both entries V2-shaped avoids the "Plugin must export a default definition"
 * error when V2 discovers a directory that contains both files.
 */
import type { Plugin } from "@opencode-ai/plugin";
export declare const quotaCardsServerPlugin: Plugin;
type V2SetupContext = {
    storage?: unknown;
    location?: unknown;
};
declare const plugin: {
    id: string;
    server: Plugin;
    setup(ctx?: V2SetupContext): Promise<void>;
};
export default plugin;
//# sourceMappingURL=server.d.ts.map