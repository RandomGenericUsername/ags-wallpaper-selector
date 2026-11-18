// Pure placement math (REQ-005 §7.3/§7.4). Node only.
//
// Run with: node --test tests/placement.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOTTOM_INSET,
  TOP_FLOAT_GAP,
  controlBarPlacement,
  previewGeometry,
} from "../domain/placement.ts";

test("bottom is a fixed 30 px inset and ignores the offset", () => {
  const placement = controlBarPlacement("bottom", 48, 90);
  assert.equal(placement.edge, "bottom");
  assert.equal(placement.marginBottom, BOTTOM_INSET);
  assert.equal(placement.marginTop, 0);
  assert.equal(placement.valign, "end");
  assert.equal(placement.offsetApplied, false);
});

test("top is reserved + 14 + offset", () => {
  const placement = controlBarPlacement("top", 48, 20);
  assert.equal(placement.edge, "top");
  assert.equal(placement.marginTop, 48 + TOP_FLOAT_GAP + 20);
  assert.equal(placement.marginBottom, 0);
  assert.equal(placement.valign, "start");
  assert.equal(placement.offsetApplied, true);
  assert.equal(TOP_FLOAT_GAP, 14);
});

test("top with no reserved zone still floats 14 px plus the offset", () => {
  assert.equal(controlBarPlacement("top", 0, 0).marginTop, 14);
  assert.equal(controlBarPlacement("top", 0, 6).marginTop, 20);
});

test("reserved/offset are never negative and never NaN", () => {
  assert.equal(controlBarPlacement("top", -20, 0).marginTop, 14);
  assert.equal(controlBarPlacement("top", 48, -99).marginTop, 62);
  assert.equal(controlBarPlacement("top", Number.NaN, Number.NaN).marginTop, 14);
  assert.equal(controlBarPlacement("top", 12.9, 4.9).marginTop, 30);
});

test("keep_visible leaves the reserved strip uncovered; false covers it", () => {
  assert.deepEqual(previewGeometry(true, 48), {
    marginTop: 48,
    reservedStripVisible: true,
  });
  assert.deepEqual(previewGeometry(false, 48), {
    marginTop: 0,
    reservedStripVisible: false,
  });
});

test("preview geometry treats an unknown/negative reserved zone as 0", () => {
  assert.equal(previewGeometry(true, 0).marginTop, 0);
  assert.equal(previewGeometry(true, -10).marginTop, 0);
  assert.equal(previewGeometry(true, Number.NaN).marginTop, 0);
});
