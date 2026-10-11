// Tests for the rows of the Team Leads and Leadership panels (dashboard/core/portrait.js,
// core/team-leads.js, core/leadership.js and the two panels): the portrait fills the row, the
// name, the role and a line are stacked beside it, and a chip is at the right end. The plain
// functions are run for real. The panels are run against a fake page that records what they
// draw. The stylesheet is checked by reading it, because the sizes need a browser to be seen.
//
//   node tools/test-person-rows.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const sampleFile = path.join(dashboardFolder, 'data/sample/content.json');
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-rows-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
fs.copyFileSync(path.join(dashboardFolder, 'config.js'), path.join(root, 'config.js'));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file));
});
['leadership/leadership.js', 'team-leads/team-leads.js'].forEach(file => {
  fs.mkdirSync(path.join(root, 'panels', path.dirname(file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, 'panels', file), path.join(root, 'panels', file));
});

const base = pathToFileURL(root).href + '/';
const portrait = await import(base + 'core/portrait.js');
const teamLeads = await import(base + 'core/team-leads.js');
const leadership = await import(base + 'core/leadership.js');
const teams = await import(base + 'core/teams.js');
const sanity = await import(base + 'core/sanity.js');
const images = await import(base + 'core/images.js');
const leadershipPanel = await import(base + 'panels/leadership/leadership.js');
const teamLeadsPanel = await import(base + 'panels/team-leads/team-leads.js');

// A panel keeps the page it showed last, so a test that counts visits asks for a copy of its own
let copies = 0;
async function freshPanel(name) {
  copies += 1;
  return import(base + 'panels/' + name + '/' + name + '.js?copy=' + copies);
}

const { rowSizes, rowsMarkup, rowsPerPage, portraitSizes } = portrait;
const { departmentRows, showcaseOf } = teamLeads;
const { groupNames, groupOf, leaders, roleOrder } = leadership;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const countOf = (text, piece) => text.split(piece).length - 1;
const photoRecord = () => ({
  url: 'https://cdn.sanity.io/images/abc123/production/0123abcd-800x600.jpg',
  width: 800,
  height: 600,
  crop: { left: 0, right: 0, top: 0, bottom: 0 },
  hotspot: { x: 0.5, y: 0.5 },
});

// plate.js draws each card and bar shape once into a hidden group of the page. This
// stands in for the page, and says which shapes were drawn.
async function withFakePage(run) {
  const drawn = [];
  globalThis.document = {
    getElementById: id => {
      if (id === 'metal-shapes') return { insertAdjacentHTML: (where, markup) => drawn.push(markup.match(/id="([^"]+)"/)[1]) };
      return drawn.includes(id) ? {} : null;
    },
  };

  try {
    await run(drawn);
  } finally {
    delete globalThis.document;
  }
}

// The photos of the page after this one are asked for with an image. The test says which.
async function withFakeImages(run) {
  const asked = [];
  globalThis.Image = class {
    set src(address) {
      asked.push(address);
    }
  };

  try {
    await run(asked);
  } finally {
    delete globalThis.Image;
  }
}

// Runs a check with a team on the screen, and puts the built-in team back after it. The
// module is shared by every test in this file, so it has to be left as it was found.
function onTeamScreen(code, run) {
  const list = [{ code: 'prime', name: 'Prime', active: true }, { code: 'nova', name: 'Nova', active: true }];
  teams.useTeams({ teams: list, settings: { teamMode: code, alternateMinutes: 5 } });
  teams.changeTeamNow();
  try {
    run();
  } finally {
    teams.useTeams(null);
    teams.changeTeamNow();
  }
}

function mount(panel, content) {
  const host = { innerHTML: '', querySelectorAll: () => [] };
  panel.mount(host, content);
  return host.innerHTML;
}

function namesIn(html) {
  return Array.from(html.matchAll(/<div class="person-name">([^<]*)<\/div>/g)).map(match => match[1]);
}

function rolesIn(html) {
  return Array.from(html.matchAll(/<div class="person-role">([^<]*)<\/div>/g)).map(match => match[1]);
}

function linesIn(html) {
  return Array.from(html.matchAll(/<div class="person-line">([^<]*)<\/div>/g)).map(match => match[1]);
}

function chipsIn(html) {
  return Array.from(html.matchAll(/<div class="person-chip">([^<]*)<\/div>/g)).map(match => match[1]);
}

function department(name, lead, more) {
  return Object.assign({ name: name, lead: lead, members: [] }, more);
}

function departments(count) {
  const list = [];
  for (let number = 1; number <= count; number++) {
    list.push(department('[Dept ' + number + ']', '[Lead ' + number + ']'));
  }
  return list;
}

function crew(role, count, more) {
  const people = [];
  for (let number = 1; number <= count; number++) {
    people.push(Object.assign({ role: role, name: '[' + role + ' ' + number + ']' }, more));
  }
  return people;
}

const namesOf = people => people.map(person => person.name);
const sample = () => sanity.normalizeSample(JSON.parse(fs.readFileSync(sampleFile, 'utf8')));

// The rule of a selector in a stylesheet, or '' when there is none
function ruleOf(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp('(?:^|[}\\s])' + escaped + '\\s*\\{([^}]*)\\}').exec(css);
  return found ? found[1] : '';
}

// The rule of a selector that stands alone in front of its braces, and is not the end of a longer selector or of a list
function soleRuleOf(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp('(?:^|\\}|\\*\\/)\\s*' + escaped + '\\s*\\{([^}]*)\\}').exec(css);
  return found ? found[1] : '';
}

const numberIn = (rule, property) => Number(new RegExp('(?:^|[;\\s])' + property + ': (\\d+)(?:px)?[;\\s]').exec(rule)[1]);
// the height of a row at 100 is the fallback of the variable that rowsMarkup sets for a taller row
const rowHeightIn = rule => Number(/height: var\(--row-height, (\d+)px\);/.exec(rule)[1]);

// The portrait in a row

test('four rows to a page, and the portrait in a row is 120 square at 100 and follows the portrait size', () => {
  assert.equal(rowsPerPage, 4);
  assert.deepEqual(rowSizes(100), { card: 120, photo: 116, inset: 2 });
  assert.deepEqual(rowSizes(80), { card: 96, photo: 92, inset: 2 });
  assert.deepEqual(rowSizes(60), { card: 72, photo: 70, inset: 1 });

  // no size, or an odd one, is 100, and the setting stays between 60 and 220
  assert.deepEqual(rowSizes(), rowSizes(100));
  assert.deepEqual(rowSizes('big'), rowSizes(100));
  assert.deepEqual(rowSizes(30), rowSizes(60));
  assert.deepEqual(rowSizes(250), rowSizes(220), 'the setting stops at 220');

  let before = 0;
  for (let percent = 60; percent <= 100; percent++) {
    const size = rowSizes(percent);
    assert.equal(size.photo, size.card - 2 * size.inset, 'the picture is the card less its space on both sides');
    assert.ok(size.card >= before, 'a bigger setting never gives a smaller portrait');
    before = size.card;
  }

  // the thin bar under a row is centred on the row's foot, and the card leaves it room: 144 less 120 is 12 each side
  assert.ok(144 - rowSizes(100).card >= 20);
  // the full size portrait of the Roster panel is not touched
  assert.deepEqual(portraitSizes(100), { card: 292, photo: 280, inset: 6 });
});

test('a row is the portrait, the name, the role, the line and the chip, as one slat, and escapes what editors typed', () => withFakePage(drawn => {
  const address = 'https://cdn.sanity.io/images/abc123/production/0123abcd-800x600.jpg?w=280&h=280';
  const html = rowsMarkup([
    { name: '<b>Alexandria Joseph</b>', role: 'HEAD COACH', line: 'Since <2019>', chip: 'COACH', address: address, metal: 'red' },
    { name: '[Sam]', role: 'CAPTAIN', line: '', chip: 'CAPTAIN', address: '', metal: 'gold' },
    { name: '[Pat]', role: '', address: '' },
  ], 100);

  assert.ok(html.startsWith('<div class="person-rows rows-4">'));
  assert.equal(countOf(html, '<div class="person-row" data-slat="item">'), 3);
  assert.equal(countOf(html, 'row-bar'), 0, 'the rule between rows is the border of the row, not a metal bar');
  assert.ok(html.includes('&lt;b&gt;Alexandria Joseph&lt;/b&gt;') && !html.includes('<b>'));
  assert.ok(html.includes('<div class="person-role">HEAD COACH</div>'));
  assert.ok(html.includes('<div class="person-line">Since &lt;2019&gt;</div>') && html.includes('<div class="person-chip">COACH</div>'));
  assert.ok(html.includes('<img src="' + address.replace(/&/g, '&amp;') + '" width="116" height="116" alt="">'));
  assert.equal(countOf(html, '<use href="#person-silhouette"'), 2, 'a row with no address has the silhouette');

  // the name, the role and the line are one block, and the chip is the last part of the row
  assert.equal(countOf(html, '<div class="person-text">'), 3);
  assert.ok(/<div class="person-name">[^<]*<\/div>\s*<div class="person-role">[^<]*<\/div>\s*<div class="person-line">[^<]*<\/div>\s*<\/div>\s*<div class="person-chip">/.test(html));
  assert.deepEqual([namesIn(html), rolesIn(html), linesIn(html), chipsIn(html)], [
    ['&lt;b&gt;Alexandria Joseph&lt;/b&gt;', '[Sam]', '[Pat]'],
    ['HEAD COACH', 'CAPTAIN', ''],
    ['Since &lt;2019&gt;', '', ''],
    ['COACH', 'CAPTAIN', ''],
  ]);

  // the metal is the frame of the picture, not of the row
  assert.ok(html.includes('<div class="portrait red-metal" style="--portrait-card: 120px; --portrait-photo: 116px; --portrait-inset: 2px">'));
  assert.ok(html.includes('<div class="portrait" data-metal="gold" style='));
  assert.ok(html.includes('<div class="portrait" style='));
  assert.equal(/<div class="person-row"[^>]*(metal|red)/.test(html), false);

  // the card is the one shape of 292, drawn once however many rows there are
  assert.deepEqual(Array.from(new Set(drawn)), ['card-292x292']);
  assert.ok(html.includes('href="#card-292x292"'));
}));

test('a row follows the portrait size and keeps its text, and the markup is the same apart from the sizes', () => withFakePage(() => {
  const rows = [{ name: '[Alex]', role: 'CAPTAIN', address: 'https://example.test/a.jpg' }, { name: '[Sam]', role: 'COACH', address: '' }];
  const at100 = rowsMarkup(rows, 100);
  const at60 = rowsMarkup(rows, 60);

  assert.equal(rowsMarkup(rows), at100, 'no size is 100');
  assert.ok(at60.includes('--portrait-card: 72px; --portrait-photo: 70px; --portrait-inset: 1px'));
  assert.ok(at60.includes('width="70" height="70" alt=""'));
  assert.ok(rowsMarkup(rows, 80).includes('--portrait-card: 96px; --portrait-photo: 92px; --portrait-inset: 2px'));

  const withoutSizes = html => html.replace(/ style="--portrait[^"]*"/g, '').replace(/ width="\d+" height="\d+" alt=""/g, '');
  assert.equal(withoutSizes(at60), withoutSizes(at100));
}));

// The Team Leads panel

test('departmentRows: the lead, TEAM LEAD, the line and the department, in the order of the list, and [lead] for a department with no lead', () => {
  const rows = departmentRows([
    department('  [Build] ', '  [Lead A]  '),
    department('[Software]', ''),
    department('[Media]', undefined),
    department('', '[Lead B]'),
    { name: '[Bare]' },
    department('[Safety]', '[Lead C]', { line: '  [Junior, since 2026]  ' }),
    department('[Gap]', '', { line: '[Open for a student]' }),
  ]);

  assert.deepEqual(rows, [
    { name: '[Lead A]', role: 'TEAM LEAD', line: '[Build]', chip: '[BUILD]', lead: '[Lead A]' },
    { name: '[Software]', role: '[lead]', line: '', chip: '', lead: '' },
    { name: '[Media]', role: '[lead]', line: '', chip: '', lead: '' },
    { name: '[Lead B]', role: 'TEAM LEAD', line: '', chip: '', lead: '[Lead B]' },
    { name: '[Bare]', role: '[lead]', line: '', chip: '', lead: '' },
    { name: '[Lead C]', role: 'TEAM LEAD', line: '[Junior, since 2026]', chip: '[SAFETY]', lead: '[Lead C]' },
    { name: '[Gap]', role: '[lead]', line: '[Open for a student]', chip: '', lead: '' },
  ]);
});

test('departmentRows leaves out hidden and expired departments and ones with nothing to show, and no new field is needed', () => {
  assert.deepEqual(departmentRows([]), []);
  assert.deepEqual(departmentRows(undefined), []);

  const list = [
    department('[Shown]', '[Lead A]'),
    department('[Hidden]', '[Lead B]', { show: false }),
    department('[Expired]', '[Lead C]', { expires: '2020-01-01T00:00:00.000Z' }),
    department('[Later expiry]', '[Lead D]', { expires: '2999-01-01T00:00:00.000Z' }),
    department('', ''),
    department('   ', '   '),
    {},
  ];
  assert.deepEqual(departmentRows(list).map(row => row.name), ['[Lead A]', '[Lead D]']);
});

test('departments come in the order of the Order field, the ones without an order last, when they come through the reader', () => {
  const content = sanity.normalizeSample({
    subteams: [department('[C]', '[Lead C]'), department('[B]', '[Lead B]', { order: 20 }), department('[A]', '[Lead A]', { order: 10 }), department('[D]', '[Lead D]')],
    people: [{ role: 'Captain', name: '[Late]', order: 5 }, { role: 'Captain', name: '[Early]', order: 1 }, { role: 'Coach', name: '[Coach]' }],
  });

  assert.deepEqual(departmentRows(content.subteams).map(row => row.name), ['[Lead A]', '[Lead B]', '[Lead C]', '[Lead D]']);
  assert.deepEqual(namesOf(leaders(content.people)), ['[Coach]', '[Early]', '[Late]']);
});

test('the Team Leads panel shows four departments on each visit, in order, and comes back to the first page', () => withFakePage(async () => {
  const panel = await freshPanel('team-leads');
  const content = { subteams: departments(10), people: [] };
  const visits = [mount(panel, content), mount(panel, content), mount(panel, content), mount(panel, content)];

  assert.equal(panel.hasContent(content), true);
  assert.deepEqual(visits.map(namesIn), [
    ['[Lead 1]', '[Lead 2]', '[Lead 3]', '[Lead 4]'],
    ['[Lead 5]', '[Lead 6]', '[Lead 7]', '[Lead 8]'],
    ['[Lead 9]', '[Lead 10]'],
    ['[Lead 1]', '[Lead 2]', '[Lead 3]', '[Lead 4]'],
  ]);
  assert.deepEqual(rolesIn(visits[0]), ['TEAM LEAD', 'TEAM LEAD', 'TEAM LEAD', 'TEAM LEAD']);
  assert.deepEqual(chipsIn(visits[0]), ['[DEPT 1]', '[DEPT 2]', '[DEPT 3]', '[DEPT 4]'], 'the department is the chip at the right end');
  assert.deepEqual(linesIn(visits[0]), ['[Dept 1]', '[Dept 2]', '[Dept 3]', '[Dept 4]'], 'with no line typed the third line is the department');

  // a short page keeps its rows at the top
  assert.ok(visits[0].includes('<div class="person-rows rows-4">') && visits[2].includes('<div class="person-rows rows-4">'));
  assert.ok(visits[0].includes('data-slat="title">TEAM LEADS</h2>') && visits[0].includes('<span class="team-chip">BOTH TEAMS</span>'), 'the header names the team, and these departments are for both');
}));

test('twelve departments are three panels of four, and the last department with no lead says [lead]', () => withFakePage(async () => {
  const panel = await freshPanel('team-leads');
  const content = sample();
  assert.equal(content.subteams.length, 12);
  assert.equal(departmentRows(content.subteams).length, 12);

  const visits = [mount(panel, content), mount(panel, content), mount(panel, content), mount(panel, content)];
  assert.deepEqual(visits.map(html => countOf(html, 'data-slat="item"')), [4, 4, 4, 4]);
  assert.deepEqual(namesIn(visits[0]), namesIn(visits[3]), 'the fourth visit is the first page again');
  assert.deepEqual(namesIn(visits[2]).slice(-1), ['[Subteam L]']);
  assert.deepEqual(rolesIn(visits[2]).slice(-1), ['[lead]']);
  assert.equal(rolesIn(visits[0]).includes('[lead]'), false);

  // every sample team lead has a line, and the one with no lead has no chip
  assert.deepEqual(linesIn(visits[0]), ['[A year or a short note]', '[A year or a short note]', '[A year or a short note]', '[A year or a short note]']);
  assert.deepEqual(chipsIn(visits[2]).slice(-1), ['']);
}));

test('the Team Leads panel with nothing to show has no content, and with fewer than four has fewer rows', () => withFakePage(() => {
  assert.equal(teamLeadsPanel.hasContent({ subteams: [] }), false);
  assert.equal(teamLeadsPanel.hasContent({ subteams: [department('', '')] }), false);
  assert.equal(teamLeadsPanel.hasContent({}), false);

  const one = mount(teamLeadsPanel, { subteams: [department('[Build]', '[Lead A]')], people: [] });
  assert.equal(countOf(one, 'data-slat="item"'), 1);
}));

test('the photo of a lead is the photo of the person with the same name in Leadership, and the photo of the next page is loaded early', () => withFakePage(() => withFakeImages(asked => {
  const people = [{ role: 'Captain', name: '[LEAD 1]', photo: images.tidyPhoto(photoRecord()), showPhoto: true }, { role: 'Captain', name: '[Lead 6]', photo: images.tidyPhoto(photoRecord()), showPhoto: true }];
  const content = { subteams: departments(8), people: people };
  const first = mount(teamLeadsPanel, content);

  assert.equal(countOf(first, '<img src='), 1, 'only the first lead has a photo');
  assert.equal(countOf(first, '<use href="#person-silhouette"'), 3);
  assert.deepEqual(asked, [portrait.photoAddress(people[1])], 'the photo of a lead on the next page is asked for');

  // a person for the other team is not found, so the lead has the silhouette
  const other = Object.assign({}, people[0], { team: 'nova' });
  onTeamScreen('prime', () => {
    const html = mount(teamLeadsPanel, { subteams: [department('[Dept 1]', '[Lead 1]')], people: [other] });
    assert.equal(countOf(html, '<img src='), 0);
  });
})));

test('the panels leave out the items of the other team, and show an item with no team on both screens', () => withFakePage(() => {
  const subteams = [department('[Both]', '[Lead both]'), department('[Prime]', '[Lead prime]', { team: 'prime' }), department('[Nova]', '[Lead nova]', { team: 'nova' })];
  const people = [{ role: 'Coach', name: '[Coach both]' }, { role: 'Coach', name: '[Coach prime]', team: 'prime' }, { role: 'Captain', name: '[Captain nova]', team: 'nova' }];

  onTeamScreen('prime', () => {
    assert.deepEqual(namesIn(mount(teamLeadsPanel, { subteams: subteams, people: [] })), ['[Lead both]', '[Lead prime]']);
    assert.deepEqual(namesOf(leaders(people)), ['[Coach both]', '[Coach prime]']);
  });
  onTeamScreen('nova', () => {
    assert.deepEqual(namesIn(mount(teamLeadsPanel, { subteams: subteams, people: [] })), ['[Lead both]', '[Lead nova]']);
    assert.deepEqual(namesOf(leaders(people)), ['[Coach both]', '[Captain nova]']);
    assert.equal(teamLeadsPanel.hasContent({ subteams: [subteams[1]] }), false);
    assert.equal(leadershipPanel.hasContent({ people: [people[1]] }), false);
  });
}));

test('the showcase hook gives one department\'s lead and members, and has no comment', () => {
  assert.deepEqual(showcaseOf(department('[Build]', '  [Lead A] ', { members: ['[Alex]', '', '  ', '[Sam]'] })), { lead: '[Lead A]', members: ['[Alex]', '[Sam]'] });
  assert.deepEqual(showcaseOf({ name: '[Build]' }), { lead: '', members: [] });

  const lines = read('core/team-leads.js').split('\n');
  const at = lines.findIndex(line => line.startsWith('export function showcaseOf('));
  assert.ok(at > 0, 'showcaseOf is exported by name');
  assert.equal(lines.slice(0, at).pop().trim().startsWith('//'), false, 'the line above is not a comment');
  const end = lines.findIndex((line, index) => index > at && line === '}');
  assert.equal(lines.slice(at, end).some(line => line.includes('//')), false, 'and there is none inside');

  // nothing draws it yet: it is only the hook
  ['panels/team-leads/team-leads.js', 'panels/leadership/leadership.js', 'panels/roster/roster.js'].forEach(file => assert.equal(read(file).includes('showcaseOf'), false, file));
});

// The Leadership panel

test('leaders puts the coaches, then the captains, then the mentors, whatever order they were typed in', () => {
  const people = [].concat(crew('Mentor', 1), crew('Captain', 2), crew('Coach', 1), crew('Mentor', 1, { name: '[Mentor B]' }));

  assert.deepEqual(roleOrder, ['coach', 'captain', 'mentor']);
  assert.deepEqual(namesOf(leaders(people)), ['[Coach 1]', '[Captain 1]', '[Captain 2]', '[Mentor 1]', '[Mentor B]']);
});

// The panel used to cut the list to its first four. It pages now (tools/test-portrait-size.mjs), so the list is everyone.
test('two coaches then two captains are the four rows at 100, and everyone else comes after them', () => {
  assert.deepEqual(namesOf(leaders([].concat(crew('Captain', 2), crew('Coach', 2)))), ['[Coach 1]', '[Coach 2]', '[Captain 1]', '[Captain 2]']);
  assert.deepEqual(namesOf(leaders([].concat(crew('Coach', 2), crew('Captain', 2), crew('Mentor', 2)))), ['[Coach 1]', '[Coach 2]', '[Captain 1]', '[Captain 2]', '[Mentor 1]', '[Mentor 2]']);
  assert.deepEqual(namesOf(leaders([].concat(crew('Coach', 3), crew('Captain', 3)))), ['[Coach 1]', '[Coach 2]', '[Coach 3]', '[Captain 1]', '[Captain 2]', '[Captain 3]']);
  assert.equal(leaders(crew('Mentor', 9)).length, 9);

  // the people are in their typed order inside a role
  assert.deepEqual(namesOf(leaders(crew('Coach', 6))), namesOf(crew('Coach', 6)));

  const people = sample().people;
  assert.deepEqual(people.map(person => person.role), ['Coach', 'Coach', 'Captain', 'Captain', 'Mentor', 'Mentor']);
  assert.deepEqual(leaders(people).map(person => person.role), ['Coach', 'Coach', 'Captain', 'Captain', 'Mentor', 'Mentor']);
});

test('a president is a captain with a title, so they are with the captains', () => {
  const people = [].concat(crew('Captain', 1, { name: '[President]', title: 'President' }), crew('Coach', 1), crew('Captain', 1));

  assert.deepEqual(namesOf(leaders(people)), ['[Coach 1]', '[President]', '[Captain 1]']);
});

test('leaders ignores capitals and spaces in a role, and puts any other role last', () => {
  const people = [].concat(crew('  CAPTAIN ', 1), crew('coach', 1), crew('Alumni', 1), crew('Mentor', 1), crew('', 1, { name: '[No role]' }), crew('Alumni', 1, { name: '[Alumni B]' }));

  assert.deepEqual(namesOf(leaders(people)), ['[coach 1]', '[  CAPTAIN  1]', '[Mentor 1]', '[Alumni 1]', '[Alumni B]', '[No role]']);
  assert.deepEqual(namesOf(leaders(people.slice(2))), ['[Mentor 1]', '[Alumni 1]', '[Alumni B]', '[No role]']);
});

test('leaders leaves out hidden and expired people and people with nothing to show', () => {
  assert.deepEqual(leaders([]), []);
  assert.deepEqual(leaders(undefined), []);

  const people = [
    { role: 'Coach', name: '[Shown]' },
    { role: 'Coach', name: '[Hidden]', show: false },
    { role: 'Coach', name: '[Expired]', expires: '2020-01-01T00:00:00.000Z' },
    { role: 'Coach', name: '[Later expiry]', expires: '2999-01-01T00:00:00.000Z' },
    { role: '', name: '' },
    { role: 'Captain' },
    { name: '[No role]' },
  ];
  assert.deepEqual(namesOf(leaders(people)), ['[Shown]', '[Later expiry]', undefined, '[No role]']);

  // a hidden coach leaves no gap: the next person takes the row
  const hidden = crew('Coach', 5);
  hidden[0].show = false;
  assert.deepEqual(namesOf(leaders(hidden)), ['[Coach 2]', '[Coach 3]', '[Coach 4]', '[Coach 5]']);
});

test('the Leadership panel shows four rows on each visit and then the rest, with the frame of each picture in the colour of its role', () => withFakePage(async () => {
  const panel = await freshPanel('leadership');
  const people = [].concat(crew('Coach', 2, { title: 'Head coach' }), crew('Captain', 3), crew('Mentor', 1));
  people[1].title = undefined;
  const content = { people: people };
  const visits = [mount(panel, content), mount(panel, content), mount(panel, content)];

  assert.equal(panel.hasContent(content), true);
  assert.equal(panel.hasContent({ people: [] }), false);
  assert.equal(panel.hasContent({ people: [{ role: 'Coach', name: '[Hidden]', show: false }] }), false);
  assert.equal(panel.hasContent({}), false);

  assert.deepEqual(namesIn(visits[0]), ['[Coach 1]', '[Coach 2]', '[Captain 1]', '[Captain 2]']);
  assert.deepEqual(namesIn(visits[1]), ['[Captain 3]', '[Mentor 1]']);
  assert.equal(visits[2], visits[0], 'the third visit is the first page again');
  assert.deepEqual(rolesIn(visits[0]), ['HEAD COACH', 'COACH', 'CAPTAIN', 'CAPTAIN']);
  assert.deepEqual(rolesIn(visits[1]), ['CAPTAIN', 'MENTOR']);
  assert.deepEqual(chipsIn(visits[0]), ['COACH', 'COACH', 'CAPTAIN', 'CAPTAIN'], 'the chip follows the role');
  assert.deepEqual(chipsIn(visits[1]), ['CAPTAIN', 'MENTOR']);
  assert.equal(countOf(visits[0], 'class="portrait red-metal"'), 2);
  assert.equal(countOf(visits[0], 'data-metal="gold"'), 2);
  assert.ok(visits[0].includes('data-slat="title">LEADERSHIP</h2>') && visits[0].includes('<span class="team-chip">BOTH TEAMS</span>'), 'the header names the team, and these people are for both');
}));

test('the Leadership panel with three people has three rows, and a person with no photo has the silhouette', () => withFakePage(() => {
  const html = mount(leadershipPanel, { people: [].concat(crew('Coach', 1), crew('Captain', 2)) });

  assert.equal(countOf(html, 'data-slat="item"'), 3);
  assert.equal(countOf(html, '<use href="#person-silhouette"'), 3);
}));

test('the chip of a Leadership row is the Group field, or follows the role: coach is COACH, mentor is MENTOR and the rest are CAPTAIN', () => {
  assert.deepEqual(groupNames, ['COACH', 'CAPTAIN', 'MENTOR']);

  [['Coach', 'COACH'], ['coach', 'COACH'], ['Head Coach', 'COACH'], ['Mentor', 'MENTOR'], ['Captain', 'CAPTAIN'], ['  Captain ', 'CAPTAIN'], ['Alumni', 'CAPTAIN'], ['', 'CAPTAIN']].forEach(([role, chip]) => {
    assert.equal(groupOf({ role: role }), chip, 'role ' + JSON.stringify(role));
  });
  assert.equal(groupOf({}), 'CAPTAIN');

  // a Group that is one of the choices wins, in any case and with spaces, and anything else is ignored
  assert.equal(groupOf({ role: 'Mentor', group: 'COACH' }), 'COACH');
  assert.equal(groupOf({ role: 'Captain', group: ' mentor ' }), 'MENTOR');
  assert.equal(groupOf({ role: 'Coach', group: 'CHIEF' }), 'COACH');
  assert.equal(groupOf({ role: 'Coach', group: '' }), 'COACH');
  assert.equal(groupOf({ role: 'Coach', group: null }), 'COACH');
});

test('a Leadership row has the typed line without its spaces, and no line when there is none, and the Group changes only the chip', () => withFakePage(() => {
  const people = [
    { role: 'Coach', name: '[Coach A]', title: 'Head coach', line: '  [Since 2019]  ' },
    { role: 'Captain', name: '[Captain A]', line: '   ' },
    { role: 'Mentor', name: '[Mentor A]', group: 'COACH' },
  ];
  const html = mount(leadershipPanel, { people: people, settings: { leadershipPortrait: 101 } });

  assert.deepEqual(namesIn(html), ['[Coach A]', '[Captain A]', '[Mentor A]']);
  assert.deepEqual(rolesIn(html), ['HEAD COACH', 'CAPTAIN', 'MENTOR'], 'the role line does not follow the Group');
  assert.deepEqual(linesIn(html), ['[Since 2019]', '', '']);
  assert.deepEqual(chipsIn(html), ['COACH', 'CAPTAIN', 'COACH']);
}));

test('the reader keeps the line of a person and of a team lead, and the group of a person, and a row made from them shows them', () => withFakePage(() => {
  const content = sanity.normalizeContent({
    people: [{ role: 'Captain', name: '[Captain A]', line: '[Since 2026]', group: 'MENTOR' }],
    subteams: [department('[Build]', '[Lead A]', { line: '[Junior]' })],
  });

  assert.equal(content.people[0].line, '[Since 2026]');
  assert.equal(content.people[0].group, 'MENTOR');
  assert.equal(content.subteams[0].line, '[Junior]');

  const leaderRows = mount(leadershipPanel, { people: content.people });
  assert.deepEqual([linesIn(leaderRows), chipsIn(leaderRows)], [['[Since 2026]'], ['MENTOR']], 'the chip is the group, and the line is there for the stylesheet to hide on a page of four rows');
  assert.ok(leaderRows.includes('<div class="person-rows rows-4">'));
  const detail = mount(leadershipPanel, { people: content.people, settings: { leadershipPortrait: 101 } });
  assert.deepEqual(linesIn(detail), ['[Since 2026]']);
  assert.deepEqual(linesIn(mount(teamLeadsPanel, { subteams: content.subteams, people: [], settings: { rosterPortrait: 101 } })), ['[Junior]']);
}));

// Both panels

test('both panels draw their rows at their own portrait size, and at 100 without it, and the text keeps its size', () => withFakePage(() => {
  const people = [{ role: 'Coach', name: '[Coach A]' }, { role: 'Captain', name: '[Captain A]' }];
  const subteams = [department('[Build]', '[Lead A]')];

  [['leadership', leadershipPanel, 'leadershipPortrait'], ['team leads', teamLeadsPanel, 'rosterPortrait']].forEach(([name, panel, setting]) => {
    const draw = settings => mount(panel, { people: people, subteams: subteams, settings: settings });
    const at60 = draw({ [setting]: 60 });
    const at80 = draw({ [setting]: 80, photoScale: 60 });
    const at100 = draw({ [setting]: 100 });

    assert.ok(at60.includes('--portrait-card: 72px; --portrait-photo: 70px; --portrait-inset: 1px'), name + ' at 60');
    assert.ok(at80.includes('--portrait-card: 96px; --portrait-photo: 92px; --portrait-inset: 2px'), name + ' at 80, and the Photo size does not change it');
    assert.ok(at100.includes('--portrait-card: 120px; --portrait-photo: 116px; --portrait-inset: 2px'), name + ' at 100');
    assert.ok(draw(undefined).includes('--portrait-card: 120px'), name + ' with no settings');
    assert.ok(draw({}).includes('--portrait-card: 120px'), name + ' with no size');
    assert.ok(draw({ portraitScale: 60 }).includes('--portrait-card: 72px'), name + ' with only the old Portrait size');

    const withoutSizes = html => html.replace(/ style="--portrait[^"]*"/g, '').replace(/ width="\d+" height="\d+"/g, '');
    assert.equal(withoutSizes(at60), withoutSizes(at100), name);
  });
}));

test('the panels draw through the shared rows and the header mark, have no animation code, and the Roster panel is as it was', () => {
  [['panels/leadership/leadership.js', 'photoAddress(', 'preloadPhotos('], ['panels/team-leads/team-leads.js', 'leadAddress(', 'preloadLeadPhotos(']].forEach(([file, address, preload]) => {
    const code = read(file);
    ['rowsMarkup(', 'watchPhotos(', 'doubleSlash()', 'rowLayout(', address, preload].forEach(piece => assert.ok(code.includes(piece), file + ' does not use ' + piece));
    assert.equal(/slotMarkup|slotsPerPage|MAX_CARDS|splitEvenly|leadershipPages/.test(code), false, file + ' still draws the cards');
    assert.equal(/setTimeout|setInterval|requestAnimationFrame|animate\(/.test(code), false, file + ' has animation code');
    assert.ok(code.includes('makePages(rowsPerPage)'), file + ' does not show a page at a time');
  });

  const roster = read('panels/roster/roster.js');
  assert.ok(roster.includes('slotMarkup(') && !roster.includes('rowsMarkup('), 'the Roster panel still draws its team lead as a slot');
  assert.ok(read('registry.js').includes("{ id: 'team-leads', region: 'grid1', topic: 'subteams' },"));
  assert.ok(read('registry.js').includes("{ id: 'leadership', region: 'grid1', topic: 'people' },"));
});

test('four rows of 144 fill the 576 body, the name is 72px, the role 44px in the team colour, the line 36px, and the chip 44px at the right end', () => {
  const css = read('base.css');
  const tokens = read('tokens.css');
  const rows = ruleOf(css, '.person-rows');
  const row = ruleOf(css, '.person-row');
  const name = soleRuleOf(css, '.person-name');
  const role = soleRuleOf(css, '.person-role');
  const line = soleRuleOf(css, '.person-line');
  const chip = soleRuleOf(css, '.person-chip');

  // the Events panel has the same body: 124 from the top, 576 high, 1152 wide
  assert.deepEqual([numberIn(rows, 'left'), numberIn(rows, 'top'), numberIn(rows, 'width'), numberIn(rows, 'height')], [0, 124, 1152, 576]);
  assert.equal(rowHeightIn(row) * rowsPerPage, numberIn(rows, 'height'));
  assert.ok(/display: grid;/.test(row) && /grid-template-columns: auto minmax\(0, 1fr\) auto;/.test(row), 'the portrait, the text that takes what is left, and the chip');
  assert.ok(/align-items: center;/.test(row), 'the content of a row is centred in it');
  assert.ok(/border-bottom: 2px solid var\(--team-plate\);/.test(row), 'a 2px rule in the plate color between rows');
  assert.ok(/border-bottom: 0;/.test(ruleOf(css, '.person-row:last-child')), 'and none under the last row, where the frame is');
  assert.equal(/display: (inline-)?flex/.test(css.slice(css.indexOf('.person-rows {'), css.indexOf('.person-chip:empty'))), false, 'a flex row in base.css would have to be named in the mirror test of test-layouts.mjs');

  assert.ok(/font: 500 var\(--size-person\)\/72px var\(--font-text\);/.test(name) && /--size-person: 72px;/.test(tokens), 'the name is 72px');
  assert.ok(/font: 600 var\(--size-label\)\/48px var\(--font-display\);/.test(role) && /--size-label: 44px;/.test(tokens), 'the role is 44px');
  assert.ok(/color: var\(--yellow\);/.test(role), 'the role is in the team accent');
  assert.ok(/font: 500 36px\/40px var\(--font-text\);/.test(line) && /color: var\(--lilac\);/.test(line), 'the line is 36px in the quiet color');
  assert.ok(/font: 700 var\(--size-label\)\/52px var\(--font-display\);/.test(chip), 'the chip is 44px');
  assert.ok(/background: var\(--yellow\);/.test(chip) && /color: var\(--ground\);/.test(chip) && /padding: 0 14px;/.test(chip), 'the chip is the accent plate the Events panel has for its kind');
  const group = ruleOf(css, '.person-name,\n.person-role,\n.person-line');
  assert.ok(/overflow: hidden;/.test(group) && /text-overflow: ellipsis;/.test(group) && /white-space: nowrap;/.test(group), 'a long name, role or line is cut, not wrapped');

  [rows, row, name, role, line, chip, ruleOf(css, '.person-row .portrait'), ruleOf(css, '.person-text')].forEach(rule => {
    assert.equal(/font-size|@keyframes|transition:|animation:|box-shadow|text-shadow|filter|blur/.test(rule), false);
  });
  ['panels/leadership/leadership.css', 'panels/team-leads/team-leads.css'].forEach(file => {
    assert.equal(/font-size|font: [^;]*\b\d+px\//.test(read(file).replace(/var\(--size-[a-z-]+\)\/\d+px/g, '')), false, file + ' has a text size of its own');
    assert.equal(/@keyframes|transition:|animation:|box-shadow|text-shadow|filter|blur/.test(read(file)), false, file);
  });
});

test('the lines fit the row: two lines in a row of 144, three in a row of 192, the name may take two lines when it has room, and the chip stays inside the cut corner', () => {
  const css = read('base.css');
  const lineOf = rule => Number(/\/(\d+)px var\(--font-/.exec(rule)[1]);
  const nameLine = lineOf(soleRuleOf(css, '.person-name'));
  const roleLine = lineOf(soleRuleOf(css, '.person-role'));
  const thirdLine = lineOf(soleRuleOf(css, '.person-line'));
  const chipLine = lineOf(soleRuleOf(css, '.person-chip'));
  const rule = 2;

  assert.deepEqual([nameLine, roleLine, thirdLine, chipLine], [72, 48, 40, 52]);

  // a row of 144 holds the name and the role, with 11px above and below, and has no room for the third line, which it hides
  assert.ok(144 - rule - (nameLine + roleLine) >= 20, 'two lines fit a row of four');
  assert.ok(144 - rule - (nameLine + roleLine + thirdLine) < 0, 'three lines do not');
  assert.ok(/display: none;/.test(ruleOf(css, '.person-rows.rows-4 .person-line')), 'so a page of four rows has no third line');
  [3, 2, 1].forEach(count => {
    assert.ok(576 / count - rule - (nameLine + roleLine + thirdLine) >= 24, 'three lines fit a row of ' + 576 / count);
    assert.equal(ruleOf(css, '.person-rows.rows-' + count + ' .person-line'), '', 'and a page of ' + count + ' shows the line');
  });

  // with one or two rows the name may take two lines, and the three lines still fit
  [2, 1].forEach(count => {
    const name = ruleOf(css, '.person-rows.rows-2 .person-name,\n.person-rows.rows-1 .person-name');
    assert.ok(/-webkit-line-clamp: 2;/.test(name) && /white-space: normal;/.test(name), 'the name of a row of ' + 576 / count + ' may take two lines');
    assert.ok(576 / count - rule - (2 * nameLine + roleLine + thirdLine) >= 24, 'two lines of name and the others fit a row of ' + 576 / count);
  });
  assert.ok(/white-space: nowrap;/.test(ruleOf(css, '#screen')), 'the screen keeps lines whole, so the name has to ask for wrapping');

  // the cut corner of the large frame runs from (1148, 640) to (1068, 704). The last row stops 16px sooner on the right, and its chip,
  // centred in the row, is 52 high
  const cornerAt = y => (y <= 640 ? 1148 : 1148 - (y - 640) * 80 / 64);
  assert.ok(read('core/plate.js').includes('body: [[4, 120], [1148, 120], [1148, 640], [1068, 704], [4, 704]]'));
  const last = ruleOf(css, '.person-row:last-child');
  const right = numberIn(last, 'padding-right');
  assert.equal(right, 56);
  [4, 3, 2, 1].forEach(count => {
    const height = 576 / count;
    const centre = 124 + (count - 1) * height + height / 2;
    assert.ok(1152 - right <= cornerAt(centre + chipLine / 2), 'the chip of the last row stays inside the cut corner on a page of ' + count);
    assert.ok(124 + count * height <= 704, 'the rows end above the foot of the frame');
  });
});

test('the rows have no rule for a style or a layout, so Original, Cybertron, Minimal and the sidebar layout draw the same panel code', () => {
  const css = read('base.css');
  ['.person-rows', '.person-row', '.person-text', '.person-name', '.person-role', '.person-line', '.person-chip', '.person-row .portrait'].forEach(selector => assert.notEqual(ruleOf(css, selector), '', selector));

  const sheets = ['styles/original.css', 'styles/cybertron.css', 'styles/minimal.css', 'layouts/bar.css', 'layouts/sidebar.css', 'panels/leadership/leadership.css', 'panels/team-leads/team-leads.css'];
  sheets.forEach(file => assert.equal(/\.person-|\.slots?\b|\.slot-/.test(read(file).replace(/\/\*[\s\S]*?\*\//g, '')), false, file + ' has a rule for the rows'));

  // the extra width of Minimal's main panel is not used by any panel, so the rows stay 1152 wide as the other panels do
  assert.ok(ruleOf(css, '.person-rows').includes('width: 1152px;'));
  assert.equal(/\.slots\s*\{/.test(css), false, 'the old row of three is gone');
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
      console.log(error);
    }
  }
} finally {
  fs.rmSync(workFolder, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
