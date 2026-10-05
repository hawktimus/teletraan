// The one clock of the screen. Panels ask to be told when each second starts
// (frame.onSecond in frame.js) and this file works out when that is.
//
// It does not count. A timer that repeats every 1000 ms, or one that waits
// 1000 ms again after each tick, slowly drifts away from the real seconds, and
// after the page has been busy it can fire several times in a row to catch up.
// Here every tick reads the real clock, runs the listeners once with that
// time, and sets a single timer for the start of the next real second. A late
// tick just makes the next wait shorter, so the ticks stay on the seconds of
// the clock however long the page was busy.

// A timer may wake a hair before the time it was given. Aiming a few ms past
// the start of the second keeps the wake-up inside the new second.
export const marginMs = 5;

// How long to wait, from the time nowMs, for just after the next real second
export function msToNextSecond(nowMs) {
  return 1000 - (nowMs % 1000) + marginMs;
}

// clock is only passed by the tests: { now(), setTimeout(action, milliseconds) }.
// The screen uses the real one, which looks up the browser's functions when it
// is called so a test can replace them.
export function makeSecondTimer(clock) {
  const real = clock || {
    now: () => Date.now(),
    setTimeout: (action, milliseconds) => setTimeout(action, milliseconds),
  };
  const listeners = [];
  let running = false;
  let lastSecond = null;

  // Pass the panel's element as well, so the listener is dropped
  // automatically once that panel has left the page.
  function onSecond(listener, element) {
    listeners.push({ listener: listener, element: element || null });
  }

  function tick() {
    const nowMs = real.now();

    // Set the next tick first, so a listener that fails cannot stop the clock
    real.setTimeout(tick, msToNextSecond(nowMs));

    // A tick that came before the second changed (a timer that woke early)
    // has nothing to tell anyone
    const second = Math.floor(nowMs / 1000);
    if (second === lastSecond) return;
    lastSecond = second;

    const now = new Date(nowMs);
    listeners.slice().forEach(entry => {
      if (entry.element && !entry.element.isConnected) {
        const index = listeners.indexOf(entry);
        if (index !== -1) listeners.splice(index, 1);
        return;
      }
      try {
        entry.listener(now);
      } catch (error) {
        console.error(error);
      }
    });
  }

  // Starts the first tick now. Calling it again does not start a second clock.
  function start() {
    if (running) return;
    running = true;
    tick();
  }

  return { onSecond: onSecond, start: start };
}
