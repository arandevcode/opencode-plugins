/** @jsxImportSource @opentui/solid */
import { For } from "solid-js";
import { TextAttributes } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { CardsPluginConfig } from "../config/defaults.js";
import type { CardsSnapshot } from "../lib/types.js";
import { ProviderCards } from "./cards.js";

export function SidebarPanel(props: {
  api: TuiPluginApi;
  config: CardsPluginConfig;
  snapshot: () => CardsSnapshot;
}): JSX.Element {
  const theme = () => props.api.theme.current;
  const titleColor = () => theme().text;

  const providerCount = () =>
    props.snapshot().providers.filter((p) => p.status === "ok").length;
  const totalCount = () => props.snapshot().providers.length;

  return (
    <box flexDirection="column" gap={0}>
      <box flexDirection="row" gap={1}>
        <text fg={titleColor()} attributes={TextAttributes.BOLD}>
          Quota  ({providerCount()}/{totalCount()})
        </text>
      </box>
      <box flexDirection="column" gap={1}>
        <For each={props.snapshot().providers}>
          {(p) => <ProviderCards api={props.api} provider={p} showOnlyMultiWindow={props.config.showOnlyMultiWindow} />}
        </For>
      </box>
    </box>
  );
}
