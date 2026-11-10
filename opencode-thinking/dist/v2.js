import { rootOf } from "./state.js";
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
function executionSessionID(event) {
    return String(event?.data?.sessionID ?? event?.properties?.sessionID ?? "");
}
/** Bridge V2's context to the V1 TUI API used by `thinkingVisual`. */
export function createThinkingV2Api(context, cleanups) {
    const theme = { current: v2Theme(context.theme) };
    Object.defineProperty(theme, "current", { get: () => v2Theme(context.theme) });
    const handlers = new Map();
    let api;
    const emit = (type, event) => {
        if (type.startsWith("session.")) {
            try {
                api?.__thinkingPumpNow?.();
            }
            catch { /* pump unavailable */ }
        }
        if (type === "session.created" || type === "session.updated") {
            const data = event?.data ?? event?.properties ?? {};
            handlers.get(type)?.({ properties: { info: { ...data, id: data.id ?? data.sessionID, parentID: data.parentID } } });
            return;
        }
        if (type === "session.deleted") {
            const data = event?.data ?? event?.properties ?? {};
            handlers.get("session.deleted")?.({ properties: { sessionID: data.sessionID ?? data.id } });
            return;
        }
        handlers.get(type)?.(event);
        if (type === "session.execution.started") {
            handlers.get("session.status")?.({
                properties: { sessionID: executionSessionID(event), status: { type: "busy" } },
            });
        }
        if (type === "session.execution.succeeded" ||
            type === "session.execution.failed" ||
            type === "session.execution.interrupted") {
            const sessionID = executionSessionID(event);
            handlers.get("session.status")?.({ properties: { sessionID, status: { type: "idle" } } });
            handlers.get("session.idle")?.({ properties: { sessionID } });
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
                        if (sessionID)
                            api?.__thinkingSetFocus?.(sessionID);
                        try {
                            api?.__thinkingPumpNow?.();
                        }
                        catch { /* pump unavailable */ }
                        return bar({}, {});
                    },
                }));
            }
            const home = input.slots.home_prompt;
            if (home && context.ui?.slot) {
                cleanups.push(context.ui.slot({
                    append: "home.footer.status",
                    render: () => {
                        api?.__thinkingSetFocus?.(undefined);
                        try {
                            api?.__thinkingPumpNow?.();
                        }
                        catch { /* pump unavailable */ }
                        return home({}, {});
                    },
                }));
            }
            const sidebar = input.slots.sidebar_title;
            if (sidebar && context.ui?.slot) {
                cleanups.push(context.ui.slot({
                    before: "sidebar.footer",
                    render: (props) => {
                        const sessionID = props?.sessionID;
                        if (sessionID)
                            api?.__thinkingSetFocus?.(sessionID);
                        try {
                            api?.__thinkingPumpNow?.();
                        }
                        catch { /* pump unavailable */ }
                        return sidebar({}, {});
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
    api = { theme, event, ui, lifecycle, slots, keymap, __thinkingBridge: true };
    return api;
}
/**
 * Read OpenCode 2's reactive stores into a flat snapshot. Only the focused
 * session's tree is returned; other conversations can be running at the same
 * time and must not affect this band.
 */
export function collectV2Snapshot(context, focus) {
    if (!focus)
        return { sessions: [], tasks: [] };
    try {
        const data = context.data;
        const list = data?.session?.list?.() ?? [];
        const byID = new Map();
        const add = (id) => {
            if (!id || byID.has(id))
                return;
            let info;
            try {
                info = data?.session?.get?.(id);
            }
            catch { /* session not loaded */ }
            if (info?.id)
                byID.set(String(info.id), info);
        };
        for (const session of list) {
            if (session?.id)
                byID.set(String(session.id), session);
        }
        add(focus);
        try {
            for (const id of data?.session?.family?.(focus) ?? [])
                add(String(id));
        }
        catch { /* family unavailable */ }
        // Include ancestors, which may not be in family() yet.
        let current = focus;
        const seen = new Set();
        while (current && !seen.has(current)) {
            seen.add(current);
            add(current);
            const info = byID.get(current);
            const parentID = info?.parentID ? String(info.parentID) : undefined;
            if (!parentID)
                break;
            add(String(parentID));
            current = String(parentID);
        }
        const parents = new Map();
        for (const [id, info] of byID) {
            parents.set(id, info?.parentID ? String(info.parentID) : undefined);
        }
        const root = rootOf(focus, parents);
        const ids = [...byID.keys()].filter(id => rootOf(id, parents) === root);
        if (!ids.includes(focus))
            ids.push(focus);
        const sessions = ids.map(id => ({
            id,
            parentID: parents.get(id),
            active: data?.session?.status?.(id) === "running",
        }));
        // Shells are scoped by location. Use the focused session's location, not
        // the host process default: sessions can live in another directory.
        const focusInfo = byID.get(focus);
        const location = focusInfo?.location ?? context.location ?? data?.location?.default?.();
        const shells = data?.shell?.list?.(location) ?? [];
        const inTree = new Set(ids);
        const tasks = [];
        for (const shell of shells) {
            const metadata = shell?.metadata ?? {};
            const sessionID = String(metadata.sessionID ?? shell?.sessionID ?? "");
            // Every shell still alive after the turn is pending work. A foreground
            // shell can only survive while its session is running, and WORKING wins.
            if (!inTree.has(sessionID))
                continue;
            if (shell?.status !== undefined && shell.status !== "running")
                continue;
            if (!shell?.id)
                continue;
            tasks.push({ id: String(shell.id), sessionID, active: true });
        }
        return { sessions, tasks };
    }
    catch {
        return { sessions: [], tasks: [] };
    }
}
/**
 * Push a V2 store snapshot into the shared state machine. Polling catches
 * changes made by host syncs; the event listener makes WORKING immediate.
 */
export function startV2Pump(context, api, cleanups) {
    let stopped = false;
    let lastFocus;
    let syncedFocus;
    const routeAvailable = typeof context.ui?.router?.current === "function";
    const readFocus = () => {
        if (routeAvailable) {
            try {
                const route = context.ui?.router?.current?.();
                return route?.type === "session" ? route.sessionID : undefined;
            }
            catch {
                return undefined;
            }
        }
        try {
            return api?.__thinkingGetFocus?.();
        }
        catch {
            return undefined;
        }
    };
    const pump = () => {
        if (stopped)
            return;
        try {
            const focus = readFocus();
            const snapshot = collectV2Snapshot(context, focus);
            api?.__thinkingSetSessions?.(snapshot.sessions);
            api?.__thinkingSetTasks?.(snapshot.tasks);
            if (routeAvailable && focus !== lastFocus) {
                lastFocus = focus;
                api?.__thinkingSetFocus?.(focus);
            }
            if (focus && focus !== syncedFocus) {
                syncedFocus = focus;
                try {
                    void context.data?.session?.sync?.(focus, { children: true });
                }
                catch { /* sync best effort */ }
            }
        }
        catch { /* never break the host */ }
    };
    api.__thinkingPumpNow = pump;
    const timer = setInterval(pump, 250);
    cleanups.push(() => {
        stopped = true;
        clearInterval(timer);
        if (api.__thinkingPumpNow === pump)
            delete api.__thinkingPumpNow;
    });
    pump();
}
/**
 * Draw a border around the whole sidebar. OpenCode 2 does not publish a
 * sidebar-container slot, so this walks the host renderable tree and toggles
 * the border on the sidebar box. The sidebar is the tall pane anchored to the
 * right edge; looking at the right edge (instead of a width fraction) keeps it
 * working at every terminal size. It is reapplied periodically in case the
 * host recreates the subtree (session switch, resize).
 */
export function decorateSidebar(context, api, cleanups) {
    let decorated = null;
    let lastColor = "";
    let baseWidth = 0;
    const findSidebar = () => {
        const root = context.renderer?.root;
        const w = context.renderer?.width ?? 0;
        const h = context.renderer?.height ?? 0;
        if (!root || !w || !h)
            return null;
        let found = null;
        let foundDepth = Infinity;
        const walk = (n, depth = 0) => {
            if (!n)
                return;
            const nw = Number(n.width ?? 0);
            const nh = Number(n.height ?? 0);
            const nx = Number(n.x ?? 0);
            if (nw >= 12 &&
                nw <= w * 0.6 &&
                nx > 0 &&
                nx + nw >= w - 2 &&
                nh > h * 0.6 &&
                depth < foundDepth) {
                found = n;
                foundDepth = depth;
            }
            for (const child of n.getChildren?.() ?? [])
                walk(child, depth + 1);
        };
        walk(root);
        return found;
    };
    const undecorate = () => {
        if (decorated) {
            try {
                decorated.border = false;
                if (baseWidth)
                    decorated.width = baseWidth;
            }
            catch { /* host node is gone */ }
        }
        decorated = null;
        lastColor = "";
        baseWidth = 0;
    };
    const apply = () => {
        let enabled = true;
        try {
            enabled = Boolean(api?.__thinkingSidebarEnabled?.() ?? true);
        }
        catch { /* default on */ }
        if (!enabled) {
            undecorate();
            return;
        }
        const node = findSidebar();
        // A narrow terminal hides the sidebar. Keep any previous decoration
        // instead of tearing it down on every transient layout pass; that was the
        // source of the border flicker.
        if (!node)
            return;
        if (decorated && decorated !== node)
            undecorate();
        decorated = node;
        const width = Number(node.width ?? 0);
        if (width >= 12 &&
            width !== baseWidth &&
            width !== baseWidth + 2) {
            baseWidth = width;
        }
        if (!baseWidth)
            baseWidth = width;
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
            // The border consumes two columns from the host's sidebar. Widen the
            // box by the same amount so its content keeps its original width.
            const targetWidth = baseWidth + 2;
            if (targetWidth && node.width !== targetWidth) {
                node.width = targetWidth;
                changed = true;
            }
            if (node.marginRight !== 2) {
                node.marginRight = 2;
                changed = true;
            }
            if (node.marginBottom !== 0) {
                node.marginBottom = 0;
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
    cleanups.push(() => { clearInterval(timer); undecorate(); });
}
