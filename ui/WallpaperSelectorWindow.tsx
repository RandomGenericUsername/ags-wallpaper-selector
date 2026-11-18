// Thin mounting wrapper kept for the app's existing import surface.
//
// The overlay implementation lives in `OverlayWindow.tsx`; this file only
// re-exports the window and its appearance-refresh chrome seam so `app.tsx`
// and the conformance gate keep one stable entry point.
export {
  WallpaperSelectorWindow,
  refreshWallpaperSelectorChrome,
} from "./OverlayWindow";
