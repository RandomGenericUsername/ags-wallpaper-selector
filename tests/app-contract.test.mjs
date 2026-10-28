// ---------------------------------------------------------------------------
// Manifest + handler + template conformance for ags-wallpaper-selector
// (AD-26/AD-27/AD-33/AD-35).
//
// This is the repo-local gate the standalone contract requires:
//   1. `app.manifest.json` is schema-valid and carries the selector identity;
//   2. app.tsx / window / launcher / keybind agree with that identity;
//   3. the live palette-refresh handler is the real v0.5.0 refresh (Theme
//      pointer + search icon) and leaves the drawer untouched;
//   4. the shared dev-flow template (AGENTS, tickets, guard, Makefile, CI,
//      tests, templates/ags-app) is present and the platform's own
//      `checkAppRepo` template gate passes;
//   5. the selector keeps the platform event client / IconProvider / Theme
//      port and has no app-local copies.
//
// Run from the repo root:  make conformance
// ---------------------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAgsAppManifest } from "ags-platform/ports/app-manifest";
import {
  checkAppRepoAt,
  formatAppConformanceReport,
} from "ags-platform/conformance/app-conformance";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const IDENTITY = {
  schemaVersion: 1,
  app: "wallpaper-selector",
  instance: "wallpaper-selector",
  configDir: "ags-wallpaper-selector",
  mode: "live",
  holdsUnsavedState: false,
};

function readText(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

/** Strip comments, keeping strings intact (same shape as ags-apps' gate). */
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

/** The `{...}` body of the function named by `marker`, comments stripped. */
function functionBody(source, marker) {
  const clean = stripComments(source);
  const start = clean.indexOf(marker);
  assert.notEqual(start, -1, `missing function marker: ${marker}`);
  const brace = clean.indexOf("{", start);
  assert.notEqual(brace, -1, `missing function body for: ${marker}`);
  let depth = 0;
  let state = null;
  for (let i = brace; i < clean.length; i += 1) {
    const c = clean[i];
    if (state !== null) {
      if (c === "\\") {
        i += 1;
      } else if (c === state) {
        state = null;
      }
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      state = c;
      continue;
    }
    if (c === "{") depth += 1;
    if (c === "}") {
      depth -= 1;
      if (depth === 0) return clean.slice(brace + 1, i);
    }
  }
  throw new Error(`unterminated function body: ${marker}`);
}

function findContractsRoot() {
  const override = process.env.CONTRACTS_ROOT;
  if (override) return override;
  let dir = ROOT;
  for (let i = 0; i < 8; i += 1) {
    dir = dirname(dir);
    if (existsSync(join(dir, "contracts", "schemas", "ags-app-manifest.schema.json"))) {
      return join(dir, "contracts");
    }
  }
  return null;
}

/** Every authored file, minus generated/local-only trees. */
function walk(dir = ROOT) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      [
        ".git",
        "node_modules",
        "@girs",
        ".dev",
        ".worktrees",
        "build",
        "dist",
        "contracts",
      ].includes(entry.name)
    ) {
      continue;
    }
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile()) files.push(relative(ROOT, absolute).split("\\").join("/"));
  }
  return files;
}

// ── 1. Manifest identity ───────────────────────────────────────────────────

test("the manifest is schema-valid and carries the selector identity", () => {
  const parsed = parseAgsAppManifest(readText("app.manifest.json"));
  assert.equal(parsed.ok, true, JSON.stringify(parsed.issues ?? []));
  assert.deepEqual(parsed.manifest, IDENTITY);
});

test("the manifest agrees with app.tsx and the selector window", () => {
  const app = readText("app.tsx");
  const window = readText("ui", "WallpaperSelectorWindow.tsx");
  assert.match(app, /instanceName:\s*"wallpaper-selector"/);
  assert.match(window, /const WINDOW_NAME = "wallpaper-selector-window"/);
  assert.match(readText("style.css"), /window#wallpaper-selector-window/);
});

test("the launcher and keybind description are documented for consumers", () => {
  const readme = readText("README.md");
  assert.match(readme, /`wallpaper-selector-ui`/);
  assert.match(readme, /Open wallpaper selector/);
  assert.match(readme, /ags-wallpaper-selector/);
});

test("the app consumes the wallpaper runtime namespace", () => {
  const scan = readText("lib", "scan.ts");
  assert.match(scan, /wallpaper/);
  assert.match(scan, /current\.json/);
});

test("no app-local platform copy and no sibling-app import survives", () => {
  for (const retired of ["theme.ts", "event-bus.ts", "event-bus-core.ts", "icon-registry.ts"]) {
    assert.equal(existsSync(join(ROOT, "lib", retired)), false, `lib/${retired} must not exist`);
  }
  const sources = walk().filter((file) => /^(app\.tsx|lib\/|ui\/)/.test(file));
  for (const file of sources) {
    const text = readText(file);
    assert.doesNotMatch(text, /from\s+"\.\.?\/(?:bar|notifications|capture-tool|hypr-pano|icme|btop-theme-studio)\//, file);
  }
});

// ── 2. Repository template + platform conformance ──────────────────────────

test("the platform template gate passes for this repo", () => {
  const report = checkAppRepoAt(ROOT);
  assert.equal(report.ok, true, formatAppConformanceReport(report, ROOT));
});

test("the frozen copyable template is present for the next app", () => {
  const template = join(ROOT, "templates", "ags-app");
  const required = [
    "AGENTS.md",
    "README.md",
    "Makefile",
    "app.tsx",
    "app.manifest.json",
    "tsconfig.app.json",
    "scripts/worktree-guard.sh",
    "tickets/LIFECYCLE.md",
    "tickets/INDEX.md",
    "tickets/_template/requirement.md",
    "tests/app-contract.test.mjs",
    "tests/unit.test.mjs",
    ".github/workflows/ci.yml",
  ];
  for (const path of required) {
    assert.ok(existsSync(join(template, path)), `templates/ags-app/${path} is missing`);
  }
  for (const token of ["{{APP}}", "{{INSTANCE}}", "{{CONFIG_DIR}}", "{{REPO}}"]) {
    assert.match(
      readText("templates", "ags-app", "template.json"),
      new RegExp(token.replace(/[{}]/g, "\\$&")),
      `template.json must declare ${token}`,
    );
  }
});

test("the contracts v0.3.0 manifest schema agrees with the platform", () => {
  const contractsRoot = findContractsRoot();
  assert.notEqual(contractsRoot, null, "cannot find contracts (set CONTRACTS_ROOT)");
  const schema = JSON.parse(
    readFileSync(join(contractsRoot, "schemas", "ags-app-manifest.schema.json"), "utf8"),
  );
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(
    [...schema.required].sort(),
    ["app", "configDir", "holdsUnsavedState", "instance", "mode", "schemaVersion"],
  );
  assert.equal(
    schema.allOf[0].then.properties.holdsUnsavedState.const,
    false,
    "restart stays invalid when holdsUnsavedState is true",
  );
});

test("the Makefile pins the v0.3.0 program tuple", () => {
  const makefile = readText("Makefile");
  assert.match(makefile, /^AGS_PLATFORM_VERSION := v0\.3\.0$/m);
  assert.match(makefile, /^CONTRACTS_VERSION := v0\.3\.0$/m);
});

// ── 3. The live handler is real and non-destructive ────────────────────────

test("app.tsx registers the real v0.5.0 palette-refresh handler", () => {
  const app = readText("app.tsx");
  assert.match(app, /from\s+"\.\/lib\/palette-refresh"/);
  assert.match(app, /createWallpaperSelectorPaletteRefresh\(/);
  assert.match(app, /requestHandler:/);
  assert.match(app, /theme\.apply\(\)/, "the stable Theme pointer is re-applied");
  assert.match(
    app,
    /rebuildSearchIcon:\s*refreshWallpaperSelectorChrome/,
    "the search icon is rebuilt",
  );
});

test("the handler wiring answers through the platform helper", () => {
  const palette = readText("lib", "palette-refresh.ts");
  assert.match(palette, /from\s+"ags-platform\/ports\/palette-refresh"/);
  assert.match(palette, /createPaletteRefreshHandler\(/);
  assert.match(palette, /createAppearanceRefresh\(/);
});

test("the refresh re-applies the palette before rebuilding the icon", () => {
  const appearance = readText("lib", "appearance.ts");
  const body = functionBody(appearance, "export function applySelectorAppearance");
  assert.match(body, /surface\.reapplyTheme\(\)/);
  assert.match(body, /surface\.rebuildSearchIcon\(\)/);
  assert.ok(
    body.indexOf("reapplyTheme") < body.indexOf("rebuildSearchIcon"),
    "the Theme pointer must be re-applied before the icon is rasterized",
  );
});

test("the search-icon refresh preserves the drawer", () => {
  const window = readText("ui", "WallpaperSelectorWindow.tsx");
  const refresh = functionBody(window, "function refreshSelectorChrome");
  assert.match(refresh, /searchRow\.remove\(old\)/);
  assert.match(refresh, /searchRow\.prepend\(searchUiIcon\(\)\)/);
  for (const forbidden of [
    "rescan(",
    "renderGrid(",
    "drill(",
    "goBack(",
    "setModel(",
    "setQuery(",
    "setSelected(",
    "search.set_text",
    "hideWindow(",
    ".visible =",
    "setStatus(",
  ]) {
    assert.equal(
      refresh.includes(forbidden),
      false,
      `palette refresh must not touch drawer state: found ${forbidden}`,
    );
  }
});

test("the window exposes only the chrome refresher to app.tsx", () => {
  const window = readText("ui", "WallpaperSelectorWindow.tsx");
  const body = functionBody(window, "export function refreshWallpaperSelectorChrome");
  assert.match(body, /refreshChrome\?\.\(\)/);
  assert.doesNotMatch(body, /renderGrid|rescan|setSelected|setQuery/);
  assert.match(
    window,
    /refreshChrome = refreshSelectorChrome;/,
    "the window registers the chrome refresher",
  );
});

test("the selector consumes the one platform event client and icon provider", () => {
  const window = readText("ui", "WallpaperSelectorWindow.tsx");
  assert.match(window, /from\s+"ags-platform\/adapters\/event-bus"/);
  assert.match(window, /from\s+"ags-platform\/adapters\/icon"/);
  assert.match(window, /WALLPAPER_STATE_TOPIC = "wallpaper\.state"/);
  assert.doesNotMatch(window, /theme\.apply/);
});
