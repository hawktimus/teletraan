// Tests the run log of the hidden transitions (dashboard/core/hidden-log.js, hidden-load.js, hidden.js,
// now-report-parts.js, hidden-run.js): what the wall records of the last transition, the picture loader, the five
// minute window of a push, and the timer that plays a push when no page change comes. Nothing is drawn.
//
//   node tests/hidden-run-log.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-hidden-log-'));
fs.mkdirSync(path.join(work, 'dashboard/core'), { recursive: true });
fs.writeFileSync(path.join(work, 'package.json'), '{ "type": "module" }\n');
['config.js', 'core/hidden-log.js', 'core/hidden-load.js', 'core/hidden.js', 'core/now-report-parts.js'].forEach(file => {
  copyModule(path.join(root, 'dashboard', file), path.join(work, 'dashboard', file));
});
const base = pathToFileURL(path.join(work, 'dashboard')).href + '/';
const config = await import(base + 'config.js');
const log = await import(base + 'core/hidden-log.js');
const load = await import(base + 'core/hidden-load.js');
const hidden = await import(base + 'core/hidden.js');
const parts = await import(base + 'core/now-report-parts.js');
const runSource = fs.readFileSync(path.join(root, 'dashboard/core/hidden-run.js'), 'utf8');

const tests = [];
const test = (name, run) => tests.push({ name, run });

const now = new Date('2026-10-19T14:42:00Z');
const secondsBefore = seconds => new Date(now.getTime() - seconds * 1000).toISOString();

const chromium = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/109.0.5414.74 Chrome/109.0.5414.74 Safari/537.36';

test('the browser is told in a few words', () => {
  assert.equal(log.shortBrowser(chromium), 'Chromium 109 Linux');
  assert.equal(log.shortBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'), 'Edge 126 Windows');
  assert.equal(log.shortBrowser('Mozilla/5.0 (X11; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0'), 'Firefox 102 Linux');
  assert.equal(log.shortBrowser('Something Odd That Is Longer Than Thirty Characters'), 'Something Odd That Is Longer T');
  assert.equal(log.shortBrowser(undefined), '');
});

test('a run keeps its steps in order and ends with the total', () => {
  log.resetRunLog();
  let clock = 1000;
  log.startRun('desktop', now, () => clock);
  log.noteStep('pile 1.7s');
  clock = 10400;
  log.noteStep('rebuild ok');
  log.finishRun();
  const report = log.hiddenRunReport();
  assert.equal(report.kind, 'desktop');
  assert.equal(report.at, now.toISOString());
  assert.deepEqual(report.steps, ['pile 1.7s', 'rebuild ok', 'total 9.4s']);
  assert.equal(report.ignored, '');
});

test('an ignored request replaces the last run and takes no steps', () => {
  log.resetRunLog();
  log.startRun('redEyes', now);
  log.noteStep('pile 1.7s');
  log.noteIgnored('desktop', 'request older than 5 min', now);
  log.noteStep('late step');
  log.finishRun();
  const report = log.hiddenRunReport();
  assert.equal(report.kind, 'desktop');
  assert.equal(report.ignored, 'request older than 5 min');
  assert.deepEqual(report.steps, []);
});

test('before any run the report is empty but still carries the browser and the image kinds', () => {
  log.resetRunLog();
  log.setBrowser(chromium);
  assert.deepEqual(log.hiddenRunReport().imageTypes, { png: null, webp: null });
  log.setImageTypes({ png: true, webp: false });
  const report = log.hiddenRunReport();
  assert.equal(report.kind, '');
  assert.equal(report.browser, 'Chromium 109 Linux');
  assert.deepEqual(report.imageTypes, { png: true, webp: false });
  log.setImageTypes('nonsense');
  assert.deepEqual(log.hiddenRunReport().imageTypes, { png: null, webp: null });
});

test('the report to the control page keeps hiddenRun to 400 characters and keeps the picture lines', () => {
  const steps = ['pile 1.7s', 'picture red-eyes-1.webp FAILED: error 0', 'picture red-eyes-2.webp loaded 1920x1080 after 412ms', 'on screen 1920x1080 opacity 1.0', 'effect shown 3.7s', 'rebuild ok', 'total 10.2s'];
  const run = { kind: 'redEyes', at: now.toISOString(), steps: steps, ignored: '', browser: 'Chromium 109 Linux', imageTypes: { png: true, webp: false } };
  const clean = parts.cleanHiddenRun(run);
  assert.ok(JSON.stringify(clean).length <= 400, String(JSON.stringify(clean).length));
  assert.deepEqual(clean.steps, steps);

  const wild = Object.assign({}, run, { steps: Array.from({ length: 40 }, (_, index) => 'picture file-' + index + '.png loaded 700x394 after 40ms and some more words'), browser: 'b'.repeat(500), ignored: 'x'.repeat(500) });
  assert.ok(JSON.stringify(parts.cleanHiddenRun(wild)).length <= 400);

  const crowded = parts.cleanHiddenRun(Object.assign({}, run, { steps: steps.concat(steps) }));
  assert.ok(JSON.stringify(crowded).length <= 400);
  assert.ok(crowded.steps.some(step => step.startsWith('picture red-eyes-2.webp loaded')), 'the picture line stays');
  assert.ok(crowded.steps.some(step => step.startsWith('total')), 'the total stays');
});

test('hiddenRun that is missing or not a record is null, and the report carries it', () => {
  [undefined, null, 'x', 4].forEach(value => assert.equal(parts.cleanHiddenRun(value), null));
  assert.equal(parts.cleanReport({}).hiddenRun, null);
  const report = parts.makeReport({ panel: 'roster', hiddenRun: { kind: 'desktop', at: now.toISOString(), steps: ['total 9.4s'], imageTypes: { png: true, webp: true } } });
  assert.equal(report.hiddenRun.kind, 'desktop');
  assert.deepEqual(report.hiddenRun.imageTypes, { png: true, webp: true });
  assert.deepEqual(parts.cleanHiddenRun({ imageTypes: { png: 'yes' } }).imageTypes, { png: null, webp: null });
});

test('a push plays for five minutes, once, and a request older than that is ignored', () => {
  assert.equal(config.hiddenWindowSeconds, 300);
  [0, 3, 61, 120, 299, 300].forEach(age => assert.equal(hidden.shouldRunHidden(secondsBefore(age), '', now), true, age + ' s'));
  [301, 600, 3600].forEach(age => assert.equal(hidden.shouldRunHidden(secondsBefore(age), '', now), false, age + ' s'));
  assert.equal(hidden.shouldRunHidden(secondsBefore(10), secondsBefore(10), now), false, 'plays once');
  assert.equal(hidden.shouldRunHidden(secondsBefore(-3), '', now), true);
  assert.equal(hidden.shouldRunHidden(secondsBefore(-60), '', now), false);
  assert.equal(hidden.shouldRunHidden('', '', now), false);
  assert.equal(hidden.shouldRunHidden('tomorrow', '', now), false);
  assert.equal(hidden.pushedKind({ kind: 'redEyes', requestedAt: secondsBefore(200) }, '', now), 'redEyes');
});

// A stand-in for the Image of a browser. what(address) says how it answers: 'load', 'error', 'empty' or 'silence'.
function withImages(what, run) {
  const before = { Image: globalThis.Image };
  globalThis.Image = class {
    constructor() { this.naturalWidth = 0; this.naturalHeight = 0; }
    set src(address) {
      const answer = what(address);
      if (answer === 'silence') return;
      setTimeout(() => {
        if (answer === 'load') { this.naturalWidth = 700; this.naturalHeight = 394; this.onload(); }
        else if (answer === 'empty') this.onload();
        else this.onerror({ type: 'error' });
      }, 5);
    }
  };
  return run().finally(() => { globalThis.Image = before.Image; });
}

test('a picture that loads gives its size and time, and a failure gives the reason', async () => {
  await withImages(() => 'load', async () => {
    const result = await load.loadPicture('assets/hidden/blue-screen-1.png');
    assert.equal(result.ok, true);
    assert.equal(result.width, 700);
    assert.equal(result.height, 394);
    assert.equal(result.why, '');
    assert.ok(result.ms >= 0);
  });
  await withImages(() => 'error', async () => {
    const result = await load.loadPicture('assets/hidden/blue-screen-1.png');
    assert.equal(result.ok, false);
    assert.equal(result.why, 'error 0');
  });
  await withImages(() => 'empty', async () => {
    assert.equal((await load.loadPicture('x.png')).why, 'loaded with no size');
  });
  await withImages(() => 'silence', async () => {
    const result = await load.loadPicture('x.png', 30);
    assert.equal(result.ok, false);
    assert.match(result.why, /^no answer in/);
  });
});

test('a picture that did not load also gets what the web server said about it', async () => {
  const before = globalThis.fetch;
  try {
    for (const [answer, words] of [[{ status: 404, headers: { get: () => 'text/html; charset=utf-8' } }, 'error 0, http 404 text/html'], [{ status: 200, headers: { get: () => null } }, 'error 0, http 200']]) {
      globalThis.fetch = async () => answer;
      await withImages(() => 'error', async () => {
        assert.equal((await load.loadPicture('assets/hidden/red-eyes-1.webp')).why, words);
      });
    }
    globalThis.fetch = async () => { throw new Error('offline'); };
    await withImages(() => 'error', async () => {
      assert.equal((await load.loadPicture('assets/hidden/red-eyes-1.webp')).why, 'error 0');
    });
  } finally {
    globalThis.fetch = before;
  }
});

test('the picture kinds the browser can read are found with tiny pictures of each kind', async () => {
  assert.match(load.tinyPictures.png, /^data:image\/png;base64,/);
  assert.match(load.tinyPictures.webp, /^data:image\/webp;base64,/);
  await withImages(address => (address.startsWith('data:image/webp') ? 'error' : 'load'), async () => {
    assert.deepEqual(await load.findImageTypes(), { png: true, webp: false });
  });
  await withImages(() => 'load', async () => {
    assert.deepEqual(await load.findImageTypes(), { png: true, webp: true });
  });
});

test('the runner records why a transition did not play and plays a push without a page change', () => {
  // The wording the control page reads is fixed here, so a change of one side shows in the other
  ['Allow hidden transitions is off', 'motion is light, calm or none', 'request older than', 'an alert, announcement or talk is on', 'a demo is on', 'night mode is on', 'another transition was running', 'the areas did not come to rest'].forEach(words => {
    assert.ok(runSource.includes(words), words);
  });
  assert.ok(runSource.includes('playWithoutPageChange'));
  assert.ok(runSource.includes('hiddenForceSeconds'));
  assert.ok(runSource.includes('retryMissingPictures'));
  assert.ok(runSource.includes("noteStep('picture none, plain backdrop')"));
  assert.ok(runSource.includes("' FAILED: '"));
  assert.ok(config.hiddenForceSeconds <= 15 && config.hiddenForceSeconds > 0);
  assert.ok(config.hiddenForceSeconds + 5 <= 20, 'a push plays within 20 seconds');
});

let failed = 0;
for (const { name, run } of tests) {
  try { await run(); console.log('ok   ' + name); } catch (error) { failed++; console.log('FAIL ' + name + '\n' + error.message); }
}
fs.rmSync(work, { recursive: true, force: true });
console.log(tests.length - failed + ' of ' + tests.length + ' passed');
process.exit(failed === 0 ? 0 : 1);
