---
id: BUG-002
title: "Selector still calls the deleted icon-contrast surface (cannot apply wallpapers)"
kind: bug
status: in-progress
lane: direct
severity: high
links:
  openspec: none
  bmad: none
worktree: .worktrees/BUG-002/
branch: ticket/BUG-002-removed-contrast-surface
repro: "Open the selector (SUPER+W), hover a card or drill into a wallpaper, then Apply. The log shows `dotfiles-runtime icons preference` failing with `No such command 'preference'`, and the apply path passes `--contrast`, which `dotfiles-runtime wallpaper set` now rejects."
observed: "2026-11-01 live log ~/.local/state/ags/wallpaper-selector.log: `wallpaper-selector: contrast preference lookup failed: ... No such command 'preference'.` repeatedly. `dotfiles-runtime wallpaper set --help` lists only `--format` and `--producer`; `dotfiles-runtime icons --help` lists only `regenerate`. The selector's lib/contrast.ts still calls `icons preference` / `icons regenerate --contrast`, and lib/apply.ts still appends `--contrast`."
expected: "The selector has no icon-contrast surface at all: it runs exactly `dotfiles-runtime wallpaper set <image>` with no extra flags, applies successfully (exit 0, history entry), and its CSS uses only palette.v1 semantic roles."
---

# BUG-002 — Selector still calls the deleted icon-contrast surface

> Naming note: this repo had no BUG-002 ticket; `tests/apply-collapse.test.mjs`
> refers to the historical `ags-apps` BUG-002 (Apply-click collapse). This
> ticket is the app-local regression created for the runtime v0.5.1 removal.

## Summary

`dotfiles-runtime` v0.5.1 (REQ-007) deleted the icon-contrast guard: the
`--contrast auto|on|off` flags on `wallpaper set` / `icons regenerate`, the
`icons preference` command, and the per-wallpaper prefs store. The selector
was not migrated and still calls that removed surface:

- `lib/contrast.ts` shells `dotfiles-runtime icons preference …` and
  `dotfiles-runtime icons regenerate --contrast …`.
- `lib/apply.ts` appends `--contrast on|off` to `wallpaper set`.
- `ui/WallpaperSelectorWindow.tsx` renders the L1 swatch and L2
  "Auto high-contrast icons" checkbox and threads the pref through apply.

The prefs lookup spams `No such command 'preference'`, and an apply that
passes `--contrast` is rejected by the current CLI, so the user cannot change
the wallpaper from the selector.

## Repro

Open the selector and apply a wallpaper. Equivalent command-level repro of the
removed surface:

```sh
dotfiles-runtime icons preference "$(printf 'a%.0s' {1..64})" --format json
dotfiles-runtime wallpaper set /home/inumaki/.local/share/dotfiles/wallpapers/default.png --contrast off
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

- The icon-contrast feature is gone: no swatch, checkbox, labels, state maps,
  `lib/contrast.ts`, `--contrast` args or regeneration path.
- `lib/apply.ts` runs exactly `dotfiles-runtime wallpaper set <image>`.
- No UI text or help mentions auto high-contrast icons.
- The selector CSS uses `palette.v1` roles only (no `@color_*`).
- The app pins the platform v0.4.0 role tuple (contracts stays v0.3.0).
- Applying the current wallpaper path succeeds (exit 0) and lands in history
  without changing the visible wallpaper.

## Fix notes

Root cause: runtime v0.5.1 REQ-007 deleted a consumer surface while this app
kept its client and UI. The fix is removal, not a replacement toggle or store:
delete the client module, drop the apply argument, remove the UI/CSS/model
helpers, and migrate the sheet to semantic roles. A regression test pins the
absence of the removed commands/flags and the exact apply argv.

## Done-when

- [ ] Removed-surface search is empty in source: no `icons preference`,
      `--contrast`, `icon.contrast` or `regenerateIcons`.
- [ ] No `@color_*` token remains in `*.css` / `*.ts` / `*.tsx`.
- [ ] Unit/model/conformance/drift/typecheck/bundle gates pass.
- [ ] The exact apply command runs against the current wallpaper and exits 0.
- [ ] Screenshot shows the cards and no contrast row.
