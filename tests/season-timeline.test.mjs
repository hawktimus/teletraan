// Tests for the season timeline card (dashboard/panels/competition-timeline): the names of the events
// (the short name TBA gives, without a year at the front), the numbered dots, the words on the line, the
// legend of up to six rows, the line that says how many more events there are, and how it all fits its body.
// The competition data is made up: the sample in data/sample/content.json, changed here and there. The
// competition cards as a whole are in tests/competition.test.mjs.
//
//   node tests/season-timeline.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const sampleFile = path.join(dashboardFolder, 'data/sample/content.json');
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-season-timeline-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
copyModule(path.join(dashboardFolder, 'config.js'), path.join(root, 'config.js'));
copyModule(path.join(dashboardFolder, 'registry.js'), path.join(root, 'registry.js'));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  copyModule(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  copyModule(path.join(dashboardFolder, file), path.join(root, file));
});
fs.mkdirSync(path.join(root, 'panels/competition-timeline'), { recursive: true });
copyModule(path.join(dashboardFolder, 'panels/competition-timeline/panel.js'), path.join(root, 'panels/competition-timeline/panel.js'));

const base = pathToFileURL(root).href + '/';
const frcModule = await import(base + 'core/frc.js');
const competition = await import(base + 'core/competition.js');
const sanity = await import(base + 'core/sanity.js');
const textWidthModule = await import(base + 'core/text-width.js');
const timeline = await import(base + 'panels/competition-timeline/panel.js');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const at = text => new Date(text);
const noon = date => at(date + 'T17:00:00Z');
const countOf = (text, piece) => text.split(piece).length - 1;
const primeOf = frc => frc.teams.find(team => team.team === 'prime');

// The sample content, cleaned as the screen cleans it, with the countdown on a time that falls on the same day everywhere
function contentWith(change) {
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  raw.settings.countdown = { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
  if (change) change(raw);
  return sanity.normalizeSample(raw);
}

// The sample with these events in place of the events of the team, and no state championship unless the test gives one
function eventsOf(events, change) {
  return contentWith(raw => {
    primeOf(raw.frc).events = events;
    raw.frc.districtEvents = [];
    if (change) change(raw);
  });
}

const event = (number, fields) => Object.assign({ key: '2027x' + number, name: 'Event ' + number, city: 'City ' + number, startDate: '2027-05-' + String(number).padStart(2, '0'), endDate: '2027-05-' + String(number).padStart(2, '0') }, fields);

const rowsOf = (html, cssClass) => Array.from(html.matchAll(new RegExp('<span class="' + cssClass + '">([^<]*)</span>', 'g'))).map(match => match[1]);
const dashes = /[\u2013\u2014]/;


// The names

test('an event is called by its short name when it has one, and by its name when it has none, without a year at the front', () => {
  const name = fields => frcModule.eventName(fields);

  assert.equal(name({ name: 'FIRST In Virginia District Event', shortName: 'Hampton Roads' }), 'Hampton Roads');
  assert.equal(name({ name: 'Hampton Roads Event', shortName: '' }), 'Hampton Roads Event');
  assert.equal(name({ name: 'Hampton Roads Event' }), 'Hampton Roads Event');
  assert.equal(name({ name: '2027 Hampton Roads Event' }), 'Hampton Roads Event');
  assert.equal(name({ name: '2027 - Hampton Roads Event' }), 'Hampton Roads Event');
  assert.equal(name({ name: '2027: Hampton Roads Event' }), 'Hampton Roads Event');
  assert.equal(name({ name: '2027Hampton' }), 'Hampton', 'a year with no space after it');
  assert.equal(name({ name: '1999 Classic', shortName: '2027 Hampton Roads' }), 'Hampton Roads', 'the year is taken off the short name too');
  assert.equal(name({ name: '12th Man Event' }), '12th Man Event', 'a number that is not a year stays');
  assert.equal(name({ name: '20270 Event' }), '20270 Event', 'and so does a longer number');
  assert.equal(name({ name: '2027' }), '2027', 'a name that is only a year is kept');
  assert.equal(name({ name: 'Event 2027' }), 'Event 2027', 'only a year at the front goes');
  assert.equal(name({ name: '  Spaced  ' }), 'Spaced');
  assert.equal(name({}), '');
});

test('the status keeps the short name of an event, and a status that has none still reads', () => {
  const raw = { teams: [{ team: 'prime', events: [{ key: 'a', name: 'Full', shortName: ' Short ', startDate: '2027-03-01' }, { key: 'b', name: 'Other', startDate: '2027-03-08' }, { key: 'c', name: 'Third', shortName: 5, startDate: '2027-03-15' }] }], districtEvents: [{ key: 'd', name: 'State', shortName: 'St', startDate: '2027-04-01', championship: true }] };
  const frc = frcModule.tidyFrc(raw);

  assert.deepEqual(frc.teams[0].events.map(item => item.shortName), ['Short', '', ''], 'trimmed, empty when missing, and text only');
  assert.equal(frc.districtEvents[0].shortName, 'St');
  assert.equal(frcModule.tidyFrc(frc).teams[0].events[0].shortName, 'Short', 'cleaning twice changes nothing');
  assert.equal('shortName' in frcModule.tidyFrc({ teams: [] }), false);
});

test('a marker has the name and the city the legend writes, and the countdown is called by its label', () => {
  const content = eventsOf([event(3, { shortName: 'Short Three' }), event(4, { name: '2027 Four', city: '' })], raw => {
    raw.frc.districtEvents = [{ key: 'cmp', name: '2027 State Championship', city: 'Greensboro', startDate: '2027-06-01', endDate: '2027-06-02', championship: true }];
  });
  const markers = competition.timelineMarkers(content, frcModule.teamEntry(content.frc), noon('2026-10-09'));

  assert.deepEqual(markers.map(marker => [marker.kind, marker.name, marker.city]), [
    ['countdown', 'KICKOFF', ''], ['event', 'Short Three', 'City 3'], ['event', 'Four', ''], ['state', 'State Championship', 'Greensboro'],
  ]);
  assert.deepEqual(markers.map(marker => marker.label), ['KICKOFF', 'City 3', '2027 Four', 'STATE'], 'the label is what the line wrote before: the city, or the name when there is none');

  const noName = eventsOf([], raw => { raw.frc.districtEvents = [{ key: 'cmp', name: '', startDate: '2027-06-01', championship: true }]; });
  assert.equal(competition.timelineMarkers(noName, frcModule.teamEntry(noName.frc), noon('2026-10-09')).pop().name, 'STATE CHAMPIONSHIP', 'a championship with no name is called that');
});


// The line and the legend

test('the line has TODAY at the left dot and the label of the countdown over its dot, and nothing else is written on it', () => {
  const content = eventsOf([event(3), event(4)]);
  const html = timeline.markupFor(content, noon('2026-10-09'));
  const words = Array.from(html.matchAll(/<text x="(\d+)" y="(\d+)" class="(\w+)"(?: text-anchor="(\w+)")?>([^<]*)<\/text>/g)).map(match => [match[3], match[5]]);

  assert.deepEqual(words, [['label', 'TODAY'], ['number', '1'], ['label', 'KICKOFF'], ['number', '2'], ['number', '3']]);
  assert.equal(countOf(html, '<circle '), 4);
  assert.ok(html.includes('class="dot dot-countdown"'));
  assert.equal(countOf(html, 'class="number"'), 3);

  // the countdown label is centred over its dot, and clear of TODAY when the dot is near the left end
  const todayWidth = textWidthModule.textWidth('TODAY', 700, 44);
  const kickoff = textWidthModule.textWidth('KICKOFF', 700, 44);
  assert.equal(timeline.labelLeft(500, kickoff, todayWidth), Math.round(500 - kickoff / 2));
  assert.equal(timeline.labelLeft(100, kickoff, todayWidth), Math.round(todayWidth + 16), 'next to TODAY and not over it');
  assert.equal(timeline.labelLeft(1090, kickoff, todayWidth), Math.round(1096 - kickoff), 'and inside the body at the right');
  const near = timeline.markupFor(eventsOf([event(3)], raw => { raw.settings.countdown.kickoff = '2026-10-09T17:00:00.000Z'; }), noon('2026-10-09'));
  assert.ok(near.includes('>KICKOFF</text>'));
  assert.ok(Number(/<text x="(\d+)" y="\d+" class="label">KICKOFF<\/text>/.exec(near)[1]) >= todayWidth + 16, 'a countdown today is not drawn over TODAY');
});

test('the legend has a row for each dot: its number, the name, the city and the day, and the days left, and what editors typed is escaped', () => {
  const content = eventsOf([event(3, { shortName: '<b>Short</b>', city: '<i>Town</i>' }), event(4, { name: '2027 Four' })]);
  const html = timeline.markupFor(content, noon('2026-10-09'));

  assert.deepEqual(rowsOf(html, 'entry-number'), ['1', '2', '3']);
  assert.deepEqual(rowsOf(html, 'event'), ['KICKOFF', '&lt;b&gt;Short&lt;/b&gt;', 'Four']);
  assert.deepEqual(rowsOf(html, 'where'), ['JAN 9', '&lt;i&gt;Town&lt;/i&gt; · MAY 3', 'City 4 · MAY 4'], 'a date with no city is only the day');
  assert.deepEqual(rowsOf(html, 'days'), ['92 DAYS', '206 DAYS', '207 DAYS']);
  assert.equal(/<(b|i)>/.test(html), false);
  assert.equal(dashes.test(html), false);
  assert.equal(/style="/.test(html), false);
  assert.equal(countOf(html, 'class="entry"'), 3);

  assert.deepEqual(rowsOf(timeline.markupFor(eventsOf([event(3)]), noon('2027-05-03')), 'days'), ['NOW'], 'an event that is on says NOW');
  const one = eventsOf([event(3)], raw => { raw.settings.countdown.kickoff = '2027-05-02T17:00:00.000Z'; });
  assert.deepEqual(rowsOf(timeline.markupFor(one, noon('2027-05-01')), 'days'), ['1 DAY', '2 DAYS'], 'one day is not days');
});

test('there are six dots and six rows at the most, and a line says how many more events there are', () => {
  const crowded = eventsOf(Array.from({ length: 10 }, (nothing, index) => event(index + 3)));
  const html = timeline.markupFor(crowded, noon('2026-10-09'));

  assert.equal(countOf(html, 'class="entry"'), 6);
  assert.equal(countOf(html, 'class="number"'), 6);
  assert.deepEqual(rowsOf(html, 'entry-number'), ['1', '2', '3', '4', '5', '6']);
  assert.ok(html.includes('<div class="more">+5 more events</div>'), 'the countdown and ten events are eleven dates, and six are drawn');

  const seven = timeline.markupFor(eventsOf(Array.from({ length: 6 }, (nothing, index) => event(index + 3))), noon('2026-10-09'));
  assert.ok(seven.includes('<div class="more">+1 more event</div>'), 'one more is not events');
  const six = timeline.markupFor(eventsOf(Array.from({ length: 5 }, (nothing, index) => event(index + 3))), noon('2026-10-09'));
  assert.equal(six.includes('class="more"'), false, 'six are all of them');
  assert.equal(countOf(six, 'class="entry"'), 6);

  // the line ends at the sixth dot, and the dots are numbered in the order of their dates
  const places = Array.from(html.matchAll(/<circle class="dot[^"]*" cx="(\d+)"/g)).map(match => Number(match[1]));
  assert.equal(places.length, 7, 'today and six dates');
  assert.equal(places[places.length - 1], 1064);
  assert.ok(html.includes('<line class="axis" x1="32" y1="96" x2="1064" y2="96"/>'));
});

test('with no dates the card says one plain sentence, as it did', () => {
  // a date that has passed is no date, and an empty one is the starting one
  const none = eventsOf([], raw => { raw.settings.countdown.kickoff = '2026-01-09T17:00:00.000Z'; });
  assert.ok(timeline.markupFor(none, noon('2026-10-09')).includes('<p class="empty">No dates are coming up yet.</p>'));
  assert.ok(timeline.markupFor(contentWith(raw => { delete raw.frc; }), noon('2026-10-09')).includes('<p class="empty">No dates are coming up yet.</p>'), 'with no status at all');
  assert.equal(timeline.markupFor(none, noon('2026-10-09')).includes('class="legend"'), false);
});


// The sizes

function rulesOf(css) {
  const rules = {};
  Array.from(css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)).forEach(match => {
    match[1].split(',').forEach(selector => {
      const key = selector.trim();
      rules[key] = (rules[key] ? rules[key] + ' ' : '') + match[2];
    });
  });
  return rules;
}

const pixels = (rule, property) => Number(new RegExp('(?:^|[;\\s])' + property + ':\\s*(\\d+)px').exec(rule)[1]);
const fontOf = rule => {
  const found = /font:\s*(\d+)\s+(var\(--size-label\)|(\d+)px)\/(\d+)px\s+var\(--(font-[a-z]+)\)/.exec(rule);
  return { weight: Number(found[1]), size: found[3] ? Number(found[3]) : 44, line: Number(found[4]) };
};

test('the line and the legend fit the body of 1096 by 512, clear of the cut corner, and no text is under 44px but the city and the day', () => {
  const rules = rulesOf(read('panels/competition-timeline/panel.css'));
  const legendTop = pixels(rules['.competition-timeline .legend'], 'top');
  const row = pixels(rules['.competition-timeline .entry'], 'height');

  assert.equal(row, 52);
  assert.ok(legendTop + 6 * row <= pixels(rules['.competition-timeline .more'], 'top'), 'the line of more is under the sixth row');
  assert.ok(pixels(rules['.competition-timeline .more'], 'top') + fontOf(rules['.competition-timeline .more']).line <= 512, 'and inside the body');
  assert.ok(140 <= legendTop, 'the legend starts under the line, which is 140 high');
  assert.equal(pixels(rules['.competition-timeline .legend'], 'width'), 1096);

  // the line: a numbered dot is 60 wide with the number at 44px in it, and today's dot is smaller. Both are inside the strip.
  assert.ok(Math.round(44 * 0.72) < 60, 'the digits are shorter than the dot');
  const html = timeline.markupFor(eventsOf([event(3)]), noon('2026-10-09'));
  const radii = Array.from(html.matchAll(/r="(\d+)"/g)).map(match => Number(match[1]));
  assert.deepEqual(radii, [22, 30, 30]);
  assert.ok(96 - 30 >= 0 && 96 + 30 <= 140, 'the dots are inside the strip');
  assert.ok(50 <= 96 - 30, 'the words over the line are over the dots');
  const centres = Array.from(html.matchAll(/<circle class="dot[^"]*" cx="(\d+)"/g)).map(match => Number(match[1]));
  assert.ok(centres[0] - 22 >= 0 && centres[centres.length - 1] + 30 <= 1096, 'and so is the line');

  // the row: the number, the name, the city and the day, and the days, with the gaps, in 1096
  const gap = pixels(rules['.competition-timeline .entry'], 'gap');
  const number = pixels(rules['.competition-timeline .entry-number'], 'width');
  const where = pixels(rules['.competition-timeline .where'], 'max-width');
  const days = pixels(rules['.competition-timeline .days'], 'min-width');
  const name = 1096 - number - where - days - 3 * gap;
  assert.ok(name >= 390, 'the name has ' + name + 'px at least, which is 14 letters at 44px');
  assert.ok(days >= textWidthModule.textWidth('206 DAYS', 700, 44), 'the days left fit their column');
  assert.equal(fontOf(rules['.competition-timeline .event']).size, 44);
  assert.equal(fontOf(rules['.competition-timeline .where']).size, 36);
  assert.equal(fontOf(rules['.competition-timeline .days']).size, 44);
  assert.ok(/text-overflow: ellipsis/.test(rules['.competition-timeline .event']) && /white-space: nowrap/.test(rules['.competition-timeline .event']), 'the name is on one line and ends in an ellipsis');
  assert.ok(/color: var\(--lilac\)/.test(rules['.competition-timeline .where']), 'the city and the day are muted');
  assert.ok(/color: var\(--yellow\)/.test(rules['.competition-timeline .days']) && /text-align: right/.test(rules['.competition-timeline .days']), 'the days are in the accent and at the right');

  // the corner of the frame runs from (1148, 640) to (1068, 704): the body is 28 in and 136 down, so its last row ends at 136 + 512
  assert.ok(28 + 1096 <= 1148 - (136 + 512 - 640) * 80 / 64, 'the body stops before the cut corner');
});

test('no stylesheet or script of the card has an animation, and the card uses no dash', () => {
  const css = read('panels/competition-timeline/panel.css');
  const js = read('panels/competition-timeline/panel.js');

  assert.equal(/@keyframes|transition:|animation:|transform|box-shadow|text-shadow|filter|blur|background-image|url\(/.test(css), false);
  assert.equal(/setTimeout|setInterval|requestAnimationFrame|animate\(|@keyframes|transform|style="|font-size/.test(js), false);
  [css, js, read('core/frc.js'), read('core/competition.js')].forEach(text => assert.equal(dashes.test(text), false));
  Array.from(css.matchAll(/stroke-width:\s*([\d.]+)/g)).forEach(match => assert.ok(Number(match[1]) >= 3));
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
