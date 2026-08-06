export interface CardsPluginConfig {
    enabled: boolean;
    enabledProviders: Array<"openai" | "github-copilot" | "opencode-go">;
    refreshIntervalMs: number;
    requestTimeoutMs: number;
    opencodeGoTimeoutMs: number;
    showOnlyMultiWindow: boolean;
    cardsSidebar: {
        enabled: boolean;
        order: number;
    };
    opencodeGoWindows: Array<"5h" | "weekly" | "monthly">;
}
export declare const DEFAULT_CONFIG: CardsPluginConfig;
export declare const SIDECAR_FILENAME = "opencode-quota-extended.json";
//# sourceMappingURL=defaults.d.ts.map