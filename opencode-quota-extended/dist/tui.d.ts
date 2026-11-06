import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { type V2Context } from "./v2.js";
export declare const quotaCardsTuiPlugin: TuiPlugin;
export declare function quotaCardsTuiV2(context: V2Context): Promise<() => void>;
declare const pluginModule: TuiPluginModule & {
    id: string;
    setup?: (context: V2Context) => Promise<() => void>;
};
export default pluginModule;
//# sourceMappingURL=tui.d.ts.map