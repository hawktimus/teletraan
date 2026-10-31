// Tests for the tools around the network work of round 7: the one-line-per-event log (jsonlog.mjs and log_json in lib.sh),
// the probe of one address (net-probe.mjs), make logs, make net-status, make allowlist and make net-test (hosts.mjs and
// net-hosts.sh), the sync mode of status-write.sh, install-sync.sh, the logrotate rule and the Makefile. Local servers and fakes
// only; nothing touches the internet.
//
//   node tests/net-tools.test.mjs

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-nettools-')));
process.env.TELETRAAN_LOG_DIR = path.join(work, 'mainlog');

const { logEvent } = await import(path.join(repo, 'computer/scripts/jsonlog.mjs'));
const { probe, looksLikeBlockPage, probeDetail, probeAndLog } = await import(path.join(repo, 'computer/scripts/net-probe.mjs'));
const { sourceHosts, allowlistText, diagnosticTable } = await import(path.join(repo, 'computer/scripts/hosts.mjs'));

let passed = 0;
let counter = 0;

async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

function find(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

const readLines = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));

// A folder that stands for the computer: scripts, a data folder, a local.env with the text asked for
function place(env = '') {
  counter += 1;
  const root = path.join(work, 'place' + counter);
  const scripts = path.join(root, 'computer/scripts');
  const data = path.join(root, 'data');
  fs.mkdirSync(scripts, { recursive: true });
  fs.mkdirSync(data, { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  fs.cpSync(path.join(repo, 'computer/scripts'), scripts, { recursive: true });
  fs.cpSync(path.join(repo, 'dashboard/core'), path.join(root, 'dashboard/core'), { recursive: true });
  fs.readdirSync(path.join(repo, 'dashboard')).filter(name => /^config.*\.js$|^package\.json$/.test(name)).forEach(name => fs.copyFileSync(path.join(repo, 'dashboard', name), path.join(root, 'dashboard', name)));
  fs.writeFileSync(path.join(root, 'computer/local.env'), "TELETRAAN_DATA='" + data + "'\n" + env);
  return { root, scripts, data, logs: path.join(root, 'logs') };
}

function bash(place, script, args = [], env = {}) {
  const result = spawnSync('/bin/bash', [path.join(place.scripts, script), ...args], {
    env: Object.assign({ PATH: process.env.PATH, TELETRAAN_LOG_DIR: place.logs, TZ: 'UTC' }, env), encoding: 'utf8', input: '\n',
  });
  return { status: result.status, out: result.stdout, err: result.stderr };
}

// ----- the log -----

await check('jsonlog.mjs is the file the other services share, and writes one JSON line with five fields', () => {
  const text = fs.readFileSync(path.join(repo, 'computer/scripts/jsonlog.mjs'), 'utf8');
  assert.ok(text.startsWith('// One JSON line per event in /var/log/teletraan/<service>.jsonl. TELETRAAN_LOG_DIR moves the folder (tests).\n'));
  assert.ok(text.includes('export function logEvent(service, source, event, detail) {'));
  logEvent('probe', 'sanity', 'check_ok', 'fine');
  logEvent('probe', 'sanity', 'no_detail');
  const lines = readLines(path.join(work, 'mainlog/probe.jsonl'));
  assert.equal(lines.length, 2);
  lines.forEach(line => assert.deepEqual(Object.keys(line), ['ts', 'service', 'source', 'event', 'detail']));
  assert.match(lines[0].ts, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.equal(lines[1].detail, '');
});

await check('a log that cannot be written never stops the caller', () => {
  const previous = process.env.TELETRAAN_LOG_DIR;
  const blocked = path.join(work, 'a-file');
  fs.writeFileSync(blocked, 'not a folder');
  process.env.TELETRAAN_LOG_DIR = path.join(blocked, 'inside');
  assert.doesNotThrow(() => logEvent('x', 'y', 'z', 'w'));
  process.env.TELETRAAN_LOG_DIR = previous;
});

await check('log_json in lib.sh writes the same five fields, cleans the detail, and never fails the script', () => {
  const p = place();
  fs.writeFileSync(path.join(p.scripts, 'say.sh'), '#!/bin/bash\nset -euo pipefail\n. "$(dirname "$0")/lib.sh"\nlog_json netwatch network check "ping ok, \\"quoted\\" and \\\\ slash"\nlog_json netwatch network recovered\necho done\n', { mode: 0o755 });
  const result = bash(p, 'say.sh');
  assert.equal(result.out.trim(), 'done');
  const lines = readLines(path.join(p.logs, 'netwatch.jsonl'));
  assert.equal(lines.length, 2);
  lines.forEach(line => assert.deepEqual(Object.keys(line), ['ts', 'service', 'source', 'event', 'detail']));
  assert.match(lines[0].ts, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(lines[0].detail, 'ping ok, quoted and  slash');
  assert.equal(lines[1].detail, '');

  const blocked = path.join(work, 'a-file');
  const failing = spawnSync('/bin/bash', [path.join(p.scripts, 'say.sh')], { env: { PATH: process.env.PATH, TELETRAAN_LOG_DIR: path.join(blocked, 'inside') }, encoding: 'utf8' });
  assert.equal(failing.status, 0, 'an unwritable log does not stop the script');
});

await check('the logrotate rule keeps 14 days, caps a file at 5 MB, compresses, and copies then truncates', () => {
  const text = fs.readFileSync(path.join(repo, 'computer/logrotate/teletraan'), 'utf8');
  assert.ok(text.includes('/var/log/teletraan/*.jsonl {'));
  ['rotate 14', 'maxsize 5M', 'compress', 'copytruncate', 'daily', 'su ACCOUNT ACCOUNT'].forEach(word => assert.ok(text.includes(word), word));
  const logrotate = spawnSync('/bin/sh', ['-c', 'command -v logrotate'], { encoding: 'utf8' }).stdout.trim();
  if (logrotate) {
    const file = path.join(work, 'rotate.conf');
    fs.writeFileSync(file, text.replace(/ACCOUNT/g, os.userInfo().username).replace('/var/log/teletraan', path.join(work, 'mainlog')));
    const checked = spawnSync(logrotate, ['-d', '-s', path.join(work, 'rotate.state'), file], { encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stderr);
  }
});

// ----- the probe -----

function serve() {
  const server = http.createServer((request, response) => {
    request.url = request.url.split('?')[0];
    if (request.url === '/json') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{"result":1}');
    } else if (request.url === '/filter') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html><body>Blocked by the school filter</body></html>');
    } else if (request.url === '/away') {
      response.writeHead(302, { location: 'http://blocked.school.example/deny?url=x' });
      response.end();
    } else if (request.url === '/same') {
      response.writeHead(301, { location: '/json' });
      response.end();
    } else if (request.url === '/htmlasjson') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('<!DOCTYPE html><html>Blocked</html>');
    } else {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('no');
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, base: 'http://127.0.0.1:' + server.address().port })));
}

await check('the probe reports each step for a good answer', async () => {
  const { server, base } = await serve();
  try {
    const result = await probe(base + '/json', { expectedType: 'json' });
    assert.equal(result.ok, true, result.summary);
    assert.equal(result.dns.ok, true);
    assert.equal(result.tcp.ok, true);
    assert.equal(result.tls, null, 'a plain http address has no TLS step');
    assert.equal(result.http.status, 200);
    assert.equal(result.http.contentType, 'application/json');
    assert.equal(result.blockPage, false);
    assert.equal(result.summary, 'http 200');
  } finally {
    server.close();
  }
});

await check('the probe flags a 200 with the wrong kind of content, and a redirect to another host, as a block page', async () => {
  const { server, base } = await serve();
  try {
    const filter = await probe(base + '/filter', { expectedType: 'json' });
    assert.equal(filter.blockPage, true);
    assert.equal(filter.ok, false);
    assert.match(filter.summary, /block page \(200 text\/html\)/);

    const away = await probe(base + '/away', { expectedType: 'json' });
    assert.equal(away.blockPage, true, 'a redirect to a different host');

    const same = await probe(base + '/same', { expectedType: 'json' });
    assert.equal(same.blockPage, false, 'a redirect inside the same host is not one');

    const disguised = await probe(base + '/htmlasjson', { expectedType: 'json' });
    assert.equal(disguised.blockPage, true, 'a page of HTML that says it is JSON');

    const fine = await probe(base + '/json', {});
    assert.equal(fine.blockPage, false, 'with nothing expected, a 200 is just a 200');
  } finally {
    server.close();
  }
});

await check('the probe says which step failed, and never throws', async () => {
  const { server, base } = await serve();
  const port = server.address().port;
  server.close();
  await new Promise(resolve => setTimeout(resolve, 50));
  const refused = await probe('http://127.0.0.1:' + port + '/', {});
  assert.equal(refused.ok, false);
  assert.equal(refused.tcp.ok, false);
  assert.match(refused.summary, /^tcp ECONNREFUSED/);
  assert.equal(refused.http, null);

  const nameless = await probe('http://does-not-exist.invalid/', {});
  assert.equal(nameless.dns.ok, false);
  assert.match(nameless.summary, /^dns /);

  const notAnAddress = await probe('not an address', {});
  assert.equal(notAnAddress.summary, 'not an address');
});

await check('the logged detail names the host and the steps, never the path or the query', async () => {
  const { server, base } = await serve();
  try {
    const result = await probeAndLog('sync', 'sanity', base + '/json?token=SECRETTOKEN&x=1', { expectedType: 'json' });
    const lines = readLines(path.join(work, 'mainlog/sync.jsonl'));
    const line = lines[lines.length - 1];
    assert.equal(line.event, 'probe_ok');
    assert.match(line.detail, /^127\.0\.0\.1, dns ok \d+ms, tcp ok \d+ms, tls skipped, http 200 application\/json, blockPage false$/);
    assert.ok(!line.detail.includes('SECRETTOKEN') && !line.detail.includes('x=1') && !line.detail.includes('token'));
    assert.equal(result.ok, true);
    const filter = await probeAndLog('sync', 'sanity', base + '/filter', { expectedType: 'json' });
    assert.equal(readLines(path.join(work, 'mainlog/sync.jsonl')).pop().event, 'probe_failed');
    assert.ok(probeDetail(filter).endsWith('blockPage true'));
  } finally {
    server.close();
  }
  assert.equal(looksLikeBlockPage('a.example', { status: 301, location: 'https://www.a.example/x', contentType: '', body: '' }, 'json'), false, 'www and the bare name are one site');
});

// ----- make logs and make net-status -----

await check('make logs shows the newest lines of each log in plain words, one service, or says there is none yet', () => {
  const p = place();
  const none = bash(p, 'logs.sh');
  assert.match(none.out, /There is no log folder yet/);
  fs.mkdirSync(p.logs);
  fs.writeFileSync(path.join(p.logs, 'sync.jsonl'), ['one', 'two', 'three'].map((word, index) => JSON.stringify({ ts: '2026-10-30T15:0' + index + ':00.000Z', service: 'sync', source: 'sanity', event: 'check_' + word, detail: 'detail ' + word })).join('\n') + '\n');
  fs.writeFileSync(path.join(p.logs, 'netwatch.jsonl'), JSON.stringify({ ts: '2026-10-30T15:00:00Z', service: 'netwatch', source: 'network', event: 'check', detail: 'ping ok' }) + '\n');
  const all = bash(p, 'logs.sh');
  assert.match(all.out, /== sync\n2026-10-30T15:00:00.000Z {2}sanity {2}check_one {2}detail one/);
  assert.match(all.out, /== netwatch\n2026-10-30T15:00:00Z {2}network {2}check {2}ping ok/);
  const some = bash(p, 'logs.sh', ['sync', '2']);
  assert.ok(!some.out.includes('check_one') && some.out.includes('check_three') && !some.out.includes('netwatch'), some.out);
  assert.match(bash(p, 'logs.sh', ['missing']).out, /No log for missing yet/);
  assert.equal(bash(p, 'logs.sh', ['../etc']).status, 2);
  assert.equal(bash(p, 'logs.sh', ['sync', 'x']).status, 2);
});

await check('make net-status reads the two files and asks the network for nothing', () => {
  const p = place();
  const now = Date.UTC(2026, 9, 30, 15, 30, 0);
  const iso = minutes => new Date(now - minutes * 60000).toISOString();
  fs.writeFileSync(path.join(p.data, 'sync-status.json'), JSON.stringify({
    generatedAt: iso(0),
    sources: {
      sanity: { lastSuccessAt: iso(1), lastFailureAt: null, lastFailureReason: '' },
      weather: { lastSuccessAt: iso(40), lastFailureAt: iso(2), lastFailureReason: 'network ENOTFOUND' },
      images: { lastSuccessAt: null, lastFailureAt: null, lastFailureReason: '' },
    },
  }));
  const netwatch = path.join(p.root, 'netwatch.json');
  fs.writeFileSync(netwatch, JSON.stringify({ failures: 4, lastCheckAt: iso(0), lastOkAt: iso(8), lastAction: 'restart_network', lastActionAt: iso(2), lastRebootAt: null }));
  fs.mkdirSync(path.join(p.data, 'notify'));
  fs.writeFileSync(path.join(p.data, 'notify/pending'), 'a\nb\n');
  const result = bash(p, 'net-status.sh', [], { NETWATCH_STATE: netwatch, NET_STATUS_NOW: String(Math.floor(now / 1000)) });
  assert.equal(result.status, 0, result.err);
  assert.match(result.out, /sanity {2,}60s ago {2,}never/);
  assert.match(result.out, /weather {2,}40m ago {2,}2m ago {2,}network ENOTFOUND/);
  assert.match(result.out, /images {2,}never {2,}never/);
  assert.match(result.out, /failures in a row: 4/);
  assert.match(result.out, /last action: restart_network \(2m ago\)/);
  assert.match(result.out, /Push messages waiting to be sent: 2/);

  const empty = bash(place(), 'net-status.sh', [], { NETWATCH_STATE: path.join(work, 'nothing.json') });
  assert.match(empty.out, /no sync status yet/);
  assert.match(empty.out, /no netwatch record yet/);
});

// ----- make allowlist and make net-test -----

await check('the host list is read from the files that use each address, and has a purpose for each', () => {
  const list = sourceHosts();
  const hosts = list.map(item => item.host);
  assert.ok(hosts.includes('ybfqe345.api.sanity.io') && hosts.includes('cdn.sanity.io') && hosts.includes('api.open-meteo.com'));
  ['api.monday.com', 'www.thebluealliance.com', 'api.statbotics.io', 'community.firstinspires.org', 'actions.match13.com', 'www.googleapis.com', 'docs.google.com'].forEach(host => {
    assert.ok(hosts.includes(host), 'read from its script: ' + host);
  });
  list.forEach(item => assert.ok(item.purpose.length > 10, item.host));

  // Move an address in a copy of the scripts and the list follows
  const folder = path.join(work, 'moved');
  fs.cpSync(path.join(repo, 'computer/scripts'), folder, { recursive: true });
  const contract = path.join(folder, 'monday-contract.sh');
  fs.writeFileSync(contract, fs.readFileSync(contract, 'utf8').replace('https://api.monday.com/v2', 'https://monday.example.org/v2'));
  const moved = sourceHosts([], folder).map(item => item.host);
  assert.ok(moved.includes('monday.example.org') && !moved.includes('api.monday.com'));
});

await check('make allowlist prints a hostname and a purpose on one line each, and only hostnames of the calendars and the two addresses', () => {
  const p = place([
    "CALENDAR_TEAM_URL='webcal://calendar.example.org/ical/PRIVATETOKEN123/feed.ics?key=PRIVATEKEY'",
    "CALENDAR_SHOP_URL='https://user:pass@shop.example.org:8443/cal?token=SHOPTOKEN'",
    "CALENDAR_OLD_URL='[paste the iCal address of the team calendar here]'",
    "HEARTBEAT_URL='https://monitor.example.net/ping/0000-1111'",
    "NOTIFY_URL='https://chat.example.net/hooks/123/SECRETPART'",
    "MONDAY_API_TOKEN='mondaytokenSECRET'",
    '',
  ].join('\n'));
  const result = bash(p, 'net-hosts.sh', ['allowlist']);
  assert.equal(result.status, 0, result.err);
  ['calendar.example.org', 'shop.example.org', 'monitor.example.net', 'chat.example.net', 'ybfqe345.api.sanity.io', 'api.monday.com'].forEach(host => {
    assert.ok(new RegExp('^  ' + host.replace(/\./g, '\\.') + ' +\\S', 'm').test(result.out), host + '\n' + result.out);
  });
  assert.match(result.out, /BAND calendar feed of the team calendar/);
  assert.match(result.out, /uptime monitor/);
  ['PRIVATETOKEN123', 'PRIVATEKEY', 'SHOPTOKEN', 'user:pass', '8443', 'ical/', 'SECRETPART', 'hooks/123', '0000-1111', 'mondaytokenSECRET', 'paste the iCal'].forEach(secret => {
    assert.ok(!result.out.includes(secret), 'must not print ' + secret);
  });
  const lines = result.out.split('\n').filter(line => /^ {2}\S/.test(line));
  assert.ok(lines.length >= 12);
  lines.forEach(line => assert.match(line, /^ {2}[a-z0-9.-]+ +\S.*[a-z)]$/));
});

await check('the diagnostic table has a row for each source, marks a block page, and a source that did not answer', async () => {
  const list = sourceHosts([{ name: 'calendars', purpose: 'the BAND calendar feed of the team calendar', host: 'calendar.example.org' }]);
  const fake = async (url, options) => {
    if (url.includes('calendar.example.org')) return { ok: false, blockPage: false, dns: { ok: false, error: 'ENOTFOUND' }, tcp: null, tls: null, http: null, summary: 'dns ENOTFOUND' };
    if (url.includes('open-meteo')) return { ok: false, blockPage: true, dns: { ok: true, ms: 3 }, tcp: { ok: true, ms: 4 }, tls: { ok: true, ms: 9 }, http: { ok: true, status: 200, contentType: 'text/html' }, summary: 'block page (200 text/html)' };
    return { ok: true, blockPage: false, dns: { ok: true, ms: 3 }, tcp: { ok: true, ms: 4 }, tls: { ok: true, ms: 9 }, http: { ok: true, status: options.expectedType ? 200 : 404, contentType: 'application/json' }, summary: 'http 200' };
  };
  const table = await diagnosticTable(list, fake);
  const lines = table.text.split('\n');
  assert.match(lines[0], /^SOURCE +HOST +DNS +TCP +TLS +HTTP +TYPE +BLOCKED +RESULT/);
  assert.match(table.text, /weather +api\.open-meteo\.com .*BLOCK PAGE +block page/);
  assert.match(table.text, /calendars +calendar\.example\.org +ENOTFOUND +- +- +- +- +no +dns ENOTFOUND/);
  assert.match(table.text, /monday +api\.monday\.com .* 404 .* ok/, 'a 404 from the front of a host counts as reached');
  assert.equal(table.bad, 2);
  assert.match(lines[lines.length - 1], /2 of \d+ sources did not answer as expected/);
});

// ----- the Makefile -----

await check('the Makefile has help and the commands, and includes the fragments of computer/make', () => {
  const text = fs.readFileSync(path.join(repo, 'Makefile'), 'utf8');
  assert.ok(text.includes('-include computer/make/*.mk'));
  ['help', 'logs', 'net-status', 'net-test', 'heartbeat-test', 'allowlist'].forEach(target => assert.match(text, new RegExp('^' + target + ':', 'm'), target));
  const make = spawnSync('/bin/sh', ['-c', 'command -v make'], { encoding: 'utf8' }).stdout.trim();
  if (!make) return;

  const folder = path.join(work, 'makefolder');
  fs.mkdirSync(path.join(folder, 'computer/make'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'Makefile'), path.join(folder, 'Makefile'));
  fs.writeFileSync(path.join(folder, 'computer/make/remote.mk'), '.PHONY: remote-test\nremote-test: ## A target another file adds\n\t@echo remote ok\n');
  const help = spawnSync(make, ['-C', folder, 'help'], { encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  ['make logs ', 'make net-status ', 'make net-test ', 'make heartbeat-test ', 'make allowlist ', 'make remote-test '].forEach(word => assert.ok(help.stdout.includes(word), word + '\n' + help.stdout));
  assert.equal(spawnSync(make, ['-C', folder, 'remote-test'], { encoding: 'utf8' }).stdout.trim(), 'remote ok');
  assert.equal(spawnSync(make, ['-C', folder], { encoding: 'utf8' }).stdout.includes('make allowlist'), true, 'make alone shows the help');
  const dry = spawnSync(make, ['-C', folder, '-n', 'logs', 'SERVICE=sync', 'LINES=50'], { encoding: 'utf8' }).stdout;
  assert.match(dry, /logs\.sh "sync" "50"/);
});

// ----- status-write.sh sync -----

await check('status-write.sh sync writes status.json with no token, and sends only times and short words to status-mini', () => {
  const p = place("SANITY_WRITE_TOKEN='skTESTtoken0123456789abcdef'\n");
  const bin = path.join(p.root, 'bin');
  fs.mkdirSync(bin);
  ['sed', 'head', 'tail', 'grep', 'date', 'dirname', 'cat', 'awk', 'tr', 'mv', 'rm', 'cut', 'wc', 'printf', 'jq', 'mkdir', 'chmod'].forEach(name => fs.symlinkSync(find(name), path.join(bin, name)));
  fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/sh\nprevious=""\nfor a in "$@"; do [ "$previous" = --data ] && printf "%s" "$a" > "$STUB_DIR/body.json"; previous=$a; done\ncat > /dev/null\nexit "$(cat "$STUB_DIR/exit" 2>/dev/null || echo 0)"\n', { mode: 0o755 });
  fs.mkdirSync(path.join(p.root, 'stub'));
  const iso = text => text;
  fs.writeFileSync(path.join(p.data, 'sync-status.json'), JSON.stringify({
    generatedAt: '2026-10-30T15:30:00.000Z',
    sources: {
      sanity: { lastSuccessAt: '2026-10-30T15:29:50.000Z', lastFailureAt: null, lastFailureReason: '' },
      weather: { lastSuccessAt: '2026-10-30T15:10:00.000Z', lastFailureAt: '2026-10-30T15:25:00.000Z', lastFailureReason: 'network ENOTFOUND' },
      images: { lastSuccessAt: '2026-10-30T15:29:00.000Z', lastFailureAt: null, lastFailureReason: '' },
      monday: { lastSuccessAt: null, lastFailureAt: null, lastFailureReason: '' },
      competition: { lastSuccessAt: null, lastFailureAt: null, lastFailureReason: '' },
      calendars: { lastSuccessAt: '2026-10-30T15:20:00.000Z', lastFailureAt: null, lastFailureReason: '' },
    },
  }));
  const netwatch = path.join(p.root, 'netwatch.json');
  fs.writeFileSync(netwatch, JSON.stringify({ failures: 0, lastCheckAt: iso('2026-10-30T15:30:00Z'), lastOkAt: '2026-10-30T15:30:00Z', lastAction: 'restart_network', lastActionAt: '2026-10-30T14:00:00Z', lastRebootAt: null }));
  const env = { PATH: bin, NETWATCH_STATE: netwatch, STUB_DIR: path.join(p.root, 'stub'), TELETRAAN_LOG_DIR: p.logs };
  const result = spawnSync('/bin/bash', [path.join(p.scripts, 'status-write.sh'), 'sync'], { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const local = JSON.parse(fs.readFileSync(path.join(p.data, 'status.json'), 'utf8'));
  assert.deepEqual(Object.keys(local), ['generatedAt', 'sources', 'netwatch', 'facts']);
  assert.equal(local.netwatch.lastAction, 'restart_network');
  assert.equal(local.facts.syncLastFailure, 'weather: network ENOTFOUND');
  assert.equal(local.facts.syncMondayAt, null);

  const body = JSON.parse(fs.readFileSync(path.join(p.root, 'stub/body.json'), 'utf8'));
  const patch = body.mutations[1].patch;
  assert.equal(patch.id, 'status-mini');
  assert.equal(patch.set.syncSanityAt, '2026-10-30T15:29:50.000Z');
  assert.equal(patch.set.syncLastFailure, 'weather: network ENOTFOUND');
  assert.equal(patch.set.netwatchLastAction, 'restart_network');
  assert.equal(patch.set.netwatchLastActionAt, '2026-10-30T14:00:00Z');
  assert.deepEqual(patch.unset.sort(), ['syncCompetitionAt', 'syncMondayAt']);
  assert.ok(!JSON.stringify(body).includes('skTEST'), 'the token is not in the body');

  // With no write token only the local file is made
  fs.writeFileSync(path.join(p.root, 'computer/local.env'), "TELETRAAN_DATA='" + p.data + "'\n");
  fs.rmSync(path.join(p.root, 'stub/body.json'));
  fs.rmSync(path.join(p.data, 'status.json'));
  const quiet = spawnSync('/bin/bash', [path.join(p.scripts, 'status-write.sh'), 'sync'], { env, encoding: 'utf8' });
  assert.equal(quiet.status, 0);
  assert.ok(fs.existsSync(path.join(p.data, 'status.json')) && !fs.existsSync(path.join(p.root, 'stub/body.json')));
});

// ----- install-sync.sh -----

await check('install-sync.sh makes the log folder and the rotation rule, copies the three units for the login user, and turns them on', () => {
  const root = path.join(work, 'syncroot');
  const home = path.join(root, 'opt/teletraan');
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  fs.cpSync(path.join(repo, 'computer'), path.join(home, 'computer'), { recursive: true, filter: source => !source.endsWith('local.env') });
  fs.writeFileSync(path.join(home, 'computer/local.env'), "TELETRAAN_DATA='" + path.join(root, 'data') + "'\n");
  ['sed', 'head', 'tail', 'grep', 'awk', 'cat', 'mkdir', 'chmod', 'install', 'mktemp', 'rm', 'cmp', 'dirname', 'sort', 'ls', 'tr', 'printf', 'readlink', 'cut', 'echo', 'basename', 'node', 'jq', 'curl'].forEach(name => {
    const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
    if (found) fs.symlinkSync(found, path.join(bin, name));
  });
  const log = path.join(root, 'calls.log');
  fs.writeFileSync(path.join(bin, 'id'), '#!/bin/sh\n[ "$1" = -u ] && { echo 0; exit 0; }\n[ "$1" = -gn ] && { echo hawkgroup; exit 0; }\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'stat'), '#!/bin/sh\necho hawk\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'chown'), '#!/bin/sh\necho "chown $*" >> "' + log + '"\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'systemctl'), '#!/bin/sh\necho "systemctl $*" >> "' + log + '"\n', { mode: 0o755 });
  const run = () => spawnSync('/bin/bash', [path.join(home, 'computer/scripts/install-sync.sh')], { env: { PATH: bin, SYNC_ROOT: root }, encoding: 'utf8', input: '\n' });
  const result = run();
  assert.equal(result.status, 0, result.stderr + result.stdout);

  const unit = name => fs.readFileSync(path.join(root, 'etc/systemd/system', name), 'utf8');
  assert.match(unit('teletraan-sync.service'), /^User=hawk$/m);
  assert.match(unit('teletraan-sync.service'), new RegExp('^Environment=TELETRAAN_DATA=' + path.join(root, 'data') + '$', 'm'));
  assert.match(unit('teletraan-sync.service'), /^Restart=always$/m);
  assert.match(unit('teletraan-heartbeat.service'), /^User=hawk$/m);
  assert.match(unit('teletraan-heartbeat.timer'), /OnUnitActiveSec=5min/);
  const rule = fs.readFileSync(path.join(root, 'etc/logrotate.d/teletraan'), 'utf8');
  assert.match(rule, /su hawk hawk/);
  assert.ok(!rule.includes('ACCOUNT'));
  assert.ok(fs.statSync(path.join(root, 'var/log/teletraan')).isDirectory());
  const calls = fs.readFileSync(log, 'utf8');
  assert.ok(calls.includes('chown hawk:hawkgroup') && calls.includes('var/log/teletraan'));
  assert.ok(calls.includes('systemctl enable --now teletraan-sync.service teletraan-heartbeat.timer'));
  assert.ok(calls.includes('systemctl restart teletraan-sync.service teletraan-heartbeat.timer'), 'an update of the code takes effect');
  assert.equal(run().status, 0, 'a second run is fine');
});

await check('the units: the sync service restarts by itself, runs as the login user, reads no key; the timers are 2 and 5 minutes', () => {
  const read = name => fs.readFileSync(path.join(repo, 'computer/systemd', name), 'utf8');
  const sync = read('teletraan-sync.service');
  assert.match(sync, /^Restart=always$/m);
  assert.match(sync, /^User=ACCOUNT$/m);
  assert.match(sync, /sync-service\.mjs/);
  assert.ok(!/EnvironmentFile|local\.env/.test(sync.split('\n').filter(line => !line.startsWith('#')).join('\n')), 'the service never loads local.env');
  assert.match(read('teletraan-netwatch.timer'), /OnUnitActiveSec=2min/);
  assert.match(read('teletraan-heartbeat.timer'), /OnUnitActiveSec=5min/);
  assert.match(read('teletraan-heartbeat.service'), /^NoNewPrivileges=yes$/m);
  const deploy = fs.readFileSync(path.join(repo, 'tools/teletraan/teletraan-tool-deploy.sh'), 'utf8');
  assert.ok(deploy.includes('cleanup remote sync; do'), 'Install everything installs the remote service and then the sync service');
});

await check('local.example.env names the new values and holds no real one', () => {
  const text = fs.readFileSync(path.join(repo, 'computer/local.example.env'), 'utf8');
  ['HEARTBEAT_URL', 'NOTIFY_URL', 'NOTIFY_FORMAT', 'NETWATCH_HOST'].forEach(name => assert.match(text, new RegExp("^# " + name + "='", 'm'), name));
  assert.ok(!/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(text.split('\n').filter(line => /HEARTBEAT|NOTIFY|NETWATCH/.test(line) && !line.startsWith('#   ')).join('\n')));
});

fs.rmSync(work, { recursive: true, force: true });
console.log(passed + ' of ' + passed + ' checks passed.');
