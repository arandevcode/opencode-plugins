/**
 * OpenCode Go quota provider.
 *
 * Fetches usage data from the opencode.ai console API:
 *   GET https://opencode.ai/console/api/go/status
 *
 * Preferred auth: a personal API key (`oc_sk_...`) with All permissions, sent
 * as `Authorization: Bearer`. It also unlocks dollar spend and the credit
 * balance. A legacy browser session cookie is still accepted for backwards
 * compatibility: `{ workspaceId, authCookie }` sent as `x-org-id` + Cookie.
 *
 * Additional instances can be configured via opencode-go-<suffix>.json files,
 * each rendered as its own "Opencode Go <suffix>" section.
 * Returns up to 3 windows: 5h (rolling), Weekly, Monthly.
 */
import type { Provider, ProviderContext } from "./types.js";
import type { ProviderBalance, ProviderQuota, QuotaWindow, WindowId } from "../lib/types.js";
import { resolveOpenCodeGoInstanceCached } from "../lib/opencode-go-config.js";
import type { OpenCodeGoConfig } from "../lib/opencode-go-config.js";
import { fetchWithTimeout } from "../lib/http.js";
import { clampPercent } from "../lib/reset-format.js";

const GO_STATUS_URL = "https://opencode.ai/console/api/go/status";
const BILLING_STATUS_URL = "https://opencode.ai/console/api/billing/status";
const AUTO_RECHARGE_URL = "https://opencode.ai/console/api/billing/auto-recharge";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/148.0";

interface GoMeter {
  startsAt?: unknown;
  resetsAt?: unknown;
  limitMicroCents?: unknown;
  usedMicroCents?: unknown;
}

interface GoStatus {
  product?: unknown;
  useBalance?: unknown;
  access?: {
    startsAt?: unknown;
    endsAt?: unknown;
    meters?: {
      fiveHour?: GoMeter;
      week?: GoMeter;
      month?: GoMeter;
    };
  } | null;
}

/** Parse a microCents value (string or number) into a bigint. */
function toBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    try {
      return BigInt(trimmed);
    } catch {
      const n = Number(trimmed);
      return Number.isFinite(n) ? BigInt(Math.trunc(n)) : null;
    }
  }
  return null;
}

/** Percent used, computed exactly as the opencode.ai dashboard does. */
function percentUsed(used: bigint, limit: bigint): number {
  if (limit <= 0n) return 0;
  return Number((used * 200n + limit) / (limit * 2n));
}

/**
 * Build the Cookie header for the console API. The console authenticates with
 * the `__Host-console_session` cookie (value `st_...`); older setups stored the
 * site `auth` cookie (`Fe26....`), so pick the name by value shape.
 */
function sessionCookieHeader(value: string): string {
  const name = value.startsWith("st_") ? "__Host-console_session" : "auth";
  return `${name}=${value}`;
}

/** Build console API headers for either API-key or legacy cookie auth. */
function buildHeaders(config: OpenCodeGoConfig): Record<string, string> {
  const headers: Record<string, string> = {
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
async function getConsoleJson(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<unknown> {
  const res = await fetchWithTimeout(url, { method: "GET", headers }, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(await res.text());
}

/** Parse the `billing/status` body; null when the available credit is unreadable. */
function parseAvailableMicroCents(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const value = toBigInt((data as { availableMicroCents?: unknown }).availableMicroCents);
  return value === null || value < 0n ? null : value.toString();
}

/** Parse the `billing/auto-recharge` body; null when it does not carry `enabled`. */
function parseAutoRecharge(data: unknown): ProviderBalance["autoRecharge"] | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  if (typeof raw.enabled !== "boolean") return null;
  const out: NonNullable<ProviderBalance["autoRecharge"]> = { enabled: raw.enabled };
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
async function fetchBalance(
  headers: Record<string, string>,
  timeoutMs: number,
  useBalance: boolean | null,
): Promise<ProviderBalance | undefined> {
  const [billing, recharge] = await Promise.allSettled([
    getConsoleJson(BILLING_STATUS_URL, headers, timeoutMs),
    getConsoleJson(AUTO_RECHARGE_URL, headers, timeoutMs),
  ]);
  if (billing.status !== "fulfilled") return undefined;
  const availableMicroCents = parseAvailableMicroCents(billing.value);
  if (availableMicroCents === null) return undefined;
  const balance: ProviderBalance = { availableMicroCents, useBalance };
  if (recharge.status === "fulfilled") {
    const autoRecharge = parseAutoRecharge(recharge.value);
    if (autoRecharge) balance.autoRecharge = autoRecharge;
  }
  return balance;
}

function toIso(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function buildWindows(status: GoStatus): QuotaWindow[] {
  const access = status.access;
  if (!access || typeof access !== "object") return [];
  const meters = access.meters ?? {};
  const specs: {
    meter: GoMeter | undefined;
    id: WindowId;
    label: string;
    resetsAt: unknown;
  }[] = [
    { meter: meters.fiveHour, id: "5h", label: "5h", resetsAt: meters.fiveHour?.resetsAt },
    { meter: meters.week, id: "weekly", label: "Weekly", resetsAt: meters.week?.resetsAt },
    { meter: meters.month, id: "monthly", label: "Monthly", resetsAt: access.endsAt },
  ];
  const windows: QuotaWindow[] = [];
  for (const spec of specs) {
    const meter = spec.meter;
    if (!meter) continue;
    const limit = toBigInt(meter.limitMicroCents);
    const used = toBigInt(meter.usedMicroCents);
    if (limit === null || used === null) continue;
    const window: QuotaWindow = {
      id: spec.id,
      label: spec.label,
      percentRemaining: clampPercent(100 - percentUsed(used, limit)),
      spentMicroCents: used.toString(),
      limitMicroCents: limit.toString(),
    };
    const resetTimeIso = toIso(spec.resetsAt);
    if (resetTimeIso) window.resetTimeIso = resetTimeIso;
    windows.push(window);
  }
  return windows;
}

/** Options to create a named OpenCode Go provider instance. */
export interface OpenCodeGoProviderOptions {
  id: string;
  label: string;
}

export function createOpenCodeGoProvider(opts: OpenCodeGoProviderOptions): Provider {
  const { id, label } = opts;
  return {
    id,
    defaultLabel: label,
    async isAvailable(): Promise<boolean> {
      const r = await resolveOpenCodeGoInstanceCached(id);
      return r.state === "configured";
    },
    async fetch(ctx: ProviderContext): Promise<ProviderQuota> {
      const fetchedAt = new Date().toISOString();
      const base: ProviderQuota = {
        id,
        label,
        status: "no-auth",
        windows: [],
        fetchedAt,
      };
      const r = await resolveOpenCodeGoInstanceCached(id);
      if (r.state === "none") return { ...base, status: "skipped" };
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
        const res = await fetchWithTimeout(
          GO_STATUS_URL,
          { method: "GET", headers },
          ctx.requestTimeoutMs,
        );
        const bodyText = await res.text();
        if (!res.ok) {
          return {
            ...base,
            status: "error",
            error: `OpenCode Go API error ${res.status}: ${bodyText.slice(0, 120)}`,
          };
        }
        let data: unknown;
        try {
          data = JSON.parse(bodyText);
        } catch {
          return {
            ...base,
            status: "error",
            error: "OpenCode Go API returned invalid JSON",
          };
        }
        const status = (data ?? {}) as GoStatus;
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
        const useBalance =
          typeof status.useBalance === "boolean" ? status.useBalance : null;
        const balance = await fetchBalance(headers, ctx.requestTimeoutMs, useBalance);
        return { ...base, status: "ok", windows, ...(balance ? { balance } : {}) };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ...base, status: "error", error: message.slice(0, 200) };
      }
    },
  };
}

export const opencodeGoProvider: Provider = createOpenCodeGoProvider({
  id: "opencode-go",
  label: "OpenCode Go",
});
