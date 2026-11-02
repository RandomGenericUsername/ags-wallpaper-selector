// P5 drill-down window: level 1 wallpaper grid (search + quick-apply),
// level 2 per-wallpaper variant gallery (breadcrumb + Back).
//
// Built imperatively with `createEffect` reactivity (same pattern as the
// ICME `EditorWindow`); only the top-level `<window>` shell is JSX. Cards
// are plain boxes with a click gesture (never nested buttons): the tile
// drills down, the inner Apply button applies directly.

import { Astal, Gdk, Gtk } from "ags/gtk4";
import app from "ags/gtk4/app";
import GdkPixbuf from "gi://GdkPixbuf?version=2.0";
import GLib from "gi://GLib?version=2.0";
import Pango from "gi://Pango?version=1.0";
import { createEffect, createState } from "ags";
// The ONE event client (spine AD-5): the app-local event-bus copies are gone,
// so the selector consumes `wallpaper.state` through the platform's shared Gio
// transport + subscribe-before-read core. The event is progress/busy status
// only; palette application is the runtime's `palette-refresh` command (AD-27).
import { domainEvents } from "ags-platform/adapters/event-bus";
// The platform IconProvider (spine AD-4/AD-7): the shared registry-backed
// provider replaces the app-local icon-registry.ts copy.
import { registryProvider } from "ags-platform/adapters/icon";
import { applyWallpaper } from "../lib/apply";
import {
  filterWallpapers,
  stemOf,
  variantsFor,
  type SelectorModel,
  type VariantEntry,
  type WallpaperEntry,
} from "../lib/model";
import { loadModel, loadModelSmart } from "../lib/scan";
import { cachedTexture, generateThumb, thumbTexture } from "../lib/thumbnails";

const WINDOW_NAME = "wallpaper-selector-window";

//: The contract topic this selector consumes. The platform's shared client
//: exports no `WALLPAPER_STATE_TOPIC` constant (the notifications app uses the
//: literal too); the drift gate pins this literal against
//: `contracts/event-contract.json` (`topics["wallpaper.state"]`).
const WALLPAPER_STATE_TOPIC = "wallpaper.state";

function hideWindow(): void {
  const window = app.get_window(WINDOW_NAME);
  if (window) window.visible = false;
}

/**
 * Registry-backed chrome refresher, registered by the one selector window and
 * called from the app-level `palette-refresh` handler. It re-renders only the
 * palette-derived search icon; it never rescans, hides or rebuilds the drawer.
 */
let refreshChrome: (() => void) | null = null;

export function refreshWallpaperSelectorChrome(): void {
  refreshChrome?.();
}

export function WallpaperSelectorWindow(gdkmonitor: Gdk.Monitor) {
  const [model, setModel] = createState<SelectorModel | null>(null);
  const [query, setQuery] = createState("");
  const [selected, setSelected] = createState<WallpaperEntry | null>(null);
  const [status, setStatus] = createState("Ready.");
  const [busy, setBusy] = createState(false);

  // Busy = a local set in flight OR the last observed `wallpaper.state`
  // being `applying`/`visible`. Event-driven so an apply started elsewhere
  // locks the Apply controls too.
  let localApply = false;
  let eventBusy = false;

  // Apply controls are recreated per render; `refreshBusy` re-asserts
  // sensitivity on every busy transition.
  const applyControls: Gtk.Button[] = [];

  // Magnifier from the platform IconProvider (AD-4/AD-7): the shared
  // registry-backed provider answers with a tagged `IconSource` — a rendered
  // FILE (palette-tinted) or a themed NAME on a bare desktop (AD-18) — with a
  // stock symbolic fallback when the manifest has no art for the group.
  function searchUiIcon(): Gtk.Widget {
    const source = registryProvider.resolve("ui", "search");
    if (source !== null && source.kind === "file") {
      try {
        const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(source.path, 18, 18);
        const picture = Gtk.Picture.new_for_paintable(Gdk.Texture.new_for_pixbuf(pixbuf));
        picture.set_content_fit(Gtk.ContentFit.CONTAIN);
        picture.set_size_request(18, 18);
        picture.set_halign(Gtk.Align.CENTER);
        picture.set_valign(Gtk.Align.CENTER);
        picture.add_css_class("ws-ui-icon");
        return picture;
      } catch (error) {
        console.error(`wallpaper-selector: cannot load search icon ${source.path}: ${error}`);
      }
    } else if (source !== null && source.kind === "name") {
      const named = Gtk.Image.new_from_icon_name(source.name);
      named.set_pixel_size(18);
      named.set_halign(Gtk.Align.CENTER);
      named.set_valign(Gtk.Align.CENTER);
      return named;
    }
    const fallback = Gtk.Image.new_from_icon_name("system-search-symbolic");
    fallback.set_pixel_size(18);
    fallback.set_halign(Gtk.Align.CENTER);
    fallback.set_valign(Gtk.Align.CENTER);
    return fallback;
  }

  const search = new Gtk.Entry({
    placeholder_text: "Search wallpapers…",
    hexpand: true,
  });
  search.add_css_class("ws-search");
  search.connect("changed", () => {
    setQuery(search.get_text());
    renderGrid();
  });
  const searchRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
  searchRow.append(searchUiIcon());
  searchRow.append(search);

  const titleLabel = new Gtk.Label({ css_classes: ["ws-title"], xalign: 0 });

  const crumbBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    css_classes: ["ws-crumb"],
    spacing: 12,
    visible: false,
  });
  const crumbThumb = new Gtk.Picture({ css_classes: ["ws-crumb-thumb"] });
  crumbThumb.set_size_request(84, 52);
  crumbThumb.set_content_fit(Gtk.ContentFit.COVER);
  crumbThumb.set_valign(Gtk.Align.CENTER);
  const crumbText = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, hexpand: true });
  const crumbName = new Gtk.Label({ css_classes: ["ws-crumb-name"], xalign: 0 });
  const crumbSub = new Gtk.Label({ css_classes: ["ws-crumb-sub"], xalign: 0 });
  crumbText.append(crumbName);
  crumbText.append(crumbSub);
  const backButton = new Gtk.Button({ label: "◀ Back", css_classes: ["ws-back"] });
  backButton.set_valign(Gtk.Align.CENTER);
  backButton.connect("clicked", () => goBack());
  crumbBox.append(crumbThumb);
  crumbBox.append(crumbText);
  crumbBox.append(backButton);

  // Non-homogeneous: Gtk.Picture reports the full paintable as its natural
  // size, which would stretch every card to the largest image (2 giant
  // columns). Children size to their requests instead (208px thumbs).
  const flow = new Gtk.FlowBox({
    selection_mode: Gtk.SelectionMode.NONE,
    column_spacing: 12,
    row_spacing: 12,
    homogeneous: false,
    max_children_per_line: 4,
  });
  const scrolled = new Gtk.ScrolledWindow({
    hexpand: true,
    vexpand: true,
    css_classes: ["ws-scroll"],
  });
  scrolled.set_child(flow);

  const statusLabel = new Gtk.Label({ css_classes: ["ws-status"], xalign: 0, wrap: true });
  createEffect(() => statusLabel.set_label(status()));

  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    css_classes: ["ws-root", "ws-panel"],
    spacing: 10,
  });
  // Empty-state banner lives OUTSIDE the FlowBox (mock): a FlowBox child
  // never reliably fills the row, so the banner is a plain block sibling
  // toggled against the scrolled grid — full width, centered text.
  const emptyBanner = new Gtk.Label({ css_classes: ["ws-empty"], xalign: 0.5 });
  emptyBanner.set_halign(Gtk.Align.FILL);
  emptyBanner.set_hexpand(true);
  const emptyWrap = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
  emptyWrap.append(emptyBanner);
  emptyWrap.set_visible(false);
  emptyWrap.set_hexpand(true);
  emptyWrap.set_halign(Gtk.Align.FILL);
  root.append(searchRow);
  root.append(crumbBox);
  root.append(titleLabel);
  root.append(scrolled);
  root.append(emptyWrap);
  root.append(statusLabel);

  // Async thumbnail pump: the grid renders INSTANTLY with empty pictures
  // and thumbs stream in off the critical path (a cold cache decodes ~5s
  // for the full spine — that must never block map/show). Cache hits apply
  // synchronously; misses decode a few per idle tick. `thumbGen` invalidates
  // queued items across re-renders (scroll/search/drill).
  let thumbGen = 0;
  let thumbQueue: { picture: Gtk.Picture; path: string; gen: number }[] = [];
  let thumbPumpScheduled = false;

  function pumpThumbs(): boolean {
    const batch = thumbQueue.splice(0, 3);
    for (const item of batch) {
      if (item.gen !== thumbGen) continue;
      const texture = generateThumb(item.path, GRID_DIM);
      if (texture !== null && item.gen === thumbGen) item.picture.set_paintable(texture);
    }
    if (thumbQueue.length > 0) return true;
    thumbPumpScheduled = false;
    return false;
  }

  function scheduleThumbPump(): void {
    if (thumbPumpScheduled || thumbQueue.length === 0) return;
    thumbPumpScheduled = true;
    GLib.idle_add(GLib.PRIORITY_LOW, pumpThumbs);
  }

  // Display sizes drive decode sizes: Gtk.Picture reports the full paintable
  // as its natural size, so thumbs are decoded at (near-)display size to
  // keep FlowBox columns tight (4 across ≈ 208px cards).
  const GRID_DIM = 208;
  const CRUMB_DIM = 96;

  function thumbPictureAsync(path: string, width: number, height: number): Gtk.Picture {
    const picture = new Gtk.Picture({ css_classes: ["ws-thumb", "ws-thumb-loading"] });
    picture.set_size_request(width, height);
    picture.set_content_fit(Gtk.ContentFit.COVER);
    const hit = cachedTexture(path, GRID_DIM);
    if (hit !== null) {
      picture.set_paintable(hit);
      picture.remove_css_class("ws-thumb-loading");
    } else {
      thumbQueue.push({ picture, path, gen: thumbGen });
      scheduleThumbPump();
    }
    return picture;
  }

  function clearFlow(): void {
    thumbGen++;
    thumbQueue = [];
    thumbPumpScheduled = false;
    applyControls.length = 0;
    let child = flow.get_first_child();
    while (child !== null) {
      const next = child.get_next_sibling();
      flow.remove(child);
      child = next;
    }
  }

  function showEmpty(text: string | null): void {
    // Empty states bypass the FlowBox entirely (see emptyWrap note): hide
    // the grid and show the banner, or vice versa.
    if (text === null) {
      emptyWrap.set_visible(false);
      scrolled.set_visible(true);
    } else {
      emptyBanner.set_label(text);
      scrolled.set_visible(false);
      emptyWrap.set_visible(true);
    }
  }

  function placeholder(text: string): void {
    showEmpty(text);
  }

  function thumbPicture(path: string, width: number, height: number): Gtk.Picture {
    return thumbPictureAsync(path, width, height);
  }

  function liveBadge(label = "LIVE", tooltip?: string): Gtk.Label {
    const badge = new Gtk.Label({ label, css_classes: ["ws-live"] });
    badge.set_halign(Gtk.Align.END);
    badge.set_valign(Gtk.Align.START);
    if (tooltip !== undefined) badge.set_tooltip_text(tooltip);
    return badge;
  }

  // ── Busy/deferral wiring ──────────────────────────────────────────────

  function refreshBusy(): void {
    const current = localApply || eventBusy;
    if (current !== busy()) setBusy(current);
    if (current) root.add_css_class("ws-busy");
    else root.remove_css_class("ws-busy");
    for (const control of applyControls) control.set_sensitive(!current);
  }

  function wallpaperCard(w: WallpaperEntry): Gtk.Widget {
    const card = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, css_classes: ["ws-card"] });
    // The live wallpaper is the "selected" card: accent ring + tint, matching
    // rofi's selection language (gui-unification spec §4 selection-ring).
    if (w.live) card.add_css_class("selected");
    const overlay = new Gtk.Overlay();
    overlay.set_child(thumbPicture(w.path, 208, 130));
    // LIVE badge: shown for a directly-live wallpaper AND for a wallpaper
    // whose VARIANT is live (its card is pinned first, but without this it
    // carried no indicator that it is the source of the live image). The
    // variant case names the variant in the tooltip.
    if (w.live) {
      overlay.add_overlay(liveBadge());
    } else {
      const liveSource = model();
      const liveVariant =
        liveSource === null
          ? undefined
          : variantsFor(liveSource, w.hash).find((v) => v.live);
      if (liveVariant !== undefined) {
        // Explicitly a VARIANT, not the original: the message differs from
        // the plain-live wallpaper badge so the source is unambiguous.
        overlay.add_overlay(liveBadge("LIVE VARIANT", `Live via variant “${liveVariant.name}”`));
      }
    }

    // Apply lives in a floating toolbar so the card itself stays a drill
    // target. Children stay visible; ONLY the toolbar is toggled on hover
    // (GTK does not inherit visibility from a parent, so a child marked
    // visible:false would never reappear).
    const quick = new Gtk.Button({
      label: "Apply",
      css_classes: ["ws-quick", "ws-hover-item"],
    });
    quick.connect("clicked", () => doApply(w.path, w.name));
    const hoverbar = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      css_classes: ["ws-hoverbar"],
      visible: false,
    });
    hoverbar.set_halign(Gtk.Align.END);
    hoverbar.set_valign(Gtk.Align.END);
    hoverbar.append(quick);
    overlay.add_overlay(hoverbar);
    applyControls.push(quick);

    const motion = new Gtk.EventControllerMotion();
    motion.connect("enter", () => hoverbar.set_visible(true));
    motion.connect("leave", () => hoverbar.set_visible(false));
    card.add_controller(motion);

    const name = new Gtk.Label({ label: w.name, css_classes: ["ws-card-name"], xalign: 0 });
    const sub = new Gtk.Label({
      label: w.variantCount === 1 ? "1 variant" : `${w.variantCount} variants`,
      css_classes: ["ws-card-sub"],
      xalign: 0,
    });
    if (w.variantCount === 0) sub.set_label("no variants");
    card.append(overlay);
    card.append(name);
    card.append(sub);
    const click = new Gtk.GestureClick();
    click.connect("pressed", (_gesture, _nPress, x, y) => {
      // Presses landing on the hover toolbar are owned by its child:
      // Apply applies; everything else on the card drills. Coordinates
      // arrive in card space.
      if (hoverbar.get_visible()) {
        const [, hx, hy] = card.translate_coordinates(hoverbar, x, y);
        if (hx >= 0 && hy >= 0 && hx < hoverbar.get_width() && hy < hoverbar.get_height()) {
          return;
        }
      }
      drill(w);
    });
    card.add_controller(click);
    return card;
  }

  function variantCard(v: VariantEntry): Gtk.Widget {
    // Flat tile matching the mock: bare thumbnail, name + pill Apply in one
    // row beneath (no card chrome, no full-width button). No "original"
    // tile: the original applies from the main grid's quick-Apply.
    const card = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, css_classes: ["ws-variant"] });
    // Deliberately NO click gesture on the thumbnail: only the Apply pill
    // sets the wallpaper (a press anywhere else must be inert).
    const picture = thumbPicture(v.path, 208, 130);
    const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    const name = new Gtk.Label({
      label: v.live ? `${v.name} · LIVE` : v.name,
      css_classes: ["ws-variant-name"],
      xalign: 0,
      hexpand: true,
      ellipsize: Pango.EllipsizeMode.END,
    });
    const apply = new Gtk.Button({ label: "Apply", css_classes: ["ws-variant-apply"] });
    apply.connect("clicked", () => doApply(v.path, v.name));
    applyControls.push(apply);
    row.append(name);
    row.append(apply);
    card.append(picture);
    card.append(row);
    return card;
  }

  function renderGrid(): void {
    const m = model();
    setSelected(null);
    searchRow.set_visible(true);
    crumbBox.set_visible(false);
    titleLabel.set_label("WALLPAPERS");
    showEmpty(null);
    clearFlow();
    if (m === null) {
      placeholder("Loading…");
      refreshBusy();
      return;
    }
    const list = filterWallpapers(m.wallpapers, query());
    if (list.length === 0) {
      placeholder(
        m.wallpapers.length === 0
          ? "No wallpapers in the install spine."
          : "No wallpapers match.",
      );
      refreshBusy();
      return;
    }
    for (const w of list) flow.append(wallpaperCard(w));
    refreshBusy();
  }

  function drill(w: WallpaperEntry): void {
    // Busy never blocks browsing/drill-down (browse-live, set-locked): only
    // the Apply controls are locked.
    setSelected(w);
    setQuery("");
    search.set_text("");
    searchRow.set_visible(false);
    crumbBox.set_visible(true);
    const m = model();
    const variants = m === null ? [] : variantsFor(m, w.hash);
    const parentTex = thumbTexture(w.path, CRUMB_DIM);
    if (parentTex !== null) crumbThumb.set_paintable(parentTex);
    crumbName.set_label(w.name);
    crumbSub.set_label(
      variants.length === 0
        ? "no variants yet"
        : `${variants.length === 1 ? "1 variant" : `${variants.length} variants`}${w.live ? " · LIVE" : ""}`,
    );
    titleLabel.set_label(`VARIANTS · ${w.name.toUpperCase()}`);
    showEmpty(null);
    clearFlow();
    for (const v of variants) flow.append(variantCard(v));
    if (variants.length === 0) {
      placeholder(`No variants yet — they are generated the first time ${stemOf(w.name)} is applied.`);
    }

    refreshBusy();
    setStatus(`Variants · ${w.name}. Back returns to the grid.`);
  }

  function goBack(): void {
    renderGrid();
    setStatus("Wallpapers — pick one to see its variants.");
  }

  // Hidden-instance warmup (preload). The instance is long-lived; right
  // after startup an idle callback runs the smart scan plus thumbnail
  // decode for all wallpapers (+ live variants) so the first toggle renders
  // from memory. Opens only ever pay stat validation.
  let mapped = false;
  let warmed = false;

  function warmup(): boolean {
    try {
      setModel(loadModelSmart());
      const m = model();
      if (m !== null) {
        for (const w of m.wallpapers) generateThumb(w.path, GRID_DIM);
        const live = m.wallpapers.find((w) => w.live);
        if (live !== undefined) {
          for (const v of variantsFor(m, live.hash)) generateThumb(v.path, GRID_DIM);
        }
      }
      warmed = true;
      if (mapped) renderGrid();
    } catch (error) {
      console.error(`wallpaper-selector: warmup failed: ${error}`);
    }
    return false;
  }

  function rescan(): void {
    try {
      setModel(loadModelSmart());
    } catch (error) {
      setStatus(`Failed to scan: ${error}`);
      return;
    }
    if (selected() !== null) {
      const m = model();
      const still = m?.wallpapers.find((w) => w.hash === (selected() as WallpaperEntry).hash);
      if (still !== undefined) {
        drill(still);
        return;
      }
    }
    renderGrid();
  }

  async function doApply(path: string, label: string): Promise<void> {
    if (localApply || eventBusy) return;
    localApply = true;
    refreshBusy();
    // Contract: the Apply CLICK collapses the drawer immediately. The set
    // keeps running in the background; `done`/`error` still rescan, refresh
    // chrome and unlock the controls. Never hide on `visible`: after the
    // palette reorder that event arrives seconds later, and it would also
    // close a selector the user reopened while the set was completing.
    hideWindow();
    setStatus(`applying ${label}…`);
    try {
      await applyWallpaper(path);
      setStatus(`done · ${label}`);
    } catch (error) {
      setStatus(`failed: ${error}`);
    } finally {
      localApply = false;
      refreshBusy();
      rescan();
      // No hide here: the click already collapsed the drawer. The set runs in
      // the background, so the user may have reopened the selector while it
      // finished; a late hide would close that window uninvited.
    }
  }

  // Palette-derived chrome refresh (runtime `palette-refresh`, AD-27): the
  // Theme pointer is applied by the app-level handler; this rebuilds the
  // registry-backed search icon without touching the drawer or list.
  function refreshSelectorChrome(): void {
    const old = searchRow.get_first_child();
    if (old !== null) searchRow.remove(old);
    searchRow.prepend(searchUiIcon());
  }

  refreshChrome = refreshSelectorChrome;

  function onWallpaperEvent(payload: Record<string, unknown>): void {
    const state = payload["state"];
    if (state === "applying") {
      eventBusy = true;
      refreshBusy();
      setStatus("wallpaper.state → applying…");
    } else if (state === "visible") {
      // New intermediate (Agent A): pixels swapped, theming still in
      // flight. Busy like `applying`, but honest about what is on screen.
      eventBusy = true;
      refreshBusy();
      setStatus("wallpaper.state → visible · theming…");
      // No hide: the Apply click already collapsed the drawer (BUG-002).
      // External sets must never dismiss the window, and hiding here would
      // close a selector reopened while theming runs.
    } else if (state === "done") {
      eventBusy = false;
      refreshBusy();
      rescan();
      setStatus("wallpaper.state → done");
    } else if (state === "error") {
      eventBusy = false;
      refreshBusy();
      rescan();
      setStatus("wallpaper.state → error");
    }
  }

  try {
    domainEvents.subscribe(WALLPAPER_STATE_TOPIC, (_topic, payload) =>
      onWallpaperEvent(payload),
    );
  } catch (error) {
    console.error(`wallpaper-selector: event bus unavailable: ${error}`);
  }

  // Schedule hidden warmup after startup settles.
  GLib.idle_add(GLib.PRIORITY_LOW, () => {
    if (!warmed) warmup();
    return false;
  });

  // On-demand instance (no autostart slot): the window starts SHOWN so the
  // first SUPER+W press presents it immediately (ICME pattern). Capture and
  // pano start hidden because they autostart at login.
  return (
    <window
      visible
      name={WINDOW_NAME}
      class="wallpaper-selector-window"
      title="Wallpaper Selector"
      gdkmonitor={gdkmonitor}
      // `anchor` is an `Astal.WindowAnchor` bit flag (NONE=1, TOP=2, RIGHT=4,
      // LEFT=8, BOTTOM=16): the bare literal `0` was never a valid value. It
      // anchored to no edge, and so does NONE: astal_window_set_anchor() reads
      // only bits 1/2/3/4 and never tests bit 0, so 0 and NONE both hand
      // gtk_layer_shell four anchored=false edges. Behaviour is identical;
      // only the type is now honest. Same correction as capture-tool's
      // ClassicWindow.
      anchor={Astal.WindowAnchor.NONE}
      halign={Gtk.Align.CENTER}
      valign={Gtk.Align.CENTER}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.ON_DEMAND}
      default_width={960}
      default_height={640}
      $={(self) => {
        // Capture phase: Escape must be seen BEFORE the focused search
        // entry consumes it (same pattern as hypr-pano).
        const keys = new Gtk.EventControllerKey();
        keys.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        keys.connect("key-pressed", (_c, keyval) => {
          if (keyval === Gdk.KEY_Escape) {
            self.hide();
            return true;
          }
          return false;
        });
        self.add_controller(keys);
        // Every toggle-open re-scans: the spine, the effects gallery and
        // current.json may all have moved while the window was hidden.
        self.connect("map", () => {
          mapped = true;
          // Every toggle-open lands on the main grid: clear any drilled-in
          // selection first, or opens would stick on the last L2 view.
          // Every toggle-open re-scans: the spine, the effects gallery and
          // current.json may all have moved while the window was hidden.
          setSelected(null);
          if (!localApply && !eventBusy) {
            rescan();
            setStatus("Wallpapers — pick one to see its variants.");
          }
          // ON_DEMAND (like pano/capture/icme) so the dialog never grabs
          // the keyboard from other apps; present + focus put the cursor in
          // search on show, rofi-style.
          self.present();
          search.grab_focus();
        });
        self.connect("unmap", () => {
          mapped = false;
        });
      }}
    >
      {root}
    </window>
  );
}
