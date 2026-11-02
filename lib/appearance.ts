/**
 * The pure core of the wallpaper selector's live appearance refresh (AD-27).
 *
 * The runtime invokes `palette-refresh <appearance-hash>` after the palette
 * pointer moved. The v0.5.0 selector performs exactly two non-destructive
 * steps: re-apply the stable Theme pointer, then rebuild the registry-backed
 * search icon. The drawer itself — the visible grid or variant gallery, the
 * search query, the drilled selection and any in-flight apply — is deliberately
 * NOT touched. That is what "preserve the drawer" means here, and it is why
 * this module has no drawer operations at all.
 *
 * Two separate concerns live here so a stock-runner test can execute them with
 * no `gi://`/`ags` imports:
 *
 * 1. `applySelectorAppearance(surface)` orders the two widget steps. The theme
 *    pointer must be re-applied before the icon is rebuilt: a search glyph
 *    rasterized from the old palette would keep the old tint.
 * 2. `createAppearanceRefresh(apply)` makes the whole thing idempotent by the
 *    opaque appearance hash: the same hash does no work and still reports
 *    `applied`, while a new hash runs the refresh. A throw is not recorded as
 *    applied, so the runtime's next trigger retries it.
 *
 * PURE: no `ags`, no `gi://*`, no I/O.
 */

/** The two GTK operations the selector performs for one appearance. */
export interface SelectorAppearanceSurface {
  /** Re-apply the platform Theme's stable `colors.css` pointer. */
  reapplyTheme(): void;
  /** Replace the static search glyph with one rendered from the new palette. */
  rebuildSearchIcon(): void;
}

/** What the platform's `createPaletteRefreshHandler` accepts as applied. */
export interface AppearanceApplied {
  status: "applied";
}

/**
 * Run the non-destructive appearance refresh in its required order.
 *
 * The drawer, query, selection and busy state are intentionally absent: the
 * palette refresh must never rescan the model, clear the query or rebuild the
 * gallery.
 */
export function applySelectorAppearance(
  surface: SelectorAppearanceSurface,
): void {
  surface.reapplyTheme();
  surface.rebuildSearchIcon();
}

/**
 * Wrap an appearance application as a hash-idempotent refresh.
 *
 * The refresh is opaque to the hash; the app only records which appearance it
 * last applied successfully. Repeated triggers for the same hash are safe and
 * cheap (the runtime ledger retries failures, not successes). A new hash runs
 * the refresh; a failed refresh leaves the previous hash in place so the next
 * trigger retries it.
 */
export function createAppearanceRefresh(
  apply: () => void,
): (appearanceHash: string) => AppearanceApplied {
  let appliedHash: string | null = null;

  return (appearanceHash: string): AppearanceApplied => {
    if (appearanceHash !== appliedHash) {
      apply();
      appliedHash = appearanceHash;
    }
    return { status: "applied" };
  };
}
