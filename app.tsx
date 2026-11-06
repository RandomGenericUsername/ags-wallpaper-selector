import app from "ags/gtk4/app";
import Gtk from "gi://Gtk?version=4.0";
import style from "./style.css";
// Theming through the platform Theme port (spine AD-13): the adapter owns WHICH
// artifact is applied — the stable `colors.css` pointer, repointed on every
// palette change — so this app no longer carries its own theme.ts copy.
import { theme } from "ags-platform/adapters/theme";
import { createAppSkin } from "ags-platform/adapters/skin";
import { applySelectorAppearance } from "./lib/appearance";
import { createWallpaperSelectorPaletteRefresh } from "./lib/palette-refresh";
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

// The app-scoped Skin (platform v0.8.0): the runtime expands this app's
// `$XDG_CONFIG_HOME/ags-wallpaper-selector/skin.css`; the adapter owns the
// provider and its file monitor. `style.css` remains the bundled glass
// fallback, so a missing skin artifact is a no-op.
const skin = createAppSkin({ configDir: "ags-wallpaper-selector" });

app.start({
  css: style,
  instanceName: "wallpaper-selector",
  // The runtime is the only palette-refresh trigger (AD-27). This is the real
  // v0.5.0 handler: re-apply the Theme pointer and re-render the
  // registry-backed search icon. The selector's drawer, query, drilled
  // selection and in-flight apply state are untouched; a same-hash trigger is
  // a safe no-op and a throw stays retryable.
  requestHandler: createWallpaperSelectorPaletteRefresh(() => {
    applySelectorAppearance({
      reapplyTheme: () => theme.apply(),
      rebuildSearchIcon: refreshWallpaperSelectorChrome,
    });
  }),
  main() {
    theme.apply();
    // Palette first, then the app-scoped skin: the Skin provider is composed
    // from the live palette and must be the last-installed USER provider.
    skin.apply();
    // Single centered window on the primary monitor (settings-style tool,
    // not per-monitor chrome — same pattern as the ICME editor window).
    const monitor = app.get_monitors()[0];
    if (monitor) addWindow(WallpaperSelectorWindow(monitor));
  },
});
