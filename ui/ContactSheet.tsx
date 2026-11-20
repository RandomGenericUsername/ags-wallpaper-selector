// ---------------------------------------------------------------------------
// Contact sheet (REQ-005 D10/§5.6): the secondary finder on `G` or `/`.
//
// One `Gtk.Stack` page with a `Gtk.SearchEntry`, a FlowBox of 16:9 cards and
// the live badge. The grid keeps the existing 208 px async thumbnail pump:
// the page renders instantly with empty pictures and thumbs stream in on a
// low-priority idle tick. Search filters by wallpaper name.
// ---------------------------------------------------------------------------

import { Gtk } from "ags/gtk4";
import GLib from "gi://GLib?version=2.0";
import Pango from "gi://Pango?version=1.0";
import {
  filterWallpapers,
  formatDimensions,
  variantsFor,
  type SelectorModel,
  type WallpaperEntry,
} from "../lib/model";
import { cachedTexture, generateThumb } from "../lib/thumbnails";

const GRID_DIM = 208;
const CARD_W = 280;
const CARD_H = 158;

export interface ContactSheetOptions {
  width: number;
  searchIcon: Gtk.Widget;
  onPick(wallpaper: WallpaperEntry): void;
  onClose(): void;
  onQuery(query: string): void;
}

function text(cssClass: string, xalign = 0): Gtk.Label {
  const label = new Gtk.Label({ xalign });
  label.add_css_class(cssClass);
  return label;
}

export class ContactSheet {
  readonly widget: Gtk.Box;
  private readonly search: Gtk.SearchEntry;
  private readonly searchRow: Gtk.Box;
  private readonly count: Gtk.Label;
  private readonly flow: Gtk.FlowBox;
  private readonly scroll: Gtk.ScrolledWindow;
  private readonly empty: Gtk.Label;
  private readonly options: ContactSheetOptions;
  private model: SelectorModel | null = null;
  private focusedHash = "";
  private query = "";
  private thumbGen = 0;
  private thumbQueue: Array<{ picture: Gtk.Picture; path: string; gen: number }> = [];
  private thumbPumpScheduled = false;

  constructor(options: ContactSheetOptions) {
    this.options = options;
    this.widget = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 18 });
    this.widget.add_css_class("ws-grid");

    // ── header: title + count / search + close ───────────────────────────
    const head = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 22 });
    head.add_css_class("ws-grid-head");
    const titleBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 5 });
    titleBox.set_hexpand(true);
    const titleRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    const title = new Gtk.Label({ label: "All wallpapers", xalign: 0 });
    title.add_css_class("ws-grid-title");
    this.count = new Gtk.Label({ label: "0" });
    this.count.add_css_class("ws-grid-count");
    titleRow.append(title);
    titleRow.append(this.count);
    titleBox.append(titleRow);
    titleBox.append(
      text(
        "ws-grid-sub",
      ),
    );
    const subtitle = titleBox.get_last_child() as Gtk.Label;
    subtitle.set_label(
      "Pick one to preview it on the desktop. Nothing is applied until you press Set.",
    );

    const tools = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
    tools.add_css_class("ws-grid-tools");
    this.searchRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    this.searchRow.add_css_class("ws-grid-search");
    this.searchRow.set_size_request(300, 36);
    this.searchRow.append(options.searchIcon);
    this.search = new Gtk.SearchEntry();
    this.search.set_hexpand(false);
    // width-chars sets the natural size; max-width-chars alone does not stop
    // the row from growing to the placeholder's full width.
    this.search.set_width_chars(18);
    this.search.set_max_width_chars(18);
    this.search.set_placeholder_text("Search wallpapers…");
    this.search.connect("search-changed", () => {
      this.query = this.search.get_text();
      this.options.onQuery(this.query);
      this.render();
    });
    this.searchRow.append(this.search);
    tools.append(this.searchRow);

    const close = new Gtk.Button();
    close.add_css_class("ws-grid-close");
    close.set_tooltip_text("Close grid");
    close.update_property([Gtk.AccessibleProperty.LABEL], ["Close grid"]);
    close.set_child(
      new Gtk.Image({ icon_name: "window-close-symbolic", pixel_size: 15 }),
    );
    close.connect("clicked", () => this.options.onClose());
    tools.append(close);
    head.append(titleBox);
    head.append(tools);
    this.widget.append(head);

    // ── body: cards ──────────────────────────────────────────────────────
    this.flow = new Gtk.FlowBox({
      selection_mode: Gtk.SelectionMode.NONE,
      column_spacing: 20,
      row_spacing: 24,
      homogeneous: false,
      max_children_per_line: 4,
      min_children_per_line: 1,
      valign: Gtk.Align.START,
    });
    this.flow.add_css_class("ws-grid-flow");
    this.flow.set_size_request(Math.max(280, Math.min(1320, options.width - 120)), -1);
    const scroll = new Gtk.ScrolledWindow({ hexpand: true, vexpand: true });
    this.scroll = scroll;
    scroll.add_css_class("ws-grid-scroll");
    const holder = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
    holder.set_halign(Gtk.Align.CENTER);
    holder.append(this.flow);
    scroll.set_child(holder);
    this.widget.append(scroll);

    this.empty = text("ws-grid-empty", 0.5);
    this.empty.set_visible(false);
    this.widget.append(this.empty);
  }

  /** Replace the appearance-derived search glyph without resetting the query. */
  replaceSearchIcon(icon: Gtk.Widget): void {
    const old = this.searchRow.get_first_child();
    if (old !== null) this.searchRow.remove(old);
    this.searchRow.prepend(icon);
  }

  update(model: SelectorModel | null, focusedHash: string): void {
    this.model = model;
    this.focusedHash = focusedHash;
    this.render();
  }

  setQuery(query: string): void {
    this.query = query;
    if (this.search.get_text() !== query) this.search.set_text(query);
    this.render();
  }

  queryEmpty(): boolean {
    return this.query.trim() === "";
  }

  isSearchFocused(): boolean {
    // GtkSearchEntry delegates focus to its inner GtkText; the wrapper's
    // has_focus stays false, so letters were treated as navigation (G closed
    // the grid) instead of typing.
    return this.search.has_focus || this.search.get_focus_child() !== null;
  }

  clearQuery(): void {
    this.setQuery("");
  }

  focusSearch(): void {
    // The stack page may still be crossfading when showGrid asks for focus;
    // grab_focus on an unmapped entry is a no-op, which silently breaks typing.
    let attempts = 0;
    const attempt = () => {
      if (this.isSearchFocused()) return false;
      this.search.grab_focus();
      attempts += 1;
      return attempts < 8 && !this.isSearchFocused();
    };
    if (!attempt()) {
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 60, attempt);
    }
  }

  /** Responsive search width (REQ-005 §5.8: narrower below 880 px). */
  setSearchWidth(width: number): void {
    this.searchRow.set_size_request(width, 36);
  }

  /** `Enter` in the grid: pick the first result, if any. */
  pickFirst(): boolean {
    if (this.model === null) return false;
    const list = filterWallpapers(this.model.wallpapers, this.query);
    if (list.length === 0) return false;
    this.options.onPick(list[0]);
    return true;
  }

  private render(): void {
    this.thumbGen += 1;
    this.thumbQueue = [];
    this.thumbPumpScheduled = false;
    const generation = this.thumbGen;
    let child = this.flow.get_first_child();
    while (child !== null) {
      const next = child.get_next_sibling();
      this.flow.remove(child);
      child = next;
    }

    const all = this.model?.wallpapers ?? [];
    const list = filterWallpapers(all, this.query);
    this.count.set_label(String(list.length));
    if (list.length === 0) {
      this.empty.set_label(
        all.length === 0
          ? "No wallpapers in the install spine."
          : `No wallpapers match “${this.query.trim()}”.`,
      );
      this.scroll.set_visible(false);
      this.empty.set_visible(true);
      return;
    }
    this.scroll.set_visible(true);
    this.empty.set_visible(false);
    for (const wallpaper of list) {
      this.flow.append(this.card(wallpaper, generation));
    }
  }

  private card(wallpaper: WallpaperEntry, generation: number): Gtk.Widget {
    const card = new Gtk.Button();
    card.add_css_class("ws-grid-card");
    if (wallpaper.hash === this.focusedHash) card.add_css_class("focused");
    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
    const art = new Gtk.Overlay();
    const picture = new Gtk.Picture();
    picture.set_content_fit(Gtk.ContentFit.COVER);
    picture.set_size_request(CARD_W, CARD_H);
    const hit = cachedTexture(wallpaper.path, GRID_DIM);
    if (hit !== null) picture.set_paintable(hit);
    else {
      this.thumbQueue.push({ picture, path: wallpaper.path, gen: generation });
      this.schedulePump();
    }
    art.set_child(picture);
    art.add_css_class("ws-grid-art");
    if (wallpaper.live) {
      const badge = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 5 });
      badge.add_css_class("ws-grid-live");
      badge.set_halign(Gtk.Align.END);
      badge.set_valign(Gtk.Align.START);
      const dot = new Gtk.Box();
      dot.add_css_class("ws-grid-live-dot");
      dot.set_can_target(false);
      badge.append(dot);
      badge.append(new Gtk.Label({ label: "Live" }));
      art.add_overlay(badge);
    }
    box.append(art);

    const name = new Gtk.Label({ label: wallpaper.name, xalign: 0 });
    name.add_css_class("ws-grid-name");
    name.set_ellipsize(Pango.EllipsizeMode.END);
    box.append(name);
    const meta = formatDimensions(wallpaper.width, wallpaper.height);
    const looks =
      wallpaper.variantCount === 0
        ? "no looks yet"
        : `${wallpaper.variantCount} ${wallpaper.variantCount === 1 ? "look" : "looks"}`;
    const metaLabel = new Gtk.Label({
      label: meta === null ? looks : `${meta} · ${looks}`,
      xalign: 0,
    });
    metaLabel.add_css_class("ws-grid-meta");
    box.append(metaLabel);
    card.set_child(box);
    card.connect("clicked", () => this.options.onPick(wallpaper));
    return card;
  }

  private schedulePump(): void {
    if (this.thumbPumpScheduled || this.thumbQueue.length === 0) return;
    this.thumbPumpScheduled = true;
    GLib.idle_add(GLib.PRIORITY_LOW, () => {
      const batch = this.thumbQueue.splice(0, 3);
      for (const item of batch) {
        if (item.gen !== this.thumbGen) continue;
        const texture = generateThumb(item.path, GRID_DIM);
        if (texture !== null && item.gen === this.thumbGen) {
          item.picture.set_paintable(texture);
        }
      }
      if (this.thumbQueue.length > 0) return true;
      this.thumbPumpScheduled = false;
      return false;
    });
  }
}
