// Every panel the dashboard registry can play must be explained in the Studio: offered in the Rotation board's pickers, listed
// as an automatic panel (studio/tools/rotation-auto.js) or named as an old or internal panel with a reason
// (internalPanels in studio/tools/rotation-titles.js). A panel added to dashboard/registry.js alone fails here with its id.
//
//   node tests/rotation-panels-explained.test.mjs

import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { root, rotationWorld } from './helpers/rotation-world.mjs';

const world = await rotationWorld();
const { titles, auto } = world;
const registry = await import(pathToFileURL(path.join(root, 'dashboard', 'registry.js')).href);

const offered = titles.panelChoices.map(item => item.value).concat(titles.sideChoices.map(item => item.value));
const explained = auto.explainedIds();
const internal = titles.internalPanels.map(item => item.id);

function whereIs(id) {
  return [offered.indexOf(id) !== -1 ? 'picker' : '', explained.indexOf(id) !== -1 ? 'automatic' : '', internal.indexOf(id) !== -1 ? 'internal' : ''].filter(Boolean);
}

test('every registered panel is offered, explained as automatic, or named as old or internal', () => {
  const missing = registry.panels.map(panel => panel.id).filter(id => whereIs(id).length === 0);
  assert.deepEqual(missing, [], 'Not explained in the Studio: ' + missing.join(', ') + '. Offer it in studio/inputs/screen-panels.js, list it in studio/tools/rotation-auto.js or add it to internalPanels in studio/tools/rotation-titles.js.');
});

test('a panel is explained in one place only', () => {
  registry.panels.forEach(panel => {
    const places = whereIs(panel.id);
    assert.ok(places.length <= 1, panel.id + ' is in ' + places.join(' and '));
  });
});

test('the lists name only registered panels, and every internal panel has a reason', () => {
  const ids = registry.panels.map(panel => panel.id);
  explained.concat(internal, offered).forEach(id => assert.ok(ids.indexOf(id) !== -1, id + ' is not in dashboard/registry.js'));
  titles.internalPanels.forEach(item => assert.ok(typeof item.reason === 'string' && item.reason.length > 20, item.id + ' needs a reason'));
  assert.equal(new Set(internal).size, internal.length);
});

test('the old and test panels are the ones the registry marks', () => {
  const marked = registry.panels.filter(panel => panel.older || panel.testOnly).map(panel => panel.id).sort();
  assert.deepEqual(internal.slice().sort(), marked);
});

test('the explanation fails with the id of a panel that nobody explained', () => {
  const extra = 'brand-new-panel';
  assert.deepEqual([extra].filter(id => whereIs(id).length === 0), [extra]);
});

await finish();
