/**
 * Core type definitions for opencode-quota-extended.
 *
 * The plugin models each provider as a list of independent usage windows
 * (5h, weekly, monthly, code review, etc.). Each window has a percent
 * remaining (0-100) and an optional reset time. The TUI sidebar renders
 * one card per window with a progress bar.
 */
/** Known window identifiers (used to match multi-window providers). */
export type WindowId = "5h" | "weekly" | "monthly" | "code-review" | "primary";
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
    /** Money spent in this window, in microcents (1e8 microcents = 1 USD). */
    spentMicroCents?: string;
    /** Money limit for this window, in microcents (1e8 microcents = 1 USD). */
    limitMicroCents?: string;
}
/** Status of a single provider fetch. */
export type ProviderStatus = "ok" | "stale" | "no-auth" | "error" | "skipped" | "loading";
/** Prepaid credit balance of an account, when the provider exposes it (OpenCode Go). */
export interface ProviderBalance {
    /** Available credit in microcents (1e8 microcents = 1 USD), as a decimal string. */
    availableMicroCents: string;
    /** Whether usage may draw on credits once a plan limit is reached; null if unknown. */
    useBalance: boolean | null;
    /** Auto-recharge settings, when readable. */
    autoRecharge?: {
        enabled: boolean;
        thresholdDollars?: number;
        rechargeAmountDollars?: number;
    };
}
/** A single provider's quota result. */
export interface ProviderQuota {
    /** Stable provider id, e.g. "openai", "github-copilot", "opencode-go". */
    id: string;
    /** Display name shown in the sidebar header, e.g. "OpenAI (Pro)". */
    label: string;
    /** Current status. "stale" means the last fetch failed but old data is shown. */
    status: ProviderStatus;
    /** Optional error message when status is "error" or "stale". */
    error?: string;
    /** Per-window usage data. Empty unless status is "ok" or "stale". */
    windows: QuotaWindow[];
    /**
     * Timestamp of the reading shown. For status "stale" this is the last
     * successful fetch, not the failed attempt.
     */
    fetchedAt: string;
    /**
     * Why the provider is skipped and what to do about it (status "skipped"),
     * or the setup hint attached to a stale credential failure.
     */
    hint?: string;
    /** Credit balance, when the provider exposes it and the lookup succeeded. */
    balance?: ProviderBalance;
}
/** Aggregate snapshot used by the TUI sidebar and the server tool. */
export interface CardsSnapshot {
    generatedAt: string;
    providers: ProviderQuota[];
}
//# sourceMappingURL=types.d.ts.map