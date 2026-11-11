/** @jsxImportSource @opentui/solid */
import { createSignal, ErrorBoundary } from "solid-js"
import { readFileSync, existsSync } from "node:fs"
import { TextAttributes } from "@opentui/core"
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import type { ThinkingVisualState } from "./types.js"
import { getStatePath } from "./types.js"
import {
  createThinkingState,
  IDLE_STATUS,
  type SessionNode,
  type TaskNode,
  type ThinkingStatus,
} from "./state.js"
import { createThinkingV2Api, decorateSidebar, startV2Pump, type V2ThinkingContext } from "./v2.js"

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const COLOR_CYCLE_MS = 250
const SPINNER_TICK_MS = 120
const WORKING_COLOR_KEYS = ["primary", "accent", "success", "error"] as const

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

function isActiveStatus(status: any): boolean | undefined {
  if (typeof status === "string") return status !== "idle"
  if (status && typeof status === "object" && typeof status.type === "string") return status.type !== "idle"
  return undefined
}

export const thinkingVisual: TuiPlugin = async (api, options) => {
  const fileState = loadState()
  const opts = (options ?? {}) as Record<string, unknown>
  const modes: ThinkingVisualState = {
    a: opts.a !== undefined ? Boolean(opts.a) : fileState.a,
    b: opts.b !== undefined ? Boolean(opts.b) : fileState.b,
  }
  const bridge = Boolean((api as any).__thinkingBridge)

  const [status, setStatus] = createSignal<ThinkingStatus>(IDLE_STATUS)
  const [spinnerIdx, setSpinnerIdx] = createSignal(0)
  const [colorIdx, setColorIdx] = createSignal(0)
  const [themeTick, setThemeTick] = createSignal(0)
  let spinnerTimer: ReturnType<typeof setInterval> | null = null
  let colorTimer: ReturnType<typeof setInterval> | null = null
  let disposed = false

  const thinking = () => status().mode === "working"

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
    if (status().mode === "working") {
      const key = WORKING_COLOR_KEYS[colorIdx() % WORKING_COLOR_KEYS.length]
      return (t as any)?.[key] ?? FALLBACK_COLOR
    }
    if (status().mode === "waiting") return t?.warning ?? FALLBACK_COLOR
    return t?.success ?? FALLBACK_COLOR
  }

  function start() {
    if (spinnerTimer) return
    spinnerTimer = setInterval(() => setSpinnerIdx(i => (i + 1) % SPINNER.length), SPINNER_TICK_MS)
    colorTimer = setInterval(() => setColorIdx(i => (i + 1) % WORKING_COLOR_KEYS.length), COLOR_CYCLE_MS)
  }

  function stop() {
    if (spinnerTimer) { clearInterval(spinnerTimer); spinnerTimer = null }
    if (colorTimer) { clearInterval(colorTimer); colorTimer = null }
    setSpinnerIdx(0); setColorIdx(0)
  }

  function applyStatus(next: ThinkingStatus) {
    setStatus(next)
    if (next.mode === "working") start()
    else stop()
  }

  const controller = createThinkingState(applyStatus, { settleMs: 400 })

  let focus: string | undefined
  let focusVersion = 0
  let refreshToken = 0
  const parents = new Map<string, string>()
  const activeSessions = new Map<string, boolean>()
  const knownSessions = new Set<string>()

  function setSessionActive(id: string, active: boolean) {
    if (!id) return
    activeSessions.set(id, active)
    knownSessions.add(id)
  }

  function loadStatus(id?: string) {
    if (!id) return
    try {
      const active = isActiveStatus(api.state?.session?.status?.(id))
      if (active !== undefined) setSessionActive(id, active)
    } catch { /* status lookup failed */ }
  }

  function sessionsForV1(): SessionNode[] {
    const ids = new Set<string>()
    for (const id of knownSessions) ids.add(id)
    for (const [id, parent] of parents) {
      ids.add(id)
      if (parent) ids.add(parent)
    }
    if (focus) ids.add(focus)
    return [...ids].filter(Boolean).map(id => ({
      id,
      parentID: parents.get(id),
      active: activeSessions.get(id) === true,
    }))
  }

  function applyV1() {
    if (disposed || bridge) return
    controller.setSessions(sessionsForV1())
  }

  function refreshFamily(id?: string) {
    const token = ++refreshToken
    if (!id || disposed || bridge) return
    void (async () => {
      const discovered = new Map<string, string>()
      const seen = new Set<string>()
      let current: string | undefined = id
      let rootID: string = id
      // Climb to the root so focusing a child still covers the whole tree.
      while (current && !seen.has(current)) {
        seen.add(current)
        rootID = current
        knownSessions.add(current)
        loadStatus(current)
        let info: any
        try { info = api.state?.session?.get?.(current) } catch { /* not loaded */ }
        if (info?.parentID) {
          discovered.set(current, info.parentID)
          knownSessions.add(info.parentID)
          current = info.parentID
        } else break
      }

      const queue = [rootID]
      while (queue.length && seen.size < 100) {
        const parentID = queue.shift()
        if (!parentID) continue
        let children: any[] = []
        try {
          const result: any = await api.client?.session?.children?.({ sessionID: parentID })
          children = Array.isArray(result) ? result : (result?.data ?? [])
        } catch { /* children unavailable */ }
        for (const child of children) {
          if (!child?.id || seen.has(child.id)) continue
          seen.add(child.id)
          knownSessions.add(child.id)
          discovered.set(child.id, parentID)
          loadStatus(child.id)
          queue.push(child.id)
        }
      }

      if (disposed || token !== refreshToken) return
      for (const [child, parent] of discovered) parents.set(child, parent)
      applyV1()
    })()
  }

  function requestFocus(id?: string) {
    if (id === focus) return
    focus = id
    const version = ++focusVersion
    // Slot render must not mutate a signal synchronously.
    queueMicrotask(() => {
      if (disposed || version !== focusVersion) return
      controller.setFocus(id)
      if (!bridge) {
        applyV1()
        refreshFamily(id)
      }
    })
  }

  // V1 event source. In the V2 bridge the data pump owns the snapshot, so
  // these listeners stay out of the way and never overwrite it.
  if (!bridge) {
    api.event.on("session.status", (event: any) => {
      try {
        const id = String(event?.properties?.sessionID ?? "")
        const active = isActiveStatus(event?.properties?.status)
        if (!id || active === undefined) return
        setSessionActive(id, active)
        applyV1()
      } catch { /* session.status handler failed */ }
    })
    api.event.on("session.idle", (event: any) => {
      try {
        const id = String(event?.properties?.sessionID ?? "")
        if (!id) return
        setSessionActive(id, false)
        applyV1()
      } catch { /* session.idle handler failed */ }
    })
    const trackSession = (event: any) => {
      try {
        const info = event?.properties?.info
        if (!info?.id) return
        knownSessions.add(info.id)
        if (info.parentID) parents.set(info.id, info.parentID)
        applyV1()
      } catch { /* session metadata handler failed */ }
    }
    api.event.on("session.created", trackSession)
    api.event.on("session.updated", trackSession)
    api.event.on("session.deleted", (event: any) => {
      try {
        const id = String(event?.properties?.info?.id ?? event?.properties?.sessionID ?? "")
        if (!id) return
        parents.delete(id)
        activeSessions.delete(id)
        knownSessions.delete(id)
        applyV1()
      } catch { /* session.deleted handler failed */ }
    })

    // Seed sessions that were already running before this plugin loaded.
    const refreshTimer = setInterval(() => {
      if (focus) refreshFamily(focus)
    }, 2000)
    api.lifecycle.onDispose(() => clearInterval(refreshTimer))
  }

  // V2 gives us a reliable full snapshot; V1 uses the event source above.
  ;(api as any).__thinkingSetFocus = requestFocus
  ;(api as any).__thinkingGetFocus = () => focus
  ;(api as any).__thinkingSetSessions = (sessions: SessionNode[]) => controller.setSessions(sessions)
  ;(api as any).__thinkingSetTasks = (tasks: TaskNode[]) => controller.setTasks(tasks)
  ;(api as any).__thinkingGetStatus = () => status()

  const settleTimer = setInterval(() => {
    try { controller.tick() } catch { /* settle tick failed */ }
  }, 100)

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

  function spinnerPrefix() {
    return thinking() ? SPINNER[spinnerIdx()] + " " : ""
  }

  // A: state badge inside the host prompt's right slot. That slot is additive:
  // it nests inside whichever session_prompt wins, so this plugin never owns
  // (or duplicates) the prompt itself and coexists with other TUI plugins that
  // also render a composer.
  function statusBadge() {
    if (!showA()) return null
    const color = (refreshTheme(), colorForPhase())
    return (
      <ErrorBoundary fallback={<text>⚠</text>}>
        <box flexDirection="row" paddingX={1}>
          <text fg={color} attributes={TextAttributes.BOLD}>{spinnerPrefix()}{status().label}</text>
        </box>
      </ErrorBoundary>
    )
  }

  // A0: v1 composer border. We are the only session_prompt owner, so we build
  // the host prompt ourselves and wrap it in a stable bordered box. The tree
  // never changes shape, so toggling the border does not remount the prompt
  // (keeps Esc/interrupt wiring intact).
  function wrapPrompt(prompt: any) {
    const color = (refreshTheme(), colorForPhase())
    return (
      <ErrorBoundary fallback={<text>⚠</text>}>
        <box border={showA()} borderStyle="heavy" borderColor={color}>
          {prompt}
        </box>
      </ErrorBoundary>
    )
  }

  api.slots.register({
    slots: {
      session_prompt: (ctx: any, props: any) => {
        if (!bridge) requestFocus(props?.session_id)
        const sessionID = props?.session_id
        const prompt = api.ui.Prompt({
          sessionID,
          visible: props?.visible,
          disabled: props?.disabled,
          onSubmit: props?.on_submit,
          ref: props?.ref,
          right: sessionID
            ? <api.ui.Slot name="session_prompt_right" session_id={sessionID} />
            : undefined,
        })
        return wrapPrompt(prompt)
      },

      home_prompt: (ctx: any, props: any) => {
        if (!bridge) requestFocus(undefined)
        const prompt = api.ui.Prompt({
          ref: props?.ref,
          right: <api.ui.Slot name="home_prompt_right" />,
        })
        return wrapPrompt(prompt)
      },

      session_prompt_right: (ctx: any, props: any) => {
        if (!bridge) requestFocus(props?.session_id)
        return statusBadge()
      },

      home_prompt_right: () => {
        if (!bridge) requestFocus(undefined)
        return statusBadge()
      },

      // B: sidebar state, v1. The footer slot is single_winner, so placing the
      // status above the working-directory line requires owning the whole
      // footer. Reproduce the host lines faithfully (same text and theme
      // colors) so nothing is lost: [status] [dir:branch] [• OpenCode version].
      sidebar_footer: (ctx: any, props: any) => {
        if (!bridge) requestFocus(props?.session_id)
        const color = (refreshTheme(), colorForPhase())
        const t: any = cachedTheme ?? api.theme.current ?? {}
        const sessionID = props?.session_id
        const sessionDirectory = sessionID
          ? (api.state.session as any).get?.(sessionID)?.directory
          : undefined
        const directory = sessionDirectory || api.state.path.directory || process.cwd()
        const home = process.env.HOME
        const short = home && (directory === home || directory.startsWith(home + "/"))
          ? "~" + directory.slice(home.length)
          : directory
        const branch = directory === api.state.path.directory ? api.state.vcs?.branch : undefined
        const location = branch ? short + ":" + branch : short
        const cut = location.lastIndexOf("/")
        const parent = cut > 0 ? location.slice(0, cut) : ""
        const name = cut >= 0 ? location.slice(cut + 1) : location
        const show = active.b() || idleActive("b")
        return (
          <ErrorBoundary fallback={<text>⚠</text>}>
            <box flexDirection="column" gap={1} width="100%">
              {show ? (
                <box flexDirection="row" width="100%" paddingX={1}>
                  <text fg={color} attributes={TextAttributes.BOLD}>{spinnerPrefix()}{status().label}</text>
                </box>
              ) : null}
              <text>
                <span style={{ fg: t.textMuted }}>{parent}</span>/<span style={{ fg: t.text }}>{name}</span>
              </text>
              <text>
                <span style={{ fg: t.success }}>•</span> <b style={{ fg: t.success }}>Open</b><b style={{ fg: t.text }}>Code</b>{" "}
                <span style={{ fg: t.textMuted }}>{api.app?.version ?? ""}</span>
              </text>
            </box>
          </ErrorBoundary>
        )
      },

      // B2: sidebar status for the OpenCode 2 adapter. Never rendered by the
      // v1 host (unknown slot); the v2 bridge maps it just above its own
      // footer so OpenCode 2 keeps drawing its location/version lines.
      sidebar_status: () => {
        if (!active.b() && !idleActive("b")) return null
        const color = (refreshTheme(), colorForPhase())
        return (
          <ErrorBoundary fallback={<text>⚠</text>}>
            <box flexDirection="row" width="100%" paddingX={1}>
              <text fg={color} attributes={TextAttributes.BOLD}>{spinnerPrefix()}{status().label}</text>
            </box>
          </ErrorBoundary>
        )
      },

      // C: full-width bordered bar above the composer (OpenCode 2 cannot
      // wrap the prompt, so this is the closest border-like indicator).
      prompt_bar: () => {
        if (!showA()) return null
        const color = colorForPhase()
        return (
          <ErrorBoundary fallback={<text>⚠</text>}>
            <box
              flexDirection="row"
              justifyContent="flex-start"
              width="100%"
              border
              borderStyle="heavy"
              borderColor={color}
              paddingX={1}
            >
              <text fg={color} attributes={TextAttributes.BOLD}>{spinnerPrefix()}{status().label}</text>
            </box>
          </ErrorBoundary>
        )
      },
    },
  })

  api.keymap.registerLayer({
    commands: [
      { name: "opencode-thinking.toggle-a", title: "Thinking Visual: Toggle Border",  category: "opencode-thinking", run: () => {} },
      { name: "opencode-thinking.toggle-b", title: "Thinking Visual: Toggle Sidebar", category: "opencode-thinking", run: () => {} },
    ],
    bindings: [],
  })

  api.event.on("tui.command.execute", (event: any) => {
    const id = event?.command ?? event?.id
    if (id === "opencode-thinking.toggle-a") { modes.a = !modes.a; api.ui.toast({ title: "Border", message: modes.a ? "on" : "off", variant: "info" }) }
    if (id === "opencode-thinking.toggle-b") { modes.b = !modes.b; api.ui.toast({ title: "Sidebar", message: modes.b ? "on" : "off", variant: "info" }) }
  })

  ;(api as any).__thinkingSidebarEnabled = () => modes.b
  ;(api as any).__thinkingPhaseColor = () => colorForPhase()

  api.lifecycle.onDispose(() => {
    disposed = true
    refreshToken++
    stop()
    clearInterval(themeTimer)
    clearInterval(stateTimer)
    clearInterval(settleTimer)
  })
}

export async function thinkingVisualV2(context: V2ThinkingContext): Promise<() => void> {
  const cleanups: Array<() => void> = [];
  const api = createThinkingV2Api(context, cleanups);
  await thinkingVisual(api, context.options ?? {}, {} as any);
  startV2Pump(context, api, cleanups);
  decorateSidebar(context, api, cleanups);
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
