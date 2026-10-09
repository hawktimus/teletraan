// Tests for the theme code: which theme and overlay apply (dashboard/core/theme.js)
// and how they are put on the page (dashboard/core/theme-apply.js, with a fake
// page). Nothing touches the network or a browser.
//
//   node tools/test-themes.mjs
//
// The colours of the themes are checked by tools/check-themes.mjs.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
['theme.js', 'theme-apply.js', 'teams.js', 'style.js', 'transitions.js', 'tick.js', 'corner-art.js', 'pack-extras.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(workFolder, 'dashboard/core', file));
});

const base = pathToFileURL(path.join(workFolder, 'dashboard')).href + '/';
const config = await import(base + 'config.js');
const { resolveTheme, tidyTheme, ruleCovers, dateIn, isTimeZone, ruleExtras, overlayShown, packExtras } = await import(base + 'core/theme.js');
const packExtrasModule = await import(base + 'core/pack-extras.js');
const cornerArtModule = await import(base + 'core/corner-art.js');
const { teamProperties, teamInitials } = await import(base + 'core/teams.js');
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

test('Neon Prime is the third theme, with the sidebar layout. The other two have no layout, so they are standard', () => {
  assert.deepEqual(themes.slice(0, 3).map(theme => theme.id), ['hawktimus', 'alternate', 'neon-prime']);
  assert.equal(themes[2].name, 'Neon Prime');
  assert.equal(themes[2].layout, 'sidebar');
  assert.ok(/sidebar/i.test(themes[2].description) && /no small frame/i.test(themes[2].description), 'the description says what editors get');
  assert.ok(themes.slice(0, 2).every(theme => theme.layout === undefined), 'a theme with no layout field has the standard layout');
  assert.ok(themes.every(theme => theme.layout === undefined || ['standard', 'sidebar'].indexOf(theme.layout) !== -1), 'a layout is one of the two');
  assert.ok(!/placeholder/i.test(themes[2].name), 'the display name is final');
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

test('the switch for seasonal pieces over the panels starts on, and only a real false turns it off', () => {
  assert.equal(config.defaultThemeSettings.seasonOverPanels, true);
  assert.equal(tidyTheme({}).seasonOverPanels, true, 'missing means on');
  assert.equal(tidyTheme({ seasonOverPanels: true }).seasonOverPanels, true);
  assert.equal(tidyTheme({ seasonOverPanels: false }).seasonOverPanels, false);

  // anything that is not a true or false is the default, which is on
  [null, 'false', 'off', 0, 1, {}, []].forEach(odd => {
    assert.equal(tidyTheme({ seasonOverPanels: odd }).seasonOverPanels, true, 'an odd value ' + JSON.stringify(odd));
  });

  const off = tidyTheme({ seasonOverPanels: false });
  assert.equal(tidyTheme(off).seasonOverPanels, false, 'tidying twice changes nothing');
  assert.equal(resolveTheme({ seasonOverPanels: false }, new Date('2026-12-15T17:00:00Z')).overlay, '', 'the switch plays no part in choosing the overlay');
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

test('a look that is held does not go on the page, stays waiting, and goes on when it is let through', async () => {
  await inPage(async world => {
    await world.apply.startThemes(world.getContent, null);

    let holding = true;
    const asked = [];
    world.apply.holdLooksFor(look => {
      asked.push(look.theme);
      return holding;
    });

    world.content = { theme: { useNow: useOtherNow } };
    world.apply.checkTheme();
    world.apply.changeThemeNow();
    assert.equal(world.classes(), 'theme-' + defaultTheme, 'held, so the page keeps its look');
    assert.deepEqual(asked, [otherTheme], 'it is asked about the look that wants to go on');

    world.clock += 61 * 1000;
    world.apply.checkTheme();
    assert.deepEqual(asked, [otherTheme, otherTheme], 'it is asked again at the next check, so a held look is not lost');
    assert.equal(world.classes(), 'theme-' + defaultTheme);

    holding = false;
    world.apply.changeThemeNow();
    assert.equal(world.classes(), ['overlay-' + anOverlay, 'theme-' + otherTheme].sort().join(' '), 'let through at the next page change');
  });
});

test('a hold that fails is logged and the colours go on anyway', async () => {
  await inPage(async world => {
    await world.apply.startThemes(world.getContent, null);
    world.apply.holdLooksFor(() => {
      throw new Error('the layout check failed');
    });

    const logged = [];
    const real = console.error;
    console.error = (...parts) => logged.push(parts.join(' '));
    try {
      world.content = { theme: { useNow: useOtherNow } };
      world.apply.checkTheme();
      world.apply.changeThemeNow();
    } finally {
      console.error = real;
    }
    assert.equal(world.classes(), ['overlay-' + anOverlay, 'theme-' + otherTheme].sort().join(' '));
    assert.equal(logged.length, 1);
    assert.ok(/layout of the theme/.test(logged[0]));
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

// The look of Neon Prime that is not a colour list (dashboard/themes/decor/neon-prime-decor.css)

const decorPath = path.join(dashboardFolder, 'themes/decor/neon-prime-decor.css');
const decorText = fs.existsSync(decorPath) ? fs.readFileSync(decorPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') : '';

// The arguments of every gradient in the text, each as a list of its top level parts
function gradientsIn(text) {
  const found = [];
  const start = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/g;
  let match = start.exec(text);
  while (match) {
    let depth = 1;
    let index = start.lastIndex;
    let part = '';
    const parts = [];
    while (depth > 0 && index < text.length) {
      const letter = text[index];
      if (letter === '(') depth += 1;
      if (letter === ')') depth -= 1;
      if (depth === 0) break;
      if (letter === ',' && depth === 1) { parts.push(part.trim()); part = ''; } else part += letter;
      index += 1;
    }
    parts.push(part.trim());
    found.push({ kind: match[0], parts: parts });
    match = start.exec(text);
  }
  return found;
}

test('the Neon Prime decor file is linked once, after the sidebar layout, and only touches Neon Prime', () => {
  assert.ok(decorText.length > 0, 'dashboard/themes/decor/neon-prime-decor.css is missing');
  const index = fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8');
  assert.equal(index.split('href="themes/decor/neon-prime-decor.css"').length - 1, 1, 'index.html links it once');
  assert.ok(index.indexOf('themes/decor/neon-prime-decor.css') > index.indexOf('layouts/sidebar.css'));

  let blocks = 0;
  decorText.replace(/([^{}]+)\{[^{}]*\}/g, (all, list) => {
    blocks += 1;
    list.split(',').map(selector => selector.trim()).forEach(selector => {
      assert.ok(selector.startsWith('html.theme-neon-prime'), 'a rule here is for every theme: ' + selector);
    });
    return all;
  });
  assert.ok(blocks > 10, 'the decor file has its rules');
  assert.ok(!fs.existsSync(path.join(dashboardFolder, 'themes/neon-prime-decor.css')), 'a file in themes/ must be a theme, so the decor file is in themes/decor/');
});

test('the Neon Prime decor file has no glow, blur, shadow, filter, text or movement, and its gradients have hard stops', () => {
  assert.ok(!/(box-shadow|text-shadow|drop-shadow|filter|blur\(|backdrop|mix-blend|blend-mode|@keyframes|transition|will-change|perspective|translateZ|rotateX|rotateY|video)/.test(decorText));
  assert.ok(!/(radial|conic)-gradient/.test(decorText), 'only straight stripes and plain rectangles');
  decorText.replace(/content:\s*([^;]*);/g, (all, value) => {
    assert.equal(value.trim(), '""', 'no text in the decor: ' + all);
    return all;
  });
  assert.ok(!/font(-size|-family)?\s*:/.test(decorText), 'the decor sets no text size');

  // the only animation property is the choice of an animation frame.css has
  decorText.replace(/animation(-name)?\s*:\s*([^;]*);/g, (all, name, value) => {
    assert.ok(['lift', 'drop', 'none'].indexOf(value.trim()) !== -1, 'only lift, drop or none: ' + all);
    return all;
  });

  const gradients = gradientsIn(decorText);
  assert.ok(gradients.length > 20, 'the gradients were found');
  gradients.forEach(gradient => {
    const stops = gradient.parts.filter((part, place) => !(place === 0 && /^(to |-?[\d.]+deg)/.test(part)));
    const read = stop => {
      const found = /^(.*?)(?:\s+(-?[\d.]+(?:px|%)?))?$/.exec(stop);
      return { color: found[1].trim(), at: found[2] === undefined ? null : (found[2] === '0' ? '0px' : found[2]) };
    };
    for (let place = 1; place < stops.length; place += 1) {
      const before = read(stops[place - 1]);
      const now = read(stops[place]);
      if (before.color === now.color) continue;
      assert.ok(now.at !== null && now.at === before.at, 'a change of colour must be a hard stop, at the same place: ' + gradient.parts.join(', '));
    }
  });
});

test('the gunmetal sets every variable that the silver metal sets, and the screen picks it whatever Frame metal says', () => {
  const tokens = fs.readFileSync(path.join(dashboardFolder, 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const silver = /\[data-metal="silver"\]\s*\{([^}]*)\}/.exec(tokens)[1];
  const names = silver.split(';').map(item => item.split(':')[0].trim()).filter(Boolean);
  assert.ok(names.length >= 14, 'the silver metal has its tones');

  const gunmetal = /html\.theme-neon-prime,\s*html\.theme-neon-prime \[data-metal\]\s*\{([^}]*)\}/.exec(decorText);
  assert.ok(gunmetal, 'the gunmetal rule reaches the html element and every element that has data-metal');
  names.forEach(name => assert.ok(gunmetal[1].indexOf(name + ':') !== -1, 'the gunmetal does not set ' + name));
});

// The check for greens (tools/check-themes.mjs) really fails

// Every .css file of the dashboard except the fonts, into the same place in the copy
function copyStylesheets(from, to) {
  fs.readdirSync(from, { withFileTypes: true }).forEach(entry => {
    if (entry.isDirectory()) {
      if (entry.name !== 'fonts') copyStylesheets(path.join(from, entry.name), path.join(to, entry.name));
    } else if (entry.name.endsWith('.css')) {
      fs.mkdirSync(to, { recursive: true });
      fs.copyFileSync(path.join(from, entry.name), path.join(to, entry.name));
    }
  });
}

// Runs tools/check-themes.mjs on a copy of the files it reads. "change" gets the
// text of one file of the copy and returns what it should be.
function greenCheckAfter(name, file, change) {
  const folder = path.join(workFolder, 'green-' + name);
  fs.mkdirSync(path.join(folder, 'tools'), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, '../tools/check-themes.mjs'), path.join(folder, 'tools/check-themes.mjs'));
  fs.cpSync(path.join(dashboardFolder, 'themes'), path.join(folder, 'dashboard/themes'), { recursive: true });
  ['config.js', 'index.html', 'tokens.css'].forEach(item => fs.copyFileSync(path.join(dashboardFolder, item), path.join(folder, 'dashboard', item)));
  copyStylesheets(dashboardFolder, path.join(folder, 'dashboard')); // the check for keyframes reads every stylesheet

  if (file) {
    const target = path.join(folder, 'dashboard', file);
    const before = fs.readFileSync(target, 'utf8');
    const after = change(before);
    assert.notEqual(after, before, 'the test change to ' + file + ' did nothing, so its anchor text is gone');
    fs.writeFileSync(target, after);
  }
  const run = spawnSync(process.execPath, [path.join(folder, 'tools/check-themes.mjs')], { encoding: 'utf8' });
  return { failed: run.status !== 0, text: run.stdout + run.stderr };
}

const themeFile = 'themes/neon-prime.css';
const decorFile = 'themes/decor/neon-prime-decor.css';
const addRule = lines => before => before + '\nhtml.theme-neon-prime .test-only {\n' + lines.map(line => '  ' + line + '\n').join('') + '}\n';

test('the check for greens passes on the real Neon Prime files, and the seasonal packs keep their greens', () => {
  const run = greenCheckAfter('real', null);
  assert.ok(!run.failed, run.text);
  assert.ok(/PASS  the Neon Prime files have no green/.test(run.text));

  const christmas = fs.readFileSync(path.join(dashboardFolder, 'themes/overlays/christmas.css'), 'utf8');
  assert.ok(/--yellow:\s*#[0-9a-f]{6}/i.test(christmas), 'the Christmas pack sets the accent, and the check does not look at it');
});

test('a green added to the Neon Prime colours file fails, and the message names the file, the colour and its hue', () => {
  const run = greenCheckAfter('theme', themeFile, before => before.replace(/--status-done:[^;]*;/, '--status-done: #4dffa6;'));
  assert.ok(run.failed, 'the check should fail');
  assert.match(run.text, /FAIL  the Neon Prime files have no green/);
  assert.match(run.text, /themes\/neon-prime\.css line \d+: #4dffa6 is a green \(hue 150 degrees, teal green\)/);
});

test('a green added to the Neon Prime decor file fails, however it is written', () => {
  const run = greenCheckAfter('decor', decorFile, addRule([
    'color: #c8ff2a;',
    'background: rgb(40, 220, 60);',
    'border-color: rgba(200, 255, 42, .2);',
    'outline-color: hsl(120, 80%, 50%);',
    'fill: #0f8;',
    'stroke: lime;',
  ]));
  assert.ok(run.failed, 'the check should fail');
  [
    'themes/decor/neon-prime-decor.css line \\d+: #c8ff2a is a green \\(hue 75 degrees, yellow green\\)',
    'rgb\\(40, 220, 60\\) is a green \\(hue 127 degrees, green\\)',
    'rgba\\(200, 255, 42, \\.2\\) is a green',
    'hsl\\(120, 80%, 50%\\) is a green \\(hue 120 degrees',
    '#0f8 is a green \\(hue 152 degrees, teal green\\)',
    'the colour word "lime" is a green',
  ].forEach(words => assert.match(run.text, new RegExp(words)));
});

test('the check for greens takes in hue 65 to 175 and nothing outside it, and lets greys go', () => {
  const edges = greenCheckAfter('edges', decorFile, addRule([
    'color: hsl(65, 100%, 50%);',
    'background: hsl(175, 100%, 50%);',
  ]));
  assert.ok(edges.failed);
  assert.ok(/hsl\(65, 100%, 50%\) is a green/.test(edges.text) && /hsl\(175, 100%, 50%\) is a green/.test(edges.text), 'hue 65 and hue 175 are greens');

  const fine = greenCheckAfter('fine', decorFile, addRule([
    'color: hsl(64, 100%, 50%);', // a yellow
    'background: hsl(176, 100%, 50%);', // a cyan
    'border-color: #7a8a7a;', // a grey with a trace of green, too pale to be a hue
    'outline-color: #0a0b0a;', // nearly black
    'fill: rgba(255, 255, 255, .5);',
    'stroke: #ff2bd6;',
  ]));
  assert.ok(!fine.failed, fine.text);
});

test('a green in a comment, or in a selector, is not a colour written', () => {
  const run = greenCheckAfter('comment', decorFile, before => '/* once #4dffa6, lime and rgb(40, 220, 60) */\n' + before + '\nhtml.theme-neon-prime #abc-green .lime { color: #ff2bd6; }\n');
  assert.ok(!run.failed, run.text);
});

// The Neon Prime kit (dashboard/neon-kit.css): the check for its keyframes and its rules fails on a copy
// of the files with one mistake in them, and says what it is

const kitFile = 'neon-kit.css';
const kitCheckName = /FAIL  keyframes are only in the shared motion files/;

test('the kit check passes on the real files, and the kit file is linked once, after the decor file', () => {
  const run = greenCheckAfter('kit-real', null);
  assert.ok(!run.failed, run.text);
  assert.ok(/PASS  keyframes are only in the shared motion files/.test(run.text));

  const index = fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8');
  assert.equal(index.split('href="neon-kit.css"').length - 1, 1, 'index.html links it once');
  assert.ok(index.indexOf('href="neon-kit.css"') > index.indexOf('themes/decor/neon-prime-decor.css'));
});

const kitMistakes = [
  ['keyframes that animate the width', kitFile, before => before.replace('@keyframes kit-breathe {\n  from { transform: scale(.99); }', '@keyframes kit-breathe {\n  from { width: 5px; transform: scale(.99); }'), /the keyframes "kit-breathe" in neon-kit.css animate width\. Only transform, opacity, stroke-dashoffset may be animated/],
  ['keyframes that animate the top', kitFile, before => before.replace('  from { transform: scale(.99); }', '  from { transform: scale(.99); top: 0; }'), /kit-breathe" in neon-kit.css animate top/],
  ['a filter in the kit', kitFile, before => before + '\n.kit { filter: blur(2px); }\n', /neon-kit.css uses a filter, blur, glow or shadow/],
  ['a shadow in the kit', kitFile, before => before + '\n.kit-strip { box-shadow: 0 0 8px #2de6ff; }\n', /uses a filter, blur, glow or shadow/],
  ['a blend mode in the kit', kitFile, before => before + '\n.kit-strip { mix-blend-mode: screen; }\n', /neon-kit.css uses a blend mode/],
  ['a transition in the kit', kitFile, before => before + '\n.kit-strip { transition: opacity 1s; }\n', /neon-kit.css uses a transition/],
  ['will-change in the kit', kitFile, before => before + '\n.kit-strip { will-change: transform; }\n', /neon-kit.css uses will-change/],
  ['an animation that plays in calm motion', kitFile, before => before.replace('html[data-kit="on"][data-motion="full"] .kit-strip::after   {', 'html[data-kit="on"] .kit-strip::after   {'), /plays an animation with the selector "html\[data-kit="on"\] \.kit-strip::after"\. Start it with html\[data-kit="on"\]\[data-motion="full"\]/],
  ['an animation with no gate at all', kitFile, before => before + '\n.kit-strip { animation: kit-run-right 5s linear infinite; }\n', /plays an animation with the selector "\.kit-strip"/],
  ['keyframes with a name that is not the kit\'s', kitFile, before => before.replace('@keyframes kit-breathe {', '@keyframes breathe {'), /the keyframes "breathe" in neon-kit.css should be named kit-<name>/],
  ['an animation with no keyframes', kitFile, before => before.replace('@keyframes kit-sweep {', '@keyframes kit-sweeep {'), /plays kit-sweep, which has no @keyframes kit-sweep/],
  ['keyframes that are never played', kitFile, before => before + '\n@keyframes kit-unused { to { opacity: 0; } }\n', /the keyframes "kit-unused" in neon-kit.css are never played/],
  ['a keyframe in a panel stylesheet', 'panels/tasks/tasks.css', before => before + '\n@keyframes wiggle { to { opacity: 0; } }\n', /dashboard\/panels\/tasks\/tasks\.css has @keyframes\. Every keyframe belongs in frame\.css, seasons\/motion\.css, neon-kit\.css/],
  ['a keyframe in the decor file', 'themes/decor/neon-prime-decor.css', before => before + '\n@keyframes wiggle { to { opacity: 0; } }\n', /neon-prime-decor\.css has @keyframes/],
  ['a keyframe in the sidebar layout', 'layouts/sidebar.css', before => before + '\n@keyframes wiggle { to { opacity: 0; } }\n', /layouts\/sidebar\.css has @keyframes/],
  ['a keyframe in the season styles', 'seasons/season.css', before => before + '\n@keyframes wiggle { to { opacity: 0; } }\n', /seasons\/season\.css has @keyframes/],
  ['the kit stylesheet not linked', 'index.html', before => before.replace('  <link rel="stylesheet" href="neon-kit.css">\n', ''), /index\.html should link neon-kit\.css/],
  ['a green in the kit', kitFile, before => before + '\nhtml.theme-neon-prime .kit-strip { background: #3dff7a; }\n', /neon-kit\.css line \d+: #3dff7a is a green/],
];

kitMistakes.forEach((entry, place) => {
  test('the kit check fails for ' + entry[0] + ', and says what is wrong', () => {
    const run = greenCheckAfter('kit-' + place, entry[1], entry[2]);
    assert.ok(run.failed, 'the check should have failed:\n' + run.text);
    assert.match(run.text, entry[3]);
  });
});

test('a comment may say filter, shadow or keyframes, and the kit check does not mind', () => {
  const run = greenCheckAfter('kit-comment', kitFile, before => '/* no filter, blur, glow, shadow or blend mode, and no @keyframes outside this file */\n' + before);
  assert.ok(!run.failed, run.text);
});

// The team on the page (dashboard/core/teams.js, with a fake page): the seven colors and the mirror
// class, and when a different team goes on. The mode logic and the filter are in tools/test-content.mjs.

const seededTeams = fs.readFileSync(path.join(dashboardFolder, '../docs/seed/teams.ndjson'), 'utf8')
  .split('\n')
  .filter(line => line.trim() !== '')
  .map(line => JSON.parse(line));
const seededPrime = seededTeams[0];
const seededNova = seededTeams[1];
const minute = 60 * 1000;
const noon = Date.UTC(2026, 9, 2, 15, 0, 0); // a moment on a 5 minute boundary

// Just enough of the html element for teams.js: custom properties and a class list
function makeRoot() {
  const properties = {};
  return {
    properties: properties,
    style: { setProperty: (name, value) => { properties[name] = value; } },
    classList: makeClassList(),
  };
}

// The seven properties as a team has them, in the order of the list
function propertiesOf(team) {
  return {
    '--team-primary': team.colors.primary,
    '--team-plate': team.colors.plate,
    '--team-accent': team.colors.accent,
    '--team-neon': team.colors.neon,
    '--team-pink': team.colors.pink,
    '--team-background': team.colors.background,
    '--team-text': team.colors.text,
  };
}

// The properties the page has with a team on it: the seven colors, and the initials for the plate ids, in
// quotes as content needs them
function onThePage(team) {
  const initials = { prime: '"HP"', nova: '"HN"' };
  return Object.assign(propertiesOf(team), { '--team-initials': initials[team.code] });
}

// The Teams settings and the team list, as the content has them. teams.js reads nothing else.
function teamContent(mode, minutes, teams) {
  return { teams: teams || seededTeams, settings: { teamMode: mode, alternateMinutes: minutes || 5 } };
}

// A fresh teams.js with its own fake page. Errors that it logs are collected.
async function onTeamPage(run) {
  const world = { root: makeRoot(), logged: [], told: 0 };
  const realError = console.error;

  globalThis.document = { documentElement: world.root };
  console.error = (...parts) => world.logged.push(parts.join(' '));
  try {
    instance += 1;
    world.teams = await import(base + 'core/teams.js?test=' + instance);
    world.teams.onTeamChange(() => { world.told += 1; });
    world.classes = () => world.root.classList.text();
    await run(world);
  } finally {
    console.error = realError;
    delete globalThis.document;
  }
}

test('the screen starts on the team the settings ask for, at once: the seven colors are on the html element, and only Nova has the mirror class', async () => {
  const names = ['--team-primary', '--team-plate', '--team-accent', '--team-neon', '--team-pink', '--team-background', '--team-text'];

  await onTeamPage(async world => {
    assert.deepEqual(Object.keys(world.teams.colorProperties).map(name => world.teams.colorProperties[name]), names);
    world.teams.useTeams(teamContent('prime'), new Date(noon));

    assert.deepEqual(world.root.properties, {
      '--team-primary': '#6C18B6', '--team-plate': '#3B2A7A', '--team-accent': '#FACA2A', '--team-neon': '#35F0FF',
      '--team-pink': '#FF2E8C', '--team-background': '#09060F', '--team-text': '#FFFFFF', '--team-initials': '"HP"',
    });
    assert.equal(world.classes(), '');
    assert.equal(world.teams.mirrorClass, 'mirrored');
  });

  await onTeamPage(async world => {
    world.teams.useTeams(teamContent('nova'), new Date(noon));

    assert.deepEqual(world.root.properties, {
      '--team-primary': '#1F7AE0', '--team-plate': '#1E3A6E', '--team-accent': '#9BF0FF', '--team-neon': '#FF2E8C',
      '--team-pink': '#35F0FF', '--team-background': '#060D1A', '--team-text': '#FFFFFF', '--team-initials': '"HN"',
    });
    assert.equal(world.classes(), 'mirrored');
  });
});

test('the properties of a team are its seven colors, whatever team it is, and the built-in team has the starting Prime ones', () => {
  [seededPrime, seededNova].forEach(team => assert.deepEqual(teamProperties(team), propertiesOf(team)));
  assert.deepEqual(teamProperties(config.primeTeam), propertiesOf(seededPrime));
  assert.equal(config.primeTeam.mirror, seededPrime.mirror);
});

test('the initials of a team are the first letter of each word of its name, in capitals, for the stamped plate ids: HP for Prime and HN for Nova', () => {
  assert.equal(teamInitials(seededPrime), 'HP');
  assert.equal(teamInitials(seededNova), 'HN');
  assert.equal(teamInitials(config.primeTeam), 'HP', 'the built-in team, named in capitals');
  assert.equal(teamInitials({ name: 'hawktimus nova' }), 'HN');
  assert.equal(teamInitials({ name: '  Hawktimus   Prime ' }), 'HP', 'spaces round and between the words');
  assert.equal(teamInitials({ name: 'Robo-Hawks Gold' }), 'RHG', 'a hyphen starts a new word');
  assert.equal(teamInitials({ name: 'Hawktimus Prime Second Team' }), 'HPS', 'at most three letters');
  assert.equal(teamInitials({ name: 'Hawktimus' }), 'HA', 'one word gives its first two letters');
  assert.equal(teamInitials({ name: 'X' }), 'X');
  assert.equal(teamInitials({ name: 'Équipe Étoile' }), 'ÉÉ', 'letters that are not in English');
  assert.equal(teamInitials({ name: 'Team 3229' }), 'TE', 'a number is not a word');

  [null, undefined, {}, { name: '' }, { name: '3229' }, { name: 7 }, 'Hawktimus Prime'].forEach(odd => assert.equal(teamInitials(odd), '', JSON.stringify(odd)));
  assert.ok(!/["\\]/.test(teamInitials({ name: 'Prime "Hawk" \\ Team' })), 'only letters, so the quoted value is always safe');
});

test('with no team documents the page gets the starting Prime colors and no mirror', async () => {
  await onTeamPage(async world => {
    world.teams.useTeams({ settings: { teamMode: 'nova' } }, new Date(noon));

    assert.deepEqual(world.root.properties, onThePage(seededPrime));
    assert.equal(world.classes(), '');
    assert.equal(world.teams.currentTeam(), config.primeTeam);
  });
});

test('Alternate keeps the team for its minutes, then asks for the other one, and the page changes only when the large frame is apart, all at once', async () => {
  await onTeamPage(async world => {
    const { useTeams, changeTeamNow, currentTeam, wantedTeam, teamPending, showsForTeam } = world.teams;
    const content = teamContent('alternate', 5);

    useTeams(content, new Date(noon));
    const first = currentTeam();
    const second = seededTeams.filter(team => team.code !== first.code)[0];
    const firstLook = Object.assign({}, world.root.properties);
    const firstClasses = world.classes();
    const toldAtStart = world.told;
    assert.deepEqual(firstLook, onThePage(first), 'the first team is on at once');

    // the same slot: nothing is asked for, nothing waits, nothing is told
    [1, 2, 4].forEach(minutes => {
      useTeams(content, new Date(noon + minutes * minute + 59000));
      assert.equal(wantedTeam().code, first.code);
      assert.equal(teamPending(), false);
    });
    assert.equal(world.told, toldAtStart);

    // the next slot: the other team is wanted, so the items follow, and the page and the banner do not
    useTeams(content, new Date(noon + 5 * minute));
    assert.equal(wantedTeam().code, second.code);
    assert.equal(teamPending(), true);
    assert.equal(currentTeam().code, first.code, 'the page still shows the first team');
    assert.deepEqual(world.root.properties, firstLook, 'no color has changed');
    assert.equal(world.classes(), firstClasses, 'the mirror has not changed');
    assert.equal(showsForTeam({ team: second.code }), true, 'the pages built from now on are the second team\'s');
    assert.equal(showsForTeam({ team: first.code }), false);
    assert.equal(world.told, toldAtStart + 1, 'the banner and the events are told that a team is wanted');

    // asking again, a second later and later, changes nothing while the frame is together
    useTeams(content, new Date(noon + 5 * minute + 1000));
    useTeams(content, new Date(noon + 5 * minute + 30000));
    assert.deepEqual(world.root.properties, firstLook);
    assert.equal(world.told, toldAtStart + 1);

    // the frame is apart: everything changes in this one call, and nothing is left behind
    changeTeamNow();
    assert.equal(currentTeam().code, second.code);
    assert.equal(teamPending(), false);
    assert.deepEqual(world.root.properties, onThePage(second));
    assert.equal(world.classes(), second.mirror ? 'mirrored' : '');
    assert.equal(world.told, toldAtStart + 2);

    // and when nothing is waiting a page change changes nothing
    changeTeamNow();
    assert.equal(world.told, toldAtStart + 2);
    assert.deepEqual(world.root.properties, onThePage(second));

    // back to the first, a slot later
    useTeams(content, new Date(noon + 10 * minute));
    changeTeamNow();
    assert.equal(currentTeam().code, first.code);
    assert.deepEqual(world.root.properties, firstLook);
    assert.equal(world.classes(), firstClasses);
    assert.equal(world.logged.length, 0);
  });
});

test('every alternateMinutes the team that is wanted changes, in whole turns counted from the clock', async () => {
  await onTeamPage(async world => {
    const { useTeams, wantedTeam } = world.teams;
    const content = teamContent('alternate', 3);

    // a look every 20 seconds for 9 minutes: three turns of 9 looks each
    const wanted = [];
    for (let seconds = 0; seconds < 9 * 60; seconds += 20) {
      useTeams(content, new Date(noon + seconds * 1000));
      wanted.push(wantedTeam().code);
    }

    const first = wanted[0];
    const second = seededTeams.filter(team => team.code !== first)[0].code;
    assert.deepEqual(wanted, [].concat(Array(9).fill(first), Array(9).fill(second), Array(9).fill(first)));
  });
});

test('a change that no page change comes for goes on a minute after it was asked for, and not before', async () => {
  await onTeamPage(async world => {
    const { useTeams, currentTeam } = world.teams;
    const content = teamContent('alternate', 5);

    useTeams(content, new Date(noon));
    const first = currentTeam().code;
    useTeams(content, new Date(noon + 5 * minute));
    useTeams(content, new Date(noon + 5 * minute + 59000));
    assert.equal(currentTeam().code, first, '59 seconds is not yet a minute');
    useTeams(content, new Date(noon + 5 * minute + 60000));
    assert.notEqual(currentTeam().code, first, 'a minute with no page change');
    assert.deepEqual(world.root.properties, onThePage(currentTeam()));
    assert.equal(world.told, 3, 'told when the first team went on, when the other was wanted, and when the page had it');
  });
});

test('a team that is asked for and then not is never put on, and an edit to the team on the screen goes on at once', async () => {
  await onTeamPage(async world => {
    const { useTeams, currentTeam, teamPending, changeTeamNow } = world.teams;

    useTeams(teamContent('prime'), new Date(noon));
    useTeams(teamContent('nova'), new Date(noon + 1000));
    assert.equal(teamPending(), true);
    useTeams(teamContent('prime'), new Date(noon + 2000)); // the editors changed their minds
    assert.equal(teamPending(), false);
    changeTeamNow();
    assert.deepEqual(world.root.properties, onThePage(seededPrime));
    assert.equal(world.classes(), '');

    // a new color for the team that is showing goes on now, and a new color for the other team waits
    const edited = JSON.parse(JSON.stringify(seededTeams));
    edited[0].colors.accent = '#112233';
    useTeams(teamContent('prime', 5, edited), new Date(noon + 3000));
    assert.equal(world.root.properties['--team-accent'], '#112233');
    assert.equal(currentTeam().colors.accent, '#112233');

    edited[1].colors.accent = '#445566';
    useTeams(teamContent('prime', 5, edited), new Date(noon + 4000));
    assert.equal(world.root.properties['--team-accent'], '#112233');
    useTeams(teamContent('nova', 5, edited), new Date(noon + 5000));
    changeTeamNow();
    assert.equal(world.root.properties['--team-accent'], '#445566');
  });
});

test('a problem putting the team on the page never stops the page change that asked for it', async () => {
  await onTeamPage(async world => {
    world.teams.useTeams(teamContent('prime'), new Date(noon));
    world.teams.useTeams(teamContent('nova'), new Date(noon + 1000));

    world.root.style.setProperty = () => { throw new Error('no page'); };
    world.teams.changeTeamNow();
    assert.equal(world.logged.length, 1);
    assert.ok(/Could not change the team/.test(world.logged[0]));
    assert.equal(world.teams.teamPending(), true, 'it will try again at the next page change');
  });

  // and one that follows the team, such as the banner, cannot stop the others being told
  await onTeamPage(async world => {
    let reached = 0;
    world.teams.onTeamChange(() => { throw new Error('banner'); });
    world.teams.onTeamChange(() => { reached += 1; });
    world.teams.useTeams(teamContent('prime'), new Date(noon));
    assert.equal(reached, 1);
    assert.equal(world.logged.length, 1);
  });
});

test('the page calls changeTeamNow in the same two moments as it calls changeThemeNow, and the screen runs the team once a second', () => {
  const areas = fs.readFileSync(path.join(dashboardFolder, 'core/areas.js'), 'utf8');
  assert.ok(areas.includes("import { changeTeamNow } from './teams.js';"));
  assert.ok(/await frame\.leave\(area, change\);(?:\n[^\n]*){0,5}\n\s*if \(region === themeRegion\) changeThemeNow\(\);\n\s*if \(region === themeRegion\) changeTeamNow\(\);/.test(areas), 'after the old page has left, beside the theme');
  assert.ok(/host\.appendChild\(next\.element\);\n\s*if \(region === themeRegion\) changeThemeNow\(\);\n\s*if \(region === themeRegion\) changeTeamNow\(\);/.test(areas), 'in the moment a hidden transition has the screen apart, beside the theme');
  assert.equal(areas.split('changeTeamNow()').length - 1, 2);

  const shell = fs.readFileSync(path.join(dashboardFolder, 'shell.js'), 'utf8');
  assert.ok(shell.includes("import { askForTeam, changeTeamNow, onTeamChange, useTeams } from './core/teams.js';"));
  assert.ok(/showThemeNow\(\);[^\n]*\n\s*changeTeamNow\(\);/.test(shell), 'the first real content has its team on at once, as it has its theme');
  assert.ok(shell.indexOf('chooseTeam(); //') !== -1 && shell.indexOf('chooseTeam(); //') < shell.indexOf('content.events = mergedEvents();'), 'the team is chosen before the events are merged');
  assert.ok(/onTeamChange\(\(\) => \{\s*if \(content && !choosingTeam\) rebuild\(\);\s*\}\);/.test(shell), 'a change of team redraws the banner, and does not start a second redraw from inside one');
  assert.ok(shell.includes("startOptional('./core/team-run.js', module => module.startTeams(getContent));"));

  const run = fs.readFileSync(path.join(dashboardFolder, 'core/team-run.js'), 'utf8');
  assert.ok(run.includes('frame.onSecond(look);'));
  assert.ok(run.includes("moveOn(['grid1', 'grid2', 'ticker']);"), 'when the wanted team changes the three areas move on, so their next pages are built for it');

  const teams = fs.readFileSync(path.join(dashboardFolder, 'core/teams.js'), 'utf8');
  ['animate(', 'transition', 'requestAnimationFrame', 'keyframes', 'setTimeout', 'setInterval'].forEach(word => assert.ok(!teams.includes(word), 'teams.js should not animate or keep time: ' + word));
});

// The colors (dashboard/teams.css)

const teamsCss = fs.readFileSync(path.join(dashboardFolder, 'teams.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function blocksOf(text) {
  const blocks = [];
  text.replace(/([^{}]+)\{([^{}]*)\}/g, (all, list, body) => {
    const declarations = {};
    body.split(';').map(item => item.trim()).filter(Boolean).forEach(item => {
      declarations[item.slice(0, item.indexOf(':')).trim()] = item.slice(item.indexOf(':') + 1).trim();
    });
    blocks.push({ selectors: list.split(',').map(selector => selector.trim()), declarations: declarations });
    return all;
  });
  return blocks;
}

test('teams.css starts the seven team colors at the Prime ones, and has no other rule than the four the default theme follows', () => {
  const blocks = blocksOf(teamsCss);
  assert.equal(blocks.length, 2);

  assert.deepEqual(blocks[0].selectors, [':root']);
  const colors = config.primeTeam.colors;
  assert.deepEqual(Object.keys(blocks[0].declarations), ['--team-primary', '--team-plate', '--team-accent', '--team-neon', '--team-pink', '--team-background', '--team-text']);
  Object.keys(propertiesOf(config.primeTeam)).forEach(name => {
    assert.equal(blocks[0].declarations[name].toLowerCase(), propertiesOf(config.primeTeam)[name].toLowerCase(), name);
  });
  assert.equal(colors.primary.toLowerCase(), '#6c18b6');

  assert.deepEqual(blocks[1].selectors, [':root', 'html.theme-hawktimus'], 'the default theme only: another theme keeps its own colors');
  assert.deepEqual(blocks[1].declarations, {
    '--purple': 'var(--team-primary)',
    '--yellow': 'var(--team-accent)',
    '--ground': 'var(--team-background)',
    '--white': 'var(--team-text)',
  });
});

test('the four colors the default theme takes from the team are the same colors the theme has today, so Prime looks as it did', () => {
  const theme = fs.readFileSync(path.join(dashboardFolder, 'themes/hawktimus.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const set = {};
  blocksOf(theme).forEach(block => Object.assign(set, block.declarations));
  const colors = config.primeTeam.colors;

  assert.equal(set['--purple'].toLowerCase(), colors.primary.toLowerCase());
  assert.equal(set['--yellow'].toLowerCase(), colors.accent.toLowerCase());
  assert.equal(set['--ground'].toLowerCase(), colors.background.toLowerCase());
  assert.equal(set['--white'].toLowerCase(), colors.text.toLowerCase());

  // and these are the ones that differ: the team plate is not the theme plate, so nothing takes it yet
  assert.notEqual(set['--plate'].toLowerCase(), colors.plate.toLowerCase());
  assert.equal(teamsCss.includes('--plate'), false);
});

test('the Alternate and Neon Prime themes and every overlay set their colors without the team, and the team colors are linked after the default theme and before the page styles', () => {
  ['themes/alternate.css', 'themes/neon-prime.css', 'themes/decor/neon-prime-decor.css', 'layouts/sidebar.css', 'neon-kit.css'].concat(fs.readdirSync(path.join(dashboardFolder, 'themes/overlays')).filter(name => name.endsWith('.css')).map(name => 'themes/overlays/' + name)).forEach(file => {
    assert.equal(/--team-/.test(fs.readFileSync(path.join(dashboardFolder, file), 'utf8')), false, file);
  });

  const index = fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8');
  assert.equal(index.split('href="teams.css"').length - 1, 1);
  assert.ok(index.indexOf('themes/hawktimus.css') < index.indexOf('href="teams.css"'), 'after the default theme, so its rule wins');
  assert.ok(index.indexOf('href="teams.css"') < index.indexOf('href="base.css"'));
  assert.ok(index.indexOf('href="tokens.css"') < index.indexOf('href="teams.css"'));
  // an overlay is linked from theme-apply.js, later than anything in index.html, so it wins over the team
  assert.ok(fs.readFileSync(path.join(dashboardFolder, 'core/theme-apply.js'), 'utf8').includes('document.head.appendChild(link);'));
});

// The extras of a seasonal pack: a ticker prefix, a banner line and a corner art on a rule
// (dashboard/core/theme.js, dashboard/core/pack-extras.js). How they are drawn is in
// tools/test-seasons.mjs, and how the ticker and the banner use them is in tools/test-content.mjs.

// A rule for a seasonal pack as the Studio sends it, with the extras
function packRule(id, extras, dates) {
  const days = dates || ['2026-12-14', '2026-12-25'];
  return Object.assign(rule('overlay', id, days[0], days[1], true), extras);
}

const emptyExtras = { tickerPrefix: '', bannerLine: '', cornerArt: '' };

test('a rule for a seasonal pack keeps a ticker prefix, a banner line and a corner art, and a theme rule has none of them', () => {
  const typed = { tickerPrefix: 'HAPPY', bannerLine: 'Merry everything', cornerArt: 'gears' };
  const cleaned = tidyTheme({ schedule: [packRule(anOverlay, typed)] }).schedule[0];

  assert.deepEqual([cleaned.tickerPrefix, cleaned.bannerLine, cleaned.cornerArt], ['HAPPY', 'Merry everything', 'gears']);
  assert.deepEqual(tidyTheme({ schedule: [packRule(anOverlay)] }).schedule[0], Object.assign(packRule(anOverlay), emptyExtras), 'a rule that leaves them out has them empty');

  const themeRule = tidyTheme({ schedule: [Object.assign(rule('theme', otherTheme, '2026-12-14', '2026-12-25'), typed)] }).schedule[0];
  assert.deepEqual(Object.keys(themeRule).sort(), ['endDate', 'kind', 'name', 'repeatsEveryYear', 'startDate', 'theme'], 'a theme rule does not carry them');
});

test('the ticker prefix and the banner line are one line of text cut at 12 and 40 characters, and a corner art that is not in the list is empty', () => {
  const clean = extras => tidyTheme({ schedule: [packRule(anOverlay, extras)] }).schedule[0];

  assert.equal(packExtrasModule.tickerPrefixLimit, 12);
  assert.equal(packExtrasModule.bannerLineLimit, 40);
  assert.equal(clean({ tickerPrefix: '   HAPPY   DAYS  ' }).tickerPrefix, 'HAPPY DAYS');
  assert.equal(clean({ tickerPrefix: 'A VERY LONG PREFIX' }).tickerPrefix, 'A VERY LONG', 'cut at 12, with no space left at the end');
  assert.equal(clean({ bannerLine: 'x'.repeat(41) }).bannerLine, 'x'.repeat(40));
  assert.equal(clean({ bannerLine: 'One\nline\tonly' }).bannerLine, 'One line only');
  [undefined, null, 7, true, ['a'], { text: 'a' }].forEach(odd => {
    assert.equal(clean({ tickerPrefix: odd, bannerLine: odd }).tickerPrefix, '');
    assert.equal(clean({ tickerPrefix: odd, bannerLine: odd }).bannerLine, '');
  });

  cornerArtModule.cornerArtChoices.forEach(id => assert.equal(clean({ cornerArt: id }).cornerArt, id));
  ['', 'Gears', 'snowflake', 'sparkles', null, 4, ['gears']].forEach(odd => assert.equal(clean({ cornerArt: odd }).cornerArt, '', String(odd)));
  assert.deepEqual(cornerArtModule.cornerArtChoices, ['leaves', 'snowflakes', 'gears', 'fireworks', 'none']);
});

test('ruleExtras reads the rule for the pack: the one that covers today, else the first for that pack, else nothing', () => {
  const winter = packRule('christmas', { tickerPrefix: 'WINTER', bannerLine: 'Winter line', cornerArt: 'snowflakes' }, ['2026-12-14', '2026-12-25']);
  const later = packRule('christmas', { tickerPrefix: 'LATER', cornerArt: 'none' }, ['2026-12-26', '2026-12-31']);
  const other = packRule('halloween', { tickerPrefix: 'BOO' }, ['2026-10-24', '2026-10-31']);
  const theme = { schedule: [winter, later, other] };
  const at = (id, day) => ruleExtras(theme, id, new Date(day + 'T17:00:00Z'));

  assert.deepEqual(at('christmas', '2026-12-15'), { tickerPrefix: 'WINTER', bannerLine: 'Winter line', cornerArt: 'snowflakes' });
  assert.deepEqual(at('christmas', '2026-12-28'), { tickerPrefix: 'LATER', bannerLine: '', cornerArt: 'none' }, 'the rule that covers the day, not the first');
  assert.deepEqual(at('christmas', '2026-06-01'), { tickerPrefix: 'WINTER', bannerLine: 'Winter line', cornerArt: 'snowflakes' }, 'on a day no rule covers (Use now) the first rule for the pack');
  assert.deepEqual(at('halloween', '2026-12-15'), { tickerPrefix: 'BOO', bannerLine: '', cornerArt: '' });
  assert.deepEqual(at('thanksgiving', '2026-12-15'), emptyExtras, 'no rule for the pack');
  assert.deepEqual(ruleExtras(undefined, 'christmas', new Date()), emptyExtras);
  assert.deepEqual(ruleExtras({ schedule: [rule('theme', otherTheme, '2026-12-14', '2026-12-25', true)] }, 'christmas', new Date('2026-12-15T17:00:00Z')), emptyExtras, 'a theme rule is not a pack rule');
});

test('the overlay on the page is read from its class, and a page with no overlay class has none', () => {
  assert.equal(overlayShown({ className: 'theme-hawktimus overlay-christmas' }), 'christmas');
  assert.equal(overlayShown({ className: 'overlay-new-years theme-alternate' }), 'new-years');
  assert.equal(overlayShown({ className: 'theme-hawktimus' }), '');
  assert.equal(overlayShown({ className: '' }), '');
  assert.equal(overlayShown({ className: 'theme-overlay-x' }), '', 'only a class that starts with overlay-');
  assert.equal(overlayShown(), '', 'with no page at all');
});

test('packExtras: what is typed on the rule wins, the pack\'s own fills what is empty, corner art is none when there is neither, and a screen with no pack has nothing', () => {
  const content = extra => ({ theme: { schedule: [packRule('christmas', extra)] } });
  const page = { className: 'theme-hawktimus overlay-christmas' };
  const now = new Date('2026-12-15T17:00:00Z');
  const none = { tickerPrefix: '', bannerLine: '', cornerArt: 'none' };

  packExtrasModule.rememberDefaults('christmas', { cornerArt: 'snowflakes', tickerPrefix: 'OWN', bannerLine: 'The pack\'s own line' });
  assert.deepEqual(packExtras(content({}), now, page), { tickerPrefix: 'OWN', bannerLine: 'The pack\'s own line', cornerArt: 'snowflakes' }, 'an empty rule uses the pack');
  assert.deepEqual(packExtras(content({ tickerPrefix: 'TYPED', bannerLine: 'Typed', cornerArt: 'gears' }), now, page), { tickerPrefix: 'TYPED', bannerLine: 'Typed', cornerArt: 'gears' }, 'a typed value wins');
  assert.equal(packExtras(content({ cornerArt: 'none' }), now, page).cornerArt, 'none', 'None on the rule wins over the pack\'s corner art');
  assert.equal(packExtras(content({ tickerPrefix: 'TYPED' }), now, page).bannerLine, 'The pack\'s own line', 'each part is decided on its own');

  packExtrasModule.rememberDefaults('christmas', {});
  assert.deepEqual(packExtras(content({}), now, page), none, 'no rule value and no default');
  packExtrasModule.rememberDefaults('christmas', { cornerArt: 'sparkles' });
  assert.deepEqual(packExtras(content({}), now, page), none, 'a default that is not corner art is ignored');

  assert.deepEqual(packExtras(content({ tickerPrefix: 'TYPED' }), now, { className: 'theme-hawktimus' }), none, 'no overlay on the page');
  assert.deepEqual(packExtras(null, now, page), none, 'no content yet');
  assert.deepEqual(packExtras({ theme: 'oops' }, now, page), none);
  assert.deepEqual(packExtras(content({ tickerPrefix: 'TYPED' }), now, { className: 'overlay-halloween' }), none, 'another pack has no rule');
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
