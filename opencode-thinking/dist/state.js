export const IDLE_STATUS = { mode: "idle", waiting: "", label: "IDLE" };
export function waitingText(tasks) {
    if (tasks <= 0)
        return "";
    return tasks === 1 ? "TASK" : `${tasks} TASKS`;
}
function statusFor(mode, waiting = "") {
    if (mode === "working")
        return { mode, waiting: "", label: "WORKING" };
    if (mode === "waiting")
        return { mode, waiting, label: waiting ? `WAITING · ${waiting}` : "WAITING" };
    return IDLE_STATUS;
}
/** Walk child -> parent. Cycles are treated as a root boundary. */
export function rootOf(sessionID, parents) {
    let current = sessionID;
    const seen = new Set();
    while (!seen.has(current)) {
        seen.add(current);
        const parent = parents.get(current);
        if (!parent)
            break;
        current = parent;
    }
    return current;
}
export function isInTree(sessionID, root, parents) {
    let current = sessionID;
    const seen = new Set();
    while (current && !seen.has(current)) {
        if (current === root)
            return true;
        seen.add(current);
        current = parents.get(current);
    }
    return false;
}
/**
 * The only place state priority is decided:
 *   1. WORKING when the focused tree has any running session (main or subagent,
 *      foreground or background, nested at any depth).
 *   2. WAITING when the tree has no running session but a background task is
 *      still alive.
 *   3. IDLE otherwise.
 * Sessions from other roots never contribute.
 */
export function computeStatus(snapshot) {
    const focus = snapshot.focus;
    if (!focus)
        return IDLE_STATUS;
    const parents = new Map();
    for (const session of snapshot.sessions)
        parents.set(session.id, session.parentID);
    const root = rootOf(focus, parents);
    if (snapshot.sessions.some(session => session.active && isInTree(session.id, root, parents))) {
        return statusFor("working");
    }
    const tasks = snapshot.tasks.filter(task => task.active && isInTree(task.sessionID, root, parents)).length;
    if (tasks > 0)
        return statusFor("waiting", waitingText(tasks));
    return IDLE_STATUS;
}
function sameStatus(a, b) {
    return a.mode === b.mode && a.waiting === b.waiting;
}
/**
 * Adds a short settle window before leaving WORKING. OpenCode can emit the
 * child's idle event a few milliseconds before the parent resumes (foreground
 * subagent) or before a completed background task wakes the session. Without
 * the window the band would flash IDLE/WAITING in that gap.
 *
 * WORKING always applies immediately; only exits are debounced. A focus change
 * applies immediately too, so switching conversations never shows a stale band.
 */
export function createThinkingState(onChange, options = {}) {
    const settleMs = options.settleMs ?? 400;
    const now = options.now ?? (() => Date.now());
    let snapshot = { sessions: [], tasks: [] };
    let current = IDLE_STATUS;
    let pending = null;
    const apply = (immediate) => {
        const target = computeStatus(snapshot);
        if (sameStatus(target, current)) {
            pending = null;
            return;
        }
        if (target.mode === "working" || immediate) {
            pending = null;
            current = target;
            onChange(target);
            return;
        }
        // Keep an existing timer for the same target; otherwise restart it.
        if (pending && sameStatus(pending.status, target))
            return;
        pending = { status: target, readyAt: now() + settleMs };
    };
    return {
        setFocus(sessionID) {
            if (snapshot.focus === sessionID)
                return;
            snapshot = { ...snapshot, focus: sessionID };
            apply(true);
        },
        setSessions(sessions) {
            snapshot = { ...snapshot, sessions };
            apply(false);
        },
        setTasks(tasks) {
            snapshot = { ...snapshot, tasks };
            apply(false);
        },
        applySnapshot(next) {
            const focusChanged = next.focus !== snapshot.focus;
            snapshot = { ...next };
            apply(focusChanged);
        },
        tick(at = now()) {
            if (pending && at >= pending.readyAt) {
                const next = pending.status;
                pending = null;
                current = next;
                onChange(next);
            }
            return current;
        },
        current: () => current,
        pending: () => pending?.status ?? null,
    };
}
