// Tests for the clock of the screen (dashboard/core/tick.js), and for how
// little the countdown and the banner write to the page each second. A fake
// clock that the test moves stands in for the browser's, so an hour of ticks
// takes no time. A fake page counts what is written to it.
//
//   node tools/test-tick.mjs
//
// How smooth the motion looks on the TV is not tested here, only when the
// ticks happen and what they touch.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const workFolders = [];
const tests = [];

function test(name, run) {
  tests.push({ name: name, run: run });
}

function read(file) {
  return fs.readFileSync(path.join(dashboardFolder, file), 'utf8');
}

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
// Each call makes a fresh copy, so every test gets its own frame.js and clock.
function copyScripts() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-tick-'));
  workFolders.push(folder);
  fs.writeFileSync(path.join(folder, 'package.json'), '{ "type": "module" }\n');

  const files = ['config.js', 'frame.js', 'panels/banner/banner.js', 'panels/countdown/countdown.js'];
  fs.readdirSync(path.join(dashboardFolder, 'core')).forEach(name => {
    if (name.endsWith('.js')) files.push('core/' + name);
  });
  files.forEach(file => {
    const target = path.join(folder, 'dashboard', file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(dashboardFolder, file), target);
  });
  return pathToFileURL(path.join(folder, 'dashboard')).href + '/';
}

const tickFolder = copyScripts();
const { makeSecondTimer, msToNextSecond, marginMs } = await import(tickFolder + 'core/tick.js');


// A clock the test moves. Timers wait in a list and run when the test says,
// at the time the test says (a real timer runs late, never early).
function makeClock(startMs) {
  const clock = { time: startMs, timers: [], waits: [] };

  clock.now = () => clock.time;
  clock.setTimeout = (action, milliseconds) => {
    clock.timers.push({ at: clock.time + milliseconds, action: action });
    clock.waits.push(milliseconds);
    return clock.timers.length;
  };

  // Runs the next timer lateBy ms after it was due
  clock.runNext = lateBy => {
    clock.timers.sort((a, b) => a.at - b.at);
    const timer = clock.timers.shift();
    clock.time = Math.max(clock.time, timer.at + (lateBy || 0));
    timer.action();
  };
  return clock;
}

// Something the clock can be given to tell
function makeListeners(timer) {
  const heard = [];
  timer.onSecond(now => heard.push(now.getTime()));
  return heard;
}

const startsAt = 1700000000250; // 250 ms into a second


// The clock

test('the wait always ends just after the start of a real second', () => {
  for (let offset = 0; offset < 1000; offset++) {
    const now = 1700000000000 + offset;
    const wait = msToNextSecond(now);

    assert.ok(wait > 0 && wait <= 1000 + marginMs, 'the wait is ' + wait + ' at ' + offset);
    assert.equal((now + wait) % 1000, marginMs, 'lands ' + marginMs + ' ms into a second, from ' + offset);
  }
});

test('it starts once, now, and starting again does not make a second clock', () => {
  const clock = makeClock(startsAt);
  const timer = makeSecondTimer(clock);
  const heard = makeListeners(timer);

  timer.start();
  timer.start();
  assert.deepEqual(heard, [startsAt], 'told once, at the time of the clock');
  assert.equal(clock.timers.length, 1, 'one timer is waiting, not two');

  clock.runNext();
  assert.equal(clock.timers.length, 1);
  assert.equal(heard.length, 2);
});

test('a tick that comes late is told the real time and the next one is aimed at the next real second', () => {
  const clock = makeClock(startsAt);
  const timer = makeSecondTimer(clock);
  const heard = makeListeners(timer);
  timer.start();

  // due at 1700000001005, comes at 1700000001705
  clock.runNext(700);
  assert.equal(heard[1], 1700000001705, 'told the time it really is');
  assert.equal(clock.waits[clock.waits.length - 1], 300, 'waits 300 ms, not 1000');

  clock.runNext(0);
  assert.equal(heard[2], 1700000002005, 'the next one is on time: 5 ms into the next second');
});

test('a page that was busy for 2.4 seconds gets one tick, not one for each second it missed', () => {
  const clock = makeClock(startsAt);
  const timer = makeSecondTimer(clock);
  const heard = makeListeners(timer);
  timer.start();

  clock.runNext(2400); // due at ...001005, comes at ...003405
  assert.equal(heard.length, 2, 'one more tick');
  assert.equal(clock.timers.length, 1, 'and still one timer waiting');

  clock.runNext(0);
  clock.runNext(0);
  clock.runNext(0);
  assert.deepEqual(heard.slice(2).map(time => time % 1000), [5, 5, 5], 'back on the seconds');
  assert.deepEqual(heard.slice(1).map(time => Math.floor(time / 1000)), [1700000003, 1700000004, 1700000005, 1700000006]);
});

test('a timer that wakes just before the second changes tells no one, and tries again just after it', () => {
  const clock = makeClock(1700000000999); // started 1 ms before a second
  const timer = makeSecondTimer(clock);
  const heard = makeListeners(timer);
  timer.start();
  assert.equal(heard.length, 1);
  assert.equal(clock.waits[0], 6, 'asks for the second that is 1 ms away, plus the margin');

  // woke 3 ms early instead: still the old second
  clock.time = 1700000000997;
  clock.timers[0].at = 1700000000997;
  clock.runNext();
  assert.equal(heard.length, 1, 'the same second, so nothing is told again');
  assert.equal(clock.waits[1], 8);

  clock.runNext(0);
  assert.equal(heard.length, 2);
  assert.equal(heard[1] % 1000, 5);
});

test('an hour of ticks that are always a little late stays on the seconds and does not drift', () => {
  const clock = makeClock(startsAt);
  const timer = makeSecondTimer(clock);
  const heard = makeListeners(timer);
  timer.start();

  // 0 to 40 ms late each time, from a fixed sequence so the test is repeatable
  let seed = 12345;
  const late = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % 41;
  };
  for (let count = 0; count < 3600; count++) clock.runNext(late());

  assert.equal(heard.length, 3601);
  heard.forEach((time, index) => {
    if (index === 0) return;
    assert.equal(Math.floor(time / 1000), 1700000000 + index, 'tick ' + index + ' is in second ' + index + ' after the start');
    assert.ok(time % 1000 >= marginMs && time % 1000 <= marginMs + 40, 'tick ' + index + ' is ' + (time % 1000) + ' ms into its second');
  });
  assert.equal(clock.timers.length, 1, 'still one timer');

  // the way a plain 1000 ms wait behaves with the same lateness, to show what is avoided
  let naive = startsAt;
  seed = 12345;
  for (let count = 0; count < 3600; count++) naive += 1000 + late();
  assert.ok(naive - startsAt - 3600000 > 30000, 'a plain wait would be more than 30 seconds behind after the hour');
});

test('a listener that throws does not stop the others or the clock', () => {
  const clock = makeClock(startsAt);
  const timer = makeSecondTimer(clock);
  const heard = [];
  timer.onSecond(() => { throw new Error('a panel broke'); });
  timer.onSecond(now => heard.push(now.getTime()));

  const realError = console.error;
  console.error = () => {};
  try {
    timer.start();
    clock.runNext();
    clock.runNext();
  } finally {
    console.error = realError;
  }
  assert.equal(heard.length, 3);
});

test('a listener whose panel has left the page is dropped, and one whose panel is still there is kept', () => {
  const clock = makeClock(startsAt);
  const timer = makeSecondTimer(clock);
  const gone = { isConnected: true };
  const here = { isConnected: true };
  const goneHeard = [];
  const hereHeard = [];
  timer.onSecond(now => goneHeard.push(now), gone);
  timer.onSecond(now => hereHeard.push(now), here);

  timer.start();
  gone.isConnected = false;
  clock.runNext();
  clock.runNext();
  clock.runNext();

  assert.equal(goneHeard.length, 1, 'told once, while its panel was there');
  assert.equal(hereHeard.length, 4);
});

test('a clock that is set back still ticks, and the next wait is worked out from the new time', () => {
  const clock = makeClock(startsAt);
  const timer = makeSecondTimer(clock);
  const heard = makeListeners(timer);
  timer.start();

  clock.time = startsAt - 10000;
  clock.timers[0].at = clock.time;
  clock.runNext();
  assert.equal(heard.length, 2, 'told, because the second is a different one');
  assert.equal(heard[1], startsAt - 10000);
  assert.equal((clock.time + clock.waits[1]) % 1000, marginMs);
});


// The page as the countdown and the banner see it. Every write to a part of
// the page goes in a log as "<selector>.<what was written>", so a test can say
// exactly what a tick touched.

function makeNode(name, log) {
  let text = '';
  let html = '';
  const node = {
    isConnected: true,
    dataset: new Proxy({}, {
      set(target, key, value) {
        log.push(name + '.data-' + key);
        target[key] = value;
        return true;
      },
    }),
    classList: {
      toggle: token => log.push(name + '.class-' + token),
      add: token => log.push(name + '.class-' + token),
      remove: token => log.push(name + '.class-' + token),
    },
    animate: () => {
      log.push(name + '.animate');
      return {};
    },
    parentNode: null,
  };
  Object.defineProperty(node, 'textContent', {
    get: () => text,
    set: value => { text = String(value); log.push(name + '.text'); },
  });
  Object.defineProperty(node, 'innerHTML', {
    get: () => html,
    set: value => { html = String(value); log.push(name + '.html'); },
  });
  return node;
}

// A host for a panel to draw into. host.innerHTML = ... is accepted and the
// panel's element answers querySelector with one node for each selector.
function makeHost(log) {
  const nodes = {};
  const segments = Array.from({ length: 12 }, () => makeNode('.segment', log));
  const element = makeNode('panel', log);

  element.queries = 0;
  element.querySelector = selector => {
    element.queries += 1;
    if (!nodes[selector]) {
      nodes[selector] = makeNode(selector, log);
      if (selector === '.days-number span') nodes[selector].parentNode = makeNode('.days-number', log);
    }
    return nodes[selector];
  };
  element.querySelectorAll = selector => (selector === '.segment' ? segments : []);

  const host = {
    set innerHTML(markup) {},
    get firstElementChild() { return element; },
  };
  return { host: host, element: element, nodes: nodes };
}

// A browser with a page, a clock, timers and a canvas that measures text,
// all fake, with frame.js and the panels copied fresh. run gets the world.
async function onScreen(run, startsAtMs) {
  const folder = copyScripts();
  const RealDate = Date;
  const world = { now: startsAtMs || new RealDate(2026, 9, 5, 15, 7, 0, 250).getTime(), timers: [], nextTimer: 1, log: [], measured: [] };

  // new Date() with nothing in it asks the fake clock, like Date.now()
  class FakeDate extends RealDate {
    constructor(...parts) {
      if (parts.length === 0) super(world.now);
      else super(...parts);
    }
    static now() { return world.now; }
  }

  world.nextTick = () => {
    world.timers.sort((a, b) => a.at - b.at || a.id - b.id);
    const timer = world.timers.shift();
    world.now = Math.max(world.now, timer.at);
    timer.action();
  };
  world.pen = {
    font: '',
    measureText: text => {
      world.measured.push(text);
      return { width: text.length * 22 };
    },
  };

  const real = { Date: globalThis.Date, setTimeout: globalThis.setTimeout, setInterval: globalThis.setInterval, document: globalThis.document };
  globalThis.Date = FakeDate;
  globalThis.setTimeout = (action, milliseconds) => {
    world.timers.push({ at: world.now + (milliseconds || 0), id: world.nextTimer++, action: action });
    return world.nextTimer;
  };
  globalThis.setInterval = () => 0; // the 250 ms look at the effects is not part of this
  globalThis.document = {
    documentElement: { dataset: {}, style: { setProperty() {} } },
    createElement: () => ({ getContext: () => world.pen }),
    getElementById: id => (id === 'metal-shapes' ? { insertAdjacentHTML() {} } : null),
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  try {
    world.frame = await import(folder + 'frame.js');
    world.frame.start({ motion: 'full', speed: 'normal' });
    world.folder = folder;
    await run(world);
  } finally {
    globalThis.Date = real.Date;
    globalThis.setTimeout = real.setTimeout;
    globalThis.setInterval = real.setInterval;
    if (real.document === undefined) delete globalThis.document;
    else globalThis.document = real.document;
  }
}

function countdownContent(kickoff) {
  return { settings: { countdown: { kickoff: kickoff, kickoffLabel: 'KICKOFF', rollout: '2027-03-01T12:00', rolloutLabel: 'ROLLOUT' } } };
}

const SECONDS_WRITE = ['.seconds span.text', '.seconds span.animate'];


test('the countdown writes only the seconds on most ticks, and only the parts that changed on the others', async () => {
  await onScreen(async world => {
    const countdown = await import(world.folder + 'panels/countdown/countdown.js');
    const page = makeHost(world.log);
    // 4 days, 3 hours, 22 minutes and 59.75 seconds to go
    countdown.mount(page.host, countdownContent('2026-10-09T18:30'));

    const shown = selector => page.nodes[selector].textContent;
    assert.equal(shown('.days-number span'), '4');
    assert.equal(shown('.days-word'), 'DAYS');
    assert.equal(shown('.hours span'), '03');
    assert.equal(shown('.minutes span'), '22');
    assert.equal(shown('.seconds span'), '59');
    assert.equal(shown('.label'), 'KICKOFF IN');
    assert.equal(shown('.date'), 'OCT 9');
    assert.ok(!world.log.some(entry => entry.endsWith('.animate')), 'the first numbers just appear');

    const measuredAtStart = world.measured.length;
    assert.ok(measuredAtStart > 0, 'the top line was measured to fit it');
    world.log.length = 0;
    const queriesAtStart = page.element.queries;

    // two minutes of ticks, looking at what each one wrote
    let litChanges = 0;
    let nudges = 0;
    for (let tick = 0; tick < 120; tick++) {
      world.nextTick();
      const batch = world.log.splice(0);
      const seconds = Number(shown('.seconds span'));

      assert.ok(batch.includes('.seconds span.text') && batch.includes('.seconds span.animate'), 'the seconds changed on every tick');
      if (seconds !== 59 && seconds % 5 !== 0) {
        assert.deepEqual(batch, SECONDS_WRITE, 'at ' + seconds + ' only the seconds are written');
      }
      if (batch.includes('.segment.class-lit')) litChanges += 1;
      if (batch.includes('.minutes span.text')) {
        assert.equal(seconds, 59, 'the minutes change when the seconds start again');
        assert.equal(batch.filter(entry => entry === '.chevron-left.animate').length, 1, 'and the chevrons close once');
        nudges += 1;
      }
      ['.label.text', '.date.text', '.days-number span.text', '.days-word.text', '.hours span.text', 'panel.data-level', '.days-number.class-long'].forEach(entry => {
        assert.ok(!batch.includes(entry), 'tick ' + tick + ' wrote ' + entry);
      });
    }

    assert.equal(nudges, 2, 'two minutes, two nudges');
    assert.ok(litChanges >= 24 && litChanges <= 26, 'the bar changes every 5 seconds: ' + litChanges);
    assert.equal(shown('.minutes span'), '20');
    assert.equal(world.measured.length, measuredAtStart, 'no text was measured again');
    assert.equal(page.element.queries, queriesAtStart, 'nothing was looked up in the page');
  });
});

test('the countdown writes the top line again, and measures it again, only when the label or the date changes', async () => {
  await onScreen(async world => {
    const countdown = await import(world.folder + 'panels/countdown/countdown.js');
    const page = makeHost(world.log);
    countdown.mount(page.host, countdownContent('2026-10-09T18:30'));
    const measuredAtStart = world.measured.length;

    // the same content again changes nothing
    countdown.update(page.element, countdownContent('2026-10-09T18:30'));
    world.log.length = 0;
    world.nextTick();
    assert.deepEqual(world.log, SECONDS_WRITE);
    assert.equal(world.measured.length, measuredAtStart);

    // a new date is written and measured on the next tick
    countdown.update(page.element, countdownContent('2026-11-21T18:30'));
    world.log.length = 0;
    world.nextTick();
    assert.equal(page.nodes['.date'].textContent, 'NOV 21');
    assert.ok(world.log.includes('.date.text') && world.log.includes('.days-number span.text'));
    assert.ok(!world.log.includes('.label.text'), 'KICKOFF IN is the same, so it is not written');
    assert.ok(world.measured.length > measuredAtStart);
    assert.equal(page.nodes['.days-number span'].textContent, '47');

    // and then it is quiet again
    const measuredNow = world.measured.length;
    world.log.length = 0;
    world.nextTick();
    assert.deepEqual(world.log, SECONDS_WRITE);
    assert.equal(world.measured.length, measuredNow);
  });
});

test('the countdown draws the big days number without a slam the first time, and a three digit number gets the smaller size', async () => {
  await onScreen(async world => {
    const countdown = await import(world.folder + 'panels/countdown/countdown.js');
    const page = makeHost(world.log);
    countdown.mount(page.host, countdownContent('2027-03-01T12:00'));

    assert.equal(page.nodes['.days-number span'].textContent, '146');
    assert.ok(world.log.includes('.days-number.class-long'), 'three digits are written with the long class');
    assert.ok(!world.log.includes('.days-number span.animate'));
  });
});

test('the banner writes the clock and the date once a minute, and looks nothing up in between', async () => {
  await onScreen(async world => {
    const banner = await import(world.folder + 'panels/banner/banner.js');
    const page = makeHost(world.log);
    const content = { team: { name: '[Team]', number: '[0000]', school: '[School]' }, weather: null, status: {} };
    banner.mount(page.host, content);

    assert.equal(page.nodes['.time'].textContent, '3:07');
    assert.equal(page.nodes['.suffix'].textContent, 'PM');
    assert.equal(page.nodes['.date'].textContent, 'MON OCT 5');

    world.log.length = 0;
    const queriesAtStart = page.element.queries;

    // 59 ticks that stay in the same minute
    for (let tick = 0; tick < 59; tick++) world.nextTick();
    assert.deepEqual(world.log, [], 'nothing was written');
    assert.equal(page.element.queries, queriesAtStart, 'nothing was looked up');

    // the 60th is the next minute
    world.nextTick();
    assert.equal(page.nodes['.time'].textContent, '3:08');
    assert.deepEqual(world.log, ['.time.text'], 'only the time changed: the AM or PM and the date are the same');
    assert.equal(page.element.queries, queriesAtStart + 3);
  });
});

test('the banner draws the team that is on the screen: its name and number, and the school of the Team box that both teams share', async () => {
  await onScreen(async world => {
    const banner = await import(world.folder + 'panels/banner/banner.js');
    const teams = await import(world.folder + 'core/teams.js');
    document.documentElement.classList = { add() {}, remove() {} };

    const team = { team: { name: '[Team]', number: '[0000]', school: '[School]' }, weather: null, status: {} };
    const nova = { code: 'nova', name: 'HAWKTIMUS NOVA', shortName: 'NOVA', number: '3230', logo: '', colors: { primary: '#1F7AE0', plate: '#1E3A6E', accent: '#9BF0FF', neon: '#FF2E8C', pink: '#35F0FF', background: '#060D1A', text: '#FFFFFF' }, mirror: true, active: true, order: 20 };

    // with no team documents it is the Team box, as it always was
    teams.useTeams(team, new Date());
    const page = makeHost(world.log);
    banner.mount(page.host, team);
    assert.equal(page.nodes['.team-name'].dataset.name, '[Team]');
    assert.equal(page.nodes['.team-number'].textContent, '[0000]');
    assert.equal(page.nodes['.school'].textContent, '[School]');

    // with a team on the screen it is that team, and the school is still the Team box's
    const withNova = Object.assign({}, team, { teams: [nova], settings: { teamMode: 'nova' } });
    teams.useTeams(withNova, new Date());
    teams.changeTeamNow();
    banner.update(page.element, withNova);
    assert.equal(page.nodes['.team-name'].dataset.name, 'HAWKTIMUS NOVA');
    assert.equal(page.nodes['.team-number'].textContent, '3230');
    assert.equal(page.nodes['.school'].textContent, '[School]');
  });
});

test('the banner shows the new day and the AM at midnight', async () => {
  await onScreen(async world => {
    const banner = await import(world.folder + 'panels/banner/banner.js');
    const page = makeHost(world.log);
    const content = { team: { name: '[Team]', number: '[0000]', school: '[School]' }, weather: null, status: {} };
    banner.mount(page.host, content);
    assert.equal(page.nodes['.time'].textContent, '11:59');
    assert.equal(page.nodes['.date'].textContent, 'MON OCT 5');

    world.log.length = 0;
    world.nextTick(); // 11:59:59
    assert.deepEqual(world.log, []);
    world.nextTick(); // 12:00:00 the next day
    assert.deepEqual(world.log, ['.time.text', '.suffix.text', '.date.text']);
    assert.equal(page.nodes['.time'].textContent, '12:00');
    assert.equal(page.nodes['.suffix'].textContent, 'AM');
    assert.equal(page.nodes['.date'].textContent, 'TUE OCT 6');
  }, new Date(2026, 9, 5, 23, 59, 58, 250).getTime());
});

test('starting frame.js sets one timer going, and starting it again sets no more', async () => {
  await onScreen(async world => {
    assert.equal(world.timers.length, 1, 'the next tick');
    world.frame.start({ motion: 'full', speed: 'normal' });
    assert.equal(world.timers.length, 1);
    world.nextTick();
    assert.equal(world.timers.length, 1);
  });
});


// What the code looks like

test('nothing that runs each second reads the size or place of anything, or sets a repeating timer of its own', () => {
  const layoutReads = /offsetWidth|offsetHeight|offsetTop|offsetLeft|getBoundingClientRect|getComputedStyle|clientWidth|clientHeight|scrollWidth|scrollHeight|getClientRects|innerWidth|innerHeight/;

  ['core/tick.js', 'core/countdown.js', 'panels/countdown/countdown.js', 'panels/banner/banner.js', 'core/takeover.js'].forEach(file => {
    const code = read(file);
    assert.ok(!layoutReads.test(code), file + ' reads layout');
  });
  ['core/tick.js', 'core/countdown.js', 'panels/countdown/countdown.js', 'panels/banner/banner.js'].forEach(file => {
    assert.ok(!read(file).includes('setInterval'), file + ' has a repeating timer');
  });
  assert.ok(read('core/tick.js').includes('setTimeout'), 'the clock sets one timer at a time');
});

test('frame.js keeps onSecond and starts the one clock only from start()', () => {
  const frame = read('frame.js');

  assert.ok(frame.includes("import { makeSecondTimer } from './core/tick.js';"));
  assert.ok(frame.includes('export function onSecond(listener, element) {'));
  assert.equal((frame.match(/secondClock\.start\(\)/g) || []).length, 1, 'started once, by start()');
  assert.ok(!/function tick\(/.test(frame), 'the counting moved out of frame.js');
});

test('the digit roll and the chevron nudge change only transform and opacity', () => {
  const frame = read('frame.js');
  const section = frame.slice(frame.indexOf('export function slam('), frame.indexOf('// The logo\n'));
  assert.ok(section.includes('element.animate(') && section.includes('leftElement.animate(') && section.includes('rightElement.animate('));

  const names = new Set();
  (section.match(/\{[^{}]*\}/g) || []).forEach(block => {
    (block.match(/([a-zA-Z]+):/g) || []).forEach(name => names.add(name.slice(0, -1)));
  });
  names.delete('offset');
  names.delete('easing');
  names.delete('duration');
  assert.deepEqual(Array.from(names).sort(), ['opacity', 'transform']);
});

test('every keyframe in frame.css changes only transform, opacity or the drawing of a line', () => {
  const css = read('frame.css');
  const pattern = /@keyframes ([a-z0-9-]+) \{/g;
  const allowed = ['transform', 'opacity', 'stroke-dashoffset', 'stroke-dasharray', 'animation-timing-function'];
  let match;
  let count = 0;

  while ((match = pattern.exec(css)) !== null) {
    let depth = 1;
    let end = pattern.lastIndex;
    while (depth > 0 && end < css.length) {
      if (css[end] === '{') depth += 1;
      if (css[end] === '}') depth -= 1;
      end += 1;
    }
    const body = css.slice(pattern.lastIndex, end - 1).replace(/\/\*[\s\S]*?\*\//g, '');
    (body.match(/[a-z-]+(?=\s*:)/g) || []).forEach(property => {
      assert.ok(allowed.includes(property), match[1] + ' changes ' + property);
    });
    count += 1;
  }
  assert.ok(count > 40, 'found the keyframes');
});

// Every .css file under the dashboard except the fonts
function stylesheets(folder) {
  const found = [];
  fs.readdirSync(path.join(dashboardFolder, folder), { withFileTypes: true }).forEach(entry => {
    const relative = path.join(folder, entry.name);
    if (entry.isDirectory() && entry.name !== 'fonts') found.push(...stylesheets(relative));
    else if (entry.name.endsWith('.css')) found.push(relative);
  });
  return found;
}

test('the layers are promoted only while a page change or a hidden transition flies the blocks', () => {
  let seen = 0;

  stylesheets('').forEach(file => {
    const rules = read(file).match(/[^{}]*\{[^{}]*will-change:[^{}]*\}/g) || [];
    rules.forEach(rule => {
      seen += 1;
      assert.equal(file, 'frame.css', 'will-change in ' + file);
      assert.ok(/\[data-state="x[oi]"\]|\[data-hidden="(break|build)"\]/.test(rule.split('{')[0]), 'will-change outside a page change: ' + rule.split('{')[0].trim());
    });
  });
  assert.ok(seen >= 3, 'found the rules');
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
  workFolders.forEach(folder => fs.rmSync(folder, { recursive: true, force: true }));
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
