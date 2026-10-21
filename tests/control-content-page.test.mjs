// The Content section of the Display tab in a real browser (Playwright), at a desktop and a phone width, over the real routes and a
// fake Sanity (tests/helpers/settings-all-harness.mjs): three blocks that fold under the heading Content, the ticker lines with
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
  const seeded = seedDocuments().map(doc => (doc._id === 'dashboardSettings' ? Object.assign({}, doc, { newsInTicker: true }) : doc));
  return seeded.concat([
    { _id: 'tip-1', _type: 'tipOrNews', kind: 'tip', text: 'Wear safety glasses in the shop.', order: 10, show: true },
    { _id: 'tip-2', _type: 'tipOrNews', kind: 'news', text: 'Kickoff is January 9.', order: 20, show: true, team: ref('team-nova') },
    { _id: 'tip-3', _type: 'tipOrNews', kind: 'reminder', text: 'Sign the permission slip.', order: 30, show: false },
    { _id: 'person-1', _type: 'rosterPerson', firstName: 'Sam', role: 'student', jobTitle: 'Captain', department: 'build', team: ref('team-prime'), show: true, order: 1 },
    { _id: 'person-2', _type: 'rosterPerson', firstName: 'Ana', role: 'mentor', jobTitle: 'Lead mentor', team: ref('team-prime'), show: true },
    { _id: 'person-3', _type: 'rosterPerson', firstName: 'Bo', role: 'student', team: ref('team-nova'), show: true },
    { _id: 'person-4', _type: 'rosterPerson', firstName: 'Cy', role: 'parent', show: true },
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
  '<script type="module">import { drawContent } from "/control/tabs/content-blocks.js"; drawContent(document.getElementById("box")); window.ready = true;</script></body>';

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const browser = await playwright.chromium.launch();

// One line of the roster by the name in its title (the page text also holds the Hide and Edit buttons, so a plain text search is not safe)
const personRow = (page, name) => page.locator('[data-part="people"] .ct-item').filter({ has: page.locator('.ct-title', { hasText: new RegExp('^' + name + '(Roster|Leadership|Team lead)$') }) });

async function open(harness, width, height, block) {
  const page = await browser.newPage({ viewport: { width: width, height: height } });
  const trouble = [];
  page.on('pageerror', error => trouble.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') trouble.push(message.text()); });
  await page.goto(harness.url + '/harness.html');
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
  assert.equal(overflow, 0, what + ' scrolls sideways');
  const gutter = await page.evaluate(() => document.querySelector('.ct').getBoundingClientRect().left);
  assert.ok(gutter >= 15.5, what + ' has less than a 16px gutter');
}

for (const [width, height] of [[1600, 1000], [390, 844]]) {
  const label = ' at ' + width;
  const harness = await startHarness({ documents: documents(), routes: [settingsRoutes, collectionRoutes, contentRoutes], body: body });

  await check('Content is one heading with three blocks that fold, in the order ticker, calendar, roster' + label, async () => {
    const page = await open(harness, width, height);
    assert.equal(await page.locator('.ct > .card h2').textContent(), 'Content');
    assert.deepEqual(await page.locator('.ct-block-title').allTextContents(), ['Ticker and news', 'Calendar', 'Roster']);
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

  await check('the roster is one list of Roster, Leadership and Team lead entries grouped by team and role with counts and a source on each, and a person is added with a warning for a full name' + label, async () => {
    const page = await open(harness, width, height, 'roster');
    const groups = await page.locator('[data-part="people"] .ct-group').allTextContents();
    assert.deepEqual(groups, ['HAWKTIMUS PRIME (3)', 'HAWKTIMUS NOVA (1)', 'Both teams (2)']);
    assert.deepEqual(await page.locator('[data-part="people"] .ct-role').allTextContents(), ['Leadership (1)', 'Mentors and Coaches (1)', 'Students (1)', 'Students (1)', 'Mentors and Coaches (1)', 'Parents (1)']);
    const dee = personRow(page, 'Dee');
    assert.equal(await dee.locator('.ct-source').textContent(), 'Team lead');
    assert.match(await dee.locator('.ct-sub').textContent(), /Build lead · 2 members/);
    const jo = personRow(page, 'Jo');
    assert.equal(await jo.locator('.ct-source').textContent(), 'Leadership');
    assert.match(await jo.locator('.ct-sub').textContent(), /Coach · Listed with Coach/);
    assert.equal(await personRow(page, 'Ana').locator('.ct-source').textContent(), 'Roster');
    assert.match(await personRow(page, 'Ana').locator('.ct-sub').textContent(), /Mentor · Lead mentor/);
    assert.equal(await page.locator('[data-part="studio-people"]').count(), 0, 'nothing is shown read only any more');
    assert.equal(await page.locator('[data-part="people"] .ct-item [data-act="edit"]').count(), 6, 'every line can be edited');
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
    assert.deepEqual(groupsAfter, ['HAWKTIMUS PRIME (3)', 'HAWKTIMUS NOVA (2)', 'Both teams (2)']);
    assert.equal(await personRow(page, 'Dana').locator('[data-chip="new"]').count(), 1);
    assert.deepEqual(page.trouble, []);
    await page.close();
  });

  await check('the filter narrows the roster by role, the search finds a first name or a team member, and the counts follow' + label, async () => {
    const page = await open(harness, width, height, 'roster');
    assert.deepEqual(await page.locator('#ct-filter-kind option').allTextContents(), ['All', 'Students', 'Mentors and coaches', 'Parents', 'Leadership']);
    await page.selectOption('#ct-filter-kind', 'mentors');
    assert.deepEqual(await page.locator('[data-part="people"] .ct-item .ct-title').allTextContents(), ['AnaRoster', 'JoLeadership']);
    assert.deepEqual(await page.locator('[data-part="people"] .ct-group').allTextContents(), ['HAWKTIMUS PRIME (1)', 'Both teams (1)']);
    await shot(page, 'roster-filtered', width);
    await page.selectOption('#ct-filter-kind', 'leadership');
    assert.deepEqual(await page.locator('[data-part="people"] .ct-item .ct-title').allTextContents(), ['DeeTeam lead']);
    await page.selectOption('#ct-filter-kind', 'all');
    await page.fill('#ct-filter-q', 'flo');
    assert.deepEqual(await page.locator('[data-part="people"] .ct-item .ct-title').allTextContents(), ['DeeTeam lead']);
    await page.fill('#ct-filter-q', 'dan');
    assert.deepEqual(await page.locator('[data-part="people"] .ct-item .ct-title').allTextContents(), ['DanaRoster']);
    await page.fill('#ct-filter-q', 'zzz');
    assert.match(await page.locator('[data-part="people"] .ct-none').textContent(), /Nobody matches/);
    await fits(page, 'the filtered roster');
    assert.deepEqual(page.trouble, []);
    await page.close();
  });

  await check('an existing Leadership entry is edited in place: its own fields, no upload, a full name warns, then Save to draft, Hide and Publish' + label, async () => {
    const page = await open(harness, width, height, 'roster');
    const jo = () => personRow(page, 'Jo');
    await jo().locator('[data-act="edit"]').click();
    assert.equal(await page.locator('.ct-edit-title').textContent(), 'Edit Leadership entry');
    const paths = await page.locator('.ct-editor .sa-fields > .sa-field').evaluateAll(list => list.map(one => one.dataset.path));
    assert.deepEqual(paths, ['role', 'name', 'title', 'line', 'showPhoto', 'team', 'order', 'show', 'expires']);
    assert.equal(await page.locator('.ct-editor .sa-field[data-path="photo"]').count(), 0, 'the photo is added in the Studio');
    const name = page.locator('.ct-editor .sa-field[data-path="name"]');
    await name.locator('input').fill('Joan Smith');
    await page.waitForFunction(() => /full name/.test(document.querySelector('.ct-editor .sa-field[data-path="name"] .sa-warn').textContent));
    await name.locator('input').fill('x'.repeat(18));
    assert.match(await name.locator('.sa-error').textContent(), /Up to 17/);
    await shot(page, 'roster-leadership-editor', width);
    await fits(page, 'the Leadership editor');
    await name.locator('input').fill('Joan');
    await page.locator('.ct-editor .sa-field[data-path="title"] input').fill('Head coach');
    await page.locator('.ct-editor .sa-field[data-path="role"] label:has-text("Mentor")').click();
    await page.click('.ct-editor [data-act="save"]');
    await page.waitForSelector('[data-part="people"] .ct-flash:has-text("Saved to the draft")');
    const draft = harness.sanity.stored['drafts.leader-1'];
    assert.deepEqual([draft._type, draft.name, draft.title, draft.role], ['person', 'Joan', 'Head coach', 'Mentor']);
    assert.equal(harness.sanity.stored['leader-1'].name, 'Jo', 'the wall copy waits for Publish');
    const row = personRow(page, 'Joan');
    assert.equal(await row.locator('[data-chip="waiting"]').count(), 1);
    assert.match(await row.locator('.ct-sub').textContent(), /Head coach · Listed with Mentor/);

    await row.locator('[data-act="toggle"]').click();
    await page.waitForSelector('[data-part="people"] .ct-flash:has-text("Press Publish")');
    assert.equal(harness.sanity.stored['drafts.leader-1'].show, false);
    const hidden = personRow(page, 'Joan');
    assert.equal(await hidden.locator('[data-chip="hidden"]').count(), 1);
    await hidden.locator('[data-act="publish"]').click();
    await hidden.locator('[data-act="publish-now"]').click();
    await page.waitForSelector('[data-part="people"] .ct-flash:has-text("Published")');
    assert.equal(harness.sanity.stored['leader-1'].name, 'Joan');
    assert.equal(harness.sanity.stored['leader-1'].show, false);
    assert.equal(harness.sanity.stored['drafts.leader-1'], undefined);
    assert.deepEqual(page.trouble, []);
    await page.close();
  });

  await check('a Team lead keeps its members as lines with Add and Remove, a full name warns, a bad one is refused on the server, and a Studio change meanwhile is a question' + label, async () => {
    const page = await open(harness, width, height, 'roster');
    await personRow(page, 'Dee').locator('[data-act="edit"]').click();
    assert.equal(await page.locator('.ct-edit-title').textContent(), 'Edit Team lead');
    const members = page.locator('.ct-editor .sa-field[data-path="members"]');
    assert.deepEqual(await members.locator('.sa-taglist li span').allTextContents(), ['Ed', 'Flo']);
    assert.equal(await page.locator('.ct-editor .sa-field[data-path="photo"]').count(), 0);
    assert.equal(await page.locator('.ct-editor .sa-field[data-path="monday"]').count(), 0, 'a field the Studio hides is not drawn');
    await members.locator('.sa-addrow input').fill('Sam Smith');
    await members.locator('.sa-addrow button').click();
    await page.waitForFunction(() => /"Sam Smith" in members.*full name/.test(document.querySelector('.ct-editor .sa-field[data-path="members"] .sa-warn').textContent));
    await shot(page, 'roster-teamlead-editor', width);
    await fits(page, 'the Team lead editor');
    await members.locator('li:has-text("Sam Smith") button').click();
    await members.locator('li:has-text("Ed") button').click();
    await members.locator('.sa-addrow input').fill('Gus');
    await members.locator('.sa-addrow input').press('Enter');
    await members.locator('.sa-addrow input').fill('Ed2');
    await members.locator('.sa-addrow input').press('Enter');
    await page.click('.ct-editor [data-act="save"]');
    await page.waitForFunction(() => /"Ed2" in members/.test(document.querySelector('.ct-editor .ct-note').textContent));
    assert.equal(harness.sanity.stored['drafts.lead-1'], undefined, 'a bad name stops the save');
    await members.locator('li:has-text("Ed2") button').click();
    harness.sanity.touch('lead-1', { spotlightHeadline: 'Changed in the Studio' });
    await page.click('.ct-editor [data-act="save"]');
    await page.waitForSelector('.ct-conflict');
    assert.deepEqual(harness.sanity.stored['drafts.lead-1'].members, ['Ed', 'Flo'], 'nothing was written over the Studio copy');
    await shot(page, 'roster-teamlead-conflict', width);
    await page.click('.ct-conflict [data-act="replace"]');
    await page.waitForSelector('[data-part="people"] .ct-flash:has-text("Saved to the draft")');
    const lead = harness.sanity.stored['drafts.lead-1'];
    assert.deepEqual(lead.members, ['Flo', 'Gus']);
    assert.equal(lead.spotlightHeadline, 'Changed in the Studio', 'only the changed fields were replaced');
    assert.equal(lead.lead, 'Dee');
    assert.match(await personRow(page, 'Dee').locator('.ct-sub').textContent(), /2 members/);
    assert.deepEqual(page.trouble.filter(line => !/status of (400|409)/.test(line)), [], 'only the refusal and the question of this test reach the console');
    await page.close();
  });

  await check('Delete asks first for a Leadership entry and a Team lead, and removes only that document' + label, async () => {
    const page = await open(harness, width, height, 'roster');
    const joan = personRow(page, 'Joan');
    await joan.locator('[data-act="delete"]').click();
    assert.match(await joan.locator('.ct-ask').textContent(), /Delete this Leadership entry from the wall and the Studio\? This cannot be undone/);
    assert.ok(harness.sanity.stored['leader-1']);
    await shot(page, 'roster-delete', width);
    await fits(page, 'the delete question');
    await joan.locator('[data-act="delete-now"]').click();
    await page.waitForSelector('[data-part="people"] .ct-flash:has-text("Deleted")');
    assert.equal(harness.sanity.stored['leader-1'], undefined);
    assert.ok(harness.sanity.stored['lead-1'] && harness.sanity.stored['person-1']);
    const dee = personRow(page, 'Dee');
    await dee.locator('[data-act="delete"]').click();
    assert.match(await dee.locator('.ct-ask').textContent(), /Delete this Team lead/);
    await dee.locator('.ct-ask button:has-text("Cancel")').click();
    assert.ok(harness.sanity.stored['lead-1']);
    assert.ok(!(await page.content()).includes('skFAKEtoken'), 'no key reaches the page');
    assert.deepEqual(page.trouble, []);
    await page.close();
  });

  await harness.close();
}

await browser.close();
console.log('\n' + passed + ' of ' + passed + ' passed');
