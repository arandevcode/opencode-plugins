/**
 * Per-session card expansion state.
 *
 * Each session starts with only its own provider expanded (when the session
 * provider is known). Clicking a header records a manual override for that
 * session, so switching sessions restores what the user last saw there.
 */
import { createSignal } from "solid-js";

export type ExpansionOverrides = Record<string, Record<string, boolean>>;

export interface ExpansionState {
  isExpanded(
    sessionId: string,
    providerId: string,
    activeProviderId: string | undefined,
  ): boolean;
  toggle(
    sessionId: string,
    providerId: string,
    activeProviderId: string | undefined,
  ): void;
  clearSession(sessionId: string): void;
}

export function isExpandedFor(
  overrides: ExpansionOverrides,
  sessionId: string,
  providerId: string,
  activeProviderId: string | undefined,
): boolean {
  if (!sessionId) return true;
  const session = overrides[sessionId];
  if (session && Object.hasOwn(session, providerId)) {
    return session[providerId] === true;
  }
  if (!activeProviderId) return true;
  return providerId === activeProviderId;
}

export function createExpansionState(): ExpansionState {
  const [overrides, setOverrides] = createSignal<ExpansionOverrides>({});

  return {
    isExpanded(sessionId, providerId, activeProviderId) {
      return isExpandedFor(
        overrides(),
        sessionId,
        providerId,
        activeProviderId,
      );
    },
    toggle(sessionId, providerId, activeProviderId) {
      if (!sessionId) return;
      const next = !isExpandedFor(
        overrides(),
        sessionId,
        providerId,
        activeProviderId,
      );
      setOverrides((prev) => ({
        ...prev,
        [sessionId]: { ...prev[sessionId], [providerId]: next },
      }));
    },
    clearSession(sessionId) {
      setOverrides((prev) => {
        if (!prev[sessionId]) return prev;
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    },
  };
}
