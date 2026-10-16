// The watchdog on the Teletraan computer (computer/scripts/watchdog.sh) cannot read the page,
// but it can ask the browser for the page title. So every 30 seconds the page
// puts the time in its title. A title that stops changing means the page has
// frozen. The time is also kept in localStorage, which nginx cannot read but
// which a person can look at in the browser tools.

import { pad } from './time.js';

export const heartbeatSeconds = 30;
const heartbeatKey = 'teletraan-heartbeat';

// The title for a moment: Teletraan I, a middle dot and the clock as HH:MM
export function heartbeatTitle(now) {
  return 'Teletraan I · ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
}

export function beat(now = new Date()) {
  document.title = heartbeatTitle(now);
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
