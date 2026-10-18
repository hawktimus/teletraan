// The steps of a view, the view of the day and the held view (part of views.js).

import { barStyle, defaultThemeByWeekday, roboticsWidePanels, scheduledThemeIds, viewKeys, weekdays } from '../config.js';
import { forTeam, visibleTasks } from './monday.js';
import { departmentEntries, departmentsOf, isBothTeamDepartment } from './monday-views.js';
import { holdScreenLook, isMondayPanel, isTeamCode, planFor, stepsOfRow, teamsOf, tidyMainRow, weekdayIn } from './screens.js';
import { rotateLayout } from './style.js';
import { addressTeam } from './teams.js';
import { heldView, holdView } from './view-apply.js';
import { isRecord } from './text.js';
import { timeZoneOf } from './theme.js';
import { mainRowOf, rotationBlocks, rotationRowsOf } from './rotation.js';
import { resolveView, viewOrderOf } from './views-tidy.js';

// The Monday rows

// The ids of the Team leads a Monday tasks row plays for: the ones with tasks for the team, except those with Monday
// switched off (monday: false on the Team lead). A Team lead with no mark is on. A new department is a new row without any
// edit. Design and CNC are one row. A team view plays the departments of its team, and a row with no team (Robotics) plays
// the departments of both teams (Business, Operations, Marketing), which a team view leaves out.
function mondayDepartments(content, team, now = new Date()) {
  const entries = departmentEntries(content, now);
  const wanted = entries.filter(entry => entry.monday !== false).map(entry => entry.id);
  const both = team === '';
  const withTasks = departmentsOf(content, forTeam(visibleTasks(content, now), team), now);

  return withTasks
    .filter(group => group.ids.some(id => wanted.includes(id)) && isBothTeamDepartment(group.name) === both)
    .map(group => group.id);
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

// The rotation list (core/rotation.js): the blocks of its shown rows, which are the default rotation while the Studio has no
// shown row. The lists of the views are played only when the list has no block at all, which cannot happen with the default.
function listBlocks(content) {
  const blocks = rotationBlocks(rotationRowsOf(content));
  return blocks.length > 0 ? blocks : null;
}

// The rows of the large panel of a view. With a rotation list they are the rows of its blocks of that view (one block when
// block is a number), as rows of the large panel. Without one they are the rows of the view document.
function rowsOfView(content, key, block) {
  const blocks = listBlocks(content);
  if (blocks === null) return resolveView(content, key).panels;

  const wanted = blocks.filter((item, at) => item.key === key && (block < 0 || at === block));
  // A view the list has no block for, Condensed, plays the rows of its own document when the control page shows it
  if (wanted.length === 0 && block < 0) return resolveView(content, key).panels;
  return [].concat(...wanted.map(item => item.rows.map(row => tidyMainRow(mainRowOf(row, content), item.key === 'general', true)).filter(row => row !== null)));
}

// The order the views play in: the order of the list's blocks (each view once), or viewOrder
function playOrder(content) {
  const blocks = listBlocks(content);
  if (blocks === null) return viewOrderOf(content);

  return blocks.map(item => item.key).filter((key, at, all) => all.indexOf(key) === at);
}

// The steps of the large panel of a view, in order, as { panel, show, team, seconds, row, view }. The team of a step is
// the team of the view for a team view, and the team of the row otherwise. A step is left out when its row is for a team
// that is not switched on or for another team than ?team= asks for, and a Monday row while it has nothing to show.
export function viewSteps(content, key, now = new Date(), block = -1) {
  const view = resolveView(content, key);
  const teams = teamsOf(content).map(team => team.code);
  const only = addressTeam();
  const rows = expandRows(rowsOfView(content, key, block), content, now);
  const steps = [];

  if (view.team !== '' && (!teams.includes(view.team) || (only !== '' && view.team !== only))) return steps;

  rows.forEach((row, index) => {
    if (isTeamCode(row.team) && (!teams.includes(row.team) || (only !== '' && row.team !== only))) return;

    stepsOfRow(row, index, rows, content, now).forEach(step => {
      steps.push(Object.assign(step, { row: index, view: key, team: view.team !== '' ? view.team : key === 'general' ? teams[0] : step.team }));
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
  return playOrder(content).filter(key => viewIsPlayable(content, key, now, canShow));
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

// The layout a step is drawn in. Robotics has two, chosen by the panel of the row: wide (the bar layout) for the panels in
// roboticsWidePanels, and split (the standard layout) for the others. The other views have the layout of their document.
export function layoutOfStep(content, step) {
  const key = viewKeys.includes(step.view) ? step.view : '';
  if (key === 'general') return roboticsWidePanels.includes(step.panel) ? 'bar' : 'standard';

  return key === '' ? 'standard' : viewLayoutOf(content, key);
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

  const key = viewKeys.includes(fallbackKey) ? fallbackKey : playOrder(content)[0];
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
const cycle = { key: '', block: -1, seconds: 0, ticks: 0 };

export function cycleKey() {
  return cycle.key;
}

// The number of the block of the rotation list the clock is on, or -1 when the views play their own lists
export function cycleBlock() {
  return cycle.block;
}

// How many seconds the clock has counted in the view it is on
export function cycleSeconds() {
  return cycle.seconds;
}


// The view the lists are read for: the one the clock is on, or the first of the order before it has started
function listedView(content) {
  return viewKeys.includes(cycle.key) ? cycle.key : playOrder(content)[0];
}

export function resetViews() {
  cycle.key = '';
  cycle.block = -1;
  cycle.seconds = 0;
  cycle.ticks = 0;
  holdView('');
  rotateLayout('');
  heldPanel = '';
  paired.panel = '';
}

// The panel the control page holds on the screen, or ''. While one is held the large panel plays that panel only.
let heldPanel = '';

export function holdPanelId(id) {
  heldPanel = typeof id === 'string' ? id : '';
}

// The first view in the order that has a step of this panel, or ''
export function findViewWithPanel(content, panel, now = new Date()) {
  return playOrder(content).find(key => viewSteps(content, key, now).some(step => step.panel === panel)) || '';
}

// The steps of the large panel: the view the clock is on
export function viewPlaylist(content, now = new Date()) {
  const steps = viewSteps(content, listedView(content), now, cycle.block);
  return heldPanel === '' ? steps : steps.filter(step => step.panel === heldPanel);
}

// The small panel a row of the rotation pairs with the panel of the large frame (the side of the row), while that row is on
// the screen. views-run.js notes it each time a step of the large panel is chosen.
const paired = { panel: '', seconds: 0 };

// A step of the large panel has been chosen. Returns true when the small panel has to change with it: the step has a side, or
// the one before it did. The side stays longer than the step, because the next step moves it on.
export function pairSide(step) {
  const side = step && typeof step.side === 'string' ? step.side : '';
  const moves = side !== '' || paired.panel !== '';

  paired.panel = side;
  paired.seconds = (step && step.seconds ? step.seconds : 20) + 120;
  return moves;
}

// The steps of the small panel: the panel paired with the row on the screen, or else the view whose look is held, which is the
// one on the screen. The clock may be on the next view for a moment before its first page comes, and the small panel does not
// change before the swap.
export function viewSidePlaylist(content) {
  if (paired.panel !== '') return [{ panel: paired.panel, show: true, seconds: paired.seconds, paired: true }];

  return viewSideSteps(content, heldView() !== '' ? heldView() : listedView(content));
}

function startView(key, block = -1) {
  cycle.key = key;
  cycle.block = block;
  cycle.seconds = 0;
}


// The blocks of the rotation list

// The numbers of the blocks that have a step to show
function playableBlocks(content, now, canShow = () => true) {
  const blocks = listBlocks(content);
  return blocks.map((item, at) => at).filter(at => viewSteps(content, blocks[at].key, now, at).some(step => canShow(step)));
}

// How long a block stays: the seconds of its steps that have something to show. A step with no seconds follows pageSeconds.
function blockSeconds(content, at, now, canShow = () => true) {
  const blocks = listBlocks(content);
  const settings = isRecord(content) && isRecord(content.settings) ? content.settings : {};
  const each = typeof settings.pageSeconds === 'number' && settings.pageSeconds > 0 ? settings.pageSeconds : 20;

  return viewSteps(content, blocks[at].key, now, at).filter(step => canShow(step)).reduce((sum, step) => sum + (step.seconds || each), 0);
}

// The block after at among the playable ones, going round
function nextBlock(count, at, playable) {
  for (let step = 1; step <= count; step += 1) {
    const found = (at + step + count) % count;
    if (playable.includes(found)) return found;
  }
  return playable.length > 0 ? playable[0] : at;
}

// One second of the clock over the blocks. The same options as tickView. A block stays for the seconds of its rows, and then
// the next block with something to show comes; with one block it starts again and nothing changes.
function tickBlocks(content, now, options) {
  const blocks = listBlocks(content);
  const before = { key: cycle.key, block: cycle.block };
  const moved = () => ({ key: cycle.key, changed: cycle.key !== before.key || cycle.block !== before.block });
  const forced = viewKeys.includes(options.forced) ? options.forced : '';

  if (forced !== '') {
    // Every block of the view play, one after the other, as the rows of one view: no block is named
    if (cycle.key !== forced || cycle.block !== -1) startView(forced);
    return moved();
  }
  if (options.frozen === true && cycle.key !== '') return moved();

  cycle.ticks += 1;
  cycle.seconds += 1;
  // A block counts as known only while the block at that place is still of the view the clock is on: a list published while
  // the wall runs can put another view at the same place, and the large panel would then have no step to play.
  const known = cycle.block >= 0 && cycle.block < blocks.length && blocks[cycle.block].key === cycle.key;
  const over = known && cycle.seconds >= blockSeconds(content, cycle.block, now, options.canShow);

  if (!known || over || cycle.ticks % checkEvery === 0) {
    const playable = playableBlocks(content, now, options.canShow);

    if (playable.length > 0) {
      const go = at => startView(blocks[at].key, at);
      if (!known && playable.includes(cycle.block)) go(cycle.block);
      else if (!playable.includes(cycle.block)) go(nextBlock(blocks.length, cycle.block, playable));
      else if (over && playable.length > 1) go(nextBlock(blocks.length, cycle.block, playable));
      else if (over) cycle.seconds = 0;
    } else if (over) {
      cycle.seconds = 0;
    }
  }
  return moved();
}

// How often, in ticks, the playable views are worked out when the clock has not run out
const checkEvery = 10;

// One second of the clock. options: frozen (something has the screen: the seconds do not count), forced (a key the
// control page asked for: the view stays), canShow (see viewIsPlayable). Returns { key, changed }. The view moves on when
// its minutes are up, or when it has nothing to show any more, to the next one in the order that has something. With one
// view playable it stays and starts its minutes again. An empty list of playable views leaves the clock as it is.
export function tickView(content, now, options = {}) {
  if (listBlocks(content) !== null) return tickBlocks(content, now, options);

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
    const order = playOrder(content);

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

// The view, and the block of the rotation list, the screen starts with: the first that has something to show
function firstUnit(content, now) {
  const blocks = listBlocks(content);
  if (blocks === null) return { key: playableViews(content, now)[0] || playOrder(content)[0], block: -1 };

  const at = playableBlocks(content, now)[0];
  return at === undefined ? { key: blocks[0].key, block: 0 } : { key: blocks[at].key, block: at };
}

function firstStepOf(content, key, block, now) {
  return viewSteps(content, key, now, block)[0] || { panel: '' };
}

// The look the screen starts with, before anything is drawn: { team, style, monday }. content is the saved copy of the
// content, or null when there is none, and then nothing is held and the settings decide. It is the look of the first
// step of the first view in the order that has one.
function bootViewLook(content, now = new Date()) {
  if (!isRecord(content)) return { team: '', style: '', monday: false };

  const plan = viewPlan(content, now);
  const { key, block } = firstUnit(content, now);
  const steps = viewSteps(content, key, now, block);
  const step = steps.length > 0 ? steps[0] : { panel: '', view: key, team: resolveView(content, key).team };

  return lookForViewStep(step, plan, layoutOfStep(content, Object.assign({ view: key }, step)));
}

// Works out the look the screen starts with and holds it, with the view, in the same modules a preview holds a look in.
// Returns the look.
export function holdBootView(content, now = new Date()) {
  const look = bootViewLook(content, now);

  if (isRecord(content)) {
    const { key, block } = firstUnit(content, now);
    startView(key, block);
    holdView(key);
    rotateLayout(layoutOfStep(content, Object.assign({ view: key }, firstStepOf(content, key, block, now))));
  }
  holdScreenLook(look);
  return look;
}
