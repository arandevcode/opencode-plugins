import { homedir } from "node:os"
import { join } from "node:path"

export interface ThinkingVisualState {
  a: boolean
  b: boolean
}

export const STATE_FILE = "thinking-visual-state.json"

export function getStatePath(): string {
  const configDir = process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, "opencode")
    : join(homedir(), ".config", "opencode")
  return join(configDir, STATE_FILE)
}
