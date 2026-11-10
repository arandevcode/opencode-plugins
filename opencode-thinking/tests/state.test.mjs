import test from "node:test"
import assert from "node:assert/strict"

import {
  computeStatus,
  createThinkingState,
  IDLE_STATUS,
  waitingText,
} from "../dist/state.js"

const root = { id: "root", active: false }
const child = { id: "child", parentID: "root", active: false }
const nested = { id: "nested", parentID: "child", active: false }

test("WORKING covers background subagents after the main turn ends", () => {
  const status = computeStatus({
    focus: "root",
    sessions: [
      { ...root, active: false },
      { ...child, active: true },
    ],
    tasks: [],
  })
  assert.equal(status.mode, "working")
  assert.equal(status.label, "WORKING")
})

test("WORKING covers nested subagents", () => {
  assert.equal(computeStatus({
    focus: "root",
    sessions: [root, child, { ...nested, active: true }],
    tasks: [],
  }).mode, "working")
})

test("a session from another tree never counts", () => {
  const status = computeStatus({
    focus: "root",
    sessions: [
      root,
      child,
      { id: "other-root", active: true },
      { id: "other-child", parentID: "other-root", active: true },
    ],
    tasks: [{ id: "sh-other", sessionID: "other-root", active: true }],
  })
  assert.equal(status.mode, "idle")
})

test("focusing a child still covers the whole tree", () => {
  assert.equal(computeStatus({
    focus: "child",
    sessions: [{ ...root, active: true }, child],
    tasks: [],
  }).mode, "working")
})

test("last subagent ending settles to IDLE after the debounce", () => {
  let now = 0
  const changes = []
  const state = createThinkingState((next) => changes.push(next), { settleMs: 400, now: () => now })
  state.setFocus("root")
  state.setSessions([{ ...root, active: true }, { ...child, active: true }])
  assert.equal(state.current().mode, "working")

  now = 100
  state.setSessions([root, child])
  assert.equal(state.current().mode, "working")
  assert.equal(state.pending()?.mode, "idle")
  state.tick(499)
  assert.equal(state.current().mode, "working")
  state.tick(500)
  assert.equal(state.current().mode, "idle")
  assert.deepEqual(changes.map((status) => status.mode), ["working", "idle"])
})

test("foreground subagent handoff does not flash IDLE", () => {
  let now = 0
  const state = createThinkingState(() => {}, { settleMs: 400, now: () => now })
  state.setFocus("root")
  state.setSessions([{ ...root, active: true }, { ...child, active: true }])

  // Child stops while the parent is between turns.
  now = 100
  state.setSessions([root, child])
  state.tick(300)
  assert.equal(state.current().mode, "working")

  // Parent resumes before the settle window expires.
  now = 250
  state.setSessions([{ ...root, active: true }, child])
  assert.equal(state.current().mode, "working")
  assert.equal(state.pending(), null)

  // Finishing both also waits for the settle window.
  now = 1000
  state.setSessions([root, child])
  state.tick(1399)
  assert.equal(state.current().mode, "working")
  state.tick(1400)
  assert.equal(state.current().mode, "idle")
})

test("background task after the turn becomes WAITING · TASK", () => {
  let now = 0
  const state = createThinkingState(() => {}, { settleMs: 400, now: () => now })
  state.setFocus("root")
  state.setSessions([root, child])
  state.setTasks([{ id: "sh-1", sessionID: "root", active: true }])
  assert.equal(state.current().mode, "idle")
  state.tick(400)
  assert.deepEqual(state.current(), { mode: "waiting", waiting: "TASK", label: "WAITING · TASK" })

  now = 500
  state.setTasks([
    { id: "sh-1", sessionID: "root", active: true },
    { id: "sh-2", sessionID: "child", active: true },
  ])
  assert.equal(state.current().waiting, "TASK")
  state.tick(900)
  assert.deepEqual(state.current(), { mode: "waiting", waiting: "2 TASKS", label: "WAITING · 2 TASKS" })

  now = 1000
  state.setTasks([])
  state.tick(1400)
  assert.deepEqual(state.current(), IDLE_STATUS)
})

test("WORKING wins over a still-running background task", () => {
  const status = computeStatus({
    focus: "root",
    sessions: [{ ...root, active: true }],
    tasks: [{ id: "sh-1", sessionID: "root", active: true }],
  })
  assert.equal(status.mode, "working")
})

test("focus changes apply immediately instead of showing the old tree", () => {
  const state = createThinkingState(() => {}, { settleMs: 400, now: () => 0 })
  state.setFocus("root")
  state.setSessions([{ ...root, active: true }])
  assert.equal(state.current().mode, "working")
  state.setFocus("quiet")
  assert.equal(state.current().mode, "idle")
})

test("waiting labels are pluralised like glow-thinking", () => {
  assert.equal(waitingText(0), "")
  assert.equal(waitingText(1), "TASK")
  assert.equal(waitingText(3), "3 TASKS")
})
