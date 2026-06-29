import { createSignal } from "solid-js"
import { readFileSync, existsSync } from "node:fs"
import { TextAttributes } from "@opentui/core"
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import type { ThinkingVisualState } from "./types.js"
import { getStatePath } from "./types.js"

const RAINBOW = ["#ff0040", "#ff8000", "#ffe000", "#00ff40", "#0080ff", "#8000ff"]
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

function loadState(): ThinkingVisualState {
  try {
    const path = getStatePath()
    if (!existsSync(path)) return { a: true, b: true }
    return JSON.parse(readFileSync(path, "utf-8"))
  } catch { return { a: true, b: true } }
}

export const thinkingVisual: TuiPlugin = async (api, options) => {
  const fileState = loadState()
  const opts = (options ?? {}) as Record<string, unknown>
  const modes: ThinkingVisualState = {
    a: opts.a !== undefined ? Boolean(opts.a) : fileState.a,
    b: opts.b !== undefined ? Boolean(opts.b) : fileState.b,
  }

  const [thinking, setThinking] = createSignal(false)
  const [spinnerIdx, setSpinnerIdx] = createSignal(0)
  const [colorIdx, setColorIdx] = createSignal(0)
  let spinnerTimer: ReturnType<typeof setInterval> | null = null
  let colorTimer: ReturnType<typeof setInterval> | null = null

  const c = (offset = 0) => RAINBOW[(colorIdx() + offset) % RAINBOW.length]

  function start() {
    if (spinnerTimer) return
    spinnerTimer = setInterval(() => setSpinnerIdx(i => (i + 1) % 10), 120)
    colorTimer = setInterval(() => setColorIdx(i => (i + 1) % RAINBOW.length), 200)
  }

  function stop() {
    if (spinnerTimer) { clearInterval(spinnerTimer); spinnerTimer = null }
    if (colorTimer) { clearInterval(colorTimer); colorTimer = null }
    setSpinnerIdx(0); setColorIdx(0)
  }

  api.event.on("session.status", (event: any) => {
    const isBusy = event?.properties?.status?.type === "busy"
    setThinking(isBusy); isBusy ? start() : stop()
  })
  api.event.on("session.idle", () => { setThinking(false); stop() })

  let lastState = JSON.stringify(modes)
  setInterval(() => {
    try {
      const current = JSON.stringify(loadState())
      if (current !== lastState) { lastState = current; Object.assign(modes, JSON.parse(current)) }
    } catch { /* ignore */ }
  }, 2000)

  const active = {
    a: () => thinking() && modes.a,
    b: () => thinking() && modes.b,
  }

  api.slots.register({
    slots: {
      // A: prompt border + WORKING indicator
      session_prompt: (ctx: any, props: any) => {
        const promptHint = active.a()
          ? <text fg="yellow">{SPINNER[spinnerIdx()]}</text>
          : undefined
        const prompt = api.ui.Prompt({
          sessionID: props.session_id, visible: props.visible,
          disabled: props.disabled, onSubmit: props.on_submit,
          ref: props.ref, hint: promptHint,
        })
        if (!active.a()) return prompt
        return (
          <box>
            <box flexDirection="row" justifyContent="flex-end">
              <box borderStyle="heavy" borderColor={c(0)} paddingX={1}>
                <text fg={c(0)} attributes={TextAttributes.BOLD}>{SPINNER[spinnerIdx()]} WORKING</text>
              </box>
            </box>
            <box borderStyle="heavy" borderColor={c(0)}>
              {prompt}
            </box>
          </box>
        )
      },

      home_prompt: (ctx: any, props: any) => {
        const promptHint = active.a()
          ? <text fg="yellow">{SPINNER[spinnerIdx()]}</text>
          : undefined
        const prompt = api.ui.Prompt({ ref: props.ref, hint: promptHint })
        if (!active.a()) return prompt
        return (
          <box>
            <box flexDirection="row" justifyContent="flex-end">
              <box borderStyle="heavy" borderColor={c(0)} paddingX={1}>
                <text fg={c(0)} attributes={TextAttributes.BOLD}>{SPINNER[spinnerIdx()]} WORKING</text>
              </box>
            </box>
            <box borderStyle="heavy" borderColor={c(0)}>
              {prompt}
            </box>
          </box>
        )
      },

      // B: sidebar title border
      sidebar_title: (ctx: any, props: any) => {
        if (!active.b()) return null
        return (
          <box borderStyle="heavy" borderColor={c(0)} paddingX={1}>
            <text>{props.title}</text>
          </box>
        )
      },
    },
  })

  api.keymap.registerLayer({
    commands: [
      { id: "opencode-thinking.toggle-a", name: "Thinking Visual: Toggle Border",  category: "opencode-thinking", run: () => {} },
      { id: "opencode-thinking.toggle-b", name: "Thinking Visual: Toggle Sidebar", category: "opencode-thinking", run: () => {} },
    ],
    bindings: [],
  })

  api.event.on("tui.command.execute", (event: any) => {
    const id = event?.command ?? event?.id
    if (id === "opencode-thinking.toggle-a") { modes.a = !modes.a; api.ui.toast({ title: "Border", message: modes.a ? "on" : "off", variant: "info" }) }
    if (id === "opencode-thinking.toggle-b") { modes.b = !modes.b; api.ui.toast({ title: "Sidebar", message: modes.b ? "on" : "off", variant: "info" }) }
  })

  api.lifecycle.onDispose(() => stop())
}

const _plugin: TuiPluginModule = {
  id: "opencode-thinking (TUI)",
  tui: thinkingVisual,
};
export default _plugin
