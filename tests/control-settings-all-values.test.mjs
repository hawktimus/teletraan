// Tests for the plain rules of the All settings form (control/static/settings-all-values.js and settings-check.js): what a field
// shows, what changed, the patch a save sends, search, and the limits in plain words. Nothing here needs a browser.
//
//   node tests/control-settings-all-values.test.mjs

import assert from 'node:assert/strict';
import { buildSpec } from '../studio/tools/schema-spec.js';
import { plan } from '../studio/tools/schema-plan.js';
import { loadSchemaTypes } from '../control/support/schema-load.js';
import { changesOf, fieldMatches, fromLocalBox, getAt, itemLabel, move, newItem, searchFields, searchOthers, setAt, shownValues, toLocalBox, visible } from '../control/static/settings-all-values.js';
import { problemWith, problemsIn } from '../control/static/settings-check.js';
import { repo } from './helpers/control-world.mjs';

let passed = 0;
function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

const { types } = await loadSchemaTypes(repo.replace(/\/$/, ''));
const spec = buildSpec(types, plan);
const settings = spec.documents[0];
const team = spec.documents.filter(doc => doc.type === 'team')[0];
const field = (doc, name) => doc.fields.filter(one => one.name === name)[0];

check('a setting that was never stored shows its starting value, and a list shows only what is stored', () => {
  const shown = shownValues(settings.fields, { pageSeconds: 25 });
  assert.equal(shown.pageSeconds, 25);
  assert.equal(shown.glint, true);
  assert.equal(shown.crt.everySeconds, 240);
  assert.equal(shown.calendars, undefined);
  assert.equal(shown.newsCategories, undefined);
});

check('nothing is sent when nothing changed, and a setting still at its starting value is not sent', () => {
  const base = shownValues(settings.fields, { pageSeconds: 25 });
  assert.deepEqual(changesOf(settings.fields, base, JSON.parse(JSON.stringify(base))).names, []);
});

check('a save sends only the changed settings; a cleared one is unset; a group sends only its changed sub-fields', () => {
  const base = shownValues(settings.fields, { pageSeconds: 25, partsRequestUrl: 'https://example.com/x', crt: { on: true, everySeconds: 240, durationSeconds: 2.7 } });
  const now = JSON.parse(JSON.stringify(base));
  now.pageSeconds = 40;
  delete now.partsRequestUrl;
  now.crt.everySeconds = 60;
  now.glint = false;
  const out = changesOf(settings.fields, base, now);
  assert.deepEqual(out.set, { pageSeconds: 40, glint: false, crt: { everySeconds: 60 } });
  assert.deepEqual(out.unset, ['partsRequestUrl']);
});

check('a list item is sent with only the fields of its kind, its key and its kind', () => {
  const calendars = field(settings, 'calendars');
  const base = shownValues(settings.fields, { calendars: [{ _key: 'a', id: 'team', name: 'Team', show: true, legacy: 'x' }] });
  const now = JSON.parse(JSON.stringify(base));
  now.calendars[0].name = 'Team calendar';
  now.calendars.push(newItem(calendars.members[0]));
  const sent = changesOf(settings.fields, base, now).set.calendars;
  assert.deepEqual(sent[0], { _key: 'a', id: 'team', name: 'Team calendar', show: true });
  assert.equal(sent[1].show, true);
  assert.match(sent[1]._key, /^[0-9a-f]{12}$/);
  assert.equal(itemLabel(calendars, sent[0], 0), 'Team calendar');
  assert.equal(itemLabel(calendars, { _key: 'z' }, 1), 'Item 2');
  assert.deepEqual(move([1, 2, 3], 0, 1), [2, 1, 3]);
  assert.deepEqual(move([1, 2, 3], 0, -1), [1, 2, 3]);
});

check('search matches title, description and section words, in any order, inside groups too', () => {
  assert.ok(searchFields(settings, 'glint').some(one => one.name === 'glint'));
  assert.ok(searchFields(settings, 'night mode').some(one => one.name === 'nightEnabled'));
  assert.ok(searchFields(settings, 'seconds between glitches').some(one => one.name === 'crt'));
  assert.ok(fieldMatches(field(settings, 'glint'), 'SPARK'));
  assert.ok(!fieldMatches(field(settings, 'glint'), 'glint banana'));
  assert.equal(searchFields(settings, '').length, settings.fields.length);
  assert.ok(searchOthers(spec, 'dashboardSettings', 'mirror').some(other => other.type === 'team'));
});

check('onlyFor and showWhen decide what is on the page', () => {
  const views = spec.documents.filter(doc => doc.type === 'view')[0];
  assert.equal(visible(field(views, 'team'), {}, 'view-prime'), true);
  assert.equal(visible(field(views, 'team'), {}, 'view-general'), false);
  const rule = field(spec.documents.filter(doc => doc.type === 'theme')[0], 'schedule').members[0].fields.filter(one => one.name === 'theme')[0];
  assert.equal(visible(rule, { kind: 'theme' }, 'theme'), true);
  assert.equal(visible(rule, { kind: 'overlay' }, 'theme'), false);
});

check('paths, and date boxes in the time zone of the browser', () => {
  const root = { crt: { on: true }, calendars: [{ name: 'a' }] };
  assert.equal(getAt(root, 'calendars[0].name'), 'a');
  setAt(root, 'crt.everySeconds', 5);
  setAt(root, 'calendars[0].name', 'b');
  setAt(root, 'crt.on', undefined);
  assert.deepEqual(root, { crt: { everySeconds: 5 }, calendars: [{ name: 'b' }] });
  assert.equal(fromLocalBox(toLocalBox('2027-01-09T17:00:00.000Z')), '2027-01-09T17:00:00.000Z');
  assert.equal(toLocalBox(''), '');
});

check('limits are said in plain words, the same way for the page and the server', () => {
  const seconds = field(settings, 'pageSeconds');
  assert.equal(problemWith(seconds, 5), 'Use a whole number from 8 to 120.');
  assert.equal(problemWith(seconds, 20), '');
  assert.match(problemWith(seconds, undefined), /Enter the number of seconds/);
  assert.match(problemWith(field(team, 'name'), 'X'.repeat(21)), /Too long/);
  assert.equal(problemWith(field(settings, 'countdown').fields[0], 'X'.repeat(30), {}, 'warning'), 'Long titles wrap to two lines on the screen.');
  assert.match(problemWith(field(settings, 'crt').fields[1], 10, {}), /30 or more/);
  assert.deepEqual(problemsIn(settings.fields, { crt: { durationSeconds: 99 } }).map(item => item.path), ['crt.durationSeconds']);
  assert.deepEqual(problemsIn(settings.fields, { pageSeconds: 20 }), []);
  assert.equal(problemsIn(settings.fields, { calendars: [{ id: 'team', name: 'A', show: true }, { id: 'team', name: '', show: true }] })[0].path, 'calendars[1].name');
});

console.log(passed + ' of ' + passed + ' passed');
