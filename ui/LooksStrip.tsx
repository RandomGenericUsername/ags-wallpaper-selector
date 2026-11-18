// ---------------------------------------------------------------------------
// Looks strip (REQ-005 D3/§5.4):
//
//   Original + generated variants as 54 × 34 chips. The chip background is a
//   108 × 68 decode (2×), the selected chip carries an accent ring, and the
//   live chip carries a 5 px dot — the dot is app-owned (the skin never owns a
//   signal dot). With no variants the strip still shows Original and an honest
//   note; it never pre-generates anything.
// ---------------------------------------------------------------------------

import { Gtk } from "ags/gtk4";
import GLib from "gi://GLib?version=2.0";
import type { VariantEntry } from "../lib/model";
import { cachedTexture, generateThumb } from "../lib/thumbnails";

const LOOK_DIM = 108;

export interface LookChoice {
  name: string;
  path: string;
}

export interface LooksStripModel {
  wallpaperPath: string;
  variants: VariantEntry[];
  lookIndex: number;
  liveLookIndex: number | null;
  disabled: boolean;
}

export class LooksStrip {
  readonly widget: Gtk.Box;
  private readonly row: Gtk.Box;
  private readonly note: Gtk.Label;
  private generation = 0;
  private onSelect: (index: number) => void = () => {};

  constructor(onSelect: (index: number) => void) {
    this.onSelect = onSelect;
    this.widget = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 7 });
    this.widget.add_css_class("ws-looks");

    this.row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
    this.row.add_css_class("ws-looks-row");
    this.note = new Gtk.Label({
      label: "No looks yet — generated on first set.",
      xalign: 0,
    });
    this.note.add_css_class("ws-looks-empty");
    this.note.set_visible(false);

    this.widget.append(this.row);
    this.widget.append(this.note);
  }

  update(model: LooksStripModel): void {
    this.generation += 1;
    const generation = this.generation;
    let child = this.row.get_first_child();
    while (child !== null) {
      const next = child.get_next_sibling();
      this.row.remove(child);
      child = next;
    }

    const choices: LookChoice[] = [
      { name: "Original", path: model.wallpaperPath },
      ...model.variants.map((variant) => ({
        name: variant.name,
        path: variant.path,
      })),
    ];

    choices.forEach((choice, index) => {
      const chip = new Gtk.Button();
      chip.add_css_class("ws-look");
      chip.set_tooltip_text(choice.name);
      chip.update_property([Gtk.AccessibleProperty.LABEL], [choice.name]);
      if (index === model.lookIndex) chip.add_css_class("selected");
      chip.set_sensitive(!model.disabled);

      const overlay = new Gtk.Overlay();
      const picture = new Gtk.Picture();
      picture.set_content_fit(Gtk.ContentFit.COVER);
      picture.set_size_request(54, 34);
      overlay.set_child(picture);
      const texture = cachedTexture(choice.path, LOOK_DIM);
      if (texture !== null) picture.set_paintable(texture);
      else {
        GLib.idle_add(GLib.PRIORITY_LOW, () => {
          if (generation !== this.generation) return false;
          const decoded = generateThumb(choice.path, LOOK_DIM);
          if (decoded !== null) picture.set_paintable(decoded);
          return false;
        });
      }
      if (index === model.liveLookIndex) {
        const dot = new Gtk.Box();
        dot.add_css_class("ws-look-live-dot");
        dot.set_halign(Gtk.Align.END);
        dot.set_valign(Gtk.Align.START);
        dot.set_can_target(false);
        overlay.add_overlay(dot);
      }
      chip.set_child(overlay);
      chip.connect("clicked", () => {
        if (!model.disabled) this.onSelect(index);
      });
      this.row.append(chip);
    });

    this.note.set_visible(model.variants.length === 0);
    this.row.set_opacity(model.disabled ? 0.45 : 1);
    this.row.set_sensitive(!model.disabled);
  }
}
