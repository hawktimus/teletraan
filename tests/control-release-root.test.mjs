// The control service reads dashboard/config.js and dashboard/registry.js from the live release, not from the
// folder that holds releases and local.env. With the wrong folder the Now showing choices came back empty.
//
//   node tests/control-release-root.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, finish } from './helpers/runner.mjs';
import { createService, readConfig } from '../control/server.js';

function makeRoot(withCurrent) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-root-'));
  if (withCurrent) {
    fs.mkdirSync(path.join(root, 'current', 'dashboard'), { recursive: true });
    fs.writeFileSync(path.join(root, 'current', 'dashboard', 'config.js'), "export const config = { projectId: 'abc123', dataset: 'production', apiVersion: '2025-02-19' };\n");
  }
  return root;
}

async function ctxFor(root) {
  const config = readConfig({ CONTROL_ROOT: root, CONTROL_DATA: path.join(root, 'data') });
  return (await createService(config)).ctx;
}

test('with a live release, ctx.root is its folder and rootDir stays the parent', async () => {
  const root = makeRoot(true);
  const ctx = await ctxFor(root);
  assert.equal(ctx.root, path.join(root, 'current'));
  assert.equal(ctx.rootDir, root);
});

test('without a live release, ctx.root is the folder the service runs from, which has dashboard/', async () => {
  const ctx = await ctxFor(makeRoot(false));
  assert.ok(fs.existsSync(path.join(ctx.root, 'dashboard', 'config.js')));
});

finish();
