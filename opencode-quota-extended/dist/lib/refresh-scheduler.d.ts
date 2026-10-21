export type RefreshSchedulerOptions = {
    refresh: () => void;
    intervalMs: number;
    activityDelayMs?: number;
    minGapMs?: number;
    now?: () => number;
};
export type RefreshScheduler = {
    start: () => void;
    schedule: (delay?: number, force?: boolean) => void;
    dispose: () => void;
};
/**
 * Coalesces bursts of usage events into a single refresh and enforces a
 * minimum gap between attempts. A streaming message can emit many
 * `message.updated` events per second; without this every one of them would
 * fan out to the provider APIs.
 */
export declare function createRefreshScheduler(options: RefreshSchedulerOptions): RefreshScheduler;
//# sourceMappingURL=refresh-scheduler.d.ts.map