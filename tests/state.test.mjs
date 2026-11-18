// Pure overlay state machine (REQ-005 §4). Node only.
//
// Run with: node --test tests/state.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  beginCommit,
  cancelOverlay,
  closeGrid,
  commitEvent,
  commitStepLabel,
  failCommit,
  finishCommit,
  focusLook,
  focusWallpaper,
  initialState,
  isLiveFocus,
  openGrid,
  refreshLive,
  reopen,
  setGridQuery,
  stateLabel,
  stepLook,
} from "../lib/state.ts";

test("initial state lands on the live item, or preview when nothing is live", () => {
  const live = initialState(2, 1);
  assert.equal(live.phase, "live");
  assert.deepEqual(live.focus, { index: 2, look: 1 });
  assert.equal(live.page, "main");

  const none = initialState(null, 0, 3);
  assert.equal(none.phase, "preview");
  assert.deepEqual(none.focus, { index: 3, look: 0 });
  assert.equal(none.live, null);
});

test("navigation resets the look, never commits and never closes", () => {
  let state = focusLook(initialState(0), 2);
  assert.equal(state.phase, "look-preview");
  state = focusWallpaper(state, 3);
  assert.equal(state.phase, "preview");
  assert.deepEqual(state.focus, { index: 3, look: 0 });
  assert.equal(state.commit, null);
  assert.equal(state.page, "main");
});

test("looking at the live wallpaper's live look returns to Live", () => {
  let state = focusWallpaper(initialState(1, 2), 1);
  state = focusLook(state, 2);
  assert.equal(state.phase, "live");
  assert.equal(isLiveFocus(state), true);
  state = focusLook(state, 1);
  assert.equal(state.phase, "look-preview");
  assert.equal(isLiveFocus(state), false);
});

test("look stepping wraps and a single look is a no-op", () => {
  let state = focusLook(initialState(0), 0);
  state = stepLook(state, -1, 3);
  assert.equal(state.focus.look, 2);
  state = stepLook(state, 1, 3);
  assert.equal(state.focus.look, 0);
  assert.equal(stepLook(state, 1, 1), state);
});

test("grid preserves focus and clears the query on open; Esc closes it", () => {
  const base = focusWallpaper(initialState(0), 4);
  let state = openGrid(base);
  assert.equal(state.page, "grid");
  assert.equal(state.gridQuery, "");
  state = setGridQuery(state, "drag");
  state = closeGrid(state);
  assert.equal(state.page, "main");
  assert.equal(state.gridQuery, "");
  assert.deepEqual(state.focus, base.focus);
});

test("committing locks navigation, looks, grid and Esc", () => {
  const preview = focusWallpaper(initialState(0), 1);
  const committing = beginCommit(preview);
  assert.equal(committing.phase, "committing");
  assert.ok(committing.commit);
  assert.equal(focusWallpaper(committing, 2), committing);
  assert.equal(focusLook(committing, 1), committing);
  assert.equal(stepLook(committing, 1, 3), committing);
  assert.equal(openGrid(committing), committing);
  assert.equal(cancelOverlay(committing), committing);
});

test("a live focus cannot commit", () => {
  const live = initialState(0);
  assert.equal(beginCommit(live), live);
});

test("the three commit events map to 33/66/100 percent", () => {
  let state = beginCommit(focusWallpaper(initialState(0), 1));
  state = commitEvent(state, { state: "applying" });
  assert.deepEqual(
    [state.commit.step, state.commit.progress],
    [1, 1 / 3],
  );
  state = commitEvent(state, { state: "visible" });
  assert.deepEqual(
    [state.commit.step, state.commit.progress],
    [2, 2 / 3],
  );
  state = commitEvent(state, { state: "done" });
  assert.deepEqual([state.commit.step, state.commit.progress], [3, 1]);
  assert.equal(state.phase, "committing", "done must not hide before finish");
});

test("finish makes the target live and leaves committing", () => {
  let state = beginCommit(focusWallpaper(initialState(0), 2));
  state = commitEvent(state, { state: "done" });
  state = finishCommit(state);
  assert.equal(state.phase, "live");
  assert.deepEqual(state.live, { index: 2, look: 0 });
  assert.deepEqual(state.focus, { index: 2, look: 0 });
  assert.equal(state.commit, null);
  assert.equal(isLiveFocus(state), true);
});

test("an error keeps the preview and never marks the target live", () => {
  let state = beginCommit(focusLook(focusWallpaper(initialState(0), 3), 2));
  state = commitEvent(state, { state: "error", error: "boom" });
  assert.equal(state.phase, "look-preview");
  assert.deepEqual(state.focus, { index: 3, look: 2 });
  assert.deepEqual(state.live, { index: 0, look: 0 });
  assert.equal(state.commit.error, "boom");
  assert.equal(isLiveFocus(state), false);

  // The direct failure helper has the same contract.
  const failed = failCommit(beginCommit(focusWallpaper(initialState(0), 1)), "nope");
  assert.equal(failed.phase, "preview");
  assert.equal(failed.commit.error, "nope");
});

test("a failure is cleared by navigating away", () => {
  let state = failCommit(beginCommit(focusWallpaper(initialState(0), 1)), "nope");
  state = focusWallpaper(state, 2);
  assert.equal(state.commit, null);
});

test("refreshLive moves the marker without moving the focus", () => {
  let state = focusWallpaper(initialState(0), 3);
  state = refreshLive(state, 3, 0);
  assert.deepEqual(state.focus, { index: 3, look: 0 });
  assert.equal(state.phase, "live");
  state = refreshLive(state, 1, 0);
  assert.equal(state.phase, "preview");
  assert.deepEqual(state.focus, { index: 3, look: 0 });
});

test("reopen always resets to the live item, never a stale preview", () => {
  let state = focusWallpaper(initialState(0, 1), 5);
  state = closeGrid(openGrid(state));
  state = cancelOverlay(state);
  assert.equal(state.phase, "closed");
  state = reopen(state, 0, 1, 5);
  assert.equal(state.phase, "live");
  assert.deepEqual(state.focus, { index: 0, look: 1 });
  assert.equal(state.page, "main");
});

test("the badge is text, not colour", () => {
  const preview = focusWallpaper(initialState(0), 2);
  assert.equal(stateLabel(preview, "Original"), "Preview");
  assert.equal(stateLabel(focusLook(preview, 1), "Ember"), "Preview · Ember");
  assert.equal(stateLabel(initialState(0), "Original"), "Live");
  assert.equal(stateLabel(beginCommit(preview), "Original"), "Setting…");
});

test("commit step labels are the frozen three steps", () => {
  assert.equal(commitStepLabel(0), "Swapping pixels…");
  assert.equal(commitStepLabel(1), "Swapping pixels…");
  assert.equal(commitStepLabel(2), "Building palette…");
  assert.equal(commitStepLabel(3), "Updating icons…");
});
