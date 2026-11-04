---
id: BUG-003
title: "L1 hover toolbar puts the Apply pill off-centre in its container"
kind: bug
status: done
lane: direct
severity: low
links:
  openspec: none
  bmad: none
worktree: .worktrees/BUG-003/
branch: ticket/BUG-003-hoverbar-apply-offset
repro: "Open the selector (`ags request show -i wallpaper-selector` or the launcher) and hover a wallpaper card that has variants (for example `abstract.jpg`, `20 variants`); observe the Apply control in the lower-right of the thumbnail."
observed: "The dark rounded hoverbar container has ~6px extra space on the right/bottom only while the Apply pill is flush on the left/top, so the pill looks offset/lopsided inside its container."
expected: "The hoverbar wraps the Apply pill with even spacing on all sides, and the assembled pill is inset from the thumbnail edge by exactly one offset (the hoverbar margin)."
---

# BUG-003 — L1 hover toolbar puts the Apply pill off-centre

## Summary

The L1 hover toolbar is a `Gtk.Box.ws-hoverbar` containing one
`Gtk.Button.ws-quick` ("Apply"). Both the container and the button declare
`margin: 0 6px 6px 0` (`style.css:146` and `style.css:164`). The doubled
right/bottom margin moves the button 6px away from the container's right and
bottom edges while it stays flush against the top and left edges. The container
background and border therefore read as an asymmetric slab behind the pill —
"the apply button seems like offset with a container that holds it".

The fix belongs in CSS, not in the widget tree: the hoverbar is already the
single compact pill (`ui/WallpaperSelectorWindow.tsx:315-333`); it only needs
to own the inner spacing symmetrically.

## Repro

```sh
ags request show -i wallpaper-selector
# or: ags toggle wallpaper-selector-window -i wallpaper-selector
```

Hover a wallpaper card with variants (for example `abstract.jpg`,
`20 variants`) and look at the Apply control in the lower-right of the
thumbnail.

## Observed

The dark hoverbar container extends ~6px past the Apply pill on the right and
bottom edges; the pill is flush with the container on the left and top. The
pill is not centred in its own container.

`Evidence:` `style.css:142-148` and `style.css:158-167` both carry
`margin: 0 6px 6px 0`; the button is the hoverbar's only child.

## Expected

- The hoverbar supplies even padding on all four sides of the Apply pill.
- The Apply button carries no margin of its own (no duplicate offset).
- The hoverbar keeps one offset from the thumbnail edge (its existing
  right/bottom margin), so the floating-pill design is unchanged.

## Fix

`.ws-hoverbar` now owns the inner spacing with `padding: 3px` on all sides and
`.ws-quick` carries `margin: 0`. The bar keeps `margin: 0 6px 6px 0` as the
single offset from the thumbnail edge, so the floating pill stays compact and
the assembled control is positioned exactly as before — only the inner spacing
is now symmetric.

## Regression test

`tests/hoverbar-layout.test.mjs` reads `style.css` and asserts three things:

1. `.ws-quick` has no margin of its own (all four sides zero).
2. `.ws-hoverbar` has equal, non-zero padding on every side.
3. `.ws-hoverbar` keeps exactly one offset: top/left zero, right/bottom
   equal and positive.

Registered in the `Makefile` `test` target, which is a prerequisite of `ci`.

Against the pre-fix stylesheet the test fails 2/3 assertions:
`git show HEAD:style.css > style.css && node --test
tests/hoverbar-layout.test.mjs` → exit 1, with
`actual { top: 0, right: 6, bottom: 6, left: 0 }` for the button margin and
"the hoverbar needs its own inner padding". Against the fix it passes 3/3.

## Evidence

Implementation commit: `3cf9dec` on
`ticket/BUG-003-hoverbar-apply-offset`.

### Gates

Environment: local platform checkout via
`AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform`, contracts
via `CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`.

- `make ci` — exit 0. Log: `/tmp/opencode/bug003-ci.log`.
  - Node tests 18/18 pass (including the 3 new hoverbar assertions).
  - `model.test.mjs`: all 49 checks green.
  - `app-contract.test.mjs`: 15/15 pass, including the platform template and
    v0.4.0/v0.3.0 pin gates.
  - Drift: all checks pass.
- `make gates` — exit 0 on the rerun. Log:
  `/tmp/opencode/bug003-gates-2.log`.
  - `test` / `conformance` / `drift` same results as above.
  - `make bundle`: `build/ags-wallpaper-selector.js`, 920,872 bytes.
  - `make typecheck`: 0 errors in the selector tree (28 tolerated
    `/usr/share/ags/js` errors, 0 platform errors).
  - First-run note: the first `make gates` in this worktree failed at
    `typecheck` with `FAIL: typecheck: platform link missing` because the
    `deps` prerequisite's `npm install --no-save` pruned the extraneous
    `node_modules/ags-platform` symlink after `platform-dev` had already run
    in the same make invocation (log:
    `/tmp/opencode/bug003-gates.log`). Rerunning with the toolchain already
    present passed as recorded above; no app code is involved.

### Visual check (live)

Ran the fixed worktree app as a temporary instance
`wallpaper-selector-bug003` (uncommitted `instanceName` override, reverted
before the closeout commit), hovered a card with variants and captured the
result:

- `/tmp/opencode/bug003-shots/hover-map-under-cursor.png` (1920×1080)
- `/tmp/opencode/bug003-shots/hoverbar-valid-5x.png` (5× crop of the Apply
  control)

The dark hoverbar wraps the Apply pill with equal space on the left/right and
top/bottom; the pill is no longer flush on the left/top while padded on the
right/bottom. The toolbar remains in the lower-right of the thumbnail.

## Done-when

- [x] Ticket opened with repro/observed/expected and severity.
- [x] CSS fix keeps the compact floating pill but makes the inner spacing
  symmetric.
- [x] Static CSS regression test registered in `make test` / `make ci`.
- [x] `make ci` and local `make gates` pass; visual check recorded.
- [x] `Unreleased` CHANGELOG entry added; no tag/release/deploy.
