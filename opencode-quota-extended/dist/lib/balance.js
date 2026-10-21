/** Available credit in dollars (2 decimals), or null when unreadable. */
export function balanceUsd(balance) {
    if (!balance)
        return null;
    const raw = balance.availableMicroCents;
    const micro = typeof raw === "string" ? Number(raw.trim()) : raw;
    if (typeof micro !== "number" || !Number.isFinite(micro))
        return null;
    return Math.round(micro / 1e6) / 100;
}
/** "$9.18 credit", plus a note when credits are drawn or auto-recharge is on. */
export function formatBalance(balance) {
    const usd = balanceUsd(balance);
    if (usd === null || !balance)
        return "";
    const parts = [`$${usd.toFixed(2)} credit`];
    if (balance.useBalance === true)
        parts.push("draws on credits");
    if (balance.autoRecharge?.enabled)
        parts.push("auto-recharge");
    return parts.join(" · ");
}
/** Dollars from a microcents decimal string, using cents precision. */
function microCentsUsd(raw) {
    if (typeof raw !== "string" || raw.trim() === "")
        return null;
    try {
        const micro = BigInt(raw.trim());
        if (micro < 0n)
            return null;
        return Number((micro + 500000n) / 1000000n) / 100;
    }
    catch {
        return null;
    }
}
/** "$2.64 / $30.00" for a window that exposes both money fields. */
export function formatWindowSpend(window) {
    const spent = microCentsUsd(window.spentMicroCents);
    const limit = microCentsUsd(window.limitMicroCents);
    if (spent === null || limit === null || limit <= 0)
        return "";
    return `$${spent.toFixed(2)} / $${limit.toFixed(2)}`;
}
//# sourceMappingURL=balance.js.map