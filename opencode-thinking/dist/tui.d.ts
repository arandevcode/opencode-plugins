import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { type V2ThinkingContext } from "./v2.js";
export declare const thinkingVisual: TuiPlugin;
export declare function thinkingVisualV2(context: V2ThinkingContext): Promise<() => void>;
declare const _plugin: TuiPluginModule & {
    id: string;
    setup?: (context: V2ThinkingContext) => Promise<() => void>;
};
export default _plugin;
