// Tests for the text of the Display tab (control/static/tabs/display-parts.js) and that the tab file registers itself,
// parses, and is written to the page rules: 44px targets, wrapping text, plain words, no dashes that look like pauses.
//
//   node tests/control-display-page.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { addRowHtml, conflictHtml, controlsHtml, extrasHtml, rowsHtml, sourceHtml, summaryWords, themeHtml, quickHtml, titlesOf } from '../control/static/tabs/display-parts.js';
import { withKeys } from '../control/static/display-rows.js';
import { repo } from './helpers/control-world.mjs';

let passed = 0;
function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

const choices = {
  views: [{ value: 'robotics', title: 'Robotics' }, { value: 'prime', title: 'Prime' }, { value: 'nova', title: 'Nova' }],
  panelGroups: [{ title: 'Wall panels', panels: [{ value: 'photo', title: 'Photo' }, { value: 'tasks', title: 'Tasks' }, { value: 'events', title: 'Upcoming events' }] }],
  sideGroups: [{ title: 'Small panels', panels: [{ value: 'forecast', title: 'Weather forecast' }] }],
  themes: [{ value: 'original', title: 'Original' }, { value: 'cybertron', title: 'Cybertron' }],
  weekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
};
const list = withKeys([
  { view: 'robotics', panel: 'photo', photoCount: 4, secondsPerPhoto: 10, seconds: 40, shown: true },
  { view: 'robotics', panel: 'events', part: 1, side: 'forecast', shown: true },
  { view: 'prime', panel: 'tasks', department: '<b>build</b>', shown: false, seconds: 30 },
]);
const checks = {
  [list[0]._key]: { state: 'show', reason: 'Will show now.', items: ['3 photos visible'] },
  [list[1]._key]: { state: 'skip', reason: 'Skipped now: no event is coming up.', items: [] },
  [list[2]._key]: { state: 'off', reason: 'Shown is off, so the wall skips this row.', items: [] },
};
const page = { choices, checks, pageSeconds: 20, rows: list, canWrite: true, isDraft: true, studioNewer: true, hasDocument: true, loadedAt: new Date().toISOString(), dirty: false, canUndo: false, newerInStudio: false };

check('each row is a card with its status, its reason, its items and the fields the tab changes', () => {
  const html = rowsHtml(list, page);
  assert.equal((html.match(/class="drow"/g) || []).length, 3);
  ['Will show', 'Skipped', 'Off'].forEach(word => assert.ok(html.includes('>' + word + '<'), word));
  assert.ok(html.includes('Will show now.') && html.includes('<li>3 photos visible</li>'));
  assert.ok(html.includes('Skipped now: no event is coming up.'));
  ['view', 'panel', 'seconds', 'shown', 'photoCount', 'secondsPerPhoto'].forEach(name => assert.ok(html.includes('data-field="' + name + '"'), name));
  ['up', 'down', 'copy', 'delete'].forEach(name => assert.ok(html.includes('data-action="' + name + '"'), name));
  assert.match(html, /data-action="up" disabled/);
  assert.match(html, /data-action="down" disabled/, 'the last row cannot move down');
  assert.ok(html.includes('Small panel: Weather forecast'), 'a field the tab does not edit is still said');
  assert.ok(html.includes('Seconds (6 to 120, empty is 20)'));
});

check('rows that follow each other in one view are one group, with the view named and the time counted', () => {
  const html = rowsHtml(list, page);
  assert.equal((html.match(/class="dgroup"/g) || []).length, 2);
  assert.ok(html.includes('Robotics, rows 1 to 2. 2 of 2 on, 1 minute.'));
  assert.ok(html.includes('Prime, rows 3 to 3. 0 of 1 on, 0 seconds.'));
});

check('every value from the service is escaped', () => {
  const html = rowsHtml(list, page);
  assert.ok(!html.includes('<b>build</b>'));
  assert.ok(html.includes('Department: &lt;b&gt;build&lt;/b&gt;'));
  const odd = rowsHtml(withKeys([{ view: 'prime', panel: '"><img src=x>', shown: true }]), Object.assign({}, page, { checks: {} }));
  assert.ok(!odd.includes('<img'));
  assert.ok(odd.includes('(older panel)'), 'a panel the pickers do not offer stays in its row');
  assert.ok(!conflictHtml({ action: 'save', error: '<script>x</script>', updatedAt: '' }).includes('<script>'));
});

check('a row waits for the wall check and says so', () => {
  const html = rowsHtml(list, Object.assign({}, page, { checks: {} }));
  assert.ok(html.includes('Checking what the wall would do.'));
});

check('Save needs a change and a write key, Publish needs a saved draft, and the page says what Publish does', () => {
  const clean = controlsHtml(Object.assign({}, page));
  assert.match(clean, /data-action="save" disabled/);
  assert.doesNotMatch(clean, /data-action="publish" disabled/);
  assert.ok(clean.includes('Publish puts every waiting change of Dashboard Settings on the wall, including edits made in the Studio.'));

  const dirty = controlsHtml(Object.assign({}, page, { dirty: true }));
  assert.doesNotMatch(dirty, /data-action="save" disabled/);
  assert.match(dirty, /data-action="publish" disabled/);
  assert.ok(dirty.includes('You have changes that are not saved.'));

  const nowrite = controlsHtml(Object.assign({}, page, { dirty: true, canWrite: false }));
  assert.match(nowrite, /data-action="save" disabled/);
  assert.match(nowrite, /data-action="publish" disabled/);
  assert.ok(controlsHtml(page).includes('Refresh from Sanity'));

  assert.match(controlsHtml(Object.assign({}, page, { isDraft: false })), /data-action="publish" disabled/, 'nothing to publish without a draft');
});

check('the page says where its copy came from and when the Studio copy is newer', () => {
  assert.ok(sourceHtml(page).includes('Showing the draft of Dashboard Settings.'));
  assert.ok(sourceHtml(Object.assign({}, page, { isDraft: false })).includes('Showing the published list.'));
  assert.ok(!sourceHtml(page).includes('data-newer'));
  assert.ok(sourceHtml(Object.assign({}, page, { newerInStudio: true })).includes('The Studio copy is newer than what you loaded.'));
  assert.ok(sourceHtml(Object.assign({}, page, { canWrite: false })).includes('SANITY_WRITE_TOKEN'));
  assert.ok(sourceHtml(Object.assign({}, page, { hasDocument: false })).includes('Publish once'));
});

check('the question before a newer Studio edit is overwritten has the three answers', () => {
  const save = conflictHtml({ action: 'save', error: 'Dashboard Settings changed in the Studio after this page loaded it.', updatedAt: '2026-10-18T12:00:00Z' });
  ['overwrite', 'refresh', 'keep-editing'].forEach(name => assert.ok(save.includes('data-action="' + name + '"'), name));
  assert.ok(save.includes('Replace the Studio copy'));
  assert.ok(conflictHtml({ action: 'publish', error: 'x', updatedAt: '' }).includes('Publish the newer draft'));
  assert.equal(conflictHtml(null), '');
});

check('the summary counts shown, skipped and switched off rows and the loop time', () => {
  assert.equal(summaryWords(list, checks, 20), 'Right now the loop has 1 shown, 1 skipped, 1 switched off. A full loop takes 1 minute, counting every row that is on.');
  assert.match(summaryWords([], {}, 20), /No row is shown/);
  assert.match(summaryWords(list, {}, 20), /not available|not known/);
});

check('the theme settings have a select for each weekday, the banner title and the transition length', () => {
  const html = themeHtml({ themeByWeekday: { monday: 'cybertron', tuesday: 'original', wednesday: 'original', thursday: 'original', friday: 'original', saturday: 'original', sunday: 'original' }, generalViewTitle: 'HAWKTIMUS ROBOTICS', transitionSeconds: 3 }, choices);
  assert.equal((html.match(/data-theme-day=/g) || []).length, 7);
  assert.ok(html.includes('<option value="cybertron" selected>Cybertron</option>'));
  assert.ok(html.includes('maxlength="28"') && html.includes('value="HAWKTIMUS ROBOTICS"'));
  assert.ok(html.includes('min="2" max="4"'));
});

check('the add row card and the competition card say where the data is from', () => {
  assert.ok(addRowHtml(choices).includes('data-action="add"') && addRowHtml(choices).includes('Fill from the standard order'));
  const extras = extrasHtml({
    tba: { lastSyncAt: new Date().toISOString(), lastError: '', teams: [{ team: 'prime', number: '3229', rank: 12, of: 40, nextMatch: 'Q14' }] },
    match13: { generatedAt: new Date().toISOString(), stale: false, sample: false, events: [{ key: '2027ncwak', matches: [{ key: '2027ncwak_qm14', played: false, redWin: 62, redScore: 85.2, blueScore: 70.1 }] }] },
  });
  assert.ok(extras.includes('rank 12 of 40') && extras.includes('red wins 62 percent') && extras.includes('not saved to Sanity'));
  assert.ok(extrasHtml(null).includes('No competition data was read.'));
  assert.deepEqual(Object.keys(titlesOf(choices)).sort(), ['events', 'forecast', 'photo', 'tasks']);
});

// ----- the files -----

const files = ['control/static/tabs/display.js', 'control/static/tabs/display-parts.js', 'control/static/display-rows.js', 'control/support/display.js', 'control/support/display-wall.js', 'control/routes/display.js'];

check('the tab file registers itself as Display, the parts files do not, and every file parses', () => {
  const tab = fs.readFileSync(path.join(repo, files[0]), 'utf8');
  assert.match(tab, /registerTab\(\{/);
  assert.ok(tab.includes("id: 'display'") && tab.includes("title: 'Display'"));
  ['control/static/tabs/display-parts.js', 'control/static/display-rows.js'].forEach(file => assert.ok(!fs.readFileSync(path.join(repo, file), 'utf8').includes('registerTab(')));
  files.forEach(file => {
    const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-display-')), path.basename(file).replace('.js', '.mjs'));
    fs.writeFileSync(copy, fs.readFileSync(path.join(repo, file), 'utf8'));
    const checked = spawnSync(process.execPath, ['--check', copy], { encoding: 'utf8' });
    assert.equal(checked.status, 0, file + ': ' + checked.stderr);
  });
});

check('the page keeps no key and sends nothing to Sanity itself', () => {
  ['control/static/tabs/display.js', 'control/static/tabs/display-parts.js', 'control/static/display-rows.js'].forEach(file => {
    const text = fs.readFileSync(path.join(repo, file), 'utf8');
    assert.ok(!/api\.sanity\.io|Authorization|Bearer/.test(text), file);
    assert.ok(!/localStorage|sessionStorage/.test(text), file + ' keeps nothing in the browser');
  });
});

check('the Display styles keep the phone rules: wrapping text, one column, 44px fields', () => {
  const css = fs.readFileSync(path.join(repo, 'control/static/tabs/tabs.css'), 'utf8');
  const display = css.slice(css.indexOf('The Display tab'));
  assert.match(display, /\.display-page \.fields \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(display, /overflow-wrap: anywhere/);
  assert.match(display, /@media \(min-width: 900px\)/);
  assert.match(css, /select, \.tab input \{[^}]*min-height: 44px/, 'every select and input of a tab is 44px high');
  assert.match(css, /\.tab \.act \{ min-height: 44px; min-width: 44px/);
  assert.match(css, /\.tab \.check \{[^}]*min-height: 44px/);
});

check('the words are plain: no em or en dash, no exclamation mark, no emoji in the new files', () => {
  const all = files.concat(['tests/control-display.test.mjs', 'tests/control-display-page.test.mjs']);
  all.forEach(file => {
    const text = fs.readFileSync(path.join(repo, file), 'utf8');
    assert.ok(!new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']').test(text), file + ' has a dash');
    assert.ok(!/[A-Za-z0-9.)'"]!(?!=)/.test(text), file + ' has an exclamation mark');
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), file + ' has an emoji');
  });
});

check('Quick hide says what each button does and how many rows it changes, and escapes names', () => {
  const quickRows = withKeys([{ view: 'nova', panel: 'tasks', shown: true }, { view: 'nova', panel: 'robotStatus', shown: true }, { view: 'prime', panel: 'wireframe', shown: false }]);
  const quickChoices = Object.assign({}, choices, { panelGroups: [{ title: 'Wall panels', panels: [{ value: 'robotStatus', title: 'Robot Status' }, { value: 'wireframe', title: '3D view' }, { value: 'tasks', title: '<b>Tasks</b>' }] }] });
  const html = quickHtml(quickRows, quickChoices);
  assert.ok(html.includes('Hide all Nova rows (2 rows)'));
  assert.ok(html.includes('Hide Robot Status (1 row)'));
  assert.ok(html.includes('Show 3D view (1 row)'));
  assert.ok(html.includes('data-action="quick-panel" data-panel="wireframe"'));
  assert.ok(!html.includes('<b>Tasks</b>'));
  assert.ok(quickHtml([], quickChoices).includes('no rows in the list'));
});

check('a Department tasks row has a Department, a List and a Team dropdown, and a TV charts row a Chart and a Team dropdown', () => {
  const monday = { departments: [{ value: 'build', title: 'Build' }, { value: 'cnc', title: 'CNC' }], lists: [{ value: 'open', title: 'Open' }, { value: 'done', title: 'Done' }], charts: [{ value: 'status', title: 'Status by department' }, { value: 'timeline', title: 'Timeline' }], teams: [{ value: '', title: 'Both' }, { value: 'prime', title: 'Prime' }, { value: 'nova', title: 'Nova' }] };
  const rows = withKeys([{ view: 'robotics', panel: 'monday-department', department: 'cnc', list: 'done', shown: true }, { view: 'robotics', panel: 'monday-charts', chart: 'timeline', team: 'nova', shown: true }, { view: 'robotics', panel: 'photo', shown: true }]);
  const html = rowsHtml(rows, Object.assign({}, page, { rows: rows, checks: {}, choices: Object.assign({}, choices, { monday: monday }) }));
  const cards = html.split('<article').slice(1);
  ['department', 'list', 'team'].forEach(name => assert.ok(cards[0].includes('data-field="' + name + '"'), name));
  assert.ok(cards[0].includes('<option value="cnc" selected>CNC</option>') && cards[0].includes('<option value="done" selected>Done</option>') && cards[0].includes('<option value="" selected>Both</option>'));
  assert.ok(cards[1].includes('data-field="chart"') && cards[1].includes('<option value="timeline" selected>Timeline</option>') && cards[1].includes('<option value="nova" selected>Nova</option>'));
  assert.ok(!cards[1].includes('data-field="list"') && !cards[2].includes('data-field="team"'));
});

console.log('\n' + passed + ' passed');
