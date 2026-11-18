// PORT: a monitor's reserved top edge.
//
// `domain/placement.ts` owns the arithmetic; this port supplies the
// compositor fact. AstalHyprland is primary, `hyprctl -j monitors` the
// documented synchronous fallback; both are adapter details.
//
// Interface only: no `ags/*`, no `gi://*`, no process spawn.

export interface MonitorReservedTop {
  /**
   * The top EXCLUSIVE zone in logical pixels for `connector`.
   *
   * Returns 0 when neither source can answer (the safe default: the overlay
   * still opens; it simply cannot auto-slot). Never throws.
   */
  reservedTop(connector: string | null): number;
}
