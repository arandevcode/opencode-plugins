/**
 * Zod schemas for validating the plugin sidecar configuration file.
 *
 * The root schema `cardsConfigSchema` uses `.passthrough()` to allow
 * documentation keys prefixed with `_` (e.g. `_comment`).
 */
import { z } from "zod";
import type { CardsPluginConfig } from "./defaults.js";
export declare const WindowIdForOpenCodeGo: z.ZodEnum<{
    "5h": "5h";
    weekly: "weekly";
    monthly: "monthly";
}>;
export declare const cardsConfigSchema: z.ZodType<CardsPluginConfig>;
export declare function parseCardsConfig(input: unknown): CardsPluginConfig;
//# sourceMappingURL=schema.d.ts.map