/**
 * OpenCode Quota Cards Plugin (server entry)
 *
 * Renders quota usage as progress-bar cards in the TUI sidebar for
 * OpenAI, GitHub Copilot and OpenCode Go (5h / weekly / monthly).
 *
 * @packageDocumentation
 */
import plugin from "./server.js";

export { quotaCardsServerPlugin } from "./server.js";
export default plugin;
