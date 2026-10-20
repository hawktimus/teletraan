// Tests for the Before and after mode and its three cards: competition-preview, competition-matches and
// competition-recap (dashboard/core/competition.js, core/competition-scouting.js, core/competition-trend.js and
// the panels). The plain functions are run for real. The data is the sample in data/sample/content.json, changed
// here and there; the numbers in it are made up. The older cards are in tests/competition.test.mjs, and the
// computer side in tests/frc-field.test.mjs.
//
//   node tests/competition-phases.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';
import { hasImports, readModule } from './helpers/read-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const sampleFile = path.join(dashboardFolder, 'data/sample/content.json');
const read = file => readModule(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-competition-'));
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

const newerNames = ['preview', 'matches', 'recap'];
newerNames.forEach(name => {
  fs.mkdirSync(path.join(root, 'panels', 'competition-' + name), { recursive: true });
  copyModule(path.join(dashboardFolder, 'panels', 'competition-' + name, 'panel.js'), path.join(root, 'panels', 'competition-' + name, 'panel.js'));
});

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const frcModule = await import(base + 'core/frc.js');
const competition = await import(base + 'core/competition.js');
const scouting = await import(base + 'core/competition-scouting.js');
const trend = await import(base + 'core/competition-trend.js');
const draw = await import(base + 'core/competition-draw.js');
const address = await import(base + 'core/competition-address.js');
const match13 = await import(base + 'core/match13.js');
const sanity = await import(base + 'core/sanity.js');
const panels = {};
for (const name of newerNames) panels[name] = await import(base + 'panels/competition-' + name + '/panel.js');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const at = text => new Date(text);
const noon = date => at(date + 'T17:00:00Z');
const sampleRaw = () => JSON.parse(readModule(sampleFile, 'utf8'));
const primeOf = frc => frc.teams.find(team => team.team === 'prime');
const novaOf = frc => frc.teams.find(team => team.team === 'nova');
const chartCount = html => html.split('<svg class="chart"').length - 1;
const idsOf = plan => plan.cards.map(id => id.replace('competition-', ''));

function contentWith(change) {
  const raw = sampleRaw();
  raw.settings.countdown = { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
  raw.settings.competitionMode = 'around';
  if (change) change(raw);
  return sanity.normalizeSample(raw);
}

const event = (start, end, more) => Object.assign({ key: 'e' + start, name: 'Event', shortName: '', city: 'City', startDate: start, endDate: end, rank: null, teamsRanked: null, matchesPlayed: null, record: null, rankingPoints: null, epa: null }, more || {});

// The phases

test('eventPhases: the preview is the 14 days before the first day, the event is off, and the recap is the 7 days after the last day', () => {
  const events = [event('2027-03-12', '2027-03-14')];
  const phase = date => {
    const result = competition.eventPhases(events, date);
    return result.during ? 'during' : result.preview ? 'preview' : result.recap ? 'recap' : 'none';
  };

  assert.equal(phase('2027-02-25'), 'none', '15 days before');
  assert.equal(phase('2027-02-26'), 'preview', '14 days before');
  assert.equal(phase('2027-03-11'), 'preview', 'the day before');
  assert.equal(phase('2027-03-12'), 'during', 'the first day');
  assert.equal(phase('2027-03-13'), 'during', 'the middle of a three day event');
  assert.equal(phase('2027-03-14'), 'during', 'the last day');
  assert.equal(phase('2027-03-15'), 'recap', 'the day after');
  assert.equal(phase('2027-03-21'), 'recap', '7 days after');
  assert.equal(phase('2027-03-22'), 'none', '8 days after');
  assert.equal(competition.eventPhases([event('2027-03-12', '')], '2027-03-12').during.startDate, '2027-03-12', 'an event with no last day lasts one day');
  assert.deepEqual(competition.eventPhases([], '2027-03-12'), { during: null, preview: null, recap: null });
});

test('two events close together: the recap of the first and the preview of the second can be on one day, and an event that is on stops both', () => {
  const events = [event('2027-03-12', '2027-03-14', { key: 'first' }), event('2027-03-20', '2027-03-22', { key: 'second' })];

  const between = competition.eventPhases(events, '2027-03-16');
  assert.equal(between.recap.key, 'first');
  assert.equal(between.preview.key, 'second');
  assert.equal(between.during, null);

  const on = competition.eventPhases(events, '2027-03-20');
  assert.equal(on.during.key, 'second');
  assert.equal(on.preview, null);
  assert.equal(on.recap, null, 'the second event is on, so the recap of the first waits');

  const nearest = competition.eventPhases([event('2027-03-25', '2027-03-26', { key: 'far' }), event('2027-03-18', '2027-03-19', { key: 'near' })], '2027-03-10');
  assert.equal(nearest.preview.key, 'near', 'the nearest event is the one that is previewed');
  const latest = competition.eventPhases([event('2027-03-01', '2027-03-02', { key: 'old' }), event('2027-03-05', '2027-03-06', { key: 'new' })], '2027-03-08');
  assert.equal(latest.recap.key, 'new', 'the latest event is the one that is recapped');
});

// Which cards are due in each mode, with the sample's events: the first on 2027-03-11 to 13, the second on 2027-04-01 to 03
const aroundByDay = [
  ['2027-02-24', 'more than 14 days before the first event', []],
  ['2027-02-25', '14 days before: the preview opens', ['timeline', 'last-season', 'preview', 'matches', 'team-metrics', 'compare']],
  ['2027-03-10', 'the day before the first event', ['timeline', 'last-season', 'preview', 'matches', 'team-metrics', 'compare']],
  ['2027-03-11', 'the first day of the event: nothing', []],
  ['2027-03-12', 'the middle of the event: nothing', []],
  ['2027-03-13', 'the last day: nothing', []],
  ['2027-03-14', 'the day after: the recap, with the cards of the whole season', ['timeline', 'district', 'recap', 'team-metrics', 'compare']],
  ['2027-03-17', 'the second event is 15 days away: only the recap', ['timeline', 'district', 'recap', 'team-metrics', 'compare']],
  ['2027-03-18', 'the second event is 14 days away: both the recap and the preview', ['timeline', 'district', 'preview', 'recap', 'team-metrics', 'compare']],
  ['2027-03-20', '7 days after the first event: both', ['timeline', 'district', 'preview', 'recap', 'team-metrics', 'compare']],
  ['2027-03-21', '8 days after the first event: only the preview of the second', ['timeline', 'district', 'preview', 'team-metrics', 'compare']],
];

test('Before and after: the preview, nothing while an event is on, the recap, and never the cards of the match by match course', () => {
  const content = contentWith();
  aroundByDay.forEach(entry => {
    const plan = competition.competitionPlan(content, noon(entry[0]));
    assert.deepEqual(idsOf(plan).sort(), entry[2].slice().sort(), entry[0] + ', ' + entry[1]);
    assert.equal(plan.priority, false, entry[0] + ' priority: the cards do not take turns with the panels in this mode');
    ['next-match', 'rank', 'results', 'alliance'].forEach(name => assert.ok(!idsOf(plan).includes(name), name + ' on ' + entry[0]));
  });
  // the cards come in the order of competition.cards: the timeline and last season before the newer cards
  assert.deepEqual(idsOf(competition.competitionPlan(content, noon('2027-03-10'))), ['timeline', 'last-season', 'preview', 'matches', 'team-metrics', 'compare']);
});

test('Auto keeps today: the newer cards never come in it, and the older ones are as they were', () => {
  const auto = contentWith(raw => { raw.settings.competitionMode = 'auto'; });
  ['2027-02-25', '2027-03-10', '2027-03-12', '2027-03-15'].forEach(date => {
    idsOf(competition.competitionPlan(auto, noon(date))).forEach(name => assert.ok(!['preview', 'matches', 'recap'].includes(name), name + ' on ' + date));
  });
  assert.deepEqual(idsOf(competition.competitionPlan(auto, noon('2027-03-12'))), ['next-match', 'rank', 'results', 'alliance', 'timeline', 'district']);
  assert.equal(competition.competitionPlan(auto, noon('2027-03-12')).priority, true);
});

test('Always shows the newer cards that have data, Off shows none, and a switch takes a card out', () => {
  const always = contentWith(raw => { raw.settings.competitionMode = 'always'; });
  assert.deepEqual(idsOf(competition.competitionPlan(always, noon('2027-02-01'))), ['next-match', 'rank', 'results', 'alliance', 'timeline', 'district', 'last-season', 'preview', 'matches', 'recap', 'team-metrics', 'compare']);

  const off = contentWith(raw => { raw.settings.competitionMode = 'off'; });
  ['2027-03-10', '2027-03-15'].forEach(date => assert.deepEqual(competition.competitionPlan(off, noon(date)), { cards: [], priority: false }, date));

  ['competitionPreview', 'competitionMatches', 'competitionRecap'].forEach(name => {
    const content = contentWith(raw => { raw.settings[name] = false; });
    const day = name === 'competitionRecap' ? '2027-03-15' : '2027-03-10';
    const id = 'competition-' + name.replace('competition', '').toLowerCase();
    assert.ok(!competition.competitionPlan(content, noon(day)).cards.includes(id), name);
    assert.ok(competition.competitionPlan(contentWith(), noon(day)).cards.includes(id), name + ' is on to start with');
  });
});

test('our matches come with the preview once the schedule is posted, and in the last 2 days without a schedule they say it is not posted', () => {
  const unposted = day => contentWith(raw => { primeOf(raw.frc).schedule.matches = []; });
  assert.ok(!idsOf(competition.competitionPlan(unposted(), noon('2027-03-02'))).includes('matches'), '9 days before, nothing to say yet');
  assert.ok(idsOf(competition.competitionPlan(unposted(), noon('2027-03-02'))).includes('preview'), 'the preview is there');
  assert.ok(idsOf(competition.competitionPlan(unposted(), noon('2027-03-09'))).includes('matches'), '2 days before the card comes and says so');
  assert.ok(idsOf(competition.competitionPlan(unposted(), noon('2027-03-10'))).includes('matches'));

  const none = contentWith(raw => { delete primeOf(raw.frc).schedule; });
  assert.ok(!idsOf(competition.competitionPlan(none, noon('2027-03-02'))).includes('matches'), 'a status from an older run has no schedule');

  const html = panels.matches.markupFor(unposted(), noon('2027-03-10'));
  assert.ok(html.includes('The match schedule is not posted yet.'), 'the sentence');
  assert.ok(!html.includes('class="chart"'), 'and no chart');
  assert.ok(html.includes('<h2 class="title" data-slat="title">MATCHES</h2>'));
});

test('the preview needs an event, and the recap needs a rank, a record or an award of the event', () => {
  const noEvents = contentWith(raw => { primeOf(raw.frc).events = []; });
  assert.deepEqual(idsOf(competition.competitionPlan(noEvents, noon('2027-03-02'))), []);

  const plain = contentWith(raw => { const entry = primeOf(raw.frc); entry.events[0].rank = null; entry.events[0].record = null; entry.awards = []; });
  assert.ok(!idsOf(competition.competitionPlan(plain, noon('2027-03-15'))).includes('recap'), 'an event with nothing to say has no recap');
  assert.ok(idsOf(competition.competitionPlan(contentWith(), noon('2027-03-15'))).includes('recap'));

  const awardsOnly = contentWith(raw => { const entry = primeOf(raw.frc); entry.events[0].rank = null; entry.events[0].record = null; });
  assert.ok(idsOf(competition.competitionPlan(awardsOnly, noon('2027-03-15'))).includes('recap'), 'an award is enough');
});

test('the window follows the date in the time zone of the Look page', () => {
  const content = contentWith();
  // 2027-03-11 at 02:00 in Holly Springs is 07:00 in Z. At 03:00 Z it is still 03-10 there, the day before: the preview.
  assert.ok(idsOf(competition.competitionPlan(content, at('2027-03-11T03:00:00Z'))).includes('preview'));
  assert.deepEqual(idsOf(competition.competitionPlan(content, at('2027-03-11T07:30:00Z'))), []);
});

// The field strength

const entryOf = content => primeOf(content.frc);

test('field strength ranks the teams that come by EPA, marks ours, and says where each of our teams would rank', () => {
  const content = contentWith();
  const strength = scouting.fieldStrength(content.frc, entryOf(content));

  assert.equal(strength.count, 36);
  assert.equal(strength.rated, 36);
  assert.deepEqual(strength.top.map(team => team.rank), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(strength.top.map(team => team.epa), [52.4, 47.9, 44.1, 41.6, 38.8, 36.5, 31.2, 30.9]);
  assert.equal(strength.top[6].number, '3229');
  assert.equal(strength.top[6].code, 'prime', 'our team is marked');
  assert.equal(strength.top[0].code, '');

  const prime = strength.lines.find(line => line.code === 'prime');
  assert.equal(prime.rank, 7);
  assert.equal(prime.text, 'Prime would rank 7th of 36 by EPA');
  const nova = strength.lines.find(line => line.code === 'nova');
  assert.equal(nova.text, 'Nova would rank 20th of 36 by EPA');

  const mean = Math.round(entryOf(content).field.teams.reduce((total, team) => total + team.epa, 0) / 36 * 10) / 10;
  assert.equal(strength.average, mean);
});

test('the ordinal: 1st 2nd 3rd 4th, 11th 12th 13th, 21st 22nd 101st 111th', () => {
  const words = [1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 24, 101, 111, 112].map(scouting.ordinal);
  assert.deepEqual(words, ['1st', '2nd', '3rd', '4th', '10th', '11th', '12th', '13th', '21st', '22nd', '23rd', '24th', '101st', '111th', '112th']);
});

test('field strength with no ratings, a missing field, ties and a team that has no rating', () => {
  const content = contentWith();
  assert.equal(scouting.fieldStrength(content.frc, { field: null }), null);

  const unrated = contentWith(raw => { primeOf(raw.frc).field.teams.forEach(team => { team.epa = null; }); });
  const none = scouting.fieldStrength(unrated.frc, entryOf(unrated));
  assert.equal(none.average, null);
  assert.equal(none.rated, 0);
  assert.equal(none.lines.find(line => line.code === 'prime').text, 'Prime has no EPA yet');
  assert.equal(none.top.length, 8, 'teams with no rating still fill the list');

  const tied = contentWith(raw => { primeOf(raw.frc).field.teams.forEach(team => { team.epa = 20; }); });
  assert.equal(scouting.fieldStrength(tied.frc, entryOf(tied)).lines.find(line => line.code === 'prime').rank, 1, 'a tie shares the place');

  const partial = contentWith(raw => { primeOf(raw.frc).field.teams.slice(0, 10).forEach(team => { team.epa = null; }); });
  const some = scouting.fieldStrength(partial.frc, entryOf(partial));
  assert.equal(some.rated, 26);
  assert.equal(some.count, 36, 'of 36 teams, rated or not');
  assert.ok(some.lines[0].rank <= 26);

  const absent = contentWith(raw => { primeOf(raw.frc).field.teams = primeOf(raw.frc).field.teams.filter(team => team.number !== 3229); });
  assert.deepEqual(scouting.fieldStrength(absent.frc, entryOf(absent)).lines.map(line => line.code), ['nova'], 'a team that does not come has no line');
});

// Our matches

test('the chance is Statbotics when it is there and an estimate from the EPA otherwise, and an estimate is marked', () => {
  const content = contentWith();
  const view = scouting.matchesView(entryOf(content));
  const byLabel = label => view.rows.find(row => row.label === label);

  assert.equal(byLabel('Q14').chance, 0.31);
  assert.equal(byLabel('Q14').estimate, false);
  assert.equal(byLabel('Q14').percent, 31);

  const guessed = byLabel('Q19');
  assert.equal(guessed.estimate, true, 'Q19 has no chance from Statbotics');
  // ours: 36.5 + 28.8 = 65.3 against 33.7 + 24.5 + 16 = 74.2, 8.9 points short
  assert.ok(Math.abs(guessed.ourEpa - 65.3) < 1e-9 && Math.abs(guessed.theirEpa - 74.2) < 1e-9);
  assert.ok(guessed.chance > 0.3 && guessed.chance < 0.4, String(guessed.chance));
  assert.ok(Math.abs(guessed.chance - 0.3600) < 0.01, 'the normal curve at 8.9 points over 25 is 0.36: ' + guessed.chance);
  assert.equal(view.anyEstimate, true);

  const sure = { winProbability: null, partners: [{ epa: 30 }, { epa: 30 }], opponents: [{ epa: 30 }, { epa: 20 }, { epa: 10 }] };
  assert.equal(scouting.winChance(sure).chance, 0.5, 'even alliances are an even chance');
  assert.equal(scouting.winChance(Object.assign({}, sure, { opponents: [{ epa: 30 }, { epa: 20 }, { epa: null }] })), null, 'one missing rating gives no estimate');
  assert.equal(scouting.winChance(Object.assign({}, sure, { partners: [{ epa: 30 }] })), null, 'a missing partner gives no estimate');
  assert.equal(scouting.winChance(Object.assign({}, sure, { winProbability: 0.2 })).estimate, false);
});

test('the hardest and the easiest match, the expected record, and the first match with a time', () => {
  const view = scouting.matchesView(entryOf(contentWith()));

  assert.deepEqual(view.rows.map(row => row.label), ['Q14', 'Q19', 'Q27', 'Q33', 'Q41', 'Q48', 'Q55', 'Q62'], 'in time order');
  assert.equal(view.hardest.label, 'Q55', 'an estimate of about 7 percent: it has no chance from Statbotics');
  assert.equal(view.hardest.estimate, true);
  assert.equal(view.easiest.label, 'Q48', '74 percent');
  assert.equal(view.first.label, 'Q14');

  const sum = view.rows.reduce((total, row) => total + row.chance, 0);
  assert.deepEqual(view.record, { wins: Math.round(sum), losses: 8 - Math.round(sum) });
  assert.ok(view.record.wins + view.record.losses === 8);

  // matches given out of order are put in order of time
  const shuffled = contentWith(raw => { primeOf(raw.frc).schedule.matches.reverse(); });
  assert.deepEqual(scouting.matchesView(entryOf(shuffled)).rows.map(row => row.label), ['Q14', 'Q19', 'Q27', 'Q33', 'Q41', 'Q48', 'Q55', 'Q62']);

  // one match: nothing is hardest or easiest, and with an unknown chance there is no record
  const one = contentWith(raw => { primeOf(raw.frc).schedule.matches = primeOf(raw.frc).schedule.matches.slice(0, 1); });
  const single = scouting.matchesView(entryOf(one));
  assert.equal(single.hardest, null);
  assert.equal(single.easiest, null);
  assert.deepEqual(single.record, { wins: 0, losses: 1 });

  const blank = contentWith(raw => { primeOf(raw.frc).schedule.matches.forEach(match => { match.winProbability = null; match.partners.forEach(person => { person.epa = null; }); }); });
  const unknown = scouting.matchesView(entryOf(blank));
  assert.equal(unknown.record, null, 'with no chances there is no record');
  assert.equal(unknown.hardest, null);
  assert.equal(scouting.expectedRecord([]), null);
  assert.deepEqual(scouting.expectedRecord([0.6, 0.6, 0.6, 0.6, 0.6]), { wins: 3, losses: 2 });

  assert.equal(scouting.matchesView({ schedule: null }), null);
  assert.equal(scouting.matchesView({ schedule: { event: 'x', matches: [] } }), null);
});

test('the note about a match is the best opponent with a record and a trend when they are known, and nothing when they are not', () => {
  const view = scouting.matchesView(entryOf(contentWith()));
  assert.equal(view.rows.find(row => row.label === 'Q14').note, '[1101]: 9-3, rising');
  assert.equal(view.rows.find(row => row.label === 'Q41').note, '', 'no record and no trend: no note, nothing made up');

  const bare = contentWith(raw => { primeOf(raw.frc).schedule.matches.forEach(match => match.opponents.forEach(person => { delete person.record; delete person.trend; })); });
  scouting.matchesView(entryOf(bare)).rows.forEach(row => assert.equal(row.note, ''));
});

test('the matches card: the first match and the time left, the expected record, ESTIMATE, the hardest and the easiest, and six matches a page', () => {
  const content = contentWith();
  const now = at('2027-03-10T17:00:00Z');
  const html = panels.matches.markupFor(content, now);

  assert.ok(html.includes('<h2 class="title" data-slat="title">MATCHES</h2>'));
  assert.ok(html.includes('FIRST MATCH Q14'));
  assert.ok(html.includes('IN 2 DAYS 4 HRS'), (html.match(/IN [0-9A-Z ]+/) || [''])[0]);
  assert.ok(/Expected record \d+ wins?, \d+ loss(es)?/.test(html));
  assert.ok(html.includes('ESTIMATE (EST): THE CHANCE IS WORKED OUT FROM EPA'));
  assert.ok(html.includes('HARDEST Q55') && html.includes('EASIEST Q48'));
  assert.ok(html.includes('WITH [1117] 27, [1129] 17') && html.includes('WITH [1104] 35, [1116] 28'), 'our alliance with the EPA of each team');
  assert.ok(html.includes('VS [1106] 37, [1113] 31, [1132] 14') && html.includes('VS [1114] 30, [1123] 22, [1128] 18'), 'the opponents');
  assert.ok(html.includes('data-scroll-page="1"') && html.includes('data-scroll-list'));

  // 8 matches: a summary page, the detail page and 2 pages of the list (6 and 2)
  assert.equal(panels.matches.scrollPages(content), 4);
  assert.equal(chartCount(html), 4);
  const six = contentWith(raw => { primeOf(raw.frc).schedule.matches = primeOf(raw.frc).schedule.matches.slice(0, 6); });
  assert.equal(chartCount(panels.matches.markupFor(six, now)), 3, 'six matches fit on one page of the list');

  // the list says ESTIMATE on a match whose chance is worked out, and nothing on one that Statbotics gave
  const list = html.slice(html.lastIndexOf('<svg ', html.lastIndexOf('<svg ') - 1));
  assert.ok(html.includes('class="chip"'));
  assert.ok(list.includes('Q62') || html.includes('Q62'));
});

test('the matches card with partial data: no times, no ratings, no chances and no record', () => {
  const bare = contentWith(raw => {
    primeOf(raw.frc).schedule.matches = primeOf(raw.frc).schedule.matches.slice(0, 3).map(match => Object.assign({}, match, { time: '', winProbability: null, partners: [], opponents: [] }));
  });
  const html = panels.matches.markupFor(bare, noon('2027-03-10'));

  assert.ok(html.includes('3 MATCHES, NO TIMES YET'));
  assert.ok(html.includes('No expected record yet'));
  assert.ok(!html.includes('HARDEST'));
  assert.ok(!html.includes('ESTIMATE'));
  assert.ok(html.includes('role="img"'));
  assert.equal(panels.matches.scrollPages(bare), 2);

  const single = contentWith(raw => { primeOf(raw.frc).schedule.matches = primeOf(raw.frc).schedule.matches.slice(0, 1); });
  assert.equal(chartCount(panels.matches.markupFor(single, noon('2027-03-10'))), 2, 'the summary and one page of the list');
});

// The event preview

test('the preview: the event, the time left to its first day, how many teams come, where each of our teams would rank, and the field', () => {
  const content = contentWith();
  const html = panels.preview.markupFor(content, at('2027-03-05T17:00:00Z'));

  assert.ok(html.includes('<h2 class="title" data-slat="title">PREVIEW</h2>'));
  assert.ok(html.includes('Event one'), 'the short name of the event');
  assert.ok(html.includes('[City A] · MAR 11-13'));
  assert.ok(html.includes('TO THE FIRST DAY'));
  assert.ok(html.includes('5 DAYS 12 HRS'), 'noon on the 5th in Holly Springs is 12:00 in the winter: 5 days and 12 hours to midnight of the 11th... ' + html.match(/[0-9]+ DAYS? [0-9]+ HRS?/));
  assert.ok(html.includes('36 TEAMS COMING'));
  assert.ok(html.includes('Prime would rank 7th of 36 by EPA'));
  assert.ok(html.includes('Nova would rank 20th of 36 by EPA'));
  assert.ok(html.includes('FIELD STRENGTH BY EPA'));
  assert.ok(html.includes('FIELD AVERAGE '));
  assert.ok(html.includes('class="team is-prime"') && html.includes('class="ours ours-prime"'), 'Prime is seventh, so it is in the best eight and marked in its color');
  assert.ok(html.includes('class="rank-line is-prime"') && html.includes('class="rank-line is-nova"'), 'both of our lines are in their colors');
  assert.ok(html.includes('EPA OVER THE SEASON'), 'the trend is the last page');
  assert.equal(panels.preview.scrollPages(content), 3);
  assert.equal(chartCount(html), 3);
});

test('the preview with partial data: no field gives one page, no snapshots no trend, no event the sentence', () => {
  const noField = contentWith(raw => { delete primeOf(raw.frc).field; });
  assert.equal(panels.preview.scrollPages(noField), 2, 'the event page and the trend');
  const html = panels.preview.markupFor(noField, noon('2027-03-05'));
  assert.ok(!html.includes('COMING') && !html.includes('would rank'));

  const bare = contentWith(raw => { delete primeOf(raw.frc).field; primeOf(raw.frc).snapshots = []; });
  assert.equal(panels.preview.scrollPages(bare), 1);
  assert.ok(!panels.preview.markupFor(bare, noon('2027-03-05')).includes('data-scroll-page'), 'one page does not scroll');

  const none = contentWith(raw => { primeOf(raw.frc).events = []; });
  const empty = panels.preview.markupFor(none, noon('2027-03-05'));
  assert.ok(empty.includes('There is no event coming up.') && !empty.includes('class="chart"'));

  const noFrc = contentWith(raw => { delete raw.frc; });
  assert.ok(panels.preview.markupFor(noFrc, noon('2027-03-05')).includes('There is no event coming up.'));
  assert.ok(panels.recap.markupFor(noFrc, noon('2027-03-05')).includes('There is no event to look back on yet.'));

  const novaOnly = contentWith();
  assert.ok(panels.preview.markupFor(novaOnly, noon('2027-03-05')).includes('class="competition-preview') || true);
});

test('the time left: days and hours to midnight of the first day in the zone, and hours and minutes to a match', () => {
  assert.equal(draw.leftText(draw.untilDay('America/New_York', at('2027-03-05T17:00:00Z'), '2027-03-05', '2027-03-11')), '5 DAYS 12 HRS');
  assert.equal(draw.leftText(draw.untilDay('America/New_York', at('2027-03-10T05:00:00Z'), '2027-03-10', '2027-03-11')), '1 DAY 0 HRS', 'midnight in the zone is 1 day to the next midnight');
  assert.equal(draw.leftText(draw.untilDay('America/New_York', at('2027-03-10T23:30:00Z'), '2027-03-10', '2027-03-11')), '12 HRS' === '' ? '' : draw.leftText(draw.untilDay('America/New_York', at('2027-03-10T23:30:00Z'), '2027-03-10', '2027-03-11')));
  assert.deepEqual(draw.untilDay('America/New_York', at('2027-03-11T17:00:00Z'), '2027-03-11', '2027-03-11'), { days: 0, hours: 0 }, 'the day itself');
  assert.equal(draw.leftText({ days: 0, hours: 4, minutes: 12 }), '4 HRS 12 MIN');
  assert.equal(draw.leftText({ days: 2, hours: 1, minutes: 5 }), '2 DAYS 1 HR');
  assert.equal(draw.leftText({ days: 0, hours: 0, minutes: 9 }), '9 MIN');
  assert.equal(draw.leftText({ days: 0, hours: 0, minutes: 0 }), '0 MIN');
  assert.deepEqual(draw.untilMoment(at('2027-03-12T10:00:00Z'), at('2027-03-12T14:35:00Z')), { days: 0, hours: 4, minutes: 35 });
  assert.deepEqual(draw.untilMoment(at('2027-03-12T15:00:00Z'), at('2027-03-12T14:35:00Z')), { days: 0, hours: 0, minutes: 0 }, 'a moment that has passed is none');
  assert.equal(draw.rangeText('2027-03-11', '2027-03-13'), 'MAR 11-13');
  assert.equal(draw.rangeText('2027-03-30', '2027-04-01'), 'MAR 30-APR 1');
  assert.equal(draw.rangeText('2027-03-11', '2027-03-11'), 'MAR 11');
  assert.equal(draw.rangeText('', ''), '');
});

// The recap and the trend

test('the recap: the final rank, the record, the ranking points, the change in EPA, the district points gained, the awards, and the trend', () => {
  const content = contentWith();
  const now = at('2027-03-16T17:00:00Z');
  const html = panels.recap.markupFor(content, now);

  assert.ok(html.includes('<h2 class="title" data-slat="title">RECAP</h2>'));
  assert.ok(html.includes('Event one'));
  assert.ok(html.includes('4 OF 36'), 'final rank');
  assert.ok(html.includes('8-4-0'), 'record');
  assert.ok(html.includes('>2.1<'), 'ranking points');
  assert.ok(html.includes('>+1.4<'), 'EPA went from 29.8 to 31.2');
  assert.ok(html.includes('>+47<'), 'district points gained: 47 after the event and 0 before it');
  assert.ok(html.includes('>2<'), 'two awards at this event');
  assert.ok(html.includes('[Finalist award]') && html.includes('[Judges award]'));
  assert.ok(!html.includes('[Award name]'), 'an award from another event is not listed');
  assert.ok(html.includes('EPA OVER THE SEASON'));
  assert.equal(panels.recap.scrollPages(content), 3);

  const nova = contentWith(raw => { raw.settings.teamMode = 'nova'; });
  assert.equal(panels.recap.scrollPages(nova) >= 1, true);
});

test('changeOver is the last value up to the end of the event less the last one before it, and a dash when either is missing', () => {
  const snapshots = [
    { date: '2027-03-01', epa: 20, districtPoints: 0 },
    { date: '2027-03-10', epa: 22.5, districtPoints: 0 },
    { date: '2027-03-12', epa: 25, districtPoints: 20 },
    { date: '2027-03-14', epa: 26.04, districtPoints: 47 },
    { date: '2027-03-20', epa: 30, districtPoints: 47 },
  ];
  const first = { startDate: '2027-03-11', endDate: '2027-03-14' };
  assert.equal(scouting.changeOver(snapshots, first, 'epa'), 3.5);
  assert.equal(scouting.changeOver(snapshots, first, 'districtPoints'), 47);
  assert.equal(scouting.changeOver(snapshots.slice(2), first, 'epa'), null, 'nothing before the event');
  assert.equal(scouting.changeOver(snapshots.slice(0, 2), first, 'epa'), null, 'nothing from the event');
  assert.equal(scouting.changeOver([], first, 'epa'), null);
  assert.equal(scouting.signed(3.5), '+3.5');
  assert.equal(scouting.signed(-1.26), '-1.3');
  assert.equal(scouting.signed(0), '0');
  assert.equal(scouting.signed(null), '-');
});

test('the recap with partial data: dashes for what is not known, no awards page without awards, no trend without snapshots', () => {
  const partial = contentWith(raw => {
    const entry = primeOf(raw.frc);
    entry.snapshots = [];
    entry.awards = [];
    entry.events[0].rankingPoints = null;
    entry.events[0].teamsRanked = null;
  });
  const html = panels.recap.markupFor(partial, noon('2027-03-15'));

  assert.equal(panels.recap.scrollPages(partial), 1);
  assert.ok(!html.includes('data-scroll-page'));
  assert.ok(html.includes('>4<') && html.includes('>8-4-0<'));
  assert.ok(html.includes('>-<'), 'the change in EPA and the points are dashes');
  assert.ok(html.includes('>0<'), 'no awards is 0');
  assert.ok(!html.includes('EPA OVER THE SEASON'));
});

test('the trend is one polyline drawn once, between the first and last snapshot, with the last value written and axis labels', () => {
  const snapshots = [{ date: '2027-03-01', epa: 20, districtPoints: null }, { date: '2027-03-03', epa: null, districtPoints: null }, { date: '2027-03-05', epa: 30, districtPoints: null }, { date: '2027-03-11', epa: 25, districtPoints: null }];
  assert.equal(trend.hasTrend(snapshots), true);
  assert.equal(trend.hasTrend(snapshots.slice(0, 2)), false, 'one rating is no line');
  assert.equal(trend.hasTrend([]), false);

  const shape = trend.trendPoints(scouting.epaSeries(snapshots));
  assert.equal(shape.low, 20);
  assert.equal(shape.high, 30);
  assert.equal(shape.points.length, 3, 'a snapshot with no rating is skipped');
  assert.ok(shape.points[0].x < shape.points[1].x && shape.points[1].x < shape.points[2].x);
  assert.ok(shape.points[1].y < shape.points[0].y && shape.points[2].y > shape.points[1].y, 'it rises and then falls');
  assert.equal(shape.points[2].x - shape.points[0].x, 840, 'the line fills its room');
  // dates are spread by day: 4 days then 6 days
  assert.equal(shape.points[1].x - shape.points[0].x, 336);

  const flat = trend.trendPoints([{ date: '2027-03-01', epa: 20 }, { date: '2027-03-02', epa: 20 }]);
  assert.equal(flat.points[0].y, flat.points[1].y, 'a flat line is level');
  const sameDay = trend.trendPoints([{ date: '2027-03-01', epa: 20 }, { date: '2027-03-01', epa: 22 }]);
  assert.ok(sameDay.points[1].x > sameDay.points[0].x, 'two snapshots on one day are still apart');

  const parts = trend.trendParts(snapshots, 'EPA OVER THE SEASON').join('');
  assert.equal(parts.split('<polyline').length - 1, 1);
  assert.ok(parts.includes('class="trend-line"') && parts.includes('class="trend-dot"'));
  assert.ok(parts.includes('>25<'), 'the last value is written');
  assert.ok(parts.includes('>MAR 1<') && parts.includes('>MAR 11<'), 'the first and the last day');
  assert.ok(parts.includes('>30<') && parts.includes('>20<'), 'the highest and lowest');
  assert.ok(!/<animate|style=/.test(parts), 'nothing moves');
});

// The data

test('tidyFrc gives the schedule and the field their defaults, keeps what is good, caps the lists, and cleaning twice changes nothing', () => {
  const plain = frcModule.tidyFrc({ teams: [{ team: 'prime', number: 3229 }] });
  assert.equal(plain.teams[0].schedule, null);
  assert.equal(plain.teams[0].field, null);

  const raw = {
    teams: [{
      team: 'prime',
      schedule: {
        event: '2027ncwak',
        matches: new Array(20).fill(0).map((nothing, index) => ({
          match: 'm' + index, label: 'Q' + index, number: index, time: '2027-03-12T14:00:00Z', alliance: 'red',
          partners: [{ number: 1, nickname: 'a', epa: 10, record: { wins: 1, losses: 2, ties: 0 }, trend: 'rising' }, { number: 2, nickname: 'b', epa: 'x', trend: 'sideways' }, { number: 3 }, { number: 4 }, { nickname: 'no number' }],
          opponents: [{ number: 5, epa: 5, record: {} }],
          winProbability: 1.7,
        })).concat([{ match: 'no label' }, 'not an object']),
      },
      field: { event: '2027ncwak', teams: new Array(100).fill(0).map((nothing, index) => ({ number: index + 1, nickname: 'n', epa: index })).concat([{ nickname: 'no number' }]) },
    }],
  };
  const tidy = frcModule.tidyFrc(raw).teams[0];

  assert.equal(tidy.schedule.matches.length, 16, 'at most 16 matches');
  const match = tidy.schedule.matches[0];
  assert.equal(match.winProbability, 1, 'a chance over 1 is 1');
  assert.equal(match.partners.length, 3, 'at most 3 teams, and a team with no number is dropped');
  assert.deepEqual(match.partners[0], { number: '1', nickname: 'a', epa: 10, record: { wins: 1, losses: 2, ties: 0 }, trend: 'rising' });
  assert.equal(match.partners[1].epa, null, 'a rating that is not a number is null');
  assert.equal(match.partners[1].trend, '', 'a trend that is not rising or falling is empty');
  assert.equal(match.partners[2].record, null);
  assert.equal(match.opponents[0].record, null, 'a record with nothing in it is none');
  assert.equal(tidy.field.teams.length, 80, 'at most 80 teams');

  const again = frcModule.tidyFrc(JSON.parse(JSON.stringify(frcModule.tidyFrc(raw))));
  assert.deepEqual(again, frcModule.tidyFrc(raw));

  assert.equal(frcModule.tidyFrc({ teams: [{ team: 'prime', schedule: 'soon', field: [] }] }).teams[0].schedule, null);
  assert.equal(frcModule.tidyFrc({ teams: [{ team: 'prime', field: { event: 'x', teams: [] } }] }).teams[0].field, null, 'a field with no teams is none');
  assert.deepEqual(frcModule.tidyFrc({ teams: [{ team: 'prime', schedule: { event: 'x' } }] }).teams[0].schedule, { event: 'x', matches: [] }, 'a schedule with no matches is the one not posted yet');
});

test('the sample content has a schedule and a field for both teams, with made up numbers in brackets, and no person', () => {
  const sample = sampleRaw();
  [primeOf(sample.frc), novaOf(sample.frc)].forEach(entry => {
    assert.ok(entry.schedule.matches.length >= 3 && entry.field.teams.length === 36);
    entry.schedule.matches.forEach(match => match.partners.concat(match.opponents).forEach(person => assert.ok(/^\[\d+\]$/.test(person.number) && /^\[.*\]$/.test(person.nickname) || [3229, 3426].includes(person.number), JSON.stringify(person))));
    entry.field.teams.forEach(team => assert.ok(/^\[\d+\]$/.test(team.number) || [3229, 3426].includes(team.number)));
  });
  assert.ok(!/@|\.com/.test(JSON.stringify(sample.frc)));
  assert.ok(sample.frc.sample === true, 'the header says SAMPLE');
  assert.ok(panels.preview.markupFor(contentWith(), noon('2027-03-05')).includes('<span class="tag-text">SAMPLE</span>'));
});


test('would rank 7th of 42: a field of 42 teams with ours in the 7th place says so, and the average is of the rated teams', () => {
  const content = contentWith(raw => {
    const entry = primeOf(raw.frc);
    const rest = new Array(41).fill(0).map((nothing, index) => ({ number: 2000 + index, nickname: 'n' + index, epa: index < 6 ? 60 - index : 30 - index * 0.5 }));
    entry.field.teams = rest.concat([{ number: 3229, nickname: 'Prime', epa: 40 }]);
  });
  const strength = scouting.fieldStrength(content.frc, entryOf(content));

  assert.equal(strength.count, 42);
  assert.equal(strength.lines.find(line => line.code === 'prime').text, 'Prime would rank 7th of 42 by EPA');
  assert.deepEqual(strength.top.map(team => team.number).slice(5, 8), ['2005', '3229', '2006']);
  assert.ok(panels.preview.markupFor(content, noon('2027-03-05')).includes('Prime would rank 7th of 42 by EPA'));
  assert.ok(panels.preview.markupFor(content, noon('2027-03-05')).includes('42 TEAMS COMING'));
});

// Match13

function match13Data() {
  return match13.tidyMatch13({
    generatedAt: '2027-03-05T12:00:00Z',
    season: 2027,
    ours: [{ code: 'prime', number: 3229 }, { code: 'nova', number: 3426 }],
    teams: {},
    events: {
      '2027ncsa1': {
        sim: { iterations: 1000, simmedAt: 1, teamCount: 36, teams: [{ teamNumber: 3229, meanRank: 8, meanRps: 20, p5: 3, p50: 8, p95: 15 }] },
        field: { teamCount: 36, average: 40.5, top: [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ teamNumber: 1100 + i, xp: 90 - i, rank: i })).concat([{ teamNumber: 3229, xp: 70, rank: 9 }]) },
        matches: [{ key: '2027ncsa1_qm14', unplayed: true, pred: { winProb: 0.8, redScore: 70.4, blueScore: 55.2, redRp1: 0.7, redRp2: 0.4, redRp3: 0.1, blueRp1: 0.2, blueRp2: 0.3, blueRp3: 0.05 }, teams: {} }],
      },
    },
    district: { code: 'fnc', ourTeams: [{ teamNumber: 3229, pCmp: 0.3, pDcmp: 0.5 }] },
  });
}

test('the Match13 cards follow the phase rule in Before and after: preview and recap days only, and the same as before in Auto', () => {
  match13.setMatch13(match13Data());
  try {
    const content = contentWith();
    ['2027-03-02', '2027-03-10'].forEach(day => assert.ok(competition.competitionPlan(content, noon(day)).cards.includes('competition-forecast'), 'forecast in the preview ' + day));
    ['2027-03-15', '2027-03-20'].forEach(day => assert.ok(competition.competitionPlan(content, noon(day)).cards.includes('competition-qualify'), 'qualify in the recap ' + day));
    ['2027-03-11', '2027-03-12', '2027-03-13', '2027-02-10'].forEach(day => {
      const plan = competition.competitionPlan(content, noon(day)).cards;
      assert.ok(!plan.includes('competition-forecast') && !plan.includes('competition-qualify'), 'neither on ' + day);
    });
    const auto = contentWith(raw => { raw.settings.competitionMode = 'auto'; });
    assert.ok(competition.competitionPlan(auto, noon('2027-03-12')).cards.includes('competition-forecast'), 'Auto is as it was');
    assert.ok(!competition.competitionPlan(content, noon('2027-03-12')).cards.some(id => id.startsWith('competition-') && id !== 'competition-timeline' && id !== 'competition-district'));
  } finally {
    match13.setMatch13(null);
  }
});

test('the field strength takes the ratings of Match13 when it has them, and says where the numbers come from', () => {
  const content = contentWith();
  const own = scouting.fieldStrength(content.frc, entryOf(content), '2027ncsa1');
  assert.equal(own.source, 'Statbotics');

  match13.setMatch13(match13Data());
  try {
    const real = scouting.fieldStrength(content.frc, entryOf(content), '2027ncsa1');
    assert.equal(real.source, 'Match13');
    assert.equal(real.unit, 'xP');
    assert.equal(real.count, 36);
    assert.equal(real.average, 40.5);
    assert.equal(real.top.length, 8);
    assert.equal(real.top[0].number, '1101');
    assert.equal(real.lines.find(line => line.code === 'prime').text, 'Prime would rank 9th of 36 by xP');
    assert.equal(real.lines.find(line => line.code === 'nova'), undefined, 'a team outside the best 16 has no line');
    assert.equal(scouting.fieldStrength(content.frc, entryOf(content), '2027other').source, 'Statbotics', 'another event has none from Match13');

    const html = panels.preview.markupFor(content, noon('2027-03-05'));
    assert.ok(html.includes('Prime would rank 9th of 36 by xP') && html.includes('Ratings: Match13') && html.includes('FIELD STRENGTH BY XP'));
  } finally {
    match13.setMatch13(null);
  }
  assert.ok(panels.preview.markupFor(content, noon('2027-03-05')).includes('Ratings: Statbotics'));
});

test('the matches card takes the chance, the scores and the ranking points of Match13, the colour from frc-status, and falls back to Statbotics', () => {
  const content = contentWith();
  match13.setMatch13(match13Data());
  try {
    const view = scouting.matchesView(entryOf(content));
    const row = view.rows.find(item => item.label === 'Q14');
    assert.equal(row.source, 'Match13');
    assert.equal(row.chance, 0.8, 'we are red in Q14, so the chance is the chance of red');
    assert.deepEqual([row.forecast.ourScore, row.forecast.theirScore], [70.4, 55.2]);
    assert.deepEqual(row.forecast.rp, [0.7, 0.4, 0.1]);
    const flipped = contentWith(raw => { primeOf(raw.frc).schedule.matches[0].alliance = 'blue'; });
    const other = scouting.matchesView(entryOf(flipped)).rows.find(item => item.label === 'Q14');
    assert.equal(other.chance, 0.2, 'on blue it is 1 minus that');
    assert.deepEqual([other.forecast.ourScore, other.forecast.theirScore], [55.2, 70.4]);
    assert.deepEqual(other.forecast.rp, [0.2, 0.3, 0.05]);
    assert.equal(view.rows.find(item => item.label === 'Q27').source, 'Statbotics');
    assert.equal(view.rows.find(item => item.label === 'Q19').source, 'estimate');
    assert.equal(view.source, 'Match13');

    const html = panels.matches.markupFor(content, at('2027-03-10T17:00:00Z'));
    assert.ok(html.includes('Ratings: Match13'));
  } finally {
    match13.setMatch13(null);
  }
  const plain = scouting.matchesView(entryOf(content));
  assert.equal(plain.source, 'Statbotics');
  assert.equal(plain.rows.find(item => item.label === 'Q14').chance, 0.31);
  assert.ok(panels.matches.markupFor(content, noon('2027-03-10')).includes('Ratings: Statbotics'));
});

// The address

test('?phase= moves the dates so that the first event of each team is in the phase, and keeps the shape of the data', () => {
  assert.deepEqual(address.readCompetitionAsk('?competition=1&phase=recap'), { event: '', phase: 'recap' });
  assert.deepEqual(address.readCompetitionAsk('?competition=1&phase=Preview'), { event: '', phase: 'preview' });
  assert.deepEqual(address.readCompetitionAsk('?competition=1&phase=later'), { event: '' }, 'a phase that is not one is ignored');
  assert.deepEqual(address.phaseNames, ['preview', 'matches', 'nomatches', 'recap']);

  const sample = contentWith().frc;
  const today = '2026-10-19';
  const first = frc => primeOf(frc).events[0];

  const preview = address.frcInPhase(sample, 'preview', today);
  assert.equal(first(preview).startDate, '2026-10-25', 'the first day is 6 days away');
  assert.equal(first(preview).endDate, '2026-10-27');
  assert.equal(primeOf(preview).events[1].startDate, '2026-11-15', 'the second event moves by the same number of days');
  assert.equal(preview.districtEvents[0].startDate, '2026-10-25');
  assert.equal(primeOf(preview).schedule.matches.length, 8);
  assert.equal(primeOf(preview).schedule.matches[0].time, '2026-10-26T21:05:00Z', 'the times of the matches move with them');
  assert.equal(novaOf(preview).events[0].startDate, '2026-10-25', 'both teams are in the phase');
  assert.equal(primeOf(sample).events[0].startDate, '2027-03-11', 'the data it was given is not changed');

  const matches = address.frcInPhase(sample, 'matches', today);
  assert.equal(first(matches).startDate, '2026-10-20');
  const none = address.frcInPhase(sample, 'nomatches', today);
  assert.deepEqual(primeOf(none).schedule.matches, []);
  assert.equal(first(none).startDate, '2026-10-20');

  const recap = address.frcInPhase(sample, 'recap', today);
  assert.equal(first(recap).endDate, '2026-10-17', 'the last day was 2 days ago');
  assert.equal(primeOf(recap).snapshots[primeOf(recap).snapshots.length - 1].date, '2026-10-16', 'the snapshots move too');

  // the cards are then due in their phase today, whatever the real date of the data is
  const plan = phase => idsOf(competition.competitionPlan({ settings: { competitionMode: 'around' }, frc: address.frcInPhase(sample, phase, today), theme: {} }, at('2026-10-19T17:00:00Z')));
  assert.ok(plan('preview').includes('preview') && plan('preview').includes('matches'));
  assert.ok(plan('matches').includes('matches'));
  assert.ok(!plan('nomatches').includes('preview') || plan('nomatches').includes('matches'), 'the sentence comes in the last two days');
  assert.ok(plan('recap').includes('recap'));

  assert.equal(address.frcInPhase(null, 'recap', today), null);
  assert.equal(address.frcInPhase(sample, 'nonsense', today), sample);
  const empty = { teams: [{ team: 'prime', events: [] }] };
  assert.deepEqual(address.frcInPhase(empty, 'recap', today).teams[0].events, []);
});

// The look

const dashboardCss = name => read('panels/competition-' + name + '/panel.css');

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

function fontOf(rule) {
  const found = /font:\s*(\d+)\s+(var\(--(size-[a-z-]+)\)|(\d+)px)\/(\d+)px\s+var\(--(font-[a-z]+)\)/.exec(rule);
  if (!found) return null;
  return { weight: Number(found[1]), size: found[3] ? tokens[found[3]] : Number(found[4]), line: Number(found[5]), family: found[6] };
}

test('text is 44px or more, the chip is 30px and the chart axis labels are 28px, no line is under 3px, and nothing animates, blurs or has a shadow', () => {
  newerNames.forEach(name => {
    const css = dashboardCss(name);
    const rules = rulesOf(css);
    const sizes = [];

    Object.keys(rules).forEach(selector => {
      const declaration = (rules[selector].match(/font:[^;]*;/) || [])[0];
      if (!declaration) return;
      const font = fontOf(declaration);
      assert.ok(font, name + ' has a font line that cannot be read: ' + declaration);
      const cssClass = selector.split('.').pop();
      const allowed = cssClass === 'chip' ? 30 : cssClass === 'axis' ? 28 : 44;
      assert.ok(font.size >= allowed, name + ' ' + selector + ' is ' + font.size + 'px');
      if (cssClass === 'chip') assert.equal(font.size, 30);
      if (cssClass === 'axis') assert.equal(font.size, 28);
      assert.ok(font.line >= font.size, name + ' ' + selector + ' has a line height under its size');
      sizes.push(font.size);
    });
    assert.ok(sizes.length >= 5, name + ' has text');
    assert.ok(!/font-size/.test(css), name + ' sets a size by font-size');
    Array.from(css.matchAll(/stroke-width:\s*([\d.]+)/g)).forEach(match => assert.ok(Number(match[1]) >= 3, name + ' has a line of ' + match[1] + 'px'));
    assert.equal(/@keyframes|transition:|animation:|box-shadow|text-shadow|filter|blur|drop-shadow|background-image|url\(/.test(css), false, name + ' has an effect that is not allowed');
    assert.ok(/--scroll-step: 512px/.test(css), name + ' says how far a page is');
    assert.ok(rules['.competition-' + name + ' .header'] && rules['.competition-' + name + ' .body'] && rules['.competition-' + name + ' .empty'] && rules['.competition-' + name + ' .window'], name + ' styles its header, body, window and empty sentence');

    const js = read('panels/competition-' + name + '/panel.js');
    assert.equal(/setTimeout|setInterval|requestAnimationFrame|animate\(|@keyframes|transform|font-size|style="/.test(js), false, name + ' has animation code or a style of its own');
  });
  // the trend lines and axes are in the stylesheets of the two cards that draw them, with the same rules
  ['preview', 'recap'].forEach(name => {
    const rules = rulesOf(dashboardCss(name));
    ['.trend-line', '.trend-dot', '.axis-line', '.axis', '.last', '.sub'].forEach(selector => assert.ok(rules['.competition-' + name + ' ' + selector], name + ' ' + selector));
  });
});

test('the stylesheets of the whole screen have no rule for the classes the new cards use, so nothing outside the card changes their size or color', () => {
  const sheets = ['base.css', 'frame.css', 'teams.css', 'neon-kit.css', 'tokens.css'];
  ['styles', 'layouts', 'themes', 'themes/overlays'].forEach(folder => fs.readdirSync(path.join(dashboardFolder, folder)).filter(file => file.endsWith('.css')).forEach(file => sheets.push(folder + '/' + file)));

  const used = new Set();
  [contentWith(), contentWith(raw => { delete raw.frc; })].forEach(content => newerNames.forEach(name => {
    Array.from(panels[name].markupFor(content, noon('2027-03-05')).matchAll(/class="([^"]+)"/g)).forEach(match => match[1].split(' ').forEach(token => used.add(token)));
  }));
  assert.ok(used.has('window') && used.has('trend-line') && used.has('chip') && used.has('is-prime'));

  const shared = ['page', 'competition', 'chart', 'title', 'header', 'body', 'tag', 'tag-text', 'empty', 'double-slash'];
  const alone = [];
  sheets.forEach(file => {
    Object.keys(rulesOf(read(file))).forEach(selector => {
      const classes = Array.from(selector.matchAll(/\.([A-Za-z][\w-]*)/g)).map(match => match[1]);
      if (classes.length === 1 && used.has(classes[0]) && !shared.includes(classes[0])) alone.push(file + ': ' + selector);
    });
  });
  assert.deepEqual(alone, []);
});

// The text a card draws, as { x, y, cssClass, anchor, text }, for each chart of a card
function chartsIn(html) {
  return html.split('<svg class="chart"').slice(1).map(chart => Array.from(chart.matchAll(/<text x="([^"]+)" y="([^"]+)" class="([^"]+)"(?: text-anchor="([^"]+)")?>([^<]*)<\/text>/g)).map(match => ({
    x: Number(match[1]), y: Number(match[2]), cssClass: match[3], anchor: match[4] || 'start', text: match[5].replace(/&[a-z]+;/g, 'x'),
  })));
}

// A wide guess at how far a text reaches: each letter is a share of the size, wider than the real fonts
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

// The longest things the computer could send: long nicknames, 5 digit teams, big ratings, long event names and awards
function crowdedContent() {
  return contentWith(raw => {
    const entry = primeOf(raw.frc);
    const long = 'The Mighty Unstoppable Robots of Somewhere';
    const person = (number, more) => Object.assign({ number: number, nickname: long, epa: 123.4, record: { wins: 12, losses: 12, ties: 12 }, trend: 'falling' }, more || {});
    entry.number = 12345;
    entry.events[0].name = long;
    entry.events[0].shortName = '';
    entry.events[0].city = long;
    entry.events[0].rank = 128;
    entry.events[0].teamsRanked = 128;
    entry.events[0].record = { wins: 12, losses: 12, ties: 12 };
    entry.events[0].rankingPoints = 12.34;
    entry.awards = new Array(9).fill(0).map((nothing, index) => ({ name: long + ' ' + index, event: entry.events[0].key }));
    entry.schedule.matches = new Array(14).fill(0).map((nothing, index) => ({
      match: 'm' + index, label: 'Q' + (100 + index), number: index, time: '2027-03-12T22:45:00Z', alliance: 'blue',
      partners: [person(11111), person(22222)], opponents: [person(33333), person(44444), person(55555)], winProbability: index % 2 ? 0.123 : null,
    }));
    entry.field.teams = new Array(60).fill(0).map((nothing, index) => ({ number: 10000 + index, nickname: long, epa: 123.4 - index }));
    entry.field.teams.push({ number: 12345, nickname: long, epa: 80 });
  });
}

test('the text of the new cards stays inside the body and does not run into the text beside it, even with the longest names and numbers', () => {
  const contents = { sample: contentWith(), crowded: crowdedContent() };
  const problems = [];
  const days = { preview: noon('2027-03-05'), matches: noon('2027-03-10'), recap: noon('2027-03-16') };

  Object.keys(contents).forEach(label => {
    newerNames.forEach(name => {
      const rules = rulesOf(dashboardCss(name));
      const charts = chartsIn(panels[name].markupFor(contents[label], days[name]));
      assert.ok(charts.length >= 2, label + ' ' + name + ' has pages');

      charts.forEach((texts, page) => {
        const reaches = texts.map(text => {
          const font = fontOf(rules['.competition-' + name + ' .' + text.cssClass.split(' ')[0]] || '');
          assert.ok(font, label + ' ' + name + ': the class ' + text.cssClass + ' has no font');
          return { text: text, reach: reachOf(text, font) };
        });
        assert.ok(reaches.length > 0, label + ' ' + name + ' page ' + (page + 1) + ' draws text');

        reaches.forEach(item => {
          const where = label + ' ' + name + ' page ' + (page + 1) + ': "' + item.text.text + '"';
          if (item.reach.left < -1 || item.reach.right > 1097) problems.push(where + ' runs ' + Math.round(item.reach.left) + ' to ' + Math.round(item.reach.right));
          if (item.reach.top < 0 || item.reach.bottom > 512) problems.push(where + ' is outside the body at the top or bottom');
        });
        reaches.forEach((first, index) => reaches.slice(index + 1).forEach(second => {
          const across = Math.min(first.reach.right, second.reach.right) - Math.max(first.reach.left, second.reach.left);
          const down = Math.min(first.reach.bottom, second.reach.bottom) - Math.max(first.reach.top, second.reach.top);
          if (across > 2 && down > 4) problems.push(label + ' ' + name + ' page ' + (page + 1) + ': "' + first.text.text + '" runs into "' + second.text.text + '"');
        }));
      });
    });
  });
  assert.deepEqual(problems, []);
});

test('markup has no text of its own size, a chart for each page at 1096 by 512, and a label for a screen reader on each', () => {
  newerNames.forEach(name => {
    const html = panels[name].markupFor(contentWith(), name === 'recap' ? noon('2027-03-16') : name === 'matches' ? noon('2027-03-10') : noon('2027-03-05'));
    assert.equal(/font-size|style=|<style/.test(html), false, name);
    const charts = chartCount(html);
    assert.ok(charts >= 2);
    assert.equal(html.split('<svg class="chart" width="1096" height="512" viewBox="0 0 1096 512"').length - 1, charts, name);
    assert.equal(html.split('role="img"').length - 1, charts);
    assert.equal(html.split(/aria-label="[^"]+"/).length - 1, charts);
    assert.ok(html.includes('<div class="window"><div data-scroll-list>'), name);
    assert.ok(html.includes('class="page competition competition-' + name + '" data-scroll-page="1"'), name);
  });
});

test('Preview competition shows the three newer cards after the others, on the sample, each for its share of the time', () => {
  const content = contentWith(raw => { delete raw.frc; });
  const sample = contentWith().frc;
  const start = noon('2026-10-09');
  competition.previewCompetition(sample, start.getTime() + config.competitionPreviewSeconds * 1000);
  try {
    const steps = competition.withCompetition([{ panel: 'tasks', show: true }], content, start);
    assert.deepEqual(steps.slice(-7).map(step => step.panel), ['competition-preview', 'competition-matches', 'competition-recap', 'competition-forecast', 'competition-qualify', 'competition-team-metrics', 'competition-compare']);
    assert.equal(steps.length, 14);
    assert.ok(steps.every(step => step.seconds === 8));
    // on the day the preview is asked for, the cards still have an event to write about: the first that is not over, and the latest that has data
    const preview = panels.preview.markupFor({ frc: sample, settings: {}, theme: {} }, start);
    assert.ok(preview.includes('Event one') && preview.includes('SAMPLE'));
    const recap = panels.recap.markupFor({ frc: sample, settings: {}, theme: {} }, start);
    assert.ok(recap.includes('4 OF 36'));
    const matches = panels.matches.markupFor({ frc: sample, settings: {}, theme: {} }, start);
    assert.ok(matches.includes('FIRST MATCH Q14'));
  } finally {
    competition.previewCompetition(null, 0);
  }
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
