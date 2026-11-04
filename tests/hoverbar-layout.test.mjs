// Regression gate for BUG-003: the L1 hover toolbar must wrap the Apply pill
// with one even inset.
//
// `.ws-hoverbar` is the dark rounded container and `.ws-quick` is its only
// child ("Apply"). BUG-003 came from both rules carrying
// `margin: 0 6px 6px 0`: the button sat flush on the left/top but 6px inside
// the container on the right/bottom, so the pill looked offset inside its own
// slab. The corrected contract is:
//
//   * the button has no margin of its own;
//   * the container pads the pill by the same amount on all four sides;
//   * the container keeps exactly one offset from the thumbnail edge
//     (its right/bottom margin, with left/top at 0).
//
// Run with: node --test tests/hoverbar-layout.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CSS = readFileSync(
  fileURLToPath(new URL("../style.css", import.meta.url)),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Declarations of the rule whose selector is exactly `selector`. */
function declarations(selector) {
  const re = new RegExp(
    `(?:^|\\n)\\s*${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`,
    "m",
  );
  const match = CSS.match(re);
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

function px(value) {
  const parsed = Number.parseFloat(value);
  assert.ok(Number.isFinite(parsed), `not a length: ${value}`);
  return parsed;
}

/** The four sides of a box property, honouring longhand overrides. */
function box(decls, property) {
  const sides = { ...ZERO };
  if (decls.has(property)) {
    const [top, right = top, bottom = top, left = right] = decls
      .get(property)
      .split(/\s+/);
    Object.assign(sides, {
      top: px(top),
      right: px(right),
      bottom: px(bottom),
      left: px(left),
    });
  }
  for (const side of ["top", "right", "bottom", "left"]) {
    const longhand = `${property}-${side}`;
    if (decls.has(longhand)) sides[side] = px(decls.get(longhand));
  }
  return sides;
}

test("the Apply pill carries no margin of its own inside the hoverbar", () => {
  const button = declarations(".ws-quick");
  assert.deepEqual(
    box(button, "margin"),
    ZERO,
    "the hoverbar owns the inner spacing; the button must not add a second offset",
  );
});

test("the hoverbar pads the Apply pill symmetrically on all four sides", () => {
  const padding = box(declarations(".ws-hoverbar"), "padding");
  assert.ok(padding.top > 0, "the hoverbar needs its own inner padding");
  assert.equal(padding.top, padding.bottom, "vertical padding must match");
  assert.equal(padding.left, padding.right, "horizontal padding must match");
  assert.equal(padding.top, padding.left, "padding must be even on every side");
});

test("the hoverbar keeps exactly one offset from the thumbnail edge", () => {
  const margin = box(declarations(".ws-hoverbar"), "margin");
  assert.equal(margin.top, 0, "no extra offset at the top");
  assert.equal(margin.left, 0, "no extra offset at the left");
  assert.equal(margin.right, margin.bottom, "the corner offset must be square");
  assert.ok(margin.right > 0, "the bar still floats clear of the thumbnail edge");
});
