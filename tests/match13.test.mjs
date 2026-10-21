// Tests for the Match13 forecasts on the screen: dashboard/core/match13.js (the cleaning of match13.json, the
// stale rule, the reader and the two helpers other cards use), core/match13-draw.js and the two cards
// panels/competition-forecast and panels/competition-qualify. The files are plain browser modules and are run
// for real. The numbers come from the sample in dashboard/data/sample/match13.json, changed here and there.
//
//   node tests/match13.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dashboard/', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sampleRaw = () => JSON.parse(read('data/sample/match13.json'));
const base = new URL('../dashboard/', import.meta.url).href;

const match13 = await import(base + 'core/match13.js');
const draw = await import(base + 'core/match13-draw.js');
const competition = await import(base + 'core/competition.js');
const config = await import(base + 'config.js');
const forecast = await import(base + 'panels/competition-forecast/panel.js');
const qualify = await import(base + 'panels/competition-qualify/panel.js');

const now = new Date('2026-01-01T06:00:00Z');
const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

function tidy(change) {
  const raw = sampleRaw();
  if (change) change(raw);
  return match13.tidyMatch13(raw);
}

test('the sample file is marked as a sample and cleans to the whole shape', () => {
  const data = tidy();
  assert.equal(data.sample, true);
  assert.deepEqual(Object.keys(data).sort(), ['district', 'events', 'generatedAt', 'ours', 'sample', 'season', 'teams']);
  assert.deepEqual(data.ours.map(team => team.number), [3229, 3426]);
  assert.equal(data.teams['3229'].xp, 61.17);
  assert.ok(data.events['2026ncash'].sim.teams.every(row => ['teamNumber', 'meanRank', 'meanRps', 'p5', 'p50', 'p95'].every(name => typeof row[name] === 'number')));
  assert.ok(data.events['2026ncash'].matches.length >= 1);
  assert.equal(data.district.cmpCutline.q50, 231);
});

test('a file that is not one, or has no time, gives nothing, and the cleaning never throws on rubbish', () => {
  [null, undefined, 5, 'x', [], {}, { generatedAt: 'soon' }, { generatedAt: 7 }].forEach(raw => assert.equal(match13.tidyMatch13(raw), null));
  const wild = match13.tidyMatch13({ generatedAt: '2026-01-01T00:00:00Z', teams: { abc: 1, 3229: 'x', 1234: { xp: 'high', history: 'none' } }, events: { nonsense: {}, '2026ncash': { sim: { teams: 'x' }, field: 5, matches: [null, { key: 'k' }], notes: [1, 'ok'] } }, district: { ourTeams: [{ teamNumber: 3229, pCmp: 'x', cmpStatus: 'DROP TABLE' }] }, ours: [{ number: 'x' }] });
  assert.deepEqual(Object.keys(wild.teams), ['1234']);
  assert.equal(wild.teams['1234'].xp, null);
  assert.deepEqual(wild.teams['1234'].history, []);
  assert.deepEqual(Object.keys(wild.events), ['2026ncash']);
  assert.equal(wild.events['2026ncash'].sim, null);
  assert.deepEqual(wild.events['2026ncash'].notes, ['ok']);
  assert.equal(wild.district.ourTeams[0].pCmp, null);
  assert.equal(wild.district.ourTeams[0].cmpStatus, '');
  assert.deepEqual(wild.ours, []);
});

test('the file is stale after 12 hours, never for the sample, and a bad time counts as stale', () => {
  const fresh = tidy(raw => { delete raw.sample; raw.generatedAt = '2026-01-01T00:00:00Z'; });
  assert.equal(match13.match13Stale(fresh, new Date('2026-01-01T11:59:00Z')), false);
  assert.equal(match13.match13Stale(fresh, new Date('2026-01-01T12:01:00Z')), true);
  assert.equal(match13.match13Stale(tidy(), new Date('2030-01-01T00:00:00Z')), false, 'the sample is never stale');
  assert.equal(match13.match13Stale(null, now), false);
  assert.equal(match13.staleHours, 12);
});

test('matchForecastFor gives the numbers of a match, or null', () => {
  const data = tidy();
  const key = data.events['2026ncash'].matches[0].key;
  const found = match13.matchForecastFor(key, data);
  assert.equal(found.key, key);
  assert.equal(typeof found.redWin, 'number');
  assert.ok(Math.abs(found.redWin + found.blueWin - 1) < 0.0011);
  assert.equal(found.redRp.length, 3);
  assert.equal(found.blueRp.length, 3);
  assert.ok(Object.keys(found.ratings).length >= 1);
  assert.equal(match13.matchForecastFor('2026ncash_qm999', data), null);
  assert.equal(match13.matchForecastFor(5, data), null);
  assert.equal(match13.matchForecastFor(key, null), null);
});

test('fieldStrengthFor gives the strength of an event, with our teams marked, or null', () => {
  const data = tidy();
  const field = match13.fieldStrengthFor('2026ncash', data);
  assert.equal(field.eventKey, '2026ncash');
  assert.ok(field.teamCount > 0 && field.average !== null);
  assert.ok(field.top.length <= 16);
  assert.deepEqual(field.ours.map(row => row.teamNumber).sort(), field.top.filter(row => [3229, 3426].includes(row.teamNumber)).map(row => row.teamNumber).sort());
  assert.equal(match13.fieldStrengthFor('2026ncnone', data), null);
  assert.equal(match13.fieldStrengthFor('2026ncash', null), null);
  const none = tidy(raw => { raw.events['2026ncash'].field = null; });
  assert.equal(match13.fieldStrengthFor('2026ncash', none), null);
});

test('the reader gives the file, nothing for a 404, and null when the read fails, so the old data stays', async () => {
  const body = JSON.stringify(sampleRaw());
  const answer = (status, text) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => JSON.parse(text) });
  const good = await match13.readMatch13(answer(200, body), 'data/live/');
  assert.equal(good.data.teams['3229'].xp, 61.17);
  assert.deepEqual(await match13.readMatch13(answer(404, '{}'), 'data/live/'), { data: null });
  assert.equal(await match13.readMatch13(answer(500, '{}'), 'data/live/'), null);
  assert.equal(await match13.readMatch13(async () => { throw new Error('offline'); }, 'data/live/'), null);
  assert.deepEqual(await match13.readMatch13(async () => ({ status: 200, ok: true, json: async () => { throw new Error('not json'); } }), 'data/live/'), { data: null });
  const asked = [];
  await match13.readMatch13(async (address, options) => { asked.push([address, options.cache]); return { status: 404, ok: false }; }, 'data/live/');
  assert.deepEqual(asked, [['data/live/match13.json', 'no-store']]);
});

test('the forecast card draws a row for each of our teams, the range on a rank axis and the chance in words', () => {
  match13.setMatch13(null, tidy());
  match13.setMatch13Preview(true);
  try {
    const html = forecast.markupFor(null, now);
    assert.ok(html.includes('>FORECAST<') && html.includes('SAMPLE'));
    assert.ok(html.includes('HOW WE EXPECT 2026NCASH TO END'));
    assert.ok(html.includes('>PRIME<') && html.includes('>NOVA<'));
    assert.ok(html.includes('>11TH<') && html.includes('RANGE 5TH TO 22ND') && html.includes('31 RANKING POINTS'));
    assert.equal((html.match(/class="span"/g) || []).length, 2, 'one range bar for each team');
    assert.ok(html.includes('class="tick"'));
    assert.ok(html.includes('Match13 simulation, 25000 runs, Oct 19'));
    assert.ok(!html.includes('stale-chip'));
  } finally {
    match13.setMatch13Preview(false);
    match13.setMatch13(null, null);
  }
});

test('the forecast says plainly when there is nothing, and a settled rank has a small bar and the word settled', () => {
  match13.setMatch13(null, null);
  assert.ok(forecast.markupFor(null, now).includes('Match13 has no forecast for this event yet.'));
  const settled = tidy(raw => { raw.events['2026ncash'].sim.teams.forEach(row => { if (row.teamNumber === 3229) { row.p5 = 5; row.p50 = 5; row.p95 = 5; } }); delete raw.sample; raw.generatedAt = '2026-01-01T05:00:00Z'; });
  match13.setMatch13(settled, null);
  try {
    const html = forecast.markupFor(null, now);
    assert.ok(html.includes('SETTLED AT 5TH') && html.includes('TOP 8: NEARLY SURE'));
    assert.ok(/<rect class="span" x="\d+" y="\d+" width="14"/.test(html), 'a settled rank is still a bar you can see');
    assert.ok(!html.includes('stale-chip'), 'one hour old is not stale');
    const old = forecast.markupFor(null, new Date('2026-01-02T06:00:00Z'));
    assert.ok(old.includes('<span class="stale-chip">STALE</span>'), 'a day old is stale');
  } finally {
    match13.setMatch13(null, null);
  }
});

test('the top 8 words come from the three ranks of the simulation', () => {
  assert.equal(forecast.topEightWords({ p5: 1, p50: 3, p95: 8 }), 'TOP 8: NEARLY SURE');
  assert.equal(forecast.topEightWords({ p5: 2, p50: 8, p95: 14 }), 'TOP 8: LIKELY');
  assert.equal(forecast.topEightWords({ p5: 5, p50: 11, p95: 22 }), 'TOP 8: POSSIBLE');
  assert.equal(forecast.topEightWords({ p5: 12, p50: 20, p95: 30 }), 'TOP 8: UNLIKELY');
  assert.deepEqual(forecast.ticksFor(40), [1, 8, 40]);
  assert.deepEqual(forecast.ticksFor(8), [1, 8]);
});

test('the chances card says the percentage in words, and a status that settles it beats the percentage', () => {
  match13.setMatch13(null, tidy());
  match13.setMatch13Preview(true);
  try {
    const html = qualify.markupFor(null, now);
    assert.ok(html.includes('>CHANCES<'));
    assert.ok(html.includes('>PRIME<') && html.includes('>NOVA<') && html.includes('>62%<') && html.includes('>8%<') && html.includes('>31%<'));
    assert.ok(html.includes('DISTRICT CHAMPIONSHIP') && html.includes('WORLD CHAMPIONSHIP'));
    assert.ok(html.includes('RANK 25') && html.includes('98 POINTS'));
    assert.ok(html.includes('DISTRICT: 50 SEATS, ABOUT 56 POINTS') && html.includes('WORLD: 15 SEATS, ABOUT 231 POINTS'));
  } finally {
    match13.setMatch13Preview(false);
    match13.setMatch13(null, null);
  }
  assert.deepEqual(qualify.chanceOf(0.4, 'qualified'), { fill: 1, words: 'QUALIFIED' });
  assert.deepEqual(qualify.chanceOf(1, 'locked'), { fill: 1, words: 'LOCKED IN' });
  assert.deepEqual(qualify.chanceOf(0, 'locked_out'), { fill: 0, words: 'OUT OF REACH' });
  assert.deepEqual(qualify.chanceOf(0.62, 'in_range'), { fill: 0.62, words: '62%' });
  assert.deepEqual(qualify.chanceOf(null, ''), { fill: 0, words: 'NOT KNOWN' });
  assert.equal(draw.percentText(0.004), '1%');
  assert.equal(draw.percentText(0.996), '99%');
  assert.equal(draw.percentText(0), '0%');
  assert.equal(draw.percentText(1), '100%');
  assert.equal(draw.ordinal(1), '1ST');
  assert.equal(draw.ordinal(12), '12TH');
  assert.equal(draw.ordinal(22), '22ND');
  assert.equal(draw.ordinal(103), '103RD');
});

test('the chances card says plainly when there are no standings', () => {
  match13.setMatch13(null, null);
  assert.ok(qualify.markupFor(null, now).includes('Match13 has no district standings yet.'));
});

test('the cards are due only when Match13 has something, and Preview competition shows them on the sample', () => {
  const card = id => competition.cards.find(item => item.id === id);
  assert.equal(card('competition-forecast').setting, 'competitionForecast');
  assert.equal(card('competition-qualify').setting, 'competitionQualify');
  assert.ok(config.competitionSwitches.includes('competitionForecast') && config.competitionSwitches.includes('competitionQualify'));
  assert.equal(config.defaultSettings.competitionForecast, true);
  assert.equal(config.defaultSettings.competitionQualify, false, 'Chances is off until a coach switches it on');

  match13.setMatch13(null, null);
  assert.equal(card('competition-forecast').data(), false);
  assert.equal(card('competition-qualify').data(), false);
  match13.setMatch13(tidy(), null);
  assert.equal(card('competition-forecast').data(), true);
  assert.equal(card('competition-qualify').data(), true);
  // the window rules are the ones of the other cards: the forecast near an event, the chances once the season has begun
  assert.equal(card('competition-forecast').window({ near: true, started: false }), true);
  assert.equal(card('competition-forecast').window({ near: false, started: true }), false);
  assert.equal(card('competition-qualify').window({ near: false, started: true }), true);
  match13.setMatch13(null, tidy());
  assert.equal(match13.currentMatch13(), null, 'the sample is not shown unless a preview or ?sample=1 asks');
  competition.previewCompetition({ teams: [] }, Date.now() + 60000);
  assert.ok(match13.currentMatch13().sample === true, 'a preview shows the sample');
  competition.previewCompetition(null, 0);
  assert.equal(match13.currentMatch13(), null);
  match13.setMatch13(null, null);
});

test('both cards are registered as competition cards of the large panel and have a script and a stylesheet', () => {
  const registry = read('registry.js');
  ['competition-forecast', 'competition-qualify'].forEach(id => {
    assert.ok(registry.includes("{ id: '" + id + "', region: 'grid1', topic: 'competition', competition: true },"), id);
    assert.ok(fs.existsSync(path.join(root, 'panels', id, 'panel.js')) && fs.existsSync(path.join(root, 'panels', id, 'panel.css')), id);
  });
});

test('the stylesheets keep the text sizes and use no colors of their own, no animation and no effects', () => {
  ['competition-forecast', 'competition-qualify'].forEach(id => {
    const css = read('panels/' + id + '/panel.css');
    const sizes = Array.from(css.matchAll(/font:\s*\d+\s+(\S+?)\//g)).map(match => match[1]);
    sizes.forEach(size => assert.ok(['var(--size-label)', 'var(--size-body)', 'var(--size-heading)', 'var(--size-person)', '30px', '28px'].includes(size), id + ' ' + size));
    assert.ok(css.includes('30px/44px'), 'the stale chip is 30px');
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), 'no hex colors outside the token files');
    assert.ok(!/animation|transition|filter|box-shadow|text-shadow|blur/.test(css), 'no motion or effects in the stylesheet');
    const labels = Array.from(css.matchAll(/(\.\S+)\s*\{[^}]*font:[^;]*\b28px/g)).map(match => match[1]);
    assert.ok(labels.every(name => name.endsWith('.tick')), 'only the axis labels are 28px');
  });
});

test('the screen reads the file after the other extras, never stops for it, and nothing here goes to Sanity', () => {
  const extras = read('shell-extras.js');
  assert.ok(extras.includes("startOptional('./core/match13.js', module => module.startMatch13(fetch.bind(window), shellState.showingSample))"));
  const module = read('core/match13.js');
  assert.ok(!/fetch\(\s*['"]https/.test(module), 'only relative addresses');
  assert.ok(module.includes("cache: 'no-store'") && module.includes('refreshMinutes = 10'));
  ['core/match13.js', 'core/match13-draw.js', 'panels/competition-forecast/panel.js', 'panels/competition-qualify/panel.js', 'panels/competition-forecast/panel.css', 'panels/competition-qualify/panel.css'].forEach(file => {
    const text = read(file);
    assert.ok(!text.includes('—') && !text.includes('–'), file + ' has no em or en dash');
    assert.ok(!/!\s*['"`]/.test(text.replace(/!==|!=|![a-zA-Z(]/g, '')), file + ' has no exclamation mark in a sentence');
  });
});

test('the sample file holds no secret and no name', () => {
  const text = read('data/sample/match13.json');
  assert.ok(!/m13_|Bearer|token|nickname|email/i.test(text));
  assert.ok(Buffer.byteLength(text) < 20000);
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
