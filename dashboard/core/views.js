// The Views: the plain functions. They know nothing about the page, so tests/views.test.mjs can run them.
// core/views-run.js gives them the real screen, and core/schedule.js asks them at every page of the large panel.
//
// How it goes (docs/views.md):
//   1. A View is one of four documents, General, Prime, Nova and Family. Its id says its key. It holds a layout (fixed by
//      the key), a team, the minutes it stays on the screen, the rows of the large panel and the rows of the small panel.
//      A document that is missing, or has no rows, is the view of defaultViews in config.js.
//   2. viewOrder of Dashboard Settings says the order they play in. The screen shows a view for its minutes and then
//      moves to the next one in the order that has something to show. A swap plays at every view change. Inside a
//      view the panels change with the plain page change.
//   3. The theme of the day (the Screens' schedule, core/screens.js) is drawn over whichever view plays. The Screen
//      documents stay as they were: they hold the banner settings and the Monday style, and the seed of the Views.
//   4. A row of a team view with no department stands for every Team lead marked for Monday (expandRows).
//   5. The minutes stand still while an alert, an announcement, a talk, a demo or the night screen has the screen, so
//      the view that was interrupted is the view that comes back, at the panel that was next.

import { barStyle, countdownPlaces, defaultSettings, defaultThemeByWeekday, defaultViews, familyPanels, scheduledThemeIds, viewColors, viewIds, viewKeys, viewLayoutNames, viewLimits, viewTeams, weekdays } from '../config.js';
import { keepInRange } from './content.js';
import { forTeam, visibleTasks } from './monday.js';
import { departmentEntries, departmentsOf } from './monday-views.js';
import { holdScreenLook, isMondayPanel, isTeamCode, planFor, stepsOfRow, teamsOf, tidyMainRow, tidySideRow, weekdayIn } from './screens.js';
import { addressTeam } from './teams.js';
import { heldView, holdView } from './view-apply.js';
import { hasText } from './text.js';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const teamCode = /^[a-z0-9]+$/;

function tidyTeam(value) {
  const code = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return teamCode.test(code) && code !== 'both' ? code : '';
}

function trimmed(value, longest, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text === '' ? fallback : text.slice(0, longest);
}


// The settings

export const longestName = 24;
export const longestTitle = 40;

export function viewOrderOf(content) {
  const settings = isRecord(content) && isRecord(content.settings) ? content.settings : {};
  const order = Array.isArray(settings.viewOrder) ? settings.viewOrder.filter((key, at, list) => viewKeys.includes(key) && list.indexOf(key) === at) : [];

  return order.length > 0 ? order : viewKeys.slice();
}


// The documents

// The rows of the large panel of one view. A team view gives its team to every row, so a row of a panel that does not
// follow the team is still drawn in the team of the view. The rows of Family are the two fixed ones.
function tidyPanels(rows, key, team) {
  const wanted = (Array.isArray(rows) ? rows : []).map(raw => {
    if (!isRecord(raw)) return null;
    return tidyMainRow(team === '' ? raw : Object.assign({}, raw, { team: team }));
  }).filter(row => row !== null);

  if (key !== 'family') return wanted;

  return familyPanels.map(panel => wanted.find(row => row.panel === panel) || tidyMainRow(defaultViews.family.panels.find(row => row.panel === panel)));
}

function tidyRows(list) {
  return (Array.isArray(list) ? list : []).map(tidySideRow).filter(row => row !== null);
}

// One view document, always complete: { key, title, team, layout, mirror, countdownIn, viewTag, teamChip, colors, minutes, panels,
// sidePanels }. A list of rows that is
// empty is the starting one. The small panel exists in the standard layout only, so the other views have no side rows.
export function tidyView(raw, key) {
  const source = isRecord(raw) ? raw : {};
  const start = defaultViews[key];
  const team = viewTeams[key] === '' ? '' : tidyTeam(source.team) || viewTeams[key];
  const panels = tidyPanels(source.panels, key, team);
  const layout = viewLayoutNames.includes(source.layout) ? source.layout : start.layout;
  const sidePanels = tidyRows(source.sidePanels);
  const flag = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

  return {
    key: key,
    title: typeof source.title === 'string' ? source.title.trim() : '',
    team: team,
    layout: layout,
    mirror: flag(source.mirror, start.mirror),
    countdownIn: countdownPlaces.includes(source.countdownIn) ? source.countdownIn : start.countdownIn,
    viewTag: key === 'family' ? false : flag(source.viewTag, start.viewTag),
    teamChip: flag(source.teamChip, start.teamChip),
    colors: viewColors.includes(source.colors) ? source.colors : start.colors,
    minutes: Math.round(keepInRange(source.minutes, viewLimits.minutes, start.minutes)),
    panels: panels.length > 0 ? panels : tidyPanels(start.panels, key, team),
    sidePanels: layout !== 'standard' ? [] : sidePanels.length > 0 ? sidePanels : tidyRows(start.sidePanels),
  };
}

function keyOfId(id) {
  return viewKeys.find(key => viewIds[key] === id) || '';
}

// The views that the Studio has, from the documents as the query sends them. A document whose id is not one of the
// four is left out, and so is a second one with the same id.
export function tidyViews(list) {
  const found = [];

  (Array.isArray(list) ? list : []).forEach(raw => {
    const key = isRecord(raw) ? keyOfId(raw._id) : '';
    if (key !== '' && !found.some(view => view.key === key)) found.push(tidyView(raw, key));
  });
  return found;
}

// The view of a key, always complete: the document when the Studio has it and the starting view when it has not
export function resolveView(content, key) {
  const found = (isRecord(content) && Array.isArray(content.views) ? content.views : []).find(view => view.key === key);
  return found || tidyView(null, key);
}


// The names

// The name of a view as the tag in the banner says it, and the title of the banner. A team view is named for its
// team (the short name) and titled with the whole name of the team that is on the screen, which the banner knows.
export function viewNameOf(content, key) {
  const settings = isRecord(content) && isRecord(content.settings) ? content.settings : {};
  const view = resolveView(content, key);

  if (key === 'general') return trimmed(settings.generalViewName, longestName, defaultSettings.generalViewName);
  if (key === 'family') return view.title !== '' ? view.title : 'Family';

  const team = (isRecord(content) && Array.isArray(content.teams) ? content.teams : []).find(item => item.code === view.team);
  if (team && hasText(team.shortName)) return String(team.shortName).trim();
  return view.title !== '' ? view.title : view.team.toUpperCase();
}

// The title of the banner when the view has one of its own: General and Family carry the title of Dashboard Settings,
// and a team view carries its team's name, which is the banner's own
export function viewTitleOf(content, key) {
  if (key !== 'general' && key !== 'family') return '';

  const settings = isRecord(content) && isRecord(content.settings) ? content.settings : {};
  return trimmed(settings.generalViewTitle, longestTitle, defaultSettings.generalViewTitle);
}

// Whether the tag with the name of the view is drawn. Family is not named on the screen, and a view can switch it off.
export function viewShowsTag(content, key) {
  return key !== 'family' && resolveView(content, key).viewTag;
}


// The Monday rows

// The ids of the Team leads a team view plays Monday tasks for: the ones with tasks for the team, except those with
// Monday switched off (monday: false on the Team lead). A Team lead with no mark is on. A new department is a new row
// without any edit.
export function mondayDepartments(content, team, now = new Date()) {
  const entries = departmentEntries(content, now);
  const wanted = entries.filter(entry => entry.monday !== false).map(entry => entry.id);
  const withTasks = departmentsOf(content, forTeam(visibleTasks(content, now), team), now).map(entry => entry.id);

  return wanted.filter(id => withTasks.includes(id));
}

// The rows with each Monday tasks row that has no department replaced by one row for every department that Monday
// plays for the team. A row with a department is the one department.
export function expandRows(rows, content, now = new Date()) {
  const expanded = [];

  rows.forEach(row => {
    if (row.panel !== 'monday-tasks' || (row.department || '') !== '') {
      expanded.push(row);
      return;
    }

    mondayDepartments(content, row.team, now).forEach(id => expanded.push(Object.assign({}, row, { department: id })));
  });
  return expanded;
}


// The lists

// The steps of the large panel of a view, in order, as { panel, show, team, seconds, row, view }. The team of a step is
// the team of the view for a team view, and the team of the row otherwise. A step is left out when its row is for a team
// that is not switched on or for another team than ?team= asks for, and a Monday row while it has nothing to show.
export function viewSteps(content, key, now = new Date()) {
  const view = resolveView(content, key);
  const teams = teamsOf(content).map(team => team.code);
  const only = addressTeam();
  const rows = expandRows(view.panels, content, now);
  const steps = [];

  if (view.team !== '' && (!teams.includes(view.team) || (only !== '' && view.team !== only))) return steps;

  rows.forEach((row, index) => {
    if (isTeamCode(row.team) && (!teams.includes(row.team) || (only !== '' && row.team !== only))) return;

    stepsOfRow(row, index, rows, content, now).forEach(step => {
      steps.push(Object.assign(step, { row: index, view: key, team: view.team !== '' ? view.team : step.team }));
    });
  });
  return steps;
}

// The steps of the small panel of a view: the side rows, with no team. The bar layout has no small panel.
export function viewSideSteps(content, key) {
  return resolveView(content, key).sidePanels.map(row => {
    const step = { panel: row.panel, show: true, view: key };
    if (row.seconds) step.seconds = row.seconds;
    return step;
  });
}

// True when the view has a step to show. canShow(step) says whether the panel of a step has content, and a test leaves
// it out: the page gives it, because only the page knows the team a step is drawn for.
export function viewIsPlayable(content, key, now = new Date(), canShow = () => true) {
  return viewSteps(content, key, now).some(step => canShow(step));
}

// The views of the order that have something to show
export function playableViews(content, now = new Date(), canShow = () => true) {
  return viewOrderOf(content).filter(key => viewIsPlayable(content, key, now, canShow));
}

// The key that follows current in the order among the playable ones, going round. When current is not in the order, it
// is the first playable one.
export function nextViewKey(order, current, playable) {
  const at = order.indexOf(current);

  for (let step = 1; step <= order.length; step += 1) {
    const key = order[(at + step) % order.length];
    if (playable.includes(key)) return key;
  }
  return playable.length > 0 ? playable[0] : current;
}


// The look of a step

// The theme of the day for a time: the weekday of the Look time zone picks one of themeByWeekday of Dashboard Settings
export function dayThemeFor(content, now = new Date()) {
  const settings = isRecord(content) && isRecord(content.settings) ? content.settings : {};
  const zone = isRecord(content) && isRecord(content.theme) ? content.theme.timeZone : undefined;
  const day = weekdays[(weekdayIn(zone, now) + 6) % 7];
  const chosen = isRecord(settings.themeByWeekday) ? settings.themeByWeekday[day] : '';

  return scheduledThemeIds.includes(chosen) ? chosen : defaultThemeByWeekday[day];
}

// The plan of the day: { style, mondayStyle }. The style is the theme of the day. The Monday style comes from the Screen
// documents, which are kept for it.
export function viewPlan(content, now = new Date()) {
  return { style: dayThemeFor(content, now), mondayStyle: planFor(content, now).mondayStyle };
}

// The layout of a view
export function viewLayoutOf(content, key) {
  return resolveView(content, key).layout;
}

// The style a view is drawn in. A bar view is the theme of the day in the bar layout, whose frames are the same in every
// theme (core/style.js). A standard view takes the Monday style while a Monday card plays, unless that is the old
// name that stands for the bar layout.
export function drawStyleFor(layout, monday, plan) {
  if (layout === 'bar' || !monday || plan.mondayStyle === barStyle) return plan.style === barStyle ? 'original' : plan.style;

  return plan.mondayStyle;
}

// A step that came from outside the views (a competition card is mixed into the large panel's list) plays in the view
// that is on the screen, in the team of that view
export function stepInView(step, content, fallbackKey) {
  if (viewKeys.includes(step.view)) return step;

  const key = viewKeys.includes(fallbackKey) ? fallbackKey : viewOrderOf(content)[0];
  return Object.assign({}, step, { view: key, team: isTeamCode(step.team) ? step.team : resolveView(content, key).team });
}

// The look the screen has while a step plays: { team, style, monday }. A team view is in its team. A view with no team is
// in the team the Team mode asks for, which an empty team holds. layout is the layout of the view of the step.
export function lookForViewStep(step, plan, layout) {
  const monday = isMondayPanel(step.panel);

  return { team: isTeamCode(step.team) ? step.team : '', style: drawStyleFor(layout, monday, plan), monday: monday };
}


// The view on the screen

// The view the clock of the minutes is on, and how many seconds it has been there
const cycle = { key: '', seconds: 0, ticks: 0 };

export function cycleKey() {
  return cycle.key;
}

// How many seconds the clock has counted in the view it is on
export function cycleSeconds() {
  return cycle.seconds;
}

export { heldView, holdView };

// The view the lists are read for: the one the clock is on, or the first of the order before it has started
function listedView(content) {
  return viewKeys.includes(cycle.key) ? cycle.key : viewOrderOf(content)[0];
}

export function resetViews() {
  cycle.key = '';
  cycle.seconds = 0;
  cycle.ticks = 0;
  holdView('');
  heldPanel = '';
}

// The panel the control page holds on the screen, or ''. While one is held the large panel plays that panel only.
let heldPanel = '';

export function holdPanelId(id) {
  heldPanel = typeof id === 'string' ? id : '';
}

// The first view in the order that has a step of this panel, or ''
export function findViewWithPanel(content, panel, now = new Date()) {
  return viewOrderOf(content).find(key => viewSteps(content, key, now).some(step => step.panel === panel)) || '';
}

// The steps of the large panel: the view the clock is on
export function viewPlaylist(content, now = new Date()) {
  const steps = viewSteps(content, listedView(content), now);
  return heldPanel === '' ? steps : steps.filter(step => step.panel === heldPanel);
}

// The steps of the small panel: the view whose look is held, which is the one on the screen. The clock may be on the
// next view for a moment before its first page comes, and the small panel does not change before the swap.
export function viewSidePlaylist(content) {
  return viewSideSteps(content, heldView() !== '' ? heldView() : listedView(content));
}

function startView(key) {
  cycle.key = key;
  cycle.seconds = 0;
}

// How often, in ticks, the playable views are worked out when the clock has not run out
const checkEvery = 10;

// One second of the clock. options: frozen (something has the screen: the seconds do not count), forced (a key the
// control page asked for: the view stays), canShow (see viewIsPlayable). Returns { key, changed }. The view moves on when
// its minutes are up, or when it has nothing to show any more, to the next one in the order that has something. With one
// view playable it stays and starts its minutes again. An empty list of playable views leaves the clock as it is.
export function tickView(content, now, options = {}) {
  const before = cycle.key;
  const forced = viewKeys.includes(options.forced) ? options.forced : '';

  if (forced !== '') {
    if (cycle.key !== forced) startView(forced);
    return { key: cycle.key, changed: cycle.key !== before };
  }
  if (options.frozen === true && cycle.key !== '') return { key: cycle.key, changed: false };

  cycle.ticks += 1;
  cycle.seconds += 1;
  const over = cycle.key !== '' && cycle.seconds >= resolveView(content, cycle.key).minutes * 60;

  if (cycle.key === '' || over || cycle.ticks % checkEvery === 0) {
    const playable = playableViews(content, now, options.canShow);
    const order = viewOrderOf(content);

    if (playable.length > 0) {
      if (!playable.includes(cycle.key)) startView(nextViewKey(order, cycle.key, playable));
      else if (over && playable.length > 1) startView(nextViewKey(order, cycle.key, playable));
      else if (over) cycle.seconds = 0;
    } else if (over) {
      cycle.seconds = 0;
    }
  }
  return { key: cycle.key, changed: cycle.key !== before };
}


// The start

// The look the screen starts with, before anything is drawn: { team, style, monday }. content is the saved copy of the
// content, or null when there is none, and then nothing is held and the settings decide. It is the look of the first
// step of the first view in the order that has one.
export function bootViewLook(content, now = new Date()) {
  if (!isRecord(content)) return { team: '', style: '', monday: false };

  const plan = viewPlan(content, now);
  const key = playableViews(content, now)[0] || viewOrderOf(content)[0];
  const steps = viewSteps(content, key, now);
  const step = steps.length > 0 ? steps[0] : { panel: '', view: key, team: resolveView(content, key).team };

  return lookForViewStep(step, plan, viewLayoutOf(content, key));
}

// Works out the look the screen starts with and holds it, with the view, in the same modules a preview holds a look in.
// Returns the look.
export function holdBootView(content, now = new Date()) {
  const look = bootViewLook(content, now);

  if (isRecord(content)) {
    const key = playableViews(content, now)[0] || viewOrderOf(content)[0];
    startView(key);
    holdView(key, viewLayoutOf(content, key));
  }
  holdScreenLook(look);
  return look;
}
