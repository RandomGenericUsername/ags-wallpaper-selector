---
id: REQ-004
title: "Restore the pre-v2 960×640 window default fallback"
kind: requirement
status: in-progress
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

- [ ] `ui/WallpaperSelectorWindow.tsx` reads both layout tokens with `960` /
      `640` fallbacks and feeds them into the existing root size request.
- [ ] The `wallpaper.state` subscription and appearance handler are unchanged;
      no class, structure or other behavior change is introduced.
- [ ] `tests/appearance-consumption.test.mjs` asserts the `960` / `640`
      fallbacks; the unchanged `style.css` glass minimum assertion stays.
- [ ] `make gates` passes with local `.dev/` overrides.
- [ ] v0.4.1 is tagged after the fast-forward merge; no push.
