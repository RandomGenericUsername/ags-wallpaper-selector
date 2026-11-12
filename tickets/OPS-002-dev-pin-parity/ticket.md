---
id: OPS-002
title: "Bump the dev tuple to ags-platform v1.1.0 / contracts v0.12.0"
kind: ops-task
status: in-progress
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

Opening commit `PENDING`; implementation commit `PENDING` on
`ticket/OPS-002-dev-pin-parity` (worktree `.worktrees/OPS-002/`).

### Pins

`Evidence:` PENDING.
`Verify:` `git show PENDING -- Makefile .github/workflows/ci.yml
tests/app-contract.test.mjs`.

### Gates

Local overrides used for the gates (gitignored, not committed):

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make gates
```

`Evidence:` PENDING.
`Verify:` PENDING.

### Deviations

PENDING.
