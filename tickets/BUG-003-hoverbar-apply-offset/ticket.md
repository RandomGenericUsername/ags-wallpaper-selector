---
id: BUG-003
title: "L1 hover toolbar puts the Apply pill off-centre in its container"
kind: bug
status: triage
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

## Fix notes

Remove the button margin and give `.ws-hoverbar` symmetric `padding`. Keep the
existing `margin: 0 6px 6px 0` on the bar as the single offset from the
thumbnail edge, the compact radius, and `min-height: 0`.

Regression test: `tests/hoverbar-layout.test.mjs` reads `style.css` and asserts
the spacing contract (button margin all zero; hoverbar padding equal on all
sides; hoverbar only offset on the right/bottom).

## Evidence

MISSING — filled by the fix/closeout commits.

## Done-when

- [ ] Ticket opened with repro/observed/expected and severity.
- [ ] CSS fix keeps the compact floating pill but makes the inner spacing
  symmetric.
- [ ] Static CSS regression test registered in `make test` / `make ci`.
- [ ] `make ci` and local `make gates` pass; visual check recorded.
- [ ] `Unreleased` CHANGELOG entry added; no tag/release/deploy.
