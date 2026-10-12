// Tests for the Portraits settings of Dashboard Settings (dashboard/config.js, core/content.js,
// core/portrait.js and the three panels): the Leadership size and the Roster size, which are set
// apart, the old Portrait size that is copied into both while neither is set, and the shape and
// the frame. The plain functions are run for real. The panels are run against a fake page that
// records what they draw. The stylesheets are checked by reading them, because the shapes need a
// browser to be seen.
//
//   node tools/test-portrait-settings.mjs

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
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-portrait-settings-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
fs.copyFileSync(path.join(dashboardFolder, 'config.js'), path.join(root, 'config.js'));
fs.copyFileSync(path.join(dashboardFolder, 'registry.js'), path.join(root, 'registry.js'));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file));
});
['leadership/leadership.js', 'team-leads/team-leads.js', 'roster/roster.js'].forEach(file => {
  fs.mkdirSync(path.join(root, 'panels', path.dirname(file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, 'panels', file), path.join(root, 'panels', file));
});

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const content = await import(base + 'core/content.js');
const portrait = await import(base + 'core/portrait.js');
const sanity = await import(base + 'core/sanity.js');

// A panel keeps the page it showed last, so a test that counts visits asks for a copy of its own
let copies = 0;
async function freshPanel(name) {
  copies += 1;
  return import(base + 'panels/' + name + '/' + name + '.js?copy=' + copies);
}

const { portraitLook, portraitSizes, rowLayout, rowSizes, rowsMarkup, slotMarkup } = portrait;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// plate.js draws each card and bar shape once into a hidden group of the page. This
// stands in for the page.
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

function mount(panel, data) {
  const host = { innerHTML: '', querySelectorAll: () => [] };
  panel.mount(host, data);
  return host.innerHTML;
}

const countOf = (text, piece) => text.split(piece).length - 1;
const namesIn = html => Array.from(html.matchAll(/<div class="person-name">([^<]*)<\/div>/g)).map(match => match[1]);

function crew(role, count) {
  return Array.from({ length: count }, (_, index) => ({ role: role, name: '[' + role + ' ' + (index + 1) + ']' }));
}

function departments(count) {
  return Array.from({ length: count }, (_, index) => ({ name: '[Dept ' + (index + 1) + ']', lead: '[Lead ' + (index + 1) + ']', members: [] }));
}

// The settings as every way of reading them gives them: the reader of Sanity content, the defaults, and
// the sample file
function settingsThrough(settings) {
  return [
    sanity.normalizeContent({ settings: settings }).settings,
    content.withDefaults({ settings: settings }).settings,
    sanity.normalizeSample({ settings: settings }).settings,
  ];
}

const row = (name, role, address) => ({ name: name, role: role, address: address || '' });

// The settings

test('the two portrait sizes go from 60 to 220 and start at 100, the shape starts square and the frame metal', () => {
  assert.deepEqual([config.limits.leadershipPortrait, config.limits.rosterPortrait], [{ min: 60, max: 220 }, { min: 60, max: 220 }]);
  assert.deepEqual([config.defaultSettings.leadershipPortrait, config.defaultSettings.rosterPortrait], [100, 100]);
  assert.deepEqual(config.portraitShapes, ['square', 'rounded', 'circle']);
  assert.deepEqual(config.portraitFrames, ['metal', 'line', 'none']);
  assert.deepEqual([config.defaultSettings.portraitShape, config.defaultSettings.portraitFrame], ['square', 'metal']);

  [[60, 60], [100, 100], [220, 220], [149.6, 150], [59, 60], [0, 60], [-5, 60], [221, 220], [500, 220]].forEach(([value, wanted]) => {
    assert.equal(content.tidyScale('leadershipPortrait', value), wanted, 'leadershipPortrait ' + value);
    assert.equal(content.tidyScale('rosterPortrait', value), wanted, 'rosterPortrait ' + value);
  });
  ['big', NaN, undefined, null, Infinity].forEach(value => assert.equal(content.tidyScale('rosterPortrait', value), 100, String(value)));
});

test('each way of reading the settings keeps a size in range, and a shape or a frame that is not on the list is the starting one', () => {
  settingsThrough({ leadershipPortrait: 300, rosterPortrait: 10, portraitShape: 'hexagon', portraitFrame: 7 }).forEach(settings => {
    assert.deepEqual([settings.leadershipPortrait, settings.rosterPortrait, settings.portraitShape, settings.portraitFrame], [220, 60, 'square', 'metal']);
  });
  settingsThrough({ leadershipPortrait: 90, rosterPortrait: 180, portraitShape: 'circle', portraitFrame: 'line' }).forEach(settings => {
    assert.deepEqual([settings.leadershipPortrait, settings.rosterPortrait, settings.portraitShape, settings.portraitFrame], [90, 180, 'circle', 'line']);
  });
  config.portraitShapes.forEach(name => settingsThrough({ portraitShape: name }).forEach(settings => assert.equal(settings.portraitShape, name)));
  config.portraitFrames.forEach(name => settingsThrough({ portraitFrame: name }).forEach(settings => assert.equal(settings.portraitFrame, name)));
  [undefined, null, '', 'Circle', 'SQUARE', 'toString', 0, true, ['circle'], {}].forEach(value => {
    settingsThrough({ portraitShape: value, portraitFrame: value }).forEach(settings => {
      assert.deepEqual([settings.portraitShape, settings.portraitFrame], ['square', 'metal'], JSON.stringify(value));
    });
  });
  assert.deepEqual(content.withDefaults(null).settings.leadershipPortrait, 100);
});

test('the old Portrait size is copied into both sizes while neither is set, and is left alone otherwise', () => {
  settingsThrough({ portraitScale: 150 }).forEach(settings => {
    assert.deepEqual([settings.leadershipPortrait, settings.rosterPortrait, settings.portraitScale], [150, 150, 150]);
  });
  settingsThrough({ portraitScale: 60 }).forEach(settings => assert.deepEqual([settings.leadershipPortrait, settings.rosterPortrait], [60, 60]));

  // one of them is saved: it keeps its value, and the other starts at 100, not at the old size
  settingsThrough({ portraitScale: 150, leadershipPortrait: 90 }).forEach(settings => assert.deepEqual([settings.leadershipPortrait, settings.rosterPortrait], [90, 100]));
  settingsThrough({ portraitScale: 150, rosterPortrait: 90 }).forEach(settings => assert.deepEqual([settings.leadershipPortrait, settings.rosterPortrait], [100, 90]));
  settingsThrough({ portraitScale: 150, leadershipPortrait: 70, rosterPortrait: 200 }).forEach(settings => assert.deepEqual([settings.leadershipPortrait, settings.rosterPortrait], [70, 200]));

  // nothing saved at all is 100 for both
  settingsThrough({}).forEach(settings => assert.deepEqual([settings.leadershipPortrait, settings.rosterPortrait], [100, 100]));
  settingsThrough(undefined).forEach(settings => assert.deepEqual([settings.leadershipPortrait, settings.rosterPortrait], [100, 100]));

  // the copy is made when the settings are read: what was saved is not changed
  const saved = { portraitScale: 150 };
  sanity.normalizeContent({ settings: saved });
  content.withDefaults({ settings: saved });
  assert.deepEqual(saved, { portraitScale: 150 });

  // the settings that came through the reader once come through again unchanged, as the cache does
  const names = ['portraitScale', 'leadershipPortrait', 'rosterPortrait', 'portraitShape', 'portraitFrame'];
  const once = sanity.normalizeContent({ settings: { portraitScale: 150 } });
  const again = settings => names.map(name => settings[name]);
  assert.deepEqual(again(content.withDefaults(once).settings), [150, 150, 150, 'square', 'metal']);
  assert.deepEqual(again(sanity.normalizeContent(once).settings), [150, 150, 150, 'square', 'metal']);

  // a panel handed settings that did not come through the reader reads them the same way
  assert.equal(content.portraitPercentOf({ portraitScale: 150 }, 'leadershipPortrait'), 150);
  assert.equal(content.portraitPercentOf({ portraitScale: 150, rosterPortrait: 80 }, 'leadershipPortrait'), 100);
  assert.equal(content.portraitPercentOf({ portraitScale: 150, rosterPortrait: 80 }, 'rosterPortrait'), 80);
  assert.equal(content.portraitPercentOf(undefined, 'rosterPortrait'), 100);
  assert.equal(content.portraitPercentOf({ portraitScale: 'big' }, 'rosterPortrait'), 100);
});

// Rows per page

test('the table of rows per page: 4 up to 100, 3 up to 138, 2 up to 200 and 1 up to 220, and a row is the body divided by the rows', () => {
  const steps = [[60, 100, 4, 144], [101, 138, 3, 192], [139, 200, 2, 288], [201, 220, 1, 576]];

  steps.forEach(([from, to, rows, height]) => {
    for (let percent = from; percent <= to; percent++) {
      const layout = rowLayout(percent);
      assert.deepEqual([layout.rows, layout.height], [rows, height], 'at ' + percent);
      assert.equal(layout.rows * layout.height, 576, 'the rows fill the body at ' + percent);
      assert.ok(rowSizes(percent).card <= layout.height - 24, 'the portrait is 24px or more shorter than its row at ' + percent);
    }
  });

  // a size past either end is the nearest end, and an odd one is 100
  assert.equal(rowLayout(500).rows, 1);
  assert.equal(rowLayout(1).rows, 4);
  assert.equal(rowLayout('big').rows, 4);
  assert.equal(rowLayout().rows, 4);
});

test('Leadership and Team leads are set apart: each page holds the rows of its own size', () => withFakePage(async () => {
  const people = [].concat(crew('Coach', 2), crew('Captain', 3), crew('Mentor', 3));
  const subteams = departments(8);

  // the two sizes differ, in both directions, and the same screen holds both
  for (const [leadership, roster, leadershipRows, rosterRows] of [[100, 200, 4, 2], [200, 100, 2, 4], [120, 220, 3, 1], [60, 139, 4, 2]]) {
    const settings = { leadershipPortrait: leadership, rosterPortrait: roster };
    const leadershipPanel = await freshPanel('leadership');
    const teamLeadsPanel = await freshPanel('team-leads');
    const leadershipVisits = [];
    const teamLeadsVisits = [];

    for (let visit = 0; visit < 10; visit++) {
      leadershipVisits.push(namesIn(mount(leadershipPanel, { people: people, settings: settings })));
      teamLeadsVisits.push(namesIn(mount(teamLeadsPanel, { subteams: subteams, people: [], settings: settings })));
    }

    const where = 'Leadership at ' + leadership + ' and Team leads at ' + roster;
    assert.equal(leadershipVisits[0].length, Math.min(leadershipRows, people.length), where);
    assert.equal(teamLeadsVisits[0].length, rosterRows, where);

    // each panel goes through everyone in order, one page at a time, and starts again
    const leadershipPages = Math.ceil(people.length / leadershipRows);
    const teamLeadsPages = Math.ceil(subteams.length / rosterRows);
    assert.deepEqual([].concat(...leadershipVisits.slice(0, leadershipPages)), people.map(person => person.name), where);
    assert.deepEqual([].concat(...teamLeadsVisits.slice(0, teamLeadsPages)), subteams.map(subteam => subteam.lead), where);
    assert.deepEqual(leadershipVisits[leadershipPages], leadershipVisits[0], where + ': the first page again');
    assert.deepEqual(teamLeadsVisits[teamLeadsPages], teamLeadsVisits[0], where + ': the first page again');
  }
}));

test('a panel draws the portraits at the size of its own setting, and the old Portrait size counts only while neither is set', () => withFakePage(async () => {
  const people = crew('Coach', 1);
  const subteams = departments(1);
  const card = html => /--portrait-card: (\d+)px/.exec(html)[1];
  const draw = async (name, settings) => mount(await freshPanel(name), { people: people, subteams: subteams, settings: settings });

  const apart = { leadershipPortrait: 60, rosterPortrait: 200 };
  assert.equal(card(await draw('leadership', apart)), '72');
  assert.equal(card(await draw('team-leads', apart)), '240');

  const swapped = { leadershipPortrait: 200, rosterPortrait: 60 };
  assert.equal(card(await draw('leadership', swapped)), '240');
  assert.equal(card(await draw('team-leads', swapped)), '72');

  assert.equal(card(await draw('leadership', { portraitScale: 150 })), '180');
  assert.equal(card(await draw('team-leads', { portraitScale: 150 })), '180');
  assert.equal(card(await draw('leadership', { portraitScale: 150, rosterPortrait: 80 })), '120', 'one saved: the other starts at 100');
}));

test('the Roster slot follows the Roster size to 100 and no further, and Leadership has no say', () => withFakePage(async () => {
  const subteams = [{ name: '[Build]', lead: '[Lead A]', members: ['[Alex]'] }];
  const card = html => /--portrait-card: (\d+)px/.exec(html)[1];
  const draw = async settings => card(mount(await freshPanel('roster'), { people: [], subteams: subteams, settings: settings }));

  assert.equal(await draw({ rosterPortrait: 100 }), '292');
  assert.equal(await draw({ rosterPortrait: 220 }), '292');
  assert.equal(await draw({ rosterPortrait: 60 }), '175');
  assert.equal(await draw({ leadershipPortrait: 60, rosterPortrait: 100 }), '292');
  assert.equal(await draw({ portraitScale: 60 }), '175', 'the old Portrait size, while neither is set');
  assert.equal(await draw(undefined), '292');
}));

// The shape and the frame

test('the usual look, a square with a metal edge, adds nothing to the markup', () => withFakePage(() => {
  assert.deepEqual(portraitLook(), { shape: 'square', frame: 'metal' });
  assert.deepEqual(portraitLook({ portraitShape: 'hexagon', portraitFrame: 'gold' }), { shape: 'square', frame: 'metal' });
  assert.deepEqual(portraitLook({ portraitShape: 'circle', portraitFrame: 'none' }), { shape: 'circle', frame: 'none' });

  const slot = { name: '[Lead]', role: 'TEAM LEAD', address: '' };
  const usual = slotMarkup(slot);
  assert.ok(usual.includes('<div class="portrait" style="--portrait-card: 292px; --portrait-photo: 280px; --portrait-inset: 6px">'));
  assert.ok(usual.includes('href="#card-292x292"'), 'the card plate.js draws');
  assert.equal(slotMarkup(Object.assign({ look: portraitLook({}) }, slot)), usual);
  assert.equal(/shape-|frame-|--portrait-clip/.test(usual), false);

  const rows = rowsMarkup([row('[Sam]', 'COACH')], 100);
  assert.ok(rows.includes('<div class="portrait" style="--portrait-card: 120px; --portrait-photo: 116px; --portrait-inset: 2px">'));
  assert.equal(/shape-|frame-|--portrait-clip/.test(rows), false);
}));

test('rounded and circle put a class on the portrait and hand the clip of the picture over, and draw their own metal edge', () => withFakePage(drawn => {
  const slot = { name: '[Lead]', role: 'TEAM LEAD', address: '' };
  const rounded = slotMarkup(Object.assign({ look: { shape: 'rounded', frame: 'metal' } }, slot));
  const circle = slotMarkup(Object.assign({ look: { shape: 'circle', frame: 'metal' } }, slot));

  assert.ok(rounded.includes('<div class="portrait shape-rounded" style="--portrait-card: 292px; --portrait-photo: 280px; --portrait-inset: 6px; --portrait-clip: polygon(12px 0,'));
  assert.ok(circle.includes('<div class="portrait shape-circle" style="--portrait-card: 292px; --portrait-photo: 280px; --portrait-inset: 6px; --portrait-clip: circle(50%); --portrait-clip-flipped: circle(50%)">'));

  // the picture is cut 12px more than the card, because it sits 6px in on both sides
  assert.ok(rounded.includes('--portrait-clip: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)'));
  assert.ok(rounded.includes('--portrait-clip-flipped: polygon(12px 0,'), 'a rounded corner is the same on both sides, so the flipped clip is the same');

  // the metal edge is the five layers of plate.js and the card fill, drawn straight in the svg, and no shape is added to the page
  [rounded, circle].forEach(html => {
    ['edge-shadow', 'edge-rim', 'edge-face', 'edge-shade', 'edge-ridge', 'card-fill'].forEach(layer => assert.equal(countOf(html, 'class="' + layer + '"'), 1, layer));
    assert.ok(html.includes('<svg class="card-outline thin" width="292" height="292" viewBox="0 0 292 292">'));
  });
  assert.equal(countOf(rounded, '<polygon'), 6);
  assert.ok(rounded.includes('<polygon class="card-fill" points="26,2 266,2 290,26 290,266 266,290 26,290 2,266 2,26"/>'), 'eight corners, 24px in from each corner of the 292 card');
  assert.equal(countOf(circle, '<circle'), 6);
  assert.ok(circle.includes('<circle class="card-fill" cx="146" cy="146" r="144"/>'));
  assert.deepEqual(drawn, [], 'the shapes are not put in the hidden group of the page');

  // the corner cut is 24px on the screen at every size of card: the card is drawn at 292 and shrunk
  const small = rowsMarkup([row('[Sam]', 'COACH')], 100, { shape: 'rounded', frame: 'metal' });
  assert.ok(small.includes('<polygon class="card-fill" points="60.4,2 231.6,2 290,60.4'), 'at 120 the cut is 24 on the screen, 58.4 at 292');
  assert.ok(small.includes('--portrait-clip: polygon(20px 0, calc(100% - 20px) 0'), 'the picture is cut 4px less, 2px in on both sides');
  const least = rowsMarkup([row('[Sam]', 'COACH')], 60, { shape: 'rounded', frame: 'none' });
  assert.ok(least.includes('--portrait-clip: polygon(18px 0, calc(100% - 18px) 0'), 'a card of 72 is cut a quarter, 18px, at most');
}));

test('the thin line is drawn over the picture, 3px wide, and None draws the picture alone, with the picture as big as the card', () => withFakePage(() => {
  const slot = { name: '[Lead]', role: 'TEAM LEAD', address: '' };
  const line = slotMarkup(Object.assign({ look: { shape: 'square', frame: 'line' } }, slot));
  const none = slotMarkup(Object.assign({ look: { shape: 'square', frame: 'none' } }, slot));

  assert.ok(line.includes('<div class="portrait frame-line" style="--portrait-card: 292px; --portrait-photo: 292px; --portrait-inset: 0px; --portrait-clip: polygon(0 0, 100% 0, 100% 88.36%, 85.62% 100%, 0 100%); --portrait-clip-flipped: polygon(100% 0, 0 0, 0 88.36%, 14.38% 100%, 100% 100%)">'));
  assert.ok(none.includes('<div class="portrait frame-none" style="--portrait-card: 292px; --portrait-photo: 292px; --portrait-inset: 0px; --portrait-clip: polygon(0 0'));

  // the line comes after the picture, so it is drawn over its edge, and the metal edge came before it
  assert.ok(line.indexOf('class="portrait-photo"') < line.indexOf('class="portrait-line"'));
  assert.ok(line.includes('<svg class="card-outline" width="292" height="292" viewBox="0 0 292 292">'));
  assert.equal(countOf(line, 'class="portrait-line"'), 1);
  assert.equal(line.includes('edge-face') || line.includes('card-292x292'), false, 'no metal');
  assert.equal(none.includes('<svg class="card-outline'), false, 'no frame at all');
  assert.equal(none.includes('portrait-line') || none.includes('edge-face'), false);

  // in a row the picture is the whole card as well, and the line is 3px wide whatever the size
  const row120 = rowsMarkup([row('[Sam]', 'COACH', 'https://example.test/a.jpg')], 100, { shape: 'circle', frame: 'line' });
  assert.ok(row120.includes('<div class="portrait shape-circle frame-line" style="--portrait-card: 120px; --portrait-photo: 120px; --portrait-inset: 0px; --portrait-clip: circle(50%)'));
  assert.ok(row120.includes('<img src="https://example.test/a.jpg" width="120" height="120" alt="">'));
  assert.ok(row120.includes('<circle class="portrait-line" cx="60" cy="60" r="58.5"/>'), 'a circle 1.5px in, so the 3px line is inside the clip');

  // the sizes without metal
  assert.deepEqual(portraitSizes(100, 'line'), { card: 292, photo: 292, inset: 0 });
  assert.deepEqual(portraitSizes(60, 'none'), { card: 175, photo: 175, inset: 0 });
  assert.deepEqual(rowSizes(100, 'none'), { card: 120, photo: 120, inset: 0 });
  assert.deepEqual(rowSizes(100), { card: 120, photo: 116, inset: 2 });
}));

test('the shape and the frame are for every panel: the two sets of rows and the slot take them from the same settings', () => withFakePage(async () => {
  const settings = { portraitShape: 'rounded', portraitFrame: 'line' };
  const leadership = mount(await freshPanel('leadership'), { people: crew('Coach', 2), settings: settings });
  const teamLeads = mount(await freshPanel('team-leads'), { subteams: departments(2), people: [], settings: settings });
  const roster = mount(await freshPanel('roster'), { people: [], subteams: [{ name: '[Build]', lead: '[Lead A]', members: ['[Alex]'] }], settings: settings });

  [leadership, teamLeads, roster].forEach(html => {
    assert.ok(html.includes('class="portrait shape-rounded frame-line'));
    assert.ok(html.includes('class="portrait-line"'));
  });
  assert.equal(countOf(leadership, 'class="portrait shape-rounded frame-line'), 2);

  // the role still gives the metal of the frame of a person
  const metal = mount(await freshPanel('leadership'), { people: crew('Coach', 1), settings: { portraitFrame: 'metal', portraitShape: 'circle' } });
  assert.ok(metal.includes('class="portrait shape-circle red-metal"'));
}));

test('the stylesheets take the clip from the portrait, and the thin line is 3px in the team accent', () => {
  const css = read('base.css');
  const trim = read('trim.css');
  const rule = selector => new RegExp('(?:^|[}\\s])' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}').exec(css)[1];

  assert.ok(/clip-path: var\(--portrait-clip, polygon\(0 0, 100% 0, 100% 89\.214%, 86\.536% 100%, 0 100%\)\);/.test(rule('.portrait-photo')), 'the usual clip is the one it has always had');
  assert.ok(/html\.corner-cut-tr \.portrait-photo \{ clip-path: var\(--portrait-clip-flipped, polygon\(100% 0, 0 0, 0 89\.214%, 13\.464% 100%, 100% 100%\)\); \}/.test(trim), 'the other corner cut keeps its clip');
  const line = rule('.portrait-line');
  assert.ok(/fill: none;/.test(line) && /stroke: var\(--yellow\);/.test(line) && /stroke-width: 3px;/.test(line));
  assert.equal(/box-shadow|text-shadow|filter|blur|animation|transition|@keyframes/.test(line), false);

  // the markup of the sample screen is the usual look
  const sample = JSON.parse(fs.readFileSync(sampleFile, 'utf8')).settings;
  assert.deepEqual([sample.leadershipPortrait, sample.rosterPortrait, sample.portraitShape, sample.portraitFrame], [100, 100, 'square', 'metal']);
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
