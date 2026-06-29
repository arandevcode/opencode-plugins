import { type CardsPluginConfig } from "./defaults.js";
export type LoadConfigSource = "defaults" | "cwd" | "opencode-config" | "xdg-config" | "xdg-config-fallback" | "env-override";
export interface LoadConfigResult {
    config: CardsPluginConfig;
    source: LoadConfigSource;
    path: string | null;
    error?: string;
}
export declare function loadCardsConfig(): Promise<LoadConfigResult>;
//# sourceMappingURL=loader.d.ts.map