/**
 * Core type definitions for opencode-quota-extended.
 *
 * The plugin models each provider as a list of independent usage windows
 * (5h, weekly, monthly, code review, etc.). Each window has a percent
 * remaining (0-100) and an optional reset time. The TUI sidebar renders
 * one card per window with a progress bar.
 */

/** Known window identifiers (used to match multi-window providers). */
export type WindowId =
  | "5h"
  | "weekly"
  | "monthly"
  | "code-review"
  | "primary";

/** A single usage window for a provider. */
export interface QuotaWindow {
  /** Stable window id. */
  id: WindowId;
  /** Human-readable short label, e.g. "5h", "Weekly", "Monthly", "Code Review". */
  label: string;
  /** Percent remaining (0-100). Higher = more quota available. */
  percentRemaining: number;
  /** ISO timestamp when the window resets, if known. */
  resetTimeIso?: string;
  /** Total quota for the window, if exposed by the provider (e.g. GitHub Copilot premium requests). */
  total?: number;
  /** Used quota for the window, if exposed by the provider. */
  used?: number;
  /** Remaining quota for the window, if exposed by the provider. */
  remaining?: number;
}

/** Status of a single provider fetch. */
export type ProviderStatus =
  | "ok"
  | "no-auth"
  | "error"
  | "skipped"
  | "loading";

/** A single provider's quota result. */
export interface ProviderQuota {
  /** Stable provider id, e.g. "openai", "github-copilot", "opencode-go". */
  id: string;
  /** Display name shown in the sidebar header, e.g. "OpenAI (Pro)". */
  label: string;
  /** Current status. */
  status: ProviderStatus;
  /** Optional error message when status === "error". */
  error?: string;
  /** Per-window usage data. Empty if status !== "ok". */
  windows: QuotaWindow[];
  /** Timestamp the snapshot was taken. */
  fetchedAt: string;
}

/** Aggregate snapshot used by the TUI sidebar and the server tool. */
export interface CardsSnapshot {
  generatedAt: string;
  providers: ProviderQuota[];
}
