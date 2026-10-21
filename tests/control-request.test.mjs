// Tests for the Now showing requests: what each action writes (control/support/requests.js), the
// request route, and how the screen reads the four new fields with their expiries
// (dashboard/core/screen-requests.js). Fake Sanity and a fake helper; nothing leaves the process.
//
//   node tests/control-request.test.mjs

import assert from 'node:assert/strict';
import * as request from '../control/routes/request.js';
import { buildRequest, mutationsFor, todayThemeOf, todayViewsOf } from '../control/support/requests.js';
import { activeRequests, longestMinutes, stillRunning, tidyScreenRequests } from '../dashboard/core/screen-requests.js';
import { cleanReport, isLocalHost, makeReport } from '../dashboard/core/now-report-parts.js';
import { defaultSettings } from '../dashboard/config.js';
import { makeWorld } from './helpers/control-world.mjs';

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const at = new Date('2026-10-15T12:00:00Z');
const plus = minutes => new Date(at.getTime() + minutes * 60000).toISOString().replace('.000Z', 'Z');

await check('Next, Play announcement and the presentation test write the time now into their own fields', () => {
  assert.deepEqual(buildRequest('next', {}, at).set, { nextLookRequest: { requestedAt: '2026-10-15T12:00:00Z' } });
  assert.deepEqual(buildRequest('announce', {}, at).set, { announceRequest: { requestedAt: '2026-10-15T12:00:00Z' } });
  assert.deepEqual(buildRequest('presentation-test', {}, at).set, { presentationTestRequest: { requestedAt: '2026-10-15T12:00:00Z' } });
});

await check('Hold this panel takes a whole number of minutes from 1 to 60 and a panel id, and ends by itself', () => {
  assert.deepEqual(buildRequest('hold', { panel: 'tasks', minutes: 10 }, at).set, { holdPanel: { panel: 'tasks', until: plus(10) } });
  assert.deepEqual(buildRequest('hold', { panel: 'monday-board', minutes: 30 }, at).set, { holdPanel: { panel: 'monday-board', until: plus(30) } });
  assert.deepEqual(buildRequest('hold', { panel: 'tasks', minutes: 1 }, at).set, { holdPanel: { panel: 'tasks', until: plus(1) } });
  assert.deepEqual(buildRequest('hold', { panel: 'tasks', minutes: 60 }, at).set, { holdPanel: { panel: 'tasks', until: plus(60) } });
  assert.deepEqual(buildRequest('hold', { panel: 'tasks', minutes: '45' }, at).set, { holdPanel: { panel: 'tasks', until: plus(45) } });
  [0, 61, 120, -5, 1.5, 'abc', '', null, true, undefined].forEach(minutes => {
    assert.throws(() => buildRequest('hold', { panel: 'tasks', minutes: minutes }, at), error => error.status === 400 && error.message === 'Hold a panel for a whole number of minutes from 1 to 60.', String(minutes));
  });
  [{ minutes: 10 }, { panel: 'Tasks!', minutes: 10 }, { panel: '', minutes: 10 }].forEach(body => {
    assert.throws(() => buildRequest('hold', body, at), error => error.status === 400);
  });
});

await check('Pause has a limit that can be set and a default of an hour, and Resume clears it', () => {
  assert.equal(buildRequest('pause', {}, at).set.pauseRotation.until, plus(60));
  assert.equal(buildRequest('pause', { minutes: 15 }, at).set.pauseRotation.until, plus(15));
  assert.throws(() => buildRequest('pause', { minutes: 500 }, at), error => error.status === 400);
  assert.throws(() => buildRequest('pause', { minutes: 1 }, at), error => error.status === 400);
  assert.deepEqual(buildRequest('resume', {}, at).set, { pauseRotation: { until: '' } });
});

await check('Show view takes the four views for 30 minutes unless told, and Preview theme takes the four themes for 10 minutes', () => {
  ['general', 'prime', 'nova', 'family'].forEach(key => assert.equal(buildRequest('view', { key: key }, at).set.showView.key, key));
  assert.equal(buildRequest('view', { key: 'nova' }, at).set.showView.until, plus(30));
  assert.equal(buildRequest('view', { key: 'nova', minutes: 90 }, at).set.showView.until, plus(90));
  assert.throws(() => buildRequest('view', { key: 'minimal' }, at), error => error.status === 400);
  ['original', 'cybertron', 'retro', 'foundry'].forEach(theme => assert.deepEqual(buildRequest('theme', { theme: theme }, at).set.previewTheme, { theme: theme, until: plus(10) }));
  assert.throws(() => buildRequest('theme', { theme: 'neon-prime' }, at), error => error.status === 400);
});

await check('Back to schedule empties all four holds at once', () => {
  assert.deepEqual(buildRequest('schedule', {}, at).set, { holdPanel: { panel: '', until: '' }, showView: { key: '', until: '' }, previewTheme: { theme: '', until: '' }, pauseRotation: { until: '' } });
});

await check('Post an announcement makes a published announcement for both teams, two hours, 90 characters at most', () => {
  const created = buildRequest('post-announcement', { text: '  Pizza   at five  ' }, at).create;
  assert.deepEqual(created, { _type: 'announcement', text: 'Pizza at five', start: plus(0), end: plus(120), level: 'notice' });
  assert.equal(created.team, undefined);
  assert.equal(created._id, undefined);
  assert.throws(() => buildRequest('post-announcement', { text: '' }, at), error => error.status === 400);
  assert.throws(() => buildRequest('post-announcement', { text: 'x'.repeat(91) }, at), error => error.status === 400 && /91/.test(error.message));
  assert.equal(buildRequest('post-announcement', { text: 'x'.repeat(90) }, at).create.text.length, 90);
  assert.deepEqual(mutationsFor({ create: created }), [{ create: created }]);
  assert.deepEqual(mutationsFor({ set: { a: 1 } }), [{ patch: { id: 'dashboardSettings', set: { a: 1 } } }]);
});

await check('an unknown action is refused', () => {
  assert.throws(() => buildRequest('delete-everything', {}, at), error => error.status === 400);
});

await check('POST request writes one patch of the published Dashboard Settings with the write key, and the key is not in the answer', async () => {
  const world = await makeWorld([request]);
  const answer = await world.router.call('POST', '/request', { body: { action: 'hold', panel: 'tasks', minutes: 30 } });
  assert.equal(answer.status, 200);
  const sent = world.fetched[0];
  assert.match(sent.url, /\/data\/mutate\/production$/);
  assert.equal(sent.init.headers.Authorization, 'Bearer skFAKEtoken0123456789');
  const mutations = JSON.parse(sent.init.body).mutations;
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].patch.id, 'dashboardSettings');
  assert.equal(mutations[0].patch.set.holdPanel.panel, 'tasks');
  assert.ok(!answer.text.includes('skFAKE'));
  assert.ok(!world.logged.join('\n').includes('skFAKE'));
});

await check('a theme or view request answers with the time it ends, so the page can count down', async () => {
  const world = await makeWorld([request]);
  const theme = await world.router.call('POST', '/request', { body: { action: 'theme', theme: 'foundry' } });
  assert.equal(theme.status, 200);
  assert.match(theme.json.until, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  const written = JSON.parse(world.fetched[0].init.body).mutations[0].patch.set.previewTheme;
  assert.deepEqual(written, { theme: 'foundry', until: theme.json.until });
  assert.ok(Math.abs(Date.parse(theme.json.until) - Date.now() - 10 * 60000) < 5000);
  const view = await world.router.call('POST', '/request', { body: { action: 'view', key: 'family', minutes: 10 } });
  assert.equal(JSON.parse(world.fetched[1].init.body).mutations[0].patch.set.showView.until, view.json.until);
  const next = await world.router.call('POST', '/request', { body: { action: 'next' } });
  assert.equal(next.json.until, '');
});

await check('the service lists the same themes and views as the screen reads, each with a name', async () => {
  const screen = await import('../dashboard/core/screen-requests.js');
  const table = await import('../control/support/requests.js');
  assert.deepEqual(table.themeIds, screen.themeIds);
  assert.deepEqual(table.viewKeys, screen.viewKeys);
  assert.deepEqual(Object.keys(table.themeNames), table.themeIds);
  assert.deepEqual(Object.keys(table.viewNames), table.viewKeys);
  assert.deepEqual(table.themeIds, ['original', 'cybertron', 'retro', 'foundry']);
  assert.deepEqual(table.viewKeys, ['general', 'prime', 'nova', 'family']);
});

await check('without SANITY_WRITE_TOKEN a request is refused with a plain sentence and nothing is sent', async () => {
  const world = await makeWorld([request], { env: "CONTROL_PIN='123456'\n" });
  const answer = await world.router.call('POST', '/request', { body: { action: 'next' } });
  assert.equal(answer.status, 503);
  assert.match(answer.json.error, /SANITY_WRITE_TOKEN/);
  assert.deepEqual(world.fetched, []);
  const options = await world.router.call('GET', '/request');
  assert.equal(options.json.canWrite, false);
});

await check('a bad request is refused before Sanity is asked, and Sanity refusing the key gives a plain sentence', async () => {
  const world = await makeWorld([request]);
  for (const minutes of [0, 61, 7.5]) {
    const answer = await world.router.call('POST', '/request', { body: { action: 'hold', panel: 'tasks', minutes: minutes } });
    assert.equal(answer.status, 400);
    assert.equal(answer.json.error, 'Hold a panel for a whole number of minutes from 1 to 60.');
  }
  assert.equal((await world.router.call('POST', '/request', { body: 'not json' })).status, 400);
  assert.deepEqual(world.fetched, []);
  world.ctx.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  const refused = await world.router.call('POST', '/request', { body: { action: 'next' } });
  assert.equal(refused.status, 502);
  assert.equal(refused.json.error, 'Sanity refused the write. Check SANITY_WRITE_TOKEN in Settings, Keys.');
});

await check('GET request gives the views with the names of the Team documents, the themes and the panels of the large frame', async () => {
  const answers = { 'team"': { result: { teams: [{ code: 'prime', name: 'Hawktimus Prime', shortName: 'Prime', number: '3229' }, { code: 'nova', name: 'Hawktimus Nova', shortName: 'Nova', number: '3426' }], live: 2, talks: [{ name: 'Sam', start: '2026-10-15T22:00:00Z' }], requests: null } } };
  const world = await makeWorld([request], { answers: answers });
  const options = (await world.router.call('GET', '/request')).json;
  assert.deepEqual(options.views.map(view => view.key), ['general', 'prime', 'nova', 'family']);
  assert.equal(options.views[1].name, 'Prime');
  assert.equal(options.views[0].name, 'Robotics');
  assert.equal(options.views[3].name, 'Condensed');
  assert.deepEqual(options.themeNames, { original: 'Original', cybertron: 'Cybertron', retro: 'Retro', foundry: 'Foundry' });
  assert.deepEqual(options.themes, ['original', 'cybertron', 'retro', 'foundry']);
  assert.ok(options.panels.includes('tasks') && options.panels.includes('monday-charts'));
  assert.ok(!options.panels.includes('banner'));
  assert.equal(options.liveAnnouncements, 2);
  assert.equal(options.talks.length, 1);
  assert.equal(options.canWrite, true);
});

await check('Switch to this theme and Switch to this view stay for hours (up to 24), and more than that is refused in plain words', () => {
  assert.deepEqual(buildRequest('theme', { theme: 'retro', hours: 24 }, at).set.previewTheme, { theme: 'retro', until: plus(24 * 60) });
  assert.deepEqual(buildRequest('view', { key: 'nova', hours: 24 }, at).set.showView, { key: 'nova', until: plus(24 * 60) });
  assert.equal(buildRequest('theme', { theme: 'retro', hours: 2 }, at).set.previewTheme.until, plus(120));
  assert.equal(buildRequest('theme', { theme: 'retro', until: plus(24 * 60) }, at).set.previewTheme.until, plus(24 * 60));
  const tooLong = /^A theme or a view can stay for 24 hours at most\. Reset it to the schedule when you are done\.$/;
  assert.throws(() => buildRequest('theme', { theme: 'retro', hours: 25 }, at), error => error.status === 400 && tooLong.test(error.message));
  assert.throws(() => buildRequest('view', { key: 'nova', hours: 48 }, at), error => error.status === 400 && tooLong.test(error.message));
  assert.throws(() => buildRequest('theme', { theme: 'retro', until: plus(24 * 60 + 5) }, at), error => error.status === 400 && tooLong.test(error.message));
  assert.throws(() => buildRequest('theme', { theme: 'retro', until: plus(-5) }, at), error => error.status === 400);
  assert.throws(() => buildRequest('theme', { theme: 'retro', hours: 'many' }, at), error => error.status === 400);
});

await check('the timed buttons keep their rules: a theme takes 10 to 120 minutes (10 when none), a view 10 to 120 (30 when none)', () => {
  assert.equal(buildRequest('theme', { theme: 'retro' }, at).set.previewTheme.until, plus(10));
  assert.equal(buildRequest('theme', { theme: 'retro', minutes: 45 }, at).set.previewTheme.until, plus(45));
  [9, 121].forEach(minutes => {
    assert.throws(() => buildRequest('theme', { theme: 'retro', minutes: minutes }, at), error => error.status === 400 && error.message === 'Minutes should be from 10 to 120.');
    assert.throws(() => buildRequest('view', { key: 'nova', minutes: minutes }, at), error => error.status === 400 && error.message === 'Minutes should be from 10 to 120.');
  });
});

await check('the theme and the views of today come from the saved schedule in the time zone of the Look page', () => {
  const saved = { themeByWeekday: { sunday: 'retro', monday: 'foundry' } };
  // Sunday evening in New York is already Monday in UTC
  assert.equal(todayThemeOf(saved, 'America/New_York', new Date('2026-10-19T02:00:00Z')), 'retro');
  assert.equal(todayThemeOf(saved, 'UTC', new Date('2026-10-19T02:00:00Z')), 'foundry');
  assert.equal(todayThemeOf({}, 'America/New_York', new Date('2026-10-20T16:00:00Z')), 'cybertron', 'the starting schedule when nothing is saved');
  assert.equal(todayThemeOf({ themeByWeekday: { tuesday: 'neon' } }, 'Nowhere/Land', new Date('2026-10-20T16:00:00Z')), 'cybertron');
  assert.deepEqual(todayViewsOf({ viewOrder: ['nova', 'bogus', 'nova', 'general'] }), ['nova', 'general']);
  assert.deepEqual(todayViewsOf(null), ['general', 'prime', 'nova', 'family']);
});

await check('GET request gives todayTheme, todayViews and the requests that run now', async () => {
  const answers = { 'team"': { result: { teams: [], live: 0, talks: [], requests: { showView: { key: 'nova', until: '2026-10-20T16:00:00Z' } }, today: { themeByWeekday: { monday: 'foundry' }, viewOrder: ['prime', 'nova'], timeZone: 'UTC' } } } };
  const world = await makeWorld([request], { answers: answers });
  const options = (await world.router.call('GET', '/request')).json;
  assert.equal(typeof options.todayTheme, 'string');
  assert.deepEqual(options.todayViews, ['prime', 'nova']);
  assert.equal(options.requests.showView.key, 'nova');
  assert.ok(!isNaN(Date.parse(options.serverTime)));
  const posted = await world.router.call('POST', '/request', { body: { action: 'theme', theme: 'retro', hours: 24 } });
  assert.equal(posted.status, 200);
  assert.ok(Date.parse(posted.json.until) - Date.now() > 23.9 * 3600 * 1000);
});

await check('the screen reads a request only until its time, and not a time more than 24 hours off', () => {
  const settings = {
    holdPanel: { panel: 'tasks', until: plus(10) },
    showView: { key: 'nova', until: plus(30) },
    previewTheme: { theme: 'retro', until: plus(10) },
    pauseRotation: { until: plus(60) },
  };
  assert.deepEqual(activeRequests(settings, at), { holdPanel: 'tasks', showView: 'nova', previewTheme: 'retro', pauseRotation: true });
  const later = new Date(at.getTime() + 11 * 60000);
  assert.deepEqual(activeRequests(settings, later), { holdPanel: '', showView: 'nova', previewTheme: '', pauseRotation: true });
  assert.deepEqual(activeRequests(settings, new Date(at.getTime() + 61 * 60000)), { holdPanel: '', showView: '', previewTheme: '', pauseRotation: false });

  assert.equal(longestMinutes, 24 * 60);
  assert.equal(stillRunning(plus(longestMinutes), at), true);
  assert.equal(stillRunning(plus(longestMinutes + 5), at), false);
  assert.equal(stillRunning(plus(23 * 60), at), true, 'a theme that stays until reset is obeyed by the wall');
  assert.equal(stillRunning(plus(0), at), false);
  assert.equal(stillRunning('', at), false);
  assert.equal(stillRunning('soon', at), false);
});

await check('a forgotten hold ends on its own, and nothing wrong in the stored fields is obeyed', () => {
  assert.deepEqual(activeRequests({ holdPanel: { panel: 'tasks', until: plus(-1) } }, at).holdPanel, '');
  assert.equal(activeRequests({ holdPanel: { panel: 'tasks' } }, at).holdPanel, '');
  assert.equal(activeRequests({ holdPanel: { until: plus(10) } }, at).holdPanel, '');
  assert.equal(activeRequests({ showView: { key: 'minimal', until: plus(10) } }, at).showView, '');
  assert.equal(activeRequests({ previewTheme: { theme: 'neon', until: plus(10) } }, at).previewTheme, '');
  assert.equal(activeRequests({ holdPanel: 'tasks', pauseRotation: [1] }, at).pauseRotation, false);
  assert.deepEqual(activeRequests(null, at), { holdPanel: '', showView: '', previewTheme: '', pauseRotation: false });
});

await check('the fields are always complete after tidying, and the defaults in config.js are the empty ones', () => {
  const tidy = tidyScreenRequests({});
  assert.deepEqual(tidy, { holdPanel: { panel: '', until: '' }, showView: { key: '', until: '' }, previewTheme: { theme: '', until: '' }, pauseRotation: { until: '' } });
  ['holdPanel', 'showView', 'previewTheme', 'pauseRotation'].forEach(name => assert.deepEqual(defaultSettings[name], tidy[name]));
});

await check('the report of the wall is cut to size, keeps the hold and the pause, and only the Teletraan computer itself reports', () => {
  const report = makeReport({ view: 'v'.repeat(50), panel: 'tasks', requests: { holdPanel: 'tasks', pauseRotation: true }, dots: { monday: { color: 'green', reason: 'ok' } } }, at);
  assert.equal(report.view.length, 20);
  assert.equal(report.hold, 'tasks');
  assert.equal(report.pause, true);
  assert.deepEqual(Object.keys(report.dots), ['monday', 'band', 'sanity']);
  assert.equal(report.at, '2026-10-15T12:00:00.000Z');
  assert.deepEqual(Object.keys(cleanReport({ junk: 1 }, at)).sort(), ['at', 'build', 'dots', 'heldNote', 'hiddenRun', 'hold', 'layout', 'loadAt', 'loadReason', 'loads', 'page', 'panel', 'pause', 'team', 'theme', 'view']);
  assert.equal(isLocalHost('localhost') && isLocalHost('127.0.0.1') && isLocalHost('[::1]'), true);
  assert.equal(isLocalHost('teletraan.local') || isLocalHost('192.168.1.5') || isLocalHost(''), false);
});

console.log(passed + ' of ' + passed + ' checks passed.');
