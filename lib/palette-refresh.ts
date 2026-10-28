/**
 * The selector's palette-refresh handler wiring. PURE: no `ags`/`gi://*`
 * imports, so the stock-runner test executes the SAME handler app.tsx uses.
 *
 * The shell below is the v0.5.0 handler: the platform helper validates the
 * request, answers with exactly one JSON-encoded string, and the app refresh
 * re-applies the Theme pointer and rebuilds the search icon without touching
 * the drawer. The wrapper adds the standalone invariant the monorepo handler
 * relied on the runtime for: idempotence by appearance hash.
 */

import { createPaletteRefreshHandler } from "ags-platform/ports/palette-refresh";
import type { PaletteRefreshRequestHandler } from "ags-platform/ports/palette-refresh";
import { createAppearanceRefresh } from "./appearance.ts";

export function createWallpaperSelectorPaletteRefresh(
  apply: () => void,
): PaletteRefreshRequestHandler {
  return createPaletteRefreshHandler(createAppearanceRefresh(apply));
}
