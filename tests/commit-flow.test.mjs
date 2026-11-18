// Commit-flow gate (REQ-005 D7/D9/§4.3/§6.4).
//
// Browse never writes. Set/Enter is the only commit; the overlay stays open
// through the three `wallpaper.state` steps, holds after `done`, and a failure
// keeps the preview. Esc hides without applying.
//
// The window is a `.tsx` importing `ags/gtk4` + `gi://*`, so Node cannot
// construct it; this gate pins the WIRING as a labelled source-text
// assertion, alongside the executable state-machine tests.
//
// Run with: node --test tests/commit-flow.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(
  new URL("../ui/OverlayWindow.tsx", import.meta.url),
  "utf8",
);

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
    if (c === "'" || c === '"' || c === "`") state = c;
    out += c;
    i += 1;
  }
  return out;
}

const CLEAN = stripComments(SOURCE);

function bodyOf(signature) {
  const start = CLEAN.indexOf(signature);
  assert.notEqual(start, -1, `source is missing ${signature}`);
  const open = CLEAN.indexOf("{", start);
  assert.notEqual(open, -1, `${signature} has no body`);
  let depth = 0;
  for (let i = open; i < CLEAN.length; i += 1) {
    if (CLEAN[i] === "{") depth += 1;
    else if (CLEAN[i] === "}") {
      depth -= 1;
      if (depth === 0) return CLEAN.slice(open + 1, i);
    }
  }
  assert.fail(`${signature} body is not closed`);
}

function calls(text, name) {
  return [...text.matchAll(new RegExp(`\\b${name}\\(`, "g"))];
}

function hideCalls(text) {
  return calls(text, "hideWindow");
}

test("there is exactly one applyWallpaper call, inside commit()", () => {
  const all = calls(CLEAN, "applyWallpaper");
  assert.equal(all.length, 1, "browse must not apply; one commit call only");
  const commit = bodyOf("function commit(");
  assert.equal(calls(commit, "applyWallpaper").length, 1);
});

test("navigation, looks, grid and rescan never write", () => {
  for (const signature of [
    "function navigate(",
    "function selectLookFromKey(",
    "function showGrid(",
    "function hideGrid(",
    "function rescan(",
    "function onWallpaperEvent(",
  ]) {
    const body = bodyOf(signature);
    assert.equal(
      calls(body, "applyWallpaper").length,
      0,
      `${signature} must not write while browsing`,
    );
  }
});

test("Set and Enter are the only commit entry points", () => {
  assert.match(CLEAN, /onSet: \(\) => commit\(\)/);
  assert.match(
    CLEAN,
    /keyval === Gdk\.KEY_Return \|\| keyval === Gdk\.KEY_KP_Enter[\s\S]{0,120}commit\(\)/,
  );
  // Commit is guarded by the state machine: live focus and committing are no-ops.
  const commit = bodyOf("function commit(");
  assert.match(commit, /state\.phase === "committing"/);
  assert.match(commit, /isLiveFocus\(state\)/);
  assert.match(commit, /beginCommit\(state\)/);
});

test("the overlay does not hide on the Set click or on visible", () => {
  assert.equal(
    hideCalls(bodyOf("function commit(")).length,
    0,
    "the commit stays open; hiding happens after done",
  );
  const event = bodyOf("function onWallpaperEvent(");
  assert.equal(hideCalls(event).length, 0);
  assert.match(event, /value === "visible"/);
  assert.match(event, /value === "done"/);
});

test("done holds ~1.2 s and only then hides", () => {
  const done = bodyOf("function done(");
  assert.match(done, /COMMIT_HOLD_MS/);
  assert.match(done, /hideWindow\(\)/);
  assert.match(done, /if \(state\.phase !== "committing"\) hideWindow\(\)/);
  assert.ok(
    done.indexOf("COMMIT_HOLD_MS") < done.indexOf("hideWindow()"),
    "the hide is inside the hold timer, after done",
  );
  assert.match(CLEAN, /const COMMIT_HOLD_MS = 1_200;/);
});

test("a failure keeps the preview and never marks live", () => {
  const fail = bodyOf("function fail(");
  assert.match(fail, /failCommit\(state, message\)/);
  assert.match(fail, /render\(false\)/);
  assert.doesNotMatch(fail, /finishCommit|hideWindow/);
  const event = bodyOf("function onWallpaperEvent(");
  assert.match(event, /value === "error"[\s\S]{0,120}fail\(/);
});

test("Esc cancels without applying and is ignored while committing", () => {
  const escape = bodyOf("function escapePressed(");
  assert.match(escape, /state\.phase === "committing"[\s\S]{0,40}return true/);
  assert.equal(calls(escape, "applyWallpaper").length, 0);
  const cancel = bodyOf("function cancel(");
  assert.match(cancel, /cancelOverlay\(state\)/);
  assert.match(cancel, /hideWindow\(\)/);
  assert.equal(calls(cancel, "applyWallpaper").length, 0);
});

test("navigation is locked during the commit", () => {
  const navigate = bodyOf("function navigate(");
  assert.match(navigate, /state\.phase === "committing"[\s\S]{0,40}return/);
  const looks = bodyOf("function selectLookFromKey(");
  assert.match(looks, /state\.phase === "committing"[\s\S]{0,40}return/);
  assert.match(CLEAN, /previous\.set_sensitive\(state\.phase !== "committing"\)/);
  assert.match(CLEAN, /next\.set_sensitive\(state\.phase !== "committing"\)/);
});

test("a 30 s timeout fails the commit instead of hanging", () => {
  assert.match(CLEAN, /const COMMIT_TIMEOUT_MS = 30_000;/);
  const commit = bodyOf("function commit(");
  assert.match(commit, /COMMIT_TIMEOUT_MS/);
  assert.match(commit, /fail\("Timed out/);
});

test("the three event steps drive progress; no timer loop", () => {
  const event = bodyOf("function onWallpaperEvent(");
  assert.match(event, /state: "applying"/);
  assert.match(event, /state: "visible"/);
  assert.match(event, /value === "done"[\s\S]{0,80}done\(entry\)/);
  assert.doesNotMatch(CLEAN, /for \(let i = 0; i < 3/);
});

test("an external set never dismisses or re-focuses the overlay", () => {
  const event = bodyOf("function onWallpaperEvent(");
  assert.match(event, /rescan\(false\)/);
  assert.doesNotMatch(event, /reopen\(|cancelOverlay\(|hideWindow\(/);
});

test("the component keeps the frozen window name and appearance seam", () => {
  assert.match(CLEAN, /const WINDOW_NAME = "wallpaper-selector-window"/);
  assert.match(CLEAN, /export function refreshWallpaperSelectorChrome/);
  assert.match(CLEAN, /refreshChrome = \(\) =>/);
  assert.match(CLEAN, /contactSheet\.replaceSearchIcon\(searchUiIcon\(\)\)/);
});
