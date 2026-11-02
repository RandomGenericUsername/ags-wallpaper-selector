// Regression gate for BUG-002: the runtime's deleted contrast surface must
// not come back in the selector.
//
// Runtime v0.5.1 (REQ-007) removed the guard, its set/regenerate flags, the
// preferences accessor and the per-wallpaper store. The selector's apply path
// must be exactly `dotfiles-runtime wallpaper set <image>`, and the sheet must
// use palette.v1 roles only. The forbidden tokens are assembled from pieces so
// this test itself stays clean under the repo-wide absence grep.
//
// Run with: node --test tests/no-contrast-surface.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PALETTE_V1_ROLES } from "ags-platform/ports/palette";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REMOVED = [
  ["icons", "preference"].join(" "),
  ["--", "contrast"].join(""),
  ["icon", "contrast"].join("-"),
  ["regenerate", "Icons"].join(""),
];

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const REMOVED_RE = new RegExp(REMOVED.map(escapeRegExp).join("|"));

function walk(dir = ROOT) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      [".git", "node_modules", "@girs", ".dev", ".worktrees", "build", "dist"].includes(entry.name)
    ) {
      continue;
    }
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile()) files.push(relative(ROOT, absolute).split("\\").join("/"));
  }
  return files;
}

function readText(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

test("the contrast client module is gone", () => {
  assert.equal(existsSync(join(ROOT, "lib", "contrast.ts")), false);
});

test("no source file calls the removed contrast surface", () => {
  const sources = walk().filter((file) => /\.(ts|tsx|css)$/.test(file));
  assert.ok(sources.includes("style.css"));
  for (const file of sources) {
    const text = readText(file);
    assert.doesNotMatch(text, REMOVED_RE, `${file} references a removed runtime command/flag`);
  }
});

test("apply runs exactly wallpaper set <image>", () => {
  const apply = readText("lib", "apply.ts");
  assert.match(
    apply,
    /return execAsync\(\["dotfiles-runtime", "wallpaper", "set", imagePath\]\);/,
  );
  assert.doesNotMatch(apply, /args\.push|contrast\?:/);
});

test("the window has no contrast control or state wiring", () => {
  const window = readText("ui", "WallpaperSelectorWindow.tsx");
  for (const gone of [
    "ws-contrast",
    "Auto high-contrast icons",
    "onSwatchToggled",
    "onContrastToggled",
    "contrastPrefs",
    "pendingContrast",
    "deferredRegenerate",
  ]) {
    assert.equal(window.includes(gone), false, `window still carries ${gone}`);
  }
});

test("the stylesheet uses palette.v1 roles, never legacy color aliases", () => {
  const css = readText("style.css");
  assert.doesNotMatch(css, /@color_/);
  const roles = new Set(PALETTE_V1_ROLES);
  for (const match of css.matchAll(/@([a-z][a-z0-9_]*)/g)) {
    const token = match[1];
    assert.ok(roles.has(token), `style.css references undeclared role @${token}`);
  }
});
