// Tests that the name and the number of a team come from the Team document and nowhere else (docs/add-the-nova-team.md).
// The teams are given nonsense names, short names and numbers. The banner's name and number (teamShown), the team
// tile, the chips of the Roster, Team leads and Leadership headers, the Monday headers and the labels of the rows
// of both teams must show those strings and nothing from the seed. The dashboard code is also read for a team's name
// or number written as text. The dashboard files are copied next to a package.json that says "type": "module".
// Nothing touches the network or a browser.
//
//   node tools/test-team-name.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const dashboardFolder = path.join(repo, 'dashboard');
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');

const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-team-name-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js', 'frame.js'].forEach(file => fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file)));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file));
});

const panelIds = ['monday-tasks', 'monday-milestones-both', 'monday-progress-both', 'leadership', 'team-leads', 'roster', 'team-tile'];
panelIds.forEach(id => {
  fs.mkdirSync(path.join(root, 'panels', id), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, 'panels', id, 'panel.js'), path.join(root, 'panels', id, 'panel.js'));
});

const base = pathToFileURL(root).href + '/';
const sanity = await import(base + 'core/sanity.js');
const teams = await import(base + 'core/teams.js');
const panels = {};
for (const id of panelIds) panels[id] = await import(base + 'panels/' + id + '/panel.js');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// Strings no team has. The short name is what headers and chips write, the name and number are what the banner and the tile write.
const nonsense = {
  prime: { name: 'QZX WOBBLE', shortName: 'ZORPLE', number: '77701' },
  nova: { name: 'FNORD GLEAM', shortName: 'MUMBO', number: '77702' },
};
const fromSeed = /PRIME|NOVA|HAWKTIMUS|3229|3426/i;

// the code of a team is in class names (team-tag-prime), which is not text on the screen
const words = html => html.replace(/class="[^"]*"/g, '').replace(/\bdata:[^"']*/g, '');

const monday12 = new Date('2026-10-12T16:00:00Z');

// The sample content, cleaned as the screen cleans it, with the nonsense teams and these tasks and Team lead entries
function contentOf(tasks, leads) {
  const raw = JSON.parse(read('dashboard/data/sample/content.json'));
  raw.settings.countdown = { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
  raw.team = { name: 'Built In Name', number: '55555', school: '[School]' };
  raw.teams.forEach(team => Object.assign(team, nonsense[team.code]));
  raw.tasks = tasks;
  raw.subteams = leads.map(name => ({ id: leadId(name), name: name }));
  return sanity.normalizeSample(raw);
}

// The Monday panels find the department of a task by the id of its Team lead
const leadId = name => 'lead-' + name.replace(/[^A-Za-z0-9]+/g, '-');

function board(fields) {
  const task = Object.assign({ title: '[Task]', subteam: '[Subteam A]', status: 'up-next', team: 'prime', source: 'monday', mondayId: '[item]', showOnTv: true, dueDate: '2026-10-20' }, fields);
  return Object.assign(task, { subteamId: leadId(task.subteam) });
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
  const host = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  panel.mount(host, given);
  return host.innerHTML;
}

function onTeamScreen(content, code, run) {
  teams.useTeams(Object.assign({}, content, { settings: Object.assign({}, content.settings, { teamMode: code, alternateMinutes: 5 }) }));
  teams.changeTeamNow();
  try {
    run();
  } finally {
    teams.useTeams(null);
    teams.changeTeamNow();
  }
}

const chipOf = html => (/<span class="team-chip">([^<]*)<\/span>/.exec(html) || [])[1];
const textOf = (html, cssClass) => Array.from(html.matchAll(new RegExp('<span class="' + cssClass + '[^"]*">([^<]*)</span>', 'g'))).map(match => match[1]);

['prime', 'nova'].forEach(code => {
  const mine = nonsense[code];

  test('the banner, the team tile and the chips of ' + code + ' show its name and number from the Team document and nothing from the seed', async () => {
    await withFakePage(async () => {
      const person = fields => Object.assign({ name: '[Alex]', role: 'Captain', title: 'Captain', team: code }, fields);
      const content = contentOf([board({ team: code }), board({ team: code, status: 'done' })], ['[Subteam A]']);
      content.people = [person({}), person({ name: '[Sam]' })];
      content.subteams = [{ id: leadId('[Subteam A]'), name: '[Subteam A]', lead: '[Lead A]', members: ['[Sam]'], team: code }];

      onTeamScreen(content, code, () => {
        // the banner and the sidebar draw teamShown(); its name is the document's
        assert.equal(teams.teamShown(content).name, mine.name);
        assert.equal(teams.teamShown(content).number, mine.number);

        const tile = mounted(panels['team-tile'], content);
        assert.ok(tile.includes('<div class="name">' + mine.name + '</div>') && tile.includes('<div class="number">' + mine.number + '</div>'));

        const rendered = {
          tile: tile,
          roster: mounted(panels.roster, content),
          'team-leads': mounted(panels['team-leads'], content),
          leadership: mounted(panels.leadership, content),
          'monday-tasks': panels['monday-tasks'].markupFor(content, monday12, { team: code, department: '' }),
        };
        ['roster', 'team-leads', 'leadership', 'monday-tasks'].forEach(id => assert.equal(chipOf(rendered[id]), mine.shortName, id));
        Object.keys(rendered).forEach(id => assert.equal(fromSeed.test(words(rendered[id])), false, id + ' writes something from the seed'));
      });
    });
  });
});

test('the rows of both teams are labeled with the short names of the documents, and the Monday headers carry nothing else', () => {
  const content = contentOf([
    board({ title: '[a]', team: 'prime', subteam: '[Subteam A]' }),
    board({ title: '[b]', team: 'nova', subteam: '[Subteam A]' }),
  ], ['[Subteam A]']);
  const progress = panels['monday-progress-both'].markupFor(content, monday12);
  const milestones = panels['monday-milestones-both'].markupFor(content, monday12);

  assert.deepEqual(textOf(progress, 'team-tag'), ['ZORPLE', 'MUMBO']);
  assert.deepEqual(textOf(milestones, 'team-tag'), ['ZORPLE', 'MUMBO']);
  [progress, milestones].forEach(html => assert.equal(fromSeed.test(words(html)), false));
});

test('a team with no short name is written by its name, and never by a name from the seed', () => {
  const content = contentOf([board({ team: 'prime' })], ['[Subteam A]']);
  content.teams[0].shortName = '';
  onTeamScreen(content, 'prime', () => {
    const html = panels['monday-tasks'].markupFor(content, monday12, 1);
    assert.equal(chipOf(html), 'QZX WOBBLE');
    assert.equal(fromSeed.test(words(html)), false);
  });
});

test('the dashboard code writes no team name or number as text, except the built-in team in config.js', () => {
  const found = [];
  const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).forEach(entry => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'data') walk(full);
      return;
    }
    if (!entry.name.endsWith('.js') || full.endsWith(path.join('dashboard', 'config.js'))) return;

    read(path.relative(repo, full)).split('\n').forEach((line, index) => {
      const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, '').replace(/\s\/\/ .*$/, '');
      // quoted text only: a team name, the short name or the number as a string
      if (/(['"`])[^'"`]*(HAWKTIMUS|Hawktimus|PRIME|Prime|NOVA|Nova|3229|3426)[^'"`]*\1/.test(code)) found.push(path.relative(repo, full) + ':' + (index + 1) + ' ' + line.trim());
    });
  });
  walk(dashboardFolder);

  // Neon Prime is a theme, and the preview buttons name the two stored kinds
  const allowed = found.filter(line => !/Neon Prime|themes\/registry\.js:20 |core\/preview\.js:\d+ (prime|nova):/.test(line));
  assert.deepEqual(allowed, []);
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
