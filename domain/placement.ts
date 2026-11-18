// ---------------------------------------------------------------------------
// DOMAIN: overlay placement arithmetic (REQ-005 §7.3/§7.4).
//
// Two independent decisions:
//
//   1. the CONTROL BAR's edge. Bottom is a fixed 30 px inset. Top sits below
//      the compositor's top EXCLUSIVE zone with a 14 px float gap plus the
//      user's extra offset. The overlay is never EXCLUSIVE, so it cannot feed
//      back into that zone.
//   2. the PREVIEW GEOMETRY. `desktop_bar.keep_visible` means "leave the
//      reserved strip alone" (window margin top = reservedTop). It is not a
//      cross-app hide command; the orchestrator owns true visibility later.
//
// PURE: the compositor read and GTK margin write are elsewhere.
// ---------------------------------------------------------------------------

import type { ControlBarPosition } from "./settings";

/** The 14 px intentional gap below the desktop bar's reserved strip. */
export const TOP_FLOAT_GAP = 14;
/** The bottom inset from the monitor edge. */
export const BOTTOM_INSET = 30;

export type PlacementEdge = "top" | "bottom";
export type PlacementAlign = "start" | "end";

export interface ControlBarPlacement {
  edge: PlacementEdge;
  /** GTK window/box margin on the chosen edge; the opposite edge is 0. */
  marginTop: number;
  marginBottom: number;
  valign: PlacementAlign;
  /** `offsetPx` only participates at the top. */
  offsetApplied: boolean;
}

export interface PreviewGeometry {
  /** Window `margin_top`; 0 covers the full monitor. */
  marginTop: number;
  /** Whether the reserved strip is deliberately left uncovered. */
  reservedStripVisible: boolean;
}

function nonNegativeInt(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/** The control bar's edge, margin, alignment and whether the offset applied. */
export function controlBarPlacement(
  position: ControlBarPosition,
  reservedTop: number,
  offsetPx: number,
): ControlBarPlacement {
  const reserved = nonNegativeInt(reservedTop);
  if (position === "top") {
    return {
      edge: "top",
      marginTop: reserved + TOP_FLOAT_GAP + nonNegativeInt(offsetPx),
      marginBottom: 0,
      valign: "start",
      offsetApplied: true,
    };
  }
  return {
    edge: "bottom",
    marginTop: 0,
    marginBottom: BOTTOM_INSET,
    valign: "end",
    offsetApplied: false,
  };
}

/**
 * The preview window's top margin. `keep_visible` leaves the desktop bar's
 * reserved strip uncovered; hiding it is geometry only (margin 0), never a
 * command to another app.
 */
export function previewGeometry(
  keepVisible: boolean,
  reservedTop: number,
): PreviewGeometry {
  if (!keepVisible) return { marginTop: 0, reservedStripVisible: false };
  return {
    marginTop: nonNegativeInt(reservedTop),
    reservedStripVisible: true,
  };
}
