// Tests for the rows of the Team Leads and Leadership panels (dashboard/core/portrait.js,
// core/team-leads.js, core/leadership.js and the two panels). The plain functions are run for
// real. The panels are run against a fake page that records what they draw. The stylesheet is
// checked by reading it, because the sizes need a browser to be seen.
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
const { leaders, roleOrder } = leadership;

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

const numberIn = (rule, property) => Number(new RegExp('(?:^|[;\\s])' + property + ': (\\d+)(?:px)?[;\\s]').exec(rule)[1]);

// The portrait in a row

test('four rows to a page, and the portrait in a row is 124 square at 100 and follows the Portrait size', () => {
  assert.equal(rowsPerPage, 4);
  assert.deepEqual(rowSizes(100), { card: 124, photo: 118, inset: 3 });
  assert.deepEqual(rowSizes(80), { card: 99, photo: 95, inset: 2 });
  assert.deepEqual(rowSizes(60), { card: 74, photo: 70, inset: 2 });

  // no size, or an odd one, is 100, and the setting stays between 60 and 100
  assert.deepEqual(rowSizes(), rowSizes(100));
  assert.deepEqual(rowSizes('big'), rowSizes(100));
  assert.deepEqual(rowSizes(30), rowSizes(60));
  assert.deepEqual(rowSizes(250), rowSizes(100));

  let before = 0;
  for (let percent = 60; percent <= 100; percent++) {
    const size = rowSizes(percent);
    assert.equal(size.photo, size.card - 2 * size.inset, 'the picture is the card less its space on both sides');
    assert.ok(size.card >= before, 'a bigger setting never gives a smaller portrait');
    before = size.card;
  }

  // the thin bar under a row is centred on the row's foot, and the card leaves it room: 144 less 124 is 10 each side
  assert.ok(144 - rowSizes(100).card >= 20);
  // the full size portrait of the Roster panel is not touched
  assert.deepEqual(portraitSizes(100), { card: 292, photo: 280, inset: 6 });
});

test('a row is the portrait, the name and the role, as one slat, with a bar under it except the last, and escapes what editors typed', () => withFakePage(drawn => {
  const address = 'https://cdn.sanity.io/images/abc123/production/0123abcd-800x600.jpg?w=280&h=280';
  const html = rowsMarkup([
    { name: '<b>Alexandria Joseph</b>', role: 'HEAD COACH', address: address, metal: 'red' },
    { name: '[Sam]', role: 'CAPTAIN', address: '', metal: 'gold' },
    { name: '[Pat]', role: '', address: '' },
  ], 100);

  assert.ok(html.startsWith('<div class="person-rows">'));
  assert.equal(countOf(html, '<div class="person-row" data-slat="item">'), 3);
  assert.equal(countOf(html, 'class="row-bar"'), 2, 'a bar under every row but the last');
  assert.ok(html.includes('&lt;b&gt;Alexandria Joseph&lt;/b&gt;') && !html.includes('<b>'));
  assert.ok(html.includes('<div class="person-role">HEAD COACH</div>'));
  assert.ok(html.includes('<img src="' + address.replace(/&/g, '&amp;') + '" width="118" height="118" alt="">'));
  assert.equal(countOf(html, '<use href="#person-silhouette"'), 2, 'a row with no address has the silhouette');

  // the metal is the frame of the picture, not of the row, so the bars keep the panel's own
  assert.ok(html.includes('<div class="portrait red-metal" style="--portrait-card: 124px; --portrait-photo: 118px; --portrait-inset: 3px">'));
  assert.ok(html.includes('<div class="portrait" data-metal="gold" style='));
  assert.ok(html.includes('<div class="portrait" style='));
  assert.equal(/<div class="person-row"[^>]*(metal|red)/.test(html), false);

  // the card is the one shape of 292 and the bar the one of 1124, drawn once however many rows there are
  assert.deepEqual(Array.from(new Set(drawn)).sort(), ['bar-1124', 'card-292x292']);
  assert.ok(html.includes('href="#card-292x292"') && html.includes('href="#bar-1124"'));
}));

test('a row follows the Portrait size and keeps its text, and the markup is the same apart from the sizes', () => withFakePage(() => {
  const rows = [{ name: '[Alex]', role: 'CAPTAIN', address: 'https://example.test/a.jpg' }, { name: '[Sam]', role: 'COACH', address: '' }];
  const at100 = rowsMarkup(rows, 100);
  const at60 = rowsMarkup(rows, 60);

  assert.equal(rowsMarkup(rows), at100, 'no size is 100');
  assert.ok(at60.includes('--portrait-card: 74px; --portrait-photo: 70px; --portrait-inset: 2px'));
  assert.ok(at60.includes('width="70" height="70" alt=""'));
  assert.ok(rowsMarkup(rows, 80).includes('--portrait-card: 99px; --portrait-photo: 95px; --portrait-inset: 2px'));

  const withoutSizes = html => html.replace(/ style="--portrait[^"]*"/g, '').replace(/ width="\d+" height="\d+" alt=""/g, '');
  assert.equal(withoutSizes(at60), withoutSizes(at100));
}));

// The Team Leads panel

test('departmentRows: the lead and the department, in the order of the list, and [lead] for a department with no lead', () => {
  const rows = departmentRows([
    department('  [Build] ', '  [Lead A]  '),
    department('[Software]', ''),
    department('[Media]', undefined),
    department('', '[Lead B]'),
    { name: '[Bare]' },
  ]);

  assert.deepEqual(rows, [
    { name: '[Lead A]', role: '[BUILD] LEAD', lead: '[Lead A]' },
    { name: '[Software]', role: '[lead]', lead: '' },
    { name: '[Media]', role: '[lead]', lead: '' },
    { name: '[Lead B]', role: 'LEAD', lead: '[Lead B]' },
    { name: '[Bare]', role: '[lead]', lead: '' },
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
  assert.deepEqual(rolesIn(visits[0]), ['[DEPT 1] LEAD', '[DEPT 2] LEAD', '[DEPT 3] LEAD', '[DEPT 4] LEAD']);

  // a full page has three bars and the last row none, and a short page keeps its rows at the top
  assert.equal(countOf(visits[0], 'class="row-bar"'), 3);
  assert.equal(countOf(visits[2], 'class="row-bar"'), 1);
  assert.ok(visits[0].includes('<h2 class="title" data-slat="title">TEAM</h2>') && visits[0].includes('<span class="tag-text">TEAM LEADS</span>'));
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
}));

test('the Team Leads panel with nothing to show has no content, and with fewer than four has fewer rows', () => withFakePage(() => {
  assert.equal(teamLeadsPanel.hasContent({ subteams: [] }), false);
  assert.equal(teamLeadsPanel.hasContent({ subteams: [department('', '')] }), false);
  assert.equal(teamLeadsPanel.hasContent({}), false);

  const one = mount(teamLeadsPanel, { subteams: [department('[Build]', '[Lead A]')], people: [] });
  assert.equal(countOf(one, 'data-slat="item"'), 1);
  assert.equal(countOf(one, 'class="row-bar"'), 0);
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
  assert.deepEqual(namesOf(leaders(people)), ['[Coach 1]', '[Captain 1]', '[Captain 2]', '[Mentor 1]']);
});

test('two coaches then two captains are the four rows, and with more than four people the first four show', () => {
  assert.deepEqual(namesOf(leaders([].concat(crew('Captain', 2), crew('Coach', 2)))), ['[Coach 1]', '[Coach 2]', '[Captain 1]', '[Captain 2]']);
  assert.deepEqual(namesOf(leaders([].concat(crew('Coach', 2), crew('Captain', 2), crew('Mentor', 2)))), ['[Coach 1]', '[Coach 2]', '[Captain 1]', '[Captain 2]']);
  assert.deepEqual(namesOf(leaders([].concat(crew('Coach', 3), crew('Captain', 3)))), ['[Coach 1]', '[Coach 2]', '[Coach 3]', '[Captain 1]']);
  assert.equal(leaders(crew('Mentor', 9)).length, rowsPerPage);

  // the people are in their typed order inside a role
  assert.deepEqual(namesOf(leaders(crew('Coach', 6))), namesOf(crew('Coach', 4)));

  const people = sample().people;
  assert.deepEqual(people.map(person => person.role), ['Coach', 'Coach', 'Captain', 'Captain', 'Mentor', 'Mentor']);
  assert.deepEqual(leaders(people).map(person => person.role), ['Coach', 'Coach', 'Captain', 'Captain']);
});

test('a president is a captain with a title, so they are with the captains', () => {
  const people = [].concat(crew('Captain', 1, { name: '[President]', title: 'President' }), crew('Coach', 1), crew('Captain', 1));

  assert.deepEqual(namesOf(leaders(people)), ['[Coach 1]', '[President]', '[Captain 1]']);
});

test('leaders ignores capitals and spaces in a role, and puts any other role last', () => {
  const people = [].concat(crew('  CAPTAIN ', 1), crew('coach', 1), crew('Alumni', 1), crew('Mentor', 1), crew('', 1, { name: '[No role]' }), crew('Alumni', 1, { name: '[Alumni B]' }));

  assert.deepEqual(namesOf(leaders(people)), ['[coach 1]', '[  CAPTAIN  1]', '[Mentor 1]', '[Alumni 1]']);
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

test('the Leadership panel is one page of rows, the same on every visit, with the frame of each picture in the colour of its role', () => withFakePage(() => {
  const people = [].concat(crew('Coach', 2, { title: 'Head coach' }), crew('Captain', 3), crew('Mentor', 1));
  people[1].title = undefined;
  const content = { people: people };
  const visits = [mount(leadershipPanel, content), mount(leadershipPanel, content), mount(leadershipPanel, content)];

  assert.equal(leadershipPanel.hasContent(content), true);
  assert.equal(leadershipPanel.hasContent({ people: [] }), false);
  assert.equal(leadershipPanel.hasContent({ people: [{ role: 'Coach', name: '[Hidden]', show: false }] }), false);
  assert.equal(leadershipPanel.hasContent({}), false);

  visits.forEach(html => assert.equal(html, visits[0], 'one page, so every visit is the same'));
  assert.deepEqual(namesIn(visits[0]), ['[Coach 1]', '[Coach 2]', '[Captain 1]', '[Captain 2]']);
  assert.deepEqual(rolesIn(visits[0]), ['HEAD COACH', 'COACH', 'CAPTAIN', 'CAPTAIN']);
  assert.equal(countOf(visits[0], 'class="row-bar"'), 3);
  assert.equal(countOf(visits[0], 'class="portrait red-metal"'), 2);
  assert.equal(countOf(visits[0], 'data-metal="gold"'), 2);
  assert.ok(visits[0].includes('<h2 class="title" data-slat="title">TEAM</h2>') && visits[0].includes('<span class="tag-text">LEADERSHIP</span>'));
}));

test('the Leadership panel with three people has three rows, and a person with no photo has the silhouette', () => withFakePage(() => {
  const html = mount(leadershipPanel, { people: [].concat(crew('Coach', 1), crew('Captain', 2)) });

  assert.equal(countOf(html, 'data-slat="item"'), 3);
  assert.equal(countOf(html, 'class="row-bar"'), 2);
  assert.equal(countOf(html, '<use href="#person-silhouette"'), 3);
}));

// Both panels

test('both panels draw their rows at the Portrait size, and at 100 without it, and the text keeps its size', () => withFakePage(() => {
  const people = [{ role: 'Coach', name: '[Coach A]' }, { role: 'Captain', name: '[Captain A]' }];
  const subteams = [department('[Build]', '[Lead A]')];

  [['leadership', leadershipPanel], ['team leads', teamLeadsPanel]].forEach(([name, panel]) => {
    const draw = settings => mount(panel, { people: people, subteams: subteams, settings: settings });
    const at60 = draw({ portraitScale: 60 });
    const at80 = draw({ portraitScale: 80, photoScale: 60 });
    const at100 = draw({ portraitScale: 100 });

    assert.ok(at60.includes('--portrait-card: 74px; --portrait-photo: 70px; --portrait-inset: 2px'), name + ' at 60');
    assert.ok(at80.includes('--portrait-card: 99px; --portrait-photo: 95px; --portrait-inset: 2px'), name + ' at 80, and the Photo size does not change it');
    assert.ok(at100.includes('--portrait-card: 124px; --portrait-photo: 118px; --portrait-inset: 3px'), name + ' at 100');
    assert.ok(draw(undefined).includes('--portrait-card: 124px'), name + ' with no settings');
    assert.ok(draw({}).includes('--portrait-card: 124px'), name + ' with no size');

    const withoutSizes = html => html.replace(/ style="--portrait[^"]*"/g, '').replace(/ width="\d+" height="\d+"/g, '');
    assert.equal(withoutSizes(at60), withoutSizes(at100), name);
  });
}));

test('the panels draw through the shared rows and the header mark, have no animation code, and the Roster panel is as it was', () => {
  ['panels/leadership/leadership.js', 'panels/team-leads/team-leads.js'].forEach(file => {
    const code = read(file);
    ['rowsMarkup(', 'watchPhotos(', 'doubleSlash()', 'photoAddress('].forEach(piece => assert.ok(code.includes(piece), file + ' does not use ' + piece));
    assert.equal(/slotMarkup|slotsPerPage|MAX_CARDS|splitEvenly|leadershipPages/.test(code), false, file + ' still draws the cards');
    assert.equal(/setTimeout|setInterval|requestAnimationFrame|animate\(/.test(code), false, file + ' has animation code');
  });
  assert.ok(read('panels/team-leads/team-leads.js').includes('makePages(rowsPerPage)'), 'Team Leads does not show a page at a time');
  assert.ok(read('panels/team-leads/team-leads.js').includes('preloadPhotos('), 'Team Leads does not load the next page\'s photos');
  assert.equal(read('panels/leadership/leadership.js').includes('makePages'), false, 'Leadership is one page');

  const roster = read('panels/roster/roster.js');
  assert.ok(roster.includes('slotMarkup(') && !roster.includes('rowsMarkup('), 'the Roster panel still draws its team lead as a slot');
  assert.ok(read('registry.js').includes("{ id: 'team-leads', region: 'grid1', topic: 'subteams' },"));
  assert.ok(read('registry.js').includes("{ id: 'leadership', region: 'grid1', topic: 'people' },"));
});

test('four rows of 144 fill the 576 body, the name is 64px, the role is 44px in the team colour at the right end, and nothing is smaller than 44px', () => {
  const css = read('base.css');
  const rows = ruleOf(css, '.person-rows');
  const row = ruleOf(css, '.person-row');
  const name = ruleOf(css, '.person-name');
  const role = ruleOf(css, '.person-role');

  // the Events panel has the same body: 124 from the top, 576 high, 1152 wide
  assert.deepEqual([numberIn(rows, 'left'), numberIn(rows, 'top'), numberIn(rows, 'width'), numberIn(rows, 'height')], [0, 124, 1152, 576]);
  assert.equal(numberIn(row, 'height') * rowsPerPage, numberIn(rows, 'height'));
  assert.ok(/display: grid;/.test(row) && /grid-template-columns: auto auto minmax\(0, 1fr\);/.test(row) && /align-items: center;/.test(row), 'the picture, the name and the role are centred in the row');
  assert.ok(/grid-column: 2;/.test(name) && /grid-column: 3;/.test(role), 'the name and the role keep their columns when one of them is missing');
  assert.equal(/display: (inline-)?flex/.test(css.slice(css.indexOf('.person-rows {'), css.indexOf('.person-name:empty'))), false, 'a flex row in base.css would have to be named in the mirror test of test-layouts.mjs');

  assert.ok(/font: 500 var\(--size-body-large\)\/72px var\(--font-text\);/.test(name), 'the name is 64px');
  assert.ok(/white-space: nowrap;/.test(name) && /text-overflow: ellipsis;/.test(name), 'a long name is cut, not wrapped');
  assert.ok(/font: 600 var\(--size-label\)\/48px var\(--font-display\);/.test(role), 'the role is 44px');
  assert.ok(/color: var\(--yellow\);/.test(role), 'the role is in the team accent');
  assert.ok(/text-align: right;/.test(role), 'the role takes what is left and ends at the right');
  assert.ok(/-webkit-line-clamp: 2;/.test(role), 'the role has at most two lines');
  assert.ok(/--size-body-large: 64px;/.test(read('tokens.css')) && /--size-label: 44px;/.test(read('tokens.css')));

  [rows, row, name, role, ruleOf(css, '.person-row .portrait'), ruleOf(css, '.person-row .row-bar')].forEach(rule => {
    assert.equal(/font-size|@keyframes|transition:|animation:|box-shadow|text-shadow|filter|blur/.test(rule), false);
  });
  ['panels/leadership/leadership.css', 'panels/team-leads/team-leads.css'].forEach(file => {
    assert.equal(/font-size|font: [^;]*\b\d+px\//.test(read(file).replace(/var\(--size-[a-z-]+\)\/\d+px/g, '')), false, file + ' has a text size of its own');
    assert.equal(/@keyframes|transition:|animation:|box-shadow|text-shadow|filter|blur/.test(read(file)), false, file);
  });
});

test('the rows fit the panel: the bar between them, the photo, the longest name, the role and the cut corner', () => {
  const css = read('base.css');
  const row = ruleOf(css, '.person-row');
  const last = ruleOf(css, '.person-row:nth-child(4)');
  const name = ruleOf(css, '.person-name');
  const bar = ruleOf(css, '.person-row .row-bar');
  const gap = numberIn(row, 'column-gap');

  // the bar is the one the Events panel has: its line is 10px into its 20px picture, so it sits on the foot of the row
  assert.equal(numberIn(bar, 'top') + 10, numberIn(row, 'height'));
  assert.equal(numberIn(bar, 'left'), 14);
  assert.ok(read('core/portrait.js').includes('const rowBarLength = 1124;'));
  assert.equal(1152 - 2 * numberIn(bar, 'left'), 1124, 'the bar stops 14px short of the frame on each side');

  // the room for the name and the role in a row, and in the last row, which stops sooner
  const padding = /padding: 0 (\d+)px 0 (\d+)px;/.exec(row);
  const innerWidth = 1152 - Number(padding[1]) - Number(padding[2]);
  const lastInnerWidth = 1152 - numberIn(last, 'padding-right') - Number(padding[2]);
  const roleRoom = width => width - rowSizes(100).card - 2 * gap - numberIn(name, 'max-width');
  assert.ok(roleRoom(innerWidth) >= 336 && roleRoom(lastInnerWidth) >= 336, 'the role has 336px or more beside the longest name');

  // the last row is 556 to 700 down the panel, its role two lines at most, centred. Its lowest line ends at 676, and the cut corner
  // of the frame there is at x = 1148 - (676 - 640) * 80 / 64
  const lastTop = 124 + 3 * numberIn(row, 'height');
  const lowest = lastTop + numberIn(row, 'height') / 2 + 48;
  const cutAt = 1148 - (lowest - 640) * 80 / 64;
  assert.ok(1152 - numberIn(last, 'padding-right') <= cutAt, 'the role in the last row stays inside the cut corner');
  assert.ok(lastTop + numberIn(row, 'height') <= 704, 'the rows end above the foot of the frame');

  // the cut corner numbers are the ones of the large frame
  assert.ok(read('core/plate.js').includes('body: [[4, 120], [1148, 120], [1148, 640], [1068, 704], [4, 704]]'));
});

test('the rows have no rule for a style or a layout, so Original, Cybertron, Minimal and the sidebar layout draw the same panel code', () => {
  const css = read('base.css');
  ['.person-rows', '.person-row', '.person-name', '.person-role', '.person-row .portrait'].forEach(selector => assert.notEqual(ruleOf(css, selector), '', selector));

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
