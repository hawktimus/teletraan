// Tests for tools/monday-screens.mjs and computer/make/monday.mk: the plan of the pictures of the Monday panels, their names, and the
// make target that takes them. Nothing is drawn: the pictures need Playwright, which is not here (tools/package.json).
//
//   node tests/monday-screens.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const tool = await import(pathToFileURL(path.join(repo, 'tools/monday-screens.mjs')).href);
const registry = await import(pathToFileURL(path.join(repo, 'dashboard/registry.js')).href);

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

test('every picture has a plain name, a panel of the registry and a state, and no name comes twice', () => {
  const shots = tool.planMondayShots();
  const names = shots.map(shot => shot.name);
  assert.equal(new Set(names).size, names.length);
  assert.equal(shots.length, 38);
  const ids = registry.panels.map(panel => panel.id);
  shots.forEach(shot => {
    assert.match(shot.name, /^monday-(department|projects|charts-(status|progress|timeline))-(full|half|empty|none-done)-(original|cybertron|retro|foundry)-(condensed|prime|nova)$/, shot.name);
    const panel = new URLSearchParams(shot.url.split('?')[1]).get('panel');
    assert.ok(ids.includes(panel), shot.name + ' draws ' + panel);
    assert.ok(shot.url.includes('sample=1') && shot.url.includes('still=1'), 'the sample content, held still');
  });
});

test('Department tasks has the three states in every theme in the Condensed view, and Projects plays in the Condensed view only', () => {
  const names = tool.planMondayShots().map(shot => shot.name);
  tool.themes.forEach(theme => tool.fills.forEach(fill => assert.ok(names.includes('monday-department-' + fill + '-' + theme + '-condensed'), fill + ' ' + theme)));
  ['prime', 'nova'].forEach(view => tool.fills.forEach(fill => assert.ok(names.includes('monday-department-' + fill + '-original-' + view), fill + ' ' + view)));
  assert.deepEqual(names.filter(name => name.startsWith('monday-projects-') && !name.endsWith('-condensed')), []);
  tool.themes.forEach(theme => assert.ok(names.includes('monday-projects-full-' + theme + '-condensed'), theme));
  assert.ok(names.includes('monday-projects-half-original-condensed') && names.includes('monday-projects-empty-original-condensed'));
});

test('a fill has the tasks it says: many, a few and none, with a late task and a stuck one in the full page', () => {
  const shots = tool.planMondayShots();
  const sizeOf = name => shots.find(shot => shot.name === name).tasks.filter(task => task.list === 'open').length;
  assert.equal(sizeOf('monday-department-full-original-condensed'), 16);
  assert.equal(sizeOf('monday-department-half-original-condensed'), 3);
  assert.equal(sizeOf('monday-department-empty-original-condensed'), 0);
  const full = shots.find(shot => shot.name === 'monday-department-full-original-condensed').tasks;
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  assert.ok(full.some(task => task.status === 'blocked' && task.note), 'a stuck task with a note');
  assert.ok(full.some(task => task.status === 'in-progress' && task.dueDate && task.dueDate < today), 'a late task, counted from the day of the picture');
  full.forEach(task => assert.match(task.title, /^\[.*\]$/, 'a made-up task is a placeholder in brackets'));
});

test('make monday-screens runs the tool, and the fragment is in computer/make for the root Makefile to include', () => {
  const fragment = fs.readFileSync(path.join(repo, 'computer/make/monday.mk'), 'utf8');
  assert.ok(/^\.PHONY: monday-screens$/m.test(fragment) && /^monday-screens:\n\tnode tools\/monday-screens\.mjs$/m.test(fragment));
  assert.equal(fs.existsSync(path.join(repo, 'Makefile')) && /monday/.test(fs.readFileSync(path.join(repo, 'Makefile'), 'utf8')), false, 'this fragment does not make a root Makefile');
});

test('the pictures in docs/reference are the planned ones, and the doc says how to take them again', () => {
  const found = fs.readdirSync(path.join(repo, 'docs/reference')).filter(name => name.startsWith('monday-') && name.endsWith('.png')).sort();
  assert.deepEqual(found, tool.planMondayShots().map(shot => shot.name + '.png').sort());
  const doc = fs.readFileSync(path.join(repo, 'docs/monday.md'), 'utf8');
  assert.ok(doc.includes('make monday-screens') && doc.includes('docs/reference/'));
});

let failures = 0;
for (const entry of tests) {
  try {
    await entry.run();
    console.log('ok    ' + entry.name);
  } catch (error) {
    failures += 1;
    console.log('FAIL  ' + entry.name);
    console.log(error);
  }
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
