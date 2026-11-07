// The watchdog on the Teletraan computer (computer/scripts/watchdog.sh) cannot read the page,
// but it can ask the browser for the page title. So every 30 seconds the page
// puts the time in its title. A title that stops changing means the page has
// frozen. The time is also kept in localStorage, which nginx cannot read but
// which a person can look at in the browser tools.
//
// A clock in the title only proves that a timer fired. It does not prove that anything was drawn, and the screen that
// goes half drawn when the TV is switched away is a screen whose timers still run and whose painting has stopped. So
// the clock is written only while frames are being painted (core/frames.js). When they are not, the title says FROZEN
// instead, and the watchdog restarts the screen for the right reason.

import { framesFresh } from './frames.js';
import { pad } from './time.js';

export const heartbeatSeconds = 30;
// A frame this recently is proof enough. The probe asks every two seconds, so this is many probes' worth of room: a
// page is never called frozen for being busy for a moment.
export const freshFrameSeconds = 30;
const heartbeatKey = 'teletraan-heartbeat';

// The title for a moment: Teletraan I, a middle dot and the clock as HH:MM
export function heartbeatTitle(now) {
  return 'Teletraan I · ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
}

// The title that tells the watchdog to restart the screen. It carries no clock, which is what watchdog.sh looks for.
export const frozenTitle = 'Teletraan I · FROZEN';

// Is the page painting, and is anyone looking? A page in a hidden tab is not painting and is not meant to be: the
// browser stops giving it frames. That is normal and must not be called frozen, so it keeps its clock.
export function titleFor(now, painting, hidden) {
  if (hidden) return heartbeatTitle(now);
  return painting ? heartbeatTitle(now) : frozenTitle;
}

function pageHidden() {
  try {
    return document.visibilityState === 'hidden';
  } catch (error) {
    return false;
  }
}

export function beat(now = new Date()) {
  const painting = framesFresh(freshFrameSeconds);
  document.title = titleFor(now, painting, pageHidden());
  try {
    window.localStorage.setItem(heartbeatKey, now.toISOString());
  } catch (error) {
    // storage may be blocked or full, and the title is what the watchdog reads
  }
}

export function startHeartbeat() {
  beat();
  setInterval(beat, heartbeatSeconds * 1000);
}
