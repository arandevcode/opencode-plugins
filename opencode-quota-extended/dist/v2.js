import { providerIdFromMessages, providerIdFromSessionResponse, sessionMessagesFromResponse, } from "./lib/session-provider.js";
/**
 * Return a value accepted by OpenTUI's `fg`/`borderColor` props.
 *
 * V2 theme tokens are RGBA objects nested under `.base`; v1-style callers and
 * tests may pass plain strings or flat token names. Preserve the RGBA object
 * rather than stringifying it so terminal themes keep their exact colors.
 */
function tokenColor(value, fallback) {
    if (typeof value === "string")
        return value;
    if (!value || typeof value !== "object")
        return fallback;
    const record = value;
    const base = record.base;
    if (typeof base === "string")
        return base;
    if (base && typeof base === "object")
        return base;
    if (typeof record.toInts === "function" || ("r" in record && "g" in record && "b" in record)) {
        return value;
    }
    return fallback;
}
export function v2Theme(theme) {
    const t = (theme ?? {});
    const text = t.text;
    const feedback = text?.feedback;
    const action = text?.action;
    const background = t.background;
    return {
        text: tokenColor(typeof text === "string" ? text : text?.base, "#ffffff"),
        textMuted: tokenColor(typeof text === "object" ? text?.muted : t.textMuted, "#888888"),
        primary: tokenColor(action?.primary?.base ?? t.primary, "#4aa3ff"),
        accent: tokenColor(action?.primary?.base ?? t.accent, "#4aa3ff"),
        success: tokenColor(feedback?.success?.base ?? t.status?.success ?? t.success, "#4cc46a"),
        warning: tokenColor(feedback?.warning?.base ?? t.status?.warning ?? t.warning, "#e6b450"),
        error: tokenColor(feedback?.error?.base ?? t.status?.danger ?? t.status?.error ?? t.error, "#e5534b"),
        backgroundPanel: tokenColor(background?.raised?.base ?? background?.panel ?? t.backgroundPanel, "#111111"),
        backgroundElement: tokenColor(background?.overlay?.base ??
            background?.raised?.high ??
            background?.element ??
            t.backgroundElement, "#222222"),
    };
}
/**
 * Adapt a V2 CLI plugin context to the V1 TUI API the cards already use.
 * The components only read `theme.current`; events and slots are bridged so
 * the existing refresh scheduler and sidebar markup stay unchanged.
 */
export function createQuotaV2Api(context, cleanups) {
    const currentTheme = v2Theme(context.theme);
    const theme = { current: currentTheme };
    Object.defineProperty(theme, "current", { get: () => v2Theme(context.theme) });
    const app = { version: context.app?.version ?? "" };
    const sessionClient = context.client?.session;
    const rawGet = sessionClient?.get;
    const rawMessages = sessionClient?.messages;
    const rawList = sessionClient?.message?.list;
    const sessionMessages = typeof rawMessages === "function" || typeof rawList === "function"
        ? async (sessionID) => {
            const tryCall = async (fn, thisArg, input) => {
                try {
                    return await fn.call(thisArg, input);
                }
                catch {
                    return undefined;
                }
            };
            if (typeof rawMessages === "function") {
                // OpenCode 2 SDK shape: ordered, limited transcript.
                const v2 = sessionMessagesFromResponse(await tryCall(rawMessages, sessionClient, {
                    sessionID,
                    limit: 20,
                    order: "desc",
                }));
                if (v2)
                    return v2;
                // Older SDK shape still used by some hosts.
                const legacy = sessionMessagesFromResponse(await tryCall(rawMessages, sessionClient, {
                    path: { id: sessionID },
                    query: { limit: 20 },
                }));
                if (legacy)
                    return legacy;
            }
            if (typeof rawList === "function") {
                // In-process OpenCode 2 client: session.message.list(...)
                for (const input of [sessionID, { sessionID }]) {
                    const messages = sessionMessagesFromResponse(await tryCall(rawList, sessionClient?.message, input));
                    if (messages)
                        return messages;
                }
            }
            return undefined;
        }
        : undefined;
    const sessionProvider = async (sessionID) => {
        // Prefer the session record: it carries the selected model directly and
        // does not depend on transcript ordering or projection details.
        if (typeof rawGet === "function") {
            for (const input of [{ sessionID }, sessionID]) {
                try {
                    const providerId = providerIdFromSessionResponse(await rawGet.call(sessionClient, input));
                    if (providerId)
                        return providerId;
                }
                catch {
                    // Try the next call shape.
                }
            }
        }
        if (sessionMessages) {
            const messages = await sessionMessages(sessionID);
            return providerIdFromMessages(messages, true);
        }
        return undefined;
    };
    const event = {
        on(_type, handler) {
            const unsubscribe = context.data?.on?.("session.execution.started", handler)
                ?? context.data?.on?.("session.updated", handler)
                ?? (() => { });
            if (context.data?.listen) {
                const stop = context.data.listen(handler);
                cleanups.push(stop);
            }
            cleanups.push(unsubscribe);
            return () => {
                unsubscribe();
            };
        },
    };
    const lifecycle = {
        onDispose(fn) {
            cleanups.push(fn);
        },
    };
    const slots = {
        register(input) {
            const register = (render, append) => {
                if (!render || !context.ui?.slot)
                    return;
                const dispose = context.ui.slot({
                    append,
                    render: (props) => render({}, { session_id: props.sessionID ?? "" }),
                });
                if (typeof dispose === "function")
                    cleanups.push(dispose);
            };
            register(input.slots.sidebar_content, "sidebar.content");
            register(input.slots.sidebar_footer, "sidebar.footer");
        },
    };
    return {
        app,
        theme,
        event,
        lifecycle,
        slots,
        sessionMessages,
        sessionProvider,
    };
}
//# sourceMappingURL=v2.js.map