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

export function parseArgs(args: string): ThinkingVisualState | null {
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

type V2CommandContext = {
  command?: {
    transform: (callback: (editor: { add: (definition: Record<string, unknown>) => void }) => void) => Promise<unknown>
  }
}

/** V2 entrypoint: register the same slash command through a command transform. */
export async function thinkingVisualV2(ctx?: V2CommandContext): Promise<void> {
  if (!ctx?.command) return
  await ctx.command.transform((editor) => {
    editor.add({
      name: "thinking_visual",
      description: "Toggle thinking visual modes. Args: a, b, all, none",
      execute: async ({ prompt }: { prompt?: { text?: string } }) => {
        const state = parseArgs(prompt?.text ?? "")
        if (state) writeState(state)
      },
    })
  })
}

const _plugin: PluginModule & { setup: typeof thinkingVisualV2 } = {
  id: "opencode-thinking (Server)",
  server: thinkingVisualCommand,
  setup: thinkingVisualV2,
};
export default _plugin
