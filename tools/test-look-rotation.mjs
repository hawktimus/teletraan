// Tests for the look rotation (dashboard/core/look-rotation.js): the style of the day, the order of
// the passes in a cycle, the boundary rule, a screen that restarts, one style and one team holding for
// ever, empty lists giving the choice back to Style and Team mode, the Next look now guard and what
// each press does. The two modules that hold the style and the team (core/style.js and core/teams.js)
// are run too, and so is core/schedule.js with stand-ins for the page, for the question it asks at the
// end of every pass. Nothing is drawn and no clock runs.
//
//   node tools/test-look-rotation.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const docsFolder = fileURLToPath(new URL('../docs/', import.meta.url));
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-look-rotation-'));
fs.mkdirSync(path.join(workFolder, 'dashboard/core'), { recursive: true });
fs.mkdirSync(path.join(workFolder, 'dashboard/themes/overlays'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js', 'themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(workFolder, 'dashboard', file));
});
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(workFolder, 'dashboard/core', file));
});
const base = pathToFileURL(path.join(workFolder, 'dashboard')).href + '/';
const config = await import(base + 'config.js');
const rotation = await import(base + 'core/look-rotation.js');
const styleModule = await import(base + 'core/style.js');
const teamsModule = await import(base + 'core/teams.js');
const previewModule = await import(base + 'core/preview.js');
const { contentQuery, normalizeContent, normalizeSample } = await import(base + 'core/sanity.js');
const { withDefaults } = await import(base + 'core/content.js');
const { handledKey: announceKey } = await import(base + 'core/announce.js');

const { bootLook, dayNumber, makeLookRotation, makeNextLookRunner, mondayCards, planCycle, styleForDay, teamsInOrder, tidyNextLookRequest } = rotation;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// The calendar in New York, which is the time zone of the Look page. October 12 2026 is a Monday.
const noonOnTheTwelfth = new Date('2026-10-12T16:00:00Z');
const seconds = (from, count) => new Date(from.getTime() + count * 1000);
const days = (from, count) => new Date(from.getTime() + count * 86400 * 1000);

const prime = { code: 'prime', name: 'HAWKTIMUS PRIME', active: true };
const nova = { code: 'nova', name: 'HAWKTIMUS NOVA', active: true };

// Content with the starting settings and both teams, and what a test changes
function contentWith(settings, extra) {
  return withDefaults(Object.assign({ teams: [prime, nova], settings: settings || {} }, extra));
}

// Prime has Monday rows and Nova has none
const primeHasMonday = (content, code) => (code === 'prime' ? [{ panel: 'monday-tasks', show: true }, { panel: 'monday-charts', show: true }] : []);

// A stand-in for localStorage that keeps its values in an object
function fakeStorage() {
  const kept = {};
  return {
    kept: kept,
    getItem: name => (name in kept ? kept[name] : null),
    setItem: (name, value) => { kept[name] = String(value); },
  };
}

// A storage that is switched off, the way a browser can have it: every call throws
const brokenStorage = {
  getItem: () => { throw new Error('storage is off'); },
  setItem: () => { throw new Error('storage is off'); },
};

// A rotation over this content, with a storage of its own unless a test gives one
function rotationFor(content, extra) {
  return makeLookRotation(Object.assign({ getContent: () => content, storage: fakeStorage(), mondayCards: primeHasMonday }, extra));
}

// Walks a rotation from its start through this many passes, each one lasting twenty seconds (the
// shortest pass is 15). Returns what the screen showed in each pass: { team, kind, style }.
function walk(machine, from, count) {
  const shown = [];
  let held = machine.begin(from);
  shown.push(Object.assign({ kind: machine.pass().kind }, held));

  for (let step = 1; step < count; step++) {
    const result = machine.boundary(seconds(from, step * 20));
    held = result.look || held;
    shown.push({ team: held.team, kind: machine.pass().kind, style: held.style });
  }
  return shown;
}

const other = style => (style === 'original' ? 'cybertron' : 'original');

// The day -------------------------------------------------------------------------

test('a day is the same number from midnight to midnight in the time zone of the Look page, and one more after it', () => {
  const zone = 'America/New_York'; // 4 hours behind UTC in October
  const first = dayNumber(zone, new Date('2026-10-12T04:00:00Z')); // midnight in New York
  assert.equal(dayNumber(zone, new Date('2026-10-12T03:59:59Z')), first - 1);
  assert.equal(dayNumber(zone, new Date('2026-10-12T04:00:00Z')), first);
  assert.equal(dayNumber(zone, new Date('2026-10-12T16:00:00Z')), first);
  assert.equal(dayNumber(zone, new Date('2026-10-13T03:59:59Z')), first);
  assert.equal(dayNumber(zone, new Date('2026-10-13T04:00:00Z')), first + 1);
});

test('the day changes at midnight on the clock of the zone, also on the night the clocks go back', () => {
  const zone = 'America/New_York';
  const november = dayNumber(zone, new Date('2026-11-01T12:00:00Z')); // the clocks go back at 2 AM that morning
  assert.equal(dayNumber(zone, new Date('2026-11-02T04:59:59Z')), november, 'still the first, at 11:59 PM in standard time');
  assert.equal(dayNumber(zone, new Date('2026-11-02T05:00:00Z')), november + 1);
  assert.equal(dayNumber(zone, new Date('2026-03-08T12:00:00Z')) + 1, dayNumber(zone, new Date('2026-03-09T12:00:00Z')), 'and when they go forward');
});

test('the zone, and not the computer, says which day it is, and a zone that is not one is the Look page default', () => {
  const instant = new Date('2026-10-12T20:00:00Z'); // 4 PM in New York and 5 AM the next day in Tokyo
  assert.equal(dayNumber('Asia/Tokyo', instant), dayNumber('America/New_York', instant) + 1);
  [undefined, null, '', 'Nowhere/Land', 5].forEach(zone => assert.equal(dayNumber(zone, instant), dayNumber(config.defaultThemeSettings.timeZone, instant), String(zone)));
});

test('the style of a day is the list taken round and round by the number of the day', () => {
  const list = ['original', 'cybertron'];
  assert.equal(styleForDay(list, 20000), 'original');
  assert.equal(styleForDay(list, 20001), 'cybertron');
  assert.equal(styleForDay(list, 20002), 'original');

  const three = ['original', 'cybertron', 'minimal'];
  assert.deepEqual([6, 7, 8, 9, 10].map(number => styleForDay(three, number)), ['original', 'cybertron', 'minimal', 'original', 'cybertron']);
  assert.equal(styleForDay(three, -1), 'minimal', 'a day before 1970 still has a style');
  assert.equal(styleForDay(['cybertron', 'cybertron', 'original'], 3), 'cybertron', 'a style that comes twice has two days of three');
});

test('a list with nothing in it has no style, and a name that is not a style is left out', () => {
  [[], undefined, null, 'original', {}, ['red', '']].forEach(list => assert.equal(styleForDay(list, 5), '', JSON.stringify(list)));
  assert.equal(styleForDay(['red', 'cybertron'], 8), 'cybertron');
});

// The cycle -----------------------------------------------------------------------

test('a cycle of two styles, two teams and Monday rows on one team is Prime, Prime Monday, Nova, in that order', () => {
  const passes = planCycle({ style: 'original', mondayStyle: 'minimal', teams: ['prime', 'nova'], hasMonday: code => code === 'prime' });
  assert.deepEqual(passes, [
    { team: 'prime', style: 'original', kind: 'panels' },
    { team: 'prime', style: 'minimal', kind: 'monday' },
    { team: 'nova', style: 'original', kind: 'panels' },
  ]);
});

test('the screen walks that cycle, and starts it again after the last pass', () => {
  const content = contentWith({});
  const today = styleForDay(config.defaultSettings.dailyStyles, dayNumber('America/New_York', noonOnTheTwelfth));
  const shown = walk(rotationFor(content), noonOnTheTwelfth, 6);

  assert.deepEqual(shown.slice(0, 3), [
    { team: 'prime', kind: 'panels', style: today },
    { team: 'prime', kind: 'monday', style: 'minimal' },
    { team: 'nova', kind: 'panels', style: today },
  ]);
  assert.deepEqual(shown.slice(3), shown.slice(0, 3), 'and over again');
});

test('tomorrow the cycle is the same passes in the other style, and the Monday pass keeps its own', () => {
  const content = contentWith({});
  const today = walk(rotationFor(content), noonOnTheTwelfth, 3);
  const tomorrow = walk(rotationFor(content), days(noonOnTheTwelfth, 1), 3);
  const style = today[0].style;

  assert.deepEqual(today.map(pass => pass.style), [style, 'minimal', style]);
  assert.deepEqual(tomorrow.map(pass => pass.style), [other(style), 'minimal', other(style)]);
  assert.deepEqual(tomorrow.map(pass => pass.team + ' ' + pass.kind), today.map(pass => pass.team + ' ' + pass.kind));
  assert.deepEqual(walk(rotationFor(content), days(noonOnTheTwelfth, 2), 1)[0].style, style, 'and the day after is the first again');
});

test('the style of the day is picked at the first pass that ends after midnight', () => {
  const content = contentWith({}, { teams: [prime] });
  const late = new Date('2026-10-13T03:59:30Z'); // 11:59:30 PM in New York
  const machine = rotationFor(content, { mondayCards: () => [] });
  const first = machine.begin(late);
  assert.equal(first.style, styleForDay(config.defaultSettings.dailyStyles, dayNumber('America/New_York', late)));

  assert.equal(machine.boundary(seconds(late, 20)).look, null, 'twenty seconds on it is midnight, and the pass has not ended yet');
  const result = machine.boundary(seconds(late, 40));
  assert.deepEqual(result.look, { style: other(first.style), team: 'prime' }, 'the next pass end brings the new style');
  assert.equal(result.moved, false, 'with one team there is no other pass to go to');
});

test('the teams in order are the ones that are in the list and switched on, each once, in the order of the setting', () => {
  const off = Object.assign({}, nova, { active: false });
  assert.deepEqual(teamsInOrder(['nova', 'prime'], [prime, nova]).map(team => team.code), ['nova', 'prime']);
  assert.deepEqual(teamsInOrder(['prime', 'nova'], [prime, off]).map(team => team.code), ['prime'], 'a team that is switched off does not count');
  assert.deepEqual(teamsInOrder(['prime', 'nova', 'prime', 'ghost'], [prime, nova]).map(team => team.code), ['prime', 'nova'], 'a repeat and a team that is not there are left out');
  assert.deepEqual(teamsInOrder(['prime', 'nova'], []).map(team => team.code), ['prime'], 'with no teams in the Studio there is the built-in Prime');
  assert.deepEqual(teamsInOrder(undefined, [prime]), []);
});

test('Nova first puts the Nova pass first, and a team with no Monday rows has no Monday pass', () => {
  const content = contentWith({ teamOrder: ['nova', 'prime'] });
  const shown = walk(rotationFor(content), noonOnTheTwelfth, 3);
  assert.deepEqual(shown.map(pass => pass.team + ' ' + pass.kind), ['nova panels', 'prime panels', 'prime monday']);

  const none = walk(rotationFor(content, { mondayCards: () => [] }), noonOnTheTwelfth, 4);
  assert.deepEqual(none.map(pass => pass.team + ' ' + pass.kind), ['nova panels', 'prime panels', 'nova panels', 'prime panels']);
});

test('until the Monday cards are built no team has a Monday pass', () => {
  assert.deepEqual(mondayCards(contentWith({}), 'prime'), []);
  const shown = walk(makeLookRotation({ getContent: () => contentWith({}), storage: fakeStorage() }), noonOnTheTwelfth, 4);
  assert.deepEqual(shown.map(pass => pass.team + ' ' + pass.kind), ['prime panels', 'nova panels', 'prime panels', 'nova panels']);
});

test('the list of the large panel is the Monday cards of the team in a Monday pass, and the usual list in the others', () => {
  const machine = rotationFor(contentWith({}));
  const usual = [{ panel: 'tasks', show: true }];
  machine.begin(noonOnTheTwelfth);
  assert.equal(machine.playlist(usual, contentWith({})), usual);

  machine.boundary(seconds(noonOnTheTwelfth, 20));
  assert.equal(machine.pass().kind, 'monday');
  assert.deepEqual(machine.playlist(usual, contentWith({})), primeHasMonday(null, 'prime'));
  machine.boundary(seconds(noonOnTheTwelfth, 40));
  assert.equal(machine.playlist(usual, contentWith({})), usual);
});

test('the swap is the setting, and assemble when the setting is not one', () => {
  ['assemble', 'slats', 'cut'].forEach(how => {
    const machine = rotationFor(contentWith({ lookSwap: how }));
    machine.begin(noonOnTheTwelfth);
    assert.equal(machine.boundary(seconds(noonOnTheTwelfth, 20)).swap, how);
  });
  const odd = rotationFor({ settings: { lookSwap: 'fade', dailyStyles: ['original'], teamOrder: ['prime'] }, teams: [prime] });
  odd.begin(noonOnTheTwelfth);
  assert.equal(odd.boundary(seconds(noonOnTheTwelfth, 20)).swap, 'assemble');
});

// The boundary rule ---------------------------------------------------------------

test('the rotation moves only when it is asked at the end of a pass, and then only if the pass has run its shortest time', () => {
  const machine = rotationFor(contentWith({}));
  machine.begin(noonOnTheTwelfth);
  const asked = seconds(noonOnTheTwelfth, 5);

  machine.keep(asked); // a once-a-second look is not a boundary
  assert.deepEqual(machine.pass(), { team: 'prime', kind: 'panels' });
  assert.equal(config.lookShortestSeconds, 15);

  const early = machine.boundary(seconds(noonOnTheTwelfth, config.lookShortestSeconds - 1));
  assert.deepEqual([early.moved, early.look], [false, null], 'a pass that has run 14 seconds goes on');
  assert.deepEqual(machine.pass(), { team: 'prime', kind: 'panels' });

  const due = machine.boundary(seconds(noonOnTheTwelfth, config.lookShortestSeconds));
  assert.equal(due.moved, true);
  assert.deepEqual(machine.pass(), { team: 'prime', kind: 'monday' });
  assert.deepEqual(due.look, { style: 'minimal', team: 'prime' });
  assert.equal(due.kind, 'monday');
});

test('the look is handed on only when it is not the one held, so a pass in the same look has no swap', () => {
  const content = contentWith({ mondayStyle: 'original', dailyStyles: ['original'], teamOrder: ['prime'] });
  const machine = rotationFor(content);
  machine.begin(noonOnTheTwelfth);

  const result = machine.boundary(seconds(noonOnTheTwelfth, 20));
  assert.equal(result.moved, true, 'the Monday cards are another list');
  assert.equal(result.look, null, 'in the same style and the same team');
});

test('nothing moves while an alert, an announcement, a talk, a demo, the night screen or a hidden transition has the screen', () => {
  let busy = false;
  const machine = rotationFor(contentWith({}), { busy: () => busy });
  machine.begin(noonOnTheTwelfth);

  busy = true;
  const waiting = machine.boundary(seconds(noonOnTheTwelfth, 60));
  assert.deepEqual([waiting.moved, waiting.look], [false, null]);
  assert.deepEqual(machine.pass(), { team: 'prime', kind: 'panels' }, 'it is in the same pass when the screen is free again');
  assert.equal(machine.next(seconds(noonOnTheTwelfth, 61)).moved, false, 'and Next look now waits too');

  busy = false;
  const free = machine.boundary(seconds(noonOnTheTwelfth, 62));
  assert.equal(free.moved, true);
  assert.deepEqual(machine.pass(), { team: 'prime', kind: 'monday' });
});

test('the page asks for the screen through one busy check that has every one of those, and the swap itself', () => {
  const run = read('core/look-rotation-run.js');
  const busy = /function busy\(\) \{\s*return ([^;]+);/.exec(run);

  assert.ok(busy, 'look-rotation-run.js has a busy function');
  ['swapping', 'takeoverRunning()', 'demoRunning()', 'nightIsUp()', 'hiddenPlaying()'].forEach(name => assert.ok(busy[1].includes(name), 'busy checks ' + name));
  assert.ok(run.includes('makeLookRotation({ getContent: getContent, storage: storage, busy: busy })'));
  assert.ok(run.includes('makeNextLookRunner({ getContent: getContent, storage: storage, busy: busy, next: pressed })'));
  assert.ok(read('core/takeover.js').includes('return running !== null || frame.isPaused();'), 'takeoverRunning is true for an alert, an announcement and a talk');
});

test('the swap pauses the rotation by the count other callers use, and gives it back whatever happens', () => {
  const run = read('core/look-rotation-run.js');
  assert.ok(/async function assemble\(look\) \{\s*pauseRotation\(\);\s*try \{/.test(run));
  assert.ok(/\} finally \{\s*restartRotation\(\);\s*resumeRotation\(\);/.test(run), 'the lists restart and the pause is let go in finally');
  assert.equal((run.match(/pauseRotation\(\)/g) || []).length, 1);
  assert.equal((run.match(/resumeRotation\(\)/g) || []).length, 1);
});

// A screen that restarts ------------------------------------------------------------

test('a screen that restarts lands on the style of the day, however long it was off and whatever it had kept', () => {
  const content = contentWith({});
  const style = walk(rotationFor(content), noonOnTheTwelfth, 1)[0].style;

  [noonOnTheTwelfth, seconds(noonOnTheTwelfth, 3 * 3600), seconds(noonOnTheTwelfth, -9 * 3600), new Date('2026-10-13T03:59:00Z')].forEach(moment => {
    const booted = bootLook(content, null, moment);
    assert.deepEqual(booted, { style: style, team: 'prime' }, moment.toISOString());
  });
  assert.equal(bootLook(content, null, days(noonOnTheTwelfth, 1)).style, other(style), 'and the next day the other');
});

test('a screen that restarts with a pass written down a moment ago goes on in that pass', () => {
  const content = contentWith({});
  const storage = fakeStorage();
  const machine = rotationFor(content, { storage: storage });
  machine.begin(noonOnTheTwelfth);
  machine.boundary(seconds(noonOnTheTwelfth, 20)); // the Monday pass, in Minimal: the page reloads for the layout
  assert.ok(storage.kept[rotation.stateKey], 'the pass is written down');

  const booted = bootLook(content, storage, seconds(noonOnTheTwelfth, 25), primeHasMonday);
  assert.deepEqual(booted, { style: 'minimal', team: 'prime' });

  const again = rotationFor(content, { storage: storage });
  assert.deepEqual(again.begin(seconds(noonOnTheTwelfth, 25)), { style: 'minimal', team: 'prime' });
  assert.deepEqual(again.pass(), { team: 'prime', kind: 'monday' });
  assert.equal(again.boundary(seconds(noonOnTheTwelfth, 30)).moved, false, 'and its time began when the pass did, so 15 seconds are not over yet');
  assert.equal(again.boundary(seconds(noonOnTheTwelfth, 36)).moved, true);
});

test('a pass written down long ago, one that is no longer in the cycle, and a storage that fails all start at the first pass', () => {
  const content = contentWith({});
  const storage = fakeStorage();
  const machine = rotationFor(content, { storage: storage });
  machine.begin(noonOnTheTwelfth);
  machine.boundary(seconds(noonOnTheTwelfth, 20));
  const stale = seconds(noonOnTheTwelfth, 20 + config.lookResumeSeconds + 1);

  assert.equal(bootLook(content, storage, stale, primeHasMonday).team, 'prime');
  assert.equal(bootLook(content, storage, stale, primeHasMonday).style, walk(rotationFor(content), noonOnTheTwelfth, 1)[0].style, 'the first pass, in the style of the day');

  // Prime has no Monday rows any more
  const gone = makeLookRotation({ getContent: () => content, storage: storage, mondayCards: () => [] });
  assert.equal(gone.begin(seconds(noonOnTheTwelfth, 25)).style, walk(rotationFor(content), noonOnTheTwelfth, 1)[0].style);
  assert.deepEqual(gone.pass(), { team: 'prime', kind: 'panels' });

  assert.deepEqual(bootLook(content, brokenStorage, noonOnTheTwelfth).team, 'prime');
  assert.doesNotThrow(() => rotationFor(content, { storage: brokenStorage }).begin(noonOnTheTwelfth));
  ['not json', '{}', '{"team":"prime"}', 'null', '5'].forEach(text => {
    const odd = fakeStorage();
    odd.kept[rotation.stateKey] = text;
    assert.equal(bootLook(content, odd, noonOnTheTwelfth).team, 'prime', text);
  });
});

test('the screen starts with nothing held when there is no saved copy of the content', () => {
  assert.deepEqual(bootLook(null, fakeStorage(), noonOnTheTwelfth), { style: '', team: '' });
  assert.deepEqual(bootLook(undefined, null, noonOnTheTwelfth), { style: '', team: '' });
});

test('a pass worked out only to start with writes nothing down', () => {
  const storage = fakeStorage();
  bootLook(contentWith({}), storage, noonOnTheTwelfth);
  assert.deepEqual(storage.kept, {});
});

test('the pass is written down again every half minute, so a reload long into a pass goes on in it', () => {
  const storage = fakeStorage();
  const machine = rotationFor(contentWith({}), { storage: storage });
  machine.begin(noonOnTheTwelfth);
  const first = storage.kept[rotation.stateKey];

  machine.keep(seconds(noonOnTheTwelfth, 10));
  assert.equal(storage.kept[rotation.stateKey], first, 'not before 30 seconds');
  machine.keep(seconds(noonOnTheTwelfth, 31));
  assert.notEqual(storage.kept[rotation.stateKey], first);
  assert.equal(JSON.parse(storage.kept[rotation.stateKey]).since, noonOnTheTwelfth.getTime(), 'with the time the pass began');
});

// One look holds, and empty lists give the choice back ------------------------------

test('one style and one team make one pass for ever, over days, and nothing is ever handed on', () => {
  const content = contentWith({ dailyStyles: ['cybertron'], teamOrder: ['prime'] });
  const machine = rotationFor(content, { mondayCards: () => [] });
  assert.deepEqual(machine.begin(noonOnTheTwelfth), { style: 'cybertron', team: 'prime' });

  for (let step = 1; step <= 40; step++) {
    const result = machine.boundary(seconds(noonOnTheTwelfth, step * 20000));
    assert.deepEqual([result.moved, result.look], [false, null], 'boundary ' + step);
  }
  assert.equal(machine.next(days(noonOnTheTwelfth, 5)).moved, false);
});

test('one style and two teams change the team and never the style, and two styles and one team change the style at midnight', () => {
  const styles = walk(rotationFor(contentWith({ dailyStyles: ['minimal'] }), { mondayCards: () => [] }), noonOnTheTwelfth, 4);
  assert.deepEqual(styles.map(pass => pass.style), ['minimal', 'minimal', 'minimal', 'minimal']);
  assert.deepEqual(styles.map(pass => pass.team), ['prime', 'nova', 'prime', 'nova']);

  const one = rotationFor(contentWith({ teamOrder: ['nova'] }), { mondayCards: () => [] });
  const start = one.begin(noonOnTheTwelfth);
  assert.equal(one.boundary(seconds(noonOnTheTwelfth, 20)).look, null);
  const tomorrow = one.boundary(days(noonOnTheTwelfth, 1));
  assert.deepEqual(tomorrow.look, { style: other(start.style), team: 'nova' });
  assert.equal(tomorrow.moved, false);
});

test('a team that is not there or is switched off leaves the order, and only teams that are not leave one pass', () => {
  const off = contentWith({ teamOrder: ['nova', 'prime'] }, { teams: [prime, Object.assign({}, nova, { active: false })] });
  assert.deepEqual(walk(rotationFor(off, { mondayCards: () => [] }), noonOnTheTwelfth, 3).map(pass => pass.team), ['prime', 'prime', 'prime']);
});

test('an empty Styles by day gives the style back to Style, and an empty Team order gives the team back to Team mode', () => {
  const noStyles = contentWith({ dailyStyles: [] });
  const withoutStyles = walk(rotationFor(noStyles, { mondayCards: () => [] }), noonOnTheTwelfth, 2);
  assert.deepEqual(withoutStyles.map(pass => pass.style), ['', ''], 'no style is held, and the setting decides');
  assert.deepEqual(withoutStyles.map(pass => pass.team), ['prime', 'nova'], 'the teams still take turns');

  const noTeams = contentWith({ teamOrder: [] });
  const withoutTeams = walk(rotationFor(noTeams), noonOnTheTwelfth, 3);
  assert.deepEqual(withoutTeams.map(pass => pass.team), ['', '', ''], 'no team is held, and Team mode decides');
  assert.deepEqual(withoutTeams.map(pass => pass.kind), ['panels', 'panels', 'panels'], 'with no team there is no Monday pass');
  assert.equal(withoutTeams[0].style, styleForDay(config.defaultSettings.dailyStyles, dayNumber('America/New_York', noonOnTheTwelfth)));
});

test('both lists empty hold nothing at all, so the screen is as it was before the rotation', () => {
  const both = contentWith({ dailyStyles: [], teamOrder: [] });
  const machine = rotationFor(both);
  assert.deepEqual(machine.begin(noonOnTheTwelfth), { style: '', team: '' });
  for (let step = 1; step <= 5; step++) {
    const result = machine.boundary(days(noonOnTheTwelfth, step));
    assert.deepEqual([result.moved, result.look], [false, null]);
  }
  assert.deepEqual(bootLook(both, null, noonOnTheTwelfth), { style: '', team: '' });
});

test('teams named in Team order that do not exist count as an empty list', () => {
  const ghosts = contentWith({ teamOrder: ['ghost', 'spook'] });
  assert.equal(rotationFor(ghosts).begin(noonOnTheTwelfth).team, '');
});

test('a content with no settings at all holds nothing', () => {
  const machine = makeLookRotation({ getContent: () => ({}), storage: null });
  assert.deepEqual(machine.begin(noonOnTheTwelfth), { style: '', team: '' });
  const nothing = makeLookRotation({ getContent: () => null, storage: null });
  assert.deepEqual(nothing.begin(noonOnTheTwelfth), { style: '', team: '' });
});

// Cleaning the settings -------------------------------------------------------------

test('settings that are missing are the starting ones: Original then Cybertron, Minimal, Prime then Nova, assemble', () => {
  const settings = withDefaults({}).settings;
  assert.deepEqual(settings.dailyStyles, ['original', 'cybertron']);
  assert.equal(settings.mondayStyle, 'minimal');
  assert.deepEqual(settings.teamOrder, ['prime', 'nova']);
  assert.equal(settings.lookSwap, 'assemble');
  assert.deepEqual(config.defaultSettings.dailyStyles, ['original', 'cybertron']);
});

test('a list the editors emptied stays empty, and a list that is not a list is the starting list', () => {
  [normalizeSample, normalizeContent, withDefaults].forEach(through => {
    const emptied = through({ settings: { dailyStyles: [], teamOrder: [] } }).settings;
    assert.deepEqual([emptied.dailyStyles, emptied.teamOrder], [[], []]);

    ['text', 5, {}, null].forEach(value => {
      const odd = through({ settings: { dailyStyles: value, teamOrder: value } }).settings;
      assert.deepEqual([odd.dailyStyles, odd.teamOrder], [['original', 'cybertron'], ['prime', 'nova']], JSON.stringify(value));
    });
  });
});

test('a name that is not a style goes, a style may come twice, and a team code is lowercase and comes once', () => {
  const settings = normalizeContent({ settings: { dailyStyles: ['original', 'red', 'original', 'cybertron', 5, null], teamOrder: [' Prime ', 'NOVA', 'nova', 7, '', null, 'prime'] } }).settings;
  assert.deepEqual(settings.dailyStyles, ['original', 'original', 'cybertron']);
  assert.deepEqual(settings.teamOrder, ['prime', 'nova']);
});

test('a Monday style or a swap that is not one is the starting one', () => {
  ['plain', '', 5, null].forEach(value => {
    const settings = withDefaults({ settings: { mondayStyle: value, lookSwap: value } }).settings;
    assert.equal(settings.mondayStyle, 'minimal', String(value));
    assert.equal(settings.lookSwap, 'assemble', String(value));
  });
  const kept = withDefaults({ settings: { mondayStyle: 'cybertron', lookSwap: 'cut' } }).settings;
  assert.deepEqual([kept.mondayStyle, kept.lookSwap], ['cybertron', 'cut']);
});

test('the query sends the lists as lists, and Team order as the codes of its teams, so that a missing list is an empty one', () => {
  assert.ok(contentQuery.includes('"dailyStyles": coalesce(dailyStyles, [])'));
  assert.ok(contentQuery.includes('"teamOrder": coalesce(teamOrder[]->code, [])'));
  const fromSanity = normalizeContent({ settings: { dailyStyles: [], teamOrder: [] } }).settings;
  assert.deepEqual([fromSanity.dailyStyles, fromSanity.teamOrder], [[], []], 'a page published before the fields existed follows Style and Team mode');
});

test('the sample content has the rotation, with codes of the sample teams', () => {
  const sample = JSON.parse(read('data/sample/content.json'));
  const settings = normalizeSample(sample).settings;
  const codes = sample.teams.map(team => team.code);

  assert.deepEqual(settings.dailyStyles, ['original', 'cybertron']);
  assert.deepEqual(settings.teamOrder, ['prime', 'nova']);
  settings.teamOrder.forEach(code => assert.ok(codes.includes(code), code));
});

// Style and team are held, not set ------------------------------------------------

test('a style the rotation holds wins over the setting and loses to the address and to a preview', () => {
  const later = new Date(Date.now() + 60000);
  styleModule.rotateStyle('cybertron');
  try {
    assert.equal(styleModule.chooseStyle('original', null), 'cybertron');
    assert.equal(styleModule.chooseStyle('minimal', null), 'cybertron');
    assert.equal(styleModule.chooseStyle('original', 'minimal'), 'minimal', 'the address wins');

    styleModule.previewStyle('minimal', later.getTime());
    assert.equal(styleModule.chooseStyle('original', 'cybertron'), 'minimal', 'a preview wins over both');
    styleModule.previewStyle('', 0);
    assert.equal(styleModule.chooseStyle('original', null), 'cybertron', 'and it comes back when the preview is over');

    styleModule.rotateStyle('');
    assert.equal(styleModule.chooseStyle('minimal', null), 'minimal', 'an empty name lets go');
    styleModule.rotateStyle('plain');
    assert.equal(styleModule.chooseStyle('minimal', null), 'minimal', 'and so does a name that is not a style');
  } finally {
    styleModule.rotateStyle('');
    styleModule.previewStyle('', 0);
  }
});

test('a team the rotation holds wins over Team mode and loses to a preview and the address', () => {
  const content = { teams: [prime, nova], settings: { teamMode: 'prime', alternateMinutes: 5 } };
  const now = new Date();
  const wantedAfter = (rotated, extra) => {
    teamsModule.rotateTeam(rotated);
    if (extra) extra();
    teamsModule.useTeams(content, now);
    return teamsModule.wantedTeam().code;
  };

  try {
    assert.equal(wantedAfter('nova'), 'nova', 'Team mode says Prime and the rotation says Nova');
    assert.equal(wantedAfter(''), 'prime', 'an empty code lets go');
    assert.equal(wantedAfter('ghost'), 'prime', 'a team that is not there lets go');

    teamsModule.rotateTeam('nova');
    teamsModule.useTeams(Object.assign({}, content, { teams: [prime, Object.assign({}, nova, { active: false })] }), now);
    assert.equal(teamsModule.wantedTeam().code, 'prime', 'a team that is switched off lets go');

    assert.equal(wantedAfter('nova', () => teamsModule.previewTeam('prime', now.getTime() + 60000)), 'prime', 'a preview wins');
    assert.equal(wantedAfter('nova', () => teamsModule.previewTeam('', 0)), 'nova', 'and it comes back when the preview is over');
    assert.equal(wantedAfter('prime', () => teamsModule.askForTeam('nova')), 'nova', 'the address wins');
  } finally {
    teamsModule.rotateTeam('');
    teamsModule.askForTeam('');
    teamsModule.previewTeam('', 0);
  }
});

test('the style and the team go on the page only through the modules a preview uses, and the page change puts both on in one step', () => {
  const run = read('core/look-rotation-run.js');
  const areas = read('core/areas.js');

  assert.ok(/function holdLook\(look\) \{\s*rotateStyle\(look\.style\);\s*rotateTeam\(look\.team\);\s*useTeams\(getContent\(\), new Date\(\)\);\s*noteWantedTeam\(\);\s*checkTheme\(\);\s*\}/.test(run));
  ['applyStyle', 'applyTeamLook', 'dataset.style', 'classList', 'setProperty'].forEach(name => assert.ok(!run.includes(name), 'look-rotation-run.js should not touch the page with ' + name));
  assert.ok(areas.includes('if (region === themeRegion) changeThemeNow();\n    if (region === themeRegion) changeTeamNow();'), 'the page change still puts the style and the team on together');
  assert.ok(previewModule.previewKinds.cybertron.style === 'cybertron', 'the previews hold the style in the same module');
});

// Next look now ---------------------------------------------------------------------

test('a click is read as a time, and a time that is not one is no click', () => {
  assert.deepEqual(tidyNextLookRequest({ requestedAt: '2026-10-12T16:00:00.000Z' }), { requestedAt: '2026-10-12T16:00:00.000Z' });
  [undefined, null, {}, [], 'text', { requestedAt: 'soon' }, { requestedAt: 5 }, { requestedAt: '' }].forEach(raw => assert.deepEqual(tidyNextLookRequest(raw), { requestedAt: '' }, JSON.stringify(raw)));
});

// A runner with the rotation behind it. busy and the storage are the test's to change.
function runnerFor(requestedAt, extra) {
  const world = { calls: [], busy: false, requestedAt: requestedAt, storage: fakeStorage() };
  Object.assign(world, extra);
  world.runner = makeNextLookRunner({
    getContent: () => ({ settings: { nextLookRequest: { requestedAt: world.requestedAt } } }),
    storage: world.storage,
    busy: () => world.busy,
    next: now => world.calls.push(now.toISOString()),
  });
  return world;
}

test('a click from the last minute that is not the one handled before moves the look once', () => {
  const asked = '2026-10-12T16:00:00.000Z';
  const world = runnerFor(asked);

  world.runner.look(seconds(new Date(asked), 0));
  world.runner.look(seconds(new Date(asked), 1));
  world.runner.look(seconds(new Date(asked), 30));
  assert.equal(world.calls.length, 1, 'once, not every second');

  world.requestedAt = '2026-10-12T16:00:40.000Z';
  world.runner.look(new Date('2026-10-12T16:00:41Z'));
  assert.equal(world.calls.length, 2, 'a new click is a new request');
});

test('a click older than a minute never runs, so a screen that restarts does not move on for an old click', () => {
  const asked = '2026-10-12T16:00:00.000Z';
  const old = runnerFor(asked);
  old.runner.look(seconds(new Date(asked), 61));
  assert.equal(old.calls.length, 0);

  const edge = runnerFor(asked);
  edge.runner.look(seconds(new Date(asked), 60));
  assert.equal(edge.calls.length, 1, 'a minute exactly still counts');
  const empty = runnerFor('');
  empty.runner.look(new Date(asked));
  assert.equal(empty.calls.length, 0, 'no click, no move');
});

test('the click handled before is kept in localStorage under a name of its own, so a restart does not move on again', () => {
  const asked = '2026-10-12T16:00:00.000Z';
  const world = runnerFor(asked);
  world.runner.look(new Date(asked));

  assert.equal(world.storage.kept[rotation.handledKey], asked);
  assert.notEqual(rotation.handledKey, announceKey, 'apart from the announcements');
  assert.equal(rotation.handledKey, 'teletraan-next-look-handled');

  const restarted = runnerFor(asked, { storage: world.storage });
  restarted.runner.look(seconds(new Date(asked), 10));
  assert.equal(restarted.calls.length, 0, 'the new page knows it was handled');
});

test('a storage that fails still stops the same click from running twice while the page is open', () => {
  const asked = '2026-10-12T16:00:00.000Z';
  const world = runnerFor(asked, { storage: brokenStorage });
  world.runner.look(new Date(asked));
  world.runner.look(seconds(new Date(asked), 1));
  assert.equal(world.calls.length, 1);

  const none = runnerFor(asked, { storage: null });
  none.runner.look(new Date(asked));
  none.runner.look(seconds(new Date(asked), 1));
  assert.equal(none.calls.length, 1);
});

test('a click waits while something has the screen, and runs when it is free if it is still under a minute old', () => {
  const asked = '2026-10-12T16:00:00.000Z';
  const world = runnerFor(asked, { busy: true });
  world.runner.look(seconds(new Date(asked), 1));
  world.runner.look(seconds(new Date(asked), 20));
  assert.equal(world.calls.length, 0);

  world.busy = false;
  world.runner.look(seconds(new Date(asked), 30));
  assert.equal(world.calls.length, 1);

  const late = runnerFor(asked, { busy: true });
  late.runner.look(seconds(new Date(asked), 10));
  late.busy = false;
  late.runner.look(seconds(new Date(asked), 90));
  assert.equal(late.calls.length, 0, 'but not after the minute is over');
});

test('a click in the settings of content that has none is no click', () => {
  const world = runnerFor('');
  const runner = makeNextLookRunner({ getContent: () => null, storage: world.storage, busy: () => false, next: () => world.calls.push('x') });
  runner.look(noonOnTheTwelfth);
  const bare = makeNextLookRunner({ getContent: () => ({}), storage: world.storage, busy: () => false, next: () => world.calls.push('x') });
  bare.look(noonOnTheTwelfth);
  assert.equal(world.calls.length, 0);
});

test('each press moves one pass: to the Monday cards, and a second press while they are up moves past them', () => {
  const machine = rotationFor(contentWith({}));
  const style = machine.begin(noonOnTheTwelfth).style;
  const seen = [];
  const press = step => {
    const result = machine.next(seconds(noonOnTheTwelfth, step));
    seen.push(machine.pass().team + ' ' + machine.pass().kind);
    return result;
  };

  const first = press(1); // one second into the pass, which a press does not wait out
  assert.deepEqual(first.look, { style: 'minimal', team: 'prime' });
  assert.equal(first.moved, true);
  const second = press(2); // while the Monday cards are up
  assert.deepEqual(second.look, { style: style, team: 'nova' });
  const third = press(3);
  assert.deepEqual(third.look, { style: style, team: 'prime' }, 'and round to the first pass again');
  assert.deepEqual(seen, ['prime monday', 'nova panels', 'prime panels']);
});

test('a press with no Monday rows moves from team to team', () => {
  const machine = rotationFor(contentWith({}), { mondayCards: () => [] });
  machine.begin(noonOnTheTwelfth);
  const teams = [1, 2, 3].map(step => {
    machine.next(seconds(noonOnTheTwelfth, step));
    return machine.pass().team;
  });
  assert.deepEqual(teams, ['nova', 'prime', 'nova']);
});

test('a press that follows a press gives a pass its own time, so the next end of a pass does not skip it', () => {
  const machine = rotationFor(contentWith({}));
  machine.begin(noonOnTheTwelfth);
  machine.next(seconds(noonOnTheTwelfth, 100));

  assert.equal(machine.boundary(seconds(noonOnTheTwelfth, 105)).moved, false, 'five seconds into the Monday cards');
  assert.equal(machine.boundary(seconds(noonOnTheTwelfth, 116)).moved, true);
});

test('a press where there is one pass moves nothing, and a press moves nothing while the screen is busy', () => {
  const alone = rotationFor(contentWith({ dailyStyles: ['original'], teamOrder: ['prime'] }), { mondayCards: () => [] });
  alone.begin(noonOnTheTwelfth);
  const result = alone.next(seconds(noonOnTheTwelfth, 30));
  assert.deepEqual([result.moved, result.look], [false, null]);
});

test('a press hands on the swap of the setting', () => {
  const machine = rotationFor(contentWith({ lookSwap: 'cut' }));
  machine.begin(noonOnTheTwelfth);
  assert.equal(machine.next(seconds(noonOnTheTwelfth, 2)).swap, 'cut');
});

test('the page gives the runner a press that starts every list again, and a look that goes on through the same hold', () => {
  const run = read('core/look-rotation-run.js');
  assert.ok(/function pressed\(now\) \{\s*const result = rotation\.next\(now\);\s*if \(!result\.moved && !result\.look\) return;\s*rewindRotation\(\);\s*if \(result\.look\) swap\(result\.look, result\.swap\);\s*else pagesAgain\(\);\s*\}/.test(run));
  assert.ok(/async function atPass\(now\) \{\s*const result = rotation\.boundary\(now\);\s*if \(result\.look\) await swap\(result\.look, result\.swap\);\s*return result\.moved;\s*\}/.test(run));
  assert.ok(run.includes("setLookHooks({ atPass: atPass, playlist: list => rotation.playlist(list, getContent()) });"));
});

// The swaps ---------------------------------------------------------------------------

test('the three swaps are the ones in config.js, and each has its branch in the page', () => {
  const run = read('core/look-rotation-run.js');
  assert.deepEqual(config.lookSwaps, ['assemble', 'slats', 'cut']);
  config.lookSwaps.forEach(how => assert.ok(run.includes("how === '" + how + "'"), how + ' has a branch'));
  assert.ok(/if \(how === 'slats'\) useSlatsOnce\(\);/.test(run));
  assert.ok(/if \(how === 'cut'\) setTimeout\(cutScreen\(\), lookCutMilliseconds\);/.test(run));
});

test('the swaps use what the page already has: the first assembly, the slat change and the screen that is apart', () => {
  const run = read('core/look-rotation-run.js');
  const areas = read('core/areas.js');

  assert.ok(run.includes('restartRotation();'), 'assemble starts the lists again, so the frames get their first assembly');
  assert.ok(run.includes('frame.exit(element)') && run.includes('frame.enter(element)'), 'the banner and the countdown leave and come in again');
  assert.ok(/export function useSlatsOnce\(\) \{\s*areaRegions\.forEach\(region => slatsFor\.add\(region\)\);/.test(areas));
  assert.ok(areas.includes("if (slatsFor.delete(region)) change.style = 'slat';"), 'the slat change is forced for one page change of each area');
  assert.ok(/export function cutScreen\(\) \{\s*const screen = startWholeScreen\(\);\s*screen\.apart\(\);\s*return screen\.end;/.test(areas), 'the cut is the gate of the hidden transitions, held apart');
  assert.ok(/export async function retireAreas\(\) \{\s*await Promise\.all\(areaRegions\.filter\(region => areaOf\[region\]\)\.map\(region => frame\.retire\(areaOf\[region\]\)\)\);/.test(areas));
  assert.ok(config.lookCutMilliseconds >= 500 && config.lookCutMilliseconds <= 2000);
});

test('the swaps move only transform, opacity and lines: the new code has no animation of its own', () => {
  ['core/look-rotation.js', 'core/look-rotation-run.js'].forEach(file => {
    const source = read(file);
    ['blur', 'box-shadow', 'drop-shadow', 'requestAnimationFrame', '.animate(', 'keyframes', 'style.transform', 'style.opacity'].forEach(word => assert.ok(!source.includes(word), file + ' should not contain ' + word));
  });
});

test('the page starts the rotation after the team, before the style, and leaves it out of the test views and when the address asks', () => {
  const shell = read('shell.js');
  const team = shell.indexOf("askForTeam(params.get('team'));");
  const held = shell.indexOf('resumeSavedLook();', team);
  const style = shell.indexOf("startStyle(params.get('style'), savedStyle);");
  assert.ok(team !== -1 && held > team && style > held, 'the look is held after the team is asked for and before the style is chosen');
  assert.ok(shell.includes("if (params.get('show') || stress || onlyTasks) return;"));
  assert.ok(shell.includes("holdBootLook(savedContent(), storage, new Date());"));
  assert.ok(shell.includes("module.startLookRotation(getContent, params.has('style') || params.has('team'))"));
  assert.ok(shell.indexOf("'./core/look-rotation-run.js'") > shell.indexOf("'./core/team-run.js'"), 'after the ones it asks about');
  assert.ok(/if \(addressAsks\) return;/.test(read('core/look-rotation-run.js')));
});

// core/schedule.js, with stand-ins for the page ----------------------------------------

const scheduleTree = path.join(workFolder, 'schedule-tree');
['config.js', 'core/schedule.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(scheduleTree, 'dashboard', file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(scheduleTree, 'dashboard', file));
});
fs.writeFileSync(path.join(scheduleTree, 'package.json'), '{ "type": "module" }\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/frame.js'), [
  'export const pace = () => 1;',
  'export const turnMs = () => 0;',
  'export const isPaused = () => false;',
  'export const wait = () => new Promise(resolve => globalThis.scheduleWorld.waits.push(resolve));',
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/panels.js'), [
  'export function buildPage(id) {',
  "  globalThis.scheduleWorld.log.push('build ' + id);",
  '  return { id: id, element: {} };',
  '}',
  'export const canShow = id => globalThis.scheduleWorld.canShow(id);',
  'export const moduleOf = () => null;',
  'export const regionOf = id => globalThis.scheduleWorld.regions[id] || null;',
  'export const topicOf = () => null;',
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/photos.js'), 'export const ownSeconds = () => 0;\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/layout.js'), [
  'export const hasRegion = () => true;',
  "export const layoutNow = () => 'standard';",
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/areas.js'), [
  'export async function changePage(region, page) {',
  '  const world = globalThis.scheduleWorld;',
  "  world.log.push(region + ' ' + (page ? page.id : 'none'));",
  '  world.shown[region] = page;',
  '  return 0;',
  '}',
  'export function clearRegion(region) {',
  "  globalThis.scheduleWorld.log.push('clear ' + region);",
  '  globalThis.scheduleWorld.shown[region] = null;',
  '}',
].join('\n') + '\n');
let scheduleRuns = 0;

async function inRotation(run) {
  const world = { log: [], waits: [], shown: {}, canShow: () => true, regions: { a: 'grid1', b: 'grid1', c: 'grid1', x: 'grid1', y: 'grid1', d: 'grid2' } };
  globalThis.scheduleWorld = world;

  try {
    scheduleRuns += 1;
    world.module = await import(pathToFileURL(path.join(scheduleTree, 'dashboard/core/schedule.js')).href + '?run=' + scheduleRuns);
    world.content = { settings: { pageSeconds: 20, rotation: {} } };
    world.settle = async () => {
      for (let turn = 0; turn < 8; turn++) await new Promise(resolve => setImmediate(resolve));
    };
    // lets every wait go, a quarter of a second at a time, until this many seconds have passed
    world.pass = async count => {
      for (let quarter = 0; quarter < count * 4; quarter++) {
        world.waits.splice(0).forEach(resolve => resolve());
        await world.settle();
      }
    };
    world.pagesOf = region => world.log.filter(line => line.startsWith(region + ' ')).map(line => line.slice(region.length + 1));
    await run(world);
  } finally {
    delete globalThis.scheduleWorld;
  }
}

const steps = ids => ids.map(panel => ({ panel: panel, show: true }));
const gridPlaylist = steps(['a', 'b', 'c']);

test('the large panel asks the rotation once at the end of each pass of its list, and not at the start or in between', async () => {
  await inRotation(async world => {
    const asked = [];
    world.module.setLookHooks({ atPass: async () => { asked.push(world.pagesOf('grid1').join(' ')); return false; }, playlist: list => list });
    world.module.startRotation('grid1', () => gridPlaylist, () => world.content);
    await world.settle();
    await world.pass(20);
    await world.pass(20);
    assert.deepEqual(asked, [], 'a b are not the end of the list');
    await world.pass(20);
    assert.deepEqual(asked, ['a b c'], 'after c, before the next page');
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b', 'c', 'a'], 'and the pass goes on when the answer is no');
    await world.pass(60);
    assert.deepEqual(asked, ['a b c', 'a b c a b c']);
  });
});

test('an answer of yes starts the list the rotation gives from its first panel', async () => {
  await inRotation(async world => {
    let list = gridPlaylist;
    world.module.setLookHooks({ atPass: async () => { list = steps(['x', 'y']); return true; }, playlist: () => list });
    world.module.startRotation('grid1', () => gridPlaylist, () => world.content);
    await world.settle();
    await world.pass(60);
    await world.pass(20);
    await world.pass(20);
    await world.pass(20);

    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b', 'c', 'x', 'y', 'x', 'y'].slice(0, world.pagesOf('grid1').length));
    assert.deepEqual(world.pagesOf('grid1').slice(0, 5), ['a', 'b', 'c', 'x', 'y']);
  });
});

test('an answer of yes starts the next pass at the first panel it has content for, not where the last pass left off', async () => {
  await inRotation(async world => {
    world.canShow = id => id !== 'c'; // the team of the first pass has nothing for c
    world.module.setLookHooks({ atPass: async () => { world.canShow = () => true; return true; }, playlist: list => list });
    world.module.startRotation('grid1', () => gridPlaylist, () => world.content);
    await world.settle();
    await world.pass(60);
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b', 'a', 'b'], 'the pass ended after b, and the next one began again at a');
    await world.pass(20);
    assert.deepEqual(world.pagesOf('grid1').slice(4), ['c'], 'and now has c too');
  });
});

test('the page waits for the rotation to answer, and a rotation that fails leaves the pass going', async () => {
  await inRotation(async world => {
    let answer = null;
    world.module.setLookHooks({ atPass: () => new Promise(resolve => { answer = resolve; }), playlist: list => list });
    world.module.startRotation('grid1', () => steps(['a', 'b']), () => world.content);
    await world.settle();
    await world.pass(40);
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b']);
    await world.pass(40);
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b'], 'nothing changes while it is asked');

    answer(false);
    await world.settle();
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b', 'a']);
  });

  await inRotation(async world => {
    const complaints = [];
    const real = console.error;
    console.error = (...args) => complaints.push(args.join(' '));
    try {
      world.module.setLookHooks({ atPass: async () => { throw new Error('broken'); }, playlist: () => { throw new Error('broken too'); } });
      world.module.startRotation('grid1', () => steps(['a', 'b']), () => world.content);
      await world.settle();
      await world.pass(60);
    } finally {
      console.error = real;
    }
    assert.deepEqual(world.pagesOf('grid1').slice(0, 3), ['a', 'b', 'a']);
    assert.ok(complaints.some(line => line.includes('could not move to the next pass')));
    assert.ok(complaints.some(line => line.includes('could not give the list of the large panel')));
  });
});

test('the small panel and the ticker are never asked, and never use the list of the rotation', async () => {
  await inRotation(async world => {
    let asked = 0;
    let listed = 0;
    world.module.setLookHooks({ atPass: async () => { asked += 1; return false; }, playlist: () => { listed += 1; return steps(['a']); } });
    world.module.startRotation('grid2', () => steps(['d']), () => world.content);
    await world.settle();
    await world.pass(120);
    assert.equal(asked, 0);
    assert.equal(listed, 0);
    assert.ok(world.pagesOf('grid2').length >= 4);
    assert.ok(world.pagesOf('grid2').every(page => page === 'd'));
  });
});

test('a list of one panel is a pass of its own, so the rotation is asked at every page', async () => {
  await inRotation(async world => {
    let asked = 0;
    world.module.setLookHooks({ atPass: async () => { asked += 1; return false; }, playlist: list => list });
    world.module.startRotation('grid1', () => steps(['a']), () => world.content);
    await world.settle();
    await world.pass(60);
    assert.equal(asked, 3);
  });
});

test('without a rotation the lists go round as they always did', async () => {
  await inRotation(async world => {
    world.module.startRotation('grid1', () => gridPlaylist, () => world.content);
    await world.settle();
    await world.pass(60);
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b', 'c', 'a']);
  });
});

test('rewindRotation starts the lists again from the first panel and leaves the frames where they are', async () => {
  await inRotation(async world => {
    world.module.startRotation('grid1', () => gridPlaylist, () => world.content);
    await world.settle();
    await world.pass(20);
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b']);

    world.module.rewindRotation();
    world.module.moveOn(['grid1']);
    await world.pass(1);
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b', 'a'], 'the first panel and not the third');
    assert.ok(!world.log.some(line => line.startsWith('clear')), 'no frame was cleared');
  });
});

test('the rotation is not asked again right after a restart, and starts the new list at once', async () => {
  await inRotation(async world => {
    let asked = 0;
    world.module.setLookHooks({ atPass: async () => { asked += 1; return false; }, playlist: list => list });
    world.module.startRotation('grid1', () => gridPlaylist, () => world.content);
    await world.settle();
    await world.pass(40);
    world.module.rewindRotation();
    world.module.moveOn(['grid1']);
    await world.pass(1);

    assert.equal(asked, 0, 'the end of the list was next, but the list began again');
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b', 'c', 'a']);
  });
});

// The docs --------------------------------------------------------------------------

test('the docs name the four settings, the three swaps and the rule for an empty list', () => {
  const layouts = fs.readFileSync(path.join(docsFolder, 'layouts.md'), 'utf8').replace(/\s+/g, ' ');
  const editing = fs.readFileSync(path.join(docsFolder, 'editing-content.md'), 'utf8').replace(/\s+/g, ' ');

  assert.ok(layouts.includes('## The look rotation'), 'layouts.md has the section');
  ['Styles by day', 'Monday style', 'Team order', 'How the look changes', 'assemble', 'slats', 'cut', 'lookResumeSeconds', 'lookShortestSeconds', 'teletraan-look-pass'].forEach(word => assert.ok(layouts.includes(word), 'layouts.md names ' + word));
  ['Styles by day', 'Monday style', 'Team order', 'How the look changes', 'Assemble', 'Slats', 'Cut', 'Next look now'].forEach(word => assert.ok(editing.includes(word), 'editing-content.md names ' + word));
  assert.ok(layouts.includes('empty') && editing.includes('is empty'), 'both say what an empty list does');
  assert.ok(layouts.includes(String(config.lookResumeSeconds)) && layouts.includes(String(config.lookShortestSeconds)), 'layouts.md gives the two times');
});

// Run them

let failures = 0;
try {
  for (const entry of tests) {
    try {
      await entry.run();
      console.log('ok    ' + entry.name);
    } catch (error) {
      failures += 1;
      console.log('FAIL  ' + entry.name);
      console.log(error);
    }
  }
} finally {
  fs.rmSync(workFolder, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
