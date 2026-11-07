// The reboot ledger: the one file that says when this computer last restarted itself, how often, and what it has
// stopped trying. /var/lib/teletraan/reboot-ledger.json, written before a reboot so it survives it.
//
// supervisor-plan.mjs decides; this file owns the file on disk. Every repair path asks it through
// computer/scripts/gate.sh, so there is one budget and one place that can say no.
//
//   node ledger.mjs allow <reason> [problem]   may this reboot happen? Records it and exits 0 when it may, else exits 3
//   node ledger.mjs check <reason> [problem]   the same question, reading only; prints JSON
//   node ledger.mjs boot                       records that the computer has started (the supervisor calls this once)
//   node ledger.mjs apply <plan.json>          keeps what a supervisor run decided
//   node ledger.mjs action <problem> <step> <action> [note]   remembers one action that was taken
//   node ledger.mjs clear [problem]            turns automatic fixes back on, for one problem or for everything
//   node ledger.mjs state                      prints the ledger as it is
//
// allow is one step on purpose: asking and recording in two commands would let two callers both be told yes.
//
// Settings for tests: TELETRAAN_LEDGER (the file), TELETRAAN_NOW_MS, TELETRAAN_UPTIME_SECONDS, TELETRAAN_BOOT_ID.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { autoReasons, gateReboot, limits, readLedger } from './supervisor-plan.mjs';

const file = process.env.TELETRAAN_LEDGER || '/var/lib/teletraan/reboot-ledger.json';
const hour = 3600000;

function now() {
  const given = Number(process.env.TELETRAAN_NOW_MS);
  return Number.isFinite(given) && given > 0 ? given : Date.now();
}

function uptimeSeconds() {
  const given = Number(process.env.TELETRAAN_UPTIME_SECONDS);
  if (Number.isFinite(given) && given >= 0) return given;
  try {
    return Math.round(Number(fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0]));
  } catch (error) {
    return Math.round(os.uptime());
  }
}

function bootId() {
  if (process.env.TELETRAAN_BOOT_ID) return process.env.TELETRAAN_BOOT_ID;
  try {
    return fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
  } catch (error) {
    return '';
  }
}

function load() {
  try {
    return readLedger(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    return readLedger(null);
  }
}

// Written by way of a temporary file in the same folder, so a cut power never leaves half a ledger. The lists are
// trimmed here: a day of boots, a week of reboots and the last fifty actions are all anyone reads.
function save(ledger) {
  const nowMs = now();
  const trimmed = {
    bootId: ledger.bootId,
    boots: ledger.boots.filter(at => nowMs - at < 7 * 24 * hour).slice(-20),
    reboots: ledger.reboots.filter(item => nowMs - item.at < 7 * 24 * hour).slice(-40),
    actions: ledger.actions.slice(-50),
    problems: ledger.problems,
    degradedAll: ledger.degradedAll,
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp.' + process.pid;
  fs.writeFileSync(temporary, JSON.stringify(trimmed, null, 2) + '\n', { mode: 0o644 });
  fs.renameSync(temporary, file);
  return trimmed;
}

// Is the network itself fine? A failing source while the network works is somebody else's outage, and the gate refuses
// to reboot for it. Read from what netwatch last found, never probed here.
function networkOk() {
  const stateFile = process.env.NETWATCH_STATE || '/var/lib/teletraan/netwatch.json';
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return Number(raw.failures) === 0;
  } catch (error) {
    return false;
  }
}

function request(reason, problem) {
  return { reason: reason, problem: problem || '', nowMs: now(), uptimeSeconds: uptimeSeconds(), networkOk: networkOk() };
}

function main(argv) {
  const mode = argv[0] || '';
  const ledger = load();

  if (mode === 'state') {
    process.stdout.write(JSON.stringify(ledger, null, 2) + '\n');
    return 0;
  }

  if (mode === 'boot') {
    const id = bootId();
    if (id !== '' && id === ledger.bootId) return 0; // already recorded for this boot
    ledger.bootId = id;
    ledger.boots = ledger.boots.concat([now()]);
    save(ledger);
    return 0;
  }

  if (mode === 'check' || mode === 'allow') {
    const answer = gateReboot(request(argv[1], argv[2]), ledger);
    if (mode === 'check') {
      process.stdout.write(JSON.stringify(answer) + '\n');
      return 0;
    }
    process.stdout.write(answer.why + '\n');
    if (!answer.allowed) return 3;
    // Recorded before the reboot, so the limits hold even if the computer goes down before anything else is written
    ledger.reboots = ledger.reboots.concat([{ at: now(), reason: String(argv[1] || ''), problem: String(argv[2] || '') }]);
    save(ledger);
    return 0;
  }

  if (mode === 'apply') {
    let made;
    try {
      made = JSON.parse(fs.readFileSync(argv[1], 'utf8'));
    } catch (error) {
      process.stderr.write('ledger: the plan could not be read.\n');
      return 1;
    }
    ledger.problems = Object.assign({}, ledger.problems, made.problems && typeof made.problems === 'object' ? made.problems : {});
    if (made.degradedAll && typeof made.degradedAll === 'object') ledger.degradedAll = made.degradedAll;
    save(ledger);
    return 0;
  }

  if (mode === 'action') {
    ledger.actions = ledger.actions.concat([{
      at: now(),
      problem: String(argv[1] || ''),
      step: Number(argv[2]) || 0,
      action: String(argv[3] || ''),
      note: String(argv[4] || '').slice(0, 200),
    }]);
    save(ledger);
    return 0;
  }

  if (mode === 'clear') {
    const problem = argv[1] || '';
    if (problem === '') {
      ledger.degradedAll = null;
      Object.keys(ledger.problems).forEach(name => {
        ledger.problems[name].degradedSince = 0;
        ledger.problems[name].degradedWhy = '';
      });
      process.stdout.write('Automatic fixes are on again for everything.\n');
    } else if (ledger.problems[problem]) {
      ledger.problems[problem].degradedSince = 0;
      ledger.problems[problem].degradedWhy = '';
      process.stdout.write('Automatic fixes are on again for ' + problem + '.\n');
    } else {
      process.stdout.write('Nothing was paused for ' + problem + '.\n');
      return 0;
    }
    save(ledger);
    return 0;
  }

  process.stderr.write('ledger: say allow, check, boot, apply, action, clear or state.\n');
  return 2;
}

export { autoReasons, limits };

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
