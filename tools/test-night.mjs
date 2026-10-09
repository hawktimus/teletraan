// Tests for Night mode, the screensaver (dashboard/core/night.js, and the files
// that use it). The plain functions are run for real: when it is night in a
// time zone, where the bouncing logo starts, and how a corner hit is told from
// an ordinary bounce. The page code is checked by reading the source, because
// it needs a browser: that it draws the logo once, does nothing per frame and
// is wired to the alerts, and that the stylesheets move only transform and
// opacity.
//
//   node tools/test-night.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-night-'));
fs.mkdirSync(path.join(workFolder, 'dashboard', 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'core/night.js', 'core/logo.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(workFolder, 'dashboard', file));
});
const nightUrl = pathToFileURL(path.join(workFolder, 'dashboard/core/night.js')).href;
const night = await import(nightUrl);
const config = await import(pathToFileURL(path.join(workFolder, 'dashboard/config.js')).href);
const logo = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/logo.js')).href);

const { inNightWindow, nightWanted, nightPlan, positionAt, nextPair, makeCornerDetector, isClockTime, tidyClockTime, minutesIn } = night;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const eastern = 'America/New_York';
const at = text => new Date(text); // always written with a Z, so it means the same on every computer

// A random() that walks through the numbers it is given, so a test picks the draw
function drawing(...numbers) {
  let index = 0;
  return () => numbers[index++ % numbers.length];
}

// Whether the logo is at a wall at this moment, on either axis
function atWall(position) {
  return Math.abs(position) < 1e-9 || Math.abs(position - 1) < 1e-9;
}

// Is it night? ------------------------------------------------------------

test('the times are 24 hour times with two digits, and anything else is not a time', () => {
  ['00:00', '09:05', '11:30', '23:30', '23:59'].forEach(text => assert.equal(isClockTime(text), true, text));
  ['24:00', '9:05', '14:60', '1430', '14:3', '', 'ab:cd', '23:30 ', ' 23:30', 7, null, undefined, {}].forEach(value => {
    assert.equal(isClockTime(value), false, JSON.stringify(value));
  });
  assert.equal(tidyClockTime('09:05', '23:30'), '09:05');
  assert.equal(tidyClockTime('9:05', '23:30'), '23:30');
  assert.equal(tidyClockTime(undefined, '11:30'), '11:30');
});

test('a window inside one day starts at the start time, includes it, and ends at the end time, which is not included', () => {
  // 15 January 2027, eastern time is UTC-5 in winter, so 14:00Z is 09:00
  const inside = (hourZ, minute) => inNightWindow(at('2027-01-15T' + hourZ + ':' + minute + ':00Z'), '09:00', '17:00', eastern);

  assert.equal(inside('13', '59'), false, '08:59');
  assert.equal(inside('14', '00'), true, '09:00 is in');
  assert.equal(inside('17', '30'), true, '12:30');
  assert.equal(inside('21', '59'), true, '16:59');
  assert.equal(inside('22', '00'), false, '17:00 is out');
  assert.equal(inside('04', '00'), false, '23:00 the night before');
});

test('a window that crosses midnight is the evening and the morning, which is the starting 23:30 to 11:30', () => {
  const state = text => inNightWindow(at(text), '23:30', '11:30', eastern);

  assert.equal(state('2027-01-15T04:29:00Z'), false, '23:29');
  assert.equal(state('2027-01-15T04:30:00Z'), true, '23:30 is in');
  assert.equal(state('2027-01-15T05:00:00Z'), true, 'midnight');
  assert.equal(state('2027-01-15T10:00:00Z'), true, '05:00');
  assert.equal(state('2027-01-15T16:29:00Z'), true, '11:29');
  assert.equal(state('2027-01-15T16:30:00Z'), false, '11:30 is out');
  assert.equal(state('2027-01-15T17:00:00Z'), false, 'noon');
  assert.equal(state('2027-01-15T22:00:00Z'), false, '17:00');
  assert.equal(state('2027-01-16T04:29:00Z'), false, '23:29 the next day');
});

test('a window from midnight, and one that ends at midnight, work like any other', () => {
  const around = (start, end, text) => inNightWindow(at(text), start, end, 'UTC');

  assert.equal(around('00:00', '06:00', '2027-01-15T00:00:00Z'), true);
  assert.equal(around('00:00', '06:00', '2027-01-15T05:59:00Z'), true);
  assert.equal(around('00:00', '06:00', '2027-01-15T06:00:00Z'), false);
  assert.equal(around('22:00', '00:00', '2027-01-15T21:59:00Z'), false);
  assert.equal(around('22:00', '00:00', '2027-01-15T22:00:00Z'), true);
  assert.equal(around('22:00', '00:00', '2027-01-15T23:59:00Z'), true);
  assert.equal(around('22:00', '00:00', '2027-01-16T00:00:00Z'), false);
});

test('the same start and end is no time at all, and a time that cannot be read gives never', () => {
  for (let hour = 0; hour < 24; hour++) {
    const now = new Date(Date.UTC(2027, 0, 15, hour, 30));
    assert.equal(inNightWindow(now, '23:30', '23:30', eastern), false);
    assert.equal(inNightWindow(now, '00:00', '00:00', eastern), false);
  }
  const now = at('2027-01-15T05:00:00Z');
  [['9:00', '17:00'], ['09:00', '25:00'], ['', ''], [undefined, '11:30'], ['23:30', null], [1130, 2330]].forEach(([start, end]) => {
    assert.equal(inNightWindow(now, start, end, eastern), false, JSON.stringify([start, end]));
  });
});

test('the time zone decides, through Intl, and a half hour zone and a zone it does not know are handled', () => {
  const instant = at('2026-10-04T04:00:00Z'); // 00:00 in New York in summer, 13:00 in Tokyo

  assert.equal(minutesIn(eastern, instant), 0);
  assert.equal(minutesIn('Asia/Tokyo', instant), 13 * 60);
  assert.equal(inNightWindow(instant, '23:30', '11:30', eastern), true);
  assert.equal(inNightWindow(instant, '23:30', '11:30', 'Asia/Tokyo'), false);

  // Kolkata is UTC+5:30: 23:30 there is 18:00Z
  assert.equal(inNightWindow(at('2026-10-04T17:59:00Z'), '23:30', '11:30', 'Asia/Kolkata'), false);
  assert.equal(inNightWindow(at('2026-10-04T18:00:00Z'), '23:30', '11:30', 'Asia/Kolkata'), true);

  // a name Intl does not know is read in the Theme page's default zone, so the screen carries on
  assert.equal(minutesIn('Mars/Olympus_Mons', instant), 0);
  assert.equal(inNightWindow(instant, '23:30', '11:30', 'Mars/Olympus_Mons'), true);
  assert.equal(minutesIn(undefined, instant), 0);
});

test('the answer does not depend on the time zone of the computer it runs on', () => {
  // The same instants, asked on computers set to three other zones, give the same answers
  const instants = [
    '2026-10-04T03:29:00Z', '2026-10-04T04:00:00Z', '2026-10-04T15:29:00Z', '2026-10-04T15:30:00Z',
    '2026-12-20T04:29:00Z', '2026-12-20T04:30:00Z', '2026-12-20T16:29:00Z', '2026-12-20T16:30:00Z',
  ];
  const ask = (nightTime, list) => list.map(text => nightTime(at(text)));
  const here = ask(now => inNightWindow(now, '23:30', '11:30', eastern), instants);
  assert.deepEqual(here, [false, true, true, false, false, true, true, false]);

  const script = [
    'import { inNightWindow } from ' + JSON.stringify(nightUrl) + ';',
    'const list = ' + JSON.stringify(instants) + ';',
    'console.log(JSON.stringify(list.map(text => inNightWindow(new Date(text), "23:30", "11:30", "America/New_York"))));',
  ].join('\n');

  ['Pacific/Honolulu', 'Asia/Tokyo', 'Europe/London'].forEach(zone => {
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: Object.assign({}, process.env, { TZ: zone }), encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout), here, 'computer set to ' + zone);
  });
});

test('days when the clocks change use the clock on the wall, so a window follows it', () => {
  // New York, 8 March 2026: at 02:00 the clock jumps to 03:00 (EST to EDT)
  const spring = text => inNightWindow(at(text), '02:00', '04:00', eastern);
  assert.equal(spring('2026-03-08T06:59:00Z'), false, '01:59 EST');
  assert.equal(spring('2026-03-08T07:00:00Z'), true, '03:00 EDT, the first minute after the jump');
  assert.equal(spring('2026-03-08T07:59:00Z'), true, '03:59 EDT');
  assert.equal(spring('2026-03-08T08:00:00Z'), false, '04:00 EDT');

  // 1 November 2026: at 02:00 the clock goes back to 01:00, so 01:30 happens twice
  const autumn = text => inNightWindow(at(text), '01:00', '02:00', eastern);
  assert.equal(autumn('2026-11-01T04:59:00Z'), false, '00:59 EDT');
  assert.equal(autumn('2026-11-01T05:30:00Z'), true, '01:30 EDT');
  assert.equal(autumn('2026-11-01T06:30:00Z'), true, '01:30 EST, the second time');
  assert.equal(autumn('2026-11-01T07:00:00Z'), false, '02:00 EST');

  // the starting window across both nights: 23:30 is 04:30Z in winter and 03:30Z in summer
  const night = text => inNightWindow(at(text), '23:30', '11:30', eastern);
  assert.equal(night('2026-03-08T04:30:00Z'), true, '23:30 EST the evening before the jump');
  assert.equal(night('2026-03-08T15:29:00Z'), true, '11:29 EDT the morning after');
  assert.equal(night('2026-03-08T15:30:00Z'), false, '11:30 EDT');
  assert.equal(night('2026-03-09T03:29:00Z'), false, '23:29 EDT');
  assert.equal(night('2026-03-09T03:30:00Z'), true, '23:30 EDT');
  assert.equal(night('2026-11-01T15:29:00Z'), true, '10:29 EST, and 11:29 is 16:29Z');
  assert.equal(night('2026-11-01T16:29:00Z'), true, '11:29 EST');
  assert.equal(night('2026-11-01T16:30:00Z'), false, '11:30 EST');
});

test('night mode is wanted by the clock, forced by the preview switch even when it is off, and the address switch beats both', () => {
  const midnight = at('2027-01-15T05:00:00Z');
  const noon = at('2027-01-15T17:00:00Z');
  const settings = Object.assign({}, config.defaultSettings);

  assert.equal(nightWanted(settings, eastern, midnight, ''), true);
  assert.equal(nightWanted(settings, eastern, noon, ''), false);

  assert.equal(nightWanted(Object.assign({}, settings, { nightEnabled: false }), eastern, midnight, ''), false, 'the switch is off');
  assert.equal(nightWanted(Object.assign({}, settings, { nightPreview: true }), eastern, noon, ''), true, 'the preview shows it at noon');
  assert.equal(nightWanted(Object.assign({}, settings, { nightPreview: true, nightEnabled: false }), eastern, noon, ''), true, 'and with the switch off');
  assert.equal(nightWanted(Object.assign({}, settings, { nightPreview: 'yes' }), eastern, noon, ''), false, 'only true counts');

  assert.equal(nightWanted(settings, eastern, noon, 'on'), true, '?night=on');
  assert.equal(nightWanted(settings, eastern, midnight, 'off'), false, '?night=off');
  assert.equal(nightWanted(Object.assign({}, settings, { nightPreview: true }), eastern, midnight, 'off'), false, '?night=off beats the preview');
});

test('the starting settings are the ones the owner asked for', () => {
  const defaults = config.defaultSettings;

  assert.equal(defaults.nightEnabled, true);
  assert.equal(defaults.nightStyle, 'bounce');
  assert.equal(defaults.nightStart, '23:30');
  assert.equal(defaults.nightEnd, '11:30');
  assert.equal(defaults.nightLogoWidth, 300);
  assert.equal(defaults.nightSpeed, 'normal');
  assert.equal(defaults.nightPreview, false);
  assert.deepEqual(config.nightStyles, ['bounce', 'black']);
  assert.deepEqual(Object.keys(config.nightSpeeds), ['slow', 'normal', 'fast']);
  assert.deepEqual(config.limits.nightLogoWidth, { min: 120, max: 800 });
  assert.equal(config.defaultThemeSettings.timeZone, eastern, 'the zone comes from the Theme page, where it starts as New York');
});

// The bounce -------------------------------------------------------------

// A small random number maker with a fixed start, so a failure can be repeated
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test('the three speeds are different prime numbers of seconds, so the two movements only meet at a corner once in across x down seconds', () => {
  const expected = { slow: [31, 23, 713], normal: [23, 17, 391], fast: [17, 13, 221] };

  Object.keys(expected).forEach(name => {
    const speed = config.nightSpeeds[name];
    const prime = number => number > 1 && Array.from({ length: number - 2 }, (unused, index) => index + 2).every(divisor => number % divisor !== 0);

    assert.deepEqual([speed.across, speed.down], [expected[name][0], expected[name][1]], name);
    assert.ok(prime(speed.across) && prime(speed.down) && speed.across !== speed.down, name + ' are two different primes');
    assert.equal(nightPlan(name, () => 0.5).repeatEvery, expected[name][2], name + ' repeats every ' + expected[name][2] + ' seconds');
  });
  assert.ok(config.nightSpeeds.slow.across > config.nightSpeeds.normal.across && config.nightSpeeds.normal.across > config.nightSpeeds.fast.across, 'slow takes longer to cross');
});

test('the logo is in a corner at the first hit and then once every repeat, and at no other second', () => {
  const random = seeded(2027);

  Object.keys(config.nightSpeeds).forEach(name => {
    for (let draw = 0; draw < 20; draw++) {
      const plan = nightPlan(name, random);
      const corners = [];

      for (let second = 0; second <= plan.repeatEvery * 3 + plan.firstHit; second++) {
        const sideways = positionAt(second, plan.across, plan.acrossDelay);
        const down = positionAt(second, plan.down, plan.downDelay);
        if (atWall(sideways) && atWall(down)) corners.push(second);
      }

      const label = name + ' draw ' + draw + ' ' + JSON.stringify(plan);
      assert.equal(corners[0], plan.firstHit, label + ': the first corner');
      assert.deepEqual(corners.slice(1, 4).map((second, index) => second - corners[index]), [plan.repeatEvery, plan.repeatEvery, plan.repeatEvery].slice(0, corners.slice(1, 4).length), label + ': then every repeat');
      assert.equal(corners.length, 4, label + ': four corners in three repeats and a first hit');
    }
  });
});

test('the first hit comes two to five minutes after night mode starts, and never before the logo has hit every wall alone', () => {
  const random = seeded(4);

  Object.keys(config.nightSpeeds).forEach(name => {
    for (let draw = 0; draw < 200; draw++) {
      const plan = nightPlan(name, random);
      assert.ok(plan.firstHit >= config.nightFirstHit.min, name + ' not before ' + config.nightFirstHit.min + ' seconds');
      assert.ok(plan.firstHit <= Math.min(config.nightFirstHit.max, plan.repeatEvery), name + ' not after ' + config.nightFirstHit.max + ' seconds or the repeat');
    }
  });
  assert.deepEqual(config.nightFirstHit, { min: 120, max: 300 });
});

test('the logo never starts in a corner, or against any wall', () => {
  const random = seeded(99);

  Object.keys(config.nightSpeeds).forEach(name => {
    for (let draw = 0; draw < 500; draw++) {
      const plan = nightPlan(name, random);
      const sideways = positionAt(0, plan.across, plan.acrossDelay);
      const down = positionAt(0, plan.down, plan.downDelay);

      [sideways, down].forEach(position => assert.ok(position >= 0.15 && position <= 0.85, name + ' starts at ' + position + ' of the way across'));
      assert.ok(plan.acrossDelay > 0 && plan.acrossDelay < plan.across && plan.downDelay > 0 && plan.downDelay < plan.down, 'a negative delay that is less than one trip');
    }
  });
});

test('the draw picks the first hit from the allowed seconds, and an unknown speed is Normal', () => {
  const first = nightPlan('normal', drawing(0));
  const last = nightPlan('normal', drawing(0.999999));
  const middle = nightPlan('normal', drawing(0.5));

  assert.ok(first.firstHit < middle.firstHit && middle.firstHit < last.firstHit);

  // the earliest second from 120 on that is more than 15 percent of a crossing away from a wall, on both axes
  const clear = (second, seconds) => second % seconds >= 0.15 * seconds && second % seconds <= 0.85 * seconds;
  let earliest = config.nightFirstHit.min;
  while (!(clear(earliest, config.nightSpeeds.normal.across) && clear(earliest, config.nightSpeeds.normal.down))) earliest += 1;
  assert.equal(first.firstHit, earliest, 'the earliest clear second at normal speed');

  ['quick', '', undefined, null, 'toString', 'constructor', 7].forEach(value => {
    assert.deepEqual(nightPlan(value, drawing(0.3)), nightPlan('normal', drawing(0.3)), String(value));
  });

  // the plan hands whole seconds to the stylesheet
  Object.keys(config.nightSpeeds).forEach(name => {
    const plan = nightPlan(name, seeded(7));
    ['across', 'down', 'acrossDelay', 'downDelay', 'firstHit', 'repeatEvery'].forEach(key => assert.ok(Number.isInteger(plan[key]), name + ' ' + key));
  });
});

test('positionAt is what an alternating linear animation with a negative delay does', () => {
  // 10 seconds across, started 2.5 seconds in: a quarter of the way, going to the far wall
  assert.equal(positionAt(0, 10, 2.5), 0.25);
  assert.equal(positionAt(7.5, 10, 2.5), 1, 'the far wall after 7.5 more seconds');
  assert.equal(positionAt(12.5, 10, 2.5), 0.5, 'then back, half way');
  assert.equal(positionAt(17.5, 10, 2.5), 0, 'the near wall');
  assert.equal(positionAt(27.5, 10, 2.5), 1, 'and over again');
});

test('a corner hit is two walls within 100 ms of each other, one on each axis, counted once', () => {
  const detector = makeCornerDetector(100);

  assert.equal(detector.bounce('x', 1000), false);
  assert.equal(detector.bounce('y', 1060), true, 'y 60 ms after x');
  assert.equal(detector.bounce('x', 1061), false, 'the pair was used up');
  assert.equal(detector.bounce('y', 1100), true, 'a new x and y close together');

  assert.equal(detector.bounce('y', 5000), false);
  assert.equal(detector.bounce('x', 5100), true, 'exactly 100 ms counts, either way round');
  assert.equal(detector.bounce('x', 9000), false);
  assert.equal(detector.bounce('y', 9101), false, '101 ms is two bounces');
  assert.equal(detector.bounce('x', 9150), true, 'x 49 ms after that y');

  const alone = makeCornerDetector(100);
  assert.equal(alone.bounce('x', 0), false);
  assert.equal(alone.bounce('x', 10), false, 'two on the same wall axis never count');
  assert.equal(alone.bounce('x', 20), false);
  assert.equal(alone.bounce('y', 5000), false);
  assert.equal(alone.bounce('x', 30000), false);
  assert.equal(night.cornerWindowMs, 100);
});

test('every wall the plan reaches goes through the detector, and only the corners come out as hits', () => {
  Object.keys(config.nightSpeeds).forEach(name => {
    const plan = nightPlan(name, seeded(31));
    const detector = makeCornerDetector(night.cornerWindowMs);
    const hours = 3 * 3600;

    // every wall in milliseconds, in the order the browser sends the events
    const events = [];
    for (let second = plan.across - plan.acrossDelay; second <= hours; second += plan.across) events.push({ axis: 'x', time: second * 1000 });
    for (let second = plan.down - plan.downDelay; second <= hours; second += plan.down) events.push({ axis: 'y', time: second * 1000 + 4 }); // a few ms apart, as the browser sends them
    events.sort((a, b) => a.time - b.time);

    const hits = events.filter(event => detector.bounce(event.axis, event.time)).map(event => Math.round(event.time / 1000));
    const expected = [];
    for (let second = plan.firstHit; second <= hours; second += plan.repeatEvery) expected.push(second);

    assert.deepEqual(hits, expected, name);
    assert.equal(hits.length, Math.floor((hours - plan.firstHit) / plan.repeatEvery) + 1, name + ': a corner every ' + plan.repeatEvery + ' seconds');
  });
});

test('the colours go round four pairs, and frame.css has a rule for each', () => {
  assert.equal(night.pairCount, 4);
  assert.deepEqual([0, 1, 2, 3, 4].map(nextPair), [1, 2, 3, 0, 1]);
  [undefined, null, -1, 1.5, 'x', NaN].forEach(value => assert.equal(nextPair(value), 0, String(value)));

  const base = read('base.css');
  const pairs = base.match(/#night \.night-block\[data-pair="(\d)"\]\s*\{[^}]*\}/g) || [];
  assert.equal(pairs.length, night.pairCount, 'a rule for each pair');

  const palette = pairs.map(rule => rule.match(/--night-plate: var\((--[a-z]+)\); --night-line: var\((--[a-z]+)\)/).slice(1));
  assert.deepEqual(palette, [['--yellow', '--white'], ['--lilac', '--yellow'], ['--silver', '--lilac'], ['--white', '--silver']]);
  assert.ok(new Set(palette.map(pair => pair.join())).size === 4, 'four different pairs');

  const colours = new Set(palette.reduce((all, pair) => all.concat(pair), []));
  assert.deepEqual(Array.from(colours).sort(), ['--lilac', '--silver', '--white', '--yellow'], 'gold, light purple, silver and white');
  assert.ok(/--silver: #[0-9a-f]{6};/.test(read('tokens.css')), 'tokens.css has the silver');
  assert.ok(/--lilac: #/.test(read('themes/hawktimus.css')) && /--yellow: #/.test(read('themes/hawktimus.css')), 'the theme has the others');
});

// The page code and the stylesheets, read as text --------------------------

// The stylesheet's night section, from its comment to the next section
function nightSection(css, from, to) {
  const start = css.indexOf(from);
  const end = css.indexOf(to, start);
  assert.ok(start !== -1 && end > start, 'the section starting "' + from + '" is there');
  return css.slice(start, end);
}

// Every @keyframes in a piece of CSS, as { name, body }, found by counting braces
function keyframesIn(css) {
  const found = [];
  const pattern = /@keyframes ([a-z-]+) \{/g;
  let match;

  while ((match = pattern.exec(css)) !== null) {
    let depth = 1;
    let end = pattern.lastIndex;
    while (depth > 0 && end < css.length) {
      if (css[end] === '{') depth += 1;
      if (css[end] === '}') depth -= 1;
      end += 1;
    }
    found.push({ name: match[1], body: css.slice(pattern.lastIndex, end - 1) });
  }
  return found;
}

test('the emblem is drawn once as one svg with no colour of its own', () => {
  const markup = logo.emblemMarkup();

  assert.ok(markup.startsWith('<svg viewBox="0 0 1100 884"'));
  assert.equal((markup.match(/<polygon class="emblem-outline"/g) || []).length, 5, 'the five shapes of the four plates, outlined');
  assert.equal((markup.match(/<polygon class="emblem-plate"/g) || []).length, 5, 'and filled');
  assert.equal((markup.match(/<polygon class="emblem-stripe"/g) || []).length, 4, 'with the four stripes of the wings');
  assert.ok(markup.lastIndexOf('class="emblem-outline"') < markup.indexOf('class="emblem-plate"'), 'every outline is under every plate');
  assert.ok(markup.lastIndexOf('class="emblem-plate"') < markup.indexOf('class="emblem-stripe"'), 'and every plate is under the stripes');
  ['outline', 'plate', 'slash'].forEach(name => assert.ok(!markup.includes('class="' + name + '"'), 'no class that other rules use: ' + name));
  assert.ok(!/fill=|stroke=|style=|#[0-9a-f]{3,6}\b|rgb/i.test(markup), 'the colours are the stylesheet\'s variables');

  const screen = read('core/night-screen.js');
  assert.equal((screen.match(/emblemMarkup\(\)/g) || []).length, 1, 'drawn in one place, once');
  assert.ok(screen.includes("import { emblemMarkup } from './logo.js';"));
});

test('a team logo fills the logo box and takes the hawk out of the way, and the hawk stays in the box for the effects', () => {
  const css = read('frame.css');
  assert.ok(/\.logo \.team-logo \{[^}]*position: absolute;[^}]*width: 100%;[^}]*height: 100%;[^}]*object-fit: contain;[^}]*\}/.test(css));
  assert.ok(/\.logo\[data-team-logo\] \.drawing \{\s*display: none;\s*\}/.test(css), 'the hawk is hidden, not taken out of the page');

  const code = read('core/logo.js');
  assert.ok(/export function showTeamLogo\(box, address\)/.test(code));
  assert.ok(!/innerHTML/.test(code.slice(code.indexOf('export function showTeamLogo'), code.indexOf('export function emblemMarkup'))), 'the markup of the hawk is not rebuilt');
});

test('the night screen does nothing per frame: no frame timer, only the clock once a second and two events', () => {
  const screen = read('core/night-screen.js');
  const code = screen.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

  assert.ok(!/requestAnimationFrame|setInterval|\.animate\(|getAnimations|performance\.now|Date\.now/.test(code), 'no loop and no clock of its own');
  assert.ok(code.includes('frame.onSecond(look)'), 'once a second, from the one clock');
  assert.ok(code.includes("addEventListener('animationiteration', onBounce)"), 'a wall reached is an event');
  assert.ok(code.includes('watchTakeovers(settle)'), 'an alert starting or ending is an event');
  assert.ok(code.includes('nightWanted(content.settings, content.theme.timeZone, now, override)'), 'the time zone is the Theme page\'s');
  assert.ok(code.includes('frame.setNightCovers(covering && !stepAside)'), 'the effects wait while it covers');
  assert.ok(code.includes('nightPlan(speedName, Math.random)'), 'the plan is made once per start, not per frame');

  // the colour changes with an attribute, and a corner hit with a class
  assert.ok(code.includes('block.dataset.pair = String(nextPair('));
  assert.ok(code.includes("block.classList.add('hit')"));
  assert.ok(code.includes("event.animationName === 'night-x'") && code.includes("'night-y'"), 'it listens to the two bounces by name');
  assert.ok(code.includes("root.dataset.motion === 'full'"), 'the corner spin is skipped in calm and none');
});

test('the alerts and announcements are wired in, and the night screen sits between the stage and the overlay', () => {
  const takeover = read('core/takeover.js');
  const begin = takeover.slice(takeover.indexOf('function begin('), takeover.indexOf('function finish('));
  const finish = takeover.slice(takeover.indexOf('function finish('), takeover.indexOf('function withAnnouncement('));
  assert.ok(takeover.includes('export function watchTakeovers(listener)'));
  assert.ok(begin.includes('tellWatcher()') && finish.includes('tellWatcher()'), 'told when one starts and when it ends');
  assert.ok(finish.indexOf('running = null') < finish.indexOf('tellWatcher()'), 'told after it is over, so it sees the screen free');

  const page = read('index.html');
  const order = ['<div id="stage">', '<div id="connection-status"', '<div id="night" hidden>', '<div id="overlay">'].map(text => page.indexOf(text));
  assert.ok(order.every(position => position !== -1) && order.join() === order.slice().sort((a, b) => a - b).join(), 'stage, connection text, night, overlay, in that order');

  const shell = read('shell.js');
  assert.ok(shell.includes("startOptional('./core/night-screen.js', module => module.startNight(getContent, params.get('night')))"), 'started by the shell, and optional like the weather');
  assert.ok(shell.indexOf("'./core/night-screen.js'") < shell.indexOf('startWhatStays();'), 'before the panels are drawn');
  assert.ok(shell.includes('//   night=on|off'), 'the address switch is listed');

  const frame = read('frame.js');
  assert.ok(frame.includes('export function setNightCovers(covers)'));
  assert.ok(frame.includes("if (motion !== 'full' || nightCovers || hiddenPlaying) return;"), 'no effect comes due while it covers');
});

test('the number is 64px in the display face under the logo, the sizes come from CSS, and the stage is hidden under the screen', () => {
  const base = nightSection(read('base.css'), '/* Night mode, the screensaver', '.panel { position: relative; }');

  assert.ok(/\.night-number \{[^}]*font: 700 var\(--size-body-large\)\/var\(--night-number-h\) var\(--font-display\);/.test(base), 'Tomorrow, 64px');
  assert.ok(/--size-body-large: 64px;/.test(read('tokens.css')) && /--font-display: 'Tomorrow'/.test(read('tokens.css')));
  assert.ok(base.includes('--night-logo-w: 300px;'), 'about 300 px to start with, and the width setting replaces it');
  assert.ok(base.includes('--night-travel-x: calc(1920px - var(--night-block-w));'));
  assert.ok(base.includes('--night-travel-y: calc(1080px - var(--night-block-h));'));
  assert.ok(base.includes('background: #000;'), 'black');
  assert.ok(base.includes('html[data-night="on"] #stage { visibility: hidden; }'));
  assert.ok(base.includes('.night-flash') && /\.night-flash \{[^}]*color: var\(--yellow\);[^}]*opacity: 0;/.test(base), 'the second copy of the number is gold and starts invisible');
});

test('the bounce is two linear alternate animations on two elements, with the delays from the script, and nothing but transform and opacity moves', () => {
  const css = nightSection(read('frame.css'), '/* Night mode, the screensaver', '/* A test switch');

  assert.ok(css.includes('animation: night-x var(--night-x-seconds) linear var(--night-x-delay) infinite alternate;'));
  assert.ok(css.includes('animation: night-y var(--night-y-seconds) linear var(--night-y-delay) infinite alternate;'));
  assert.ok(/\[data-motion="full"\] #night\[data-run="moving"\] \.night-x \{/.test(css) && /\[data-motion="full"\] #night\[data-run="moving"\] \.night-y \{/.test(css), 'only in full motion');
  assert.ok(css.includes('transform: translateX(var(--night-travel-x))') && css.includes('transform: translateY(var(--night-travel-y))'), 'the travel is worked out in CSS');
  assert.ok(css.includes('animation: night-spin 1.5s ease-in-out;') && css.includes('animation: night-flash 1.5s linear;'), 'the corner hit takes 1.5 s');
  assert.ok(/\[data-motion="full"\] #night \.night-block\.hit \.night-logo/.test(css) && /\[data-motion="full"\] #night \.night-block\.hit \.night-flash/.test(css), 'no spin in calm or none');
  assert.ok(css.includes('rotate(360deg)') && !/rotate3d|rotateX|rotateY|perspective|translateZ|scale3d/.test(css), 'one full turn, flat');
  assert.ok(css.includes('#night.yielding {') && css.includes('--night-play: paused;'), 'it waits for an alert');

  // every keyframe in the section changes only transform or opacity
  const keyframes = keyframesIn(css);
  assert.deepEqual(keyframes.map(entry => entry.name), ['night-x', 'night-y', 'night-spin', 'night-flash']);
  keyframes.forEach(entry => {
    const properties = entry.body.match(/[a-z-]+(?=\s*:)/g) || [];
    assert.ok(properties.length > 0, entry.name + ' changes something');
    properties.forEach(property => assert.ok(property === 'transform' || property === 'opacity', entry.name + ' changes ' + property));
  });

  // and nothing in either night section is a blur, glow, filter, shadow, video or a moving gradient
  const both = css + nightSection(read('base.css'), '/* Night mode, the screensaver', '.panel { position: relative; }');
  assert.ok(!/blur|filter|box-shadow|text-shadow|drop-shadow|backdrop|gradient|video|will-change/.test(both), 'a flat black screen with flat shapes');
  assert.ok(!/--pace/.test(css.replace(/Night mode has its own speed[\s\S]*?nothing here is multiplied by --pace\./, '')), 'the Speed setting does not change it');
});

test('Night mode is black with a plain fade, still in calm and none, and the logo stays in the middle', () => {
  const css = nightSection(read('frame.css'), '/* Night mode, the screensaver', '/* A test switch');

  assert.ok(css.includes('#night[data-state="in"] { animation: fade-in 1s linear backwards; }'));
  assert.ok(css.includes('#night[data-state="out"] { animation: fade-out 1s linear forwards; }'));
  assert.ok(css.includes('[data-motion="none"] #night { animation: none; }'));
  assert.ok(css.includes('#night .night-x { transform: translateX(calc(var(--night-travel-x) / 2)); }'));
  assert.ok(css.includes('#night .night-y { transform: translateY(calc(var(--night-travel-y) / 2)); }'));
  assert.ok(css.includes('#night[data-style="black"] .night-x { display: none; }'), 'blank black has no logo');
  assert.ok(read('core/night-screen.js').includes("root.dataset.motion === 'none' ? 0 : fadeMs"), 'and no wait with no motion');
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
