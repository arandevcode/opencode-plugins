import type { Plugin, PluginModule } from "@opencode-ai/plugin";
import type { ThinkingVisualState } from "./types.js";
export declare function parseArgs(args: string): ThinkingVisualState | null;
export declare const thinkingVisualCommand: Plugin;
type V2CommandContext = {
    command?: {
        transform: (callback: (editor: {
            add: (definition: Record<string, unknown>) => void;
        }) => void) => Promise<unknown>;
    };
};
/** V2 entrypoint: register the same slash command through a command transform. */
export declare function thinkingVisualV2(ctx?: V2CommandContext): Promise<void>;
declare const _plugin: PluginModule & {
    setup: typeof thinkingVisualV2;
};
export default _plugin;
