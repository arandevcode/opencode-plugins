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

  const estimatedHeight = () => {
    let total = 0
    for (const p of props.snapshot().providers) {
      if (p.status === "skipped") continue
      if (p.status === "no-auth" || p.status === "error") { total += 1; continue }
      const n = p.windows?.length ?? 1
      total += 4 * n + 1  // title + gap + n*3 rows + (n-1)*gaps = 4n+1
    }
    return Math.min(total, 50)
  }

  return (
    <box flexDirection="column" gap={0}>
      <box flexDirection="row" gap={1}>
        <text fg={titleColor()} attributes={TextAttributes.BOLD}>
          Quota  ({providerCount()}/{totalCount()})
        </text>
      </box>
      <scrollbox viewportCulling={true} height={estimatedHeight()} flexDirection="column" gap={1}>
        <For each={props.snapshot().providers}>
          {(p) => <ProviderCards api={props.api} provider={p} showOnlyMultiWindow={props.config.showOnlyMultiWindow} />}
        </For>
      </scrollbox>
    </box>
  );
}
