// Reading the content from Sanity or the sample, the saved copy and the stream (part of content.js).

import { sampleFolder, sanity } from '../config.js';
import { chosenSource } from './source.js';
import { fetchResult, liveEventsUrl, normalizeContent, normalizeSample } from './sanity.js';
import { reasons } from './connection.js';
import { markUnreachable } from './monday.js';
import { withDefaults } from './content-tidy.js';

// The last content read from Sanity, written after every good read. A screen that was last run before this name
// has its copy under the old one, which is read once and not written again.
const storageKey = 'teletraan-last-content';
const olderStorageKey = 'teletraan-content';
const sampleRecheck = 30 * 1000;
const waitForMoreEdits = 1500;
const pollEvery = 5 * 60 * 1000;
const retryAfterFailure = 30 * 1000;
const reopenStreamAfter = 60 * 1000;
// Sanity counts as unreachable once reads have failed for this long, counted
// from the first failed read. The screen then says so (core/connection.js).
const unreachableAfter = 2 * 60 * 1000;

// The latest read from Sanity, for the status dots: when the last good one ended and whether the newest one threw.
// A copy taken from localStorage is not a read.
let lastRead = { at: null, failed: false };

export function lastContentRead() {
  return { at: lastRead.at, failed: lastRead.failed };
}

// Resolves with { content, status } as soon as there is something to show.
// After that, onChange({ content, status }) is called each time either changes.
// status is { source: 'sample' | 'sanity' | 'cache', updated: Date or null, offline: boolean, reason: string }
// where updated is when the content was last read, and a new updated alone is not a change.
// offline is true once Sanity has been out of reach for over two minutes, and reason then says
// why: one of the words in core/connection.js. reason is '' when offline is false.
//
// The content shown is what the editors published, or the sample when the
// address has ?sample=1 (source.js). The choice is made once, when the page
// starts.
export async function startContent(onChange) {
  const started = chosenSource() === 'sample' ? await startSampleContent(onChange) : await startSanityContent(onChange);
  return started.first;
}

// The first state passed in is the one the reader hands back, so it is only
// remembered. After that onChange is called when something is different. A
// failing onChange must not stop the reading. Once stopped, nothing more is sent.
function makeAnnouncer(onChange) {
  let last = null;
  let stopped = false;

  return {
    announce(state) {
      if (stopped) return;

      const text = JSON.stringify([state.content, state.status.source, state.status.offline, state.status.reason]);
      const send = last !== null && text !== last;
      last = text;
      if (!send) return;

      try {
        onChange(state);
      } catch (error) {
        console.error('The screen could not use the new content', error);
      }
    },
    stop() {
      stopped = true;
    },
  };
}

// Sample content is a file on this computer, so editing it shows within 30 seconds.
// It is cleaned the same way as content from Sanity. Returns { first, stop }.
export async function startSampleContent(onChange) {
  const announcer = makeAnnouncer(onChange);
  let content = withDefaults({});
  let offline = false;

  async function readFile() {
    try {
      const response = await fetch(sampleFolder + 'content.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load content (status ' + response.status + ')');

      content = normalizeSample(await response.json());
      offline = false;
    } catch (error) {
      console.error('Could not read the sample content', error);
      offline = true;
    }
    // The sample is a file on this computer, not Sanity. If it cannot be read the status text says so.
    return { content: content, status: { source: 'sample', updated: null, offline: offline, reason: offline ? 'other' : '' } };
  }

  const first = await readFile();
  announcer.announce(first);

  const timer = setInterval(async () => announcer.announce(await readFile()), sampleRecheck);
  return {
    first: first,
    stop() {
      announcer.stop();
      clearInterval(timer);
    },
  };
}

// The copy from the last good read, so the screen can start with something
// when the network is down
function storedText() {
  return localStorage.getItem(storageKey) || localStorage.getItem(olderStorageKey);
}

function readSavedCopy() {
  try {
    const text = storedText();
    if (!text) return null;

    const saved = JSON.parse(text);
    if (!saved || !saved.raw || typeof saved.raw !== 'object') return null;

    const savedAt = typeof saved.savedAt === 'number' ? saved.savedAt : null;
    return { content: normalizeContent(saved.raw), savedAt: savedAt };
  } catch (error) {
    console.error('Could not read the saved content', error);
    return null;
  }
}

// The Look document in the saved copy, as Sanity sent it, or null. Only when the
// screen will start on the editors' content: the sample has its own theme and is
// read from a file. core/layout-apply.js uses it to choose the layout before
// anything is drawn.
export function savedTheme() {
  try {
    if (chosenSource() !== 'production') return null;

    const text = storedText();
    const saved = text ? JSON.parse(text) : null;
    return saved && saved.raw && typeof saved.raw === 'object' ? saved.raw.theme || null : null;
  } catch (error) {
    console.error('Could not read the saved theme', error);
    return null;
  }
}

// The Style setting in the saved copy, as Sanity sent it, or null. Only when the screen will
// start on the editors' content, like savedTheme. core/style.js uses it to choose the style,
// and core/layout-apply.js the layout, before anything is drawn.
export function savedStyle() {
  try {
    if (chosenSource() !== 'production') return null;

    const text = storedText();
    const saved = text ? JSON.parse(text) : null;
    const settings = saved && saved.raw && typeof saved.raw === 'object' ? saved.raw.settings : null;
    return settings && typeof settings === 'object' ? settings.style || null : null;
  } catch (error) {
    console.error('Could not read the saved style', error);
    return null;
  }
}

// The content in the saved copy, cleaned the way content from Sanity is, or null. Only when the screen will
// start on the editors' content, like savedStyle. core/screens.js uses it to work out the look the
// screen starts with, before anything is drawn.
export function savedContent() {
  try {
    if (chosenSource() !== 'production') return null;

    const saved = readSavedCopy();
    return saved ? saved.content : null;
  } catch (error) {
    console.error('Could not read the saved content', error);
    return null;
  }
}

function saveCopy(raw, savedAt) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ savedAt: savedAt, raw: raw }));
  } catch (error) {
    console.error('Could not save a copy of the content', error);
  }
}

// Sanity sends a message each time published content changes. A browser
// reconnects a dropped stream by itself, but gives up after an error reply,
// so that case is opened again after a pause. Returns a function that closes
// the stream for good.
function watchStream(onMessage) {
  if (typeof EventSource === 'undefined') return () => {};

  let complained = false;
  let closed = false;
  let stream = null;
  let reopening = null;

  function open() {
    if (closed) return;

    try {
      const opened = new EventSource(liveEventsUrl(sanity));
      stream = opened;
      opened.addEventListener('message', onMessage);
      opened.addEventListener('open', () => {
        complained = false;
      });
      opened.addEventListener('error', () => {
        if (!complained) console.error('The live change stream from Sanity is not working. Checking again every few minutes instead.');
        complained = true;
        if (opened.readyState === EventSource.CLOSED) reopening = setTimeout(open, reopenStreamAfter);
      });
    } catch (error) {
      console.error('Could not open the live change stream', error);
    }
  }

  open();

  return function close() {
    closed = true;
    clearTimeout(reopening);
    if (stream) stream.close();
  };
}

// Reads from Sanity and keeps what it read in localStorage. With a saved
// copy the screen starts at once and Sanity is read right after. Without
// one it has to wait for Sanity, and shows empty content if Sanity is out of
// reach. Sample content is never shown here: it would look like the real thing.
// Returns { first, stop }. Stopping closes the stream and cancels the timers,
// for when Dashboard Settings switches the screen to the sample.
export async function startSanityContent(onChange) {
  const announcer = makeAnnouncer(onChange);
  const saved = readSavedCopy();

  let content = saved ? saved.content : withDefaults({});
  let source = saved ? 'cache' : 'sanity';
  let updated = saved ? saved.savedAt : null; // in milliseconds
  let failed = false; // true when the latest read failed
  let offline = false; // true once reads have failed for unreachableAfter
  let reason = ''; // why the latest read failed, while there is a failure
  let alarm = null; // the timer that sets offline. It starts at the first failed read.
  let busy = false;
  let again = false;
  let nextRead = null;
  let waiting = null;
  let stopped = false;

  function current() {
    const date = updated === null ? null : new Date(updated);
    // Out of reach, the Monday panels say the board is stale, whatever its age (core/monday.js)
    return { content: offline ? markUnreachable(content) : content, status: { source: source, updated: date, offline: offline, reason: offline ? reason : '' } };
  }

  // The timer is real time from the first failed read. A good read stops it,
  // so a read that fails again later starts a new two minutes.
  function startAlarm() {
    if (alarm !== null) return;

    alarm = setTimeout(() => {
      alarm = null;
      if (stopped) return;

      offline = true;
      announcer.announce(current());
    }, unreachableAfter);
  }

  function stopAlarm() {
    clearTimeout(alarm);
    alarm = null;
  }

  // A failed read keeps the content on screen. It only counts as offline once
  // the alarm goes off, two minutes after the first one that failed.
  async function readOnce() {
    try {
      const raw = await fetchResult(sanity);
      content = normalizeContent(raw);
      updated = Date.now();
      lastRead = { at: new Date(updated), failed: false };
      source = 'sanity';
      failed = false;
      offline = false;
      reason = '';
      stopAlarm();
      saveCopy(raw, updated);
    } catch (error) {
      console.error('Could not read content from Sanity', error);
      failed = true;
      lastRead = { at: lastRead.at, failed: true };
      reason = error && reasons.includes(error.reason) ? error.reason : 'other';
      startAlarm();
    }
  }

  // Reads one at a time. A request that comes in while one is running makes
  // it read again when it is done.
  async function refresh() {
    clearTimeout(nextRead);
    if (stopped) return;
    if (busy) {
      again = true;
      return;
    }

    busy = true;
    do {
      again = false;
      await readOnce();
      announcer.announce(current());
    } while (again && !stopped);
    busy = false;

    planRead(failed ? retryAfterFailure : pollEvery);
  }

  function planRead(delay) {
    clearTimeout(nextRead);
    if (!stopped) nextRead = setTimeout(refresh, delay);
  }

  // Edits tend to arrive together, so the first one starts a short wait and
  // the ones after it join that wait
  function onLiveChange() {
    if (waiting) return;

    waiting = setTimeout(() => {
      waiting = null;
      refresh();
    }, waitForMoreEdits);
  }

  if (!saved) await readOnce();
  const first = current();
  announcer.announce(first);

  const closeStream = watchStream(onLiveChange);

  // With a saved copy the first read starts a moment later, so the caller
  // has the first content before any change arrives
  const delay = failed ? retryAfterFailure : pollEvery;
  planRead(saved ? 0 : delay);

  return {
    first: first,
    stop() {
      stopped = true;
      announcer.stop();
      stopAlarm();
      clearTimeout(nextRead);
      clearTimeout(waiting);
      closeStream();
    },
  };
}
