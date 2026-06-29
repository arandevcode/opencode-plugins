/**
 * OpenCode Go quota provider.
 *
 * Fetches usage data by scraping the opencode.ai workspace dashboard.
 * Requires a workspace ID and auth cookie (either via env vars
 * OPENCODE_GO_WORKSPACE_ID / OPENCODE_GO_AUTH_COOKIE, or a sidecar file at
 * ~/.config/opencode/opencode-quota/opencode-go.json).
 * Returns up to 3 windows: 5h (rolling), Weekly, Monthly.
 */
import type { Provider, ProviderContext } from "./types.js";
import type { ProviderQuota, QuotaWindow, WindowId } from "../lib/types.js";
import { resolveOpenCodeGoConfigCached } from "../lib/opencode-go-config.js";
import { fetchWithTimeout } from "../lib/http.js";
import { clampPercent } from "../lib/reset-format.js";

const DASHBOARD_URL_PREFIX = "https://opencode.ai/workspace/";
const DASHBOARD_URL_SUFFIX = "/go";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/148.0";

const WINDOWS: { field: string; id: WindowId; label: string }[] = [
  { field: "rollingUsage", id: "5h", label: "5h" },
  { field: "weeklyUsage", id: "weekly", label: "Weekly" },
  { field: "monthlyUsage", id: "monthly", label: "Monthly" },
];

const RE_FIELD_PCT_FIRST = (field: string) =>
  new RegExp(
    `${field}[^=]*=\\s*\\{[^}]*?usagePercent\\s*:\\s*(\\d+)[^}]*?resetInSec\\s*:\\s*(\\d+)`,
  );
const RE_FIELD_RESET_FIRST = (field: string) =>
  new RegExp(
    `${field}[^=]*=\\s*\\{[^}]*?resetInSec\\s*:\\s*(\\d+)[^}]*?usagePercent\\s*:\\s*(\\d+)`,
  );

function parseWindow(
  html: string,
  field: string,
): { usagePercent: number; resetInSec: number } | null {
  const m1 = html.match(RE_FIELD_PCT_FIRST(field));
  if (m1 && m1[1] !== undefined && m1[2] !== undefined) {
    return { usagePercent: Number(m1[1]), resetInSec: Number(m1[2]) };
  }
  const m2 = html.match(RE_FIELD_RESET_FIRST(field));
  if (m2 && m2[1] !== undefined && m2[2] !== undefined) {
    return { usagePercent: Number(m2[2]), resetInSec: Number(m2[1]) };
  }
  return null;
}

export const opencodeGoProvider: Provider = {
  id: "opencode-go",
  defaultLabel: "OpenCode Go",
  async isAvailable(): Promise<boolean> {
    const r = await resolveOpenCodeGoConfigCached();
    return r.state === "configured";
  },
  async fetch(ctx: ProviderContext): Promise<ProviderQuota> {
    const fetchedAt = new Date().toISOString();
    const base: ProviderQuota = {
      id: "opencode-go",
      label: "OpenCode Go",
      status: "no-auth",
      windows: [],
      fetchedAt,
    };
    const r = await resolveOpenCodeGoConfigCached();
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
    const { workspaceId, authCookie } = r.config;
    try {
      const url = `${DASHBOARD_URL_PREFIX}${encodeURIComponent(workspaceId)}${DASHBOARD_URL_SUFFIX}`;
      const res = await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "text/html",
            Cookie: `auth=${authCookie}`,
          },
        },
        ctx.requestTimeoutMs,
      );
      if (!res.ok) {
        const text = (await res.text()).slice(0, 120);
        return {
          ...base,
          status: "error",
          error: `OpenCode Go dashboard error ${res.status}: ${text}`,
        };
      }
      const html = await res.text();
      const now = Date.now();
      const windows: QuotaWindow[] = [];
      for (const spec of WINDOWS) {
        const parsed = parseWindow(html, spec.field);
        if (!parsed) continue;
        windows.push({
          id: spec.id,
          label: spec.label,
          percentRemaining: clampPercent(100 - parsed.usagePercent),
          resetTimeIso: new Date(now + parsed.resetInSec * 1000).toISOString(),
        });
      }
      if (windows.length === 0) {
        return {
          ...base,
          status: "error",
          error: "Could not parse any known OpenCode Go dashboard usage windows",
        };
      }
      return { ...base, status: "ok", windows };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ...base, status: "error", error: message.slice(0, 200) };
    }
  },
};
