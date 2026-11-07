---
id: REQ-006
title: "Move the wallpaper selector to Generations v3"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-006/
branch: ticket/REQ-006-generations-v3
---

# Move the wallpaper selector to Generations v3

## Requirement

The program tuple moves to `ags-platform` v1.0.0 / `contracts` v0.8.0
(Generations v3; runtime v1.0.0). Platform v1.0.0's
`createAppearanceRefreshHandler` implements the generation-bound
`appearance-refresh <genHash>` protocol, and `createAppearance` reads
`$XDG_STATE_HOME/dotfiles/current/manifest.json` plus
`current/appearance/<configDir>.css`. The selector must adopt that tuple
without changing its app-owned behavior:

- The local pins in `Makefile` (and the CI checkout refs) are
  `ags-platform` v1.0.0 / `contracts` v0.8.0.
- `app.tsx` keeps exactly one module-scope
  `createAppearance({ configDir: "ags-wallpaper-selector" })`, still calls
  `appearance.apply()` in `main()`, and still registers
  `createAppearanceRefreshHandler(appearance, work)` with the search-icon
  work.
- The handler answers the v3 `appearance-refresh <genHash>` protocol only;
  the removed v2 `palette-refresh` acknowledgement is not asserted anywhere
  in the source tests.
- The `wallpaper.state` progress subscription and the namespaced layout
  tokens with their `960` / `640` fallbacks are unchanged.
- `make gates` passes with local `.dev/` overrides, the branch fast-forwards
  into `main`, and `v0.5.0` (next minor) is tagged and pushed with `main`.

## Acceptance

- [ ] `Makefile` and `.github/workflows/ci.yml` pin platform v1.0.0 and
      contracts v0.8.0; the pin gate asserts the new tuple.
- [ ] `tests/unit.test.mjs` exercises `appearance-refresh <genHash>`: apply
      before work, one exact-hash response, idempotent work per generation,
      deferred on a moved pointer, and a retryable apply failure. No v2
      `{ok:true}` or `palette-refresh` assertion remains.
- [ ] `app.tsx`, `lib/appearance.ts` and `ui/WallpaperSelectorWindow.tsx`
      keep the same appearance/apply/handler and `wallpaper.state` behavior;
      stale protocol comments name v3.
- [ ] `make gates` passes with local `.dev/ags-platform/v1.0.0` and
      `.dev/contracts/v0.8.0` symlinks.
- [ ] The ticket branch fast-forwards `main`, `v0.5.0` is tagged, and both
      `main` and the tag are pushed.
