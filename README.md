# ags-wallpaper-selector

Standalone AGS wallpaper picker. This repo is the v0.5.0 `wallpaper-selector`
extracted from `ags-apps` into its own package (REQ-013 / REQ-008): the repo
root **is** the app package.

| Field | Value |
| --- | --- |
| Repo | `ags-wallpaper-selector` |
| App id | `wallpaper-selector` |
| AGS instance | `wallpaper-selector` |
| Config dir | `ags-wallpaper-selector` |
| Window | `wallpaper-selector-window` |
| Launcher | `wallpaper-selector-ui` |
| Keybind description | Open wallpaper selector (SUPER+W) |
| Manifest mode | `live` (`holdsUnsavedState: false`) |

`app.manifest.json` is the single identity source. The runtime discovers the
deployed config link, requires `manifest.instance == app.tsx instanceName ==
ags list`, and requires `manifest.configDir == the deployed link basename`.

## Design contract

The selector is the full-monitor desktop overlay specified in
[tickets/REQ-005-overlay-redesign/ticket.md](tickets/REQ-005-overlay-redesign/ticket.md);
open [tickets/REQ-005-overlay-redesign/mock.html](tickets/REQ-005-overlay-redesign/mock.html)
in a browser (no build step).

## What it does

The selector is a layer-shell overlay on one monitor:

- the candidate wallpaper fills the desktop; the only chrome is two side
  arrows and one control bar (info / looks / actions);
- `←`/`→` browse wallpapers, `↑`/`↓` step looks, `Set`/`Enter` commits,
  `Esc` cancels, `G`/`/` opens the contact-sheet finder;
- browsing never writes; the only write is
  `dotfiles-runtime wallpaper set <image>`, on `Set`/`Enter`;
- the overlay stays open through the three `wallpaper.state` steps, holds
  ~1.2 s after `done`, then hides; a failure keeps the preview and never marks
  the target live;
- placement (bar bottom/top, desktop bar shown/covered, top offset) is
  app-owned settings, saved immediately.

### Data paths

Read-only inputs, owned by the runtime:

- spine wallpapers: `$XDG_DATA_HOME/dotfiles/wallpapers/`
- variant gallery: `$XDG_STATE_HOME/dotfiles/cache/effects/*/meta.json`
- live state: `$XDG_STATE_HOME/dotfiles/current.json`

Writable state stays outside the installed tag (AD-37). The selector writes
only its own thumbnail cache under `$XDG_CACHE_HOME`.

- UI settings: `$XDG_CONFIG_HOME/wallpaper-selector/config.json` (app-owned
  placement; never under the AGS config link
  `$XDG_CONFIG_HOME/ags-wallpaper-selector`).

## `appearance-refresh`

The runtime invokes `ags request appearance-refresh <genHash> -i
wallpaper-selector` after a generation is committed. The app registers the v3
platform handler, wrapped with the standalone invariants:

1. `createAppearance({ configDir: "ags-wallpaper-selector" })` reads
   `$XDG_STATE_HOME/dotfiles/current/manifest.json` plus
   `current/appearance/ags-wallpaper-selector.css` and installs that one
   palette + skin + mode provider;
2. the app-owned work rebuilds the registry-backed search icon from the new
   palette.

The overlay is **preserved**: no rescan, no focus change, no grid query reset,
no visibility change, no commit-state rewrite. `wallpaper.state` remains
progress status only and never applies the appearance. No additional request
command is added.

The handler is `createAppearanceRefreshHandler(appearance, work)` from
`ags-platform/adapters/appearance`. It answers with exactly one JSON-encoded
string naming the requested generation (`{"applied":"<genHash>"}`, `deferred`
or `failed`); the retired v2 `{"ok":true}` ack is neither produced nor
accepted. A repeated generation re-verifies `current` but does not rerun the
icon work; a moved `current` is deferred and a thrown apply is a retryable
failure. A wallpaper change never restarts the process.

## Layout

The overlay has no root-size token: it anchors to all four monitor edges and
the app owns the metrics (bar `min(1160px, 100vw − 56px)`, 62 px arrows,
responsive hiding below 1180/980/880 px). `style.css` is the bundled glass
fallback; the generated appearance sheet wins at USER priority and only paints
the app-declared surfaces.

## Local development

The program tuple is `ags-platform` v1.1.0 / `contracts` v0.12.0. Those tags are
local-only in this run; the local gates use gitignored symlinks under `.dev/`.

```sh
make test          # pure unit + model + settings/placement/state/commit tests (Node only)
make conformance   # manifest + handler + template gate
make drift         # shared event client <-> contracts drift gate
make typecheck     # LOCAL desktop stack: ags + GIR declarations
make bundle        # LOCAL: `ags bundle app.tsx build/ags-wallpaper-selector.js`
make gates         # all of the above
```

`make test`, `make conformance` and `make drift` are the stock-runner gates.
Typecheck is local and authoritative; CI deliberately has no self-hosted job
(AD-19/AD-23).

Run the app:

```sh
ags run -d .
ags toggle wallpaper-selector-window -i wallpaper-selector
```

## Repo layout

```text
app.tsx                       AGS entry point (instance wallpaper-selector)
app.manifest.json             identity tuple
style.css                     overlay structure + glass fallback paint
domain/settings.ts            placement vocabulary, merge, validate (pure)
domain/placement.ts           bar/preview margin math (pure)
domain/monitor-reserved.ts    hyprctl reserved-zone parser (pure)
ports/                        settings-store + monitor-reserved seams
adapters/                     GLib settings store + AstalHyprland/hyprctl
lib/state.ts                  pure overlay state machine
lib/model.ts                  pure grouping/filtering + metadata formatting
lib/scan.ts                   spine + effects-cache + current.json scan (GJS)
lib/stage.ts                  full-bleed stage, crossfade, preload (GJS)
lib/palette-hint.ts           pure dominant-colour quantizer
lib/thumbnails.ts             disk-cached GdkPixbuf thumbnails (GJS)
lib/apply.ts                  execAsync engine entry point (GJS)
lib/appearance.ts             pure app-owned search-icon refresh work
ui/OverlayWindow.tsx          layer-shell overlay + state wiring
ui/ControlBar.tsx             info / looks / actions
ui/LooksStrip.tsx             Original + variant chips
ui/ContactSheet.tsx           contact sheet + search
ui/SettingsPopover.tsx        placement rows (save-on-change)
ui/WallpaperSelectorWindow.tsx thin re-export used by app.tsx
tests/                        unit, model, settings/placement/state, commit, layout
tickets/                      LIFECYCLE, INDEX, _template, this repo's tickets
scripts/worktree-guard.sh
templates/ags-app/            frozen copyable template for the next app repo
.github/workflows/ci.yml      stock-runner CI (make ci)
```

## Consumer surfaces

`dotfiles-v3` owns the app list; `dotfiles-provision` installs the tag and links
`config/ags-wallpaper-selector`; `dotfiles-assets` owns the keybind described as
**Open wallpaper selector** and the `wallpaper-selector-ui` launcher. This repo
does not provision or edit those repos; it proves only the app-side contract.

## Overlay and skin integration (REQ-005, live)

The selector consumes the generated appearance generation (palette + skin +
mode) through `createAppearance({ configDir: "ags-wallpaper-selector" })`. The
bundled `style.css` is the fallback; the generated sheet is the USER-priority
source of surface paint. The overlay is a layer-shell **`surface.panel`**, so
the active skin paints it and the skin's `[host]` policy gives its radius/border
from the compositor (Hyprland `rounding`/`border_size`).

Implementation rules (also in `dotfiles-v3/docs/117-redesign-batch.md` and
`dotfiles-assets/skins/README.md`):

- **App owns layout/structure/content; the skin owns paint/type/ink.** The skin
  template styles the app-declared classes with role tokens (the sound-panel
  pattern). The app CSS keeps layout and fallbacks only.
- The app **must not read appearance tokens** (`appearance.value(...)` fails
  the layout gate) or use CSS inheritance to reproduce role geometry. When an
  app-owned node needs role geometry, the skin template supplies it:
  `.ws-look-frame { border-radius: {{SKIN_SURFACE_CONTROL_RADIUS}}; }`
  (assets v0.22.3).
- The looks selected ring is an overlay above the thumbnail (an inset button
  shadow sits behind the picture). Its radius is the skin's control radius; its
  colour is the focused wallpaper's palette hint, painted with a per-widget
  provider at `USER + 1`. The selected state **replaces** the skin's base
  hairline, so there is one ring.
- The Set button and bar progress use the same per-wallpaper accent with a
  computed contrast ink (USER + 1).
- Settings are the mock's **in-page** `.ws-settings` panel with a full-window
  click catcher — **not** a `Gtk.Popover`. A popover is a separate compositor
  popup whose grab/pointer focus survives its unmap until motion, swallowing
  the next same-spot click. The gear is a plain `Gtk.Button` covering the whole
  42 px circle; the panel opens above the bottom bar or below the top bar and
  the skin paints `.ws-settings`.
- Assets **v0.22.3** is required for the frame radius. The `surface.overlay`
  experiment (contracts v0.14.0 / assets v0.23.0) is **not consumed**; the
  release line maps the overlay to `surface.panel`.

Canonical batch record: `dotfiles-v3/docs/117-redesign-batch.md` (includes the
pending design index for clipboard and the bar panels).
