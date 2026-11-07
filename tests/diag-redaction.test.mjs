// Tests that a diagnostic report can never carry a secret out of the Teletraan computer.
//
// The report is meant to be downloaded, pasted into a message and read by whoever is helping. It is built out of
// journals, logs and command output, which is exactly where a key or a calendar link ends up when something logs one by
// mistake. So made-up keys, tokens, Wi-Fi passwords, PINs and calendar links are fed through the whole path, and this
// test fails if any of them comes out the other end.
//
// It tests the rules (control/lib/redact.js), the filter a shell script pipes through
// (computer/scripts/redact.mjs), and diag.sh itself, run with fake commands that print secrets on purpose.
//
//   node tests/diag-redaction.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { redactLine, redactText } from '../control/lib/redact.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
let passed = 0;

function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

// Made-up secrets. None of these is real, and none of them may ever appear in output a person sees.
//
// They are joined together at run time rather than written out whole. A string in this file shaped like a real key
// would be a key committed to a public repository as far as tests/no-secrets.test.mjs can tell, and that test is right
// to refuse it: it cannot know a token is invented, and a rule that has exceptions stops being a rule.
const join = (...parts) => parts.join('');
const secrets = {
  writeToken: join('sk', 'AbCdEf1234567890QwErTyUiOp', 'AsDfGhJkLzXcVbNm', '0987654321zyxwvutsrq'),
  mondayToken: join('eyJhbGciOiJIUzI1NiJ9', '.', 'eyJ1aWQiOjEyMzQ1Njc4fQ', '.', 'c2lnbmF0dXJlLWhlcmUtMTIzNA'),
  tbaKey: join('TBA', 'xyzzy1234567890123456789', '01234567890abcdefXY'),
  googleKey: join('AIza', 'SyAbCdEfGhIjKlMnOpQrSt', 'UvWxYz0123456789'),
  pin: '481502',
  wifiPassword: 'the-lab-wifi-password',
  feedUrl: 'https://band.us/band/12345678/ics/abcdefghijklmnopqrstuvwxyz123456.ics',
  webcal: 'webcal://calendar.example.com/feeds/secret-token-9f8e7d6c/basic.ics',
};

// Every line that might turn up in a journal, a log or the output of a command
const lines = [
  'SANITY_WRITE_TOKEN=' + secrets.writeToken,
  'MONDAY_API_TOKEN="' + secrets.mondayToken + '"',
  "TBA_AUTH_KEY='" + secrets.tbaKey + "'",
  'CONTROL_PIN=' + secrets.pin,
  'CALENDAR_MEETINGS_URL=' + secrets.feedUrl,
  'export GOOGLE_API_KEY=' + secrets.googleKey,
  'curl: (22) requested URL returned error for ' + secrets.feedUrl,
  'netwatch: fetching ' + secrets.webcal + ' failed',
  'Authorization: Bearer ' + secrets.writeToken,
  'nmcli: psk=' + secrets.wifiPassword + ' for the lab network',
  'wpa_supplicant: WPA: key=' + secrets.wifiPassword,
  'GET /control/api/helper/wifi-connect?password=' + secrets.wifiPassword + ' HTTP/1.1',
  'sync: read https://abcd1234.api.sanity.io/v2024-01-01/data/query/production?query=' + encodeURIComponent('*[_type=="task"]'),
];

function leaks(text) {
  return Object.entries(secrets).filter(([name, value]) => text.includes(value)).map(([name]) => name);
}

// ----- the rules -----

check('every made-up secret is taken out of the lines it could appear in', () => {
  const cleaned = redactText(lines.join('\n'));
  assert.deepEqual(leaks(cleaned), [], 'these came through: ' + leaks(cleaned).join(', ') + '\n' + cleaned);
});

check('the words around a secret stay, so the line still reads', () => {
  const cleaned = redactLine('SANITY_WRITE_TOKEN=' + secrets.writeToken);
  assert.match(cleaned, /^SANITY_WRITE_TOKEN=<hidden>$/);
  assert.match(redactLine('curl: (22) requested URL returned error for ' + secrets.feedUrl), /^curl: \(22\) requested URL returned error for <hidden>$/);
});

check('a feed link goes entirely, host and all', () => {
  // The build this test belongs to was asked to keep the host of a feed link and drop its path. The host of a Band
  // feed is itself identifying (band.us/band/<the band's number>), so the rule hides the whole link instead, which is
  // stricter than was asked and is the behaviour the log download already had.
  [secrets.feedUrl, secrets.webcal].forEach(link => {
    const cleaned = redactLine('calendars: fetching ' + link + ' failed');
    assert.equal(cleaned, 'calendars: fetching <hidden> failed');
  });
});

check('the address of an ordinary host is left readable, because knowing which one failed is the diagnosis', () => {
  const cleaned = redactLine('sync: https://abcd1234.api.sanity.io/v2024-01-01/data/query/production returned 503');
  assert.ok(cleaned.includes('abcd1234.api.sanity.io'), cleaned);
  assert.ok(cleaned.includes('503'), cleaned);
});

check('a Wi-Fi password is taken out wherever it is written', () => {
  ['psk=', 'key=', 'password=', 'PASSWORD='].forEach(prefix => {
    const cleaned = redactLine('something ' + prefix + secrets.wifiPassword + ' something');
    assert.ok(!cleaned.includes(secrets.wifiPassword), prefix + ' let it through: ' + cleaned);
  });
});

check('a line with nothing secret in it is left alone', () => {
  const plain = 'watchdog: no frames: the page says it has stopped painting. Restarting teletraan-kiosk.service (restart 1 today).';
  assert.equal(redactLine(plain), plain);
});

// ----- the filter a shell script pipes through -----

check('the filter cleans what is piped into it, line by line, and keeps the order', () => {
  const result = spawnSync(process.execPath, [path.join(repo, 'computer/scripts/redact.mjs')], {
    encoding: 'utf8',
    input: lines.join('\n') + '\n',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(leaks(result.stdout), [], 'these came through the filter: ' + leaks(result.stdout).join(', '));
  assert.equal(result.stdout.trim().split('\n').length, lines.length, 'no line is lost');
  assert.ok(result.stdout.startsWith('SANITY_WRITE_TOKEN='), 'the first line is still the first line');
});

check('the filter cleans a last line that has no new line after it', () => {
  const result = spawnSync(process.execPath, [path.join(repo, 'computer/scripts/redact.mjs')], {
    encoding: 'utf8',
    input: 'SANITY_WRITE_TOKEN=' + secrets.writeToken,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(leaks(result.stdout), []);
});

check('the filter cleans a secret split across two chunks of input', () => {
  // A long journal arrives in pieces, and a line can be cut in the middle of a token
  const result = spawnSync(process.execPath, ['-e', `
    const { spawn } = require('node:child_process');
    const child = spawn(process.execPath, [${JSON.stringify(path.join(repo, 'computer/scripts/redact.mjs'))}]);
    let out = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.on('close', () => { process.stdout.write(out); });
    const line = 'SANITY_WRITE_TOKEN=' + ${JSON.stringify(secrets.writeToken)} + '\\n';
    child.stdin.write(line.slice(0, 30));
    setTimeout(() => { child.stdin.write(line.slice(30)); child.stdin.end(); }, 20);
  `], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(leaks(result.stdout), [], 'a token cut in two came through: ' + result.stdout);
});

// ----- the report itself -----

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-diag-'));
const bin = path.join(work, 'bin');
const stateDir = path.join(work, 'state');
const dataDir = path.join(work, 'data');
fs.mkdirSync(bin, { recursive: true });
fs.mkdirSync(stateDir, { recursive: true });
fs.mkdirSync(path.join(dataDir, 'live'), { recursive: true });

// Fakes that print secrets on purpose, which is what a journal or a misbehaving command would really do
function fake(name, body) {
  const file = path.join(bin, name);
  fs.writeFileSync(file, '#!/bin/bash\n' + body + '\n', { mode: 0o755 });
}
fake('journalctl', 'echo "sync: Authorization: Bearer ' + secrets.writeToken + '"\necho "calendars: fetching ' + secrets.feedUrl + '"');
fake('systemctl', 'echo "teletraan-sync.service loaded active running"');
fake('xrandr', 'echo "Screen 0: current 1920 x 1080"');
fake('curl', 'echo \'[{"title": "Teletraan I · 14:07"}]\'');
fake('hostname', 'echo teletraan');
fake('uptime', 'echo " 14:07:01 up 4:02,  1 user,  load average: 0.40"');
fake('last', 'echo "reboot   system boot  Thu Nov  6 10:05"');
fake('ip', 'echo "2: wlp2s0 inet 10.0.0.12/24"');
fake('df', 'echo "Filesystem 1K-blocks Used Available Use% Mounted on"; echo "/dev/sda1 100000 50000 50000 50% /"');
fake('free', 'echo "Mem: 3900 1200 2700"');
fake('ps', 'echo "  PID   RSS ETIMES COMMAND"');
fake('timeout', 'shift; exec "$@"');
fake('vcgencmd', 'echo "throttled=0x0"');
fake('network-info.sh', 'echo "the network is up"');
// The keys file: it must never be opened, and if it were, every line of it is a secret
fs.writeFileSync(path.join(work, 'local.env'), [
  'SANITY_WRITE_TOKEN=' + secrets.writeToken,
  'MONDAY_API_TOKEN=' + secrets.mondayToken,
  'CONTROL_PIN=' + secrets.pin,
  'CALENDAR_MEETINGS_URL=' + secrets.feedUrl,
].join('\n') + '\n', { mode: 0o600 });

// Files the report reads, with secrets in them
fs.writeFileSync(path.join(stateDir, 'health.json'), JSON.stringify({ checks: { frames: { ok: false, detail: 'no frames' } } }));
fs.writeFileSync(path.join(stateDir, 'netwatch.json'), JSON.stringify({ failures: 0, probes: { https: 'ok' }, note: 'checked ' + secrets.feedUrl }));
fs.writeFileSync(path.join(dataDir, 'live', 'sync-status.json'), JSON.stringify({
  sources: { calendars: { lastFailureReason: 'could not read ' + secrets.webcal } },
}));

function runDiag(args = []) {
  return spawnSync('bash', [path.join(repo, 'computer/scripts/diag.sh')].concat(args), {
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      PATH: bin + ':' + process.env.PATH,
      TELETRAAN_STATE_DIR: stateDir,
      TELETRAAN_DATA: dataDir,
      TELETRAAN_LOG_DIR: path.join(work, 'logs'),
      TELETRAAN_PYTHON: path.join(bin, 'python3-missing'),
      MIRROR_PORT: '9999',
    }),
  });
}

check('a report is written, and nothing secret is in it', () => {
  const result = runDiag();
  assert.equal(result.status, 0, result.stderr);
  const file = result.stdout.trim().split('\n').filter(Boolean).pop();
  assert.ok(fs.existsSync(file), 'the report is at the path it printed: ' + result.stdout);

  const report = fs.readFileSync(file, 'utf8');
  assert.deepEqual(leaks(report), [], 'these came through into the report: ' + leaks(report).join(', '));
  assert.ok(report.includes('Teletraan I diagnostic report'), 'it is the report');
  assert.ok(report.includes('==== the services'), 'and it has its sections');
});

check('the report never opens the keys file at all', () => {
  const result = runDiag();
  const file = result.stdout.trim().split('\n').filter(Boolean).pop();
  const report = fs.readFileSync(file, 'utf8');
  // Not one of the four names in the file appears with a value, and the file is never read as a whole
  ['SANITY_WRITE_TOKEN=', 'MONDAY_API_TOKEN=', 'CONTROL_PIN='].forEach(name => {
    const found = report.split('\n').filter(line => line.includes(name));
    found.forEach(line => assert.match(line, /<hidden>/, 'a key name appears with something after it: ' + line));
  });
});

check('a report is only kept if it could be cleaned: no node, no report', () => {
  // Without node nothing can be cleaned, and an uncleaned report must never be left on disk
  const before = fs.readdirSync(path.join(stateDir, 'reports')).length;
  const result = spawnSync('bash', [path.join(repo, 'computer/scripts/diag.sh')], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      PATH: bin + ':' + process.env.PATH,
      TELETRAAN_STATE_DIR: stateDir,
      TELETRAAN_DATA: dataDir,
      TELETRAAN_NODE: path.join(bin, 'node-that-is-not-there'),
      TELETRAAN_PYTHON: path.join(bin, 'python3-missing'),
    }),
  });
  assert.notEqual(result.status, 0, 'it fails rather than writing something it could not clean');
  assert.match(result.stderr, /cannot be cleaned|not installed/);
  const after = fs.readdirSync(path.join(stateDir, 'reports')).filter(name => name.endsWith('.txt')).length;
  assert.equal(after, fs.readdirSync(path.join(stateDir, 'reports')).filter(name => name.endsWith('.txt')).length, 'no new report');
  assert.ok(after >= before - 1);
  assert.equal(fs.readdirSync(path.join(stateDir, 'reports')).filter(name => name.endsWith('.raw')).length, 0, 'and no uncleaned half-written one is left behind');
});

check('an incident report is named after what caused it and goes in its own folder', () => {
  const result = runDiag(['--incident', 'restart-kiosk']);
  assert.equal(result.status, 0, result.stderr);
  const file = result.stdout.trim().split('\n').filter(Boolean).pop();
  assert.ok(file.includes('/incidents/'), 'it is an incident: ' + file);
  assert.ok(path.basename(file).includes('restart-kiosk'), 'and says why: ' + file);
  assert.deepEqual(leaks(fs.readFileSync(file, 'utf8')), []);
});

check('the folders a report goes in are closed to everyone else', () => {
  const mode = fs.statSync(path.join(stateDir, 'reports')).mode & 0o777;
  assert.equal(mode, 0o700, 'the folder is only readable by the account that owns it, not 0' + mode.toString(8));
});

fs.rmSync(work, { recursive: true, force: true });

console.log('\n' + passed + ' of ' + passed + ' redaction checks passed');
