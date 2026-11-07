// ---------------------------------------------------------------------------
// Pure unit tests for ags-wallpaper-selector (stock runner: Node only, no
// AGS/GTK).
//
// These execute the app's real pure work module plus the platform's pure
// Generations v3 Appearance refresh helper the app registers:
//   - the app-owned work rebuilds only the search icon;
//   - the helper applies the REQUESTED generation before the work;
//   - the response names that exact generation, one JSON string per request;
//   - work is idempotent by generation hash, while apply re-verifies `current`;
//   - a deferred apply runs no work, and a thrown apply stays retryable;
//   - the retired v2 `palette-refresh` command is rejected.
//
// Run from the repo root:  make test
// ---------------------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";
import { createAppearanceRefreshHandler } from "ags-platform/ports/appearance-refresh";
import { applySelectorAppearance } from "../lib/appearance.ts";

const HASH = "a".repeat(64);
const MOVED = "b".repeat(64);

// ── App-owned appearance work ──────────────────────────────────────────────

test("the selector work rebuilds only the search icon", () => {
  const calls = [];
  applySelectorAppearance({
    rebuildSearchIcon: () => calls.push("search-icon"),
  });
  assert.deepEqual(calls, ["search-icon"]);
});

// ── The v3 generation-bound appearance refresh handler ─────────────────────

test("the handler applies the requested generation before the app work", () => {
  const responses = [];
  const events = [];
  const handler = createAppearanceRefreshHandler(
    {
      applyGeneration: (genHash) => {
        events.push(`apply:${genHash}`);
        return { status: "applied", genHash };
      },
    },
    (genHash) => {
      events.push(`work:${genHash}`);
      return { status: "applied" };
    },
  );

  handler(["appearance-refresh", HASH], (response) => responses.push(response));

  assert.deepEqual(events, [`apply:${HASH}`, `work:${HASH}`]);
  assert.equal(responses.length, 1, "exactly one response");
  assert.equal(typeof responses[0], "string", "AGS transport is a string");
  assert.equal(responses[0], JSON.stringify({ applied: HASH }));
});

test("the same generation re-applies current but does not rerun app work", () => {
  const responses = [];
  let applies = 0;
  let worked = 0;
  const handler = createAppearanceRefreshHandler(
    {
      applyGeneration: (genHash) => {
        applies += 1;
        return { status: "applied", genHash };
      },
    },
    () => {
      worked += 1;
      return { status: "applied" };
    },
  );

  handler(["appearance-refresh", HASH], (response) => responses.push(response));
  handler(["appearance-refresh", HASH], (response) => responses.push(response));

  assert.equal(applies, 2, "the requested generation is always re-verified");
  assert.equal(worked, 1, "the same generation must not rebuild twice");
  assert.deepEqual(responses, [
    JSON.stringify({ applied: HASH }),
    JSON.stringify({ applied: HASH }),
  ]);
});

test("a deferred apply answers the requested hash and runs no work", () => {
  const responses = [];
  let worked = 0;
  const handler = createAppearanceRefreshHandler(
    {
      applyGeneration: (genHash) => ({
        status: "deferred",
        reason: `current generation moved to ${MOVED}`,
        genHash,
      }),
    },
    () => {
      worked += 1;
      return { status: "applied" };
    },
  );

  handler(["appearance-refresh", HASH], (response) => responses.push(response));

  assert.equal(worked, 0, "the work must not run without an installed generation");
  assert.deepEqual(JSON.parse(responses[0]), {
    deferred: `current generation moved to ${MOVED}`,
    genHash: HASH,
  });
});

test("a thrown appearance apply is retryable and does not advance the hash", () => {
  const responses = [];
  let applies = 0;
  let worked = 0;
  let fail = true;
  const handler = createAppearanceRefreshHandler(
    {
      applyGeneration: (genHash) => {
        applies += 1;
        if (fail) throw new Error("appearance pointer missing");
        return { status: "applied", genHash };
      },
    },
    () => {
      worked += 1;
      return { status: "applied" };
    },
  );

  handler(["appearance-refresh", HASH], (response) => responses.push(response));
  assert.equal(applies, 1);
  assert.equal(worked, 0, "work did not run when the apply failed");
  assert.deepEqual(JSON.parse(responses[0]), {
    failed: "appearance pointer missing",
    retryable: true,
    genHash: HASH,
  });

  fail = false;
  handler(["appearance-refresh", HASH], (response) => responses.push(response));
  assert.equal(applies, 2);
  assert.equal(worked, 1, "the failed generation was retried");
  assert.deepEqual(JSON.parse(responses[1]), { applied: HASH });
});

test("the retired palette-refresh command never runs the work", () => {
  const responses = [];
  let applies = 0;
  let worked = 0;
  const handler = createAppearanceRefreshHandler(
    {
      applyGeneration: () => {
        applies += 1;
        return { status: "applied", genHash: HASH };
      },
    },
    () => {
      worked += 1;
      return { status: "applied" };
    },
  );

  handler(["palette-refresh", HASH], (response) => responses.push(response));
  assert.equal(applies, 0, "a v2 command must not apply anything");
  assert.equal(worked, 0);
  assert.equal(responses.length, 1);
  assert.deepEqual(JSON.parse(responses[0]), {
    failed: "malformed appearance-refresh request",
    retryable: false,
    genHash: HASH,
  });
});

test("an appearance-refresh request without a generation is malformed", () => {
  const responses = [];
  let applies = 0;
  const handler = createAppearanceRefreshHandler(
    {
      applyGeneration: () => {
        applies += 1;
        return { status: "applied", genHash: HASH };
      },
    },
    () => ({ status: "applied" }),
  );

  handler(["appearance-refresh"], (response) => responses.push(response));

  assert.equal(applies, 0);
  assert.equal(responses.length, 1);
  assert.deepEqual(JSON.parse(responses[0]), {
    failed: "malformed appearance-refresh request",
    retryable: false,
    genHash: "0".repeat(64),
  });
});
