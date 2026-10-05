// The Demo page: the plain functions. They know nothing about the page, so
// tools/test-effects.mjs can run them. core/demo-runner.js hands them the real
// screen, and core/demo-screens.js lists the screens a demo can show.
//
// How a demo goes:
//   1. Someone clicks "Run demo" in the Studio. That writes the time into
//      requestedAt on the Demo page and publishes it. "Stop demo" clears it.
//   2. The screen reads the Demo page with the rest of the content and looks at
//      it every second (makeDemoRunner().look).
//   3. A request starts a demo only if it is recent and is not the one handled
//      before (shouldRunDemo). The one handled before is kept in localStorage,
//      so a Mini that restarts a minute after a demo does not play it again.
//   4. The steps play once, in order. The normal pages stop changing while they
//      play, and the normal screen comes back when the last one ends.

import { defaultDemo, demoDefaultSeconds, demoMaxSteps, demoSkewSeconds, demoWindowSeconds, limits } from '../config.js';
import { demoScreens } from './demo-screens.js';

export const handledKey = 'teletraan-demo-handled';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isScreen(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(demoScreens, id);
}

// A number of seconds in the range the Studio allows. Anything that is not a
// number becomes the default.
function stepSeconds(value) {
  if (typeof value !== 'number' || !isFinite(value)) return demoDefaultSeconds;
  return Math.min(limits.demoSeconds.max, Math.max(limits.demoSeconds.min, value));
}

// The steps from the Demo page. A step with no screen, or a screen the
// dashboard does not have, is left out. More than demoMaxSteps are cut. A list
// the editors emptied stays empty (a demo with nothing in it plays nothing),
// and no list at all is the default one.
function tidySteps(raw) {
  if (!Array.isArray(raw)) return defaultDemo.steps.map(step => Object.assign({}, step));

  return raw
    .filter(step => isRecord(step) && isScreen(step.screen))
    .slice(0, demoMaxSteps)
    .map(step => ({ screen: step.screen, seconds: stepSeconds(step.seconds) }));
}

// The Demo document as content.demo, always complete: requestedAt, steps and
// announcementText. A missing document is no request, and the default steps.
export function tidyDemo(raw) {
  const source = isRecord(raw) ? raw : {};
  const requestedAt = typeof source.requestedAt === 'string' && !isNaN(Date.parse(source.requestedAt)) ? source.requestedAt : '';

  return {
    requestedAt: requestedAt,
    steps: tidySteps(source.steps),
    announcementText: typeof source.announcementText === 'string' ? source.announcementText.trim() : '',
  };
}

// Should this request start a demo now?
//   requestedAt  the time Run demo wrote, as the text Sanity holds. Empty when
//                Stop demo has cleared it, and then there is nothing to run.
//   lastHandled  the request that was handled before, or empty
//   now          a Date
// Yes when the request is not the one handled before and is no more than a
// minute old. It may be a few seconds in the future, which only means the
// computer that clicked the button has a clock a little ahead.
export function shouldRunDemo(requestedAt, lastHandled, now) {
  if (typeof requestedAt !== 'string' || requestedAt === '') return false;
  if (requestedAt === lastHandled) return false;

  const when = Date.parse(requestedAt);
  if (isNaN(when)) return false;

  const age = now.getTime() - when;
  return age <= demoWindowSeconds * 1000 && age >= -demoSkewSeconds * 1000;
}

// The handled request, from localStorage. A storage that cannot be read, or has
// nothing, gives an empty text, which is "nothing handled yet". The hidden
// transitions (core/hidden.js) use the same two functions with a key of their
// own, so a demo and a hidden transition never mistake each other's request.
export function readHandled(storage, key = handledKey) {
  try {
    return storage.getItem(key) || '';
  } catch (error) {
    return '';
  }
}

// Remembers the request. False when the storage cannot be written: the runner
// then still knows it from its own memory until the page is reloaded.
export function rememberHandled(storage, requestedAt, key = handledKey) {
  try {
    storage.setItem(key, requestedAt);
    return true;
  } catch (error) {
    return false;
  }
}

// The runner. deps is what it needs from the page, so that the tests can give
// it fakes:
//   getContent()       the newest content
//   screens            the registry, demoScreens in core/demo-screens.js
//   storage            localStorage, or null when the browser has none
//   pauseRotation(), resumeRotation()   stop and start the normal pages changing
//   pauseEffects(paused)                stop and start the logo effects and the glitch
//   takeoverRunning()  true while an alert or announcement covers the screen
//   alertsStarted()    how many alerts have started so far
//   wait(milliseconds) a promise that is done after that long
// Call look(now) once a second.
export function makeDemoRunner(deps) {
  // Read once and then kept here as well, so that a storage that fails still
  // stops the same request from playing twice while the page is open
  let handled = readHandled(deps.storage);
  let running = null; // { requestedAt, cancelled, alerts } while a demo plays
  let playing = Promise.resolve();

  // A real alert ends the demo: it counted one more alert since the demo began
  function alertCame(run) {
    return deps.alertsStarted() !== run.alerts;
  }

  function stopped(run) {
    return run.cancelled || alertCame(run);
  }

  async function waitUnlessStopped(run, seconds) {
    let left = seconds * 1000;
    while (left > 0 && !stopped(run)) {
      await deps.wait(250);
      left -= 250;
    }
  }

  async function playStep(step, run) {
    const screen = deps.screens[step.screen];
    if (!screen) return;

    const context = {
      seconds: step.seconds,
      getContent: deps.getContent,
      cancelled: () => stopped(run),
      waitSeconds: seconds => waitUnlessStopped(run, seconds),
    };

    try {
      const stop = await screen.run(context);
      if (typeof stop === 'function') {
        await context.waitSeconds(step.seconds);
        stop();
      }
    } catch (error) {
      console.error('The demo screen "' + step.screen + '" failed and is skipped', error);
    }
  }

  async function play(demo) {
    const run = { requestedAt: demo.requestedAt, cancelled: false, alerts: deps.alertsStarted() };
    running = run;
    deps.pauseRotation();
    deps.pauseEffects(true);

    try {
      for (const step of demo.steps) {
        // Something else has the screen between two steps: the demo is over
        if (stopped(run) || deps.takeoverRunning()) break;
        await playStep(step, run);
      }
    } finally {
      deps.pauseEffects(false);
      deps.resumeRotation();
      running = null;
    }
  }

  function look(now) {
    const content = deps.getContent();
    if (!content || !content.demo) return;
    const demo = content.demo;

    // Stop demo clears the request and a new Run demo changes it: either one
    // ends the demo that is playing. A new request then starts at a later look.
    if (running) {
      if (demo.requestedAt !== running.requestedAt) running.cancelled = true;
      return;
    }

    // An alert or announcement has the screen. A recent request waits for it to end.
    if (deps.takeoverRunning()) return;
    if (!shouldRunDemo(demo.requestedAt, handled, now)) return;

    handled = demo.requestedAt;
    rememberHandled(deps.storage, handled);
    playing = play(demo).catch(error => console.error('The demo failed', error));
  }

  return {
    look: look,
    isRunning: () => running !== null,
    // A promise that is done when the demo that is playing has ended. For the tests.
    whenIdle: () => playing,
  };
}
