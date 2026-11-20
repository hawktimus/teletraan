// The wait at the end of an update: the install is finished when the screen reports the new build. The screen's
// report is kept by routes/now.js as ctx.state.wallSeen = { report, received }; the wait must read that, with the
// real wait (not a stand-in), or every update rolls back although the screen came up.
//
//   node tests/control-wait-build.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, finish } from './helpers/runner.mjs';
import { createService } from '../control/server.js';

process.env.CONTROL_SKIP_STUDIO = '1';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-wait-'));

async function service() {
  const root = path.join(work, 'service' + Math.random().toString(16).slice(2));
  fs.mkdirSync(path.join(root, 'releases/1/dashboard'), { recursive: true });
  fs.mkdirSync(path.join(root, 'releases/1/computer'), { recursive: true });
  fs.writeFileSync(path.join(root, 'releases/1/RELEASE.json'), JSON.stringify({ version: 1, commit: '4e18836', date: '2026-10-15T20:00:00Z', from: 'github', note: 'Before', treeHash: '' }));
  fs.symlinkSync('releases/1', path.join(root, 'current'));
  fs.writeFileSync(path.join(root, 'local.env'), "CONTROL_PIN='424242'\n");
  const { ctx } = await createService({
    port: 0, host: '127.0.0.1', rootDir: root, releasesDir: path.join(root, 'releases'), dataDir: root, envFile: path.join(root, 'local.env'),
    secretFile: path.join(root, 'control-secret'), socket: path.join(root, 'none.sock'), logFile: path.join(root, 'logs/control.log'),
  }, { helper: async () => '' });
  return ctx;
}

test('the wait sees the build the screen reported', async () => {
  const ctx = await service();
  ctx.state.wallSeen = { report: { build: '36-b0c8cca' }, received: new Date() };
  assert.equal(await ctx.waitForBuild('36-b0c8cca', 1000), true);
});

test('the wait does not take another build for the new one', async () => {
  const ctx = await service();
  ctx.state.wallSeen = { report: { build: '34-ef64f66' }, received: new Date() };
  assert.equal(await ctx.waitForBuild('36-b0c8cca', 500), false);
});

test('the wait does not take a report that went quiet long ago', async () => {
  const ctx = await service();
  ctx.state.wallSeen = { report: { build: '36-b0c8cca' }, received: new Date(Date.now() - 5 * 60 * 1000) };
  assert.equal(await ctx.waitForBuild('36-b0c8cca', 500), false);
});

await finish();
setTimeout(() => process.exit(0), 100);
