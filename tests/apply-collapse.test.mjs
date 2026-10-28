// Regression gate for BUG-002: the Apply CLICK must collapse the selector.
//
// The window is a `.tsx` importing `ags/gtk4` + `gi://*`, so plain `node` cannot
// construct it. This gate therefore pins the WIRING, labelled as a source-text
// assertion (same posture as capture-tool's source acceptance checks): the
// timing contract is "hideWindow() runs synchronously in doApply, after the
// busy guard and before the first await", and no other code path (notably the
// `wallpaper.state → visible` handler) hides the drawer.
//
// RED before the fix (49adc30): doApply had no hideWindow() call at all — the
// drawer was hidden by the `visible` branch (line 811) and by the success
// `finally` (line 776), i.e. two calls, both after awaits / event arrival.
// GREEN after the fix: exactly one call, before the first await.
//
// Run with: node wallpaper-selector/tests/apply-collapse.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const WINDOW = fileURLToPath(
  new URL("../ui/WallpaperSelectorWindow.tsx", import.meta.url),
);

/** Strip line/block comments, keeping strings intact (a `//` inside a URL or
 * template literal must not truncate the file). */
function stripComments(source) {
  let out = "";
  let state = null;
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (state === "line") {
      if (c === "\n") {
        state = null;
        out += c;
      }
      i += 1;
      continue;
    }
    if (state === "block") {
      if (c === "*" && next === "/") {
        state = null;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }
    if (state === "'" || state === '"' || state === "`") {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === state) state = null;
      i += 1;
      continue;
    }
    if (c === "/" && next === "/") {
      state = "line";
      i += 2;
      continue;
    }
    if (c === "/" && next === "*") {
      state = "block";
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      state = c;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** Body of the named function, found by its signature and matched braces. */
function bodyOf(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `source is missing ${signature}`);
  const open = source.indexOf("{", start);
  assert.notEqual(open, -1, `${signature} has no body`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  assert.fail(`${signature} body is not closed`);
}

/** Calls only — `function hideWindow(): void` is a declaration, not a call
 * (the negative lookahead drops the `: <type>` that follows the declaration). */
function hideCalls(text) {
  return [...text.matchAll(/\bhideWindow\(\)(?!\s*:)/g)];
}

const source = stripComments(readFileSync(WINDOW, "utf8"));

test("doApply hides the drawer on the click, before the first await", () => {
  const doApply = bodyOf(source, "async function doApply(");
  const calls = hideCalls(doApply);
  assert.equal(
    calls.length,
    1,
    "doApply must contain exactly one hideWindow() call (the Apply-click contract)",
  );

  const guard = doApply.indexOf("if (localApply || eventBusy) return;");
  assert.notEqual(guard, -1, "doApply must keep the busy guard");
  assert.ok(
    guard < calls[0].index,
    "hideWindow() must run after the busy guard so a rejected click never closes the drawer",
  );

  const firstAwait = doApply.indexOf("await ");
  assert.notEqual(firstAwait, -1, "doApply must still await the apply pipeline");
  assert.ok(
    calls[0].index < firstAwait,
    "hideWindow() must run BEFORE the first await: the collapse happens on the click, not when the async work resolves",
  );
});

test("the wallpaper event path never hides the drawer", () => {
  const event = bodyOf(source, "function onWallpaperEvent(");
  assert.ok(
    event.includes('state === "visible"'),
    "the `visible` branch must still exist (only its hide is gone)",
  );
  assert.equal(
    hideCalls(event).length,
    0,
    "no hide on `visible`/`done`/`error`: an external set must never dismiss the window, and a reopened selector must survive a late completion",
  );
});

test("hideWindow has exactly one call site in the window", () => {
  assert.equal(
    hideCalls(source).length,
    1,
    "the Apply click is the contract — no extra hide in a finally/event branch",
  );
});
