export const DEFAULT_CONFIG = {
    enabled: true,
    enabledProviders: ["openai", "github-copilot", "opencode-go"],
    refreshIntervalMs: 60_000,
    requestTimeoutMs: 8_000,
    opencodeGoTimeoutMs: 10_000,
    showOnlyMultiWindow: false,
    cardsSidebar: {
        enabled: true,
        order: 145,
    },
    opencodeGoWindows: ["5h", "weekly", "monthly"],
};
export const SIDECAR_FILENAME = "opencode-quota-extended.json";
//# sourceMappingURL=defaults.js.map