// Tests for the competition cards (dashboard/core/frc.js, core/competition.js, core/competition-draw.js,
// core/competition-preview.js and the panels in dashboard/panels/competition-*). The plain functions are
// run for real. Each card is run against a fake host that keeps the markup it draws, and the stylesheets
// are checked by reading them, because the sizes need a browser to be seen. The competition data is made
// up: the sample in data/sample/content.json, changed here and there. The Studio side (the Competition tab,
// the connection block and the document type) is checked in studio/check-schemas.mjs.
//
//   node tools/test-competition.mjs

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
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-competition-'));
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

const cardNames = ['next-match', 'rank', 'results', 'alliance', 'timeline', 'district', 'last-season'];
const cardIds = cardNames.map(name => 'competition-' + name);
cardIds.forEach(id => {
  fs.mkdirSync(path.join(root, 'panels', id), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, 'panels', id, id + '.js'), path.join(root, 'panels', id, id + '.js'));
});

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const frcModule = await import(base + 'core/frc.js');
const competition = await import(base + 'core/competition.js');
const draw = await import(base + 'core/competition-draw.js');
const previewModule = await import(base + 'core/competition-preview.js');
const sanity = await import(base + 'core/sanity.js');
const contentModule = await import(base + 'core/content.js');
const teams = await import(base + 'core/teams.js');
const panels = {};
for (const name of cardNames) panels[name] = await import(base + 'panels/competition-' + name + '/competition-' + name + '.js');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const at = text => new Date(text); // always written with a Z, so it means the same on every computer
const sampleRaw = () => JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
const countOf = (text, piece) => text.split(piece).length - 1;
const primeOf = frc => frc.teams.find(team => team.team === 'prime');

// The sample content, cleaned as the screen cleans it. The countdown has a time with a Z, so it falls on the same
// day in every time zone. Anything else is changed by the function given, which is given the raw sample.
function contentWith(change) {
  const raw = sampleRaw();
  raw.settings.countdown = { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
  if (change) change(raw);
  return sanity.normalizeSample(raw);
}

// Noon in Holly Springs, in winter and in summer time, on a date
const noon = date => at(date + 'T17:00:00Z');

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

// Runs a check with the console quiet, and says what was written to it
function quietly(run) {
  const written = [];
  const before = console.error;
  console.error = (...args) => written.push(args.map(String).join(' '));
  try {
    run();
  } finally {
    console.error = before;
  }
  return written;
}

function hostFor(panel, content, now) {
  const host = { innerHTML: '' };
  if (now) host.innerHTML = panel.markupFor(content, now);
  else panel.mount(host, content);
  return host.innerHTML;
}

const idsOf = plan => plan.cards.map(id => id.replace('competition-', ''));


// The settings

test('the mode and the seven switches have their lists and starting values in config.js, and anything odd is the starting value', () => {
  assert.deepEqual(config.competitionModes, ['auto', 'always', 'off']);
  assert.deepEqual(config.competitionSwitches, ['competitionTimeline', 'competitionLastSeason', 'competitionRank', 'competitionNextMatch', 'competitionResults', 'competitionAlliance', 'competitionDistrict']);
  assert.equal(config.defaultSettings.competitionMode, 'auto');
  config.competitionSwitches.forEach(name => assert.equal(config.defaultSettings[name], true, name));
  assert.equal(config.competitionLeadDays, 2);
  assert.equal(config.competitionPreviewSeconds, 120);

  const empty = contentModule.withDefaults({}).settings;
  assert.equal(empty.competitionMode, 'auto');
  config.competitionSwitches.forEach(name => assert.equal(empty[name], true, name));

  ['always', 'off', 'auto'].forEach(mode => assert.equal(sanity.normalizeContent({ settings: { competitionMode: mode } }).settings.competitionMode, mode));
  [' auto', 'AUTO', 'never', 5, true, null, ['auto'], {}].forEach(mode => {
    assert.equal(sanity.normalizeContent({ settings: { competitionMode: mode } }).settings.competitionMode, 'auto', 'mode ' + JSON.stringify(mode));
    assert.equal(sanity.normalizeSample({ settings: { competitionMode: mode } }).settings.competitionMode, 'auto', 'sample mode ' + JSON.stringify(mode));
  });

  config.competitionSwitches.forEach(name => {
    assert.equal(sanity.normalizeContent({ settings: { [name]: false } }).settings[name], false, name + ' off');
    [undefined, null, 'no', 0, 1, {}].forEach(value => {
      assert.equal(sanity.normalizeContent({ settings: { [name]: value } }).settings[name], true, name + ' ' + JSON.stringify(value));
    });
  });
});

test('the screen asks Sanity for the frc-status document with the rest, and content has frc, null when there is none', () => {
  assert.ok(sanity.contentQuery.includes('"frc": *[_id == "frc-status"][0]'));
  assert.equal(contentModule.withDefaults({}).frc, null);
  assert.equal(sanity.normalizeContent({}).frc, null);
  assert.equal(sanity.normalizeSample({}).frc, null);
  assert.equal(sanity.normalizeContent({ frc: 'text' }).frc, null);

  const document = { _id: 'frc-status', _type: 'frcStatus', _rev: 'a', season: 2027, teams: [{ _key: 'k', team: 'prime', number: 3229 }] };
  const frc = sanity.normalizeContent({ frc: document }).frc;
  assert.equal(frc.season, 2027);
  assert.equal(frc.teams.length, 1);
  assert.equal(frc.teams[0].team, 'prime');
  assert.equal('_id' in frc || '_rev' in frc || '_key' in frc.teams[0], false, 'names that start with an underscore are left out');
});

// The data

test('tidyFrc gives a complete shape, keeps nothing it cannot use, caps the lists, and cleaning twice changes nothing', () => {
  assert.equal(frcModule.tidyFrc(null), null);
  assert.equal(frcModule.tidyFrc(undefined), null);
  assert.equal(frcModule.tidyFrc([]), null);
  assert.equal(frcModule.tidyFrc('x'), null);

  const bare = frcModule.tidyFrc({});
  assert.deepEqual(bare, { season: null, lastSyncAt: '', lastError: '', notes: [], districtEvents: [], teams: [] });

  const long = 'x'.repeat(500);
  const events = [];
  for (let day = 1; day <= 20; day++) events.push({ key: '2027ncsa' + day, name: 'Event ' + day, startDate: '2027-03-' + String(day).padStart(2, '0') });
  const messy = frcModule.tidyFrc({
    season: 'soon',
    lastSyncAt: 'not a time',
    lastError: long,
    notes: ['A note', '', 5, null, '  Another  ', 'c', 'd', 'e', 'f'],
    districtEvents: [{ key: 'a', startDate: '2027-04-01', championship: 'yes' }, { key: 'b', startDate: 'April' }, 7],
    teams: [
      { team: 'Prime', number: 3229, events: events, epa: 'high' },
      { team: 'bad code!', number: 1 },
      { number: 5 },
      null,
      { team: 'nova', number: '  3230 ', results: new Array(12).fill({ label: 'Q1', alliance: 'purple', scoreFor: '5', scoreAgainst: 4, won: 'yes' }) },
    ],
  });

  assert.equal(messy.season, null);
  assert.equal(messy.lastSyncAt, '');
  assert.equal(messy.lastError.length, 300);
  assert.deepEqual(messy.notes, ['A note', 'Another', 'c', 'd', 'e'], 'at most 5 notes, none empty');
  assert.deepEqual(messy.districtEvents, [{ key: 'a', name: '', city: '', startDate: '2027-04-01', endDate: '', championship: false }], 'an event with no first day is left out, and only true is a championship');
  assert.deepEqual(messy.teams.map(team => team.team), ['prime', 'nova'], 'a team needs a code of lowercase letters and digits');
  assert.equal(messy.teams[0].events.length, 12, 'at most 12 events');
  assert.equal(messy.teams[0].epa, null);
  assert.equal(messy.teams[1].number, '3230');
  assert.equal(messy.teams[1].results.length, 8, 'at most 8 results');
  assert.deepEqual(messy.teams[1].results[0], { match: '', label: 'Q1', alliance: '', scoreFor: null, scoreAgainst: 4, won: null });
  assert.equal(messy.teams[1].nextMatch, null);
  assert.equal(messy.teams[1].ranking, null);
  assert.equal(messy.teams[1].alliance, null);
  assert.equal(messy.teams[1].districtPoints, null);
  assert.equal(messy.teams[1].lastSeason, null);

  assert.deepEqual(frcModule.tidyFrc(messy), messy);
  const sample = sanity.normalizeSample(sampleRaw()).frc;
  assert.deepEqual(frcModule.tidyFrc(sample), sample, 'the sample is already clean');
});

test('tidyFrc reads a match, a ranking, an alliance and the district points, and leaves out what has no number', () => {
  const frc = frcModule.tidyFrc({
    teams: [{
      team: 'prime',
      number: 3229,
      nextMatch: {
        label: 'Q5', level: 'qm', number: 5, time: '2027-03-12T19:45:00Z', alliance: 'blue', redWinProbability: 1.4,
        red: [{ number: 9001, nickname: '<b>Red</b>', epa: 20 }, { nickname: 'No number' }, { number: '[1111]' }],
        blue: [],
      },
      ranking: { event: 'e', rank: 'first', rankingPoints: 2 },
      alliance: { event: 'e', picks: [{ number: 3229 }] },
      districtPoints: { total: 'many', rank: 3, cutoff: 60 },
    }],
  });
  const entry = frc.teams[0];

  assert.equal(entry.nextMatch.redWinProbability, 1, 'a chance is between 0 and 1');
  assert.equal(frcModule.tidyFrc({ teams: [{ team: 'a', nextMatch: { redWinProbability: -3 } }] }).teams[0].nextMatch.redWinProbability, 0);
  assert.equal(frcModule.tidyFrc({ teams: [{ team: 'a', nextMatch: { redWinProbability: 'high' } }] }).teams[0].nextMatch.redWinProbability, null);
  assert.deepEqual(entry.nextMatch.red, [{ number: '9001', nickname: '<b>Red</b>', epa: 20 }, { number: '[1111]', nickname: '', epa: null }], 'a team needs a number, which may be text such as [1111]');
  assert.equal(entry.nextMatch.time, '2027-03-12T19:45:00Z');
  assert.equal(entry.ranking, null, 'a ranking needs a rank that is a number');
  assert.deepEqual(entry.alliance, { event: 'e', number: null, picks: [{ number: '3229', nickname: '', epa: null }] }, 'a selection that did not pick the team has no number');
  assert.equal(entry.districtPoints, null, 'district points need a total that is a number');
});

test('the sample content has frc data with made up numbers in brackets, a team entry for each team, and normalizeContent and normalizeSample carry it', () => {
  const sample = sampleRaw();
  assert.equal(sample.frc.sample, true);
  assert.deepEqual(sample.frc.teams.map(team => team.team), ['prime', 'nova']);
  assert.equal(sample.settings.competitionMode, 'auto');
  config.competitionSwitches.forEach(name => assert.equal(sample.settings[name], true, name));

  // every team number that is not one of the two teams of the sample is written in brackets
  const people = [];
  sample.frc.teams.forEach(team => {
    [team.nextMatch, team.alliance].filter(Boolean).forEach(part => ['red', 'blue', 'picks'].forEach(name => (part[name] || []).forEach(person => people.push(person))));
  });
  assert.ok(people.length >= 15);
  people.filter(person => ![3229, 3230].includes(person.number)).forEach(person => assert.ok(/^\[\d+\]$/.test(person.number), 'team number ' + person.number));
  people.forEach(person => assert.ok([3229, 3230].includes(person.number) || /^\[.*\]$/.test(person.nickname), 'nickname ' + person.nickname));

  const content = sanity.normalizeSample(sample);
  assert.equal(content.frc.sample, true);
  assert.equal(primeOf(content.frc).nextMatch.red[1].number, '[1121]');
  assert.equal(primeOf(content.frc).lastSeason.events.length, 3);
  assert.ok(Object.keys(content).includes('frc'));
});

test('dates are plain text and the helpers are the same on every computer', () => {
  assert.equal(frcModule.addDays('2027-03-12', 2), '2027-03-14');
  assert.equal(frcModule.addDays('2027-03-12', -2), '2027-03-10');
  assert.equal(frcModule.addDays('2027-03-01', -1), '2027-02-28');
  assert.equal(frcModule.addDays('2027-12-31', 1), '2028-01-01');
  assert.equal(frcModule.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(frcModule.daysFromTo('2026-10-09', '2027-01-09'), 92);
  assert.equal(frcModule.daysFromTo('2027-03-12', '2027-03-12'), 0);
  assert.equal(frcModule.daysFromTo('2027-03-14', '2027-03-12'), -2);
  assert.equal(frcModule.daysFromTo('2027-03-13', '2027-03-15'), 2, 'a change of clock does not make a day 23 or 25 hours');
  assert.equal(frcModule.shortDate('2027-03-12'), 'MAR 12');
  assert.equal(frcModule.shortDate('2027-12-05'), 'DEC 5');
  assert.equal(frcModule.shortDate('soon'), '');
  assert.equal(frcModule.weekdayName('2027-03-12'), 'FRI');
  assert.equal(frcModule.weekdayName('2027-03-13'), 'SAT');
  assert.equal(frcModule.weekdayName('x'), '');
  assert.equal(frcModule.recordText({ wins: 5, losses: 2, ties: 0 }), '5-2-0');
  assert.equal(frcModule.recordText({ wins: 5, losses: null, ties: null }), '5-?-?');
  assert.equal(frcModule.recordText(null), '');
});

// Which cards are due

// The cards due on a day in Auto, for the first team, with the sample's events: the first one on 2027-03-11 to 13, the second
// on 2027-04-01 to 03 and the state championship on 2027-04-14 to 17. The window of an event opens two days before.
const dueByDay = [
  ['2026-10-09', 'long before the season: the timeline, and last season', ['timeline', 'last-season'], false],
  ['2027-01-08', 'the day before Kickoff', ['timeline', 'last-season'], false],
  ['2027-01-10', 'after Kickoff, with no Rollout date', ['timeline', 'last-season'], false],
  ['2027-03-08', 'three days before the first event', ['timeline', 'last-season'], false],
  ['2027-03-09', 'two days before the first event: the cards of an event come in', ['next-match', 'rank', 'results', 'alliance', 'timeline', 'last-season'], false],
  ['2027-03-10', 'the day before the first event', ['next-match', 'rank', 'results', 'alliance', 'timeline', 'last-season'], false],
  ['2027-03-11', 'the first day of the first event: last season goes, district points come, and the cards take priority', ['next-match', 'rank', 'results', 'alliance', 'timeline', 'district'], true],
  ['2027-03-12', 'the middle of the event', ['next-match', 'rank', 'results', 'alliance', 'timeline', 'district'], true],
  ['2027-03-13', 'the last day of the event', ['next-match', 'rank', 'results', 'alliance', 'timeline', 'district'], true],
  ['2027-03-14', 'the day after: only the cards of the whole season', ['timeline', 'district'], false],
  ['2027-03-29', 'three days before the second event', ['timeline', 'district'], false],
  ['2027-03-30', 'two days before the second event', ['next-match', 'rank', 'results', 'alliance', 'timeline', 'district'], false],
  ['2027-04-01', 'the second event', ['next-match', 'rank', 'results', 'alliance', 'timeline', 'district'], true],
  ['2027-04-04', 'after the second event', ['timeline', 'district'], false],
  ['2027-04-17', 'the last day of the state championship, which is on the timeline', ['timeline', 'district'], false],
  ['2027-04-18', 'after the whole season: the timeline has no date left', ['district'], false],
];

test('Auto: the cards due on each day of the season, with the next match first and priority only on the days of an event', () => {
  const content = contentWith();
  dueByDay.forEach(entry => {
    const plan = competition.competitionPlan(content, noon(entry[0]));
    assert.deepEqual(idsOf(plan), entry[2], entry[0] + ', ' + entry[1]);
    assert.equal(plan.priority, entry[3], entry[0] + ' priority');
    assert.deepEqual(competition.dueCards(content, noon(entry[0])), plan.cards);
  });
  assert.deepEqual(competition.cards.map(card => card.id), cardIds, 'the cards are listed in the order of priority');
});

test('the window follows the date in the time zone of the Look page, not the computer', () => {
  const content = contentWith();
  // 2027-03-09 at 02:00 in Holly Springs is 07:00 in Z. At 01:00 Z it is still 03-08 there, and the window is not open.
  assert.deepEqual(idsOf(competition.competitionPlan(content, at('2027-03-09T07:30:00Z'))), ['next-match', 'rank', 'results', 'alliance', 'timeline', 'last-season']);
  assert.deepEqual(idsOf(competition.competitionPlan(content, at('2027-03-09T03:00:00Z'))), ['timeline', 'last-season']);
  // 2027-03-13 at 23:30 in Holly Springs is 04:30 Z on the 14th: still the last day of the event
  assert.equal(competition.competitionPlan(content, at('2027-03-14T04:30:00Z')).priority, true);
  assert.equal(competition.competitionPlan(content, at('2027-03-14T05:30:00Z')).priority, false);

  const west = contentWith(raw => { raw.theme.timeZone = 'America/Los_Angeles'; });
  assert.equal(competition.todayOf(west, at('2027-03-12T05:00:00Z')), '2027-03-11');
  assert.equal(competition.competitionPlan(west, at('2027-03-12T05:00:00Z')).priority, true, 'the first day there');
  assert.equal(competition.todayOf(contentWith(raw => { raw.theme.timeZone = 'Not/AZone'; }), at('2027-03-12T05:00:00Z')), '2027-03-12', 'a zone that does not exist is the one of config.js');
});

test('Always shows every card with something to show whatever the date, Off shows none, and a switch takes its card out', () => {
  const always = contentWith(raw => { raw.settings.competitionMode = 'always'; });
  assert.deepEqual(idsOf(competition.competitionPlan(always, noon('2026-10-09'))), cardNames, 'in October, all seven');
  assert.equal(competition.competitionPlan(always, noon('2026-10-09')).priority, false);
  assert.equal(competition.competitionPlan(always, noon('2027-03-12')).priority, true, 'the cards still take turns with the panels on the days of an event');
  assert.deepEqual(idsOf(competition.competitionPlan(always, noon('2027-04-18'))), cardNames.filter(name => name !== 'timeline'), 'the timeline has no date left, so it has nothing to show');

  const off = contentWith(raw => { raw.settings.competitionMode = 'off'; });
  ['2026-10-09', '2027-03-12'].forEach(date => assert.deepEqual(competition.competitionPlan(off, noon(date)), { cards: [], priority: false }, 'off on ' + date));

  config.competitionSwitches.forEach((name, index) => {
    const content = contentWith(raw => { raw.settings.competitionMode = 'always'; raw.settings[name] = false; });
    const left = idsOf(competition.competitionPlan(content, noon('2027-03-12')));
    assert.equal(left.length, 6, name);
    assert.ok(!left.includes(competition.cards.find(card => card.setting === name).id.replace('competition-', '')), name + ' is off');
  });
  const allOff = contentWith(raw => { config.competitionSwitches.forEach(name => { raw.settings[name] = false; }); });
  assert.deepEqual(competition.competitionPlan(allOff, noon('2027-03-12')), { cards: [], priority: false });
});

test('a card with nothing to show is not due, in Auto and in Always', () => {
  const without = (name, change) => ['auto', 'always'].forEach(mode => {
    const content = contentWith(raw => { raw.settings.competitionMode = mode; change(primeOf(raw.frc)); });
    assert.ok(!idsOf(competition.competitionPlan(content, noon('2027-03-12'))).includes(name), name + ' in ' + mode);
  });
  without('next-match', entry => { delete entry.nextMatch; });
  without('rank', entry => { delete entry.ranking; });
  without('results', entry => { entry.results = []; });
  without('alliance', entry => { delete entry.alliance; });
  without('district', entry => { delete entry.districtPoints; });
  without('last-season', entry => { delete entry.lastSeason; });

  // every card gone leaves only the timeline, and the rotation is unchanged
  const bare = contentWith(raw => {
    const entry = primeOf(raw.frc);
    ['nextMatch', 'ranking', 'alliance', 'districtPoints', 'lastSeason'].forEach(name => { delete entry[name]; });
    entry.results = [];
  });
  assert.deepEqual(idsOf(competition.competitionPlan(bare, noon('2027-03-12'))), ['timeline']);
  assert.equal(competition.competitionPlan(bare, noon('2027-03-12')).priority, true);
});

test('no frc data, a team the Mini did not read, or a problem with the data gives no cards and never throws', () => {
  const none = { cards: [], priority: false };
  assert.deepEqual(competition.competitionPlan(contentWith(raw => { delete raw.frc; }), noon('2027-03-12')), none);
  assert.deepEqual(competition.competitionPlan({}, noon('2027-03-12')), none);
  assert.deepEqual(competition.competitionPlan(null, noon('2027-03-12')), none);
  assert.deepEqual(competition.competitionPlan({ frc: { teams: [] } }, noon('2027-03-12')), none);
  assert.deepEqual(competition.competitionPlan(contentWith(raw => { raw.frc.teams = raw.frc.teams.filter(team => team.team !== 'prime'); }), noon('2027-03-12')), none, 'Prime has no entry');

  // content with no settings uses the starting values: Auto, every card on
  const bare = { frc: contentWith().frc };
  assert.deepEqual(idsOf(competition.competitionPlan(bare, noon('2026-10-09'))), ['timeline', 'last-season']);
  // a mode that is not one is Auto
  const odd = contentWith(); odd.settings.competitionMode = 'sometimes';
  assert.deepEqual(idsOf(competition.competitionPlan(odd, noon('2026-10-09'))), ['timeline', 'last-season']);
});

test('the cards are for the team on the screen: Nova has its own entry, and a team with none has no cards', () => {
  const content = contentWith();
  const day = noon('2027-03-12');
  const prime = ['next-match', 'rank', 'results', 'alliance', 'timeline', 'district'];

  assert.deepEqual(idsOf(competition.competitionPlan(content, day)), prime);
  onTeamScreen('nova', () => {
    assert.deepEqual(idsOf(competition.competitionPlan(content, day)), ['next-match', 'rank', 'results', 'timeline', 'district'], 'Nova has no alliance and no last season');
    assert.equal(frcModule.teamEntry(content.frc).number, '3230');
    assert.ok(panels.rank.markupFor(content, day).includes('class="rank">11</text>'), 'and the cards draw Nova\'s rank');
  });
  assert.deepEqual(idsOf(competition.competitionPlan(content, day)), prime, 'and Prime again after');
  assert.equal(frcModule.teamEntry(content.frc).number, '3229');

  // a team that the Mini did not read has no entry, and no cards
  const novaOnly = contentWith(raw => { raw.frc.teams = raw.frc.teams.filter(team => team.team === 'nova'); });
  assert.deepEqual(competition.competitionPlan(novaOnly, day), { cards: [], priority: false });
  onTeamScreen('nova', () => assert.equal(competition.competitionPlan(novaOnly, day).cards.length, 5));

  // an entry for both teams, with no team, would be judged like every other list; the Mini always writes a team
  assert.equal(frcModule.teamEntry(null), null);
  assert.equal(frcModule.teamEntry({}), null);
  assert.equal(frcModule.teamEntry({ teams: [] }), null);
});

test('the season timeline has the countdown date, the events that are not over and the state championship, earliest first, seven at most', () => {
  const content = contentWith();
  const entry = frcModule.teamEntry(content.frc);
  const summary = markers => markers.map(marker => [marker.kind, marker.label, marker.days, marker.now].join(' '));

  assert.deepEqual(summary(competition.timelineMarkers(content, entry, noon('2026-10-09'))), [
    'countdown KICKOFF 92 false', 'event [City A] 153 false', 'event [City B] 174 false', 'state STATE 187 false',
  ]);
  assert.deepEqual(summary(competition.timelineMarkers(content, entry, noon('2027-03-12'))), ['event [City A] 0 true', 'event [City B] 20 false', 'state STATE 33 false'], 'an event that is on has 0 days and is now');
  assert.deepEqual(summary(competition.timelineMarkers(content, entry, noon('2027-03-14'))), ['event [City B] 18 false', 'state STATE 31 false'], 'an event that is over has gone');
  assert.deepEqual(competition.timelineMarkers(content, entry, noon('2027-04-18')), []);

  // Kickoff on the day is now, and after it the Rollout date is next
  const rollout = contentWith(raw => { raw.settings.countdown.rollout = '2027-01-30T17:00:00.000Z'; });
  assert.deepEqual(summary(competition.timelineMarkers(rollout, entry, noon('2027-01-09'))).slice(0, 2), ['countdown KICKOFF 0 true', 'event [City A] 61 false'], 'only the next date of the countdown is on the line');
  assert.deepEqual(summary(competition.timelineMarkers(rollout, entry, noon('2027-01-10'))).slice(0, 1), ['countdown ROLLOUT 20 false']);
  assert.equal(competition.timelineMarkers(contentWith(raw => { raw.settings.countdown.kickoffLabel = 'LIFTOFF'; }), entry, noon('2026-10-09'))[0].label, 'LIFTOFF');

  // the state championship is not listed twice when it is one of the team's own events, and at most seven are drawn
  const shared = contentWith(raw => { primeOf(raw.frc).events.push({ key: '2027nccmp', name: '[State championship]', city: '[City C]', startDate: '2027-04-14', endDate: '2027-04-17' }); });
  assert.equal(competition.timelineMarkers(shared, frcModule.teamEntry(shared.frc), noon('2026-10-09')).filter(marker => marker.date === '2027-04-14').length, 1);
  const crowded = contentWith(raw => {
    for (let number = 3; number <= 12; number++) primeOf(raw.frc).events.push({ key: '2027x' + number, name: 'Event ' + number, startDate: '2027-05-' + String(number).padStart(2, '0'), endDate: '2027-05-' + String(number).padStart(2, '0') });
  });
  const many = competition.timelineMarkers(crowded, frcModule.teamEntry(crowded.frc), noon('2026-10-09'));
  assert.equal(many.length, competition.timelineDates);
  assert.equal(competition.timelineDates, 7);
  assert.deepEqual(many.map(marker => marker.date), many.map(marker => marker.date).slice().sort());
});

// The rotation

test('mixIn: on the days of an event a card and a panel take turns, otherwise the cards are spread through the panels', () => {
  const panelsList = 'ABCDEFGHIJ'.split('').map(panel => ({ panel: panel }));
  const steps = ['x', 'y', 'z'].map(panel => ({ panel: panel }));
  const names = list => list.map(step => step.panel).join('');

  assert.equal(names(competition.mixIn(panelsList, steps, true)), 'xAyBzCDEFGHIJ');
  assert.equal(names(competition.mixIn(panelsList, steps, false)), 'ABCxDEyFGHzIJ');
  assert.equal(names(competition.mixIn(panelsList.slice(0, 1), steps, true)), 'xAyz');
  assert.equal(names(competition.mixIn(panelsList.slice(0, 2), steps, false)), 'AxyBz');
  assert.equal(names(competition.mixIn([], steps, true)), 'xyz');
  assert.equal(names(competition.mixIn([], steps, false)), 'xyz');
  assert.equal(competition.mixIn(panelsList, [], true), panelsList, 'no cards leaves the list as it is');
  assert.equal(competition.mixIn(panelsList, [], false), panelsList);

  // each panel and each card once, and the panels in their own order
  [true, false].forEach(priority => {
    for (let panelCount = 0; panelCount <= 12; panelCount++) {
      for (let cardCount = 1; cardCount <= 7; cardCount++) {
        const mixed = competition.mixIn(panelsList.concat(panelsList).slice(0, panelCount), steps.concat(steps, steps).slice(0, cardCount), priority);
        assert.equal(mixed.length, panelCount + cardCount);
        assert.equal(names(mixed).replace(/[xyz]/g, ''), names(panelsList.concat(panelsList).slice(0, panelCount)));
      }
    }
  });
});

test('withCompetition puts the due cards in the list of the large panel, and a problem with the data leaves the list alone', () => {
  const playlist = 'ABCDEFGHIJ'.split('').map(panel => ({ panel: panel, show: true }));
  const names = list => list.map(step => step.panel).join(' ');

  const event = competition.withCompetition(playlist, contentWith(), noon('2027-03-12'));
  assert.equal(names(event), 'competition-next-match A competition-rank B competition-results C competition-alliance D competition-timeline E competition-district F G H I J');
  event.filter(step => step.panel.startsWith('competition-')).forEach(step => assert.deepEqual(step, { panel: step.panel, show: true }, 'a card has no seconds of its own, so it follows Seconds per page'));

  assert.equal(names(competition.withCompetition(playlist, contentWith(), noon('2026-10-09'))), 'A B C competition-timeline D E F G competition-last-season H I J', 'out of an event the cards are spread through the panels');
  assert.equal(names(competition.withCompetition(playlist, contentWith(raw => { raw.settings.competitionMode = 'off'; }), noon('2027-03-12'))), 'A B C D E F G H I J');
  assert.equal(competition.withCompetition(playlist, {}, noon('2027-03-12')), playlist, 'no data is the same list');

  // data that was not cleaned and cannot be read: the list comes back, and the console hears of it once
  const broken = { settings: contentWith().settings, frc: { teams: [{ team: 'prime', events: null }] } };
  const written = quietly(() => {
    assert.equal(competition.withCompetition(playlist, broken, noon('2027-03-12')), playlist);
    assert.equal(competition.withCompetition(playlist, broken, noon('2027-03-12')), playlist);
  });
  assert.equal(written.length, 1, 'once');
});

test('Preview competition shows every card in order of priority on the sample data, each for an equal share, and then lets go', () => {
  const content = contentWith(raw => { delete raw.frc; });
  const sample = contentWith().frc;
  const playlist = [{ panel: 'tasks', show: true }];
  const start = noon('2026-10-09');
  const until = start.getTime() + config.competitionPreviewSeconds * 1000;

  assert.equal(competition.previewIsOn(start), false);
  competition.previewCompetition(sample, until);
  try {
    assert.equal(competition.previewIsOn(start), true);
    assert.equal(competition.frcOf(content, start), sample, 'the cards draw the preview data, not the content');
    const steps = competition.withCompetition(playlist, content, start);
    assert.deepEqual(steps.map(step => step.panel), cardIds, 'every card, whatever the mode, the switches and the date');
    assert.ok(steps.every(step => step.show === true && step.seconds === 17), '120 seconds shared by 7 is 17');
    assert.ok(steps.length * steps[0].seconds <= config.competitionPreviewSeconds);

    const off = contentWith(raw => { raw.settings.competitionMode = 'off'; config.competitionSwitches.forEach(name => { raw.settings[name] = false; }); });
    assert.equal(competition.withCompetition(playlist, off, start).length, 7, 'a preview is asked for, so the settings do not stop it');
    assert.equal(competition.previewIsOn(new Date(until)), false, 'it ends at its time');
    assert.deepEqual(competition.withCompetition(playlist, content, new Date(until)), playlist);
  } finally {
    competition.previewCompetition(null, 0);
  }
  assert.equal(competition.previewIsOn(start), false);
  assert.equal(competition.frcOf(content, start), null);
  competition.previewCompetition(sample, 'soon');
  assert.equal(competition.previewIsOn(start), false, 'a time that is not a time is no preview');
  competition.previewCompetition(null, until);
  assert.equal(competition.previewIsOn(start), false, 'no data is no preview');
});

// The cards

// The page of each card, drawn from the sample at noon on the second day of the first event
const eventDay = noon('2027-03-12');

test('the next match: its number and time, three teams on each side with their EPA, the side the team is on, and the win chance as one bar', () => {
  const html = panels['next-match'].markupFor(contentWith(), eventDay);

  assert.ok(html.includes('<h2 class="title" data-slat="title">MATCH</h2>'));
  assert.ok(html.includes('<span class="tag-text">SAMPLE</span>'), 'sample data says so in the header');
  assert.ok(html.includes('>SF2-1</text>') && html.includes('>SAT 2:45 PM</text>'), 'the match is on the next day, so its time has the weekday');
  assert.ok(html.includes('>RED: OUR SIDE</text>') && html.includes('>BLUE</text>'), 'the head of the column the team is in says so');
  ['3229', '[1121]', '[1122]', '[1131]', '[1132]', '[1133]'].forEach(number => assert.ok(html.includes('>' + number + '</text>'), number));
  ['31.2', '28.4', '24.9', '33.6', '27', '22.3'].forEach(epa => assert.ok(html.includes('class="epa" text-anchor="end">' + epa + '</text>'), 'EPA ' + epa));
  assert.equal(countOf(html, 'class="ours"'), 1, 'one row, the team on the screen, has a line round it');
  assert.ok(html.includes('>RED 58%</text>') && html.includes('>BLUE 42%</text>'));
  assert.ok(html.includes('class="share share-red" x="0" y="462" width="636" height="46"') && html.includes('class="share share-blue" x="636" y="462" width="460" height="46"'), 'red is 58 percent of 1096');

  // a match today shows the time alone, and Nova sees its own match
  const today = panels['next-match'].markupFor(contentWith(), at('2027-03-13T17:00:00Z'));
  assert.ok(today.includes('>2:45 PM</text>') && !today.includes('SAT 2:45 PM'));
  onTeamScreen('nova', () => {
    const nova = hostFor(panels['next-match'], contentWith());
    assert.ok(nova.includes('>Q13</text>') && nova.includes('>BLUE: OUR SIDE</text>') && nova.includes('>[1151]</text>'));
    assert.ok(nova.includes('>RED 49%</text>') && nova.includes('>BLUE 51%</text>'), 'the two numbers add up to 100');
  });
});

test('the next match without a win chance says so in a sentence, without a time or a side has neither, and a nickname that is too long is cut', () => {
  const content = contentWith(raw => {
    const match = primeOf(raw.frc).nextMatch;
    delete match.redWinProbability;
    delete match.time;
    delete match.alliance;
    match.red[2] = { number: '[1122]', nickname: '[A long nickname here]' };
    match.red[0] = { number: 3229, nickname: '[Nickname]' };
    delete primeOf(raw.frc).epa;
  });
  const html = panels['next-match'].markupFor(content, eventDay);

  assert.ok(html.includes('No win chance for this match yet.'));
  assert.equal(countOf(html, 'class="share '), 0, 'no bar');
  assert.equal(countOf(html, 'class="when"'), 0);
  assert.equal(countOf(html, 'OUR SIDE'), 0);
  assert.ok(html.includes('>[A long nickname…</text>'), 'a nickname is cut at 18 characters');
  assert.ok(html.includes('>[Nickname]</text>'));
});

test('the live rank: the rank as the big number, how many are ranked, the record and the ranking points, and a dash for what the Mini did not find', () => {
  const html = panels.rank.markupFor(contentWith(), eventDay);
  assert.ok(html.includes('<h2 class="title" data-slat="title">RANK</h2>'));
  assert.ok(html.includes('class="rank">4</text>') && html.includes('>OF 36</text>'));
  assert.ok(html.includes('class="stat">8-4-0</text>') && html.includes('class="stat">2.1</text>'));
  assert.ok(html.includes('>RANKING POINTS</text>') && html.includes('>[District event one]</text>'), 'and the event it is from');

  const partial = contentWith(raw => { const ranking = primeOf(raw.frc).ranking; delete ranking.record; delete ranking.rankingPoints; delete ranking.teamsRanked; });
  const dashes = panels.rank.markupFor(partial, eventDay);
  assert.ok(dashes.includes('class="stat">-</text>') && countOf(dashes, 'class="stat">-</text>') === 2);
  assert.ok(dashes.includes('class="rank">4</text>') && !dashes.includes('class="of"'), 'no OF without the number of teams');
});

test('the results strip: eight chips in the colour of the alliance, the score, a tick for a win, TIE for a tie, a dimmer chip for a loss, and the tally', () => {
  const html = panels.results.markupFor(contentWith(), eventDay);

  assert.equal(countOf(html, '<rect class="chip '), 8);
  assert.equal(countOf(html, 'class="chip chip-red'), 5);
  assert.equal(countOf(html, 'class="chip chip-blue'), 3);
  assert.equal(Array.from(html.matchAll(/class="chip chip-[a-z]+ lost"/g)).length, 2, 'two lost matches are dimmer');
  assert.equal(countOf(html, 'class="check"'), 5, 'a tick for each win');
  assert.equal(countOf(html, '>TIE</text>'), 1);
  assert.ok(html.includes('class="chip-score" text-anchor="middle">71</text>') && html.includes('class="chip-against" text-anchor="middle">vs 58</text>'));
  assert.equal(countOf(html, '>75</text>') + countOf(html, '>vs 75</text>'), 2, 'a tie is the same score twice');
  assert.ok(html.includes('>5 WON   2 LOST   1 TIED</text>'));
  assert.ok(html.indexOf('>Q7</text>') < html.indexOf('>Q12</text>') && html.indexOf('>Q12</text>') < html.indexOf('>QF3-2</text>'), 'oldest first');

  // the chips are in two rows of four, 256 wide, 24 apart, which is the 1096 of the body
  const places = Array.from(html.matchAll(/<rect class="chip [^"]*" x="(\d+)" y="(\d+)" width="256" height="200"/g)).map(match => match[1] + ',' + match[2]);
  assert.deepEqual(places, ['0,0', '280,0', '560,0', '840,0', '0,224', '280,224', '560,224', '840,224']);
  assert.equal(3 * 24 + 4 * 256, 1096);

  // fewer than eight, a team with no colour, and a score the Mini did not find
  const few = contentWith(raw => { primeOf(raw.frc).results = [{ label: 'Q1', alliance: '', scoreFor: 40 }, { label: 'Q2', alliance: 'blue', scoreFor: 30, scoreAgainst: 20, won: true }]; });
  const small = panels.results.markupFor(few, eventDay);
  assert.equal(countOf(small, '<rect class="chip '), 2);
  assert.ok(small.includes('chip-none') && small.includes('>40</text>') && small.includes('>vs -</text>'));
  assert.ok(small.includes('>1 WON   0 LOST   1 TIED</text>'), 'a match with no winner known counts as a tie');
});

test('the alliance board: the number, the teams on it with the team on the screen marked, and the event', () => {
  const html = panels.alliance.markupFor(contentWith(), eventDay);
  assert.ok(html.includes('<h2 class="title" data-slat="title">ALLIANCE</h2>'));
  assert.ok(html.includes('class="number">3</text>') && html.includes('>[District event one]</text>'));
  ['3229', '[1121]', '[1122]'].forEach(number => assert.ok(html.includes('class="team">' + number + '</text>'), number));
  assert.equal(countOf(html, 'class="ours"'), 1);
  assert.ok(html.includes('class="epa" text-anchor="end">31.2</text>'));
  const own = panels.alliance.markupFor(contentWith(raw => { delete primeOf(raw.frc).alliance.picks[0].epa; }), eventDay);
  assert.ok(own.includes('class="epa" text-anchor="end">31.2</text>'), 'the team on the screen has its own EPA from its entry when the Mini wrote none beside it');
  assert.equal(countOf(own, 'class="epa"'), 3);

  const four = contentWith(raw => { const picks = primeOf(raw.frc).alliance.picks; for (let n = 0; n < 4; n++) picks.push({ number: '[' + (2000 + n) + ']', nickname: '[Spare]' }); });
  assert.equal(countOf(panels.alliance.markupFor(four, eventDay), 'class="team">'), 4, 'four rows at most');
});

test('the district points: the total, the rank and a bar to the cutoff, with the points to go, and no bar until the cutoff is known', () => {
  const html = panels.district.markupFor(contentWith(), eventDay);
  assert.ok(html.includes('<h2 class="title" data-slat="title">DISTRICT</h2>'));
  assert.ok(html.includes('class="total">47</text>') && html.includes('>RANK 5</text>'));
  assert.ok(html.includes('class="lane" x="0" y="290" width="1096" height="64"') && html.includes('class="fill" x="6" y="296" width="849" height="52"'), '47 of 60 of the 1084 inside the lane');
  assert.ok(html.includes('>13 TO GO</text>') && html.includes('>CUTOFF 60</text>'));

  const standing = total => panels.district.markupFor(contentWith(raw => { primeOf(raw.frc).districtPoints.total = total; }), eventDay);
  assert.ok(standing(60).includes('>AT THE CUTOFF</text>') && standing(60).includes('width="1084" height="52"'));
  assert.ok(standing(75).includes('>ABOVE THE CUTOFF</text>') && standing(75).includes('width="1084" height="52"'), 'the bar stops at full');
  assert.ok(standing(0).includes('width="0" height="52"') && standing(0).includes('>60 TO GO</text>'));
  assert.ok(standing(47.5).includes('>12.5 TO GO</text>'));

  const unknown = panels.district.markupFor(contentWith(raw => { delete primeOf(raw.frc).districtPoints.cutoff; delete primeOf(raw.frc).districtPoints.rank; }), eventDay);
  assert.ok(unknown.includes('The cutoff is not known yet.'));
  assert.equal(countOf(unknown, 'class="lane"') + countOf(unknown, 'class="fill"') + countOf(unknown, 'RANK '), 0);
  assert.ok(unknown.includes('class="total">47</text>'));
});

test('the season timeline: the dots, the days left, the names, and spacing that keeps the words apart', () => {
  const html = panels.timeline.markupFor(contentWith(), eventDay);
  assert.ok(html.includes('<h2 class="title" data-slat="title">SEASON</h2>'));
  assert.equal(countOf(html, '<circle '), 4, 'today and three dates');
  assert.ok(html.includes('class="dot dot-today"') && html.includes('class="dot dot-event on"') && html.includes('class="dot dot-state"'));
  ['TODAY', 'MAR 12', 'NOW', '[City A]', '20 DAYS', '[City B]', '33 DAYS', 'STATE'].forEach(word => assert.ok(html.includes('>' + word + '</text>'), word));

  const places = Array.from(html.matchAll(/<circle class="dot[^"]*" cx="(\d+)"/g)).map(match => Number(match[1]));
  assert.equal(places[0], 124, 'today is at the left end');
  assert.equal(places[places.length - 1], 972, 'the last date is at the right end');
  places.slice(1).forEach((place, index) => assert.ok(place - places[index] >= 120, 'dots ' + index + ' and ' + (index + 1) + ' are 120 apart or more'));
  assert.ok(html.includes('<line class="axis" x1="124" y1="256" x2="972" y2="256"/>'));

  // the dots are as far along as their dates, until they would be too close
  assert.deepEqual(panelsDots([0, 50, 100]), [124, 548, 972]);
  assert.deepEqual(panelsDots([0, 1, 2, 100]), [124, 244, 364, 972], 'close dates are pushed apart');
  assert.deepEqual(panelsDots([0, 100, 101, 102]), [124, 732, 852, 972], 'when the last would pass the end, the ones before it are pulled back');
  assert.deepEqual(panelsDots([0, 0, 0]), [124, 244, 364]);
  assert.deepEqual(panelsDots([0, 5]), [124, 972]);
  const eight = panelsDots([0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(eight[7], 972);
  assert.equal(eight[0], 124, 'eight dots just fit: 7 gaps of 120 are 840 of the 848');
  assert.ok(eight.slice(1).every((place, index) => place - eight[index] >= 120));
});

function panelsDots(days) {
  return panels.timeline.dotPositions(days);
}

test('last season at a glance: the record of the whole season, the rank at each event, and the EPA after each event as a line', () => {
  const html = panels['last-season'].markupFor(contentWith(), eventDay);
  assert.ok(html.includes('<h2 class="title" data-slat="title">2026</h2>') && html.includes('<span class="tag-text">SAMPLE</span>'));
  assert.ok(html.includes('class="big">20-12-2</text>'), 'the record is the three events added together');
  assert.ok(html.includes('>EVENTS</text>') && html.includes('class="big">3</text>'));
  ['RANK 7 / 40', 'RANK 3 / 34', 'RANK 12 / 64'].forEach(rank => assert.ok(html.includes('>' + rank + '</text>'), rank));
  assert.ok(html.includes('>6-4-2</text>') && html.includes('>[Last year\'s ev…</text>'));
  assert.ok(html.includes('>EPA 24.1</text>') && html.includes('class="rank" text-anchor="end">31</text>'));
  assert.equal(countOf(html, '<polyline class="line"'), 1);
  const points = /<polyline class="line" points="([^"]*)"/.exec(html)[1].split(' ').map(pair => pair.split(',').map(Number));
  assert.equal(points.length, 3, 'a point for each event');
  assert.equal(points[0][0], 250);
  assert.equal(points[2][0], 846);
  assert.ok(points[0][1] > points[1][1] && points[1][1] > points[2][1], 'the line rises with the EPA');
  assert.ok(points.every(point => point[1] >= 424 && point[1] <= 482));

  // one number is written and not drawn, none is neither, and a flat line is in the middle
  const one = contentWith(raw => { primeOf(raw.frc).lastSeason.events.forEach((event, index) => { if (index > 0) delete event.epa; }); });
  const single = panels['last-season'].markupFor(one, eventDay);
  assert.ok(single.includes('>EPA 24.1</text>') && !single.includes('<polyline'));
  const noEpa = contentWith(raw => { primeOf(raw.frc).lastSeason.events.forEach(event => { delete event.epa; }); });
  assert.ok(!panels['last-season'].markupFor(noEpa, eventDay).includes('EPA'));
  assert.deepEqual(panels['last-season'].linePoints([5, 5, 5]).map(point => point.split(',')[1]), ['453', '453', '453']);
  assert.equal(panels['last-season'].seasonRecord([]), null);
  assert.deepEqual(panels['last-season'].seasonRecord([{ record: { wins: 1, losses: null, ties: 2 } }, { record: null }]), { wins: 1, losses: 0, ties: 2 });
  assert.ok(panels['last-season'].markupFor(contentWith(raw => { delete primeOf(raw.frc).lastSeason.season; }), eventDay).includes('>LAST YR</h2>'));
});

test('a card with nothing to show says one plain sentence, with its header and no chart', () => {
  const sentences = {
    'next-match': 'No match is scheduled yet.',
    rank: 'There is no rank yet. Rankings start after the first match.',
    results: 'No matches have been played yet.',
    alliance: 'Alliance selection has not happened yet.',
    timeline: 'No dates are coming up yet.',
    district: 'There are no district points yet.',
    'last-season': 'There are no results from last season yet.',
  };
  const titles = { 'next-match': 'MATCH', rank: 'RANK', results: 'RESULTS', alliance: 'ALLIANCE', timeline: 'SEASON', district: 'DISTRICT', 'last-season': 'LAST YR' };

  const noFrc = [contentWith(raw => { delete raw.frc; }), {}, { frc: null }, { frc: { teams: [] } }, contentWith(raw => { raw.frc.teams = []; })];
  cardNames.forEach(name => {
    noFrc.forEach(content => {
      const html = panels[name].markupFor(content, eventDay);
      assert.ok(html.includes('<p class="empty">' + sentences[name] + '</p>'), name + ': ' + html);
      assert.ok(html.includes('<h2 class="title" data-slat="title">' + titles[name] + '</h2>'), name + ' keeps its header');
      assert.ok(!html.includes('<svg class="chart"'), name + ' draws no chart');
      assert.equal(countOf(html, 'class="page competition competition-' + name + '"'), 1);
      assert.ok(sentences[name].length <= 80 && sentences[name].endsWith('.'), name + ' is one plain sentence');
      assert.ok(!/[\u2013\u2014!]/.test(sentences[name]) && !/\b(simply|seamless|robust|leverage|ensure)\b/i.test(sentences[name]));
    });
  });

  // the cards that depend on a part of the entry say the sentence when only that part is missing
  const part = (name, change) => panels[name].markupFor(contentWith(raw => change(primeOf(raw.frc))), eventDay);
  assert.ok(part('next-match', entry => { delete entry.nextMatch; }).includes(sentences['next-match']));
  assert.ok(part('rank', entry => { delete entry.ranking; }).includes(sentences.rank));
  assert.ok(part('results', entry => { entry.results = []; }).includes(sentences.results));
  assert.ok(part('alliance', entry => { delete entry.alliance; }).includes(sentences.alliance));
  assert.ok(part('alliance', entry => { entry.alliance.number = null; }).includes('The team was not picked for an alliance.'));
  assert.ok(part('district', entry => { delete entry.districtPoints; }).includes(sentences.district));
  assert.ok(part('last-season', entry => { delete entry.lastSeason; }).includes(sentences['last-season']));
  assert.ok(part('timeline', entry => { entry.events = []; }).includes('class="axis"'), 'the timeline still has the dates of the countdown and the state championship');
});

test('the header says SAMPLE for sample data and how old the data is when it is old, and what editors typed is escaped', () => {
  const tag = (frc, now) => draw.tagTextFor(frc, now);
  const now = noon('2027-03-12');
  const hoursAgo = hours => new Date(now.getTime() - hours * 3600 * 1000).toISOString();

  assert.equal(tag(null, now), '');
  assert.equal(tag({ sample: true, lastSyncAt: hoursAgo(100) }, now), 'SAMPLE');
  assert.equal(tag({ lastSyncAt: hoursAgo(0) }, now), '');
  assert.equal(tag({ lastSyncAt: hoursAgo(1.9) }, now), '');
  assert.equal(tag({ lastSyncAt: hoursAgo(2) }, now), '2 HR OLD');
  assert.equal(tag({ lastSyncAt: hoursAgo(5) }, now), '5 HR OLD');
  assert.equal(tag({ lastSyncAt: hoursAgo(47) }, now), '47 HR OLD');
  assert.equal(tag({ lastSyncAt: hoursAgo(72) }, now), '3 DAYS OLD');
  assert.equal(tag({ lastSyncAt: '' }, now), '', 'a Mini that never wrote a time is not called old');

  const old = contentWith(raw => { delete raw.frc.sample; raw.frc.lastSyncAt = hoursAgo(5); });
  cardNames.forEach(name => assert.ok(panels[name].markupFor(old, now).includes('<span class="tag-text">5 HR OLD</span>'), name));
  const fresh = contentWith(raw => { delete raw.frc.sample; raw.frc.lastSyncAt = hoursAgo(0); });
  cardNames.filter(name => name !== 'last-season').forEach(name => assert.ok(!panels[name].markupFor(fresh, now).includes('tag-text'), name));
  assert.ok(panels['last-season'].markupFor(fresh, now).includes('<span class="tag-text">LAST SEASON</span>'), 'last season says what it is when there is nothing else to say');

  const rude = contentWith(raw => {
    const match = primeOf(raw.frc).nextMatch;
    match.red[1] = { number: '[1121]', nickname: '<img src=x onerror=alert(1)>' };
    match.label = '<b>Q1</b>';
  });
  const html = panels['next-match'].markupFor(rude, eventDay);
  assert.ok(!html.includes('<img') && !html.includes('<b>'));
  assert.ok(html.includes('&lt;b&gt;Q1&lt;/b&gt;'));
  assert.equal(draw.cut('abcdef', 4), 'abc…');
  assert.equal(draw.cut('abcd', 4), 'abcd');
  assert.equal(draw.cut('ab cdef', 4), 'ab…');
  assert.equal(draw.cut(null, 4), '');
  assert.equal(draw.numberFor(31.24), '31.2');
  assert.equal(draw.numberFor(34), '34');
  assert.equal(draw.numberFor(null), '-');
  assert.equal(draw.numberFor('5'), '-');
  assert.equal(draw.daysText(1), '1 DAY');
  assert.equal(draw.daysText(5), '5 DAYS');
  assert.equal(draw.clockText('America/New_York', at('2027-03-12T19:45:00Z')), '2:45 PM');
  assert.equal(draw.clockText('America/New_York', at('2027-03-12T05:05:00Z')), '12:05 AM');
});

test('a card mounts into its host as one section, the way the other panels do', () => {
  const content = contentWith();
  cardNames.forEach(name => {
    const html = hostFor(panels[name], content);
    assert.ok(html.trim().startsWith('<section class="page competition competition-' + name + '">'), name);
    assert.ok(html.trim().endsWith('</section>'));
    assert.equal(countOf(html, '<section'), 1);
    assert.equal(countOf(html, 'data-slat="title"'), 1);
    assert.equal(countOf(html, 'data-slat="tag"'), 1);
    assert.equal(countOf(html, 'data-slat="item"'), 1, 'the body is one slat');
    assert.equal(typeof panels[name].mount, 'function');
    assert.equal('hasContent' in panels[name], false, 'the cards are chosen by core/competition.js, so they always draw');
  });
});

// The sizes

// The rules of a stylesheet, one for each selector, as selector -> text of the rule
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

const tokens = {};
Array.from(read('tokens.css').matchAll(/--(size-[a-z-]+):\s*(\d+)px;/g)).forEach(match => { tokens[match[1]] = Number(match[2]); });

// The size in pixels of a font declaration: font: 600 var(--size-label)/48px var(--font-display);
function fontOf(rule) {
  const found = /font:\s*(\d+)\s+(var\(--(size-[a-z-]+)\)|(\d+)px)\/(\d+)px\s+var\(--(font-[a-z]+)\)/.exec(rule);
  if (!found) return null;
  return { weight: Number(found[1]), size: found[3] ? tokens[found[3]] : Number(found[4]), line: Number(found[5]), family: found[6] };
}

test('nothing on a card is smaller than 44px, no line is thinner than 3px, and the stylesheets have no animation, blur or shadow', () => {
  assert.equal(tokens['size-label'], 44);
  cardNames.forEach(name => {
    const css = read('panels/competition-' + name + '/competition-' + name + '.css');
    const rules = rulesOf(css);
    const declarations = Array.from(css.matchAll(/font[a-z-]*:[^;]*;/g)).map(match => match[0]);

    assert.ok(declarations.length >= 4, name + ' has text');
    declarations.forEach(declaration => {
      assert.ok(!declaration.startsWith('font-size'), name + ' sets a size by font-size: ' + declaration);
      if (declaration.startsWith('font:')) {
        const font = fontOf(declaration);
        assert.ok(font, name + ' has a font line that cannot be read: ' + declaration);
        assert.ok(font.size >= 44, name + ' has text of ' + font.size + 'px: ' + declaration);
        assert.ok(font.line >= font.size, name + ' has a line height under its size: ' + declaration);
      }
    });
    Array.from(css.matchAll(/stroke-width:\s*([\d.]+)/g)).forEach(match => assert.ok(Number(match[1]) >= 3, name + ' has a line of ' + match[1] + 'px'));
    assert.equal(/@keyframes|transition:|animation:|box-shadow|text-shadow|filter|blur|drop-shadow|background-image|url\(/.test(css), false, name + ' has an effect that is not allowed');

    // every class a card writes into its chart has a rule with a font, a fill or a stroke
    const js = read('panels/competition-' + name + '/competition-' + name + '.js');
    assert.equal(/setTimeout|setInterval|requestAnimationFrame|animate\(|@keyframes|transform/.test(js), false, name + ' has animation code');
    assert.equal(/font-size|style="/.test(js), false, name + ' sets a size or a style in its markup');
    assert.ok(rules['.competition-' + name + ' .header'] && rules['.competition-' + name + ' .body'] && rules['.competition-' + name + ' .empty'], name + ' styles its header, body and empty sentence');
  });

  // the sentence a card says is 56px, and the biggest numbers use the tokens for them
  const empty = rulesOf(read('panels/competition-rank/competition-rank.css'))['.competition-rank .empty'];
  assert.equal(fontOf(empty).size, 56);
  assert.equal(tokens['size-days'], 184);
  assert.equal(tokens['size-heading'], 96);
  assert.ok(read('tokens.css').includes('--alliance-red: #d8323a;') && read('tokens.css').includes('--alliance-blue: #2f6fd6;'));
});

test('markup has no text of its own size, and the chart is 1096 by 512 at one pixel to the unit', () => {
  const content = contentWith();
  cardNames.forEach(name => {
    const html = panels[name].markupFor(content, eventDay);
    assert.equal(/font-size|style=|<style/.test(html), false, name);
    assert.ok(html.includes('<svg class="chart" width="1096" height="512" viewBox="0 0 1096 512"'), name);
    assert.equal(countOf(html, 'role="img"'), 1);
    assert.equal(/aria-label="[^"]+"/.test(html), true);
  });
  assert.deepEqual(draw.bodySize, { width: 1096, height: 512 });
  const css = read('panels/competition-rank/competition-rank.css');
  const body = rulesOf(css)['.competition-rank .body'];
  assert.ok(/left: 28px;/.test(body) && /top: 136px;/.test(body) && /width: 1096px;/.test(body) && /height: 512px;/.test(body));
  assert.ok(28 + 1096 <= 1148 - (136 + 512 - 640) * 80 / 64, 'the body stops before the cut corner of the frame');
});

test('no class a card uses has a rule of its own in the stylesheets of the whole screen, so nothing outside the card changes its size or its colour', () => {
  // an SVG shape takes its width and height from CSS before its attributes, so a rule such as .bar { height: 16px } would shrink a bar
  const sheets = ['base.css', 'frame.css', 'teams.css', 'neon-kit.css', 'tokens.css'];
  ['styles', 'layouts', 'themes', 'themes/overlays'].forEach(folder => fs.readdirSync(path.join(dashboardFolder, folder)).filter(file => file.endsWith('.css')).forEach(file => sheets.push(folder + '/' + file)));

  const used = new Set();
  [contentWith(), contentWith(raw => { delete raw.frc; })].forEach(content => cardNames.forEach(name => {
    Array.from(panels[name].markupFor(content, eventDay).matchAll(/class="([^"]+)"/g)).forEach(match => match[1].split(' ').forEach(token => used.add(token)));
  }));
  assert.ok(used.has('share') && used.has('chip') && used.has('empty') && used.size > 40);

  const shared = ['page', 'double-slash', 'competition'];
  const alone = [];
  sheets.forEach(file => {
    Object.keys(rulesOf(read(file))).forEach(selector => {
      const classes = Array.from(selector.matchAll(/\.([A-Za-z][\w-]*)/g)).map(match => match[1]);
      if (classes.length === 1 && used.has(classes[0]) && !shared.includes(classes[0])) alone.push(file + ': ' + selector);
    });
  });
  assert.deepEqual(alone, []);
});

// The text a card draws, as { x, y, cssClass, anchor, text }
function textsIn(html) {
  return Array.from(html.matchAll(/<text x="([^"]+)" y="([^"]+)" class="([^"]+)"(?: text-anchor="([^"]+)")?>([^<]*)<\/text>/g)).map(match => ({
    x: Number(match[1]), y: Number(match[2]), cssClass: match[3], anchor: match[4] || 'start', text: match[5].replace(/&[a-z]+;/g, 'x'),
  }));
}

// A wide guess at how far a text reaches. Each letter is a share of the size: a capital 0.72 in the display font (HAWKTIMUS PRIME is
// 0.73 of its size a letter in a real render, docs/layouts.md) and 0.66 in the text font, a lower case letter 0.58 and 0.52, a digit
// 0.62 and 0.58, a space 0.3 and 0.28, anything else 0.5. These are wider than the real fonts, so a text that fits here fits there.
function reachOf(text, font) {
  const display = font.family === 'font-display';
  const share = letter => {
    if (/[A-Z\[\]]/.test(letter)) return display ? 0.72 : 0.66;
    if (/[a-z]/.test(letter)) return display ? 0.58 : 0.52;
    if (/[0-9]/.test(letter)) return display ? 0.62 : 0.58;
    return letter === ' ' ? (display ? 0.3 : 0.28) : 0.5;
  };
  const width = Array.from(text.text).reduce((total, letter) => total + share(letter), 0) * font.size;
  const left = text.anchor === 'middle' ? text.x - width / 2 : text.anchor === 'end' ? text.x - width : text.x;
  return { left: left, right: left + width, top: text.y - font.size * 0.72, bottom: text.y + font.size * 0.1 };
}

// The longest things the Mini could send: long nicknames, long event names, five digit team numbers, and big numbers
function crowdedContent() {
  return contentWith(raw => {
    const entry = primeOf(raw.frc);
    const nickname = 'The Mighty Unstoppable Robots of Somewhere';
    const person = number => ({ number: number, nickname: nickname, epa: 123.4 });
    entry.number = 12345;
    entry.nextMatch.label = 'SF12-3';
    entry.nextMatch.time = '2027-03-13T22:45:00Z';
    entry.nextMatch.red = [person(12345), person(11111), person(22222)];
    entry.nextMatch.blue = [person(33333), person(44444), person(55555)];
    entry.nextMatch.alliance = 'blue';
    entry.events[0].name = nickname;
    entry.events[0].city = nickname;
    entry.ranking.rank = 128;
    entry.ranking.teamsRanked = 128;
    entry.ranking.record = { wins: 12, losses: 12, ties: 12 };
    entry.ranking.rankingPoints = 12.34;
    entry.alliance.number = 8;
    entry.alliance.picks = [person(12345), person(11111), person(22222), person(33333)];
    entry.results = new Array(8).fill({ label: 'QF4-3', alliance: 'red', scoreFor: 388, scoreAgainst: 388, won: true });
    entry.districtPoints = { total: 188, rank: 128, cutoff: 188 };
    entry.lastSeason.events = new Array(4).fill(0).map((nothing, index) => ({ key: 'k' + index, name: nickname, city: nickname, startDate: '2026-03-0' + (index + 1), rank: 128, teamsRanked: 128, record: { wins: 12, losses: 12, ties: 12 }, epa: 100 + index * 10 }));
    entry.lastSeason.season = 2026;
  });
}

test('the text of every card stays inside the body and does not run into the text beside it, even with the longest names and numbers', () => {
  const contents = { sample: contentWith(), crowded: crowdedContent() };
  const crowdedTimeline = crowdedContent();
  const entry = primeOf(crowdedTimeline.frc);
  for (let day = 20; day <= 25; day++) entry.events.push({ key: 'x' + day, name: 'Event', city: 'The Mighty Unstoppable Robots', startDate: '2027-04-' + day, endDate: '2027-04-' + day });
  contents.timeline = crowdedTimeline;
  const problems = [];

  Object.keys(contents).forEach(label => {
    cardNames.forEach(name => {
      const rules = rulesOf(read('panels/competition-' + name + '/competition-' + name + '.css'));
      const html = panels[name].markupFor(contents[label], noon('2026-10-09'));
      const reaches = textsIn(html).map(text => {
        const font = fontOf(rules['.competition-' + name + ' .' + text.cssClass.split(' ')[0]] || '');
        assert.ok(font, label + ' ' + name + ': the class ' + text.cssClass + ' has no font');
        return { text: text, reach: reachOf(text, font) };
      });
      assert.ok(reaches.length > 0, label + ' ' + name + ' draws text');

      reaches.forEach(item => {
        if (item.reach.left < -1 || item.reach.right > 1097) problems.push(label + ' ' + name + ': "' + item.text.text + '" runs ' + Math.round(item.reach.left) + ' to ' + Math.round(item.reach.right));
        if (item.reach.top < 0 || item.reach.bottom > 512) problems.push(label + ' ' + name + ': "' + item.text.text + '" is outside the body at the top or bottom');
      });
      reaches.forEach((first, index) => reaches.slice(index + 1).forEach(second => {
        const across = Math.min(first.reach.right, second.reach.right) - Math.max(first.reach.left, second.reach.left);
        const down = Math.min(first.reach.bottom, second.reach.bottom) - Math.max(first.reach.top, second.reach.top);
        if (across > 2 && down > 4) problems.push(label + ' ' + name + ': "' + first.text.text + '" runs into "' + second.text.text + '"');
      }));
    });
  });
  assert.deepEqual(problems, []);
});

// Preview competition: the guard

function memoryStorage(start) {
  const kept = Object.assign({}, start);
  return { getItem: key => (key in kept ? kept[key] : null), setItem: (key, value) => { kept[key] = String(value); }, kept: kept };
}

// A runner with fakes for everything the page gives it. The request is the time given, as text.
function runnerFor(requestedAt, more) {
  const calls = [];
  const storage = memoryStorage();
  const sample = contentWith().frc;
  const content = { settings: { competitionPreviewRequest: { requestedAt: requestedAt } } };
  const deps = Object.assign({
    getContent: () => content,
    storage: storage,
    takeoverRunning: () => false,
    demoRunning: () => false,
    nightIsUp: () => false,
    hiddenPlaying: () => false,
    loadSampleFrc: async () => sample,
    startPreview: (frc, until) => calls.push(['start', frc === sample, until]),
    endPreview: () => calls.push(['end']),
  }, more);
  return { runner: previewModule.makeCompetitionPreviewRunner(deps), calls: calls, storage: storage, content: content, sample: sample };
}

const requestedAgo = (now, seconds) => new Date(now.getTime() - seconds * 1000).toISOString();

test('Preview competition: a request under a minute old starts once, with the sample data, for 120 seconds, and then the large panel is given back', async () => {
  const now = at('2027-03-12T18:00:00Z');
  const { runner, calls, storage } = runnerFor(requestedAgo(now, 5));

  runner.look(now);
  await runner.whenStarted();
  assert.deepEqual(calls, [['start', true, now.getTime() + 120000]]);
  assert.equal(runner.isActive(), true);
  assert.equal(storage.kept[previewModule.handledKey], requestedAgo(now, 5), 'the request is remembered, so a restart never runs it again');

  runner.look(new Date(now.getTime() + 1000));
  runner.look(new Date(now.getTime() + 60000));
  await runner.whenStarted();
  assert.equal(calls.length, 1, 'the same request does not start it again');

  runner.look(new Date(now.getTime() + 119000));
  assert.equal(calls.length, 1);
  runner.look(new Date(now.getTime() + 120000));
  assert.deepEqual(calls[1], ['end']);
  assert.equal(runner.isActive(), false);
  runner.look(new Date(now.getTime() + 121000));
  runner.look(new Date(now.getTime() + 500000));
  assert.equal(calls.length, 2, 'the end comes once, and the request is not run again');
});

test('Preview competition does not start for a request that is old, handled before, in the future, empty or not a time', async () => {
  const now = at('2027-03-12T18:00:00Z');
  const tries = {
    'one minute and a second old': requestedAgo(now, 61),
    'an hour old': requestedAgo(now, 3600),
    'six seconds ahead of the clock': requestedAgo(now, -6),
    'empty': '',
    'not a time': 'yesterday',
  };
  for (const label of Object.keys(tries)) {
    const { runner, calls } = runnerFor(tries[label]);
    runner.look(now);
    await runner.whenStarted();
    assert.deepEqual(calls, [], label);
  }

  // up to a minute old, and a few seconds ahead of the clock, both start
  for (const seconds of [0, 30, 60, -4]) {
    const { runner, calls } = runnerFor(requestedAgo(now, seconds));
    runner.look(now);
    await runner.whenStarted();
    assert.equal(calls.length, 1, seconds + ' seconds');
  }

  // the request that was handled before, kept in localStorage, is not run again by a screen that restarts
  const handled = requestedAgo(now, 5);
  const restarted = runnerFor(handled, { storage: memoryStorage({ [previewModule.handledKey]: handled }) });
  restarted.runner.look(now);
  await restarted.runner.whenStarted();
  assert.deepEqual(restarted.calls, []);

  // the content has no settings, or no request field
  const nothing = runnerFor('', { getContent: () => null });
  nothing.runner.look(now);
  const noSettings = runnerFor('', { getContent: () => ({}) });
  noSettings.runner.look(now);
  assert.deepEqual(nothing.calls.concat(noSettings.calls), []);
});

test('Preview competition waits while an alert, an announcement, a talk, night mode, a demo or a hidden transition has the screen, and runs when it is free', async () => {
  const now = at('2027-03-12T18:00:00Z');
  for (const busy of ['takeoverRunning', 'demoRunning', 'nightIsUp', 'hiddenPlaying']) {
    let taken = true;
    const { runner, calls } = runnerFor(requestedAgo(now, 5), { [busy]: () => taken });

    runner.look(now);
    runner.look(new Date(now.getTime() + 20000));
    await runner.whenStarted();
    assert.deepEqual(calls, [], busy + ' has the screen');
    assert.equal(runner.isActive(), false);

    taken = false;
    runner.look(new Date(now.getTime() + 30000));
    await runner.whenStarted();
    assert.equal(calls.length, 1, 'free again, and the request is still under a minute old');
  }

  // a request that waited more than a minute is dropped
  let taken = true;
  const late = runnerFor(requestedAgo(now, 5), { takeoverRunning: () => taken });
  late.runner.look(now);
  taken = false;
  late.runner.look(new Date(now.getTime() + 61000));
  await late.runner.whenStarted();
  assert.deepEqual(late.calls, []);
});

test('Preview competition ignores a new request while it runs, survives a storage that fails and a sample that is missing or cannot be read', async () => {
  const now = at('2027-03-12T18:00:00Z');
  const running = runnerFor(requestedAgo(now, 2));
  running.runner.look(now);
  await running.runner.whenStarted();
  running.content.settings.competitionPreviewRequest.requestedAt = requestedAgo(new Date(now.getTime() + 10000), 1);
  running.runner.look(new Date(now.getTime() + 10000));
  await running.runner.whenStarted();
  assert.equal(running.calls.length, 1, 'a second click does not start it over');

  // no storage, and a storage that throws: the request is still handled once, even while the sample is being read
  for (const storage of [null, { getItem: () => { throw new Error('off'); }, setItem: () => { throw new Error('full'); } }]) {
    let release = null;
    const slow = new Promise(resolve => { release = resolve; });
    const { runner, calls, sample } = runnerFor(requestedAgo(now, 3), { storage: storage });
    const again = runnerFor(requestedAgo(now, 3), { storage: storage, loadSampleFrc: () => slow });

    again.runner.look(now);
    again.runner.look(new Date(now.getTime() + 1000));
    release(sample);
    await again.runner.whenStarted();
    assert.equal(again.calls.length, 1);

    runner.look(now);
    await runner.whenStarted();
    assert.equal(calls.length, 1);
  }

  // a sample with no competition data, and a sample that cannot be read: the error is written and the screen carries on
  for (const loadSampleFrc of [async () => null, async () => { throw new Error('no network'); }]) {
    const { runner, calls } = runnerFor(requestedAgo(now, 3), { loadSampleFrc: loadSampleFrc });
    const heard = [];
    const before = console.error;
    console.error = (...args) => heard.push(args.map(String).join(' '));
    try {
      runner.look(now);
      await runner.whenStarted();
    } finally {
      console.error = before;
    }
    assert.deepEqual(calls, []);
    assert.equal(runner.isActive(), false);
    assert.ok(heard.some(line => line.includes('Preview competition failed')), 'the problem is written to the console');
  }
});

test('requestTimeOf reads the time of the request and nothing else, and the handled key is its own', () => {
  const when = '2027-03-12T18:00:00Z';
  assert.equal(previewModule.requestTimeOf({ competitionPreviewRequest: { requestedAt: when } }), when);
  [null, undefined, {}, { competitionPreviewRequest: null }, { competitionPreviewRequest: {} }, { competitionPreviewRequest: { requestedAt: 5 } }, { competitionPreviewRequest: { requestedAt: 'x' } }, { competitionPreviewRequest: [when] }, 'text'].forEach(settings => {
    assert.equal(previewModule.requestTimeOf(settings), '', JSON.stringify(settings));
  });
  assert.equal(previewModule.handledKey, 'teletraan-competition-preview-handled');
  ['teletraan-demo-handled', 'teletraan-announce-handled', 'teletraan-preview-handled', 'teletraan-presentation-test-handled'].forEach(key => assert.notEqual(previewModule.handledKey, key));

  const storage = memoryStorage();
  assert.equal(previewModule.readHandledPreview(storage), '');
  assert.equal(previewModule.rememberHandledPreview(storage, when), true);
  assert.equal(previewModule.readHandledPreview(storage), when);
  assert.equal(previewModule.readHandledPreview(null), '');
  assert.equal(previewModule.rememberHandledPreview(null, when), false);
});

test('the screen starts the preview runner after the other runners, hands the large panel its list through withCompetition, and the page glue asks the right questions', () => {
  const shell = read('shell.js');
  assert.ok(shell.includes("import { withCompetition } from './core/competition.js';"));
  assert.ok(shell.includes("withCompetition(playlistOf(rotation(), 'grid1'), content, new Date())"));
  assert.ok(shell.indexOf("./core/preview-run.js") < shell.indexOf("./core/competition-preview-run.js") && shell.indexOf('./core/competition-preview-run.js') < shell.indexOf('./core/team-run.js'));
  assert.ok(shell.includes("startOptional('./core/competition-preview-run.js', module => module.startCompetitionPreviewRunner(getContent));"));
  assert.ok(!shell.includes("withCompetition(playlistOf(rotation(), 'grid2')"), 'the small panel has no cards');

  const run = read('core/competition-preview-run.js');
  ['frame.onSecond(runner.look);', "sampleFolder + 'content.json'", 'normalizeSample(await response.json()).frc', "moveOn(['grid1'])", 'previewCompetition(frc, until)', 'previewCompetition(null, 0)', 'takeoverRunning: takeoverRunning'].forEach(piece => assert.ok(run.includes(piece), piece));
  ['demo-runner.js', 'night-screen.js', 'hidden-run.js'].forEach(file => assert.ok(run.includes("'./" + file + "'"), file));
  assert.equal(/fetch\(['"]https|sanity\.io/.test(run), false, 'nothing is read from Sanity');
});

test('every card is a panel of the large frame with a script and a stylesheet, is flagged in registry.js, and is not in Panel order', () => {
  const registry = read('registry.js');
  cardIds.forEach(id => {
    assert.ok(registry.includes("{ id: '" + id + "', region: 'grid1', topic: 'competition', competition: true },"), id);
    assert.ok(fs.existsSync(path.join(dashboardFolder, 'panels', id, id + '.js')) && fs.existsSync(path.join(dashboardFolder, 'panels', id, id + '.css')), id);
    assert.ok(!read('core/panel-order.js').includes(id) && !config.defaultSettings.rotation.grid1.some(step => step.panel === id), id + ' is not in a rotation list');
  });
  assert.equal(countOf(registry, 'competition: true'), 7);
  assert.deepEqual(competition.cards.map(card => card.id).sort(), cardIds.slice().sort());
  assert.ok(cardIds.every(id => competition.isCard(id)) && !competition.isCard('tasks'));
  competition.cards.forEach(card => assert.ok(config.competitionSwitches.includes(card.setting), card.id + ' has a switch'));
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
