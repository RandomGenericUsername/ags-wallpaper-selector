// Disk-cached thumbnails (GJS side).
//
// Full-resolution wallpapers (and their variants) are far too heavy to
// decode on every open, and the runtime owns no thumbnails — so the
// selector keeps its own cache under the user cache dir. A cache entry is
// keyed by `sha256(path + mtime + size)` plus a `CACHE_VER` tag: content
// changes under a stable path (re-provisioned tarball) invalidate
// naturally, renames just miss. The version tag is the only invalidation
// for entries whose source stats NEVER move — v1 was fully desaturated
// for every RGBA source (gdk-pixbuf JPEG writer bug, see flattenToRGB)
// and the poisoned files kept re-hitting forever; v2 starts after the
// alpha flatten landed.

import Gdk from "gi://Gdk?version=4.0";
import GdkPixbuf from "gi://GdkPixbuf?version=2.0";
import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

export const THUMB_MAX_DIM = 360;

// JPEG cache: photos encode ~4x faster than PNG and decode faster too.
// JPEG carries no alpha, so RGBA sources are composited onto black before
// the save (flattenToRGB, below). Over-black is the faithful choice: it is
// what Hyprland composites a transparent wallpaper against on the live
// desktop, and this corpus has no visible transparency anyway (BUG-001:
// 40 spine PNGs — all fully opaque except degenerate junk; WEG dim
// variants measure min-alpha 179-204, rendered over black live too).
const CACHE_FORMAT = "jpeg";
const CACHE_EXT = "jpg";
const CACHE_QUALITY = "82";
// Bump whenever the on-disk bytes or the generation recipe change: entries
// are keyed path+mtime+size alone, so without this tag an old poisoned
// file keeps re-hitting as long as its source stays untouched. v1 =
// RGBA-sourced JPEGs written by the pre-flatten code (grayscale, BUG-001).
const CACHE_VER = "v2";

const memoryCache = new Map<string, Gdk.Texture>();

export function thumbnailCacheDir(): string {
  const dir = `${GLib.get_user_cache_dir()}/dotfiles-wallpaper-selector`;
  GLib.mkdir_with_parents(dir, 0o755);
  return dir;
}

function cacheKey(sourcePath: string): string | null {
  try {
    const info = Gio.File.new_for_path(sourcePath).query_info(
      "time::modified,standard::size",
      Gio.FileQueryInfoFlags.NONE,
      null,
    );
    const mtime = info.get_modification_date_time()?.format_iso8601() ?? "";
    const stamp = `${sourcePath}\0${mtime}\0${info.get_size()}`;
    // GJS requires the explicit byte length (a 2-arg call throws), and the
    // stamp carries embedded NUL separators, so hash the whole UTF-8 string
    // rather than letting a NUL terminate it.
    const length = new TextEncoder().encode(stamp).length;
    return GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256, stamp, length);
  } catch {
    return null;
  }
}

function cachedPath(sourcePath: string, maxDim: number): string | null {
  const key = cacheKey(sourcePath);
  if (key === null) return null;
  // The version tag sits between hash and display size so v1 files (`<key>-
  // <maxDim>.jpg`) can never match a v2 lookup name (and recursion via the
  // maxDim suffix stays unique).
  return `${thumbnailCacheDir()}/${key}-${CACHE_VER}-${maxDim}.${CACHE_EXT}`;
}

function textureFromPixbuf(pixbuf: GdkPixbuf.Pixbuf): Gdk.Texture {
  return Gdk.Texture.new_for_pixbuf(pixbuf);
}

/**
 * gdk-pixbuf's JPEG writer mishandles 4-channel buffers: on this host
 * (pixbuf 2.44.8) every RGBA source saved through `savev(..., "jpeg", …)`
 * came out a fully DESATURATED jpeg (sat 0.0 measured per regenerated
 * file; 3-channel sources saved correctly, sat 0.30-0.69 — BUG-001). So
 * composite any RGBA pixbuf onto black and hand the save (and the memory
 * texture) an opaque 3-channel buffer: one definition of "a thumbnail",
 * disk and memory identical. Freshly `new()`ed RGB pixbufs are zeroed,
 * i.e. black; a full-area composite with overall_alpha 255 yields
 * `a*src + (1-a)*0` per pixel — exact for opaque sources, over-black for
 * translucent ones (which is how the desktop renders them live). */
function flattenToRGB(pixbuf: GdkPixbuf.Pixbuf): GdkPixbuf.Pixbuf {
  if (pixbuf.get_n_channels() === 3) return pixbuf;
  const flat = GdkPixbuf.Pixbuf.new(
    GdkPixbuf.Colorspace.RGB,
    false,
    8,
    pixbuf.get_width(),
    pixbuf.get_height(),
  );
  pixbuf.composite(
    flat,
    0,
    0,
    flat.get_width(),
    flat.get_height(),
    0,
    0,
    1,
    1,
    GdkPixbuf.InterpType.BILINEAR,
    255,
  );
  return flat;
}

function remember(memKey: string, texture: Gdk.Texture): Gdk.Texture {
  memoryCache.set(memKey, texture);
  return texture;
}

/** Fast path: disk-cache hit → texture, WITHOUT decoding the source.
 * Returns null on miss (the caller decodes off the critical path). */
export function cachedTexture(
  sourcePath: string,
  maxDim: number = THUMB_MAX_DIM,
): Gdk.Texture | null {
  const memKey = `${sourcePath}:${maxDim}`;
  const mem = memoryCache.get(memKey);
  if (mem !== undefined) return mem;
  try {
    const cached = cachedPath(sourcePath, maxDim);
    if (cached !== null && GLib.file_test(cached, GLib.FileTest.EXISTS)) {
      return remember(memKey, textureFromPixbuf(GdkPixbuf.Pixbuf.new_from_file(cached)));
    }
  } catch (error) {
    console.error(`wallpaper-selector: cannot read thumb cache for ${sourcePath}: ${error}`);
  }
  return null;
}

/** Slow path: full decode + scale + cache write (call off the UI thread —
 * from a GLib idle pump, never in a render loop). Null when undecodable. */
export function generateThumb(
  sourcePath: string,
  maxDim: number = THUMB_MAX_DIM,
): Gdk.Texture | null {
  const memKey = `${sourcePath}:${maxDim}`;
  const mem = memoryCache.get(memKey);
  if (mem !== undefined) return mem;
  try {
    const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(sourcePath, maxDim, maxDim);
    // Flatten BEFORE saving: the RGBA pixbuf is exactly what the jpeg
    // writer cannot handle (grayscale output, BUG-001), and using the
    // flattened buffer for the texture as well keeps memory == disk.
    const opaque = flattenToRGB(pixbuf);
    const cached = cachedPath(sourcePath, maxDim);
    if (cached !== null) {
      try {
        opaque.savev(cached, CACHE_FORMAT, ["quality"], [CACHE_QUALITY]);
      } catch (error) {
        console.error(`wallpaper-selector: cannot write thumb cache ${cached}: ${error}`);
      }
    }
    return remember(memKey, textureFromPixbuf(opaque));
  } catch (error) {
    console.error(`wallpaper-selector: cannot thumbnail ${sourcePath}: ${error}`);
    return null;
  }
}

/** Sync convenience (single images: breadcrumb, first paint). Grid cards
 * MUST use the async pump in the window (cachedTexture + generateThumb),
 * never this — a cold cache decodes ~5s for the full spine. */
export function thumbTexture(sourcePath: string, maxDim: number = THUMB_MAX_DIM): Gdk.Texture | null {
  return cachedTexture(sourcePath, maxDim) ?? generateThumb(sourcePath, maxDim);
}

/** Drop in-memory textures (disk cache survives); called after rescan. */
export function clearMemoryCache(): void {
  memoryCache.clear();
}
