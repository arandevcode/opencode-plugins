# Changelog

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
