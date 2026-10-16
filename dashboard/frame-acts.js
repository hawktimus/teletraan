// The acts of the logo: slam, nudge, the entrance, the spin and the hawk (part of frame.js).

import { frameState } from './frame-state.js';
import { effects, hawkActs, hawkNormalSeconds, spinNormalSeconds } from './frame-effects.js';
import { pace, wait, whenDone } from './frame-pages.js';
import { askToPlay, scaleOf } from './frame-play.js';

// Small moves while a panel is on screen

// Swap a number for a new one that drops in from above, hits, and settles
// with a small bounce, like a mechanical counter. The element must sit
// inside a parent with a fixed height and overflow: hidden, so only the
// new number shows.
export function slam(element, text) {
  element.textContent = text;
  if (frameState.motion !== 'full') return;

  element.animate(
    [
      { transform: 'translateY(-80%)', opacity: 0 },
      { transform: 'translateY(7%)', opacity: 1, offset: 0.55 },
      { transform: 'translateY(-3%)', offset: 0.8 },
      { transform: 'none' },
    ],
    { duration: 260 * pace(), easing: 'cubic-bezier(.5, 0, .2, 1)' }
  );
}

// The two chevrons beside the days number close in like jaws and open again
export function nudge(leftElement, rightElement) {
  if (frameState.motion !== 'full') return;

  const ease = 'cubic-bezier(.3, 0, .2, 1)';
  leftElement.animate(
    [
      { transform: 'none', easing: ease },
      { transform: 'translateX(14px)', offset: 0.35, easing: ease },
      { transform: 'none' },
    ],
    { duration: 700 * pace() }
  );
  rightElement.animate(
    [
      { transform: 'none', easing: ease },
      { transform: 'translateX(-14px)', offset: 0.35, easing: ease },
      { transform: 'none' },
    ],
    { duration: 700 * pace() }
  );
}


// The logo
//
// The logo's moves are effects like the others (see "Effects that play now
// and then" above): the entrance, the spin and the flying hawk. Each plays an
// act, or a few in a row, by setting data-act on the logo. frame.css has the
// rules for each act name.

// Plays one act and says when it is over. seconds is how long the act lasts at
// normal speed. Any mode but full motion gets the still emblem. An act that is
// already playing starts again from the beginning, which tools/logo.html needs.
export async function playLogoAct(logo, act, seconds) {
  if (logo.dataset.act === act && act !== 'rest') {
    logo.dataset.act = 'rest';
    void logo.getBoundingClientRect(); // lets the page notice the change before the next one
  }
  logo.dataset.act = frameState.motion === 'full' ? act : 'rest';

  await wait(seconds * 1000 * pace());
  await whenDone(logo);
}

// The logo can move: it is the banner's logo and it is on the page
export function logoCanMove() {
  return !!frameState.showLogo && frameState.showLogo.isConnected;
}

// Whether the play that has this run should carry on moving this logo. It
// should not once it has been ended (stopLogoEffects), or when the logo has
// gone, or the master switch is off, or the motion is not full.
function logoIsGoing(logo, run) {
  return frameState.playing === run && frameState.showLogo === logo && logo.isConnected && frameState.logoAnimationsOn && frameState.motion === 'full';
}

// Back to the still emblem. The time scales go with it, so an act played by
// hand later (tools/logo.html) runs at its normal time.
function restLogo(logo) {
  logo.dataset.act = 'rest';
  logo.style.removeProperty('--spin-scale');
  logo.style.removeProperty('--hawk-scale');
}

// The entrance: the plates fly in
export async function playEntranceNow(seconds, run) {
  const logo = frameState.showLogo;

  await playLogoAct(logo, 'boot', seconds);
  if (frameState.playing === run) restLogo(logo);
}

// The spin. --spin-scale stretches the time of the turn in frame.css, so the
// turn lasts the seconds in the setting.
export async function playSpinNow(seconds, run) {
  const logo = frameState.showLogo;

  logo.style.setProperty('--spin-scale', String(scaleOf(seconds, spinNormalSeconds)));
  await playLogoAct(logo, 'turn', seconds);
  if (frameState.playing === run) restLogo(logo);
}

// The flying hawk: the four acts one after the other. --hawk-scale stretches
// every time in them in frame.css, and the acts here are stretched the same,
// so the whole sequence lasts the seconds in the setting.
export async function playHawkNow(seconds, run) {
  const logo = frameState.showLogo;
  const scale = seconds / hawkNormalSeconds;

  logo.style.setProperty('--hawk-scale', String(scaleOf(seconds, hawkNormalSeconds)));
  for (const act of hawkActs) {
    if (!logoIsGoing(logo, run)) break;
    await playLogoAct(logo, act[0], act[1] * scale);
  }
  if (frameState.playing === run) restLogo(logo);
}

// Takes over the logo that the effects move, and starts them counting. The
// entrance plays first, if its switch and the master switch are on. Starting a
// logo again (tools/logo.html) starts it all again, once it has been stopped.
// A logo that takes the place of the one on screen is the same show: a swap
// draws the banner again when the style or the layout changes, and the counts
// go on, or the hawk would play again 13 seconds after every swap.
export function startLogo(logo) {
  const replaced = frameState.showLogo !== null;

  frameState.showLogo = logo;
  restLogo(logo);

  // Anything waiting for the old logo is dropped, so the entrance comes first
  frameState.waiting = frameState.waiting.filter(entry => !effects[entry.name].logo);

  if (!replaced) {
    const now = performance.now();
    Object.keys(effects).forEach(name => {
      if (!effects[name].logo) return;
      effects[name].lastStarted = null;
      effects[name].countFrom = now;
    });
  }

  if (frameState.logoAnimationsOn && frameState.entranceOn) askToPlay('entrance', true);
}

// Ends the effects on a logo and leaves it a still emblem (tools/logo.html uses it)
export function stopLogo(logo) {
  if (frameState.showLogo === logo) {
    frameState.showLogo = null;
    if (frameState.playing && effects[frameState.playing.name].logo) frameState.playing = null;
  }
  restLogo(logo);
}

// A logo that flies for as long as it is on screen (the announcements). It
// runs on --pace, so a change of Speed changes it while it flies. Calm and
// none show the hawk still, in frame.css. With the master switch off it is the
// still emblem.
export function flyLogo(logo) {
  logo.dataset.act = frameState.logoAnimationsOn ? 'fly' : 'rest';
}

// Ends whatever the logo is doing at once and leaves the still emblem. The
// play that was going sees it is no longer the one playing and stops by
// itself. Used by the master switch, and by a play asked for by hand.
export function stopLogoEffects() {
  if (frameState.playing && effects[frameState.playing.name].logo) {
    if (frameState.playing.name === 'name') stopNameEffect();
    frameState.playing = null;
  }
  restLogos();
}

export function stopNameEffect() {
  const name = document.querySelector('[data-name-effect]');
  if (name) name.classList.remove('splitting');
}

// Also called when the motion setting leaves full: a logo in the middle of an
// act goes back to rest at once, because the act's pose would otherwise stay.
export function restLogos() {
  if (frameState.showLogo) restLogo(frameState.showLogo);
}
