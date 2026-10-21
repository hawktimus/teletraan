// The four tabs of the control page in a real browser (Playwright), at a computer and a phone width, over the real control service
// and a fake Sanity: the bottom tab bar on a phone and that nothing hides behind it, the What do I do here note and the Help
// link, More tools remembered by the browser, the arrow keys on the tabs, the look of a chosen button and a switch, and the one
// action bar on Scheduled reboot from the first change to the publish. Skipped when Playwright is not installed.
//
//   node tests/control-tabs-page.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createService, readConfig } from '../control/server.js';
import { defaultRotationRows } from '../dashboard/config-rotation.js';
import { loadPlaywright } from '../tools/screenshots.mjs';
import { makeFakeSanity } from './helpers/fake-sanity.mjs';
import { seedDocuments } from './helpers/settings-all-harness.mjs';
import { repo } from './helpers/control-world.mjs';

const playwright = await loadPlaywright();
if (!playwright) {
  console.log('SKIP  Playwright is not installed, so the page was not drawn.');
  console.log('0 of 0 passed');
  process.exit(0);
}

const shots = process.env.SHOTS_DIR || '';
if (shots) fs.mkdirSync(shots, { recursive: true });

const rows = defaultRotationRows().map((row, at) => Object.assign({ _key: 'row' + String(at).padStart(3, '0') }, row));
const documents = seedDocuments().map(doc => (doc._id === 'dashboardSettings' ? Object.assign({}, doc, { rotationRows: rows, rebootEnabled: false, rebootDays: [1, 2, 3], rebootTime: '03:30', rebootSkipBusy: true, rebootWaitMinutes: 30 }) : doc));
const sanity = makeFakeSanity(documents);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-tabs-page-'));
fs.mkdirSync(path.join(root, 'data'));
fs.writeFileSync(path.join(root, 'local.env'), "SANITY_WRITE_TOKEN='skFAKEtoken0123456789'\nCONTROL_PIN='123456'\n");
const config = Object.assign(readConfig({ CONTROL_ROOT: root, CONTROL_DATA: path.join(root, 'data'), CONTROL_ENV_FILE: path.join(root, 'local.env') }), { port: 0 });
const { server, ctx } = await createService(config, { pinCheck: () => true, fetch: sanity.fetch });
ctx.state.displayWorld = { at: Date.now() + 3600 * 1000, world: { content: { tasks: [] }, now: new Date(), match13: null, problem: '' } };

// The preview frames ask for the dashboard, which this test does not serve
const outer = http.createServer((req, res) => {
  if (req.url.startsWith('/dashboard/')) { res.writeHead(404); res.end('no'); return; }
  server.emit('request', req, res);
});
await new Promise(resolve => outer.listen(0, '127.0.0.1', resolve));
const base = 'http://teletraan.test:' + outer.address().port;
const browser = await playwright.chromium.launch({ args: ['--host-resolver-rules=MAP teletraan.test 127.0.0.1'] });

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

async function open(width, height, tab) {
  const context = await browser.newContext({ viewport: { width: width, height: height } });
  const page = await context.newPage();
  await page.goto(base + '/control/login.html');
  await page.evaluate(() => fetch('/control/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) }));
  await page.goto(base + '/control/#' + tab);
  await page.waitForSelector('#tabs button');
  await page.waitForTimeout(600);
  return { context, page };
}

const sideways = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

try {
  for (const [width, height] of [[1600, 1000], [390, 844]]) {
    const label = ' at ' + width;

    await check('every tab opens with its heading and sentence, nothing wider than the screen, and the tab buttons are 44px' + label, async () => {
      for (const tab of ['status', 'display', 'content', 'settings']) {
        const { context, page } = await open(width, height, tab);
        assert.equal(await page.locator('#tabs button[aria-selected="true"]').getAttribute('data-id'), tab);
        assert.ok((await page.locator('#page .lead').count()) >= 1, tab + ' has a sentence');
        assert.equal(await sideways(page), 0, tab + ' scrolls sideways');
        const small = await page.evaluate(() => Array.from(document.querySelectorAll('#tabs button, .help, .studio')).map(element => element.getBoundingClientRect().height).filter(high => high < 43.5));
        assert.deepEqual(small, [], tab + ' has a target under 44px');
        if (shots) await page.screenshot({ path: path.join(shots, 'tab-' + tab + '-' + width + '.png'), clip: { x: 0, y: 0, width: width, height: height } });
        await context.close();
      }
    });
  }

  await check('on a phone the four tabs are a bar fixed to the bottom, and the end of the page is not hidden behind it', async () => {
    const { context, page } = await open(390, 844, 'settings');
    const nav = await page.locator('#tabs').boundingBox();
    assert.ok(Math.abs(nav.y + nav.height - 844) < 1, 'the bar is at the bottom of the screen');
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('tabs')).position), 'fixed');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = await page.evaluate(() => { const box = document.getElementById('page').lastElementChild.getBoundingClientRect(); return box.bottom; });
    assert.ok(last <= nav.y + 1, 'the last card ends above the tab bar');
    await context.close();
  });

  await check('on a phone the Next, Pause and Reset bar sits just above the tab bar and the two do not overlap', async () => {
    const { context, page } = await open(390, 844, 'display');
    await page.waitForSelector('.quickbar');
    const bar = await page.locator('.quickbar').boundingBox();
    const nav = await page.locator('#tabs').boundingBox();
    assert.ok(bar.y + bar.height <= nav.y + 1, 'the quick bar ends where the tab bar starts');
    assert.ok(nav.y + nav.height >= 843);
    await context.close();
  });

  await check('the first visit shows the What do I do here note, Got it keeps it away after a reload, and Help brings it back', async () => {
    const { context, page } = await open(1600, 1000, 'content');
    assert.equal(await page.locator('.help-note').count(), 1);
    assert.match(await page.locator('.help-note').textContent(), /What do I do here\?/);
    await page.click('[data-help-done]');
    assert.equal(await page.locator('.help-note').count(), 0);
    await page.reload();
    await page.waitForSelector('.ct-block');
    assert.equal(await page.locator('.help-note').count(), 0, 'it stays dismissed');
    await page.click('#help');
    assert.equal(await page.locator('.help-note').count(), 1, 'Help brings it back');
    await context.close();
  });

  await check('the arrow keys move between the tabs, and only the open tab is in the tab order', async () => {
    const { context, page } = await open(1600, 1000, 'status');
    await page.focus('#tabs button[data-id="status"]');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#tabs button[aria-selected="true"]').getAttribute('data-id'), 'display');
    await page.keyboard.press('End');
    assert.equal(await page.locator('#tabs button[aria-selected="true"]').getAttribute('data-id'), 'settings');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#tabs button[aria-selected="true"]').getAttribute('data-id'), 'status');
    assert.deepEqual(await page.locator('#tabs button').evaluateAll(list => list.map(button => button.tabIndex)), [0, -1, -1, -1]);
    assert.equal(await page.locator('#page').getAttribute('aria-labelledby'), 'tab-status');
    await context.close();
  });

  await check('More tools on Display starts closed, holds Quick hide, Hidden transitions and Motion, and a browser remembers it open', async () => {
    const { context, page } = await open(1600, 1000, 'display');
    await page.waitForSelector('.more-tools');
    assert.equal(await page.locator('.more-tools').evaluate(element => element.open), false);
    assert.equal(await page.locator('.more-tools [data-quick]').count(), 1);
    assert.equal(await page.locator('.more-tools [data-hidden-card]').count(), 1);
    assert.equal(await page.locator('.more-tools h2', { hasText: 'Motion' }).count(), 1);
    await page.click('.more-tools > summary');
    assert.equal(await page.locator('.more-tools').evaluate(element => element.open), true);
    await page.waitForFunction(() => window.localStorage.getItem('teletraan.control.more.display') === 'open');
    await page.reload();
    await page.waitForSelector('.more-tools');
    assert.equal(await page.locator('.more-tools').evaluate(element => element.open), true, 'remembered by this browser');
    await context.close();
  });

  await check('a chosen button is filled with a check mark, a switch shows On or Off, and the keyboard focus shows', async () => {
    const { context, page } = await open(1600, 1000, 'display');
    await page.waitForSelector('.drow');
    const chosen = page.locator('.drow').first().locator('.choice > input:checked + .choice-face').first();
    const colors = await chosen.evaluate(element => [getComputedStyle(element).backgroundColor, getComputedStyle(element.querySelector('.choice-mark'), '::before').content]);
    assert.equal(colors[0], 'rgb(124, 58, 237)');
    assert.equal(colors[1], '"✓"');
    const word = await page.locator('.drow').first().locator('.switch-word').first().evaluate(element => getComputedStyle(element, '::before').content);
    assert.match(word, /^"(On|Off)"$/);
    await page.locator('.drow').first().locator('.choice > input').first().focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    const ring = await page.evaluate(() => getComputedStyle(document.activeElement.nextElementSibling).boxShadow);
    assert.notEqual(ring, 'none', 'the focused button has a ring');
    await context.close();
  });

  await check('Scheduled reboot: a change counts as unsaved, Save to draft writes the draft, Publish to the wall puts it live, Undo takes a change back', async () => {
    const { context, page } = await open(1600, 1000, 'settings/reboot');
    await page.waitForSelector('.reboot-card [data-bar]');
    assert.match(await page.locator('.reboot-card [data-unsaved]').textContent(), /No unsaved changes\./);
    assert.equal(await page.locator('.reboot-card [data-act="save"]').isDisabled(), true);
    await page.locator('.reboot-card [data-enabled]').evaluate(input => input.click());
    assert.match(await page.locator('.reboot-card [data-unsaved]').textContent(), /1 unsaved change\./);
    await page.click('.reboot-card [data-act="undo"]');
    await page.waitForSelector('.reboot-card [data-bar]');
    assert.match(await page.locator('.reboot-card [data-unsaved]').textContent(), /No unsaved changes\./);
    assert.equal(await page.locator('.reboot-card [data-enabled]').isChecked(), false, 'Undo put the value back');

    await page.locator('.reboot-card [data-enabled]').evaluate(input => input.click());
    await page.locator('.reboot-card [data-day="0"]').evaluate(input => input.click());
    assert.match(await page.locator('.reboot-card [data-unsaved]').textContent(), /2 unsaved changes\./);
    assert.equal(await page.locator('.reboot-card [data-act="publish"]').isDisabled(), true, 'Publish waits for a saved draft');
    await page.click('.reboot-card [data-act="save"]');
    await page.waitForSelector('.reboot-card .result[data-state="done"]');
    const draft = sanity.stored['drafts.dashboardSettings'];
    assert.equal(draft.rebootEnabled, true);
    assert.deepEqual(draft.rebootDays, [0, 1, 2, 3]);
    assert.match(await page.locator('.reboot-card .result').textContent(), /Saved to the draft\. Press Publish to the wall/);
    assert.equal(await page.locator('.reboot-card [data-act="publish"]').isDisabled(), false);

    page.once('dialog', dialog => dialog.accept());
    await page.click('.reboot-card [data-act="publish"]');
    await page.waitForFunction(() => /Published/.test((document.querySelector('.reboot-card .result') || {}).textContent || ''));
    assert.equal(sanity.stored.dashboardSettings.rebootEnabled, true);
    assert.ok(!sanity.stored['drafts.dashboardSettings'], 'the draft is gone after publishing');
    if (shots) await page.screenshot({ path: path.join(shots, 'reboot-1600.png'), fullPage: true });
    await context.close();
  });

  await check('Scheduled reboot: a Studio copy that changed meanwhile is the shared card with Replace, Refresh from Sanity and Keep editing', async () => {
    const { context, page } = await open(390, 844, 'settings/reboot');
    await page.waitForSelector('.reboot-card [data-bar]');
    await page.locator('.reboot-card [data-skip]').evaluate(input => input.click());
    sanity.touch('dashboardSettings', { pageSeconds: 41 });
    await page.click('.reboot-card [data-act="save"]');
    await page.waitForSelector('.reboot-card .studio-changed');
    assert.match(await page.locator('.studio-changed').textContent(), /The Studio has a newer copy/);
    assert.equal(sanity.stored.dashboardSettings.rebootSkipBusy, true, 'nothing was written');
    await page.click('.studio-changed [data-act="keep-editing"]');
    assert.equal(await page.locator('.studio-changed').count(), 0);
    assert.match(await page.locator('.reboot-card [data-unsaved]').textContent(), /1 unsaved change/);
    assert.equal(await sideways(page), 0);
    await context.close();
  });
} finally {
  await browser.close();
  outer.closeAllConnections();
  outer.close();
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(passed + ' of ' + passed + ' passed');
process.exit(0);
