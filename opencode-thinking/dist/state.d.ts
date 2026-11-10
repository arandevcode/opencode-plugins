export type ThinkingMode = "working" | "waiting" | "idle";
export type SessionNode = {
    id: string;
    parentID?: string;
    active: boolean;
};
/** A background shell task. Tasks are only reported by OpenCode 2. */
export type TaskNode = {
    id: string;
    sessionID: string;
    active: boolean;
};
export type ThinkingSnapshot = {
    focus?: string;
    sessions: readonly SessionNode[];
    tasks: readonly TaskNode[];
};
export type ThinkingStatus = {
    mode: ThinkingMode;
    /** e.g. `TASK` or `2 TASKS`; empty unless mode is waiting. */
    waiting: string;
    /** Full band text: WORKING, WAITING · 2 TASKS or IDLE. */
    label: string;
};
export declare const IDLE_STATUS: ThinkingStatus;
export declare function waitingText(tasks: number): string;
/** Walk child -> parent. Cycles are treated as a root boundary. */
export declare function rootOf(sessionID: string, parents: ReadonlyMap<string, string | undefined>): string;
export declare function isInTree(sessionID: string, root: string, parents: ReadonlyMap<string, string | undefined>): boolean;
/**
 * The only place state priority is decided:
 *   1. WORKING when the focused tree has any running session (main or subagent,
 *      foreground or background, nested at any depth).
 *   2. WAITING when the tree has no running session but a background task is
 *      still alive.
 *   3. IDLE otherwise.
 * Sessions from other roots never contribute.
 */
export declare function computeStatus(snapshot: ThinkingSnapshot): ThinkingStatus;
export type ThinkingState = {
    setFocus(sessionID?: string): void;
    setSessions(sessions: readonly SessionNode[]): void;
    setTasks(tasks: readonly TaskNode[]): void;
    applySnapshot(snapshot: ThinkingSnapshot): void;
    /** Advance a debounced transition. Call regularly while the plugin is alive. */
    tick(now?: number): ThinkingStatus;
    current(): ThinkingStatus;
    pending(): ThinkingStatus | null;
};
/**
 * Adds a short settle window before leaving WORKING. OpenCode can emit the
 * child's idle event a few milliseconds before the parent resumes (foreground
 * subagent) or before a completed background task wakes the session. Without
 * the window the band would flash IDLE/WAITING in that gap.
 *
 * WORKING always applies immediately; only exits are debounced. A focus change
 * applies immediately too, so switching conversations never shows a stale band.
 */
export declare function createThinkingState(onChange: (status: ThinkingStatus) => void, options?: {
    settleMs?: number;
    now?: () => number;
}): ThinkingState;
