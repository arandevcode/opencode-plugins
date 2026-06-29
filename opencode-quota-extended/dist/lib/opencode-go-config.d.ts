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
export declare function resolveOpenCodeGoConfig(): Promise<OpenCodeGoConfigResolution>;
export declare function resolveOpenCodeGoConfigCached(): Promise<OpenCodeGoConfigResolution>;
//# sourceMappingURL=opencode-go-config.d.ts.map