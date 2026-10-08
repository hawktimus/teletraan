// Run presentation test: the plain functions. They know nothing about the page, so
// tools/test-effects.mjs can run them. core/presentation-test-run.js hands them the real
// screen, and startTestTalk in core/presentation-run.js puts the talk on it.
//
// How it goes (docs/hidden-transitions.md, "Run presentation test"):
//   1. Someone clicks "Run presentation test" on Dashboard Settings in the Studio. That
//      writes the time now into presentationTestRequest and publishes.
//   2. The screen reads the settings with the rest of the content and looks at them
//      every second (makePresentationTestRunner().look).
//   3. A request starts the test only if it is less than a minute old and is not the one
//      handled before, the same guard as a demo (shouldRunDemo in core/demo.js). The one
//      handled before is kept in localStorage, so a Mini that restarts never runs it again.
//   4. It waits while an alert, an announcement, a talk, night mode, a demo or a hidden
//      transition has the screen. With Run presentations off it waits too, and a request
//      that is still under a minute old runs when the switch is turned on.
//   5. It starts the sample talk from data/sample, with its start set to now. Its title card,
//      six slides and thanks card then go like those of a booked talk. Nothing is read
//      from Sanity or from Google.

import { readHandled, rememberHandled, shouldRunDemo } from './demo.js';

export const handledKey = 'teletraan-presentation-test-handled';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// The presentationTestRequest of Dashboard Settings, always complete: { requestedAt }.
// A time that is not a time is empty, which is no request.
export function tidyTestRequest(raw) {
  const source = isRecord(raw) ? raw : {};
  const requestedAt = typeof source.requestedAt === 'string' && !isNaN(Date.parse(source.requestedAt)) ? source.requestedAt : '';

  return { requestedAt: requestedAt };
}

// The handled request, kept under a name of its own in localStorage, apart from the
// demo's, the hidden transitions' and the announcements'
export function readHandledTest(storage) {
  return readHandled(storage, handledKey);
}

export function rememberHandledTest(storage, requestedAt) {
  return rememberHandled(storage, requestedAt, handledKey);
}

// The sample talk as a talk that starts now. It is scheduled whatever the sample file says,
// so the test always runs. It keeps its id, which is the name of its folder of slides.
export function talkStartingAt(talk, now) {
  return Object.assign({}, talk, { start: new Date(now.getTime()), status: 'scheduled' });
}

// The runner. deps is what it needs from the page, so that the tests can give it fakes:
//   getContent()        the newest content
//   storage             localStorage, or null when the browser has none
//   takeoverRunning()   true while an alert, an announcement or a talk covers the screen
//   demoRunning()       true while a demo plays
//   nightIsUp()         true while the night screen is up
//   hiddenPlaying()     true while a hidden transition plays
//   loadSampleTalk()    a promise of the talk in the sample content, or null when it has none
//   startTalk(talk)     puts the talk on the screen, as startTestTalk in core/presentation-run.js does
// Call look(now) once a second.
export function makePresentationTestRunner(deps) {
  // Read once and then kept here as well, so that a storage that fails still stops
  // the same request from running twice while the page is open
  let handled = readHandledTest(deps.storage);
  let starting = Promise.resolve();

  function busy() {
    return deps.takeoverRunning() || deps.demoRunning() || deps.nightIsUp() || deps.hiddenPlaying();
  }

  async function start(now) {
    const talk = await deps.loadSampleTalk();
    if (talk === null) throw new Error('The sample content has no talk');

    deps.startTalk(talkStartingAt(talk, now));
  }

  function look(now) {
    const content = deps.getContent();
    if (!content || !content.settings) return;
    if (content.settings.presentationsEnabled === false) return;
    const requestedAt = tidyTestRequest(content.settings.presentationTestRequest).requestedAt;

    if (!shouldRunDemo(requestedAt, handled, now)) return;
    if (busy()) return;

    handled = requestedAt;
    rememberHandledTest(deps.storage, handled);
    starting = start(now).catch(error => console.error('Run presentation test failed', error));
  }

  return {
    look: look,
    // A promise that is done when the talk has been handed to the screen. For the tests.
    whenStarted: () => starting,
  };
}
