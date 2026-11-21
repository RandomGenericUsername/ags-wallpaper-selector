// ---------------------------------------------------------------------------
// The wallpaper selector overlay (REQ-005).
//
// One layer-shell OVERLAY, anchored to all four edges, IGNORE exclusivity:
// the candidate wallpaper fills the monitor, and the only chrome is two side
// arrows plus one control bar. `desktop_bar.keep_visible` is implemented as
// preview geometry (window margin top = reserved top), never as a cross-app
// hide command.
//
// Browse never writes. The only write is `lib/apply.ts`
// (`dotfiles-runtime wallpaper set <image>`); `Set`/Enter is the only entry
// point, and the overlay stays open through the three `wallpaper.state`
// steps, holds ~1.2 s after `done`, then hides. Esc cancels without a write.
//
// This file owns layout/components/content; the skin owns paint. The window
// keeps the frozen name `wallpaper-selector-window` so the provisioned
// launcher and `ags toggle` are unchanged.
// ---------------------------------------------------------------------------

import { Astal, Gdk, Gtk } from "ags/gtk4";
import app from "ags/gtk4/app";
import GdkPixbuf from "gi://GdkPixbuf?version=2.0";
import GLib from "gi://GLib?version=2.0";
import { domainEvents } from "ags-platform/adapters/event-bus";
import { registryProvider } from "ags-platform/adapters/icon";
import type { Appearance } from "ags-platform/ports/appearance";
import { applyWallpaper } from "../lib/apply";
import {
  formatMeta,
  variantsFor,
  type SelectorModel,
  type WallpaperEntry,
} from "../lib/model";
import {
  loadModelSmart,
  readImageInfo,
  type ImageInfo,
} from "../lib/scan";
import {
  beginCommit,
  cancelOverlay,
  closeGrid,
  commitEvent,
  commitStepLabel,
  failCommit,
  finishCommit,
  focusLook,
  focusWallpaper,
  initialState,
  isLiveFocus,
  openGrid,
  refreshLive,
  reopen,
  setGridQuery,
  stateLabel,
  stepLook,
  type OverlayState,
} from "../lib/state";
import { quantizePalette } from "../lib/palette-hint";
import { StageView, neighbourIndex } from "../lib/stage";
import { glibSettingsStore } from "../adapters/glib-settings-store";
import { hyprlandMonitorReservedTop } from "../adapters/hyprland-monitor-reserved";
import {
  controlBarPlacement,
  previewGeometry,
} from "../domain/placement";
import {
  mergeSettings,
  type WallpaperSelectorSettings,
} from "../domain/settings";
import { ControlBar } from "./ControlBar";
import { ContactSheet } from "./ContactSheet";
import { SettingsPopover } from "./SettingsPopover";

const WINDOW_NAME = "wallpaper-selector-window";
const WALLPAPER_STATE_TOPIC = "wallpaper.state";
const COMMIT_TIMEOUT_MS = 120_000;
const COMMIT_HOLD_MS = 1_200;
const TOAST_MS = 2_400;
const HINT_DIM = 48;

function hideWindow(): void {
  const window = app.get_window(WINDOW_NAME);
  if (window) window.visible = false;
}

/**
 * Registry-backed chrome refresher, registered by the one selector window and
 * called from the app-level `appearance-refresh` handler. It replaces the
 * search glyph only; it never rescans, changes visibility, resets the query
 * or rebuilds the grid.
 */
let refreshChrome: (() => void) | null = null;

export function refreshWallpaperSelectorChrome(): void {
  refreshChrome?.();
}

/** The magnifier from the platform IconProvider (palette-tinted or themed). */
function searchUiIcon(): Gtk.Widget {
  const source = registryProvider.resolve("ui", "search");
  if (source !== null && source.kind === "file") {
    try {
      const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(source.path, 15, 15);
      const picture = Gtk.Picture.new_for_paintable(
        Gdk.Texture.new_for_pixbuf(pixbuf),
      );
      picture.set_content_fit(Gtk.ContentFit.CONTAIN);
      picture.set_size_request(15, 15);
      picture.set_halign(Gtk.Align.CENTER);
      picture.set_valign(Gtk.Align.CENTER);
      picture.add_css_class("ws-search-icon");
      return picture;
    } catch (error) {
      console.error(
        `wallpaper-selector: cannot load search icon ${source.path}: ${error}`,
      );
    }
  } else if (source !== null && source.kind === "name") {
    const named = Gtk.Image.new_from_icon_name(source.name);
    named.set_pixel_size(15);
    named.set_halign(Gtk.Align.CENTER);
    named.set_valign(Gtk.Align.CENTER);
    return named;
  }
  const fallback = Gtk.Image.new_from_icon_name("system-search-symbolic");
  fallback.set_pixel_size(15);
  fallback.set_halign(Gtk.Align.CENTER);
  fallback.set_valign(Gtk.Align.CENTER);
  return fallback;
}

function lookNameOf(model: SelectorModel | null, entry: WallpaperEntry, look: number): string {
  if (look <= 0) return "Original";
  const variants = model === null ? [] : variantsFor(model, entry.hash);
  return variants[look - 1]?.name ?? "Original";
}

function lookPathOf(model: SelectorModel | null, entry: WallpaperEntry, look: number): string {
  if (look <= 0) return entry.path;
  const variants = model === null ? [] : variantsFor(model, entry.hash);
  return variants[look - 1]?.path ?? entry.path;
}

/** The live point: direct wallpaper (look 0) or a promoted variant (look N). */
function livePoint(model: SelectorModel | null): { index: number; look: number } | null {
  if (model === null) return null;
  const direct = model.wallpapers.findIndex((wallpaper) => wallpaper.live);
  if (direct >= 0) return { index: direct, look: 0 };
  if (model.liveVariantPath === "") return null;
  for (let index = 0; index < model.wallpapers.length; index += 1) {
    const found = variantsFor(model, model.wallpapers[index].hash).findIndex(
      (variant) => variant.path === model.liveVariantPath,
    );
    if (found >= 0) return { index, look: found + 1 };
  }
  return null;
}

function hintFromPixbuf(path: string): string[] {
  try {
    const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(path, HINT_DIM, HINT_DIM);
    const width = pixbuf.get_width();
    const height = pixbuf.get_height();
    const channels = pixbuf.get_n_channels();
    const stride = pixbuf.get_rowstride();
    const raw = pixbuf.get_pixels() as Uint8Array;
    const rgba = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const source = y * stride + x * channels;
        const target = (y * width + x) * 4;
        rgba[target] = raw[source];
        rgba[target + 1] = raw[source + 1];
        rgba[target + 2] = raw[source + 2];
        rgba[target + 3] = channels === 4 ? raw[source + 3] : 255;
      }
    }
    return quantizePalette(rgba, { count: 5, alphaMin: 128, minDistance: 34 });
  } catch (error) {
    console.error(`wallpaper-selector: cannot sample palette hint: ${error}`);
    return [];
  }
}

function toastLabel(): Gtk.Revealer {
  const revealer = new Gtk.Revealer({
    transition_type: Gtk.RevealerTransitionType.CROSSFADE,
    transition_duration: 180,
    reveal_child: false,
  });
  revealer.add_css_class("ws-toast-revealer");
  const label = new Gtk.Label({ label: "" });
  label.add_css_class("ws-toast");
  label.set_halign(Gtk.Align.CENTER);
  revealer.set_child(label);
  return revealer;
}

export function WallpaperSelectorWindow(
  gdkmonitor: Gdk.Monitor,
  _appearance: Appearance,
) {
  const geometry = gdkmonitor.get_geometry();
  const monitorWidth = geometry.width;
  const monitorHeight = geometry.height;
  const connector = (() => {
    try {
      return gdkmonitor.get_connector();
    } catch {
      return null;
    }
  })();

  const settingsStore = glibSettingsStore();
  const monitorReserved = hyprlandMonitorReservedTop();
  let settings: WallpaperSelectorSettings = settingsStore.load();
  let reservedTop = monitorReserved.reservedTop(connector);

  let model: SelectorModel | null = null;
  let state: OverlayState = initialState(null);
  let window: Astal.Window | null = null;

  const infoCache = new Map<string, ImageInfo | null>();
  const hintCache = new Map<string, string[]>();
  const infoPending = new Set<string>();
  const hintPending = new Set<string>();
  let activePath = "";
  let commitTimeout: number | null = null;
  let holdTimer: number | null = null;
  let toastTimer: number | null = null;

  const stage = new StageView(monitorWidth, monitorHeight);
  const barWidth = Math.max(280, Math.min(1160, monitorWidth - 56));

  function onChange(next: WallpaperSelectorSettings): string | null {
    const merged = mergeSettings(next);
    const error = settingsStore.save(merged);
    settings = merged;
    reservedTop = monitorReserved.reservedTop(connector);
    applyPlacement();
    return error;
  }

  const settingsPopover = new SettingsPopover({
    initial: settings,
    onChange,
  });

  const controlBar = new ControlBar({
    width: barWidth,
    gearPopover: settingsPopover.popover,
    onSet: () => commit(),
    onLookSelect: (index) => {
      if (state.phase === "committing") return;
      const entry = focusEntry();
      if (entry === null) return;
      state = focusLook(state, index);
      render();
    },
  });

  const contactSheet = new ContactSheet({
    width: monitorWidth,
    searchIcon: searchUiIcon(),
    onPick: (wallpaper) => {
      const index = model?.wallpapers.findIndex((entry) => entry.hash === wallpaper.hash) ?? -1;
      if (index < 0) return;
      state = focusWallpaper(closeGrid(state), index);
      render();
      stage.show(lookPathOf(model, wallpaper, 0), true);
      preloadNeighbours(index);
    },
    onClose: () => {
      state = closeGrid(state);
      render();
    },
    onQuery: (query) => {
      state = setGridQuery(state, query);
    },
  });

  function focusEntry(): WallpaperEntry | null {
    if (model === null) return null;
    return model.wallpapers[state.focus.index] ?? null;
  }

  function preloadNeighbours(index: number): void {
    if (model === null || model.wallpapers.length < 2) return;
    const previous = neighbourIndex(index, model.wallpapers.length, -1);
    const next = neighbourIndex(index, model.wallpapers.length, 1);
    stage.preload(
      [previous, next]
        .filter((candidate) => candidate !== index)
        .map((candidate) => model?.wallpapers[candidate]?.path)
        .filter((path): path is string => typeof path === "string"),
    );
  }

  function applyPlacement(): void {
    const placement = controlBarPlacement(
      settings.control_bar.position,
      reservedTop,
      settings.control_bar.offsetPx,
    );
    const preview = previewGeometry(settings.desktop_bar.keep_visible, reservedTop);
    if (window !== null) window.margin_top = preview.marginTop;
    controlBar.widget.set_valign(
      placement.valign === "start" ? Gtk.Align.START : Gtk.Align.END,
    );
    // §7.3's top inset is monitor-absolute. The preview window is itself
    // offset by `preview.marginTop` (§7.4), so subtract that offset once to
    // avoid counting the reserved strip twice. keep_visible => 14 + offset
    // below the strip; covered => reserved + 14 + offset from the monitor top.
    controlBar.widget.set_margin_top(
      Math.max(0, placement.marginTop - preview.marginTop),
    );
    // <880 px is not the target, but the bar still stays clear of the edge.
    controlBar.widget.set_margin_bottom(
      monitorWidth < 880 ? 18 : placement.marginBottom,
    );
  }

  function toast(message: string): void {
    toastRevealer.set_reveal_child(true);
    const label = toastRevealer.get_child() as Gtk.Label | null;
    label?.set_label(message);
    if (toastTimer !== null) GLib.source_remove(toastTimer);
    toastTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TOAST_MS, () => {
      toastRevealer.set_reveal_child(false);
      toastTimer = null;
      return false;
    });
  }

  function ensureInfo(entry: WallpaperEntry, path: string): string {
    const cached = infoCache.get(path);
    if (cached !== undefined) {
      return cached === null
        ? formatMeta(entry.width, entry.height, entry.bytes)
        : formatMeta(cached.width, cached.height, cached.bytes);
    }
    if (entry.width !== null && entry.height !== null) {
      return formatMeta(entry.width, entry.height, entry.bytes);
    }
    // Header probe off the critical path; the meta line updates if the focus
    // has not moved on.
    if (!infoPending.has(path)) {
      infoPending.add(path);
      GLib.idle_add(GLib.PRIORITY_LOW, () => {
        infoPending.delete(path);
        if (activePath !== path) return false;
        const info = readImageInfo(path);
        infoCache.set(path, info);
        if (activePath === path) renderMeta();
        return false;
      });
    }
    return formatMeta(entry.width, entry.height, entry.bytes);
  }

  /** The most common palette swatch that is usable as a border: frequency
   * order, skipping near-black/near-white dominants so the ring matches the
   * visible artwork rather than its background. */
  function accentColor(swatches: string[]): string | null {
    let first: string | null = null;
    for (const color of swatches) {
      const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
      if (match === null) continue;
      if (first === null) first = color;
      const r = Number.parseInt(match[1], 16);
      const g = Number.parseInt(match[2], 16);
      const b = Number.parseInt(match[3], 16);
      const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
      if (lightness >= 0.22 && lightness <= 0.82) return color;
    }
    return first;
  }

  function ensureHint(path: string): string[] {
    const cached = hintCache.get(path);
    if (cached !== undefined) return cached;
    if (!hintPending.has(path)) {
      hintPending.add(path);
      GLib.idle_add(GLib.PRIORITY_LOW, () => {
        hintPending.delete(path);
        if (activePath !== path) return false;
        const hint = hintFromPixbuf(path);
        hintCache.set(path, hint);
        if (activePath === path) renderMeta();
        return false;
      });
    }
    return [];
  }

  function renderMeta(): void {
    const entry = focusEntry();
    if (entry === null) return;
    const path = lookPathOf(model, entry, state.focus.look);
    controlBar.update(controlBarModel(entry, path));
  }

  function inkFor(accent: string | null): string {
    if (accent === null) return "#111111";
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(accent);
    if (match === null) return "#111111";
    const luminance =
      (Number.parseInt(match[1], 16) * 299 +
        Number.parseInt(match[2], 16) * 587 +
        Number.parseInt(match[3], 16) * 114) /
      1000;
    return luminance > 145 ? "#111111" : "#ffffff";
  }

  function controlBarModel(entry: WallpaperEntry, path: string) {
    const variants = model === null ? [] : variantsFor(model, entry.hash);
    const swatches = ensureHint(path);
    const accent = accentColor(swatches);
    const live = livePoint(model);
    const lookIndex = Math.min(state.focus.look, variants.length);
    const lookName = lookIndex === 0 ? "Original" : variants[lookIndex - 1]?.name ?? "Original";
    const liveLookIndex =
      live !== null && live.index === state.focus.index ? live.look : null;
    const committing = state.phase === "committing";
    const error = state.commit?.error ?? null;
    const meta = committing
      ? commitStepLabel(state.commit?.step ?? 0)
      : error ?? ensureInfo(entry, path);
    return {
      name: entry.name,
      stateText: stateLabel(state, lookName),
      live: isLiveFocus(state),
      committing,
      meta,
      step: committing,
      error: error !== null && !committing,
      swatches,
      lookName: variants.length === 0 ? "none yet" : lookName,
      looks: {
        wallpaperPath: entry.path,
        variants,
        lookIndex,
        liveLookIndex,
        disabled: committing,
        accent,
      },
      accent,
      onAccent: inkFor(accent),
      progress: state.commit?.progress ?? 0,
      setEnabled:
        !committing && !isLiveFocus(state) && model !== null && model.wallpapers.length > 0,
      setText: committing
        ? "Setting wallpaper…"
        : isLiveFocus(state)
          ? "Current wallpaper"
          : "Set wallpaper",
    };
  }

  function render(animateStage = true): void {
    const entry = focusEntry();
    if (entry === null) {
      controlBar.update({
        name: "No wallpapers",
        stateText: "Preview",
        live: false,
        committing: false,
        meta: "No wallpapers in the install spine.",
        step: false,
        error: false,
        swatches: [],
        lookName: "none yet",
        looks: {
          wallpaperPath: "",
          variants: [],
          lookIndex: 0,
          liveLookIndex: null,
          disabled: true,
          accent: null,
        },
        accent: null,
        onAccent: "#111111",
        progress: 0,
        setEnabled: false,
        setText: "Set wallpaper",
      });
      return;
    }
    const path = lookPathOf(model, entry, state.focus.look);
    activePath = path;
    stage.show(path, animateStage);
    controlBar.update(controlBarModel(entry, path));
    previous.set_sensitive(state.phase !== "committing");
    next.set_sensitive(state.phase !== "committing");
    root.set_visible_child_name(state.page === "grid" ? "grid" : "main");
    if (state.page === "grid") {
      contactSheet.update(model, entry.hash);
    }
  }

  function navigate(delta: number): void {
    if (state.phase === "committing" || state.phase === "closed") return;
    if (model === null || model.wallpapers.length === 0) return;
    const count = model.wallpapers.length;
    const index = neighbourIndex(state.focus.index, count, delta);
    state = focusWallpaper(state, index);
    render();
    preloadNeighbours(index);
  }

  function selectLookFromKey(delta: number): void {
    if (state.phase === "committing") return;
    const entry = focusEntry();
    if (entry === null) return;
    const count = (model === null ? 0 : variantsFor(model, entry.hash).length) + 1;
    if (count < 2) {
      toast(`No looks yet for ${entry.name} — set it once and they are generated.`);
      return;
    }
    state = stepLook(state, delta, count);
    render();
  }

  function showGrid(focusSearch: boolean): void {
    if (state.phase === "committing") return;
    controlBar.gear.set_active(false);
    state = openGrid(state, true);
    contactSheet.setQuery("");
    render(false);
    if (focusSearch) {
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        contactSheet.focusSearch();
        return false;
      });
    }
  }

  function hideGrid(): void {
    state = closeGrid(state);
    render(false);
  }

  function escapePressed(): boolean {
    if (state.phase === "committing") {
      // Owner decision 2026-11-20: Esc collapses the overlay while the apply
      // continues; it never cancels the commit.
      hideWindow();
      return true;
    }
    if (controlBar.gear.get_active()) {
      controlBar.gear.set_active(false);
      return true;
    }
    if (state.page === "grid") {
      if (!contactSheet.queryEmpty()) {
        contactSheet.clearQuery();
        state = setGridQuery(state, "");
        contactSheet.focusSearch();
      } else {
        hideGrid();
      }
      return true;
    }
    cancel();
    return true;
  }

  function cancel(): void {
    if (state.phase === "committing") return;
    state = cancelOverlay(state);
    render(false);
    hideWindow();
  }

  function commit(): void {
    if (state.phase === "committing" || state.phase === "closed") return;
    const entry = focusEntry();
    if (entry === null || isLiveFocus(state)) return;
    const target = lookPathOf(model, entry, state.focus.look);
    state = beginCommit(state);
    render(false);
    controlBar.gear.set_active(false);
    if (commitTimeout !== null) GLib.source_remove(commitTimeout);
    commitTimeout = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      COMMIT_TIMEOUT_MS,
      () => {
        commitTimeout = null;
        if (state.phase === "committing") {
          fail("Timed out while setting the wallpaper.");
        }
        return false;
      },
    );

    applyWallpaper(target)
      .then(() => {
        // The command blocks through the derive/swap/reload chain; the event
        // stream still drives the visible steps. If it resolves while the
        // overlay is committing, reconcile as success (a missed final event
        // must not leave the overlay stuck).
        if (state.phase === "committing") done(entry);
      })
      .catch((error) => {
        if (state.phase === "committing") {
          fail(`Failed to set the wallpaper: ${error}`);
        }
      });
  }

  function done(entry: WallpaperEntry): void {
    if (state.phase !== "committing") return;
    if (commitTimeout !== null) {
      GLib.source_remove(commitTimeout);
      commitTimeout = null;
    }
    state = commitEvent(state, { state: "done" });
    state = finishCommit(state);
    render(false);
    toast(`${entry.name} is live`);
    // Do NOT rebuild the model here: the rebuilt gallery can clamp/reorder the
    // focused look while the overlay is still on screen, so the user saw a
    // different wallpaper than the one just set. The next map rescans to live.
    if (holdTimer !== null) GLib.source_remove(holdTimer);
    holdTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, COMMIT_HOLD_MS, () => {
      holdTimer = null;
      if (state.phase !== "committing") hideWindow();
      return false;
    });
  }

  function fail(message: string): void {
    if (commitTimeout !== null) {
      GLib.source_remove(commitTimeout);
      commitTimeout = null;
    }
    if (state.phase !== "committing") return;
    state = failCommit(state, message);
    render(false);
    toast(message);
  }

  function rescan(resetToLive: boolean): void {
    try {
      model = loadModelSmart();
    } catch (error) {
      console.error(`wallpaper-selector: rescan failed: ${error}`);
      return;
    }
    const live = livePoint(model);
    if (resetToLive) {
      state = reopen(
        state,
        live?.index ?? null,
        live?.look ?? 0,
        0,
      );
    } else {
      // Keep the last known live point if the model has not caught up yet
      // (the command may resolve a beat before `current.json` is rewritten);
      // never clobber a just-finished commit with a stale null.
      const liveIndex = live?.index ?? state.live?.index ?? null;
      const liveLook = live?.look ?? state.live?.look ?? 0;
      state = refreshLive(state, liveIndex, liveLook);
      if (model.wallpapers.length === 0) {
        state = { ...state, focus: { index: 0, look: 0 } };
      } else if (state.focus.index >= model.wallpapers.length) {
        state = {
          ...state,
          focus: { index: model.wallpapers.length - 1, look: 0 },
        };
      } else {
        const entry = model.wallpapers[state.focus.index];
        const count = variantsFor(model, entry.hash).length + 1;
        if (state.focus.look >= count) {
          state = { ...state, focus: { ...state.focus, look: 0 } };
        }
      }
    }
    render(false);
    if (model !== null && model.wallpapers.length > 0) {
      preloadNeighbours(state.focus.index);
    }
  }

  function onWallpaperEvent(payload: Record<string, unknown>): void {
    const value = payload["state"];
    if (state.phase === "committing") {
      if (value === "applying") {
        state = commitEvent(state, { state: "applying" });
        render(false);
      } else if (value === "visible") {
        state = commitEvent(state, { state: "visible" });
        render(false);
      } else if (value === "done") {
        const entry = focusEntry();
        if (entry !== null) done(entry);
      } else if (value === "error") {
        fail("The wallpaper set failed. The live wallpaper is unchanged.");
      }
      return;
    }
    // An external set must never dismiss or re-focus this overlay. It only
    // refreshes the live marker and the model.
    if (value === "done" || value === "error") rescan(false);
  }

  // ── the widget tree ─────────────────────────────────────────────────────
  const mainPage = new Gtk.Overlay();
  mainPage.add_css_class("ws-main");
  mainPage.set_child(stage.widget);

  const vignette = new Gtk.Box();
  vignette.add_css_class("ws-vignette");
  vignette.set_can_target(false);
  mainPage.add_overlay(vignette);

  const toastRevealer = toastLabel();
  toastRevealer.set_halign(Gtk.Align.CENTER);
  toastRevealer.set_valign(Gtk.Align.END);
  toastRevealer.set_margin_bottom(140);
  toastRevealer.set_can_target(false);
  mainPage.add_overlay(toastRevealer);

  function arrow(direction: -1 | 1): Gtk.Button {
    const button = new Gtk.Button();
    button.add_css_class("ws-nav");
    if (direction < 0) {
      button.add_css_class("prev");
      button.set_halign(Gtk.Align.START);
      button.set_margin_start(26);
      button.set_tooltip_text("Previous wallpaper");
      button.update_property(
        [Gtk.AccessibleProperty.LABEL],
        ["Previous wallpaper"],
      );
    } else {
      button.add_css_class("next");
      button.set_halign(Gtk.Align.END);
      button.set_margin_end(26);
      button.set_tooltip_text("Next wallpaper");
      button.update_property([Gtk.AccessibleProperty.LABEL], ["Next wallpaper"]);
    }
    button.set_valign(Gtk.Align.CENTER);
    button.set_size_request(62, 62);
    button.set_child(
      new Gtk.Image({
        icon_name: direction < 0 ? "go-previous-symbolic" : "go-next-symbolic",
        pixel_size: 24,
      }),
    );
    button.connect("clicked", () => navigate(direction));
    return button;
  }

  controlBar.setResponsive(monitorWidth);
  contactSheet.setSearchWidth(monitorWidth < 880 ? 190 : 300);

  const previous = arrow(-1);
  const next = arrow(1);
  if (monitorWidth < 880) {
    for (const button of [previous, next]) {
      button.set_size_request(52, 52);
      button.set_margin_start(14);
      button.set_margin_end(14);
    }
  }
  mainPage.add_overlay(previous);
  mainPage.add_overlay(next);
  mainPage.add_overlay(controlBar.widget);

  const root = new Gtk.Stack({
    transition_type: Gtk.StackTransitionType.CROSSFADE,
    transition_duration: 220,
    hexpand: true,
    vexpand: true,
  });
  root.add_css_class("ws-root-stack");
  root.add_named(mainPage, "main");
  root.add_named(contactSheet.widget, "grid");
  root.set_visible_child_name("main");

  refreshChrome = () => {
    contactSheet.replaceSearchIcon(searchUiIcon());
  };

  try {
    domainEvents.subscribe(WALLPAPER_STATE_TOPIC, (_topic, payload) =>
      onWallpaperEvent(payload),
    );
  } catch (error) {
    console.error(`wallpaper-selector: event bus unavailable: ${error}`);
  }

  return (
    <window
      visible
      name={WINDOW_NAME}
      class="wallpaper-selector-window"
      title="Wallpaper Selector"
      gdkmonitor={gdkmonitor}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.RIGHT |
        Astal.WindowAnchor.BOTTOM |
        Astal.WindowAnchor.LEFT
      }
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
      margin_top={0}
      $={(self) => {
        window = self;
        applyPlacement();
        // Do not open with the first focusable control (the gear) wearing a
        // keyboard focus ring; the ring belongs to real Tab/keyboard focus.
        // GTK assigns the initial focus on map/activate, so clear it on idle.
        const clearInitialFocus = () =>
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
            self.set_focus(null);
            return false;
          });
        self.connect("map", clearInitialFocus);
        self.connect("notify::is-active", () => {
          if (self.is_active) clearInitialFocus();
        });

        // Capture phase: arrows/Enter/Esc are seen before a focused button or
        // the grid search entry. Typing in the entry is left alone (only Enter
        // and Esc are handled there).
        const keys = new Gtk.EventControllerKey();
        keys.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        keys.connect("key-pressed", (_controller, keyval) => {
          if (keyval === Gdk.KEY_Escape) return escapePressed();
          // The settings popover owns its own focus/Esc; do not navigate the
          // overlay behind an open popover.
          if (controlBar.gear.get_active()) return false;
          const typing = contactSheet.isSearchFocused();
          if (state.page === "grid") {
            if (typing) {
              if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) {
                contactSheet.pickFirst();
                return true;
              }
              return false;
            }
            if (keyval === Gdk.KEY_g || keyval === Gdk.KEY_G) {
              hideGrid();
              return true;
            }
            return false;
          }
          if (state.phase === "committing") {
            return (
              keyval === Gdk.KEY_Left ||
              keyval === Gdk.KEY_Right ||
              keyval === Gdk.KEY_Up ||
              keyval === Gdk.KEY_Down ||
              keyval === Gdk.KEY_Return ||
              keyval === Gdk.KEY_KP_Enter
            );
          }
          if (keyval === Gdk.KEY_Left) {
            navigate(-1);
            return true;
          }
          if (keyval === Gdk.KEY_Right) {
            navigate(1);
            return true;
          }
          if (keyval === Gdk.KEY_Up) {
            selectLookFromKey(-1);
            return true;
          }
          if (keyval === Gdk.KEY_Down) {
            selectLookFromKey(1);
            return true;
          }
          if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) {
            commit();
            return true;
          }
          if (keyval === Gdk.KEY_g || keyval === Gdk.KEY_G) {
            showGrid(false);
            return true;
          }
          if (keyval === Gdk.KEY_slash) {
            showGrid(true);
            return true;
          }
          return false;
        });
        self.add_controller(keys);

        const onMap = (): void => {
          if (state.phase === "committing") {
            self.present();
            render(false);
            return;
          }
          settings = settingsStore.load();
          settingsPopover.update(settings);
          reservedTop = monitorReserved.reservedTop(connector);
          applyPlacement();
          rescan(true);
          // ON_DEMAND so the overlay never grabs the keyboard from other
          // apps; present() asks the compositor to focus the surface.
          self.present();
        };
        self.connect("map", onMap);
        // The window can be mapped during construction, before this handler is
        // attached; without the immediate call the first show never rescans
        // and the overlay renders an empty model ("no wallpapers").
        if (self.get_mapped()) {
          GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            onMap();
            return false;
          });
        }
        self.connect("unmap", () => {
        });
      }}
    >
      {root}
    </window>
  );
}
