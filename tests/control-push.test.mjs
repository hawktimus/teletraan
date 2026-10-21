// Tests for the temporary pushes of the Display tab: what each push writes (control/support/push.js), the routes
// (control/routes/push.js) against a fake Sanity that keeps its documents, and the plain functions and markup of the page
// (control/static/push-lib.js, tabs/push-parts.js). Nothing leaves the process.
//
//   node tests/control-push.test.mjs

import assert from 'node:assert/strict';
import * as push from '../control/routes/push.js';
import { buildCancel, buildPush, buildReset, holdRowText, noticeId, pushesOf, weekdayOf } from '../control/support/push.js';
import { clockOffset, leftWords, nowTheme, previewTarget, pushRow, rowWords, secondsLeft, weekDates } from '../control/static/push-lib.js';
import { activeHtml, announceHtml, heldHtml, holdHtml, namesOf, onWallHtml, themeCardHtml } from '../control/static/tabs/push-parts.js';
import { makeWorld } from './helpers/control-world.mjs';

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const at = new Date('2026-10-20T16:00:00Z');
const plus = minutes => new Date(at.getTime() + minutes * 60000).toISOString().replace('.000Z', 'Z');

// A fake Sanity that keeps Dashboard Settings and the announcement, applies the mutations it is sent and answers the state query
function keepSanity(world, teams = [{ _id: 'team-prime', code: 'prime', name: 'Hawktimus Prime' }, { _id: 'team-nova', code: 'nova', name: 'Hawktimus Nova' }]) {
  const store = { dashboardSettings: { _id: 'dashboardSettings', themeByWeekday: { tuesday: 'cybertron' } } };
  world.ctx.fetch = async (url, init) => {
    world.fetched.push({ url: String(url), init: init || {} });
    if (String(url).includes('/data/mutate/')) {
      const { mutations } = JSON.parse(init.body);
      mutations.forEach(mutation => {
        if (mutation.createOrReplace) store[mutation.createOrReplace._id] = mutation.createOrReplace;
        if (mutation.patch) {
          const doc = store[mutation.patch.id];
          if (!doc) throw new Error('patched a document that does not exist: ' + mutation.patch.id);
          Object.assign(doc, mutation.patch.set || {});
          (mutation.patch.unset || []).forEach(name => { delete doc[name]; });
        }
      });
      return { ok: true, status: 200, json: async () => ({ results: mutations.map(() => ({})) }) };
    }
    const notice = store[noticeId] ? Object.assign({}, store[noticeId], { team: store[noticeId].team ? (teams.find(team => team._id === store[noticeId].team._ref) || {}).code : undefined }) : null;
    return { ok: true, status: 200, json: async () => ({ result: { settings: store.dashboardSettings, zone: 'America/New_York', notice: notice, teams: teams } }) };
  };
  return store;
}

await check('each push writes the field the wall reads and holds for the minutes asked, 1 to 60', () => {
  assert.deepEqual(buildPush('theme', { theme: 'foundry', minutes: 5 }, at).set, { previewTheme: { theme: 'foundry', until: plus(5) } });
  assert.deepEqual(buildPush('view', { key: 'family', minutes: 60 }, at).set, { showView: { key: 'family', until: plus(60) } });
  assert.deepEqual(buildPush('panel', { panel: 'monday-board' }, at).set, { holdPanel: { panel: 'monday-board', until: plus(15) }, holdRow: '' });
  assert.deepEqual(buildPush('pause', { minutes: 1 }, at).set, { pauseRotation: { until: plus(1) } });
  assert.deepEqual(buildPush('hidden', { transition: 'redEyes' }, at).set, { hiddenRequest: { kind: 'redEyes', requestedAt: at.toISOString() } });
  [0, 61, 1.5, 'abc', true].forEach(minutes => {
    assert.throws(() => buildPush('theme', { theme: 'retro', minutes: minutes }, at), error => error.status === 400 && error.message === 'Hold for a whole number of minutes from 1 to 60.', String(minutes));
  });
  assert.throws(() => buildPush('theme', { theme: 'neon' }, at), error => error.status === 400);
  assert.throws(() => buildPush('view', { key: 'minimal' }, at), error => error.status === 400);
  assert.throws(() => buildPush('panel', { panel: 'Tasks!' }, at), error => error.status === 400);
  assert.throws(() => buildPush('hidden', { transition: 'nope' }, at), error => error.status === 400);
  assert.throws(() => buildPush('shutdown', {}, at), error => error.status === 400);
});

await check('an announcement is one published document with a fixed id, 90 characters at most, starting now and ending after the hold', () => {
  const made = buildPush('announcement', { text: '  Pizza   at five  ', level: 'important', minutes: 30 }, at, 'team-nova').notice;
  assert.deepEqual(made, { _id: noticeId, _type: 'announcement', text: 'Pizza at five', start: plus(0), end: plus(30), level: 'important', team: { _type: 'reference', _ref: 'team-nova' } });
  assert.equal(buildPush('announcement', { text: 'Hello' }, at).notice.team, undefined, 'both teams has no team field');
  assert.equal(buildPush('announcement', { text: 'Hello' }, at).notice.level, 'notice');
  assert.throws(() => buildPush('announcement', { text: '' }, at), error => error.status === 400);
  assert.throws(() => buildPush('announcement', { text: 'x'.repeat(91) }, at), error => error.status === 400 && /91/.test(error.message));
  assert.throws(() => buildPush('announcement', { text: 'Hi', level: 'loud' }, at), error => error.status === 400);
});

await check('cancel clears one field, and reset clears the four holds and the row of the panel hold, the hidden request and nothing else', () => {
  assert.deepEqual(buildCancel('theme').set, { previewTheme: { theme: '', until: '' } });
  assert.deepEqual(buildCancel('panel').set, { holdPanel: { panel: '', until: '' }, holdRow: '' });
  assert.deepEqual(buildCancel('hidden').unset, ['hiddenRequest']);
  assert.equal(buildCancel('announcement', at).endNotice, plus(0));
  assert.throws(() => buildCancel('everything'), error => error.status === 400);
  const reset = buildReset();
  assert.deepEqual(Object.keys(reset.set).sort(), ['holdPanel', 'holdRow', 'pauseRotation', 'previewTheme', 'showView']);
  assert.deepEqual(reset.unset, ['hiddenRequest']);
});

await check('pushesOf lists what runs now: a push that has ended is gone, a hidden transition is listed for two minutes', () => {
  const settings = {
    previewTheme: { theme: 'retro', until: plus(10) }, showView: { key: 'nova', until: plus(-1) }, holdPanel: { panel: 'tasks', until: plus(5) },
    pauseRotation: { until: '' }, hiddenRequest: { kind: 'desktop', requestedAt: plus(-1) },
  };
  const notice = { text: 'Pizza', start: plus(-1), end: plus(20), level: 'notice' };
  assert.deepEqual(pushesOf(settings, notice, at).map(item => item.kind), ['theme', 'panel', 'announcement', 'hidden']);
  assert.deepEqual(pushesOf(settings, { text: 'Old', start: plus(-60), end: plus(-1) }, new Date(at.getTime() + 3 * 60000)).map(item => item.kind), ['theme', 'panel']);
  assert.deepEqual(pushesOf({}, null, at), []);
  assert.equal(weekdayOf('America/New_York', at), 'tuesday');
  assert.equal(weekdayOf('Nowhere/Land', at), 'tuesday');
});

await check('POST push writes one patch with the write key, answers with the end time, and the key is not in the answer', async () => {
  const world = await makeWorld([push]);
  keepSanity(world);
  const answer = await world.router.call('POST', '/push', { body: { kind: 'theme', theme: 'foundry', minutes: 5 } });
  assert.equal(answer.status, 200);
  assert.ok(Math.abs(Date.parse(answer.json.until) - Date.now() - 5 * 60000) < 5000);
  const sent = world.fetched.find(item => item.url.includes('/data/mutate/'));
  assert.equal(sent.init.headers.Authorization, 'Bearer skFAKEtoken0123456789');
  const mutation = JSON.parse(sent.init.body).mutations[0];
  assert.equal(mutation.patch.id, 'dashboardSettings');
  assert.deepEqual(mutation.patch.set.previewTheme, { theme: 'foundry', until: answer.json.until });
  assert.ok(!answer.text.includes('skFAKE'));
  assert.ok(!world.logged.join('\n').includes('skFAKE'));
});

await check('a bad push is refused before Sanity is asked, and without the write key nothing is sent', async () => {
  const world = await makeWorld([push]);
  keepSanity(world);
  const before = world.fetched.length;
  const refused = await world.router.call('POST', '/push', { body: { kind: 'panel', panel: 'x y', minutes: 5 } });
  assert.equal(refused.status, 400);
  const late = await world.router.call('POST', '/push', { body: { kind: 'theme', theme: 'retro', minutes: 90 } });
  assert.equal(late.status, 400);
  assert.equal(late.json.error, 'Hold for a whole number of minutes from 1 to 60.');
  assert.equal((await world.router.call('POST', '/push', { body: { kind: 'other' } })).status, 400);
  assert.equal(world.fetched.length, before);

  const bare = await makeWorld([push], { env: "CONTROL_PIN='123456'\n" });
  keepSanity(bare);
  const answer = await bare.router.call('POST', '/push', { body: { kind: 'pause', minutes: 5 } });
  assert.equal(answer.status, 503);
  assert.match(answer.json.error, /SANITY_WRITE_TOKEN/);
  assert.equal(bare.fetched.some(item => item.url.includes('/data/mutate/')), false);
});

await check('the pin is asked for on every push route', async () => {
  const world = await makeWorld([push], { pin: false });
  keepSanity(world);
  for (const [method, path] of [['GET', '/push'], ['POST', '/push'], ['POST', '/push/cancel'], ['POST', '/push/reset']]) {
    assert.equal((await world.router.call(method, path, { body: {} })).status, 401, path);
  }
  assert.equal(world.fetched.length, 0);
});

await check('holds: a push shows with its end time, Cancel ends only that one, and the others keep running', async () => {
  const world = await makeWorld([push]);
  const store = keepSanity(world);
  await world.router.call('POST', '/push', { body: { kind: 'theme', theme: 'retro', minutes: 30 } });
  await world.router.call('POST', '/push', { body: { kind: 'view', key: 'prime', minutes: 15 } });
  await world.router.call('POST', '/push', { body: { kind: 'pause', minutes: 5 } });
  let state = (await world.router.call('GET', '/push')).json;
  assert.deepEqual(state.pushes.map(item => item.kind), ['theme', 'view', 'pause']);
  assert.equal(state.today, weekdayOf('America/New_York'));
  assert.equal(state.week.tuesday, 'cybertron');

  const cancelled = await world.router.call('POST', '/push/cancel', { body: { kind: 'theme' } });
  assert.equal(cancelled.status, 200);
  assert.deepEqual(store.dashboardSettings.previewTheme, { theme: '', until: '' });
  state = (await world.router.call('GET', '/push')).json;
  assert.deepEqual(state.pushes.map(item => item.kind), ['view', 'pause']);
});

await check('announcement lifecycle: posted for the hold, replaced by the next one, ended by Cancel, and ended by Reset', async () => {
  const world = await makeWorld([push]);
  const store = keepSanity(world);

  const empty = await world.router.call('POST', '/push/cancel', { body: { kind: 'announcement' } });
  assert.equal(empty.status, 200, 'nothing to end is not an error');
  assert.equal(empty.json.nothing, true);

  const first = await world.router.call('POST', '/push', { body: { kind: 'announcement', text: 'Pizza at five', minutes: 30, team: 'nova' } });
  assert.equal(first.status, 200);
  assert.equal(store[noticeId].text, 'Pizza at five');
  assert.equal(store[noticeId].team._ref, 'team-nova');
  assert.ok(Math.abs(Date.parse(store[noticeId].end) - Date.now() - 30 * 60000) < 5000);
  let state = (await world.router.call('GET', '/push')).json;
  assert.deepEqual(state.pushes.map(item => [item.kind, item.id, item.team]), [['announcement', 'Pizza at five', 'nova']]);

  await world.router.call('POST', '/push', { body: { kind: 'announcement', text: 'Bus leaves at six', minutes: 5 } });
  assert.equal(Object.keys(store).filter(id => store[id]._type === 'announcement').length, 1, 'one document, replaced');
  assert.equal(store[noticeId].team, undefined);

  await world.router.call('POST', '/push/cancel', { body: { kind: 'announcement' } });
  assert.ok(Date.parse(store[noticeId].end) <= Date.now(), 'the end moved to now');
  state = (await world.router.call('GET', '/push')).json;
  assert.deepEqual(state.pushes, []);

  await world.router.call('POST', '/push', { body: { kind: 'announcement', text: 'Again', minutes: 10 } });
  await world.router.call('POST', '/push', { body: { kind: 'theme', theme: 'original', minutes: 10 } });
  await world.router.call('POST', '/push', { body: { kind: 'hidden', transition: 'desktop' } });
  state = (await world.router.call('GET', '/push')).json;
  assert.deepEqual(state.pushes.map(item => item.kind), ['theme', 'announcement', 'hidden']);

  const reset = await world.router.call('POST', '/push/reset', { body: {} });
  assert.equal(reset.status, 200);
  assert.deepEqual(store.dashboardSettings.previewTheme, { theme: '', until: '' });
  assert.equal(store.dashboardSettings.hiddenRequest, undefined);
  assert.deepEqual((await world.router.call('GET', '/push')).json.pushes, []);
});

await check('an announcement for a team with no document is refused in plain words', async () => {
  const world = await makeWorld([push]);
  keepSanity(world, []);
  const answer = await world.router.call('POST', '/push', { body: { kind: 'announcement', text: 'Hi', team: 'nova', minutes: 5 } });
  assert.equal(answer.status, 400);
  assert.match(answer.json.error, /no document/);
  assert.equal(world.fetched.some(item => item.url.includes('/data/mutate/')), false);
});

await check('the countdown follows the clock of the Teletraan computer and says the time in words', () => {
  const offset = clockOffset('2026-10-20T16:00:00Z', Date.parse('2026-10-20T15:59:00Z'));
  assert.equal(offset, 60000);
  const now = at.getTime();
  assert.equal(secondsLeft(plus(15), now), 900);
  assert.equal(leftWords(plus(15), now), '15 minutes 0 seconds left');
  assert.equal(leftWords(new Date(now + 61000).toISOString(), now), '1 minute 1 second left');
  assert.equal(leftWords(new Date(now + 45000).toISOString(), now), '45 seconds left');
  assert.equal(leftWords(plus(-1), now), 'ending now');
  assert.equal(secondsLeft('nonsense', now), 0);
});

await check('the next date of each weekday is counted in the time zone of the wall, and the theme shown now is the pushed one or the one of the weekday', () => {
  const week = { monday: 'original', tuesday: 'cybertron', wednesday: 'retro', thursday: 'foundry', friday: 'original', saturday: 'original', sunday: 'original' };
  // 21 October 2026 is a Wednesday. Late evening in New York is already Thursday in UTC.
  const dates = weekDates('2026-10-21T16:00:00Z', 'America/New_York');
  assert.deepEqual(Object.keys(dates), ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
  assert.deepEqual([dates.monday.date, dates.wednesday.date, dates.thursday.date, dates.sunday.date], ['Mon Oct 26', 'Wed Oct 21', 'Thu Oct 22', 'Sun Oct 25']);
  assert.deepEqual(Object.keys(dates).filter(day => dates[day].today), ['wednesday']);
  const late = weekDates('2026-10-22T02:30:00Z', 'America/New_York');
  assert.equal(late.wednesday.today, true, 'it is still Wednesday evening there');
  assert.equal(weekDates('2026-12-30T12:00:00Z', 'UTC').monday.date, 'Mon Jan 4', 'the year turns');
  assert.equal(weekDates('nonsense', 'UTC').monday.date, '');
  assert.equal(weekDates('2026-10-21T16:00:00Z', 'Not/AZone').wednesday.date.startsWith('Wed'), true, 'an unknown zone falls back to this device');
  assert.deepEqual(nowTheme([], week, 'tuesday'), { id: 'cybertron', pushed: false, until: '' });
  assert.equal(nowTheme([{ kind: 'theme', id: 'foundry', until: plus(5) }], week, 'tuesday').pushed, true);
});

await check('a push that is chosen but not sent is drawn in the large picture with its own words', () => {
  const rows = [{ _key: 'a', view: 'robotics', panel: 'tasks' }, { _key: 'b', view: 'prime', panel: 'monday-department', department: 'build', list: 'open', team: 'prime', seconds: 30 }];
  const titles = { tasks: 'Tasks', 'monday-department': 'Department tasks' };
  const names = { views: { family: 'Condensed' }, themes: { retro: 'Retro' } };
  assert.equal(previewTarget({ theme: '', view: '', panel: '' }, rows, rows[0], titles, names), null);
  const theme = previewTarget({ theme: 'retro', view: '', panel: '' }, rows, rows[1], titles, names);
  assert.equal(theme.theme, 'retro');
  assert.equal(theme.row.panel, 'monday-department');
  assert.equal(theme.row.seconds, undefined, 'only the fields that change the picture');
  assert.match(theme.words, /^Previewing Department tasks, Retro\. This is not on the wall until you send it\.$/);
  const panel = previewTarget({ theme: '', view: 'family', panel: 'monday-department' }, rows, rows[0], titles, names);
  assert.equal(panel.row.department, 'build');
  assert.equal(panel.row.view, 'family');
  assert.equal(previewTarget({ theme: '', view: '', panel: 'photo' }, rows, rows[0], titles, names).row.panel, 'photo');
});

await check('the top of the page: the strip, three cards, 5 hold lengths with 15 pressed, tiles, escaped words, no dash, no exclamation mark', () => {
  const state = {
    pushes: [{ kind: 'announcement', id: '<b>Pizza</b>', until: plus(10), level: 'notice', team: '' }, { kind: 'theme', id: 'foundry', until: plus(5) }],
    today: 'tuesday', week: { tuesday: 'cybertron' }, canWrite: true,
    themes: [{ value: 'original', title: 'Original' }, { value: 'cybertron', title: 'Cybertron' }, { value: 'retro', title: 'Retro' }, { value: 'foundry', title: 'Foundry' }],
    views: [{ key: 'general', name: 'Robotics' }, { key: 'prime', name: 'Prime' }, { key: 'nova', name: 'Nova' }, { key: 'family', name: 'Condensed' }],
    teams: [{ code: 'prime', name: 'Prime' }], hiddenKinds: [{ value: 'desktop', title: 'Desktop reveal' }, { value: 'redEyes', title: 'Red eyes' }],
  };
  const draft = { theme: 'retro', view: 'prime', panel: '', settings: {}, hold: 15, text: '', level: 'notice', noticeTeam: '' };
  const choices = { panelGroups: [{ title: 'Wall', panels: [{ value: 'tasks', title: 'Tasks' }] }] };
  const names = namesOf(state, { tasks: 'Tasks' });
  const wall = onWallHtml(state, draft, choices, names);
  const theme = themeCardHtml(state, draft, names);
  const announce = announceHtml(state, draft, null, { liveAnnouncements: 2, talks: [{ name: 'Ada', start: '10:00' }] });
  const strip = activeHtml(state.pushes, state, names);
  const all = wall + theme + announce + strip;

  assert.match(wall, /<h2>On the wall now<\/h2>/);
  assert.match(wall, /data-now-theme-name>Foundry</, 'a pushed theme is the big one');
  assert.match(wall, /Held<\/dt><dd data-held-now>[^]*data-left=/, 'the status line counts down what is held');
  ['pause', 'next', 'schedule', 'reset', 'show-on-wall', 'edit-rows'].forEach(action => assert.ok(wall.includes('data-action="' + action + '"'), action));
  assert.ok(wall.indexOf('data-action="pause"') < wall.indexOf('data-action="show-on-wall"'), 'playback comes first');
  assert.equal((wall.match(/data-view-pick=/g) || []).length, 4);
  assert.match(wall, /data-view-pick="prime"[^>]*aria-pressed="true"/);
  assert.match(wall, /<option value="tasks">Tasks<\/option>/);
  assert.match(onWallHtml({ ...state, pushes: [{ kind: 'pause', id: '', until: plus(5) }] }, draft, choices, names), /data-action="resume"[^>]*>Resume rotation</);
  assert.equal((theme.match(/data-theme-pick=/g) || []).length, 4);
  assert.match(theme, /data-theme-pick="retro"[^>]*aria-pressed="true"/);
  ['push-theme', 'preview-theme'].forEach(action => assert.ok(theme.includes('data-action="' + action + '"'), action));
  assert.match(theme, /Preview for 10 minutes/);
  assert.match(theme, /Back to the schedule/);
  assert.match(theme, /Tuesday the schedule uses Cybertron/);
  assert.equal((holdHtml(15).match(/data-hold=/g) || []).length, 5);
  assert.match(holdHtml(15), /data-hold="15"[^>]*aria-pressed="true"/);
  assert.ok(strip.includes('&lt;b&gt;Pizza&lt;/b&gt;') && !strip.includes('<b>Pizza'), 'an announcement text is escaped');
  assert.equal((strip.match(/data-action="cancel"/g) || []).length, 2, 'one Cancel on each push');
  assert.ok(strip.includes('data-action="reset"'));
  assert.ok(!/<details/.test(wall + theme), 'the first two cards are not folded');
  assert.match(announce, /<details class="more-tools announce-card" data-more="announce">/);
  assert.ok(!/<details[^>]* open/.test(announce), 'closed to start with');
  ['push-announcement', 'post-announcement', 'announce', 'presentation-test'].forEach(action => assert.ok(announce.includes('data-action="' + action + '"'), action));
  assert.equal((announce.match(/data-action="push-hidden"/g) || []).length, 2);
  assert.ok(announce.includes('data-hidden-run') && announce.includes('2 live now') && announce.includes('Ada'));
  assert.match(announce, /maxlength="90"/);
  assert.ok(!/[–—!]/.test(all.replace(/<[^>]*>/g, '')), 'plain wording');
  assert.ok(activeHtml([], state, names).includes('nothing'));
  assert.match(heldHtml([], names), /Nothing is held/);

  const off = onWallHtml(Object.assign({}, state, { canWrite: false }), draft, choices, names);
  assert.match(off, /data-action="show-on-wall" disabled/);
});

await check('Show a panel draws the menus of the chosen panel from the same choices as the row editor', async () => {
  const { panelFieldsOf, settingsOf, showFieldsHtml } = await import('../control/static/tabs/show-panel-fields.js');
  const monday = { departments: [{ value: 'build', title: 'Build' }], lists: [{ value: 'open', title: 'Open' }, { value: 'done', title: 'Done' }], charts: [{ value: 'status', title: 'Status' }], teams: [{ value: '', title: 'Both' }, { value: 'prime', title: 'Prime' }] };
  const choices = { monday: monday };
  assert.deepEqual(panelFieldsOf('monday-department', {}, choices).map(item => item.field), ['department', 'list', 'team']);
  assert.deepEqual(panelFieldsOf('monday-charts', {}, choices).map(item => item.field), ['chart', 'department', 'team']);
  assert.deepEqual(panelFieldsOf('tasks', {}, choices), []);
  assert.deepEqual(panelFieldsOf('roster', {}, { monday: monday, roster: { teams: [{ value: 'a', title: 'A' }], departments: [{ value: 'b', title: 'B' }] } }).map(item => item.field), ['department', 'team']);
  const html = showFieldsHtml('monday-department', { department: 'build' }, choices);
  assert.match(html, /<select data-show-field="department">/);
  assert.match(html, /data-show-field="list"/);
  assert.deepEqual(settingsOf('monday-charts', { chart: 'status', department: 'build', team: '' }, choices), { chart: 'status', department: 'build', team: '' }, 'only this panel\'s menus; an empty pick is kept because it takes the setting off the row');
  const rows = [{ _key: 'a', panel: 'monday-department', department: 'build', list: 'open' }];
  const target = previewTarget({ theme: '', view: '', panel: 'monday-department', settings: { department: 'design', list: 'done' } }, rows, null, {}, {});
  assert.equal(target.row.department, 'design');
  assert.equal(target.row.list, 'done');
  const both = previewTarget({ theme: '', view: '', panel: 'monday-department', settings: { team: '' } }, [{ _key: 'a', panel: 'monday-department', department: 'build', team: 'prime' }], null, {}, {});
  assert.equal(both.row.team, undefined, 'Both teams takes the team off the row of the Rotation');
  assert.equal(both.row.department, 'build');
});

const mondayChoices = {
  monday: {
    departments: [{ value: 'build', title: 'Build' }, { value: 'business', title: 'Business' }, { value: 'electrical', title: 'Electrical' }],
    lists: [{ value: 'open', title: 'Open' }, { value: 'done', title: 'Done' }],
    charts: [{ value: 'status', title: 'Status' }, { value: 'progress', title: 'Progress' }],
    teams: [{ value: '', title: 'Both' }, { value: 'prime', title: 'Prime' }, { value: 'nova', title: 'Nova' }],
  },
};
const wordNames = { panels: { 'monday-department': 'Department tasks', 'monday-charts': 'TV charts', roster: 'Subteam roster', tasks: 'Tasks' }, views: { general: 'Robotics', prime: 'Prime', nova: 'Nova', family: 'Condensed' }, choices: mondayChoices };

await check('a held row is named in words: the panel, its menus and the view it plays in', () => {
  assert.equal(rowWords({ view: 'prime', panel: 'monday-department', department: 'build', list: 'open', team: 'prime' }, wordNames), 'Monday: Department tasks, Build, Open, Prime view');
  assert.equal(rowWords({ view: 'family', panel: 'monday-department', department: 'business', list: 'open' }, wordNames), 'Monday: Department tasks, Business, Open, Condensed view');
  assert.equal(rowWords({ view: 'robotics', panel: 'monday-charts', chart: 'progress', department: 'electrical' }, wordNames), 'Monday: TV charts, Progress, Electrical, Condensed view', 'a Robotics Monday row of both teams plays in Condensed');
  assert.equal(rowWords({ view: 'robotics', panel: 'roster', team: 'nova', department: 'electrical' }, wordNames), 'Subteam roster, Electrical, Nova view');
  assert.equal(rowWords({ panel: 'tasks' }, wordNames), 'Tasks', 'a row with no view names none');
  assert.equal(rowWords({ view: 'robotics', panel: 'tasks' }, wordNames), 'Tasks, Robotics view');
  assert.ok(!/[–—!]/.test(rowWords({ view: 'prime', panel: 'monday-department', department: 'build' }, wordNames)));
});

await check('the row a panel push sends is the row of the picture, with the seconds of the first row of the Rotation', () => {
  const rows = [{ _key: 'a', view: 'robotics', panel: 'monday-department', department: 'build', list: 'done', seconds: 30 }];
  const draft = { theme: '', view: 'prime', panel: 'monday-department', settings: { department: 'design', list: 'open', team: 'prime' } };
  const row = pushRow(draft, rows, null);
  assert.deepEqual(row, { panel: 'monday-department', view: 'prime', department: 'design', list: 'open', team: 'prime', seconds: 30 });
  const target = previewTarget(draft, rows, null, {}, {});
  Object.keys(target.row).forEach(name => assert.equal(row[name], target.row[name], 'the picture draws ' + name + ' as it is sent'));
  assert.equal(pushRow({ theme: 'retro', view: '', panel: '', settings: {} }, rows, null), null, 'no panel, no row');
});

await check('a panel push writes the row for the wall, a push with no row clears the old one, and Cancel, Reset and the Status hold clear it', async () => {
  const world = await makeWorld([push]);
  const store = keepSanity(world);
  const row = { view: 'prime', panel: 'monday-department', department: 'build', list: 'open', team: 'prime', seconds: 30 };
  const sent = await world.router.call('POST', '/push', { body: { kind: 'panel', panel: 'monday-department', minutes: 30, row: row } });
  assert.equal(sent.status, 200);
  assert.deepEqual(JSON.parse(store.dashboardSettings.holdRow), row);
  assert.ok(store.dashboardSettings.holdRow.length <= 400);
  assert.equal(store.dashboardSettings.holdPanel.panel, 'monday-department');
  assert.equal(JSON.stringify(store.dashboardSettings).includes('skFAKE'), false);

  const state = (await world.router.call('GET', '/push')).json;
  assert.deepEqual(state.pushes[0].row, row, 'the strip can name the row');

  await world.router.call('POST', '/push', { body: { kind: 'panel', panel: 'monday-department', minutes: 5 } });
  assert.equal(store.dashboardSettings.holdRow, '', 'a push with no row clears the row of the push before');

  await world.router.call('POST', '/push', { body: { kind: 'panel', panel: 'monday-department', minutes: 5, row: row } });
  await world.router.call('POST', '/push/cancel', { body: { kind: 'panel' } });
  assert.deepEqual([store.dashboardSettings.holdRow, store.dashboardSettings.holdPanel], ['', { panel: '', until: '' }]);

  await world.router.call('POST', '/push', { body: { kind: 'panel', panel: 'monday-department', minutes: 5, row: row } });
  await world.router.call('POST', '/push/reset', { body: {} });
  assert.equal(store.dashboardSettings.holdRow, '', 'Reset to today\'s schedule ends the row');

  const { buildRequest } = await import('../control/support/requests.js');
  assert.equal(buildRequest('hold', { panel: 'tasks', minutes: 5 }, at).set.holdRow, '', 'the Status hold has no row');
  assert.equal(buildRequest('schedule', {}, at).set.holdRow, '', 'Back to schedule ends the row');
});

await check('a row the wall could not play is refused before Sanity is asked, and a row is cleaned like a row of the Rotation', async () => {
  assert.throws(() => holdRowText({ view: 'prime', panel: 'monday-charts' }, 'monday-department'), error => error.status === 400);
  assert.throws(() => holdRowText('text', 'tasks'), error => error.status === 400);
  assert.throws(() => holdRowText({ view: 'sideways', panel: 'tasks' }, 'tasks'), error => error.status === 400);
  assert.equal(holdRowText(undefined, 'tasks'), '');
  assert.equal(holdRowText('', 'tasks'), '');
  assert.deepEqual(JSON.parse(holdRowText({ view: 'family', panel: 'monday-department', department: 'Business', list: 'later', junk: 1, shown: false }, 'monday-department')), { view: 'family', panel: 'monday-department', department: 'business', list: 'open' });
  assert.deepEqual(JSON.parse(holdRowText({ panel: 'tasks' }, 'tasks')), { panel: 'tasks' }, 'no view stays no view');
  assert.deepEqual(JSON.parse(holdRowText({ view: 'general', panel: 'tasks', seconds: 500 }, 'tasks')), { view: 'robotics', panel: 'tasks', seconds: 120 });

  const world = await makeWorld([push]);
  keepSanity(world);
  const before = world.fetched.length;
  const refused = await world.router.call('POST', '/push', { body: { kind: 'panel', panel: 'monday-department', minutes: 5, row: { view: 'prime', panel: 'roster' } } });
  assert.equal(refused.status, 400);
  assert.equal(world.fetched.length, before);
});

console.log(passed + ' passed');
