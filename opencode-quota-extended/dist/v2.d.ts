type ColorToken = unknown;
export type V2Theme = {
    text?: {
        base?: ColorToken;
        muted?: ColorToken;
        feedback?: {
            success?: {
                base?: ColorToken;
            };
            warning?: {
                base?: ColorToken;
            };
            error?: {
                base?: ColorToken;
            };
            info?: {
                base?: ColorToken;
            };
        };
        action?: {
            primary?: {
                base?: ColorToken;
            };
        };
    } | string;
    accent?: {
        base?: ColorToken;
    } | string;
    background?: {
        raised?: {
            base?: ColorToken;
            high?: ColorToken;
        };
        overlay?: {
            base?: ColorToken;
        };
        panel?: ColorToken;
        element?: ColorToken;
    };
    status?: {
        success?: ColorToken;
        warning?: ColorToken;
        danger?: ColorToken;
        error?: ColorToken;
    };
    primary?: ColorToken;
    success?: ColorToken;
    warning?: ColorToken;
    error?: ColorToken;
    textMuted?: ColorToken;
    backgroundPanel?: ColorToken;
    backgroundElement?: ColorToken;
};
export type V2Context = {
    app?: {
        version?: string;
    };
    theme?: V2Theme;
    options?: Record<string, unknown>;
    client?: {
        credential?: {
            list?: () => Promise<unknown>;
        };
        session?: {
            get?: (input: unknown) => Promise<unknown>;
            messages?: (input: unknown) => Promise<unknown>;
            message?: {
                list?: (input: unknown) => unknown;
            };
        };
    };
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
export declare function v2Theme(theme?: V2Theme): {
    text: unknown;
    textMuted: unknown;
    primary: unknown;
    accent: unknown;
    success: unknown;
    warning: unknown;
    error: unknown;
    backgroundPanel: unknown;
    backgroundElement: unknown;
};
/**
 * Adapt a V2 CLI plugin context to the V1 TUI API the cards already use.
 * The components only read `theme.current`; events and slots are bridged so
 * the existing refresh scheduler and sidebar markup stay unchanged.
 */
export declare function createQuotaV2Api(context: V2Context, cleanups: Array<() => void>): any;
export {};
//# sourceMappingURL=v2.d.ts.map