// The keys of a Teletraan that is used like a game console: the copy on the Raspberry Pi, which is started from
// EmulationStation and has a keyboard or a controller in front of it (computer/pi/README.md). The plain part, so a
// node test can run it. core/console-keys-run.js gives it the real page.
//
// They are off unless the address of the page says ?keys=console, which only the Pi launcher adds. The screen
// on the wall never has them.
//
//   X            the large panel changes to its next step now      (A on a controller set up the RetroPie way)
//   Z            the large panel goes back one step                (B)
//   Esc          leaves the dashboard, back to the menu
//   Right Shift  opens the control page                            (Select)
//
// A talk and the list of presentations keep their own keys: while one of them has the screen, and for a moment
// after, these keys do nothing, so the Esc that ends a talk or closes the list does not also leave the dashboard.
//
// The Meeting system of EmulationStation adds &meeting=1 to the address. The page then opens on the list of
// presentations, shows it again when a talk is over, and Esc in the list leaves (core/decks-run.js).

export const consoleParameter = 'keys';
export const consoleValue = 'console';
export const meetingParameter = 'meeting';
export const quietMs = 1500; // how long the keys stay off after a talk or the list had the screen
export const controlAddress = '/control/';
export const leaveAddress = '/pi/leave';
export const pageAddress = '/pi/page/';

// True when the address of the page asks for the console keys. search is location.search.
export function consoleKeysOn(search) {
  try {
    return new URLSearchParams(search || '').get(consoleParameter) === consoleValue;
  } catch (error) {
    return false;
  }
}

// True when the Pi launcher asked for the meeting page: the console keys are on and the address says meeting=1
export function meetingOn(search) {
  try {
    return consoleKeysOn(search) && new URLSearchParams(search || '').get(meetingParameter) === '1';
  } catch (error) {
    return false;
  }
}

// What a key press asks for: 'next', 'back', 'leave', 'control', or null for a key that is not one of these, is
// held down, or comes with Ctrl, Alt or the command key. event is the parts of a keydown that matter.
export function consoleAction(event) {
  if (!event || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return null;
  if (event.code === 'ShiftRight') return 'control';
  if (event.key === 'Escape') return 'leave';

  const letter = typeof event.key === 'string' && event.key.length === 1 ? event.key.toLowerCase() : '';
  if (letter === 'x') return 'next';
  return letter === 'z' ? 'back' : null;
}

// True when the keys may act: nothing else has the screen now, and nothing had it in the last moment.
// busyAt is when a talk or the list was last seen on the screen, in milliseconds, or 0 for never.
export function consoleKeysFree(busyNow, busyAt, now) {
  return !busyNow && now - busyAt >= quietMs;
}
