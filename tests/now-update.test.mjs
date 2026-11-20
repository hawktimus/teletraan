// The Update button is on Now as well as in Update: the same card (github-card.js), which asks before it runs and sends
// confirmed: true. The page is not drawn here (no browser), so this reads the code. docs/audit.md, Part E.
//
//   node tests/now-update.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';

const root = fileURLToPath(new URL('../control/static/', import.meta.url));
const read = name => fs.readFileSync(root + name, 'utf8');

test('Now mounts the GitHub update card with the step names of Update, after the three buttons', () => {
  const now = read('areas/now.js');
  assert.ok(now.includes("import { githubCard } from '../github-card.js';") && now.includes("import { stepNames } from '../tabs/settings-update.js';"));
  assert.ok(now.indexOf("[sync, refresh, restart].forEach") < now.indexOf('githubCard(stepNames'), 'the card comes after the primary buttons');
  assert.ok(read('tabs/settings-update.js').includes('export const stepNames = {'));
});

test('the card asks before it runs and says it was confirmed, and every file still reads', () => {
  const card = read('github-card.js');
  assert.ok(card.includes('confirmAction(') && card.includes('confirmed: true'));
  ['areas/now.js', 'github-card.js', 'tabs/settings-update.js'].forEach(file => {
    const result = spawnSync(process.execPath, ['--check', root + file], { encoding: 'utf8' });
    assert.equal(result.status, 0, file + ': ' + result.stderr);
  });
});

finish();
