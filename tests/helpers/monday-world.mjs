// What the tests of the Monday panels share (tests/monday-panels.test.mjs and the tests of the panels that read the board
// tasks): a copy of the dashboard folder that node can import, the modules and panels
// loaded from it, and a small task board to build content from. The board is made up: placeholders in brackets,
// with a full name and an address in the places a real board might hold them, so a test can show they do not reach
// the screen. Not a test itself.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const dashboardFolder = fileURLToPath(new URL('../../dashboard/', import.meta.url));
export const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. A copy next to a package.json that says "type": "module"
// lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-monday-world-'));
const root = path.join(workFolder, 'dashboard');
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
fs.cpSync(dashboardFolder, root, { recursive: true });
process.on('exit', () => fs.rmSync(workFolder, { recursive: true, force: true }));

const base = pathToFileURL(root).href + '/';
export const load = file => import(base + file);

export const config = await load('config.js');
export const registry = await load('registry.js');
export const monday = await load('core/monday.js');
export const views = await load('core/monday-views.js');
export const draw = await load('core/monday-draw.js');
export const sanity = await load('core/sanity.js');
export const contentModule = await load('core/content.js');
export const screens = await load('core/screens.js');
export const teams = await load('core/teams.js');

export const panelIds = ['monday-department', 'monday-charts'];
export const panels = {};
for (const id of panelIds) panels[id] = await load('panels/' + id + '/panel.js');

// Noon on Thursday October 15 2026 in Holly Springs, written with a Z so it means the same on every computer
export const now = new Date('2026-10-15T16:00:00Z');
export const today = '2026-10-15';

// The Team leads of the board: the departments. Two for each team, and the id each task names.
export const leads = [
  { id: 'lead-build', name: '[Build]', team: 'prime', order: 1 },
  { id: 'lead-electrical', name: '[Electrical]', team: 'prime', order: 2 },
  { id: 'lead-programming', name: '[Programming]', team: 'nova', order: 3 },
  { id: 'lead-design', name: '[Design]', team: 'nova', order: 4 },
];

// A task from the board the way the sync writes it, with what a test changes. The department is Build, the team Prime, and
// the Team lead of Build is the one with that id.
export function task(fields) {
  return Object.assign(
    {
      title: '[Task]',
      department: 'build',
      list: 'open',
      subteam: '[Build]',
      subteamId: 'lead-build',
      status: 'up-next',
      team: 'prime',
      source: 'monday',
      mondayId: '[item]',
      showOnBoard: true,
      showOnTv: true,
      priority: 'medium',
      contact: '[Jordan]',
      startDate: '2026-10-12',
      dueDate: '2026-10-30',
    },
    fields
  );
}

// The sample content, cleaned the way the screen cleans it, with these tasks in place of its own. The Team leads are the four
// above, there are no milestones unless a test gives some, and the board was read a minute ago. The countdown has a time with a Z.
export function contentOf(tasks, change) {
  const raw = JSON.parse(fs.readFileSync(path.join(dashboardFolder, 'data/sample/content.json'), 'utf8'));
  raw.settings.countdown = { kickoffLabel: 'GAMEDROP IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
  raw.settings.mondayEveryMinutes = 30;
  raw.tasks = tasks;
  raw.subteams = leads.map(lead => ({ id: lead.id, name: lead.name, team: lead.team, order: lead.order }));
  raw.milestones = [];
  raw.monday = { lastSyncAt: new Date(now.getTime() - 60000).toISOString(), lastError: '', snapshots: [] };
  if (change) change(raw);
  return sanity.normalizeSample(raw);
}

// The markup a panel draws for a page, at the time given
export function htmlOf(id, content, page, at = now) {
  return panels[id].markupFor(content, at, page);
}

// The words of some markup, with the tags taken out
export const wordsOf = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export const tests = [];
export function test(name, run) {
  tests.push({ name: name, run: run });
}

// Runs the tests of a file one after the other and says how many passed. The exit code is 1 when one failed.
export async function runTests() {
  let passed = 0;
  for (const item of tests) {
    try {
      await item.run();
      passed += 1;
      console.log('ok    ' + item.name);
    } catch (error) {
      console.log('FAIL  ' + item.name);
      console.log(error && error.stack ? error.stack : String(error));
    }
  }
  console.log('\n' + passed + ' of ' + tests.length + ' passed');
  process.exitCode = passed === tests.length ? 0 : 1;
}
