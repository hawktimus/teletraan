// Tests for the Views (docs/views.md): the documents and their starting values, the order, the Monday rows that expand
// by themselves, the clock of the minutes with its swap at every change, the views that are skipped, and the views
// handed to the screen (dashboard/core/views-run.js, run for real with stand-ins for the swap, the schedule and the
// other parts of the screen). Nothing is drawn and no clock runs.
//
//   node tests/views.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';
import { readModule } from './helpers/read-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const docsFolder = fileURLToPath(new URL('../docs/', import.meta.url));
const read = file => readModule(path.join(dashboardFolder, file), 'utf8');
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-views-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js'].forEach(file => copyModule(path.join(dashboardFolder, file), path.join(root, file)));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  copyModule(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  copyModule(path.join(dashboardFolder, file), path.join(root, file));
});

// The parts of the screen that need a page are stand-ins that write down what they were asked
const standIns = {
  'frame.js': ['export const onSecond = listener => { globalThis.viewsWorld.seconds = listener; };'],
  'core/schedule.js': [
    'export const setLookHooks = hooks => { globalThis.viewsWorld.hooks = hooks; };',
    "export const skipRow = () => globalThis.viewsWorld.log.push('skipRow');",
    "export const startListsOver = () => globalThis.viewsWorld.log.push('startListsOver');",
    'export const pauseRotation = () => globalThis.viewsWorld.log.push("pauseRotation");',
    'export const resumeRotation = () => globalThis.viewsWorld.log.push("resumeRotation");',
    "export const moveOn = regions => globalThis.viewsWorld.log.push('moveOn ' + regions.join(' '));",
  ],
  'core/swap-run.js': [
    "export const queueSwap = () => globalThis.viewsWorld.log.push('queueSwap');",
    'export const startSwaps = (busy, scale) => { globalThis.viewsWorld.swapBusy = busy; globalThis.viewsWorld.swapScale = scale; };',
    'export const swapRunning = () => globalThis.viewsWorld.swapping;',
  ],
  'core/team-run.js': ['export const noteWantedTeam = () => {};'],
  'core/takeover.js': ['export const takeoverRunning = () => globalThis.viewsWorld.takeover;'],
  'core/theme-apply.js': ["export const checkTheme = () => globalThis.viewsWorld.log.push('checkTheme');"],
  'core/demo-runner.js': ['export const demoRunning = () => false;'],
  'core/night-screen.js': ['export const nightIsUp = () => false;'],
  'core/hidden-run.js': ['export const hiddenPlaying = () => false;'],
  'core/panels.js': ['export const canShow = (panel, content, page) => globalThis.viewsWorld.canShow(panel, page);'],
};
Object.keys(standIns).forEach(file => fs.writeFileSync(path.join(root, file), standIns[file].join('\n') + '\n'));

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const views = await import(base + 'core/views.js');
const viewApply = await import(base + 'core/view-apply.js');
const screens = await import(base + 'core/screens.js');
const sanity = await import(base + 'core/sanity.js');
const contentModule = await import(base + 'core/content.js');
const teamsModule = await import(base + 'core/teams.js');
const weather = await import(base + 'core/weather.js');

const tests = [];
function test(name, body) {
  tests.push({ name: name, run: body });
}

const at = text => new Date(text);
const monday12 = at('2026-10-12T16:00:00Z');

const sampleRaw = () => JSON.parse(readModule(path.join(dashboardFolder, 'data/sample/content.json'), 'utf8'));

// The sample, cleaned as the screen cleans it, with every day of the week on Original. change is given the raw sample.
function contentWith(change) {
  const raw = sampleRaw();
  raw.settings.countdown = { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
  Object.keys(raw.settings.screenSchedule).forEach(day => { raw.settings.screenSchedule[day] = 'original'; });
  if (change) change(raw);
  return sanity.normalizeSample(raw);
}

function fakeStorage() {
  const kept = {};
  return {
    kept: kept,
    getItem: name => (name in kept ? kept[name] : null),
    setItem: (name, value) => { kept[name] = String(value); },
    removeItem: name => { delete kept[name]; },
  };
}

function setPage(layout) {
  const page = { dataset: { layout: layout, style: layout === 'bar' ? 'minimal' : 'original' }, style: { setProperty: () => {} }, classList: { add: () => {}, remove: () => {} } };
  if (layout === 'bar') page.dataset.shapes = 'minimal';
  globalThis.document = { documentElement: page };
  return page;
}

// Starts the page side of the views over this content and gives back what it hands to the schedule and the swap
async function start(options = {}) {
  const content = options.content || contentWith();
  const world = { log: [], hooks: null, seconds: null, swapBusy: null, swapScale: null, swapping: false, takeover: false, canShow: () => true, content: content };
  globalThis.viewsWorld = world;
  setPage('standard');
  globalThis.window = { localStorage: fakeStorage(), sessionStorage: fakeStorage() };
  views.resetViews();
  screens.holdScreenLook({ team: '', style: '', monday: false });
  teamsModule.rotateTeam('');

  const module = await import(base + 'core/views-run.js?' + Math.random());
  await module.startViews(() => content, options.addressAsks === true);
  return world;
}

// Runs the clock of the minutes for this many seconds, one tick each, and gives the list of { at, key } changes
function runClock(content, seconds, options = {}) {
  const changes = [];
  for (let second = 1; second <= seconds; second += 1) {
    const result = views.tickView(content, new Date(monday12.getTime() + second * 1000), options);
    if (result.changed) changes.push({ at: second, key: result.key });
  }
  return changes;
}

// The minutes of the starting views, in the order they play in
const startMinutes = { general: 6, prime: 6, nova: 6, family: 2 };


// The documents

test('there are four views with a fixed layout, team and number of minutes, and the order starts General, Prime, Nova, Family', () => {
  assert.deepEqual(config.viewKeys, ['general', 'prime', 'nova', 'family']);
  assert.deepEqual(config.viewTeams, { general: '', prime: 'prime', nova: 'nova', family: '' });
  assert.deepEqual(config.viewLimits.minutes, { min: 1, max: 30 });
  config.viewKeys.forEach(key => {
    const view = views.tidyView(null, key);
    assert.equal(view.key, key);
    assert.equal(view.minutes, startMinutes[key], key + ' minutes');
    assert.equal(view.layout, config.defaultViews[key].layout);
    assert.equal(view.mirror, config.defaultViews[key].mirror);
    assert.equal(view.viewTag, config.defaultViews[key].viewTag);
    assert.equal(view.team, config.viewTeams[key]);
  });
  assert.deepEqual(config.defaultSettings.viewOrder, config.viewKeys);
  assert.equal(config.defaultSettings.generalViewName, 'General');
  assert.equal(config.defaultSettings.generalViewTitle, 'HAWKTIMUS ROBOTICS');
});

test('the General view starts with the agenda, events, leadership, four photos of ten seconds and sponsors, and five small panels', () => {
  const view = views.tidyView(null, 'general');
  assert.deepEqual(view.panels.map(row => [row.panel, row.seconds]), [['tonight', 45], ['events', 60], ['leadership', 20], ['photo', 40], ['sponsor-feature', 15]]);
  assert.equal(view.panels[3].photoCount, 4);
  assert.equal(view.panels[3].secondsPerPhoto, 10);
  assert.deepEqual(view.sidePanels.map(row => [row.panel, row.seconds]), [['next-event', 30], ['task-counts', 20], ['safety-days', 20], ['forecast', 15], ['sponsor-logo', 15]]);
});

test('Prime and Nova start with Monday tasks, done, timeline and board at 30 seconds, in their team, and have no small panel', () => {
  ['prime', 'nova'].forEach(key => {
    const view = views.tidyView(null, key);
    assert.deepEqual(view.panels.map(row => [row.panel, row.team, row.seconds]), [['monday-tasks', key, 30], ['monday-done', key, 30], ['monday-timeline', key, 30], ['monday-board', key, 30]]);
    assert.deepEqual(view.sidePanels, [], 'the bar layout has no small panel');
  });
});

test('the panels of the Family view are Overall progress and Status by department, whatever the document says', () => {
  const locked = views.tidyView({ panels: [{ panel: 'events', seconds: 30 }, { panel: 'monday-status-depts', seconds: 12 }] }, 'family');
  assert.deepEqual(locked.panels.map(row => row.panel), ['monday-overall', 'monday-status-depts']);
  assert.equal(locked.panels[1].seconds, 12, 'the seconds of a locked row can be typed');
  assert.deepEqual(views.tidyView(null, 'family').panels.map(row => row.panel), config.familyPanels);
});

test('a document is read the way it is typed, and a number or a list that cannot be used is the starting value', () => {
  const view = views.tidyView({ minutes: 12, title: ' Show ', panels: [{ panel: 'events', seconds: 20 }, { panel: 'no-such-panel' }, 'text'], sidePanels: [{ panel: 'forecast' }, { panel: 'tasks' }] }, 'general');
  assert.equal(view.minutes, 12);
  assert.equal(view.title, 'Show');
  assert.deepEqual(view.panels.map(row => row.panel), ['events'], 'a row of a panel that is not a large panel is dropped');
  assert.deepEqual(view.sidePanels.map(row => row.panel), ['forecast'], 'and so is a small row of a large panel');
  assert.equal(views.tidyView({ minutes: 99 }, 'prime').minutes, 30);
  assert.equal(views.tidyView({ minutes: 0 }, 'prime').minutes, 1);
  assert.equal(views.tidyView({ minutes: 'six' }, 'prime').minutes, 6);
  assert.equal(views.tidyView({ panels: [] }, 'prime').panels.length, 4, 'an empty list is the starting list');
});

test('a team view keeps its team, a team that is typed in lower case is read, and General and Family have none', () => {
  assert.equal(views.tidyView({ team: 'NOVA' }, 'prime').team, 'nova');
  assert.equal(views.tidyView({ team: '' }, 'nova').team, 'nova', 'an empty team is the team of the view');
  assert.equal(views.tidyView({ team: 'prime' }, 'general').team, '');
  assert.equal(views.tidyView({ team: 'prime' }, 'family').team, '');
});

test('the documents are found by their id, and one with another id or a second with the same id is left out', () => {
  const found = views.tidyViews([{ _id: 'view-nova', minutes: 9 }, { _id: 'view-nova', minutes: 3 }, { _id: 'view-other' }, null, { _id: 'view-general' }]);
  assert.deepEqual(found.map(view => view.key), ['nova', 'general']);
  assert.equal(found[0].minutes, 9);
  const content = { views: found };
  assert.equal(views.resolveView(content, 'nova').minutes, 9);
  assert.equal(views.resolveView(content, 'prime').minutes, 6, 'a view with no document is the starting view');
  assert.equal(views.resolveView(null, 'family').minutes, 2);
});

test('the content carries the views of the query, and a sample with none plays the starting views', () => {
  const content = contentWith();
  assert.deepEqual(content.views, []);
  assert.deepEqual(contentModule.withDefaults({}).views, []);
  assert.ok(sanity.contentQuery.includes('"views": *[_type == "view"]'));
  const withDocument = contentWith(raw => { raw.views = [{ _id: 'view-prime', minutes: 4 }]; });
  assert.equal(withDocument.views.length, 1);
  assert.equal(views.resolveView(withDocument, 'prime').minutes, 4);
});

test('the stored Screens are still read: their rows, their banner minutes and their Monday style', () => {
  const content = contentWith();
  assert.equal(content.screens.length, 3);
  const screen = content.screens[0];
  assert.ok(Array.isArray(screen.mainRows) && Array.isArray(screen.sideRows));
  assert.equal(typeof screen.hawkEveryMinutes, 'number');
  assert.equal(screens.cadenceOf(screen).hawkEverySeconds, screen.hawkEveryMinutes * 60);
  assert.equal(screens.planFor(content, monday12).mondayStyle, 'minimal');
});


// The settings and the order

test('the General name and title and the order are read from Dashboard Settings', () => {
  const content = contentWith(raw => { raw.settings.viewOrder = ['family', 'prime']; raw.settings.generalViewTitle = 'Our Dashboard'; raw.settings.generalViewName = 'Shop'; });
  assert.deepEqual(content.settings.viewOrder, ['family', 'prime']);
  assert.equal(content.settings.generalViewTitle, 'Our Dashboard');
  assert.equal(views.viewNameOf(content, 'general'), 'Shop');
  assert.deepEqual(views.viewOrderOf(contentWith()), config.viewKeys);
  assert.deepEqual(views.viewOrderOf(null), config.viewKeys);
});


test('General is named by its setting, a team view by the short name of its team, no view draws a tag, and the title of General is HAWKTIMUS ROBOTICS', () => {
  const content = contentWith(raw => { raw.settings.generalViewName = 'Shop'; });
  assert.equal(views.viewNameOf(content, 'general'), 'Shop');
  assert.equal(views.viewNameOf(content, 'prime'), 'PRIME');
  assert.equal(views.viewNameOf(content, 'nova'), 'NOVA');
  assert.equal(views.viewNameOf(content, 'family'), 'Family');
  ['general', 'prime', 'nova', 'family'].forEach(key => assert.equal(views.viewShowsTag(content, key), false, 'no view chips: ' + key));
  assert.equal(views.viewTitleOf(content, 'general'), 'HAWKTIMUS ROBOTICS');
  assert.equal(views.viewTitleOf(contentWith(raw => { raw.settings.generalViewTitle = 'Hawktimus Dashboard'; }), 'general'), 'HAWKTIMUS ROBOTICS', 'the older default title reads as the new one');
  assert.equal(views.viewTitleOf(contentWith(raw => { raw.settings.generalViewTitle = 'Our Shop'; }), 'general'), 'Our Shop');
  assert.equal(views.viewTitleOf(content, 'family'), 'HAWKTIMUS ROBOTICS');
  assert.equal(views.viewTitleOf(content, 'prime'), '', 'a team view carries the name of its team');
  assert.equal(views.viewNameOf({ settings: {}, teams: [] }, 'nova'), 'NOVA', 'with no team document the name is the key');
});


// The lists

test('a team view plays every one of its steps in its team, and General plays the rows of its panels with no team', () => {
  const content = contentWith();
  const prime = views.viewSteps(content, 'prime', monday12);
  assert.ok(prime.length > 0);
  prime.forEach(step => {
    assert.equal(step.view, 'prime');
    assert.equal(step.team, 'prime');
  });
  const general = views.viewSteps(content, 'general', monday12);
  assert.deepEqual(general.map(step => step.panel), ['tonight', 'events', 'leadership', 'photo', 'sponsor-feature']);
  general.forEach(step => assert.equal(step.view, 'general'));
  assert.deepEqual(views.viewSteps(content, 'family', monday12).map(step => step.panel), ['monday-overall', 'monday-status-depts']);
});

test('the Monday tasks row of a team view becomes one step for each Team lead that has tasks, in the order of the Team leads list', () => {
  const content = contentWith(raw => { raw.subteams.forEach(lead => { delete lead.monday; }); });
  const steps = views.viewSteps(content, 'prime', monday12).filter(step => step.panel === 'monday-tasks');
  assert.deepEqual(steps.map(step => step.page.department), ['subteam-a', 'subteam-b', 'subteam-c']);
  steps.forEach(step => assert.equal(step.page.team, 'prime'));
});

test('a Team lead with Monday switched off is left out, and one with no mark is on', () => {
  const content = contentWith(raw => {
    raw.subteams.forEach(lead => { delete lead.monday; });
    raw.subteams.find(lead => lead.id === 'subteam-b').monday = false;
    raw.subteams.find(lead => lead.id === 'subteam-a').monday = true;
  });
  const steps = views.viewSteps(content, 'prime', monday12).filter(step => step.panel === 'monday-tasks');
  assert.deepEqual(steps.map(step => step.page.department), ['subteam-a', 'subteam-c']);
});

test('a department added later is played without any edit to the view', () => {
  const before = contentWith(raw => { raw.tasks = raw.tasks.filter(task => task.subteamId !== 'subteam-c'); });
  const after = contentWith();
  const count = content => views.viewSteps(content, 'prime', monday12).filter(step => step.panel === 'monday-tasks').length;
  assert.equal(count(before) + 1, count(after));
});

test('a Monday tasks row with a department of its own plays that department only, and a department marked with no tasks is skipped', () => {
  const content = contentWith(raw => {
    raw.views = [{ _id: 'view-prime', panels: [{ panel: 'monday-tasks', department: 'subteam-b', seconds: 20 }, { panel: 'monday-tasks', department: 'subteam-k', seconds: 20 }] }];
  });
  const steps = views.viewSteps(content, 'prime', monday12);
  assert.deepEqual(steps.map(step => step.page.department), ['subteam-b'], 'subteam-k has no tasks');
  assert.equal(steps[0].seconds, 20);
});

test('a view whose team is not switched on has no steps, and ?team= leaves out the view of the other team', () => {
  const noNova = contentWith(raw => { raw.teams = raw.teams.filter(team => team.code !== 'nova'); });
  assert.deepEqual(views.viewSteps(noNova, 'nova', monday12), []);
  assert.ok(views.viewSteps(noNova, 'prime', monday12).length > 0);

  teamsModule.askForTeam('nova');
  try {
    const content = contentWith();
    assert.deepEqual(views.viewSteps(content, 'prime', monday12), []);
    assert.ok(views.viewSteps(content, 'nova', monday12).length > 0);
  } finally {
    teamsModule.askForTeam('');
  }
});

test('the small panel has side steps in the General view only', () => {
  const content = contentWith();
  assert.deepEqual(views.viewSideSteps(content, 'general').map(step => step.panel), ['next-event', 'task-counts', 'safety-days', 'forecast', 'sponsor-logo']);
  ['prime', 'nova', 'family'].forEach(key => assert.deepEqual(views.viewSideSteps(content, key), [], key));
});

test('the competition card that the schedule mixes in plays in the view on the screen, in the team of that view', () => {
  const content = contentWith();
  const card = views.stepInView({ panel: 'competition-rank', show: true }, content, 'nova');
  assert.equal(card.view, 'nova');
  assert.equal(card.team, 'nova');
  assert.equal(views.stepInView({ panel: 'x', view: 'prime', team: 'prime' }, content, 'nova').view, 'prime');
  assert.equal(views.stepInView({ panel: 'x' }, content, '').view, 'general', 'with nothing on the screen yet it is the first of the order');
});


// The layouts and the look

test('a bar view is the theme of the day in the bar layout, and a standard view takes the day and the Monday style', () => {
  const plan = { style: 'cybertron', mondayStyle: 'original' };
  assert.equal(views.drawStyleFor('standard', false, plan), 'cybertron');
  assert.equal(views.drawStyleFor('bar', false, plan), 'cybertron', 'the theme stays, the layout is the view\'s');
  assert.equal(views.drawStyleFor('bar', true, plan), 'cybertron');
  assert.equal(views.drawStyleFor('standard', true, plan), 'original', 'a Monday style of a standard layout is kept');
});

test('a standard view never takes the old bar name: that Monday style and that day are the original theme', () => {
  assert.equal(views.drawStyleFor('standard', true, { style: 'original', mondayStyle: 'minimal' }), 'original');
  assert.equal(views.drawStyleFor('standard', false, { style: 'minimal', mondayStyle: 'minimal' }), 'original');
});

test('the layout of a view is its field, and the theme of the day is the weekday of Dashboard Settings', () => {
  const content = contentWith(raw => { raw.views = [{ _id: 'view-nova', layout: 'standard' }]; raw.settings.themeByWeekday = { monday: 'retro' }; });
  assert.equal(views.viewLayoutOf(content, 'nova'), 'standard');
  assert.equal(views.viewLayoutOf(content, 'prime'), 'bar');
  assert.equal(views.dayThemeFor(content, monday12), 'retro');
  assert.equal(views.dayThemeFor(content, at('2026-10-13T16:00:00Z')), 'cybertron', 'Tuesday');
  assert.equal(views.tidyView({ layout: 'bar' }, 'general').sidePanels.length, 0, 'the bar layout has no small panel');
});

test('the look of a step is the team of its view and the theme of the day, and the team is empty for a view with none', () => {
  const plan = { style: 'original', mondayStyle: 'minimal' };
  assert.deepEqual(views.lookForViewStep({ panel: 'monday-tasks', view: 'prime', team: 'prime' }, plan, 'bar'), { team: 'prime', style: 'original', monday: true });
  assert.deepEqual(views.lookForViewStep({ panel: 'tonight', view: 'general', team: '' }, plan, 'standard'), { team: '', style: 'original', monday: false });
});

test('Nova is the mirrored view: the Nova team carries the mirror switch, and the bar layout turns round with it', () => {
  const content = contentWith();
  const nova = content.teams.find(team => team.code === 'nova');
  const prime = content.teams.find(team => team.code === 'prime');
  assert.equal(nova.mirror, true);
  assert.equal(prime.mirror, false);
  assert.ok(readModule(path.join(dashboardFolder, 'layouts/bar.css'), 'utf8').includes('html.mirrored[data-layout="bar"] #bar-middle'));
});

test('the view is written on the page only when it changes, and a name that is not a view leaves the page alone', () => {
  const page = { dataset: {} };
  assert.equal(viewApply.viewNow(page), '');
  assert.equal(viewApply.applyView('prime', page), true);
  assert.equal(page.dataset.view, 'prime');
  assert.equal(viewApply.viewNow(page), 'prime');
  assert.equal(viewApply.applyView('prime', page), false, 'the same view writes nothing');
  assert.equal(viewApply.applyView('bogus', page), false);
  assert.equal(viewApply.applyView('', page), false);
  assert.equal(page.dataset.view, 'prime');
  assert.equal(viewApply.viewNow({ dataset: { view: 'bogus' } }), '');
  assert.equal(viewApply.applyView('nova', null), false);
});


// The clock

test('the four views play in turn for their minutes and then start again: 6, 6, 6 and 2', () => {
  views.resetViews();
  const content = contentWith();
  const changes = runClock(content, 60 * 40);

  assert.deepEqual(changes.slice(0, 5), [
    { at: 1, key: 'general' },
    { at: 1 + 360, key: 'prime' },
    { at: 1 + 720, key: 'nova' },
    { at: 1 + 1080, key: 'family' },
    { at: 1 + 1080 + 120, key: 'general' },
  ]);
  assert.equal(changes[5].key, 'prime');
  assert.equal(changes[5].at - changes[4].at, 360);
});

test('a view that has nothing to show is skipped, and so is a view whose team has no document', () => {
  views.resetViews();
  const content = contentWith();
  const noNova = runClock(content, 60 * 30, { canShow: step => step.view !== 'nova' }).map(change => change.key);
  assert.deepEqual(noNova.slice(0, 5), ['general', 'prime', 'family', 'general', 'prime']);

  views.resetViews();
  const lonely = contentWith(raw => { raw.teams = raw.teams.filter(team => team.code !== 'nova'); });
  assert.ok(!runClock(lonely, 60 * 30).some(change => change.key === 'nova'));
});

test('a view that is the only one with something to show stays, with no change and no swap', () => {
  views.resetViews();
  const content = contentWith();
  const changes = runClock(content, 60 * 30, { canShow: step => step.view === 'prime' });
  assert.deepEqual(changes, [{ at: 1, key: 'prime' }]);
});

test('a view that empties while it plays is left at once, at the next check, for the next one in the order', () => {
  views.resetViews();
  const content = contentWith();
  runClock(content, 5);
  assert.equal(views.cycleKey(), 'general');
  const changes = runClock(content, 30, { canShow: step => step.view !== 'general' });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].key, 'prime');
  assert.ok(changes[0].at <= 10, 'within ten seconds');
});

test('the order of Dashboard Settings changes the turn: Family first, then Nova, and a view left out of the order never plays', () => {
  views.resetViews();
  const content = contentWith(raw => { raw.settings.viewOrder = ['family', 'nova', 'general']; });
  const changes = runClock(content, 60 * 30);
  assert.deepEqual(changes.slice(0, 4).map(change => change.key), ['family', 'nova', 'general', 'family']);
  assert.ok(!changes.some(change => change.key === 'prime'));
  assert.equal(changes[1].at - changes[0].at, 120, 'Family is two minutes');
  assert.equal(changes[2].at - changes[1].at, 360);
});

test('the minutes of a view come from its document, and a change of the document shows at once', () => {
  views.resetViews();
  const content = contentWith(raw => { raw.views = [{ _id: 'view-general', minutes: 1 }]; });
  const changes = runClock(content, 200);
  assert.equal(changes[1].key, 'prime');
  assert.equal(changes[1].at - changes[0].at, 60);
});

test('a view the control page holds stays, and the clock starts its minutes when the hold is over', () => {
  views.resetViews();
  const content = contentWith();
  runClock(content, 3);
  const held = views.tickView(content, monday12, { forced: 'nova' });
  assert.deepEqual(held, { key: 'nova', changed: true });
  for (let i = 0; i < 1000; i += 1) assert.equal(views.tickView(content, monday12, { forced: 'nova' }).changed, false);
  assert.equal(views.cycleKey(), 'nova');
  const after = runClock(content, 400);
  assert.equal(after[0].key, 'family', 'after Nova in the order, once its six minutes are up');
  assert.equal(after[0].at, 360);
});

test('the lists follow the clock: the large panel the view of the clock, the small panel the view that is held', () => {
  views.resetViews();
  const content = contentWith();
  runClock(content, 1);
  assert.equal(views.viewPlaylist(content, monday12)[0].view, 'general');
  assert.ok(views.viewSidePlaylist(content).length > 0);

  runClock(content, 360);
  assert.equal(views.cycleKey(), 'prime');
  assert.equal(views.viewPlaylist(content, monday12)[0].view, 'prime');
  viewApply.holdView('general');
  assert.ok(views.viewSidePlaylist(content).length > 0, 'the small panel stays General until the first step of Prime is chosen');
  viewApply.holdView('prime');
  assert.deepEqual(views.viewSidePlaylist(content), []);
  viewApply.holdView('');
});


// The start

test('the screen starts in the first view that has something to show, in its team and its layout', () => {
  views.resetViews();
  screens.holdScreenLook({ team: '', style: '', monday: false });
  const content = contentWith(raw => { raw.settings.viewOrder = ['prime', 'general']; });
  const look = views.holdBootView(content, monday12);
  assert.deepEqual(look, { team: 'prime', style: 'original', monday: true });
  assert.equal(views.cycleKey(), 'prime');
  assert.equal(viewApply.heldView(), 'prime');
  assert.deepEqual(screens.heldLook(), look);

  views.resetViews();
  screens.holdScreenLook({ team: '', style: '', monday: false });
  assert.deepEqual(views.holdBootView(null, monday12), { team: '', style: '', monday: false }, 'no saved content holds nothing');
  assert.equal(views.cycleKey(), '');
});


// The page side

test('the views hand the schedule three questions and the swap its length, and the address that asks for a style or a team gets nothing', async () => {
  const world = await start();
  assert.deepEqual(Object.keys(world.hooks).sort(), ['begin', 'fits', 'viewAs']);
  assert.equal(typeof world.swapBusy, 'function');
  assert.equal(world.swapScale(), 1);

  const asked = await start({ addressAsks: true });
  assert.equal(asked.hooks, null);
  assert.equal(asked.swapBusy, null);
  assert.deepEqual(asked.log, []);
});

test('a swap plays at every view change: the first step of the next view is held with a swap, for all four turns of the round', async () => {
  const world = await start();
  const content = world.content;
  const first = key => views.viewSteps(content, key, new Date())[0];

  world.hooks.begin(first('general'));
  assert.deepEqual(world.log, ['checkTheme'], 'the first step holds its look, and there is nothing to swap from');
  assert.equal(viewApply.heldView(), 'general');

  ['prime', 'nova', 'family', 'general'].forEach(key => {
    world.log.length = 0;
    world.hooks.begin(first(key));
    assert.ok(world.log.includes('queueSwap'), 'a swap into ' + key);
    assert.equal(viewApply.heldView(), key);
  });
});

test('a swap plays between two views that look alike, because the view is a change by itself', async () => {
  const world = await start({ content: contentWith(raw => { raw.teams = raw.teams.map(team => Object.assign(team, { mirror: false })); }) });
  const content = world.content;
  const step = (view, team) => ({ panel: 'monday-overall', show: true, view: view, team: team });

  world.hooks.begin(step('family', ''));
  world.log.length = 0;
  world.hooks.begin(step('general', ''));
  assert.ok(world.log.includes('queueSwap'));
  world.log.length = 0;
  world.hooks.begin(step('general', ''));
  assert.deepEqual(world.log, [], 'the next step of the same view changes nothing');
  assert.ok(content);
});

test('inside a view the panels change with the plain page change: no swap between two steps of one view', async () => {
  const world = await start();
  const steps = views.viewSteps(world.content, 'general', new Date());

  world.hooks.begin(steps[0]);
  world.log.length = 0;
  steps.slice(1).forEach(step => world.hooks.begin(step));
  assert.deepEqual(world.log, []);

  const prime = views.viewSteps(world.content, 'prime', new Date());
  world.hooks.begin(prime[0]);
  world.log.length = 0;
  prime.slice(1).forEach(step => world.hooks.begin(step));
  assert.deepEqual(world.log, [], 'the Monday cards of a team view are one look');
});

test('the minutes run out and both lists begin again at the first step of the next view', async () => {
  const world = await start();
  const stepsOf = key => views.viewSteps(world.content, key, new Date());
  views.holdBootView(world.content, new Date());
  world.hooks.begin(stepsOf('general')[0]);

  const at = new Date();
  world.log.length = 0;
  for (let second = 0; second < 359; second += 1) world.seconds(new Date(at.getTime() + second * 1000));
  assert.deepEqual(world.log, []);
  world.seconds(new Date(at.getTime() + 360 * 1000));
  assert.deepEqual(world.log, ['startListsOver', 'moveOn grid1 grid2']);
  assert.equal(views.cycleKey(), 'prime');
});

test('an alert, an announcement or a talk stops the clock: the view comes back as it was, and the lists are not touched', async () => {
  const world = await start();
  views.holdBootView(world.content, new Date());
  world.hooks.begin(views.viewSteps(world.content, 'general', new Date())[0]);
  const at = new Date();
  for (let second = 0; second < 200; second += 1) world.seconds(new Date(at.getTime() + second * 1000));
  const seconds = views.cycleSeconds();
  assert.equal(views.cycleKey(), 'general');

  world.takeover = true;
  world.log.length = 0;
  for (let second = 0; second < 5000; second += 1) world.seconds(new Date(at.getTime() + second * 1000));
  assert.equal(views.cycleKey(), 'general', 'still the view that was interrupted');
  assert.equal(views.cycleSeconds(), seconds, 'with the seconds it had');
  assert.equal(viewApply.heldView(), 'general');
  assert.deepEqual(world.log.filter(line => /startListsOver|moveOn|queueSwap/.test(line)), [], 'nothing was moved while it was covered');

  world.takeover = false;
  for (let second = 0; second < 159; second += 1) world.seconds(new Date(at.getTime() + second * 1000));
  assert.equal(views.cycleKey(), 'general', 'it has 360 seconds, and 200 and 159 are 359');
  world.seconds(at);
  assert.equal(views.cycleKey(), 'prime', 'then it moves on, as if nothing had covered it');
});

test('the large panel does not lose its place in a view over an interruption: the lists are paused by their own count, and the views only stop their clock', () => {
  const run = read('core/views-run.js');
  const schedule = read('core/schedule.js');
  assert.equal((withoutComments(run).match(/\bpauseRotation\(\)/g) || []).length, 1, 'only the pause the control page asks for pauses the pages');
  assert.ok(!withoutComments(run).includes('restartRotation'), 'and restart nothing');
  assert.ok(run.includes('frozen: busyElsewhere() || asked.paused'));
  assert.ok(/function rotationPaused\(\) \{\s*return pauses > 0 \|\| frame\.isPaused\(\);\s*\}/.test(schedule));
  assert.ok(schedule.includes('followListResets();'));
});

test('a view that the control page holds stays while the hold lasts, and a pause stops the clock', async () => {
  const world = await start();
  views.holdBootView(world.content, new Date());
  world.hooks.begin(views.viewSteps(world.content, 'general', new Date())[0]);
  const at = new Date();
  for (let second = 0; second < 100; second += 1) world.seconds(new Date(at.getTime() + second * 1000));
  const counted = views.cycleSeconds();
  assert.ok(counted > 0);

  world.content.settings.pauseRotation = { until: new Date(at.getTime() + 100 * 60 * 1000).toISOString() };
  for (let second = 0; second < 100; second += 1) world.seconds(new Date(at.getTime() + second * 1000));
  assert.equal(views.cycleSeconds(), counted, 'a paused clock counts nothing');

  delete world.content.settings.pauseRotation;
  world.content.settings.showView = { key: 'nova', until: new Date(at.getTime() + 100 * 60 * 1000).toISOString() };
  world.log.length = 0;
  world.seconds(at);
  assert.equal(views.cycleKey(), 'nova');
  assert.deepEqual(world.log, ['resumeRotation', 'startListsOver', 'moveOn grid1 grid2'], 'the pause ends, and the view moves');
  for (let second = 0; second < 2000; second += 1) world.seconds(new Date(at.getTime() + second * 1000));
  assert.equal(views.cycleKey(), 'nova', 'held for as long as the request lasts');

  world.content.settings.showView = { key: 'nova', until: new Date(at.getTime() - 1000).toISOString() };
  for (let second = 0; second < 361; second += 1) world.seconds(new Date(at.getTime() + second * 1000));
  assert.equal(views.cycleKey(), 'family', 'a request that has run out holds nothing, and Nova runs its minutes');
});

test('a step the clock asks about is judged as the team it is drawn for, and one that has no content makes its view skipped', async () => {
  const world = await start();
  const asked = [];
  world.canShow = (panel, page) => {
    asked.push(panel);
    return !panel.startsWith('monday');
  };
  views.resetViews();
  const at = new Date();
  for (let second = 0; second < 5000; second += 1) world.seconds(new Date(at.getTime() + second * 1000));
  assert.ok(asked.length > 0);
  assert.ok(asked.every(panel => panel !== undefined));
});


test('a panel the control page holds is the only one the large panel plays, in the first view that has it, and the page reports the theme and the page number', async () => {
  const world = await start();
  views.holdBootView(world.content, new Date());
  const at = new Date();
  world.content.settings.holdPanel = { panel: 'monday-board', until: new Date(at.getTime() + 30 * 60 * 1000).toISOString() };
  world.log.length = 0;
  world.seconds(at);
  assert.equal(views.cycleKey(), 'prime');
  assert.deepEqual(views.viewPlaylist(world.content, at).map(step => step.panel), ['monday-board']);
  assert.ok(world.log.includes('moveOn grid1'));

  world.content.settings.holdPanel = { panel: '', until: '' };
  world.seconds(new Date(at.getTime() + 1000));
  assert.ok(views.viewPlaylist(world.content, at).length > 1, 'the hold is over');

  const page = { dataset: {} };
  assert.equal(viewApply.applyTheme('cybertron', page), true);
  assert.equal(page.dataset.theme, 'cybertron');
  assert.equal(viewApply.applyTheme('cybertron', page), false);
  viewApply.applyViewLabels({ name: 'PRIME', title: '', tag: true }, page);
  assert.deepEqual(viewApply.viewLabelsNow(page), { name: 'PRIME', title: '', tag: true });
  assert.deepEqual(viewApply.viewLabelsNow({ dataset: {} }), { name: '', title: '', tag: false });
  assert.ok(read('core/schedule.js').includes("area.dataset.pageNumber = String(number);"));
});

test('a bar view asks for the bar layout in any theme, and a standard view leaves the layout to the theme', async () => {
  const style = await import(base + 'core/style.js');
  style.rotateLayout('bar');
  try {
    ['original', 'cybertron', 'retro'].forEach(theme => assert.equal(style.layoutFor(theme, 'standard'), 'bar', theme));
    style.rotateLayout('standard');
    assert.equal(style.layoutFor('cybertron', 'standard'), 'standard');
    assert.equal(style.layoutFor('original', 'sidebar'), 'sidebar');
  } finally {
    style.rotateLayout('');
  }
});


// The weather

test('weather: a source that fails never throws at the screen, and a reading over two hours old blanks the panels', async () => {
  assert.equal(config.sanity !== undefined, true);
  const sent = [];
  const parts = {
    fetch: () => Promise.reject(new Error('offline')),
    storage: null,
    now: () => 1000000,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    const stop = weather.startWeather({ latitude: 1, longitude: 2 }, reading => {
      sent.push(reading);
      throw new Error('the screen failed');
    }, parts);
    await new Promise(resolve => setImmediate(resolve));
    stop();
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(sent, [], 'nothing is sent when there never was a reading, and the panels draw dashes');
});


// The files

test('the views do not draw or animate: the new files hold no animation of their own and no view tag is drawn', () => {
  ['core/views.js', 'core/views-run.js', 'core/view-apply.js'].forEach(file => {
    const source = withoutComments(read(file));
    ['blur', 'box-shadow', 'drop-shadow', 'requestAnimationFrame', '.animate(', 'keyframes', 'style.transform', 'style.opacity'].forEach(word => assert.ok(!source.includes(word), file + ' should not contain ' + word));
    assert.ok(!/localStorage\.|sessionStorage\./.test(source.replace(/window\.sessionStorage\.getItem\(reloadKey\)/g, '')) || file === 'core/views-run.js');
  });
  assert.ok(!fs.existsSync(path.join(dashboardFolder, 'view-tag.css')), 'the view tag is not drawn any more');
  ['panels/banner/panel.js', 'panels/bar-banner/panel.js'].forEach(file => assert.ok(!read(file).includes('view-tag'), file + ' draws no view tag'));
});

test('the shell starts the views in place of the Screens, holds the first view before it draws, and puts the view on in the step of the look', () => {
  const shell = read('shell.js');
  assert.ok(shell.includes("startOptional('./core/views-run.js', module => module.startViews(getContent, params.has('style') || params.has('team')));"));
  assert.ok(!shell.includes('screens-run'));
  assert.ok(shell.includes('holdBootView(savedContent(), new Date());'));
  assert.ok(shell.includes('withPages(withCompetition(viewPlaylist(shellState.content, new Date()), shellState.content, new Date()))'));
  assert.ok(shell.includes('withStandIns(withPages(viewSidePlaylist(shellState.content)))'));
  assert.ok(/function showDecorations\(look\) \{\s*useLayout\(look\);\s*useStyle\(look\);\s*useView\(look\);/.test(shell));
  assert.ok(shell.indexOf("'./core/views-run.js'") > shell.indexOf("'./core/team-run.js'"), 'after the ones it asks about');
  assert.ok(/if \(addressAsks\) return;/.test(read('core/views-run.js')));
  assert.ok(read('core/theme-apply.js').includes('a.style === b.style && a.view === b.view'), 'a change of view waits for the swap, like a change of style');
});

test('the docs say how the views go', () => {
  const text = readModule(path.join(docsFolder, 'views.md'), 'utf8').replace(/\s+/g, ' ');
  ['viewOrder', 'minutes', 'swap', 'generalViewTitle', 'two hours', 'Open-Meteo', 'monday: false', 'comes back', 'Family'].forEach(word => assert.ok(text.includes(word), 'views.md names ' + word));
  assert.ok(!/[—–]/.test(text) && !/!/.test(text), 'written plainly');
});


// Run them

let failures = 0;
try {
  for (const entry of tests) {
    try {
      await entry.run();
      console.log('ok    ' + entry.name);
    } catch (error) {
      failures += 1;
      console.log('FAIL  ' + entry.name);
      console.log('      ' + String(error && error.stack ? error.stack : error).split('\n').join('\n      '));
    }
  }
} finally {
  teamsModule.rotateTeam('');
  teamsModule.askForTeam('');
  fs.rmSync(workFolder, { recursive: true, force: true });
}
console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exit(1);
