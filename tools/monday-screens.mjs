// Takes the pictures of the Monday panels for docs/reference/ (docs/monday.md, "The pictures"): Department tasks, the TV charts
// and Projects, at 1920 by 1080, in three fill states (full, half, empty), in every theme and in every view that can play the panel.
//
//   node tools/monday-screens.mjs                    every picture, written to docs/reference/
//   node tools/monday-screens.mjs --only projects    only the pictures whose file name has "projects" in it
//   node tools/monday-screens.mjs --out <folder>     write somewhere else (--dashboard <folder> draws another copy of dashboard/)
//   make monday-screens                              the same as the first line (computer/make/monday.mk)
//
// The sample content is changed on its way to the page: the tasks and the projects are replaced by made-up ones in brackets, with
// dates counted from today, so a picture shows the Late chip whatever the day. Nothing live is read.
//
// File names: <panel>-<fill>-<theme>-<view>.png, such as monday-department-full-original-prime.png. A view is condensed (both teams),
// prime or nova. Projects play in condensed only.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadPlaywright, onlyFilter, runShots, serveDashboard, summaryLine } from './screenshots.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..');

export const themes = ['original', 'cybertron', 'retro', 'foundry'];
export const fills = ['full', 'half', 'empty'];
// view: the key written on the page, and the team of the tasks
export const viewChoices = [
  { name: 'condensed', key: 'family', team: '' },
  { name: 'prime', key: 'prime', team: 'prime' },
  { name: 'nova', key: 'nova', team: 'nova' },
];

function addDays(days) {
  const day = new Date();
  day.setDate(day.getDate() + days);
  return day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
}

// How many open Build tasks and done ones a fill has
const sizes = { full: { open: 16, done: 6, projects: 12 }, half: { open: 3, done: 2, projects: 4 }, empty: { open: 0, done: 0, projects: 0 } };

// A short run of statuses, so that a full page shows every kind of row: two stuck, four in progress, one in review, the rest to do
const openMix = [
  ['blocked', 'high', -9, '[Contact-A]'], ['in-progress', 'high', -3, '[Contact-B]'], ['in-progress', 'medium', 4, ''], ['blocked', 'medium', 3, '[Contact-C]'],
  ['in-progress', 'low', 9, '[Contact-A]'], ['in-review', 'medium', 6, '[Contact-B]'], ['in-progress', 'high', 14, ''], ['up-next', 'high', 20, '[Contact-C]'],
  ['up-next', 'medium', 25, ''], ['up-next', 'low', 30, '[Contact-A]'], ['up-next', 'high', 0, ''], ['up-next', 'medium', 0, ''],
  ['up-next', '', 0, ''], ['up-next', 'low', 40, ''], ['up-next', 'medium', 45, '[Contact-B]'], ['up-next', 'high', 50, ''],
];

function sampleTasks(fill, team) {
  const size = sizes[fill];
  const tasks = [];
  for (let at = 0; at < size.open; at++) {
    const [status, priority, due, contact] = openMix[at % openMix.length];
    const task = { title: '[Build task ' + (at + 1) + ']', department: 'build', list: 'open', status: status, source: 'monday', mondayId: '[item ' + (at + 1) + ']', showOnTv: true, showOnBoard: true };
    if (priority) task.priority = priority;
    if (contact) task.contact = contact;
    if (due !== 0) Object.assign(task, { startDate: addDays(due - 20), dueDate: addDays(due) });
    if (status === 'blocked' && at === 0) task.note = '[Waiting on a part from the supplier]';
    if (team) task.team = team;
    tasks.push(task);
  }
  for (let at = 0; at < size.done; at++) {
    tasks.push({ title: '[Finished build task ' + (at + 1) + ']', department: 'build', list: 'done', status: 'done', source: 'monday', mondayId: '[done ' + (at + 1) + ']', showOnTv: true, showOnBoard: true, completedOn: addDays(-at - 1), contact: '[Contact-A]' });
  }
  return tasks;
}

const departmentNames = ['build', 'electrical', 'programming', 'design', 'cnc', 'strategy', 'operations', 'business', 'marketing'];

// The board for the charts: a few tasks in every department, with a Timeline, so that the status chart has nine bars and the timeline
// has bars in this month and the next two. empty has none, and zero has tasks and none of them done (the progress chart then draws no bar).
function sampleBoard(kind) {
  if (kind === 'empty') return [];
  const tasks = [];
  departmentNames.forEach((department, at) => {
    const count = 1 + (at % 3);
    for (let index = 0; index < count; index++) {
      const done = kind !== 'zero' && (index + at) % 3 === 0;
      const open = ['in-progress', 'up-next', 'blocked'][(index + at) % 3];
      const task = { title: '[' + department + ' task ' + (index + 1) + ']', department: department, list: done ? 'done' : 'open', status: done ? 'done' : open, source: 'monday', mondayId: '[' + department + index + ']', showOnTv: true, showOnBoard: true };
      Object.assign(task, { startDate: addDays(-10 + at * 6 + index * 9), dueDate: addDays(8 + at * 6 + index * 9) });
      if (done) task.completedOn = addDays(-2);
      tasks.push(task);
    }
  });
  return tasks;
}

const projectMix = [
  ['blocked', '[Mentor-A]', '', ['[Helper-A]'], 20], ['in-progress', '[Mentor-B]', '', [], 60], ['in-progress', '[Mentor-C]', '', ['[Helper-A]', '[Helper-B]'], null],
  ['in-progress', '[Mentor-A]', 'K', [], 35], ['up-next', '[Mentor-D]', '', [], null], ['in-review', '[Mentor-B]', '', [], 90],
  ['up-next', '[Mentor-C]', '', [], null], ['up-next', '', '', [], null], ['up-next', '[Mentor-D]', '', ['[Helper-C]'], null],
  ['done', '[Mentor-A]', 'M', [], 100], ['done', '[Mentor-B]', '', [], 100], ['done', '[Mentor-C]', '', [], 100],
];

function sampleProjects(fill) {
  const count = sizes[fill].projects;
  return projectMix.slice(0, count).map((entry, at) => {
    const [status, mentor, initial, helpers, percent] = entry;
    const project = { id: '[project ' + (at + 1) + ']', title: '[Project ' + (at + 1) + ']', status: status };
    if (mentor) project.mentor = mentor;
    if (initial) project.mentorInitial = initial;
    if (helpers.length > 0) project.helpers = helpers;
    if (percent !== null) project.percent = percent;
    if (status === 'done') project.completedOn = addDays(-at);
    return project;
  });
}

function address(parts) {
  const query = ['sample=1', 'still=1'].concat(Object.keys(parts).filter(key => parts[key] !== '').map(key => key + '=' + encodeURIComponent(parts[key])));
  return '/index.html?' + query.join('&');
}

// The pictures, 38 in all at about 350 KB each. Department tasks (open list), 24: all three fills in the Condensed view of every theme,
// and in the Prime and Nova views all three fills of the original theme and the full page of the others. Projects (Condensed only), 6:
// full in every theme, and half full and empty in the original. The charts, 8: each of the three full in the original theme, the
// progress chart full in the other themes, the status chart with no task and the progress chart with no task done.
export function planMondayShots() {
  const shots = [];

  themes.forEach(theme => viewChoices.forEach(view => fills.forEach(fill => {
    const wanted = view.name === 'condensed' || theme === 'original' || fill === 'full';
    if (!wanted) return;
    shots.push({
      name: 'monday-department-' + fill + '-' + theme + '-' + view.name, kind: 'monday', fill: fill, team: view.team, tasks: sampleTasks(fill, ''),
      url: address({ panel: 'monday-department', dept: 'build', list: 'open', screen: theme, team: view.team, view: view.key }),
    });
  })));

  themes.forEach(theme => fills.forEach(fill => {
    if (fill !== 'full' && theme !== 'original') return;
    shots.push({
      name: 'monday-projects-' + fill + '-' + theme + '-condensed', kind: 'monday', fill: fill, tasks: [], projects: sampleProjects(fill),
      url: address({ panel: 'monday-projects', screen: theme, view: 'family' }),
    });
  }));

  ['status', 'progress', 'timeline'].forEach(chart => {
    shots.push({
      name: 'monday-charts-' + chart + '-full-original-condensed', kind: 'monday', tasks: sampleBoard('full'),
      url: address({ panel: 'monday-charts', chart: chart, screen: 'original', view: 'family' }),
    });
  });
  shots.push({
    name: 'monday-charts-status-empty-original-condensed', kind: 'monday', tasks: sampleBoard('empty'),
    url: address({ panel: 'monday-charts', chart: 'status', screen: 'original', view: 'family' }),
  });
  ['cybertron', 'retro', 'foundry'].forEach(theme => {
    shots.push({
      name: 'monday-charts-progress-full-' + theme + '-condensed', kind: 'monday', tasks: sampleBoard('full'),
      url: address({ panel: 'monday-charts', chart: 'progress', screen: theme, view: 'family' }),
    });
  });
  shots.push({
    name: 'monday-charts-progress-none-done-original-condensed', kind: 'monday', tasks: sampleBoard('zero'),
    url: address({ panel: 'monday-charts', chart: 'progress', screen: 'original', view: 'family' }),
  });
  return shots;
}

// The sample content with the tasks and projects of the shot. Added to runShots as a kind of its own
export async function takeMonday(page, base, shot, file, limits) {
  await page.route('**/data/sample/content.json', async route => {
    const response = await route.fetch();
    const content = await response.json();
    content.tasks = (content.tasks || []).filter(task => task.source !== 'monday').concat(shot.tasks);
    content.monday = Object.assign({}, content.monday, { projects: shot.projects || [] });
    await route.fulfill({ response: response, json: content });
  });

  const problems = [];
  page.on('pageerror', error => problems.push(error.message));
  await page.goto(base + shot.url, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.stillReady === '1' || Boolean(document.documentElement.dataset.stillError), null, { timeout: limits.drawMs });

  const failed = await page.evaluate(() => document.documentElement.dataset.stillError || '');
  if (failed) throw new Error('the panel threw: ' + failed);
  if (problems.length > 0) throw new Error('the page threw: ' + problems[0]);

  await page.waitForTimeout(limits.settleMs);
  await page.screenshot({ path: file });
  return [file];
}

function readOptions(argv) {
  const options = { only: '', out: path.join(repoRoot, 'docs', 'reference'), dashboard: path.join(repoRoot, 'dashboard') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only' && argv[i + 1] !== undefined) options.only = argv[++i];
    else if (argv[i] === '--out' && argv[i + 1] !== undefined) options.out = path.resolve(argv[++i]);
    else if (argv[i] === '--dashboard' && argv[i + 1] !== undefined) options.dashboard = path.resolve(argv[++i]);
    else {
      console.error('Usage: node tools/monday-screens.mjs [--only <pattern>] [--out <folder>] [--dashboard <folder>]');
      process.exit(2);
    }
  }
  return options;
}

async function main() {
  const options = readOptions(process.argv.slice(2));
  const wanted = onlyFilter(options.only);
  const chosen = planMondayShots().filter(shot => wanted(shot.name));
  if (chosen.length === 0) {
    console.error('Nothing matches --only "' + options.only + '".');
    process.exit(2);
  }
  const playwright = await loadPlaywright();
  if (!playwright) {
    console.error('Playwright is not installed. Run npm install in tools/ on a laptop, or set NODE_PATH to a folder that has it.');
    process.exit(2);
  }

  const server = await serveDashboard(options.dashboard);
  fs.mkdirSync(options.out, { recursive: true });
  try {
    const result = await runShots({
      playwright: playwright, shots: chosen, base: 'http://127.0.0.1:' + server.port, outFolder: options.out,
      log: line => console.log(line), kinds: { monday: takeMonday },
    });
    console.log('\n' + summaryLine(result) + '. Folder: ' + options.out);
    process.exitCode = result.failed.length > 0 ? 1 : 0;
  } finally {
    await server.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
