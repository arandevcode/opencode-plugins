import { jsx as _jsx, jsxs as _jsxs } from "@opentui/solid/jsx-runtime";
import { createSignal } from "solid-js";
import { readFileSync, existsSync } from "node:fs";
import { TextAttributes } from "@opentui/core";
import { getStatePath } from "./types.js";
const RAINBOW = ["#ff0040", "#ff8000", "#ffe000", "#00ff40", "#0080ff", "#8000ff"];
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
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
    let spinnerTimer = null;
    let colorTimer = null;
    const c = (offset = 0) => RAINBOW[(colorIdx() + offset) % RAINBOW.length];
    function start() {
        if (spinnerTimer)
            return;
        spinnerTimer = setInterval(() => setSpinnerIdx(i => (i + 1) % 10), 120);
        colorTimer = setInterval(() => setColorIdx(i => (i + 1) % RAINBOW.length), 200);
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
        const isBusy = event?.properties?.status?.type === "busy";
        setThinking(isBusy);
        isBusy ? start() : stop();
    });
    api.event.on("session.idle", () => { setThinking(false); stop(); });
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
    api.slots.register({
        slots: {
            // A: prompt border + WORKING indicator
            session_prompt: (ctx, props) => {
                const promptHint = active.a()
                    ? _jsx("text", { fg: "yellow", children: SPINNER[spinnerIdx()] })
                    : undefined;
                const prompt = api.ui.Prompt({
                    sessionID: props.session_id, visible: props.visible,
                    disabled: props.disabled, onSubmit: props.on_submit,
                    ref: props.ref, hint: promptHint,
                });
                if (!active.a())
                    return prompt;
                return (_jsxs("box", { children: [_jsx("box", { flexDirection: "row", justifyContent: "flex-end", children: _jsx("box", { borderStyle: "heavy", borderColor: c(0), paddingX: 1, children: _jsxs("text", { fg: c(0), attributes: TextAttributes.BOLD, children: [SPINNER[spinnerIdx()], " WORKING"] }) }) }), _jsx("box", { borderStyle: "heavy", borderColor: c(0), children: prompt })] }));
            },
            home_prompt: (ctx, props) => {
                const promptHint = active.a()
                    ? _jsx("text", { fg: "yellow", children: SPINNER[spinnerIdx()] })
                    : undefined;
                const prompt = api.ui.Prompt({ ref: props.ref, hint: promptHint });
                if (!active.a())
                    return prompt;
                return (_jsxs("box", { children: [_jsx("box", { flexDirection: "row", justifyContent: "flex-end", children: _jsx("box", { borderStyle: "heavy", borderColor: c(0), paddingX: 1, children: _jsxs("text", { fg: c(0), attributes: TextAttributes.BOLD, children: [SPINNER[spinnerIdx()], " WORKING"] }) }) }), _jsx("box", { borderStyle: "heavy", borderColor: c(0), children: prompt })] }));
            },
            // B: sidebar title border
            sidebar_title: (ctx, props) => {
                if (!active.b())
                    return null;
                return (_jsx("box", { borderStyle: "heavy", borderColor: c(0), paddingX: 1, children: _jsx("text", { children: props.title }) }));
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
    api.lifecycle.onDispose(() => stop());
};
const _plugin = {
    id: "opencode-thinking (TUI)",
    tui: thinkingVisual,
};
export default _plugin;
