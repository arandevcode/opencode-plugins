/** @jsxImportSource @opentui/solid */
import { For, createMemo } from "solid-js";
import { TextAttributes } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { ProviderQuota, QuotaWindow } from "../lib/types.js";
import { trafficLight, trafficLightColorKey } from "./progress-bar.js";
import { formatResetCombined } from "../lib/reset-format.js";
import { formatPaceCompact, paceLinePercent, quotaPace } from "../lib/pace.js";
import { formatBalanceCompact, formatWindowSpend } from "../lib/balance.js";
import {
  actionableHint,
  formatAge,
  isCredentialError,
  isReadingStale,
  readingAgeMs,
  windowResetSinceReading,
} from "../lib/freshness.js";

export function ProviderCards(props: {
  api: { theme: { current: TuiThemeCurrent } };
  provider: ProviderQuota;
  showOnlyMultiWindow: boolean;
  now: () => number;
  refreshIntervalMs: number;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
}): JSX.Element {
  const theme = () => props.api.theme.current;
  const muted = () => theme().textMuted;
  const errorColor = () => theme().error;
  const credit = () => formatBalanceCompact(props.provider.balance);
  const summary = () => {
    const windows = props.provider.windows;
    if (windows.length === 1) {
      const single = windows[0];
      if (single) return `${Math.round(single.percentRemaining)}%`;
    }
    return windows
      .map((window) => {
        const label = shortWindowLabel(window);
        const percent = `${Math.round(window.percentRemaining)}%`;
        return label ? `${label} ${percent}` : percent;
      })
      .join(" · ");
  };
  const readingStale = () =>
    props.provider.status === "stale" ||
    isReadingStale(
      props.provider.fetchedAt,
      props.now(),
      props.refreshIntervalMs,
    );
  const ageText = () =>
    formatAge(readingAgeMs(props.provider.fetchedAt, props.now()));
  const staleAction = () => {
    const hint = actionableHint(props.provider.hint);
    if (hint) return hint;
    return isCredentialError(props.provider.error)
      ? "check provider credentials"
      : "refreshes automatically";
  };

  // Reserve the same left and right border columns on every card. Inactive
  // cards draw them transparent, so switching the active provider never
  // shifts the provider names or their window rows.
  const framed = (content: JSX.Element) => (
    <box
      flexDirection="column"
      gap={0}
      width="100%"
      border={
        props.active
          ? ["left", "right", "top", "bottom"]
          : ["left", "right"]
      }
      borderColor={props.active ? theme().warning : "transparent"}
      borderStyle="rounded"
      paddingLeft={1}
      paddingRight={1}
    >
      {content}
    </box>
  );

  const statusSummary = () => {
    if (props.provider.status === "skipped") return "not configured";
    if (props.provider.status === "no-auth") return "no auth";
    if (props.provider.status === "error") {
      return props.provider.error ?? "error";
    }
    return "no data";
  };
  const statusDetail = () => {
    const hint = actionableHint(props.provider.hint);
    if (props.provider.status === "skipped") {
      return hint ?? "configuration required";
    }
    if (props.provider.status === "no-auth") {
      return hint ?? "run /connect or check provider credentials";
    }
    if (props.provider.status === "error") {
      if (hint) return hint;
      return isCredentialError(props.provider.error)
        ? "check provider credentials"
        : "refreshes automatically";
    }
    return hint ?? "refreshes automatically";
  };
  const statusOnly =
    props.provider.status === "skipped" ||
    props.provider.status === "no-auth" ||
    props.provider.status === "error" ||
    props.provider.windows.length === 0;

  if (statusOnly) {
    if (props.provider.status === "skipped" && !props.provider.hint) return null;
    const detail = statusDetail();
    return framed(
      <box flexDirection="column" gap={0} width="100%">
        <box
          flexDirection="row"
          gap={1}
          width="100%"
          justifyContent="space-between"
          onMouseDown={() => props.onToggle()}
        >
          <box flexDirection="row" gap={1} flexShrink={1}>
            <text fg={muted()} wrapMode="none">
              {props.expanded ? "▾" : "▸"}
            </text>
            {props.active ? (
              <text fg={theme().warning} wrapMode="none">
                ●
              </text>
            ) : null}
            <text
              fg={theme().text}
              attributes={TextAttributes.BOLD}
              wrapMode="none"
              truncate
              flexShrink={1}
            >
              {props.provider.label}
            </text>
          </box>
          <text
            fg={readingStale() ? theme().warning : muted()}
            wrapMode="none"
            flexShrink={0}
          >
            {readingStale() ? `⚠ ${ageText()}` : ageText()}
          </text>
        </box>
        <text
          fg={props.provider.status === "error" ? errorColor() : muted()}
          wrapMode="word"
        >
          {statusSummary()}
        </text>
        {props.expanded && detail !== statusSummary() ? (
          <text fg={theme().warning} wrapMode="word">
            {detail}
          </text>
        ) : null}
      </box>,
    );
  }

  if (props.showOnlyMultiWindow && props.provider.windows.length === 1) {
    return null;
  }

  return framed(
    <box flexDirection="column" gap={0} width="100%">
      <box
        flexDirection="row"
        gap={1}
        width="100%"
        justifyContent="space-between"
        onMouseDown={() => props.onToggle()}
      >
        <box flexDirection="row" gap={1} flexShrink={1}>
          <text fg={muted()} wrapMode="none">
            {props.expanded ? "▾" : "▸"}
          </text>
          {props.active ? (
            <text fg={theme().warning} wrapMode="none">
              ●
            </text>
          ) : null}
          <text
            fg={theme().text}
            attributes={TextAttributes.BOLD}
            wrapMode="none"
            truncate
            flexShrink={1}
          >
            {compactProviderLabel(props.provider.label)}
          </text>
        </box>
        <box flexDirection="row" gap={1} flexShrink={0}>
          {props.expanded && credit() ? (
            <text fg={theme().accent} wrapMode="none">
              {credit()}
            </text>
          ) : null}
          <text fg={readingStale() ? theme().warning : muted()} wrapMode="none">
            {readingStale() ? `⚠ ${ageText()}` : ageText()}
          </text>
        </box>
      </box>
      {!props.expanded ? (
        <box
          flexDirection="row"
          gap={1}
          width="100%"
          justifyContent="space-between"
          onMouseDown={() => props.onToggle()}
        >
          <text fg={muted()} wrapMode="none" truncate flexShrink={1}>
            {summary()}
          </text>
          {credit() ? (
            <text fg={theme().accent} wrapMode="none">
              {credit()}
            </text>
          ) : null}
        </box>
      ) : null}
      {readingStale() ? (
        <text fg={theme().warning} wrapMode="word">
          {staleAction()}
        </text>
      ) : null}
      {props.expanded ? (
        <box flexDirection="column" gap={1} width="100%">
          <For each={props.provider.windows}>
            {(window) => (
              <WindowRow
                api={props.api}
                window={window}
                fetchedAt={props.provider.fetchedAt}
                now={props.now}
              />
            )}
          </For>
        </box>
      ) : null}
    </box>
  );
}

function WindowRow(props: {
  api: { theme: { current: TuiThemeCurrent } };
  window: QuotaWindow;
  fetchedAt: string;
  now: () => number;
}): JSX.Element {
  const theme = () => props.api.theme.current;
  const muted = () => theme().textMuted;
  const percent = () => props.window.percentRemaining;
  const resetSinceReading = () =>
    windowResetSinceReading(
      props.window.resetTimeIso,
      props.fetchedAt,
      props.now(),
    );
  const light = () => trafficLight(percent());
  const barColor = () => {
    const key = trafficLightColorKey(light());
    return theme()[key] ?? theme().text;
  };
  const label = () => windowDisplayLabel(props.window);
  const reset = () => formatReset(props.window.resetTimeIso);
  const spend = () => formatWindowSpend(props.window);
  const pace = createMemo(() => quotaPace(props.window, props.now()));
  const paceText = () => formatPaceCompact(props.window, props.now());
  const paceLine = () => paceLinePercent(props.window, props.now());
  const paceColor = () => {
    const reading = pace();
    if (!reading || reading.pace === "on-pace") return muted();
    return reading.pace === "buffer" ? theme().success : theme().error;
  };

  return (
    <box flexDirection="column" gap={0} width="100%">
      <box flexDirection="row" gap={0} justifyContent="space-between">
        <text>{label()}</text>
        <text fg={light() === "error" ? barColor() : muted()}>{reset()}</text>
      </box>
      <GaugeBar
        percent={percent()}
        theme={theme()}
        barColor={barColor()}
        markerPercent={paceLine()}
        markerColor={theme().warning}
      />
      <box flexDirection="row" gap={0} justifyContent="space-between">
        <text fg={barColor()}>{percent()}% left</text>
        <text fg={muted()}>{100 - percent()}% used</text>
      </box>
      {spend() || paceText() ? (
        <box flexDirection="row" gap={0} justifyContent="space-between" width="100%">
          <text fg={muted()}>{spend()}</text>
          <text fg={paceColor()}>{paceText()}</text>
        </box>
      ) : null}
      {resetSinceReading() ? (
        <text fg={theme().warning}>
          window reset since this reading · refreshes automatically
        </text>
      ) : null}
    </box>
  );
}

function GaugeBar(props: {
  percent: number;
  theme: any;
  barColor: any;
  markerPercent?: number | null;
  markerColor?: any;
}): JSX.Element {
  const clamped = Math.max(0, Math.min(100, props.percent));
  const WIDTH = 38;
  const filledCount = Math.round((clamped / 100) * WIDTH);
  const emptyCount = WIDTH - filledCount;

  if (props.markerPercent == null || !Number.isFinite(props.markerPercent)) {
    return (
      <box flexDirection="row" height={1}>
        {filledCount > 0 ? (
          <text fg={props.barColor}>{"▓".repeat(filledCount)}</text>
        ) : null}
        {emptyCount > 0 ? (
          <text fg={props.barColor}>{"░".repeat(emptyCount)}</text>
        ) : null}
      </box>
    );
  }

  // Overlay a one-cell tick without changing the bar width. The tick marks how
  // much of the window is still ahead, so the filled quota can be compared
  // directly against it.
  const marker = Math.max(0, Math.min(100, props.markerPercent));
  const markerIndex = Math.min(
    WIDTH - 1,
    Math.max(0, Math.round((marker / 100) * (WIDTH - 1))),
  );
  const cells = Array.from({ length: WIDTH }, (_, index) =>
    index < filledCount ? "▓" : "░",
  );
  const before = cells.slice(0, markerIndex).join("");
  const after = cells.slice(markerIndex + 1).join("");

  return (
    <box flexDirection="row" height={1}>
      {before ? <text fg={props.barColor}>{before}</text> : null}
      <text fg={props.markerColor ?? props.barColor}>{"│"}</text>
      {after ? <text fg={props.barColor}>{after}</text> : null}
    </box>
  );
}

function compactProviderLabel(label: string): string {
  const trimmed = label.trim();
  const go = trimmed.replace(/^opencode\s*go\b/i, "GO");
  if (go !== trimmed) return go;
  return trimmed.replace(/^github\s+copilot\b/i, "Copilot");
}

function shortWindowLabel(window: QuotaWindow): string {
  const raw = window.label?.trim() ?? "";
  const lower = raw.toLowerCase();
  if (lower.includes("5h") || lower.includes("5 hour")) return "5h";
  if (lower.includes("week")) return "wk";
  if (lower.includes("month")) return "mo";
  if (lower.includes("day")) return "day";
  if (!raw || /^\d+\s*\/\s*\d+$/.test(raw)) return "";
  return raw.length <= 7 ? raw : `${raw.slice(0, 6)}…`;
}

function windowDisplayLabel(window: QuotaWindow): string {
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

function formatReset(iso: string | undefined): string {
  const s = formatResetCombined(iso);
  return s || "—";
}
