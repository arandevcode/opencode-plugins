export function asColor(value, fallback) {
    if (typeof value === "string")
        return value;
    if (value && typeof value === "object" && typeof value.base === "string") {
        return value.base;
    }
    return fallback;
}
export function v2Theme(theme) {
    const text = theme?.text;
    return {
        text: typeof text === "string" ? text : asColor(text?.base, "#ffffff"),
        textMuted: typeof text === "object" ? asColor(text?.muted, "#888888") : asColor(theme?.textMuted, "#888888"),
        primary: asColor(theme?.primary, "#4aa3ff"),
        accent: asColor(theme?.accent, "#4aa3ff"),
        success: asColor(theme?.status?.success ?? theme?.success, "#4cc46a"),
        warning: asColor(theme?.status?.warning ?? theme?.warning, "#e6b450"),
        error: asColor(theme?.status?.danger ?? theme?.status?.error ?? theme?.error, "#e5534b"),
        backgroundPanel: asColor(theme?.background?.panel ?? theme?.backgroundPanel, "#111111"),
        backgroundElement: asColor(theme?.background?.element ?? theme?.backgroundElement, "#222222"),
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
            const render = input.slots.sidebar_content;
            if (!render || !context.ui?.slot)
                return;
            const dispose = context.ui.slot({
                append: "sidebar.content",
                render: (props) => render({}, { session_id: props.sessionID ?? "" }),
            });
            if (typeof dispose === "function")
                cleanups.push(dispose);
        },
    };
    return { theme, event, lifecycle, slots };
}
//# sourceMappingURL=v2.js.map