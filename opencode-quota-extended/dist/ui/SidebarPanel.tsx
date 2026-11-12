/** @jsxImportSource @opentui/solid */
import { For, createSignal } from "solid-js";
import { TextAttributes } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { CardsPluginConfig } from "../config/defaults.js";
import type { CardsSnapshot } from "../lib/types.js";
import { actionableHint } from "../lib/freshness.js";
import type { ExpansionState } from "./expansion.js";
import { ProviderCards } from "./cards.js";
import { panelLayout, unconfiguredSummary } from "./panel-layout.js";

export function SidebarPanel(props: {
  api: TuiPluginApi;
  config: CardsPluginConfig;
  snapshot: () => CardsSnapshot;
  now: () => number;
  refreshIntervalMs: number;
  sessionId: string;
  activeProviderId: () => string | undefined;
  expansion: ExpansionState;
}): JSX.Element {
  const theme = () => props.api.theme.current;
  const titleColor = () => theme().text;
  const muted = () => theme().textMuted;

  const layout = () =>
    panelLayout(props.snapshot().providers, props.activeProviderId());
  const [setupOpen, setSetupOpen] = createSignal(false);

  return (
    <box flexDirection="column" gap={0}>
      <box flexDirection="row" gap={1}>
        <text fg={titleColor()} attributes={TextAttributes.BOLD}>
          {layout().total > 0
            ? `Quota  (${layout().ready}/${layout().total})`
            : "Quota"}
        </text>
      </box>
      <box flexDirection="column" gap={1}>
        <For each={layout().cards}>
          {(p) => (
            <ProviderCards
              api={props.api}
              provider={p}
              showOnlyMultiWindow={props.config.showOnlyMultiWindow}
              now={props.now}
              refreshIntervalMs={props.refreshIntervalMs}
              active={props.activeProviderId() === p.id}
              expanded={props.expansion.isExpanded(
                props.sessionId,
                p.id,
                props.activeProviderId(),
              )}
              onToggle={() =>
                props.expansion.toggle(
                  props.sessionId,
                  p.id,
                  props.activeProviderId(),
                )
              }
            />
          )}
        </For>
        {layout().unconfigured.length > 0 ? (
          <box flexDirection="column" gap={0} paddingLeft={1}>
            <box
              flexDirection="row"
              gap={1}
              onMouseDown={() => setSetupOpen(!setupOpen())}
            >
              <text fg={muted()} wrapMode="none">
                {setupOpen() ? "▾" : "▸"}
              </text>
              <text fg={muted()} wrapMode="none" truncate flexShrink={1}>
                {unconfiguredSummary(layout().unconfigured)}
              </text>
            </box>
            {setupOpen() ? (
              <For each={layout().unconfigured}>
                {(p) => (
                  <text fg={muted()} wrapMode="word">
                    {`${p.label}: ${actionableHint(p.hint) ?? "configuration required"}`}
                  </text>
                )}
              </For>
            ) : null}
          </box>
        ) : null}
      </box>
    </box>
  );
}
