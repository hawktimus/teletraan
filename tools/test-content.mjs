// Tests for the content reader (dashboard/core/content.js and sanity.js).
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

  const base = pathToFileURL(path.join(root, 'dashboard')).href + '/';
  return {
    config: await import(base + 'config.js'),
    content: await import(base + 'core/content.js'),
    sanity: await import(base + 'core/sanity.js'),
    text: await import(base + 'core/text.js'),
    turns: await import(base + 'core/turns.js'),
  };
}

// config.js as it is in the repository shows the sample content. live has
// useSampleContent switched off, so it reads from Sanity. noProject has a
// project ID that is empty, which also means sample content.
function changeConfig(text, anchor, replacement) {
  assert.ok(text.includes(anchor), 'config.js no longer has ' + anchor);
  return text.replace(anchor, replacement);
}

const sample = await loadCopy('sample', text => text);
const live = await loadCopy('live', text => changeConfig(text, 'useSampleContent = true', 'useSampleContent = false'));
const noProject = await loadCopy('no-project', text => {
  const reading = changeConfig(text, 'useSampleContent = true', 'useSampleContent = false');
  return reading.replace(/projectId: '[^']*'/, "projectId: ''");
});
assert.equal(sample.config.useSampleContent, true);
assert.equal(sample.config.sampleMode, true);
assert.equal(live.config.sampleMode, false);
assert.equal(noProject.config.sampleMode, true);

const { normalizeContent, contentQuery, queryUrl, liveEventsUrl } = live.sanity;
const { normalizeSample } = sample.sanity;
const { withDefaults, isVisible, visibleItems, startContent } = live.content;
const { escapeHtml, hasText } = live.text;
const { makeTurns } = live.turns;

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
      crt: { on: false, everyMinutes: 6 },
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
  assert.deepEqual(settings.crt, { on: false, everyMinutes: 6 });
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
    { role: 'Coach', name: '[Coach A]', order: 1 },
    { role: 'Mentor', name: '[Mentor A]' },
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
  ['frameMetal', 'glint', 'pageSeconds', 'nameTransform', 'nameEvery'].forEach(name => {
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
  assert.deepEqual(content.settings.crt, { on: false, everyMinutes: 4 });
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
  assert.deepEqual(live.config.limits, { pageSeconds: { min: 8, max: 120 }, nameEvery: { min: 30, max: 900 } });

  // the starting rows follow pageSeconds, so they carry no seconds of their own
  ['grid1', 'grid2'].forEach(area => {
    assert.ok(defaults.rotation[area].length > 0);
    defaults.rotation[area].forEach(step => assert.equal('seconds' in step, false, step.panel));
  });
  assert.equal('tickerSeconds' in defaults.rotation, false);

  const empty = withDefaults({}).settings;
  ['frameMetal', 'glint', 'pageSeconds', 'nameTransform', 'nameEvery'].forEach(name => {
    assert.equal(empty[name], defaults[name], name);
  });
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

test('the name effect every so many seconds is a number from 30 to 900, and anything else is moved into range or becomes 300', () => {
  checkRange('nameEvery', 30, 900, 300, [31, 300, 600, 899]);
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

test('the sample content file carries the new settings and they come through unchanged', () => {
  const file = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  const settings = normalizeSample(file).settings;

  ['frameMetal', 'glint', 'pageSeconds', 'nameTransform', 'nameEvery'].forEach(name => {
    assert.ok(name in file.settings, 'the sample content has no ' + name);
    assert.equal(settings[name], file.settings[name], name);
  });
});

test('sample content is used when the project ID is empty or useSampleContent is on', () => {
  assert.equal(sample.config.sampleMode, true);
  assert.equal(sample.config.dataFolder, sample.config.sampleFolder);
  assert.equal(noProject.config.sampleMode, true);
  assert.equal(live.config.sampleMode, false);
  assert.equal(live.config.dataFolder, live.config.liveFolder);
  assert.notEqual(live.config.sanity.projectId, '');
});

test('sample mode reads the sample file and reads it again every 30 seconds', async () => {
  await inWorld(async world => {
    const file = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
    world.handler = async () => jsonResponse(copyOf(file));

    const first = await sample.content.startContent(world.onChange);
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

    const first = await sample.content.startContent(world.onChange);
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

    const first = await sample.content.startContent(world.onChange);
    assert.deepEqual(first.content, sample.content.withDefaults({}));
    assert.deepEqual(first.status, { source: 'sample', updated: null, offline: true });
    assert.equal(world.errors.length, 1);
  });
});

test('sanity: with no saved copy it waits for Sanity, saves the answer and listens for changes', async () => {
  await inWorld(async world => {
    const fixture = sanityFixture();
    world.handler = async () => sanityReply(fixture);

    const first = await startContent(world.onChange);
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
    await startContent(world.onChange);

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

    const first = await startContent(world.onChange);
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

    const first = await startContent(world.onChange);
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

    const first = await startContent(world.onChange);
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
    await startContent(world.onChange);

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
    await startContent(world.onChange);
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
    await startContent(world.onChange);
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

    await startContent(world.onChange);
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
      const first = await startContent(world.onChange);
      assert.deepEqual(first.content, withDefaults({}), name);
      assert.equal(first.status.offline, true, name);
      assert.equal(world.errors.length, 1, name);

      saveCopy(world, sanityFixture(), start);
      const withCopy = await startContent(world.onChange);
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

      const first = await startContent(world.onChange);
      assert.equal(first.status.source, 'sanity', 'saved text: ' + text);
      assert.equal(first.content.tasks.length, 4, 'saved text: ' + text);
    });
  }
});

test('sanity: a saved copy without a time still starts the screen', async () => {
  await inWorld(async world => {
    world.storage.set(storageKey, JSON.stringify({ raw: sanityFixture() }));
    const first = await startContent(world.onChange);
    assert.equal(first.status.source, 'cache');
    assert.equal(first.status.updated, null);
  });
});

test('sanity: blocked storage does not stop the screen', async () => {
  await inWorld(async world => {
    world.storageBroken = true;
    world.handler = async () => sanityReply(sanityFixture());

    const first = await startContent(world.onChange);
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

    await startContent(world.onChange);
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

    await startContent(world.onChange);
    assert.equal(world.errors.length, 1);
    await world.advance(5 * minute);
    assert.equal(world.fetches.length, 2);
  });

  await inWorld(async world => {
    world.handler = async () => sanityReply(sanityFixture());
    await startContent(world.onChange);
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
    await startContent(() => {
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
