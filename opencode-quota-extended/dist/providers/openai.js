import { readAuthFileCached } from "../lib/auth.js";
import { fetchWithTimeout } from "../lib/http.js";
import { clampPercent } from "../lib/reset-format.js";
const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const USER_AGENT = "opencode-quota-extended/0.1.0";
function pickAuthEntry(auth) {
    if (!auth)
        return null;
    const candidates = [auth.openai, auth.codex, auth.chatgpt];
    for (const entry of candidates) {
        if (!entry)
            continue;
        if (!entry.access || typeof entry.access !== "string" || entry.access.length === 0)
            continue;
        if (entry.type === "api")
            continue;
        return entry;
    }
    return null;
}
function buildLabel(planType) {
    if (typeof planType !== "string" || planType.length === 0)
        return "OpenAI";
    const lower = planType.toLowerCase();
    if (lower.includes("pro"))
        return "OpenAI (Pro)";
    if (lower.includes("plus"))
        return "OpenAI (Plus)";
    return `OpenAI (${planType})`;
}
function windowResetIso(win) {
    if (!win)
        return undefined;
    const resetAt = win.reset_at;
    if (typeof resetAt === "number" && resetAt > 0) {
        return new Date(resetAt * 1000).toISOString();
    }
    const resetAfter = win.reset_after_seconds;
    if (typeof resetAfter === "number" && resetAfter > 0) {
        return new Date(Date.now() + resetAfter * 1000).toISOString();
    }
    return undefined;
}
function windowFromData(id, label, win) {
    if (!win)
        return null;
    const used = win.used_percent;
    if (typeof used !== "number")
        return null;
    return {
        id,
        label,
        percentRemaining: clampPercent(100 - used),
        resetTimeIso: windowResetIso(win),
    };
}
async function readResponseText(res) {
    try {
        return await res.text();
    }
    catch {
        return "";
    }
}
export const openaiProvider = {
    id: "openai",
    defaultLabel: "OpenAI",
    async isAvailable(_ctx) {
        const auth = await readAuthFileCached(5_000);
        return pickAuthEntry(auth) !== null;
    },
    async fetch(ctx) {
        const fetchedAt = new Date().toISOString();
        try {
            const auth = await readAuthFileCached(5_000);
            const entry = pickAuthEntry(auth);
            if (!entry) {
                return {
                    id: "openai",
                    label: "OpenAI",
                    status: "no-auth",
                    windows: [],
                    fetchedAt,
                };
            }
            if (typeof entry.expires === "number" && entry.expires < Date.now()) {
                return {
                    id: "openai",
                    label: "OpenAI",
                    status: "error",
                    error: "Token expired",
                    windows: [],
                    fetchedAt,
                };
            }
            const headers = {
                Authorization: `Bearer ${entry.access}`,
                "User-Agent": USER_AGENT,
            };
            if (typeof entry.accountId === "string" && entry.accountId.length > 0) {
                headers["ChatGPT-Account-Id"] = entry.accountId;
            }
            const res = await fetchWithTimeout(USAGE_URL, { headers }, ctx.requestTimeoutMs);
            if (!res.ok) {
                const text = await readResponseText(res);
                const snippet = text.slice(0, 120);
                return {
                    id: "openai",
                    label: "OpenAI",
                    status: "error",
                    error: `OpenAI API error ${res.status}: ${snippet}`,
                    windows: [],
                    fetchedAt,
                };
            }
            const data = (await res.json());
            const planType = (data.plan_type ?? null);
            const label = buildLabel(planType);
            const rateLimit = (data.rate_limit ?? null);
            const codeReview = (data.code_review_rate_limit ?? null);
            const windows = [];
            const primary = windowFromData("5h", "5h", rateLimit?.primary_window);
            if (primary)
                windows.push(primary);
            const secondary = windowFromData("weekly", "Weekly", rateLimit?.secondary_window);
            if (secondary)
                windows.push(secondary);
            const codeReviewPrimary = windowFromData("code-review", "Code Review", codeReview?.primary_window);
            if (codeReviewPrimary)
                windows.push(codeReviewPrimary);
            return {
                id: "openai",
                label,
                status: "ok",
                windows,
                fetchedAt,
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                id: "openai",
                label: "OpenAI",
                status: "error",
                error: message.slice(0, 200),
                windows: [],
                fetchedAt,
            };
        }
    },
};
//# sourceMappingURL=openai.js.map