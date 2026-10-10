// Preview competition: the plain functions. They know nothing about the page, so
// tools/test-competition.mjs can run them. core/competition-preview-run.js hands them the real
// screen.
//
// How it goes (docs/frc-feed.md, "Preview competition"):
//   1. Someone clicks "Preview competition" on the Start here page in the Studio. That writes the
//      time now into competitionPreviewRequest on Dashboard Settings and publishes it.
//   2. The screen reads the settings with the rest of the content and looks at them every second
//      (makeCompetitionPreviewRunner().look).
//   3. A request starts the preview only if it is less than a minute old and is not the one handled
//      before, the same guard as a demo (shouldRunDemo in core/demo.js). The one handled before is
//      kept in localStorage, so a Mini that restarts never runs it again.
//   4. It waits while an alert, an announcement, a talk, night mode, a demo or a hidden transition
//      has the screen.
//   5. It reads the sample frc-status from data/sample/content.json, which has made up team numbers
//      in [brackets], and for competitionPreviewSeconds the large panel shows every card with that
//      data, one after the other (previewCompetition in core/competition.js). Nothing is read from
//      Sanity or from the Mini, and nothing is written. When the time is up the large panel goes
//      back to its own list.

import { competitionPreviewSeconds } from '../config.js';
import { readHandled, rememberHandled, shouldRunDemo } from './demo.js';

export const handledKey = 'teletraan-competition-preview-handled';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// The time in competitionPreviewRequest of Dashboard Settings, or empty when it is not a time
export function requestTimeOf(settings) {
  const request = isRecord(settings) ? settings.competitionPreviewRequest : null;
  const requestedAt = isRecord(request) ? request.requestedAt : '';

  return typeof requestedAt === 'string' && !isNaN(Date.parse(requestedAt)) ? requestedAt : '';
}

// The handled request, kept under a name of its own in localStorage, apart from the demo's, the
// hidden transitions', the announcements', the presentation test's and the looks'
export function readHandledPreview(storage) {
  return readHandled(storage, handledKey);
}

export function rememberHandledPreview(storage, requestedAt) {
  return rememberHandled(storage, requestedAt, handledKey);
}

// The runner. deps is what it needs from the page, so that the tests can give it fakes:
//   getContent()        the newest content
//   storage             localStorage, or null when the browser has none
//   takeoverRunning()   true while an alert, an announcement or a talk covers the screen
//   demoRunning()       true while a demo plays
//   nightIsUp()         true while the night screen is up
//   hiddenPlaying()     true while a hidden transition plays
//   loadSampleFrc()     a promise of the frc-status in the sample content, or null when it has none
//   startPreview(frc, until)   shows the cards with that data until a time in milliseconds
//   endPreview()        goes back to the ordinary list
// Call look(now) once a second.
export function makeCompetitionPreviewRunner(deps) {
  // Read once and then kept here as well, so that a storage that fails still stops
  // the same request from running twice while the page is open
  let handled = readHandledPreview(deps.storage);
  let until = null; // the time the preview that is on ends, in milliseconds
  let starting = Promise.resolve();

  function busy() {
    return deps.takeoverRunning() || deps.demoRunning() || deps.nightIsUp() || deps.hiddenPlaying();
  }

  async function start(now) {
    const frc = await deps.loadSampleFrc();
    if (frc === null) throw new Error('The sample content has no competition data');

    until = now.getTime() + competitionPreviewSeconds * 1000;
    deps.startPreview(frc, until);
  }

  function look(now) {
    if (until !== null && now.getTime() >= until) {
      until = null;
      deps.endPreview();
    }

    const content = deps.getContent();
    if (!content || !content.settings) return;
    const requestedAt = requestTimeOf(content.settings);

    if (until !== null || !shouldRunDemo(requestedAt, handled, now)) return;
    if (busy()) return;

    handled = requestedAt;
    rememberHandledPreview(deps.storage, handled);
    starting = start(now).catch(error => console.error('Preview competition failed', error));
  }

  return {
    look: look,
    isActive: () => until !== null,
    // A promise that is done when the preview has been handed to the screen. For the tests.
    whenStarted: () => starting,
  };
}
