// Tests for the Match13 key: the Keys section of Settings, the Mac tool, the helper word, the status fields and the
// Sync Match13 now button. No test asks Match13 anything.
//
//   node tests/match13-keys.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { incomingLines, keyNames, labels, mask, mergeEnv } from '../control/support/keys.js';
import { redactLine as redact } from '../control/lib/redact.js';
import { words as helperWords } from '../control/routes/helper.js';
import { describe } from '../control/routes/env.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const fake = 'm13_live_FAKEFAKEFAKE0123456789';

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

test('the Keys section knows MATCH13_API_KEY, masks it, merges it and refuses a bad one', () => {
  assert.ok(keyNames.includes('MATCH13_API_KEY'));
  assert.equal(labels.MATCH13_API_KEY, 'Match13 key');
  assert.equal(mask(fake), 'm13_........');
  const { lines, changed } = incomingLines({ keys: { MATCH13_API_KEY: { action: 'set', value: fake } } });
  assert.deepEqual(lines, ["MATCH13_API_KEY='" + fake + "'"]);
  assert.deepEqual(changed, [{ name: 'MATCH13_API_KEY', did: 'set' }]);
  assert.ok(!JSON.stringify(changed).includes('FAKE'), 'the value is not in the report');
  assert.throws(() => incomingLines({ keys: { MATCH13_API_KEY: { action: 'set', value: 'has a space' } } }));
  assert.equal(mergeEnv('A=1\n', lines), "A=1\nMATCH13_API_KEY='" + fake + "'\n");
  const shown = describe({ MATCH13_API_KEY: fake }).keys.find(key => key.name === 'MATCH13_API_KEY');
  assert.equal(shown.masked, 'm13_........');
  assert.ok(!JSON.stringify(describe({ MATCH13_API_KEY: fake })).includes('FAKEFAKE'));
});

test('the log redaction hides the Match13 key', () => {
  const text = redact('write-env MATCH13_API_KEY=' + fake + ' done');
  assert.ok(!text.includes('FAKEFAKE'), text);
});

test('merge-env.sh on the Mac takes MATCH13_API_KEY and still refuses other names', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-m13-merge-'));
  try {
    const env = path.join(folder, 'local.env');
    fs.writeFileSync(env, "TBA_AUTH_KEY='one'\n");
    const incoming = path.join(folder, 'incoming');
    fs.writeFileSync(incoming, "MATCH13_API_KEY='" + fake + "'\n");
    const good = spawnSync('/bin/sh', [path.join(repo, 'tools/teletraan/merge-env.sh'), env, incoming], { encoding: 'utf8' });
    assert.equal(good.status, 0, good.stderr);
    assert.equal(fs.readFileSync(env, 'utf8'), "TBA_AUTH_KEY='one'\nMATCH13_API_KEY='" + fake + "'\n");
    assert.ok(!good.stdout.includes('FAKEFAKE'), 'the value is not printed');
    fs.writeFileSync(incoming, "MATCH14_API_KEY='x'\n");
    assert.equal(spawnSync('/bin/sh', [path.join(repo, 'tools/teletraan/merge-env.sh'), env, incoming], { encoding: 'utf8' }).status, 1);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test('the Mac tool lists the Match13 key in its form, its secrets file and its pull', () => {
  const tool = read('tools/teletraan/teletraan-tool');
  assert.ok(tool.includes('MATCH13_API_KEY'));
  assert.ok(tool.includes("'Match13 key'"));
  assert.ok(tool.includes('form_key_count=5'));
  assert.ok(tool.includes("key_values=('' '' '' '' '')"));
  assert.ok(tool.includes('key_states=(0 0 0 0 0)'));
  const secrets = read('tools/teletraan/teletraan-tool-secrets.sh');
  assert.ok(secrets.includes('TBA_AUTH_KEY|GOOGLE_API_KEY|MATCH13_API_KEY)'));
  assert.ok(secrets.includes("key_values=('' '' '' '' '')") && secrets.includes('key_states=(0 0 0 0 0)'));
  assert.ok(read('tools/teletraan/teletraan-tool-deploy.sh').includes('GOOGLE_API_KEY|MATCH13_API_KEY|CALENDAR'));
});

test('local.example.env has a commented Match13 line with a placeholder', () => {
  assert.ok(read('computer/local.example.env').includes("# MATCH13_API_KEY='[paste the Match13 key here]'"));
});

test('the helper word sync-now takes match13 in the route, the helper and the button', () => {
  assert.ok(helperWords.includes('sync-now'));
  assert.ok(read('control/routes/helper.js').includes("'match13']"));
  assert.ok(read('computer/scripts/control-helper.sh').includes('calendars|monday|frc|news|photos-drive|match13)'));
  assert.ok(read('control/static/tabs/health.js').includes("{ target: 'match13', label: 'Sync Match13 now' }"));
  assert.ok(read('control/static/tabs/render.js').includes("match13: 'Match13'"));
});

test('a new Match13 key runs the read once and a changed one does not break the save', () => {
  const route = read('control/routes/env.js');
  assert.ok(route.includes("item.name === 'MATCH13_API_KEY' && item.did === 'set'"));
  assert.ok(route.includes("ctx.helper('sync-now', ['match13'])"));
});

test('status-write.sh sends the Match13 time, state and count, and Studio and the control page show the time', () => {
  const script = read('computer/scripts/status-write.sh');
  ['match13)', 'match13At', 'match13State', 'match13Count', 'match13-status.json', "time_line match13At 'Last Match13 read'"].forEach(word => assert.ok(script.includes(word), word));
  ['match13At', 'match13State', 'match13Count'].forEach(name => assert.ok(read('studio/schemas/status.js').includes(name), name));
  assert.ok(read('studio/inputs/status-input.js').includes("{ field: 'match13At', label: 'Last Match13 read' }"));
  assert.ok(read('control/support/status-parts.js').includes('match13: text(mini.match13At)'));
  assert.ok(read('control/static/tabs/render.js').includes("row('Last Match13 read'"));
  assert.equal(spawnSync('bash', ['-n', path.join(repo, 'computer/scripts/status-write.sh')]).status, 0);
});

let failures = 0;
for (const entry of tests) {
  try {
    await entry.run();
    console.log('ok    ' + entry.name);
  } catch (error) {
    failures += 1;
    console.log('FAIL  ' + entry.name + '\n      ' + String(error && error.message).split('\n').join('\n      '));
  }
}
console.log(failures === 0 ? 'all ' + tests.length + ' passed' : failures + ' of ' + tests.length + ' failed');
process.exit(failures === 0 ? 0 : 1);
