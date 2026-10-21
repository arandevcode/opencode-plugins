/** Shape of the entries we care about (partial). */
export interface AuthFile {
    openai?: {
        type?: string;
        access?: string;
        refresh?: string;
        expires?: number;
        accountId?: string;
    };
    codex?: {
        type?: string;
        access?: string;
        refresh?: string;
        expires?: number;
        accountId?: string;
    };
    chatgpt?: {
        type?: string;
        access?: string;
        refresh?: string;
        expires?: number;
        accountId?: string;
    };
    "github-copilot"?: {
        type?: string;
        access?: string;
        refresh?: string;
        expires?: number;
    };
    copilot?: {
        type?: string;
        access?: string;
        refresh?: string;
        expires?: number;
    };
    "opencode-go"?: {
        type?: string;
        workspaceId?: string;
        authCookie?: string;
    };
}
export declare function readAuthFile(): Promise<AuthFile | null>;
export declare function readAuthFileCached(maxAgeMs?: number): Promise<AuthFile | null>;
export declare function clearAuthCache(): void;
//# sourceMappingURL=auth.d.ts.map