# Changelog

## 0.3.0 — 2026-11-06
- OpenCode 2 support (early preview): the package now registers on both OpenCode 1.x and 2.x; tested on 2.1.2.
- Fix installation from npm on OpenCode 1.x and 2: accept current `@opentui` versions (0.4 to 0.x). Before this, `opencode plugin` failed with "unable to resolve dependency tree".
- README: separate install and uninstall steps for OpenCode 1.x and OpenCode 2, plus a compatibility table.
- Fix: Esc did not interrupt a running session (issue #1). The prompt was re-created on every animation tick, resetting its focus and the "esc again to interrupt" state; it is now created once.

## 0.2.2 — 2026-08-06
- Allow OpenTUI 0.5 peer dependencies.

## 0.2.1 — 2026-08-05
- Packaging cleanup: removed stray files from the published package.

## 0.2.0 — 2026-08-05
- Colors follow the active OpenCode theme; error boundary and guarded event handlers.

## 0.1.x — 2026-06
- First releases: animated rainbow border and sidebar glow while the model is thinking, plus IDLE state.
