/** @jsxImportSource @opentui/solid */
import { createSignal, ErrorBoundary, untrack } from "solid-js"
import { readFileSync, existsSync } from "node:fs"
import { TextAttributes } from "@opentui/core"
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import type { ThinkingVisualState } from "./types.js"
import { getStatePath } from "./types.js"
import { createThinkingV2Api, type V2ThinkingContext } from "./v2.js"

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const COLOR_CYCLE_MS = 250
const SPINNER_TICK_MS = 120
const RAINBOW_LENGTH = 6

function loadState(): ThinkingVisualState {
  try {
    const path = getStatePath()
    if (!existsSync(path)) return { a: true, b: true }
    return JSON.parse(readFileSync(path, "utf-8"))
  } catch { return { a: true, b: true } }
}

function themeSignature(t: any): string {
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
  ].map(v => String(v ?? "")).join("|")
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
  const [themeTick, setThemeTick] = createSignal(0)
  let spinnerTimer: ReturnType<typeof setInterval> | null = null
  let colorTimer: ReturnType<typeof setInterval> | null = null

  let lastThemeSignature = themeSignature(api.theme.current)
  const themeTimer = setInterval(() => {
    try {
      const next = themeSignature(api.theme.current)
      if (next !== lastThemeSignature) {
        lastThemeSignature = next
        setThemeTick(t => t + 1)
      }
    } catch { /* theme poll failed */ }
  }, 250)

  let cachedTheme: any = null
  function refreshTheme() {
    themeTick()
    cachedTheme = api.theme.current
    return cachedTheme
  }

  const FALLBACK_COLOR = "#888"
  function colorForPhase() {
    const t = cachedTheme ?? api.theme.current
    if (!thinking()) return t?.success ?? FALLBACK_COLOR
    return colorIdx() % 2 === 0 ? (t?.warning ?? FALLBACK_COLOR) : (t?.error ?? FALLBACK_COLOR)
  }

  function labelForPhase() {
    return thinking() ? "WORKING" : "IDLE"
  }

  function start() {
    if (spinnerTimer) return
    spinnerTimer = setInterval(() => setSpinnerIdx(i => (i + 1) % 10), SPINNER_TICK_MS)
    colorTimer = setInterval(() => setColorIdx(i => (i + 1) % RAINBOW_LENGTH), COLOR_CYCLE_MS)
  }

  function stop() {
    if (spinnerTimer) { clearInterval(spinnerTimer); spinnerTimer = null }
    if (colorTimer) { clearInterval(colorTimer); colorTimer = null }
    setSpinnerIdx(0); setColorIdx(0)
  }

  api.event.on("session.status", (event: any) => {
    try {
      const isBusy = event?.properties?.status?.type === "busy"
      setThinking(isBusy); isBusy ? start() : stop()
    } catch { /* session.status handler failed */ }
  })
  api.event.on("session.idle", () => {
    try { setThinking(false); stop() } catch { /* session.idle handler failed */ }
  })

  let lastState = JSON.stringify(modes)
  const stateTimer = setInterval(() => {
    try {
      const current = JSON.stringify(loadState())
      if (current !== lastState) { lastState = current; Object.assign(modes, JSON.parse(current)) }
    } catch { /* ignore */ }
  }, 2000)

  const active = {
    a: () => thinking() && modes.a,
    b: () => thinking() && modes.b,
  }

  const idleActive = (slot: "a" | "b") => !thinking() && modes[slot]

  const showA = () => active.a() || idleActive("a")

  // Stable (created once) hint: only its text content is reactive.
  function busyHint() {
    return <text fg={refreshTheme()?.warning ?? FALLBACK_COLOR}>{active.a() ? SPINNER[spinnerIdx()] : ""}</text>
  }

  // Constant element structure: toggling busy/idle only changes props, so the
  // wrapped prompt is never unmounted.
  function wrapPrompt(prompt: any) {
    return (
      <ErrorBoundary fallback={<text>⚠</text>}>
        <box>
          <box flexDirection="row" justifyContent="flex-end" height={showA() ? undefined : 0} overflow="hidden">
            <box borderStyle="heavy" borderColor={(refreshTheme(), colorForPhase())} paddingX={1}>
              <text fg={colorForPhase()} attributes={TextAttributes.BOLD}>{SPINNER[spinnerIdx()]} {labelForPhase()}</text>
            </box>
          </box>
          {prompt
            ? <box border={showA()} borderStyle="heavy" borderColor={colorForPhase()}>
                {prompt}
              </box>
            : null}
        </box>
      </ErrorBoundary>
    )
  }

  api.slots.register({
    slots: {
      // A: prompt border + WORKING/IDLE indicator.
      // IMPORTANT: the slot function must NOT read signals at its top level.
      // Slots are re-run when a tracked signal changes; the spinner/color
      // signals tick every 120-250ms, which re-created api.ui.Prompt each time.
      // That remounted the prompt, resetting its focus and the "esc again to
      // interrupt" counter, so Esc never interrupted a running session.
      // The prompt is built once (untracked) and only the wrapper is reactive.
      session_prompt: (ctx: any, props: any) => untrack(() => {
        const prompt = api.ui.Prompt({
          sessionID: props.session_id, visible: props.visible,
          disabled: props.disabled, onSubmit: props.on_submit,
          ref: props.ref, hint: busyHint(),
        })
        return wrapPrompt(prompt)
      }),

      home_prompt: (ctx: any, props: any) => untrack(() => {
        const prompt = api.ui.Prompt({ ref: props.ref, hint: busyHint() })
        return wrapPrompt(prompt)
      }),

      // B: sidebar title border
      sidebar_title: (ctx: any, props: any) => {
        if (!active.b() && !idleActive("b")) return null
        const color = colorForPhase()
        return (
          <ErrorBoundary fallback={<text>⚠</text>}>
            <box borderStyle="heavy" borderColor={color} paddingX={1}>
              <text>{props.title}</text>
            </box>
          </ErrorBoundary>
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

  api.lifecycle.onDispose(() => {
    stop()
    clearInterval(themeTimer)
    clearInterval(stateTimer)
  })
}

export async function thinkingVisualV2(context: V2ThinkingContext): Promise<() => void> {
  const cleanups: Array<() => void> = [];
  await thinkingVisual(createThinkingV2Api(context, cleanups), context.options ?? {}, {} as any);
  return () => {
    for (const cleanup of cleanups.reverse()) {
      try { cleanup(); } catch {}
    }
  };
}

const _plugin: TuiPluginModule & { id: string; setup?: (context: V2ThinkingContext) => Promise<() => void> } = {
  id: "opencode-thinking (TUI)",
  tui: thinkingVisual,
  setup: thinkingVisualV2,
};
export default _plugin
