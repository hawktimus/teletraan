// The Screens: the plain functions. They know nothing about the page, so tools/test-screens.mjs can run
// them. core/screens-run.js gives them the real screen, and core/schedule.js asks them at every page of the
// large panel.
//
// How it goes (docs/layouts.md, "The Screens"):
//   1. A Screen is one of three documents, Original, Cybertron and Minimal. Its id says its style. It holds the
//      rows of the large panel (area B), the rows of the small panel (area D), the minutes between the name
//      effect and between the flights of the hawk, the length of a swap and the style it uses while a Monday
//      row plays.
//   2. The Screen of the day is picked from the weekday in the time zone of the Look page (planFor). It is picked
//      at boot and at the first row change after midnight, because the plan is worked out again at every row.
//   3. The large panel plays the rows of the Screen of the day from the top and starts again at the end. The team on the
//      screen is a state: a row with a team other than the one on the screen is a swap into that team, and a row
//      with no team keeps it. A Monday row plays in the Monday style of the Screen. Going into it is a swap when the
//      style changes and so is coming out of it (lookForStep and changesBetween). In full motion every move from
//      a Monday card or to one is a swap, also with the same style (core/swap-run.js).
//   4. The small panel plays the side rows of the Screen that is on the screen, on its own timer.
//   5. A Screen with no rows, or with no document at all, plays rows built from the Panel order (seedMainRows
//      and seedSideRows), so nothing is blank before anyone has opened the Screens in the Studio.
//
// Next look now (a button on the Start here page) moves the large panel to the next row at once.

import { defaultPhotoRow, defaultScreen, defaultSchedule, defaultSettings, defaultThemeSettings, limits, mondayKinds, mondayOldPanels, primeTeam, screenIds, standardSwapSeconds, styles, teamPanels, weekdays } from '../config.js';
import { panels } from '../registry.js';
import { keepInRange } from './content.js';
import { readHandled, rememberHandled, shouldRunDemo } from './demo.js';
import { viewOf } from './monday-views.js';
import { seedMainRows, seedSideRows } from './screen-seed.js';
import { rotateStyle } from './style.js';
import { activeTeams, addressTeam, rotateTeam } from './teams.js';
import { dateIn, isTimeZone } from './theme.js';

export const handledKey = 'teletraan-next-look-handled';

const teamCode = /^[a-z0-9]+$/;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function panelOf(id) {
  return panels.find(item => item.id === id);
}

export function isMondayPanel(id) {
  const panel = panelOf(id);
  return Boolean(panel && panel.monday);
}

// True for the code of a team. An empty team and both are not: a row with either keeps the team on the screen.
export function isTeamCode(team) {
  return typeof team === 'string' && team !== '' && team !== 'both';
}


// The documents

function tidySeconds(value) {
  if (typeof value !== 'number' || !isFinite(value) || value <= 0) return undefined;

  return keepInRange(value, limits.rowSeconds, limits.rowSeconds.min);
}

// The team of a row as it is stored: a code in lowercase, both, or empty
function tidyTeam(value) {
  const code = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return code === 'both' || teamCode.test(code) ? code : '';
}

// A row of the large panel becomes { panel, team, seconds }. The seconds are left out when there are none. A row
// of a panel that is not a large panel is dropped. Only a panel that follows the team has a team, so one
// stored on any other row is not read. A Monday row is for a team, as the kind of its panel says (mondayKinds in
// config.js): the tasks panel for a team and a department (a Team lead, stored as department), done, timeline and board for a
// team, and status by department and overall progress for neither. A Monday row that needs a team and has none is
// dropped. A row that names one of the older Monday panels is the tasks panel of its team, for the first department that has
// tasks, and a row for both teams that is dropped.
function tidyMainRow(raw) {
  if (!isRecord(raw) || typeof raw.panel !== 'string') return null;

  const panel = panelOf(raw.panel.trim());
  if (!panel || panel.region !== 'grid1' || panel.testOnly) return null;

  let team = tidyTeam(raw.team);
  let id = panel.id;
  let older = false;
  if (panel.monday) {
    if (mondayOldPanels.includes(id)) {
      older = true;
      id = 'monday-tasks';
    }
    const kind = mondayKinds[id];
    if (!kind) return null;
    if (kind === 'none') team = '';
    else if (team === '' || team === 'both') return null;
  } else if (!teamPanels.includes(panel.id) || team === 'both') {
    team = '';
  }

  const row = { panel: id, team: team };
  if (panel.monday && mondayKinds[id] === 'department') row.department = typeof raw.department === 'string' && !older ? raw.department.trim() : '';
  const seconds = tidySeconds(raw.seconds);
  if (seconds) row.seconds = seconds;
  if (older) Object.defineProperty(row, 'older', { value: true, enumerable: false });
  if (panel.id === 'photo') Object.assign(row, photoRowOf(raw));
  return row;
}

// The rows of the large panel. A row that was one of the older Monday panels and is now the same as an earlier row is left out,
// so a Screen that had the three older cards for a team plays one tasks panel and not three.
function tidyMainRows(list) {
  const rows = [];
  const same = (a, b) => a.panel === b.panel && a.team === b.team && a.department === b.department;

  tidyRows(list, tidyMainRow).forEach(row => {
    if (!(row.older === true && rows.some(earlier => same(earlier, row)))) rows.push(row);
  });
  return rows;
}

// A Photos row shows photoCount photos, each for secondsPerPhoto seconds, and stays up for the product. That
// product is its seconds, in place of the seconds a row has of its own. A row saved before these fields existed
// gets four photos of ten seconds. A number out of range is brought into range.
function photoRowOf(raw) {
  const photoCount = Math.round(keepInRange(raw.photoCount, limits.photoCount, defaultPhotoRow.photoCount));
  const secondsPerPhoto = Math.round(keepInRange(raw.secondsPerPhoto, limits.secondsPerPhoto, defaultPhotoRow.secondsPerPhoto));
  return { photoCount: photoCount, secondsPerPhoto: secondsPerPhoto, seconds: photoCount * secondsPerPhoto };
}

// A row of the small panel becomes { panel, seconds }. It never has a team: the small panels take the colors of
// the team on the banner at that moment.
function tidySideRow(raw) {
  if (!isRecord(raw) || typeof raw.panel !== 'string') return null;

  const panel = panelOf(raw.panel.trim());
  if (!panel || panel.region !== 'grid2' || panel.testOnly || panel.lastResort) return null;

  const row = { panel: panel.id };
  const seconds = tidySeconds(raw.seconds);
  if (seconds) row.seconds = seconds;
  return row;
}

function tidyRows(list, tidyRow) {
  return (Array.isArray(list) ? list : []).map(tidyRow).filter(row => row !== null);
}

function validMondayStyle(style) {
  return styles.includes(style) ? style : defaultSettings.mondayStyle;
}

// One Screen document, always complete: { style, mainRows, sideRows, nameEffectEveryMinutes, hawkEveryMinutes,
// swapSeconds, mondayStyle }. style is the style the document stands for. A Monday style that is missing is the
// one of Dashboard Settings, fallbackMondayStyle, which is how a screen that had set it there keeps it.
export function tidyScreen(raw, style, fallbackMondayStyle) {
  const source = isRecord(raw) ? raw : {};

  return {
    style: style,
    mainRows: tidyMainRows(source.mainRows),
    sideRows: tidyRows(source.sideRows, tidySideRow),
    nameEffectEveryMinutes: keepInRange(source.nameEffectEveryMinutes, limits.nameEffectEveryMinutes, defaultScreen.nameEffectEveryMinutes),
    hawkEveryMinutes: keepInRange(source.hawkEveryMinutes, limits.hawkEveryMinutes, defaultScreen.hawkEveryMinutes),
    swapSeconds: keepInRange(source.swapSeconds, limits.swapSeconds, defaultScreen.swapSeconds),
    mondayStyle: styles.includes(source.mondayStyle) ? source.mondayStyle : validMondayStyle(fallbackMondayStyle),
  };
}

function styleOfId(id) {
  return Object.keys(screenIds).find(style => screenIds[style] === id) || '';
}

// The Screens that the Studio has, from the documents as the query sends them. A document whose id is not one of the
// three is left out, and so is a second one with the same id.
export function tidyScreens(list, fallbackMondayStyle) {
  const found = [];

  (Array.isArray(list) ? list : []).forEach(raw => {
    const style = isRecord(raw) ? styleOfId(raw._id) : '';
    if (style !== '' && !found.some(screen => screen.style === style)) found.push(tidyScreen(raw, style, fallbackMondayStyle));
  });
  return found;
}


// The day

// The number of the weekday in a time zone, 0 for Sunday. A zone that Intl does not know is the Look page's default.
export function weekdayIn(timeZone, now) {
  const zone = isTimeZone(timeZone) ? timeZone : defaultThemeSettings.timeZone;
  const parts = dateIn(zone, now).split('-').map(Number);

  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
}

// The Screen schedule of Dashboard Settings, always complete: a style for each weekday. A day that is missing, or has
// a name that is not a style, has the starting Screen of that day.
export function tidySchedule(raw) {
  const source = isRecord(raw) ? raw : {};
  const schedule = {};

  weekdays.forEach(day => {
    schedule[day] = styles.includes(source[day]) ? source[day] : defaultSchedule[day];
  });
  return schedule;
}

// The style of the Screen that plays on the day it is in a time zone. weekdays starts on Monday and weekdayIn on Sunday
export function screenStyleFor(schedule, timeZone, now) {
  return tidySchedule(schedule)[weekdays[(weekdayIn(timeZone, now) + 6) % 7]];
}


// Building a Screen from the Panel order (the rule that makes the rows is in core/screen-seed.js)

export { seedMainRows, seedSideRows };

// The teams the rows can name: the ones that are switched on, and the built-in Prime when the Studio has none
export function teamsOf(content) {
  const list = isRecord(content) && Array.isArray(content.teams) && content.teams.length > 0 ? content.teams : [primeTeam];
  const active = activeTeams(list);

  return active.length > 0 ? active : [primeTeam];
}

// The Screen of a style, always complete. The document when the Studio has it, and a Screen with the starting
// values when it has not. A list of rows that is empty is built from the Panel order, so a Screen nobody has opened
// plays what the screen played before the Screens.
export function resolveScreen(content, style) {
  const source = isRecord(content) ? content : {};
  const settings = isRecord(source.settings) ? source.settings : {};
  const found = (Array.isArray(source.screens) ? source.screens : []).find(item => item.style === style);
  const screen = found || tidyScreen(null, style, settings.mondayStyle);
  if (screen.mainRows.length > 0 && screen.sideRows.length > 0) return screen;

  const order = isRecord(settings.rotation) ? settings.rotation : defaultSettings.rotation;
  return Object.assign({}, screen, {
    mainRows: screen.mainRows.length > 0 ? screen.mainRows : seedMainRows(order, teamsOf(source)),
    sideRows: screen.sideRows.length > 0 ? screen.sideRows : seedSideRows(order),
  });
}


// The plan of the day

function zoneOf(content) {
  return isRecord(content) && isRecord(content.theme) ? content.theme.timeZone : undefined;
}

// The Screen of the day and its Monday style: { style, mondayStyle, screen }. Asked again at every row, so the Screen of a
// new day is the one the first row after midnight plays in.
export function planFor(content, now = new Date()) {
  const settings = isRecord(content) && isRecord(content.settings) ? content.settings : {};
  const style = screenStyleFor(settings.screenSchedule, zoneOf(content), now);
  const screen = resolveScreen(content, style);

  return { style: style, mondayStyle: screen.mondayStyle, screen: screen };
}

// What the screen holds now: { team, style, monday }. The Screens hold the team and the style the way a preview
// does (rotateTeam in core/teams.js, rotateStyle in core/style.js), and the page puts them on in a swap.
let held = { team: '', style: '', monday: false };
const listeners = [];

export function heldLook() {
  return Object.assign({}, held);
}

// Called after the style that is held changes, so that what follows the Screen on the screen can follow it too
export function onScreenChange(listener) {
  listeners.push(listener);
}

export function holdScreenLook(look) {
  const changed = look.style !== held.style;

  held = { team: look.team, style: look.style, monday: look.monday === true };
  rotateStyle(held.style);
  rotateTeam(held.team);
  if (!changed) return;

  listeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.error('Something that follows the Screen could not change with it', error);
    }
  });
}

// The Screen on the screen: the one of the style that is held, and the one of the day before anything is held
export function currentScreen(content, now = new Date()) {
  const style = styles.includes(held.style) ? held.style : planFor(content, now).style;
  return resolveScreen(content, style);
}

// The seconds between plays of the name effect and of the hawk for a Screen, as frame.js wants them
export function cadenceOf(screen) {
  return { nameEverySeconds: screen.nameEffectEveryMinutes * 60, hawkEverySeconds: screen.hawkEveryMinutes * 60 };
}

// How much longer or shorter than the swap was built for a swap into a Screen takes, 1 for the standard length
export function swapScaleOf(screen) {
  return screen.swapSeconds / standardSwapSeconds;
}


// The lists

// The steps of the large panel: the rows of the Screen of the day, in order, as { panel, show, team, seconds, row }. They are
// the rows of that Screen also while a Monday row plays in the style of another one. row is the number of the row the
// step comes from, so that Next look now can leave all the steps of a row at once. A step is left out when its row is for
// a team that is not switched on, or for another team than ?team= asks for, and a Monday row is left out while it has
// nothing to show. core/panel-order.js (withPages) makes a step for each page of the panels that have more than one, and
// core/competition.js mixes in the competition cards.
export function mainPlaylist(content, now = new Date(), screen = planFor(content, now).screen) {
  const teams = teamsOf(content).map(team => team.code);
  const only = addressTeam();
  const steps = [];

  screen.mainRows.forEach((row, index) => {
    if (isTeamCode(row.team) && (!teams.includes(row.team) || (only !== '' && row.team !== only))) return;

    stepsOfRow(row, index, screen.mainRows, content, now).forEach(step => steps.push(Object.assign(step, { row: index })));
  });
  return steps;
}

// One step for a row. A Monday row has one step, and none while its panel has nothing to show (viewOf in core/monday-views.js): a
// department with no visible task is left out as an empty row always was. The page of the step is the team, the department and
// the turn of the row: how many rows of the same panel, team and department come right before it, plus one, so that a board that
// plays twice in a row shows the next cards the second time.
function stepsOfRow(row, index, rows, content, now) {
  const step = { show: true, team: row.team };
  if (row.seconds) step.seconds = row.seconds;
  if (row.photoCount) Object.assign(step, { photoCount: row.photoCount, secondsPerPhoto: row.secondsPerPhoto });
  if (!isMondayPanel(row.panel)) return [Object.assign({ panel: row.panel }, step)];

  let turn = 1;
  const same = other => other.panel === row.panel && other.team === row.team && (other.department || '') === (row.department || '');
  while (index - turn >= 0 && same(rows[index - turn])) turn += 1;
  const page = { team: row.team, department: row.department || '', turn: turn };
  return viewOf(row.panel, content, now, page) === null ? [] : [Object.assign({ panel: row.panel, page: page }, step)];
}

// The steps of the small panel: the side rows of the Screen that is on the screen, with no team
export function sidePlaylist(content, now = new Date()) {
  return currentScreen(content, now).sideRows.map(row => {
    const step = { panel: row.panel, show: true };
    if (row.seconds) step.seconds = row.seconds;
    return step;
  });
}


// The look of a row

// Whether a style can go on a page that is drawn for one layout. The page is drawn for onPage (core/layout.js,
// drawnFor) and the style asks for wanted. A page changes layout while it runs, so it can take any style
// (core/layout-apply.js, layoutsChangeLive). One whose change has failed goes on by a reload, and the reload is
// made impossible when the page has reloaded for that layout already, or cannot keep a note (mustReload in
// core/layout.js). canReload says whether it may. A Monday row whose style cannot go on is left out for now: the
// cards are never drawn in the frames of another style.
export function styleCanGoOn(onPage, wanted, canReload) {
  return wanted === onPage || canReload === true;
}

// The look the screen has while a step plays: { team, style, monday }. A step with a team is shown in that team, and one
// with none, or for both teams, in the team the screen has now. A Monday step is in the Monday style and every other
// step in the style of the day. from is the look the screen has now, and plan comes from planFor.
export function lookForStep(step, from, plan) {
  const monday = isMondayPanel(step.panel);

  return { team: isTeamCode(step.team) ? step.team : from.team, style: monday ? plan.mondayStyle : plan.style, monday: monday };
}

// What changes from one look to the next. The team and the style are what goes on the page, and a change of either
// is a swap. Going into the Monday cards or out of them is noted as monday: with the Monday style of the day it
// changes no style, and the swap for it is the one core/swap-run.js plays at every Monday card in full motion.
// A screen that holds nothing yet (it has no style) has nothing to swap from.
export function changesBetween(from, to) {
  const changes = { team: from.team !== to.team, style: from.style !== to.style, monday: from.monday !== to.monday };

  changes.swap = from.style !== '' && (changes.team || changes.style);
  return changes;
}

// Walks the steps once, from the look start, and says for each one the look it has and what changes to get to it. The
// page does the same one step at a time (core/screens-run.js).
export function walkSteps(steps, plan, start) {
  let from = start;

  return steps.map(step => {
    const look = lookForStep(step, from, plan);
    const changes = changesBetween(from, look);

    from = look;
    return { panel: step.panel, look: look, changes: changes };
  });
}

// The look the screen starts with, before anything is drawn: { team, style, monday }. content is the saved copy of the
// content, or null when there is none, and then nothing is held and the settings decide. The Screen of the day, and
// the team of the first row that has one, or the first team that is switched on.
export function bootLook(content, now = new Date()) {
  if (!isRecord(content)) return { team: '', style: '', monday: false };

  const plan = planFor(content, now);
  const steps = mainPlaylist(content, now, plan.screen);
  const first = steps.find(step => isTeamCode(step.team));
  const start = { team: first ? first.team : teamsOf(content)[0].code, style: plan.style, monday: false };

  return steps.length > 0 ? lookForStep(steps[0], start, plan) : start;
}

// Works out the look the screen starts with and holds it, in the same two modules a preview holds a look in, so that
// the style and the layout the page starts with are the ones of the first row. Returns the look.
export function holdBootScreen(content, now = new Date()) {
  const look = bootLook(content, now);

  holdScreenLook(look);
  return look;
}


// Next look now

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

// The plain functions of the runner. deps is what it needs from the page:
//   getContent()   the newest content
//   storage        localStorage, or null when the browser has none
//   busy()         true while something has the screen, and the request waits
//   next(now)      moves the large panel on to the next row (the runner of the page gives it)
// Call look(now) once a second. A request counts only when it is less than a minute old and is not the one handled
// before, the same guard as Play announcements (shouldRunDemo in core/demo.js).
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
