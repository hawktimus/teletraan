// Where the screen gets what it shows: startContent() hands over the content
// once it has it, and again every time it changes. Same shape as data/sample/content.json.

import { contentSources, defaultSettings, defaultTeam, limits, metals, sampleFolder, sanity, speeds } from '../config.js';
import { parseLocalDateTime } from './time.js';
import { chooseSource } from './source.js';
import { tidyTheme } from './theme.js';
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
  const content = Object.assign({ tasks: [], plan: null, sponsors: [], tipsAndNews: [], subteams: [], people: [], customPanels: [], extraEvents: [] }, source);
  content.team = Object.assign({}, defaultTeam, source.team);
  content.settings = Object.assign({}, defaultSettings, source.settings);
  content.settings.countdown = Object.assign({}, defaultSettings.countdown, content.settings.countdown);
  content.settings.alert = Object.assign({}, defaultSettings.alert, content.settings.alert);
  content.settings.rotation = Object.assign({}, defaultSettings.rotation, content.settings.rotation);

  // The Theme document is its own thing, not part of Dashboard Settings. A
  // missing or unusable value becomes the default (see core/theme.js).
  content.theme = tidyTheme(source.theme);

  // normalizeSettings in sanity.js already does this for the editors' content.
  // This covers content that did not come through it.
  fixSettingValues(content.settings);
  return content;
}

// Settings that are one of a few words, an on/off switch, or a number in a
// range. Anything that does not fit becomes the default, so the panels never
// have to check. A number outside its range is moved to the nearest end.
export function fixSettingValues(settings) {
  if (!contentSources.includes(settings.contentSource)) settings.contentSource = defaultSettings.contentSource;
  if (typeof settings.switchBackAt !== 'string') settings.switchBackAt = defaultSettings.switchBackAt;
  if (!Object.keys(speeds).includes(settings.speed)) settings.speed = defaultSettings.speed;
  if (!metals.includes(settings.frameMetal)) settings.frameMetal = defaultSettings.frameMetal;

  ['glint', 'nameTransform'].forEach(name => {
    if (typeof settings[name] !== 'boolean') settings[name] = defaultSettings[name];
  });
  ['pageSeconds', 'nameEvery', 'nameDuration'].forEach(name => {
    settings[name] = keepInRange(settings[name], limits[name], defaultSettings[name]);
  });
  settings.crt = tidyGlitch(settings.crt);
}

// A number in its range. For a limit with a shortest, 0 stays 0 (never) and
// a number between 0 and the shortest is brought up to the shortest.
function keepInRange(value, limit, fallback) {
  if (typeof value !== 'number' || !isFinite(value)) return fallback;
  if (limit.shortest && value > limit.min && value < limit.shortest) return limit.shortest;
  return Math.min(limit.max, Math.max(limit.min, value));
}

// The screen glitch setting, always complete: on, everySeconds, durationSeconds.
// Settings saved before the seconds existed have everyMinutes instead, so a
// published value keeps working. everySeconds wins when both are there.
function tidyGlitch(raw) {
  const glitch = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  let everySeconds = glitch.everySeconds;
  if (typeof everySeconds !== 'number' && typeof glitch.everyMinutes === 'number') {
    everySeconds = Math.round(glitch.everyMinutes * 60);
  }

  return {
    on: typeof glitch.on === 'boolean' ? glitch.on : defaultSettings.crt.on,
    everySeconds: keepInRange(everySeconds, limits.crtEvery, defaultSettings.crt.everySeconds),
    durationSeconds: keepInRange(glitch.durationSeconds, limits.crtDuration, defaultSettings.crt.durationSeconds),
  };
}

// Resolves with { content, status } as soon as there is something to show.
// After that, onChange({ content, status }) is called each time either changes.
// status is { source: 'sample' | 'sanity' | 'cache', updated: Date or null, offline: boolean }
// where updated is when the content was last read, and a new updated alone is not a change.
//
// Dashboard Settings says which content to show (source.js): the sample, or
// what the editors published. The screen keeps asking, so a change in Content
// source, or the Switch back time arriving, swaps the reader below while the
// screen runs. The first content of the new source comes through onChange.
export async function startContent(onChange) {
  let reader = null; // the sample reader or the Sanity reader that is running now
  let turn = 0; // counts the switches, so a start that was overtaken by a newer one is dropped

  async function use(source) {
    turn += 1;
    const mine = turn;
    if (reader) reader.stop();
    reader = null;

    const started = source === 'sample' ? await startSampleContent(onChange) : await startSanityContent(onChange);
    if (mine === turn) reader = started;
    else started.stop();
    return { first: started.first, current: mine === turn };
  }

  const choice = await chooseSource();
  const started = await use(choice.source);

  // Watching starts only now, so a switch can never arrive before the first content
  choice.keepWatching(source => {
    use(source)
      .then(result => {
        if (result.current) onChange(result.first);
      })
      .catch(error => console.error('Could not switch the content source', error));
  });
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

      const text = JSON.stringify([state.content, state.status.source, state.status.offline]);
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
    return { content: content, status: { source: 'sample', updated: null, offline: offline } };
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
  let lastSuccess = null; // the last good read in this run, in milliseconds
  let failed = false; // true when the latest read failed
  let offline = false;
  let busy = false;
  let again = false;
  let nextRead = null;
  let waiting = null;
  let stopped = false;

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
      clearTimeout(nextRead);
      clearTimeout(waiting);
      closeStream();
    },
  };
}
