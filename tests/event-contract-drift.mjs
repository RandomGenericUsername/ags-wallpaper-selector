// Contract drift + event-consumer gate for the standalone wallpaper selector.
//
// Pins the SHARED platform event client (spine AD-5, `ags-platform/ports/
// event-client`) against the canonical contract (`contracts/event-contract
// .json` / `.xml`), exercises its subscribe-before-read hydration state machine
// for the one topic the selector consumes (`wallpaper.state`, including the
// optional/additive `stage` / `reload_failures` members) with a scripted fake
// transport (no live bus), and asserts the structural facts the standalone
// extraction keeps: the window consumes the ONE platform event client +
// IconProvider (no app-local event-bus / icon-registry copies) and the app
// registers the real palette-refresh wrapper through the Theme port. Executed,
// never text-scanned -- except the structural source read, which is labelled
// as such.
//
// Run from the repo root:  make drift

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// The ONE event client: the app-local event-bus core is gone, so this gate
// reads the platform's shared client through the dev `node_modules/ags-platform`
// shortcut `make ags-platform-dev` creates (its target sits outside
// node_modules so Node's type-stripping accepts the `.ts` source).
import * as core from "ags-platform/ports/event-client";

const here = dirname(fileURLToPath(import.meta.url));
const selectorDir = join(here, "..");

// The canonical contract lives in the sibling `contracts` repo (AGENTS: every
// app depends on `ags-platform` and `contracts`). `CONTRACTS_REPO` overrides the
// location (the Makefile and CI set it); otherwise search upward for a checkout,
// mirroring the repo's `icons-json-drift` cross-repo read. A missing contract
// FAILS -- never a silent skip: a drift gate that cannot read the contract
// proves nothing.
function findContractsRepo() {
  const override = process.env.CONTRACTS_REPO;
  if (override) return override;
  let dir = here;
  for (let i = 0; i < 8; i += 1) {
    dir = dirname(dir);
    if (existsSync(join(dir, "contracts", "event-contract.json"))) {
      return join(dir, "contracts");
    }
  }
  return null;
}

const contractsRepo = findContractsRepo();
if (contractsRepo === null) {
  console.error(
    "FAIL: cannot find the `contracts` repo (set CONTRACTS_REPO=/path/to/contracts)",
  );
  process.exit(1);
}
const contractJson = JSON.parse(
  readFileSync(join(contractsRepo, "event-contract.json"), "utf-8"),
);
const contractXml = readFileSync(
  join(contractsRepo, "event-contract.xml"), "utf-8",
);

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures += 1;
    console.error(`FAIL ${name}\n  expected: ${e}\n  actual:   ${a}`);
  } else {
    console.log(`ok ${name}`);
  }
}

// ── Drift: every baked constant is a machine-definition value ────────────

check("bus name", core.EVENTS_BUS_NAME, contractJson.well_known_name);
check("object path", core.EVENTS_OBJECT_PATH, contractJson.object_path);
check("interface", core.EVENTS_INTERFACE, contractJson.interface);
check("DomainEvent signal", contractJson.signals[core.DOMAIN_EVENT_SIGNAL] !== undefined, true);
check("JobsCleared signal", contractJson.signals[core.JOBS_CLEARED_SIGNAL] !== undefined, true);
check("Control method", contractJson.methods[core.CONTROL_METHOD] !== undefined, true);
check("GetTopicState method", contractJson.methods[core.HYDRATION_METHOD] !== undefined, true);
check(
  "GetTopicState returns reserved _epoch/_seq",
  contractJson.methods.GetTopicState.out,
  ["state:a{sv}"],
);
check("xml declares the hub interface", contractXml.includes(core.EVENTS_INTERFACE), true);

// ── The one topic the selector consumes ─────────────────────────────────
//
// The window's `onWallpaperEvent` reads `state`; REQ-005 also requires the
// optional/additive `stage` / `reload_failures` members to be consumed via the
// shared client (the payload is passed through whole), so the contract shape is
// pinned here -- if the contract renames one, this gate must fail first.

const wallpaper = contractJson.topics["wallpaper.state"];
check("wallpaper.state is a contract topic", wallpaper !== undefined, true);
check(
  "wallpaper.state payload keys",
  Object.keys(wallpaper.payload).sort(),
  ["reload_failures", "stage", "state", "trigger", "wallpaper_hash"],
);
check(
  "wallpaper.state optional members",
  [...wallpaper.optional].sort(),
  ["reload_failures", "stage", "trigger"],
);
check(
  "wallpaper.state enum.state",
  wallpaper.enum.state,
  ["applying", "visible", "done", "error"],
);
check(
  "wallpaper.state enum.trigger",
  wallpaper.enum.trigger,
  ["set", "regenerate", "reconcile", "reactive"],
);
check(
  "wallpaper.state enum.stage",
  wallpaper.enum.stage,
  [
    "setting_wallpaper",
    "generating_palette",
    "palette_generated",
    "preparing_appearance_assets",
    "appearance_assets_ready",
    "reconciling_consumers",
    "finished",
  ],
);

// ── Subscribe-before-read hydration state machine (fake transport) ───────

function fakeTransport(states) {
  const calls = [];
  const signals = { onDomainEvent: null, onJobsCleared: null, onHubRestart: null };
  let state = { ...states };
  const transport = {
    startSignals(onDomainEvent, onJobsCleared, onHubRestart) {
      calls.push("startSignals");
      signals.onDomainEvent = onDomainEvent;
      signals.onJobsCleared = onJobsCleared;
      signals.onHubRestart = onHubRestart;
    },
    getTopicState(topic) {
      calls.push(`getTopicState:${topic}`);
      return topic in state ? state[topic] : null;
    },
    control(jobId, action) {
      calls.push(`control:${jobId}:${action}`);
    },
  };
  return { transport, calls, signals, setState: (next) => { state = { ...next }; } };
}

// Hydration on subscribe delivers the last wallpaper payload immediately (with
// its optional stage/reload_failures members), so a selector opened mid-apply
// renders the current state without waiting for the next transition.
{
  const fake = fakeTransport({
    "wallpaper.state": {
      state: "applying",
      wallpaper_hash: "h1",
      trigger: "set",
      stage: "generating_palette",
      reload_failures: ["bar", "hypr-pano"],
      _epoch: 4,
      _seq: 9,
    },
  });
  const bus = new core.DomainEventBusCore(fake.transport);
  const seen = [];
  bus.subscribe("wallpaper.state", (_t, payload) => seen.push(payload));
  check("subscribe starts signals before hydrating", fake.calls[0], "startSignals");
  check("subscribe hydrates wallpaper.state", fake.calls[1], "getTopicState:wallpaper.state");
  check("hydrated wallpaper payload delivered whole", seen, [{
    state: "applying",
    wallpaper_hash: "h1",
    trigger: "set",
    stage: "generating_palette",
    reload_failures: ["bar", "hypr-pano"],
  }]);
  check("hydrated pair recorded", bus.hydratedPair("wallpaper.state"), [4, 9]);
}

// A payload omitting the optional members (an older publisher) still hydrates:
// the client must not require stage/reload_failures.
{
  const fake = fakeTransport({
    "wallpaper.state": { state: "done", wallpaper_hash: "h2", _epoch: 1, _seq: 2 },
  });
  const bus = new core.DomainEventBusCore(fake.transport);
  const seen = [];
  bus.subscribe("wallpaper.state", (_t, payload) => seen.push(payload));
  check("optional members tolerated absent", seen, [{ state: "done", wallpaper_hash: "h2" }]);
}

// A stale (epoch, seq) signal is dropped; a newer one is delivered once.
{
  const fake = fakeTransport({
    "wallpaper.state": { state: "applying", wallpaper_hash: "h1", _epoch: 2, _seq: 5 },
  });
  const bus = new core.DomainEventBusCore(fake.transport);
  const seen = [];
  bus.subscribe("wallpaper.state", (_t, payload) => seen.push(payload.state));
  fake.signals.onDomainEvent([
    "wallpaper.state",
    ":1.1",
    4, // seq <= baseline 5 -> stale
    2,
    { state: "visible", wallpaper_hash: "h1" },
  ]);
  check("stale signal dropped", seen, ["applying"]);
  fake.signals.onDomainEvent([
    "wallpaper.state",
    ":1.1",
    6,
    2,
    { state: "visible", wallpaper_hash: "h1", stage: "reconciling_consumers" },
  ]);
  check("newer signal delivered", seen, ["applying", "visible"]);
  check("baseline advanced", bus.hydratedPair("wallpaper.state"), [2, 6]);
}

// ── Structural: the selector consumes the platform (AD-1/AD-5/AD-7/AD-13) ──
//
// REQ-005 removes the app-local `event-bus*.ts`, `icon-registry.ts` and
// `theme.ts` copies. A source read, labelled as structural (the alternative --
// running a second selector -- would fight the live instance).

const windowSource = readFileSync(
  join(selectorDir, "ui", "WallpaperSelectorWindow.tsx"),
  "utf-8",
);
const appSource = readFileSync(join(selectorDir, "app.tsx"), "utf-8");
const refreshSource = readFileSync(
  join(selectorDir, "lib", "palette-refresh.ts"),
  "utf-8",
);
const appearanceSource = readFileSync(
  join(selectorDir, "lib", "appearance.ts"),
  "utf-8",
);

check(
  "window imports the platform event client",
  /from\s+"ags-platform\/adapters\/event-bus"/.test(windowSource),
  true,
);
check(
  "window declares the wallpaper.state topic",
  /WALLPAPER_STATE_TOPIC\s*=\s*"wallpaper\.state"/.test(windowSource),
  true,
);
check(
  "window subscribes wallpaper.state",
  windowSource.includes("domainEvents.subscribe(WALLPAPER_STATE_TOPIC"),
  true,
);
check(
  "window imports the platform IconProvider",
  /from\s+"ags-platform\/adapters\/icon"/.test(windowSource),
  true,
);
check(
  "window no longer imports the platform Theme port",
  /from\s+"ags-platform\/adapters\/theme"/.test(windowSource),
  false,
);
check(
  "app imports the platform Theme port",
  /from\s+"ags-platform\/adapters\/theme"/.test(appSource),
  true,
);
check(
  "app registers the palette-refresh wrapper",
  /createWallpaperSelectorPaletteRefresh\(/.test(appSource),
  true,
);
check(
  "app imports the app-local refresh wrapper",
  /from\s+"\.\/lib\/palette-refresh"/.test(appSource),
  true,
);
check(
  "refresh wrapper uses the platform helper",
  /createPaletteRefreshHandler\(/.test(refreshSource),
  true,
);
check(
  "refresh is hash-idempotent",
  /createAppearanceRefresh\(/.test(refreshSource),
  true,
);
check(
  "refresh order is theme then search icon",
  appearanceSource.indexOf("reapplyTheme") < appearanceSource.indexOf("rebuildSearchIcon"),
  true,
);
check(
  "window does not apply the palette from wallpaper.state",
  /theme\.apply/.test(windowSource),
  false,
);
check(
  "no app-local event-bus import",
  /from\s+"\.\.?\/lib\/event-bus/.test(windowSource) || /from\s+"\.\.?\/lib\/event-bus/.test(appSource),
  false,
);
check(
  "no app-local icon-registry import",
  /from\s+"\.\.?\/lib\/icon-registry/.test(windowSource),
  false,
);
check(
  "no app-local theme import",
  /from\s+"\.\.?\/lib\/theme"/.test(windowSource) || /from\s+"\.\.?\/lib\/theme"/.test(appSource),
  false,
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
