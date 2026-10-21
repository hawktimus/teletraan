// The All settings form in a real browser (Playwright), at a desktop and a phone width, over the real routes and a fake Sanity
// (tests/helpers/settings-all-harness.mjs). It checks the form is drawn from the spec, that nothing is wider than the screen, that
// every target is 44px, that search finds a setting by its words, and the whole path: edit, unsaved mark, undo, save to the draft,
// a Studio change in between (the conflict question), and publish with a confirm. Skipped when Playwright is not installed.
// Set SHOTS_DIR to keep a PNG of each state.
//
//   node tests/control-settings-all-page.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright } from '../tools/screenshots.mjs';
import { startHarness } from './helpers/settings-all-harness.mjs';

const playwright = await loadPlaywright();
if (!playwright) {
  console.log('SKIP  Playwright is not installed, so the page was not drawn.');
  console.log('0 of 0 passed');
  process.exit(0);
}

const shots = process.env.SHOTS_DIR || '';
if (shots) fs.mkdirSync(shots, { recursive: true });

let passed = 0;
let harness = null;
const browser = await playwright.chromium.launch();

async function open(width, height, doc) {
  const page = await browser.newPage({ viewport: { width: width, height: height } });
  const trouble = [];
  page.on('pageerror', error => trouble.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') trouble.push(message.text()); });
  await page.goto(harness.url + '/harness.html' + (doc ? '?doc=' + doc : ''));
  await page.waitForSelector('.sa-panel');
  page.trouble = trouble;
  return page;
}

async function shot(page, name, width) {
  if (shots) await page.screenshot({ path: path.join(shots, name + '-' + width + '.png'), fullPage: width > 1000 });
}

async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

for (const [width, height] of [[1600, 1000], [390, 844]]) {
  const label = ' at ' + width;
  harness = await startHarness();

  await check('the form is drawn from the spec, with the tabs, descriptions and no sideways scroll' + label, async () => {
    const page = await open(width, height);
    const tabs = await page.locator('.sa-tab').allTextContents();
    assert.deepEqual(tabs.map(text => text.trim()), ['Timing', 'Look', 'Photos', 'Countdown', 'Calendars', 'Monday', 'Competition', 'Today', 'Advanced']);
    assert.match(await page.locator('.sa-field .sa-help').first().textContent(), /how long/i);
    await page.click('[data-tab="look"]');
    assert.ok(await page.locator('.sa-field[data-path="glint"]').count() === 1);
    assert.equal(await page.locator('.sa-field[data-path="glint"] input[role="switch"]').isChecked(), true);
    await page.click('[data-tab="countdown"]');
    assert.equal(await page.locator('.sa-field[data-path="countdown.kickoff"] input[type="datetime-local"]').count(), 1);
    await shot(page, 'countdown', width);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0);
    assert.deepEqual(page.trouble, []);
    await page.close();
  });

  await check('every button, box and menu is 44px high, and text wraps inside the card' + label, async () => {
    const page = await open(width, height);
    for (const tab of ['screen', 'look', 'calendars', 'today', 'advanced']) {
      await page.click('[data-tab="' + tab + '"]');
      const small = await page.evaluate(() => Array.from(document.querySelectorAll('.sa button, .sa select, .sa input:not([type="checkbox"]):not([type="radio"]), .sa textarea, .sa .choice-face, .sa .switch'))
        .filter(element => element.offsetParent !== null)
        .map(element => ({ name: (element.className || element.tagName) + ' ' + (element.textContent || '').trim().slice(0, 20), height: element.getBoundingClientRect().height }))
        .filter(item => item.height < 43.5));
      assert.deepEqual(small, [], tab + ' has targets under 44px');
      const wide = await page.evaluate(() => {
        const edge = document.querySelector('.sa').getBoundingClientRect().right + 1;
        return Array.from(document.querySelectorAll('.sa *')).filter(element => element.getBoundingClientRect().right > edge).map(element => element.className).slice(0, 5);
      });
      assert.deepEqual(wide, [], tab + ' has something wider than the card');
    }
    await page.close();
  });

  await check('search finds a setting by its words across the tabs, and points at other pages' + label, async () => {
    const page = await open(width, height);
    await page.fill('#sa-search', 'glint');
    assert.equal(await page.locator('.sa-found .sa-field[data-path="glint"]').count(), 1);
    assert.match(await page.locator('.sa-says').first().textContent(), /match "glint"/);
    await shot(page, 'search', width);
    await page.fill('#sa-search', 'night mode');
    assert.ok(await page.locator('.sa-found .sa-field[data-path="nightEnabled"]').count() === 1);
    await page.fill('#sa-search', 'mirror');
    assert.match(await page.locator('.sa-others').textContent(), /Teams: Mirror the layout/);
    await page.locator('.sa-others button:has-text("Teams:")').click();
    await page.waitForSelector('.sa-field[data-path="mirror"]');
    assert.equal(await page.locator('#sa-doc').inputValue().then(value => value.startsWith('team-')), true);
    await page.fill('#sa-search', 'zzzz nothing');
    assert.match(await page.locator('.sa-says').first().textContent(), /No setting/);
    await page.close();
  });

  await check('an edit is marked unsaved, can be undone, and a bad value shows its limit and blocks the save' + label, async () => {
    const page = await open(width, height);
    const field = page.locator('.sa-field[data-path="pageSeconds"]');
    await field.locator('input').fill('31');
    assert.equal(await field.locator('.sa-mark').isVisible(), true);
    assert.match(await page.locator('[data-unsaved]').textContent(), /1 unsaved change/);
    assert.equal(await page.locator('.sa-tab[data-tab="screen"] .sa-badge').textContent(), '1');
    assert.equal(await page.locator('[data-act="save"]').isEnabled(), true);
    await shot(page, 'unsaved', width);

    await page.click('[data-act="undo"]');
    assert.equal(await page.locator('.sa-field[data-path="pageSeconds"] input').inputValue(), '20');
    assert.match(await page.locator('[data-unsaved]').textContent(), /No unsaved/);

    await page.locator('.sa-field[data-path="pageSeconds"] input').fill('5');
    assert.match(await page.locator('.sa-field[data-path="pageSeconds"] .sa-error').textContent(), /8 to 120/);
    const before = harness.sanity.log.length;
    await page.click('[data-act="save"]');
    assert.equal(harness.sanity.log.length, before, 'nothing is sent when a value breaks a limit');
    await shot(page, 'limit', width);
    await page.locator('.sa-field[data-path="pageSeconds"] .sa-undo').click();
    assert.equal(await page.locator('.sa-field[data-path="pageSeconds"] input').inputValue(), '20');
    await page.close();
  });

  await check('text shows a counter against the Studio limit, a color has a swatch and a hex box, a Team select writes a reference' + label, async () => {
    const page = await open(width, height, 'team-prime');
    const name = page.locator('.sa-field[data-path="name"]');
    assert.match(await name.locator('.sa-count').textContent(), /15 of 20/);
    await name.locator('input').fill('X'.repeat(21));
    assert.equal(await name.locator('.sa-count').getAttribute('data-state'), 'over');
    assert.match(await name.locator('.sa-error').textContent(), /Too long/);
    await name.locator('input').fill('HAWKTIMUS PRIME');

    const color = page.locator('.sa-field[data-path="colors.primary"]');
    await color.locator('.sa-hex').fill('#112233');
    assert.equal(await color.locator('.sa-swatch').inputValue(), '#112233');
    await color.locator('.sa-hex').fill('purple');
    assert.match(await color.locator('.sa-error').textContent(), /# and six characters/);
    await shot(page, 'team', width);
    await color.locator('.sa-undo').click();
    await page.close();

    const panelPage = await open(width, height, 'panel-info');
    await panelPage.locator('.sa-field[data-path="team"] label:has-text("HAWKTIMUS NOVA") input').check();
    assert.match(await panelPage.locator('[data-unsaved]').textContent(), /1 unsaved/);
    await panelPage.click('[data-act="save"]');
    await panelPage.waitForSelector('.sa-flash[data-state="done"]');
    assert.deepEqual(harness.sanity.stored['drafts.panel-info'].team, { _type: 'reference', _ref: 'team-nova' });
    await panelPage.close();
  });

  await check('a list can add, move and remove items, and a rule that follows another field shows only when it applies' + label, async () => {
    const page = await open(width, height, 'theme');
    assert.equal(await page.locator('.sa-item').count(), 1);
    const item = page.locator('.sa-item').first();
    assert.equal(await item.locator('.sa-field[data-path="schedule[0].overlay"]').isVisible(), true);
    assert.equal(await item.locator('.sa-field[data-path="schedule[0].theme"]').isHidden(), true);
    await item.locator('.sa-field[data-path="schedule[0].kind"] label:has-text("Theme") input').first().check();
    assert.equal(await item.locator('.sa-field[data-path="schedule[0].theme"]').isVisible(), true);
    assert.equal(await item.locator('.sa-field[data-path="schedule[0].tickerPrefix"]').isHidden(), true);
    await page.locator('.sa-items + .sa-addrow button, .sa-addrow button:has-text("Add an item")').first().click();
    assert.equal(await page.locator('.sa-item').count(), 2);
    await page.locator('.sa-item').nth(1).locator('button:has-text("Up")').click();
    assert.equal(await page.locator('.sa-item').count(), 2);
    await page.locator('.sa-item').first().locator('button:has-text("Remove")').click();
    assert.equal(await page.locator('.sa-item').count(), 1);
    await page.close();
  });

  await check('save goes to the draft, publish asks first and publishes only that document' + label, async () => {
    const page = await open(width, height);
    await page.locator('.sa-field[data-path="pageSeconds"] input').fill('33');
    await page.click('[data-act="save"]');
    await page.waitForSelector('.sa-flash[data-state="done"]');
    assert.match(await page.locator('.sa-flash').textContent(), /Saved to the draft/);
    assert.equal(harness.sanity.stored['drafts.dashboardSettings'].pageSeconds, 33);
    assert.equal(harness.sanity.stored.dashboardSettings.pageSeconds, 20, 'the published copy did not change yet');
    assert.match(await page.locator('.sa-bar .note:not(.unsaved)').textContent(), /waiting draft/);

    await page.click('[data-act="publish"]');
    assert.equal(await page.locator('.sa-confirm').count(), 1);
    assert.equal(harness.sanity.stored.dashboardSettings.pageSeconds, 20, 'nothing is published before the confirm');
    await shot(page, 'publish', width);
    await page.click('[data-act="publish-now"]');
    await page.waitForFunction(() => /Published/.test(document.querySelector('.sa-flash').textContent));
    assert.equal(harness.sanity.stored.dashboardSettings.pageSeconds, 33);
    assert.equal(harness.sanity.stored['drafts.dashboardSettings'], undefined);
    assert.equal(harness.sanity.stored['team-prime'].name, 'HAWKTIMUS PRIME', 'no other document was touched');
    await page.locator('.sa-field[data-path="pageSeconds"] input').fill('20');
    await page.click('[data-act="save"]');
    await page.waitForSelector('.sa-flash[data-state="done"]');
    await page.click('[data-act="publish"]');
    await page.click('[data-act="publish-now"]');
    await page.waitForFunction(() => /Published/.test(document.querySelector('.sa-flash').textContent));
    await page.close();
  });

  await check('a Studio change in between is a question: replace, refresh or keep editing' + label, async () => {
    const page = await open(width, height);
    await page.locator('.sa-field[data-path="doneDays"] input').fill('9');
    harness.sanity.touch('dashboardSettings', { doneDays: 12, pageSeconds: 44 });
    await page.click('[data-act="save"]');
    await page.waitForSelector('.studio-changed');
    assert.match(await page.locator('.studio-changed').textContent(), /The Studio has a newer copy/);
    assert.equal(harness.sanity.stored['drafts.dashboardSettings'].doneDays, 12, 'nothing was written');
    await shot(page, 'conflict', width);

    await page.click('[data-act="keep"]');
    assert.equal(await page.locator('.studio-changed').count(), 0);
    assert.equal(await page.locator('.sa-field[data-path="doneDays"] input').inputValue(), '9', 'my edit is still there');
    await page.click('[data-act="save"]');
    await page.waitForSelector('.studio-changed');
    await page.click('[data-act="replace"]');
    await page.waitForSelector('.sa-flash[data-state="done"]');
    assert.equal(harness.sanity.stored['drafts.dashboardSettings'].doneDays, 9);
    assert.equal(harness.sanity.stored['drafts.dashboardSettings'].pageSeconds, 44, 'the Studio change to another setting is kept');

    await page.locator('.sa-field[data-path="doneDays"] input').fill('10');
    harness.sanity.touch('dashboardSettings', { doneDays: 15 });
    await page.click('[data-act="save"]');
    await page.waitForSelector('.studio-changed');
    await page.click('.studio-changed [data-act="refresh"]');
    await page.waitForFunction(() => /Refreshed/.test(document.querySelector('.sa-flash').textContent));
    assert.equal(await page.locator('.sa-field[data-path="doneDays"] input').inputValue(), '15');
    harness.sanity.stored.dashboardSettings.pageSeconds = 20;
    delete harness.sanity.stored['drafts.dashboardSettings'];
    await page.close();
  });
  await harness.close();
}

await browser.close();
console.log(passed + ' of ' + passed + ' passed');
