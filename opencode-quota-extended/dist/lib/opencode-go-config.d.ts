export type OpenCodeGoConfig = {
    workspaceId: string;
    authCookie: string;
};
export type OpenCodeGoConfigResolution = {
    state: "configured";
    config: OpenCodeGoConfig;
    source: string;
} | {
    state: "incomplete";
    source: string;
    missing: "workspaceId" | "authCookie";
} | {
    state: "invalid";
    source: string;
    error: string;
} | {
    state: "none";
};
/** A named OpenCode Go instance backed by an opencode-go-<suffix>.json file. */
export interface OpenCodeGoInstance {
    /** Stable id, e.g. "opencode-go-work". */
    id: string;
    /** Display label, e.g. "Opencode GO (work)". */
    label: string;
}
/** Resolve the default OpenCode Go config (env vars, then opencode-go.json). */
export declare function resolveOpenCodeGoConfig(): Promise<OpenCodeGoConfigResolution>;
/** Resolve the config for a specific instance id. */
export declare function resolveOpenCodeGoInstance(id: string): Promise<OpenCodeGoConfigResolution>;
/**
 * Discover additional OpenCode Go instances from opencode-go-<suffix>.json
 * files present in the sidecar directory. Returns stable, deduplicated
 * instance descriptors (first directory with a matching file wins).
 */
export declare function discoverOpenCodeGoInstances(): Promise<OpenCodeGoInstance[]>;
export declare function resolveOpenCodeGoConfigCached(): Promise<OpenCodeGoConfigResolution>;
export declare function resolveOpenCodeGoInstanceCached(id: string): Promise<OpenCodeGoConfigResolution>;
/** Clear all cached OpenCode Go config resolutions (used by tests). */
export declare function clearOpenCodeGoConfigCache(): void;
//# sourceMappingURL=opencode-go-config.d.ts.map