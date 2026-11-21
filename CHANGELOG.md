# Changelog

## v0.6.27 — 2026-11-20

- Settings gear: open a fresh `Gtk.Popover` anchored to the whole button on each
  open and unparent/detach it on close (the sound-panel pattern). The reused
  popover left a stale surface/grab behind, so the third same-spot click was
  swallowed until the pointer moved.

## v0.6.26 — 2026-11-20

- Settings gear: use the sound-panel pattern — a plain `Gtk.Button` that parents
  and pops a `Gtk.Popover` — instead of `Gtk.MenuButton`, whose inner button
  shrank the hit target to the glyph. The full 42 px circle is now clickable.

## v0.6.25 — 2026-11-20

- Look chips: the selected state now replaces the skin's base control hairline
  instead of stacking on it. Unselected chips show the skin border only; the
  selected chip shows the app ring only (skin border suppressed at the widget).
  This removes the double border (rounded app ring inside the square skin chip)
  without adding a skin mechanism.

## v0.6.24 — 2026-11-20

- Settings popover: the native `popover > contents` shell no longer clips the
  skin's settings surface; the app-owned shell is transparent with radius 0 and
  the skin's `surface.card` panel owns the visible rounding.
- Selected-look frame: the app keeps a radius fallback, and the skin template
  supplies `surface.control.radius` for the frame (assets v0.22.3). No token
  reads or CSS inheritance in the app; layout stays TSX/CSS-owned.

## v0.6.23 — 2026-11-20

- Keep the just-applied wallpaper on screen through `done`. The post-commit
  rescan rebuilt the gallery, which pins the live wallpaper first, so the
  unchanged focus index pointed at a different wallpaper. The rescan is
  deferred to the next open, which reopens on the live point.

## v0.6.22 — 2026-11-20

- The Set button and the bar progress line now use the focused wallpaper's
  accent, with a computed contrast ink, instead of the applied theme's
  `@primary` (the "always pink" button).
- Attach the accent CSS provider to each target widget (Set button, keycap,
  progress nodes). A GTK provider added to a parent does not style its
  descendants, which is why the ring worked and the button did not.

## v0.6.21 — 2026-11-20

- The selected-look ring now actually follows the wallpaper. The per-widget
  provider was at APPLICATION+1, but AGS installs app CSS at USER, so the
  global `@primary` always won (the "always green" ring). It is now USER+1.
- Pick the most common swatch with usable lightness (0.22–0.82), so a
  near-black background does not swallow the colour while a mostly green
  wallpaper keeps a green ring.
- Owner decision: `Esc` during a commit collapses the overlay without
  cancelling the apply. Mock, ticket, `mock.sha256` and the commit-flow test
  updated together; navigation/looks/grid/settings stay locked.

## v0.6.20 — 2026-11-20

- The selected-look ring uses the **dominant** palette swatch, not the most
  chromatic one. A mostly green wallpaper could surface a small pink detail as
  the ring, which read as unrelated to the artwork.

## v0.6.19 — 2026-11-20

- The selected-look border follows the focused wallpaper/look palette hint
  (most chromatic swatch), not the applied global `@primary`. A per-widget CSS
  provider overrides only the border colour; the white inner line stays for
  contrast.

## v0.6.18 — 2026-11-20

- Draw the selected-look ring as an overlay **above** the thumbnail. A button
  inset box-shadow is painted behind the Gtk.Picture, which is why the accent
  border was invisible; the frame is now the mock's accent border with a white
  inner line.
- Give the settings segmented buttons an explicit 64x28 allocation and a
  stronger selected fill; the GTK button padding/min-height was not reaching
  them inside the popover.
- Pin the bar progress line to 2 px on every node (bar, trough, progress).

## v0.6.17 — 2026-11-20

- Selected look: use the mock's 2 px accent border again (the check badge is
  gone) with a thin light halo so a dark accent stays visible; unselected chips
  sit at 60 %.
- Slim the control bar: 10 px vertical padding, compact keycaps (`line-height:
  1`), and a 2 px bar progress line. The Set fill stays a 3 px bottom line.
- Settings popover: match the mock's 322 px total width, restore the row
  separators, clear the GTK theme's `background-image` on segmented/stepper
  buttons, and centre the stepper value.

## v0.6.16 — 2026-11-20

- Fix the first-show model load. The window is mapped during construction,
  before the `map` handler is attached, so the initial `rescan(true)` never
  ran and the overlay rendered an empty model ("no wallpapers", black stage).
  The handler now also runs immediately when the window is already mapped.

## v0.6.15 — 2026-11-19

- Raise the commit timeout to 120 s. The 30 s failure fired before the
  runtime's palette/icon chain finished, so a successful apply showed a false
  timeout and the overlay stayed open (the promise could no longer reconcile a
  failed state). The 120 s watchdog still prevents a true hang.
- The Set button's commit progress is a 3 px line at the bottom of the pill, not
  a full-height white fill.
- Esc remains locked during the commit per the frozen design; collapse the
  overlay with the launcher / `SUPER+W` or `ags toggle`, which does not cancel
  the apply. Supersedes v0.6.14 (tagged while its tests were red; never moved).

## v0.6.14 — 2026-11-19

- The Set button's commit progress is a 3 px line at the bottom of the pill,
  not a full-height white fill.
- A slow apply no longer fails the overlay at 30 s. The commit watchdog now
  shows `Still setting wallpaper…` and re-arms; the event stream or the command
  promise still finishes the commit and hides the overlay.
- `Esc` during a commit collapses the overlay without cancelling the apply; the
  next map shows the in-flight steps or the resulting live state.

## v0.6.13 — 2026-11-19

- The grid card's `Live` dot is a 6 px circle; the badge box was inheriting
  fill alignment and stretching it into a vertical column.

## v0.6.12 — 2026-11-19

- One search pill, not a pill inside a pill: `Gtk.SearchEntry` is composite and
  Arc paints both its `entry` and inner `text` nodes with their own background,
  border and focus ring. Both are flattened; only the 300 px row owns the pill.
- Constrain the entry with `width-chars` as well as `max-width-chars`, so the
  search row stops growing to the placeholder's natural width.

## v0.6.11 — 2026-11-19

- Fix grid typing. `GtkSearchEntry` delegates focus to its inner `GtkText`, so
  the wrapper's `has_focus` stayed false; the key controller therefore treated
  letters as navigation and `G` closed the grid. `isSearchFocused()` now
  recognises the delegated focus, and the grid focus retries until the entry is
  actually focused.
- Raise the contact-sheet scrim to `.97`; `.94` still let terminal text read
  through without the mock's blur.

## v0.6.10 — 2026-11-19

- Remove the duplicate search glyph in the contact sheet: the row already
  carries the appearance-derived magnifier, so the `Gtk.SearchEntry`'s internal
  icons are hidden. The search pill is capped at the mock's 300 px instead of
  stretching to the placeholder's full width.
- Raise the contact-sheet scrim to `.94`; the mock pairs `.86` with a 30 px
  backdrop blur, which GTK cannot render.

## v0.6.9 — 2026-11-19

- Keycaps size to their text. The `↵` inside the Set button was stretching to
  the pill's full height and reading as a tall bar.

## v0.6.8 — 2026-11-19

- Make the Set button's label the main child of its overlay and the progress
  fill the overlay. The button was sized to the ProgressBar's natural width, so
  the pill only covered "Set" while "wallpaper ↵" spilled outside it. This also
  restores the correct size of the live `Current wallpaper` pill.

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
