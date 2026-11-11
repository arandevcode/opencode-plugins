import test from "node:test"
import assert from "node:assert/strict"

import { thinkingVisual } from "../dist/tui.js"

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function fakeApi({ statuses = {}, children = {}, parents = {} } = {}) {
  const handlers = new Map()
  const disposers = []
  const registered = []
  const layers = []
  let promptCalls = 0
  const api = {
    theme: {
      current: {
        text: "#fff", textMuted: "#888", primary: "#0af", accent: "#a0f",
        success: "#0f0", warning: "#fa0", error: "#f00",
      },
    },
    event: {
      on(type, handler) { handlers.set(type, handler); return () => handlers.delete(type) },
    },
    slots: { register(plugin) { registered.push(plugin) } },
    keymap: { registerLayer(input) { layers.push(input) } },
    ui: { Prompt: () => { promptCalls += 1; return {} }, toast() {} },
    lifecycle: { onDispose(fn) { disposers.push(fn) } },
    state: {
      session: {
        get(id) { return { id, parentID: parents[id] } },
        status(id) { return statuses[id] ?? { type: "idle" } },
      },
    },
    client: {
      session: {
        async children({ sessionID }) { return { data: children[sessionID] ?? [] } },
      },
    },
  }
  return {
    api,
    registered,
    layers,
    get promptCalls() { return promptCalls },
    emit(type, event) {
      const id = event?.properties?.sessionID
      if (id && type === "session.status") statuses[id] = event.properties.status
      if (id && type === "session.idle") statuses[id] = { type: "idle" }
      handlers.get(type)?.(event)
    },
    dispose() { for (const fn of disposers.reverse()) fn() },
  }
}

function statusEvent(sessionID, type) {
  return { properties: { sessionID, status: { type } } }
}

test("V1 sees a background subagent after the main turn ends", async () => {
  const harness = fakeApi({
    statuses: { root: { type: "idle" }, child: { type: "busy" } },
    parents: { child: "root" },
    children: { root: [{ id: "child", parentID: "root" }] },
  })
  await thinkingVisual(harness.api, { a: true, b: true })
  try {
    harness.api.__thinkingSetFocus("root")
    await sleep(100)
    assert.equal(harness.api.__thinkingGetStatus().mode, "working")

    harness.emit("session.status", statusEvent("child", "idle"))
    assert.equal(harness.api.__thinkingGetStatus().mode, "working")
    await sleep(500)
    assert.equal(harness.api.__thinkingGetStatus().mode, "idle")
  } finally {
    harness.dispose()
  }
})

test("V1 foreground subagent handoff does not flash IDLE", async () => {
  const harness = fakeApi({
    statuses: { root: { type: "busy" }, child: { type: "busy" } },
    parents: { child: "root" },
    children: { root: [{ id: "child", parentID: "root" }] },
  })
  await thinkingVisual(harness.api, { a: true, b: true })
  try {
    harness.api.__thinkingSetFocus("root")
    await sleep(20)
    assert.equal(harness.api.__thinkingGetStatus().mode, "working")

    harness.emit("session.status", statusEvent("child", "idle"))
    harness.emit("session.status", statusEvent("root", "idle"))
    assert.equal(harness.api.__thinkingGetStatus().mode, "working")

    await sleep(200)
    harness.emit("session.status", statusEvent("root", "busy"))
    await sleep(450)
    assert.equal(harness.api.__thinkingGetStatus().mode, "working")
  } finally {
    harness.dispose()
  }
})

test("V1 ignores another conversation's running session", async () => {
  const harness = fakeApi({ statuses: { root: { type: "idle" } } })
  await thinkingVisual(harness.api, { a: true, b: true })
  try {
    harness.api.__thinkingSetFocus("root")
    await sleep(20)
    harness.emit("session.status", statusEvent("other-root", "busy"))
    await sleep(450)
    assert.equal(harness.api.__thinkingGetStatus().mode, "idle")
  } finally {
    harness.dispose()
  }
})

test("V1 counts nested subagents", async () => {
  const harness = fakeApi({
    statuses: { root: { type: "idle" }, child: { type: "idle" }, nested: { type: "busy" } },
    parents: { child: "root", nested: "child" },
    children: {
      root: [{ id: "child", parentID: "root" }],
      child: [{ id: "nested", parentID: "child" }],
    },
  })
  await thinkingVisual(harness.api, { a: true, b: true })
  try {
    harness.api.__thinkingSetFocus("root")
    await sleep(20)
    assert.equal(harness.api.__thinkingGetStatus().mode, "working")
  } finally {
    harness.dispose()
  }
})

test("V1 owns the composer wrapper without creating a second prompt", async () => {
  const harness = fakeApi()
  await thinkingVisual(harness.api, { a: true, b: true })
  try {
    const keys = harness.registered.flatMap((plugin) => Object.keys(plugin.slots))
    assert.ok(keys.includes("session_prompt"))
    assert.ok(keys.includes("home_prompt"))
    assert.ok(keys.includes("session_prompt_right"))
    assert.ok(keys.includes("home_prompt_right"))
    assert.ok(keys.includes("sidebar_footer"))
    assert.ok(keys.includes("sidebar_status"))
    assert.ok(!keys.includes("sidebar_content"))
    assert.ok(!keys.includes("sidebar_title"))
    assert.equal(harness.promptCalls, 0)

    const commands = harness.layers.at(-1).commands
    assert.equal(commands.length, 2)
    for (const command of commands) {
      assert.equal(command.name, command.name.trim())
      assert.ok(!/\s/.test(command.name), `command name has whitespace: ${command.name}`)
      assert.ok(command.title)
    }
  } finally {
    harness.dispose()
  }
})
