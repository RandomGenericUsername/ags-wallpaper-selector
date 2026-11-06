---
id: REQ-003
title: "Migrate the wallpaper selector to the v2 Appearance plane"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-003/
branch: ticket/REQ-003-appearance-migration
---

# Migrate the wallpaper selector to the v2 Appearance plane

## Requirement

The contracts v0.7.0 / platform v0.9.0 Appearance plane replaces the split
Theme + Skin pair with one composed generation: `createAppearance({ configDir })`
applies palette + skin + mode from the single `current/appearance` hop, and
`createAppearanceRefreshHandler(appearance, work?)` always re-applies the whole
appearance before app-owned derived work. Migrate this app without a redesign:

- `app.tsx` holds one module-level
  `const appearance = createAppearance({ configDir: "ags-wallpaper-selector" })`
  and calls `appearance.apply()` in `main()` instead of `theme.apply()` /
  `skin.apply()`.
- The one `palette-refresh` handler becomes
  `createAppearanceRefreshHandler(appearance, work)`. The app-owned work is the
  existing search-icon rebuild (and the platform apply refreshes the appearance
  cache); the `wallpaper.state` progress subscription in the window stays, and
  no new request command is added.
- Namespaced layout tokens that exist for this app are consumed in TSX:
  `layout.ags-wallpaper-selector.root-width` (fallback `920`) and
  `layout.ags-wallpaper-selector.root-height` (fallback `600`). The accessors
  feed the existing root size request; `.peek()` is used only where a plain
  number is required.
- `style.css` remains the bundled glass fallback; no structure, class, gesture
  or behavior change.
- The local pin moves to `ags-platform` v0.9.0 / `contracts` v0.7.0, with local
  `.dev/` overrides for the gates.
- A source-level test asserts the module-level appearance apply/configDir, the
  `createAppearanceRefreshHandler` wiring, the preserved `wallpaper.state`
  subscription, the layout-token reads and the retained `style.css` fallback.

## Acceptance

- [ ] `app.tsx` creates one module-scope Appearance for
      `configDir: "ags-wallpaper-selector"` and applies it in `main()`; no
      `theme.apply()` or `skin.apply()` survives.
- [ ] The request handler is `createAppearanceRefreshHandler(appearance, work)`
      and the work rebuilds the search icon only; the `wallpaper.state`
      progress subscription is unchanged and no new request command exists.
- [ ] `layout.ags-wallpaper-selector.root-width` / `root-height` are read with
      their `920` / `600` fallbacks and drive the root size request.
- [ ] `style.css` is still bundled through `app.start({ css: style })` and
      remains the glass fallback; no structure/class/behavior change.
- [ ] `Makefile` pins `ags-platform` v0.9.0 and `contracts` v0.7.0; local
      `.dev/` links and every pin assertion agree.
- [ ] Source-level test covers appearance apply/configDir/handler, the retained
      progress subscription, the layout tokens and `style.css`.
- [ ] `make gates` passes; v0.4.0 (next minor) is tagged after the
      fast-forward merge.
