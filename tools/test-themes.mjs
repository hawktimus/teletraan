// Tests for the theme code: which theme and overlay apply (dashboard/core/theme.js)
// and how they are put on the page (dashboard/core/theme-apply.js, with a fake
// page). Nothing touches the network or a browser.
//
//   node tools/test-themes.mjs
//
// The colours of the themes are checked by tools/check-themes.mjs.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-themes-'));
fs.mkdirSync(path.join(workFolder, 'dashboard/core'), { recursive: true });
fs.mkdirSync(path.join(workFolder, 'dashboard/themes/overlays'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'frame.js', 'themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(workFolder, 'dashboard', file));
});
['theme.js', 'theme-apply.js', 'transitions.js', 'tick.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(workFolder, 'dashboard/core', file));
});

const base = pathToFileURL(path.join(workFolder, 'dashboard')).href + '/';
const config = await import(base + 'config.js');
const { resolveTheme, tidyTheme, ruleCovers, dateIn, isTimeZone } = await import(base + 'core/theme.js');
const { themes } = await import(base + 'themes/registry.js');
const { overlays } = await import(base + 'themes/overlays/registry.js');

const otherTheme = themes.filter(theme => theme.id !== config.defaultThemeSettings.defaultTheme)[0].id;
const exampleOverlay = overlays.filter(overlay => overlay.id === 'example')[0];
const anOverlay = exampleOverlay.id; // the placeholder overlay: colours only, no decorations
const defaultTheme = config.defaultThemeSettings.defaultTheme;

const tests = [];

function test(name, run) {
  tests.push({ name: name, run: run });
}

// A rule as the Studio sends it
function rule(kind, id, start, end, repeats) {
  const result = { name: '[Rule]', kind: kind, startDate: start, endDate: end, repeatsEveryYear: repeats === true };
  result[kind] = id;
  return result;
}

// The look the screen would have at a moment, with the schedule given
function lookAt(schedule, instant, extra) {
  return resolveTheme(Object.assign({ schedule: schedule }, extra), new Date(instant));
}

const none = { theme: defaultTheme, overlay: '' };

// Which theme and overlay apply

test('the registries have the placeholder theme and overlay, and the default theme is listed', () => {
  assert.ok(themes.some(theme => theme.id === defaultTheme));
  assert.ok(themes.length >= 2, 'there should be a second theme');
  assert.ok(overlays.length >= 1, 'there should be an overlay');
  assert.ok(/placeholder/i.test(themes.filter(theme => theme.id === otherTheme)[0].name), 'the second theme is marked as a placeholder');
  assert.ok(/placeholder/i.test(exampleOverlay.name), 'the example overlay is marked as a placeholder');
});

test('the seven seasonal packs are listed, in order, with their final ids, and the example has no decorations', () => {
  const packs = [
    ['halloween', 'Halloween'], ['thanksgiving', 'Thanksgiving'], ['christmas', 'Christmas'], ['new-years', 'New Year\'s'],
    ['valentines-day', 'Valentine\'s Day'], ['competition-day', 'Competition Day'], ['summer-break', 'Summer Break'],
  ];
  assert.deepEqual(overlays.slice(0, 7).map(overlay => [overlay.id, overlay.name]), packs);
  assert.ok(overlays.slice(0, 7).every(overlay => overlay.decorations === true), 'every pack says it has decorations');
  assert.equal(exampleOverlay.decorations, false);
  assert.ok(overlays.every(overlay => typeof overlay.decorations === 'boolean'), 'every overlay says decorations: true or false');
  assert.equal(new Set(overlays.map(overlay => overlay.id)).size, overlays.length, 'no id twice');
});

test('with nothing set, or nothing usable, the default theme and no overlay', () => {
  const noon = '2026-10-10T16:00:00Z';
  assert.deepEqual(resolveTheme(undefined, new Date(noon)), none);
  assert.deepEqual(resolveTheme(null, new Date(noon)), none);
  assert.deepEqual(resolveTheme({}, new Date(noon)), none);
  assert.deepEqual(resolveTheme('oops', new Date(noon)), none);
  assert.deepEqual(resolveTheme({ schedule: 'oops', useNow: 5, timeZone: 7 }, new Date(noon)), none);
  assert.deepEqual(resolveTheme({}), resolveTheme({}, new Date()), 'with no time it uses now');
});

test('the default theme is used when it is set, and an id that is not in the registry becomes the starting one', () => {
  const noon = new Date('2026-10-10T16:00:00Z');
  assert.deepEqual(resolveTheme({ defaultTheme: otherTheme }, noon), { theme: otherTheme, overlay: '' });
  assert.deepEqual(resolveTheme({ defaultTheme: 'no-such-theme' }, noon), none);
  assert.deepEqual(resolveTheme({ defaultTheme: 3 }, noon), none);
});

test('a rule covers its first and last day, and no other', () => {
  const schedule = [rule('theme', otherTheme, '2026-10-10', '2026-10-12')];
  const asOther = { theme: otherTheme, overlay: '' };

  assert.deepEqual(lookAt(schedule, '2026-10-09T16:00:00Z'), none);
  assert.deepEqual(lookAt(schedule, '2026-10-10T16:00:00Z'), asOther);
  assert.deepEqual(lookAt(schedule, '2026-10-11T16:00:00Z'), asOther);
  assert.deepEqual(lookAt(schedule, '2026-10-12T16:00:00Z'), asOther);
  assert.deepEqual(lookAt(schedule, '2026-10-13T16:00:00Z'), none);
  assert.deepEqual(lookAt(schedule, '2027-10-11T16:00:00Z'), none, 'a rule that does not repeat is for that year only');
});

test('dates are read in the Theme time zone, not the zone of this computer', () => {
  const schedule = [rule('theme', otherTheme, '2026-10-10', '2026-10-10')];
  const lateInNewYork = '2026-10-11T02:30:00Z'; // 22:30 on the 10th in New York, already the 11th in UTC and Tokyo
  const asOther = { theme: otherTheme, overlay: '' };

  assert.deepEqual(lookAt(schedule, lateInNewYork, { timeZone: 'America/New_York' }), asOther);
  assert.deepEqual(lookAt(schedule, lateInNewYork), asOther, 'America/New_York is the default zone');
  assert.deepEqual(lookAt(schedule, lateInNewYork, { timeZone: 'UTC' }), none);
  assert.deepEqual(lookAt(schedule, lateInNewYork, { timeZone: 'Asia/Tokyo' }), none);
  assert.deepEqual(lookAt(schedule, '2026-10-09T20:00:00Z', { timeZone: 'Asia/Tokyo' }), asOther, 'the 10th has begun in Tokyo');

  // changing the zone of this computer changes nothing
  const before = process.env.TZ;
  try {
    ['Pacific/Kiritimati', 'Pacific/Pago_Pago'].forEach(zone => {
      process.env.TZ = zone;
      assert.deepEqual(lookAt(schedule, lateInNewYork, { timeZone: 'America/New_York' }), asOther, 'computer zone ' + zone);
      assert.deepEqual(lookAt(schedule, lateInNewYork, { timeZone: 'UTC' }), none, 'computer zone ' + zone);
    });
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});

test('dateIn gives the year, month and day in a zone, and isTimeZone knows the names', () => {
  assert.equal(dateIn('America/New_York', new Date('2027-01-01T04:30:00Z')), '2026-12-31');
  assert.equal(dateIn('UTC', new Date('2027-01-01T04:30:00Z')), '2027-01-01');
  assert.equal(dateIn('Asia/Tokyo', new Date('2026-03-01T16:00:00Z')), '2026-03-02');
  assert.equal(dateIn('America/Los_Angeles', new Date('2026-03-08T09:30:00Z')), '2026-03-08');

  ['America/New_York', 'UTC', 'Europe/London'].forEach(name => assert.equal(isTimeZone(name), true, name));
  ['Nowhere/Land', 'new york', '', null, 5, undefined].forEach(name => assert.equal(isTimeZone(name), false, String(name)));
  assert.equal(tidyTheme({ timeZone: 'Nowhere/Land' }).timeZone, config.defaultThemeSettings.timeZone);
  assert.equal(tidyTheme({ timeZone: 'Asia/Tokyo' }).timeZone, 'Asia/Tokyo');
});

test('a rule that repeats every year matches by month and day, whatever the year', () => {
  const schedule = [rule('overlay', anOverlay, '2025-12-01', '2025-12-10', true)];
  const withOverlay = { theme: defaultTheme, overlay: anOverlay };

  [2026, 2027, 2030].forEach(year => {
    assert.deepEqual(lookAt(schedule, year + '-11-30T17:00:00Z'), none, year + '-11-30');
    assert.deepEqual(lookAt(schedule, year + '-12-01T17:00:00Z'), withOverlay, year + '-12-01');
    assert.deepEqual(lookAt(schedule, year + '-12-10T17:00:00Z'), withOverlay, year + '-12-10');
    assert.deepEqual(lookAt(schedule, year + '-12-11T17:00:00Z'), none, year + '-12-11');
  });
});

test('a rule that repeats every year can cross New Year, for example 12-20 to 01-05', () => {
  const schedule = [rule('theme', otherTheme, '2025-12-20', '2026-01-05', true)];
  const asOther = { theme: otherTheme, overlay: '' };

  [['2026-12-19', none], ['2026-12-20', asOther], ['2026-12-31', asOther], ['2027-01-01', asOther], ['2027-01-05', asOther], ['2027-01-06', none], ['2027-06-15', none], ['2031-01-02', asOther]].forEach(entry => {
    assert.deepEqual(lookAt(schedule, entry[0] + 'T17:00:00Z'), entry[1], entry[0]);
  });
});

test('New Year is decided in the Theme time zone', () => {
  const newYearsDay = [rule('theme', otherTheme, '2026-01-01', '2026-01-01', true)];
  const asOther = { theme: otherTheme, overlay: '' };
  const justAfterMidnightUtc = '2027-01-01T04:30:00Z';

  assert.deepEqual(lookAt(newYearsDay, justAfterMidnightUtc, { timeZone: 'America/New_York' }), none, 'still 31 December in New York');
  assert.deepEqual(lookAt(newYearsDay, justAfterMidnightUtc, { timeZone: 'Asia/Tokyo' }), asOther, 'already 1 January in Tokyo');
  assert.deepEqual(lookAt(newYearsDay, '2027-01-01T05:00:00Z', { timeZone: 'America/New_York' }), asOther, 'midnight in New York');
});

test('a date can be a month and a day only, and then it repeats every year', () => {
  const schedule = [rule('theme', otherTheme, '12-20', '01-05', false)];
  const asOther = { theme: otherTheme, overlay: '' };

  assert.equal(tidyTheme({ schedule: schedule }).schedule[0].repeatsEveryYear, true);
  assert.deepEqual(lookAt(schedule, '2026-12-25T17:00:00Z'), asOther);
  assert.deepEqual(lookAt(schedule, '2031-01-03T17:00:00Z'), asOther);
  assert.deepEqual(lookAt(schedule, '2031-02-03T17:00:00Z'), none);

  // a month and day on one end only, with a whole date on the other, also repeats
  const mixed = [rule('theme', otherTheme, '12-20', '2026-01-05', false)];
  assert.deepEqual(lookAt(mixed, '2028-12-25T17:00:00Z'), asOther);
});

test('a rule that does not repeat can cross New Year once, and never applies if it ends before it starts', () => {
  const crossing = [rule('theme', otherTheme, '2026-12-20', '2027-01-05', false)];
  const asOther = { theme: otherTheme, overlay: '' };

  assert.deepEqual(lookAt(crossing, '2026-12-25T17:00:00Z'), asOther);
  assert.deepEqual(lookAt(crossing, '2027-01-02T17:00:00Z'), asOther);
  assert.deepEqual(lookAt(crossing, '2027-12-25T17:00:00Z'), none, 'not the year after');
  assert.deepEqual(lookAt(crossing, '2028-01-02T17:00:00Z'), none, 'not the year after');

  const backwards = [rule('theme', otherTheme, '2026-12-20', '2026-12-01', false)];
  ['2026-12-01', '2026-12-10', '2026-12-20', '2026-12-25'].forEach(day => {
    assert.deepEqual(lookAt(backwards, day + 'T17:00:00Z'), none, day);
  });
});

test('ruleCovers on its own', () => {
  assert.equal(ruleCovers(rule('theme', otherTheme, '2026-03-01', '2026-03-31', false), '2026-03-15'), true);
  assert.equal(ruleCovers(rule('theme', otherTheme, '2026-03-01', '2026-03-31', false), '2026-04-01'), false);
  assert.equal(ruleCovers(rule('theme', otherTheme, '2026-03-01', '2026-03-31', true), '2031-03-31'), true);
  assert.equal(ruleCovers(rule('theme', otherTheme, '02-29', '03-02', true), '2027-03-01'), true, 'a rule from 29 February still runs in a year without one');
  assert.equal(ruleCovers(rule('theme', otherTheme, '02-27', '02-29', true), '2027-02-28'), true);
  assert.equal(ruleCovers({ startDate: 'x', endDate: '2026-01-01', repeatsEveryYear: false }, '2026-01-01'), false);
});

test('the first matching rule of each kind wins, and a theme and an overlay are picked on their own', () => {
  const third = themes.length > 2 ? themes[2].id : otherTheme;
  const schedule = [
    rule('theme', otherTheme, '2026-12-01', '2026-12-31'),
    rule('overlay', anOverlay, '2026-12-20', '2026-12-26'),
    rule('theme', third, '2026-12-10', '2026-12-31'),
  ];

  assert.deepEqual(lookAt(schedule, '2026-11-30T17:00:00Z'), none);
  assert.deepEqual(lookAt(schedule, '2026-12-05T17:00:00Z'), { theme: otherTheme, overlay: '' });
  assert.deepEqual(lookAt(schedule, '2026-12-15T17:00:00Z'), { theme: otherTheme, overlay: '' }, 'the first rule wins where two overlap');
  assert.deepEqual(lookAt(schedule, '2026-12-25T17:00:00Z'), { theme: otherTheme, overlay: anOverlay });
  assert.deepEqual(lookAt(schedule, '2026-12-28T17:00:00Z'), { theme: otherTheme, overlay: '' });

  // the same, with the overlay rule first in the list
  const overlayFirst = [schedule[1], schedule[0]];
  assert.deepEqual(lookAt(overlayFirst, '2026-12-25T17:00:00Z'), { theme: otherTheme, overlay: anOverlay });
});

test('use now beats the schedule, and each part can be left empty to follow the schedule', () => {
  const schedule = [
    rule('theme', otherTheme, '2026-12-01', '2026-12-31'),
    rule('overlay', anOverlay, '2026-12-01', '2026-12-31'),
  ];
  const noon = '2026-12-15T17:00:00Z';

  // theme only: the overlay follows the schedule
  assert.deepEqual(lookAt(schedule, noon, { useNow: { theme: defaultTheme } }), { theme: defaultTheme, overlay: anOverlay });
  // overlay only: the theme follows the schedule
  assert.deepEqual(lookAt([], noon, { defaultTheme: otherTheme, useNow: { overlay: anOverlay } }), { theme: otherTheme, overlay: anOverlay });
  assert.deepEqual(lookAt(schedule, noon, { useNow: { overlay: anOverlay } }), { theme: otherTheme, overlay: anOverlay });
  // both
  assert.deepEqual(lookAt(schedule, noon, { useNow: { theme: defaultTheme, overlay: 'none' } }), { theme: defaultTheme, overlay: '' });
  // none hides the scheduled overlay and leaves the theme alone
  assert.deepEqual(lookAt(schedule, noon, { useNow: { overlay: 'none' } }), { theme: otherTheme, overlay: '' });
  // empty and unknown ids are ignored
  assert.deepEqual(lookAt(schedule, noon, { useNow: { theme: '', overlay: '' } }), { theme: otherTheme, overlay: anOverlay });
  assert.deepEqual(lookAt(schedule, noon, { useNow: { theme: 'no-such-theme', overlay: 'no-such-overlay' } }), { theme: otherTheme, overlay: anOverlay });
});

test('use now stops at its until time, and with no until it stays', () => {
  const useNow = until => ({ theme: otherTheme, overlay: anOverlay, until: until });
  const asNow = { theme: otherTheme, overlay: anOverlay };
  const noon = new Date('2026-12-15T17:00:00Z');

  assert.deepEqual(resolveTheme({ useNow: useNow('2026-12-15T17:00:01Z') }, noon), asNow);
  assert.deepEqual(resolveTheme({ useNow: useNow('2026-12-15T17:00:00Z') }, noon), none, 'at the until time it has stopped');
  assert.deepEqual(resolveTheme({ useNow: useNow('2026-12-15T16:59:59Z') }, noon), none);
  assert.deepEqual(resolveTheme({ useNow: useNow('') }, noon), asNow);
  assert.deepEqual(resolveTheme({ useNow: { theme: otherTheme } }, noon), { theme: otherTheme, overlay: '' });
  assert.deepEqual(resolveTheme({ useNow: useNow('2099-01-01T00:00:00Z') }, noon), asNow);

  // after it has stopped the schedule and then the default apply
  const schedule = [rule('theme', defaultTheme, '2026-12-01', '2026-12-31')];
  assert.deepEqual(resolveTheme({ schedule: schedule, defaultTheme: otherTheme, useNow: useNow('2026-12-15T16:00:00Z') }, noon), { theme: defaultTheme, overlay: '' });
});

test('a rule that cannot be used is left out, and the rules after it still work', () => {
  const asOther = { theme: otherTheme, overlay: '' };
  const goodRule = rule('theme', otherTheme, '2026-12-01', '2026-12-31');
  const bad = [
    rule('theme', 'no-such-theme', '2026-12-01', '2026-12-31'),
    rule('overlay', 'no-such-overlay', '2026-12-01', '2026-12-31'),
    rule('theme', otherTheme, '', '2026-12-31'),
    rule('theme', otherTheme, '2026-12-01', undefined),
    rule('theme', otherTheme, '2026-02-30', '2026-12-31'),
    rule('theme', otherTheme, '2027-02-29', '2027-03-31'),
    rule('theme', otherTheme, 'December', '2026-12-31'),
    rule('banner', otherTheme, '2026-12-01', '2026-12-31'),
    { kind: 'theme', startDate: '2026-12-01', endDate: '2026-12-31' },
    null,
    'oops',
    7,
    goodRule,
  ];

  assert.deepEqual(tidyTheme({ schedule: bad }).schedule, [Object.assign({}, goodRule, { repeatsEveryYear: false })]);
  assert.deepEqual(lookAt(bad, '2026-12-15T17:00:00Z'), asOther);
});

test('tidyTheme gives the defaults for nothing, and keeps what is usable', () => {
  assert.deepEqual(tidyTheme(undefined), config.defaultThemeSettings);
  assert.deepEqual(tidyTheme({}), config.defaultThemeSettings);
  assert.deepEqual(tidyTheme({ _id: 'theme', _type: 'theme', _rev: 'x' }), config.defaultThemeSettings);

  const kept = tidyTheme({
    defaultTheme: otherTheme,
    useNow: { theme: otherTheme, overlay: 'none', until: '2026-12-15T17:00:00.000Z' },
    schedule: [rule('overlay', anOverlay, '2025-12-20', '2026-01-05', true)],
    timeZone: 'America/Chicago',
  });
  assert.equal(kept.defaultTheme, otherTheme);
  assert.deepEqual(kept.useNow, { theme: otherTheme, overlay: 'none', until: '2026-12-15T17:00:00.000Z' });
  assert.equal(kept.schedule.length, 1);
  assert.equal(kept.timeZone, 'America/Chicago');

  assert.deepEqual(tidyTheme({ useNow: { until: 'not a time' } }).useNow, config.defaultThemeSettings.useNow);
  assert.deepEqual(tidyTheme(tidyTheme(kept)), kept, 'tidying twice changes nothing');
});

// The page

// Just enough of a page for theme-apply.js: the html element with a class list,
// a head to add stylesheet links to, and a way to look a link up.
function makeClassList() {
  const list = { length: 0 };

  function names() {
    return Array.prototype.slice.call(list);
  }

  function set(newNames) {
    names().forEach((name, index) => { delete list[index]; });
    newNames.forEach((name, index) => { list[index] = name; });
    list.length = newNames.length;
  }

  list.add = name => {
    if (names().indexOf(name) === -1) set(names().concat(name));
  };
  list.remove = name => set(names().filter(existing => existing !== name));
  list.text = () => names().sort().join(' ');
  return list;
}

function makeDocument() {
  const links = [{ href: 'themes/hawktimus.css' }]; // index.html links this one itself
  return {
    links: links,
    documentElement: { classList: makeClassList() },
    head: {
      appendChild: link => {
        links.push(link);
        setImmediate(() => link.listeners.load && link.listeners.load());
      },
    },
    createElement: () => ({ listeners: {}, addEventListener(type, run) { this.listeners[type] = run; } }),
    querySelector: selector => links.filter(link => link.href === /href="([^"]+)"/.exec(selector)[1])[0] || null,
  };
}

let instance = 0;

// A fresh theme-apply.js with its own fake page and a clock the test moves.
// setInterval is replaced so nothing is left running.
async function inPage(run) {
  const world = { clock: 1000000, content: { theme: tidyTheme({}) }, intervals: [], page: makeDocument() };
  const realNow = Date.now;
  const realInterval = globalThis.setInterval;

  globalThis.document = world.page;
  Date.now = () => world.clock;
  globalThis.setInterval = (run, milliseconds) => world.intervals.push({ run: run, milliseconds: milliseconds });

  try {
    instance += 1;
    world.apply = await import(base + 'core/theme-apply.js?test=' + instance);
    world.classes = () => world.page.documentElement.classList.text();
    world.getContent = () => world.content;
    await run(world);
  } finally {
    Date.now = realNow;
    globalThis.setInterval = realInterval;
    delete globalThis.document; // node has none of its own
  }
}

const useOtherNow = { theme: otherTheme, overlay: anOverlay, until: '' };

test('at boot the theme goes on at once, and the stylesheets are linked from the registries, overlays last', async () => {
  await inPage(async world => {
    world.content = { theme: { useNow: useOtherNow } };
    await world.apply.startThemes(world.getContent, null);

    assert.equal(world.classes(), ['overlay-' + anOverlay, 'theme-' + otherTheme].sort().join(' '));

    const added = world.page.links.slice(1).map(link => link.href);
    const expected = themes.filter(theme => theme.id !== defaultTheme).map(theme => 'themes/' + theme.id + '.css')
      .concat(overlays.map(overlay => 'themes/overlays/' + overlay.id + '.css'));
    assert.deepEqual(added, expected, 'hawktimus.css is not linked again, and overlays come after themes');
    assert.ok(added.every(href => world.page.links.filter(link => link.href === href).length === 1));
    assert.equal(world.page.links.filter(link => link.rel !== undefined && link.rel !== 'stylesheet').length, 0);

    assert.equal(world.intervals.length, 1);
    assert.equal(world.intervals[0].milliseconds, 60 * 1000, 'it looks again once a minute');
  });
});

test('with no theme chosen the page gets the default theme class and no overlay class', async () => {
  await inPage(async world => {
    await world.apply.startThemes(world.getContent, null);
    assert.equal(world.classes(), 'theme-' + defaultTheme);
  });
});

test('a change waits for the page change, then both classes are replaced together', async () => {
  await inPage(async world => {
    await world.apply.startThemes(world.getContent, null);
    assert.equal(world.classes(), 'theme-' + defaultTheme);

    world.content = { theme: { useNow: useOtherNow } };
    world.apply.checkTheme();
    assert.equal(world.classes(), 'theme-' + defaultTheme, 'seen, but not shown yet');

    world.apply.changeThemeNow();
    assert.equal(world.classes(), ['overlay-' + anOverlay, 'theme-' + otherTheme].sort().join(' '), 'the old theme class is gone and the new pair is on');

    // and back again, which takes the overlay class away
    world.content = { theme: {} };
    world.apply.checkTheme();
    world.apply.changeThemeNow();
    assert.equal(world.classes(), 'theme-' + defaultTheme);
  });
});

test('a page change with nothing waiting changes nothing, and a change that went away is not shown', async () => {
  await inPage(async world => {
    await world.apply.startThemes(world.getContent, null);
    world.apply.changeThemeNow();
    assert.equal(world.classes(), 'theme-' + defaultTheme);

    world.content = { theme: { useNow: useOtherNow } };
    world.apply.checkTheme();
    world.content = { theme: {} }; // the editors changed their minds
    world.apply.checkTheme();
    world.apply.changeThemeNow();
    assert.equal(world.classes(), 'theme-' + defaultTheme);
  });
});

test('a change that has waited a minute with no page change goes on at the next check', async () => {
  await inPage(async world => {
    await world.apply.startThemes(world.getContent, null);

    world.content = { theme: { useNow: useOtherNow } };
    world.apply.checkTheme(); // seen
    world.clock += 30 * 1000;
    world.apply.checkTheme();
    assert.equal(world.classes(), 'theme-' + defaultTheme, 'only half a minute');

    world.clock += 31 * 1000;
    world.apply.checkTheme();
    assert.equal(world.classes(), ['overlay-' + anOverlay, 'theme-' + otherTheme].sort().join(' '));
  });
});

test('a waiting change that becomes a different change starts waiting again', async () => {
  await inPage(async world => {
    await world.apply.startThemes(world.getContent, null);

    world.content = { theme: { useNow: { theme: otherTheme } } };
    world.apply.checkTheme();
    world.clock += 50 * 1000;
    world.content = { theme: { useNow: useOtherNow } };
    world.apply.checkTheme();
    world.clock += 20 * 1000;
    world.apply.checkTheme();
    assert.equal(world.classes(), 'theme-' + defaultTheme, 'the new change has only waited 20 seconds');
  });
});

test('showThemeNow puts the newest look on at once', async () => {
  await inPage(async world => {
    await world.apply.startThemes(world.getContent, null);
    world.content = { theme: { defaultTheme: otherTheme } };
    world.apply.showThemeNow();
    assert.equal(world.classes(), 'theme-' + otherTheme);
  });
});

test('the address can choose a theme and an overlay, and none', async () => {
  await inPage(async world => {
    world.content = { theme: { useNow: useOtherNow } };
    await world.apply.startThemes(world.getContent, { theme: defaultTheme, overlay: 'none' });
    assert.equal(world.classes(), 'theme-' + defaultTheme);
  });

  await inPage(async world => {
    await world.apply.startThemes(world.getContent, { theme: 'no-such-theme', overlay: anOverlay });
    assert.equal(world.classes(), ['overlay-' + anOverlay, 'theme-' + defaultTheme].sort().join(' '), 'an unknown theme in the address is ignored');
  });
});

test('onLook is told each look that goes on, at boot and at each change, and a failure in it never stops the colours', async () => {
  await inPage(async world => {
    const told = [];
    world.content = { theme: { useNow: useOtherNow } };
    await world.apply.startThemes(world.getContent, null, look => told.push(look.theme + '/' + look.overlay));
    assert.deepEqual(told, [otherTheme + '/' + anOverlay], 'told at boot');

    world.content = { theme: {} };
    world.apply.checkTheme();
    assert.equal(told.length, 1, 'a change that is only waiting is not told yet');
    world.apply.changeThemeNow();
    assert.deepEqual(told, [otherTheme + '/' + anOverlay, defaultTheme + '/'], 'told in the same step as the classes');
    assert.equal(world.classes(), 'theme-' + defaultTheme);
  });

  await inPage(async world => {
    const real = console.error;
    const logged = [];
    console.error = text => logged.push(String(text));
    try {
      world.content = { theme: { useNow: useOtherNow } };
      await world.apply.startThemes(world.getContent, null, () => { throw new Error('the decorations broke'); });
    } finally {
      console.error = real;
    }
    assert.equal(world.classes(), ['overlay-' + anOverlay, 'theme-' + otherTheme].sort().join(' '), 'the colours are on whatever the callback did');
    assert.ok(logged.length === 1 && /follow the theme change/.test(logged[0]));
  });

  await inPage(async world => {
    await world.apply.startThemes(world.getContent, null, 'not a function');
    assert.equal(world.classes(), 'theme-' + defaultTheme, 'a callback that is not a function is ignored');
  });
});

test('a failure in the content never stops the screen: the look stays as it was', async () => {
  await inPage(async world => {
    await world.apply.startThemes(world.getContent, null);
    world.getContent = null;
    world.content = null;
    const real = console.error;
    console.error = () => {};
    try {
      assert.doesNotThrow(() => world.apply.checkTheme());
    } finally {
      console.error = real;
    }
    assert.equal(world.classes(), 'theme-' + defaultTheme);
  });
});

// The wiring

test('the large panel tells theme-apply when its frame is apart, and nothing else moves', () => {
  const areas = fs.readFileSync(path.join(dashboardFolder, 'core/areas.js'), 'utf8');
  // the new metal goes on in the same moment (core/areas.js), so a line or two of comment and that line sit between
  assert.ok(/await frame\.leave\(area, change\);\s*\n(?:[^\n]*\n){0,4}\s*if \(region === themeRegion\) changeThemeNow\(\);/.test(areas), 'areas.js should call changeThemeNow() right after the old page has left');
  assert.ok(areas.includes("const themeRegion = 'grid1';"));

  const apply = fs.readFileSync(path.join(dashboardFolder, 'core/theme-apply.js'), 'utf8');
  ['animate(', 'transition', 'requestAnimationFrame', 'keyframes'].forEach(word => assert.ok(!apply.includes(word), 'theme-apply.js should not animate: ' + word));
});

test('shell.js starts the themes before the first panel and checks them when the content changes', () => {
  const shell = fs.readFileSync(path.join(dashboardFolder, 'shell.js'), 'utf8');
  assert.ok(shell.indexOf('await startThemes(') !== -1 && shell.indexOf('await startThemes(') < shell.indexOf('startWhatStays();\n\n    // Alerts'), 'startThemes should come before startWhatStays');
  assert.ok(/rebuild\(\);\s*\n\s*checkTheme\(\);/.test(shell), 'setBase should call checkTheme() after rebuild()');
  assert.ok(shell.includes('showThemeNow();'), 'the first real content should show its theme at once');
});

test('index.html links the default theme and the theme files hold variables only', () => {
  const index = fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8');
  assert.ok(index.indexOf('themes/hawktimus.css') < index.indexOf('tokens.css'), 'the theme comes before tokens.css');

  const names = fs.readdirSync(path.join(dashboardFolder, 'themes')).filter(name => name.endsWith('.css'));
  assert.ok(names.includes('hawktimus.css') && names.length === themes.length);
  names.forEach(name => {
    const text = fs.readFileSync(path.join(dashboardFolder, 'themes', name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const declarations = text.replace(/[^{}]*\{|\}/g, '\n').split(';').map(item => item.trim()).filter(Boolean);
    assert.ok(declarations.length > 10, name + ' has no variables');
    declarations.forEach(item => assert.ok(item.startsWith('--'), name + ' has something that is not a variable: ' + item));
  });
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
