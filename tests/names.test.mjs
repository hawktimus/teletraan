// Tests for dashboard/core/names.js, the map from the old words to the new ones.
//
//   node tests/names.test.mjs

import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const names = await import(pathToFileURL(fileURLToPath(new URL('../dashboard/core/names.js', import.meta.url))).href);
const config = await import(pathToFileURL(fileURLToPath(new URL('../dashboard/config.js', import.meta.url))).href);

let passed = 0;
function test(name, run) {
  try { run(); passed += 1; console.log('ok    ' + name); } catch (error) { console.log('FAIL  ' + name + '\n' + error.stack); process.exitCode = 1; }
}

test('a screen and a pass are a view, and a style and a look are a theme', () => {
  assert.equal(names.wordFor('screen'), 'view');
  assert.equal(names.wordFor('pass'), 'view');
  assert.equal(names.wordFor('style'), 'theme');
  assert.equal(names.wordFor('look'), 'theme');
});

test('a word that is not in the map comes back as it is', () => {
  assert.equal(names.wordFor('view'), 'view');
  assert.equal(names.wordFor('toString'), 'toString', 'a word of Object is not a word of the map');
});

test('the stored names stay: the old settings and the theme ids are still in the config', () => {
  assert.ok('style' in config.defaultSettings && 'look' in config.defaultSettings);
  assert.deepEqual(config.themeIds, ['original', 'cybertron', 'retro', 'foundry']);
});

console.log('\n' + passed + ' passed');
