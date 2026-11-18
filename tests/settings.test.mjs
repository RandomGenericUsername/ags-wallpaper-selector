// Pure settings contract (REQ-005 §7.1/§7.6). Node only: no GTK, no I/O.
//
// Run with: node --test tests/settings.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampOffsetPx,
  defaultSettings,
  mergeSettings,
  settingsToJson,
  validateSettings,
} from "../domain/settings.ts";

test("defaults are the frozen bottom / offset 0 / keep-visible values", () => {
  assert.deepEqual(defaultSettings(), {
    control_bar: { position: "bottom", offsetPx: 0 },
    desktop_bar: { keep_visible: true },
  });
});

test("defaults are a fresh deep copy", () => {
  const a = defaultSettings();
  a.control_bar.position = "top";
  assert.equal(defaultSettings().control_bar.position, "bottom");
});

test("missing and non-object input degrades to defaults", () => {
  assert.deepEqual(mergeSettings(undefined), defaultSettings());
  assert.deepEqual(mergeSettings(null), defaultSettings());
  assert.deepEqual(mergeSettings("nonsense"), defaultSettings());
  assert.deepEqual(mergeSettings([]), defaultSettings());
});

test("merge is per key: one invalid value does not discard the others", () => {
  const merged = mergeSettings({
    control_bar: { position: "sideways", offsetPx: 42 },
    desktop_bar: { keep_visible: false },
  });
  assert.deepEqual(merged, {
    control_bar: { position: "bottom", offsetPx: 42 },
    desktop_bar: { keep_visible: false },
  });
});

test("offset is finite, integral and clamped to 0..2000", () => {
  assert.equal(clampOffsetPx(12.9), 12);
  assert.equal(clampOffsetPx(-4), 0);
  assert.equal(clampOffsetPx(99_999), 2000);
  assert.equal(clampOffsetPx(Number.NaN), 0);
  assert.equal(clampOffsetPx(Number.POSITIVE_INFINITY), 0);
  assert.equal(clampOffsetPx("12"), 0);
  assert.equal(clampOffsetPx(true), 0);
});

test("unknown keys and wrong shapes are ignored", () => {
  const merged = mergeSettings({
    control_bar: { position: "top", offsetPx: 8, mystery: true },
    desktop_bar: { keep_visible: "yes" },
    extra: { nope: 1 },
  });
  assert.deepEqual(merged, {
    control_bar: { position: "top", offsetPx: 8 },
    desktop_bar: { keep_visible: true },
  });
});

test("validation accepts the canonical shape and rejects bad values", () => {
  assert.equal(validateSettings(defaultSettings()), null);
  const badPosition = defaultSettings();
  badPosition.control_bar.position = "middle";
  assert.match(validateSettings(badPosition), /position/);
  const badOffset = defaultSettings();
  badOffset.control_bar.offsetPx = 1.5;
  assert.match(validateSettings(badOffset), /whole number/);
  const huge = defaultSettings();
  huge.control_bar.offsetPx = 2001;
  assert.match(validateSettings(huge), /between/);
  const badBool = defaultSettings();
  badBool.desktop_bar.keep_visible = 1;
  assert.match(validateSettings(badBool), /boolean/);
});

test("serialization is pretty JSON with exactly one trailing newline", () => {
  const json = settingsToJson({
    control_bar: { position: "top", offsetPx: 14 },
    desktop_bar: { keep_visible: false },
  });
  assert.equal(
    json,
    `{
  "control_bar": {
    "position": "top",
    "offsetPx": 14
  },
  "desktop_bar": {
    "keep_visible": false
  }
}
`,
  );
  assert.ok(json.endsWith("}\n"));
  assert.equal(json.endsWith("\n\n"), false);
});
