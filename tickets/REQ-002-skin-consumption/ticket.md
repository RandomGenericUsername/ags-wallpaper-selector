---
id: REQ-002
title: "Consume the app-scoped skin plane in the wallpaper selector"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-002/
branch: ticket/REQ-002-skin-consumption
---

# Consume the app-scoped skin plane in the wallpaper selector

## Requirement

The platform v0.8.0 exposes `createAppSkin({ configDir })`; the runtime emits
`$XDG_CONFIG_HOME/<configDir>/skin.css`. Wire this app's instance for
`configDir: "ags-wallpaper-selector"` and apply it at startup, minimal and
without redesign:

- `app.tsx` holds one module-level
  `const skin = createAppSkin({ configDir: "ags-wallpaper-selector" })` and
  calls `skin.apply()` immediately after `theme.apply()` in `main()`.
- The existing palette-refresh handler and the `wallpaper.state` progress
  subscription stay untouched. No skin-refresh request handler is added: the
  adapter's file monitor reloads `skin.css`.
- `style.css` remains the bundled glass fallback.
- No structure, class, gesture, size or behavior change. Layout tokens are
  TSX-owned; none apply in v1.
- The local pin moves to `ags-platform` v0.8.0 and `contracts` v0.6.0, with
  local `.dev/` overrides for the gates.
- A source-level test asserts the apply order and configDir, the absence of a
  new request handler, and the continued presence of `style.css`.

## Acceptance

- [ ] `app.tsx` creates the app-scoped Skin at module scope with
      `configDir: "ags-wallpaper-selector"` and applies it immediately after
      `theme.apply()` in `main()`.
- [ ] The palette-refresh handler and `wallpaper.state` progress subscription
      are unchanged; no skin-refresh request handler exists.
- [ ] `style.css` is still bundled through `app.start({ css: style })` and
      remains the glass fallback.
- [ ] `Makefile` pins `ags-platform` v0.8.0 and `contracts` v0.6.0; local
      `.dev/` links and any pin assertions agree.
- [ ] Source-level test covers the order, configDir, no new handler and
      `style.css` presence.
- [ ] `make gates` passes; v0.3.0 (next minor) is tagged after merge.
