// Where the screen gets what it shows: startContent() hands over the content
// once it has it, and again every time it changes. Same shape as data/sample/content.json.

import { competitionModes, competitionSwitches, defaultSettings, defaultTeam, frameFinishes, limits, looks, lookSwaps, metals, nightSpeeds, nightStyles, pageChangeStyles, photoFits, photoOrders, portraitFrames, portraitShapes, sampleFolder, sanity, speeds, styles, teamModes } from '../config.js';
import { parseLocalDateTime } from './time.js';
import { chosenSource } from './source.js';
import { tidyTheme } from './theme.js';
import { tidyDemo } from './demo.js';
import { chanceFields, hoursFields, tidyHiddenRequest, tidyHours } from './hidden.js';
import { tidyAnnounceRequest } from './announce.js';
import { tidyTestRequest } from './presentation-test.js';
import { tidyPreviewRequest } from './preview.js';
import { tidyNextLookRequest, tidySchedule } from './screens.js';
import { fetchResult, liveEventsUrl, normalizeContent, normalizeSample } from './sanity.js';
import { reasons } from './connection.js';
import { showsForTeam } from './teams.js';
import { markUnreachable } from './monday.js';

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

// An item is shown unless it is switched off or its expiry time has passed. Only a task
// has Show on TV, and every panel that draws tasks comes through here, so it is read here.
export function isVisible(item, now = new Date()) {
  if (item.show === false || item.showOnTv === false) return false;

  const expires = parseLocalDateTime(item.expires);
  return !expires || expires > now;
}

// The items a panel may draw: the ones that are visible and are for the team on the screen
// (core/teams.js). Every panel takes its items through here, so the team is judged in this one place.
// The Screens ask about a team that is not on the screen yet, and give its code.
export function visibleItems(list, now = new Date(), teamCode) {
  return (list || []).filter(item => isVisible(item, now) && showsForTeam(item, teamCode));
}

// Puts the defaults under whatever the editors have set. Anything they have
// not filled in comes from config.js, so the panels never have to check
// whether settings exist.
export function withDefaults(raw) {
  const source = raw || {};
  const content = Object.assign({ tasks: [], plan: null, plans: [], teams: [], sponsors: [], tipsAndNews: [], notices: [], subteams: [], people: [], photos: [], presentations: [], customPanels: [], calendarFilters: [], milestones: [], frc: null, monday: null, screens: [] }, source);
  content.team = Object.assign({}, defaultTeam, source.team);
  content.settings = Object.assign({}, defaultSettings, source.settings);
  // The Mini reads the two Monday blocks and the screen has no use for them
  ['mondayTaskBoard', 'mondayMilestoneBoard'].forEach(name => delete content.settings[name]);
  content.settings.countdown = Object.assign({}, defaultSettings.countdown, content.settings.countdown);
  content.settings.alert = Object.assign({}, defaultSettings.alert, content.settings.alert);
  content.settings.rotation = Object.assign({}, defaultSettings.rotation, content.settings.rotation);

  // The Look document is its own thing, not part of Dashboard Settings. A
  // missing or unusable value becomes the default (see core/theme.js).
  content.theme = tidyTheme(source.theme);

  // The Demo document is its own thing too. A missing one is no request and
  // the default steps (see core/demo.js).
  content.demo = tidyDemo(source.demo);

  // normalizeSettings in sanity.js already does this for the editors' content.
  // This covers content that did not come through it. The settings as they were saved, before the
  // defaults went under them, say whether the two portrait sizes were ever set.
  fixSettingValues(content.settings, source.settings || {});
  return content;
}

// Settings that are one of a few words, an on/off switch, or a number in a
// range. Anything that does not fit becomes the default, so the panels never
// have to check. A number outside its range is moved to the nearest end. saved is the settings as
// the editors saved them, which is the same object unless defaults were put under it first.
export function fixSettingValues(settings, saved = settings) {
  if (!Object.keys(speeds).includes(settings.speed)) settings.speed = defaultSettings.speed;
  if (!metals.includes(settings.frameMetal)) settings.frameMetal = defaultSettings.frameMetal;
  if (!looks.includes(settings.look)) settings.look = defaultSettings.look;
  if (!styles.includes(settings.style)) settings.style = defaultSettings.style;
  // The page change settings
  if (!pageChangeStyles.includes(settings.pageChangeStyle)) settings.pageChangeStyle = defaultSettings.pageChangeStyle;
  if (!frameFinishes.includes(settings.frameFinish)) settings.frameFinish = defaultSettings.frameFinish;
  // The photo settings
  if (!photoOrders.includes(settings.photoOrder)) settings.photoOrder = defaultSettings.photoOrder;
  if (!photoFits.includes(settings.photoFit)) settings.photoFit = defaultSettings.photoFit;
  if (!portraitShapes.includes(settings.portraitShape)) settings.portraitShape = defaultSettings.portraitShape;
  if (!portraitFrames.includes(settings.portraitFrame)) settings.portraitFrame = defaultSettings.portraitFrame;
  // The team settings
  if (!teamModes.includes(settings.teamMode)) settings.teamMode = defaultSettings.teamMode;
  // The Screens: the Screen of each weekday, and the Monday style a Screen has when it has not set its own. The swap is
  // not a setting any more (lookSwaps in config.js) and the stored value is only kept tidy
  settings.screenSchedule = tidySchedule(settings.screenSchedule);
  if (!styles.includes(settings.mondayStyle)) settings.mondayStyle = defaultSettings.mondayStyle;
  if (!lookSwaps.includes(settings.lookSwap)) settings.lookSwap = defaultSettings.lookSwap;
  // The competition cards: the mode here, and a switch for each card in the list of booleans below
  if (!competitionModes.includes(settings.competitionMode)) settings.competitionMode = defaultSettings.competitionMode;
  // The night mode settings: two choices, a switch each way and the logo width. The times are fixed (constants.js)
  if (!nightStyles.includes(settings.nightStyle)) settings.nightStyle = defaultSettings.nightStyle;
  if (!Object.keys(nightSpeeds).includes(settings.nightSpeed)) settings.nightSpeed = defaultSettings.nightSpeed;

  // The logo and name switches and numbers are the logo settings in the Studio
  const logoSwitches = ['logoAnimations', 'logoEntrance', 'logoSpin', 'logoHawk', 'nameTransform'];
  const logoNumbers = ['logoSpinEvery', 'logoSpinDuration', 'logoHawkEvery', 'logoHawkDuration', 'nameEvery', 'nameDuration'];
  const transitionNumbers = ['breakSeconds', 'silverChance'];

  ['glint', 'showConnectionStatus', 'nightEnabled', 'nightPreview', 'hiddenEnabled', 'presentationsEnabled'].concat(logoSwitches, competitionSwitches).forEach(name => {
    if (typeof settings[name] !== 'boolean') settings[name] = defaultSettings[name];
  });
  // The hidden transition settings: each chance is a percent, and the last push from the Studio is a kind and a time
  const hiddenNumbers = chanceFields();
  // The team settings: minutes each team stays in Alternate mode
  const teamNumbers = ['alternateMinutes'];
  ['pageSeconds', 'photoSeconds', 'nightLogoWidth'].concat(logoNumbers, transitionNumbers, hiddenNumbers, teamNumbers).forEach(name => {
    settings[name] = keepInRange(settings[name], limits[name], defaultSettings[name]);
  });
  ['portraitScale', 'photoScale'].forEach(name => {
    settings[name] = tidyScale(name, settings[name]);
  });
  // Both are worked out before either is set, because setting one would make the other look saved
  const portraitSizes = portraitNames.map(name => portraitPercentOf(saved, name));
  portraitNames.forEach((name, index) => {
    settings[name] = portraitSizes[index];
  });
  // The hours between hidden transitions: 1 to 1000, or 0 when not set, and then the percent is used
  hoursFields().forEach(name => {
    settings[name] = tidyHours(settings[name], name);
  });
  settings.hiddenRequest = tidyHiddenRequest(settings.hiddenRequest);
  // The last click of Play announcements (Screen tab, hidden from editors): a time, or empty
  settings.announceRequest = tidyAnnounceRequest(settings.announceRequest);
  // The last click of Run presentation test (Presentations tab, hidden from editors): a time, or empty
  settings.presentationTestRequest = tidyTestRequest(settings.presentationTestRequest);
  // The last click of a Preview button (hidden from editors): a kind and a time, or empty
  settings.previewRequest = tidyPreviewRequest(settings.previewRequest);
  // The last click of Next look now and of Preview competition (Start here page, hidden from editors): a time, or empty
  settings.nextLookRequest = tidyNextLookRequest(settings.nextLookRequest);
  settings.competitionPreviewRequest = tidyRequestTime(settings.competitionPreviewRequest);
  settings.crt = tidyGlitch(settings.crt);
  // The Events panel: Group events by kind (Calendars tab) is a switch that starts off
  if (typeof settings.groupEventsByKind !== 'boolean') settings.groupEventsByKind = defaultSettings.groupEventsByKind;
  // The Monday tab: the boards are a list and the owner names a switch. The Mini reads both, and the screen has no use for them
  if (!Array.isArray(settings.mondayBoards)) settings.mondayBoards = defaultSettings.mondayBoards.slice();
  if (typeof settings.mondayShowOwners !== 'boolean') settings.mondayShowOwners = defaultSettings.mondayShowOwners;
}

// A request that is only a time, always complete: { requestedAt }. A time that is not a time
// is empty, which is no request.
function tidyRequestTime(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const requestedAt = typeof source.requestedAt === 'string' && !isNaN(Date.parse(source.requestedAt)) ? source.requestedAt : '';

  return { requestedAt: requestedAt };
}

// A number in its range. For a limit with a shortest, 0 stays 0 (never) and
// a number between 0 and the shortest is brought up to the shortest.
export function keepInRange(value, limit, fallback) {
  if (typeof value !== 'number' || !isFinite(value)) return fallback;
  if (limit.shortest && value > limit.min && value < limit.shortest) return limit.shortest;
  return Math.min(limit.max, Math.max(limit.min, value));
}

// A size setting (leadershipPortrait, rosterPortrait, the old portraitScale or photoScale): a whole
// percent inside the limits of the setting (60 to 220 for portraits, 60 to 200 for the old portrait size,
// 60 to 100 for photos), so 79.6 is 80. Anything missing or odd is 100. The portrait and Photo panel
// code calls it too, so a size is never odd there.
export function tidyScale(name, value) {
  return Math.round(keepInRange(value, limits[name], defaultSettings[name]));
}

// The size of the portraits of one panel, a whole percent. leadershipPortrait and rosterPortrait replace
// portraitScale. When neither has been saved, both are the old Portrait size, so a screen that was set up
// before them looks the same. When one has been saved, the other is its starting value. The Roster
// panel and the code that draws the rows call this with their settings, saved or not tidied yet.
export const portraitNames = ['leadershipPortrait', 'rosterPortrait'];

export function portraitPercentOf(settings, name) {
  const source = settings || {};
  const saved = portraitNames.some(own => typeof source[own] === 'number');

  return tidyScale(name, saved ? source[name] : source.portraitScale);
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
      source = 'sanity';
      failed = false;
      offline = false;
      reason = '';
      stopAlarm();
      saveCopy(raw, updated);
    } catch (error) {
      console.error('Could not read content from Sanity', error);
      failed = true;
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
