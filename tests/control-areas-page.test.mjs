// The five areas of the control page in a real browser (Playwright) over the real service with a fake computer around it
// (tests/helpers/control-page-harness.mjs): the banner and the five dots, the plain sentence for a failed calendar, what an
// action shows while it runs and after, the questions before a restart, the computer that cannot be reached, the empty page, a
// keyboard only pass through every area, contrast at both colour schemes, no console errors, and no request to any other host.
// Skipped when Playwright is not installed.
//
//   node tests/control-areas-page.test.mjs

import assert from 'node:assert/strict';
import { startControl } from './helpers/control-page-harness.mjs';

const world = await startControl({ scenario: 'good' });
if (!world) {
  console.log('SKIP  Playwright is not installed, so the page was not drawn.');
  console.log('0 of 0 passed');
  process.exit(0);
}

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const areas = ['now', 'show', 'update', 'computer', 'details'];
const sections = ['show/photos', 'show/announcements', 'show/roster', 'update/publish', 'update/keys', 'update/monday', 'computer/network', 'computer/schedule', 'computer/screen', 'computer/copy', 'details/output', 'details/log'];
const settle = page => page.waitForTimeout(1500);
const text = (page, selector) => page.locator(selector).first().textContent().then(value => value.replace(/\s+/g, ' ').trim());

// Contrast of every piece of text against the colour behind it, from the computed styles of the page itself
function contrastProbe() {
  const parse = value => { const found = /rgba?\(([^)]+)\)/.exec(value); if (!found) return null; const part = found[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: part[0], g: part[1], b: part[2], a: part.length > 3 ? part[3] : 1 }; };
  const light = ({ r, g, b }) => { const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
  const back = element => {
    for (let at = element; at; at = at.parentElement) {
      const color = parse(getComputedStyle(at).backgroundColor);
      if (color && color.a > 0.95) return color;
    }
    return parse(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  };
  const bad = [];
  document.querySelectorAll('body *').forEach(element => {
    if (!Array.from(element.childNodes).some(node => node.nodeType === 3 && node.textContent.trim() !== '')) return;
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0 || style.visibility === 'hidden' || element.closest('[hidden], [disabled], .visually-hidden, details:not([open]) > :not(summary)')) return;
    const fore = parse(style.color);
    if (!fore) return;
    const behind = back(element);
    const a = light(fore) + 0.05;
    const b = light(behind) + 0.05;
    const ratio = Math.max(a, b) / Math.min(a, b);
    const size = parseFloat(style.fontSize);
    const need = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
    if (ratio < need) bad.push(element.tagName + '.' + element.className + ' "' + element.textContent.trim().slice(0, 30) + '" ' + ratio.toFixed(2));
  });
  return bad;
}

try {
  await check('all good: the banner says All good, the five dots each have a word, and the last remote action shows', async () => {
    const { context, page } = await world.open(390, 844, 'now');
    await settle(page);
    assert.match(await text(page, '[data-banner] .banner-words'), /^All good$/);
    assert.deepEqual(await page.locator('button[data-dot]').evaluateAll(list => list.map(button => button.dataset.dot)), ['sanity', 'monday', 'band', 'network', 'screen']);
    const words = await page.locator('button[data-dot] .dot-word').allTextContents();
    assert.deepEqual(words, ['OK', 'OK', 'OK', 'OK', 'OK']);
    assert.match(await text(page, '[data-last]'), /Last remote action\s*Restart the dashboard, asked by Jason/);
    assert.match(await text(page, '[data-showing]'), /Original theme/);
    assert.match(await text(page, '[data-attention]'), /Nothing needs attention/);
    await context.close();
  });

  await check('a failed calendar says it in one plain sentence with what the TV shows, and keeps the raw reason in a drawer', async () => {
    world.set({ scenario: 'calendar-failed' });
    const { context, page } = await world.open(390, 844, 'now');
    await settle(page);
    assert.match(await text(page, '[data-banner] .banner-words'), /Needs attention: 1 problem/);
    const message = await text(page, '.problem-message');
    assert.match(message, /^Calendars didn't update\. The last good copy from \d+:\d\d (AM|PM) is still showing\.$/);
    assert.match(await text(page, '.problem .muted'), /still showing the copy from/);
    const visible = await page.locator('#area').evaluate(area => area.innerText);
    assert.ok(!/TLS|ssl error|handshake|systemctl|journalctl/i.test(visible.split('Show details')[0]), 'no raw reason on the page itself');
    assert.equal(await page.locator('.problem details').getAttribute('open'), null, 'the drawer starts closed');
    await page.locator('.problem details summary').click();
    assert.match(await text(page, '.problem .raw'), /TLS handshake failed/);
    assert.deepEqual(await page.locator('.problem-actions button').allTextContents().then(list => list.map(item => item.trim())), ['Sync calendars now', 'Run network check']);
    assert.equal(await page.locator('button[data-dot="band"] .dot-word').textContent(), 'Problem');
    await context.close();
    world.set({ scenario: 'good' });
  });

  await check('syncing: the button is disabled with a spinner, says what it does, adds a still working note, then ends with Done at <time> and is kept after leaving', async () => {
    const { context, page } = await world.open(390, 844, 'now');
    await settle(page);
    await page.evaluate(() => import('./action-run.js').then(module => { module.timing.slowMs = 400; }));
    world.set({ helperDelay: 700 });
    const button = page.locator('.primary-grid button[data-action="sync-everything"]');
    await button.click();
    assert.equal(await button.isDisabled(), true);
    assert.equal(await button.getAttribute('aria-busy'), 'true');
    assert.equal(await button.locator('.spinner').isVisible(), true);
    const status = page.locator('.primary-grid button[data-action="sync-everything"] + .action-status');
    assert.match(await status.textContent(), /Syncing everything\.\.\./);
    assert.equal(await status.getAttribute('role'), 'status');
    await page.waitForFunction(() => /Still working/.test(document.querySelector('.action-status[data-state="working"]').textContent));
    await page.waitForSelector('.primary-grid button[data-action="sync-everything"]:not([disabled])', { timeout: 20000 });
    assert.match(await status.textContent(), /^Done at \d+:\d\d (AM|PM)\. 6 ran\.$/);
    assert.deepEqual(world.state.helped.filter(item => item[0] === 'sync-now').map(item => item[1]), ['calendars', 'monday', 'frc', 'news', 'match13', 'photos-drive']);
    world.set({ helperDelay: 0 });
    await page.click('#tabs a[data-id="details"]');
    await page.click('#tabs a[data-id="now"]');
    assert.match(await text(page, '.primary-grid button[data-action="sync-everything"] + .action-status'), /^Last time: Done at \d+:\d\d (AM|PM)\. 6 ran\./);
    await page.click('#tabs a[data-id="details"]');
    await page.click('a.subnav-link:has-text("Action output")');
    await page.waitForSelector('.entries li');
    assert.ok((await page.locator('.entries li').count()) >= 6, 'the raw output of every sync is kept in Details');
    await context.close();
  });

  await check('a sync that fails ends as Didn\'t finish with a reason, and one that is not installed is skipped, and the others still run', async () => {
    world.state.helped.length = 0;
    world.set({ helperFails: { 'sync-now': 'The helper did not finish (failed 5). Unit teletraan-news.service not found.' } });
    const { context, page } = await world.open(390, 844, 'update');
    await page.waitForSelector('.source');
    await page.click('button[data-action="sync-everything"]');
    await page.waitForSelector('button[data-action="sync-everything"]:not([disabled])', { timeout: 20000 });
    const lines = await page.locator('.sync-lines li').allTextContents();
    assert.equal(lines.length, 6);
    assert.ok(lines.every(line => /Skipped/.test(line)), lines.join(' | '));
    assert.equal(world.state.helped.filter(item => item[0] === 'sync-now').length, 6, 'one skipped source does not stop the next');
    world.set({ helperFails: { 'sync-now': 'The helper did not finish (failed 1). Monday refused the token.' } });
    await page.click('.source[data-source="monday"] button[data-action="sync-monday"]');
    await page.waitForSelector('.source[data-source="monday"] button[data-action="sync-monday"]:not([disabled])');
    assert.match(await text(page, '.source[data-source="monday"] .action-status'), /^Didn't finish: The helper did not finish/);
    world.set({ helperFails: {} });
    await context.close();
  });

  await check('a restart asks first, names what happens and how long the TV may go dark, Cancel does nothing, and sync never asks', async () => {
    world.state.helped.length = 0;
    const { context, page } = await world.open(390, 844, 'now');
    await settle(page);
    await page.click('button[data-action="restart-screen"]');
    const dialog = page.locator('dialog.ask');
    await dialog.waitFor();
    assert.match(await dialog.textContent(), /Restart the dashboard\?/);
    assert.match(await dialog.textContent(), /dark for about 30 seconds/);
    await page.click('dialog.ask [data-ask="no"]');
    await page.waitForTimeout(200);
    assert.equal(world.state.helped.filter(item => item[0] === 'restart-kiosk').length, 0, 'Cancel asks the helper nothing');
    await page.click('button[data-action="restart-screen"]');
    await page.click('dialog.ask [data-ask="yes"]');
    await page.waitForFunction(() => /Done at/.test(document.querySelector('button[data-action="restart-screen"] + .action-status').textContent));
    assert.equal(world.state.helped.filter(item => item[0] === 'restart-kiosk').length, 1);
    await page.click('button[data-action="sync-everything"]');
    assert.equal(await page.locator('dialog.ask').count(), 0, 'sync does not ask');
    await page.waitForSelector('button[data-action="sync-everything"]:not([disabled])', { timeout: 20000 });
    await page.click('#tabs a[data-id="computer"]');
    await page.click('button[data-action="reboot"]');
    assert.match(await page.locator('dialog.ask').textContent(), /dark for about 3 minutes/);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    assert.equal(await page.locator('dialog.ask').count(), 0, 'Escape cancels');
    assert.equal(world.state.helped.filter(item => item[0] === 'reboot').length, 0);
    await context.close();
  });

  await check('an action that takes too long stops waiting after the limit and says so', async () => {
    const { context, page } = await world.open(390, 844, 'computer/network');
    await page.waitForSelector('button[data-action="network-check"]');
    await page.evaluate(() => import('./action-run.js').then(module => { module.timing.hardMs = 500; }));
    world.set({ helperDelay: 2500 });
    await page.click('button[data-action="network-check"]');
    await page.waitForFunction(() => /Didn't finish/.test(document.querySelector('button[data-action="network-check"] + .action-status').textContent), null, { timeout: 8000 });
    assert.match(await text(page, 'button[data-action="network-check"] + .action-status'), /stopped waiting/);
    world.set({ helperDelay: 0 });
    await context.close();
  });

  await check('the computer cannot be reached: a banner with the last known status and the time, and it goes away when it answers', async () => {
    const { context, page } = await world.open(390, 844, 'now');
    await settle(page);
    await page.route('**/api/overview', route => route.abort());
    await page.evaluate(() => import('./poll.js').then(module => module.refreshNow()));
    await page.waitForSelector('#offline:not([hidden])');
    assert.match(await text(page, '#offline'), /Can't reach the computer\./);
    assert.match(await text(page, '#offline'), /last known status is from \d+:\d\d (AM|PM)/);
    assert.match(await text(page, '#offline'), /Trying again every \d+ seconds/);
    assert.match(await text(page, '[data-banner] .banner-time'), /the computer is not answering now/);
    assert.equal(await page.locator('button[data-dot]').count(), 5, 'the last known status stays on the page');
    await page.unroute('**/api/overview');
    await page.evaluate(() => import('./poll.js').then(module => module.refreshNow()));
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#offline').isHidden(), true);
    await context.close();
  });

  await check('status is asked every 10 seconds while the tab is visible and not while it is hidden, with backoff after failures', async () => {
    const poll = await import('../control/static/poll.js');
    assert.deepEqual([0, 1, 2, 3, 4, 9].map(failures => poll.waitAfter(failures)), [10000, 10000, 20000, 40000, 60000, 60000]);
    const { context, page } = await world.open(390, 844, 'now');
    await settle(page);
    const asked = [];
    page.on('request', request => { if (request.url().includes('/api/overview')) asked.push(Date.now()); });
    await page.evaluate(() => import('./poll.js').then(module => { module.timing.everyMs = 300; document.dispatchEvent(new Event('visibilitychange')); }));
    await page.waitForTimeout(1500);
    const visible = asked.length;
    assert.ok(visible >= 3, 'it keeps asking while visible: ' + visible);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(300);
    const before = asked.length;
    await page.waitForTimeout(1200);
    assert.equal(asked.length, before, 'it pauses while hidden');
    await context.close();
  });

  await check('empty: a computer that knows nothing yet shows waiting words, not a broken page', async () => {
    world.set({ scenario: 'empty' });
    const errors = [];
    for (const area of areas) {
      const { context, page } = await world.open(390, 844, area, { errors: errors });
      await settle(page);
      assert.ok((await text(page, '#area')).length > 40, area + ' has words');
      assert.equal(await page.locator('#area .bad').count() < 3, true, area + ' is not a wall of errors');
      await context.close();
    }
    const { context, page } = await world.open(390, 844, 'now');
    await settle(page);
    assert.match(await text(page, '[data-banner] .banner-words'), /All good|Needs attention/);
    assert.match(await text(page, '[data-showing]'), /not reported yet/);
    await context.close();
    world.set({ scenario: 'good' });
  });

  await check('one address for each area and each section: a reload lands in the same place', async () => {
    const { context, page } = await world.open(390, 844, 'show/photos');
    await page.waitForSelector('.subnav');
    assert.equal(await page.locator('.subnav-link[aria-current="page"]').textContent(), 'Photos');
    await page.reload();
    await page.waitForSelector('.subnav');
    assert.equal(await page.locator('.subnav-link[aria-current="page"]').textContent(), 'Photos');
    assert.equal(await page.evaluate(() => location.hash), '#show/photos');
    await page.goto(world.base + '/control/#settings/reboot');
    await page.waitForSelector('.reboot-card');
    assert.equal(await page.evaluate(() => location.hash), '#computer/schedule');
    await page.goto(world.base + '/control/#content/roster');
    await page.waitForFunction(() => location.hash === '#show/roster');
    await context.close();
  });

  await check('a keyboard only pass: every area is reachable with Tab and Enter, every control that takes focus shows a ring, and there are no console errors', async () => {
    const errors = [];
    const { context, page } = await world.open(1440, 900, 'now', { errors: errors });
    await settle(page);
    for (const area of areas) {
      await page.focus('#tabs a[data-id="' + area + '"]');
      await page.keyboard.press('Enter');
      await page.waitForSelector('#tabs a[data-id="' + area + '"][aria-current="page"]');
      await page.waitForTimeout(600);
      const seen = [];
      for (let step = 0; step < 14; step += 1) {
        await page.keyboard.press('Tab');
        const state = await page.evaluate(() => {
          const element = document.activeElement;
          if (!element || element === document.body) return null;
          const style = getComputedStyle(element);
          const label = element.getAttribute('aria-label') || element.textContent.trim().slice(0, 30) || element.id || element.tagName;
          return { label: label, ring: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 || style.boxShadow !== 'none', name: element.tagName };
        });
        if (state) seen.push(state);
      }
      assert.ok(seen.length >= 3, area + ': Tab moves through the page');
      const noRing = seen.filter(state => !state.ring && !/INPUT/.test(state.name));
      assert.deepEqual(noRing.map(state => state.label), [], area + ' has a control with no focus ring');
    }
    // Enter and Space press a button
    await page.focus('#tabs a[data-id="update"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('button[data-action="sync-everything"]');
    await page.focus('.source[data-source="news"] button[data-action="sync-news"]');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => /Done at/.test(document.querySelector('.source[data-source="news"] .action-status').textContent));
    assert.deepEqual(errors, [], 'no console errors');
    await context.close();
  });

  for (const dark of [false, true]) {
    await check('contrast is at least 4.5 to 1 (3 to 1 for large text) on every area at 390 and 1440, ' + (dark ? 'dark' : 'light'), async () => {
      world.set({ scenario: 'calendar-failed' });
      for (const [width, height] of [[390, 844], [1440, 900]]) {
        for (const area of areas.concat(width === 390 ? sections : [])) {
          const { context, page } = await world.open(width, height, area, { dark: dark });
          await settle(page);
          const bad = await page.evaluate(contrastProbe);
          assert.deepEqual(bad.slice(0, 6), [], area + ' at ' + width + (dark ? ' dark' : ' light') + ' has text under the limit');
          await context.close();
        }
      }
      world.set({ scenario: 'good' });
    });
  }

  await check('light and dark follow the system and the Theme button chooses one and remembers it', async () => {
    const colour = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const light = await world.open(390, 844, 'now');
    const dark = await world.open(390, 844, 'now', { dark: true });
    assert.notEqual(await colour(light.page), await colour(dark.page));
    await light.page.click('#theme');
    assert.equal(await light.page.evaluate(() => document.documentElement.dataset.theme), 'light');
    await light.page.click('#theme');
    assert.equal(await light.page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    assert.equal(await colour(light.page), await colour(dark.page), 'the manual choice wins over the system');
    await light.page.reload();
    await light.page.waitForSelector('#tabs a');
    assert.equal(await light.page.evaluate(() => document.documentElement.dataset.theme), 'dark', 'remembered');
    await light.context.close();
    await dark.context.close();
  });

  await check('reduced motion stops the spinner turning, and the sidebar replaces the bottom bar from 900px', async () => {
    const calm = await world.open(390, 844, 'now', { reduceMotion: true });
    assert.equal(await calm.page.evaluate(() => getComputedStyle(document.querySelector('.spinner')).animationName), 'none');
    await calm.context.close();
    const narrow = await world.open(390, 844, 'now');
    const wide = await world.open(1440, 900, 'now');
    assert.equal(await narrow.page.evaluate(() => getComputedStyle(document.getElementById('tabs')).position), 'fixed');
    assert.equal(await wide.page.evaluate(() => getComputedStyle(document.getElementById('tabs')).position), 'sticky');
    assert.ok((await wide.page.locator('#tabs').boundingBox()).x < 5 && (await wide.page.locator('#tabs').boundingBox()).width < 260, 'a sidebar on the left');
    const tall = await narrow.page.evaluate(() => Array.from(document.querySelectorAll('#tabs a, .primary-grid .btn, .dot-button')).map(element => element.getBoundingClientRect().height).filter(high => high < 47.5));
    assert.deepEqual(tall, [], 'every target is 48px or more');
    await narrow.context.close();
    await wide.context.close();
  });

  await check('a 360px phone has no sideways scroll in any area', async () => {
    for (const area of areas) {
      const { context, page } = await world.open(360, 740, area);
      await settle(page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, area + ' scrolls sideways at 360');
      await context.close();
    }
  });

  await check('the page asks only its own host: no request in any area goes anywhere else, and every link and call is relative', async () => {
    const requests = [];
    const host = new URL(world.base).host;
    for (const area of areas.concat(sections)) {
      const { context, page } = await world.open(1440, 900, area, { requests: requests });
      await settle(page);
      await context.close();
    }
    assert.ok(requests.length > 50, 'the log has the requests: ' + requests.length);
    const other = requests.filter(url => !url.startsWith('data:') && new URL(url).host !== host);
    assert.deepEqual(other, [], 'requests to another host');
  });

  await check('sign-in: a wrong PIN says so and how many tries are left, and after the last one the form says how long to wait and stops', async () => {
    const other = await startControl({ scenario: 'good' });
    try {
      const context = await other.browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.goto(other.base + '/control/');
      assert.equal(await page.title(), 'Sign in - Teletraan I control');
      await page.fill('#pin', '1111');
      await page.press('#pin', 'Enter');
      await page.waitForFunction(() => /That PIN is not right\. 5 tries left\./.test(document.getElementById('message').textContent));
      assert.equal(await page.getAttribute('#message', 'aria-live'), 'polite');
      for (let again = 0; again < 5; again += 1) {
        await page.fill('#pin', '1111');
        await page.press('#pin', 'Enter');
        await page.waitForTimeout(200);
      }
      await page.waitForFunction(() => /Too many wrong tries, so sign-in is paused\. Try again in 60 minutes\./.test(document.getElementById('message').textContent));
      assert.equal(await page.locator('#go').isDisabled(), true);
      assert.equal(await page.locator('#pin').isDisabled(), true);
      await context.close();
    } finally {
      await other.close();
    }
  });
} finally {
  await world.close();
}

console.log(passed + ' of ' + passed + ' passed');
process.exit(0);
