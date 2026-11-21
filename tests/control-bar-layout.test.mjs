// Control-bar layout gate (REQ-005 §5.4/D4/D14).
//
// The bar is one three-zone CenterBox: info / looks / actions. The accent is
// a state colour (Set, selected look, focus, progress), never a frame around
// the bar or the wallpaper. Targets are 40-44 px (arrows are the one 62 px
// navigation exception). This is a source-text gate labelled as such.
//
// Run with: node --test tests/control-bar-layout.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CSS = readFileSync(new URL("../style.css", import.meta.url), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);
const BAR = readFileSync(new URL("../ui/ControlBar.tsx", import.meta.url), "utf8");
const OVERLAY = readFileSync(new URL("../ui/OverlayWindow.tsx", import.meta.url), "utf8");

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function declarations(selector) {
  const match = CSS.match(
    new RegExp(`(?:^|\\n)\\s*${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, "m"),
  );
  assert.ok(match, `${selector} rule is missing from style.css`);
  const decls = new Map();
  for (const chunk of match[1].split(";")) {
    const colon = chunk.indexOf(":");
    if (colon === -1) continue;
    const property = chunk.slice(0, colon).trim();
    const value = chunk.slice(colon + 1).trim();
    if (property) decls.set(property, value);
  }
  return decls;
}

const px = (value) => Number.parseFloat(value);

function allRules() {
  return [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim(),
    body: match[2],
  }));
}

test("the control bar is a three-zone CenterBox", () => {
  assert.match(BAR, /new Gtk\.CenterBox\(\)/);
  assert.match(BAR, /set_start_widget\(left\)/);
  assert.match(BAR, /set_center_widget\(middle\)/);
  assert.match(BAR, /set_end_widget\(right\)/);
  // Order is info / looks / actions.
  assert.ok(BAR.indexOf("const left") < BAR.indexOf("const middle"));
  assert.ok(BAR.indexOf("const middle") < BAR.indexOf("const right"));
});

test("the bar is a 20 px glass surface with a hairline, never an accent frame", () => {
  const bar = declarations(".ws-control-bar");
  assert.equal(px(bar.get("border-radius")), 20);
  const border = bar.get("border");
  assert.match(border, /rgba\(255, 255, 255/);
  assert.doesNotMatch(border, /@primary|@secondary|@tertiary/);
  assert.match(bar.get("background-color"), /alpha\(@surface/);
  assert.match(bar.get("box-shadow"), /rgba\(0, 0, 0/);
});

test("accent is a state colour, not a surface outline", () => {
  const accentRules = allRules().filter((rule) =>
    /@primary\b/.test(rule.body),
  );
  assert.ok(accentRules.length > 0, "Set and the selected look need accent");
  for (const rule of accentRules) {
    assert.doesNotMatch(
      rule.selector,
      /^(window|\.ws-control-bar|\.ws-main|\.ws-stage|\.ws-grid)$/,
      `accent on surface ${rule.selector} would be a frame`,
    );
  }
});

test("pointer targets match the frozen sizes", () => {
  assert.equal(px(declarations(".ws-nav").get("min-width")), 62);
  assert.equal(px(declarations(".ws-nav").get("min-height")), 62);
  assert.equal(px(declarations(".ws-gear").get("min-width")), 42);
  assert.equal(px(declarations(".ws-gear").get("min-height")), 42);
  assert.equal(px(declarations(".ws-set").get("min-height")), 42);
  assert.equal(px(declarations(".ws-look").get("min-width")), 54);
  assert.equal(px(declarations(".ws-look").get("min-height")), 34);
});

test("the looks strip is Original + chips with a live dot the app owns", () => {
  assert.match(BAR, /new LooksStrip\(options\.onLookSelect\)/);
  const looks = readFileSync(new URL("../ui/LooksStrip.tsx", import.meta.url), "utf8");
  assert.match(looks, /name: "Original"/);
  assert.match(looks, /No looks yet — generated on first set\./);
  assert.match(looks, /ws-look-live-dot/);
  assert.match(looks, /index === model\.lookIndex/);
});

test("the commit action and the gear are the right zone and order", () => {
  assert.match(BAR, /const actions = new Gtk\.Box/);
  assert.ok(BAR.indexOf("actions.append(gear)") < BAR.indexOf("actions.append(this.setButton)"));
  assert.match(BAR, /new Gtk\.MenuButton\(\)/);
  assert.match(BAR, /set_popover\(options\.gearPopover\)/);
});

test("the bar offers no click-to-apply on the wallpaper stage", () => {
  assert.doesNotMatch(OVERLAY, /stage\.widget\.(add_controller|connect\()/);
  assert.doesNotMatch(OVERLAY, /mainPage\.set_child\([^)]*\)[\s\S]{0,200}GestureClick/);
  assert.match(OVERLAY, /mainPage\.set_child\(stage\.widget\)/);
});

test("every icon-only button has an accessible name", () => {
  const contact = readFileSync(new URL("../ui/ContactSheet.tsx", import.meta.url), "utf8");
  const looks = readFileSync(new URL("../ui/LooksStrip.tsx", import.meta.url), "utf8");
  const settings = readFileSync(
    new URL("../ui/SettingsPopover.tsx", import.meta.url),
    "utf8",
  );
  for (const [source, label] of [
    [OVERLAY, "Previous wallpaper"],
    [OVERLAY, "Next wallpaper"],
    [BAR, "Placement settings"],
    [contact, "Close grid"],
    [settings, "Decrease top offset"],
    [settings, "Increase top offset"],
  ]) {
    assert.ok(
      source.includes(`["${label}"]`) &&
        source.includes("Gtk.AccessibleProperty.LABEL"),
      `missing accessible name: ${label}`,
    );
  }
  assert.match(looks, /update_property\(\[Gtk\.AccessibleProperty\.LABEL\], \[choice\.name\]\)/);
});

test("the responsive rules are explicit (no CSS media queries in GTK)", () => {
  const bar = readFileSync(new URL("../ui/ControlBar.tsx", import.meta.url), "utf8");
  assert.match(bar, /setResponsive\(width: number\)/);
  assert.match(bar, /width >= 1180/);
  assert.match(bar, /width >= 980/);
});
