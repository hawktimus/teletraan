// The one place that decides what to do about a problem, and whether a reboot may happen. supervisor.sh (started by
// teletraan-supervisor.timer every minute) reads the health file and the ledger, asks this file, and does what it says.
// Every other repair path on this computer (watchdog.sh, netwatch.sh, remote-poller.mjs, scheduled-reboot.sh,
// nightly.sh and the control helper) asks the gate below before it reboots, through computer/scripts/gate.sh. They keep
// their own detection; only the reboot goes through here. That is what makes a reboot loop impossible: one ledger, one
// budget, one place that can say no.
//
// Plain functions that take values and give values back, so tests can run the whole ladder with a fake clock
// (tests/supervisor.test.mjs). Nothing here reads a file, asks the network or runs a command.
//
//   node supervisor-plan.mjs plan <health.json> <ledger.json>   prints the actions to take, as JSON
//   node supervisor-plan.mjs gate <request.json> <ledger.json>  prints whether that reboot may happen
//
// The ladder, by how long one problem has been failing without a break:
//   1 min   reload the page (a screen problem) or look again (a source)
//   5 min   restart the service that problem belongs to
//   10 min  restart the screen session and set the display again
//   20 min  restart the network (a network problem only)
//   30 min  reboot, if the gate allows it
//
// A step runs one action and then waits to see whether the check passes. A problem that clears starts again at the
// bottom. A problem that nothing fixes ends in degraded mode: steps 1 to 3 go on, no more automatic reboots, and the
// last good content stays on the screen.

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const minute = 60000;
const hour = 60 * minute;

// ----- the shape of a problem -----

// Every check the health file may hold, and what may be done about it.
//   service  the unit to restart at step 2, empty when there is none
//   screen   the problem is on the screen, so restarting the session (step 3) can help
//   network  the problem is the network, so restarting it (step 4) can help
//   source   the problem is a read of something outside this computer, so a reboot never fixes it
//   words    how to say it to a person
export const problems = {
  frames: { service: 'teletraan-kiosk', screen: true, network: false, source: false, words: 'the screen is not drawing' },
  page: { service: 'teletraan-kiosk', screen: true, network: false, source: false, words: 'the page is not answering' },
  display: { service: '', screen: true, network: false, source: false, words: 'the display is not at its mode' },
  screenStuck: { service: 'teletraan-kiosk', screen: true, network: false, source: false, words: 'the picture is not changing' },
  network: { service: '', screen: false, network: true, source: false, words: 'the network is down' },
  dns: { service: '', screen: false, network: true, source: false, words: 'names cannot be looked up' },
  sanity: { service: 'teletraan-sync', screen: false, network: false, source: true, words: 'the content cannot be read' },
  calendars: { service: 'teletraan-calendars', screen: false, network: false, source: true, words: 'the calendars cannot be read' },
  monday: { service: 'teletraan-monday', screen: false, network: false, source: true, words: 'Monday cannot be read' },
  competition: { service: 'teletraan-frc', screen: false, network: false, source: true, words: 'the competition data cannot be read' },
  services: { service: '', screen: false, network: false, source: false, words: 'a service keeps stopping' },
  memory: { service: 'teletraan-kiosk', screen: true, network: false, source: false, words: 'the browser is using too much memory' },
  disk: { service: '', screen: false, network: false, source: false, words: 'the disk is nearly full' },
  clock: { service: '', screen: false, network: false, source: false, words: 'the clock is not set' },
};

// The five steps, in order, with how long a problem must have been failing.
export const steps = [
  { number: 1, action: 'reload', minutes: 1 },
  { number: 2, action: 'restart-service', minutes: 5 },
  { number: 3, action: 'restart-kiosk', minutes: 10 },
  { number: 4, action: 'restart-network', minutes: 20 },
  { number: 5, action: 'reboot', minutes: 30 },
];

// How long to leave an action alone before trying the next step, so a step is judged on its own
export const settleMinutes = 2;

// The limits of the gate
export const limits = {
  anyGapMinutes: 10, // no reboot of any kind within 10 minutes of the last one
  autoPerHours: 6, // one automatic reboot per 6 hours
  autoPerDay: 3, // and three in a day
  bootGraceMinutes: 10, // nothing above step 3 in the first 10 minutes after a boot
  didNotHelpMinutes: 30, // the same problem failing again this soon after a recovery reboot means rebooting does not help
  bootLoopBoots: 3, // this many boots
  bootLoopMinutes: 60, // in this long is a boot loop
  degradedHours: 24, // how long degraded mode lasts, and how long it takes to clear itself
};

// The reasons a reboot may be asked for. The first three are the computer deciding by itself and share the budget; the
// last three are a person or a plan a person set up.
export const autoReasons = ['recovery', 'netwatch', 'watchdog'];
export const humanReasons = ['nightly', 'remote', 'control'];

// ----- reading what is kept -----

function toMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? 0 : time;
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

// The ledger cleaned: every time in milliseconds, every list a list. An unreadable or missing ledger is an empty one,
// which is safe: the gate then counts no reboots and the ten minute gap still holds through the uptime.
export function readLedger(raw) {
  const source = record(raw);
  const list = (value, pick) => (Array.isArray(value) ? value.map(pick).filter(item => item !== null) : []);

  return {
    bootId: typeof source.bootId === 'string' ? source.bootId : '',
    boots: list(source.boots, item => (toMs(item) > 0 ? toMs(item) : null)),
    reboots: list(source.reboots, item => {
      const at = toMs(record(item).at);
      return at > 0 ? { at: at, reason: String(record(item).reason || ''), problem: String(record(item).problem || '') } : null;
    }),
    actions: list(source.actions, item => {
      const at = toMs(record(item).at);
      return at > 0 ? { at: at, problem: String(record(item).problem || ''), step: Number(record(item).step) || 0, action: String(record(item).action || ''), note: String(record(item).note || '') } : null;
    }),
    problems: Object.fromEntries(Object.entries(record(source.problems)).map(([name, value]) => {
      const kept = record(value);
      return [name, {
        since: toMs(kept.since),
        lastStep: Number(kept.lastStep) || 0,
        lastActionAt: toMs(kept.lastActionAt),
        lastAction: typeof kept.lastAction === 'string' ? kept.lastAction : '',
        degradedSince: toMs(kept.degradedSince),
        degradedWhy: typeof kept.degradedWhy === 'string' ? kept.degradedWhy : '',
        healthySince: toMs(kept.healthySince),
      }];
    })),
    degradedAll: toMs(record(source.degradedAll).since) > 0 ? { since: toMs(record(source.degradedAll).since), why: String(record(source.degradedAll).why || '') } : null,
  };
}

// The health file cleaned: { name: { ok, since (ms), detail } }. A check that is not a record is left out.
export function readHealth(raw) {
  const checks = record(record(raw).checks);
  const out = {};
  Object.entries(checks).forEach(([name, value]) => {
    const check = record(value);
    if (typeof check.ok !== 'boolean') return;
    out[name] = { ok: check.ok, since: toMs(check.since), detail: typeof check.detail === 'string' ? check.detail.slice(0, 200) : '' };
  });
  return out;
}

// ----- the gate -----

function withinDay(times, nowMs) {
  return times.filter(at => at <= nowMs && nowMs - at < 24 * hour);
}

// Is this problem, or the whole computer, in degraded mode now?
export function degradedFor(ledger, problem, nowMs) {
  if (ledger.degradedAll && nowMs - ledger.degradedAll.since < limits.degradedHours * hour) return { all: true, why: ledger.degradedAll.why };
  const kept = ledger.problems[problem];
  if (kept && kept.degradedSince > 0 && nowMs - kept.degradedSince < limits.degradedHours * hour) return { all: false, why: kept.degradedWhy };
  return null;
}

// May this reboot happen?
//   request { reason, problem, nowMs, uptimeSeconds, networkOk }
// networkOk is true when the network itself is fine, which means a failing source is someone else's fault and a reboot
// cannot help. Gives { allowed, why }. why is a plain sentence either way, for the log and the page.
export function gateReboot(request, ledger) {
  const nowMs = toMs(request.nowMs);
  const reason = String(request.reason || '');
  const problem = String(request.problem || '');
  const uptime = Number(request.uptimeSeconds) || 0;
  const automatic = autoReasons.includes(reason);

  if (!automatic && !humanReasons.includes(reason)) return { allowed: false, why: 'a reboot needs one of these reasons: ' + autoReasons.concat(humanReasons).join(', ') + '.' };

  // The ten minute gap holds for every reason, and the uptime counts as a reboot this ledger may not have seen
  const reboots = ledger.reboots.filter(item => item.at <= nowMs);
  const newest = reboots.reduce((most, item) => Math.max(most, item.at), 0);
  if (newest > 0 && nowMs - newest < limits.anyGapMinutes * minute) {
    return { allowed: false, why: 'the computer rebooted ' + Math.round((nowMs - newest) / minute) + ' minutes ago, and one reboot in ' + limits.anyGapMinutes + ' minutes is the most allowed.' };
  }
  if (uptime > 0 && uptime < limits.anyGapMinutes * 60) {
    return { allowed: false, why: 'the computer started ' + Math.round(uptime / 60) + ' minutes ago, and one reboot in ' + limits.anyGapMinutes + ' minutes is the most allowed.' };
  }

  const stopped = degradedFor(ledger, problem, nowMs);
  if (stopped && stopped.all) {
    if (automatic || reason === 'nightly') return { allowed: false, why: 'automatic fixes are paused for the whole computer: ' + stopped.why };
  } else if (stopped && automatic) {
    return { allowed: false, why: 'automatic fixes are paused for ' + (problems[problem] ? problems[problem].words : problem) + ': ' + stopped.why };
  }

  if (!automatic) return { allowed: true, why: 'a person asked for this reboot (' + reason + ').' };

  if (uptime > 0 && uptime < limits.bootGraceMinutes * 60) {
    return { allowed: false, why: 'the computer started less than ' + limits.bootGraceMinutes + ' minutes ago, so it is given time.' };
  }
  if (problems[problem] && problems[problem].source && request.networkOk === true) {
    return { allowed: false, why: 'the network works and only ' + problems[problem].words + ', so this is not something a reboot fixes.' };
  }

  const automatics = reboots.filter(item => autoReasons.includes(item.reason));
  const lastAutomatic = automatics.reduce((most, item) => Math.max(most, item.at), 0);
  if (lastAutomatic > 0 && nowMs - lastAutomatic < limits.autoPerHours * hour) {
    return { allowed: false, why: 'the computer already fixed itself with a reboot ' + Math.round((nowMs - lastAutomatic) / hour) + ' hours ago, and one in ' + limits.autoPerHours + ' hours is the most allowed.' };
  }
  const today = withinDay(automatics.map(item => item.at), nowMs);
  if (today.length >= limits.autoPerDay) {
    return { allowed: false, why: 'there have already been ' + today.length + ' automatic reboots in a day, which is the most allowed.' };
  }
  return { allowed: true, why: 'nothing else fixed ' + (problems[problem] ? problems[problem].words : problem) + '.' };
}

// ----- the ladder -----

// Which steps this problem may take
function stepsFor(name) {
  const shape = problems[name];
  if (!shape) return [];
  return steps.filter(step => {
    if (step.action === 'restart-service') return shape.service !== '';
    if (step.action === 'restart-kiosk') return shape.screen === true;
    if (step.action === 'restart-network') return shape.network === true;
    return true;
  });
}

// What to do about one problem now. Gives { action, step, why } with action 'none' when nothing is due.
export function stepFor(name, health, ledger, input) {
  const nowMs = toMs(input.nowMs);
  const check = health[name];
  const kept = ledger.problems[name] || { since: 0, lastStep: 0, lastActionAt: 0 };
  if (!check || check.ok === true) return { action: 'none', step: 0, why: '' };

  const since = check.since > 0 ? check.since : kept.since > 0 ? kept.since : nowMs;
  const failingMinutes = Math.floor((nowMs - since) / minute);
  const uptimeMinutes = Math.floor((Number(input.uptimeSeconds) || 0) / 60);
  const stopped = degradedFor(ledger, name, nowMs);

  const due = stepsFor(name).filter(step => failingMinutes >= step.minutes && step.number > kept.lastStep);
  if (due.length === 0) return { action: 'none', step: 0, why: '' };

  const step = due[0];
  if (kept.lastActionAt > 0 && nowMs - kept.lastActionAt < settleMinutes * minute) {
    return { action: 'none', step: 0, why: 'waiting to see whether the last fix worked' };
  }
  if (uptimeMinutes < limits.bootGraceMinutes && step.number > 3) {
    return { action: 'none', step: 0, why: 'the computer started less than ' + limits.bootGraceMinutes + ' minutes ago, so only the gentle fixes run' };
  }
  if (stopped && step.number > 3) {
    return { action: 'none', step: 0, why: 'automatic fixes above restarting the screen are paused' };
  }

  const shape = problems[name];
  return {
    action: step.action,
    step: step.number,
    service: step.action === 'restart-service' ? shape.service : '',
    why: shape.words + ' for ' + failingMinutes + ' minutes',
    detail: check.detail,
  };
}

// Everything to do this minute, worst first, and what the state becomes.
//   input { nowMs, uptimeSeconds, bootId, networkOk }
// Gives { actions, problems, notes, degraded }. actions are in the order to run them, at most one a problem.
export function plan(health, ledger, input) {
  const nowMs = toMs(input.nowMs);
  const names = Object.keys(problems).filter(name => health[name]);
  const actions = [];
  const notes = [];
  const next = {};

  names.forEach(name => {
    const check = health[name];
    const kept = ledger.problems[name] || { since: 0, lastStep: 0, lastActionAt: 0, lastAction: '', degradedSince: 0, degradedWhy: '', healthySince: 0 };
    const state = Object.assign({}, kept);

    if (check.ok === true) {
      // A problem that has cleared starts again at the bottom, and its degraded mode runs out after a day of quiet
      if (state.lastStep > 0 || state.since > 0) notes.push(problems[name].words + ' is fixed.');
      state.since = 0;
      state.lastStep = 0;
      state.lastAction = '';
      if (state.healthySince === 0) state.healthySince = nowMs;
      if (state.degradedSince > 0 && nowMs - state.healthySince >= limits.degradedHours * hour) {
        state.degradedSince = 0;
        state.degradedWhy = '';
        notes.push('automatic fixes for ' + problems[name].words + ' are on again after a day without trouble.');
      }
      next[name] = state;
      return;
    }

    state.healthySince = 0;
    if (state.since === 0) state.since = check.since > 0 ? check.since : nowMs;

    const chosen = stepFor(name, health, ledger, input);
    if (chosen.action === 'none') {
      next[name] = state;
      return;
    }
    if (chosen.action === 'reboot') {
      const gate = gateReboot({ reason: 'recovery', problem: name, nowMs: nowMs, uptimeSeconds: input.uptimeSeconds, networkOk: input.networkOk }, ledger);
      if (!gate.allowed) {
        // A refused reboot is the end of the ladder for now: the step is marked so the ladder does not ask every minute
        state.lastStep = 5;
        state.lastActionAt = nowMs;
        state.lastAction = 'reboot-refused';
        notes.push('the computer did not reboot for ' + problems[name].words + ': ' + gate.why);
        next[name] = state;
        return;
      }
      actions.push({ problem: name, step: 5, action: 'reboot', why: chosen.why, gate: gate.why });
      state.lastStep = 5;
      state.lastActionAt = nowMs;
      state.lastAction = 'reboot';
      next[name] = state;
      return;
    }

    actions.push({ problem: name, step: chosen.step, action: chosen.action, service: chosen.service || '', why: chosen.why });
    state.lastStep = chosen.step;
    state.lastActionAt = nowMs;
    state.lastAction = chosen.action;
    next[name] = state;
  });

  return { actions: actions, problems: next, notes: notes };
}

// Degraded mode is entered here, not in the ladder: it is about what happened across a reboot.
//   A recovery reboot whose problem is failing again within half an hour of the boot means rebooting does not help.
//   Three boots in an hour for any reason means the computer is in a boot loop, and only a person may reboot it.
// Gives { problems, degradedAll, notifications } to merge into the ledger.
export function afterBoot(health, ledger, input) {
  const nowMs = toMs(input.nowMs);
  const uptime = Number(input.uptimeSeconds) || 0;
  const notifications = [];
  const problemsNext = {};
  let degradedAll = ledger.degradedAll;

  const bootsInWindow = ledger.boots.filter(at => at <= nowMs && nowMs - at < limits.bootLoopMinutes * minute);
  if (bootsInWindow.length >= limits.bootLoopBoots && !degradedAll) {
    degradedAll = { since: nowMs, why: 'the computer restarted ' + bootsInWindow.length + ' times in an hour, so it stopped restarting itself.' };
    notifications.push(degradedAll.why);
  }

  if (uptime > 0 && uptime < limits.didNotHelpMinutes * 60) {
    const last = ledger.reboots.filter(item => item.at <= nowMs).sort((a, b) => b.at - a.at)[0];
    if (last && autoReasons.includes(last.reason) && last.problem && health[last.problem] && health[last.problem].ok === false) {
      const kept = ledger.problems[last.problem] || {};
      if (!(kept.degradedSince > 0)) {
        const why = 'restarting the computer did not fix ' + (problems[last.problem] ? problems[last.problem].words : last.problem) + ', so it stopped restarting for that.';
        problemsNext[last.problem] = Object.assign({}, kept, { degradedSince: nowMs, degradedWhy: why });
        notifications.push(why);
      }
    }
  }

  return { problems: problemsNext, degradedAll: degradedAll, notifications: notifications };
}

// What the Control page and the Studio say, in plain words.
export function stateWords(health, ledger, nowMs) {
  const failing = Object.keys(problems).filter(name => health[name] && health[name].ok === false);
  const paused = failing.filter(name => degradedFor(ledger, name, toMs(nowMs)));
  if (ledger.degradedAll && degradedFor(ledger, '', toMs(nowMs))) return 'Automatic fixes are paused: ' + ledger.degradedAll.why;
  if (failing.length === 0) return 'Everything is fine.';
  if (paused.length > 0) return 'Automatic fixes are paused: ' + problems[paused[0]].words + '.';
  const worst = failing[0];
  const kept = ledger.problems[worst];
  const step = kept && kept.lastStep > 0 ? kept.lastStep : 1;
  return 'Fixing: ' + problems[worst].words + ' (step ' + step + ' of ' + steps.length + ').';
}

// ----- as a command -----

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return null;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const mode = process.argv[2];
  const first = readJson(process.argv[3]);
  const ledger = readLedger(readJson(process.argv[4]));
  if (!first) {
    console.error('supervisor-plan: the input file could not be read.');
    process.exit(1);
  }
  if (mode === 'gate') {
    process.stdout.write(JSON.stringify(gateReboot(first, ledger)) + '\n');
  } else if (mode === 'plan') {
    const health = readHealth(first);
    const input = { nowMs: toMs(first.nowMs) || Date.now(), uptimeSeconds: Number(first.uptimeSeconds) || 0, bootId: String(first.bootId || ''), networkOk: first.networkOk === true };
    const boot = afterBoot(health, ledger, input);
    const made = plan(health, ledger, input);
    process.stdout.write(JSON.stringify({
      actions: made.actions,
      problems: Object.assign({}, made.problems, boot.problems),
      degradedAll: boot.degradedAll,
      notes: made.notes.concat(boot.notifications),
      words: stateWords(health, ledger, input.nowMs),
    }) + '\n');
  } else {
    console.error('supervisor-plan: say plan or gate.');
    process.exit(1);
  }
}
