<p align="center">
  <img src="https://raw.githubusercontent.com/arandevcode/opencode-plugins/main/opencode-thinking/images/demo.gif" alt="Rainbow border and sidebar glow demo" width="480">
  <br>
  <sub><em>Rainbow border animation around the input area + sidebar glow</em></sub>
</p>

# @arandevcode/opencode-thinking

> 🇪🇸 Also available in [Spanish](README-es.md)

Animated visual indicators when the model is processing — rainbow border around the input area and sidebar glow. No config needed.

<br>
<p align="center">🐟</p>
<p align="center">
  <em>&ldquo;Quien quiera peces que se moje el culo&rdquo;</em><br>
  <em>&ldquo;If you want fish, get your ass wet&rdquo;</em>
</p>
<p align="center">
  <sub>— for my father, who taught me to roll up my sleeves and get it done</sub>
</p>

<p align="center">
  <a href="https://buymeacoffee.com/arandevcode"><strong>☕ Buy me a coffee</strong></a>
  <br>
  <sub><a href="https://github.com/sponsors/arandevcode">❤️ Sponsor on GitHub</a></sub>
</p>

## Install

```sh
opencode plugin --global --force @arandevcode/opencode-thinking
```

Or install from GitHub source to follow latest development:

```json
// ~/.config/opencode/opencode.json
{
  "plugin": [
    "https://github.com/arandevcode/opencode-plugins/tree/main/opencode-thinking"
  ]
}
```

## Uninstall

Three steps, in order:

1. Remove the plugin entry from your OpenCode config (`~/.config/opencode/opencode.json`):

   ```jsonc
   // delete the @arandevcode/opencode-thinking lines inside "plugin": []
   {
     "plugin": [
       "@arandevcode/opencode-thinking/tui",   // ← remove
       "@arandevcode/opencode-thinking/server" // ← remove
     ]
   }
   ```

2. Delete the shared state file the plugin uses for TUI ↔ Server IPC:

   ```sh
   rm -f ~/.config/opencode/thinking-visual-state.json
   rm -f ~/.config/opencode/thinking-visual-debug.log
   ```

3. (Optional) Remove any local source clone you may have used to follow development:

   ```sh
   rm -rf ./opencode-thinking
   ```

Restart OpenCode and the rainbow border + sidebar glow will be gone.

## Commands

| Command | Effect |
|---|---|
| `/thinking_visual` | Toggle all effects |
| `/thinking_visual a` | Border animation only |
| `/thinking_visual b` | Sidebar glow only |
| `/thinking_visual all` | Both |
| `/thinking_visual none` | Disable |

## More Information

### How activation works

**Automatic** (default): the plugin listens for session status. When opencode starts processing (`session.status === "busy"`), rainbow effects appear. When done (`session.idle`), they disappear.

**Manual**: use `/thinking_visual` or toggle individual modes via Command Palette (`Cmd+K` → "Thinking Visual").

### Project structure

```
├── .opencode/
│   ├── opencode.json            ← project config (activates plugin + slash cmds)
│   └── plugins/
│       ├── opencode-thinking-tui.ts      ← TUI plugin (visual effects)
│       └── opencode-thinking-server.ts   ← Server plugin (handles /thinking_visual)
├── src/                         ← npm distribution source
│   ├── index.ts
│   ├── tui.ts
│   ├── server.ts
│   └── types.ts
├── docs/
│   └── ARCHITECTURE.md
├── example.opencode.json
└── package.json
```

`.opencode/plugins/` lets the plugin work **without npm install, without build, without global install** — opencode loads them automatically from the project.

### Install in another project

```jsonc
// .opencode/opencode.json
{
  "plugin": [
    "@arandevcode/opencode-thinking/tui",
    "@arandevcode/opencode-thinking/server"
  ]
}
```

### Development

```sh
npm install        # install deps (type-check only)
npm run build      # compile src/ → dist/
npm run dev        # continuous compilation
```

## TUI Patterns & Theme

Colors are sourced live from `api.theme.current`, not hardcoded. The plugin also watches the theme signature (250ms polling) so theme changes mid-session are picked up by the next re-render.

| Phase | Border + badge color | Badge text |
|---|---|---|
| **Working** (model is `busy`) | alternates `theme.warning` ↔ `theme.error` every 250ms | `WORKING` |
| **Idle** (model is `idle` / `session.idle`) | `theme.success` | `IDLE` |

The same color drives the sidebar title border while the visual mode `b` is enabled.

This pattern follows the `opentui-theme-colors` convention: semantic theme keys (`success` / `warning` / `error`) instead of hardcoded palette values, and `themeSignature()` + `setInterval` polling for reactive theme changes.

## License

MIT
