/**
 * Provider interface and shared context.
 */
import type { ProviderQuota } from "../lib/types.js";

/** Input passed to a provider's fetch() method. */
export interface ProviderContext {
  /** Per-request timeout in ms. */
  requestTimeoutMs: number;
}

/** A provider fetches quota data from a remote API. */
export interface Provider {
  /** Stable id, e.g. "openai", "github-copilot", "opencode-go". */
  id: string;
  /** Display name when no label override is available. */
  defaultLabel: string;
  /**
   * Best-effort availability check.
   * Should return true if the provider has credentials configured.
   */
  isAvailable(ctx: ProviderContext): Promise<boolean>;
  /**
   * Fetch quota data.
   * Returns a ProviderQuota with status="no-auth" | "error" | "ok".
   */
  fetch(ctx: ProviderContext): Promise<ProviderQuota>;
}
