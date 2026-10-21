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

## Uninstall

Four steps, in order:

1. Remove the plugin entry from your OpenCode config (`~/.config/opencode/opencode.json`):

   ```jsonc
   // delete the @arandevcode/opencode-quota-extended lines inside "plugin": []
   {
     "plugin": [
       "@arandevcode/opencode-quota-extended", // ← remove
       "@arandevcode/opencode-quota-extended/tui",  // ← remove
       "@arandevcode/opencode-quota-extended/server" // ← remove
     ]
   }
   ```

2. Delete the optional sidecar config and OpenCode Go credential file (only if you created them):

   ```sh
   rm -f ~/.config/opencode/opencode-quota-extended.json
   rm -rf ~/.config/opencode/opencode-quota
   ```

3. (Optional) Remove the global CLI binary if you installed it:

   ```sh
   npm rm -g @arandevcode/opencode-quota-extended
   ```

4. (Optional) Remove any local source clone you may have used to follow development:

   ```sh
   rm -rf ./opencode-quota-extended
   ```

Restart OpenCode and the Quota panel will be gone. **Note:** the plugin does **not** store or touch `~/.local/share/opencode/auth.json` — your auth tokens are never modified.

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

Traffic-light colors: green (ok), orange (warning), red (error). All colors come from the active OpenCode theme — they adapt to the user's palette automatically.

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
| **OpenCode Go** | 5h, Weekly, Monthly + spend | Personal API key (or legacy session cookie) |

Traffic-light colors: ≥50% `theme.success` (green), 25-49% `theme.warning` (orange), <25% `theme.error` (red).

### Authentication

Reads credentials from OpenCode's runtime auth file (`~/.local/share/opencode/auth.json`). Does **not** store, prompt for, or distribute secrets.

**OpenCode Go** uses a personal API key. The plugin calls the same console endpoint as the dashboard and reads the three quota windows, the dollar spend per window, and the prepaid credit balance.

Create `~/.config/opencode/opencode-quota/opencode-go.json`:

```json
{
  "apiKey": "oc_sk_..."
}
```

| Field | Description | How to get it |
|---|---|---|
| `apiKey` | Personal OpenCode API key | Open [opencode.ai/console](https://opencode.ai/console) → **Personal API keys** → create a key with **All** permissions. Copy the `oc_sk_...` value. Do not use a service-account key: service accounts cannot read billing. |

The key is stored with mode `600` and is only sent to `opencode.ai`. An **All** key shows quota, dollar spend and credit balance. A `read` key is not enough for this plugin: it cannot call `go/status`.

**Multiple workspaces/accounts:** any `opencode-go-<suffix>.json` file in the same directory adds an extra `Opencode GO (<suffix>)` section (e.g. `opencode-go-work.json` → **Opencode GO (work)**). The base `opencode-go.json` always renders as **OpenCode Go**. The `opencode-go-<suffix>-key.json` files maintained by the account switcher are ignored by the quota plugin.

```sh
# e.g. a second workspace
cp ~/.config/opencode/opencode-quota/opencode-go.json \
   ~/.config/opencode/opencode-quota/opencode-go-work.json
# then replace apiKey inside opencode-go-work.json
```

**Automated setup** (recommended):
```sh
npm run setup            # base account -> opencode-go.json
npm run setup work       # extra account -> opencode-go-work.json
```
This prompts for the API key, writes the file with mode `600`, and prints where to create the key.

You can also use `OPENCODE_GO_API_KEY` instead of a file.

**Legacy:** `{ "workspaceId": "wrk_...", "authCookie": "st_..." }` is still accepted for backwards compatibility, but the browser session cookie expires. Prefer the API key.

**Migrating an existing account:** if you already have `opencode-go-<Account>.json`, replace its entire contents with `{ "apiKey": "oc_sk_..." }`. No `workspaceId` or `authCookie` needed. `npm run setup <Account>` is case-sensitive: the suffix must match the filename exactly.

### Relationship with [`@slkiser/opencode-quota`](https://github.com/slkiser/opencode-quota)

**No dependency.** Both plugins fetch quota independently and render their own sidebar panels. You can have one, both, or none — they do not interfere.

### Troubleshooting

- **Panel doesn't appear**: `grep '@arandevcode/opencode-quota-extended' ~/.local/share/opencode/log/*.log`
- **OpenCode Go shows "skipped"**: confirm the sidecar file or `OPENCODE_GO_API_KEY` is set
- **OpenCode Go shows 401/403**: the key is invalid, expired or lacks permissions; create a personal **All** key (service-account keys cannot read billing)
- **Old `@opentui/solid` pinning bug**: use `^0.4.1 || ^0.5.0` and clean-install (`rm -rf node_modules && npm ci`)

### Development

```sh
npm run build        # compile TS + copy TUI assets
npm run build:watch  # watch mode
npm test             # vitest
npm run typecheck    # type-check without emitting
```

### TUI Patterns & Theme

Colors are sourced live from `api.theme.current`. The traffic-light mapping is theme-aware:

| Remaining | Color (theme key) | Hex default (AMOLED) |
|---|---|---|
| ≥50% | `theme.success` (green) | `#00ff88` |
| 25-49% | `theme.warning` (orange) | `#ffea00` |
| <25% | `theme.error` (red) | `#ff1744` |

The progress bar follows the `opentui-theme-colors` gauge pattern: one `<text>` per cell, `bg={themeColor}` on filled cells and `bg={theme.backgroundElement}` on empty cells, with the percent label rendered in the foreground with proper contrast (`backgroundPanel` on filled, `textMuted` on empty). This is the same pattern as the context progress bar in `@arandevcode/opencode-stats`.

The old `flexGrow` ratio bar and the hardcoded hex values (`#6b8e23`, `#ffa500`, `#ff6b6b`) are gone.

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
