# Changelog

## 0.5.0 — 2026-11-12
- Change: on OpenCode 2 the status badge now lives in the host prompt's additive right slot and the sidebar status sits above the host footer, so OpenCode 2 keeps its own location and version lines and the plugin never owns (or duplicates) the prompt. It coexists with other TUI plugins that render a composer.
- Fix: keymap commands use `name`/`category` instead of `id`/`group`.
- Change: the OpenCode 1.x composer border wraps the host prompt in a stable bordered box, so toggling it never remounts the prompt.

## 0.4.0 — 2026-11-10
- Fix: the band stayed on `IDLE` while subagents were running. `WORKING` now covers the main turn **and every subagent**, foreground or background, nested at any depth.
- New: `WAITING · TASK` / `WAITING · 2 TASKS` in amber on OpenCode 2 when the turn is over but a background shell is still alive. OpenCode 1.x has no reliable plugin-facing signal for this, so it goes `WORKING` → `IDLE` there.
- New: focused-conversation tree tracking. Sessions from another conversation no longer influence the band; this replaces the 0.3.2 rule that ignored all subagents.
- New: 400 ms settle window when leaving `WORKING`, so a foreground subagent handoff or a background task waking its parent never flashes `IDLE`/`WAITING`.
- Change: `WORKING` cycles `theme.primary` → `theme.accent` → `theme.success` → `theme.error`; `WAITING` is solid `theme.warning` and `IDLE` is solid `theme.success`. Warning is reserved for waiting so it cannot be confused with the working animation.
- Change: a shared state machine (`src/state.ts`) now computes the state for both OpenCode generations, with v1 event/tree and v2 store/shell adapters.
- Fix: the OpenCode 2 sidebar border now finds the right-anchored pane at any width, keeps its decoration through transient reflows, and no longer flickers or changes the root padding. Narrow terminals hide the sidebar, so there is nothing to frame.
- Docs: new states table, compatibility details, update instructions and simulated screenshots/GIFs with made-up data.

## 0.3.2 — 2026-11-06
- Fix: on OpenCode 2 the WORKING/IDLE indicator stayed on IDLE while the model was running. The TUI event listener receives `{ details }` and the adapter read `event.type` from the wrapper, so `session.execution.started` never matched. The adapter now unwraps the envelope (and still accepts unwrapped events).
- Fix: treat `session.execution.interrupted` as idle, alongside `succeeded` and `failed`.
- Fix: no more stray empty bordered box above the prompt on OpenCode 2, where the prompt element is not available.
- Fix: the spinner and color animation stayed frozen on OpenCode 2. The TUI entry was pre-compiled by tsc, which removes Solid's reactive JSX transform; it now ships as `dist/tui.tsx` and is compiled by the host runtime, so signals update live.
- Fix: the indicator no longer reacts to other sessions or subagents running in the background; it follows only the focused session and syncs when you switch.
- Change: on OpenCode 2 the indicator is now a full-width bar with a colored top border above the composer (`session.composer.top`), since the prompt itself cannot be wrapped.
- Change: the sidebar title box was removed. `WORKING`/`IDLE` now sits at the bottom of the sidebar, above the `cwd:branch` line (`before: sidebar.footer`).
- Change: the whole sidebar is framed with a heavy border; the sidebar is widened by the border width so its content (quota percentages, etc.) is not clipped, and the frame is kept clear of the terminal's clipped right edge.

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
