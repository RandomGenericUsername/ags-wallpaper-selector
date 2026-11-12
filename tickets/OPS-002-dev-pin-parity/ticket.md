---
id: OPS-002
title: "Bump the dev tuple to ags-platform v1.1.0 / contracts v0.12.0"
kind: ops-task
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/OPS-002/
branch: ticket/OPS-002-dev-pin-parity
---

# Bump the dev tuple to ags-platform v1.1.0 / contracts v0.12.0

## Work

Move the local-only program tuple for dev-pin parity with the platform's and
contracts' latest tags:

- `ags-platform` `v1.0.1` → `v1.1.0` (adds the required `surface.window` role);
- `contracts` `v0.8.0` → `v0.12.0` (freezes that role).

- `Makefile`: `AGS_PLATFORM_VERSION := v1.1.0` and
  `CONTRACTS_VERSION := v0.12.0`, plus the tuple comments and the help text's
  `.dev/` paths.
- `.github/workflows/ci.yml`: checkout `ref: v1.1.0` / `ref: v0.12.0` and the
  matching paths/assertions.
- `tests/app-contract.test.mjs`: assert the `v1.1.0` / `v0.12.0` tuple.
- `tests/appearance-consumption.test.mjs`: update the protocol comment only.
- `README.md`, `AGENTS.md`, `.gitignore` and `CHANGELOG.md`: update the live
  tuple wording; keep historical CHANGELOG entries unchanged and add a v0.5.2
  entry.

App ownership stays untouched: no `app.tsx`, `lib/`, `ui/`, `style.css`,
handler/ack, layout-token, `wallpaper.state` subscription or lane-policy
changes. Historical ticket text, protocol comments in app code and the frozen
`templates/` copy keep their recorded provenance.

## Done-when

`make gates` passes against the local `ags-platform` `v1.1.0` and
`contracts` `v0.12.0` checkouts, the ticket branch fast-forwards `main`, and
`v0.5.2` is tagged (annotated) and pushed with `main`.

## Evidence

Opening commit `618c0f0`; implementation commit `77f8581` on
`ticket/OPS-002-dev-pin-parity` (worktree `.worktrees/OPS-002/`).

### Pins

`Evidence:` `Makefile:8-9` pins `AGS_PLATFORM_VERSION := v1.1.0` and
`CONTRACTS_VERSION := v0.12.0`; `.github/workflows/ci.yml:38-50` checks out
`ref: v1.1.0` at `.dev/ags-platform/v1.1.0`, `ref: v0.12.0` at `contracts`,
and asserts the platform `index.ts`; `tests/app-contract.test.mjs:264-268`
asserts the tuple; the `appearance-consumption` gate comment names platform
v1.1.0.
`Verify:` `git show 77f8581 -- Makefile .github/workflows/ci.yml
tests/app-contract.test.mjs tests/appearance-consumption.test.mjs`.

`Evidence:` the remaining old-tuple mentions are historical or app-comment
provenance only: earlier CHANGELOG entries, OPS-001/REQ-002/REQ-006 ticket
text, and protocol comments in `app.tsx` / `lib/appearance.ts` (app code left
untouched by this pin-only change).
`Verify:` `grep -rn "v1\.0\.1\|v0\.8\.0" --exclude-dir=node_modules
--exclude-dir=.git --exclude-dir=@girs .`.

### Gates

Local overrides used for the gates (gitignored, not committed):

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make gates
```

`Evidence:` the `ags-platform` checkout `HEAD` equals `v1.1.0^{commit}`
`f20a68539ae4211604f253b7a54caefa81920262`; the `contracts` checkout `HEAD`
equals `v0.12.0^{commit}` `a03b5632828df8012c02a6117c3be438eca4264b`.
`Verify:` `git -C ../ags-platform rev-parse v1.1.0^{commit} HEAD`,
`git -C ../contracts rev-parse v0.12.0^{commit} HEAD`.

`make gates` → exit 0. Log: `/tmp/opencode/ops002-gates.log`.

- Node tests 24/24 pass (`fail 0`); `model.test.mjs` → 50 `ok`,
  `model: all green`.
- `app-contract.test.mjs` → 15/15 pass, including the platform
  `checkAppRepo` template gate, the contracts v0.12.0 manifest-schema check
  and the v1.1.0/v0.12.0 pin gate.
- Drift → 37 `ok`, `all checks passed` against contracts v0.12.0.
- Bundle → `build/ags-wallpaper-selector.js`, 1,080,860 bytes.
- Typecheck → 0 errors in the selector tree (28 tolerated
  `/usr/share/ags/js` errors, 0 `ags-platform` errors).

### Deviations

- Before the gate run, `make deps types platform-dev contracts-dev` was run
  once in the fresh worktree so `typescript` and the machine GIR declarations
  existed and `npm install --no-save` could not drop the `ags-platform` link
  mid-run (the OPS-001 ordering deviation). The gate command itself then ran
  cleanly; no Makefile change was made.
- `app.tsx` and `lib/appearance.ts` protocol comments still name contracts
  v0.8.0 / platform v1.0.0; they are app code, which this pin-only task must
  not change.
- No app behavior, `style.css`, layout tokens, `wallpaper.state`
  subscription, handler/ack or lane policy changed. `package.json` keeps
  `0.4.1` (the v0.5.x releases did not bump it; repo flow is the annotated
  tag).
- The release is the patch tag `v0.5.2` after the fast-forward merge to
  `main`, pushed with `main`. This repo tags only; it publishes no GitHub
  Release object. No deployment/apply was performed.
