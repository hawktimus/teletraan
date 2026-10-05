// Play announcements: the plain functions. They know nothing about the page, so
// tools/test-effects.mjs can run them. core/announce-run.js hands them the real
// screen, and runAnnouncement in core/takeover.js draws each announcement.
//
// How it goes (docs/hidden-transitions.md, "Play announcements"):
//   1. Someone clicks "Play announcements" on Dashboard Settings in the Studio. That
//      writes the time now into announceRequest and publishes.
//   2. The screen reads the settings with the rest of the content and looks at them
//      every second (makeAnnounceRunner().look).
//   3. A request plays only if it is less than a minute old and is not the one handled
//      before, the same guard as a demo (shouldRunDemo in core/demo.js). The one handled
//      before is kept in localStorage, so a Mini that restarts never plays it again.
//   4. It waits while an alert, an announcement, night mode, a demo or a hidden
//      transition has the screen.
//   5. It plays every announcement that is switched on, once, one after another, each
//      at its own length. The time and the days of an announcement are ignored, because
//      this is "now" and not 14:30. With none switched on, nothing plays.

import { defaultSettings } from '../config.js';
import { readHandled, rememberHandled, shouldRunDemo } from './demo.js';

export const handledKey = 'teletraan-announce-handled';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// The announceRequest of Dashboard Settings, always complete: { requestedAt }.
// A time that is not a time is empty, which is no request.
export function tidyAnnounceRequest(raw) {
  const source = isRecord(raw) ? raw : {};
  const requestedAt = typeof source.requestedAt === 'string' && !isNaN(Date.parse(source.requestedAt)) ? source.requestedAt : '';

  return { requestedAt: requestedAt };
}

// The handled request, kept under a name of its own in localStorage, apart from the
// demo's and the hidden transitions'
export function readHandledAnnounce(storage) {
  return readHandled(storage, handledKey);
}

export function rememberHandledAnnounce(storage, requestedAt) {
  return rememberHandled(storage, requestedAt, handledKey);
}

// A number of seconds that can be used, or the one the starting announcements have
function secondsOr(value, fallback) {
  return typeof value === 'number' && isFinite(value) && value > 0 ? value : fallback;
}

// The announcements to play now, in the order of Dashboard Settings: every one
// that is not switched off, as the { title, followUp, titleSeconds, followUpSeconds }
// that runAnnouncement plays. Its time and days are left out on purpose.
export function enabledAnnouncements(settings) {
  const list = isRecord(settings) && Array.isArray(settings.announcements) ? settings.announcements : [];
  const starting = defaultSettings.announcements[0];

  return list
    .filter(item => isRecord(item) && item.show !== false)
    .map(item => ({
      title: typeof item.title === 'string' ? item.title : '',
      followUp: typeof item.followUp === 'string' ? item.followUp : '',
      titleSeconds: secondsOr(item.titleSeconds, starting.titleSeconds),
      followUpSeconds: secondsOr(item.followUpSeconds, starting.followUpSeconds),
    }));
}

// Plays the announcements one after another.
//   announcements  the list from enabledAnnouncements
//   playOne(config)  starts one and gives back a promise that is done when it is over
//   shouldStop()   asked before each one. When it says true, the rest do not play.
// The Demo step "All announcements" (core/demo-screens.js) uses this too.
export async function playEach(announcements, playOne, shouldStop) {
  for (const config of announcements) {
    if (shouldStop()) return;
    await playOne(config);
  }
}

// The runner. deps is what it needs from the page, so that the tests can give it fakes:
//   getContent()        the newest content
//   storage             localStorage, or null when the browser has none
//   pauseRotation(), resumeRotation()   stop and start the normal pages changing
//   takeoverRunning()   true while an alert or an announcement covers the screen
//   demoRunning()       true while a demo plays
//   nightIsUp()         true while the night screen is up
//   hiddenPlaying()     true while a hidden transition plays
//   alertsStarted()     how many alerts have started so far
//   playAnnouncement(config, shouldStop)   plays one, as runAnnouncement in core/takeover.js does
// Call look(now) once a second.
export function makeAnnounceRunner(deps) {
  // Read once and then kept here as well, so that a storage that fails still stops
  // the same request from playing twice while the page is open
  let handled = readHandledAnnounce(deps.storage);
  let running = null; // { requestedAt, cancelled, alerts } while the announcements play
  let playing = Promise.resolve();

  // A real alert ends it: it counted one more alert since the first announcement began
  function stopped(run) {
    return run.cancelled || deps.alertsStarted() !== run.alerts;
  }

  function busy() {
    return deps.takeoverRunning() || deps.demoRunning() || deps.nightIsUp() || deps.hiddenPlaying();
  }

  // The first announcement must start in the same breath as the look that decided to
  // play, so that the demo and the hidden transitions see the screen is taken
  async function play(list, run) {
    deps.pauseRotation();
    try {
      await playEach(
        list,
        config => deps.playAnnouncement(config, () => stopped(run)),
        // something else has the screen between two announcements: this is over
        () => stopped(run) || deps.takeoverRunning()
      );
    } finally {
      deps.resumeRotation();
      running = null;
    }
  }

  function look(now) {
    const content = deps.getContent();
    if (!content || !content.settings) return;
    const requestedAt = tidyAnnounceRequest(content.settings.announceRequest).requestedAt;

    // A new push while these play ends them, and the new one starts at a later look
    if (running) {
      if (requestedAt !== running.requestedAt) running.cancelled = true;
      return;
    }

    if (!shouldRunDemo(requestedAt, handled, now)) return;
    if (busy()) return;

    // Handled from here on, even when there is nothing to play: enabling an
    // announcement a few seconds later does not bring this request back to life
    handled = requestedAt;
    rememberHandledAnnounce(deps.storage, handled);

    const list = enabledAnnouncements(content.settings);
    if (list.length === 0) return;

    const run = { requestedAt: requestedAt, cancelled: false, alerts: deps.alertsStarted() };
    running = run;
    playing = play(list, run).catch(error => console.error('Play announcements failed', error));
  }

  return {
    look: look,
    isRunning: () => running !== null,
    // A promise that is done when the announcements that are playing have ended. For the tests.
    whenIdle: () => playing,
  };
}
