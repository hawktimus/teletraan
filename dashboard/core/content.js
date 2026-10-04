// Where the screen gets what it shows: startContent() hands over the content
// once it has it, and again every time it changes. Same shape as data/sample/content.json.

import { defaultSettings, defaultTeam, dataFolder, sanity, sampleMode, speeds } from '../config.js';
import { parseLocalDateTime } from './time.js';
import { fetchResult, liveEventsUrl, normalizeContent, normalizeSample } from './sanity.js';

const storageKey = 'teletraan-content';
const sampleRecheck = 30 * 1000;
const waitForMoreEdits = 1500;
const pollEvery = 5 * 60 * 1000;
const retryAfterFailure = 30 * 1000;
const reopenStreamAfter = 60 * 1000;
const offlineAfter = 10 * 60 * 1000;

// An item is shown unless it is switched off or its expiry time has passed
export function isVisible(item, now = new Date()) {
  if (item.show === false) return false;

  const expires = parseLocalDateTime(item.expires);
  return !expires || expires > now;
}

export function visibleItems(list, now = new Date()) {
  return (list || []).filter(item => isVisible(item, now));
}

// Puts the defaults under whatever the editors have set. Anything they have
// not filled in comes from config.js, so the panels never have to check
// whether settings exist.
export function withDefaults(raw) {
  const source = raw || {};
  const content = Object.assign({ tasks: [], plan: null, sponsors: [], tipsAndNews: [], subteams: [], people: [], customPanels: [] }, source);
  content.team = Object.assign({}, defaultTeam, source.team);
  content.settings = Object.assign({}, defaultSettings, source.settings);
  content.settings.countdown = Object.assign({}, defaultSettings.countdown, content.settings.countdown);
  content.settings.alert = Object.assign({}, defaultSettings.alert, content.settings.alert);
  content.settings.rotation = Object.assign({}, defaultSettings.rotation, content.settings.rotation);
  content.settings.crt = Object.assign({}, defaultSettings.crt, content.settings.crt);

  // normalizeSettings in sanity.js already does this for the editors' content.
  // This covers content that did not come through it.
  if (!Object.keys(speeds).includes(content.settings.speed)) content.settings.speed = defaultSettings.speed;
  return content;
}

// Resolves with { content, status } as soon as there is something to show.
// After that, onChange({ content, status }) is called each time either changes.
// status is { source: 'sample' | 'sanity' | 'cache', updated: Date or null, offline: boolean }
// where updated is when the content was last read, and a new updated alone is not a change.
export async function startContent(onChange) {
  return sampleMode ? startSample(onChange) : startSanity(onChange);
}

// The first state passed in is the one startContent returns, so it is only
// remembered. After that onChange is called when something is different. A
// failing onChange must not stop the reading.
function makeAnnouncer(onChange) {
  let last = null;

  return function announce(state) {
    const text = JSON.stringify([state.content, state.status.source, state.status.offline]);
    const send = last !== null && text !== last;
    last = text;
    if (!send) return;

    try {
      onChange(state);
    } catch (error) {
      console.error('The screen could not use the new content', error);
    }
  };
}

// Sample content is a file on this computer, so editing it shows within 30 seconds.
// It is cleaned the same way as content from Sanity.
async function startSample(onChange) {
  const announce = makeAnnouncer(onChange);
  let content = withDefaults({});
  let offline = false;

  async function readFile() {
    try {
      const response = await fetch(dataFolder + 'content.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load content (status ' + response.status + ')');

      content = normalizeSample(await response.json());
      offline = false;
    } catch (error) {
      console.error('Could not read the sample content', error);
      offline = true;
    }
    return { content: content, status: { source: 'sample', updated: null, offline: offline } };
  }

  const first = await readFile();
  announce(first);

  setInterval(async () => announce(await readFile()), sampleRecheck);
  return first;
}

// The copy from the last good read, so the screen can start with something
// when the network is down
function readSavedCopy() {
  try {
    const text = localStorage.getItem(storageKey);
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

function saveCopy(raw, savedAt) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ savedAt: savedAt, raw: raw }));
  } catch (error) {
    console.error('Could not save a copy of the content', error);
  }
}

// Sanity sends a message each time published content changes. A browser
// reconnects a dropped stream by itself, but gives up after an error reply,
// so that case is opened again after a pause.
function watchStream(onMessage) {
  if (typeof EventSource === 'undefined') return;

  let complained = false;

  function open() {
    try {
      const stream = new EventSource(liveEventsUrl(sanity));
      stream.addEventListener('message', onMessage);
      stream.addEventListener('open', () => {
        complained = false;
      });
      stream.addEventListener('error', () => {
        if (!complained) console.error('The live change stream from Sanity is not working. Checking again every few minutes instead.');
        complained = true;
        if (stream.readyState === EventSource.CLOSED) setTimeout(open, reopenStreamAfter);
      });
    } catch (error) {
      console.error('Could not open the live change stream', error);
    }
  }

  open();
}

// Reads from Sanity and keeps what it read in localStorage. With a saved
// copy the screen starts at once and Sanity is read right after. Without
// one it has to wait for Sanity, and shows empty content if Sanity is out of
// reach. Sample content is never shown here: it would look like the real thing.
async function startSanity(onChange) {
  const announce = makeAnnouncer(onChange);
  const saved = readSavedCopy();

  let content = saved ? saved.content : withDefaults({});
  let source = saved ? 'cache' : 'sanity';
  let updated = saved ? saved.savedAt : null; // in milliseconds
  let lastSuccess = null; // the last good read in this run, in milliseconds
  let failed = false; // true when the latest read failed
  let offline = false;
  let busy = false;
  let again = false;
  let nextRead = null;
  let waiting = null;

  function current() {
    const date = updated === null ? null : new Date(updated);
    return { content: content, status: { source: source, updated: date, offline: offline } };
  }

  // A failed read keeps the content on screen. It only counts as offline once
  // the screen has gone ten minutes without a good read.
  async function readOnce() {
    try {
      const raw = await fetchResult(sanity);
      content = normalizeContent(raw);
      lastSuccess = Date.now();
      updated = lastSuccess;
      source = 'sanity';
      failed = false;
      offline = false;
      saveCopy(raw, updated);
    } catch (error) {
      console.error('Could not read content from Sanity', error);
      failed = true;
      offline = lastSuccess === null || Date.now() - lastSuccess > offlineAfter;
    }
  }

  // Reads one at a time. A request that comes in while one is running makes
  // it read again when it is done.
  async function refresh() {
    clearTimeout(nextRead);
    if (busy) {
      again = true;
      return;
    }

    busy = true;
    do {
      again = false;
      await readOnce();
      announce(current());
    } while (again);
    busy = false;

    planRead(failed ? retryAfterFailure : pollEvery);
  }

  function planRead(delay) {
    clearTimeout(nextRead);
    nextRead = setTimeout(refresh, delay);
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
  announce(first);

  watchStream(onLiveChange);

  // With a saved copy the first read starts a moment later, so the caller
  // has the first content before any change arrives
  const delay = failed ? retryAfterFailure : pollEvery;
  planRead(saved ? 0 : delay);
  return first;
}
