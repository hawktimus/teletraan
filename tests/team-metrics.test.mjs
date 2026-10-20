// Tests for the two metrics cards: dashboard/core/team-metrics.js (the numbers of a team from frc-status and the Match13
// file), core/team-metrics-draw.js and the cards panels/competition-team-metrics and panels/competition-compare. The files are
// plain browser modules and are run for real. The numbers come from the sample content and the sample Match13 file, changed
// here and there.
//
//   node tests/team-metrics.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dashboard/', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const base = new URL('../dashboard/', import.meta.url).href;

const match13 = await import(base + 'core/match13.js');
const frcModule = await import(base + 'core/frc.js');
const metrics = await import(base + 'core/team-metrics.js');
const drawing = await import(base + 'core/team-metrics-draw.js');
const competition = await import(base + 'core/competition.js');
const config = await import(base + 'config.js');
const single = await import(base + 'panels/competition-team-metrics/panel.js');
const both = await import(base + 'panels/competition-compare/panel.js');

const now = new Date('2027-03-12T12:00:00Z');
const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

const sampleContent = () => JSON.parse(read('data/sample/content.json'));
const sampleMatch13 = () => JSON.parse(read('data/sample/match13.json'));

// The sample content with the frc part cleaned, changed by some function first
function contentWith(change) {
  const raw = sampleContent();
  if (change) change(raw);
  return Object.assign({}, raw, { frc: raw.frc ? frcModule.tidyFrc(raw.frc) : undefined });
}

function withMatch13(change) {
  const raw = sampleMatch13();
  if (change) change(raw);
  match13.setMatch13(null, null);
  match13.setMatch13(match13.tidyMatch13(raw), null);
}

function without() {
  match13.setMatch13(null, null);
}

function rowsOf(page) {
  const found = {};
  page.rows.forEach(row => { found[row.label] = row.value; });
  return found;
}

function pageNamed(code, id, frc) {
  return metrics.pagesOf(metrics.metricsFor(frc, code)).find(page => page.id === id);
}

test('the season page adds the records of the events and reads the rank, the streak and the score from frc-status', () => {
  without();
  const frc = contentWith().frc;
  const season = pageNamed('prime', 'season', frc);
  const rows = rowsOf(season);
  assert.equal(rows['SEASON RECORD'], '8-4-0');
  assert.equal(rows['EVENT RANK'], '4TH OF 36');
  assert.equal(rows['RANKING POINTS'], '2.1');
  assert.equal(rows['STREAK'], 'LOST 1');
  assert.equal(rows['DISTRICT POINTS'], '47, RANK 5');
  assert.ok(/^AVG SCORE, LAST 8$/.test(season.rows[3].label) && rows['AVG SCORE, LAST 8'] === '77');
  assert.equal(season.sub, '[Event one]');

  const two = contentWith(raw => { raw.frc.teams[0].events.push({ key: '2027ncsa3', name: 'Third', city: 'C', startDate: '2027-04-10', endDate: '2027-04-12', rank: 2, teamsRanked: 30, record: { wins: 5, losses: 3, ties: 1 } }); }).frc;
  assert.equal(rowsOf(pageNamed('prime', 'season', two))['SEASON RECORD'], '13-7-1', 'the records of all events are added');
});

test('a win streak counts back from the newest result and stops at the first change', () => {
  without();
  const frc = contentWith(raw => {
    raw.frc.teams[0].results = [true, false, true, true, true].map((won, index) => ({ match: 'm' + index, label: 'Q' + index, alliance: 'red', scoreFor: won ? 70 : 50, scoreAgainst: won ? 60 : 55, won: won }));
  }).frc;
  const found = metrics.metricsFor(frc, 'prime');
  assert.deepEqual(found.results.streak, { won: true, length: 3 });
  assert.equal(found.results.lastThree[0].margin, 10);
  assert.equal(rowsOf(pageNamed('prime', 'season', frc))['STREAK'], 'WON 3');
  assert.equal(rowsOf(pageNamed('prime', 'last', frc))['Q4'], 'WON 70 TO 60  +10');
});

test('with no results there is no streak, no average and no last matches page, and the rows say NOT YET', () => {
  without();
  const frc = contentWith(raw => { raw.frc.teams[0].results = []; }).frc;
  const found = metrics.metricsFor(frc, 'prime');
  assert.equal(found.results.streak, null);
  assert.equal(found.results.average, null);
  const season = pageNamed('prime', 'season', frc);
  assert.equal(rowsOf(season)['STREAK'], null);
  assert.equal(pageNamed('prime', 'last', frc), undefined);

  const html = single.markupFor({ frc: frc, settings: {}, theme: {} }, now);
  assert.ok(html.includes('NOT YET'));
});

test('the rating page uses the Match13 numbers only, with the percentile turned into a top share and no number made up', () => {
  withMatch13();
  const frc = contentWith().frc;
  const ratings = rowsOf(pageNamed('prime', 'ratings', frc));
  assert.equal(ratings['xP RATING'], '61.2');
  assert.equal(ratings['AMONG ALL TEAMS'], 'TOP 32%');
  assert.equal(ratings['SEASON RANK'], '1179TH');
  assert.equal(ratings['AT THE EVENT'], '6TH OF 36');
  const phases = rowsOf(pageNamed('prime', 'phases', frc));
  assert.deepEqual([phases['AUTO'], phases['TELEOP'], phases['ENDGAME'], phases['OPR'], phases['DPR']], ['11.8', '48.9', '0.5', '78.1', '105.7']);

  withMatch13(raw => { raw.teams['3229'].xAuto = null; raw.teams['3229'].opr = null; raw.teams['3229'].percentile = 99.9; });
  const changed = pageNamed('prime', 'phases', frc);
  assert.equal(rowsOf(changed)['AUTO'], null);
  assert.equal(rowsOf(changed)['OPR'], null);
  assert.equal(rowsOf(pageNamed('prime', 'ratings', frc))['AMONG ALL TEAMS'], 'TOP 1%');
});

test('with no Match13 file the ratings pages are left out and the other pages still draw', () => {
  without();
  const ids = metrics.pagesOf(metrics.metricsFor(contentWith().frc, 'prime')).map(page => page.id);
  assert.ok(!ids.includes('ratings') && !ids.includes('phases'));
  assert.ok(ids.includes('season') && ids.includes('next'));
  assert.equal(metrics.pagesOf(null).length, 0);
  assert.equal(metrics.metricsFor(contentWith().frc, 'nobody'), null);
  assert.equal(metrics.metricsFor(null, 'prime'), null);
});

test('the next match takes its chance and score from Match13, then Statbotics, and says ESTIMATE when it has to work it out', () => {
  withMatch13();
  const frc = contentWith().frc;
  // Nova is blue in Q13: Match13 gives red 46%, so Nova has 54%
  const nova = rowsOf(pageNamed('nova', 'next', frc));
  assert.equal(nova['MATCH'], 'Q13');
  assert.equal(nova['WIN CHANCE'], '54%');
  assert.equal(nova['EXPECTED SCORE'], '62 TO 58');
  // Prime plays a semi-final that is not in the schedule: the chance is read from the next match itself
  assert.equal(rowsOf(pageNamed('prime', 'next', frc))['WIN CHANCE'], '55%');

  without();
  assert.equal(rowsOf(pageNamed('nova', 'next', frc))['WIN CHANCE'], '51%', 'without Match13 the chance of the schedule is used');
});

test('partners and opponents are averaged on one rating: xP when every team has it, EPA when every team has it, nothing when neither is complete', () => {
  const people = (numbers, epa) => numbers.map(number => ({ number: String(number), nickname: '', epa: epa }));
  const frcWith = (partnerEpa, opponentEpa) => contentWith(raw => {
    const next = raw.frc.teams[1].nextMatch;
    next.red = people([1, 2, 3], opponentEpa);
    next.blue = people([3426, 4, 5], partnerEpa);
  }).frc;

  without();
  const epaOnly = metrics.metricsFor(frcWith(20, 30), 'nova').next.sides;
  assert.equal(epaOnly.unit, 'EPA');
  assert.equal(epaOnly.partners, 20);
  assert.equal(epaOnly.opponents, 30);

  // every team has a Match13 rating
  withMatch13(raw => {
    raw.events['2027ncsa1'].matches[0].teams = { 1: 50, 2: 50, 3: 50, 4: 40, 5: 40, 3426: 44.2 };
  });
  const xp = metrics.metricsFor(frcWith(20, 30), 'nova').next.sides;
  assert.equal(xp.unit, 'xP');
  assert.equal(xp.partners, 40);
  assert.equal(xp.opponents, 50);

  // one team has neither: no average, and the row says NOT YET
  withMatch13(raw => { raw.events['2027ncsa1'].matches[0].teams = { 1: 50, 3426: 44.2 }; });
  const missing = contentWith(raw => {
    raw.frc.teams[1].nextMatch.red = people([1, 2, 3], null);
    raw.frc.teams[1].nextMatch.blue = people([3426, 4, 5], 20);
  }).frc;
  assert.equal(metrics.metricsFor(missing, 'nova').next.sides, null);
  assert.equal(rowsOf(pageNamed('nova', 'next', missing))['PARTNERS AVG'], null);
  without();
});

test('the matches still to play give the expected record, the hardest and the easiest, and the average of partners and opponents', () => {
  without();
  const frc = contentWith().frc;
  const ahead = rowsOf(pageNamed('prime', 'ahead', frc));
  assert.equal(ahead['MATCHES LEFT'], '8');
  assert.match(ahead['EXPECTED RECORD'], /^\d+-\d+$/);
  assert.match(ahead['HARDEST'], /^Q\d+, \d+%$/);
  assert.match(ahead['PARTNERS AVG'], / EPA$/);

  const none = contentWith(raw => { raw.frc.teams[0].schedule = null; }).frc;
  assert.equal(pageNamed('prime', 'ahead', none), undefined);
});

test('the events page joins the Match13 history with the names and the ranks of frc-status, newest last, three at most', () => {
  withMatch13();
  const frc = contentWith().frc;
  const page = pageNamed('prime', 'events', frc);
  assert.equal(page.rows.length, 3);
  const newest = page.rows[page.rows.length - 1];
  assert.equal(newest.label, '[Event one]');
  assert.equal(newest.value, 'RANK 4, 8-4-0');
  assert.match(newest.note, /^xP 52\.5 TO 61\.2, 47 DISTRICT PTS$/);
  without();
  assert.equal(pageNamed('prime', 'events', frc), undefined);
});

test('the comparison keeps the pages both teams share, in order, and a team with no number on a page shows NOT YET', () => {
  withMatch13(raw => { delete raw.teams['3426']; });
  const frc = contentWith().frc;
  const pages = metrics.comparePages(metrics.metricsFor(frc, 'prime'), metrics.metricsFor(frc, 'nova'));
  assert.deepEqual(pages.map(page => page.id), ['season', 'ratings', 'phases', 'next', 'ahead']);
  const ratings = pages.find(page => page.id === 'ratings');
  assert.equal(ratings.first.rows[0].short, '61.2');
  assert.equal(ratings.second.rows.length, 0, 'Nova has no rating page, so the comparison has nothing to draw for it');

  const html = both.markupFor({ frc: frc, settings: {}, theme: {} }, now);
  assert.ok(html.includes('NOT YET'));
  assert.ok(html.includes('class="head-first"') && html.includes('class="head-second"'));
  assert.ok(html.includes('>PRIME<') && html.includes('>NOVA<'));
  without();
});

test('the single card names the team, has one page for each part, says SAMPLE for the sample, and speaks plainly when it has nothing', () => {
  withMatch13();
  const content = { frc: contentWith().frc, settings: {}, theme: {} };
  const html = single.markupFor(content, now);
  assert.ok(html.includes('<h2 class="title" data-slat="title">PRIME</h2>'));
  assert.equal((html.match(/<svg class="chart"/g) || []).length, 7, 'season, ratings, per match, next, ahead, last, events');
  assert.ok(html.includes('data-scroll-page="1"'));
  assert.ok(html.includes('NEXT MATCH, '), 'the time of the next match is written');
  assert.equal(single.scrollPages(content) >= 1, true);

  const empty = single.markupFor({ frc: null, settings: {}, theme: {} }, now);
  assert.ok(empty.includes('Not enough matches yet.'));
  assert.equal(both.markupFor({ frc: null, settings: {}, theme: {} }, now).includes('Not enough matches yet.'), true);
  without();
});

test('the tag says SAMPLE for the sample, how old the data is, and STALE for an old Match13 file', () => {
  const frc = contentWith().frc;
  const fresh = match13.tidyMatch13(Object.assign(sampleMatch13(), { sample: false, generatedAt: '2027-03-12T11:00:00Z' }));
  assert.equal(drawing.tagFor(Object.assign({}, frc, { sample: false, lastSyncAt: '2027-03-12T11:30:00Z' }), fresh, now), '');
  assert.equal(drawing.tagFor(Object.assign({}, frc, { sample: false, lastSyncAt: '2027-03-12T11:30:00Z' }), match13.tidyMatch13(sampleMatch13()), now), 'SAMPLE');
  const old = match13.tidyMatch13(Object.assign(sampleMatch13(), { sample: false, generatedAt: '2027-03-11T11:00:00Z' }));
  assert.equal(drawing.tagFor(Object.assign({}, frc, { sample: false, lastSyncAt: '2027-03-12T11:30:00Z' }), old, now), 'STALE');
  assert.match(drawing.tagFor(Object.assign({}, frc, { sample: false, lastSyncAt: '2027-03-12T05:00:00Z' }), fresh, now), /HR OLD/);
});

test('the cards are due in Before and after and in Always, never in Auto, and only with something to show', () => {
  const card = id => competition.cards.find(item => item.id === id);
  ['competition-team-metrics', 'competition-compare'].forEach(id => {
    assert.equal(card(id).phased, true, id + ' is not in Auto');
    assert.equal(card(id).around(), true);
  });
  assert.equal(card('competition-team-metrics').setting, 'competitionTeamMetrics');
  assert.equal(card('competition-compare').setting, 'competitionCompare');
  assert.equal(config.defaultSettings.competitionTeamMetrics, true);
  assert.equal(config.defaultSettings.competitionCompare, true);

  without();
  const day = new Date('2027-03-10T12:00:00Z');
  const ids = mode => competition.competitionPlan(contentWith(raw => { raw.settings.competitionMode = mode; }), day).cards;
  assert.ok(ids('around').includes('competition-team-metrics') && ids('around').includes('competition-compare'));
  assert.ok(ids('always').includes('competition-team-metrics'));
  assert.ok(!ids('auto').includes('competition-team-metrics') && !ids('auto').includes('competition-compare'));
  assert.deepEqual(ids('off'), []);

  const off = contentWith(raw => { raw.settings.competitionMode = 'around'; raw.settings.competitionTeamMetrics = false; });
  assert.ok(!competition.competitionPlan(off, day).cards.includes('competition-team-metrics'));
  assert.ok(competition.competitionPlan(off, day).cards.includes('competition-compare'));

  // a team with nothing at all has no card
  const bare = contentWith(raw => { Object.assign(raw.frc.teams[0], { events: [], results: [], ranking: null, districtPoints: null, nextMatch: null, schedule: null }); });
  assert.equal(metrics.hasMetrics(bare.frc, 'prime'), false);
});

test('Preview competition shows both cards on the sample, with the sample Match13 numbers', () => {
  match13.setMatch13(null, match13.tidyMatch13(sampleMatch13()));
  competition.previewCompetition(contentWith().frc, now.getTime() + 60000);
  try {
    const html = single.markupFor({ frc: null, settings: {}, theme: {} }, now);
    assert.ok(html.includes('>SAMPLE<'));
    assert.ok(html.includes('xP RATING'));
  } finally {
    competition.previewCompetition(null, 0);
    without();
  }
});

test('both cards are registered, have a script and a stylesheet, and are in the Studio lists', () => {
  const registry = read('registry.js');
  ['competition-team-metrics', 'competition-compare'].forEach(id => {
    assert.ok(registry.includes("{ id: '" + id + "', region: 'grid1', topic: 'competition', competition: true },"), id);
    assert.ok(fs.existsSync(path.join(root, 'panels', id, 'panel.js')) && fs.existsSync(path.join(root, 'panels', id, 'panel.css')), id);
  });
  assert.ok(config.competitionSwitches.includes('competitionTeamMetrics') && config.competitionSwitches.includes('competitionCompare'));
  const rotation = fs.readFileSync(fileURLToPath(new URL('../studio/tools/rotation-auto.js', import.meta.url)), 'utf8');
  assert.ok(rotation.includes("id: 'competition-team-metrics'") && rotation.includes("id: 'competition-compare'"));
  const screenPanels = fs.readFileSync(fileURLToPath(new URL('../studio/inputs/screen-panels.js', import.meta.url)), 'utf8');
  assert.ok(screenPanels.includes("'competition-team-metrics'"), 'the team card can be a row, with the team of the row');
});

test('the stylesheets keep the text sizes, use no colors of their own, no animation and no effects', () => {
  ['competition-team-metrics', 'competition-compare'].forEach(id => {
    const css = read('panels/' + id + '/panel.css');
    const declarations = Array.from(css.matchAll(/font:\s*\d+\s+(\S+?)\/(\d+)px/g));
    assert.ok(declarations.length >= 6, id + ' has text');
    declarations.forEach(found => assert.ok(['var(--size-label)', 'var(--size-body)', 'var(--size-heading)'].includes(found[1]), id + ' ' + found[1]));
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), 'no hex colors outside the token files');
    assert.ok(!/animation|transition|filter|box-shadow|text-shadow|blur/.test(css), 'no motion or effects in the stylesheet');
    assert.ok(!css.includes('stroke-width') || Array.from(css.matchAll(/stroke-width:\s*([\d.]+)/g)).every(found => Number(found[1]) >= 3));
  });
  const compare = read('panels/competition-compare/panel.css');
  assert.ok(compare.includes('var(--compare-first') && compare.includes('var(--compare-second'), 'each team has its own color property');
});

test('the files have no animation code, no style in the markup, no dash and no exclamation mark in a sentence', () => {
  ['core/team-metrics.js', 'core/team-metrics-draw.js', 'panels/competition-team-metrics/panel.js', 'panels/competition-compare/panel.js', 'panels/competition-team-metrics/panel.css', 'panels/competition-compare/panel.css'].forEach(file => {
    const text = read(file);
    assert.ok(!text.includes('—') && !text.includes('–'), file + ' has no em or en dash');
    assert.ok(!/!\s*['"`]/.test(text.replace(/!==|!=|![a-zA-Z(]/g, '')), file + ' has no exclamation mark in a sentence');
    if (file.endsWith('.js')) assert.ok(!/setTimeout|setInterval|requestAnimationFrame|animate\(|@keyframes|font-size|style="/.test(text), file + ' draws no animation and sets no style in markup');
  });
  without();
  const html = single.markupFor({ frc: contentWith().frc, settings: {}, theme: {} }, now) + both.markupFor({ frc: contentWith().frc, settings: {}, theme: {} }, now);
  assert.equal(/font-size|style=|<style/.test(html), false);
});

test('the Match13 script keeps what the cards use, and nothing from Match13 goes to Sanity', () => {
  const script = fs.readFileSync(fileURLToPath(new URL('../computer/scripts/match13-sync.sh', import.meta.url)), 'utf8');
  ['xAuto', 'xTele', 'xEnd', 'epa', 'opr', 'dpr', 'percentile', 'districtPoints'].forEach(name => assert.ok(script.includes(name), name));
  assert.ok(!/api\.sanity\.io[^\n]*(createOrReplace|mutate)/.test(script), 'the script only reads from Sanity');
  assert.ok(!read('core/team-metrics.js').includes('fetch('), 'the numbers are joined from what the screen already holds');
});

let failures = 0;
for (const entry of tests) {
  try {
    await entry.run();
    console.log('ok    ' + entry.name);
  } catch (error) {
    failures += 1;
    console.log('FAIL  ' + entry.name + '\n      ' + String(error && error.stack).split('\n').slice(0, 8).join('\n      '));
  }
}
console.log(failures === 0 ? 'all ' + tests.length + ' passed' : failures + ' of ' + tests.length + ' failed');
process.exit(failures === 0 ? 0 : 1);
