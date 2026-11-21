// ---------------------------------------------------------------------------
// Settings popover (REQ-005 §5.5/§7.5).
//
// The capture-tool grammar in miniature: grouped rows, segmented pills, a
// stepper, and save-on-change (no Save button). The view owns no persistence:
// `onChange` is the window's "persist + re-apply placement" seam.
// ---------------------------------------------------------------------------

import { Gtk } from "ags/gtk4";
import {
  OFFSET_MAX,
  OFFSET_MIN,
  type ControlBarPosition,
  type WallpaperSelectorSettings,
} from "../domain/settings";

export interface SettingsPopoverOptions {
  initial: WallpaperSelectorSettings;
  onChange(settings: WallpaperSelectorSettings): string | null;
}

interface Segmented {
  widget: Gtk.Box;
  buttons: Map<string, Gtk.Button>;
}

function label(text: string, cssClass: string): Gtk.Label {
  const widget = new Gtk.Label({ label: text, xalign: 0 });
  widget.add_css_class(cssClass);
  return widget;
}

function row(title: string, description: string | null, control: Gtk.Widget): Gtk.Box {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 16 });
  box.add_css_class("ws-settings-row");
  const text = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 });
  text.set_hexpand(true);
  text.append(label(title, "ws-settings-label"));
  if (description !== null) {
    text.append(label(description, "ws-settings-desc"));
  }
  box.append(text);
  control.set_halign(Gtk.Align.END);
  control.set_valign(Gtk.Align.CENTER);
  box.append(control);
  return box;
}

function segmented(
  values: Array<{ label: string; value: string }>,
  selected: string,
  onPick: (value: string) => void,
): Segmented {
  const widget = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 2 });
  widget.add_css_class("ws-seg");
  const buttons = new Map<string, Gtk.Button>();
  for (const item of values) {
    const button = new Gtk.Button({ label: item.label });
    button.add_css_class("ws-seg-button");
    button.set_size_request(64, 28);
    if (item.value === selected) button.add_css_class("selected");
    button.connect("clicked", () => onPick(item.value));
    buttons.set(item.value, button);
    widget.append(button);
  }
  return { widget, buttons };
}

export class SettingsPopover {
  private current: Gtk.Popover | null = null;
  private readonly content: Gtk.Box;
  private readonly openListeners: Array<(open: boolean) => void> = [];
  private readonly offsetRow: Gtk.Box;
  private readonly offsetValue: Gtk.Label;
  private readonly minus: Gtk.Button;
  private readonly plus: Gtk.Button;
  private readonly position: Segmented;
  private readonly desktop: Segmented;
  private readonly errorLabel: Gtk.Label;
  private settings: WallpaperSelectorSettings;
  private readonly onChange: SettingsPopoverOptions["onChange"];

  constructor(options: SettingsPopoverOptions) {
    this.settings = options.initial;
    this.onChange = options.onChange;

    const content = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 0,
    });
    content.add_css_class("ws-settings");

    const head = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
    head.add_css_class("ws-settings-head");
    const title = label("Settings", "ws-settings-title");
    title.set_hexpand(true);
    head.append(title);
    head.append(label("Placement", "ws-settings-sub"));
    content.append(head);

    this.position = segmented(
      [
        { label: "Bottom", value: "bottom" },
        { label: "Top", value: "top" },
      ],
      this.settings.control_bar.position,
      (value) => {
        this.apply({
          ...this.settings,
          control_bar: {
            ...this.settings.control_bar,
            position: value as ControlBarPosition,
          },
        });
      },
    );
    const positionRow = row("Control bar", null, this.position.widget);
    positionRow.add_css_class("first");
    content.append(positionRow);

    this.desktop = segmented(
      [
        { label: "Show", value: "show" },
        { label: "Hide", value: "hide" },
      ],
      this.settings.desktop_bar.keep_visible ? "show" : "hide",
      (value) => {
        this.apply({
          ...this.settings,
          desktop_bar: { keep_visible: value === "show" },
        });
      },
    );
    content.append(
      row("Desktop bar", "Keep it visible while previewing", this.desktop.widget),
    );

    const stepper = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 5 });
    stepper.add_css_class("ws-stepper");
    this.minus = new Gtk.Button({ label: "−" });
    this.minus.add_css_class("ws-stepper-button");
    this.minus.set_tooltip_text("Decrease top offset");
    this.minus.update_property(
      [Gtk.AccessibleProperty.LABEL],
      ["Decrease top offset"],
    );
    this.minus.connect("clicked", () => this.step(-1));
    this.offsetValue = new Gtk.Label({
      label: String(this.settings.control_bar.offsetPx),
      width_chars: 3,
    });
    this.offsetValue.add_css_class("ws-stepper-value");
    this.offsetValue.set_xalign(0.5);
    this.plus = new Gtk.Button({ label: "+" });
    this.plus.add_css_class("ws-stepper-button");
    this.plus.set_tooltip_text("Increase top offset");
    this.plus.update_property(
      [Gtk.AccessibleProperty.LABEL],
      ["Increase top offset"],
    );
    this.plus.connect("clicked", () => this.step(1));
    stepper.append(this.minus);
    stepper.append(this.offsetValue);
    stepper.append(this.plus);
    this.offsetRow = row(
      "Top offset",
      "Extra px below the reserved zone",
      stepper,
    );
    content.append(this.offsetRow);

    this.errorLabel = label("", "ws-settings-error");
    this.errorLabel.set_visible(false);
    content.append(this.errorLabel);

    const footer = label("Changes save immediately.", "ws-settings-foot");
    content.append(footer);

    this.content = content;
    this.sync();
  }

  /** Create and pop a fresh popover anchored to the whole gear button (the
   * sound-panel pattern); reuse leaves a stale surface/grab that swallows the
   * next same-spot click. */
  toggle(anchor: Gtk.Widget): void {
    if (this.isOpen()) {
      this.close();
      return;
    }
    if (this.current !== null) {
      this.current.set_child(null);
      this.current.unparent();
      this.current = null;
    }
    const popover = new Gtk.Popover();
    popover.add_css_class("ws-settings-popover");
    popover.set_has_arrow(false);
    popover.set_child(this.content);
    popover.set_parent(anchor);
    popover.connect("closed", () => {
      popover.set_child(null);
      popover.unparent();
      if (this.current === popover) this.current = null;
      this.notifyOpen(false);
    });
    this.current = popover;
    popover.popup();
    this.notifyOpen(true);
  }

  close(): void {
    this.current?.popdown();
  }

  isOpen(): boolean {
    return this.current !== null && this.current.get_visible();
  }

  onOpenChange(listener: (open: boolean) => void): void {
    this.openListeners.push(listener);
  }

  private notifyOpen(open: boolean): void {
    for (const listener of this.openListeners) listener(open);
  }

  /** Replace the view from the persisted settings (e.g. after a failed save). */
  update(settings: WallpaperSelectorSettings): void {
    this.settings = settings;
    this.sync();
  }

  private step(delta: number): void {
    if (this.settings.control_bar.position !== "top") return;
    const next = Math.min(
      OFFSET_MAX,
      Math.max(OFFSET_MIN, this.settings.control_bar.offsetPx + delta),
    );
    this.apply({
      ...this.settings,
      control_bar: { ...this.settings.control_bar, offsetPx: next },
    });
  }

  private apply(settings: WallpaperSelectorSettings): void {
    this.settings = settings;
    const error = this.onChange(settings);
    this.sync();
    this.errorLabel.set_label(error ?? "");
    this.errorLabel.set_visible(error !== null);
  }

  private sync(): void {
    const setSelected = (group: Segmented, value: string): void => {
      for (const [key, button] of group.buttons) {
        if (key === value) button.add_css_class("selected");
        else button.remove_css_class("selected");
      }
    };
    setSelected(this.position, this.settings.control_bar.position);
    setSelected(
      this.desktop,
      this.settings.desktop_bar.keep_visible ? "show" : "hide",
    );
    this.offsetValue.set_label(String(this.settings.control_bar.offsetPx));
    const enabled = this.settings.control_bar.position === "top";
    this.offsetRow.set_sensitive(enabled);
    this.offsetRow.set_opacity(enabled ? 1 : 0.36);
    this.minus.set_sensitive(enabled);
    this.plus.set_sensitive(enabled);
  }
}
