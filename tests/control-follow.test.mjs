// The Live preview follows the wall: the frame address is built from the last report of the TV, it changes only when
// the panel, team, theme, view or layout change, and a phone holds no frame until the tap.
//
//   node tests/control-follow.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { followFor, followLine, previewCardHtml, previewAutoLoads, wallReport, nowCardHtml } from '../control/static/tabs/render.js';
import { readStill, useStillSwitches } from '../dashboard/core/still.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(repo + name, 'utf8');
const base = { view: 'prime', theme: 'cybertron', layout: 'standard', team: 'prime', panel: 'events', page: '2', build: 'v3' };

test('a report gives an address that holds the same panel, team, theme and view, still', () => {
  const found = followFor(base);
  assert.equal(found.src, '/dashboard/?panel=events&team=prime&screen=cybertron&view=prime&still=1');
  assert.equal(found.line, 'Showing: Events (page 2), Prime, Cybertron');
});

test('the bar layout is carried, and a report with no team says both teams', () => {
  const found = followFor({ view: 'family', theme: 'original', layout: 'bar', team: '', panel: 'photo', page: '1' });
  assert.equal(found.src, '/dashboard/?panel=photo&screen=original&view=family&layout=bar&still=1');
  assert.equal(found.line, 'Showing: Photo, both teams, Original');
});

test('the address the control page builds is read by the dashboard as a held, still panel', () => {
  const found = followFor(base);
  const search = found.src.slice(found.src.indexOf('?'));
  const ask = readStill(search);
  assert.deepEqual(ask, { panel: 'events', team: 'prime', department: '', screen: 'cybertron', still: true, view: 'prime' });
  const params = useStillSwitches(new URLSearchParams(search), ask);
  assert.equal(params.get('show'), 'events');
  assert.equal(params.get('motion'), 'none');
});

test('an unknown view or theme is left out of the address', () => {
  const found = followFor({ ...base, view: 'robotics', theme: 'neon', layout: 'wide' });
  assert.equal(found.src, '/dashboard/?panel=events&team=prime&still=1');
});

test('a panel that cannot be held is replaced by the nearest plain one, and the line says so', () => {
  ['alert', 'announcement', 'talk', 'stand-in-tile'].forEach(panel => {
    const found = followFor({ ...base, panel });
    assert.ok(found.src.startsWith('/dashboard/?panel=tonight&'), panel);
    assert.ok(found.line.includes('cannot be copied, so the copy shows Tonight'), panel);
  });
});

test('a Monday card keeps its panel and the line says the department is not carried', () => {
  const found = followFor({ ...base, panel: 'monday-tasks' });
  assert.ok(found.src.includes('panel=monday-tasks'));
  assert.ok(found.line.includes('no department'));
});

test('an unchanged report gives the same address, and a change of page alone does not change it', () => {
  assert.equal(followFor(base).src, followFor({ ...base, build: 'v4', at: 'later', dots: {} }).src);
  assert.equal(followFor(base).src, followFor({ ...base, page: '1' }).src);
  ['panel', 'team', 'theme', 'view'].forEach(name => {
    const other = { panel: 'roster', team: 'nova', theme: 'original', view: 'nova' }[name];
    assert.notEqual(followFor(base).src, followFor({ ...base, [name]: other }).src, name);
  });
});

test('no report means no address and the plain sentence', () => {
  [null, undefined, {}, { panel: '' }, 'x'].forEach(report => {
    const found = followFor(report);
    assert.equal(found.src, '');
    assert.equal(found.line, 'The TV has not reported yet');
  });
  assert.equal(followLine(null), 'The TV has not reported yet');
});

test('the card and the preview agree on the real answer of GET /now', () => {
  const report = { view: 'general', theme: 'cybertron', panel: 'competition-timeline', team: 'prime', page: 1, build: '10-7932f57', at: '2026-10-17T21:23:00Z' };
  const answer = { report, receivedAt: new Date().toISOString(), ageSeconds: 2, quiet: false, message: '', rows: [] };
  assert.equal(wallReport(answer), report);
  assert.ok(followFor(wallReport(answer)).src.startsWith('/dashboard/?panel=competition-timeline&team=prime&screen=cybertron&view=general'));
  assert.ok(!nowCardHtml(answer).includes('competition-timeline'), 'the card says the panel in plain words, not its stored name');
  assert.ok(nowCardHtml({ ...answer, names: { panels: { 'competition-timeline': 'Competition: Timeline' } } }).includes('Competition: Timeline'));
  const quiet = { ...answer, quiet: true, message: 'No report for 90 s' };
  assert.equal(wallReport(quiet), null);
  assert.equal(followFor(wallReport(quiet)).src, '');
  assert.ok(nowCardHtml(quiet).includes('No report for 90 s'));
  assert.equal(wallReport({ report: null, quiet: true }), null);
  assert.equal(wallReport(null), null);
});

test('a panel or team with odd characters cannot break out of the address', () => {
  const found = followFor({ ...base, panel: 'a&b=c', team: 'x y&z' });
  assert.ok(found.src.includes('panel=a%26b%3Dc') && found.src.includes('team=x%20y%26z'));
});

test('the tab polls every 5 seconds, sets the frame address only when it differs, and never reports', () => {
  const text = read('control/static/tabs/preview.js');
  assert.ok(text.includes('const followSeconds = 5') && text.includes('setInterval(() => follow(mine), followSeconds * 1000)'));
  assert.ok(text.includes("next.src === held") && text.includes('frame.src = held;'));
  assert.equal(text.split('frame.src =').length - 1, 1, 'one place sets the address');
  assert.ok(!/method: *'POST'/.test(text.slice(text.indexOf('function wirePreview'), text.indexOf('registerTab'))));
});

test('phones: no frame in the markup, none until the tap, and none after a tab change or the background', () => {
  assert.ok(!previewCardHtml().includes('<iframe'));
  assert.equal(previewAutoLoads(430), false);
  assert.equal(previewAutoLoads(1200), true);
  const text = read('control/static/tabs/preview.js');
  assert.ok(text.includes('let wanted = wide();') && text.includes('if (wanted) load(); else unload();'));
  assert.ok(text.includes('if (document.hidden) {') && text.includes('if (!wide()) wanted = false;'));
  assert.ok(text.includes('return () => {\n    unload();'));
  assert.ok(!/frame\.src = box\.dataset/.test(text), 'the frame never loads the bare address any more');
});

test('the frame keeps the 16:9 box and the scale', () => {
  const text = read('control/static/tabs/preview.js');
  assert.ok(text.includes('frame.width = previewWidth') && text.includes('frame.height = previewHeight') && text.includes('previewScale(box.clientWidth)'));
});

test('the dashboard applies view and layout only inside a still address, and the report carries the layout', async () => {
  const text = read('dashboard/shell-state.js');
  const block = text.slice(text.indexOf('if (stillAsk) {'), text.indexOf('export const competitionAsk') > 0 ? text.indexOf('export const competitionAsk') : undefined);
  assert.ok(block.includes("rotateLayout('bar')") && block.includes('applyView(stillAsk.view)'));
  assert.equal(text.split('rotateLayout(').length - 1, 1, 'one call');
  const { cleanReport } = await import('../dashboard/core/now-report-parts.js');
  assert.equal(cleanReport({ layout: 'bar' }).layout, 'bar');
  assert.equal(cleanReport({}).layout, '');
});

await finish();
