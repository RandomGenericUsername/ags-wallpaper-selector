---
id: REQ-003
title: "Migrate the wallpaper selector to the v2 Appearance plane"
kind: requirement
status: done
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

- [x] `app.tsx` creates one module-scope Appearance for
      `configDir: "ags-wallpaper-selector"` and applies it in `main()`; no
      `theme.apply()` or `skin.apply()` survives.
- [x] The request handler is `createAppearanceRefreshHandler(appearance, work)`
      and the work rebuilds the search icon only; the `wallpaper.state`
      progress subscription is unchanged and no new request command exists.
- [x] `layout.ags-wallpaper-selector.root-width` / `root-height` are read with
      their `920` / `600` fallbacks and drive the root size request.
- [x] `style.css` is still bundled through `app.start({ css: style })` and
      remains the glass fallback; no structure/class/behavior change.
- [x] `Makefile` pins `ags-platform` v0.9.0 and `contracts` v0.7.0; local
      `.dev/` links and every pin assertion agree.
- [x] Source-level test covers appearance apply/configDir/handler, the retained
      progress subscription, the layout tokens and `style.css`.
- [x] `make gates` passes; v0.4.0 (next minor) is tagged after the
      fast-forward merge.

## Evidence

Implementation commit: `e0c3e0f` on
`ticket/REQ-003-appearance-migration` (opened by `e892f47`). Worktree
`.worktrees/REQ-003/`, branch `ticket/REQ-003-appearance-migration`.

### Appearance

`Evidence:` `app.tsx:33-38` is the single module-scope instance
`const appearance = createAppearance({ configDir: "ags-wallpaper-selector" })`;
`app.tsx:49-54` registers `createAppearanceRefreshHandler(appearance, work)`
and `app.tsx:55-62` calls `appearance.apply()` in `main()` before building the
window. `Verify:` `node --test tests/appearance-consumption.test.mjs` → 6/6
pass.

- The platform helper always re-applies the whole appearance before the
  app-owned work, so `theme.apply()` / `skin.apply()` are gone. The app work is
  `applySelectorAppearance(...)`, which only calls
  `surface.rebuildSearchIcon()` (`lib/appearance.ts:31-35`); the platform apply
  refreshes the appearance cache.
- Exactly one `requestHandler:` exists and it is the v2 helper. No new request
  command exists: `tests/appearance-consumption.test.mjs:164-170` rejects
  `argv[0]` and `PALETTE_REFRESH_COMMAND` in `app.tsx`.
- The `wallpaper.state` progress subscription is unchanged at
  `ui/WallpaperSelectorWindow.tsx:584`; the window never applies the appearance.
- The local v1 wrapper `lib/palette-refresh.ts` is deleted; the retired-file
  gate in `tests/app-contract.test.mjs:199` keeps it from returning.

### Layout tokens

`Evidence:` `ui/WallpaperSelectorWindow.tsx:80-90` reads
`appearance.value("layout.ags-wallpaper-selector.root-width", 920)` and
`root-height` / `600`; `:187-189` feeds the accessors into the existing root
size request. `style.css:15-18` keeps the `920px` / `600px` glass fallbacks.
No layout token is expanded in CSS.

### Pin

`Makefile:3-8` pins `AGS_PLATFORM_VERSION := v0.9.0` and
`CONTRACTS_VERSION := v0.7.0`; `README.md`, `AGENTS.md`,
`.github/workflows/ci.yml`, `.gitignore` and the pin assertion in
`tests/app-contract.test.mjs:264-268` agree.

Local overrides used for the gates (gitignored, not committed):

```sh
ln -sfn ../../../../../ags-platform .dev/ags-platform/v0.9.0
ln -sfn ../../../../../contracts .dev/contracts/v0.7.0
```

`Evidence:` `readlink -f .dev/ags-platform/v0.9.0` →
`/home/inumaki/Development/dotfiles/ags-platform` (`v0.9.0`); the contracts
link resolves to `contracts` (`v0.7.0`).

### Gates

`make gates` → exit 0. Log: `/tmp/opencode/req003-gates.log`.

- Node tests 22/22 pass, including the 6 new `appearance-consumption`
  assertions; `model.test.mjs` → `model: all green`.
- `app-contract.test.mjs` → 15/15 pass, including the platform
  `checkAppRepo` template gate and the v0.9.0/v0.7.0 pin gate.
- Drift → `all checks passed` against contracts v0.7.0.
- Bundle → `build/ags-wallpaper-selector.js`, 1,024,104 bytes.
- Typecheck → 0 errors in the selector tree (28 tolerated
  `/usr/share/ags/js` errors, 0 `ags-platform` errors).

### Deviations

- The task allowed local overrides; this run created gitignored
  `.dev/ags-platform/v0.9.0` and `.dev/contracts/v0.7.0` symlinks in the
  worktree (plus `@girs` / `env.d.ts` symlinks for the local typecheck). No
  local-only artifact is committed.
- The source gate was renamed from `skin-consumption` to
  `appearance-consumption` because the v1 skin plane is retired; the Makefile
  test target points at the new file.
- `style.css` changed only in its header comment; its rules (including the
  `920px` / `600px` fallbacks) are unchanged. The root size request is now fed
  by the same values from the layout tokens.
- The app was not run live: this is a source migration, backed by the bundle
  and typecheck gates. No other deviation.
