export type V2Theme = {
    text?: {
        base?: string;
        muted?: string;
    } | string;
    accent?: {
        base?: string;
    } | string;
    background?: {
        panel?: string;
        element?: string;
    };
    status?: {
        success?: string;
        warning?: string;
        danger?: string;
        error?: string;
    };
    primary?: string;
    success?: string;
    warning?: string;
    error?: string;
    textMuted?: string;
    backgroundPanel?: string;
    backgroundElement?: string;
};
export type V2Context = {
    theme?: V2Theme;
    options?: Record<string, unknown>;
    data?: {
        on?: (type: string, handler: (event: unknown) => void) => () => void;
        listen?: (handler: (event: unknown) => void) => () => void;
    };
    ui?: {
        slot?: (input: {
            append?: string;
            render: (props: {
                sessionID?: string;
            }) => unknown;
        }) => () => void;
    };
};
export declare function asColor(value: unknown, fallback: string): string;
export declare function v2Theme(theme?: V2Theme): {
    text: string;
    textMuted: string;
    primary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    backgroundPanel: string;
    backgroundElement: string;
};
/**
 * Adapt a V2 CLI plugin context to the V1 TUI API the cards already use.
 * The components only read `theme.current`; events and slots are bridged so
 * the existing refresh scheduler and sidebar markup stay unchanged.
 */
export declare function createQuotaV2Api(context: V2Context, cleanups: Array<() => void>): any;
//# sourceMappingURL=v2.d.ts.map