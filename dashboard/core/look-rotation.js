// The look rotation: the plain functions. They know nothing about the page, so
// tools/test-look-rotation.mjs can run them. core/look-rotation-run.js gives them the real
// screen, and core/schedule.js asks at the end of every pass of the large panel.
//
// How it goes (docs/layouts.md, "The look rotation"):
//   1. The style of the day is one of Styles by day. The number of the calendar day in the time zone
//      of the Look page, counted from 1970, modulo the length of the list, says which. Every screen
//      has the same style on the same day, and a screen that restarts lands on it again.
//   2. A cycle is a row of passes. For each team of Team order there is a pass of its panels in the
//      style of the day, and after it a pass of its Monday cards in the Monday style, if the team has
//      Monday rows. The panels that every team shares (events, tips, photos, the countdown) are in the
//      pass of each team, once.
//   3. A pass is over when the list of the large panel has been through once. Only then does the
//      screen move to the next pass, and only when no alert, announcement, talk, demo, night screen
//      or hidden transition has the screen. The pass waits and is asked again at the next one.
//   4. The style and the team of the next pass are handed on together (rotateStyle in core/style.js,
//      rotateTeam in core/teams.js), and go on the page in the same step as a preview does.
//   5. One style and one team make one pass for ever. A list that is empty gives the choice back to
//      the old setting: Style for Styles by day, and Team mode for Team order.
//
// Next look now (a button on the Start here page) moves to the next pass at once. Where a pass is
// written down in localStorage, a page that reloads for a change of layout goes on in the same pass.

import { defaultSettings, defaultThemeSettings, lookResumeSeconds, lookShortestSeconds, lookSwaps, primeTeam, styles } from '../config.js';
import { readHandled, rememberHandled, shouldRunDemo } from './demo.js';
import { rotateStyle } from './style.js';
import { dateIn, isTimeZone } from './theme.js';
import { activeTeams, rotateTeam } from './teams.js';

export const stateKey = 'teletraan-look-pass';
export const handledKey = 'teletraan-next-look-handled';

const passKinds = ['panels', 'monday'];
const writeEvery = 30 * 1000;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// The nextLookRequest of Dashboard Settings, always complete: { requestedAt }.
// A time that is not a time is empty, which is no request.
export function tidyNextLookRequest(raw) {
  const source = isRecord(raw) ? raw : {};
  const requestedAt = typeof source.requestedAt === 'string' && !isNaN(Date.parse(source.requestedAt)) ? source.requestedAt : '';

  return { requestedAt: requestedAt };
}

// The handled request, kept under a name of its own in localStorage, apart from the
// announcements', the previews' and the demo's
export function readHandledNextLook(storage) {
  return readHandled(storage, handledKey);
}

export function rememberHandledNextLook(storage, requestedAt) {
  return rememberHandled(storage, requestedAt, handledKey);
}


// The day, the style of the day and the teams in order

// The number of the calendar day in a time zone: the same for every moment of that day, and one
// more for the next. A zone that Intl does not know is the Look page's default.
export function dayNumber(timeZone, now) {
  const zone = isTimeZone(timeZone) ? timeZone : defaultThemeSettings.timeZone;
  const parts = dateIn(zone, now).split('-').map(Number);

  return Math.round(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
}

// The style a day has: the list, taken round and round. An empty list has none, which is the old Style setting.
export function styleForDay(list, number) {
  const names = (Array.isArray(list) ? list : []).filter(name => styles.includes(name));
  if (names.length === 0) return '';

  return names[((number % names.length) + names.length) % names.length];
}

// The teams of Team order that are in the list and switched on, in the order of the setting, each
// once. The teams are content.teams, and the built-in Prime when the Studio has none.
export function teamsInOrder(order, teams) {
  const active = activeTeams(Array.isArray(teams) && teams.length > 0 ? teams : [primeTeam]);
  const found = [];

  (Array.isArray(order) ? order : []).forEach(code => {
    const team = active.find(item => item.code === code);
    if (team && found.indexOf(team) === -1) found.push(team);
  });
  return found;
}

// The Monday cards of a team, as the rows of the list the large panel follows while its Monday pass
// is up. A team with no Monday rows has none, and then it has no Monday pass. There are no cards yet.
export function mondayCards(content, teamCode) {
  return [];
}

// The passes of one cycle, in order: { team, style, kind }. team is a code, or '' when Team mode
// decides the team, and style is '' when Style decides the style. teams is the codes in order.
// hasMonday(code) says whether a team has Monday rows. The cycle always has at least one pass.
export function planCycle(options) {
  const codes = options.teams.length > 0 ? options.teams : [''];
  const passes = [];

  codes.forEach(code => {
    passes.push({ team: code, style: options.style, kind: 'panels' });
    if (code !== '' && options.hasMonday(code)) passes.push({ team: code, style: options.mondayStyle, kind: 'monday' });
  });
  return passes;
}

function lookOf(pass) {
  return { style: pass.style, team: pass.team };
}

function indexOfPass(passes, wanted) {
  return passes.findIndex(pass => pass.team === wanted.team && pass.kind === wanted.kind);
}


// The pass kept in localStorage

function isTime(value) {
  return typeof value === 'number' && isFinite(value);
}

function readState(storage, now) {
  try {
    const saved = JSON.parse(storage.getItem(stateKey));
    if (!isRecord(saved) || typeof saved.team !== 'string' || !passKinds.includes(saved.kind)) return null;
    if (!isTime(saved.since) || !isTime(saved.savedAt)) return null;
    if (now.getTime() - saved.savedAt > lookResumeSeconds * 1000) return null;

    return { team: saved.team, kind: saved.kind, since: Math.min(saved.since, now.getTime()) };
  } catch (error) {
    return null;
  }
}

function writeState(storage, state) {
  try {
    storage.setItem(stateKey, JSON.stringify(state));
  } catch (error) {
    // the rotation still runs from memory, and a reload starts the first pass again
  }
}


// The rotation. deps is what it needs from the page, so that the tests can give it fakes:
//   getContent()      the newest content
//   storage           localStorage, or null when the browser has none
//   keepPlace         false for a look worked out only to start with: nothing is written down
//   busy()            true while an alert, an announcement, a talk, a demo, the night screen or a
//                     hidden transition has the screen
//   mondayCards       the Monday cards of a team (the function above, unless a test gives another)
export function makeLookRotation(deps) {
  const cardsOf = deps.mondayCards || mondayCards;
  const busy = deps.busy || (() => false);
  const keepPlace = deps.keepPlace !== false;

  let current = null; // { team, kind }: the pass the screen is in
  let since = 0; // when that pass began, in milliseconds
  let applied = null; // { style, team }: the look last handed on
  let writtenAt = 0;

  // Content that has no settings has no rotation: nothing is held
  function planFor(now) {
    const content = deps.getContent();
    const source = isRecord(content) ? content : {};
    const settings = isRecord(source.settings) ? source.settings : {};
    const theme = isRecord(source.theme) ? source.theme : {};

    const list = Array.isArray(settings.dailyStyles) ? settings.dailyStyles : [];
    const order = Array.isArray(settings.teamOrder) ? settings.teamOrder : [];
    const style = styleForDay(list, dayNumber(theme.timeZone, now));
    const codes = teamsInOrder(order, source.teams).map(team => team.code);

    return {
      passes: planCycle({
        style: style,
        mondayStyle: styles.includes(settings.mondayStyle) ? settings.mondayStyle : defaultSettings.mondayStyle,
        teams: codes,
        hasMonday: code => cardsOf(source, code).length > 0,
      }),
      swap: lookSwaps.includes(settings.lookSwap) ? settings.lookSwap : defaultSettings.lookSwap,
    };
  }

  function save(now) {
    if (!keepPlace || current === null) return;

    writtenAt = now.getTime();
    writeState(deps.storage, { team: current.team, kind: current.kind, since: since, savedAt: writtenAt });
  }

  // Works out where the screen starts and returns that look, { style, team }, for the caller to hold.
  // A page that reloaded a moment ago goes on in its pass. Anything else starts at the first pass.
  function begin(now) {
    const passes = planFor(now).passes;
    const saved = readState(deps.storage, now);
    const found = saved ? indexOfPass(passes, saved) : -1;
    const pass = passes[found === -1 ? 0 : found];

    current = { team: pass.team, kind: pass.kind };
    since = found === -1 ? now.getTime() : saved.since;
    applied = lookOf(pass);
    save(now);
    return Object.assign({}, applied);
  }

  // Moves to the next pass when it may, and says what to do about it:
  //   moved  the list of the large panel has to start again, because the pass is another one
  //   look   { style, team } to hold now, or null when the look is the one already held
  //   swap   how the look changes (lookSwaps in config.js)
  //   kind   'panels' or 'monday', the kind of the pass the screen is in now
  // forced is Next look now, which does not wait for the pass to have run its shortest time. One pass
  // alone has nowhere to move to. While the screen is busy nothing changes, and the next ask tries again.
  function move(now, forced) {
    if (current === null) begin(now);
    if (busy()) return { moved: false, look: null, swap: planFor(now).swap, kind: current.kind };

    const plan = planFor(now);
    let index = indexOfPass(plan.passes, current);
    let moved = false;

    if (index === -1) {
      index = 0;
      moved = true;
    } else if (plan.passes.length > 1 && (forced || now.getTime() - since >= lookShortestSeconds * 1000)) {
      index = (index + 1) % plan.passes.length;
      moved = true;
    }

    const pass = plan.passes[index];
    const look = lookOf(pass);
    const changed = applied === null || look.style !== applied.style || look.team !== applied.team;

    current = { team: pass.team, kind: pass.kind };
    if (moved) since = now.getTime();
    if (changed) applied = look;
    if (moved || changed) save(now);
    return { moved: moved, look: changed ? look : null, swap: plan.swap, kind: pass.kind };
  }

  return {
    begin: begin,
    // Asked at the end of every pass of the large panel
    boundary: now => move(now, false),
    // Next look now
    next: now => move(now, true),
    // The list the large panel follows now: the Monday cards while a Monday pass is up
    playlist: (list, content) => (current !== null && current.kind === 'monday' ? cardsOf(content, current.team) : list),
    // The pass the screen is in, or null before it has begun
    pass: () => (current === null ? null : Object.assign({}, current)),
    // Asked once a second: writes the pass down again now and then, so that a reload long into a pass goes on in it
    keep: now => {
      if (current !== null && now.getTime() - writtenAt >= writeEvery) save(now);
    },
  };
}

// The look the screen starts with, before anything is drawn: { style, team }. content is the saved
// copy of the content, or null when there is none, and then nothing is held and the settings decide.
// cardsOf is only for the tests.
export function bootLook(content, storage, now = new Date(), cardsOf = mondayCards) {
  if (!content) return { style: '', team: '' };

  return makeLookRotation({ getContent: () => content, storage: storage, keepPlace: false, mondayCards: cardsOf }).begin(now);
}

// Works out the look the screen starts with (bootLook) and holds it, in the same two modules a preview
// holds a look in, so that the style and the layout the page starts with are the ones of the pass.
// Returns the look.
export function holdBootLook(content, storage, now = new Date()) {
  const look = bootLook(content, storage, now);

  rotateStyle(look.style);
  rotateTeam(look.team);
  return look;
}


// Next look now: the plain functions of the runner. deps is what it needs from the page:
//   getContent()   the newest content
//   storage        localStorage, or null when the browser has none
//   busy()         true while something has the screen, and the request waits
//   next(now)      moves the rotation on (the runner of the page gives it)
// Call look(now) once a second. A request counts only when it is less than a minute old and is not the one
// handled before, the same guard as Play announcements (shouldRunDemo in core/demo.js).
export function makeNextLookRunner(deps) {
  // Read once and then kept here as well, so that a storage that fails still stops
  // the same request from running twice while the page is open
  let handled = readHandledNextLook(deps.storage);

  function look(now) {
    const content = deps.getContent();
    if (!content || !content.settings) return;
    const requestedAt = tidyNextLookRequest(content.settings.nextLookRequest).requestedAt;

    if (!shouldRunDemo(requestedAt, handled, now)) return;
    if (deps.busy()) return;

    handled = requestedAt;
    rememberHandledNextLook(deps.storage, handled);
    deps.next(now);
  }

  return { look: look };
}
