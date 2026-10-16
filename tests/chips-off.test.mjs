// A team's name is in the banner once on a page: the headers of the panels draw no team chip and their titles do not repeat
// the team (docs/views.md). The code that draws the chip is kept, and the other tests turn it on to test it.
//
//   node tests/chips-off.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-chips-'));
fs.mkdirSync(path.join(work, 'dashboard/core'), { recursive: true });
fs.writeFileSync(path.join(work, 'package.json'), '{ "type": "module" }\n');
copyModule(path.join(dashboardFolder, 'core/team-title.js'), path.join(work, 'dashboard/core/team-title.js'));
const title = await import(pathToFileURL(path.join(work, 'dashboard/core/team-title.js')).href);

try {
  assert.equal(title.teamChipMarkup('PRIME'), '');
  assert.equal(title.chipWidth('PRIME'), 0);
  assert.equal(title.chipShown('PRIME'), '');
  globalThis.teletraanTeamChips = true;
  assert.ok(title.teamChipMarkup('PRIME').includes('team-chip'));
  assert.ok(title.chipWidth('PRIME') > 0);
  console.log('ok    the team chip is off on the screen and its drawing is kept');
  console.log('\n1 of 1 passed');
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
