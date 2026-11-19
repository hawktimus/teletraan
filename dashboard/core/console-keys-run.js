// The console keys on the page (core/console-keys.js says which keys and why). Started by shell.js only when the
// address has ?keys=console.
//
// Leaving and the control page need the watcher of the Pi (computer/pi/exit-watch.py), which listens on this
// computer behind /pi/ of the web server: the page cannot close its own browser. A page that is not on the Pi gets no
// answer there and nothing happens.

import * as frame from '../frame.js';
import { backStep, moveOn } from './schedule.js';
import { consoleAction, consoleKeysFree, controlAddress, leaveAddress, pageAddress } from './console-keys.js';
import { decksOpen } from './decks-run.js';
import { demoRunning } from './demo-runner.js';
import { hiddenPlaying } from './hidden-run.js';
import { nightIsUp } from './night-screen.js';
import { talkOnScreen } from './presentation-run.js';
import { swapRunning } from './swap-run-play.js';
import { takeoverRunning } from './takeover.js';

let busyAt = 0; // when a talk or the list of presentations was last seen on the screen

function busyNow() {
  return talkOnScreen() || decksOpen();
}

// True while the large panel must be left alone: something else has the screen, or a swap is playing. The same
// things Next look now waits for (busy in core/views-run.js).
function panelBusy() {
  return swapRunning() || takeoverRunning() || demoRunning() || nightIsUp() || hiddenPlaying();
}

// The watcher is told and never waited for. No answer is not a problem of the page. Nothing is sent but the address.
function tell(address) {
  return fetch(address, { cache: 'no-store', keepalive: true }).catch(() => null);
}

function onKey(event) {
  const action = consoleAction(event);
  if (action === null) return;

  const now = Date.now();
  if (busyNow()) busyAt = now;
  if (!consoleKeysFree(busyNow(), busyAt, now)) return;

  event.preventDefault();
  if (action === 'next' && !panelBusy()) moveOn(['grid1']);
  if (action === 'back' && !panelBusy()) backStep();
  if (action === 'leave') tell(leaveAddress);
  if (action === 'control') {
    // The watcher is told first, so that Esc on the control page leaves as well
    tell(pageAddress + 'control').then(() => {
      window.location.href = controlAddress;
    });
  }
}

export function startConsoleKeys() {
  window.addEventListener('keydown', onKey, true);
  frame.onSecond(() => {
    if (busyNow()) busyAt = Date.now();
  });
  tell(pageAddress + 'dashboard');
}
