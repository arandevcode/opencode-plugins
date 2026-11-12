# Changelog

## 0.5.0 — 2026-11-12
- Package: the `images` folder is no longer published to npm (the READMEs load them from GitHub), so the package shrinks from about 413 kB to 80 kB.
- CLI: `quota` now marks the active OpenCode Go account (`●` and `active`), draws the pace tick on each bar and shows the pace text (`margin +34% · 2d 9h`) at the right of the spend row, like the sidebar. The formatting lives in `src/lib/cli-format.ts` and is tested.
- Sidebar: providers with no credentials at all no longer get a card or count in the header. A user with only OpenCode Go and GitHub Copilot now sees `Quota (2/2)` instead of `2/3` plus an OpenAI row. Unconfigured providers are folded into one muted `▸ not set up: OpenAI` line; click it to see each provider's setup hint. The provider the current session is using keeps its own card and counts even when it is not set up, so a missing OpenCode Go key is still shown where it matters. Configured providers that fail (expired token, 403, outage) are still counted and shown. Thanks to @scottchiefbaker for reporting it (#4).
- OpenCode 2: the sidebar now uses the active terminal theme colors for quota bars and status text. V2 exposes colors as nested RGBA tokens (`text.feedback.success.base`, etc.); the previous adapter expected flat strings and silently fell back to hardcoded green/amber/red.
- Sidebar: on OpenCode 2, the footer now appends a `• OpenCode 2.2.5` line matching the 1.x footer style: success-colored dot, bold muted `Open`, bold brighter `Code`, and a muted version. OpenCode 1 already renders its own path + version footer, so the plugin leaves that one untouched.
- Sidebar: each progress bar now has a yellow pace tick at the share of the window still ahead. If the filled quota is to the left of the tick, usage is ahead of schedule; if it is to the right, there is margin. Works in both the v1 TUI and the v2 plugin because both render the same cards.
- OpenCode Go: when named accounts (`opencode-go-<suffix>.json`) exist, an unconfigured default `opencode-go.json` is no longer rendered with a "no API key" hint. Single-account setups keep the setup hint when nothing is configured.
- Sidebar: provider headers no longer wrap their account name into separate lines. The header shows only the compact dollar balance (`$12.40`), and the reading age (`just now`, `3m ago`) sits inline with the name instead of on its own row. Stale readings still show their warning on a second line.
- Sidebar: status-only providers (expired credentials, missing auth, setup required, no data) now use the same expandable header as normal cards: expand triangle, active marker, reading age, and a detail line when expanded instead of a single unstyled text row.
- Sidebar: cards are now session-aware. The provider used by the current session starts expanded and gets a yellow rail and bullet; the rest collapse to a two-line summary (`5h 98% · wk 80% · mo 78%`). Provider names and window labels are shortened in tight sidebars (`GO (personal)`, `Copilot (Individual)`, `wk 80%`), single-window providers show just `100%`. All cards reserve the same border columns so active and inactive content stays aligned; the active card is framed with a solid rounded yellow border and a little horizontal inner padding. Pace text drops the `margin`/`ahead` word so the spend row stays on one line in narrow sidebars. Click a header or summary line to expand/collapse; each session remembers its own state. For OpenCode Go, the active named account is read from `opencode-go-active.json` so the highlighted card matches the account in use. Works with both the v1 TUI session record/transcript and the v2 session client (`session.get`, `session.messages`, and `session.message.list`).
- Build: `npm run build` no longer deletes `dist` first, and copies `.tsx` files atomically. This stops the TUI plugin watcher from seeing a temporarily missing `tui.tsx` and reporting a false plugin failure. Use `npm run build:clean` when a clean output directory is needed.

## 0.4.0 — 2026-11-10
- Show the age of each provider's reading (`read 3m ago`) and turn the line amber once it is older than three polling intervals. The threshold follows `refreshIntervalMs`, so changing the polling interval also changes when data is considered stale.
- If a fetch fails (401/403, network error, provider outage), keep the last successful reading on screen as `stale` instead of replacing it with an error. Credential failures reuse the existing setup hint. The CLI does the same and prints the reading age.
- Add `window reset since this reading` when a quota window reset after the snapshot was fetched, so an old percentage is not mistaken for live data.
- Refresh age labels every 30 s without making API requests, and cache the last snapshot (quota numbers only, mode `600`) so readings survive restarts.
- Providers without credentials are no longer hidden. The panel shows a line saying exactly what is missing and how to fix it (for example, the `OPENCODE_GO_API_KEY` variable or the `opencode-go.json` path for OpenCode Go, or the `/connect` login for OpenAI and GitHub Copilot). Before, the header could read `1/3` with no explanation.
- Fix: `OPENCODE_GO_API_KEY` (and the other `OPENCODE_GO_*` variables) were documented but ignored for the default OpenCode Go instance, which only read `opencode-go.json`. The variable now works, taking precedence over the file; extra `opencode-go-<name>` instances still use their own files.
- OpenCode Go: a 401/403 response now points at the key's permissions (create a personal API key with All permissions, not a service account).
- Thanks to @scottchiefbaker for reporting the confusing `1/3` panel (#3), and to @irlevesque for the early `usagePercent` fix (#2), whose parser has since been replaced by the API-key endpoint.

## 0.3.2 — 2026-11-06
- OpenCode 2: read OpenAI and GitHub Copilot credentials from OpenCode 2 itself (plugin client `credential.list()`) instead of the OpenCode 1.x `auth.json`. Fixes "OpenAI: Token expired" caused by a stale OpenCode 1.x token.
- If OpenCode 2 has no credential for a provider, the OpenCode 1.x `auth.json` is still used as a fallback, and error messages now say which source was used.
- The plugin never refreshes tokens; an expired OpenCode 2 token is refreshed by OpenCode 2 on its next model request.
- OpenCode 1.x behavior is unchanged.

## 0.3.1 — 2026-11-06
- Fix installation from npm on OpenCode 1.x and 2: accept current `@opentui` versions (0.4 to 0.x), which the OpenCode plugin SDK now pulls in. Before this, `opencode plugin` failed with "unable to resolve dependency tree".
- README: separate install and uninstall steps for OpenCode 1.x and OpenCode 2, plus a compatibility table.

## 0.3.0 — 2026-11-06
- OpenCode 2 support (early preview): the package now registers on both OpenCode 1.x and 2.x; tested on 2.1.2.

## 0.2.4 — 2026-10-21
- OpenCode Go quota, spend and balance read with a personal API key.
- More compact sidebar layout.

## 0.2.3 — 2026-10-19
- Credit balance and usage pace in the sidebar.
- Coalesced TUI refreshes to stop provider error storms.

## 0.2.2 — 2026-08-06
- Allow OpenTUI 0.5 peer dependencies.

## 0.2.1 — 2026-08-05
- Packaging cleanup: removed stray files from the published package.

## 0.2.0 — 2026-08-05
- Theme-aware colors, single-row gauge, error boundary and guarded event handlers.

## 0.1.x — 2026-06 / 2026-07
- First releases: per-window quota cards for OpenAI, GitHub Copilot and OpenCode Go, plus the `quota` CLI.
