# Changelog

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
