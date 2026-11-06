/**
 * The pure app-owned work for the wallpaper selector's live appearance refresh
 * (AD-27).
 *
 * The runtime invokes `palette-refresh <appearance-hash>` after an appearance
 * change. Platform v0.9.0's `createAppearanceRefreshHandler` re-applies the
 * WHOLE appearance (palette + skin + mode) first, so this app no longer owns a
 * `theme.apply()` step or the hash ledger. What remains is genuinely derived
 * widget work: the registry-backed search icon must be rasterized again from
 * the new palette. The drawer itself — the visible grid or variant gallery, the
 * search query, the drilled selection and any in-flight apply — is deliberately
 * NOT touched. That is what "preserve the drawer" means here, and it is why this
 * module has no drawer operations at all.
 *
 * PURE: no `ags`, no `gi://*`, no I/O.
 */

/** The one GTK operation the selector performs for one appearance. */
export interface SelectorAppearanceSurface {
  /** Replace the static search glyph with one rendered from the new palette. */
  rebuildSearchIcon(): void;
}

/**
 * Run the non-destructive app-owned appearance work.
 *
 * The drawer, query, selection and busy state are intentionally absent: the
 * palette refresh must never rescan the model, clear the query or rebuild the
 * gallery.
 */
export function applySelectorAppearance(
  surface: SelectorAppearanceSurface,
): void {
  surface.rebuildSearchIcon();
}
