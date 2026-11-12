/**
 * Sidebar layout decisions that do not depend on the renderer.
 *
 * Providers with no credentials at all ("skipped") are usually ones the user
 * never signed up for (for example OpenAI for someone who only uses Copilot
 * and OpenCode Go). They do not get a card of their own and do not count in
 * the header: they are folded into one muted "not set up" line that expands
 * to the setup hints. The exception is the provider the current session is
 * using, whose missing setup is relevant right now, so it keeps its card.
 */
import type { ProviderQuota } from "../lib/types.js";

export interface PanelLayout {
  /** Providers rendered as cards, in snapshot order. */
  cards: ProviderQuota[];
  /** Providers without credentials, folded into the "not set up" line. */
  unconfigured: ProviderQuota[];
  /** Cards with a usable reading (ok or stale). */
  ready: number;
  /** Cards counted in the header denominator. */
  total: number;
}

export function panelLayout(
  providers: ProviderQuota[],
  activeProviderId: string | undefined,
): PanelLayout {
  const cards: ProviderQuota[] = [];
  const unconfigured: ProviderQuota[] = [];
  for (const provider of providers) {
    if (provider.status === "skipped" && provider.id !== activeProviderId) {
      unconfigured.push(provider);
    } else {
      cards.push(provider);
    }
  }
  const ready = cards.filter(
    (p) => p.status === "ok" || p.status === "stale",
  ).length;
  return { cards, unconfigured, ready, total: cards.length };
}

/** Text of the collapsed line, e.g. "not set up: OpenAI". */
export function unconfiguredSummary(unconfigured: ProviderQuota[]): string {
  return `not set up: ${unconfigured.map((p) => p.label).join(", ")}`;
}
