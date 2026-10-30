// Reading the content from the local snapshot or the sample, and the saved copy (part of content.js).
//
// The editors' content is not read from Sanity by the screen. The sync service of the Teletraan computer reads it and writes
// data/live/content.json, and this file reads that file from the same server every few seconds (docs/OPERATIONS.md). So a
// publish still shows within seconds, and a read that fails costs nothing: the screen keeps what it has and never says so.

import { sampleFolder } from '../config.js';
import { chosenSource } from './source.js';
import { contentFile, fetchLocalText, imageIndexFile, normalizeContent, normalizeSample, resultOf } from './sanity.js';
import { useLocalImages } from './images.js';
import { withDefaults } from './content-tidy.js';

// The last content read, written after every good read. A screen that was last run before this name
// has its copy under the old one, which is read once and not written again.
const storageKey = 'teletraan-last-content';
const olderStorageKey = 'teletraan-content';
const sampleRecheck = 30 * 1000;
// The file is on this computer, so asking is cheap. The sync service sees a publish within 10 seconds, and this read
// follows within 5 more.
const pollEvery = 5 * 1000;

// The latest read of the local snapshot: when the last good one ended and whether the newest one threw.
// A copy taken from localStorage is not a read. The Sanity dot uses the time of the sync service instead (core/sync-status.js).
let lastRead = { at: null, failed: false };

export function lastContentRead() {
  return { at: lastRead.at, failed: lastRead.failed };
}

// Resolves with { content, status } as soon as there is something to show.
// After that, onChange({ content, status }) is called each time either changes.
// status is { source: 'sample' | 'sanity' | 'cache', updated: Date or null, offline: boolean, reason: string }
// where updated is when the content was last read, and a new updated alone is not a change.
// offline is true only for the sample file that cannot be read. The editors' content is never offline here: a read that
// fails keeps the content, and the status pill says when the sync service has gone quiet (core/sync-pill.js).
// reason is '' when offline is false.
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
      if (!response.ok) throw new Error('Could not load dashboard/data/sample/content.json (status ' + response.status + '). Is the file there, and is the server running?');

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
    if (!saved || !saved.raw || typeof saved.raw !== 'object' || Array.isArray(saved.raw)) return null;

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

// Reads the local snapshot and keeps what it read in localStorage. With a saved
// copy the screen starts at once and the file is read right after. Without
// one it waits for the first read, and shows empty content if there is none.
// Sample content is never shown here: it would look like the real thing.
// Returns { first, stop }. Stopping cancels the timer, for when Dashboard Settings switches the screen to the sample.
export async function startSanityContent(onChange) {
  const announcer = makeAnnouncer(onChange);
  const saved = readSavedCopy();

  let content = saved ? saved.content : withDefaults({});
  let source = saved ? 'cache' : 'sanity';
  let updated = saved ? saved.savedAt : null; // in milliseconds
  let busy = false;
  let nextRead = null;
  let stopped = false;
  let lastText = ''; // the text of content.json that content was made from, to skip a file that has not changed
  let lastIndex = ''; // the same for images/index.json

  function current() {
    const date = updated === null ? null : new Date(updated);
    return { content: content, status: { source: source, updated: date, offline: false, reason: '' } };
  }

  // The list of pictures the sync service has downloaded. A missing or bad list leaves the one in use.
  async function readImageIndex() {
    try {
      return await fetchLocalText(imageIndexFile);
    } catch (error) {
      return lastIndex;
    }
  }

  // A failed read keeps the content on screen and says nothing on it
  async function readOnce() {
    try {
      const text = await fetchLocalText(contentFile);
      const indexText = await readImageIndex();
      const changed = text !== lastText || indexText !== lastIndex;

      // A file that is not the content (a page of a filter, an empty file) throws here, before anything is taken in
      const raw = changed ? resultOf(text) : null;
      updated = Date.now();
      lastRead = { at: new Date(updated), failed: false };
      source = 'sanity';
      if (!changed) return;

      try {
        useLocalImages(indexText ? JSON.parse(indexText) : {});
      } catch (error) {
        console.error('Could not read the list of downloaded pictures', error);
      }
      content = normalizeContent(raw);
      lastText = text;
      lastIndex = indexText;
      saveCopy(raw, updated);
    } catch (error) {
      console.error('Could not read the local content, keeping what is on screen', error);
      lastRead = { at: lastRead.at, failed: true };
    }
  }

  async function refresh() {
    clearTimeout(nextRead);
    if (stopped || busy) return;

    busy = true;
    await readOnce();
    announcer.announce(current());
    busy = false;

    if (!stopped) nextRead = setTimeout(refresh, pollEvery);
  }

  if (!saved) await readOnce();
  const first = current();
  announcer.announce(first);

  // With a saved copy the first read starts a moment later, so the caller has the first content before any change arrives
  nextRead = setTimeout(refresh, saved ? 0 : pollEvery);

  return {
    first: first,
    stop() {
      stopped = true;
      announcer.stop();
      clearTimeout(nextRead);
    },
  };
}
