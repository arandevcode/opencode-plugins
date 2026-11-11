export type ExpansionOverrides = Record<string, Record<string, boolean>>;
export interface ExpansionState {
    isExpanded(sessionId: string, providerId: string, activeProviderId: string | undefined): boolean;
    toggle(sessionId: string, providerId: string, activeProviderId: string | undefined): void;
    clearSession(sessionId: string): void;
}
export declare function isExpandedFor(overrides: ExpansionOverrides, sessionId: string, providerId: string, activeProviderId: string | undefined): boolean;
export declare function createExpansionState(): ExpansionState;
//# sourceMappingURL=expansion.d.ts.map