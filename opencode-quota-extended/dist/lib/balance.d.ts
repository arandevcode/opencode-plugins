/**
 * Prepaid credit balance formatting (OpenCode Go).
 *
 * The provider reports `availableMicroCents` as a decimal string because it can
 * exceed the safe integer range; 1e8 microcents make one US dollar. Only the
 * dollar amount and the auto-recharge flag are ever rendered — never the raw
 * microcents, and never anything that came from the account credentials.
 */
import type { ProviderBalance, QuotaWindow } from "./types.js";
/** Available credit in dollars (2 decimals), or null when unreadable. */
export declare function balanceUsd(balance: ProviderBalance | undefined): number | null;
/** "$9.18 credit", plus a note when credits are drawn or auto-recharge is on. */
export declare function formatBalance(balance: ProviderBalance | undefined): string;
/** "$2.64 / $30.00" for a window that exposes both money fields. */
export declare function formatWindowSpend(window: QuotaWindow): string;
//# sourceMappingURL=balance.d.ts.map