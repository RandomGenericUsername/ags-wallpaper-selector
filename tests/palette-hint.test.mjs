// Pure palette-hint quantizer (REQ-005 §8.4). Node only, no GTK.
//
// Run with: node --test tests/palette-hint.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { quantizePalette } from "../lib/palette-hint.ts";

function pixels(colors, repeat = 1) {
  const out = [];
  for (const [r, g, b, a = 255] of colors) {
    for (let index = 0; index < repeat; index += 1) out.push(r, g, b, a);
  }
  return out;
}

test("empty or short input renders no dots", () => {
  assert.deepEqual(quantizePalette([]), []);
  assert.deepEqual(quantizePalette([1, 2, 3]), []);
});

test("deterministic and most common first", () => {
  const input = pixels(
    [
      [200, 20, 25],
      [200, 20, 25],
      [200, 20, 25],
      [10, 200, 40],
      [10, 200, 40],
      [20, 100, 220],
    ],
    1,
  );
  const first = quantizePalette(input, { minDistance: 10 });
  const second = quantizePalette(input, { minDistance: 10 });
  assert.deepEqual(first, second);
  assert.equal(first[0], "#c81419");
  assert.ok(first.length >= 2);
});

test("transparent pixels are skipped", () => {
  const input = pixels([
    [255, 0, 0, 0],
    [0, 128, 0, 255],
  ]);
  assert.deepEqual(quantizePalette(input, { count: 5 }), ["#008000"]);
});

test("at most `count` swatches, each a lowercase hex colour", () => {
  const input = pixels([
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [255, 0, 255],
    [0, 255, 255],
    [128, 128, 128],
  ]);
  const colors = quantizePalette(input, { count: 5, minDistance: 0 });
  assert.equal(colors.length, 5);
  for (const color of colors) assert.match(color, /^#[0-9a-f]{6}$/);
  assert.equal(new Set(colors).size, 5);
});

test("minDistance collapses near-identical buckets", () => {
  const input = pixels([
    [120, 120, 120],
    [122, 121, 119],
    [121, 119, 120],
    [10, 200, 40],
  ]);
  const collapsed = quantizePalette(input, { count: 5, minDistance: 60 });
  assert.equal(collapsed.length, 2);
});

test("count is clamped to a useful range", () => {
  const input = pixels([
    [255, 0, 0],
    [0, 255, 0],
  ]);
  assert.equal(quantizePalette(input, { count: 0 }).length, 1);
  assert.ok(quantizePalette(input, { count: 999 }).length <= 16);
});
