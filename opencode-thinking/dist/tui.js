import { jsx as _jsx, jsxs as _jsxs } from "@opentui/solid/jsx-runtime";
import { createSignal, ErrorBoundary } from "solid-js";
import { readFileSync, existsSync } from "node:fs";
import { TextAttributes } from "@opentui/core";
import { getStatePath } from "./types.js";
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const COLOR_CYCLE_MS = 250;
const SPINNER_TICK_MS = 120;
const RAINBOW_LENGTH = 6;
function loadState() {
    try {
        const path = getStatePath();
        if (!existsSync(path))
            return { a: true, b: true };
        return JSON.parse(readFileSync(path, "utf-8"));
    }
    catch {
        return { a: true, b: true };
    }
}
function themeSignature(t) {
    return [
        t?.text,
        t?.textMuted,
        t?.primary,
        t?.accent,
        t?.success,
        t?.warning,
        t?.error,
        t?.backgroundPanel,
        t?.backgroundElement,
    ].map(v => String(v ?? "")).join("|");
}
export const thinkingVisual = async (api, options) => {
    const fileState = loadState();
    const opts = (options ?? {});
    const modes = {
        a: opts.a !== undefined ? Boolean(opts.a) : fileState.a,
        b: opts.b !== undefined ? Boolean(opts.b) : fileState.b,
    };
    const [thinking, setThinking] = createSignal(false);
    const [spinnerIdx, setSpinnerIdx] = createSignal(0);
    const [colorIdx, setColorIdx] = createSignal(0);
    const [themeTick, setThemeTick] = createSignal(0);
    let spinnerTimer = null;
    let colorTimer = null;
    let lastThemeSignature = themeSignature(api.theme.current);
    const themeTimer = setInterval(() => {
        try {
            const next = themeSignature(api.theme.current);
            if (next !== lastThemeSignature) {
                lastThemeSignature = next;
                setThemeTick(t => t + 1);
            }
        }
        catch { /* theme poll failed */ }
    }, 250);
    let cachedTheme = null;
    function refreshTheme() {
        themeTick();
        cachedTheme = api.theme.current;
        return cachedTheme;
    }
    const FALLBACK_COLOR = "#888";
    function colorForPhase() {
        const t = cachedTheme ?? api.theme.current;
        if (!thinking())
            return t?.success ?? FALLBACK_COLOR;
        return colorIdx() % 2 === 0 ? (t?.warning ?? FALLBACK_COLOR) : (t?.error ?? FALLBACK_COLOR);
    }
    function labelForPhase() {
        return thinking() ? "WORKING" : "IDLE";
    }
    function start() {
        if (spinnerTimer)
            return;
        spinnerTimer = setInterval(() => setSpinnerIdx(i => (i + 1) % 10), SPINNER_TICK_MS);
        colorTimer = setInterval(() => setColorIdx(i => (i + 1) % RAINBOW_LENGTH), COLOR_CYCLE_MS);
    }
    function stop() {
        if (spinnerTimer) {
            clearInterval(spinnerTimer);
            spinnerTimer = null;
        }
        if (colorTimer) {
            clearInterval(colorTimer);
            colorTimer = null;
        }
        setSpinnerIdx(0);
        setColorIdx(0);
    }
    api.event.on("session.status", (event) => {
        try {
            const isBusy = event?.properties?.status?.type === "busy";
            setThinking(isBusy);
            isBusy ? start() : stop();
        }
        catch { /* session.status handler failed */ }
    });
    api.event.on("session.idle", () => {
        try {
            setThinking(false);
            stop();
        }
        catch { /* session.idle handler failed */ }
    });
    let lastState = JSON.stringify(modes);
    setInterval(() => {
        try {
            const current = JSON.stringify(loadState());
            if (current !== lastState) {
                lastState = current;
                Object.assign(modes, JSON.parse(current));
            }
        }
        catch { /* ignore */ }
    }, 2000);
    const active = {
        a: () => thinking() && modes.a,
        b: () => thinking() && modes.b,
    };
    const idleActive = (slot) => !thinking() && modes[slot];
    api.slots.register({
        slots: {
            // A: prompt border + WORKING/IDLE indicator
            session_prompt: (ctx, props) => {
                const t = refreshTheme();
                const color = colorForPhase();
                const label = labelForPhase();
                const showBusy = active.a();
                const showIdle = idleActive("a");
                const promptHint = showBusy
                    ? _jsx("text", { fg: t?.warning ?? FALLBACK_COLOR, children: SPINNER[spinnerIdx()] })
                    : undefined;
                const prompt = api.ui.Prompt({
                    sessionID: props.session_id, visible: props.visible,
                    disabled: props.disabled, onSubmit: props.on_submit,
                    ref: props.ref, hint: promptHint,
                });
                if (!showBusy && !showIdle)
                    return prompt;
                return (_jsx(ErrorBoundary, { fallback: _jsx("text", { children: "\u26A0" }), children: _jsxs("box", { children: [_jsx("box", { flexDirection: "row", justifyContent: "flex-end", children: _jsx("box", { borderStyle: "heavy", borderColor: color, paddingX: 1, children: _jsxs("text", { fg: color, attributes: TextAttributes.BOLD, children: [SPINNER[spinnerIdx()], " ", label] }) }) }), _jsx("box", { borderStyle: "heavy", borderColor: color, children: prompt })] }) }));
            },
            home_prompt: (ctx, props) => {
                const t = refreshTheme();
                const color = colorForPhase();
                const label = labelForPhase();
                const showBusy = active.a();
                const showIdle = idleActive("a");
                const promptHint = showBusy
                    ? _jsx("text", { fg: t?.warning ?? FALLBACK_COLOR, children: SPINNER[spinnerIdx()] })
                    : undefined;
                const prompt = api.ui.Prompt({ ref: props.ref, hint: promptHint });
                if (!showBusy && !showIdle)
                    return prompt;
                return (_jsx(ErrorBoundary, { fallback: _jsx("text", { children: "\u26A0" }), children: _jsxs("box", { children: [_jsx("box", { flexDirection: "row", justifyContent: "flex-end", children: _jsx("box", { borderStyle: "heavy", borderColor: color, paddingX: 1, children: _jsxs("text", { fg: color, attributes: TextAttributes.BOLD, children: [SPINNER[spinnerIdx()], " ", label] }) }) }), _jsx("box", { borderStyle: "heavy", borderColor: color, children: prompt })] }) }));
            },
            // B: sidebar title border
            sidebar_title: (ctx, props) => {
                if (!active.b() && !idleActive("b"))
                    return null;
                const color = colorForPhase();
                return (_jsx(ErrorBoundary, { fallback: _jsx("text", { children: "\u26A0" }), children: _jsx("box", { borderStyle: "heavy", borderColor: color, paddingX: 1, children: _jsx("text", { children: props.title }) }) }));
            },
        },
    });
    api.keymap.registerLayer({
        commands: [
            { id: "opencode-thinking.toggle-a", name: "Thinking Visual: Toggle Border", category: "opencode-thinking", run: () => { } },
            { id: "opencode-thinking.toggle-b", name: "Thinking Visual: Toggle Sidebar", category: "opencode-thinking", run: () => { } },
        ],
        bindings: [],
    });
    api.event.on("tui.command.execute", (event) => {
        const id = event?.command ?? event?.id;
        if (id === "opencode-thinking.toggle-a") {
            modes.a = !modes.a;
            api.ui.toast({ title: "Border", message: modes.a ? "on" : "off", variant: "info" });
        }
        if (id === "opencode-thinking.toggle-b") {
            modes.b = !modes.b;
            api.ui.toast({ title: "Sidebar", message: modes.b ? "on" : "off", variant: "info" });
        }
    });
    api.lifecycle.onDispose(() => {
        stop();
        clearInterval(themeTimer);
    });
};
const _plugin = {
    id: "opencode-thinking (TUI)",
    tui: thinkingVisual,
};
export default _plugin;
