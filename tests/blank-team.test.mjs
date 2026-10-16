// Tests for a blank team (docs/team-on-an-item.md): an item with no team is for both teams, the screen shows
// no team chip for it and never writes BOTH TEAMS, the cards of both teams read MILESTONES or PROGRESS alone,
// and a row of those cards from a board with no team has no label. It also checks that no panel has a Prime or
// a Nova flavor. The Studio side (the team fields are optional and say "Leave blank when it is for both
// teams.") is in tests/schemas.test.mjs, and the board sync is in tests/monday-script.test.mjs. The
// dashboard files are copied next to a package.json that says "type": "module", so any version of node reads
// them. Nothing touches the network or a browser.
//
//   node tests/blank-team.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

// the drawing of the team chip is kept and tested here; the screen draws none (tests/chips-off.test.mjs)
globalThis.teletraanTeamChips = true;

const repo = fileURLToPath(new URL('../', import.meta.url));
const dashboardFolder = path.join(repo, 'dashboard');
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');

const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-blank-team-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js', 'frame.js'].forEach(file => copyModule(path.join(dashboardFolder, file), path.join(root, file)));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  copyModule(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  copyModule(path.join(dashboardFolder, file), path.join(root, file));
});

const cardIds = ['monday-tasks', 'monday-status-depts', 'monday-overall', 'monday-milestones-both', 'monday-progress-both', 'leadership', 'team-leads', 'roster'];
cardIds.forEach(id => {
  fs.mkdirSync(path.join(root, 'panels', id), { recursive: true });
  copyModule(path.join(dashboardFolder, 'panels', id, 'panel.js'), path.join(root, 'panels', id, 'panel.js'));
});

const base = pathToFileURL(root).href + '/';
const content = await import(base + 'core/content.js');
const draw = await import(base + 'core/monday-draw.js');
const monday = await import(base + 'core/monday.js');
const sanity = await import(base + 'core/sanity.js');
const teams = await import(base + 'core/teams.js');
const teamTitle = await import(base + 'core/team-title.js');
const registry = await import(base + 'registry.js');
const textWidth = (await import(base + 'core/text-width.js')).textWidth;
const panels = {};
for (const id of cardIds) panels[id] = await import(base + 'panels/' + id + '/panel.js');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// Noon on Monday October 12 2026 in Holly Springs
const monday12 = new Date('2026-10-12T16:00:00Z');
const noChip = html => assert.equal(html.includes('team-chip'), false, 'the header has no team chip');
const chipOf = html => (/<span class="team-chip">([^<]*)<\/span>/.exec(html) || [])[1];
const textOf = (html, cssClass) => Array.from(html.matchAll(new RegExp('<span class="' + cssClass + '[^"]*">([^<]*)</span>', 'g'))).map(match => match[1]);

// The sample content, cleaned as the screen cleans it, with these tasks in place of its own and these Team lead entries
function contentOf(tasks, leads) {
  const raw = JSON.parse(read('dashboard/data/sample/content.json'));
  raw.settings.countdown = { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
  raw.tasks = tasks;
  raw.subteams = leads.map(name => ({ name: name }));
  return sanity.normalizeSample(raw);
}

// A task from the board, the way the board sync makes it
function board(fields) {
  return Object.assign({ title: '[Task]', subteam: '[Subteam A]', status: 'up-next', team: 'prime', source: 'monday', mondayId: '[item]', showOnTv: true, dueDate: '2026-10-20' }, fields);
}

async function withFakePage(run) {
  const drawn = [];
  globalThis.document = {
    getElementById: id => {
      if (id === 'metal-shapes') return { insertAdjacentHTML: (where, markup) => drawn.push(markup.match(/id="([^"]+)"/)[1]) };
      return drawn.includes(id) ? {} : null;
    },
  };
  globalThis.Image = class { set src(address) {} };

  try {
    await run();
  } finally {
    delete globalThis.document;
    delete globalThis.Image;
  }
}

function mounted(panel, given) {
  const host = { innerHTML: '', querySelectorAll: () => [] };
  panel.mount(host, given);
  return host.innerHTML;
}

function onTeamScreen(code, run) {
  const sample = contentOf([], []);
  teams.useTeams({ teams: sample.teams, settings: { teamMode: code, alternateMinutes: 5 } });
  teams.changeTeamNow();
  try {
    run();
  } finally {
    teams.useTeams(null);
    teams.changeTeamNow();
  }
}


// What a blank team means

test('an item with no team, an empty team or a team that was deleted shows for either team, and an item of one team shows only for it', () => {
  [{}, { team: '' }, { team: null }].forEach(item => {
    assert.equal(teams.showsForTeam(item, 'prime'), true);
    assert.equal(teams.showsForTeam(item, 'nova'), true);
  });
  assert.equal(teams.showsForTeam({ team: 'nova' }, 'nova'), true);
  assert.equal(teams.showsForTeam({ team: 'nova' }, 'prime'), false);
  assert.deepEqual(content.visibleItems([{ name: 'a' }, { name: 'b', team: 'nova' }, { name: 'c', team: 'prime' }], new Date(), 'prime').map(item => item.name), ['a', 'c']);

  // the query sends the code of the team, and nothing for a team that is gone
  const cleaned = sanity.normalizeSample({ sponsors: [{ name: '[a]', team: null }, { name: '[b]', team: '' }, { name: '[c]', team: ' Nova ' }, { name: '[d]' }] });
  assert.deepEqual(cleaned.sponsors.map(sponsor => sponsor.team), [undefined, undefined, 'nova', undefined]);
});

test('a header names no team for things that are for both teams, and the name of the team for anything else', async () => {
  await withFakePage(async () => {
    const person = fields => Object.assign({ name: '[Alex]', role: 'Captain', title: 'Captain' }, fields);
    const department = fields => Object.assign({ name: '[Build]', lead: '[Lead A]', members: ['[Sam]'] }, fields);
    const shared = { people: [person({}), person({ name: '[Sam]' })], subteams: [department({})], settings: {} };

    ['leadership', 'team-leads', 'roster'].forEach(id => {
      const html = mounted(panels[id], shared);
      noChip(html);
      assert.ok(html.includes('class="double-slash"'), id + ' keeps the slashes');
      assert.equal(/BOTH/.test(html), false, id + ' never writes both teams');
    });
    assert.ok(mounted(panels.leadership, shared).includes('<h2 class="title" data-slat="title">LEADERSHIP</h2>'), 'with no chip the title is a heading');
    assert.ok(mounted(panels['team-leads'], shared).includes('<h2 class="title" data-slat="title">TEAM LEADS</h2>'));

    const mixed = { people: [person({}), person({ name: '[Sam]', team: 'prime' })], subteams: [department({ team: 'prime' })], settings: {} };
    ['leadership', 'team-leads', 'roster'].forEach(id => assert.equal(chipOf(mounted(panels[id], mixed)), 'PRIME', id));
    onTeamScreen('nova', () => {
      const forNova = { people: [person({ team: 'nova' })], subteams: [department({ team: 'nova' })], settings: {} };
      ['leadership', 'team-leads', 'roster'].forEach(id => assert.equal(chipOf(mounted(panels[id], forNova)), 'NOVA', id));
    });
  });
});

test('no chip is written for no name, and a title is at the size of a heading when it fits before the line that ends the tab', () => {
  assert.equal(teamTitle.pageTeamName([{}, { team: '' }], 'PRIME'), '');
  assert.equal(teamTitle.pageTeamName([{}, { team: 'nova' }], 'NOVA'), 'NOVA');
  assert.equal(teamTitle.teamChipMarkup(''), '');
  assert.equal(teamTitle.teamChipMarkup(undefined), '');
  assert.equal(teamTitle.teamChipMarkup('PRIME'), '<span class="team-chip">PRIME</span>');

  // the choice is by the room before the line, whatever the chip: it is on the other side of the line
  const room = 656;
  ['LEADERSHIP', 'TEAM LEADS', 'BUILD TEAM', 'DESIGN TEAM', 'PROGRAMMING TEAM', 'ELECTRICAL TEAM', 'A TEAM'].forEach(title => {
    assert.equal(teamTitle.titleClass(title) === 'title', textWidth(title, 700, 96) <= room, title);
  });
  assert.equal(teamTitle.titleClass('LEADERSHIP'), 'title');
  assert.equal(teamTitle.titleClass('TEAM LEADS'), 'title');
  assert.equal(teamTitle.titleClass('PROGRAMMING TEAM'), 'title title-tight', 'a long title is still smaller');
});


// The cards of both teams

test('the cards of both teams read MILESTONES or PROGRESS alone, with the words about the board and the slashes', () => {
  const mix = contentOf([board({ title: '[a]', team: 'prime' }), board({ title: '[b]', team: 'nova' })], ['[Subteam A]']);
  const milestones = panels['monday-milestones-both'].markupFor(mix, monday12);
  const progress = panels['monday-progress-both'].markupFor(mix, monday12);

  [milestones, progress].forEach(html => {
    noChip(html);
    assert.ok(html.includes('class="double-slash"'));
    assert.equal(/BOTH/.test(html), false);
  });
  assert.ok(milestones.includes('data-slat="title">MILESTONES</h2>') && progress.includes('data-slat="title">PROGRESS</h2>'));

  // the words have the room of the chip that is not there, and the slashes go when the words need the room
  const status = { lastSyncAt: '2026-10-12T15:56:00Z' };
  const header = draw.headerMarkup('PROGRESS', '', status, monday12);
  assert.equal(header.includes('team-chip'), false);
  assert.equal(header.includes('tag-with-chip'), false, 'there is no chip for the words to fit beside');
  assert.ok(header.includes('<span class="ago">4 MIN AGO</span>') && !header.includes('class="double-slash"'), 'the words are there and the slashes are not');
  const sample = draw.headerMarkup('PROGRESS', '', { sample: true }, monday12);
  assert.ok(sample.indexOf('<span class="ago">SAMPLE</span>') !== -1 && sample.indexOf('class="ago"') < sample.indexOf('class="double-slash"'), 'SAMPLE is short, so the slashes come after it');
});

test('a row is labeled with the team of its board, and a department whose tasks come only from boards with no team is one row with no label', () => {
  const lone = contentOf([board({ title: '[a]', team: '' }), board({ title: '[b]', team: '', status: 'done' })], ['[Subteam A]']);
  const rows = monday.bothRows(lone, [{ code: 'prime' }, { code: 'nova' }], monday12);
  assert.equal(rows.length, 1, 'both teams have the same two tasks, so there is one row');
  assert.equal(rows[0].team, null);
  assert.equal(rows[0].tasks.length, 2);

  const progress = panels['monday-progress-both'].markupFor(lone, monday12);
  assert.equal(progress.includes('team-tag'), false, 'a card of rows with no team has no labels at all');
  assert.deepEqual(textOf(progress, 'count'), ['1/2']);
  const milestones = panels['monday-milestones-both'].markupFor(lone, monday12);
  assert.equal(milestones.includes('team-tag'), false);
  assert.ok(milestones.includes('[a]'));

  // a department of the teams next to one that is for both: the labels of the teams, and a blank of the same width
  const mixed = contentOf([
    board({ title: '[a]', team: 'prime', subteam: '[Subteam A]' }),
    board({ title: '[b]', team: 'nova', subteam: '[Subteam A]' }),
    board({ title: '[c]', team: '', subteam: '[Subteam B]' }),
  ], ['[Subteam A]', '[Subteam B]']);
  const mixedRows = monday.bothRows(mixed, [{ code: 'prime', shortName: 'PRIME' }, { code: 'nova', shortName: 'NOVA' }], monday12);
  assert.deepEqual(mixedRows.map(row => (row.team ? row.team.code : 'none') + ' ' + row.lead), ['prime [Subteam A]', 'nova [Subteam A]', 'none [Subteam B]']);

  const html = panels['monday-progress-both'].markupFor(mixed, monday12);
  assert.deepEqual(textOf(html, 'team-tag'), ['PRIME', 'NOVA', ''], 'the third row has a blank where the label would be');
  assert.ok(html.includes('team-tag team-tag-blank'));
  assert.equal(html.split('class="row"').length - 1, 3);
  assert.equal(draw.teamTagMarkup(null), '');
  assert.equal(draw.teamTagMarkup(null, true), '<span class="team-tag team-tag-blank"></span>');
  assert.equal(draw.teamTagMarkup({ code: 'nova', shortName: 'NOVA' }, true), '<span class="team-tag team-tag-nova">NOVA</span>');
  assert.ok(/\.monday \.team-tag-blank \{ background: none; \}/.test(read('dashboard/monday.css')), 'the blank has no color');
});

test('the tasks panel of a department has the chip of its team, also with General tasks, and the panels for both teams have none', () => {
  const content = (tasks, leads = ['[Subteam A]']) => {
    const raw = JSON.parse(read('dashboard/data/sample/content.json'));
    raw.settings.countdown = { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
    raw.tasks = tasks;
    raw.subteams = leads.map((name, index) => ({ name: name, id: 'lead-' + (index + 1) }));
    return sanity.normalizeSample(raw);
  };

  const general = content([board({ title: '[a]', team: '', subteamId: 'lead-1' })]);
  const html = panels['monday-tasks'].markupFor(general, monday12, { team: 'prime', department: 'lead-1' });
  assert.equal(chipOf(html), 'PRIME');
  assert.ok(html.includes('data-slat="title">[SUBTEAM A] TASKS</h2>'));
  assert.equal(chipOf(panels['monday-tasks'].markupFor(general, monday12, { team: 'nova', department: 'lead-1' })), 'NOVA', 'a General task is on the panel of the other team too');

  const own = content([board({ title: '[a]', team: 'prime', subteamId: 'lead-1' }), board({ title: '[b]', team: '', subteamId: 'lead-1' })]);
  assert.equal(chipOf(panels['monday-tasks'].markupFor(own, monday12, { team: 'prime', department: 'lead-1' })), 'PRIME');
  noChip(panels['monday-status-depts'].markupFor(own, monday12));
  noChip(panels['monday-overall'].markupFor(own, monday12));
});


// Nothing says both teams, and no panel has a flavor of a team

test('no file of the dashboard, the Studio or the docs writes the old chip text', () => {
  const found = [];
  const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).forEach(entry => {
    if (entry.name === 'node_modules' || entry.name === '.git') return;
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|mjs|css|md|json|html|sh)$/.test(entry.name) && !full.endsWith('blank-team.test.mjs') && /BOTH TEAMS/.test(fs.readFileSync(full, 'utf8'))) found.push(path.relative(repo, full));
  });
  ['dashboard', 'studio', 'docs', 'computer', 'tools'].forEach(folder => walk(path.join(repo, folder)));
  assert.deepEqual(found, []);
});

test('the registry and the panel choices of a Screen row have no Prime or Nova flavor of a panel, and the small panels take their colors from the page', () => {
  const small = registry.panels.filter(panel => panel.region === 'grid2');
  assert.ok(small.length >= 5);
  registry.panels.forEach(panel => assert.equal(/prime|nova/i.test(panel.id), false, panel.id + ' is not a flavor of a team'));

  const order = read('studio/inputs/screen-panels.js');
  const values = Array.from(order.matchAll(/value: '([^']+)'/g)).map(match => match[1]);
  assert.ok(values.length >= 15);
  values.forEach(value => assert.equal(/prime|nova/i.test(value), false, value));

  // a small panel has no color of its own and no rule for a team: the colors are the page's, set with the banner
  small.forEach(panel => {
    const css = read('dashboard/panels/' + panel.id + '/panel.css').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(css), false, panel.id + ' uses the colors of the theme');
    assert.equal(/prime|nova|--team-/i.test(css), false, panel.id + ' has no rule for a team');
  });
});

let failures = 0;
try {
  for (const entry of tests) {
    try {
      await entry.run();
      console.log('ok    ' + entry.name);
    } catch (error) {
      failures += 1;
      console.log('FAIL  ' + entry.name);
      console.log(error);
    }
  }
} finally {
  fs.rmSync(workFolder, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
