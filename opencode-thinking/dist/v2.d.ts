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
    data?: {
        listen?: (handler: (event: any) => void) => () => void;
    };
    ui?: {
        slot?: (input: {
            append?: string;
            render: (props?: any) => unknown;
        }) => () => void;
        toast?: {
            show?: (input: {
                title?: string;
                message: string;
                variant?: string;
            }) => void;
        };
    };
    keymap?: {
        layer?: (factory: () => unknown) => void;
    };
};
export declare function v2Color(value: unknown, fallback: string): string;
/** Bridge V2's context to the V1 TUI API used by `thinkingVisual`. */
export declare function createThinkingV2Api(context: V2ThinkingContext, cleanups: Array<() => void>): any;
