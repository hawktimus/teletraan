// A flag that says a transition is running: a change of look, a hidden transition, any move of the
// whole screen. Whatever runs one calls setBusy(true, reason) when it starts and setBusy(false, reason)
// when it ends: the swap (core/swap-run.js) is 'swap' and a hidden transition (core/hidden-run.js) is 'hidden'.
//
// frame.js asks isBusy() before it starts an effect that comes due on its own: the name effect, the
// glitch of the screen and the name glitch of the Neon Prime kit do not start while it is set, and
// the first two end at the next look (every 250 ms) if they are playing when it is set. The name
// glitching in the middle of a change is what this is for.
//
// Each reason is held once, so two transitions that overlap do not end each other's hold: the flag is
// set until every reason has let go. Without a reason it is one called transition.

const reasons = new Set();

export function setBusy(on, reason = 'transition') {
  if (on === true) reasons.add(reason);
  else reasons.delete(reason);
}

// True while any reason holds the effects
export function isBusy() {
  return reasons.size > 0;
}
