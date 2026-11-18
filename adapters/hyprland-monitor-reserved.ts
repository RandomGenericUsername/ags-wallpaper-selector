// ---------------------------------------------------------------------------
// ADAPTER: the compositor's reserved top zone, for the top control-bar margin.
//
// PRIMARY: AstalHyprland's `Monitor.reserved_top`, read from the in-process
// service. The import is dynamic so a host without AstalHyprland still starts;
// a failure degrades to the fallback.
//
// FALLBACK: `hyprctl -j monitors` via a synchronous spawn, parsed by the pure
// `domain/monitor-reserved.ts`. The spawn is deliberately synchronous:
// placement is applied while the window is being mapped, and returning 0
// because a promise has not settled would put the control bar over the
// desktop bar for a frame.
//
// The value is the EXCLUSIVE zone, not this overlay's own. This overlay never
// sets EXCLUSIVE, so there is no self-offset feedback loop.
// ---------------------------------------------------------------------------

import GLib from "gi://GLib?version=2.0";
import type { MonitorReservedTop } from "../ports/monitor-reserved";
import { reservedTopFromHyprctl } from "../domain/monitor-reserved";

interface HyprlandMonitor {
  name: string;
  reserved_top: number;
}

interface HyprlandReservedSource {
  get_monitors(): HyprlandMonitor[];
  get_focused_monitor(): HyprlandMonitor | null;
}

function readHyprctl(connector: string | null): number | null {
  try {
    const [ok, stdout] = GLib.spawn_command_line_sync("hyprctl -j monitors");
    if (!ok || stdout === null) return null;
    return reservedTopFromHyprctl(
      new TextDecoder().decode(stdout),
      connector,
    );
  } catch (error) {
    console.error(
      `wallpaper-selector: cannot read hyprctl reserved zone: ${error}`,
    );
    return null;
  }
}

export function hyprlandMonitorReservedTop(): MonitorReservedTop {
  let source: HyprlandReservedSource | null = null;

  void import("gi://AstalHyprland?version=0.1")
    .then(({ default: Hyprland }) => {
      source = Hyprland.get_default() as unknown as HyprlandReservedSource;
    })
    .catch(() => {
      // No AstalHyprland on this host: the hyprctl fallback is the whole answer.
      source = null;
    });

  return {
    reservedTop(connector: string | null): number {
      const monitors = source?.get_monitors() ?? [];
      const monitor =
        (connector === null
          ? source?.get_focused_monitor() ?? undefined
          : monitors.find((entry) => entry.name === connector)) ?? null;
      if (monitor !== null) {
        const value = monitor.reserved_top;
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
          return Math.max(0, Math.trunc(value));
        }
      }
      // MEASURED on this host (the capture tool's exact lesson): a stale 0
      // would put the bar over the desktop bar for a frame, so 0 means "not
      // populated yet" and the documented fallback supplies the real zone.
      // A genuinely bare-top host still resolves to 0 because hyprctl says 0.
      return readHyprctl(connector) ?? 0;
    },
  };
}
