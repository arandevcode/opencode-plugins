import { type SessionNode, type TaskNode } from "./state.js";
export type V2ThemeLike = {
    text?: {
        base?: string;
        muted?: string;
    } | string;
    accent?: {
        base?: string;
    } | string;
    status?: {
        success?: string;
        warning?: string;
        danger?: string;
    };
    success?: string;
    warning?: string;
    error?: string;
    textMuted?: string;
};
export type V2ThinkingContext = {
    theme?: V2ThemeLike;
    options?: Record<string, unknown>;
    location?: unknown;
    data?: {
        listen?: (handler: (event: any) => void) => () => void;
        location?: {
            default?: () => unknown;
        };
        session?: {
            status?: (sessionID: string) => "idle" | "running";
            list?: () => any[];
            get?: (sessionID: string) => any;
            family?: (sessionID: string) => string[];
            sync?: (sessionID: string, options?: {
                children?: boolean;
            }) => Promise<void>;
        };
        shell?: {
            list?: (location?: unknown) => any[];
        };
    };
    renderer?: {
        root?: any;
        width?: number;
        height?: number;
        requestRender?: () => void;
    };
    ui?: {
        slot?: (input: {
            append?: string;
            prepend?: string;
            before?: string;
            after?: string;
            replace?: string;
            render: (props?: any) => unknown;
        }) => () => void;
        toast?: {
            show?: (input: {
                title?: string;
                message: string;
                variant?: string;
            }) => void;
        };
        router?: {
            current?: () => {
                type?: string;
                sessionID?: string;
            };
        };
    };
    keymap?: {
        layer?: (factory: () => unknown) => void;
    };
};
export declare function v2Color(value: unknown, fallback: string): string;
/** Bridge V2's context to the V1 TUI API used by `thinkingVisual`. */
export declare function createThinkingV2Api(context: V2ThinkingContext, cleanups: Array<() => void>): any;
export type V2Snapshot = {
    sessions: SessionNode[];
    tasks: TaskNode[];
};
/**
 * Read OpenCode 2's reactive stores into a flat snapshot. Only the focused
 * session's tree is returned; other conversations can be running at the same
 * time and must not affect this band.
 */
export declare function collectV2Snapshot(context: V2ThinkingContext, focus: string | undefined): V2Snapshot;
/**
 * Push a V2 store snapshot into the shared state machine. Polling catches
 * changes made by host syncs; the event listener makes WORKING immediate.
 */
export declare function startV2Pump(context: V2ThinkingContext, api: any, cleanups: Array<() => void>): void;
/**
 * Draw a border around the whole sidebar. OpenCode 2 does not publish a
 * sidebar-container slot, so this walks the host renderable tree and toggles
 * the border on the sidebar box. The sidebar is the tall pane anchored to the
 * right edge; looking at the right edge (instead of a width fraction) keeps it
 * working at every terminal size. It is reapplied periodically in case the
 * host recreates the subtree (session switch, resize).
 */
export declare function decorateSidebar(context: V2ThinkingContext, api: any, cleanups: Array<() => void>): void;
