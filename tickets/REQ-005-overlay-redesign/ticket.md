---
id: REQ-005
title: "Redesign the wallpaper selector as a desktop overlay"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-005/
branch: ticket/REQ-005-overlay-redesign
---

# Redesign the wallpaper selector as a desktop overlay

## Requirement

Replace the centered 960×640 selector with a full-monitor wallpaper preview:
the candidate image fills the desktop, the only chrome is two side arrows and
one control bar, browsing never writes, and `Set`/`Enter` is the only commit.
The control bar position and the desktop-bar visibility are configurable through
the capture-tool settings pattern. The normative mock is
[`mock.html`](./mock.html); this ticket is the app-local implementation
contract. The batch-level record is
`dotfiles-v3/docs/106-wallpaper-selector-overlay.md`.

## Acceptance

- [ ] The overlay implements the contract in this ticket.
- [ ] The mock's states are reproduced in GTK at 1600×1000 and 1920×1080.
- [ ] Placement settings persist at `$XDG_CONFIG_HOME/wallpaper-selector/config.json`
      and degrade safely.
- [ ] `make ci` and `make gates` pass; the composition pin is bumped.

## Mock (normative)

Open `mock.html` directly; no build step:

```sh
xdg-open tickets/REQ-005-overlay-redesign/mock.html
```

Try: `←`/`→` browse, `↑`/`↓` looks, `Enter`/Set commit, `Esc` cancel, `G`/`/`
grid, gear → Placement (Bottom/Top, desktop bar Show/Hide, offset). Deep links:
`?bar=top&desktop=hide`, `?settings=1`, `?view=grid`,
`?w=ember&look=2&commit=1`.

The mock is the first source of truth for look and interaction; this ticket is
the source of truth for invariants, settings, architecture and acceptance.

## Source of truth and drift rule

- Normative mock: `mock.html`; sha256
  `6f877b971b4b402eaeb2447d6563784dd1a18c137ba619ab5810d10a31373543`
  (also recorded in `mock.sha256`).
- This ticket is the **criteria** source of truth; the mock is the **look and
  interaction** source of truth.
- Any change to `mock.html` must update this ticket's acceptance/contract
  **and** `mock.sha256` in the same commit. Any criteria change must update the
  mock in the same commit. If they disagree, fix one before merging.
- The app-local ticket + mock are canonical; the composition doc 106 is the
  batch-level record, and its `spikes/` copy mirrors this mock.

## Design contract

## 0. Scope

**In scope**

- The selector overlay on one monitor.
- The side arrows, the control bar, the looks strip, the contact-sheet finder.
- Placement settings: control bar bottom/top, desktop bar visible/covered, top
  offset.
- The interaction/state machine, failure states, and acceptance criteria.
- The app-repo architecture needed to ship it.

**Out of scope**

- The runtime apply pipeline (`dotfiles-runtime wallpaper set`), the palette
  producer (`tpr`), variant generation (`weg`), notifications.
- A cross-app UI orchestrator. Deferred by decision D12.
- Appearance-plane token changes (e.g. motion tokens). The app consumes the
  existing v2 appearance adapter.
- Pre-generating variants before a wallpaper has been applied once.

---

## 1. Today (the thing being replaced)

The current app (`ags-wallpaper-selector` v0.4.0) is a centered 960×640 dialog:

- search + a 4-across FlowBox of 208 px cards
  (`ui/WallpaperSelectorWindow.tsx:154,219,600-601`);
- a drill-down variant grid; per-tile hover **Apply**
  (`ui/WallpaperSelectorWindow.tsx:315-380`);
- Apply hides the dialog immediately and the set continues in the background
  (`ui/WallpaperSelectorWindow.tsx:512-540`, pinned by
  `tests/apply-collapse.test.mjs`);
- live = accent ring + 12 % tint; panel = `alpha(@surface,.94)` + 2 px
  `@primary` frame (`style.css:20-26`);
- appearance via `createAppearance({ configDir: "ags-wallpaper-selector" })`
  (`app.tsx:36-38`);
- the provisioned launcher toggles the window named
  `wallpaper-selector-window` with `ags toggle`
  (pinned engine `wallpaper-selector-ui.j2`).

### 1.1 Why it reads old

1. **Box-in-box-in-box.** Accent frame around the panel, hairline around each
   card, hairline around each control.
2. **Selection is drawn, not spatial.** A ring + tint on a static grid; the
   screen does not show what the wallpaper will actually look like.
3. **Hover-only actions.** Apply appears on hover, while pressing the same tile
   does something else (drill). Two meanings on one target.
4. **Micro-typography.** 10–11 px captions and uppercase letter-spaced labels
   (`audio-panel.css:12,35`; wallpaper `style.css:80` for the same habit).
5. **No hierarchy.** Every row weighs the same; no hero, no focus.
6. **Per-app dialects.** 221 lines of wallpaper CSS, 226 clipboard, 350 audio,
   1 378 bar; same palette, five grammars.

### 1.2 What must survive

- The spine scan, the variant gallery, the live marker, the busy lock.
- Search.
- The exact apply command and the `wallpaper.state` progress contract.
- No system write while browsing.
- The launcher/window name (`wallpaper-selector-window`) and the appearance v2
  refresh contract.
- The `Original` + generated-variant model.

---

## 2. Locked decisions

| ID | Decision | Why | Consequence |
| --- | --- | --- | --- |
| **D1** | The selector is a **full-monitor overlay**, not a dialog. The candidate wallpaper fills the monitor; there is no stage card, no rounded frame, no page scrim. | You judge a wallpaper by looking at the desktop, not at a thumbnail in a box. | One full-screen window; the wallpaper is the content; the chrome floats. |
| **D2** | Wallpapers navigate on the **horizontal axis** with two side arrows. `←`/`→` and clicking a peek/arrow are equivalent. No large top/bottom wallpaper arrows. | Landscape imagery reads left-to-right; side arrows stay out of the image's centre. | Two 62 px circular glass buttons at the vertical centre, 26 px from the edges. |
| **D3** | Looks (variants) are the **second axis**, presented as a strip inside the control bar. The UI word is “Looks”; the domain word is “variants”. `↑`/`↓` and clicking a chip are equivalent. No extra on-screen up/down arrows. | Variants are secondary; the strip is enough and keeps the monitor chrome minimal. | `Original` + existing variants; an honest empty note when none exist. |
| **D4** | **One control bar** carries all settings: state pill, filename, metadata, palette hint, looks, Set, settings gear, hints. | One place to read and one place to act. | Three zones: info / looks / actions. |
| **D5** | The control bar's position is **configurable**: `bottom` (default) or `top`. Top sits below the compositor's reserved top zone. | The bar may collide with the user's existing desktop bar; placement is a preference. | Config key `control_bar.position`; live re-apply on change. |
| **D6** | The desktop bar's visibility during preview is **configurable**: `keep_visible` (default) or covered. | Some users want an honest “real desktop” preview; others want a clean image. | Config key `desktop_bar.keep_visible`; implemented as preview geometry (see §7.4), not as a cross-app hide command. |
| **D7** | **Browse ≠ commit.** Navigation changes only the preview. `Set` or `Enter` is the only commit. `Esc` cancels with zero system writes. | The old hover Apply conflated browsing and committing. | The state machine has explicit `preview` and `committing` states; no apply call from navigation. |
| **D8** | Live and preview are **explicit**, not inferred. A green `Live` pill marks the live item; a neutral `Preview` pill marks anything else; `Setting…` marks a commit. | The user must know whether the desktop already changed. | The live marker follows the live wallpaper+look, never the focus. |
| **D9** | Commit is **in place**: the bar shows three steps, then the overlay leaves the wallpaper. It does not vanish on click. | A silent disappearance reads as a crash after the user invested in a choice. | Progress mapped to `wallpaper.state`; auto-hide after `done`; failure keeps the preview. |
| **D10** | The contact-sheet **grid is a secondary finder** on `G` (or `/`). Search lives in the grid, not in the main overlay. | A filmstrip does not scale to 40+ wallpapers; a grid does. The main overlay stays minimal. | One `Gtk.Stack` page with a `Gtk.SearchEntry`; `G`/`/` opens it. |
| **D11** | Settings follow the **capture-tool pattern**: app-owned JSON, pure domain, port + GLib adapter, grouped rows, segmented pills, spin value, immediate save. | One settings grammar across apps; no Save button; safe degradation. | New `domain/settings.ts`, `ports/settings-store.ts`, `adapters/glib-settings-store.ts`, placement adapter. |
| **D12** | A cross-app **UI orchestrator is deferred**. Each app owns its placement now; the selector only decides whether its preview covers or leaves the reserved strip. | First validate the per-app grammar; resolve superposition once, later. | Keys stay namespaced so the orchestrator can consume them without migration. |
| **D13** | Appearance stays on the **appearance plane**. Palette/skin/mode come from `createAppearance`; structure stays in TSX. No new skin structure. | The v2 plane is the one provider/watch/apply path; skins are appearance only. | New CSS for structure; derived icons rebuilt on appearance refresh; the preview state is preserved. |
| **D14** | The **visual contract** below is binding: one chrome layer, accent only for action/selection, type scale, 8 px rhythm, 40–44 px targets, sentence case. | This is what makes the batch feel like one system instead of five apps. | New surfaces use these values; old values are retired. |

### 2.1 Defaults (frozen unless changed before implementation)

- `control_bar.position = "bottom"`
- `control_bar.offsetPx = 0`
- `desktop_bar.keep_visible = true`

---

## 3. Principles (style contract)

These apply to the wallpaper selector now and to the rest of the batch later.

1. **Content is the surface; chrome floats.** The wallpaper, the clipboard
   item, the media artwork is the thing. Chrome is a floating control layer,
   never a frame around content.
2. **One chrome layer.** Glass + 1 px hairline + one soft shadow. No accent
   frame around anything. Separation comes from tone and space, not outlines.
3. **Accent is a state colour.** Accent (from the generated palette) is only
   for the commit action, the selected look, focus rings and progress. Live is
   its own semantic green. Everything else is neutral ink.
4. **Type scale.** ~10.5 caption / 11.5 body-small / 13 body / 16 title /
   22–30 display. Sentence case. No uppercase micro-labels, no letter-spacing
   theatre.
5. **8 px rhythm.** Spacing, padding and gaps land on the grid. Radii: control
   bar 20, card 13–14, chip 8–10, pill 999.
6. **Reach.** 40–44 px targets; hover, focus and keyboard states are real; every
   pointer action has a keyboard equivalent.
7. **Browse is free; commit is explicit.** Preview changes nothing. Commit is a
   visible action with a progress state and a failure state.
8. **Motion is widget-level.** The repo treats CSS transitions as dead in GTK
   4.24 (`dotfiles-assets/skins/tests/fixtures/invalid/transition.gtk.css.j2:1`).
   Use crossfades/reveals and tick-driven opacity, ~160–280 ms.
9. **Settings use the capture-tool grammar.** Group title, rows, segmented
   pills, a spin value, save-on-change. Missing/corrupt config degrades to
   defaults.

---

## 4. User flow and state machine

### 4.1 States

| State | What is on screen | Set button | Navigation |
| --- | --- | --- | --- |
| `closed` | The real desktop; no overlay chrome | — | — |
| `live` | Live wallpaper + `Live` pill | Disabled: `Current wallpaper` | Allowed |
| `preview` | Candidate wallpaper + `Preview` pill | Enabled: `Set wallpaper` | Allowed |
| `look-preview` | Candidate look + `Preview · <look>` | Enabled | Allowed |
| `committing` | Candidate + `Setting…` pill + 3-step bar | `Setting wallpaper…` | Locked |
| `grid` | Contact sheet + search | Hidden | Grid only |
| `settings` | A `Gtk.Popover` over the current state | Depends on the underlying state | Popover only |

The preview states (`preview`, `look-preview`) are the same state with a
different focus; the distinction is only for the badge and the selected chip.

### 4.2 Transitions

| From | Event | To | Notes |
| --- | --- | --- | --- |
| `closed` | launcher/keybind | `live` | Reset focus to the live item; re-read settings; smart rescan. |
| `live` / `preview` / `look-preview` | `←`/`→`, peek click, arrow click | `preview` (look = Original) | `showArt(newWallpaper)`; `lookIndex=0`; no system write. |
| `preview` / `look-preview` | `↑`/`↓`, look chip | `look-preview` | Filter/grade change only. |
| `preview` / `look-preview` | `Set` / `Enter` | `committing` | Capture the target; lock navigation. |
| `live` | `Set` / `Enter` | `live` | No-op. |
| `committing` | `applying` event | `committing` step 1 | Status: “Swapping pixels…”. |
| `committing` | `visible` event | `committing` step 2 | Status: “Building palette…”. |
| `committing` | `done` event | `live` | `live = target`; show `Live`; hold ~1.2 s; hide. |
| `committing` | `error` event / timeout | `preview` | Keep the preview; show the error; do not mark live. |
| any visible state | `Esc` | `closed` | Cancel: hide; never write. |
| `live` / `preview` | `G` / `/` | `grid` | Search focused. |
| `grid` | card click / `Enter` on first result | `preview` | Return to the overlay focused on that wallpaper. |
| `grid` | `Esc` | previous state | First Esc clears a non-empty search; second closes the grid. |
| any visible state | gear | `settings` | Popover over the current state. |
| `settings` | `Esc` / outside click | previous state | Changes already persisted. |
| `committing` | external window hide (`ags toggle`) | hidden | Do **not** cancel the apply; on remap, reflect the live state. |

### 4.3 Commit mapping (real app)

The mock's three 700 ms steps are a simulation. The real app maps the visible
steps to the existing domain event:

| Step | Event / condition | UI |
| --- | --- | --- |
| 1 “Swapping pixels” | `wallpaper.state` = `applying` | progress 33 % |
| 2 “Building palette” | `wallpaper.state` = `visible` (pixels swapped, theming in flight) | progress 66 % |
| 3 “Updating icons” | still `visible`, until `done` | progress 100 % on `done` |
| Failure | `error` or 30 s timeout | revert to `preview`; error text; unlock |
| Success | `done` | `live = target`; hold ~1.2 s; hide |

The overlay must never implement its own apply sequence. The only write is
`dotfiles-runtime wallpaper set <image>` via the existing `lib/apply.ts`.

### 4.4 Cancel / reopen semantics

- **Cancel (`Esc`)**: hide the overlay. The real desktop is underneath; the
  wallpaper was never written. The mock crossfades back to the live image only
  because the mock is itself the desktop.
- **Reopen**: always reset focus to the live wallpaper/look. Never resume a
  stale preview.
- **External hide during commit**: the apply continues; the overlay is hidden.
  On remap, show the resulting live state (or the in-flight steps if still
  running).

---

## 5. Layout spec

### 5.1 Anatomy

```text
┌──────────────────────────────────────────────────────────────┐
│  desktop bar (other app; visible or covered per setting)     │
│                                                              │
│  ‹                                                       ›   │
│              candidate wallpaper, full-bleed                 │
│              (two crossfaded layers)                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ filename  [Live|Preview]   Looks  ▣ ▣ ▣ ▣   [⚙] [Set] │  │
│  │ res · size · palette hint                  Esc · G · / │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Wallpaper layers

- Two full-window `Gtk.Picture` layers (or a `Gtk.Stack` with `CROSSFADE`).
- `ContentFit.COVER`, decoded at monitor size (see §8.4).
- Crossfade: 500 ms; a subtle filter transition for looks: 400 ms.
- Vignette: one overlay with a radial edge darkening and a bottom gradient for
  bar legibility. The image must stay the image; the vignette is not a scrim.
- No accent frame, no rounded stage, no card.

### 5.3 Side arrows

- 62 × 62 px circular glass buttons; 24 px chevron; 26 px from the left/right
  edges; vertically centred.
- `rgba(9,9,13,.40)` + 18 px blur + 1 px hairline + soft shadow; opacity .80,
  1.0 on hover; scale 1.04 on hover.
- Disabled at opacity .22 during commit.
- Focus ring: 2 px accent, 3 px offset.

### 5.4 Control bar

- Width `min(1160px, 100vw − 56px)`; bottom inset 30 px; top inset
  `reservedTop + 14px + offset` when placed top (see §7.4).
- Radius 20 px; padding 14 px 18 px; 1 px hairline; glass
  `rgba(9,9,13,.54)` + 28 px blur + 20 px shadow; overflow hidden for the
  progress line.
- Grid: `1fr auto 1fr`, gap 26 px. Left = info, centre = looks, right =
  actions. `Gtk.CenterBox` is the natural implementation.
- Progress: 2 px accent line along the bottom edge, width = progress, visible
  only while committing.

**Left zone**

- Filename: 16 px / 650, ellipsised.
- State pill: 20 px high, 9.5 px / 700; `Live` has a 6 px green dot and green
  tint; `Preview` is neutral; `Setting…` is neutral.
- Meta: 11.5 px dim, tabular numbers: `3840 × 2160 · 2.4 MB`.
- Palette hint: five 12 px dots with a 1 px inset ring.

**Centre zone**

- Header: `Looks` + the selected look name + `↑`/`↓` keycaps, 10.5 px.
- Chips: 54 × 34 px, radius 8, background = the look's thumbnail; selected =
  2 px accent ring; live = a 5 px green dot at the top-right; opacity .70,
  1.0 on hover.
- No looks: an honest 10.5 px note, `No looks yet — generated on first set.`

**Right zone**

- Gear: 42 × 42 px circular button, hairline; active state while the popover is
  open.
- Set: 42 px high, pill; accent fill, `on-accent` ink, 13 px / 700, `↵`
  keycap; `Current wallpaper` is a disabled neutral state; `Setting
  wallpaper…` is a progress state with an inner fill.
- Hints: 9.5 px faint: `Esc cancel · G grid · / search`.

### 5.5 Settings popover

- 322 px wide; radius 16; padding 14; glass `.92` + blur; shadow.
- Opens above the control bar when it is bottom, below it when it is top;
  anchored to the gear.
- Rows: label 11.5 / 550, optional description 9.5 faint; control on the
  right.
- Segmented pills: 26 px high, 10.5 / 600; track `rgba(255,255,255,.06)`; the
  selected segment `rgba(255,255,255,.15)`.
- Stepper: 26 px circular `−` / `+`, 34 px value, tabular numbers.
- Footer: `Changes save immediately.`
- The top-offset row is disabled at `.36` opacity and not interactive unless
  the position is `top` (mirrors the capture tool).

### 5.6 Contact sheet

- Full window; `rgba(6,6,9,.86)` + 30 px blur; no bar visible underneath.
- Header: title 21 / 650 + count; subtitle 11.5 faint; search field 300 × 36
  pill; close button.
- Cards: `minmax(280px, 1fr)`, max width 1320, gap 24 × 20; 16:9 art, radius
  13; focused = 2 px accent ring; live = green `Live` badge.
- Search filters by wallpaper name; `Enter` selects the first result.

### 5.7 Type and colour tokens

| Token | Value |
| --- | --- |
| ink / dim / faint | `#f6f5f8` / 62 % / 40 % |
| hairline | `rgba(255,255,255,.14)` |
| glass | `rgba(9,9,13,.54)`; strong `.82`–`.92` |
| live | `#4ade80` |
| accent | from the generated palette (mock: per-wallpaper accent) |
| on-accent | the palette's on-primary |
| bar radius / card / chip / pill | 20 / 13–14 / 8–10 / 999 |

Type sizes: 9.5 hints, 10.5 caption/looks head, 11.5 meta, 13 body, 16 title,
21 grid title, 30 max stage title. No uppercase.

### 5.8 Responsive safety

The target is a desktop monitor, not a phone. Still:

- `< 1180 px`: control bar gap 16; hints hidden.
- `< 980 px`: looks zone hidden; info + actions remain.
- `< 880 px`: arrows 52 px, 14 px inset; control bar 18 px from the bottom;
  grid search narrower.

### 5.9 Accessibility

- Every icon-only button has an `aria-label` / accessible name.
- Visible focus ring on all controls; tab order: gear → Set → looks → arrows?
  Choose a deterministic order and document it in the implementation.
- 40–44 px targets; no hover-only action is the only way to do something.
- Keyboard parity: all pointer actions have a key.
- Motion is decorative; no state depends on an animation completing.
- The preview/commit distinction must be conveyed by text (`Preview` / `Live`),
  not colour alone.

---

## 6. Interaction contract

### 6.1 Keyboard

| Key | Action | State guard |
| --- | --- | --- |
| `←` / `→` | Previous / next wallpaper | not committing, not grid/settings |
| `↑` / `↓` | Previous / next look | not committing; wraps; empty note if none |
| `Enter` | Set wallpaper | preview/look-preview only |
| `Esc` | Cancel overlay; first closes settings, then grid (clears search first) | not committing |
| `G` | Toggle contact sheet | not committing, not settings |
| `/` | Open contact sheet and focus search | not committing, not settings |
| `Tab` / `Shift+Tab` | Move focus within the bar / popover | native GTK |
| `Delete` (grid/list?) | Not in this overlay; delete lives in the clipboard | — |

During `committing`, all navigation keys are ignored; `Esc` is ignored until
the commit resolves or fails.

### 6.2 Pointer

| Target | Action |
| --- | --- |
| Left/right arrow | Navigate wallpaper |
| Left/right peek | Navigate wallpaper |
| Look chip | Select look (preview) |
| Set | Commit (if not live) |
| Gear | Toggle settings popover |
| Grid card | Focus that wallpaper and return to the overlay |
| Search field | Filter the grid |
| Outside settings popover | Close settings |
| Window close / launcher toggle | Hide (same as cancel) |

Clicking the wallpaper itself does nothing. There is no hidden second meaning
on the stage, and no click-to-apply on the image.

### 6.3 Focus and keymode

- The main overlay has no text input; `Astal.Keymode.ON_DEMAND` is enough.
- The window is presented on open; the key controller is installed in the
  **capture** phase so arrows/Enter/Esc are seen before any focused button.
- The grid search entry takes typed input only in the grid; the main key
  controller must ignore typing when the focus is an entry (the existing
  clipboard/selector pattern).
- The settings popover is a native `Gtk.Popover`; it owns its own focus/Esc.

### 6.4 Busy / guards

- `committing` locks: navigation, looks, grid, settings, close.
- Browse never locks.
- The busy lock is driven by the commit state, not by a timer.
- External `ags toggle` can hide the window during commit; the apply continues.

### 6.5 Empty / error states

- No wallpapers: `No wallpapers in the install spine.`; Set disabled.
- No search results in the grid: `No wallpapers match “<query>”.`
- No variants: `No looks yet — generated on first set.`
- Apply error: keep the preview; state back to `Preview`; show the error in
  the meta line (accent/error ink); Set re-enabled. The live item is unchanged.
- Missing/corrupt settings: defaults; the overlay still opens.

---

## 7. Settings contract

### 7.1 File and schema

Path: `$XDG_CONFIG_HOME/wallpaper-selector/config.json`

```json
{
  "control_bar": {
    "position": "bottom",
    "offsetPx": 0
  },
  "desktop_bar": {
    "keep_visible": true
  }
}
```

- `control_bar.position`: `"bottom" | "top"`; anything else → default.
- `control_bar.offsetPx`: finite number, integer, clamped `0..2000`; anything
  else → default. It is **top-only** (disabled in the UI at bottom, like the
  capture tool's top offset).
- `desktop_bar.keep_visible`: boolean; anything else → default.
- Unknown keys are ignored. Missing keys fall back per-key.
- The file is written pretty-printed JSON with a trailing newline.

Why `wallpaper-selector` and not `ags-wallpaper-selector`: the capture tool
precedent is `$XDG_CONFIG_HOME/capture-tool/config.json` while its AGS
`configDir` is `ags-capture`. The settings namespace is the app id, not the
deployed link basename. One namespace, documented here; never both.

`$XDG_CONFIG_HOME/ags-wallpaper-selector` is the AGS config link into the
installed tag (immutable). The UI writes only
`$XDG_CONFIG_HOME/wallpaper-selector/config.json`; it never writes through the
link.

### 7.2 Capture-tool pattern (the reference)

| Layer | Capture tool evidence | Wallpaper selector mapping |
| --- | --- | --- |
| Pure vocabulary + defaults + merge + validate | `ags-capture-tool/domain/settings.ts` (`CaptureSettings`, `DEFAULT_SETTINGS`, `mergeSettings`, `validateSettings`) | `domain/settings.ts` with `WallpaperSelectorSettings` |
| Port | `ags-capture-tool/ports/settings-store.ts` (`load()`, `save()`) | `ports/settings-store.ts` |
| GLib adapter | `ags-capture-tool/adapters/glib-settings-store.ts:31-32` (path), `:45-70` (load), `:76-95` (save) | `adapters/glib-settings-store.ts` |
| Settings UI rows | `ags-capture-tool/ui/shared/rows.ts:110-205` (`toggleRow`, `pillRow`, `numberRow`) | `ui/settings-popover.tsx` with the same grammar |
| Placement apply | `ags-capture-tool/ui/classic/ClassicWindow.tsx:434-450` (`applyPlacement`) | `applyPlacement()` in the overlay |
| Reserved zone | `ags-capture-tool/ports/monitor-reserved.ts` + `adapters/hyprland-monitor-reserved.ts` + `domain/monitor-reserved.ts` | same port/adapter pattern, app-local |
| Immediate save | `ags-capture-tool/ui/classic/SettingsPage.tsx:95-110` (`persistSettings`) | save on every committed row change |
| Cross-app read | `ags-bar/bar/widgets/recording.tsx:68-69` via `ags-platform` `Preferences` | only if another app needs it later |

The selector must not import the capture-tool files (app → app is forbidden).
Mirror the pattern; when the orchestrator/shared settings plane lands, promote
the row vocabulary to `ags-platform`.

### 7.3 Placement math

Pure function, tested without GTK:

```text
bottom: marginBottom = 30
        anchor = BOTTOM, valign = END
        offsetPx is ignored (UI row disabled)

top:    marginTop = reservedTop + 14 + offsetPx
        anchor = TOP, valign = START

reservedTop = compositor's top EXCLUSIVE zone for the monitor (0 if unknown)
```

- `14` is the intentional float gap below the desktop bar.
- The overlay is **never EXCLUSIVE**. It cannot feed back into the compositor's
  reserved zone.
- `reservedTop` is read from AstalHyprland primarily, with
  `hyprctl -j monitors` as the synchronous fallback (the capture tool's exact
  lesson: a stale 0 would put the bar over the desktop bar for a frame).
- Failure to read → `0`: the control bar still opens; it just cannot auto-slot.

### 7.4 Desktop bar visible / covered

This is a **geometry** decision, not a cross-app visibility command:

- `keep_visible = true`: the preview window's `margin_top = reservedTop`.
  The desktop bar's reserved strip is left uncovered, so the normal bar
  remains visible. The preview is the rest of the screen (the wallpaper is
  cropped by the reserved strip; that is the accepted cost of not building the
  orchestrator yet).
- `keep_visible = false`: the preview window's `margin_top = 0`; the overlay
  covers the full monitor, including the bar's strip. The bar still exists
  underneath.
- The selector does **not** call another app or change another window's
  visibility. True show/hide/stack is the orchestrator's job (D12).

### 7.5 Settings UI

A gear in the control bar opens a `Gtk.Popover` with:

- **Control bar** — `Bottom` / `Top` (segmented).
- **Desktop bar** — `Show` / `Hide` (segmented; maps to `keep_visible`).
- **Top offset** — a spin value, enabled only when `Top`; unit: extra pixels
  below the reserved zone.
- Footer: `Changes save immediately.`

Every change persists immediately and re-applies placement. There is no Save
button. The popover closes on `Esc` or outside click; changes are already
saved.

### 7.6 Degradation

- Missing file → silent defaults (first run, not an error).
- Corrupt file → loud `console.error`, then defaults; the overlay opens.
- Save failure → keep the in-memory value for the session, show the error in
  the popover footer; never crash the overlay.
- Invalid enum/number/bool → per-key default; other keys still apply.

### 7.7 Orchestrator boundary (deferred)

- Now: per-app config, per-app settings UI, per-app placement; no shared
  registry, no cross-app commands.
- Later: an orchestrator reads the namespaced keys, resolves collisions
  (two top bars, two overlays, reserved-zone conflicts) and owns true
  visibility/stacking.
- The selector's `desktop_bar.keep_visible` is intentionally phrased as
  “my preview leaves the strip alone”, not “hide the bar”. That keeps the
  meaning valid when the orchestrator takes over.

---

## 8. Architecture

### 8.1 Repo and identity

`ags-wallpaper-selector` is a standalone app repo. Identity is frozen by
`app.manifest.json`:

```text
app=wallpaper-selector  instance=wallpaper-selector
configDir=ags-wallpaper-selector  mode=live
window=wallpaper-selector-window
```

The launcher (<install>/bin/wallpaper-selector-ui) toggles the same window
name with `ags toggle`; the redesign **keeps** `wallpaper-selector-window`.

### 8.2 New/changed modules

```text
domain/settings.ts            WallpaperSelectorSettings, defaults, merge, validate
domain/placement.ts           pure margins: bottom(30) / top(reserved+14+offset)
ports/settings-store.ts       load()/save()
ports/monitor-reserved.ts     reservedTop(connector) -> number
adapters/glib-settings-store.ts   $XDG_CONFIG_HOME/wallpaper-selector/config.json
adapters/hyprland-monitor-reserved.ts   AstalHyprland + hyprctl fallback

ui/OverlayWindow.tsx          full-screen window, wallpaper layers, chrome
ui/ControlBar.tsx             info / looks / actions
ui/LooksStrip.tsx             Original + variants, live dot, selected ring
ui/ContactSheet.tsx           Gtk.Stack page + search + FlowBox
ui/SettingsPopover.tsx        the three placement rows
lib/stage.ts                  display-size decode + neighbour preload
lib/palette-hint.ts           dominant-colour hint (never a palette producer)
lib/state.ts                  pure overlay state machine (live/preview/committing/...)
```

`ui/WallpaperSelectorWindow.tsx` is retired or reduced to a thin mounting
wrapper. `lib/scan.ts`, `lib/model.ts`, `lib/thumbnails.ts`, `lib/apply.ts` and
`lib/appearance.ts` are reused; `style.css` is rewritten around the new
classes.

### 8.3 Window and rendering

- One `Astal.Window`: `layer = OVERLAY`, anchor all four edges,
  `exclusivity = IGNORE`, `keymode = ON_DEMAND`, name
  `wallpaper-selector-window`.
- `margin_top = reservedTop` when `desktop_bar.keep_visible`, else `0`.
- Wallpaper: `Gtk.Stack` with `CROSSFADE` (500 ms), two `Gtk.Picture`
  children, `ContentFit.COVER`. If the stack's crossfade cannot be made to
  fill correctly, use a `Gtk.Overlay` with two pictures and a tick-driven
  opacity swap. Do not ship CSS transitions.
- Vignette: a `Gtk.DrawingArea` or a CSS-gradient `Gtk.Box` overlay,
  input-transparent.
- Chrome: `Gtk.Overlay` children, `halign` START/END for arrows, `valign`
  START/END for the bar. The bar is a `Gtk.CenterBox` (start/center/end).
- Gear: `Gtk.MenuButton` + `Gtk.Popover` (native outside-click/Esc).
- Looks: `Gtk.Button` containing `Gtk.Picture`; live dot in a `Gtk.Overlay`.
- Contact sheet: `Gtk.Stack` page with a `Gtk.SearchEntry` and a
  `Gtk.FlowBox` (the existing FlowBox logic can be reused).
- Progress: a 2 px `Gtk.Box` fill driven by the three event steps (not a
  continuous timer).
- Toast: `Gtk.Revealer` + label, bottom centre.

### 8.4 Data and performance

- **Grid**: existing 208 px thumbnails and async idle pump; unchanged.
- **Stage**: new display-size decode (monitor logical size, cap ~2560 px) with
  its own cache. Do not reuse the 208 px grid thumbs for the stage.
- **Preload**: decode the previous/next wallpaper at half resolution while the
  current one is visible. Never block map/show; apply cache hits
  synchronously, misses on idle.
- **Looks**: 108 × 68 px decode (2× the 54 × 34 chip) from the variant paths.
- **Metadata**: add width, height and byte size to `WallpaperEntry` via
  `GdkPixbuf.get_file_info` / `Gio.File.query_info`; test in `model.test.mjs`.
- **Palette hint**: sample a downscaled stage texture and quantize to five
  colours. It is a **hint only**: never written to disk, never used as a theme,
  never a second palette producer. `tpr` remains the sole palette producer.
  If extraction fails, render no dots.
- **Variants**: only existing variants from `cache/effects/*/meta.json`; no
  pre-generation. The strip always shows `Original`; if no variants exist, show
  the honest note. `wallpaper.state` `done` triggers a rescan so newly
  generated variants appear.

### 8.5 Appearance integration

- `createAppearance({ configDir: "ags-wallpaper-selector" })` stays; `apply()`
  runs at startup.
- The `palette-refresh` handler re-applies the whole appearance, then rebuilds
  only appearance-derived widgets (the search/gear glyphs if they are
  registry-backed). It must preserve: overlay visibility, focused wallpaper,
  look index, commit state, grid query.
- The wallpaper thumbnails and palette hint are content, not appearance; do not
  rebuild the stage on a palette refresh.
- `style.css` remains the bundled glass fallback; the generated appearance
  sheet wins at USER priority. No new skin structure; layout metrics stay in
  TSX/CSS unless the appearance plane adds a token.

### 8.6 Contact sheet and search

- The main overlay has no search field (D10).
- `G` / `/` opens the grid; the search entry gets focus.
- Selecting a card sets the focus to that wallpaper, closes the grid, and
  returns to the overlay.
- `Esc` in the grid clears a non-empty query first, then closes the grid.

### 8.7 Tests and gates

Current tests to rewrite:

- `tests/hoverbar-layout.test.mjs` → `control-bar-layout.test.mjs`: three-zone
  order, bar width/radius, no accent frame, accent only on Set/selected look,
  target sizes.
- `tests/apply-collapse.test.mjs` → `commit-flow.test.mjs`: browse never calls
  `applyWallpaper`; Set/Enter only; the overlay does not hide until `done`;
  error keeps the preview; Esc hides without applying.

Keep/update: `model.test.mjs`, `unit.test.mjs`,
`event-contract-drift.mjs`, `app-contract.test.mjs`, `no-contrast-surface`
(review its assumptions against the new chrome).

New pure tests:

- `settings.test.ts` — defaults, per-key merge, corrupt input, validation,
  clamping.
- `placement.test.ts` — bottom 30; top reserved+14+offset; reserved 0;
  offset clamp; never negative.
- `state.test.ts` — the transition table (§4.2), especially “browse never
  commits” and “no close before done”.
- `palette-hint.test.ts` — quantizer determinism/empty input.
- Optional `mockup-parity.test.mjs` — read the mock and assert the frozen
  numbers/keys here.

Commands (app repo):

```sh
make ci       # stock-runner: test + conformance + drift
make gates    # + bundle + typecheck (desktop stack)
```

Composition: `make gates-ci`, `make deploy-coverage`; bump the app tag in
`dotfiles/provisioning/apps.yaml`. No new skeleton files, so no engine
`skeleton_files` registration is needed.

### 8.8 Shipping shape

- One new tag for `ags-wallpaper-selector`.
- Composition bumps the app tag; no second per-app list.
- The mock lives with this ticket
  (`tickets/REQ-005-overlay-redesign/mock.html`) and is not deployed.
- Rollback is the previous tag; the settings file is additive and tolerant, so
  the old selector can ignore it (or degrade to defaults).

---

## 9. Acceptance criteria

**Visual**

- [ ] At 1600×1000 and 1920×1080 the overlay matches the mock’s proportions:
      full-bleed wallpaper, 62 px side arrows, 1160 px control bar, 20 px radius.
- [ ] No accent frame around the wallpaper, the bar or the chips; accent appears
      only on Set, the selected look, focus and progress.
- [ ] The states `Live`, `Preview`, `Preview · <look>`, `Setting…` are visually
      distinct and readable.
- [ ] The no-looks and no-wallpapers states are honest.
- [ ] Bottom and top control bar placements, with the desktop bar shown or
      covered, all match the mock.

**Interaction**

- [ ] `←`/`→` browse; `↑`/`↓` looks; `Enter`/Set commits; `Esc` cancels.
- [ ] Browsing performs no write; the only write is `wallpaper set`.
- [ ] The overlay stays open through the three commit steps and hides after
      `done`; a failure keeps the preview and never marks live.
- [ ] Reopening resets focus to the live wallpaper/look.
- [ ] `G`/`/` opens the grid and focuses search; `Esc` clears then closes.
- [ ] Every pointer action has a keyboard equivalent.

**Settings**

- [ ] `$XDG_CONFIG_HOME/wallpaper-selector/config.json` is created/updated on
      change, pretty JSON, no Save button.
- [ ] Missing/corrupt config degrades to defaults; the overlay still opens.
- [ ] Bottom placement = 30 px inset; top = `reservedTop + 14 + offset`, never
      EXCLUSIVE, never overlaps the reserved zone.
- [ ] `desktop_bar.keep_visible` leaves the reserved strip uncovered; false
      covers the full monitor.
- [ ] Changing any row applies live and survives a restart.

**Performance**

- [ ] Opening with a warm cache presents the overlay in < 200 ms; the first
      stage decode does not block map/show.
- [ ] Neighbour preload makes the next/previous transition immediate.
- [ ] Switching looks does not re-decode the full wallpaper.
- [ ] The grid keeps the existing 208 px async pump; no regression to the
      measured ~430 ms full-history/thumbnail path.

**Architecture**

- [ ] No app → app imports; settings/placement live in the selector repo.
- [ ] Appearance refresh preserves overlay state.
- [ ] `make ci` + `make gates` pass; the composition gates pass after the tag
      bump.
- [ ] The launcher still toggles `wallpaper-selector-window`.

---

## 10. Open questions

1. **Multi-monitor.** The current app creates one window on
   `app.get_monitors()[0]`. The redesign is monitor-agnostic in the mock. Do we
   open on the focused monitor (needs a monitor-focus port), or keep the
   primary? (Recommendation: focused monitor; same pattern as the capture
   tool.)
2. **Defaults.** The doc freezes bottom + `keep_visible = true` + offset 0.
   Confirm before implementation.
3. **Settings surface.** Popover (current) vs a full settings page like the
   capture tool. The popover is proportionate to three rows; a full page is
   available if the settings grow.
4. **Motion tokens.** Appearance v2 has no motion token. The mock’s timings are
   implementation guidance; if motion should be skin-controlled, that is an
   appearance-plane decision.
5. **Variant pre-generation.** Not in scope. The strip is honest about missing
   looks; a future “generate preview” path would be a separate feature.
6. **True desktop-bar hide/show.** Deferred to the orchestrator (D12). The
   current setting only controls whether the preview covers the reserved
   strip.
7. **Clicking the wallpaper.** The design intentionally makes the stage inert.
   If a single-click commit is desired later, it must be an explicit,
   documented exception to D7.

---

## 11. Evidence index

Current app:

- `ags-wallpaper-selector/app.manifest.json` — identity.
- `ags-wallpaper-selector/app.tsx:36-38` — `createAppearance`.
- `ags-wallpaper-selector/ui/WallpaperSelectorWindow.tsx:154,219,600-601` —
  4-across 208 px grid, 960×640.
- `ags-wallpaper-selector/ui/WallpaperSelectorWindow.tsx:315-380` — hover
  Apply.
- `ags-wallpaper-selector/ui/WallpaperSelectorWindow.tsx:512-540` — immediate
  hide on apply.
- `ags-wallpaper-selector/style.css:20-26` — accent panel frame.
- `ags-wallpaper-selector/lib/apply.ts` — the one apply command.
- `ags-wallpaper-selector/lib/scan.ts` — spine/effects/current inputs.
- `ags-wallpaper-selector/lib/model.ts` — wallpapers/variants/live.
- Pinned engine `cli_tools/templates/wallpaper-selector-ui.j2` — `ags toggle`
  on `wallpaper-selector-window`.

Capture-tool settings reference:

- `ags-capture-tool/domain/settings.ts` — types, defaults, merge, validate.
- `ags-capture-tool/ports/settings-store.ts` — load/save seam.
- `ags-capture-tool/adapters/glib-settings-store.ts:31-32,45-70,76-95` — path
  and degradation.
- `ags-capture-tool/ui/shared/rows.ts:110-205` — toggle/pill/number rows.
- `ags-capture-tool/ui/classic/SettingsPage.tsx:95-110,212-239` — immediate
  persist, placement rows.
- `ags-capture-tool/ui/classic/ClassicWindow.tsx:434-450` — `applyPlacement`.
- `ags-capture-tool/domain/bar-placement.ts:25-36` — margin math.
- `ags-capture-tool/ports/monitor-reserved.ts`,
  `adapters/hyprland-monitor-reserved.ts`, `domain/monitor-reserved.ts` —
  reserved zone.
- `ags-bar/bar/widgets/recording.tsx:68-69` — cross-app read via Preferences.

Normative mock:

- `tickets/REQ-005-overlay-redesign/mock.html` — the artifact.
- `tickets/REQ-005-overlay-redesign/ticket.md` — how to open, what is
  simulated.
