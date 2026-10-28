# Changelog

## v0.1.0 — 2026-10-27

- Extract the wallpaper selector from `ags-apps` v0.5.0 into the standalone
  `ags-wallpaper-selector` repo (repo root is the app package).
- Identity: app/instance `wallpaper-selector`, config dir
  `ags-wallpaper-selector`, window `wallpaper-selector-window`, launcher
  `wallpaper-selector-ui`, keybind description “Open wallpaper selector”.
- Keep the real v0.5.0 `palette-refresh` handler: re-apply the Theme pointer and
  rebuild the registry-backed search icon; the drawer, query, selection,
  contrast choices and in-flight apply state are preserved. Add hash
  idempotency and the retryable-failure contract.
- Keep the model, scan, thumbnail, apply and contrast modules as-is.
- Keep the app tests (model, BUG-002 Apply-collapse) and the
  `wallpaper.state` contract-drift gate.
- Add the standalone dev flow (`AGENTS.md`, tickets, worktree guard, Makefile,
  CI, tests, `templates/ags-app/`) and the manifest/handler conformance gate.
- Pin the local-only v0.3.0 `ags-platform` / `contracts` tuple via `.dev/`
  symlinks.
