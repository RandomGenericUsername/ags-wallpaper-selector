// ---------------------------------------------------------------------------
// PURE overlay state machine (REQ-005 §4).
//
// The overlay's visible state is explicit, never inferred from a timer or a
// hidden window: `closed`, `live`, `preview`, `look-preview`, `committing`.
// The two preview states are the same state with a different look focus; the
// badge and the selected chip are what differ.
//
// Invariants encoded here (and tested in `tests/state.test.mjs`):
//   * navigation never commits and never closes;
//   * browse never locks; only `committing` locks navigation;
//   * the live marker follows the live wallpaper+look, never the focus;
//   * the overlay does not leave `committing` before `done` or `error`;
//   * Esc/cancel never writes and never runs while committing;
//   * reopening always resets focus to the live item.
//
// PURE: no `ags`, no `gi://*`, no I/O.
// ---------------------------------------------------------------------------

export type OverlayPhase =
  | "closed"
  | "live"
  | "preview"
  | "look-preview"
  | "committing";

export type OverlayPage = "main" | "grid";

export type CommitStep = 0 | 1 | 2 | 3;

export interface OverlayFocus {
  /** Index into the model's wallpaper list. */
  index: number;
  /** 0 = Original, 1.. = generated variants. */
  look: number;
}

export interface CommitState {
  target: OverlayFocus;
  step: CommitStep;
  /** 0..1, driven by the three real event steps (never a continuous timer). */
  progress: number;
  error: string | null;
}

export interface OverlayState {
  phase: OverlayPhase;
  page: OverlayPage;
  focus: OverlayFocus;
  /** The live item; null when `current.json` names nothing this model knows. */
  live: OverlayFocus | null;
  commit: CommitState | null;
  gridQuery: string;
}

export interface CommitEvent {
  state: "applying" | "visible" | "done" | "error";
  error?: string;
}

export const COMMIT_STEP_LABELS = [
  "Swapping pixels…",
  "Building palette…",
  "Updating icons…",
] as const;

export function initialState(
  liveIndex: number | null,
  liveLook = 0,
  fallbackIndex = 0,
): OverlayState {
  const live =
    liveIndex === null ? null : { index: liveIndex, look: Math.max(0, liveLook) };
  return {
    phase: live === null ? "preview" : "live",
    page: "main",
    focus: live ?? { index: Math.max(0, fallbackIndex), look: 0 },
    live,
    commit: null,
    gridQuery: "",
  };
}

export function isLiveFocus(state: OverlayState): boolean {
  return (
    state.live !== null &&
    state.live.index === state.focus.index &&
    state.live.look === state.focus.look
  );
}

/** The phase implied by a focus, used after navigation and look changes. */
export function phaseForFocus(
  state: OverlayState,
  focus: OverlayFocus,
): OverlayPhase {
  if (state.live !== null && state.live.index === focus.index) {
    if (state.live.look === focus.look) return "live";
  }
  return focus.look === 0 ? "preview" : "look-preview";
}

function withFocus(state: OverlayState, focus: OverlayFocus): OverlayState {
  return {
    ...state,
    focus,
    phase: phaseForFocus(state, focus),
    page: "main",
    commit: null,
  };
}

/** Move the wallpaper focus. Navigation resets the look to Original. */
export function focusWallpaper(
  state: OverlayState,
  index: number,
): OverlayState {
  if (state.phase === "committing" || state.phase === "closed") return state;
  return withFocus(state, { index, look: 0 });
}

/** Change the look focus. The caller owns the look-count wrap. */
export function focusLook(state: OverlayState, look: number): OverlayState {
  if (state.phase === "committing" || state.phase === "closed") return state;
  return withFocus(state, { ...state.focus, look: Math.max(0, look) });
}

/** Step the look focus with wrap. A single look is a no-op. */
export function stepLook(
  state: OverlayState,
  delta: number,
  lookCount: number,
): OverlayState {
  if (state.phase === "committing" || state.phase === "closed") return state;
  if (lookCount < 2) return state;
  const current = Math.min(state.focus.look, lookCount - 1);
  const next = ((current + delta) % lookCount + lookCount) % lookCount;
  return focusLook(state, next);
}

/** `G` / `/`: a secondary finder; the focus and phase are preserved. */
export function openGrid(state: OverlayState, resetQuery = true): OverlayState {
  if (state.phase === "committing" || state.phase === "closed") return state;
  return { ...state, page: "grid", gridQuery: resetQuery ? "" : state.gridQuery };
}

export function setGridQuery(state: OverlayState, query: string): OverlayState {
  return { ...state, gridQuery: query };
}

export function closeGrid(state: OverlayState): OverlayState {
  if (state.page !== "grid") return state;
  return { ...state, page: "main", gridQuery: "" };
}

/**
 * `Set` / `Enter`: capture the target and lock navigation. The only commit
 * entry point; a live focus is a no-op.
 */
export function beginCommit(state: OverlayState): OverlayState {
  if (state.phase === "committing" || state.phase === "closed") return state;
  if (isLiveFocus(state)) return state;
  return {
    ...state,
    page: "main",
    phase: "committing",
    commit: {
      target: { ...state.focus },
      step: 0,
      progress: 0,
      error: null,
    },
  };
}

/** Map one `wallpaper.state` value to a visible step. */
export function commitEvent(
  state: OverlayState,
  event: CommitEvent,
): OverlayState {
  if (state.phase !== "committing" || state.commit === null) return state;
  if (event.state === "error") {
    return failCommit(state, event.error ?? "wallpaper set failed");
  }
  const step: CommitStep =
    event.state === "applying" ? 1 : event.state === "visible" ? 2 : 3;
  return {
    ...state,
    commit: { ...state.commit, step, progress: step / 3, error: null },
  };
}

/** `done`: the target becomes live and the overlay holds before hiding. */
export function finishCommit(state: OverlayState): OverlayState {
  if (state.phase !== "committing" || state.commit === null) return state;
  const target = state.commit.target;
  return {
    ...state,
    phase: "live",
    page: "main",
    focus: { ...target },
    live: { ...target },
    commit: null,
    gridQuery: "",
  };
}

/** A failure keeps the preview and never marks the target live. */
export function failCommit(state: OverlayState, error: string): OverlayState {
  if (state.phase !== "committing" || state.commit === null) return state;
  const target = state.commit.target;
  return {
    ...state,
    phase: phaseForFocus(state, target),
    page: "main",
    focus: { ...target },
    commit: { ...state.commit, error, step: 0, progress: 0 },
  };
}

/** Esc from any visible non-committing state: hide, never write. */
export function cancelOverlay(state: OverlayState): OverlayState {
  if (state.phase === "committing") return state;
  return {
    ...state,
    phase: "closed",
    page: "main",
    commit: null,
    gridQuery: "",
  };
}

/** Update the live marker without moving the user's focus. */
export function refreshLive(
  state: OverlayState,
  liveIndex: number | null,
  liveLook = 0,
): OverlayState {
  const live =
    liveIndex === null ? null : { index: liveIndex, look: Math.max(0, liveLook) };
  if (state.phase === "committing") return { ...state, live };
  return { ...state, live, phase: phaseForFocus({ ...state, live }, state.focus) };
}

/** Reopen always lands on the live item, never a stale preview. */
export function reopen(
  state: OverlayState,
  liveIndex: number | null,
  liveLook = 0,
  fallbackIndex = 0,
): OverlayState {
  const live =
    liveIndex === null ? null : { index: liveIndex, look: Math.max(0, liveLook) };
  return {
    ...state,
    phase: live === null ? "preview" : "live",
    page: "main",
    focus: live ?? { index: Math.max(0, fallbackIndex), look: 0 },
    live,
    commit: null,
    gridQuery: "",
  };
}

/** The badge word (text, never colour alone). */
export function stateLabel(
  state: OverlayState,
  lookName: string,
): string {
  if (state.phase === "committing") return "Setting…";
  if (isLiveFocus(state)) return "Live";
  if (state.focus.look === 0) return "Preview";
  return `Preview · ${lookName}`;
}

export function commitStepLabel(step: CommitStep): string {
  if (step <= 0) return COMMIT_STEP_LABELS[0];
  return COMMIT_STEP_LABELS[Math.min(step, 3) - 1];
}
