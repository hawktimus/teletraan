// The pictures of a row in the Display tab: the plain functions (control/static/display-preview.js), the markup of the
// picture card and of a row's slot (tabs/display-preview-parts.js, display-parts.js), and rules of the page code that are
// read from the files: the frame is sandboxed, the page asks the service only for the report of the wall, and nothing
// that writes or holds a key is in it. The browser part is tests/control-display-pictures.test.mjs.
//
//   node tests/control-display-preview.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  chooseLive, hasPicture, isKioskHost, isPhone, mostThumbs, nowLine, pictureAddress, pictureRow, readSwitch, sandbox, scaleFor,
  switchName, thumbsWanted, writeSwitch,
} from '../control/static/display-preview.js';
import { largeHtml, thumbHtml } from '../control/static/tabs/display-preview-parts.js';
import { rowHtml, rowsHtml } from '../control/static/tabs/display-parts.js';
import { withKeys } from '../control/static/display-rows.js';
import { readRowPreview } from '../dashboard/core/row-preview.js';
import { repo } from './helpers/control-world.mjs';

let passed = 0;
function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const codeOf = file => read(file).split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n');

check('the address of a frame holds only what changes the picture, in a fixed order, and the dashboard reads it back', () => {
  const row = { _key: 'abc', view: 'prime', panel: 'monday-department', department: 'build', list: 'done', team: 'nova', seconds: 40, shown: false, unknown: 1 };
  assert.deepEqual(Object.keys(pictureRow(row)), ['panel', 'view', 'department', 'list', 'team']);
  const address = pictureAddress(row);
  assert.ok(address.startsWith('/dashboard/?rowpreview='), 'the same server, the dashboard folder');
  assert.ok(!address.includes('http'), 'a relative address, on the page\'s own origin');
  assert.deepEqual(readRowPreview(address.slice(address.indexOf('?'))).row, { panel: 'monday-department', view: 'prime', department: 'build', list: 'done', team: 'nova' });
  // Seconds and Show on screen do not load the frame again
  assert.equal(pictureAddress(Object.assign({}, row, { seconds: 90, shown: true })), address);
  assert.notEqual(pictureAddress(Object.assign({}, row, { department: 'design' })), address);
  assert.equal(pictureAddress({ view: 'prime' }), '');
  assert.equal(pictureAddress({ panel: '' }), '');
  assert.equal(pictureAddress(null), '');
});

check('the scale of a frame is the width of its box over 1920', () => {
  assert.equal(scaleFor(240), 0.125);
  assert.equal(scaleFor(960), 0.5);
  assert.equal(scaleFor(0), 0.125);
});

check('the page opened on the Teletraan computer itself is told apart from one on a laptop', () => {
  ['localhost', '127.0.0.1', '[::1]', 'LOCALHOST'].forEach(host => assert.equal(isKioskHost(host), true, host));
  ['teletraan.local', '192.168.1.20', 'teletraan.tail1234.ts.net', ''].forEach(host => assert.equal(isKioskHost(host), false, host));
});

check('Show thumbnails is on for a computer, off for a phone and for the kiosk, and a saved choice wins', () => {
  assert.equal(thumbsWanted(null, 1440, false), true);
  assert.equal(thumbsWanted(null, 390, false), false);
  assert.equal(thumbsWanted('on', 390, false), true);
  assert.equal(thumbsWanted('off', 1440, false), false);
  assert.equal(thumbsWanted('on', 1440, true), false, 'never on the kiosk');
  assert.equal(isPhone(999), true);
  assert.equal(isPhone(1000), false);

  const store = { values: {}, getItem(name) { return name in this.values ? this.values[name] : null; }, setItem(name, value) { this.values[name] = value; } };
  writeSwitch(store, true);
  assert.equal(store.values[switchName], 'on');
  assert.equal(readSwitch(store), 'on');
  writeSwitch(store, false);
  assert.equal(readSwitch(store), 'off');
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readSwitch(broken), null);
  writeSwitch(broken, true);
  assert.equal(readSwitch(null), null);
});

check('at most six small pictures are live, the selected row keeps one, and a phone has the selected row only', () => {
  const keys = Array.from({ length: 20 }, (item, at) => 'k' + at);
  assert.equal(mostThumbs, 6);
  assert.deepEqual(chooseLive(keys, '', 6), keys.slice(0, 6));
  assert.deepEqual(chooseLive(keys.slice(0, 4), 'k2', 6), ['k0', 'k1', 'k2', 'k3']);
  const withSelected = chooseLive(keys, 'k15', 6);
  assert.equal(withSelected.length, 6);
  assert.ok(withSelected.includes('k15'));
  assert.deepEqual(withSelected.slice(0, 5), keys.slice(0, 5), 'the others keep page order');
  assert.deepEqual(chooseLive(keys, 'k3', 6, true), ['k3']);
  assert.deepEqual(chooseLive(keys, 'k30', 6, true), [], 'a selected row that is not on screen has none');
  assert.deepEqual(chooseLive([], 'k1'), []);
});

check('a row with no panel or a retired one has no picture', () => {
  const titles = { tasks: 'Tasks' };
  assert.equal(hasPicture({ panel: 'tasks' }, titles), true);
  assert.equal(hasPicture({ panel: 'monday-tasks' }, titles), false);
  assert.equal(hasPicture({ panel: '' }, titles), false);
  assert.equal(hasPicture(null, titles), false);
});

check('what the TV shows now is one plain line, and says so when the TV has not reported', () => {
  assert.equal(nowLine(null), 'What the TV shows now: not known yet.');
  assert.equal(nowLine({ panel: '' }), 'What the TV shows now: not known yet.');
  assert.equal(nowLine({ panel: 'team-leads', page: '2', team: 'nova', view: 'nova', theme: 'cybertron' }), 'What the TV shows now: team leads (page 2), nova, view nova, theme cybertron.');
  assert.equal(nowLine({ panel: 'tasks', page: '1', team: '' }), 'What the TV shows now: tasks, both teams.');
});

check('the picture card has the lines, the thumbnails switch with a 44px target and no dash or exclamation mark', () => {
  const html = largeHtml();
  ['data-large-box', 'data-large-stage', 'data-large-title', 'data-large-reason', 'data-large-now', 'data-kiosk-note', 'data-thumb-switch', 'data-action="preview-here"'].forEach(name => assert.ok(html.includes(name), name));
  assert.ok(html.includes('Show thumbnails'));
  assert.ok(html.includes('<aside'), 'a landmark a screen reader can find');
  assert.ok(!/[–—!]/.test(html), 'plain wording');
  assert.ok(!html.includes('<iframe'), 'the page code makes the frames when a row is picked, so a phone holds none at first');
  assert.ok(thumbHtml('<b>Tasks</b>').includes('&lt;b&gt;Tasks&lt;/b&gt;'), 'a title is escaped');
});

check('every row has a slot for its small picture as the first child, with the title in it', () => {
  const rows = withKeys([{ view: 'robotics', panel: 'tasks', shown: true }, { view: 'prime', panel: 'photo', shown: true }]);
  const page = { choices: { views: [{ value: 'robotics', title: 'Robotics' }, { value: 'prime', title: 'Prime' }], panelGroups: [{ title: 'Wall', panels: [{ value: 'tasks', title: 'Tasks' }, { value: 'photo', title: 'Photo' }] }], sideGroups: [] }, checks: {}, pageSeconds: 20 };
  const html = rowsHtml(rows, page);
  assert.equal((html.match(/data-thumb /g) || []).length, 2);
  assert.match(html, /<article class="drow"[^>]*><div class="thumb" data-thumb aria-hidden="true"><span class="thumb-title">Tasks<\/span><\/div><div class="dhead">/);
  assert.ok(rowHtml(rows[0], 0, false, page).includes('data-action="to-preview"'), 'a phone can jump to the large picture');
});

check('the page code makes a sandboxed frame, asks the service only for the report of the wall, and holds no key', () => {
  assert.equal(sandbox, 'allow-scripts allow-same-origin', 'no forms, popups, downloads or page changes');
  const page = codeOf('control/static/tabs/display-preview.js');
  assert.ok(page.includes("setAttribute('sandbox', sandbox)"));
  assert.ok(page.includes("setAttribute('referrerpolicy', 'no-referrer')"));
  assert.ok(page.includes('frame.tabIndex = -1'));
  const calls = Array.from(page.matchAll(/api\('([A-Z]+)', '([^']+)'/g)).map(match => match[1] + ' ' + match[2]);
  assert.deepEqual(calls, ['GET /now'], 'the one call is the read only report of the wall');
  ['display-preview.js', 'tabs/display-preview.js', 'tabs/display-preview-parts.js', 'tabs/display-patch.js'].forEach(file => {
    const code = codeOf('control/static/' + file);
    assert.ok(!/SANITY_WRITE_TOKEN|MONDAY_API_TOKEN|TBA_AUTH_KEY|local\.env|CONTROL_PIN/.test(code), file);
    assert.ok(!/method: '(POST|PUT|DELETE|PATCH)'|XMLHttpRequest|sendBeacon|document\.cookie|innerHTML\s*=\s*[^;]*location/.test(code), file);
  });
});

check('the code is plain: no dashes that look like pauses, no exclamation marks, no emoji', () => {
  ['control/static/display-preview.js', 'control/static/tabs/display-preview.js', 'control/static/tabs/display-preview-parts.js', 'control/static/tabs/display-patch.js', 'dashboard/core/row-preview.js', 'dashboard/core/row-preview-guard.js'].forEach(file => {
    const text = read(file);
    assert.ok(!/[–—]/.test(text), file + ' has an en or em dash');
    assert.ok(!/!\s*['"`]|❗/.test(text.replace(/!==?/g, '')), file + ' has an exclamation mark in a word');
    assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(text), file + ' has an emoji');
  });
});

check('the stylesheet gives the slot 240 by 135, the frame the 1920 canvas and the frames no pointer', () => {
  const css = read('control/static/tabs/tabs.css');
  assert.ok(/\.display-page \.thumb \{[^}]*width: 240px[^}]*height: 135px/.test(css));
  assert.ok(/\.thumb-frame \{[^}]*width: 1920px[^}]*height: 1080px[^}]*scale\(0\.125\)[^}]*pointer-events: none/.test(css));
  assert.ok(/\.large-frame \{[^}]*pointer-events: none/.test(css));
  assert.ok(/@media \(min-width: 1000px\)[\s\S]*position: sticky/.test(css), 'sticky beside the rows from 1000px');
});

console.log('\n' + passed + ' checks passed');
