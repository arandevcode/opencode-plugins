import type { Provider, ProviderContext } from "./types.js";
import type { ProviderQuota, QuotaWindow } from "../lib/types.js";
import { readAuthFileCached } from "../lib/auth.js";
import { fetchWithTimeout } from "../lib/http.js";

type CopilotAuthEntry = {
  type?: string;
  access?: string;
  refresh?: string;
  expires?: number;
  key?: string;
  org?: string;
};

const COPILOT_INTERNAL_URL = "https://api.github.com/copilot_internal/user";
const USER_AGENT = "opencode-quota-extended/0.1.0";

const COPILOT_PLAN_LIMITS: Record<string, number> = {
  free: 50,
  pro: 300,
  "pro+": 1500,
  business: 300,
  enterprise: 1000,
  individual: 1500,
};

const PLAN_DISPLAY: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  "pro+": "Pro+",
  business: "Business",
  enterprise: "Enterprise",
  individual: "Individual",
};

type Path = ReadonlyArray<string>;

const TOTAL_PATHS: Path[] = [
  ["quota", "limit"],
  ["quota", "total"],
  ["monthly_quota", "limit"],
  ["monthly_quota", "total"],
  ["monthly_premium_requests", "limit"],
  ["monthly_premium_requests", "total"],
  ["premium_requests", "limit"],
  ["premium_requests", "total"],
  ["quota_snapshots", "premium_interactions", "entitlement"],
  ["limit"],
  ["total"],
  ["quota_limit"],
  ["monthly_limit"],
  ["included_premium_requests"],
];

const USED_PATHS: Path[] = [
  ["quota", "used"],
  ["monthly_quota", "used"],
  ["monthly_premium_requests", "used"],
  ["premium_requests", "used"],
  ["used"],
  ["quota_used"],
  ["monthly_used"],
  ["premium_requests_used"],
];

const REMAINING_PATHS: Path[] = [
  ["quota", "remaining"],
  ["monthly_quota", "remaining"],
  ["monthly_premium_requests", "remaining"],
  ["premium_requests", "remaining"],
  ["quota_snapshots", "premium_interactions", "remaining"],
  ["quota_snapshots", "premium_interactions", "quota_remaining"],
  ["remaining"],
  ["quota_remaining"],
  ["monthly_remaining"],
  ["premium_requests_remaining"],
];

const RESET_PATHS: Path[] = [
  ["quota", "reset_at"],
  ["monthly_quota", "reset_at"],
  ["monthly_premium_requests", "reset_at"],
  ["premium_requests", "reset_at"],
  ["reset_at"],
  ["quota_reset_date_utc"],
  ["quota_reset_date"],
  ["quota_reset_at"],
];

const TIER_PATHS: Path[] = [
  ["plan", "type"],
  ["plan", "name"],
  ["plan"],
  ["copilot_plan"],
  ["subscription_plan"],
  ["sku"],
];

function getNested(source: unknown, path: Path): unknown {
  let cur: unknown = source;
  for (const key of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function getFirstNumber(source: unknown, paths: Path[]): number | undefined {
  for (const p of paths) {
    const v = getNested(source, p);
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function getFirstString(source: unknown, paths: Path[]): string | undefined {
  for (const p of paths) {
    const v = getNested(source, p);
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return undefined;
}

function normalizeTier(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "free") return "free";
  if (v === "pro") return "pro";
  if (v === "pro+" || v === "pro_plus" || v === "pro-plus") return "pro+";
  if (v === "business") return "business";
  if (v === "enterprise") return "enterprise";
  if (v === "individual") return "individual";
  return undefined;
}

function tierDisplay(tier: string | undefined): string {
  if (!tier) return "";
  return PLAN_DISPLAY[tier] ?? tier.charAt(0).toUpperCase() + tier.slice(1);
}

function tierLimit(tier: string | undefined): number | undefined {
  if (!tier) return undefined;
  return COPILOT_PLAN_LIMITS[tier];
}

function getFirstPremiumSnapshot(data: Record<string, unknown>): Record<string, unknown> | null {
  const snapshots = data.quota_snapshots;
  if (!snapshots || typeof snapshots !== "object") return null;
  const s = snapshots as Record<string, unknown>;
  for (const key of ["premium_interactions", "chat", "completions"]) {
    const snap = s[key];
    if (snap && typeof snap === "object") return snap as Record<string, unknown>;
  }
  return null;
}

function approxNextMonthResetIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

function parseResetIso(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) {
    const ms = Number(trimmed) * (trimmed.length > 10 ? 1 : 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function pickAuthEntry(auth: Awaited<ReturnType<typeof readAuthFileCached>>): CopilotAuthEntry | null {
  if (!auth) return null;
  const entry = (auth["github-copilot"] ?? auth.copilot) as CopilotAuthEntry | undefined;
  if (!entry) return null;
  const hasAccess = typeof entry.access === "string" && entry.access.length > 0;
  const hasKey = typeof entry.key === "string" && entry.key.length > 0;
  if (!hasAccess && !hasKey) return null;
  return entry;
}

function isOAuthEntry(entry: CopilotAuthEntry): boolean {
  if (entry.type === "oauth") return true;
  if (entry.type === "api") return false;
  return typeof entry.access === "string" && entry.access.length > 0;
}

function isPatEntry(entry: CopilotAuthEntry): boolean {
  return entry.type === "api" && typeof entry.key === "string" && entry.key.length > 0;
}

function err(fetchedAt: string, msg: string): ProviderQuota {
  return { id: "github-copilot", label: "GitHub Copilot", status: "error", error: msg, windows: [], fetchedAt };
}

export const copilotProvider: Provider = {
  id: "github-copilot",
  defaultLabel: "GitHub Copilot",

  async isAvailable(_ctx: ProviderContext): Promise<boolean> {
    const auth = await readAuthFileCached(5_000);
    return pickAuthEntry(auth) !== null;
  },

  async fetch(ctx: ProviderContext): Promise<ProviderQuota> {
    const fetchedAt = new Date().toISOString();
    try {
      const auth = await readAuthFileCached(5_000);
      const entry = pickAuthEntry(auth);
      if (!entry) return { id: "github-copilot", label: "GitHub Copilot", status: "no-auth", windows: [], fetchedAt };

      if (isPatEntry(entry)) {
        return err(
          fetchedAt,
          !entry.key ? "Missing PAT" : "PAT mode: tier-specific math not supported",
        );
      }

      if (!isOAuthEntry(entry)) return err(fetchedAt, "Unsupported Copilot auth type");

      const res = await fetchWithTimeout(
        COPILOT_INTERNAL_URL,
        {
          headers: {
            Authorization: `Bearer ${entry.access}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": USER_AGENT,
          },
        },
        ctx.requestTimeoutMs,
      );

      if (!res.ok) {
        let snippet = "";
        try {
          snippet = (await res.text()).slice(0, 120);
        } catch {}
        return err(fetchedAt, `Copilot API error ${res.status}: ${snippet}`);
      }

      const data = (await res.json()) as Record<string, unknown>;
      const tierRaw = getFirstString(data, TIER_PATHS);
      const tier = normalizeTier(tierRaw);
      const tierShown = tierDisplay(tier);

      let total = getFirstNumber(data, TOTAL_PATHS);
      let used = getFirstNumber(data, USED_PATHS);
      const remaining = getFirstNumber(data, REMAINING_PATHS);

      if (total === undefined && used !== undefined && remaining !== undefined) total = used + remaining;
      if (used === undefined && total !== undefined && remaining !== undefined) {
        used = Math.max(0, total - remaining);
      }
      if (total === undefined && tier) total = tierLimit(tier);

      const resetIso = parseResetIso(getFirstString(data, RESET_PATHS)) ?? approxNextMonthResetIso();

      if (!Number.isFinite(total) || total === undefined || total <= 0) {
        const snap = getFirstPremiumSnapshot(data);
        if (snap) {
          const sTotal = getFirstNumber(snap, [["entitlement"]]);
          const sRemaining = getFirstNumber(snap, [["remaining"], ["quota_remaining"]]);
          if (sTotal && sTotal > 0) {
            const ratio = sRemaining !== undefined ? sRemaining / sTotal : 1;
            const pct = Math.max(0, Math.min(100, Math.floor(ratio * 100)));
            const fallbackTotal = sTotal;
            const fallbackRemaining = sRemaining ?? 0;
            const fallbackUsed = fallbackTotal - fallbackRemaining;
            const window: QuotaWindow = {
              id: "primary",
              label: "Premium requests",
              percentRemaining: pct,
              resetTimeIso: resetIso,
              total: fallbackTotal,
              used: fallbackUsed,
              remaining: fallbackRemaining,
            };
            return {
              id: "github-copilot",
              label: tierShown ? `GitHub Copilot (${tierShown})` : "GitHub Copilot",
              status: "ok",
              windows: [window],
              fetchedAt,
            };
          }
        }
        return err(fetchedAt, "No Copilot quota data in response");
      }

      if (used === undefined) used = 0;
      used = Math.max(0, used);
      const remainingComputed = Math.max(0, total - used);
      const percent = Math.max(0, Math.min(100, Math.floor((remainingComputed * 100) / total)));

      const usedValue = used;
      const remainingValue = remainingComputed;
      const window: QuotaWindow = {
        id: "primary",
        label: "Premium requests",
        percentRemaining: percent,
        resetTimeIso: resetIso,
        total,
        used: usedValue,
        remaining: remainingValue,
      };

      return {
        id: "github-copilot",
        label: tierShown ? `GitHub Copilot (${tierShown})` : "GitHub Copilot",
        status: "ok",
        windows: [window],
        fetchedAt,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(fetchedAt, message.slice(0, 200));
    }
  },
};
