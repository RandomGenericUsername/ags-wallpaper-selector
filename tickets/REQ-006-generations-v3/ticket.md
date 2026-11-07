---
id: REQ-006
title: "Move the wallpaper selector to Generations v3"
kind: requirement
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-006/
branch: ticket/REQ-006-generations-v3
---

# Move the wallpaper selector to Generations v3

## Requirement

The program tuple moves to `ags-platform` v1.0.0 / `contracts` v0.8.0
(Generations v3; runtime v1.0.0). Platform v1.0.0's
`createAppearanceRefreshHandler` implements the generation-bound
`appearance-refresh <genHash>` protocol, and `createAppearance` reads
`$XDG_STATE_HOME/dotfiles/current/manifest.json` plus
`current/appearance/<configDir>.css`. The selector must adopt that tuple
without changing its app-owned behavior:

- The local pins in `Makefile` (and the CI checkout refs) are
  `ags-platform` v1.0.0 / `contracts` v0.8.0.
- `app.tsx` keeps exactly one module-scope
  `createAppearance({ configDir: "ags-wallpaper-selector" })`, still calls
  `appearance.apply()` in `main()`, and still registers
  `createAppearanceRefreshHandler(appearance, work)` with the search-icon
  work.
- The handler answers the v3 `appearance-refresh <genHash>` protocol only;
  the removed v2 `palette-refresh` acknowledgement is not asserted anywhere
  in the source tests.
- The `wallpaper.state` progress subscription and the namespaced layout
  tokens with their `960` / `640` fallbacks are unchanged.
- `make gates` passes with local `.dev/` overrides, the branch fast-forwards
  into `main`, and `v0.5.0` (next minor) is tagged and pushed with `main`.

## Acceptance

- [x] `Makefile` and `.github/workflows/ci.yml` pin platform v1.0.0 and
      contracts v0.8.0; the pin gate asserts the new tuple.
- [x] `tests/unit.test.mjs` exercises `appearance-refresh <genHash>`: apply
      before work, one exact-hash response, idempotent work per generation,
      deferred on a moved pointer, and a retryable apply failure. No v2
      `{ok:true}` or `palette-refresh` assertion remains.
- [x] `app.tsx`, `lib/appearance.ts` and `ui/WallpaperSelectorWindow.tsx`
      keep the same appearance/apply/handler and `wallpaper.state` behavior;
      stale protocol comments name v3.
- [x] `make gates` passes with local `.dev/ags-platform/v1.0.0` and
      `.dev/contracts/v0.8.0` symlinks.
- [x] The ticket branch fast-forwards `main`, `v0.5.0` is tagged, and both
      `main` and the tag are pushed.

## Evidence

Implementation commit: `46fba1e` on
`ticket/REQ-006-generations-v3` (opened by `f1c3736`). Worktree
`.worktrees/REQ-006/`, branch `ticket/REQ-006-generations-v3`.

### Pins

`Evidence:` `Makefile:8-9` pins `AGS_PLATFORM_VERSION := v1.0.0` and
`CONTRACTS_VERSION := v0.8.0`; `.github/workflows/ci.yml:38-50` checks out the
same refs; `tests/app-contract.test.mjs:264-268` asserts the tuple;
`:245` names the contracts v0.8.0 schema.
`Verify:` `git show 46fba1e -- Makefile .github/workflows/ci.yml
tests/app-contract.test.mjs`.

### Generation-bound handler and unchanged wiring

`Evidence:` `app.tsx:39` still builds the one module-scope
`createAppearance({ configDir: "ags-wallpaper-selector" })`; `:59` still calls
`appearance.apply()` in `main()`; `:50` still registers
`createAppearanceRefreshHandler(appearance, () => …)` with
`rebuildSearchIcon: refreshWallpaperSelectorChrome`. The diff changes only
protocol comments in this file, not those expressions.
`Verify:` `git show 46fba1e -- app.tsx`.

`Evidence:` `tests/unit.test.mjs:37-149` executes the v3 helper and asserts:
apply runs before work and answers `{"applied":"<genHash>"}` (`:37`), the same
generation re-verifies `current` but runs work once (`:61`), a moved pointer is
deferred and runs no work (`:89`), a thrown apply is retryable (`:115`), and
the retired `palette-refresh` command is rejected without applying (`:150`).
`Verify:` `node --test tests/unit.test.mjs` → 7/7 pass.

`Evidence:` the progress subscription and layout tokens are untouched:
`ui/WallpaperSelectorWindow.tsx:42` declares `WALLPAPER_STATE_TOPIC =
"wallpaper.state"`, `:585` subscribes it, and `:84-88` reads
`layout.ags-wallpaper-selector.root-width` / `root-height`; `:188` feeds them
into `set_size_request`. The diff for this file is comments only.
`Verify:` `git show 46fba1e -- ui/WallpaperSelectorWindow.tsx`.

### Gates

Local overrides used for the gates (gitignored, not committed):

```sh
ln -sfn /home/inumaki/Development/dotfiles/ags-platform .dev/ags-platform/v1.0.0
ln -sfn /home/inumaki/Development/dotfiles/contracts .dev/contracts/v0.8.0
```

`Evidence:` `.dev/ags-platform/v1.0.0` resolves to the `ags-platform` sibling
checkout at `ca85672` (`v1.0.0^{commit}`); `.dev/contracts/v0.8.0` resolves to
the `contracts` sibling checkout at `8906f1a` (`v0.8.0^{commit}`); both
sibling `HEAD`s equal those tag commits.
`Verify:` `readlink -f .dev/ags-platform/v1.0.0`,
`git -C ../ags-platform rev-parse v1.0.0^{commit}`,
`git -C ../contracts rev-parse v0.8.0^{commit}`.

`make gates` → exit 0. Log: `/tmp/opencode/req006-gates.log`.

- Node tests 24/24 pass; `model.test.mjs` → `model: all green`.
- `app-contract.test.mjs` → 15/15 pass, including the platform
  `checkAppRepo` template gate and the v1.0.0/v0.8.0 pin gate.
- Drift → `all checks passed` against contracts v0.8.0.
- Bundle → `build/ags-wallpaper-selector.js`, 1,074,776 bytes.
- Typecheck → 0 errors in the selector tree (28 tolerated
  `/usr/share/ags/js` errors, 0 `ags-platform` errors).

### Deviations

- The runtime wiring is unchanged by design: `createAppearance`, the single
  `appearance.apply()`, the handler registration, the search-icon work, the
  `wallpaper.state` subscription and the layout tokens are the same code.
  Only protocol comments and the pin/test protocol changed.
- The app work callback still ignores the helper's `genHash` argument; the
  search-icon rebuild needs no generation-specific input.
- `templates/ags-app/` is the frozen copyable template and remains on its v2
  wording; it is not app runtime source and the platform gate excludes it.
  Historical ticket text (REQ-001…REQ-005) and older CHANGELOG entries keep
  their v2 provenance.
- The release is the next minor, `v0.5.0`, tagged after the fast-forward merge
  to `main`, and pushed with `main`.
