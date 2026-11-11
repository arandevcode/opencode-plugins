import type { JSX } from "@opentui/solid";
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { ProviderQuota } from "../lib/types.js";
export declare function ProviderCards(props: {
    api: {
        theme: {
            current: TuiThemeCurrent;
        };
        app?: {
            version?: string;
        };
    };
    provider: ProviderQuota;
    showOnlyMultiWindow: boolean;
    now: () => number;
    refreshIntervalMs: number;
    active: boolean;
    expanded: boolean;
    onToggle: () => void;
}): JSX.Element;
//# sourceMappingURL=cards.d.ts.map