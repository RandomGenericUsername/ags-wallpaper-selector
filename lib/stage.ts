// ---------------------------------------------------------------------------
// STAGE: the full-bleed wallpaper surface (GJS side).
//
// Two `Gtk.Picture` children in a `Gtk.Stack` with a 500 ms CROSSFADE. The
// stack's children both fill the stack, so `ContentFit.COVER` crops at the
// monitor size exactly like the desktop. CSS transitions are dead in GTK 4.24;
// the stack's own crossfade is the only motion here.
//
// Decode policy (REQ-005 §8.4):
//   * cache hit at stage size -> present synchronously;
//   * miss -> present the 208 px grid thumb immediately, then decode the
//     stage size on a low-priority idle tick and swap it in if still current;
//   * neighbours are preloaded at half resolution while the current one is
//     visible; a transition then hits the memory/disk cache.
//
// The stage never blocks map/show.
// ---------------------------------------------------------------------------

import { Gdk, Gtk } from "ags/gtk4";
import GLib from "gi://GLib?version=2.0";
import {
  cachedTexture,
  generateThumb,
  thumbTexture,
} from "./thumbnails";

export const STAGE_CAP = 2560;
export const PREVIEW_THUMB_DIM = 208;
export const STAGE_CROSSFADE_MS = 500;

/** The logical decode size: the monitor's long edge, capped at 2560. */
export function stageDecodeDim(
  monitorWidth: number,
  monitorHeight: number,
  cap = STAGE_CAP,
): number {
  const longEdge = Math.max(1, monitorWidth, monitorHeight);
  return Math.max(1, Math.min(cap, Math.trunc(longEdge)));
}

/** Half-resolution neighbour preload (never below a useful preview size). */
export function preloadDecodeDim(stageDim: number): number {
  return Math.max(320, Math.trunc(stageDim / 2));
}

/** Wrapping neighbour index; count <= 0 yields 0. */
export function neighbourIndex(index: number, count: number, delta: number): number {
  if (count <= 0) return 0;
  return ((index + delta) % count + count) % count;
}

export class StageView {
  readonly widget: Gtk.Stack;
  private readonly pictures: [Gtk.Picture, Gtk.Picture] = [
    new Gtk.Picture(),
    new Gtk.Picture(),
  ];
  private front = 0;
  private currentPath = "";
  private decodeGeneration = 0;
  private dim: number;

  constructor(monitorWidth: number, monitorHeight: number) {
    this.dim = stageDecodeDim(monitorWidth, monitorHeight);
    this.widget = new Gtk.Stack({
      transition_type: Gtk.StackTransitionType.CROSSFADE,
      transition_duration: STAGE_CROSSFADE_MS,
      hexpand: true,
      vexpand: true,
    });
    this.widget.add_css_class("ws-stage");
    this.pictures.forEach((picture, index) => {
      picture.set_content_fit(Gtk.ContentFit.COVER);
      picture.set_can_shrink(true);
      picture.set_hexpand(true);
      picture.set_vexpand(true);
      picture.add_css_class("ws-stage-picture");
      this.widget.add_named(picture, `stage-${index}`);
    });
    this.widget.set_visible_child(this.pictures[0]);
  }

  get stageDim(): number {
    return this.dim;
  }

  /** Present `path`, optionally crossfading from the current wallpaper. */
  show(path: string, animate = true): void {
    if (path === this.currentPath) return;
    this.currentPath = path;
    this.decodeGeneration += 1;
    const generation = this.decodeGeneration;
    const target = this.pictures[1 - this.front];
    const hit = cachedTexture(path, this.dim);
    if (hit !== null) {
      target.set_paintable(hit);
      this.present(target, animate);
      return;
    }
    // Fast placeholder: a preloaded half-resolution neighbour is the best
    // immediate fit; the grid's 208 px thumb is the warm-cache fallback. If
    // even that misses, decode it synchronously (~tens of ms) so the first
    // open never shows the previous wallpaper; the stage-size decode still
    // lands on an idle tick.
    const quick =
      cachedTexture(path, preloadDecodeDim(this.dim)) ??
      cachedTexture(path, PREVIEW_THUMB_DIM) ??
      generateThumb(path, PREVIEW_THUMB_DIM);
    if (quick !== null) target.set_paintable(quick);
    this.present(target, animate);
    GLib.idle_add(GLib.PRIORITY_LOW, () => {
      if (generation !== this.decodeGeneration) return false;
      const decoded = generateThumb(path, this.dim);
      if (decoded !== null && generation === this.decodeGeneration) {
        target.set_paintable(decoded);
      }
      return false;
    });
  }

  /** Decode the direct neighbours off the critical path. */
  preload(paths: string[]): void {
    const dim = preloadDecodeDim(this.dim);
    for (const path of paths) {
      if (path === this.currentPath) continue;
      if (cachedTexture(path, dim) !== null) continue;
      GLib.idle_add(GLib.PRIORITY_LOW, () => {
        generateThumb(path, dim);
        return false;
      });
    }
  }

  /** Synchronous texture for the current path (used by the contact sheet). */
  texture(path: string): Gdk.Texture | null {
    return thumbTexture(path, this.dim);
  }

  private present(target: Gtk.Picture, animate: boolean): void {
    if (animate) {
      this.widget.set_visible_child(target);
    } else {
      const previous = this.widget.get_transition_duration();
      this.widget.set_transition_duration(0);
      this.widget.set_visible_child(target);
      this.widget.set_transition_duration(previous);
    }
    this.front = target === this.pictures[0] ? 0 : 1;
  }
}
