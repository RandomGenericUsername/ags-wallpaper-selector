// ---------------------------------------------------------------------------
// The one control bar (REQ-005 D4/§5.4).
//
// Three zones in a Gtk.CenterBox: info / looks / actions. The bar owns every
// setting and the only commit action. It is paint-free structure: the skin
// styles `.ws-control-bar` (surface.panel) and the simple surfaces below it;
// this file owns layout, components and content.
//
// The state pill is text (`Live` / `Preview` / `Preview · <look>` /
// `Setting…`), never colour alone. The commit progress is a 2 px line along
// the bar's bottom edge plus an inner fill, driven by the three real
// `wallpaper.state` steps — never a continuous timer.
// ---------------------------------------------------------------------------

import { Gtk } from "ags/gtk4";
import Pango from "gi://Pango?version=1.0";
import { LooksStrip, type LooksStripModel } from "./LooksStrip";

export interface ControlBarModel {
  name: string;
  /** `Live`, `Preview`, `Preview · <look>` or `Setting…`. */
  stateText: string;
  live: boolean;
  committing: boolean;
  meta: string;
  /** True while the meta line shows a commit step. */
  step: boolean;
  /** True when the meta line carries a failure instead of metadata. */
  error: boolean;
  swatches: string[];
  lookName: string;
  looks: LooksStripModel;
  /** 0..1; only meaningful while committing. */
  progress: number;
  setEnabled: boolean;
  setText: string;
}

export interface ControlBarOptions {
  width: number;
  gearPopover: Gtk.Popover;
  onSet(): void;
  onLookSelect(index: number): void;
}

function textLabel(cssClass: string, xalign = 0): Gtk.Label {
  const label = new Gtk.Label({ xalign });
  label.add_css_class(cssClass);
  return label;
}

function keycap(text: string): Gtk.Label {
  const label = new Gtk.Label({ label: text });
  label.add_css_class("ws-kbd");
  return label;
}

/** A 12 px palette-hint dot, painted with Cairo (no per-widget CSS provider). */
function swatch(color: string): Gtk.DrawingArea {
  const area = new Gtk.DrawingArea();
  area.set_size_request(12, 12);
  area.set_halign(Gtk.Align.CENTER);
  area.set_valign(Gtk.Align.CENTER);
  area.set_tooltip_text(color);
  area.add_css_class("ws-swatch");
  area.set_draw_func((_area, cr, width, height) => {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
    if (match === null) return;
    cr.setSourceRGBA(
      Number.parseInt(match[1], 16) / 255,
      Number.parseInt(match[2], 16) / 255,
      Number.parseInt(match[3], 16) / 255,
      1,
    );
    cr.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
    cr.fill();
  });
  return area;
}

export class ControlBar {
  readonly widget: Gtk.Overlay;
  private readonly bar: Gtk.CenterBox;
  private readonly name: Gtk.Label;
  private readonly statePill: Gtk.Box;
  private readonly stateDot: Gtk.Box;
  private readonly stateText: Gtk.Label;
  private readonly meta: Gtk.Label;
  private readonly swatches: Gtk.Box;
  private readonly lookName: Gtk.Label;
  private readonly looks: LooksStrip;
  private readonly setButton: Gtk.Button;
  private readonly setLabel: Gtk.Label;
  private readonly setKeycap: Gtk.Label;
  private readonly setProgress: Gtk.ProgressBar;
  private readonly barProgress: Gtk.ProgressBar;
  private readonly hints: Gtk.Box;
  private readonly middle: Gtk.Box;
  readonly gear: Gtk.MenuButton;

  constructor(options: ControlBarOptions) {
    this.bar = new Gtk.CenterBox();
    this.bar.add_css_class("ws-control-bar");
    this.bar.set_halign(Gtk.Align.CENTER);
    this.bar.set_valign(Gtk.Align.CENTER);
    this.bar.set_size_request(options.width, -1);

    // ── left: filename, state pill, meta + palette hint ──────────────────
    const left = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
    left.add_css_class("ws-left");
    left.set_hexpand(true);
    left.set_valign(Gtk.Align.CENTER);
    const nameRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
    this.name = textLabel("ws-name");
    // The mock keeps the state pill beside the filename; the name does not
    // grow to eat the left zone. Long names ellipsize at a fixed cap.
    this.name.set_max_width_chars(32);
    this.name.set_ellipsize(Pango.EllipsizeMode.END);
    nameRow.append(this.name);

    this.statePill = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 5 });
    this.statePill.add_css_class("ws-state-pill");
    this.statePill.set_valign(Gtk.Align.CENTER);
    this.stateDot = new Gtk.Box();
    this.stateDot.add_css_class("ws-state-dot");
    this.stateDot.set_can_target(false);
    this.stateDot.set_valign(Gtk.Align.CENTER);
    this.stateDot.set_halign(Gtk.Align.CENTER);
    this.stateDot.set_size_request(6, 6);
    this.stateText = textLabel("ws-state-text");
    this.statePill.append(this.stateDot);
    this.statePill.append(this.stateText);
    nameRow.append(this.statePill);
    left.append(nameRow);

    const metaRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
    metaRow.add_css_class("ws-meta-row");
    this.meta = textLabel("ws-meta");
    metaRow.append(this.meta);
    this.swatches = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
    this.swatches.add_css_class("ws-swatches");
    this.swatches.set_valign(Gtk.Align.CENTER);
    metaRow.append(this.swatches);
    left.append(metaRow);

    // ── centre: Looks header + chips ─────────────────────────────────────
    const middle = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 7 });
    this.middle = middle;
    middle.add_css_class("ws-middle");
    middle.set_halign(Gtk.Align.CENTER);
    middle.set_valign(Gtk.Align.CENTER);
    const looksHead = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 7 });
    looksHead.add_css_class("ws-looks-head");
    const looksWord = new Gtk.Label({ label: "Looks" });
    looksWord.add_css_class("ws-looks-word");
    looksHead.append(looksWord);
    this.lookName = new Gtk.Label({ label: "Original" });
    this.lookName.add_css_class("ws-look-name");
    looksHead.append(this.lookName);
    looksHead.append(keycap("↑"));
    looksHead.append(keycap("↓"));
    middle.append(looksHead);
    this.looks = new LooksStrip(options.onLookSelect);
    middle.append(this.looks.widget);

    // ── right: gear, Set, hints ──────────────────────────────────────────
    const right = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 5 });
    right.add_css_class("ws-right");
    right.set_halign(Gtk.Align.END);
    right.set_valign(Gtk.Align.CENTER);
    const actions = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    actions.add_css_class("ws-actions");

    const gear = new Gtk.MenuButton();
    gear.add_css_class("ws-gear");
    gear.set_size_request(42, 42);
    gear.set_halign(Gtk.Align.CENTER);
    gear.set_valign(Gtk.Align.CENTER);
    gear.set_tooltip_text("Placement settings");
    gear.update_property([Gtk.AccessibleProperty.LABEL], ["Placement settings"]);
    gear.set_popover(options.gearPopover);
    const gearIcon = new Gtk.Image({ icon_name: "emblem-system-symbolic", pixel_size: 16 });
    gear.set_child(gearIcon);
    gear.connect("notify::active", () => {
      if (gear.get_active()) gear.add_css_class("is-active");
      else gear.remove_css_class("is-active");
    });
    actions.append(gear);
    this.gear = gear;

    this.setButton = new Gtk.Button();
    this.setButton.add_css_class("ws-set");
    this.setButton.set_tooltip_text("Set this wallpaper");
    const setSurface = new Gtk.Overlay();
    this.setProgress = new Gtk.ProgressBar();
    this.setProgress.add_css_class("ws-set-progress");
    this.setProgress.set_show_text(false);
    this.setProgress.set_valign(Gtk.Align.FILL);
    this.setProgress.set_halign(Gtk.Align.FILL);
    setSurface.set_child(this.setProgress);
    const setContent = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 9 });
    setContent.add_css_class("ws-set-content");
    this.setLabel = new Gtk.Label({ label: "Set wallpaper" });
    this.setLabel.add_css_class("ws-set-text");
    this.setKeycap = keycap("↵");
    setContent.append(this.setLabel);
    setContent.append(this.setKeycap);
    setSurface.add_overlay(setContent);
    this.setButton.set_child(setSurface);
    this.setButton.connect("clicked", () => options.onSet());
    actions.append(this.setButton);

    right.append(actions);

    this.hints = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 5 });
    this.hints.add_css_class("ws-hints");
    for (const [key, verb] of [
      ["Esc", "cancel"],
      ["G", "grid"],
      ["/", "search"],
    ] as const) {
      if (this.hints.get_first_child() !== null) {
        this.hints.append(new Gtk.Label({ label: "·" }));
      }
      this.hints.append(keycap(key));
      this.hints.append(new Gtk.Label({ label: verb }));
    }
    right.append(this.hints);

    this.bar.set_start_widget(left);
    this.bar.set_center_widget(middle);
    this.bar.set_end_widget(right);

    // The commit line runs along the bar's bottom edge.
    this.widget = new Gtk.Overlay();
    this.widget.add_css_class("ws-bar-shell");
    this.widget.set_halign(Gtk.Align.CENTER);
    this.widget.set_valign(Gtk.Align.CENTER);
    this.widget.set_child(this.bar);
    this.barProgress = new Gtk.ProgressBar();
    this.barProgress.add_css_class("ws-bar-progress");
    this.barProgress.set_show_text(false);
    this.barProgress.set_valign(Gtk.Align.END);
    this.barProgress.set_halign(Gtk.Align.FILL);
    this.barProgress.set_visible(false);
    this.widget.add_overlay(this.barProgress);
  }

  update(model: ControlBarModel): void {
    this.name.set_label(model.name);
    this.stateText.set_label(model.stateText);
    this.stateDot.set_visible(model.live && !model.committing);
    if (model.committing) {
      this.statePill.set_css_classes(["ws-state-pill", "setting"]);
    } else if (model.live) {
      this.statePill.set_css_classes(["ws-state-pill", "live"]);
    } else {
      this.statePill.set_css_classes(["ws-state-pill"]);
    }

    this.meta.set_label(model.meta);
    if (model.step) this.meta.add_css_class("is-step");
    else this.meta.remove_css_class("is-step");
    if (model.error) this.meta.add_css_class("is-error");
    else this.meta.remove_css_class("is-error");

    let child = this.swatches.get_first_child();
    while (child !== null) {
      const next = child.get_next_sibling();
      this.swatches.remove(child);
      child = next;
    }
    for (const color of model.swatches) this.swatches.append(swatch(color));

    this.lookName.set_label(model.lookName);
    this.looks.update(model.looks);

    this.setButton.set_sensitive(model.setEnabled);
    this.gear.set_sensitive(!model.committing);
    this.setLabel.set_label(model.setText);
    this.setKeycap.set_visible(model.setEnabled);
    if (model.live) this.setButton.add_css_class("is-live");
    else this.setButton.remove_css_class("is-live");
    if (model.committing) this.setButton.add_css_class("is-committing");
    else this.setButton.remove_css_class("is-committing");

    const progress = Math.max(0, Math.min(1, model.progress));
    this.setProgress.set_fraction(progress);
    this.setProgress.set_visible(model.committing);
    this.barProgress.set_fraction(progress);
    this.barProgress.set_visible(model.committing);
  }

  /**
   * Responsive safety (REQ-005 §5.8); GTK CSS has no media queries, so the
   * width rules are explicit: <1180 hides the hints, <980 hides the looks zone.
   */
  setResponsive(width: number): void {
    this.hints.set_visible(width >= 1180);
    this.middle.set_visible(width >= 980);
  }

  /** Focus the commit action (documented tab order starts here). */
  focusSet(): void {
    this.setButton.grab_focus();
  }
}
