// Tests the things that stop the screen freezing half drawn.
//
// The fault this is about: the TV is switched off or to another input, Chromium keeps the page's timers running and
// stops painting it, and a transition that was playing never finishes. On the wall that is black at the top, a solid
// block over the lower half and pieces of frame. The old heartbeat said the page was fine the whole time, because a
// timer was still writing the title.
//
// So four things are checked here:
//   the frame budget is measured, not assumed     a 30 Hz TV was giving Full transitions up after two changes
//   a wait for a frame gives up                   every transition is built out of these, and one that never
//                                                 returns is the freeze
//   a transition that overstays is forced to its end state   the rotation can never be held for ever
//   the heartbeat tells the truth about painting   so the watchdog restarts the screen for the right reason
//
//   node tests/frozen-screen.test.mjs

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const load = file => import(pathToFileURL(path.join(root, file)).href);

let passed = 0;
async function test(name, run) {
  try {
    await run();
    passed += 1;
    console.log('ok    ' + name);
  } catch (error) {
    console.log('FAIL  ' + name + '\n' + error.stack);
    process.exitCode = 1;
  }
}

// ----- a page, enough of one for these modules -----

// What requestAnimationFrame does in a given test. 'paint' calls back on a timer like a real screen; 'stopped' never
// calls back at all, which is the browser that has given up painting.
let rafMode = 'paint';
let rafGapMs = 16.7;
let clockMs = 0;
const pending = [];

function makeElement() {
  const element = {
    dataset: {},
    hidden: false,
    isConnected: true,
    style: { setProperty() {}, removeProperty() {} },
    children: [],
    firstElementChild: null,
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren() { this.children = []; },
    after() {},
    remove() {},
    matches() { return false; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    animate() { return { id: '', cancel() {}, finished: new Promise(() => {}) }; },
    closest() { return null; },
  };
  return element;
}

function setUpPage() {
  clockMs = 0;
  pending.length = 0;
  const stage = makeElement();
  globalThis.performance = { now: () => clockMs };
  globalThis.window = {
    location: { search: '' },
    localStorage: { getItem: () => null, setItem() {} },
    addEventListener() {},
  };
  globalThis.document = {
    documentElement: { dataset: {} },
    title: '',
    visibilityState: 'visible',
    timeline: { currentTime: 0 },
    getElementById: id => (id === 'stage' ? stage : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    getAnimations: () => [],
    createElement: () => makeElement(),
    addEventListener() {},
  };
  // A browser that has stopped painting does not throw the request away: it keeps it and runs it when painting comes
  // back. That is what lets the page notice afterwards how long the gap was, so the fake keeps them too and simply
  // does not run them while painting is stopped.
  globalThis.requestAnimationFrame = callback => {
    pending.push(callback);
    return pending.length;
  };
}

// Lets the fake clock run: every pending frame callback is called in turn, and timers run for real. While painting is
// stopped the clock still moves and nothing is called, which is what the browser does.
async function runFrames(count = 4) {
  for (let i = 0; i < count; i += 1) {
    clockMs += rafGapMs;
    if (rafMode !== 'stopped') {
      const due = pending.splice(0, pending.length);
      due.forEach(callback => callback(clockMs));
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

setUpPage();

const frames = await load('dashboard/core/frames.js');
const motion = await load('dashboard/core/motion.js');
const heartbeat = await load('dashboard/core/heartbeat.js');
const reform = await load('dashboard/core/reform-run.js');

// ----- the frame budget is measured -----

await test('a 30 Hz screen is judged against its own refresh, not against 60 Hz', () => {
  // The TV in the lab offers 3840x2160 at 30 Hz only, where every frame takes 33.3 ms. Against the old fixed 34 ms
  // every one of those frames counted as slow, two transitions in a row "missed", and the screen dropped to Light
  // for the rest of the day. Nobody ever saw a Full transition on the wall.
  const thirtyHz = new Array(40).fill(33.4);
  assert.equal(motion.missedBudget(thirtyHz, 33.4), false, 'a screen keeping up perfectly at 30 Hz has not missed');

  const sixtyHz = new Array(40).fill(16.7);
  assert.equal(motion.missedBudget(sixtyHz, 16.7), false);

  // And a screen that really is struggling still gives Full up
  const struggling = new Array(40).fill(33.4);
  for (let i = 0; i < 20; i += 1) struggling[i] = 120;
  assert.equal(motion.missedBudget(struggling, 33.4), true, 'half the frames at 120 ms is a miss at any refresh');
});

await test('the budget is a frame and a half of this screen, and never tighter than the 60 Hz floor', () => {
  assert.equal(motion.slowFrameMs(16.7), 34, 'on a 60 Hz screen the floor applies');
  assert.ok(Math.abs(motion.slowFrameMs(33.4) - 50.1) < 0.01, 'on a 30 Hz screen it is 50 ms');
  assert.equal(motion.slowFrameMs(0), 34, 'nothing measured yet means the floor');
});

await test('the refresh of the screen is measured from two frames in a row', async () => {
  frames.forgetFrames();
  rafMode = 'paint';
  rafGapMs = 33.4;
  frames.startFrames();
  await runFrames(8);

  assert.ok(Math.abs(frames.refreshMs() - 33.4) < 2, 'it measured about 33 ms, got ' + frames.refreshMs());
  assert.equal(frames.framesFresh(30), true);
  assert.equal(frames.frameAgeSeconds(), 0);
});

// ----- the page knows when painting has stopped -----

await test('when frames stop, the age of the last one grows and a stall is announced', async () => {
  frames.forgetFrames();
  rafMode = 'paint';
  rafGapMs = 16.7;
  frames.startFrames();
  await runFrames(4);
  assert.equal(frames.framesFresh(30), true, 'painting to start with');

  // The TV is switched away: no callback ever comes again
  rafMode = 'stopped';
  clockMs += 90 * 1000;
  assert.equal(frames.framesFresh(30), false, 'no frame for 90 seconds is not fresh');
  assert.ok(frames.frameAgeSeconds() >= 90, 'and the age says how long, got ' + frames.frameAgeSeconds());

  // The TV comes back. The probe asks for its next pair of frames on its own timer, and that frame arriving after a
  // long gap is what tells the page it was away.
  const stalls = [];
  frames.onStall(seconds => stalls.push(seconds));
  rafMode = 'paint';
  await new Promise(resolve => setTimeout(resolve, frames.probeEveryMs + 300));
  await runFrames(3);
  assert.equal(stalls.length, 1, 'the stall is announced once');
  assert.ok(stalls[0] >= 90, 'with how long it lasted, got ' + stalls[0]);
});

await test('the heartbeat says FROZEN while nothing is being painted, and the watchdog looks for exactly that', () => {
  const at = new Date('2026-11-06T14:07:00');
  assert.equal(heartbeat.titleFor(at, true, false), 'Teletraan I · 14:07', 'painting: the clock, as before');
  assert.equal(heartbeat.titleFor(at, false, false), heartbeat.frozenTitle, 'not painting: FROZEN');
  assert.ok(!/\d\d:\d\d/.test(heartbeat.frozenTitle), 'and the frozen title has no clock, which is what watchdog.sh reads');

  // A hidden page is not painting on purpose, and must not be called frozen
  assert.equal(heartbeat.titleFor(at, false, true), 'Teletraan I · 14:07', 'a hidden tab keeps its clock');
});

await test('the heartbeat writes FROZEN into the real title when frames have stopped', async () => {
  frames.forgetFrames();
  rafMode = 'paint';
  rafGapMs = 16.7;
  frames.startFrames();
  await runFrames(3);
  heartbeat.beat(new Date('2026-11-06T14:07:00'));
  assert.equal(globalThis.document.title, 'Teletraan I · 14:07');

  rafMode = 'stopped';
  clockMs += 120 * 1000;
  heartbeat.beat(new Date('2026-11-06T14:09:00'));
  assert.equal(globalThis.document.title, heartbeat.frozenTitle);
});

// ----- a wait for a frame always ends -----

await test('a wait for the next frame gives up instead of hanging for ever', async () => {
  rafMode = 'stopped';
  const started = Date.now();
  // Without the timeout this never resolves, and every transition is built out of these waits
  await reform.nextFrame();
  const took = Date.now() - started;
  assert.ok(took >= reform.frameWaitMs - 50, 'it waited for a frame first, ' + took + ' ms');
  assert.ok(took < reform.frameWaitMs + 500, 'and then gave up, ' + took + ' ms');
});

await test('a wait for the next frame returns at once when the screen is painting', async () => {
  rafMode = 'paint';
  const waiting = reform.nextFrame();
  let done = false;
  waiting.then(() => { done = true; });
  await runFrames(1);
  await waiting;
  assert.equal(done, true, 'it resolved on the frame, not on the timeout');
});

await test('a wait for animations gives up after their own length plus two seconds', async () => {
  // An animation of a page that is not being painted never finishes on its own
  const never = { id: 'reform', cancel() {}, finished: new Promise(() => {}) };
  const started = Date.now();
  await reform.animationsDone([never], 100);
  const took = Date.now() - started;
  assert.ok(took >= 100, 'it waited the animation out, ' + took + ' ms');
  assert.ok(took < 100 + reform.guardSlackMs + 500, 'and then gave up, ' + took + ' ms');
});

// ----- the lock on the rotation is always let go -----

await test('a transition that overstays is forced to its end state and lets the rotation go', async () => {
  const holds = [];
  const release = reform.takeRun('reform', on => holds.push(on), 60);
  assert.ok(release, 'it took the lock');
  assert.deepEqual(holds, [true], 'and held the rotation clock');
  assert.equal(reform.reformRunning(), true);

  // The run never calls release: the guard has to
  await new Promise(resolve => setTimeout(resolve, 60 + reform.guardSlackMs + 150));
  assert.deepEqual(holds, [true, false], 'the rotation clock was started again');
  assert.equal(reform.reformRunning(), false, 'and the lock was let go, so the next transition can play');
});

await test('a run that finishes normally is not touched by the guard', async () => {
  const holds = [];
  const release = reform.takeRun('reform', on => holds.push(on), 60);
  release();
  assert.deepEqual(holds, [true, false]);
  assert.equal(reform.reformRunning(), false);

  // The guard must not fire afterwards and let go a second time, which would release a later transition's lock
  const later = reform.takeRun('reform', on => holds.push(on), 5000);
  await new Promise(resolve => setTimeout(resolve, 60 + reform.guardSlackMs + 150));
  assert.deepEqual(holds, [true, false, true], 'the second run still holds the clock');
  later();
});

await test('what a transition wrote on the page is given back when it is forced to end', () => {
  const written = [];
  reform.noteRestore(() => written.push('given back'));
  reform.forceEnd();
  assert.deepEqual(written, ['given back']);

  // And only once: a second forcing must not call a stale restore
  reform.forceEnd();
  assert.deepEqual(written, ['given back']);
});

console.log('\n' + passed + ' of ' + passed + ' checks passed');

// The frame probe asks to be run again for as long as the page is open, which on a real screen is all day. Here that
// chain of timers would keep this process alive after the last check, so it is ended on purpose.
process.exit(process.exitCode || 0);
