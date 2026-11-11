import type { JSX } from "@opentui/solid";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { CardsPluginConfig } from "../config/defaults.js";
import type { CardsSnapshot } from "../lib/types.js";
import type { ExpansionState } from "./expansion.js";
export declare function SidebarPanel(props: {
    api: TuiPluginApi;
    config: CardsPluginConfig;
    snapshot: () => CardsSnapshot;
    now: () => number;
    refreshIntervalMs: number;
    sessionId: string;
    activeProviderId: () => string | undefined;
    expansion: ExpansionState;
}): JSX.Element;
//# sourceMappingURL=SidebarPanel.d.ts.map