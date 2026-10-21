// The Content tab in a real browser (Playwright), at a desktop and a phone width, over the real routes and a
// fake Sanity (tests/helpers/settings-all-harness.mjs): five blocks that fold under the heading Content, the ticker lines with
// add, edit, hide, order, publish and delete, the FRC news with its hide button, the calendar with its Hide button and Publish, and
// the roster grouped by team and role. It checks nothing is wider than the screen and every target is 44px. Skipped when Playwright
// is not installed. Set SHOTS_DIR to keep a PNG of each state.
//
//   node tests/control-content-page.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright } from '../tools/screenshots.mjs';
import * as settingsRoutes from '../control/routes/settings-doc.js';
import * as collectionRoutes from '../control/routes/collection-doc.js';
import * as contentRoutes from '../control/routes/content.js';
import * as uploadRoutes from '../control/routes/photo-upload.js';
import { seedDocuments, startHarness } from './helpers/settings-all-harness.mjs';

const playwright = await loadPlaywright();
if (!playwright) {
  console.log('SKIP  Playwright is not installed, so the page was not drawn.');
  console.log('0 of 0 passed');
  process.exit(0);
}

const shots = process.env.SHOTS_DIR || '';
if (shots) fs.mkdirSync(shots, { recursive: true });

const hour = 3600000;
const iso = time => new Date(time).toISOString();
const ref = id => ({ _type: 'reference', _ref: id });
const event = (title, start, extra = {}) => Object.assign({ _key: title, title: title, date: 'DATE', day: iso(start).slice(0, 10), time: '6:00 PM', shown: true, rule: '', start: iso(start), end: iso(start + 2 * hour) }, extra);

function documents() {
  const soon = Date.now() + 26 * hour;
  const later = Date.now() + 50 * hour;
  const seeded = seedDocuments().map(doc => (doc._id === 'dashboardSettings' ? Object.assign({}, doc, { newsInTicker: true, photoSource: 'both', photoDriveFolder: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp' }) : doc));
  return seeded.concat([
    { _id: 'tip-1', _type: 'tipOrNews', kind: 'tip', text: 'Wear safety glasses in the shop.', order: 10, show: true },
    { _id: 'tip-2', _type: 'tipOrNews', kind: 'news', text: 'Kickoff is January 9.', order: 20, show: true, team: ref('team-nova') },
    { _id: 'tip-3', _type: 'tipOrNews', kind: 'reminder', text: 'Sign the permission slip.', order: 30, show: false },
    { _id: 'person-1', _type: 'rosterPerson', firstName: 'Sam', role: 'student', jobTitle: 'Captain', department: 'build', team: ref('team-prime'), show: true, order: 1 },
    { _id: 'person-2', _type: 'rosterPerson', firstName: 'Ana', role: 'mentor', jobTitle: 'Lead mentor', team: ref('team-prime'), show: true },
    { _id: 'person-3', _type: 'rosterPerson', firstName: 'Bo', role: 'student', team: ref('team-nova'), show: true },
    { _id: 'person-4', _type: 'rosterPerson', firstName: 'Cy', role: 'parent', show: true },
    { _id: 'announcement-live', _type: 'announcement', text: 'Pizza in the lab at 6', start: iso(Date.now() - hour), end: iso(Date.now() + 3 * hour), level: 'notice' },
    { _id: 'announcement-soon', _type: 'announcement', text: 'Shop closes early on Friday', start: iso(Date.now() + 5 * hour), end: iso(Date.now() + 9 * hour), level: 'important', team: ref('team-nova') },
    { _id: 'announcement-old', _type: 'announcement', text: 'Bring your permission slip', start: iso(Date.now() - 30 * hour), end: iso(Date.now() - 20 * hour), level: 'notice' },
    { _id: 'photo-1', _type: 'photo', _createdAt: '2026-09-01T10:00:00Z', image: { _type: 'image', asset: { _type: 'reference', _ref: 'image-aaa111-4000x3000-jpg' } }, caption: 'Pit crew at work', credit: 'Sam', show: true, fit: 'setting' },
    { _id: 'photo-2', _type: 'photo', _createdAt: '2026-10-01T10:00:00Z', image: { _type: 'image', asset: { _type: 'reference', _ref: 'image-bbb222-2000x1500-png' } }, caption: 'Field test', show: false, fit: 'whole', expires: '2027-01-01T00:00:00.000Z' },
    { _id: 'status-mini', _type: 'status', photosDriveAt: iso(Date.now() - hour), photosDriveCount: 12, photosDriveState: 'ok' },
    { _id: 'leader-1', _type: 'person', name: 'Jo', title: 'Coach', role: 'Coach', show: true },
    { _id: 'lead-1', _type: 'subteam', name: 'Build', lead: 'Dee', members: ['Ed', 'Flo'], show: true, team: ref('team-prime') },
    {
      _id: 'calendar-status', _type: 'calendarStatus', updatedAt: iso(Date.now() - 5 * 60000),
      calendars: [{ _key: 'k1', code: 'team', fetchedAt: iso(Date.now() - 5 * 60000), occurrences: [
        event('Build meeting', soon), event('Strategy talk', later),
        event('Parents night', later, { title: '', shown: false, rule: 'No parents night' }),
      ] }],
    },
    { _id: 'calendarFilter-rule-1', _type: 'calendarFilter', name: 'No parents night', action: 'hide', words: ['parents'], show: true },
    { _id: 'frc-news', _type: 'frcNews', lastSyncAt: iso(Date.now() - hour), items: [
      { _key: 'n1', title: 'The 2027 game manual is out', link: 'https://example.org/a', date: iso(Date.now() - 2 * 24 * hour), categories: ['FRC'] },
      { _key: 'n2', title: 'New control system parts announced', link: 'https://example.org/b', date: iso(Date.now() - 3 * 24 * hour), categories: ['Control System'], systemcore: true },
    ] },
  ]);
}

const body = '<body><main id="page" style="padding:16px"><div id="box"></div></main>' +
  '<script type="module">import { drawContent } from "/control/tabs/content-blocks.js"; drawContent(document.getElementById("box"), { section: new URLSearchParams(location.search).get("section") || "" }); window.ready = true;</script></body>';

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const browser = await playwright.chromium.launch();

async function open(harness, width, height, block, section) {
  const page = await browser.newPage({ viewport: { width: width, height: height } });
  const trouble = [];
  page.on('pageerror', error => trouble.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') trouble.push(message.text()); });
  await page.goto(harness.url + '/harness.html' + (section ? '?section=' + section : ''));
  await page.waitForSelector('.ct-block');
  if (block) {
    await page.click('.ct-block[data-block="' + block + '"] > summary');
    await page.waitForSelector('.ct-block[data-block="' + block + '"] .ct-bar, .ct-block[data-block="' + block + '"] .ct-error');
  }
  page.trouble = trouble;
  return page;
}

async function shot(page, name, width) {
  if (shots) await page.screenshot({ path: path.join(shots, name + '-' + width + '.png'), fullPage: true });
}

// Every button, link, box and menu inside the section is 44px high, and nothing is wider than the page
async function fits(page, what) {
  const small = await page.evaluate(() => Array.from(document.querySelectorAll('.ct button, .ct a, .ct select, .ct input:not([type="checkbox"]):not([type="radio"]), .ct textarea, .ct .sa-choice, .ct .sa-switch'))
    .filter(element => element.offsetParent !== null)
    .map(element => ({ name: (element.className || element.tagName) + ' ' + (element.textContent || '').trim().slice(0, 20), height: element.getBoundingClientRect().height }))
    .filter(item => item.height < 43.5));
  assert.deepEqual(small, [], what + ' has targets under 44px');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const wide = overflow === 0 ? [] : await page.evaluate(() => Array.from(document.querySelectorAll('body *')).filter(element => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map(element => element.tagName + '.' + element.className).slice(0, 6));
  assert.equal(overflow, 0, what + ' scrolls sideways: ' + wide.join(', '));
  const gutter = await page.evaluate(() => document.querySelector('.ct').getBoundingClientRect().left);
  assert.ok(gutter >= 15.5, what + ' has less than a 16px gutter');
}

for (const [width, height] of [[1600, 1000], [390, 844]]) {
  const label = ' at ' + width;
  const harness = await startHarness({ documents: documents(), routes: [settingsRoutes, collectionRoutes, contentRoutes, uploadRoutes], body: body });

  await check('Content is one heading with five blocks that fold, in the order ticker, calendar, roster, announcements, photos' + label, async () => {
    const page = await open(harness, width, height);
    assert.equal(await page.locator('.ct > .card h2').textContent(), 'Content');
    assert.deepEqual(await page.locator('.ct-block-title').allTextContents(), ['Ticker and news', 'Calendar', 'Roster', 'Announcements', 'Photos']);
    assert.equal(await page.locator('.ct-block[open]').count(), 0, 'every block starts folded');
    assert.equal(harness.ctx.state.settingsSpec, undefined, 'nothing is read before a block is opened');
    await shot(page, 'content-folded', width);
    await fits(page, 'the folded section');
    assert.deepEqual(page.trouble, []);
    await page.close();
  });

  await check('the ticker block lists the lines with their tag, state and how the ticker draws them, and the FRC news below' + label, async () => {
    const page = await open(harness, width, height, 'ticker');
    const lines = page.locator('[data-part="lines"] .ct-item');
    assert.equal(await lines.count(), 3);
    assert.equal(await lines.nth(0).locator('.ct-tag').textContent(), 'TIP');
    assert.equal(await lines.nth(1).locator('.ct-tag').textContent(), 'NEWS');
    assert.equal(await lines.nth(2).locator('.ct-tag').textContent(), 'REMINDER');
    assert.match(await lines.nth(1).locator('.ct-sub').textContent(), /For HAWKTIMUS NOVA/);
    assert.equal(await lines.nth(2).locator('[data-chip="hidden"]').count(), 1);
    assert.equal(await lines.nth(2).locator('[data-act="toggle"]').textContent(), 'Show');
    const news = page.locator('[data-part="news"] .ct-item');
    assert.equal(await news.count(), 2);
    assert.match(await page.locator('[data-part="news"]').textContent(), /FRC, Control System/);
    assert.match(await page.locator('[data-part="news"]').textContent(), /Last read/);
    await shot(page, 'ticker', width);
    await fits(page, 'the ticker block');
    assert.deepEqual(page.trouble, []);
    await page.close();
  });

  await check('a line is added with a counter against the Studio limit, a live preview and a warning, saved to a draft, then published' + label, async () => {
    const page = await open(harness, width, height, 'ticker');
    await page.click('[data-part="lines"] [data-act="add"]');
    const field = page.locator('.ct-editor .sa-field[data-path="text"]');
    await field.locator('input').fill('Clean up your bench before you leave.');
    assert.match(await field.locator('.sa-count').textContent(), /37 of 52/);
    assert.match(await page.locator('.ct-extra').textContent(), /TIP.*Clean up your bench/);
    await page.locator('.ct-editor .sa-field[data-path="kind"] label:has-text("Reminder")').click();
    assert.match(await page.locator('.ct-extra .ct-tag').textContent(), /REMINDER/);
    await field.locator('input').fill('x'.repeat(53));
    assert.match(await field.locator('.sa-error').textContent(), /Up to 52/);
    await shot(page, 'ticker-editor', width);
    await fits(page, 'the ticker editor');
    const before = harness.sanity.log.length;
    await page.click('.ct-editor [data-act="save"]');
    assert.equal(harness.sanity.log.length, before, 'nothing is sent over the limit');
    await field.locator('input').fill('Clean up your bench before you leave.');
    await page.click('.ct-editor [data-act="save"]');
    await page.waitForSelector('.ct-flash:has-text("Saved to the draft")');
    const made = Object.values(harness.sanity.stored).filter(doc => doc._id.startsWith('drafts.') && doc._type === 'tipOrNews');
    assert.equal(made.length, 1);
    assert.equal(made[0].kind, 'reminder');
    assert.equal(made[0].show, true);
    const created = page.locator('[data-part="lines"] .ct-item').filter({ hasText: 'Clean up your bench' });
    assert.equal(await created.locator('[data-chip="new"]').count(), 1);
    assert.equal(await page.locator('[data-part="lines"] [data-act="publish-all"]').textContent(), 'Publish 1 waiting');
    await created.locator('[data-act="publish"]').click();
    await created.locator('[data-act="publish-now"]').click();
    await page.waitForSelector('.ct-flash:has-text("Published")');
    assert.ok(Object.values(harness.sanity.stored).some(doc => doc._type === 'tipOrNews' && doc.text === 'Clean up your bench before you leave.' && !doc._id.startsWith('drafts.')));
    assert.deepEqual(page.trouble, []);
    await page.close();
  });

  await check('Hide and Show write the switch to the draft, Up and Down renumber the order, Delete asks first' + label, async () => {
    const page = await open(harness, width, height, 'ticker');
    const first = page.locator('[data-part="lines"] .ct-item').filter({ hasText: 'Wear safety glasses' });
    await first.locator('[data-act="toggle"]').click();
    await page.waitForSelector('.ct-flash:has-text("Press Publish")');
    assert.equal(harness.sanity.stored['drafts.tip-1'].show, false);
    assert.equal(harness.sanity.stored['tip-1'].show, true, 'the wall copy is untouched');
    assert.equal(await page.locator('[data-part="lines"] .ct-item').filter({ hasText: 'Wear safety glasses' }).locator('[data-chip="waiting"]').count(), 1);

    const kick = page.locator('[data-part="lines"] .ct-item').filter({ hasText: 'Kickoff is January 9' });
    await kick.locator('[data-act="up"]').click();
    await page.waitForSelector('.ct-flash:has-text("Saved the new order")');
    assert.equal(harness.sanity.stored['drafts.tip-2'].order, 10);
    assert.equal(harness.sanity.stored['drafts.tip-1'].order, 20);
    const titles = await page.locator('[data-part="lines"] .ct-item .ct-text').allTextContents();
    assert.match(titles[0], /Kickoff/);

    const last = page.locator('[data-part="lines"] .ct-item').filter({ hasText: 'Sign the permission slip' });
    await last.locator('[data-act="delete"]').click();
    assert.match(await last.locator('.ct-ask').textContent(), /cannot be undone/);
    assert.ok(harness.sanity.stored['tip-3']);
    await shot(page, 'ticker-delete', width);
    await last.locator('[data-act="delete-now"]').click();
    await page.waitForSelector('.ct-flash:has-text("Deleted")');
    assert.equal(harness.sanity.stored['tip-3'], undefined);
    await fits(page, 'the ticker list after changes');
    await page.close();
  });

  await check('a news headline is hidden through the draft of Dashboard Settings and published on a confirm' + label, async () => {
    const page = await open(harness, width, height, 'ticker');
    const item = page.locator('[data-part="news"] .ct-item').filter({ hasText: 'game manual' });
    assert.equal(await item.locator('.ct-tag').textContent(), 'NEWS', 'the ticker preview shows only when news is in the ticker');
    await item.locator('[data-act="news-toggle"]').click();
    await page.waitForSelector('[data-part="news"] .ct-flash:has-text("Saved to the draft")');
    assert.deepEqual(harness.sanity.stored['drafts.dashboardSettings'].newsHiddenLinks, ['https://example.org/a']);
    assert.equal(await page.locator('[data-part="news"] .ct-item').filter({ hasText: 'game manual' }).locator('[data-chip="hidden"]').count(), 1);
    await page.click('[data-act="news-publish"]');
    await page.click('[data-act="news-publish-now"]');
    await page.waitForSelector('[data-part="news"] .ct-flash:has-text("Published")');
    assert.deepEqual(harness.sanity.stored.dashboardSettings.newsHiddenLinks, ['https://example.org/a']);
    await page.close();
  });

  await check('the calendar lists the events by day, hides one with a draft rule, and publishes it' + label, async () => {
    const page = await open(harness, width, height, 'calendar');
    assert.match(await page.locator('.ct-calendar').textContent(), /edited in BAND/);
    assert.equal(await page.locator('.ct-calendar .ct-group').first().textContent().then(text => /Tomorrow \(1\)/.test(text)), true);
    const parents = page.locator('.ct-event[data-state="hidden-rule"]');
    assert.match(await parents.textContent(), /Hidden by the rule No parents night/);
    assert.equal(await parents.locator('[data-act="switch"]').isDisabled(), true);
    await shot(page, 'calendar', width);
    await fits(page, 'the calendar block');

    const build = page.locator('.ct-event').filter({ hasText: 'Build meeting' });
    await build.locator('[data-act="switch"]').click();
    await page.waitForSelector('.ct-flash:has-text("Hidden in a draft rule")');
    const rule = Object.values(harness.sanity.stored).filter(doc => doc._id.startsWith('drafts.calendarFilter-one-'))[0];
    assert.equal(rule.eventTitle, 'Build meeting');
    assert.equal(await page.locator('.ct-event').filter({ hasText: 'Build meeting' }).locator('[data-chip="hidden"]').count(), 1);
    assert.equal(await page.locator('[data-act="cal-publish"]').textContent(), 'Publish 1 change');
    await page.click('[data-act="cal-publish"]');
    await page.click('[data-act="cal-publish-now"]');
    await page.waitForSelector('.ct-flash:has-text("Published")');
    assert.ok(Object.keys(harness.sanity.stored).some(id => id.startsWith('calendarFilter-one-')));
    await page.fill('#ct-cal-search', 'strategy');
    assert.equal(await page.locator('.ct-event').count(), 1);
    assert.deepEqual(page.trouble, []);
    await page.close();
  });

  await check('the roster is grouped by team and role with counts, a person is added with a warning for a full name, and the Studio people are read only' + label, async () => {
    const page = await open(harness, width, height, 'roster');
    const groups = await page.locator('[data-part="people"] .ct-group').allTextContents();
    assert.deepEqual(groups, ['HAWKTIMUS PRIME (2)', 'HAWKTIMUS NOVA (1)', 'Both teams (1)']);
    assert.deepEqual(await page.locator('[data-part="people"] .ct-role').allTextContents(), ['Mentors and Coaches (1)', 'Students (1)', 'Students (1)', 'Parents (1)']);
    assert.match(await page.locator('[data-part="people"] .ct-item').first().textContent(), /Ana.*Mentor · Lead mentor/);
    assert.match(await page.locator('[data-part="studio-people"]').textContent(), /Leadership \(1\).*Jo.*Coach/s);
    assert.match(await page.locator('[data-part="studio-people"]').textContent(), /Team leads \(1\).*Dee.*Build/s);
    assert.equal(await page.locator('[data-part="studio-people"] a').getAttribute('href'), '/studio/');
    assert.equal(await page.locator('[data-part="studio-people"] [data-act]').count(), 0, 'the Studio people have no buttons');
    await shot(page, 'roster', width);
    await fits(page, 'the roster block');

    await page.click('[data-part="people"] [data-act="add"]');
    const name = page.locator('.ct-editor .sa-field[data-path="firstName"]');
    await name.locator('input').fill('Dana Lee');
    assert.match(await name.locator('.sa-warn').textContent(), /use a first name only/);
    assert.equal(await page.locator('.ct-editor .sa-field[data-path="portrait"]').count(), 0, 'no upload on this page');
    await name.locator('input').fill('Dana');
    await page.locator('.ct-editor .sa-field[data-path="role"] label:has-text("Student")').click();
    await page.locator('.ct-editor .sa-field[data-path="team"] label:has-text("NOVA")').click();
    await shot(page, 'roster-editor', width);
    await fits(page, 'the roster editor');
    await page.click('.ct-editor [data-act="save"]');
    await page.waitForSelector('[data-part="people"] .ct-flash:has-text("Saved to the draft")');
    const groupsAfter = await page.locator('[data-part="people"] .ct-group').allTextContents();
    assert.deepEqual(groupsAfter, ['HAWKTIMUS PRIME (2)', 'HAWKTIMUS NOVA (2)', 'Both teams (1)']);
    assert.equal(await page.locator('[data-part="people"] .ct-item').filter({ hasText: 'Dana' }).locator('[data-chip="new"]').count(), 1);
    assert.deepEqual(page.trouble, []);
    await page.close();
  });

  await check('the address names a block and it opens by itself; on a phone opening one closes the others' + label, async () => {
    const page = await open(harness, width, height, '', 'photos');
    assert.equal(await page.locator('.ct-block[open]').count(), 1);
    assert.equal(await page.locator('.ct-block[open]').getAttribute('data-block'), 'photos');
    await page.waitForSelector('.ct-block[data-block="photos"] .ct-grid');
    await page.click('.ct-block[data-block="roster"] > summary');
    await page.waitForSelector('.ct-block[data-block="roster"] .ct-bar');
    const opened = await page.locator('.ct-block[open]').count();
    assert.equal(opened, width < 600 ? 1 : 2, width < 600 ? 'one block at a time on a phone' : 'blocks stay open on a wide page');
    await page.close();
  });

  await check('announcements: live, waiting and over chips, the 12 second sentence, no Hide button, and Post now publishes at once' + label, async () => {
    const page = await open(harness, width, height, 'announcements');
    const items = page.locator('[data-part="announcements"] .ct-item');
    assert.equal(await items.count(), 3);
    assert.match(await items.nth(0).textContent(), /Shop closes early/);
    assert.equal(await items.nth(0).locator('[data-chip="waiting"]').textContent(), 'Waiting');
    assert.equal(await items.nth(1).locator('[data-chip="live"]').textContent(), 'Live now');
    assert.equal(await items.nth(2).locator('[data-chip="over"]').textContent(), 'Over');
    assert.match(await items.nth(0).locator('.ct-sub').textContent(), /For HAWKTIMUS NOVA.*Important/);
    assert.equal(await page.locator('[data-part="announcements"] [data-act="toggle"]').count(), 0, 'this type has no Show switch');
    assert.match(await page.locator('.ct-block[data-block="announcements"]').textContent(), /one for 12 seconds and then the other/);
    assert.match(await page.locator('[data-part="live-note"]').textContent(), /One announcement is live now/);
    await shot(page, 'announcements', width);
    await fits(page, 'the announcements block');

    const text = page.locator('#ct-post-text');
    assert.equal(await page.locator('[data-act="post-now"]').isDisabled(), true, 'nothing to post yet');
    await text.fill('x'.repeat(91));
    assert.match(await page.locator('.ct-post .ct-sub[aria-live]').textContent(), /91 of 90.*Too long/);
    assert.equal(await page.locator('[data-act="post-now"]').isDisabled(), true);
    await text.fill('Meeting moved to 5:30');
    await page.selectOption('#ct-post-minutes', '30');
    assert.equal(await page.locator('[data-act="post-now"]').textContent(), 'Post now for 30 minutes');
    await page.click('[data-act="post-now"]');
    await page.waitForSelector('[data-part="announcements"] .ct-flash:has-text("Posted")');
    const posted = Object.values(harness.sanity.stored).filter(doc => doc._type === 'announcement' && doc.text === 'Meeting moved to 5:30');
    assert.equal(posted.length, 1);
    assert.equal(Date.parse(posted[0].end) - Date.parse(posted[0].start), 30 * 60000);
    assert.match(await page.locator('[data-part="live-note"]').textContent(), /Two announcements are live now.*every 12 seconds/);
    assert.equal(await page.locator('[data-part="announcements"] .ct-item').count(), 4);
    await fits(page, 'the announcements block after Post now');
    assert.deepEqual(page.trouble, []);
    await page.close();
  });

  await check('an announcement is added with the datetime fields and a counter, and an old one is deleted after a question' + label, async () => {
    const page = await open(harness, width, height, 'announcements');
    await page.click('[data-part="announcements"] [data-act="add"]');
    const field = page.locator('.ct-editor .sa-field[data-path="text"]');
    await field.locator('input').fill('Parents night is on Thursday');
    assert.match(await field.locator('.sa-count').textContent(), /28 of 90/);
    await page.locator('.ct-editor .sa-field[data-path="start"] input').fill('2027-03-01T17:00');
    await page.locator('.ct-editor .sa-field[data-path="end"] input').fill('2027-03-01T19:00');
    await shot(page, 'announcements-editor', width);
    await fits(page, 'the announcement editor');
    await page.click('.ct-editor [data-act="save"]');
    await page.waitForSelector('[data-part="announcements"] .ct-flash:has-text("Saved to the draft")');
    const created = page.locator('[data-part="announcements"] .ct-item').filter({ hasText: 'Parents night' });
    assert.equal(await created.locator('[data-chip="new"]').count(), 1);
    assert.equal(await created.locator('[data-chip="waiting"]').count(), 1);
    const old = page.locator('[data-part="announcements"] .ct-item').filter({ hasText: 'permission slip' });
    await old.locator('[data-act="delete"]').click();
    assert.match(await old.locator('.ct-ask').textContent(), /cannot be undone/);
    assert.ok(harness.sanity.stored['announcement-old']);
    await old.locator('[data-act="delete-now"]').click();
    await page.waitForSelector('[data-part="announcements"] .ct-flash:has-text("Deleted")');
    assert.equal(harness.sanity.stored['announcement-old'], undefined);
    assert.deepEqual(page.trouble, []);
    await page.close();
  });

  await check('photos: a grid of small pictures newest first, the source read only with a link to Settings, edit, hide and delete' + label, async () => {
    const page = await open(harness, width, height, 'photos');
    const cards = page.locator('[data-part="photos"] .ct-item');
    assert.equal(await cards.count(), 2);
    assert.match(await cards.nth(0).textContent(), /Field test/, 'newest first');
    assert.match(await cards.nth(1).textContent(), /Pit crew at work.*Photo: Sam/);
    const sources = await page.locator('[data-part="photos"] .ct-thumb').evaluateAll(images => images.map(image => image.getAttribute('src')));
    sources.forEach(src => assert.match(src, /w=480&fit=max/, 'the small size, never the original'));
    assert.match(await cards.nth(0).locator('.ct-sub').textContent(), /Show the whole photo.*Hides after/);
    assert.equal(await cards.nth(0).locator('[data-chip="hidden"]').count(), 1);
    assert.match(await page.locator('[data-part="source"]').textContent(), /Both uploaded photos and the Google Drive folder.*ends in KlMnOp.*12 photos/);
    assert.equal(await page.locator('[data-part="source"] a').getAttribute('href'), '#settings/all');
    assert.equal(await page.locator('[data-part="source"] input, [data-part="source"] select').count(), 0, 'the source is read only');
    assert.equal(await page.locator('[data-part="photos"] [data-act="add"]').count(), 0, 'adding is the upload form');
    await shot(page, 'photos', width);
    await fits(page, 'the photos block');

    await cards.nth(1).locator('[data-act="edit"]').click();
    const credit = page.locator('.ct-editor .sa-field[data-path="credit"]');
    await credit.locator('input').fill('Sam Smith');
    assert.match(await credit.locator('.sa-warn').textContent(), /space, an @ or a number.*first name only/i);
    await credit.locator('input').fill('Sam');
    assert.equal(await page.locator('.ct-editor .sa-field[data-path="image"]').count(), 0, 'the picture is not a field');
    await page.locator('.ct-editor .sa-field[data-path="caption"] input').fill('Pit crew at the regional');
    await page.click('.ct-editor [data-act="save"]');
    await page.waitForSelector('[data-part="photos"] .ct-flash:has-text("Saved to the draft")');
    assert.equal(harness.sanity.stored['drafts.photo-1'].caption, 'Pit crew at the regional');
    await page.locator('[data-part="photos"] .ct-item').filter({ hasText: 'Pit crew at the regional' }).locator('[data-act="toggle"]').click();
    await page.waitForSelector('[data-part="photos"] .ct-flash:has-text("Press Publish")');
    assert.equal(harness.sanity.stored['drafts.photo-1'].show, false);
    const gone = page.locator('[data-part="photos"] .ct-item').filter({ hasText: 'Field test' });
    await gone.locator('[data-act="delete"]').click();
    await gone.locator('[data-act="delete-now"]').click();
    await page.waitForSelector('[data-part="photos"] .ct-flash:has-text("Deleted")');
    assert.equal(harness.sanity.stored['photo-2'], undefined);
    assert.deepEqual(page.trouble, []);
    await page.close();
  });

  await check('Add photo refuses a wrong file and a wrong credit in the page, uploads a picture through the service and lists the new draft' + label, async () => {
    const page = await open(harness, width, height, 'photos');
    await page.setInputFiles('#ct-up-file', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await page.click('[data-act="upload"]');
    assert.match(await page.locator('.ct-post .ct-flash').textContent(), /Only JPEG, PNG or WebP/);
    assert.equal(harness.sanity.uploads.length, 0);
    await page.setInputFiles('#ct-up-file', { name: 'Jane Smith pit.jpg', mimeType: 'image/jpeg', buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000)]) });
    await page.fill('#ct-up-credit', 'Jane Smith');
    assert.match(await page.locator('[data-warn="credit"]').textContent(), /first name only/);
    await page.click('[data-act="upload"]');
    assert.equal(harness.sanity.uploads.length, 0, 'a last name is not sent');
    await page.fill('#ct-up-credit', 'Jane');
    await page.fill('#ct-up-caption', 'At the pit');
    await shot(page, 'photos-upload', width);
    await fits(page, 'the upload form');
    await page.click('[data-act="upload"]');
    await page.waitForSelector('[data-part="photos"] .ct-flash:has-text("Added as a draft")');
    assert.equal(harness.sanity.uploads.length, 1);
    assert.equal(harness.sanity.uploads[0].filename, 'photo.jpg', 'the name of the file is not kept');
    const made = Object.values(harness.sanity.stored).filter(doc => doc._id.startsWith('drafts.') && doc._type === 'photo' && doc.caption === 'At the pit');
    assert.equal(made.length, 1);
    assert.equal(made[0].credit, 'Jane');
    assert.equal(await page.locator('[data-part="photos"] .ct-item').filter({ hasText: 'At the pit' }).locator('[data-chip="new"]').count(), 1);
    assert.deepEqual(page.trouble, []);
    await page.close();
  });

  await harness.close();
}

await browser.close();
console.log('\n' + passed + ' of ' + passed + ' passed');
