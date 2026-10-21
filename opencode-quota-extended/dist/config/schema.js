/**
 * Zod schemas for validating the plugin sidecar configuration file.
 *
 * The root schema `cardsConfigSchema` uses `.passthrough()` to allow
 * documentation keys prefixed with `_` (e.g. `_comment`).
 */
import { z } from "zod";
const providerIdSchema = z.enum(["openai", "github-copilot", "opencode-go"]);
export const WindowIdForOpenCodeGo = z.enum(["5h", "weekly", "monthly"]);
const cardsSidebarSchema = z.object({
    enabled: z.boolean(),
    order: z.number().int(),
});
const cardsConfigBaseSchema = z.object({
    enabled: z.boolean(),
    enabledProviders: z.array(providerIdSchema).min(1),
    refreshIntervalMs: z.coerce.number().int().positive(),
    requestTimeoutMs: z.coerce.number().int().positive(),
    opencodeGoTimeoutMs: z.coerce.number().int().positive(),
    showOnlyMultiWindow: z.boolean(),
    cardsSidebar: cardsSidebarSchema,
    opencodeGoWindows: z.array(WindowIdForOpenCodeGo).min(1),
});
export const cardsConfigSchema = cardsConfigBaseSchema.passthrough();
export function parseCardsConfig(input) {
    return cardsConfigSchema.parse(input);
}
//# sourceMappingURL=schema.js.map