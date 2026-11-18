// PORT: persistence for `$XDG_CONFIG_HOME/wallpaper-selector/config.json`.
//
// The seam only. Vocabulary, merge and validation live in
// `domain/settings.ts`; the GLib path/read/write lives in
// `adapters/glib-settings-store.ts`.
//
// Interface only: no `ags/*`, no `gi://*`, no I/O.

import type { WallpaperSelectorSettings } from "../domain/settings";

export interface SettingsStore {
  /**
   * Read settings; a missing file is silent defaults, a corrupt file logs
   * loudly and still returns defaults. Never throws.
   */
  load(): WallpaperSelectorSettings;

  /**
   * Persist settings (validated), creating the config directory. Returns an
   * error string, or null on success. Never throws.
   */
  save(settings: WallpaperSelectorSettings): string | null;
}
