export function v2Color(value, fallback) {
    if (typeof value === "string")
        return value;
    if (value && typeof value === "object" && typeof value.base === "string") {
        return value.base;
    }
    return fallback;
}
function v2Theme(theme) {
    const text = theme?.text;
    return {
        text: typeof text === "string" ? text : v2Color(text?.base, "#ffffff"),
        textMuted: typeof text === "object" ? v2Color(text?.muted, "#888888") : v2Color(theme?.textMuted, "#888888"),
        primary: v2Color(theme?.accent, "#4aa3ff"),
        accent: v2Color(theme?.accent, "#4aa3ff"),
        success: v2Color(theme?.status?.success ?? theme?.success, "#4cc46a"),
        warning: v2Color(theme?.status?.warning ?? theme?.warning, "#e6b450"),
        error: v2Color(theme?.status?.danger ?? theme?.error, "#e5534b"),
        backgroundPanel: "#111111",
        backgroundElement: "#222222",
    };
}
/** Bridge V2's context to the V1 TUI API used by `thinkingVisual`. */
export function createThinkingV2Api(context, cleanups) {
    const theme = { current: v2Theme(context.theme) };
    Object.defineProperty(theme, "current", { get: () => v2Theme(context.theme) });
    const handlers = new Map();
    const emit = (type, event) => {
        handlers.get(type)?.(event);
        if (type === "session.execution.started")
            handlers.get("session.status")?.({ properties: { status: { type: "busy" } } });
        if (type === "session.execution.succeeded" || type === "session.execution.failed") {
            handlers.get("session.status")?.({ properties: { status: { type: "idle" } } });
            handlers.get("session.idle")?.({});
        }
    };
    if (context.data?.listen) {
        cleanups.push(context.data.listen((event) => emit(String(event?.type ?? ""), event)));
    }
    const event = {
        on(type, handler) {
            handlers.set(type, handler);
            return () => handlers.delete(type);
        },
    };
    const ui = {
        Prompt: () => null,
        toast(input) {
            context.ui?.toast?.show?.(input);
        },
        dialog: {},
    };
    const lifecycle = { onDispose(fn) { cleanups.push(fn); } };
    const slots = {
        register(input) {
            const prompt = input.slots.session_prompt;
            if (prompt && context.ui?.slot) {
                cleanups.push(context.ui.slot({ append: "session.composer.top", render: (props) => prompt({}, { session_id: props?.sessionID, title: "" }) }));
            }
            const home = input.slots.home_prompt;
            if (home && context.ui?.slot) {
                cleanups.push(context.ui.slot({ append: "home.footer.status", render: () => home({}, {}) }));
            }
            const sidebar = input.slots.sidebar_title;
            if (sidebar && context.ui?.slot) {
                cleanups.push(context.ui.slot({ append: "sidebar.content", render: () => sidebar({}, { title: "Thinking" }) }));
            }
        },
    };
    const keymap = {
        registerLayer(input) {
            context.keymap?.layer?.(() => ({
                mode: "global",
                commands: (input?.commands ?? []).map((command) => ({
                    id: command.id,
                    title: command.name ?? command.id,
                    group: command.category,
                    run: command.run,
                })),
                bindings: [],
            }));
        },
    };
    return { theme, event, ui, lifecycle, slots, keymap };
}
