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

export const DEFAULT_CONFIG: CardsPluginConfig = {
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
