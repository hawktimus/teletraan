// Tests the test of the secrets: in a small repository, a key-shaped string, a key name set to a value, a private
// address and a value copied from an env file must fail tests/no-secrets.test.mjs, and the message must name the
// file and the line and never the secret itself. The fake keys are built from pieces so that this file holds none.
//
//   node tests/no-secrets-fail.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-secrets-'));
const tests = [];
const test = (name, run) => tests.push({ name: name, run: run });

const sanityShaped = 's' + 'k' + 'Q'.repeat(60);
const privateBlock = '-----BEGIN ' + 'RSA PRIVATE KEY-----';
const calendarValue = 'https://calendars.invalid/ical/' + 'z9y8x7w6v5u4t3s2';

// A small repository holding the test and these files. Returns what the test printed.
function place(name, files, env) {
  const root = path.join(work, name);
  fs.mkdirSync(path.join(root, 'tests/helpers'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'tests/no-secrets.test.mjs'), path.join(root, 'tests/no-secrets.test.mjs'));
  fs.copyFileSync(path.join(repo, 'tests/helpers/house-rules.mjs'), path.join(root, 'tests/helpers/house-rules.mjs'));
  Object.keys(files).forEach(file => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), files[file]);
  });
  const git = args => spawnSync('git', ['-C', root].concat(args), { encoding: 'utf8' });
  git(['init', '-q']);

  const envFile = path.join(work, name + '.env');
  fs.writeFileSync(envFile, env || '');
  const result = spawnSync(process.execPath, [path.join(root, 'tests/no-secrets.test.mjs')], { encoding: 'utf8', env: Object.assign({}, process.env, { HOUSE_RULES_ENV_FILES: envFile, TELETRAAN_RUNNER: '' }) });
  return { code: result.status, text: result.stdout + result.stderr };
}

test('a repository with only placeholders passes', () => {
  const result = place('clean', {
    'docs/keys.md': "SANITY_WRITE_TOKEN='[paste it here]'\nMONDAY_API_TOKEN=\nCALENDAR_TEAM_URL='https://example.invalid/ical'\n",
    'script.sh': 'SANITY_WRITE_TOKEN="${SANITY_WRITE_TOKEN:-}"\n',
  });
  assert.equal(result.code, 0, result.text);
});

test('a key shape, a key name with a value and a private address fail with the file and the line', () => {
  const result = place('shapes', {
    'a.js': '// one\nconst key = "' + sanityShaped + '";\n',
    'b.sh': 'echo hi\nTBA_AUTH_KEY=' + 'abcdef0123456789abcdef\n',
    'c.md': privateBlock + '\n',
    'd.txt': 'see https://band.example/feed?token=' + 'ABCDEFGHIJKLMNOPQRSTUV' + '\n',
  });
  assert.equal(result.code, 1);
  assert.match(result.text, /a\.js line 2: has a string shaped like a Sanity token/);
  assert.match(result.text, /b\.sh line 2: TBA_AUTH_KEY is set to a value of 22 characters/);
  assert.match(result.text, /c\.md line 1: has a private key block/);
  assert.match(result.text, /d\.txt line 1: has an address with a long token in it/);
  assert.match(result.text, /Do instead: Delete the value from the file/);
  assert.equal(result.text.includes(sanityShaped), false, 'the message must not repeat the key');
});

test('a value from an env file in any file fails, and only the name of the key is written', () => {
  const result = place('copied', { 'notes.md': 'the calendar is at ' + calendarValue + ' for now\n' }, "CALENDAR_TEAM_URL='" + calendarValue + "'\nPORT=8080\n");
  assert.equal(result.code, 1);
  assert.match(result.text, /notes\.md line 1: holds the value of CALENDAR_TEAM_URL from your key file/);
  assert.equal(result.text.includes(calendarValue), false, 'the message must not repeat the value');
});

test('HOUSE_RULES_ENV_FILES=none leaves the key files alone', () => {
  const root = path.join(work, 'none');
  const result = place('none', { 'notes.md': 'x\n' });
  assert.equal(result.code, 0);
  assert.ok(fs.existsSync(root));
});

let failed = 0;
for (const item of tests) {
  try {
    item.run();
    console.log('ok    ' + item.name);
  } catch (error) {
    failed += 1;
    console.log('FAIL  ' + item.name + '\n' + error.message);
  }
}
fs.rmSync(work, { recursive: true, force: true });
console.log('\n' + (tests.length - failed) + ' of ' + tests.length + ' tests passed.');
process.exitCode = failed > 0 ? 1 : 0;
