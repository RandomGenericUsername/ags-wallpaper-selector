---
id: REQ-004
title: "Restore the pre-v2 960×640 window default fallback"
kind: requirement
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-004/
branch: ticket/REQ-004-layout-default-size
---

# Restore the pre-v2 960×640 window default fallback

## Requirement

The v2 Appearance migration replaced the pre-v2 window default of `960×640`
with the skin layout tokens' CSS-derived `920×600` fallbacks, changing the
window size when no layout token is present. The assets manifest is being
corrected to `960×640` in v0.12.2, so the app fallbacks must agree with the
pre-v2 defaults:

- `ui/WallpaperSelectorWindow.tsx` still reads
  `layout.ags-wallpaper-selector.root-width` / `root-height`.
- The `appearance.value(...)` fallbacks are `960` / `640`, restoring the pre-v2
  default size.
- No other behavior, class or structure changes: the `wallpaper.state`
  progress subscription and the appearance refresh handler stay as they are.
- The source-level layout-token test asserts the new fallback values.
- v0.4.1 (patch) is tagged after `make gates` passes and the fast-forward merge
  completes.

## Acceptance

- [x] `ui/WallpaperSelectorWindow.tsx` reads both layout tokens with `960` /
      `640` fallbacks and feeds them into the existing root size request.
- [x] The `wallpaper.state` subscription and appearance handler are unchanged;
      no class, structure or other behavior change is introduced.
- [x] `tests/appearance-consumption.test.mjs` asserts the `960` / `640`
      fallbacks; the unchanged `style.css` glass minimum assertion stays.
- [x] `make gates` passes with local `.dev/` overrides.
- [x] v0.4.1 is tagged after the fast-forward merge; no push.

## Evidence

Implementation commit: `8f0f44f` on
`ticket/REQ-004-layout-default-size` (opened by `3903f9a`). Worktree
`.worktrees/REQ-004/`, branch `ticket/REQ-004-layout-default-size`.

### Fallbacks

`Evidence:` `ui/WallpaperSelectorWindow.tsx:80-90` still reads both tokens via
`appearance.value(...)`; the fallback literals are now `960` and `640`;
`:187-189` feeds `rootWidth()` / `rootHeight()` into the existing root size
request. The implementation diff changes only those two literals and their
comment in this file.
`Verify:` `git show 8f0f44f -- ui/WallpaperSelectorWindow.tsx`.

`Evidence:` `tests/appearance-consumption.test.mjs:172-186` asserts the `960` /
`640` fallbacks; `:188-195` still asserts the unchanged `style.css` `920px` /
`600px` glass minimum.
`Verify:` `node --test tests/appearance-consumption.test.mjs` → 6/6 pass.

### Unchanged behavior

`Evidence:` `app.tsx:49` still registers
`createAppearanceRefreshHandler(appearance, …)` and `:58` still calls
`appearance.apply()`; `ui/WallpaperSelectorWindow.tsx:584` still subscribes
`domainEvents` to `WALLPAPER_STATE_TOPIC`; `:547-553` still exposes only
`refreshSelectorChrome`. The implementation commit changes no class, structure
or handler line.
`Verify:` `git show --stat 8f0f44f`.

### Resulting default size

`Evidence:` the pre-v2 window attributes remain `default_width={960}` /
`default_height={640}` (`ui/WallpaperSelectorWindow.tsx:619-620`), and the
layout-token fallbacks now match them (`:83-90`). With the assets v0.12.2
manifest at `960×640`, the root size request resolves to **960×640** whether or
not the layout tokens are present. `style.css` keeps its `920×600` glass
minimum only as the bundled CSS floor.

### Gates

Local overrides used for the gates (gitignored, not committed):

```sh
ln -sfn /home/inumaki/Development/dotfiles/ags-platform .dev/ags-platform/v0.9.0
ln -sfn /home/inumaki/Development/dotfiles/contracts .dev/contracts/v0.7.0
```

`make gates` → exit 0. Log: `/tmp/opencode/req004-gates.log`.

- Node tests 22/22 pass, including the updated layout-token assertion;
  `model.test.mjs` → `model: all green`.
- `app-contract.test.mjs` → 15/15 pass, including the platform
  `checkAppRepo` template gate and the v0.9.0/v0.7.0 pin gate.
- Drift → `all checks passed` against contracts v0.7.0.
- Bundle → `build/ags-wallpaper-selector.js`, 1,024,064 bytes.
- Typecheck → 0 errors in the selector tree (28 tolerated
  `/usr/share/ags/js` errors, 0 `ags-platform` errors).

The first gate attempt installed the gitignored TypeScript dependency into the
fresh worktree; npm pruned the `node_modules/ags-platform` symlink during that
install, so the typecheck prerequisite failed. The rerun above is the
authoritative full pass after `deps` was satisfied.

### Deviations

- `style.css` is unchanged at its `920px` / `600px` glass minimum; only the TSX
  fallbacks move to `960` / `640`.
- `README.md`, `AGENTS.md` and `CHANGELOG.md` were updated to match the new
  fallbacks. No local-only artifact is committed.
