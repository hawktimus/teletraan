// Tests that the frames of Retro and Foundry fade away with the content in a hidden transition
// (dashboard/core/hidden-pile.js, findContent). They are drawn by theme-art.js as a div beside the plates, so
// without this they stayed over the blue screen and the red eyes. Nothing is drawn.
//
//   node tests/hidden-theme-art.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-hidden-art-'));
fs.mkdirSync(path.join(workFolder, 'dashboard/core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
copyModule(path.join(dashboardFolder, 'core/hidden-pile.js'), path.join(workFolder, 'dashboard/core/hidden-pile.js'));
fs.writeFileSync(path.join(workFolder, 'dashboard/frame.js'), 'export const enter = () => {};\nexport const pace = () => 1;\n');
const { findContent } = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/hidden-pile.js')).href);

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

function element(name, dataset = {}) {
  return { name: name, dataset: dataset, children: [], matches: () => false };
}

// A stage that answers the four searches findContent makes
function stageWith(lists) {
  return { querySelectorAll: selector => lists[selector] || [] };
}

test('the art of an area is content, so it fades away and comes back with the page', () => {
  const art = element('art');
  const host = element('host');
  const content = findContent(stageWith({ '.page-host': [host], '.area > .theme-art': [art] }), []);

  assert.ok(content.includes(art));
  assert.ok(content.includes(host));
});

test('an art that is already marked as pieces is metal and stays out', () => {
  const art = element('art', { pile: 'pieces' });
  assert.equal(findContent(stageWith({ '.area > .theme-art': [art] }), []).length, 0);
});

test('a page with no theme art has the same content as before', () => {
  const host = element('host');
  assert.deepEqual(findContent(stageWith({ '.page-host': [host] }), []), [host]);
});

test('hidden-pile.js asks for the art of an area and not for every theme-art', () => {
  const text = fs.readFileSync(path.join(dashboardFolder, 'core/hidden-pile.js'), 'utf8');
  assert.ok(text.includes("'.area > .theme-art'"), 'the banner keeps its art in its own panel, which is content already');
});

let failed = 0;
for (const { name, run } of tests) {
  try {
    await run();
    console.log('ok   ' + name);
  } catch (error) {
    failed++;
    console.log('FAIL ' + name + '\n' + error.message);
  }
}
fs.rmSync(workFolder, { recursive: true, force: true });
console.log(tests.length - failed + ' of ' + tests.length + ' passed');
process.exit(failed === 0 ? 0 : 1);
