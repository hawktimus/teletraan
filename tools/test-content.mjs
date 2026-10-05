// Tests for the content reader (dashboard/core/content.js, source.js and sanity.js).
// Nothing touches the network: fetch, EventSource, localStorage and the clock are fakes.
//
//   node tools/test-content.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const sampleFile = path.join(dashboardFolder, 'data/sample/content.json');
const storageKey = 'teletraan-content';
const sourceKey = 'teletraan-source';
const start = Date.UTC(2026, 9, 2, 15, 0, 0);
const today = new Date(2026, 9, 2, 11, 0); // 2 October 2026 on this computer's own clock
const second = 1000;
const minute = 60 * second;

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them
// without changing the files. The copy has its own config.js.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-content-'));

async function loadCopy(name, changeConfig) {
  const root = path.join(workFolder, name);
  fs.mkdirSync(path.join(root, 'dashboard/core'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{ "type": "module" }\n');

  const config = fs.readFileSync(path.join(dashboardFolder, 'config.js'), 'utf8');
  fs.writeFileSync(path.join(root, 'dashboard/config.js'), changeConfig(config));
  fs.readdirSync(path.join(dashboardFolder, 'core'))
    .filter(file => file.endsWith('.js'))
    .forEach(file => {
      fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(root, 'dashboard/core', file));
    });

  // core/theme.js reads the two registries of themes and overlays
  fs.mkdirSync(path.join(root, 'dashboard/themes/overlays'), { recursive: true });
  ['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
    fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, 'dashboard', file));
  });

  // the Events panel and the Next event tile draw the merged list, so they are tested too
  ['events/events.js', 'next-event/next-event.js'].forEach(file => {
    fs.mkdirSync(path.join(root, 'dashboard/panels', path.dirname(file)), { recursive: true });
    fs.copyFileSync(path.join(dashboardFolder, 'panels', file), path.join(root, 'dashboard/panels', file));
  });

  const base = pathToFileURL(path.join(root, 'dashboard')).href + '/';
  return {
    config: await import(base + 'config.js'),
    content: await import(base + 'core/content.js'),
    device: await import(base + 'core/device.js'),
    events: await import(base + 'core/events.js'),
    eventsPanel: await import(base + 'panels/events/events.js'),
    nextEventPanel: await import(base + 'panels/next-event/next-event.js'),
    images: await import(base + 'core/images.js'),
    portrait: await import(base + 'core/portrait.js'),
    sanity: await import(base + 'core/sanity.js'),
    source: await import(base + 'core/source.js'),
    text: await import(base + 'core/text.js'),
    theme: await import(base + 'core/theme.js'),
    turns: await import(base + 'core/turns.js'),
  };
}

// Which content the screen shows is decided while it runs, by Dashboard
// Settings. The one thing config.js still says about it is useSampleContent,
// the fallback for when the settings cannot be read. So there is a copy with
// the flag on and a copy with it off, whatever the repository has today.
// noProject has a project ID that is empty, so there is nothing to ask.
function setFallbackFlag(text, value) {
  assert.ok(/useSampleContent = (true|false);/.test(text), 'config.js no longer has useSampleContent');
  return text.replace(/useSampleContent = (true|false);/, 'useSampleContent = ' + value + ';');
}

const live = await loadCopy('flag-off', text => setFallbackFlag(text, false));
const flagOn = await loadCopy('flag-on', text => setFallbackFlag(text, true));
const noProject = await loadCopy('no-project', text => setFallbackFlag(text, false).replace(/projectId: '[^']*'/, "projectId: ''"));
assert.equal(live.config.useSampleContent, false);
assert.equal(flagOn.config.useSampleContent, true);
assert.equal(noProject.config.sanity.projectId, '');

const { normalizeContent, contentQuery, queryUrl, liveEventsUrl, sourceQuery, sourceQueryUrl, fetchSourceSettings, normalizeSample } = live.sanity;
const { withDefaults, isVisible, visibleItems, startContent, startSanityContent, startSampleContent } = live.content;
const { pickSource, tidySourceSettings } = live.source;
const { escapeHtml, hasText } = live.text;
const { tidyDevice, deviceLines, loginAddress, showDeviceInfo, deviceFile, refreshSeconds } = live.device;
const { tidyExtraEvent, extraEventsToEvents, mergeEvents, instantIn, rangeLabel, rangeText, timeText } = live.events;
const eventsPanel = live.eventsPanel;
const nextEventPanel = live.nextEventPanel;
const { makeTurns, makePages } = live.turns;
const { tidyPhoto, photoUrl, preloadImages } = live.images;
const { photoAddress, personNamed, slotMarkup, slotsPerPage, silhouetteMarkup } = live.portrait;

// startContent decides between the two readers. These two skip the deciding
// and just read, for the tests that are about one reader.
async function readSanity(onChange) {
  return (await startSanityContent(onChange)).first;
}

async function readSample(onChange) {
  return (await startSampleContent(onChange)).first;
}

// Fakes for the network, the clock and storage

function settle() {
  return new Promise(resolve => setImmediate(resolve));
}

function jsonResponse(body, status) {
  const code = status || 200;
  return { ok: code < 400, status: code, json: async () => body };
}

function sanityReply(result) {
  return jsonResponse({ ms: 5, query: '', result: result });
}

function unreachable() {
  return Promise.reject(new TypeError('Failed to fetch'));
}

// A copy, so that a test changing its fixture later cannot change content that was already handed out
function copyOf(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeEventSource(world) {
  class FakeEventSource {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.listeners = {};
      world.streams.push(this);
    }

    addEventListener(type, run) {
      this.listeners[type] = (this.listeners[type] || []).concat(run);
    }

    emit(type) {
      (this.listeners[type] || []).forEach(run => run({ type: type }));
    }

    close() {
      this.readyState = 2;
    }
  }
  FakeEventSource.CLOSED = 2;
  return FakeEventSource;
}

// One fake world per test: a clock that only moves when advance() is called,
// and a fetch that answers with whatever world.handler returns
function makeWorld() {
  const world = {
    now: start,
    timers: [],
    nextTimerId: 1,
    fetches: [],
    inFlight: 0,
    mostInFlight: 0,
    handler: async () => sanityReply({}),
    streams: [],
    storage: new Map(),
    storageBroken: false,
    errors: [],
    changes: [],
  };

  world.onChange = change => world.changes.push(change);

  world.fetch = async (url, options) => {
    world.fetches.push({ url: String(url), options: options || {} });
    world.inFlight += 1;
    world.mostInFlight = Math.max(world.mostInFlight, world.inFlight);
    try {
      return await world.handler(String(url), options || {});
    } finally {
      world.inFlight -= 1;
    }
  };

  world.localStorage = {
    getItem(key) {
      if (world.storageBroken) throw new Error('storage is blocked');
      return world.storage.has(key) ? world.storage.get(key) : null;
    },
    setItem(key, value) {
      if (world.storageBroken) throw new Error('storage is blocked');
      world.storage.set(key, String(value));
    },
  };

  function addTimer(run, delay, every) {
    const timer = { id: world.nextTimerId, at: world.now + delay, run: run, every: every };
    world.nextTimerId += 1;
    world.timers.push(timer);
    return timer.id;
  }

  world.setTimeout = (run, delay) => addTimer(run, delay, null);
  world.setInterval = (run, delay) => addTimer(run, delay, delay);
  world.clearTimeout = id => {
    world.timers = world.timers.filter(timer => timer.id !== id);
  };

  // Runs every timer that falls due in the next so many milliseconds, in order
  world.advance = async milliseconds => {
    const end = world.now + milliseconds;
    while (true) {
      const due = world.timers
        .filter(timer => timer.at <= end)
        .sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;

      world.now = Math.max(world.now, due.at);
      if (due.every) {
        due.at += due.every;
      } else {
        world.timers = world.timers.filter(timer => timer !== due);
      }
      due.run();
      await settle();
    }
    world.now = end;
    await settle();
  };

  world.EventSource = makeEventSource(world);
  return world;
}

const faked = ['fetch', 'EventSource', 'localStorage', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'];

async function inWorld(run) {
  const world = makeWorld();
  const originals = {};
  faked.forEach(name => {
    originals[name] = Object.getOwnPropertyDescriptor(globalThis, name);
  });
  const realNow = Date.now;
  const realError = console.error;

  const replacements = {
    fetch: world.fetch,
    EventSource: world.EventSource,
    localStorage: world.localStorage,
    setTimeout: world.setTimeout,
    clearTimeout: world.clearTimeout,
    setInterval: world.setInterval,
    clearInterval: world.clearTimeout,
  };
  faked.forEach(name => {
    Object.defineProperty(globalThis, name, { value: replacements[name], configurable: true, writable: true });
  });
  Date.now = () => world.now;
  console.error = (message, error) => world.errors.push(message + (error ? ' / ' + error.message : ''));

  try {
    await run(world);
  } finally {
    console.error = realError;
    Date.now = realNow;
    faked.forEach(name => {
      if (originals[name]) Object.defineProperty(globalThis, name, originals[name]);
      else delete globalThis[name];
    });
  }
}

function saveCopy(world, raw, savedAt) {
  world.storage.set(storageKey, JSON.stringify({ savedAt: savedAt, raw: raw }));
}

// Sample answers from Sanity

function document(type, id, fields) {
  return Object.assign({
    _id: id,
    _type: type,
    _rev: 'rev-' + id,
    _createdAt: '2026-09-01T10:00:00Z',
    _updatedAt: '2026-09-30T10:00:00Z',
  }, fields);
}

// A result like the one Sanity sends back for contentQuery, with every kind
// of document, Sanity's own keys, empty fields and nulls
function sanityFixture() {
  return {
    settings: document('dashboardSettings', 'dashboardSettings', {
      team: { name: '[Team name]', number: 1234, school: null },
      motion: 'calm',
      speed: 'slow',
      frameMetal: 'silver',
      glint: false,
      pageSeconds: 30,
      nameTransform: false,
      nameEvery: 120,
      nameDuration: 3,
      countdown: {
        kickoffLabel: '[Kickoff label]',
        kickoff: '2027-01-09T17:00:00.000Z',
        rolloutLabel: '[Rollout label]',
        rollout: '2027-03-01T17:00:00.000Z',
      },
      alert: { on: true, headline: '[Alert headline]', message: '[Alert message]', until: '2026-10-03T00:00:00.000Z' },
      rotation: {
        grid1: [
          { _key: 'a1', panel: 'events', show: true, seconds: 20 },
          { _key: 'a2', panel: 'tasks', show: false, seconds: 16 },
          { _key: 'a3', panel: 'photo' },
        ],
        grid2: [{ _key: 'b1', panel: 'forecast', show: true, seconds: 10 }],
        tickerSeconds: 30,
      },
      doneDays: 5,
      safetyDaysSince: '2026-09-01',
      crt: { on: false, everyMinutes: 6 }, // saved before the glitch had seconds
      announcements: [
        { _key: 'n1', time: '14:30', title: '[Title]', followUp: '[Follow up]', titleSeconds: 8, followUpSeconds: 6, days: [1, 2, 3, 4, 5] },
        { _key: 'n2', time: 'soon', title: '[No usable time]' },
      ],
      calendars: [
        { _key: 'c1', id: 'team', name: '[Team calendar]', show: true },
        { _key: 'c2', id: 'build', name: '[Build calendar]', show: false },
      ],
    }),

    tasks: [
      document('task', 't1', { title: '[Task A]', subteam: '[Subteam A]', status: 'in-progress', order: 2 }),
      document('task', 't2', { title: '[Task B]', subteam: null, status: 'blocked', order: 1, show: false }),
      document('task', 't3', { title: '[Task C]', subteam: '[Subteam B]', status: 'done', finishedOn: '2026-09-30T20:00:00.000Z' }),
      document('task', 't4', { title: '[Task D]', subteam: '[Subteam C]', status: 'up-next', expires: '2020-01-01T00:00:00.000Z' }),
    ],

    sponsors: [
      document('sponsor', 's1', { name: '[Sponsor A]', tier: '[Tier]', blurb: '[Blurb A]', thankYou: '[Thank you A]', logoAddress: 'https://example.com/logo-a.svg', order: 2 }),
      document('sponsor', 's2', { name: '[Sponsor B]', tier: '[Tier]', blurb: '[Blurb B]', thankYou: '', logoAddress: '', order: 1 }),
    ],

    tipsAndNews: [
      document('tipOrNews', 'k1', { kind: 'tip', text: '[A tip]' }),
      document('tipOrNews', 'k2', { kind: 'news', text: '[A piece of news]', show: false }),
      document('tipOrNews', 'k3', { kind: 'reminder', text: '[A reminder]', order: 1 }),
    ],

    subteams: [
      document('subteam', 'u1', { name: '[Subteam A]', lead: '[Lead A]', spotlight: true, spotlightHeadline: '[Headline]', spotlightText: '[Spotlight text]', order: 1 }),
      document('subteam', 'u2', { name: '[Subteam B]', lead: '[Lead B]', spotlight: false, order: 2 }),
    ],

    people: [
      document('person', 'p1', { role: 'Mentor', name: '[Mentor A]' }),
      document('person', 'p2', { role: 'Coach', name: '[Coach A]', order: 1 }),
    ],

    plans: [
      document('plan', 'l1', { heading: '[Hidden plan]', show: false }),
      document('plan', 'l2', { heading: '[Expired plan]', expires: '2020-01-01T00:00:00.000Z' }),
      document('plan', 'l3', {
        heading: "[Tonight's plan]",
        date: '2026-10-02',
        location: '[Room]',
        rows: [
          { _key: 'r1', time: '[6:00 PM]', text: '[First thing]', lead: '[Lead A]' },
          { _key: 'r2', time: '[7:00 PM]', text: '[Second thing]', lead: '' },
          { _key: 'r3' },
        ],
        expires: '2099-01-01T00:00:00.000Z',
      }),
      document('plan', 'l4', { heading: '[A later plan]' }),
    ],

    customPanels: [
      document('customPanel', 'm1', {
        title: '[Custom panel]',
        order: 2,
        blocks: [
          { _key: 'b1', _type: 'headingBlock', text: '[A heading]' },
          { _key: 'b2', _type: 'textBlock', text: '[Some text]' },
          { _key: 'b3', _type: 'statBlock', value: '[00]', label: '[What it counts]' },
          { _key: 'b4', _type: 'listBlock', items: ['[First]', '', '[Second]'] },
          { _key: 'b5', _type: 'imageBlock', address: 'https://example.com/photo.jpg' },
          { _key: 'b6', _type: 'progressBlock', label: '[Goal]', percent: 0 },
          { _key: 'b7', _type: 'countdownBlock', label: '[Event]', target: '2026-12-01T18:00:00.000Z' },
          { _key: 'b8', text: 'A block with no type' },
        ],
      }),
      document('customPanel', 'm2', { title: '[First custom panel]', order: 1, blocks: [{ _key: 'b9', _type: 'listBlock' }] }),
    ],
  };
}

// The tests

const tests = [];

function test(name, run) {
  tests.push({ name: name, run: run });
}

test('normalizeContent turns a full Sanity result into the sample content shape', () => {
  const content = normalizeContent(sanityFixture(), today);
  const sampleContent = withDefaults(JSON.parse(fs.readFileSync(sampleFile, 'utf8')));

  assert.deepEqual(Object.keys(content).sort(), Object.keys(sampleContent).sort());
  assert.deepEqual(content.team, { name: '[Team name]', number: '1234', school: live.config.defaultTeam.school });

  const settings = content.settings;
  assert.equal(settings.motion, 'calm');
  assert.equal(settings.speed, 'slow');
  assert.equal(settings.frameMetal, 'silver');
  assert.equal(settings.glint, false);
  assert.equal(settings.pageSeconds, 30);
  assert.equal(settings.nameTransform, false);
  assert.equal(settings.nameEvery, 120);
  assert.equal(settings.nameDuration, 3);
  assert.deepEqual(settings.countdown, {
    kickoffLabel: '[Kickoff label]',
    kickoff: '2027-01-09T17:00:00.000Z',
    rolloutLabel: '[Rollout label]',
    rollout: '2027-03-01T17:00:00.000Z',
  });
  assert.deepEqual(settings.alert, { on: true, headline: '[Alert headline]', message: '[Alert message]', until: '2026-10-03T00:00:00.000Z' });
  assert.deepEqual(settings.rotation, {
    grid1: [
      { panel: 'events', show: true, seconds: 20 },
      { panel: 'tasks', show: false, seconds: 16 },
      { panel: 'photo', show: true },
    ],
    grid2: [{ panel: 'forecast', show: true, seconds: 10 }],
    tickerSeconds: 30,
  });
  assert.equal(settings.doneDays, 5);
  assert.equal(settings.safetyDaysSince, '2026-09-01');
  assert.deepEqual(settings.crt, { on: false, everySeconds: 360, durationSeconds: 2.7 });
  assert.deepEqual(settings.announcements, [
    { time: '14:30', title: '[Title]', followUp: '[Follow up]', titleSeconds: 8, followUpSeconds: 6, days: [1, 2, 3, 4, 5] },
  ]);
  assert.deepEqual(settings.calendars, [
    { id: 'team', name: '[Team calendar]', show: true },
    { id: 'build', name: '[Build calendar]', show: false },
  ]);
  assert.equal('team' in settings, false);

  assert.deepEqual(content.tasks, [
    { title: '[Task B]', status: 'blocked', order: 1, show: false },
    { title: '[Task A]', subteam: '[Subteam A]', status: 'in-progress', order: 2 },
    { title: '[Task C]', subteam: '[Subteam B]', status: 'done', finishedOn: '2026-09-30T20:00:00.000Z' },
    { title: '[Task D]', subteam: '[Subteam C]', status: 'up-next', expires: '2020-01-01T00:00:00.000Z' },
  ]);

  assert.deepEqual(content.sponsors, [
    { name: '[Sponsor B]', tier: '[Tier]', blurb: '[Blurb B]', order: 1 },
    { name: '[Sponsor A]', tier: '[Tier]', blurb: '[Blurb A]', thankYou: '[Thank you A]', logoAddress: 'https://example.com/logo-a.svg', order: 2 },
  ]);

  assert.deepEqual(content.tipsAndNews, [
    { kind: 'reminder', text: '[A reminder]', order: 1 },
    { kind: 'tip', text: '[A tip]' },
    { kind: 'news', text: '[A piece of news]', show: false },
  ]);

  assert.deepEqual(content.subteams, [
    { name: '[Subteam A]', lead: '[Lead A]', spotlight: true, spotlightHeadline: '[Headline]', spotlightText: '[Spotlight text]', order: 1 },
    { name: '[Subteam B]', lead: '[Lead B]', spotlight: false, order: 2 },
  ]);

  assert.deepEqual(content.people, [
    { role: 'Coach', name: '[Coach A]', order: 1, showPhoto: true },
    { role: 'Mentor', name: '[Mentor A]', showPhoto: true },
  ]);

  assert.deepEqual(content.plan, {
    heading: "[Tonight's plan]",
    date: '2026-10-02',
    location: '[Room]',
    rows: [
      { time: '[6:00 PM]', text: '[First thing]', lead: '[Lead A]' },
      { time: '[7:00 PM]', text: '[Second thing]' },
    ],
    expires: '2099-01-01T00:00:00.000Z',
  });

  const text = JSON.stringify(content);
  ['_id', '_rev', '_createdAt', '_updatedAt', '_key', '_type', 'undefined', 'null'].forEach(word => {
    assert.equal(text.includes(word), false, 'the content contains ' + word);
  });
});

test('normalizeContent maps every kind of custom panel block', () => {
  const content = normalizeContent(sanityFixture());

  assert.deepEqual(content.customPanels, [
    { title: '[First custom panel]', order: 1, blocks: [{ type: 'list', items: [] }] },
    {
      title: '[Custom panel]',
      order: 2,
      blocks: [
        { type: 'heading', text: '[A heading]' },
        { type: 'text', text: '[Some text]' },
        { type: 'stat', value: '[00]', label: '[What it counts]' },
        { type: 'list', items: ['[First]', '[Second]'] },
        { type: 'image', address: 'https://example.com/photo.jpg' },
        { type: 'progress', label: '[Goal]', percent: 0 },
        { type: 'countdown', label: '[Event]', target: '2026-12-01T18:00:00.000Z' },
      ],
    },
  ]);
});

test('normalizeContent orders by order: numbered first, the rest in stored order', () => {
  const titles = ['none-1', 'five', 'one-first', 'none-2', 'one-second', 'zero'];
  const orders = [undefined, 5, 1, undefined, 1, 0];
  const result = {
    tasks: titles.map((title, index) => document('task', 'id' + index, { title: title, order: orders[index] })),
  };

  const sorted = normalizeContent(result).tasks.map(task => task.title);
  assert.deepEqual(sorted, ['zero', 'one-first', 'one-second', 'five', 'none-1', 'none-2']);
});

test('normalizeContent keeps hidden and expired items, and picks the first plan that is showing', () => {
  const fixture = sanityFixture();
  const content = normalizeContent(fixture, today);

  assert.equal(content.tasks.length, 4);
  assert.equal(visibleItems(content.tasks, new Date(start)).length, 2);
  assert.equal(content.tipsAndNews.length, 3);
  assert.equal(content.plan.heading, "[Tonight's plan]");

  const laterPlan = fixture.plans[2];
  laterPlan.show = false;
  assert.equal(normalizeContent(fixture, today).plan.heading, '[A later plan]');

  fixture.plans[3].show = false;
  assert.equal(normalizeContent(fixture, today).plan, null);
});

function planResult(plans) {
  return {
    plans: plans.map((plan, index) => document('plan', 'plan' + index, Object.assign({ rows: [] }, plan))),
  };
}

test('normalizeContent picks the first plan that is for today, not one that is for another day', () => {
  const plans = [
    { heading: '[Last week]', date: '2026-09-25' },
    { heading: '[Yesterday]', date: '2026-10-01' },
    { heading: '[Tomorrow]', date: '2026-10-03' },
    { heading: '[Tonight]', date: '2026-10-02' },
    { heading: '[No date]' },
  ];
  assert.equal(normalizeContent(planResult(plans), today).plan.heading, '[Tonight]');

  const withoutToday = plans.filter(plan => plan.heading !== '[Tonight]');
  assert.equal(normalizeContent(planResult(withoutToday), today).plan.heading, '[No date]');

  const onlyOtherDays = withoutToday.filter(plan => plan.date);
  assert.equal(normalizeContent(planResult(onlyOtherDays), today).plan, null);

  const lastMinute = new Date(2026, 9, 2, 23, 59);
  assert.equal(normalizeContent(planResult(plans), lastMinute).plan.heading, '[Tonight]');
  const nextMorning = new Date(2026, 9, 3, 0, 1);
  assert.equal(normalizeContent(planResult(plans), nextMorning).plan.heading, '[Tomorrow]');
});

test('normalizeContent skips a hidden or expired plan for today, and reads a date it cannot understand as no date', () => {
  const plans = [
    { heading: '[Hidden]', date: '2026-10-02', show: false },
    { heading: '[Expired]', date: '2026-10-02', expires: '2026-10-02T09:00:00' },
    { heading: '[Odd date]', date: 'next friday' },
    { heading: '[Tonight]', date: '2026-10-02' },
  ];
  assert.equal(normalizeContent(planResult(plans), today).plan.heading, '[Odd date]');
  assert.equal(normalizeContent(planResult(plans.slice(0, 2).concat(plans[3])), today).plan.heading, '[Tonight]');
});

test('normalizeContent of an empty dataset is the defaults', () => {
  const empty = {
    settings: null,
    tasks: [],
    sponsors: [],
    tipsAndNews: [],
    subteams: [],
    people: [],
    plans: [],
    customPanels: [],
  };

  assert.deepEqual(normalizeContent(empty), withDefaults({}));
  assert.deepEqual(normalizeContent({}), withDefaults({}));
  assert.deepEqual(normalizeContent(null), withDefaults({}));
  assert.deepEqual(normalizeContent({ settings: 'oops', tasks: 'oops', plans: 7, customPanels: [null, 3] }), withDefaults({}));
});

test('normalizeContent fills gaps in settings from the defaults', () => {
  const result = {
    settings: {
      countdown: { kickoff: '2027-01-09T17:00:00.000Z' },
      rotation: {
        grid1: [{ panel: 'events' }, { show: true, seconds: 9 }],
        grid2: [{ panel: 'forecast', seconds: 0 }],
      },
      announcements: [{ time: '9:05', title: '[Title]' }, { title: 'No time' }],
      calendars: [{ name: 'No id', show: true }],
    },
  };
  const settings = normalizeContent(result).settings;
  const defaults = live.config.defaultSettings;

  assert.deepEqual(settings.countdown, Object.assign({}, defaults.countdown, { kickoff: '2027-01-09T17:00:00.000Z' }));
  assert.deepEqual(settings.rotation.grid1, [{ panel: 'events', show: true }]);
  assert.deepEqual(settings.rotation.grid2, [{ panel: 'forecast', show: true }]);
  assert.equal('tickerSeconds' in settings.rotation, false);
  ['frameMetal', 'glint', 'pageSeconds', 'nameTransform', 'nameEvery', 'nameDuration'].forEach(name => {
    assert.equal(settings[name], defaults[name], name + ' is missing, so it is the default');
  });
  assert.deepEqual(settings.announcements, [
    { time: '9:05', title: '[Title]', followUp: '', titleSeconds: 12, followUpSeconds: 10, days: [] },
  ]);
  assert.deepEqual(settings.calendars, []);
  assert.deepEqual(settings.alert, defaults.alert);
  assert.deepEqual(settings.crt, defaults.crt);
});

test('the query and the addresses', () => {
  const project = { projectId: 'abc123', dataset: 'production', apiVersion: '2025-02-19' };
  const url = new URL(queryUrl(project));

  assert.equal(url.origin, 'https://abc123.api.sanity.io');
  assert.equal(url.pathname, '/v2025-02-19/data/query/production');
  assert.equal(url.searchParams.get('query'), contentQuery);
  assert.deepEqual(Array.from(url.searchParams.keys()).sort(), ['perspective', 'query']);
  assert.equal(url.searchParams.get('perspective'), 'published');
  assert.equal(liveEventsUrl(project), 'https://abc123.api.sanity.io/v2025-02-19/data/live/events/production');

  ['dashboardSettings', 'task', 'sponsor', 'tipOrNews', 'subteam', 'person', 'plan', 'customPanel', 'subteam->name'].forEach(word => {
    assert.ok(contentQuery.includes(word), 'the query does not mention ' + word);
  });
});

test('the query keeps lists in the order they were created, and dates a finished task', () => {
  ['task', 'sponsor', 'tipOrNews', 'subteam', 'person', 'customPanel'].forEach(type => {
    const list = '*[_type == "' + type + '"] | order(_createdAt asc)';
    assert.ok(contentQuery.includes(list), 'the ' + type + ' list is not in creation order');
  });
  assert.ok(contentQuery.includes('*[_type == "plan"] | order(date asc, _createdAt asc)'));

  // the Tasks panel reads finishedOn, so the answer has to carry that name
  assert.ok(contentQuery.includes('"finishedOn": coalesce(finishedOn, _updatedAt)'));
  const finished = document('task', 't9', { title: '[Done]', status: 'done', finishedOn: '2026-09-30T10:00:00Z' });
  assert.equal(normalizeContent({ tasks: [finished] }).tasks[0].finishedOn, '2026-09-30T10:00:00Z');
});

test('the query hands over an empty list when the editors deleted every row', () => {
  [
    '"announcements": coalesce(announcements, [])',
    '"calendars": coalesce(calendars, [])',
    '"grid1": coalesce(grid1, [])',
    '"grid2": coalesce(grid2, [])',
  ].forEach(part => assert.ok(contentQuery.includes(part), 'the query does not contain ' + part));

  const none = normalizeContent({
    settings: document('dashboardSettings', 'dashboardSettings', {
      rotation: { grid1: [], grid2: [], tickerSeconds: 20 },
      announcements: [],
      calendars: [],
    }),
  }).settings;
  assert.deepEqual(none.rotation, { grid1: [], grid2: [], tickerSeconds: 20 });
  assert.deepEqual(none.announcements, []);
  assert.deepEqual(none.calendars, []);
});

test('a settings document that does not exist, or has no lists, gives the default lists', () => {
  const defaults = live.config.defaultSettings;
  const noDocument = normalizeContent({ settings: null }).settings;
  assert.deepEqual(noDocument.announcements, defaults.announcements);
  assert.deepEqual(noDocument.calendars, defaults.calendars);
  assert.deepEqual(noDocument.rotation, defaults.rotation);

  const noLists = normalizeContent({ settings: document('dashboardSettings', 'dashboardSettings', { motion: 'calm' }) }).settings;
  assert.deepEqual(noLists.announcements, defaults.announcements);
  assert.deepEqual(noLists.rotation, defaults.rotation);
});

test('an announcement that is switched off is left out, and one with no switch is on', () => {
  const entry = fields => Object.assign({ time: '14:30', title: '[Title]', days: [1] }, fields);
  const result = {
    settings: {
      announcements: [
        entry({ title: '[On]', show: true }),
        entry({ title: '[Off]', show: false }),
        entry({ title: '[No switch]' }),
      ],
    },
  };
  const titles = list => list.map(item => item.title);

  assert.deepEqual(titles(normalizeContent(result).settings.announcements), ['[On]', '[No switch]']);
  assert.deepEqual(titles(normalizeSample(result).settings.announcements), ['[On]', '[No switch]']);

  result.settings.announcements = [entry({ show: false }), entry({ show: false })];
  assert.deepEqual(normalizeContent(result).settings.announcements, []);
  assert.deepEqual(normalizeSample(result).settings.announcements, []);
});

test('seconds on a row or the ticker that are zero, negative or not numbers are left out, and announcements get their defaults', () => {
  const bad = [0, -5, 'abc', '12', NaN, Infinity, true, {}, [8]];

  bad.forEach(value => {
    const result = {
      settings: {
        rotation: {
          grid1: [{ panel: 'tasks', seconds: value }],
          grid2: [{ panel: 'forecast', seconds: value }],
          tickerSeconds: value,
        },
        announcements: [{ time: '14:30', title: '[Title]', titleSeconds: value, followUpSeconds: value, days: [1] }],
      },
    };
    [normalizeContent(result), normalizeSample(result)].forEach(content => {
      const rotation = content.settings.rotation;
      assert.deepEqual(rotation.grid1, [{ panel: 'tasks', show: true }], 'grid1 with ' + String(value));
      assert.deepEqual(rotation.grid2, [{ panel: 'forecast', show: true }], 'grid2 with ' + String(value));
      assert.equal('tickerSeconds' in rotation, false, 'ticker with ' + String(value));
      assert.equal(content.settings.announcements[0].titleSeconds, 12);
      assert.equal(content.settings.announcements[0].followUpSeconds, 10);
    });
  });

  const good = { settings: { rotation: { grid1: [{ panel: 'tasks', seconds: 30 }], tickerSeconds: 40 } } };
  assert.equal(normalizeContent(good).settings.rotation.grid1[0].seconds, 30);
  assert.equal(normalizeContent(good).settings.rotation.tickerSeconds, 40);
});

test('a rotation list that is not a list is replaced by the default list', () => {
  const defaults = live.config.defaultSettings.rotation;
  const result = { settings: { rotation: { grid1: 'tasks', grid2: { panel: 'forecast' } } } };

  [normalizeContent(result), normalizeSample(result)].forEach(content => {
    assert.deepEqual(content.settings.rotation, defaults);
  });
  assert.deepEqual(normalizeSample({ settings: { rotation: 'text' } }).settings.rotation, defaults);
});

test('isVisible, visibleItems and withDefaults', () => {
  const now = new Date(start);
  assert.equal(isVisible({}, now), true);
  assert.equal(isVisible({ show: false }, now), false);
  assert.equal(isVisible({ expires: '2026-10-02T14:59:00.000Z' }, now), false);
  assert.equal(isVisible({ expires: '2026-10-02T15:01:00.000Z' }, now), true);
  assert.equal(isVisible({ expires: '' }, now), true);
  assert.deepEqual(visibleItems(undefined, now), []);
  assert.deepEqual(visibleItems([{ n: 1 }, { n: 2, show: false }], now), [{ n: 1 }]);

  const content = withDefaults({ team: { name: '[Name]' }, settings: { motion: 'calm', crt: { on: false } } });
  assert.deepEqual(content.team, { name: '[Name]', number: '3229', school: 'HOLLY SPRINGS HIGH SCHOOL' });
  assert.equal(content.settings.motion, 'calm');
  assert.deepEqual(content.settings.crt, { on: false, everySeconds: 240, durationSeconds: 2.7 });
  assert.deepEqual(content.tasks, []);
  assert.equal(content.plan, null);
  assert.deepEqual(withDefaults(null), withDefaults({}));
  assert.deepEqual(content.settings.calendars, [{ id: 'team', name: 'Team calendar', show: true }]);
});

test('speed is one of four names, and anything else becomes normal', () => {
  assert.deepEqual(live.config.speeds, { 'very-slow': 2, 'slow': 1.5, 'normal': 1, 'fast': 0.75 });
  assert.equal(live.config.defaultSettings.speed, 'normal');

  Object.keys(live.config.speeds).forEach(name => {
    assert.equal(normalizeContent({ settings: { speed: name } }).settings.speed, name);
    assert.equal(normalizeSample({ settings: { speed: name } }).settings.speed, name);
    assert.equal(withDefaults({ settings: { speed: name } }).settings.speed, name);
  });

  [undefined, null, '', 'Fast', 'turbo', 'toString', 3, ['fast'], {}].forEach(value => {
    const label = JSON.stringify(value);
    assert.equal(normalizeContent({ settings: { speed: value } }).settings.speed, 'normal', 'Sanity content with ' + label);
    assert.equal(normalizeSample({ settings: { speed: value } }).settings.speed, 'normal', 'sample content with ' + label);
    assert.equal(withDefaults({ settings: { speed: value } }).settings.speed, 'normal', 'withDefaults with ' + label);
  });

  assert.equal(normalizeContent({ settings: null }).settings.speed, 'normal');
  assert.equal(withDefaults(null).settings.speed, 'normal');
});

// The three ways content reaches the screen: from Sanity, from the sample
// file, and straight into withDefaults. Each must treat settings the same way.
function settingsThrough(settings) {
  return [
    normalizeContent({ settings: settings }).settings,
    normalizeSample({ settings: settings }).settings,
    withDefaults({ settings: settings }).settings,
  ];
}

test('the new settings have the defaults the Studio starts with', () => {
  const defaults = live.config.defaultSettings;

  assert.deepEqual(live.config.metals, ['gold', 'silver']);
  assert.equal(defaults.frameMetal, 'gold');
  assert.equal(defaults.glint, true);
  assert.equal(defaults.pageSeconds, 20);
  assert.equal(defaults.nameTransform, true);
  assert.equal(defaults.nameEvery, 300);
  assert.equal(defaults.nameDuration, 1.43);
  assert.deepEqual(defaults.crt, { on: true, everySeconds: 240, durationSeconds: 2.7 });
  assert.deepEqual(live.config.limits, {
    pageSeconds: { min: 8, max: 120 },
    nameEvery: { min: 0, shortest: 30, max: 900 },
    nameDuration: { min: 0.5, max: 10 },
    crtEvery: { min: 0, shortest: 30, max: 3600 },
    crtDuration: { min: 0.5, max: 10 },
  });

  // the name effect takes .8 s for a letter and each later letter starts 45 ms after the one before (frame.css)
  const letters = Array.from(live.config.defaultTeam.name).length;
  assert.equal(letters, 15);
  assert.ok(Math.abs(0.8 + (letters - 1) * 0.045 - defaults.nameDuration) < 0.0005, 'nameDuration is the length of the effect on the default name');

  // the starting rows follow pageSeconds, so they carry no seconds of their own
  ['grid1', 'grid2'].forEach(area => {
    assert.ok(defaults.rotation[area].length > 0);
    defaults.rotation[area].forEach(step => assert.equal('seconds' in step, false, step.panel));
  });
  assert.equal('tickerSeconds' in defaults.rotation, false);

  const empty = withDefaults({}).settings;
  ['frameMetal', 'glint', 'pageSeconds', 'nameTransform', 'nameEvery', 'nameDuration'].forEach(name => {
    assert.equal(empty[name], defaults[name], name);
  });
  assert.deepEqual(empty.crt, defaults.crt);
});

test('frame metal is gold or silver, and anything else becomes gold', () => {
  live.config.metals.forEach(name => {
    settingsThrough({ frameMetal: name }).forEach(settings => assert.equal(settings.frameMetal, name));
  });

  [undefined, null, '', 'Gold', 'SILVER', 'bronze', 'toString', 0, true, ['gold'], {}].forEach(value => {
    settingsThrough({ frameMetal: value }).forEach(settings => {
      assert.equal(settings.frameMetal, 'gold', JSON.stringify(value));
    });
  });
  assert.equal(normalizeContent({ settings: null }).settings.frameMetal, 'gold');
  assert.equal(withDefaults(null).settings.frameMetal, 'gold');
});

test('glint and the name effect are switches, and anything but true or false becomes on', () => {
  ['glint', 'nameTransform'].forEach(name => {
    [true, false].forEach(value => {
      settingsThrough({ [name]: value }).forEach(settings => assert.equal(settings[name], value, name));
    });

    [undefined, null, '', 'false', 'off', 'yes', 0, 1, [], {}].forEach(value => {
      settingsThrough({ [name]: value }).forEach(settings => {
        assert.equal(settings[name], true, name + ' with ' + JSON.stringify(value));
      });
    });
  });
});

// a good number stays, a number outside the range moves to the nearest end,
// and anything that is not a finite number becomes the default
function checkRange(name, min, max, fallback, inside) {
  inside.concat([min, max]).forEach(value => {
    settingsThrough({ [name]: value }).forEach(settings => assert.equal(settings[name], value, name + ' ' + value));
  });

  [[min - 1, min], [0, min], [-3, min], [-1e9, min], [max + 1, max], [1e9, max]].forEach(pair => {
    settingsThrough({ [name]: pair[0] }).forEach(settings => {
      assert.equal(settings[name], pair[1], name + ' with ' + pair[0]);
    });
  });

  [undefined, null, '', 'abc', String(min + 1), NaN, Infinity, -Infinity, true, false, [min + 1], {}].forEach(value => {
    settingsThrough({ [name]: value }).forEach(settings => {
      assert.equal(settings[name], fallback, name + ' with ' + String(value));
    });
  });
}

test('seconds per page is a number from 8 to 120, and anything else is moved into range or becomes 20', () => {
  checkRange('pageSeconds', 8, 120, 20, [9, 20, 45, 119]);
});

// seconds between plays: 0 is never and stays 0, a number from just above 0 up to
// the shortest is brought up to the shortest, a number above the largest comes
// down to it, and anything that is not a finite number becomes the default
function checkEvery(read, shortest, max, fallback, inside) {
  inside.concat([0, shortest, max]).forEach(value => {
    read(value).forEach(result => assert.equal(result, value, String(value)));
  });

  [[1, shortest], [shortest - 1, shortest], [0.5, shortest], [-1, 0], [-1e9, 0], [max + 1, max], [1e9, max]].forEach(pair => {
    read(pair[0]).forEach(result => assert.equal(result, pair[1], 'with ' + pair[0]));
  });

  [undefined, null, '', 'abc', String(shortest + 1), NaN, Infinity, -Infinity, true, false, [shortest + 1], {}].forEach(value => {
    read(value).forEach(result => assert.equal(result, fallback, 'with ' + String(value)));
  });
}

test('the name effect every so many seconds is 0 (never) or 30 to 900, and anything else is moved into range or becomes 300', () => {
  checkEvery(value => settingsThrough({ nameEvery: value }).map(settings => settings.nameEvery), 30, 900, 300, [31, 300, 600, 899]);
});

test('the name effect duration is a number from 0.5 to 10 seconds, decimals allowed, and anything else is moved into range or becomes 1.43', () => {
  checkRange('nameDuration', 0.5, 10, 1.43, [0.51, 1.43, 2.5, 9.99]);
});

function glitchThrough(glitch) {
  return settingsThrough({ crt: glitch }).map(settings => settings.crt);
}

test('the screen glitch is on, seconds between glitches and seconds one lasts, and each missing part is the default', () => {
  const defaults = { on: true, everySeconds: 240, durationSeconds: 2.7 };

  glitchThrough({ on: false, everySeconds: 90, durationSeconds: 4 }).forEach(glitch => {
    assert.deepEqual(glitch, { on: false, everySeconds: 90, durationSeconds: 4 });
  });
  glitchThrough({ on: false }).forEach(glitch => assert.deepEqual(glitch, Object.assign({}, defaults, { on: false })));
  glitchThrough({ everySeconds: 600 }).forEach(glitch => assert.deepEqual(glitch, Object.assign({}, defaults, { everySeconds: 600 })));
  glitchThrough({}).forEach(glitch => assert.deepEqual(glitch, defaults));

  [undefined, null, '', 'on', 5, true, [1, 2], () => 1].forEach(value => {
    glitchThrough(value).forEach(glitch => assert.deepEqual(glitch, defaults, String(value)));
  });
  [undefined, null, '', 'false', 'off', 0, 1, [], {}].forEach(value => {
    glitchThrough({ on: value }).forEach(glitch => assert.equal(glitch.on, true, JSON.stringify(value)));
  });
});

test('the seconds between glitches are 0 (never) or 30 to 3600, and anything else is moved into range or becomes 240', () => {
  checkEvery(value => glitchThrough({ everySeconds: value }).map(glitch => glitch.everySeconds), 30, 3600, 240, [31, 240, 1000, 3599]);
});

test('the glitch duration is a number from 0.5 to 10 seconds, decimals allowed, and anything else is moved into range or becomes 2.7', () => {
  const min = 0.5;
  const max = 10;

  [0.51, 1, 2.7, 9.99, min, max].forEach(value => {
    glitchThrough({ durationSeconds: value }).forEach(glitch => assert.equal(glitch.durationSeconds, value, String(value)));
  });
  [[0.4, min], [0, min], [-3, min], [10.5, max], [1e9, max]].forEach(pair => {
    glitchThrough({ durationSeconds: pair[0] }).forEach(glitch => assert.equal(glitch.durationSeconds, pair[1], 'with ' + pair[0]));
  });
  [undefined, null, '', 'abc', '2', NaN, Infinity, -Infinity, true, [2], {}].forEach(value => {
    glitchThrough({ durationSeconds: value }).forEach(glitch => assert.equal(glitch.durationSeconds, 2.7, 'with ' + String(value)));
  });
});

test('a published glitch with only everyMinutes becomes seconds, so nothing published breaks', () => {
  [[4, 240], [1, 60], [10, 600], [60, 3600], [0, 0], [90, 3600], [0.2, 30], [2.5, 150]].forEach(pair => {
    glitchThrough({ on: true, everyMinutes: pair[0] }).forEach(glitch => {
      assert.deepEqual(glitch, { on: true, everySeconds: pair[1], durationSeconds: 2.7 }, pair[0] + ' minutes');
      assert.equal('everyMinutes' in glitch, false);
    });
  });

  // everySeconds wins when both are there, and an unusable everyMinutes is the default
  glitchThrough({ everySeconds: 90, everyMinutes: 4 }).forEach(glitch => assert.equal(glitch.everySeconds, 90));
  glitchThrough({ everySeconds: 0, everyMinutes: 4 }).forEach(glitch => assert.equal(glitch.everySeconds, 0));
  ['4', null, NaN, {}, [4]].forEach(value => {
    glitchThrough({ everyMinutes: value }).forEach(glitch => assert.equal(glitch.everySeconds, 240, String(value)));
  });

  // a copy saved on the screen's own computer by an older version of the page is read the same way
  const cached = withDefaults({ settings: { crt: { on: false, everyMinutes: 6 } } }).settings.crt;
  assert.deepEqual(cached, { on: false, everySeconds: 360, durationSeconds: 2.7 });
});

test('a row can leave seconds empty to follow seconds per page, and a good number is kept', () => {
  const result = {
    settings: {
      pageSeconds: 40,
      rotation: {
        grid1: [{ panel: 'tasks' }, { panel: 'events', show: true, seconds: 25 }, { panel: 'photo', show: false, seconds: null }, { panel: 'tonight', seconds: '' }],
        grid2: [{ panel: 'forecast', seconds: 6 }, { panel: 'next-event' }],
        tickerSeconds: 45,
      },
    },
  };

  [normalizeContent(result), normalizeSample(result)].forEach(content => {
    const rotation = content.settings.rotation;
    assert.equal(content.settings.pageSeconds, 40);
    assert.deepEqual(rotation.grid1, [
      { panel: 'tasks', show: true },
      { panel: 'events', show: true, seconds: 25 },
      { panel: 'photo', show: false },
      { panel: 'tonight', show: true },
    ]);
    assert.deepEqual(rotation.grid2, [{ panel: 'forecast', show: true, seconds: 6 }, { panel: 'next-event', show: true }]);
    assert.equal(rotation.tickerSeconds, 45);
  });

  // with no ticker seconds of its own the ticker follows seconds per page
  const noTicker = normalizeContent({ settings: { rotation: { grid1: [{ panel: 'tasks' }] } } });
  assert.equal('tickerSeconds' in noTicker.settings.rotation, false);
  assert.equal(noTicker.settings.rotation.tickerSeconds, undefined);

  // a fraction of a second is a number, so it is kept
  assert.equal(normalizeContent({ settings: { rotation: { tickerSeconds: 7.5 } } }).settings.rotation.tickerSeconds, 7.5);
});

// The Theme document. The rules for which theme applies are in tools/test-themes.mjs.

test('the query asks for the Theme document by its id, and the answer is cleaned into content.theme', () => {
  assert.ok(contentQuery.includes('"theme": *[_id == "theme"][0]'));

  const defaults = live.config.defaultThemeSettings;
  const rule = { _key: 'r1', name: '[Rule]', kind: 'overlay', overlay: 'example', startDate: '2025-12-20', endDate: '2026-01-05', repeatsEveryYear: true };
  const stored = document('theme', 'theme', {
    defaultTheme: 'alternate',
    useNow: { theme: null, overlay: 'none', until: '2026-12-15T17:00:00.000Z' },
    schedule: [rule],
    timeZone: 'America/Chicago',
  });

  const theme = normalizeContent({ theme: stored }).theme;
  assert.equal(theme.defaultTheme, 'alternate');
  assert.deepEqual(theme.useNow, { theme: '', overlay: 'none', until: '2026-12-15T17:00:00.000Z' });
  assert.equal(theme.schedule.length, 1);
  assert.equal(theme.schedule[0].overlay, 'example');
  assert.equal(theme.timeZone, 'America/Chicago');
  assert.deepEqual(Object.keys(theme).sort(), Object.keys(defaults).sort(), 'only the four settings come through, not _id and the rest');
});

test('a missing Theme document, or fields missing from it, are the defaults', () => {
  const defaults = live.config.defaultThemeSettings;

  assert.deepEqual(normalizeContent({}).theme, defaults);
  assert.deepEqual(normalizeContent({ theme: null }).theme, defaults);
  assert.deepEqual(normalizeContent({ theme: 'oops' }).theme, defaults);
  assert.deepEqual(withDefaults({}).theme, defaults);
  assert.deepEqual(withDefaults(null).theme, defaults);
  assert.deepEqual(normalizeContent({ theme: document('theme', 'theme', { timeZone: 'America/Chicago' }) }).theme, Object.assign({}, defaults, { timeZone: 'America/Chicago' }));

  // a theme id the dashboard does not have, and a time zone Intl does not know, fall back
  const odd = normalizeContent({ theme: document('theme', 'theme', { defaultTheme: 'no-such-theme', timeZone: 'Nowhere/Land', useNow: { theme: 'no-such-theme' } }) }).theme;
  assert.deepEqual(odd, defaults);
});

test('a saved copy from before the Theme document existed still gives a theme', async () => {
  await inWorld(async world => {
    saveCopy(world, { settings: document('dashboardSettings', 'dashboardSettings', { motion: 'calm' }) }, world.now - minute);
    world.handler = () => unreachable();
    const first = await readSanity(() => {});
    assert.deepEqual(first.content.theme, live.config.defaultThemeSettings);
    assert.equal(first.content.settings.motion, 'calm');
  });
});

test('the sample content has a Theme document with the defaults, and it comes through unchanged', () => {
  const file = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  assert.deepEqual(file.theme, live.config.defaultThemeSettings);
  assert.deepEqual(normalizeSample(file).theme, live.config.defaultThemeSettings);
  assert.deepEqual(withDefaults(file).theme, live.config.defaultThemeSettings);
});

test('the sample content file carries the new settings and they come through unchanged', () => {
  const file = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  const settings = normalizeSample(file).settings;

  ['frameMetal', 'glint', 'pageSeconds', 'nameTransform', 'nameEvery', 'nameDuration', 'crt', 'contentSource', 'switchBackAt'].forEach(name => {
    assert.ok(name in file.settings, 'the sample content has no ' + name);
    assert.deepEqual(settings[name], file.settings[name], name);
  });
});

test('sample mode reads the sample file and reads it again every 30 seconds', async () => {
  await inWorld(async world => {
    const file = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
    world.handler = async () => jsonResponse(copyOf(file));

    const first = await readSample(world.onChange);
    assert.deepEqual(first.content, normalizeSample(file));
    assert.deepEqual(first.status, { source: 'sample', updated: null, offline: false });
    assert.equal(world.fetches[0].url, 'data/sample/content.json');
    assert.equal(world.streams.length, 0);
    assert.equal(world.storage.size, 0);

    await world.advance(30 * second);
    assert.equal(world.fetches.length, 2);
    assert.equal(world.changes.length, 0);

    file.tasks[0].title = '[Edited task]';
    await world.advance(30 * second);
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].content.tasks[0].title, '[Edited task]');
    assert.equal(world.changes[0].status.source, 'sample');

    await world.advance(30 * second);
    assert.equal(world.changes.length, 1);
    assert.equal(world.errors.length, 0);

    world.handler = unreachable;
    await world.advance(30 * second);
    assert.equal(world.changes.length, 2);
    assert.equal(world.changes[1].status.offline, true);
    assert.equal(world.changes[1].content.tasks[0].title, '[Edited task]');
    assert.equal(world.errors.length, 1);

    await world.advance(30 * second);
    assert.equal(world.changes.length, 2);

    world.handler = async () => jsonResponse(copyOf(file));
    await world.advance(30 * second);
    assert.equal(world.changes.length, 3);
    assert.equal(world.changes[2].status.offline, false);
  });
});

test('sample content is cleaned the same way as content from Sanity', async () => {
  const settings = {
    rotation: { grid1: [{ panel: 'tasks', seconds: 0 }, { seconds: 9 }], grid2: null, tickerSeconds: -1 },
    announcements: [{ time: '14:30', title: '[Title]', days: [1], show: false }, { title: 'No time' }],
    calendars: [{ id: 'team', name: '[Team]' }, { name: 'No id' }],
  };
  const fromSanity = normalizeContent({ settings: settings });
  assert.deepEqual(normalizeSample({ settings: settings }).settings, fromSanity.settings);
  assert.equal('tickerSeconds' in fromSanity.settings.rotation, false);

  await inWorld(async world => {
    const file = {
      settings: settings,
      tasks: [null, { title: '[Second]', order: 2 }, 7, { title: '[First]', order: 1 }],
      tipsAndNews: [null, { kind: 'tip', text: '[A tip]', logoAddress: '' }, 'text'],
      sponsors: 'not a list',
      subteams: { name: '[One]' },
      customPanels: [null, { title: '[Panel]', blocks: [null, { type: 'text', text: '[Text]' }] }],
      plan: { heading: '[Plan]', date: '', rows: [null, { time: '[6 PM]', text: '[Do it]' }] },
    };
    world.handler = async () => jsonResponse(copyOf(file));

    const first = await readSample(world.onChange);
    const content = first.content;
    assert.deepEqual(content.tasks.map(task => task.title), ['[First]', '[Second]']);
    assert.deepEqual(content.tipsAndNews, [{ kind: 'tip', text: '[A tip]' }]);
    assert.deepEqual(content.sponsors, []);
    assert.deepEqual(content.subteams, []);
    assert.deepEqual(content.customPanels, [{ title: '[Panel]', blocks: [{ type: 'text', text: '[Text]' }] }]);
    assert.deepEqual(content.plan, { heading: '[Plan]', rows: [{ time: '[6 PM]', text: '[Do it]' }] });
    assert.deepEqual(content.settings.rotation.grid1, [{ panel: 'tasks', show: true }]);
    assert.deepEqual(content.settings.rotation.grid2, live.config.defaultSettings.rotation.grid2);
    assert.equal('tickerSeconds' in content.settings.rotation, false);
    assert.deepEqual(content.settings.announcements, []);
    assert.deepEqual(content.settings.calendars, [{ id: 'team', name: '[Team]' }]);
    assert.equal(world.errors.length, 0);
  });
});

test('sample content that is not an object gives empty content and does not stop the screen', () => {
  [null, undefined, 'text', 42, [], [{ tasks: [] }]].forEach(raw => {
    assert.deepEqual(normalizeSample(raw), withDefaults({}), JSON.stringify(raw));
  });
});

test('sample mode starts with empty content when the file cannot be read', async () => {
  await inWorld(async world => {
    world.handler = async () => jsonResponse({}, 404);

    const first = await readSample(world.onChange);
    assert.deepEqual(first.content, withDefaults({}));
    assert.deepEqual(first.status, { source: 'sample', updated: null, offline: true });
    assert.equal(world.errors.length, 1);
  });
});

test('the content source settings have their defaults, and the old static constants are gone', () => {
  assert.deepEqual(live.config.contentSources, ['production', 'sample']);
  assert.equal(live.config.defaultSettings.contentSource, 'production');
  assert.equal(live.config.defaultSettings.switchBackAt, '');
  assert.equal(typeof live.config.useSampleContent, 'boolean');
  assert.equal('sampleMode' in live.config, false);
  assert.equal('dataFolder' in live.config, false);
  assert.equal(live.config.sampleFolder, 'data/sample/');
  assert.equal(live.config.liveFolder, 'data/live/');
  assert.notEqual(live.config.sanity.projectId, '');

  const empty = withDefaults({}).settings;
  assert.equal(empty.contentSource, 'production');
  assert.equal(empty.switchBackAt, '');
});

test('contentSource is production or sample and anything else becomes production, and switchBackAt is text', () => {
  live.config.contentSources.forEach(name => {
    settingsThrough({ contentSource: name }).forEach(settings => assert.equal(settings.contentSource, name));
  });

  [undefined, null, '', 'Sample', 'SAMPLE', 'demo', 'toString', 0, true, ['sample'], {}].forEach(value => {
    settingsThrough({ contentSource: value }).forEach(settings => {
      assert.equal(settings.contentSource, 'production', JSON.stringify(value));
    });
  });

  settingsThrough({ switchBackAt: '2027-01-09T17:00:00.000Z' }).forEach(settings => {
    assert.equal(settings.switchBackAt, '2027-01-09T17:00:00.000Z');
  });
  [undefined, null, '', 5, true, ['2027-01-09'], {}].forEach(value => {
    settingsThrough({ switchBackAt: value }).forEach(settings => assert.equal(settings.switchBackAt, '', JSON.stringify(value)));
  });
});

test('the settings query asks for only contentSource and switchBackAt, from the published settings', () => {
  assert.ok(sourceQuery.includes('_id == "dashboardSettings"'));
  assert.ok(sourceQuery.includes('contentSource'));
  assert.ok(sourceQuery.includes('switchBackAt'));
  assert.ok(sourceQuery.length < 100);
  assert.notEqual(sourceQuery, contentQuery);

  const address = sourceQueryUrl(live.config.sanity);
  assert.ok(address.startsWith('https://' + live.config.sanity.projectId + '.api.sanity.io/v2025-02-19/data/query/production?'));
  assert.ok(address.includes('query=' + encodeURIComponent(sourceQuery)));
  assert.ok(address.endsWith('&perspective=published'));
  assert.notEqual(address, queryUrl(live.config.sanity));
});

test('pickSource: sample until the switch back time, and anything unclear is production', () => {
  const now = new Date(start);
  const earlier = new Date(start - minute).toISOString();
  const later = new Date(start + minute).toISOString();

  assert.equal(pickSource({ contentSource: 'production' }, now), 'production');
  assert.equal(pickSource({ contentSource: 'sample' }, now), 'sample');
  assert.equal(pickSource({ contentSource: 'sample', switchBackAt: '' }, now), 'sample');
  assert.equal(pickSource({ contentSource: 'sample', switchBackAt: later }, now), 'sample');
  assert.equal(pickSource({ contentSource: 'sample', switchBackAt: earlier }, now), 'production');
  assert.equal(pickSource({ contentSource: 'sample', switchBackAt: new Date(start).toISOString() }, now), 'production');
  assert.equal(pickSource({ contentSource: 'production', switchBackAt: later }, now), 'production');

  // a time that cannot be read is ignored, so the sample stays on
  assert.equal(pickSource({ contentSource: 'sample', switchBackAt: 'next week' }, now), 'sample');

  // an editor-typed time with no zone is read on this computer's clock
  const localLater = new Date(start + 3600 * 1000);
  const typed = localLater.getFullYear() + '-' + String(localLater.getMonth() + 1).padStart(2, '0') + '-' + String(localLater.getDate()).padStart(2, '0') +
    'T' + String(localLater.getHours()).padStart(2, '0') + ':' + String(localLater.getMinutes()).padStart(2, '0');
  assert.equal(pickSource({ contentSource: 'sample', switchBackAt: typed }, now), 'sample');

  [null, undefined, {}, 'sample', 7, [], { contentSource: 'Sample' }, { contentSource: 'toString' }].forEach(value => {
    assert.equal(pickSource(value, now), 'production', JSON.stringify(value));
  });
  assert.deepEqual(tidySourceSettings(null), { contentSource: 'production', switchBackAt: '' });
  assert.deepEqual(tidySourceSettings({ contentSource: 'sample', switchBackAt: later, extra: 1 }), { contentSource: 'sample', switchBackAt: later });
});

test('fetchSourceSettings: no settings document is a good answer, anything else unusable is an error, and 5 seconds is the limit', async () => {
  await inWorld(async world => {
    world.handler = async () => sanityReply({ contentSource: 'sample', switchBackAt: '2027-01-09T17:00:00.000Z' });
    assert.deepEqual(await fetchSourceSettings(live.config.sanity), { contentSource: 'sample', switchBackAt: '2027-01-09T17:00:00.000Z' });
    assert.equal(world.fetches[0].url, sourceQueryUrl(live.config.sanity));
    assert.equal(world.fetches[0].options.headers, undefined);

    world.handler = async () => sanityReply(null);
    assert.deepEqual(await fetchSourceSettings(live.config.sanity), {});
    world.handler = async () => sanityReply({});
    assert.deepEqual(await fetchSourceSettings(live.config.sanity), {});

    const bad = {
      'an error status': () => jsonResponse({ error: 'no' }, 500),
      'a missing page': () => jsonResponse({}, 404),
      'no result': () => jsonResponse({ ms: 1 }),
      'a list': () => sanityReply([]),
      'text': () => sanityReply('sample'),
      'a body that is not an object': () => jsonResponse(null),
      'text instead of JSON': () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token'); } }),
      'no connection': () => unreachable(),
    };
    for (const name of Object.keys(bad)) {
      world.handler = async () => bad[name]();
      await assert.rejects(fetchSourceSettings(live.config.sanity), name);
    }
  });

  await inWorld(async world => {
    world.handler = (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('The request was aborted')));
    });
    let outcome = 'waiting';
    fetchSourceSettings(live.config.sanity).then(() => { outcome = 'answered'; }, () => { outcome = 'gave up'; });

    await world.advance(5 * second - 1);
    assert.equal(outcome, 'waiting');
    await world.advance(1);
    assert.equal(outcome, 'gave up');
  });
});

// A fake Sanity and a fake web server for startContent. world.server says what
// each answers, and a test can change it while the screen runs.
//   settings: the Dashboard Settings answer. An object, null (no settings
//             document), or one of the strings in answerSettings.
function serve(world, server) {
  world.server = Object.assign({ settings: {}, content: sanityFixture(), file: JSON.parse(fs.readFileSync(sampleFile, 'utf8')) }, server);

  world.handler = async url => {
    if (url === sourceQueryUrl(live.config.sanity)) return answerSettings(world.server.settings);
    if (url === queryUrl(live.config.sanity)) return sanityReply(copyOf(world.server.content));
    if (url === 'data/sample/content.json') return jsonResponse(copyOf(world.server.file));
    throw new Error('The test did not expect a request for ' + url);
  };
}

function answerSettings(settings) {
  if (settings === 'unreachable') return unreachable();
  if (settings === 'error status') return jsonResponse({ error: 'no' }, 500);
  if (settings === 'no result') return jsonResponse({ ms: 1 });
  return sanityReply(copyOf(settings));
}

function requestsFor(world, url) {
  return world.fetches.filter(request => request.url === url).length;
}

function contentQueries(world) {
  return requestsFor(world, queryUrl(live.config.sanity));
}

function settingsQueries(world) {
  return requestsFor(world, sourceQueryUrl(live.config.sanity));
}

function sampleReads(world) {
  return requestsFor(world, 'data/sample/content.json');
}

function sourcesOf(world) {
  return world.changes.map(change => change.status.source);
}

function saveSource(world, settings, savedAt) {
  world.storage.set(sourceKey, JSON.stringify({ savedAt: savedAt, settings: settings }));
}

function savedSource(world) {
  return JSON.parse(world.storage.get(sourceKey)).settings;
}

test('source: production settings read the settings first, then run the whole Sanity reader', async () => {
  const answers = [
    { contentSource: 'production' },
    { contentSource: 'production', switchBackAt: '2099-01-01T00:00:00.000Z' },
    {},
    null,
    { contentSource: 'Sample' },
  ];

  for (const settings of answers) {
    await inWorld(async world => {
      serve(world, { settings: settings });

      const first = await startContent(world.onChange);
      const label = JSON.stringify(settings);
      assert.equal(first.status.source, 'sanity', label);
      assert.deepEqual(first.content, normalizeContent(world.server.content), label);

      // the settings come first, then the full query, and the stream is open
      assert.deepEqual(world.fetches.map(request => request.url), [sourceQueryUrl(live.config.sanity), queryUrl(live.config.sanity)], label);
      assert.equal(world.streams.length, 1, label);
      assert.equal(sampleReads(world), 0, label);
      assert.deepEqual(savedSource(world), tidySourceSettings(settings), label);
      assert.ok(world.storage.has(storageKey), label);
      assert.equal(world.errors.length, 0, label);
    });
  }
});

test('source: sample settings load only the sample content, with no other content request', async () => {
  await inWorld(async world => {
    serve(world, { settings: { contentSource: 'sample' } });

    const first = await startContent(world.onChange);
    assert.deepEqual(first.content, normalizeSample(world.server.file));
    assert.deepEqual(first.status, { source: 'sample', updated: null, offline: false });
    assert.deepEqual(world.fetches.map(request => request.url), [sourceQueryUrl(live.config.sanity), 'data/sample/content.json']);
    assert.equal(contentQueries(world), 0);
    assert.equal(world.streams.length, 0);
    assert.equal(world.storage.has(storageKey), false);
    assert.deepEqual(savedSource(world), { contentSource: 'sample', switchBackAt: '' });

    // five minutes later: still no content query and no stream. Only the
    // settings and the sample file are read.
    await world.advance(5 * minute);
    assert.equal(contentQueries(world), 0);
    assert.equal(world.streams.length, 0);
    world.fetches.forEach(request => {
      assert.ok([sourceQueryUrl(live.config.sanity), 'data/sample/content.json'].includes(request.url), request.url);
    });
    assert.equal(world.errors.length, 0);
  });
});

test('source: sample content is edited in data/sample and shows within 30 seconds', async () => {
  await inWorld(async world => {
    serve(world, { settings: { contentSource: 'sample' } });
    await startContent(world.onChange);

    world.server.file.tasks[0].title = '[Edited task]';
    await world.advance(30 * second);
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].status.source, 'sample');
    assert.equal(world.changes[0].content.tasks[0].title, '[Edited task]');
  });
});

test('source: sample with a switch back time that has passed behaves as production', async () => {
  const passed = [new Date(start - minute).toISOString(), new Date(start).toISOString(), '2020-01-01T00:00:00.000Z'];

  for (const switchBackAt of passed) {
    await inWorld(async world => {
      serve(world, { settings: { contentSource: 'sample', switchBackAt: switchBackAt } });

      const first = await startContent(world.onChange);
      assert.equal(first.status.source, 'sanity', switchBackAt);
      assert.equal(contentQueries(world), 1, switchBackAt);
      assert.equal(sampleReads(world), 0, switchBackAt);
      assert.equal(world.streams.length, 1, switchBackAt);
    });
  }

  // a time still to come keeps the sample
  await inWorld(async world => {
    serve(world, { settings: { contentSource: 'sample', switchBackAt: new Date(start + minute).toISOString() } });
    const first = await startContent(world.onChange);
    assert.equal(first.status.source, 'sample');
    assert.equal(contentQueries(world), 0);
  });
});

test('source: settings that cannot be read use the saved settings, whatever the fallback flag says', async () => {
  const failures = ['unreachable', 'error status', 'no result'];

  for (const failure of failures) {
    for (const copy of [live, flagOn]) {
      const flag = copy.config.useSampleContent;

      // saved: sample, so sample, even with the flag off
      await inWorld(async world => {
        saveSource(world, { contentSource: 'sample', switchBackAt: '' }, start - 10 * minute);
        serve(world, { settings: failure });

        const first = await copy.content.startContent(world.onChange);
        assert.equal(first.status.source, 'sample', failure + ' flag ' + flag);
        assert.equal(contentQueries(world), 0, failure + ' flag ' + flag);
        assert.equal(world.streams.length, 0, failure + ' flag ' + flag);
        assert.equal(world.errors.length, 1, failure + ' flag ' + flag);
        assert.deepEqual(savedSource(world), { contentSource: 'sample', switchBackAt: '' }, 'a failed read does not change the saved settings');
      });

      // saved: production, so production, even with the flag on
      await inWorld(async world => {
        saveSource(world, { contentSource: 'production', switchBackAt: '' }, start - 10 * minute);
        serve(world, { settings: failure });
        world.handler = (inner => async url => {
          if (url === sourceQueryUrl(live.config.sanity)) return answerSettings(failure);
          return inner(url);
        })(world.handler);

        const first = await copy.content.startContent(world.onChange);
        assert.equal(first.status.source, 'sanity', failure + ' flag ' + flag);
        assert.equal(sampleReads(world), 0, failure + ' flag ' + flag);
      });

      // saved: sample until a time that has passed, so production
      await inWorld(async world => {
        saveSource(world, { contentSource: 'sample', switchBackAt: new Date(start - minute).toISOString() }, start - 10 * minute);
        serve(world, { settings: failure });

        const first = await copy.content.startContent(world.onChange);
        assert.equal(first.status.source, 'sanity', failure + ' flag ' + flag);
      });
    }
  }
});

test('source: a settings read that hangs is given up after 5 seconds and the saved settings are used', async () => {
  await inWorld(async world => {
    saveSource(world, { contentSource: 'sample', switchBackAt: '' }, start - minute);
    serve(world, {});
    const inner = world.handler;
    world.handler = (url, options) => {
      if (url !== sourceQueryUrl(live.config.sanity)) return inner(url, options);
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('The request was aborted')));
      });
    };

    let first = null;
    startContent(world.onChange).then(state => { first = state; });
    await world.advance(5 * second - 1);
    assert.equal(first, null);

    await world.advance(1);
    assert.equal(first.status.source, 'sample');
    assert.equal(world.errors.length, 1);
  });
});

test('source: settings that cannot be read and nothing saved use the useSampleContent flag, both ways', async () => {
  const failures = ['unreachable', 'error status', 'no result'];

  for (const failure of failures) {
    await inWorld(async world => {
      serve(world, { settings: failure });
      const first = await flagOn.content.startContent(world.onChange);
      assert.equal(first.status.source, 'sample', failure);
      assert.equal(contentQueries(world), 0, failure);
      assert.equal(world.storage.has(sourceKey), false, 'nothing was read, so nothing is saved');
    });

    await inWorld(async world => {
      serve(world, { settings: failure });
      const first = await live.content.startContent(world.onChange);
      assert.equal(first.status.source, 'sanity', failure);
      assert.equal(contentQueries(world), 1, failure);
      assert.equal(sampleReads(world), 0, failure);
    });
  }

  // saved settings that cannot be used are the same as having none
  const unusable = ['not json', '', 'null', '7', '{}', '{ "savedAt": 1 }', '{ "savedAt": 1, "settings": "sample" }', '{ "savedAt": 1, "settings": {} }'];
  for (const text of unusable) {
    await inWorld(async world => {
      world.storage.set(sourceKey, text);
      serve(world, { settings: 'unreachable' });
      assert.equal((await flagOn.content.startContent(world.onChange)).status.source, 'sample', 'saved text: ' + text);
    });
    await inWorld(async world => {
      world.storage.set(sourceKey, text);
      serve(world, { settings: 'unreachable' });
      assert.equal((await live.content.startContent(world.onChange)).status.source, 'sanity', 'saved text: ' + text);
    });
  }
});

test('source: a good answer wins over the saved settings and the flag, and no settings document means production', async () => {
  // saved says sample and the flag says sample, Sanity says production
  await inWorld(async world => {
    saveSource(world, { contentSource: 'sample', switchBackAt: '' }, start - minute);
    serve(world, { settings: { contentSource: 'production' } });
    assert.equal((await flagOn.content.startContent(world.onChange)).status.source, 'sanity');
    assert.deepEqual(savedSource(world), { contentSource: 'production', switchBackAt: '' });
  });

  // Sanity answers that there is no settings document: production, even with the flag on
  await inWorld(async world => {
    saveSource(world, { contentSource: 'sample', switchBackAt: '' }, start - minute);
    serve(world, { settings: null });
    const first = await flagOn.content.startContent(world.onChange);
    assert.equal(first.status.source, 'sanity');
    assert.equal(sampleReads(world), 0);
    assert.equal(world.errors.length, 0);
  });

  // saved says production, Sanity says sample
  await inWorld(async world => {
    saveSource(world, { contentSource: 'production', switchBackAt: '' }, start - minute);
    serve(world, { settings: { contentSource: 'sample' } });
    assert.equal((await live.content.startContent(world.onChange)).status.source, 'sample');
  });
});

test('source: blocked storage does not stop the screen choosing', async () => {
  await inWorld(async world => {
    world.storageBroken = true;
    serve(world, { settings: { contentSource: 'sample' } });

    const first = await startContent(world.onChange);
    assert.equal(first.status.source, 'sample');
    assert.ok(world.errors.length >= 1);
  });
});

test('source: an empty project ID always shows the sample and asks Sanity for nothing', async () => {
  await inWorld(async world => {
    serve(world, { settings: { contentSource: 'production' } });
    saveSource(world, { contentSource: 'production', switchBackAt: '' }, start - minute);

    const first = await noProject.content.startContent(world.onChange);
    assert.equal(first.status.source, 'sample');
    await world.advance(10 * minute);
    assert.deepEqual([...new Set(world.fetches.map(request => request.url))], ['data/sample/content.json']);
    assert.equal(world.streams.length, 0);
  });
});

test('source: the settings are read again every 30 seconds, in production and in sample', async () => {
  await inWorld(async world => {
    serve(world, { settings: { contentSource: 'sample' } });
    await startContent(world.onChange);
    assert.equal(settingsQueries(world), 1);

    await world.advance(30 * second - 1);
    assert.equal(settingsQueries(world), 1);
    await world.advance(1);
    assert.equal(settingsQueries(world), 2);
    await world.advance(60 * second);
    assert.equal(settingsQueries(world), 4);
    assert.equal(world.changes.length, 0);
  });

  await inWorld(async world => {
    serve(world, { settings: {} });
    await startContent(world.onChange);
    await world.advance(90 * second);
    assert.equal(settingsQueries(world), 4);
    assert.equal(world.changes.length, 0);
  });
});

test('source: "Use sample content" and "Use production content" take effect without a reload, in both directions', async () => {
  await inWorld(async world => {
    serve(world, { settings: { contentSource: 'production' } });
    const first = await startContent(world.onChange);
    assert.equal(first.status.source, 'sanity');
    const productionStream = world.streams[0];

    // someone presses "Use sample content"
    world.server.settings = { contentSource: 'sample' };
    await world.advance(30 * second);
    assert.deepEqual(sourcesOf(world), ['sample']);
    assert.deepEqual(world.changes[0].content, normalizeSample(world.server.file));
    assert.equal(world.changes[0].status.offline, false);
    assert.equal(productionStream.readyState, 2, 'the live stream is closed');
    assert.deepEqual(savedSource(world), { contentSource: 'sample', switchBackAt: '' });

    // from now on no content query and no stream, however long it runs
    const queriesBefore = contentQueries(world);
    await world.advance(15 * minute);
    assert.equal(contentQueries(world), queriesBefore);
    assert.equal(world.streams.length, 1);
    assert.equal(world.changes.length, 1);
    assert.ok(sampleReads(world) > 10);

    // someone presses "Use production content". The saved copy shows at
    // once, and Sanity replaces it.
    world.server.content.tasks[0].title = '[Task from production]';
    world.server.settings = { contentSource: 'production' };
    await world.advance(30 * second);
    assert.deepEqual(sourcesOf(world), ['sample', 'cache', 'sanity']);
    assert.equal(world.changes[2].content.tasks.some(task => task.title === '[Task from production]'), true);
    assert.equal(world.changes[2].status.offline, false);
    assert.equal(world.streams.length, 2, 'the live stream is open again');

    // and the sample reader stopped: its file is not read any more
    const readsBefore = sampleReads(world);
    await world.advance(5 * minute);
    assert.equal(sampleReads(world), readsBefore);
    assert.equal(world.errors.length, 0);

    // sample again, and a repeated answer causes no further change
    world.server.settings = { contentSource: 'sample' };
    await world.advance(30 * second);
    await world.advance(5 * minute);
    assert.deepEqual(sourcesOf(world), ['sample', 'cache', 'sanity', 'sample']);
  });
});

test('source: from sample to production with nothing saved reads Sanity first, then shows it', async () => {
  await inWorld(async world => {
    serve(world, { settings: { contentSource: 'sample' } });
    await startContent(world.onChange);

    world.server.settings = {};
    await world.advance(30 * second);
    assert.deepEqual(sourcesOf(world), ['sanity']);
    assert.deepEqual(world.changes[0].content, normalizeContent(world.server.content));
    assert.equal(world.streams.length, 1);
    assert.equal(contentQueries(world), 1);

    const readsBefore = sampleReads(world);
    await world.advance(5 * minute);
    assert.equal(sampleReads(world), readsBefore);
  });
});

test('source: the switch back time arriving moves the screen to production without a reload', async () => {
  await inWorld(async world => {
    // 100 seconds is not a moment when the settings are read (every 30 seconds)
    // so this is the clock being looked at (every 5 seconds)
    const switchBackAt = new Date(start + 100 * second).toISOString();
    serve(world, { settings: { contentSource: 'sample', switchBackAt: switchBackAt } });

    const first = await startContent(world.onChange);
    assert.equal(first.status.source, 'sample');

    await world.advance(100 * second - 1);
    assert.equal(world.changes.length, 0);
    assert.equal(contentQueries(world), 0);

    await world.advance(1);
    assert.deepEqual(sourcesOf(world), ['sanity']);
    assert.equal(contentQueries(world), 1);
    assert.equal(world.streams.length, 1);

    // and it stays on production, though the settings still say sample
    await world.advance(10 * minute);
    assert.deepEqual(sourcesOf(world), ['sanity']);
  });
});

test('source: a read of the settings that fails keeps the screen on what it has, and a later good read still switches', async () => {
  await inWorld(async world => {
    serve(world, { settings: { contentSource: 'sample' } });
    await startContent(world.onChange);

    world.server.settings = 'unreachable';
    await world.advance(5 * minute);
    assert.equal(world.changes.length, 0);
    assert.equal(world.errors.length, 10);

    world.server.settings = 'error status';
    await world.advance(minute);
    assert.equal(world.changes.length, 0);

    world.server.settings = {};
    await world.advance(30 * second);
    assert.deepEqual(sourcesOf(world), ['sanity']);
  });
});

test('source: a screen that started on the flag moves to what Dashboard Settings say once they can be read', async () => {
  await inWorld(async world => {
    serve(world, { settings: 'unreachable' });
    const first = await flagOn.content.startContent(world.onChange);
    assert.equal(first.status.source, 'sample');

    // still unreadable: the flag keeps deciding
    await world.advance(5 * minute);
    assert.equal(world.changes.length, 0);

    world.server.settings = { contentSource: 'production' };
    await world.advance(30 * second);
    assert.deepEqual(sourcesOf(world), ['sanity']);
  });

  await inWorld(async world => {
    serve(world, { settings: 'unreachable' });
    const first = await live.content.startContent(world.onChange);
    assert.equal(first.status.source, 'sanity');

    world.server.settings = { contentSource: 'sample' };
    await world.advance(30 * second);
    assert.deepEqual(sourcesOf(world), ['sample']);
    assert.equal(contentQueries(world) , 1);
  });
});

test('source: production keeps its offline logic when it was switched to while running', async () => {
  await inWorld(async world => {
    serve(world, { settings: { contentSource: 'sample' } });
    await startContent(world.onChange);

    // Sanity goes down for the content, but the settings still answer
    const inner = world.handler;
    world.handler = async (url, options) => {
      if (url === queryUrl(live.config.sanity)) return unreachable();
      return inner(url, options);
    };
    world.server.settings = {};
    await world.advance(30 * second);
    assert.deepEqual(sourcesOf(world), ['sanity']);
    assert.equal(world.changes[0].status.offline, true);
    assert.deepEqual(world.changes[0].content, withDefaults({}));
  });
});

test('source: a switch that is overtaken by a newer one is dropped', async () => {
  await inWorld(async world => {
    serve(world, { settings: { contentSource: 'sample' } });
    await startContent(world.onChange);

    // production is chosen, but Sanity is slow to answer the content query
    const inner = world.handler;
    let release = null;
    world.handler = (url, options) => {
      if (url !== queryUrl(live.config.sanity)) return inner(url, options);
      return new Promise(resolve => {
        release = () => resolve(sanityReply(copyOf(world.server.content)));
      });
    };
    world.server.settings = {};
    await world.advance(30 * second);
    assert.equal(world.changes.length, 0);
    assert.equal(contentQueries(world), 1);

    // before it answers, the editors go back to the sample
    world.server.settings = { contentSource: 'sample' };
    await world.advance(30 * second);
    assert.deepEqual(sourcesOf(world), ['sample']);

    // the late answer from Sanity changes nothing, and nothing is left running for production
    release();
    await settle();
    await world.advance(15 * minute);
    assert.deepEqual(sourcesOf(world), ['sample']);
    assert.equal(contentQueries(world), 1);
    assert.equal(world.streams.length, 1);
    assert.equal(world.streams[0].readyState, 2);
  });
});

test('sanity: with no saved copy it waits for Sanity, saves the answer and listens for changes', async () => {
  await inWorld(async world => {
    const fixture = sanityFixture();
    world.handler = async () => sanityReply(fixture);

    const first = await readSanity(world.onChange);
    assert.deepEqual(first.content, normalizeContent(fixture));
    assert.equal(first.status.source, 'sanity');
    assert.equal(first.status.offline, false);
    assert.ok(first.status.updated instanceof Date);
    assert.equal(first.status.updated.getTime(), start);

    assert.equal(world.fetches.length, 1);
    assert.equal(world.fetches[0].url, queryUrl(live.config.sanity));
    assert.ok(world.fetches[0].url.startsWith('https://' + live.config.sanity.projectId + '.api.sanity.io/v2025-02-19/data/query/production?'));
    assert.equal(world.fetches[0].options.headers, undefined);
    assert.equal(world.streams.length, 1);
    assert.equal(world.streams[0].url, liveEventsUrl(live.config.sanity));

    assert.deepEqual(JSON.parse(world.storage.get(storageKey)), { savedAt: start, raw: fixture });
    assert.equal(world.changes.length, 0);
    assert.equal(world.errors.length, 0);
  });
});

test('sanity: reads again every 5 minutes, and identical content does not call onChange', async () => {
  await inWorld(async world => {
    const fixture = sanityFixture();
    world.handler = async () => sanityReply(copyOf(fixture));
    await readSanity(world.onChange);

    await world.advance(5 * minute - 1);
    assert.equal(world.fetches.length, 1);
    await world.advance(1);
    assert.equal(world.fetches.length, 2);
    await world.advance(5 * minute);
    assert.equal(world.fetches.length, 3);
    assert.equal(world.changes.length, 0);
    assert.equal(JSON.parse(world.storage.get(storageKey)).savedAt, start + 10 * minute);

    fixture.tasks[0].title = '[A changed task]';
    await world.advance(5 * minute);
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].content.tasks.some(task => task.title === '[A changed task]'), true);
    assert.equal(world.changes[0].status.updated.getTime(), start + 15 * minute);

    await world.advance(5 * minute);
    assert.equal(world.changes.length, 1);
  });
});

test('sanity: a saved copy starts the screen at once, then Sanity replaces it', async () => {
  await inWorld(async world => {
    const saved = sanityFixture();
    const newer = sanityFixture();
    newer.tasks[0].title = '[Newer task]';
    saveCopy(world, saved, start - 3 * minute);

    let release = null;
    world.handler = () => new Promise(resolve => {
      release = () => resolve(sanityReply(newer));
    });

    const first = await readSanity(world.onChange);
    assert.deepEqual(first.content, normalizeContent(saved));
    assert.equal(first.status.source, 'cache');
    assert.equal(first.status.offline, false);
    assert.equal(first.status.updated.getTime(), start - 3 * minute);
    assert.equal(world.fetches.length, 0);

    await world.advance(0);
    assert.equal(world.fetches.length, 1);
    assert.equal(world.changes.length, 0);

    release();
    await settle();
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].status.source, 'sanity');
    assert.equal(world.changes[0].status.offline, false);
    assert.equal(world.changes[0].content.tasks.some(task => task.title === '[Newer task]'), true);
    assert.deepEqual(JSON.parse(world.storage.get(storageKey)), { savedAt: start, raw: newer });
  });
});

test('sanity: a saved copy and no network shows the saved copy as offline, and tries again', async () => {
  await inWorld(async world => {
    const saved = sanityFixture();
    saveCopy(world, saved, start - 3 * minute);
    world.handler = unreachable;

    const first = await readSanity(world.onChange);
    assert.equal(first.status.offline, false);

    await world.advance(0);
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].status.source, 'cache');
    assert.equal(world.changes[0].status.offline, true);
    assert.deepEqual(world.changes[0].content, normalizeContent(saved));
    assert.equal(world.errors.length, 1);

    await world.advance(30 * second - 1);
    assert.equal(world.fetches.length, 1);
    await world.advance(1);
    assert.equal(world.fetches.length, 2);
    assert.equal(world.changes.length, 1);
    assert.equal(world.errors.length, 2);

    world.handler = async () => sanityReply(saved);
    await world.advance(30 * second);
    assert.equal(world.changes.length, 2);
    assert.equal(world.changes[1].status.source, 'sanity');
    assert.equal(world.changes[1].status.offline, false);
  });
});

test('sanity: no saved copy and no network gives empty content, never the sample', async () => {
  await inWorld(async world => {
    world.handler = unreachable;

    const first = await readSanity(world.onChange);
    assert.deepEqual(first.content, withDefaults({}));
    assert.equal(first.status.offline, true);
    assert.equal(first.status.updated, null);
    assert.equal(first.content.tasks.length, 0);
    assert.equal(world.errors.length, 1);
    assert.equal(world.storage.size, 0);

    const sampleTitle = JSON.parse(fs.readFileSync(sampleFile, 'utf8')).tasks[0].title;
    assert.equal(JSON.stringify(first.content).includes(sampleTitle), false);

    world.handler = async () => sanityReply(sanityFixture());
    await world.advance(30 * second);
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].status.offline, false);
    assert.equal(world.changes[0].status.source, 'sanity');
    assert.equal(world.changes[0].content.tasks.length, 4);
  });
});

test('sanity: offline only after 10 minutes without a good read, and clears on the next one', async () => {
  await inWorld(async world => {
    const fixture = sanityFixture();
    world.handler = async () => sanityReply(fixture);
    await readSanity(world.onChange);

    world.handler = unreachable;
    await world.advance(10 * minute);
    // reads failed at 5:00, 5:30 and so on up to 10:00, which is not yet more than 10 minutes
    assert.equal(world.fetches.length, 12);
    assert.equal(world.errors.length, 11);
    assert.equal(world.changes.length, 0);

    await world.advance(30 * second);
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].status.offline, true);
    assert.equal(world.changes[0].status.source, 'sanity');
    assert.deepEqual(world.changes[0].content, normalizeContent(fixture));

    await world.advance(30 * second);
    assert.equal(world.changes.length, 1);

    world.handler = async () => sanityReply(fixture);
    await world.advance(30 * second);
    assert.equal(world.changes.length, 2);
    assert.equal(world.changes[1].status.offline, false);
    assert.equal(world.changes[1].status.updated.getTime(), world.now);
  });
});

test('sanity: edits that arrive together cause one read, 1.5 seconds after the first', async () => {
  await inWorld(async world => {
    const fixture = sanityFixture();
    world.handler = async () => sanityReply(copyOf(fixture));
    await readSanity(world.onChange);
    const stream = world.streams[0];

    stream.emit('welcome');
    stream.emit('restart');
    await world.advance(5 * second);
    assert.equal(world.fetches.length, 1);

    fixture.tasks[0].title = '[Edited task]';
    stream.emit('message');
    await world.advance(500);
    stream.emit('message');
    await world.advance(500);
    stream.emit('message');
    await world.advance(499);
    assert.equal(world.fetches.length, 1);
    await world.advance(1);
    assert.equal(world.fetches.length, 2);
    assert.equal(world.changes.length, 1);

    await world.advance(5 * second);
    assert.equal(world.fetches.length, 2);

    stream.emit('message');
    await world.advance(1500);
    assert.equal(world.fetches.length, 3);
    assert.equal(world.changes.length, 1);
  });
});

test('sanity: reads never overlap, a change that comes during a read gets a read after it', async () => {
  await inWorld(async world => {
    const fixture = sanityFixture();
    world.handler = async () => sanityReply(copyOf(fixture));
    await readSanity(world.onChange);
    const stream = world.streams[0];

    let release = null;
    world.handler = () => new Promise(resolve => {
      release = () => resolve(sanityReply(copyOf(fixture)));
    });
    stream.emit('message');
    await world.advance(1500);
    assert.equal(world.fetches.length, 2);

    stream.emit('message');
    await world.advance(1500);
    assert.equal(world.fetches.length, 2);

    world.handler = async () => sanityReply(copyOf(fixture));
    release();
    await settle();
    assert.equal(world.fetches.length, 3);
    assert.equal(world.mostInFlight, 1);
  });
});

test('sanity: a read that hangs is given up after 15 seconds and the next one still works', async () => {
  await inWorld(async world => {
    saveCopy(world, sanityFixture(), start - minute);
    world.handler = (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('The request was aborted')));
    });

    await readSanity(world.onChange);
    await world.advance(0);
    await world.advance(15 * second - 1);
    assert.equal(world.errors.length, 0);
    assert.equal(world.changes.length, 0);

    await world.advance(1);
    assert.equal(world.errors.length, 1);
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].status.offline, true);

    world.handler = async () => sanityReply(sanityFixture());
    await world.advance(30 * second);
    assert.equal(world.changes.length, 2);
    assert.equal(world.changes[1].status.offline, false);
  });
});

test('sanity: bad answers count as a failed read and keep what is on screen', async () => {
  const badAnswers = {
    'an error status': () => jsonResponse({ error: { description: 'no' } }, 500),
    'no result': () => jsonResponse({ ms: 1 }),
    'a null result': () => jsonResponse({ result: null }),
    'text instead of JSON': () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token'); } }),
  };

  for (const name of Object.keys(badAnswers)) {
    await inWorld(async world => {
      world.handler = async () => badAnswers[name]();
      const first = await readSanity(world.onChange);
      assert.deepEqual(first.content, withDefaults({}), name);
      assert.equal(first.status.offline, true, name);
      assert.equal(world.errors.length, 1, name);

      saveCopy(world, sanityFixture(), start);
      const withCopy = await readSanity(world.onChange);
      await world.advance(0);
      assert.equal(withCopy.status.source, 'cache', name);
      assert.equal(world.changes[0].status.offline, true, name);
      assert.equal(world.changes[0].content.tasks.length, 4, name);
    });
  }
});

test('sanity: a saved copy that cannot be used is the same as having none', async () => {
  const unusable = ['not json', '', 'null', '7', '{}', '{ "savedAt": 1 }', '{ "savedAt": 1, "raw": "text" }'];

  for (const text of unusable) {
    await inWorld(async world => {
      world.storage.set(storageKey, text);
      world.handler = async () => sanityReply(sanityFixture());

      const first = await readSanity(world.onChange);
      assert.equal(first.status.source, 'sanity', 'saved text: ' + text);
      assert.equal(first.content.tasks.length, 4, 'saved text: ' + text);
    });
  }
});

test('sanity: a saved copy without a time still starts the screen', async () => {
  await inWorld(async world => {
    world.storage.set(storageKey, JSON.stringify({ raw: sanityFixture() }));
    const first = await readSanity(world.onChange);
    assert.equal(first.status.source, 'cache');
    assert.equal(first.status.updated, null);
  });
});

test('sanity: blocked storage does not stop the screen', async () => {
  await inWorld(async world => {
    world.storageBroken = true;
    world.handler = async () => sanityReply(sanityFixture());

    const first = await readSanity(world.onChange);
    assert.equal(first.status.source, 'sanity');
    assert.equal(first.content.tasks.length, 4);
    // one for reading the saved copy, one for saving the new one
    assert.equal(world.errors.length, 2);
  });
});

test('sanity: the live stream may be missing, may fail to open, or may drop', async () => {
  await inWorld(async world => {
    Object.defineProperty(globalThis, 'EventSource', { value: undefined, configurable: true, writable: true });
    world.handler = async () => sanityReply(sanityFixture());

    await readSanity(world.onChange);
    assert.equal(world.errors.length, 0);
    await world.advance(5 * minute);
    assert.equal(world.fetches.length, 2);
  });

  await inWorld(async world => {
    Object.defineProperty(globalThis, 'EventSource', {
      value: function () { throw new Error('not allowed'); },
      configurable: true,
      writable: true,
    });
    world.handler = async () => sanityReply(sanityFixture());

    await readSanity(world.onChange);
    assert.equal(world.errors.length, 1);
    await world.advance(5 * minute);
    assert.equal(world.fetches.length, 2);
  });

  await inWorld(async world => {
    world.handler = async () => sanityReply(sanityFixture());
    await readSanity(world.onChange);
    const stream = world.streams[0];

    stream.emit('error');
    stream.emit('error');
    stream.emit('error');
    assert.equal(world.errors.length, 1);
    stream.emit('open');
    stream.emit('error');
    assert.equal(world.errors.length, 2);

    await world.advance(5 * minute);
    assert.equal(world.streams.length, 1);

    stream.readyState = 2;
    stream.emit('error');
    await world.advance(minute - 1);
    assert.equal(world.streams.length, 1);
    await world.advance(1);
    assert.equal(world.streams.length, 2);
    assert.equal(world.streams[1].url, liveEventsUrl(live.config.sanity));
  });
});

test('sanity: a failing onChange does not stop the reading', async () => {
  await inWorld(async world => {
    const fixture = sanityFixture();
    world.handler = async () => sanityReply(copyOf(fixture));
    await readSanity(() => {
      throw new Error('the screen broke');
    });

    fixture.tasks[0].title = '[Edited task]';
    await world.advance(5 * minute);
    assert.equal(world.errors.length, 1);

    fixture.tasks[0].title = '[Edited again]';
    await world.advance(5 * minute);
    assert.equal(world.fetches.length, 3);
    assert.equal(world.errors.length, 2);
  });
});

// People and their photos

// What the query's projection sends for a person with a photo
function photoRecord(changes) {
  return Object.assign({
    url: 'https://cdn.sanity.io/images/abc123/production/0123abcd-800x600.jpg',
    width: 800,
    height: 600,
    crop: { _type: 'sanity.imageCrop', top: 0, bottom: 0, left: 0, right: 0 },
    hotspot: { _type: 'sanity.imageHotspot', x: 0.5, y: 0.5, width: 0.3, height: 0.3 },
  }, changes);
}

function personWith(fields) {
  return normalizeContent({ people: [document('person', 'px', Object.assign({ role: 'Mentor', name: '[Mentor X]' }, fields))] }).people[0];
}

test('the query asks for each person\'s photo as an address, a size, a crop and a hotspot', () => {
  assert.ok(contentQuery.includes('*[_type == "person"] | order(_createdAt asc) {'));
  ['"url": asset->url', '"width": asset->metadata.dimensions.width', '"height": asset->metadata.dimensions.height', 'crop,', 'hotspot'].forEach(piece => {
    assert.ok(contentQuery.includes(piece), 'the query does not ask for ' + piece);
  });
});

test('a person with a photo keeps its address, size, crop and hotspot, and loses Sanity\'s own names', () => {
  const person = personWith({ photo: photoRecord({ crop: { _type: 'sanity.imageCrop', top: 0.1, bottom: 0, left: 0, right: 0.25 } }), showPhoto: true });

  assert.deepEqual(person.photo, {
    url: 'https://cdn.sanity.io/images/abc123/production/0123abcd-800x600.jpg',
    width: 800,
    height: 600,
    crop: { left: 0, right: 0.25, top: 0.1, bottom: 0 },
    hotspot: { x: 0.5, y: 0.5 },
  });
  assert.equal(person.showPhoto, true);
  assert.equal(JSON.stringify(person).includes('_type'), false);
});

test('a person with no photo, or a photo that cannot be used, has no photo at all', () => {
  assert.equal('photo' in personWith({}), false);
  assert.equal('photo' in personWith({ photo: null }), false);
  // an image field with no picture in it comes back from the query like this
  assert.equal('photo' in personWith({ photo: { url: null, width: null, height: null, crop: null, hotspot: null } }), false);
  assert.equal('photo' in personWith({ photo: photoRecord({ url: 'http://cdn.sanity.io/images/a.jpg' }) }), false);
  assert.equal('photo' in personWith({ photo: photoRecord({ width: 0 }) }), false);
  assert.equal('photo' in personWith({ photo: photoRecord({ height: '600' }) }), false);
});

test('a missing Show photo on screen takes the default, and a real switch is kept', () => {
  assert.equal(live.config.defaultPerson.showPhoto, true);
  assert.equal(personWith({}).showPhoto, true);
  assert.equal(personWith({ showPhoto: false }).showPhoto, false);
  assert.equal(personWith({ showPhoto: true }).showPhoto, true);
  assert.equal(personWith({ showPhoto: 'no' }).showPhoto, true);
  assert.equal(normalizeSample({ people: [{ role: 'Coach', name: '[Coach]' }] }).people[0].showPhoto, true);
  assert.equal(normalizeSample({ people: [{ role: 'Coach', name: '[Coach]', showPhoto: false }] }).people[0].showPhoto, false);
});

test('the sample people have no photos, so the sample shows silhouettes', () => {
  const people = normalizeSample(JSON.parse(fs.readFileSync(sampleFile, 'utf8'))).people;
  assert.ok(people.length > 0);
  people.forEach(person => assert.equal(photoAddress(person), ''));
});

test('tidyPhoto fills in a missing crop and hotspot and refuses what cannot be used', () => {
  const bare = tidyPhoto({ url: 'https://cdn.sanity.io/images/abc123/production/0123abcd-800x600.jpg', width: 800, height: 600 });
  assert.deepEqual(bare.crop, { left: 0, right: 0, top: 0, bottom: 0 });
  assert.deepEqual(bare.hotspot, { x: 0.5, y: 0.5 });

  // an edge outside 0 to 1, a missing edge, or edges that leave nothing: the whole picture
  [{ left: -0.1, right: 0, top: 0, bottom: 0 }, { left: 0, right: 0, top: 0 }, { left: 0.5, right: 0.5, top: 0, bottom: 0 }, { left: 0, right: 0, top: 0.6, bottom: 0.6 }, 'text'].forEach(crop => {
    assert.deepEqual(tidyPhoto(photoRecord({ crop: crop })).crop, { left: 0, right: 0, top: 0, bottom: 0 });
  });
  // a hotspot outside the picture is the middle
  assert.deepEqual(tidyPhoto(photoRecord({ hotspot: { x: 2, y: 0.5 } })).hotspot, { x: 0.5, y: 0.5 });

  [undefined, null, 'text', 7, {}, photoRecord({ url: '' }), photoRecord({ url: 5 }), photoRecord({ width: -1 }), photoRecord({ height: NaN })].forEach(raw => {
    assert.equal(tidyPhoto(raw), null);
  });
});

const photoBase = 'https://cdn.sanity.io/images/abc123/production/0123abcd-800x600.jpg';

test('photoUrl asks for the part of the picture shown, at the size it is shown, in an efficient format', () => {
  const photo = tidyPhoto(photoRecord());

  // 800 x 600 into a square: the whole height, cut at the sides around the middle
  assert.equal(photoUrl(photo, 280, 280), photoBase + '?rect=100,0,600,600&w=280&h=280&fit=crop&auto=format');

  // a square picture needs no cutting
  const square = tidyPhoto(photoRecord({ width: 500, height: 500 }));
  assert.equal(photoUrl(square, 280, 280), photoBase + '?rect=0,0,500,500&w=280&h=280&fit=crop&auto=format');

  // a tall picture is cut at the top and bottom
  const tall = tidyPhoto(photoRecord({ width: 600, height: 900 }));
  assert.equal(photoUrl(tall, 280, 280), photoBase + '?rect=0,150,600,600&w=280&h=280&fit=crop&auto=format');

  // the screen is 1 to 1, and scale says how many screen pixels each pixel is
  assert.equal(photoUrl(photo, 280, 280, 1), photoUrl(photo, 280, 280));
  assert.equal(photoUrl(photo, 280, 280, 2), photoBase + '?rect=100,0,600,600&w=560&h=560&fit=crop&auto=format');
});

test('photoUrl keeps the face in the picture: the hotspot moves the cut and the crop limits it', () => {
  // the face is on the left of an 800 x 600 picture
  const left = tidyPhoto(photoRecord({ hotspot: { x: 0.25, y: 0.5 } }));
  assert.equal(photoUrl(left, 280, 280), photoBase + '?rect=0,0,600,600&w=280&h=280&fit=crop&auto=format');

  // the face is at the far right: the cut stops at the edge of the picture
  const right = tidyPhoto(photoRecord({ hotspot: { x: 0.95, y: 0.5 } }));
  assert.equal(photoUrl(right, 280, 280), photoBase + '?rect=200,0,600,600&w=280&h=280&fit=crop&auto=format');

  // the editor cut 25% off the right, so what is left is 600 x 600 and the cut stays inside it
  const cropped = tidyPhoto(photoRecord({ crop: { top: 0, bottom: 0, left: 0, right: 0.25 }, hotspot: { x: 0.95, y: 0.5 } }));
  assert.equal(photoUrl(cropped, 280, 280), photoBase + '?rect=0,0,600,600&w=280&h=280&fit=crop&auto=format');

  // a crop from the top: the cut starts below it
  const lower = tidyPhoto(photoRecord({ width: 600, height: 900, crop: { top: 0.2, bottom: 0.1, left: 0, right: 0 }, hotspot: { x: 0.5, y: 0.05 } }));
  assert.equal(photoUrl(lower, 280, 280), photoBase.replace('800x600', '800x600') + '?rect=0,180,600,600&w=280&h=280&fit=crop&auto=format');
});

test('photoUrl always asks for a part that is inside the picture and the crop, in the shape of the box', () => {
  const sizes = [[100, 100], [333, 777], [800, 600], [4032, 3024], [60, 4000]];
  const hotspots = [0, 0.1, 0.5, 0.9, 1];
  const crops = [{ left: 0, right: 0, top: 0, bottom: 0 }, { left: 0.2, right: 0.1, top: 0.05, bottom: 0.3 }, { left: 0.4, right: 0.4, top: 0, bottom: 0.7 }];
  const boxes = [[280, 280], [280, 400], [500, 168]];

  sizes.forEach(([width, height]) => {
    crops.forEach(crop => {
      hotspots.forEach(x => {
        hotspots.forEach(y => {
          boxes.forEach(([boxWidth, boxHeight]) => {
            const photo = tidyPhoto(photoRecord({ width: width, height: height, crop: crop, hotspot: { x: x, y: y } }));
            const [left, top, partWidth, partHeight] = photoUrl(photo, boxWidth, boxHeight).match(/rect=([\d,]+)/)[1].split(',').map(Number);
            const where = [width, height, JSON.stringify(crop), x, y, boxWidth, boxHeight].join(' ');

            const cropLeft = Math.round(crop.left * width);
            const cropTop = Math.round(crop.top * height);
            assert.ok(left >= cropLeft && top >= cropTop, 'starts outside the crop: ' + where);
            assert.ok(left + partWidth <= Math.round(width - crop.right * width), 'ends outside the crop on the right: ' + where);
            assert.ok(top + partHeight <= Math.round(height - crop.bottom * height), 'ends outside the crop at the bottom: ' + where);
            assert.ok(partWidth >= 1 && partHeight >= 1, 'has no size: ' + where);
            // the shape is the box's, to within the rounding of whole pixels
            const aspect = boxWidth / boxHeight;
            assert.ok(Math.abs(partHeight * aspect - partWidth) <= 0.5 * Math.max(1, aspect) + 0.001, 'is the wrong shape: ' + where);
          });
        });
      });
    });
  });
});

test('photoUrl gives an empty text for no photo or a size that makes no sense', () => {
  const photo = photoRecord();
  assert.equal(photoUrl(null, 280, 280), '');
  assert.equal(photoUrl(undefined, 280, 280), '');
  assert.equal(photoUrl(photo, 0, 280), '');
  assert.equal(photoUrl(photo, 280, -1), '');
  assert.equal(photoUrl(photo, 280, 280, 0), '');
  assert.notEqual(photoUrl(photo, 280, 280), '');
});

test('preloadImages starts a download for each address and skips the empty ones', () => {
  const started = [];
  globalThis.Image = class {
    set src(address) {
      started.push(address);
    }
  };

  try {
    preloadImages(['https://example.com/a.jpg', '', 'https://example.com/b.jpg']);
    preloadImages([]);
  } finally {
    delete globalThis.Image;
  }
  assert.deepEqual(started, ['https://example.com/a.jpg', 'https://example.com/b.jpg']);
});

test('makePages gives a page at a time, comes back to the first, and says what comes next', () => {
  const next = makePages(3);
  const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

  assert.deepEqual(next(list), { items: ['a', 'b', 'c'], upcoming: ['d', 'e', 'f'], number: 1, count: 3 });
  assert.deepEqual(next(list), { items: ['d', 'e', 'f'], upcoming: ['g'], number: 2, count: 3 });
  assert.deepEqual(next(list), { items: ['g'], upcoming: ['a', 'b', 'c'], number: 3, count: 3 });
  assert.deepEqual(next(list), { items: ['a', 'b', 'c'], upcoming: ['d', 'e', 'f'], number: 1, count: 3 });
});

test('makePages with one page, no list, or a list that changes between turns', () => {
  const one = makePages(3);
  assert.deepEqual(one(['a', 'b']), { items: ['a', 'b'], upcoming: [], number: 1, count: 1 });
  assert.deepEqual(one(['a', 'b']), { items: ['a', 'b'], upcoming: [], number: 1, count: 1 });

  const empty = makePages(3);
  assert.deepEqual(empty([]), { items: [], upcoming: [], number: 1, count: 1 });

  // an exact multiple has no empty page at the end
  const exact = makePages(3);
  assert.equal(exact(['a', 'b', 'c', 'd', 'e', 'f']).count, 2);

  // the list gets shorter after page 2 was shown: counting goes round the pages as they are now
  const shrinking = makePages(2);
  const long = ['a', 'b', 'c', 'd', 'e', 'f'];
  shrinking(long);
  shrinking(long);
  // page 3 was next, but there are only 2 pages now, so it goes round to the first
  assert.deepEqual(shrinking(['a', 'b', 'c']).items, ['a', 'b']);
  assert.deepEqual(shrinking(['a', 'b', 'c']).items, ['c']);
});

test('photoAddress is the photo at the portrait size, or empty for the silhouette', () => {
  const photo = tidyPhoto(photoRecord());

  assert.equal(photoAddress({ name: '[A]', photo: photo, showPhoto: true }), photoUrl(photo, 280, 280));
  assert.ok(photoAddress({ name: '[A]', photo: photo, showPhoto: true }).includes('&w=280&h=280&'));
  // no switch in the content means the default, which is on
  assert.equal(photoAddress({ name: '[A]', photo: photo }), photoUrl(photo, 280, 280));
  assert.equal(photoAddress({ name: '[A]', photo: photo, showPhoto: false }), '');
  assert.equal(photoAddress({ name: '[A]', showPhoto: true }), '');
  assert.equal(photoAddress({ name: '[A]' }), '');
  assert.equal(photoAddress(null), '');
});

test('personNamed finds a showing person by name, ignoring capitals and spaces at the ends', () => {
  const people = [
    { name: '[Alex]', showPhoto: true },
    { name: '[Sam]', show: false },
    { name: '[Old]', expires: '2020-01-01T00:00:00.000Z' },
    { role: 'Coach' },
  ];

  assert.equal(personNamed(people, '  [ALEX] '), people[0]);
  assert.equal(personNamed(people, '[Sam]'), null);
  assert.equal(personNamed(people, '[Old]'), null);
  assert.equal(personNamed(people, '[Nobody]'), null);
  assert.equal(personNamed(people, ''), null);
  assert.equal(personNamed(people, undefined), null);
  assert.equal(personNamed(undefined, '[Alex]'), null);
});

// plate.js draws each card shape once into a hidden group of the page. This
// stands in for the page, and says which shapes were drawn.
function withFakePage(run) {
  const drawn = [];
  globalThis.document = {
    getElementById: id => {
      if (id === 'metal-shapes') return { insertAdjacentHTML: (where, markup) => drawn.push(markup.match(/id="([^"]+)"/)[1]) };
      return drawn.includes(id) ? {} : null;
    },
  };

  try {
    run(drawn);
  } finally {
    delete globalThis.document;
  }
}

test('a slot has the portrait, the name and the role, as one slat, and escapes what editors typed', () => withFakePage(drawn => {
  assert.equal(slotsPerPage, 3);

  const withPhoto = slotMarkup({ name: '<b>Alexandria Joseph</b>', role: 'CAPTAIN', address: photoBase + '?rect=0,0,5,5&w=280&h=280&fit=crop&auto=format' });
  assert.ok(withPhoto.includes('data-slat="item"'));
  assert.ok(withPhoto.includes('<img src="' + photoBase + '?rect=0,0,5,5&amp;w=280&amp;h=280&amp;fit=crop&amp;auto=format" width="280" height="280" alt="">'));
  assert.ok(withPhoto.includes('&lt;b&gt;Alexandria Joseph&lt;/b&gt;'));
  assert.equal(withPhoto.includes('<b>'), false);
  assert.ok(withPhoto.includes('<div class="slot-role">CAPTAIN</div>'));
  assert.equal(withPhoto.includes('person-silhouette'), false);

  // no address: the silhouette, drawn once in index.html and pointed at
  const without = slotMarkup({ name: '[Alex]', role: '', address: '' });
  assert.ok(without.includes('<use href="#person-silhouette"'));
  assert.equal(without.includes('<img'), false);
  assert.ok(without.includes('<div class="slot-role"></div>'));
  assert.ok(silhouetteMarkup().includes('href="#person-silhouette"'));

  // the card's shape is drawn once, however many slots there are
  assert.deepEqual(drawn, ['card-296x296']);
}));

test('the silhouette is drawn once in index.html, from the logo\'s numbers, with every colour a variable', () => {
  const html = fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8');
  const start = html.indexOf('<symbol id="person-silhouette"');
  const symbol = html.slice(start, html.indexOf('</symbol>', start));
  assert.ok(start > 0, 'index.html has no symbol called person-silhouette');
  assert.equal(html.split('id="person-silhouette"').length, 2, 'the silhouette should be drawn once');
  assert.equal(/fill=|stroke=|style=|#[0-9a-f]{3,6}\b/i.test(symbol), false, 'the silhouette has a colour of its own');

  const classes = (symbol.match(/class="[^"]+"/g) || []).map(text => text.slice(7, -1));
  assert.deepEqual(Array.from(new Set(classes)).sort(), ['bust-cut', 'bust-light', 'bust-shade', 'bust-slash']);

  // the numbers it uses are on the logo's grid: the head plate's sides and the chin, the jaw's top and the face plate's width
  ['430.5', '669.5', '478.5', '621.5', '290.5', '632', '498.5', '601.5', '326.5', '773.5'].forEach(number => {
    assert.ok(symbol.includes(number), 'the silhouette does not use ' + number + ' from logo.js');
    assert.ok(fs.readFileSync(path.join(dashboardFolder, 'core/logo.js'), 'utf8').includes(number), 'logo.js does not have ' + number);
  });

  const tokens = fs.readFileSync(path.join(dashboardFolder, 'tokens.css'), 'utf8');
  const base = fs.readFileSync(path.join(dashboardFolder, 'base.css'), 'utf8');
  ['light', 'shade', 'cut', 'slash'].forEach(name => {
    assert.ok(tokens.includes('--silhouette-' + name + ':'), 'tokens.css has no --silhouette-' + name);
    assert.ok(base.includes('.bust-' + name + ' { fill: var(--silhouette-' + name + '); }'), 'base.css does not colour .bust-' + name + ' from a variable');
  });
});

test('the portrait sizes in portrait.js, base.css and the text sizes agree', () => {
  const base = fs.readFileSync(path.join(dashboardFolder, 'base.css'), 'utf8');
  const tokens = fs.readFileSync(path.join(dashboardFolder, 'tokens.css'), 'utf8');

  // the photo is asked for at 280 and drawn at 280
  assert.ok(photoAddress({ photo: tidyPhoto(photoRecord()) }).includes('w=280&h=280'));
  assert.ok(/\.portrait-photo\s*\{[^}]*width: 280px;[^}]*height: 280px;/.test(base));
  assert.ok(/\.portrait\s*\{[^}]*width: 296px;[^}]*height: 296px;/.test(base));
  assert.ok(/\.slot-name\s*\{ font: 500 var\(--size-body\)\//.test(base));
  assert.ok(/\.slot-role\s*\{[^}]*font: 600 var\(--size-label\)\//.test(base));
  assert.ok(tokens.includes('--size-body: 56px;') && tokens.includes('--size-label: 44px;'));
});

test('the Leadership and Team Leads panels have no cap of six and use the shared slots', () => {
  ['leadership/leadership.js', 'team-leads/team-leads.js'].forEach(file => {
    const code = fs.readFileSync(path.join(dashboardFolder, 'panels', file), 'utf8');
    assert.equal(/MAX_CARDS|slice\(0, 6\)/.test(code), false, file + ' still limits the list to six');
    assert.ok(code.includes('makePages(slotsPerPage)'), file + ' does not show a page at a time');
    assert.ok(code.includes('preloadPhotos('), file + ' does not load the next page\'s photos');
    assert.ok(code.includes('watchPhotos('), file + ' does not replace a photo that cannot be loaded');
    assert.ok(code.includes('slotMarkup('), file + ' should draw its slots with slotMarkup');
  });
});


// Things that came after ES2017, and the pattern that finds each one. This is
// a text search, so it can only find what is written out in the file.
const newerThanEs2017 = [
  [/\?\.[A-Za-z_$[(]/, 'optional chaining (?.)'],
  [/\?\?/, 'the ?? operator'],
  [/\.(replaceAll|at|flat|flatMap|finally|matchAll|trimStart|trimEnd)\(/, 'a newer method'],
  [/\b(Object\.fromEntries|Promise\.(allSettled|any))\b/, 'a newer function'],
  [/catch\s*\{/, 'catch with no name'],
  [/\{\s*\.\.\.[A-Za-z_$]/, 'object spread'],
  [/,\s*\.\.\.[A-Za-z_$][\w$]*\s*\}/, 'object rest'],
  [/\(\?<[=!A-Za-z]/, 'a regular expression lookbehind or group name'],
  [/\bfor\s+await\b/, 'for await'],
  [/\b\d+n\b|\b\d+_\d/, 'a BigInt or a number with underscores'],
  [/^\s*static\s+[\w$]+\s*=/, 'a class field'],
  [/import\.meta/, 'import.meta'],
];

function javascriptFilesIn(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).reduce((found, entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return found.concat(javascriptFilesIn(full));
    return entry.name.endsWith('.js') ? found.concat(full) : found;
  }, []);
}

// Extra events: events typed into the Studio that are not on BAND (core/events.js).
// Times are given as real moments (...Z) and zones by name, so none of this
// depends on the time zone of the computer that runs the tests.

const newYork = 'America/New_York';

function extra(fields) {
  return Object.assign({ title: '[Extra]', startDate: '2027-04-02' }, fields);
}

// An all-day BAND event, made the way core/calendar.js makes it: midnights on the computer's own clock
function bandDay(title, year, month, day, lastDay) {
  return {
    title: title,
    start: new Date(year, month - 1, day),
    end: new Date(year, month - 1, (lastDay || day) + 1),
    allDay: true,
    location: '',
    calendarId: 'team',
  };
}

function bandTimed(title, startIso, endIso) {
  return { title: title, start: new Date(startIso), end: new Date(endIso), allDay: false, location: '', calendarId: 'team' };
}

function titlesOf(events) {
  return events.map(event => event.title);
}

test('the query asks for the Extra events that are not switched off, soonest first, and normalizeContent passes them on', () => {
  assert.ok(contentQuery.includes('*[_type == "extraEvent" && show != false] | order(startDate asc, _createdAt asc)'));

  const content = normalizeContent({
    extraEvents: [
      document('extraEvent', 'e1', { title: '[One]', startDate: '2027-04-02', endDate: '', location: '' }),
      'oops',
      null,
    ],
  }, today);
  assert.deepEqual(content.extraEvents, [{ title: '[One]', startDate: '2027-04-02' }]);
  assert.deepEqual(normalizeContent({}, today).extraEvents, []);
  assert.deepEqual(normalizeContent({ extraEvents: 'oops' }, today).extraEvents, []);
  assert.deepEqual(withDefaults(null).extraEvents, []);
});

test('the sample content has Extra events marked with square brackets, and they are kept', () => {
  const file = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  assert.ok(file.extraEvents.length >= 2);
  file.extraEvents.forEach(item => assert.ok(item.title.startsWith('['), item.title));

  const content = normalizeSample(file);
  assert.equal(content.extraEvents.length, file.extraEvents.length);
  assert.equal(extraEventsToEvents(content.extraEvents, newYork).length, file.extraEvents.length, 'every sample Extra event can be shown');
});

test('tidyExtraEvent keeps a good event and fills in the end date and the empty parts', () => {
  assert.deepEqual(tidyExtraEvent(extra({ location: '  Holly Springs HS ' })), {
    title: '[Extra]', startDate: '2027-04-02', endDate: '2027-04-02', startTime: '', endTime: '', location: 'Holly Springs HS',
  });
  assert.deepEqual(tidyExtraEvent(extra({ endDate: '2027-04-04', startTime: '18:30', endTime: '20:00' })), {
    title: '[Extra]', startDate: '2027-04-02', endDate: '2027-04-04', startTime: '18:30', endTime: '20:00', location: '',
  });
});

test('tidyExtraEvent leaves out an event that is switched off, has no title, or has no real start date', () => {
  assert.equal(tidyExtraEvent(extra({ show: false })), null);
  assert.equal(tidyExtraEvent(extra({ show: true })) !== null, true);
  assert.equal(tidyExtraEvent(extra({ title: '   ' })), null);
  assert.equal(tidyExtraEvent(extra({ title: undefined })), null);
  assert.equal(tidyExtraEvent(extra({ startDate: undefined })), null);
  assert.equal(tidyExtraEvent(extra({ startDate: '2027-02-30' })), null);
  assert.equal(tidyExtraEvent(extra({ startDate: '04/02/2027' })), null);
  assert.equal(tidyExtraEvent('oops'), null);
  assert.equal(tidyExtraEvent(null), null);
  assert.equal(tidyExtraEvent([]), null);
});

test('tidyExtraEvent fixes small slips instead of hiding the event', () => {
  // an end date before the start is the start
  assert.equal(tidyExtraEvent(extra({ endDate: '2027-04-01' })).endDate, '2027-04-02');
  assert.equal(tidyExtraEvent(extra({ endDate: 'soon' })).endDate, '2027-04-02');
  // a time that is not HH:MM means no time, so the event is all-day
  ['6:30 PM', '24:00', '18:60', '1830', 42, ''].forEach(bad => {
    assert.equal(tidyExtraEvent(extra({ startTime: bad })).startTime, '', String(bad));
  });
  // an end time needs a start time, and may not come before it on a one day event
  assert.equal(tidyExtraEvent(extra({ endTime: '20:00' })).endTime, '');
  assert.equal(tidyExtraEvent(extra({ startTime: '18:30', endTime: '17:00' })).endTime, '');
  assert.equal(tidyExtraEvent(extra({ startTime: '18:30', endTime: '25:00' })).endTime, '');
  assert.equal(tidyExtraEvent(extra({ startTime: '18:30', endTime: '17:00', endDate: '2027-04-03' })).endTime, '17:00');
});

test('instantIn gives the real moment when a clock in that time zone shows a time', () => {
  assert.equal(instantIn(newYork, '2027-01-09', '18:30').toISOString(), '2027-01-09T23:30:00.000Z'); // winter, 5 hours behind UTC
  assert.equal(instantIn(newYork, '2027-07-04', '18:30').toISOString(), '2027-07-04T22:30:00.000Z'); // summer, 4 hours behind
  assert.equal(instantIn(newYork, '2027-03-14', '01:00').toISOString(), '2027-03-14T06:00:00.000Z'); // the morning the clocks go forward, before 2:00
  assert.equal(instantIn(newYork, '2027-03-14', '12:00').toISOString(), '2027-03-14T16:00:00.000Z'); // the same day, after
  assert.equal(instantIn(newYork, '2027-11-07', '12:00').toISOString(), '2027-11-07T17:00:00.000Z'); // the day the clocks go back
  assert.equal(instantIn(newYork, '2027-01-09', '00:00').toISOString(), '2027-01-09T05:00:00.000Z');
  assert.equal(instantIn('Asia/Kolkata', '2027-01-09', '18:30').toISOString(), '2027-01-09T13:00:00.000Z'); // 5 and a half hours ahead
  assert.equal(instantIn('UTC', '2027-01-09', '18:30').toISOString(), '2027-01-09T18:30:00.000Z');
});

test('an Extra event with no start time is an all-day event, made like a BAND one', () => {
  const event = extraEventsToEvents([extra({ title: 'Game Drop', startDate: '2027-04-02', endDate: '2027-04-04', location: 'Holly Springs HS' })], newYork)[0];

  assert.equal(event.allDay, true);
  assert.equal(event.title, 'Game Drop');
  assert.equal(event.location, 'Holly Springs HS');
  assert.equal(event.calendar, 'Extra');
  assert.equal(event.calendarId, 'extra');
  assert.deepEqual([event.firstDay, event.lastDay], ['2027-04-02', '2027-04-04']);

  // midnights on the computer's own clock, ending at the midnight after the last day
  assert.equal(event.start.getTime(), new Date(2027, 3, 2).getTime());
  assert.equal(event.end.getTime(), new Date(2027, 3, 5).getTime());
  assert.equal(event.start.getDate(), 2);
});

test('an Extra event with a start time starts at that time in the Theme time zone', () => {
  const event = extraEventsToEvents([extra({ startDate: '2027-01-09', startTime: '18:30', endTime: '20:00' })], newYork)[0];
  assert.equal(event.allDay, false);
  assert.equal(event.start.toISOString(), '2027-01-09T23:30:00.000Z');
  assert.equal(event.end.toISOString(), '2027-01-10T01:00:00.000Z');

  const elsewhere = extraEventsToEvents([extra({ startDate: '2027-01-09', startTime: '18:30' })], 'Europe/London')[0];
  assert.equal(elsewhere.start.toISOString(), '2027-01-09T18:30:00.000Z');
});

test('a timed Extra event with no end time ends when it starts, unless it runs over several days', () => {
  const oneDay = extraEventsToEvents([extra({ startDate: '2027-01-09', startTime: '18:30' })], newYork)[0];
  assert.equal(oneDay.end.getTime(), oneDay.start.getTime());

  const several = extraEventsToEvents([extra({ startDate: '2027-01-09', endDate: '2027-01-10', startTime: '18:30' })], newYork)[0];
  assert.equal(several.end.toISOString(), '2027-01-11T05:00:00.000Z'); // midnight at the end of the 10th in New York
  assert.equal(several.lastDay, '2027-01-10');
});

test('extraEventsToEvents copes with a missing list, bad entries and a time zone it does not know', () => {
  assert.deepEqual(extraEventsToEvents(undefined, newYork), []);
  assert.deepEqual(extraEventsToEvents('oops', newYork), []);
  assert.deepEqual(extraEventsToEvents([null, {}, extra({ show: false })], newYork), []);

  const fallback = extraEventsToEvents([extra({ startDate: '2027-01-09', startTime: '18:30' })], 'Nowhere/Land')[0];
  assert.equal(fallback.start.toISOString(), '2027-01-09T23:30:00.000Z', 'an unknown zone is America/New_York');
});

test('mergeEvents puts BAND and Extra events in one list sorted by start', () => {
  const band = [bandTimed('[Band late]', '2027-03-04T23:00:00Z', '2027-03-05T01:00:00Z'), bandDay('[Band day]', 2027, 3, 10)];
  const extras = [extra({ title: '[Extra later]', startDate: '2027-03-12' }), extra({ title: '[Extra first]', startDate: '2027-03-04' })];
  const now = new Date('2027-03-01T15:00:00Z');

  const merged = mergeEvents(band, extras, newYork, now);
  assert.deepEqual(titlesOf(merged), ['[Extra first]', '[Band late]', '[Band day]', '[Extra later]']);
});

test('mergeEvents shows the BAND events as they are when there are no Extra events, and the Extra events when there are no BAND ones', () => {
  const now = new Date('2027-03-01T15:00:00Z');
  const band = [bandDay('[Band day]', 2027, 3, 10)];

  assert.deepEqual(titlesOf(mergeEvents(band, [], newYork, now)), ['[Band day]']);
  assert.deepEqual(titlesOf(mergeEvents(band, undefined, newYork, now)), ['[Band day]']);
  assert.deepEqual(titlesOf(mergeEvents(undefined, [extra({ startDate: '2027-03-05' })], newYork, now)), ['[Extra]']);
  assert.deepEqual(mergeEvents(undefined, undefined, newYork, now), []);
  assert.deepEqual(mergeEvents(null, null, undefined, now), []);
});

test('mergeEvents does not change the lists it is given', () => {
  const band = [bandDay('[Band day]', 2027, 3, 10)];
  const extras = [extra({ startDate: '2027-03-05' })];
  const before = JSON.stringify([band, extras]);

  const merged = mergeEvents(band, extras, newYork, new Date('2027-03-01T15:00:00Z'));
  assert.equal(JSON.stringify([band, extras]), before);
  assert.equal(band[0].firstDay, undefined);
  assert.notEqual(merged[1], band[0]);
});

test('an event is dropped once its end date has passed, by the date in the Theme time zone', () => {
  const extras = [extra({ title: '[Over]', startDate: '2027-01-08' }), extra({ title: '[Today]', startDate: '2027-01-09' })];

  // 22:00 on 9 January in New York is already 10 January in UTC
  const lateEvening = new Date('2027-01-10T03:00:00Z');
  assert.deepEqual(titlesOf(mergeEvents([], extras, newYork, lateEvening)), ['[Today]']);
  assert.deepEqual(titlesOf(mergeEvents([], extras, 'UTC', lateEvening)), [], 'the same moment is the next day in UTC');

  // an event that is over at 00:30 on the 10th in New York
  const justAfterMidnight = new Date('2027-01-10T05:30:00Z');
  assert.deepEqual(titlesOf(mergeEvents([], extras, newYork, justAfterMidnight)), []);
});

test('an event with an end date stays until the end date has passed, and one with no end date goes after its start date', () => {
  const extras = [extra({ title: '[Weekend]', startDate: '2027-04-02', endDate: '2027-04-04' }), extra({ title: '[One day]', startDate: '2027-04-02' })];
  const shown = day => titlesOf(mergeEvents([], extras, newYork, new Date('2027-04-0' + day + 'T16:00:00Z')));

  assert.deepEqual(shown(2).sort(), ['[One day]', '[Weekend]']);
  assert.deepEqual(shown(3), ['[Weekend]']);
  assert.deepEqual(shown(4), ['[Weekend]']);
  assert.deepEqual(shown(5), []);
});

test('mergeEvents also drops BAND events whose last day has passed, and keeps one that is on today', () => {
  const now = new Date('2027-03-05T16:00:00Z'); // noon on the 5th in New York
  const band = [
    bandDay('[Yesterday]', 2027, 3, 4),
    bandDay('[Today]', 2027, 3, 5),
    bandDay('[Three days, still on]', 2027, 3, 3, 5),
    bandTimed('[Ended last night]', '2027-03-04T23:00:00Z', '2027-03-05T02:00:00Z'),
    bandTimed('[Tonight]', '2027-03-05T23:00:00Z', '2027-03-06T01:00:00Z'),
  ];

  const merged = mergeEvents(band, [], newYork, now);
  assert.deepEqual(titlesOf(merged).sort(), ['[Three days, still on]', '[Today]', '[Tonight]']);
});

test('an event with no usable start is left out', () => {
  const band = [{ title: '[No start]', start: 'not a date', end: null, allDay: false }, null, 'oops', bandDay('[Fine]', 2027, 3, 10)];
  assert.deepEqual(titlesOf(mergeEvents(band, [], newYork, new Date('2027-03-01T15:00:00Z'))), ['[Fine]']);
});

test('mergeEvents adds the dates each event covers, in the Theme time zone for timed events', () => {
  const band = [
    bandDay('[Three days]', 2027, 3, 10, 12),
    bandTimed('[Evening]', '2027-03-11T01:30:00Z', '2027-03-11T03:00:00Z'), // 8:30 PM on the 10th in New York
    bandTimed('[Ends at midnight]', '2027-03-11T03:00:00Z', '2027-03-11T05:00:00Z'), // 10 PM to midnight on the 10th
  ];
  const merged = mergeEvents(band, [], newYork, new Date('2027-03-01T15:00:00Z'));
  const days = title => merged.filter(event => event.title === title).map(event => [event.firstDay, event.lastDay])[0];

  assert.deepEqual(days('[Three days]'), ['2027-03-10', '2027-03-12']);
  assert.deepEqual(days('[Evening]'), ['2027-03-10', '2027-03-10']);
  assert.deepEqual(days('[Ends at midnight]'), ['2027-03-10', '2027-03-10']);
});

test('an Extra event on the same date as a BAND event with a title that contains the other is left out', () => {
  const now = new Date('2026-10-04T15:00:00Z');
  const band = [bandDay('Doyenne East Regional', 2026, 10, 17)];

  // the Extra title is inside the BAND title
  let merged = mergeEvents(band, [extra({ title: 'Doyenne East', startDate: '2026-10-17' })], newYork, now);
  assert.deepEqual(titlesOf(merged), ['Doyenne East Regional'], 'the BAND one stays');
  assert.equal(merged[0].calendarId, 'team');

  // the BAND title is inside the Extra title, and capitals do not matter
  merged = mergeEvents([bandDay('doyenne east', 2026, 10, 17)], [extra({ title: 'DOYENNE EAST - Day 1', startDate: '2026-10-17' })], newYork, now);
  assert.deepEqual(titlesOf(merged), ['doyenne east']);

  // the same title
  merged = mergeEvents([bandDay('THOR East', 2026, 10, 18)], [extra({ title: 'thor east', startDate: '2026-10-18' })], newYork, now);
  assert.deepEqual(titlesOf(merged), ['THOR East']);
});

test('an Extra event stays when the date is different, or the titles are not alike', () => {
  const now = new Date('2026-10-04T15:00:00Z');
  const band = [bandDay('Doyenne East Regional', 2026, 10, 17)];

  assert.deepEqual(titlesOf(mergeEvents(band, [extra({ title: 'Doyenne East', startDate: '2026-10-18' })], newYork, now)), ['Doyenne East Regional', 'Doyenne East']);
  assert.deepEqual(titlesOf(mergeEvents(band, [extra({ title: 'THOR East', startDate: '2026-10-17' })], newYork, now)), ['Doyenne East Regional', 'THOR East']);
  assert.deepEqual(titlesOf(mergeEvents(band, [extra({ title: 'Doyenne West', startDate: '2026-10-17' })], newYork, now)), ['Doyenne East Regional', 'Doyenne West']);
});

test('a BAND event on any day of a several day Extra event with the same name hides the Extra event, and an empty title matches nothing', () => {
  const now = new Date('2027-03-01T15:00:00Z');
  const weekend = extra({ title: 'Wake County Event', startDate: '2027-04-02', endDate: '2027-04-04' });

  assert.deepEqual(titlesOf(mergeEvents([bandDay('Host: Wake County Event', 2027, 4, 3)], [weekend], newYork, now)), ['Host: Wake County Event']);
  assert.deepEqual(titlesOf(mergeEvents([bandDay('Wake County Event', 2027, 4, 5)], [weekend], newYork, now)).sort(), ['Wake County Event', 'Wake County Event']);
  assert.deepEqual(titlesOf(mergeEvents([bandDay('', 2027, 4, 3)], [weekend], newYork, now)), ['Wake County Event', '']);
});

test('rangeLabel writes one day, a range in one month, and a range over two months', () => {
  assert.equal(rangeLabel('2027-04-02', '2027-04-02'), 'Apr 2');
  assert.equal(rangeLabel('2027-04-02', '2027-04-04'), 'Apr 2-4');
  assert.equal(rangeLabel('2026-12-30', '2027-01-02'), 'Dec 30-Jan 2');
  assert.equal(rangeLabel('2027-03-31', '2027-04-01'), 'Mar 31-Apr 1');
  assert.equal(rangeLabel('2027-04-09', '2027-04-10'), 'Apr 9-10');
  assert.equal(rangeLabel('2027-04-02', '2027-04-01'), 'Apr 2', 'a last day before the first is one day');
});

test('rangeText is in capitals for an event of several days and empty for one day', () => {
  assert.equal(rangeText({ firstDay: '2027-04-02', lastDay: '2027-04-04' }), 'APR 2-4');
  assert.equal(rangeText({ firstDay: '2026-12-30', lastDay: '2027-01-02' }), 'DEC 30-JAN 2');
  assert.equal(rangeText({ firstDay: '2027-04-02', lastDay: '2027-04-02' }), '');
  assert.equal(rangeText({}), '');

  const merged = mergeEvents([bandDay('[Band]', 2027, 4, 2, 4)], [], newYork, new Date('2027-03-01T15:00:00Z'));
  assert.equal(rangeText(merged[0]), 'APR 2-4');
});

test('timeText is empty for an all-day event, so only its date shows', () => {
  assert.equal(timeText({ allDay: true, start: new Date(2027, 3, 2) }), '');
  assert.equal(timeText({ allDay: false, start: new Date(2027, 0, 9, 18, 30) }), '6:30 PM');
  assert.equal(timeText({ allDay: false, start: new Date(2027, 0, 9, 0, 5).toISOString() }), '12:05 AM');
});

// The two panels write times on the computer's own clock, as they do for BAND
// events, so these tests use the computer's own time zone for the Extra events.
// (On the Mini the two are the same: rebuilding-the-mini.md sets the zone.)
const computerZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;

// The two panels draw the merged list. A stand-in host takes the markup.
function drawn(panel, content) {
  const host = { innerHTML: '' };
  let markup = '';
  withFakePage(() => {
    panel.mount(host, content);
    markup = host.innerHTML;
  });
  return markup;
}

test('the Events panel shows an all-day event with its date and no time, and a range for several days', () => {
  const now = new Date();
  const soon = new Date(now.getFullYear() + 1, 3, 2); // next 2 April, so nothing has finished
  const first = soon.getFullYear() + '-04-02';
  const merged = mergeEvents([], [
    extra({ title: 'Winterfest', startDate: first }),
    extra({ title: 'Host: Wake County Event', startDate: first, endDate: soon.getFullYear() + '-04-04', location: 'Holly Springs HS' }),
    extra({ title: 'Evening', startDate: first, startTime: '18:30', location: 'Cafeteria' }),
  ], computerZone, now);

  const markup = drawn(eventsPanel, { events: merged });
  assert.ok(markup.includes('Winterfest'));
  assert.ok(markup.includes('APR 2-4 · Holly Springs HS'), 'a range, then the place');
  assert.ok(markup.includes('6:30 PM · Cafeteria'), 'a time, then the place');
  assert.ok(!markup.includes('ALL DAY'), 'no all-day wording and no time');
  assert.ok(!/12:00 AM/.test(markup));

  // the row of an all-day event with no place has no second line
  const rows = markup.split('class="row"').slice(1);
  const winterfest = rows.filter(row => row.includes('Winterfest'))[0];
  assert.ok(!winterfest.includes('event-when'), 'no empty second line');
});

test('the Next event tile shows the date only for an all-day event, a range for several days, and the time for a timed one', () => {
  const now = new Date();
  const year = now.getFullYear() + 1;
  const tile = fields => drawn(nextEventPanel, { events: mergeEvents([], [extra(fields)], computerZone, now) });

  const oneDay = tile({ title: 'Game Drop', startDate: year + '-01-09' });
  assert.ok(oneDay.includes('Game Drop'));
  assert.ok(/class="when">[A-Z]{3} JAN 9<\/div>/.test(oneDay), oneDay);

  const range = tile({ title: 'Weekend', startDate: year + '-04-02', endDate: year + '-04-04', location: 'Holly Springs HS' });
  assert.ok(/class="when">APR 2-4<\/div>/.test(range), range);
  assert.ok(range.includes('Holly Springs HS'));

  const timed = tile({ title: 'Evening', startDate: year + '-01-09', startTime: '18:30' });
  assert.ok(/class="when">[A-Z]{3} JAN 9 · \d{1,2}:\d\d [AP]M<\/div>/.test(timed), timed);
});

test('the Events panel and the Next event tile have nothing to show once the only event is over', () => {
  const content = { events: mergeEvents([], [extra({ startDate: '2020-05-05' })], newYork, new Date()) };
  assert.deepEqual(content.events, []);
  assert.equal(eventsPanel.hasContent(content), false);
  assert.equal(nextEventPanel.hasContent(content), false);
});

test('shell.js merges the events when content changes and once a minute', () => {
  const shell = fs.readFileSync(path.join(dashboardFolder, 'shell.js'), 'utf8');
  assert.ok(shell.includes("import { mergeEvents } from './core/events.js';"));
  assert.ok(shell.includes('content.events = mergedEvents();'), 'rebuild() should merge');
  assert.ok(/setInterval\(\(\) => \{\s*if \(content\) content\.events = mergedEvents\(\);\s*\}, 60 \* 1000\);/.test(shell), 'a timer should merge once a minute');
  assert.ok(shell.includes('base.theme.timeZone'), 'the Theme time zone should be used');
});

// The Mini's name and addresses, shown while the status says OFFLINE
// (core/device.js). The first tests are the pure part: device.json in, up to
// two lines of text out.

const fullDevice = { hostname: 'hawktimus-mini', wifi: '192.168.1.23', tailscale: '100.101.102.103', time: '2026-10-02T15:00:00Z' };

test('deviceLines gives the name and both addresses on one line, and the ssh line with the Tailscale address', () => {
  assert.deepEqual(deviceLines(fullDevice), [
    'hawktimus-mini · Wi-Fi 192.168.1.23 · Tailscale 100.101.102.103',
    'ssh hawktimus@100.101.102.103',
  ]);
});

test('deviceLines uses the Wi-Fi address for ssh when there is no Tailscale address', () => {
  const lines = deviceLines({ hostname: 'hawktimus-mini', wifi: '192.168.1.23', tailscale: '' });
  assert.deepEqual(lines, ['hawktimus-mini · Wi-Fi 192.168.1.23', 'ssh hawktimus@192.168.1.23']);
});

test('deviceLines leaves out what is empty, and gives no ssh line when both addresses are empty', () => {
  assert.deepEqual(deviceLines({ hostname: 'hawktimus-mini', wifi: '', tailscale: '' }), ['hawktimus-mini']);
  assert.deepEqual(deviceLines({ hostname: '', wifi: '', tailscale: '100.64.0.9' }), ['Tailscale 100.64.0.9', 'ssh hawktimus@100.64.0.9']);
  assert.deepEqual(deviceLines({ hostname: '', wifi: '', tailscale: '' }), []);
});

test('deviceLines gives nothing for a file that is not an object, and tidyDevice drops values that are not names or addresses', () => {
  [null, undefined, 'text', 42, [], true].forEach(raw => {
    assert.deepEqual(deviceLines(raw), []);
  });

  assert.deepEqual(tidyDevice({ hostname: 7, wifi: ['192.168.1.2'], tailscale: null }), { hostname: '', wifi: '', tailscale: '' });
  assert.deepEqual(tidyDevice({ hostname: 'a b', wifi: '192.168.1', tailscale: '1.2.3.4; reboot' }), { hostname: '', wifi: '', tailscale: '' });
  assert.deepEqual(tidyDevice({ hostname: '<b>x</b>', wifi: 'fe80::1', tailscale: '' }), { hostname: '', wifi: '', tailscale: '' });
  assert.deepEqual(tidyDevice({ hostname: ' mini ', wifi: ' 10.0.0.5 ' }), { hostname: 'mini', wifi: '10.0.0.5', tailscale: '' });
});

test('tidyDevice cuts a very long name so the addresses after it still fit', () => {
  const device = tidyDevice({ hostname: 'a'.repeat(63), wifi: '10.0.0.5' });
  assert.equal(device.hostname.length, 24);
  assert.equal(device.wifi, '10.0.0.5');
});

test('loginAddress prefers Tailscale, then Wi-Fi, then nothing', () => {
  assert.equal(loginAddress({ wifi: '10.0.0.5', tailscale: '100.1.1.1' }), '100.1.1.1');
  assert.equal(loginAddress({ wifi: '10.0.0.5', tailscale: '' }), '10.0.0.5');
  assert.equal(loginAddress({ wifi: '', tailscale: '' }), '');
});

// The strip itself, with a stand-in for the page, a clock and a fetch

function fakeStrip() {
  const strip = { hidden: true, children: [{ textContent: '' }, { textContent: '' }] };
  globalThis.document = { getElementById: id => (id === 'device-info' ? strip : null) };
  return strip;
}

function shownText(strip) {
  return strip.hidden ? null : strip.children.map(row => row.textContent);
}

async function withStrip(run) {
  await inWorld(async world => {
    const strip = fakeStrip();
    try {
      await run(world, strip);
    } finally {
      showDeviceInfo(false);
      delete globalThis.document;
    }
  });
}

test('the strip reads device.json when the status shows, uses no cache, and shows the two lines', () => withStrip(async (world, strip) => {
  world.handler = async () => jsonResponse(fullDevice);

  showDeviceInfo(true);
  await settle();

  assert.equal(world.fetches.length, 1);
  assert.ok(world.fetches[0].url.endsWith('data/live/device.json'), world.fetches[0].url);
  assert.equal(deviceFile, 'data/live/device.json');
  assert.equal(world.fetches[0].options.cache, 'no-store');
  assert.deepEqual(shownText(strip), [
    'hawktimus-mini · Wi-Fi 192.168.1.23 · Tailscale 100.101.102.103',
    'ssh hawktimus@100.101.102.103',
  ]);
}));

test('the strip reads nothing and shows nothing while the status is not showing', () => withStrip(async (world, strip) => {
  world.handler = async () => jsonResponse(fullDevice);

  showDeviceInfo(false);
  showDeviceInfo(false);
  await world.advance(5 * 60 * 1000);

  assert.equal(world.fetches.length, 0);
  assert.equal(world.timers.length, 0);
  assert.equal(shownText(strip), null);
}));

test('the strip reads the file again every minute while it stays shown, and asking to show it twice starts one timer', () => withStrip(async (world, strip) => {
  let reads = 0;
  world.handler = async () => {
    reads += 1;
    return jsonResponse(reads === 1 ? fullDevice : { hostname: 'hawktimus-mini', wifi: '10.0.0.8', tailscale: '' });
  };

  showDeviceInfo(true);
  showDeviceInfo(true);
  await settle();
  assert.equal(reads, 1);
  assert.equal(world.timers.length, 1);
  assert.equal(refreshSeconds, 60);

  await world.advance(59 * 1000);
  assert.equal(reads, 1);
  await world.advance(1000);
  assert.equal(reads, 2);
  assert.deepEqual(shownText(strip), ['hawktimus-mini · Wi-Fi 10.0.0.8', 'ssh hawktimus@10.0.0.8']);

  await world.advance(60 * 1000);
  assert.equal(reads, 3);
}));

test('the strip is hidden at once when the status goes away, and the reading stops', () => withStrip(async (world, strip) => {
  world.handler = async () => jsonResponse(fullDevice);

  showDeviceInfo(true);
  await settle();
  assert.notEqual(shownText(strip), null);

  showDeviceInfo(false);
  assert.equal(shownText(strip), null);
  assert.deepEqual(strip.children.map(row => row.textContent), ['', '']);
  assert.equal(world.timers.length, 0);

  await world.advance(5 * 60 * 1000);
  assert.equal(world.fetches.length, 1);
  assert.equal(shownText(strip), null);
}));

test('an answer that comes after the status went away is thrown away', () => withStrip(async (world, strip) => {
  let answer = null;
  world.handler = () => new Promise(resolve => { answer = resolve; });

  showDeviceInfo(true);
  await settle();
  showDeviceInfo(false);

  answer(jsonResponse(fullDevice));
  await settle();
  assert.equal(shownText(strip), null);
}));

test('a missing file, a file that is not JSON and a network error all show nothing, and a good file later shows again', () => withStrip(async (world, strip) => {
  const answers = [
    async () => jsonResponse({}, 404),
    async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token'); } }),
    async () => { throw new TypeError('Failed to fetch'); },
    async () => jsonResponse({ hostname: '', wifi: '', tailscale: '' }),
    async () => jsonResponse(fullDevice),
  ];
  world.handler = async () => answers.shift()();

  showDeviceInfo(true);
  await settle();
  assert.equal(shownText(strip), null, 'a missing file');

  await world.advance(60 * 1000);
  assert.equal(shownText(strip), null, 'bad JSON');

  await world.advance(60 * 1000);
  assert.equal(shownText(strip), null, 'a network error');

  await world.advance(60 * 1000);
  assert.equal(shownText(strip), null, 'every value empty');

  await world.advance(60 * 1000);
  assert.deepEqual(shownText(strip)[1], 'ssh hawktimus@100.101.102.103');
  assert.equal(world.errors.length, 0, 'a missing file is not an error to report');
}));

test('shell.js shows the strip only for status.offline, and index.html has the strip hidden to begin with', () => {
  const shell = fs.readFileSync(path.join(dashboardFolder, 'shell.js'), 'utf8');
  assert.ok(shell.includes("import { showDeviceInfo } from './core/device.js';"));
  assert.ok(shell.includes('showDeviceInfo(Boolean(status && status.offline));'), 'rebuild() should pass status.offline');

  const page = fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8');
  assert.ok(/<div id="device-info" hidden>\s*<div><\/div>\s*<div><\/div>\s*<\/div>/.test(page), 'index.html should have the empty hidden strip');
  assert.ok(page.indexOf('id="device-info"') > page.indexOf('id="stage"'), 'the strip comes after the stage');
  assert.ok(page.indexOf('id="device-info"') < page.indexOf('id="overlay"'), 'the strip comes before the overlay');
});

test('the strip text is at least 44px, has no animation, and is only shown by the hidden switch', () => {
  const css = fs.readFileSync(path.join(dashboardFolder, 'base.css'), 'utf8');
  const rule = css.match(/#device-info \{([^}]*)\}/);
  assert.ok(rule, 'base.css should have the #device-info rule');
  assert.ok(rule[1].includes('font: 600 var(--size-label)/44px'), 'the text is the 44px label size');
  assert.ok(!/animation|transition|shadow|filter/.test(rule[1]), 'no animation, shadow or blur');
  assert.ok(!/display:/.test(rule[1]), 'a display value would override the hidden switch');
});

test('hasText is false for a missing field and for one with only spaces', () => {
  assert.equal(hasText(undefined), false);
  assert.equal(hasText(null), false);
  assert.equal(hasText(''), false);
  assert.equal(hasText('   '), false);
  assert.equal(hasText('Go'), true);
  assert.equal(hasText(0), true);
});

test('escapeHtml turns markup into plain text and a missing field into nothing', () => {
  assert.equal(escapeHtml('<b>"A" & B</b>'), '&lt;b&gt;&quot;A&quot; &amp; B&lt;/b&gt;');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(42), '42');
});

test('makeTurns gives each item in order, starts again after the last, and copes with an empty list', () => {
  const next = makeTurns();
  assert.equal(next([]), null);
  assert.deepEqual([next(['a', 'b', 'c']), next(['a', 'b', 'c']), next(['a', 'b', 'c']), next(['a', 'b', 'c'])], ['a', 'b', 'c', 'a']);
});

test('makeTurns keeps counting when the list gets shorter between turns', () => {
  const next = makeTurns();
  next(['a', 'b', 'c', 'd']);
  next(['a', 'b', 'c', 'd']);
  next(['a', 'b', 'c', 'd']);
  assert.equal(next(['a', 'b']), 'b');
  assert.equal(next(['a', 'b']), 'a');
  assert.equal(next(['a']), 'a');
});

test('every script in dashboard/ uses nothing newer than ES2017', () => {
  const files = javascriptFilesIn(dashboardFolder);
  const names = files.map(file => path.relative(dashboardFolder, file).split(path.sep).join('/'));
  ['shell.js', 'perf.js', 'core/sanity.js', 'panels/tasks/tasks.js'].forEach(name => {
    assert.ok(names.includes(name), 'the search did not find ' + name);
  });

  const problems = [];
  files.forEach(file => {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      newerThanEs2017.forEach(([pattern, name]) => {
        if (pattern.test(line)) problems.push(path.relative(dashboardFolder, file) + ' line ' + (index + 1) + ': ' + name);
      });
    });
  });
  assert.deepEqual(problems, []);
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
