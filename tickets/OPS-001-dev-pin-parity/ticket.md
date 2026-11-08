---
id: OPS-001
title: "Bump the local ags-platform pin to v1.0.1"
kind: ops-task
status: in-progress
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
