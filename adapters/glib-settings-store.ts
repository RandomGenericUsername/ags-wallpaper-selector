// ---------------------------------------------------------------------------
// ADAPTER: GLib-backed persistence for
// `$XDG_CONFIG_HOME/wallpaper-selector/config.json`.
//
// The UI writes here; the runtime never reads this file. `$XDG_CONFIG_HOME/
// ags-wallpaper-selector` is the AGS config link into the installed tag and is
// immutable — the settings file deliberately lives in its own namespace.
//
// Degradation is load-bearing:
//   * missing -> silent defaults (first run, not an error)
//   * corrupt -> loud log, then defaults
//   * save failure -> the caller keeps its in-memory value for the session
// ---------------------------------------------------------------------------

import GLib from "gi://GLib?version=2.0";
import type { SettingsStore } from "../ports/settings-store";
import {
  CONFIG_FILE_NAME,
  CONFIG_NAMESPACE,
  defaultSettings,
  mergeSettings,
  settingsToJson,
  validateSettings,
  type WallpaperSelectorSettings,
} from "../domain/settings";

function configDir(): string {
  const configHome =
    GLib.getenv("XDG_CONFIG_HOME") || `${GLib.get_home_dir()}/.config`;
  return `${configHome}/${CONFIG_NAMESPACE}`;
}

export function settingsConfigPath(): string {
  return `${configDir()}/${CONFIG_FILE_NAME}`;
}

/** Read config; missing/corrupt degrade to defaults (corrupt logs loudly). */
export function loadSettings(): WallpaperSelectorSettings {
  const path = settingsConfigPath();
  try {
    if (!GLib.file_test(path, GLib.FileTest.EXISTS)) return defaultSettings();
    const [ok, bytes] = GLib.file_get_contents(path);
    if (!ok || bytes === null) return defaultSettings();
    return mergeSettings(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (error) {
    console.error(`wallpaper-selector: cannot read settings config: ${error}`);
    return defaultSettings();
  }
}

/** Persist validated settings, creating the config dir. Never throws. */
export function saveSettings(
  settings: WallpaperSelectorSettings,
): string | null {
  const error = validateSettings(settings);
  if (error !== null) return error;
  try {
    GLib.mkdir_with_parents(configDir(), 0o755);
    GLib.file_set_contents(settingsConfigPath(), settingsToJson(settings));
    return null;
  } catch (cause) {
    console.error(`wallpaper-selector: cannot write settings config: ${cause}`);
    return `Could not save settings: ${cause}`;
  }
}

/** The composition root's `SettingsStore`. */
export function glibSettingsStore(): SettingsStore {
  return { load: loadSettings, save: saveSettings };
}
