// ---------------------------------------------------------------------------
// DOMAIN: the wallpaper selector's placement settings.
//
// Path: `$XDG_CONFIG_HOME/wallpaper-selector/config.json` (the app id, not the
// deployed `ags-wallpaper-selector` config-link basename). The capture tool is
// the reference grammar: pure vocabulary + defaults + strict per-key merge;
// the GLib read/write lives in `adapters/glib-settings-store.ts`.
//
// Every tolerance rule is here, so it is executable without GTK:
//   * a missing file is first-run (silent defaults) — the adapter's concern;
//   * a corrupt document degrades to defaults with one loud log — the
//     adapter's concern;
//   * an invalid enum/number/bool degrades PER KEY, so the other keys survive;
//   * unknown keys are ignored;
//   * `offsetPx` is finite, integer, clamped to 0..2000 and is top-only.
//
// PURE: no `ags/*`, no `gi://*`, no I/O.
// ---------------------------------------------------------------------------

export type ControlBarPosition = "bottom" | "top";

export interface WallpaperSelectorSettings {
  control_bar: {
    position: ControlBarPosition;
    offsetPx: number;
  };
  desktop_bar: {
    keep_visible: boolean;
  };
}

export const CONFIG_NAMESPACE = "wallpaper-selector";
export const CONFIG_FILE_NAME = "config.json";
export const CONTROL_BAR_POSITIONS: readonly ControlBarPosition[] = [
  "bottom",
  "top",
];
export const OFFSET_MIN = 0;
export const OFFSET_MAX = 2000;

export const DEFAULT_SETTINGS: WallpaperSelectorSettings = {
  control_bar: { position: "bottom", offsetPx: 0 },
  desktop_bar: { keep_visible: true },
};

/** A fresh deep copy of the defaults (GJS has no structuredClone). */
export function defaultSettings(): WallpaperSelectorSettings {
  return {
    control_bar: { ...DEFAULT_SETTINGS.control_bar },
    desktop_bar: { ...DEFAULT_SETTINGS.desktop_bar },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function oneOf<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Finite integer in [OFFSET_MIN, OFFSET_MAX]; anything else is the default. */
export function clampOffsetPx(
  value: unknown,
  fallback = DEFAULT_SETTINGS.control_bar.offsetPx,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, Math.trunc(value)));
}

/** Merge any parsed JSON value into the canonical settings shape. */
export function mergeSettings(raw: unknown): WallpaperSelectorSettings {
  const record = isRecord(raw) ? raw : {};
  const control = isRecord(record.control_bar) ? record.control_bar : {};
  const desktop = isRecord(record.desktop_bar) ? record.desktop_bar : {};
  return {
    control_bar: {
      position: oneOf(
        control.position,
        CONTROL_BAR_POSITIONS,
        DEFAULT_SETTINGS.control_bar.position,
      ),
      offsetPx: clampOffsetPx(
        control.offsetPx,
        DEFAULT_SETTINGS.control_bar.offsetPx,
      ),
    },
    desktop_bar: {
      keep_visible: bool(
        desktop.keep_visible,
        DEFAULT_SETTINGS.desktop_bar.keep_visible,
      ),
    },
  };
}

/**
 * Validate a settings object before persisting. Returns an error string or
 * null. `mergeSettings` already guarantees the shape; this is the guard for a
 * direct caller (and for a future settings page).
 */
export function validateSettings(
  settings: WallpaperSelectorSettings,
): string | null {
  if (!CONTROL_BAR_POSITIONS.includes(settings.control_bar.position)) {
    return `Control bar position must be one of ${CONTROL_BAR_POSITIONS.join(", ")}.`;
  }
  const offset = settings.control_bar.offsetPx;
  if (!Number.isFinite(offset) || Math.trunc(offset) !== offset) {
    return "Top offset must be a whole number.";
  }
  if (offset < OFFSET_MIN || offset > OFFSET_MAX) {
    return `Top offset must be between ${OFFSET_MIN} and ${OFFSET_MAX}.`;
  }
  if (typeof settings.desktop_bar.keep_visible !== "boolean") {
    return "Desktop bar visibility must be a boolean.";
  }
  return null;
}

/** The exact on-disk bytes: pretty JSON plus one trailing newline. */
export function settingsToJson(settings: WallpaperSelectorSettings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}
