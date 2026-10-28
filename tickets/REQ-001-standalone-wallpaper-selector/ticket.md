---
id: REQ-001
title: "Extract the wallpaper selector into the standalone ags-wallpaper-selector repo"
kind: requirement
status: done
lane: 3
links:
  openspec: none
  bmad: none
worktree: none
branch: main
---

# Extract the wallpaper selector into the standalone ags-wallpaper-selector repo

## Requirement

Create `ags-wallpaper-selector` from the `ags-apps` v0.5.0 `wallpaper-selector`
app, with the repo root as the app package and the standalone identity. Keep
the real live `palette-refresh` (Theme pointer + search icon, drawer preserved),
the app's model/Apply tests, the `wallpaper.state` contract drift gate and the
frozen `templates/ags-app/` fixture. Pin the local-only v0.3.0
`ags-platform`/`contracts` tuple. This ticket does not provision, cut over or
push.

## Acceptance

- [x] `app.tsx` is at the repo root; there is no app subdirectory.
- [x] `app.manifest.json` is the `wallpaper-selector` /
      `ags-wallpaper-selector` / `live` / no-unsaved-state tuple and agrees with
      `app.tsx`, the window and `style.css`.
- [x] `palette-refresh` is the real v0.5.0 refresh through the platform v0.3.0
      helper: re-apply the Theme pointer, rebuild the search icon; the drawer,
      query, selection, contrast choices and in-flight apply state are
      preserved; idempotent by appearance hash; one JSON-string response.
- [x] The app's pure model test, the BUG-002 Apply-collapse regression test and
      the `wallpaper.state` contract drift gate are present and pass.
- [x] `AGENTS.md`, `tickets/LIFECYCLE|INDEX|_template`, worktree guard,
      Makefile, CI, README, tests and `templates/ags-app/` are present and the
      platform template-conformance gate passes.
- [x] Local gates pass: `make test`, `make conformance`, `make drift`,
      `make typecheck`, `make bundle` (or `ags bundle`).
- [x] Annotated tag `v0.1.0` is created after the gates pass; nothing is pushed.

## Evidence

`make gates` → exit 0 (warm tree):

- `make test` → 10/10 node tests pass (`tests/unit.test.mjs`,
  `tests/apply-collapse.test.mjs`) and `model: all green`
  (`tests/model.test.mjs`).
- `make conformance` → 15/15 pass (`tests/app-contract.test.mjs`), including
  the platform `checkAppRepo` template gate, the manifest identity, the
  v0.5.0 refresh wiring and the drawer-preservation source checks.
- `make drift` → 38/38 checks, `all checks passed`
  (`tests/event-contract-drift.mjs`).
- `make bundle` → `build/ags-wallpaper-selector.js`, 919224 bytes.
- `make typecheck` → 0 errors in the `ags-wallpaper-selector` tree (28
  tolerated `/usr/share/ags/js` errors, 0 `ags-platform` errors).

Identity evidence: `app.manifest.json` is the four-value tuple above;
`app.tsx` registers `instanceName: "wallpaper-selector"`;
`ui/WallpaperSelectorWindow.tsx` names `wallpaper-selector-window`; `style.css`
selects `window#wallpaper-selector-window`; `README.md` documents launcher
`wallpaper-selector-ui` and the keybind description “Open wallpaper selector”.

Refresh evidence: `lib/palette-refresh.ts` composes
`createPaletteRefreshHandler` with the hash-idempotent
`createAppearanceRefresh`; `lib/appearance.ts` orders `reapplyTheme()` before
`rebuildSearchIcon()`; `app.tsx` binds those to `theme.apply()` and
`refreshWallpaperSelectorChrome()`. The window's
`refreshSelectorChrome()` only removes/rebuilds the search icon, and
`tests/app-contract.test.mjs` rejects any rescan, query/selection reset,
visibility or status change in that path.

Source parity: `lib/model.ts`, `lib/scan.ts`, `lib/apply.ts`,
`lib/contrast.ts`, `lib/thumbnails.ts`,
`ui/WallpaperSelectorWindow.tsx`, `tests/model.test.mjs` and
`tests/apply-collapse.test.mjs` are byte-identical to `ags-apps` v0.5.0; only
the `style.css` header comment was updated for live refresh.

Local tuple: `.dev/ags-platform/v0.3.0 -> ../../../ags-platform` and
`.dev/contracts/v0.3.0 -> ../../../contracts` are gitignored symlinks.

No GUI/host changes: the app was not run and no sibling repo was edited;
`git -C ../ags-apps status --porcelain` is empty.

Release: annotated tag `v0.1.0` on the initial commit; nothing pushed.

## Dependencies

- `ags-apps` v0.5.0 source and the REQ-008/REQ-013 standalone contract.
- `ags-platform` v0.3.0 and `contracts` v0.3.0 (local-only tags).
