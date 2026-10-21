/**
 * OpenCode Quota Cards Plugin (server entry)
 *
 * Renders quota usage as progress-bar cards in the TUI sidebar for
 * OpenAI, GitHub Copilot and OpenCode Go (5h / weekly / monthly).
 *
 * @packageDocumentation
 */
import type { Plugin, PluginInput, Hooks, PluginModule } from "@opencode-ai/plugin";

import { quotaCardsServerPlugin } from "./server.js";

const pluginModule: PluginModule = {
  id: "@local/opencode-quota-extended",
  server: quotaCardsServerPlugin as Plugin,
};

export default pluginModule;
export { quotaCardsServerPlugin };
