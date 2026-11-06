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
import type { Plugin, Hooks } from "@opencode-ai/plugin";

export const quotaCardsServerPlugin: Plugin = async (): Promise<Hooks> => {
  return {};
};

type V2SetupContext = {
  storage?: unknown;
  location?: unknown;
};

const plugin = {
  id: "@local/opencode-quota-extended",
  server: quotaCardsServerPlugin as Plugin,
  async setup(ctx?: V2SetupContext) {
    // OpenCode 1.19.x calls setup() too, but without the V2 context.
    if (!ctx?.storage || !ctx?.location) return;
    // V2 has no server-side quota work. The TUI cards are still V1-only;
    // this entry point exists so V2 can load the package without error.
  },
};

export default plugin;
