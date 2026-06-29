import { writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { Plugin, PluginModule } from "@opencode-ai/plugin"
import type { ThinkingVisualState } from "./types.js"
import { getStatePath } from "./types.js"

function ensureDir(path: string) {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function writeState(state: ThinkingVisualState) {
  const path = getStatePath()
  ensureDir(path)
  writeFileSync(path, JSON.stringify(state, null, 2))
}

function debug(message: string) {
  const p = join(dirname(getStatePath()), "thinking-visual-debug.log")
  ensureDir(p)
  appendFileSync(p, `${new Date().toISOString()} ${message}\n`)
}

function parseArgs(args: string): ThinkingVisualState | null {
  args = args.trim()
  if (!args) return { a: true, b: true }

  const result: ThinkingVisualState = { a: false, b: false }
  for (const tok of args.split(/\s+/)) {
    if (tok === "a") result.a = true
    else if (tok === "b") result.b = true
    else if (tok === "all") return { a: true, b: true }
    else if (tok === "none") return { a: false, b: false }
    else return null
  }
  if (!result.a && !result.b) return { a: true, b: true }
  return result
}

export const thinkingVisualCommand: Plugin = async () => {
  debug("server plugin loaded")
  return {
    config: async (cfg: any) => {
      cfg.command ??= {}
      cfg.command.thinking_visual = {
        template: "",
        description: "Toggle thinking visual modes. Args: a, b, all, none",
      }
      debug("registered /thinking_visual command")
    },

    "command.execute.before": async (cmdInput: any, output: any) => {
      if (cmdInput.command !== "thinking_visual") return
      debug(`hook command=${cmdInput.command} args=${cmdInput.arguments}`)

      const state = parseArgs(cmdInput.arguments)
      if (!state) {
        output.parts = [{ type: "text", text: "Invalid args. Use: a, b, all, none" }]
        return
      }

      writeState(state)
      output.parts = []
      debug("command consumed")
    },
  }
}

const _plugin: PluginModule = {
  id: "opencode-thinking (Server)",
  server: thinkingVisualCommand,
};
export default _plugin
