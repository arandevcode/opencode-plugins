/** @jsxImportSource @opentui/solid */
import { For } from "solid-js";
import { TextAttributes } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { ProviderQuota, QuotaWindow } from "../lib/types.js";
import { trafficLight } from "./progress-bar.js";
import { formatResetCombined } from "../lib/reset-format.js";

export function ProviderCards(props: {
  api: { theme: { current: TuiThemeCurrent } };
  provider: ProviderQuota;
  showOnlyMultiWindow: boolean;
}): JSX.Element {
  const theme = () => props.api.theme.current;
  const muted = () => theme().textMuted;
  const errorColor = () => theme().error;

  if (props.provider.status === "skipped") return null;

  if (props.provider.status === "no-auth") {
    return (
      <text fg={muted()}>
        {props.provider.label}: no auth
      </text>
    );
  }

  if (props.provider.status === "error") {
    return (
      <text fg={errorColor()}>
        {props.provider.label}: {props.provider.error ?? "error"}
      </text>
    );
  }

  if (props.provider.windows.length === 0) {
    return (
      <text fg={muted()}>
        {props.provider.label}: no data
      </text>
    );
  }

  if (props.showOnlyMultiWindow && props.provider.windows.length === 1) {
    return null;
  }

  return (
    <box flexDirection="column" gap={0}>
      <text fg={theme().text} attributes={TextAttributes.BOLD}>
        {props.provider.label}
      </text>
      <box flexDirection="column" gap={1}>
        <For each={props.provider.windows}>
          {(window) => <WindowRow api={props.api} window={window} />}
        </For>
      </box>
    </box>
  );
}

function WindowRow(props: {
  api: { theme: { current: TuiThemeCurrent } };
  window: QuotaWindow;
}): JSX.Element {
  const theme = () => props.api.theme.current;
  const muted = () => theme().textMuted;
  const textColor = () => theme().text;
  const percent = () => props.window.percentRemaining;
  const light = () => trafficLight(percent());
  const barColor = () => {
    if (light() === "ok") return "#6b8e23";
    if (light() === "warning") return "#ffa500";
    return "#ff6b6b";
  };
  const label = () => windowDisplayLabel(props.window);
  const reset = () => formatReset(props.window.resetTimeIso);
  const usedPct = () => {
    const v = Math.round(100 - percent());
    return v >= 0 ? v : 0;
  };

  return (
    <box flexDirection="column" gap={0}>
      <box flexDirection="row" gap={0} justifyContent="space-between">
        <text>{label()}</text>
        <text fg={light() === "error" ? barColor() : muted()}>{reset()}</text>
      </box>
      <box flexDirection="row" height={1}>
        <box flexGrow={percent()} backgroundColor={barColor()} />
        <box flexGrow={100 - percent()} backgroundColor={theme().backgroundElement} />
      </box>
      <box flexDirection="row" gap={0} justifyContent="flex-end">
        <text fg={textColor()}>{`${usedPct()}% used / `}</text>
        <text fg={barColor()}>{`${percent()}% left`}</text>
      </box>
    </box>
  );
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
