/**
 * Per-session card expansion state.
 *
 * Each session starts with only its own provider expanded (when the session
 * provider is known). Clicking a header records a manual override for that
 * session, so switching sessions restores what the user last saw there.
 */
import { createSignal } from "solid-js";
export function isExpandedFor(overrides, sessionId, providerId, activeProviderId) {
    if (!sessionId)
        return true;
    const session = overrides[sessionId];
    if (session && Object.hasOwn(session, providerId)) {
        return session[providerId] === true;
    }
    if (!activeProviderId)
        return true;
    return providerId === activeProviderId;
}
export function createExpansionState() {
    const [overrides, setOverrides] = createSignal({});
    return {
        isExpanded(sessionId, providerId, activeProviderId) {
            return isExpandedFor(overrides(), sessionId, providerId, activeProviderId);
        },
        toggle(sessionId, providerId, activeProviderId) {
            if (!sessionId)
                return;
            const next = !isExpandedFor(overrides(), sessionId, providerId, activeProviderId);
            setOverrides((prev) => ({
                ...prev,
                [sessionId]: { ...prev[sessionId], [providerId]: next },
            }));
        },
        clearSession(sessionId) {
            setOverrides((prev) => {
                if (!prev[sessionId])
                    return prev;
                const next = { ...prev };
                delete next[sessionId];
                return next;
            });
        },
    };
}
//# sourceMappingURL=expansion.js.map