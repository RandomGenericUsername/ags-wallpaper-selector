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

## What it does

The selector is a centered, on-demand dialog:

- Level 1 — the install-spine wallpaper grid with search, hover Apply and a
  per-wallpaper high-contrast swatch.
- Level 2 — the per-wallpaper variant gallery (breadcrumb + Back) fed by the
  runtime's effects cache.
- Apply shells `dotfiles-runtime wallpaper set`; progress and completion arrive
  on the `wallpaper.state` domain event. Applying collapses the drawer
  immediately and the set continues in the background; failures surface through
  the notifications app.

### Data paths

Read-only inputs, owned by the runtime:

- spine wallpapers: `$XDG_DATA_HOME/dotfiles/wallpapers/`
- variant gallery: `$XDG_STATE_HOME/dotfiles/cache/effects/*/meta.json`
- live state: `$XDG_STATE_HOME/dotfiles/current.json`

Writable state stays outside the installed tag (AD-37). The selector writes
only its own thumbnail cache under `$XDG_CACHE_HOME`.

## `palette-refresh`

The runtime invokes `ags request palette-refresh <appearance-hash> -i
wallpaper-selector` after an appearance change. The handler is the real v0.5.0
refresh, wrapped with the standalone invariants:

1. re-apply the stable Theme pointer (`$XDG_CONFIG_HOME/ags/colors.css`);
2. rebuild the registry-backed search icon from the new palette.

The drawer is **preserved**: no rescan, no query reset, no selection change, no
visibility change, no status rewrite. `wallpaper.state` remains progress/busy
status only and never applies the palette.

The handler is idempotent by appearance hash and answers with exactly one
JSON-encoded string (`{"ok":true}` or a protocol failure), via
`ags-platform/ports/palette-refresh`. A same-hash trigger is a safe no-op; a
thrown refresh is a retryable failure. A wallpaper change never restarts the
process.

## Local development

The program tuple is `ags-platform` / `contracts` v0.3.0. Those tags are
local-only in this run; the local gates use gitignored symlinks under `.dev/`.

```sh
make test          # pure unit + model + Apply-collapse tests (Node only)
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
style.css                     ws-* classes (runtime palette tokens)
lib/model.ts                  pure grouping/filtering (node-tested, no GJS)
lib/scan.ts                   spine + effects-cache + current.json scan (GJS)
lib/thumbnails.ts             disk-cached GdkPixbuf thumbnails (GJS)
lib/apply.ts                  execAsync engine entry point (GJS)
lib/contrast.ts               icons preference/regenerate CLI shell (GJS)
lib/appearance.ts             pure refresh order + hash idempotency
lib/palette-refresh.ts        real handler wiring (pure)
ui/WallpaperSelectorWindow.tsx P5 window (imperative GTK + createEffect)
tests/                        unit, model, Apply-collapse, drift, conformance
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
