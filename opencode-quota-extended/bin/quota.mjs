#!/usr/bin/env node

import { fileURLToPath } from "url";
import { dirname } from "path";
import { loadCardsConfig } from "../dist/config/loader.js";
import { collectSnapshot } from "../dist/providers/registry.js";
import { trafficLight } from "../dist/ui/progress-bar.js";
import { formatResetCombined } from "../dist/lib/reset-format.js";
import { formatBalance, formatWindowSpend } from "../dist/lib/balance.js";
import {
  actionableHint,
  formatReadingAge,
  isCredentialError,
  isReadingStale,
  windowResetSinceReading,
} from "../dist/lib/freshness.js";
import { loadSnapshotCache, saveSnapshotCache } from "../dist/lib/snapshot-cache.js";
import { readActiveOpenCodeGoAccount } from "../dist/lib/opencode-go-config.js";
import {
  isActiveGoProvider,
  windowPaceText,
  windowTickBar,
} from "../dist/lib/cli-format.js";

const INDENT = 4;

const COLORS = {
  ok: "\x1b[32m",
  warning: "\x1b[33m",
  error: "\x1b[31m",
  accent: "\x1b[36m",
};
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const TICK = "\x1b[1;97m";
const DIM = "\x1b[2m";

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}
function cols() {
  return process.stdout.columns ?? 80;
}
function usedPct(pct) {
  return `${Math.round(100 - pct)}% used`;
}
function windowLabel(window) {
  if (
    typeof window.remaining === "number" &&
    typeof window.total === "number" &&
    Number.isFinite(window.remaining) &&
    Number.isFinite(window.total)
  ) {
    return `${window.remaining}/${window.total}`;
  }
  return window.label;
}
function padRight(left, right) {
  const gap = Math.max(2, cols() - INDENT - stripAnsi(left).length - stripAnsi(right).length);
  return left + " ".repeat(gap) + right;
}

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const loadResult = await loadCardsConfig();
  const config = loadResult.config;
  const barWidth = cols() - INDENT;

  console.log(`\n${BOLD}Quota${RESET}\n`);

  const cached = await loadSnapshotCache();
  const snapshot = await collectSnapshot(config, cached?.snapshot);
  await saveSnapshotCache(snapshot);
  const now = Date.now();
  const activeAccount = await readActiveOpenCodeGoAccount();

  for (const provider of snapshot.providers) {
    if (provider.status === "skipped") continue;

    if (provider.status === "no-auth") {
      console.log(`  ${BOLD}${provider.label}${RESET}  ${DIM}no auth${RESET}`);
      continue;
    }

    if (provider.status === "error") {
      console.log(
        `  ${BOLD}${provider.label}${RESET}  ${COLORS.error}${provider.error ?? "error"}${RESET}`,
      );
      continue;
    }

    if (provider.windows.length === 0) {
      console.log(`  ${BOLD}${provider.label}${RESET}  ${DIM}no data${RESET}`);
      continue;
    }

    const credit = formatBalance(provider.balance);
    const active = isActiveGoProvider(provider.id, activeAccount);
    console.log(
      `${active ? `${COLORS.warning}●${RESET} ` : "  "}${BOLD}${provider.label}${RESET}` +
        `${active ? ` ${DIM}active${RESET}` : ""}` +
        `${credit ? `  ${COLORS.accent}${credit}${RESET}` : ""}`,
    );

    const stale =
      provider.status === "stale" ||
      isReadingStale(provider.fetchedAt, now, config.refreshIntervalMs);
    const age = formatReadingAge(provider.fetchedAt, now);
    if (stale) {
      const hint = actionableHint(provider.hint);
      const action =
        hint ??
        (isCredentialError(provider.error)
          ? "check provider credentials"
          : "run again to refresh");
      console.log(
        " ".repeat(INDENT) + COLORS.warning + `⚠ ${age} · ${action}` + RESET,
      );
    } else {
      console.log(" ".repeat(INDENT) + DIM + age + RESET);
    }

    for (const [i, win] of provider.windows.entries()) {
      if (i > 0) console.log();
      const pct = win.percentRemaining;
      const light = trafficLight(pct);
      const color = COLORS[light];
      const bar = windowTickBar(win, barWidth, now);
      const resetT = formatResetCombined(win.resetTimeIso);
      const resetStyle = resetT ? (light === "error" ? `${color}${resetT}${RESET}` : `${DIM}${resetT}${RESET}`) : "";

      const labelStr = windowLabel(win);
      console.log(" ".repeat(INDENT) + padRight(labelStr, resetStyle));
      console.log(
        " ".repeat(INDENT) +
          color + bar.before + RESET +
          (bar.tick ? TICK + bar.tick + RESET : "") +
          color + bar.after + RESET,
      );
      const leftStr = `${color}${pct}% left${RESET}`;
      const rightStr = `${DIM}${usedPct(pct)}${RESET}`;
      console.log(" ".repeat(INDENT) + padRight(leftStr, rightStr));
      const spend = formatWindowSpend(win);
      const pace = windowPaceText(win, now);
      if (pace) {
        const paceColor = pace.tone === "ok" ? COLORS.ok : pace.tone === "error" ? COLORS.error : DIM;
        const spendStr = spend ? DIM + spend + RESET : "";
        console.log(" ".repeat(INDENT) + padRight(spendStr, paceColor + pace.text + RESET));
      } else if (spend) {
        console.log(" ".repeat(INDENT) + DIM + spend + RESET);
      }
      if (windowResetSinceReading(win.resetTimeIso, provider.fetchedAt, now)) {
        console.log(
          " ".repeat(INDENT) +
            COLORS.warning +
            "window reset since this reading · run again to refresh" +
            RESET,
        );
      }
    }
    console.log();
  }

  console.log(`${DIM}Generated at: ${snapshot.generatedAt}${RESET}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
