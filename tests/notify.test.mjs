// Tests for computer/scripts/notify.sh (the push message) and computer/scripts/heartbeat.sh (the ping to the uptime monitor and
// the went-offline and came-back messages). curl is a fake that writes down what it was asked, so nothing touches the network.
// The addresses in the test are made up.
//
//   node tests/notify.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-notify-'));
const ordinary = ['sed', 'head', 'tail', 'grep', 'date', 'dirname', 'cat', 'awk', 'tr', 'mv', 'rm', 'cut', 'wc', 'mkdir', 'printf', 'jq', 'basename'];
let counter = 0;
let passed = 0;

function find(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

// A fake curl: every call goes to calls.log, the standard input (where the address goes) to last-stdin, the body to last-data
// and the header to last-header. The dashboard check is answered by dash.exit, everything else by curl.exit.
const fakeCurl = `#!/bin/sh
echo "curl $*" >> "$STUB_LOG"
previous=""
data=""
header=""
for argument in "$@"; do
  [ "$previous" = --data-binary ] && data=$argument
  [ "$previous" = --header ] && header=$argument
  previous=$argument
done
case "$*" in
  *127.0.0.1*) exit "$(cat "$STUB_DIR/dash.exit")" ;;
esac
case " $* " in *" --config - "*) cat > "$STUB_DIR/last-stdin" ;; esac
printf '%s' "$data" > "$STUB_DIR/last-data"
printf '%s' "$header" > "$STUB_DIR/last-header"
echo "sent" >> "$STUB_DIR/sent.log"
exit "$(cat "$STUB_DIR/curl.exit")"
`;

function setup(env = '') {
  counter += 1;
  const root = path.join(work, 'place' + counter);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const data = path.join(root, 'data');
  const scripts = path.join(root, 'computer/scripts');
  [bin, stub, data, scripts].forEach(folder => fs.mkdirSync(folder, { recursive: true }));
  ['lib.sh', 'notify.sh', 'heartbeat.sh'].forEach(name => fs.copyFileSync(path.join(repo, 'computer/scripts', name), path.join(scripts, name)));
  fs.writeFileSync(path.join(scripts, 'status-write.sh'), '#!/bin/sh\necho "status-write $*" >> "$STUB_LOG"\n', { mode: 0o755 });
  fs.writeFileSync(path.join(root, 'dashboard-config.js'), '');
  fs.writeFileSync(path.join(root, 'computer/local.env'), "TELETRAAN_DATA='" + data + "'\n" + env);
  ordinary.forEach(name => fs.symlinkSync(find(name), path.join(bin, name)));
  fs.writeFileSync(path.join(bin, 'curl'), fakeCurl, { mode: 0o755 });
  fs.writeFileSync(path.join(stub, 'curl.exit'), '0');
  fs.writeFileSync(path.join(stub, 'dash.exit'), '0');
  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');
  const logs = path.join(root, 'logs');
  const place = {
    root, stub, data, logs,
    calls: () => fs.readFileSync(log, 'utf8').split('\n').filter(Boolean),
    sent: () => (fs.existsSync(path.join(stub, 'sent.log')) ? fs.readFileSync(path.join(stub, 'sent.log'), 'utf8').split('\n').filter(Boolean).length : 0),
    read: name => (fs.existsSync(path.join(stub, name)) ? fs.readFileSync(path.join(stub, name), 'utf8') : null),
    set: (name, text) => fs.writeFileSync(path.join(stub, name), text),
    logLines: () => {
      const file = path.join(logs, 'notify.jsonl');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
    },
    heartbeatLines: () => {
      const file = path.join(logs, 'heartbeat.jsonl');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
    },
    run(script, args = [], extraEnv = {}) {
      const env = Object.assign({ PATH: bin, TZ: 'UTC', STUB_LOG: log, STUB_DIR: stub, TELETRAAN_LOG_DIR: logs }, extraEnv);
      const result = spawnSync('/bin/bash', [path.join(scripts, script), ...args], { env, encoding: 'utf8', input: '' });
      return { status: result.status, out: result.stdout, err: result.stderr };
    },
    notify: (text, extraEnv) => place.run('notify.sh', [text], extraEnv),
  };
  return place;
}

async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const url = 'https://chat.example.net/hooks/abc/SECRETPART';
const jsonEnv = "NOTIFY_URL='" + url + "'\n";

await check('with no NOTIFY_URL nothing is sent and nothing is said', () => {
  const place = setup();
  const result = place.notify('hello');
  assert.equal(result.status, 0);
  assert.equal(result.out + result.err, '');
  assert.deepEqual(place.calls(), []);
  const placeholder = setup("NOTIFY_URL='[paste the webhook address here]'\n");
  placeholder.notify('hello');
  assert.deepEqual(placeholder.calls(), [], 'the placeholder of local.example.env is skipped');
});

await check('a message is JSON with a content field and the machine name first, and the address goes in on standard input only', () => {
  const place = setup(jsonEnv);
  const result = place.notify('went offline');
  assert.equal(result.status, 0, result.err);
  const body = JSON.parse(place.read('last-data'));
  assert.deepEqual(Object.keys(body), ['content']);
  assert.match(body.content, /^teletraan: \[\d\d:\d\d\] went offline$/);
  assert.equal(place.read('last-header'), 'Content-Type: application/json');
  assert.match(place.read('last-stdin'), /^url = "https:\/\/chat\.example\.net\/hooks\/abc\/SECRETPART"/);
  place.calls().forEach(line => assert.ok(!line.includes('SECRETPART') && !line.includes('chat.example.net'), 'the address is not in the command line: ' + line));
  assert.ok(place.calls()[0].includes('--proto =https'));
  assert.ok(fs.existsSync(path.join(place.logs, 'notify.jsonl')));
  assert.ok(!JSON.stringify(place.logLines()).includes('SECRETPART'), 'the log never holds the address');
  assert.equal(place.logLines()[0].event, 'sent');
});

await check('NOTIFY_FORMAT=text sends the plain text as the body', () => {
  const place = setup(jsonEnv + "NOTIFY_FORMAT='text'\n");
  place.notify('came back');
  assert.match(place.read('last-data'), /^teletraan: \[\d\d:\d\d\] came back$/);
  assert.equal(place.read('last-header'), 'Content-Type: text/plain');
});

await check('a host name, an address or a web address in the text is taken out before it is sent', () => {
  const place = setup(jsonEnv);
  place.notify('wifi of hawk.school.k12.nc.us at 10.1.2.3 and https://intranet.school.org/x?token=abc failed');
  const content = JSON.parse(place.read('last-data')).content;
  assert.ok(!/school|10\.1\.2\.3|intranet|token/.test(content), content);
  assert.match(content, /^teletraan: /);
  place.notify('x'.repeat(1000));
  assert.ok(JSON.parse(place.read('last-data')).content.length <= 330, 'cut to a short text');
  place.notify('line one\nline two\u0007');
  assert.ok(!/\n|\u0007/.test(JSON.parse(place.read('last-data')).content));
});

await check('a message that cannot be sent is logged and kept, never stops the caller, and goes with the next one in the order it came', () => {
  const place = setup(jsonEnv);
  place.set('curl.exit', '6');
  const first = place.notify('went offline');
  assert.equal(first.status, 0, 'the caller is never blocked');
  assert.ok(place.logLines().some(line => line.event === 'failed' && /curl exit 6/.test(line.detail)));
  assert.match(fs.readFileSync(path.join(place.data, 'notify/pending'), 'utf8'), /went offline/);

  place.notify('netwatch: restart_network');
  assert.equal(fs.readFileSync(path.join(place.data, 'notify/pending'), 'utf8').trim().split('\n').length, 2);

  place.set('curl.exit', '0');
  place.notify('came back');
  const content = JSON.parse(place.read('last-data')).content.split('\n');
  assert.equal(content.length, 3);
  assert.match(content[0], /went offline/);
  assert.match(content[2], /came back/);
  content.forEach(line => assert.match(line, /^teletraan: /));
  assert.equal(fs.existsSync(path.join(place.data, 'notify/pending')), false, 'sent, so nothing is kept');
});

await check('only the last 5 unsent messages are kept', () => {
  const place = setup(jsonEnv);
  place.set('curl.exit', '7');
  for (let number = 1; number <= 8; number += 1) place.notify('message ' + number);
  const kept = fs.readFileSync(path.join(place.data, 'notify/pending'), 'utf8').trim().split('\n');
  assert.equal(kept.length, 5);
  assert.match(kept[0], /message 4/);
  assert.match(kept[4], /message 8/);
});

await check('--flush sends what is waiting and does nothing when nothing is', () => {
  const place = setup(jsonEnv);
  place.run('notify.sh', ['--flush']);
  assert.equal(place.sent(), 0);
  place.set('curl.exit', '6');
  place.notify('kept one');
  place.set('curl.exit', '0');
  const before = place.sent();
  place.run('notify.sh', ['--flush']);
  assert.equal(place.sent(), before + 1);
  assert.match(JSON.parse(place.read('last-data')).content, /kept one/);
});

await check('a web address that is not https is refused and logged', () => {
  const place = setup("NOTIFY_URL='http://chat.example.net/hook'\n");
  const result = place.notify('hello');
  assert.equal(result.status, 0);
  assert.deepEqual(place.calls(), []);
  assert.ok(place.logLines().some(line => line.event === 'skipped'));
});

await check('--test says how it went and fails when the push did not go', () => {
  const place = setup(jsonEnv);
  const good = place.run('notify.sh', ['--test']);
  assert.equal(good.status, 0);
  assert.match(good.out, /push: sent\./);
  place.set('curl.exit', '22');
  const bad = place.run('notify.sh', ['--test']);
  assert.equal(bad.status, 1);
  assert.match(bad.out, /push: not sent \(curl exit 22\)/);
  const empty = setup().run('notify.sh', ['--test']);
  assert.match(empty.out, /NOTIFY_URL is empty/);
});

// ----- the heartbeat -----

const pingUrl = 'https://monitor.example.net/ping/0000-1111-2222';
const heartbeatEnv = "HEARTBEAT_URL='" + pingUrl + "'\n";

function syncStatus(place, minutesAgo, now) {
  const at = new Date(now - minutesAgo * 60000).toISOString();
  fs.writeFileSync(path.join(place.data, 'sync-status.json'), JSON.stringify({ generatedAt: at, sources: { sanity: { lastSuccessAt: minutesAgo === null ? null : at, lastFailureAt: null, lastFailureReason: '' } } }));
}

await check('the heartbeat pings the monitor with a GET when the dashboard answers, with the address on standard input only', () => {
  const place = setup(heartbeatEnv);
  const result = place.run('heartbeat.sh');
  assert.equal(result.status, 0, result.err);
  assert.equal(place.sent(), 1);
  assert.match(place.read('last-stdin'), /url = "https:\/\/monitor\.example\.net\/ping\/0000-1111-2222"/);
  place.calls().forEach(line => assert.ok(!line.includes('monitor.example.net') && !line.includes('0000-1111'), line));
  assert.ok(place.calls().some(line => line.includes('http://127.0.0.1:8080/dashboard/')), 'it asked the local dashboard first');
  assert.ok(place.heartbeatLines().some(line => line.event === 'sent'));
  assert.ok(!JSON.stringify(place.heartbeatLines()).includes('0000-1111'));
  assert.ok(place.calls().includes('status-write sync'), 'and wrote the status');
});

await check('no ping is sent while the local dashboard does not answer, and the port comes from local.env', () => {
  const place = setup(heartbeatEnv + "TELETRAAN_PORT='8090'\n");
  place.set('dash.exit', '7');
  const result = place.run('heartbeat.sh');
  assert.equal(result.status, 0);
  assert.equal(place.sent(), 0);
  assert.ok(place.calls().some(line => line.includes('127.0.0.1:8090/dashboard/')));
  assert.ok(place.heartbeatLines().some(line => line.event === 'skipped'));
});

await check('with HEARTBEAT_URL empty the heartbeat is silent, and a failed ping is logged and never fails the unit', () => {
  const none = setup();
  const quiet = none.run('heartbeat.sh');
  assert.equal(quiet.status, 0);
  assert.equal(quiet.out + quiet.err, '');
  assert.equal(none.sent(), 0);

  const failing = setup(heartbeatEnv);
  failing.set('curl.exit', '28');
  const result = failing.run('heartbeat.sh');
  assert.equal(result.status, 0);
  assert.ok(failing.heartbeatLines().some(line => line.event === 'failed' && /curl exit 28/.test(line.detail)));
});

await check('a stale Sanity read raises one went-offline message, and a fresh one raises one came-back message; nothing repeats', () => {
  const place = setup(heartbeatEnv + jsonEnv);
  const now = Date.UTC(2026, 9, 30, 15, 30, 0);
  const env = { HEARTBEAT_NOW: String(Math.floor(now / 1000)) };

  syncStatus(place, 1, now);
  place.run('heartbeat.sh', [], env);
  assert.equal(place.sent(), 1, 'only the ping: the first state is online and says nothing');

  syncStatus(place, 12, now);
  place.run('heartbeat.sh', [], env);
  assert.match(place.read('last-data'), /went offline/);
  const afterOffline = place.sent();
  place.run('heartbeat.sh', [], env);
  assert.equal(place.sent(), afterOffline + 1, 'the ping goes again, the message does not');

  syncStatus(place, 1, now);
  place.run('heartbeat.sh', [], env);
  const messages = place.logLines().filter(line => line.event === 'sent').length;
  assert.equal(messages, 2, 'one for offline, one for back');
  place.run('heartbeat.sh', [], env);
  assert.equal(place.logLines().filter(line => line.event === 'sent').length, 2);
  assert.match(fs.readFileSync(path.join(place.data, 'heartbeat/state'), 'utf8'), /^state=online$/m);
});

await check('the came-back message says when it went offline, without a host name', () => {
  const place = setup(jsonEnv);
  const now = Date.UTC(2026, 9, 30, 15, 30, 0);
  const env = { HEARTBEAT_NOW: String(Math.floor(now / 1000)) };
  syncStatus(place, 20, now);
  place.run('heartbeat.sh', [], env);
  syncStatus(place, 1, now);
  place.run('heartbeat.sh', [], env);
  const content = JSON.parse(place.read('last-data')).content;
  assert.match(content, /came back online \(offline since \d\d:\d\d\)/);
  assert.ok(!/\.(com|net|org|io|us)/.test(content));
});

await check('without a sync status file (a laptop) the screen is never called offline', () => {
  const place = setup(jsonEnv);
  place.run('heartbeat.sh');
  assert.ok(!(place.read('last-data') || '').includes('offline'));
});

await check('--test sends one ping and one push and prints how each went', () => {
  const place = setup(heartbeatEnv + jsonEnv);
  const result = place.run('heartbeat.sh', ['--test']);
  assert.equal(result.status, 0);
  assert.match(result.out, /ping: sent\./);
  assert.match(result.out, /push: sent\./);
  assert.equal(place.sent(), 2);
  place.set('curl.exit', '6');
  const bad = place.run('heartbeat.sh', ['--test']);
  assert.match(bad.out, /ping: not sent \(curl exit 6\)/);
  assert.match(bad.out, /push: not sent/);
  const none = setup().run('heartbeat.sh', ['--test']);
  assert.match(none.out, /HEARTBEAT_URL is empty/);
  assert.match(none.out, /NOTIFY_URL is empty/);
});

fs.rmSync(work, { recursive: true, force: true });
console.log(passed + ' of ' + passed + ' checks passed.');
