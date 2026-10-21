// The pictures of a row in the Display tab, in a real browser: the real control service and the real dashboard on one fake
// address, a fake Sanity, the sample content in the frames. Runs only when Playwright loads (it is not on the Teletraan
// computer); without it this says so and passes.
//
//   node tests/control-display-pictures.test.mjs

import assert from 'node:assert/strict';
import { loadPlaywright } from '../tools/screenshots.mjs';
import { startDisplayWorld } from './helpers/display-world.mjs';

const playwright = await loadPlaywright();
if (!playwright) {
  console.log('Skipped: Playwright is not installed here (tests/motion/README.md says how to run browser tests on a laptop).');
  process.exit(0);
}

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const world = await startDisplayWorld();
// A name that is not a loopback address, so the page does not think it is on the Teletraan computer
const browser = await playwright.chromium.launch({ args: ['--host-resolver-rules=MAP teletraan.test 127.0.0.1'] });
const base = world.url.replace('127.0.0.1', 'teletraan.test');

async function openDisplay(width, height, address = base) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const outside = [];
  page.on('request', request => {
    if (request.frame() !== page.mainFrame()) outside.push({ method: request.method(), url: request.url() });
  });
  await page.goto(address + '/control/login.html');
  await page.evaluate(() => fetch('/control/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) }));
  await page.goto(address + '/control/#display');
  await page.waitForSelector('.drow');
  await page.evaluate(() => document.querySelector('.drow').scrollIntoView());
  return { context, page, outside };
}

const frames = page => page.evaluate(() => ({
  thumbs: document.querySelectorAll('.thumb-frame').length,
  large: document.querySelectorAll('.large-frame').length,
  all: document.querySelectorAll('iframe').length,
}));
const largeSource = page => page.evaluate(() => (document.querySelector('.large-frame') || {}).src || '');
const rowOf = panel => world.rows.find(row => row.panel === panel);

try {
  await check('a computer gets the large picture and at most six small ones, whatever the length of the list', async () => {
    const { context, page } = await openDisplay(1440, 900);
    assert.ok(world.rows.length > 30, 'a long list');
    await page.waitForSelector('.thumb-frame');
    await page.waitForSelector('.large-frame');

    let most = 0;
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += 450) {
      await page.evaluate(top => window.scrollTo(0, top), y);
      await page.waitForTimeout(150);
      most = Math.max(most, (await frames(page)).thumbs);
    }
    assert.ok(most >= 2 && most <= 6, 'between 2 and 6 small pictures were live at once, it was ' + most);
    const now = await frames(page);
    assert.equal(now.large, 1);
    assert.ok(now.all <= 7);

    const attributes = await page.evaluate(() => Array.from(document.querySelectorAll('iframe')).map(frame => [frame.getAttribute('sandbox'), frame.getAttribute('referrerpolicy'), frame.getAttribute('tabindex')]));
    attributes.forEach(item => assert.deepEqual(item, ['allow-scripts allow-same-origin', 'no-referrer', '-1']));
    await context.close();
  });

  await check('picking a row, or changing its settings before any save, changes the large picture and not the other rows', async () => {
    const { context, page } = await openDisplay(1440, 900);
    await page.waitForSelector('.large-frame');
    const first = await largeSource(page);
    assert.ok(first.includes('rowpreview='));

    const monday = rowOf('monday-department');
    const card = '.drow[data-key="' + monday._key + '"]';
    await page.locator(card).scrollIntoViewIfNeeded();
    await page.locator(card + ' h3').click();
    await page.waitForFunction(old => (document.querySelector('.large-frame') || {}).src !== old, first);
    assert.equal(await page.locator(card).getAttribute('data-selected'), 'yes');
    const picked = decodeURIComponent(await largeSource(page));
    assert.ok(picked.includes('"panel":"monday-department"') && picked.includes('"department":"' + monday.department + '"'));

    // Mark the small frames that are live, change a Department, and see that the others are the same elements and the large one moved
    await page.evaluate(() => document.querySelectorAll('.thumb-frame').forEach((frame, at) => { frame.dataset.mark = 'm' + at; frame.__mark = true; }));
    const before = await page.evaluate(selector => Array.from(document.querySelectorAll('.thumb-frame')).filter(frame => !frame.closest(selector)).map(frame => frame.dataset.mark), card);
    const other = monday.department === 'design' ? 'electrical' : 'design';
    await page.selectOption(card + ' select[data-field="department"]', other);
    await page.waitForFunction(old => decodeURIComponent((document.querySelector('.large-frame') || {}).src || '') !== old, picked);
    assert.ok(decodeURIComponent(await largeSource(page)).includes('"department":"' + other + '"'), 'the picture shows the new department before the row is saved');
    const after = await page.evaluate(selector => Array.from(document.querySelectorAll('.thumb-frame')).filter(frame => !frame.closest(selector) && frame.__mark).map(frame => frame.dataset.mark), card);
    assert.deepEqual(after, before, 'the small pictures of the other rows were not loaded again');
    assert.ok(!world.requests.some(request => request.method === 'POST' && request.url.includes('/display/save')), 'nothing was saved');
    await context.close();
  });

  await check('the frames only read: no write, no call to the control service, nothing kept in the browser', async () => {
    const { context, page, outside } = await openDisplay(1440, 900);
    await page.waitForSelector('.large-frame');
    await page.waitForTimeout(4000);
    assert.ok(outside.length > 20, 'the frames made requests (' + outside.length + ')');
    outside.forEach(request => {
      assert.equal(request.method, 'GET', request.url);
      assert.ok(!new URL(request.url).pathname.startsWith('/control/'), request.url);
    });
    const keys = await page.evaluate(() => Object.keys(localStorage));
    assert.ok(keys.every(key => key === 'teletraan-display-thumbs'), 'only the switch is kept: ' + keys.join(', '));
    const reports = world.requests.filter(request => request.method === 'POST' && request.url.includes('/control/api/now'));
    assert.equal(reports.length, 0, 'a preview never reports as the wall');
    await context.close();
  });

  await check('a change of the content shows in the large picture by the dashboard\'s own cycle, with no help from the page', async () => {
    const { context, page } = await openDisplay(1440, 900);
    const tasks = world.rows.find(row => row.panel === 'monday-department' && row.department === 'build' && row.list !== 'done');
    await page.locator('.drow[data-key="' + tasks._key + '"] h3').scrollIntoViewIfNeeded();
    await page.locator('.drow[data-key="' + tasks._key + '"] h3').click();
    await page.waitForSelector('.large-frame');
    const inside = () => page.frames().find(frame => frame !== page.mainFrame() && frame.url().includes('rowpreview=%7B%22panel%22%3A%22monday-department%22'));
    await page.waitForFunction(() => document.querySelector('.large-frame'));
    for (let tries = 0; tries < 40 && !(inside() && await inside().locator('text=[Task in progress]').count()); tries += 1) await page.waitForTimeout(500);
    assert.ok(inside() && await inside().locator('text=[Task in progress]').count() > 0, 'the tasks of the sample are drawn');

    world.editSample(content => { content.tasks.forEach(task => { if (task.title === '[Task in progress]') task.title = '[Changed in the content]'; }); });
    const frame = inside();
    for (let tries = 0; tries < 80 && !(await frame.locator('text=[Changed in the content]').count()); tries += 1) await page.waitForTimeout(500);
    assert.ok(await frame.locator('text=[Changed in the content]').count() > 0, 'the new title shows within the 30 second cycle');
    await context.close();
  });

  await check('every frame is dropped while the tab is hidden and comes back when it is shown', async () => {
    const { context, page } = await openDisplay(1440, 900);
    await page.waitForSelector('.thumb-frame');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => document.querySelectorAll('iframe').length === 0);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForSelector('.large-frame');
    await page.waitForSelector('.thumb-frame');
    await context.close();
  });

  await check('the switch Show thumbnails is remembered', async () => {
    const { context, page } = await openDisplay(1440, 900);
    await page.waitForSelector('.thumb-frame');
    await page.waitForSelector('.large-frame');
    await page.locator('[data-thumb-switch]').uncheck();
    await page.waitForFunction(() => document.querySelectorAll('.thumb-frame').length === 0);
    assert.equal((await frames(page)).large, 1, 'the large picture stays');
    await page.reload();
    await page.waitForSelector('.drow');
    await page.waitForTimeout(800);
    assert.equal(await page.locator('[data-thumb-switch]').isChecked(), false);
    assert.equal((await frames(page)).thumbs, 0);
    await context.close();
  });

  await check('a phone has the large picture above the rows, no small pictures at first, and one for the selected row when asked', async () => {
    const { context, page } = await openDisplay(390, 844);
    await page.waitForSelector('.large-frame');
    assert.equal(await page.locator('[data-thumb-switch]').isChecked(), false);
    assert.equal((await frames(page)).thumbs, 0);
    assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'nothing is wider than the screen');
    const order = await page.evaluate(() => document.querySelector('[data-preview-card]').getBoundingClientRect().top < document.querySelector('.rows-card').getBoundingClientRect().top);
    assert.ok(order, 'the picture is above the rows');
    await page.locator('[data-thumb-switch]').check();
    await page.locator('.drow[data-selected]').scrollIntoViewIfNeeded();
    await page.waitForSelector('.thumb-frame');
    await page.waitForTimeout(500);
    assert.equal((await frames(page)).thumbs, 1);
    await context.close();
  });

  await check('a wide page has the preview and its four buttons in a right column that follows the scroll, and Edit jumps to the rows', async () => {
    const { context, page } = await openDisplay(1440, 900);
    const box = selector => page.evaluate(name => { const r = document.querySelector(name).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }, selector);
    const left = await box('.display-left');
    const card = await box('[data-preview-card]');
    assert.ok(card.left >= left.right, 'the preview is to the right of everything else');
    const buttons = await page.locator('[data-preview-card] [data-save-bar] button').allTextContents();
    assert.deepEqual(buttons, ['Save to draft', 'Publish to the wall', 'Refresh from Sanity', 'Undo']);
    assert.equal(await page.locator('.display-left [data-action="save"], .display-left [data-action="publish"]').count(), 0, 'no second set of buttons on the left');
    await page.evaluate(() => window.scrollTo(0, 2500));
    await page.waitForTimeout(300);
    const moved = await box('[data-preview-card]');
    assert.ok(moved.top >= 0 && moved.top <= 40 && moved.bottom <= 900, 'the preview stays in view after a long scroll');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('[data-action="edit-rows"]').click();
    await page.waitForTimeout(400);
    const rows = await box('.rows-card');
    assert.ok(rows.top >= -2 && rows.top < 450, 'the rows are at the top of the screen');
    assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('.drow'))), true, 'a field of the first row has the focus');
    assert.equal(await page.locator('[data-theme-card] .trow').count(), 7, 'Theme rotation has a row for each day');
    assert.equal(await page.locator('[data-theme-card] [data-week-strip]').count(), 0);
    await page.locator('[data-theme-day="friday"]').selectOption({ index: 1 });
    assert.match(await page.locator('[data-save-bar] .note').textContent(), /changes that are not saved/, 'a theme change shows in the one bar');
    assert.equal(await page.locator('[data-save-bar] [data-action="save"]').isEnabled(), true);
    await context.close();
  });

  await check('opened on the Teletraan computer itself the page says so and draws nothing until asked', async () => {
    const { context, page } = await openDisplay(1440, 900, world.url.replace('127.0.0.1', 'localhost'));
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('[data-kiosk-note]').isVisible(), true);
    assert.equal(await page.locator('[data-thumb-switch]').isDisabled(), true);
    assert.deepEqual(await frames(page), { thumbs: 0, large: 0, all: 0 });
    await page.locator('[data-action="preview-here"]').click();
    await page.waitForSelector('.large-frame');
    assert.equal((await frames(page)).thumbs, 0);
    await context.close();
  });
} finally {
  await browser.close();
  await world.close();
}

console.log('\n' + passed + ' checks passed');
process.exit(0);
