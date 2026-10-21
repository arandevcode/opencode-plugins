/** @jsxImportSource @opentui/solid */
import { For, createMemo } from "solid-js";
import { TextAttributes } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { ProviderQuota, QuotaWindow } from "../lib/types.js";
import { trafficLight, trafficLightColorKey } from "./progress-bar.js";
import { formatResetCombined } from "../lib/reset-format.js";
import { formatPace, quotaPace } from "../lib/pace.js";
import { formatBalance, formatWindowSpend } from "../lib/balance.js";

export function ProviderCards(props: {
  api: { theme: { current: TuiThemeCurrent } };
  provider: ProviderQuota;
  showOnlyMultiWindow: boolean;
}): JSX.Element {
  const theme = () => props.api.theme.current;
  const muted = () => theme().textMuted;
  const errorColor = () => theme().error;
  const credit = () => formatBalance(props.provider.balance);

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
    <box flexDirection="column" gap={0} width="100%">
      <box flexDirection="row" gap={1} width="100%">
        <text fg={theme().text} attributes={TextAttributes.BOLD}>
          {props.provider.label}
        </text>
        {credit() ? <text fg={theme().accent}>{credit()}</text> : null}
      </box>
      <box flexDirection="column" gap={1} width="100%">
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
  const percent = () => props.window.percentRemaining;
  const light = () => trafficLight(percent());
  const barColor = () => {
    const key = trafficLightColorKey(light());
    return theme()[key] ?? theme().text;
  };
  const label = () => windowDisplayLabel(props.window);
  const reset = () => formatReset(props.window.resetTimeIso);
  const spend = () => formatWindowSpend(props.window);
  const pace = createMemo(() => quotaPace(props.window));
  const paceText = () => formatPace(props.window);
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
      <GaugeBar percent={percent()} theme={theme()} barColor={barColor()} />
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
    </box>
  );
}

function GaugeBar(props: { percent: number; theme: any; barColor: any }): JSX.Element {
  const clamped = Math.max(0, Math.min(100, props.percent));
  const WIDTH = 38;
  const filledCount = Math.round((clamped / 100) * WIDTH);
  const emptyCount = WIDTH - filledCount;

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
