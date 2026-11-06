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
/**
 * OpenCode 2 credential entry as returned by `client.credential.list()`
 * (only the fields we read; secrets are never logged).
 */
export interface V2CredentialEntry {
    integrationID?: string;
    active?: boolean;
    value?: {
        type?: string;
        access?: string;
        key?: string;
        expires?: number;
        metadata?: Record<string, unknown>;
    };
}
type V2Loader = () => Promise<readonly V2CredentialEntry[] | undefined | null>;
/** Register (or clear with null) the OpenCode 2 credential loader. Only the V2 path calls this. */
export declare function setV2CredentialLoader(loader: V2Loader | null): void;
/** Map OpenCode 2 credentials onto the AuthFile shape the providers already read. */
export declare function mapV2Credentials(entries: readonly V2CredentialEntry[]): AuthFile;
/**
 * Where an auth entry came from, for user-facing messages.
 * Returns "" outside OpenCode 2 (V1 behaviour and messages stay unchanged).
 */
export declare function describeAuthSource(entry: object | null | undefined): string;
/**
 * Read credentials. Inside OpenCode 2 the host's own credentials win; the
 * OpenCode 1.x auth.json is only a per-provider fallback.
 */
export declare function readAuthFile(): Promise<AuthFile | null>;
export declare function readAuthFileCached(maxAgeMs?: number): Promise<AuthFile | null>;
export declare function clearAuthCache(): void;
export {};
//# sourceMappingURL=auth.d.ts.map