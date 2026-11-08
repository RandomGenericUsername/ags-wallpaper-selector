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

The next design is the full-monitor desktop overlay specified in
[tickets/REQ-005-overlay-redesign/ticket.md](tickets/REQ-005-overlay-redesign/ticket.md);
open [tickets/REQ-005-overlay-redesign/mock.html](tickets/REQ-005-overlay-redesign/mock.html)
in a browser (no build step). The centered dialog described below is the live
v0.4.x behavior, not the target.

## What it does

The selector is a centered, on-demand dialog:

- Level 1 — the install-spine wallpaper grid with search and hover Apply.
- Level 2 — the per-wallpaper variant gallery (breadcrumb + Back) fed by the
  runtime's effects cache.
- Apply shells exactly `dotfiles-runtime wallpaper set <image>`; progress and
  completion arrive on the `wallpaper.state` domain event. Applying collapses
  the drawer immediately and the set continues in the background; failures
  surface through the notifications app.

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

The drawer is **preserved**: no rescan, no query reset, no selection change, no
visibility change, no status rewrite. `wallpaper.state` remains progress/busy
status only and never applies the appearance. No additional request command is
added.

The handler is `createAppearanceRefreshHandler(appearance, work)` from
`ags-platform/adapters/appearance`. It answers with exactly one JSON-encoded
string naming the requested generation (`{"applied":"<genHash>"}`, `deferred`
or `failed`); the retired v2 `{"ok":true}` ack is neither produced nor
accepted. A repeated generation re-verifies `current` but does not rerun the
icon work; a moved `current` is deferred and a thrown apply is a retryable
failure. A wallpaper change never restarts the process.

## Layout tokens

The app consumes its namespaced v2 metrics in TSX:
`appearance.value("layout.ags-wallpaper-selector.root-width", 960)` and
`appearance.value("layout.ags-wallpaper-selector.root-height", 640)` drive the
root size request; the `960×640` fallbacks are the pre-v2 window defaults. The
`920px` / `600px` glass minimum in `style.css` remains the bundled CSS
fallback; templates never expand layout tokens into CSS.

## Local development

The program tuple is `ags-platform` v1.0.1 / `contracts` v0.8.0. Those tags are
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
lib/appearance.ts             pure app-owned search-icon refresh work
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
