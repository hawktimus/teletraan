// Whether a transition has the screen: a swap (core/swap-run.js) or a hidden transition
// (core/hidden-run.js). Each says so with setBusy(true) when it starts and setBusy(false) when it is
// over, and the things that must not move meanwhile, such as the glitch of the team name, ask isBusy().
// It counts, so two that overlap for a moment do not let the screen go early.

let holds = 0;

export function setBusy(on) {
  holds = Math.max(0, holds + (on ? 1 : -1));
}

export function isBusy() {
  return holds > 0;
}
