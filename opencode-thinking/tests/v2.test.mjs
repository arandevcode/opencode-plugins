import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { parseArgs, thinkingVisualV2 as thinkingServerV2 } from "../dist/server.js"
import { collectV2Snapshot, createThinkingV2Api, startV2Pump } from "../dist/v2.js"
import { thinkingVisualV2 } from "../dist/tui.js"
import { computeStatus } from "../dist/state.js"

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

test("V2 TUI adapter maps slots and forwards every session", async () => {
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
  assert.equal(api.theme.current.warning, "#fa0")
  api.slots.register({
    slots: {
      prompt_bar: () => "bar",
      home_prompt: () => "home",
      sidebar_title: () => "side",
    },
  })
  assert.deepEqual(slots.map((slot) => slot.append ?? slot.before), ["session.composer.top", "home.footer.status", "sidebar.footer"])

  const statuses = []
  const created = []
  let pumps = 0
  api.__thinkingPumpNow = () => { pumps += 1 }
  api.event.on("session.status", (event) => statuses.push([event.properties.sessionID, event.properties.status.type]))
  api.event.on("session.created", (event) => created.push(event.properties.info))
  listener?.({ details: { type: "session.execution.started", data: { sessionID: "ses_1" } } })
  listener?.({ details: { type: "session.execution.succeeded", data: { sessionID: "ses_1" } } })
  listener?.({ details: { type: "session.execution.started", data: { sessionID: "ses_2" } } })
  listener?.({ details: { type: "session.execution.interrupted", data: { sessionID: "ses_2" } } })
  listener?.({ details: { type: "session.created", data: { sessionID: "ses_child", parentID: "ses_1" } } })
  assert.deepEqual(statuses, [
    ["ses_1", "busy"], ["ses_1", "idle"],
    ["ses_2", "busy"], ["ses_2", "idle"],
  ])
  assert.equal(created[0].id, "ses_child")
  assert.equal(created[0].parentID, "ses_1")
  assert.ok(pumps >= 5)
  assert.ok(cleanups.length >= 1)
})

test("V2 snapshot includes the focused tree and live shells as pending work", () => {
  let shellLocation
  const context = {
    data: {
      session: {
        list: () => [
          { id: "root", parentID: undefined, location: { directory: "/work/project" } },
          { id: "child", parentID: "root" },
          { id: "other-root", parentID: undefined, location: { directory: "/work/other" } },
        ],
        get: (id) => ({
          id,
          parentID: id === "child" ? "root" : undefined,
          location: id === "root" ? { directory: "/work/project" } : undefined,
        }),
        family: () => ["root", "child"],
        status: (id) => (id === "child" ? "running" : "idle"),
      },
      shell: {
        list: (location) => {
          shellLocation = location
          return [
            { id: "sh-bg", status: "running", metadata: { sessionID: "root" } },
            { id: "sh-child", status: "running", metadata: { sessionID: "child" } },
            { id: "sh-other", status: "running", metadata: { sessionID: "other-root" } },
            { id: "sh-done", status: "exited", metadata: { sessionID: "root" } },
            { id: "sh-anon", status: "running", metadata: {} },
          ]
        },
      },
      location: { default: () => ({ directory: "/host-default" }) },
    },
  }
  const snapshot = collectV2Snapshot(context, "root")
  assert.deepEqual(snapshot.sessions.map((session) => session.id).sort(), ["child", "root"])
  assert.equal(snapshot.sessions.find((session) => session.id === "child").active, true)
  assert.deepEqual(snapshot.tasks.map((task) => task.id).sort(), ["sh-bg", "sh-child"])
  assert.deepEqual(shellLocation, { directory: "/work/project" })
  assert.equal(computeStatus({ focus: "root", ...snapshot }).mode, "working")
  assert.deepEqual(collectV2Snapshot(context, undefined), { sessions: [], tasks: [] })
})

test("V2 snapshot yields WAITING · TASK when the turn and subagents are done", () => {
  const context = {
    data: {
      session: {
        list: () => [{ id: "root", parentID: undefined }],
        get: (id) => ({ id }),
        family: () => ["root"],
        status: () => "idle",
      },
      shell: {
        list: () => [
          { id: "sh-bg", status: "running", metadata: { sessionID: "root" } },
          { id: "sh-bg-2", status: "running", metadata: { sessionID: "root" } },
        ],
      },
    },
  }
  const snapshot = collectV2Snapshot(context, "root")
  assert.deepEqual(computeStatus({ focus: "root", ...snapshot }), {
    mode: "waiting",
    waiting: "2 TASKS",
    label: "WAITING · 2 TASKS",
  })
})

test("V2 pump pushes snapshots and focus into the shared state", () => {
  const cleanups = []
  const received = { sessions: [], tasks: [], focus: [] }
  const status = { root: "running" }
  const context = {
    data: {
      listen: () => () => {},
      session: {
        list: () => [{ id: "root", parentID: undefined }],
        get: (id) => ({ id }),
        family: () => ["root"],
        status: (id) => status[id] ?? "idle",
        sync: async () => {},
      },
      shell: { list: () => [] },
    },
    ui: { router: { current: () => ({ type: "session", sessionID: "root" }) } },
  }
  const api = {
    __thinkingSetSessions: (sessions) => { received.sessions.push(sessions) },
    __thinkingSetTasks: (tasks) => { received.tasks.push(tasks) },
    __thinkingSetFocus: (focus) => { received.focus.push(focus) },
    __thinkingGetFocus: () => "root",
  }
  startV2Pump(context, api, cleanups)
  assert.equal(received.focus.at(-1), "root")
  assert.equal(received.sessions.at(-1)[0].active, true)

  status.root = "idle"
  api.__thinkingPumpNow()
  assert.equal(received.sessions.at(-1)[0].active, false)
  for (const cleanup of cleanups.reverse()) cleanup()
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
  let listener
  const context = {
    data: {
      listen: (fn) => { listener = fn; return () => {} },
      session: {
        list: () => [{ id: "root" }],
        get: (id) => ({ id }),
        family: () => ["root"],
        status: () => "idle",
        sync: async () => {},
      },
      shell: { list: () => [] },
    },
    ui: {
      slot: () => () => {},
      router: { current: () => ({ type: "home" }) },
    },
    keymap: { layer: () => {} },
    theme: {},
  }
  const cleanup = await thinkingVisualV2(context)
  assert.equal(typeof cleanup, "function")
  assert.equal(typeof listener, "function")
  cleanup()
})
