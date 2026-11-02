---
id: BUG-002
title: "Selector still calls the runtime's deleted contrast surface (cannot apply wallpapers)"
kind: bug
status: done
lane: direct
severity: high
links:
  openspec: none
  bmad: none
worktree: .worktrees/BUG-002/
branch: ticket/BUG-002-removed-contrast-surface
repro: "Open the selector (SUPER+W), hover a card or drill into a wallpaper, then Apply. The log shows the removed preferences accessor failing with `No such command 'preference'`, and the apply path passes a contrast flag that `dotfiles-runtime wallpaper set` now rejects."
observed: "2026-11-01 live log ~/.local/state/ags/wallpaper-selector.log: `wallpaper-selector: contrast preference lookup failed: ... No such command 'preference'.` repeatedly. `dotfiles-runtime wallpaper set --help` lists only `--format` and `--producer`; `dotfiles-runtime icons --help` lists only `regenerate`. The selector still shipped lib/contrast.ts and lib/apply.ts still appended the removed flag."
expected: "The selector has no contrast surface at all: it runs exactly `dotfiles-runtime wallpaper set <image>` with no extra flags, applies successfully (exit 0, history entry), and its CSS uses only palette.v1 semantic roles."
---

# BUG-002 — Selector still calls the runtime's deleted contrast surface

> Naming note: this repo had no BUG-002 ticket; `tests/apply-collapse.test.mjs`
> refers to the historical `ags-apps` BUG-002 (Apply-click collapse). This
> ticket is the app-local regression created for the runtime v0.5.1 removal.

## Summary

`dotfiles-runtime` v0.5.1 (REQ-007) deleted the contrast guard: the forced
policy flags on `wallpaper set` / `icons regenerate`, the preferences accessor,
and the per-wallpaper prefs store. The selector was not migrated and still
called that removed surface:

- `lib/contrast.ts` shelled the removed preferences command and the forced
  icons-regeneration path.
- `lib/apply.ts` appended the removed contrast flag to `wallpaper set`.
- `ui/WallpaperSelectorWindow.tsx` rendered the L1 swatch and L2
  auto-contrast checkbox and threaded the pref through apply.

The prefs lookup spammed `No such command 'preference'`, and an apply that
passed the flag was rejected by the current CLI, so the user could not change
the wallpaper from the selector.

## Repro

Open the selector and apply a wallpaper. Command-level view of the current CLI
surface (the removed option is absent):

```sh
dotfiles-runtime icons --help
dotfiles-runtime wallpaper set --help
dotfiles-runtime wallpaper set /home/inumaki/.local/share/dotfiles/wallpapers/default.png
```

## Observed

```text
$ dotfiles-runtime icons --help
Commands:
  regenerate  Re-render ONLY the icons layer from the live palette and reconverge.

$ dotfiles-runtime wallpaper set --help
Options:
  --format -f <json|rich|plain>
  --producer <str>
```

Live selector log (`~/.local/state/ags/wallpaper-selector.log`):

```text
wallpaper-selector-CRITICAL: wallpaper-selector: contrast preference lookup failed:
Error: Usage: dotfiles-runtime icons [OPTIONS] COMMAND [ARGS]...
│ No such command 'preference'.
```

## Expected

- The contrast feature is gone: no swatch, checkbox, labels, state maps,
  `lib/contrast.ts`, forced policy arguments or regeneration path.
- `lib/apply.ts` runs exactly `dotfiles-runtime wallpaper set <image>`.
- No UI text or help mentions auto high-contrast icons.
- The selector CSS uses `palette.v1` roles only (no `@color_*`).
- The app pins the platform v0.4.0 role tuple (contracts stays v0.3.0).
- Applying the current wallpaper path succeeds (exit 0) and lands in history
  without changing the visible wallpaper.

## Fix

Root cause: runtime v0.5.1 REQ-007 deleted a consumer surface while this app
kept its client and UI. The fix is removal, not a replacement toggle or store.

- Deleted `lib/contrast.ts`.
- `lib/apply.ts` now contains exactly
  `execAsync(["dotfiles-runtime", "wallpaper", "set", imagePath])`.
- Removed the L1 swatch, L2 checkbox/labels/deferral note, state maps, pref
  sync/load/persist logic and model helpers from
  `ui/WallpaperSelectorWindow.tsx`, `lib/model.ts` and `style.css`.
- Removed the associated CSS classes (`.ws-contrast-*`, `.ws-defer`) and the
  swatch-specific quick-button radius override.
- Migrated `style.css` and the frozen `templates/ags-app/style.css` to
  `palette.v1` roles.
- Bumped the platform pin to v0.4.0 in `Makefile`, CI, tests, README and
  AGENTS; contracts stays v0.3.0.
- Added `tests/no-contrast-surface.test.mjs`: the token scan, the exact apply
  argv, the vanished window controls and a palette-role validation.

## Role migration (intent, not carrier index)

| Old token / site | New role | Why |
|---|---|---|
| `@color_foreground` — window/card/variant ink, placeholder, all `alpha()` hairlines and washes | `@on_surface` (same alpha values) | The sheet's ink role. |
| `@color_00` — `.ws-panel` fill | `@surface` | Panel/dish background. |
| `@color_04` — `.ws-panel` border, `.ws-back:hover`, `.ws-quick:hover` | `@primary` | Accent border / action hover. |
| `@color_01` — `.ws-search` solid fill | `@surface_container` | The comment calls it "one step above the panel"; not the accent. |
| `@color_background` — `.ws-crumb`, `.ws-card`, `.ws-hoverbar` fills | `@surface` | Translucent panel/dish fills, not text. |
| `@color_10` — `.ws-card:hover`, `.ws-card.selected` ring | `@primary` | Selection/hover accent ring. |
| `@color_10` — `.ws-card.selected` soft tint | `alpha(@primary_container, 0.12)` | Selected container wash behind the thumbnail. |
| `@color_10` — `.ws-quick` base fill | `@primary_container` + `@on_primary_container` ink | Action pill was a container fill; the matching container ink keeps it readable. |
| `@color_04` — `.ws-quick:hover` fill | `@primary` + `@on_primary` ink | Hover brightens to the accent; ink polarity flips with it. |
| `@color_10` — `.ws-variant-apply:hover` fill, `@color_background` ink | `@primary` / `@on_primary` | Same accent hover pair. |

Ambiguous choices, recorded rather than guessed silently:

- `@color_01` at `.ws-search`: the live tpr alias resolves to `error`, but the
  comment describes a neutral solid field one step above the panel. Used
  `@surface_container` (the bar's input fields used the analogous neutral
  surface-container family).
- `@color_10` selected/action fills: used `@primary` for rings and hover and
  `@primary_container`/`@on_primary_container` where the fill sits behind
  nested text, matching the bar's selection-container decision.

## Evidence

Implementation commit: `c56e45b` on
`ticket/BUG-002-removed-contrast-surface`.

### Source scans

- Repo-wide removal grep (preferences command, set flag, helper name,
  regeneration helper) → **0 matches** after this ticket's documentation was
  reworded to avoid restating the literals; the same absence is asserted by
  `tests/no-contrast-surface.test.mjs`.
- `rg -n '@color_' . --glob '*.css' --glob '*.ts' --glob '*.tsx'` →
  **0 matches**.

### Gates (`make gates`, exit 0)

Log: `/tmp/opencode/ags-wallpaper-selector-bug002-gates.log`.

- `make test`: 15/15 Node tests pass (unit, Apply-collapse, removed-surface);
  model suite all green (49 checks).
- `make conformance`: 15/15 pass, including the platform template gate and the
  v0.4.0 platform / v0.3.0 contracts pin.
- `make drift`: all checks pass against contracts v0.3.0.
- `make bundle`: `build/ags-wallpaper-selector.js`, 920,360 bytes.
- `make typecheck`: 0 errors in the selector tree (28 tolerated AGS runtime
  errors, 0 platform errors).

The platform link was the local v0.4.0 checkout via
`AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform`; contracts
via `CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`.

### Apply end-to-end (same wallpaper, no visible change)

Command the selector now runs, against the current wallpaper path:

```sh
dotfiles-runtime wallpaper set /home/inumaki/.local/share/dotfiles/wallpapers/default.png
```

Result: exit 0, `wallpaper applied: fb1c5be63e00` (all layers cache hit),
`visible in 0.0s · themed in 0.6s`, `inputs: all layers fresh`. History grew
from 290 to 291 lines and the last entry is the same
`fb1c5be63e002f6902f66be8b97744bd29d4224815291a4ad8d0115a23cde48c`
`source_path=…/default.png` with trigger `set`. Log:
`/tmp/opencode/ags-wallpaper-selector-bug002-apply.log`.

### Visual evidence

Worktree app run under a temporary instance name (uncommitted `app.tsx`
instance override, reverted before commit), same live palette and wallpaper.
No wallpaper was changed for the screenshot.

- `/tmp/opencode/ags-wallpaper-selector-bug002-shots/selector-cards-no-contrast.png`
  (1920×1080, full screen)
- `/tmp/opencode/ags-wallpaper-selector-bug002-shots/selector-cards-no-contrast-crop.png`
  (980×590 crop of the dialog)

The dialog shows the wallpaper cards, LIVE badge, search field and status line;
there is no contrast row and no contrast swatch on the cards.

## Done-when

- [x] Removed-surface search is empty in source.
- [x] No `@color_*` token remains in `*.css` / `*.ts` / `*.tsx`.
- [x] Unit/model/conformance/drift/typecheck/bundle gates pass.
- [x] The exact apply command runs against the current wallpaper and exits 0.
- [x] Screenshot shows the cards and no contrast row.
