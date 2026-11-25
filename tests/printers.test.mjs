// The printer frame of the dashboard (dashboard/core/printers.js, panels/printer, panels/printer-file): which printers count as
// printing, the steps that put them in the rotation, how the small panel is told which printer, the numbers on the pages and the
// reader. Nothing is drawn in a browser: the pages are asked for their markup. The service on the Teletraan computer that writes
// the file is tested in tests/printer-sync.test.mjs.
//
//   node tests/printers.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { contentOf, dashboardFolder, load, now, registry } from './helpers/monday-world.mjs';
import { test, finish } from './helpers/runner.mjs';

const printers = await load('core/printers.js');
const playing = await load('core/views.js');
const bigPanel = await load('panels/printer/panel.js');
const smallPanel = await load('panels/printer-file/panel.js');

const content = contentOf([]);
const at = now.getTime();

function entry(fields) {
  return Object.assign({ id: '1', name: 'Centauri 1', online: true, printing: true, state: 'printing', file: 'Pit crew bracket v7', progress: 27, layer: 96, totalLayer: 360, elapsedSeconds: 2400, remainingSeconds: 6600, totalSeconds: 9000, asOf: new Date(at).toISOString(), etaAt: new Date(at + 6600 * 1000).toISOString(), camera: true, frameN: 4 }, fields);
}

function file(list, when = at) {
  return printers.tidyPrinters({ version: 1, updatedAt: new Date(when).toISOString(), printers: list });
}

test('the file is tidied: a printer needs an id, the job only shows while it prints, and a file with no time is not ours', () => {
  const data = file([entry({}), entry({ id: '2', printing: false, state: 'idle', file: 'old' }), { name: 'no id' }, 'junk', entry({ id: 'bad id' })]);
  assert.deepEqual(data.printers.map(item => item.id), ['1', '2']);
  assert.equal(data.printers[0].file, 'Pit crew bracket v7');
  assert.equal(data.printers[0].remainingSeconds, 6600);
  assert.equal(data.printers[1].printing, false);
  assert.equal(data.printers[1].file, undefined);
  assert.equal(printers.tidyPrinters({ printers: [] }), null);
  assert.equal(printers.tidyPrinters(null), null);
  assert.equal(printers.tidyPrinters({ updatedAt: 'x', printers: [] }), null);
});

test('a printer that is not online is not printing, whatever the file says', () => {
  assert.equal(file([entry({ online: false })]).printers[0].printing, false);
});

test('only printers that are printing count, and only while the file is fresh', () => {
  const data = file([entry({}), entry({ id: '2', printing: false, state: 'idle' }), entry({ id: '3', name: 'Centauri 3' })]);
  assert.deepEqual(printers.printingPrinters(now, data).map(item => item.id), ['1', '3']);
  assert.deepEqual(printers.printingPrinters(new Date(at + 29000), data).map(item => item.id), ['1', '3']);
  assert.deepEqual(printers.printingPrinters(new Date(at + 31000), data), [], 'a file the service has stopped writing proves nothing');
  assert.deepEqual(printers.printingPrinters(now, null), []);
});

test('each printing printer has a step of two minutes, with its small panel, and nothing is added when none prints', () => {
  const data = file([entry({}), entry({ id: '2', printing: false, state: 'idle' }), entry({ id: '3', name: 'Centauri 3' })]);
  const steps = printers.printerSteps(now, data);
  assert.equal(steps.length, 2);
  assert.deepEqual(steps[0], { panel: 'printer', side: 'printer-file', show: true, seconds: 120, page: { printer: '1' }, sidePage: { printer: '1' } });
  assert.equal(steps[1].page.printer, '3');
  assert.deepEqual(printers.printerSteps(now, file([entry({ printing: false, state: 'idle' })])), []);
  assert.deepEqual(printers.printerSteps(now, null), []);
});

test('the printers are mixed into the rotation, once each, and the rest of the rotation is as it was', () => {
  printers.setPrinters(file([entry({}), entry({ id: '3', name: 'Centauri 3' })]));
  const playlist = [{ panel: 'tasks' }, { panel: 'events' }, { panel: 'photo' }, { panel: 'roster' }];
  const mixed = printers.withPrinters(playlist, content, now);
  assert.equal(mixed.length, 6);
  assert.deepEqual(mixed.filter(step => step.panel !== 'printer').map(step => step.panel), ['tasks', 'events', 'photo', 'roster']);
  assert.deepEqual(mixed.filter(step => step.panel === 'printer').map(step => step.page.printer), ['1', '3']);

  printers.setPrinters(file([entry({ printing: false, state: 'idle' })]));
  assert.deepEqual(printers.withPrinters(playlist, content, now), playlist, 'no printing, no change');
  printers.setPrinters(null);
  assert.deepEqual(printers.withPrinters(playlist, content, now), playlist);
  assert.deepEqual(printers.withPrinters([], content, now), []);
});

test('a problem while planning leaves the rotation as it was', () => {
  printers.setPrinters({ at: at, printers: 'broken' });
  const playlist = [{ panel: 'tasks' }];
  const complain = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(printers.withPrinters(playlist, content, now), playlist);
  } finally {
    console.error = complain;
    printers.setPrinters(null);
  }
});

test('the page is for the printer its step names, and a step with none takes the first that prints', () => {
  const data = file([entry({}), entry({ id: '3', name: 'Centauri 3', file: 'Gear' })]);
  assert.equal(printers.printerOf({ printer: '3' }, now), null, 'nothing is held until the file is set');
  printers.setPrinters(data);
  assert.equal(printers.printerOf({ printer: '3' }, now).file, 'Gear');
  assert.equal(printers.printerOf(undefined, now).id, '1');
  assert.equal(printers.printerOf({ printer: '9' }, now), null, 'a printer that is not printing has no page');
  assert.equal(printers.hasPrinter({ printer: '1' }, now), true);
  assert.equal(printers.hasPrinter({ printer: '1' }, new Date(at + 60000)), false);
  assert.equal(printers.printerStillPrinting('3', now).id, '3');
  assert.equal(printers.printerStillPrinting('2', now), null);
  printers.setPrinters(null);
});

test('the large panel and the small panel show a page only while there is something to show', () => {
  // the panels ask the clock of the computer, so the file is written at this moment
  printers.setPrinters(file([entry({ asOf: new Date().toISOString() })], Date.now()));
  assert.equal(bigPanel.hasContent(content, { printer: '1' }), true);
  assert.equal(smallPanel.hasContent(content, { printer: '1' }), true);
  assert.equal(bigPanel.hasContent(content, { printer: '2' }), false);
  printers.setPrinters(null);
  assert.equal(bigPanel.hasContent(content, { printer: '1' }), false);
  assert.equal(smallPanel.hasContent(content, undefined), false);
});

test('the numbers run on from when the file was written, for as long as that can be believed', () => {
  const printer = file([entry({})]).printers[0];
  const same = printers.liveTimes(printer, now);
  assert.equal(same.elapsed, 2400);
  assert.equal(same.remaining, 6600);
  assert.equal(same.progress, 27);

  const later = printers.liveTimes(printer, new Date(at + 10000));
  assert.equal(later.elapsed, 2410);
  assert.equal(later.remaining, 6590);
  assert.equal(later.etaAt, at + 6600 * 1000, 'the time it will be done does not move');

  const old = printers.liveTimes(printer, new Date(at + 600000));
  assert.equal(old.elapsed, 2430, 'no more than the 30 seconds that count as fresh');

  const ending = file([entry({ remainingSeconds: 5 })]).printers[0];
  assert.equal(printers.liveTimes(ending, new Date(at + 20000)).remaining, 0);
});

test('with no time left known the page says so and does not make one up', () => {
  const printer = file([entry({ remainingSeconds: null, totalSeconds: null, etaAt: null, progress: null })]).printers[0];
  const times = printers.liveTimes(printer, now);
  assert.equal(times.remaining, null);
  assert.equal(times.etaAt, null);
  assert.equal(times.progress, null);
  assert.equal(printers.durationWords(times.remaining), '--');
  assert.equal(printers.finishWords(times.etaAt, now, 'America/New_York'), '--');
});

test('times are written the way the wall reads them', () => {
  assert.equal(printers.durationWords(7500), '2H 05M');
  assert.equal(printers.durationWords(3600), '1H 00M');
  assert.equal(printers.durationWords(2700), '45M');
  assert.equal(printers.durationWords(59), '59S');
  assert.equal(printers.durationWords(0), '0S');
  assert.equal(printers.durationWords(null), '--');
});

test('the time it will be done is the time of day, with the day when it is not today', () => {
  const zone = 'America/New_York';
  // now is noon in New York
  assert.equal(printers.finishWords(at + 3 * 3600 * 1000, now, zone), '3:00 PM');
  assert.equal(printers.finishWords(at + 14 * 3600 * 1000, now, zone), 'TOMORROW 2:00 AM');
  assert.equal(printers.finishWords(at + 50 * 3600 * 1000, now, zone), 'SAT 2:00 PM');
  assert.equal(printers.finishWords(null, now, zone), '--');
});

test('the small panel is told which printer: a step with a small page hands it on, and a step without takes it away', () => {
  playing.resetViews();
  const step = printers.printerSteps(now, file([entry({ id: '3', name: 'Centauri 3' })]))[0];
  assert.equal(playing.pairSide(step), true);
  const side = playing.viewSidePlaylist(content);
  assert.deepEqual(side.map(item => [item.panel, item.paired, item.page]), [['printer-file', true, { printer: '3' }]]);
  assert.ok(side[0].seconds > 120);

  assert.equal(playing.pairSide({ panel: 'tasks', side: 'qrParts' }), true);
  assert.equal(playing.viewSidePlaylist(content)[0].page, undefined, 'a row of the Rotation has no page for its small panel');
  assert.equal(playing.pairSide({ panel: 'tasks' }), true);
  assert.equal(playing.viewSidePlaylist(content)[0].panel === 'printer-file', false);
  playing.resetViews();
});

test('the large page names the file, the printer and the percent, and says when the camera is not there yet', () => {
  printers.setPrinters(file([entry({ camera: false })]));
  const markup = bigPanel.markupFor(content, now, { printer: '1' });
  assert.ok(markup.includes('PRINTING'));
  assert.ok(markup.includes('CENTAURI 1'));
  assert.ok(markup.includes('Pit crew bracket v7'));
  assert.ok(markup.includes('27%'));
  assert.ok(markup.includes('WAITING FOR THE CAMERA'));
  assert.ok(markup.includes('data-slat="title"') && markup.includes('data-slat="tag"') && markup.includes('data-slat="item"'));

  printers.setPrinters(file([entry({ camera: true })]));
  assert.ok(!bigPanel.markupFor(content, now, { printer: '1' }).includes('WAITING FOR THE CAMERA'));
  printers.setPrinters(null);
});

test('the small page has the file, the printer, the time so far, the time left, and when it is done', () => {
  printers.setPrinters(file([entry({})]));
  const markup = smallPanel.markupFor(content, now, { printer: '1' });
  assert.ok(markup.includes('CENTAURI 1'));
  assert.ok(markup.includes('Pit crew bracket v7'));
  assert.ok(markup.includes('40M'), 'the time so far');
  assert.ok(markup.includes('1H 50M'), 'the time left');
  assert.ok(markup.includes('1:50 PM'), 'the time of day it will be done');
  assert.ok(markup.includes('27%'));
  assert.ok(markup.includes('data-slat="label"') && markup.includes('data-slat="content"'));
  printers.setPrinters(null);
});

test('a name from the printer file cannot put markup in the page', () => {
  printers.setPrinters(file([entry({ name: '<img src=x onerror=alert(1)>', file: '<script>x</script>' })]));
  [bigPanel.markupFor(content, now, { printer: '1' }), smallPanel.markupFor(content, now, { printer: '1' })].forEach(markup => {
    assert.ok(!markup.includes('<img src=x'), 'the name is written as text');
    assert.ok(!markup.includes('<script>x'), 'the file is written as text');
  });
  printers.setPrinters(null);
});

test('a page for a printer that is not printing says so in a sentence and does not break', () => {
  printers.setPrinters(null);
  assert.ok(bigPanel.markupFor(content, now, { printer: '1' }).includes('No printer is printing.'));
  assert.ok(smallPanel.markupFor(content, now, { printer: '1' }).includes('No printer is printing.'));
});

test('the address of a camera picture is the file of its printer, and changes each time', () => {
  assert.equal(printers.frameAddress('2', 5), 'data/live/printers/2/frame.jpg?t=5');
});

test('the reader keeps what it had when a read fails, and a missing file means no printers', async () => {
  const good = { ok: true, status: 200, json: async () => ({ version: 1, updatedAt: new Date(at).toISOString(), printers: [entry({})] }) };
  assert.equal((await printers.readPrinters(async () => good)).data.printers.length, 1);
  assert.deepEqual(await printers.readPrinters(async () => ({ ok: false, status: 404 })), { data: null });
  assert.equal(await printers.readPrinters(async () => ({ ok: false, status: 500 })), null);
  assert.equal(await printers.readPrinters(async () => { throw new Error('offline'); }), null);
  assert.deepEqual(await printers.readPrinters(async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } })), { data: null });
});

test('a page with ?sample=1 adds no printer', async () => {
  await printers.startPrinters(async () => ({ ok: false, status: 404 }), true);
  printers.setPrinters(file([entry({})]));
  assert.deepEqual(printers.printerSteps(now), []);
});

test('the printer panels are registered as large and small, outside the lists of the Studio, with a folder of their own', () => {
  const big = registry.panels.find(panel => panel.id === 'printer');
  const small = registry.panels.find(panel => panel.id === 'printer-file');
  assert.ok(big && big.region === 'grid1' && big.rotationOnly === true);
  assert.ok(small && small.region === 'grid2' && small.rotationOnly === true);
  assert.equal(big.topic, small.topic, 'a large and a small panel of one topic are never on screen together, except as a pair');
  ['printer', 'printer-file'].forEach(id => {
    assert.ok(fs.existsSync(path.join(dashboardFolder, 'panels', id, 'panel.js')));
    assert.ok(fs.existsSync(path.join(dashboardFolder, 'panels', id, 'panel.css')));
  });
});

test('every rule of the stylesheets starts with the class of its panel', () => {
  [['printer', 'printer'], ['printer-file', 'printer-file']].forEach(([id, prefix]) => {
    const css = fs.readFileSync(path.join(dashboardFolder, 'panels', id, 'panel.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = css.split('}').map(block => block.split('{')[0].trim()).filter(Boolean);
    selectors.forEach(selector => selector.split(',').forEach(part => assert.ok(part.trim().startsWith('.' + prefix), id + ': ' + part.trim())));
  });
});

await finish();
