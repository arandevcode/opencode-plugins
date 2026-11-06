import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { parseArgs, thinkingVisualV2 as thinkingServerV2 } from "../dist/server.js"
import { createThinkingV2Api } from "../dist/v2.js"
import { thinkingVisualV2 } from "../dist/tui.js"

test("parseArgs accepts the documented modes", () => {
  assert.deepEqual(parseArgs("a"), { a: true, b: false })
  assert.deepEqual(parseArgs("b"), { a: false, b: true })
  assert.deepEqual(parseArgs("all"), { a: true, b: true })
  assert.deepEqual(parseArgs("none"), { a: false, b: false })
  assert.equal(parseArgs("nope"), null)
})

test("V2 command transform writes the state file", async () => {
  const root = mkdtempSync(join(tmpdir(), "thinking-v2-"))
  const previous = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = root
  try {
    let definition
    const command = {
      transform: async (callback) => callback({ add: (next) => { definition = next } }),
    }
    await thinkingServerV2({ command })
    assert.equal(definition.name, "thinking_visual")
    await definition.execute({ prompt: { text: "none" } })
    const saved = JSON.parse(readFileSync(join(root, "opencode", "thinking-visual-state.json"), "utf8"))
    assert.deepEqual(saved, { a: false, b: false })
  } finally {
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME
    else process.env.XDG_CONFIG_HOME = previous
  }
})

test("V2 TUI adapter maps slots and cleans up", async () => {
  const slots = []
  let listener
  const cleanups = []
  const api = createThinkingV2Api(
    {
      theme: { text: { base: "#fff", muted: "#888" }, accent: { base: "#0af" }, status: { success: "#0f0", warning: "#fa0", danger: "#f00" } },
      data: { listen: (fn) => { listener = fn; return () => {} } },
      ui: { slot: (input) => { slots.push(input); return () => {} } },
      keymap: { layer: () => {} },
    },
    cleanups,
  )

  assert.equal(api.theme.current.text, "#fff")
  api.slots.register({
    slots: {
      prompt_bar: () => "bar",
      home_prompt: () => "home",
      sidebar_title: () => "side",
    },
  })
  assert.deepEqual(slots.map((slot) => slot.append ?? slot.before), ["session.composer.top", "home.footer.status", "sidebar.footer"])

  const statuses = []
  api.event.on("session.status", (event) => statuses.push(event.properties.status.type))
  listener?.({ details: { type: "session.execution.started", data: { sessionID: "ses_1" } } })
  listener?.({ details: { type: "session.execution.succeeded", data: { sessionID: "ses_1" } } })
  listener?.({ details: { type: "session.execution.started", data: { sessionID: "ses_2" } } })
  listener?.({ details: { type: "session.execution.interrupted", data: { sessionID: "ses_2" } } })
  assert.deepEqual(statuses, ["busy", "idle", "busy", "idle"])
  assert.ok(cleanups.length >= 1)
})

test("V2 TUI adapter only reacts to the focused session", async () => {
  const slots = []
  let listener
  let route = { type: "home" }
  const statuses = []
  const api = createThinkingV2Api(
    {
      data: {
        listen: (fn) => { listener = fn; return () => {} },
        session: { status: (sessionID) => (sessionID === "ses_running" ? "running" : "idle") },
      },
      ui: {
        router: { current: () => route },
        slot: (input) => { slots.push(input); return () => {} },
      },
    },
    [],
  )
  api.slots.register({
    slots: {
      prompt_bar: () => "bar",
      home_prompt: () => "home",
      sidebar_title: () => "side",
    },
  })
  api.event.on("session.status", (event) => statuses.push(event.properties.status.type))

  // On home there is no focused session: background activity is ignored.
  listener?.({ details: { type: "session.execution.started", data: { sessionID: "ses_other" } } })
  assert.deepEqual(statuses, [])

  // Focusing a session syncs with its current status (idle here).
  route = { type: "session", sessionID: "ses_focus" }
  const promptSlot = slots.find((slot) => slot.append === "session.composer.top")
  promptSlot.render({ sessionID: "ses_focus" })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(statuses, ["idle"])

  // Background sessions must not turn the indicator on or off.
  listener?.({ details: { type: "session.execution.started", data: { sessionID: "ses_other" } } })
  assert.deepEqual(statuses, ["idle"])
  listener?.({ details: { type: "session.execution.started", data: { sessionID: "ses_focus" } } })
  listener?.({ details: { type: "session.execution.succeeded", data: { sessionID: "ses_other" } } })
  listener?.({ details: { type: "session.execution.succeeded", data: { sessionID: "ses_focus" } } })
  assert.deepEqual(statuses, ["idle", "busy", "idle"])

  // Switching to an already-running session lights it up immediately.
  route = { type: "session", sessionID: "ses_running" }
  const sidebarSlot = slots.find((slot) => (slot.append ?? slot.before) === "sidebar.footer")
  sidebarSlot.render({ sessionID: "ses_running" })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(statuses.at(-1), "busy")
})

test("V2 TUI adapter accepts unwrapped events and ignores unknown ones", () => {
  let listener
  const api = createThinkingV2Api(
    { data: { listen: (fn) => { listener = fn; return () => {} } } },
    [],
  )
  const statuses = []
  api.event.on("session.status", (event) => statuses.push(event.properties.status.type))
  listener?.({ type: "session.execution.started" })
  listener?.({ type: "message.updated" })
  listener?.({ details: { type: "session.execution.failed", data: { sessionID: "ses_1" } } })
  assert.deepEqual(statuses, ["busy", "idle"])
})

test("V2 TUI setup returns a cleanup", async () => {
  const cleanups = []
  const context = {
    data: { listen: () => () => {} },
    ui: { slot: () => () => {} },
    keymap: { layer: () => {} },
    theme: {},
  }
  const cleanup = await thinkingVisualV2(context)
  assert.equal(typeof cleanup, "function")
  cleanup()
})
