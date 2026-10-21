/**
 * Zod schemas for validating the plugin sidecar configuration file.
 *
 * The root schema `cardsConfigSchema` uses `.passthrough()` to allow
 * documentation keys prefixed with `_` (e.g. `_comment`).
 */
import { z } from "zod";

import type { CardsPluginConfig } from "./defaults.js";

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

export const cardsConfigSchema: z.ZodType<CardsPluginConfig> =
  cardsConfigBaseSchema.passthrough() as z.ZodType<CardsPluginConfig>;

export function parseCardsConfig(input: unknown): CardsPluginConfig {
  return cardsConfigSchema.parse(input);
}
