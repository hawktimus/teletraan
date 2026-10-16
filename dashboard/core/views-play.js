// The steps of a view, the view of the day and the held view (part of views.js).

import { barStyle, defaultThemeByWeekday, scheduledThemeIds, viewKeys, weekdays } from '../config.js';
import { forTeam, visibleTasks } from './monday.js';
import { departmentEntries, departmentsOf } from './monday-views.js';
import { holdScreenLook, isMondayPanel, isTeamCode, planFor, stepsOfRow, teamsOf, weekdayIn } from './screens.js';
import { rotateLayout } from './style.js';
import { addressTeam } from './teams.js';
import { heldView, holdView } from './view-apply.js';
import { isRecord } from './text.js';
import { timeZoneOf } from './theme.js';
import { resolveView, viewOrderOf } from './views-tidy.js';

// The Monday rows

// The ids of the Team leads a team view plays Monday tasks for: the ones with tasks for the team, except those with
// Monday switched off (monday: false on the Team lead). A Team lead with no mark is on. A new department is a new row
// without any edit.
function mondayDepartments(content, team, now = new Date()) {
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
function viewIsPlayable(content, key, now = new Date(), canShow = () => true) {
  return viewSteps(content, key, now).some(step => canShow(step));
}

// The views of the order that have something to show
function playableViews(content, now = new Date(), canShow = () => true) {
  return viewOrderOf(content).filter(key => viewIsPlayable(content, key, now, canShow));
}

// The key that follows current in the order among the playable ones, going round. When current is not in the order, it
// is the first playable one.
function nextViewKey(order, current, playable) {
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
  const zone = timeZoneOf(content);
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


// The view the lists are read for: the one the clock is on, or the first of the order before it has started
function listedView(content) {
  return viewKeys.includes(cycle.key) ? cycle.key : viewOrderOf(content)[0];
}

export function resetViews() {
  cycle.key = '';
  cycle.seconds = 0;
  cycle.ticks = 0;
  holdView('');
  rotateLayout('');
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
function bootViewLook(content, now = new Date()) {
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
    holdView(key);
    rotateLayout(viewLayoutOf(content, key));
  }
  holdScreenLook(look);
  return look;
}
