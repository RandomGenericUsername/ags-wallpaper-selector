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

- [x] `app.tsx` creates the app-scoped Skin at module scope with
      `configDir: "ags-wallpaper-selector"` and applies it immediately after
      `theme.apply()` in `main()`.
- [x] The palette-refresh handler and `wallpaper.state` progress subscription
      are unchanged; no skin-refresh request handler exists.
- [x] `style.css` is still bundled through `app.start({ css: style })` and
      remains the glass fallback.
- [x] `Makefile` pins `ags-platform` v0.8.0 and `contracts` v0.6.0; local
      `.dev/` links and any pin assertions agree.
- [x] Source-level test covers the order, configDir, no new handler and
      `style.css` presence.
- [x] `make gates` passes; v0.3.0 (next minor) is tagged after the
      fast-forward merge.

## Evidence

Implementation commit: `ec1caf8` on
`ticket/REQ-002-skin-consumption` (opened by `e0aef72`).

### Skin consumption

`Evidence:` `app.tsx:31-36` is the single module-scope instance
`const skin = createAppSkin({ configDir: "ags-wallpaper-selector" })`;
`app.tsx:52-55` calls `theme.apply()` then `skin.apply()` in `main()`.
`Verify:` `node --test tests/skin-consumption.test.mjs` → 4/4 pass.

- The import comes from `ags-platform/adapters/skin` (v0.8.0). The adapter
  resolves `$XDG_CONFIG_HOME/ags-wallpaper-selector/skin.css`; its module-scope
  file monitor owns reloads, so no request path is added.
- `app.tsx` still has exactly one `requestHandler:` (the existing
  `createWallpaperSelectorPaletteRefresh(...)`); the test rejects any `skin`
  reference inside that handler. `WallpaperSelectorWindow.tsx` and its
  `wallpaper.state` progress subscription are untouched.
- `app.tsx` still imports `./style.css` and passes `css: style` to
  `app.start`; `style.css` is byte-identical to `v0.2.1`.
  `Verify:` `git diff v0.2.1 -- style.css` is empty.
- No structure, class, gesture, size or behavior change; no layout token is
  read in v1.

### Pin

`Makefile:3-8` pins `AGS_PLATFORM_VERSION := v0.8.0` and
`CONTRACTS_VERSION := v0.6.0`; `README.md`, `AGENTS.md`,
`.github/workflows/ci.yml`, `.gitignore` and the pin assertion in
`tests/app-contract.test.mjs` agree.

Local overrides used for the gates (no `.dev/` symlink is committed):

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make gates
```

`Evidence:` both checkouts resolve to the pinned tags:
`ags-platform` → `v0.8.0`, `contracts` → `v0.6.0`.

### Gates

`make gates` → exit 0. Log: `/tmp/opencode/req002-gates-rerun.log`.

- Node tests 22/22 pass, including the 4 new `skin-consumption` assertions;
  `model.test.mjs` → `model: all green`.
- `app-contract.test.mjs` → 15/15 pass, including the platform
  `checkAppRepo` template gate and the new v0.8.0/v0.6.0 pin gate.
- Drift → `all checks passed` against contracts v0.6.0.
- Bundle → `build/ags-wallpaper-selector.js`, 1,039,992 bytes.
- Typecheck → 0 errors in the selector tree (28 tolerated
  `/usr/share/ags/js` errors, 0 `ags-platform` errors).

First-run note (same as BUG-003): the first `make gates` failed at
`typecheck` with `FAIL: typecheck: platform link missing` because the `deps`
prerequisite's `npm install --no-save` pruned the extraneous
`node_modules/ags-platform` symlink after `platform-dev` had run in the same
make invocation. Log: `/tmp/opencode/req002-gates.log`. Rerunning with the
toolchain present passed as recorded; no app code is involved.

### Deviation

The task allowed "local overrides for gates"; this run used
`AGS_PLATFORM_DEV`/`CONTRACTS_ROOT` env overrides instead of creating new
`.dev/ags-platform/v0.8.0` and `.dev/contracts/v0.6.0` symlinks. No other
deviation. The app was not run live: the change is source-only and the
adapter is already verified by the platform.

