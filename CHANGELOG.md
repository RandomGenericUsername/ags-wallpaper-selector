# Changelog

## v0.4.1 — 2026-11-06

- Restore the pre-v2 `960×640` window default as the layout-token fallbacks
  (was `920×600` from the CSS minimums); the assets manifest moves to
  `960×640` in v0.12.2. The `wallpaper.state` subscription and appearance
  handler are unchanged.

## v0.4.0 — 2026-11-06

- Migrate to the v2 Appearance plane: `app.tsx` builds one module-scope
  `createAppearance({ configDir: "ags-wallpaper-selector" })` and applies it in
  `main()`, replacing the split `theme.apply()` / `skin.apply()` pair.
- Replace the local palette-refresh wrapper with
  `createAppearanceRefreshHandler(appearance, work)`; the platform re-applies
  the whole appearance and the app work rebuilds only the search icon. The
  `wallpaper.state` progress subscription stays and no request command is
  added.
- Consume `layout.ags-wallpaper-selector.root-width` / `root-height` with their
  `920` / `600` fallbacks at the root size request; `style.css` remains the
  bundled glass fallback.
- Move the local tuple to `ags-platform` v0.9.0 / `contracts` v0.7.0.
- Replace the skin-consumption test with `tests/appearance-consumption.test.mjs`
  for the appearance apply/configDir/handler, the retained progress
  subscription, the layout tokens and the bundled stylesheet.

## v0.3.0 — 2026-11-05

- Consume the app-scoped skin plane: `app.tsx` builds one
  `createAppSkin({ configDir: "ags-wallpaper-selector" })` at module scope and
  applies it right after `theme.apply()` in `main()`. The adapter monitor
  reloads `$XDG_CONFIG_HOME/ags-wallpaper-selector/skin.css`; no refresh
  request handler is added. `style.css` stays the bundled glass fallback.
- Move the local tuple to `ags-platform` v0.8.0 / `contracts` v0.6.0.
- Add `tests/skin-consumption.test.mjs` for the apply order, configDir, the
  single palette-only request handler and the bundled stylesheet.

## v0.2.1 — 2026-11-04

- Fix the L1 hover toolbar so the Apply pill sits symmetrically inside its dark
  container: `.ws-hoverbar` now supplies even padding on all four sides and
  `.ws-quick` no longer carries its own right/bottom margin.
- Add `tests/hoverbar-layout.test.mjs` to keep the hoverbar/button spacing
  contract.

## v0.2.0 — 2026-11-01

- Remove the deleted runtime contrast surface from the selector: the client
  module, the per-wallpaper swatch/checkbox and its state wiring, and the extra
  apply argument. `lib/apply.ts` now runs exactly
  `dotfiles-runtime wallpaper set <image>`.
- Migrate `style.css` (and the frozen app template) to semantic `palette.v1`
  roles; no legacy `@color_*` alias remains.
- Pin `ags-platform` v0.4.0 for the role tuple (contracts stays v0.3.0).
- Add `tests/no-contrast-surface.test.mjs` to keep the removed surface and
  legacy color aliases out.

## v0.1.0 — 2026-10-27

- Extract the wallpaper selector from `ags-apps` v0.5.0 into the standalone
  `ags-wallpaper-selector` repo (repo root is the app package).
- Identity: app/instance `wallpaper-selector`, config dir
  `ags-wallpaper-selector`, window `wallpaper-selector-window`, launcher
  `wallpaper-selector-ui`, keybind description “Open wallpaper selector”.
- Keep the real v0.5.0 `palette-refresh` handler: re-apply the Theme pointer and
  rebuild the registry-backed search icon; the drawer, query, selection,
  contrast choices and in-flight apply state are preserved. Add hash
  idempotency and the retryable-failure contract.
- Keep the model, scan, thumbnail, apply and contrast modules as-is.
- Keep the app tests (model, BUG-002 Apply-collapse) and the
  `wallpaper.state` contract-drift gate.
- Add the standalone dev flow (`AGENTS.md`, tickets, worktree guard, Makefile,
  CI, tests, `templates/ags-app/`) and the manifest/handler conformance gate.
- Pin the local-only v0.3.0 `ags-platform` / `contracts` tuple via `.dev/`
  symlinks.
