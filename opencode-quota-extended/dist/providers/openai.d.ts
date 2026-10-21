/**
 * OpenAI quota provider.
 *
 * Fetches usage data from `chatgpt.com/backend-api/wham/usage`.
 * Returns up to 3 windows: `5h` (rolling), `Weekly`, `Code Review`.
 * Auth token is read from the opencode `auth.json` (openai / codex / chatgpt entry).
 */
import type { Provider } from "./types.js";
export declare const openaiProvider: Provider;
//# sourceMappingURL=openai.d.ts.map