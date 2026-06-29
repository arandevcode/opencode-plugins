<p align="center">
  <img src="https://raw.githubusercontent.com/arandevcode/opencode-plugins/main/opencode-quota-extended/images/opencode_quota_extended_sidebar.png" alt="TUI sidebar" width="420">
  <br>
  <sub><em>-sidebar example-</em></sub>
</p>

# @arandevcode/opencode-quota-extended

> 🇪🇸 Also available in [Spanish](README-es.md)

Quota usage cards for the TUI sidebar — per-window progress bars with traffic-light colors for OpenAI, GitHub Copilot, and OpenCode Go.

- Progress bar for each quota window (5h rolling, weekly, monthly, code review...)
- Shows when it resets — time remaining and exact date
- Color-coded health indication (green = ok, orange = warning, red = critical)
- OpenCode Go capable!

Heavily inspired by [`@slkiser/opencode-quota`](https://github.com/slkiser/opencode-quota). Both coexist without conflict.

<br>
<p align="center">🐟 <em>&ldquo;Quien quiera peces que se moje el culo&rdquo;</em> >
  <em>&ldquo;If you want fish, get your ass wet&rdquo;</em>  <sub>— for my father, who taught me to roll up my sleeves and get it done</sub>
</p>

<p align="center">
  <a href="https://buymeacoffee.com/arandevcode"><strong>☕ Buy me a coffee</strong></a>
  <br>
  <sub><a href="https://github.com/sponsors/arandevcode">❤️ Sponsor on GitHub</a></sub>
</p>

## Install

```sh
opencode plugin --global --force @arandevcode/opencode-quota-extended
```

Or install from GitHub source to follow latest development:

```json
// ~/.config/opencode/opencode.json
{
  "plugin": [
    "https://github.com/arandevcode/opencode-plugins/tree/main/opencode-quota-extended"
  ]
}
```

## CLI

View quota from the terminal without opening the TUI:

```sh
npx opencode-quota            # run via npm (no install)
opencode-quota                # if installed globally
node bin/quota.mjs            # from the repo directory (no build needed)
npm run quota                 # from the repo directory
```

<p align="center">
  <img src="https://raw.githubusercontent.com/arandevcode/opencode-plugins/main/opencode-quota-extended/images/opencode_quota_extended_cli.png" alt="CLI output" width="620">
  <br>
  <sub><em>-cli example-</em></sub>
</p>

Traffic-light colors: green (ok), orange (warning), red (error).

## Configuration

Optional sidecar at `~/.config/opencode/opencode-quota-extended.json`:

| Field | Type | Default | Description |
|---|---|---|---|
| `enabledProviders` | string[] | `["openai","github-copilot","opencode-go"]` | Providers to fetch |
| `refreshIntervalMs` | int | `60000` | Polling interval |
| `cardsSidebar.order` | int | `145` | Sidebar position (lower = higher) |

## More Information

### How it works

Registers a TUI plugin that renders a `sidebar_content` panel at order 145, showing quota cards for every enabled provider. Each provider fetches quota data independently from its own API.

| Provider | Windows | Auth source |
|---|---|---|
| **OpenAI** | 5h rolling, Weekly, Code Review | `auth.json` → `openai` / `chatgpt` entry |
| **GitHub Copilot** | Premium requests (single window) | `auth.json` → `github-copilot` entry |
| **OpenCode Go** | 5h, Weekly, Monthly | Config file or env vars |

Traffic-light colors: ≥50% green (`accent`), 25-49% yellow (`warning`), <25% red (`error`).

### Authentication

Reads credentials from OpenCode's runtime auth file (`~/.local/share/opencode/auth.json`). Does **not** store, prompt for, or distribute secrets.

**OpenCode Go** requires additional setup — it's a bit tricky because there's no official API yet.

Create `~/.config/opencode/opencode-quota/opencode-go.json`:

```json
{
  "workspaceId": "wrk_abc123...",
  "authCookie": "Fe26.2..."
}
```

| Field | Description | How to get it |
|---|---|---|
| `workspaceId` | Your OpenCode workspace ID | Log in at [opencode.ai/go](https://opencode.ai/go). The URL is `https://opencode.ai/workspace/wrk_XXX/go` — copy the `wrk_XXX` part. |
| `authCookie` | Session cookie for auth | Open DevTools (F12) → Application → Cookies → `opencode.ai` → find the `auth` cookie (starts with `Fe26.2...`). Or run this in the console: `document.cookie.match(/(?:^\|;\s*)auth=([^;]+)/)?.[1]` |

**Automated setup** (recommended):
```sh
npm run setup
```
This prompts for both values and creates the file for you. It also prints a bookmarklet you can drag to your bookmarks bar and click while on opencode.ai to extract the auth cookie with one click.

**Tip:** keep a browser tab logged into opencode.ai while using this plugin — the auth cookie may expire.

### Relationship with [`@slkiser/opencode-quota`](https://github.com/slkiser/opencode-quota)

**No dependency.** Both plugins fetch quota independently and render their own sidebar panels. You can have one, both, or none — they do not interfere.

### Troubleshooting

- **Panel doesn't appear**: `grep '@arandevcode/opencode-quota-extended' ~/.local/share/opencode/log/*.log`
- **OpenCode Go shows "skipped"**: confirm sidecar file or env vars are set
- **Old `@opentui/solid` pinning bug**: update to `^0.4.1` and clean-install (`rm -rf node_modules && npm ci`)

### Development

```sh
npm run build        # compile TS + copy TUI assets
npm run build:watch  # watch mode
npm test             # vitest
npm run typecheck    # type-check without emitting
```

### Project structure

```
src/
  index.ts            # Plugin module (server entry)
  server.ts           # Server plugin (minimal, no tools)
  tui.tsx             # TUI plugin: sidebar_content slot
  config/             # defaults, schema, loader
  lib/                # types, auth, http, formatting, credential resolver
  providers/          # openai.ts, copilot.ts, opencode-go.ts, registry.ts
  ui/                 # SidebarPanel, cards, progress-bar
tests/                # vitest unit tests
```

## License

MIT
