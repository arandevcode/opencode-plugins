import { resolveOpenCodeGoInstanceCached } from "../lib/opencode-go-config.js";
import { fetchWithTimeout } from "../lib/http.js";
import { clampPercent } from "../lib/reset-format.js";
const GO_STATUS_URL = "https://opencode.ai/console/api/go/status";
const BILLING_STATUS_URL = "https://opencode.ai/console/api/billing/status";
const AUTO_RECHARGE_URL = "https://opencode.ai/console/api/billing/auto-recharge";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/148.0";
/** Parse a microCents value (string or number) into a bigint. */
function toBigInt(value) {
    if (typeof value === "bigint")
        return value;
    if (typeof value === "number") {
        if (!Number.isFinite(value))
            return null;
        return BigInt(Math.trunc(value));
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "")
            return null;
        try {
            return BigInt(trimmed);
        }
        catch {
            const n = Number(trimmed);
            return Number.isFinite(n) ? BigInt(Math.trunc(n)) : null;
        }
    }
    return null;
}
/** Percent used, computed exactly as the opencode.ai dashboard does. */
function percentUsed(used, limit) {
    if (limit <= 0n)
        return 0;
    return Number((used * 200n + limit) / (limit * 2n));
}
/**
 * Build the Cookie header for the console API. The console authenticates with
 * the `__Host-console_session` cookie (value `st_...`); older setups stored the
 * site `auth` cookie (`Fe26....`), so pick the name by value shape.
 */
function sessionCookieHeader(value) {
    const name = value.startsWith("st_") ? "__Host-console_session" : "auth";
    return `${name}=${value}`;
}
/** Build console API headers for either API-key or legacy cookie auth. */
function buildHeaders(config) {
    const headers = {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
    };
    if (config.auth === "api-key") {
        headers.Authorization = `Bearer ${config.apiKey}`;
        return headers;
    }
    headers.Cookie = sessionCookieHeader(config.authCookie);
    headers["x-org-id"] = config.workspaceId;
    return headers;
}
/** GET a console JSON endpoint. Errors never carry the response body or headers. */
async function getConsoleJson(url, headers, timeoutMs) {
    const res = await fetchWithTimeout(url, { method: "GET", headers }, timeoutMs);
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return JSON.parse(await res.text());
}
/** Parse the `billing/status` body; null when the available credit is unreadable. */
function parseAvailableMicroCents(data) {
    if (!data || typeof data !== "object")
        return null;
    const value = toBigInt(data.availableMicroCents);
    return value === null || value < 0n ? null : value.toString();
}
/** Parse the `billing/auto-recharge` body; null when it does not carry `enabled`. */
function parseAutoRecharge(data) {
    if (!data || typeof data !== "object")
        return null;
    const raw = data;
    if (typeof raw.enabled !== "boolean")
        return null;
    const out = { enabled: raw.enabled };
    if (typeof raw.thresholdDollars === "number" && Number.isFinite(raw.thresholdDollars)) {
        out.thresholdDollars = raw.thresholdDollars;
    }
    if (typeof raw.rechargeAmountDollars === "number" && Number.isFinite(raw.rechargeAmountDollars)) {
        out.rechargeAmountDollars = raw.rechargeAmountDollars;
    }
    return out;
}
/**
 * Credit balance for the account. Both lookups are best-effort: when the
 * balance itself is missing the result is undefined, and a failed auto-recharge
 * lookup only drops that sub-field.
 */
async function fetchBalance(headers, timeoutMs, useBalance) {
    const [billing, recharge] = await Promise.allSettled([
        getConsoleJson(BILLING_STATUS_URL, headers, timeoutMs),
        getConsoleJson(AUTO_RECHARGE_URL, headers, timeoutMs),
    ]);
    if (billing.status !== "fulfilled")
        return undefined;
    const availableMicroCents = parseAvailableMicroCents(billing.value);
    if (availableMicroCents === null)
        return undefined;
    const balance = { availableMicroCents, useBalance };
    if (recharge.status === "fulfilled") {
        const autoRecharge = parseAutoRecharge(recharge.value);
        if (autoRecharge)
            balance.autoRecharge = autoRecharge;
    }
    return balance;
}
function toIso(value) {
    if (typeof value !== "string" || value.trim() === "")
        return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
        return undefined;
    return d.toISOString();
}
function buildWindows(status) {
    const access = status.access;
    if (!access || typeof access !== "object")
        return [];
    const meters = access.meters ?? {};
    const specs = [
        { meter: meters.fiveHour, id: "5h", label: "5h", resetsAt: meters.fiveHour?.resetsAt },
        { meter: meters.week, id: "weekly", label: "Weekly", resetsAt: meters.week?.resetsAt },
        { meter: meters.month, id: "monthly", label: "Monthly", resetsAt: access.endsAt },
    ];
    const windows = [];
    for (const spec of specs) {
        const meter = spec.meter;
        if (!meter)
            continue;
        const limit = toBigInt(meter.limitMicroCents);
        const used = toBigInt(meter.usedMicroCents);
        if (limit === null || used === null)
            continue;
        const window = {
            id: spec.id,
            label: spec.label,
            percentRemaining: clampPercent(100 - percentUsed(used, limit)),
            spentMicroCents: used.toString(),
            limitMicroCents: limit.toString(),
        };
        const resetTimeIso = toIso(spec.resetsAt);
        if (resetTimeIso)
            window.resetTimeIso = resetTimeIso;
        windows.push(window);
    }
    return windows;
}
export function createOpenCodeGoProvider(opts) {
    const { id, label } = opts;
    return {
        id,
        defaultLabel: label,
        async isAvailable() {
            const r = await resolveOpenCodeGoInstanceCached(id);
            return r.state === "configured";
        },
        async fetch(ctx) {
            const fetchedAt = new Date().toISOString();
            const base = {
                id,
                label,
                status: "no-auth",
                windows: [],
                fetchedAt,
            };
            const r = await resolveOpenCodeGoInstanceCached(id);
            if (r.state === "none")
                return { ...base, status: "skipped" };
            if (r.state === "incomplete") {
                return {
                    ...base,
                    status: "error",
                    error: `Missing ${r.missing} (source: ${r.source})`,
                };
            }
            if (r.state === "invalid") {
                return { ...base, status: "error", error: `Invalid config: ${r.error}` };
            }
            const headers = buildHeaders(r.config);
            try {
                const res = await fetchWithTimeout(GO_STATUS_URL, { method: "GET", headers }, ctx.requestTimeoutMs);
                const bodyText = await res.text();
                if (!res.ok) {
                    return {
                        ...base,
                        status: "error",
                        error: `OpenCode Go API error ${res.status}: ${bodyText.slice(0, 120)}`,
                    };
                }
                let data;
                try {
                    data = JSON.parse(bodyText);
                }
                catch {
                    return {
                        ...base,
                        status: "error",
                        error: "OpenCode Go API returned invalid JSON",
                    };
                }
                const status = (data ?? {});
                const windows = buildWindows(status);
                if (windows.length === 0) {
                    return {
                        ...base,
                        status: "error",
                        error: status.access
                            ? "Could not parse any known OpenCode Go usage windows"
                            : "No active OpenCode Go subscription",
                    };
                }
                const useBalance = typeof status.useBalance === "boolean" ? status.useBalance : null;
                const balance = await fetchBalance(headers, ctx.requestTimeoutMs, useBalance);
                return { ...base, status: "ok", windows, ...(balance ? { balance } : {}) };
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { ...base, status: "error", error: message.slice(0, 200) };
            }
        },
    };
}
export const opencodeGoProvider = createOpenCodeGoProvider({
    id: "opencode-go",
    label: "OpenCode Go",
});
//# sourceMappingURL=opencode-go.js.map