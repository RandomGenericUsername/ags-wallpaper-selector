# Ticket index

> Counting rule: completeness checks cover item files (`tickets/<id>-<slug>/ticket.md`) only.
> `tickets/_template/` (and any `tickets/_fixtures/`) are excluded from INDEX completeness counting.
> Entry format: link — title | `status` | execution links. Epics add `done/total children done`, done-when, and one nested line per child. Bugs add severity. Spikes add timebox state.

## Epics

(none)

## Requirements

- [REQ-001-standalone-wallpaper-selector/ticket.md](./REQ-001-standalone-wallpaper-selector/ticket.md) — Extract the wallpaper selector into the standalone ags-wallpaper-selector repo | `done` | links: worktree none, branch main
- [REQ-002-skin-consumption/ticket.md](./REQ-002-skin-consumption/ticket.md) — Consume the app-scoped skin plane in the wallpaper selector | `done` | links: worktree `.worktrees/REQ-002/`, branch `ticket/REQ-002-skin-consumption`; merged to main, tagged v0.3.0
- [REQ-003-appearance-migration/ticket.md](./REQ-003-appearance-migration/ticket.md) — Migrate the wallpaper selector to the v2 Appearance plane | `in-progress` | links: worktree `.worktrees/REQ-003/`, branch `ticket/REQ-003-appearance-migration`

## Bugs

- [BUG-001-stale-producer-env](./BUG-001-stale-producer-env/ticket.md) — Wallpaper selector keeps using csg after tpr activation (stale RUNTIME__PALETTE__PRODUCER) | `done` | fixed by runtime v0.4.1 producer config; selector apply unchanged
- [BUG-002-removed-contrast-surface](./BUG-002-removed-contrast-surface/ticket.md) — Selector still calls the runtime's deleted contrast surface (cannot apply wallpapers) | `done` | severity high; fixed by c56e45b; CSS migrated to palette.v1 roles; gates green
- [BUG-003-hoverbar-apply-offset](./BUG-003-hoverbar-apply-offset/ticket.md) — L1 hover toolbar puts the Apply pill off-centre in its container | `done` | severity low; fixed by 3cf9dec; hoverbar now pads Apply symmetrically; gates green

## Ops tasks

(none)

## Spikes

(none)

## Tasks

(none)

## Done (links only, newest last)

(none)
