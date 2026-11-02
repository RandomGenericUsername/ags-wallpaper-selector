# Ticket index

> Counting rule: completeness checks cover item files (`tickets/<id>-<slug>/ticket.md`) only.
> `tickets/_template/` (and any `tickets/_fixtures/`) are excluded from INDEX completeness counting.
> Entry format: link — title | `status` | execution links. Epics add `done/total children done`, done-when, and one nested line per child. Bugs add severity. Spikes add timebox state.

## Epics

(none)

## Requirements

- [REQ-001-standalone-wallpaper-selector/ticket.md](./REQ-001-standalone-wallpaper-selector/ticket.md) — Extract the wallpaper selector into the standalone ags-wallpaper-selector repo | `done` | links: worktree none, branch main

## Bugs

- [BUG-001-stale-producer-env](./BUG-001-stale-producer-env/ticket.md) — Wallpaper selector keeps using csg after tpr activation (stale RUNTIME__PALETTE__PRODUCER) | `done` | fixed by runtime v0.4.1 producer config; selector apply unchanged
- [BUG-002-removed-contrast-surface](./BUG-002-removed-contrast-surface/ticket.md) — Selector still calls the deleted icon-contrast surface (cannot apply wallpapers) | `in-progress` | severity high; worktree .worktrees/BUG-002/, branch ticket/BUG-002-removed-contrast-surface

## Ops tasks

(none)

## Spikes

(none)

## Tasks

(none)

## Done (links only, newest last)

(none)
