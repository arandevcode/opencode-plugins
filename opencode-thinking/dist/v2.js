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
    const focusedSession = () => {
        try {
            const route = context.ui?.router?.current?.();
            return route?.type === "session" ? route.sessionID : undefined;
        }
        catch {
            return undefined;
        }
    };
    const routeAvailable = typeof context.ui?.router?.current === "function";
    const emit = (type, event) => {
        if (type.startsWith("session.execution.")) {
            const sessionID = event?.data?.sessionID;
            if (routeAvailable) {
                const focused = focusedSession();
                // Only the focused session drives the indicator; subagents and other
                // sessions running in the background must not turn it on or off.
                if (!focused)
                    return;
                if (sessionID && sessionID !== focused)
                    return;
            }
        }
        handlers.get(type)?.(event);
        if (type === "session.execution.started")
            handlers.get("session.status")?.({ properties: { status: { type: "busy" } } });
        if (type === "session.execution.succeeded" ||
            type === "session.execution.failed" ||
            type === "session.execution.interrupted") {
            handlers.get("session.status")?.({ properties: { status: { type: "idle" } } });
            handlers.get("session.idle")?.({});
        }
    };
    // OpenCode 2 delivers events as `{ details: OpenCodeEvent }`, while older
    // previews passed the event itself. Accept both shapes.
    const unwrapEvent = (event) => (event && typeof event === "object" && "details" in event ? event.details : event);
    if (context.data?.listen) {
        cleanups.push(context.data.listen((event) => {
            const details = unwrapEvent(event);
            const type = String(details?.type ?? "");
            if (type)
                emit(type, details);
        }));
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
    let lastFocus;
    const syncFocus = (sessionID) => {
        if (!sessionID || sessionID === lastFocus)
            return;
        lastFocus = sessionID;
        // Querying the status lets a session that is already running light up
        // immediately when you switch to it.
        queueMicrotask(() => {
            const status = context.data?.session?.status?.(sessionID);
            if (status === "running")
                handlers.get("session.status")?.({ properties: { status: { type: "busy" } } });
            else if (status === "idle")
                handlers.get("session.status")?.({ properties: { status: { type: "idle" } } });
        });
    };
    const resetFocus = () => {
        if (lastFocus === undefined)
            return;
        lastFocus = undefined;
        queueMicrotask(() => handlers.get("session.status")?.({ properties: { status: { type: "idle" } } }));
    };
    const slots = {
        register(input) {
            // OpenCode 2 has no composer wrapper. Draw a full-width bordered bar
            // above the composer instead of the small pill.
            const bar = input.slots.prompt_bar;
            if (bar && context.ui?.slot) {
                cleanups.push(context.ui.slot({
                    append: "session.composer.top",
                    render: (props) => {
                        const sessionID = props?.sessionID;
                        if (!sessionID)
                            return null;
                        syncFocus(sessionID);
                        return bar({}, {});
                    },
                }));
            }
            const home = input.slots.home_prompt;
            if (home && context.ui?.slot) {
                cleanups.push(context.ui.slot({
                    append: "home.footer.status",
                    render: () => { resetFocus(); return home({}, {}); },
                }));
            }
            const sidebar = input.slots.sidebar_title;
            if (sidebar && context.ui?.slot) {
                cleanups.push(context.ui.slot({
                    append: "sidebar.content",
                    render: (props) => {
                        const sessionID = props?.sessionID;
                        syncFocus(sessionID);
                        let title = "";
                        try {
                            title = String(context.data?.session?.get?.(sessionID)?.title ?? "");
                        }
                        catch { /* session lookup failed */ }
                        return sidebar({}, { title: title.slice(0, 40) });
                    },
                }));
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
/**
 * Draw a border around the whole sidebar. OpenCode 2 does not publish a
 * sidebar-container slot, so this walks the host renderable tree and toggles
 * the border on the sidebar box. It is reapplied periodically in case the
 * host recreates the subtree (session switch, resize).
 */
export function decorateSidebar(context, api, cleanups) {
    let decorated = null;
    let lastColor = "";
    const findSidebar = () => {
        const root = context.renderer?.root;
        const w = context.renderer?.width ?? 0;
        const h = context.renderer?.height ?? 0;
        if (!root || !w || !h)
            return null;
        const walk = (n) => {
            if (!n)
                return null;
            const nw = Number(n.width ?? 0);
            const nh = Number(n.height ?? 0);
            if (nw > 8 && nw < w * 0.5 && nh > h * 0.5)
                return n;
            for (const child of n.getChildren?.() ?? []) {
                const found = walk(child);
                if (found)
                    return found;
            }
            return null;
        };
        return walk(root);
    };
    const remove = () => {
        if (!decorated)
            return;
        try {
            decorated.border = false;
        }
        catch { /* host node is gone */ }
        decorated = null;
        lastColor = "";
    };
    const apply = () => {
        let enabled = true;
        try {
            enabled = Boolean(api?.__thinkingSidebarEnabled?.() ?? true);
        }
        catch { /* default on */ }
        if (!enabled) {
            remove();
            return;
        }
        const node = findSidebar();
        if (!node) {
            remove();
            return;
        }
        if (decorated && decorated !== node) {
            try {
                decorated.border = false;
            }
            catch { /* old node is gone */ }
            lastColor = "";
        }
        decorated = node;
        let color = lastColor || "#4cc46a";
        try {
            color = String(api?.__thinkingPhaseColor?.() ?? color);
        }
        catch { /* keep last color */ }
        let changed = false;
        try {
            if (node.border !== true) {
                node.border = true;
                changed = true;
            }
            if (node.borderStyle !== "heavy") {
                node.borderStyle = "heavy";
                changed = true;
            }
            // Keep the frame away from the terminal edges: the last column/row is
            // often clipped, which cut the bottom-right corner of the border.
            if (node.marginRight !== 2) {
                node.marginRight = 2;
                changed = true;
            }
            if (node.marginBottom !== 1) {
                node.marginBottom = 1;
                changed = true;
            }
            if (color !== lastColor) {
                node.borderColor = color;
                lastColor = color;
                changed = true;
            }
        }
        catch { /* host node layout changed */ }
        if (changed)
            context.renderer?.requestRender?.();
    };
    apply();
    const timer = setInterval(apply, 120);
    cleanups.push(() => { clearInterval(timer); remove(); });
}
