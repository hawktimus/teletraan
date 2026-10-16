// The booking path, checked with fixtures and not live (round 5, B8): three Meeting days (one closed), the
// talks the booking script saves, the Daily Agenda showing them, a talk starting at its time on the screen,
// and the no-show rule at 5 minutes.
//
// THE BOOKING SCRIPT IS NOT IN THE REPOSITORY. docs/presentations.md names
// tools/presentation-booking/presentation-booking.gs, and no such file, no slotsFromDays and no freeSlots
// exist anywhere in the repository or its history. So this test cannot run the script. It checks everything
// on this side of it, and it checks the slot rule as docs/presentations.md states it against the expected
// lists in tests/data/booking/booking.json. When the script is added, give its slot lists to the same
// fixture and compare (the expected lists were written for exactly that).
//
//   node tests/booking.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const testsFolder = fileURLToPath(new URL('.', import.meta.url));
const dashboardFolder = path.join(testsFolder, '../dashboard');
const studioFolder = path.join(testsFolder, '../studio');
const fixture = JSON.parse(fs.readFileSync(path.join(testsFolder, 'data/booking/booking.json'), 'utf8'));

// The dashboard files are browser modules named .js: a copy next to a package.json that says "type": "module"
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-booking-'));
const root = path.join(workFolder, 'dashboard');
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
function copyAll(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from, { withFileTypes: true }).forEach(entry => {
    if (entry.isDirectory()) copyAll(path.join(from, entry.name), path.join(to, entry.name));
    else if (/\.(js|json)$/.test(entry.name) && !to.includes('data')) copyModule(path.join(from, entry.name), path.join(to, entry.name));
  });
}
['core', 'themes', 'panels/tonight'].forEach(folder => copyAll(path.join(dashboardFolder, folder), path.join(root, folder)));
['config.js', 'registry.js'].forEach(file => copyModule(path.join(dashboardFolder, file), path.join(root, file)));

const base = pathToFileURL(root).href + '/';
const { normalizeContent } = await import(base + 'core/sanity.js');
const presentation = await import(base + 'core/presentation.js');
const tonight = await import(base + 'panels/tonight/panel.js');
const constants = await import(base + 'core/constants.js');
const { dueTalk, idleState, nextState, canRun } = presentation;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const minute = 60 * 1000;
const at = text => new Date(text);
const settings = { presentationsEnabled: true };

// The booking rule as docs/presentations.md states it
function slotsByRule(day) {
  if (day.open === false) return [];
  const slots = [];
  for (let time = Date.parse(day.firstSlotAt); time <= Date.parse(day.lastSlotAt); time += day.slotMinutes * minute) slots.push(new Date(time).toISOString().replace('.000Z', 'Z'));
  return slots;
}

function freeByRule(day, talks, now) {
  const taken = talks.filter(talk => talk.status === 'scheduled').map(talk => Date.parse(talk.start));
  return slotsByRule(day).filter(slot => Date.parse(slot) - now >= day.closeMinutesBefore * minute && !taken.includes(Date.parse(slot)));
}

function contentOf(extra) {
  return normalizeContent(Object.assign({ presentations: fixture.presentations, settings: { presentationsEnabled: true } }, extra));
}

test('the Meeting days: three, one closed, with the fields of the Studio type and the booking close time of 30 minutes', () => {
  assert.equal(fixture.meetingDays.length, 3);
  assert.deepEqual(fixture.meetingDays.map(day => day.open), [true, true, false]);

  const source = fs.readFileSync(path.join(studioFolder, 'schemas/presentationDay.js'), 'utf8');
  const names = Array.from(source.matchAll(/name: '(\w+)'/g)).map(match => match[1]);
  fixture.meetingDays.forEach(day => {
    Object.keys(day).filter(key => !key.startsWith('_') && key !== 'expectedSlots').forEach(key => assert.ok(names.includes(key), key + ' is not a field of presentationDay'));
    assert.equal(day.closeMinutesBefore, 30);
  });
  assert.ok(/closeMinutesBefore[\s\S]*?initialValue: 30/.test(source), 'closeMinutesBefore should start at 30 in the Studio type');
});

test('the slots of each day follow the rule: the first talk, then every length, up to and including the last talk; a closed day has none', () => {
  fixture.meetingDays.forEach(day => assert.deepEqual(slotsByRule(day), day.expectedSlots, day._id));
  assert.equal(fixture.meetingDays[0].expectedSlots.length, 7);
});

test('the free slots drop the ones inside the close time and the ones a scheduled talk holds, and a cancelled talk frees its slot', () => {
  const day = fixture.meetingDays.find(item => item._id === fixture.freeAt.day);
  assert.deepEqual(freeByRule(day, fixture.presentations, Date.parse(fixture.freeAt.now)), fixture.freeAt.expectedFree);
  // exactly 30 minutes ahead is still open, one minute less is closed
  assert.ok(freeByRule(day, [], Date.parse('2026-10-08T18:15:00Z')).includes('2026-10-08T18:45:00Z'));
  assert.ok(!freeByRule(day, [], Date.parse('2026-10-08T18:16:00Z')).includes('2026-10-08T18:45:00Z'));
  assert.deepEqual(freeByRule(fixture.meetingDays[2], [], Date.parse('2026-10-01T00:00:00Z')), []);
});

test('a talk the script saves has the fields of the Studio type, and the screen reads it', () => {
  const source = fs.readFileSync(path.join(studioFolder, 'schemas/presentation.js'), 'utf8');
  const names = Array.from(source.matchAll(/name: '(\w+)'/g)).map(match => match[1]);
  fixture.presentations.forEach(talk => Object.keys(talk).filter(key => key !== 'id').forEach(key => assert.ok(names.includes(key), key + ' is not a field of presentation')));

  const content = contentOf();
  assert.equal(content.presentations.length, 3);
  const alex = content.presentations.find(talk => talk.id === 'presentation-a1');
  assert.equal(alex.name, 'Alex');
  assert.equal(alex.minutes, 15);
  assert.ok(alex.deckLink.startsWith('https://docs.google.com/presentation/d/'));
  assert.ok(alex.start instanceof Date);
});

test('only the scheduled talks can run: the cancelled one does not', () => {
  assert.deepEqual(contentOf().presentations.filter(canRun).map(talk => talk.id), ['presentation-a1', 'presentation-c3']);
});

test('the Daily Agenda lists the talks of the day, soonest first, and leaves out the cancelled one and the other days', () => {
  const content = contentOf({ plans: [], plan: null });
  const rows = tonight.rowsFor(content, at('2026-10-08T18:00:00Z'));
  assert.deepEqual(rows.map(row => row.kind), ['talk', 'talk']);
  assert.deepEqual(rows.map(row => row.time), ['3:15 PM', '4:00 PM']);
  assert.ok(rows[0].text.startsWith('Alex'));
  assert.equal(rows[0].tag, 'TALK');

  assert.deepEqual(tonight.rowsFor(content, at('2026-10-09T15:00:00Z')), []);
});

test('the talk in progress shows as NOW in the Daily Agenda, and a talk that is over is gone', () => {
  const content = contentOf({ plans: [], plan: null });
  assert.equal(tonight.rowsFor(content, at('2026-10-08T19:20:00Z'))[0].tag, 'NOW');
  assert.deepEqual(tonight.rowsFor(content, at('2026-10-08T19:31:00Z')).map(row => row.time), ['4:00 PM']);
});

test('the title card comes up at the start of the talk, not a moment before', () => {
  const talks = contentOf().presentations;
  const input = now => ({ now: now, talks: talks, settings: settings, skipped: new Set(), announcing: false, slides: undefined });
  assert.equal(dueTalk(talks, at('2026-10-08T19:14:59.999Z'), settings, new Set()), null);
  assert.equal(dueTalk(talks, at('2026-10-08T19:15:00Z'), settings, new Set()).id, 'presentation-a1');
  assert.equal(nextState(idleState(), input(at('2026-10-08T19:14:59Z'))).name, 'idle');
  assert.equal(nextState(idleState(), input(at('2026-10-08T19:15:00Z'))).name, 'title');
});

test('with nobody at the clicker the talk is skipped after 5 minutes, and not before', () => {
  assert.equal(constants.noShowMinutes, 5);
  const talks = contentOf().presentations;
  const skipped = new Set();
  const input = now => ({ now: now, talks: talks, settings: settings, skipped: skipped, announcing: false, slides: undefined });

  let state = nextState(idleState(), input(at('2026-10-08T19:15:00Z')));
  assert.equal(state.name, 'title');
  state = nextState(state, input(at('2026-10-08T19:19:59Z')));
  assert.equal(state.name, 'title');
  state = nextState(state, input(at('2026-10-08T19:20:00Z')));
  assert.equal(state.name, 'skipped');
});

let failed = 0;
for (const item of tests) {
  try {
    await item.run();
    console.log('PASS  ' + item.name);
  } catch (error) {
    failed += 1;
    console.log('FAIL  ' + item.name + '\n      ' + error.message);
  }
}
console.log('\n' + (tests.length - failed) + ' of ' + tests.length + ' tests passed.');
fs.rmSync(workFolder, { recursive: true, force: true });
process.exit(failed === 0 ? 0 : 1);
