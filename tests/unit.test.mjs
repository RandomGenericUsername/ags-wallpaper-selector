// ---------------------------------------------------------------------------
// Pure unit tests for ags-wallpaper-selector (stock runner: Node only, no
// AGS/GTK).
//
// These execute the app's real pure work module plus the platform's pure
// Appearance refresh helper the app registers:
//   - the app-owned work rebuilds only the search icon;
//   - the helper applies the whole appearance before the work;
//   - appearance apply is repeated per request, work is idempotent by hash;
//   - a thrown apply stays retryable and does not advance the hash.
//
// Run from the repo root:  make test
// ---------------------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";
import { PALETTE_REFRESH_COMMAND } from "ags-platform/ports/palette-refresh";
import { createAppearanceRefreshHandler } from "ags-platform/ports/appearance-refresh";
import { applySelectorAppearance } from "../lib/appearance.ts";

const HASH = "appearance-2026-10-27";

// ── App-owned appearance work ──────────────────────────────────────────────

test("the selector work rebuilds only the search icon", () => {
  const calls = [];
  applySelectorAppearance({
    rebuildSearchIcon: () => calls.push("search-icon"),
  });
  assert.deepEqual(calls, ["search-icon"]);
});

// ── The v2 appearance refresh handler ──────────────────────────────────────

test("the handler applies the whole appearance before the app work", () => {
  const responses = [];
  const worked = [];
  let applies = 0;
  const handler = createAppearanceRefreshHandler(
    { apply: () => void (applies += 1) },
    (hash) => void worked.push(hash),
  );

  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => responses.push(response));

  assert.equal(applies, 1, "appearance.apply() ran before the work");
  assert.deepEqual(worked, [HASH], "the derived work ran");
  assert.equal(responses.length, 1, "exactly one response");
  assert.equal(typeof responses[0], "string", "AGS transport is a string");
  assert.equal(responses[0], JSON.stringify({ ok: true }));
});

test("the same hash re-applies appearance but does not rerun app work", () => {
  const responses = [];
  let applies = 0;
  let worked = 0;
  const handler = createAppearanceRefreshHandler(
    { apply: () => void (applies += 1) },
    () => void (worked += 1),
  );

  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => responses.push(response));
  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => responses.push(response));

  assert.equal(applies, 2, "the whole appearance is always re-applied");
  assert.equal(worked, 1, "the same hash must not rebuild twice");
  assert.deepEqual(responses, [JSON.stringify({ ok: true }), JSON.stringify({ ok: true })]);
});

test("a thrown appearance apply is retryable and does not advance the hash", () => {
  const responses = [];
  let applies = 0;
  let worked = 0;
  let fail = true;
  const handler = createAppearanceRefreshHandler(
    {
      apply: () => {
        applies += 1;
        if (fail) throw new Error("appearance pointer missing");
      },
    },
    () => void (worked += 1),
  );

  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => responses.push(response));
  assert.equal(applies, 1);
  assert.equal(worked, 0, "work did not run when the apply failed");
  assert.deepEqual(JSON.parse(responses[0]), {
    ok: false,
    error: "appearance pointer missing",
    retryable: true,
  });

  fail = false;
  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => responses.push(response));
  assert.equal(applies, 2);
  assert.equal(worked, 1, "the failed hash was retried");
  assert.deepEqual(JSON.parse(responses[1]), { ok: true });
});

test("a malformed palette-refresh request never runs the work", () => {
  const responses = [];
  let applies = 0;
  let worked = 0;
  const handler = createAppearanceRefreshHandler(
    { apply: () => void (applies += 1) },
    () => void (worked += 1),
  );

  handler([PALETTE_REFRESH_COMMAND], (response) => responses.push(response));
  assert.equal(applies, 0);
  assert.equal(worked, 0);
  assert.equal(responses.length, 1);
  assert.deepEqual(JSON.parse(responses[0]), {
    ok: false,
    error: "malformed palette-refresh request",
    retryable: false,
  });
});
