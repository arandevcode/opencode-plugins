/**
 * OpenCode Quota Cards — server plugin (minimal).
 *
 * This plugin is primarily a TUI sidebar plugin. The server module
 * is kept registered for compatibility but provides no additional
 * tools or commands.
 */
import type { Plugin, Hooks } from "@opencode-ai/plugin";

export const quotaCardsServerPlugin: Plugin = async (): Promise<Hooks> => {
  return {};
};
