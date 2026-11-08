---
id: OPS-001
title: "Bump the local ags-platform pin to v1.0.1"
kind: ops-task
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/OPS-001/
branch: ticket/OPS-001-dev-pin-parity
---

# Bump the local ags-platform pin to v1.0.1

## Work

Move the local-only `ags-platform` pin from `v1.0.0` to `v1.0.1` for
dev-pin parity with the platform's latest tag. Keep `contracts` at `v0.8.0`.

- `Makefile`: `AGS_PLATFORM_VERSION := v1.0.1`, plus the tuple comments and
  the help text's `.dev/ags-platform/v1.0.1` path.
- `.github/workflows/ci.yml`: checkout `ref: v1.0.1` and the matching
  `.dev/ags-platform/v1.0.1` path/assertion.
- `tests/app-contract.test.mjs`: assert the `v1.0.1` / `v0.8.0` tuple.
- `README.md`, `AGENTS.md`, `CHANGELOG.md` and `.gitignore`: update the live
  tuple wording (`v1.0.1` / `v0.8.0`); keep the historical v0.5.0 CHANGELOG
  entry unchanged and add a v0.5.1 entry.

App ownership stays untouched: no `app.tsx`, `lib/`, `ui/`, `style.css`,
handler/ack, layout-token, `wallpaper.state` subscription or lane-policy
changes. Historical ticket text and the frozen `templates/` copy keep their
recorded provenance.

## Done-when

`make gates` passes against the local `ags-platform` `v1.0.1` and
`contracts` `v0.8.0` checkouts, the ticket branch fast-forwards `main`, and
`v0.5.1` is tagged (annotated) and pushed with `main`.

## Evidence

Opening commit `ccbd916`; implementation commit `02c905d` on
`ticket/OPS-001-dev-pin-parity` (worktree `.worktrees/OPS-001/`).

### Pins

`Evidence:` `Makefile:8-9` pins `AGS_PLATFORM_VERSION := v1.0.1` and
`CONTRACTS_VERSION := v0.8.0`; `.github/workflows/ci.yml:38-50` checks out
`ref: v1.0.1` at `.dev/ags-platform/v1.0.1` and asserts its `index.ts`;
`tests/app-contract.test.mjs:264-268` asserts the tuple.
`Verify:` `git show 02c905d -- Makefile .github/workflows/ci.yml
tests/app-contract.test.mjs`.

`Evidence:` the remaining `v1.0.0` mentions are historical or app-comment
provenance only: the `v0.5.0` CHANGELOG entry, REQ-006/historical ticket text,
and protocol comments in `app.tsx` / `lib/appearance.ts` (app code left
untouched by this pin-only change).
`Verify:` `grep -rn "v1\.0\.0" --exclude-dir=node_modules --exclude-dir=.git
--exclude-dir=@girs .`.

### Gates

Local overrides used for the gates (gitignored, not committed):

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make gates
```

`Evidence:` the `ags-platform` checkout `HEAD` equals `v1.0.1^{commit}`
`10b4d11cc4cc38cb68ebda7a849023206ad8b801`; the `contracts` checkout `HEAD`
equals `v0.8.0^{commit}` `8906f1ad95e10d649ff67d5f7be9dd662eb65fec`.
`Verify:` `git -C ../ags-platform rev-parse v1.0.1^{commit} HEAD`,
`git -C ../contracts rev-parse v0.8.0^{commit} HEAD`.

`make gates` → exit 0. Log: `/tmp/opencode/ops001-gates.log`.

- Node tests 24/24 pass (`fail 0`); `model.test.mjs` → 50 `ok`,
  `model: all green`.
- `app-contract.test.mjs` → 15/15 pass, including the platform
  `checkAppRepo` template gate and the v1.0.1/v0.8.0 pin gate.
- Drift → 37 `ok`, `all checks passed` against contracts v0.8.0.
- Bundle → `build/ags-wallpaper-selector.js`, 1,077,852 bytes.
- Typecheck → 0 errors in the selector tree (28 tolerated
  `/usr/share/ags/js` errors, 0 `ags-platform` errors).

### Deviations

- A fresh worktree has no `typescript`; the first `make gates` run let the
  `typecheck` prerequisites install it after `platform-dev` had already
  stopped for that invocation, so `npm install` dropped the
  `node_modules/ags-platform` link and `typecheck` aborted with
  `FAIL: typecheck: platform link missing`. Running `make deps` once, then the
  exact gate command, passed cleanly. No Makefile change was made.
- `app.tsx` and `lib/appearance.ts` protocol comments still name platform
  v1.0.0; they are app code, which this pin-only task must not change.
- No app behavior, `style.css`, layout tokens, `wallpaper.state`
  subscription, handler/ack or lane policy changed.
- The release is the patch tag `v0.5.1` after the fast-forward merge to
  `main`, pushed with `main`. This repo tags only; it publishes no GitHub
  Release object.
