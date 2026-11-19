# Changelog

## v0.6.7 — 2026-11-19

- Border the accent ring with a check badge on the selected look: a dark
  palette accent could not carry the selection, and a bright thumbnail could
  outshine a dimmed chip. The badge is app-owned content at the chip's
  bottom-right; the live dot stays top-right.
- Make the gear a true 42 px circle: Arc-Dark paints the inner `button` node of
  `GtkMenuButton` as a rounded square, so that node is reset to transparent and
  the theme's `menubutton.image-button` specificity is matched.
- Clear the initial focus after activation (120 ms) so the gear no longer opens
  wearing a keyboard focus ring.
- Match Arc's `button:disabled` specificity so the disabled `Current wallpaper`
  pill no longer inherits the theme gradient.

## v0.6.6 — 2026-11-19

- The selected look now carries a neutral 2 px ring with a dark separator
  instead of a palette-accent ring: a dark accent on a dark thumbnail was
  invisible, so the user could not tell which variant `Set` would apply.
  Unselected chips dim to 42 %.

## v0.6.5 — 2026-11-19

- Palette-hint swatches are fixed 12×12 circles; they no longer stretch into
  ovals with the meta row.
- The selected look is unmistakable: the accent ring now has a 2 px dark
  separator inside it, and unselected chips sit at 55 % opacity. Supersedes the
  ring contrast in v0.6.4.

## v0.6.4 — 2026-11-19

- The `Live` dot is a 6 px circle again (it was stretching into a vertical bar
  because the box inherited fill alignment).
- Vertically centre the three bar zones; the filename/state/meta block no
  longer sits at the top of a taller bar.
- Reset the GTK theme's `background-image` on the gear, Set, arrow and look
  buttons so the theme's gradient no longer bleeds through the paint.
- Do not focus the gear on open; the keyboard focus ring appears only after
  real Tab/keyboard focus.

## v0.6.3 — 2026-11-19

- Give the Looks strip a fixed 354 px window (six chips) with external
  scrolling: no viewport fill, no reserved scrollbar gutter, and the selected
  chip still auto-scrolls into view. Supersedes the strip allocation in v0.6.2.

## v0.6.2 — 2026-11-19

- Clamp the Looks strip to 360 px and scroll it horizontally: an unbounded
  variant list no longer stretches the 1160 px control bar. The selected chip
  scrolls into view on `↑`/`↓`.
- Keep the no-looks note in the same row as the `Original` chip, as the mock
  does; the bar no longer grows a tall empty middle zone.
- Keep the state pill beside the filename (the name no longer expands to push
  it across the bar) and ellipsize long names at a fixed cap.
- Give the `↵` keycap on the accent `Set` button on-accent ink so it stays
  readable.
- Supersedes `v0.6.1`, which was tagged before these layout fixes landed.

## v0.6.0 — 2026-11-18

- Replace the centered 960×640 selector with the REQ-005 full-monitor overlay:
  the candidate wallpaper is the surface, and the only chrome is two 62 px side
  arrows plus one control bar (info / looks / actions).
- Browse (`←`/`→`, looks, grid) never writes. `Set`/`Enter` is the only
  commit, mapped to the three real `wallpaper.state` steps; the overlay holds
  ~1.2 s after `done`, a failure keeps the preview, and `Esc` cancels without a
  write.
- Add app-owned placement settings at
  `$XDG_CONFIG_HOME/wallpaper-selector/config.json` (bottom/top, desktop bar
  shown/covered, top offset) with the capture-tool grammar: save-on-change,
  post-merge per-key degradation, no Save button.
- Add the pure state machine, placement math, settings merge/validate,
  monitor-reserved parser and palette-hint quantizer, plus the GLib settings
  adapter and AstalHyprland/hyprctl reserved-zone adapter.
- Add the contact sheet (`G`/`/`, search, 208 px async pump), the looks strip
  (Original + variants, live dot app-owned) and metadata (dimensions · size).
- Keep the frozen identity: window `wallpaper-selector-window`, launcher
  `wallpaper-selector-ui`, `createAppearance({ configDir: "ags-wallpaper-selector" })`
  and the generation-bound `appearance-refresh` handler.
- `style.css` is rewritten around the overlay classes; the skin plane remains
  paint-only (layout/components are app-owned).

## v0.5.2 — 2026-11-12

- Bump the local-only `ags-platform` pin from `v1.0.1` to `v1.1.0` and
  `contracts` from `v0.8.0` to `v0.12.0` for dev-pin parity. CI checks out the
  same tags.
- No app behavior change: `app.tsx`, `lib/`, `ui/`, `style.css`, the
  `appearance-refresh` handler/ack, layout tokens and the `wallpaper.state`
  progress subscription are untouched.

## v0.5.1 — 2026-11-07

- Bump the local-only `ags-platform` pin to `v1.0.1` for dev-pin parity;
  `contracts` stays `v0.8.0`. CI checks out the same tags.
- No app behavior change: `app.tsx`, `lib/`, `ui/`, `style.css`, the
  `appearance-refresh` handler/ack, layout tokens and the `wallpaper.state`
  progress subscription are untouched.

## v0.5.0 — 2026-11-07

- Move the local tuple to `ags-platform` v1.0.0 / `contracts` v0.8.0
  (Generations v3; runtime v1.0.0). CI checks out the same tags.
- `createAppearance({ configDir: "ags-wallpaper-selector" })` now reads
  `current/manifest.json` + `current/appearance/ags-wallpaper-selector.css`
  behind the one `current` hop; `appearance.apply()` and the app-scoped
  provider are unchanged.
- `createAppearanceRefreshHandler` answers the generation-bound
  `appearance-refresh <genHash>` protocol; the unit suite asserts the exact-hash
  response, idempotent work, deferred moved pointer, retryable apply failure
  and rejection of the retired v2 `palette-refresh` command.
- The search-icon work, `wallpaper.state` progress subscription and
  `960` / `640` layout-token fallbacks are unchanged.

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
