import app from "ags/gtk4/app";
import Gtk from "gi://Gtk?version=4.0";
import style from "./style.css";
// The v2 Appearance plane (contracts v0.7.0 / platform v0.9.0) replaces the
// split Theme + Skin pair: one composed palette+skin+mode generation, installed
// as one USER-priority provider, watched through the single
// `$XDG_STATE_HOME/dotfiles/current/appearance` hop.
import {
  createAppearance,
  createAppearanceRefreshHandler,
} from "ags-platform/adapters/appearance";
import { applySelectorAppearance } from "./lib/appearance";
import {
  WallpaperSelectorWindow,
  refreshWallpaperSelectorChrome,
} from "./ui/WallpaperSelectorWindow";

/**
 * Register one top-level window with the application.
 *
 * gnim types a JSX element — what `WallpaperSelectorWindow(monitor)` returns —
 * as `JSX.Element`, which it declares as the base `GObject.Object`, while AGS's
 * `app.add_window` is typed to take a `Gtk.Window`. At runtime the object a JSX
 * root call returns IS the `Gtk.Window` the tree was rooted in (the surface
 * cannot start otherwise), so the cast states a runtime truth the compiler
 * cannot see. Same helper as `bar/app.tsx`, `hypr-pano/app.tsx` and
 * `notifications/app.tsx`.
 */
function addWindow(element: JSX.Element): void {
  app.add_window(element as Gtk.Window);
}

// The app-scoped Appearance (platform v0.9.0): the runtime publishes this app's
// composed `$XDG_CONFIG_HOME/ags-wallpaper-selector/appearance.css` through the
// one `current/appearance` pointer, and the adapter owns the provider and its
// file monitor. `style.css` remains the bundled glass fallback, so a missing
// generation is a no-op.
const appearance = createAppearance({ configDir: "ags-wallpaper-selector" });

app.start({
  css: style,
  instanceName: "wallpaper-selector",
  // The runtime is the only palette-refresh trigger (AD-27). The v2 helper
  // re-applies the whole appearance (palette, skin and mode) before the
  // app-owned work; here that work is only the registry-backed search-icon
  // rebuild. The selector's drawer, query, drilled selection and in-flight
  // apply state are untouched; a same-hash trigger is a safe work no-op and a
  // throw stays retryable.
  requestHandler: createAppearanceRefreshHandler(appearance, () => {
    applySelectorAppearance({
      rebuildSearchIcon: refreshWallpaperSelectorChrome,
    });
    return { status: "applied" };
  }),
  main() {
    // One apply for palette + skin + mode. Missing artifacts are a no-op and
    // an identical generation is coalesced, so this never double-installs.
    appearance.apply();
    // Single centered window on the primary monitor (settings-style tool,
    // not per-monitor chrome — same pattern as the ICME editor window).
    const monitor = app.get_monitors()[0];
    if (monitor) addWindow(WallpaperSelectorWindow(monitor, appearance));
  },
});
