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

  // the Events panel and the Next event tile draw the merged list, and the Roster panel draws the roster pages, so they are tested too.
  // The Photo and Team Leads panels are here to check that they follow the two size settings.
  // The Daily Agenda panel is here for the rows it draws from the plan and the booked talks.
  // The rest are here to check that each one leaves out the items of the other team (the Teams section).
  ['events/events.js', 'next-event/next-event.js', 'roster/roster.js', 'leadership/leadership.js', 'photo/photo.js', 'team-leads/team-leads.js', 'tonight/tonight.js',
    'tasks/tasks.js', 'task-counts/task-counts.js', 'spotlight/spotlight.js', 'sponsor-feature/sponsor-feature.js', 'sponsor-logo/sponsor-logo.js', 'custom/custom.js', 'ticker/ticker.js'].forEach(file => {
    fs.mkdirSync(path.join(root, 'dashboard/panels', path.dirname(file)), { recursive: true });
    fs.copyFileSync(path.join(dashboardFolder, 'panels', file), path.join(root, 'dashboard/panels', file));
  });

  const base = pathToFileURL(path.join(root, 'dashboard')).href + '/';
  return {
    config: await import(base + 'config.js'),
    connection: await import(base + 'core/connection.js'),
    content: await import(base + 'core/content.js'),
    device: await import(base + 'core/device.js'),
    events: await import(base + 'core/events.js'),
    eventsPanel: await import(base + 'panels/events/events.js'),
    nextEventPanel: await import(base + 'panels/next-event/next-event.js'),
    rosterPanel: await import(base + 'panels/roster/roster.js'),
    leadershipPanel: await import(base + 'panels/leadership/leadership.js'),
    photoPanel: await import(base + 'panels/photo/photo.js'),
    teamLeadsPanel: await import(base + 'panels/team-leads/team-leads.js'),
    tonightPanel: await import(base + 'panels/tonight/tonight.js'),
    tasksPanel: await import(base + 'panels/tasks/tasks.js'),
    taskCountsPanel: await import(base + 'panels/task-counts/task-counts.js'),
    spotlightPanel: await import(base + 'panels/spotlight/spotlight.js'),
    sponsorFeaturePanel: await import(base + 'panels/sponsor-feature/sponsor-feature.js'),
    sponsorLogoPanel: await import(base + 'panels/sponsor-logo/sponsor-logo.js'),
    customPanel: await import(base + 'panels/custom/custom.js'),
    tickerPanel: await import(base + 'panels/ticker/ticker.js'),
    layout: await import(base + 'core/layout.js'),
    look: await import(base + 'core/look.js'),
    marks: await import(base + 'core/marks.js'),
    packExtras: await import(base + 'core/pack-extras.js'),
    images: await import(base + 'core/images.js'),
    photos: await import(base + 'core/photos.js'),
    portrait: await import(base + 'core/portrait.js'),
    presentation: await import(base + 'core/presentation.js'),
    roster: await import(base + 'core/roster.js'),
    overlays: await import(base + 'themes/overlays/registry.js'),
    sanity: await import(base + 'core/sanity.js'),
    source: await import(base + 'core/source.js'),
    style: await import(base + 'core/style.js'),
    text: await import(base + 'core/text.js'),
    theme: await import(base + 'core/theme.js'),
    teams: await import(base + 'core/teams.js'),
    turns: await import(base + 'core/turns.js'),
  };
}

// noProject has a project ID that is empty, so there is nothing to ask.
const live = await loadCopy('live', text => text);
const noProject = await loadCopy('no-project', text => text.replace(/projectId: '[^']*'/, "projectId: ''"));
assert.equal(noProject.config.sanity.projectId, '');

const { normalizeContent, contentQuery, queryUrl, liveEventsUrl, probeUrl, normalizeSample } = live.sanity;
const { withDefaults, isVisible, visibleItems, startContent, startSanityContent, startSampleContent } = live.content;
const { askForSample, chosenSource } = live.source;
const { escapeHtml, hasText } = live.text;
const { pageSwitchesFor } = live.look;
const { tidyDevice, deviceLines, loginAddress, showDeviceInfo, deviceFile, refreshSeconds } = live.device;
const { classifyFailure, connectionLines, itemCounts, reasonText, reasons, drawConnection } = live.connection;
const { mergeEvents, rangeLabel, eventDate, timeText } = live.events;
const eventsPanel = live.eventsPanel;
const nextEventPanel = live.nextEventPanel;
const tonightPanel = live.tonightPanel;
const teamsModule = live.teams;
const { makeTurns, makePages } = live.turns;
const { tidyPhoto, photoUrl, preloadImages, screenPhotoUrl, photoFocus, photoMaxWidth } = live.images;
const { photosToShow, photoKey, newestFirst, creditText, makePhotoQueue, ownSeconds } = live.photos;
const { photoAddress, personNamed, slotMarkup, silhouetteMarkup } = live.portrait;
const { rosterPages, makeRosterTurns, membersPerPage, rowsPerColumn } = live.roster;

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
      logoAnimations: false,
      logoEntrance: false,
      logoSpin: false,
      logoSpinEvery: 100,
      logoSpinDuration: 3,
      logoHawk: false,
      logoHawkEvery: 60,
      logoHawkDuration: 20,
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

    // what the photos part of contentQuery answers: the underscore names are asked for under plain ones
    photos: [
      { id: 'ph1', createdAt: '2026-09-20T10:00:00Z', caption: '[Photo caption]', credit: '[Name]', show: true, image: photoRecord() },
      { id: 'ph2', createdAt: '2026-09-10T10:00:00Z', caption: '', credit: null, show: false, expires: null, image: photoRecord({ width: 600, height: 900 }) },
      { id: 'ph3', createdAt: '2026-09-01T10:00:00Z', expires: '2020-01-01T00:00:00.000Z', image: photoRecord() },
      { id: 'ph4', createdAt: '2026-08-01T10:00:00Z', image: null },
    ],

    plans: [
      document('plan', 'l1', { heading: '[Hidden plan]', show: false }),
      document('plan', 'l2', { heading: '[Expired plan]', expires: '2020-01-01T00:00:00.000Z' }),
      document('plan', 'l3', {
        heading: "[Meeting heading]",
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

  // The sample also carries a Meeting day to show its shape. The booking script reads those, not the screen.
  // And the drawings of the boot and shutdown screens, which the screen does not read.
  assert.deepEqual(Object.keys(content).sort(), Object.keys(sampleContent).filter(name => name !== 'presentationDays' && name !== 'console').sort());
  assert.deepEqual(content.team, { name: '[Team name]', number: '1234', school: live.config.defaultTeam.school });

  const settings = content.settings;
  assert.equal(settings.motion, 'calm');
  assert.equal(settings.speed, 'slow');
  assert.equal(settings.frameMetal, 'silver');
  assert.equal(settings.glint, false);
  assert.equal(settings.pageSeconds, 30);
  assert.deepEqual(
    [settings.logoAnimations, settings.logoEntrance, settings.logoSpin, settings.logoSpinEvery, settings.logoSpinDuration, settings.logoHawk, settings.logoHawkEvery, settings.logoHawkDuration],
    [false, false, false, 100, 3, false, 60, 20]
  );
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
    { name: '[Subteam A]', lead: '[Lead A]', spotlight: true, spotlightHeadline: '[Headline]', spotlightText: '[Spotlight text]', order: 1, members: [] },
    { name: '[Subteam B]', lead: '[Lead B]', spotlight: false, order: 2, members: [] },
  ]);

  assert.deepEqual(content.people, [
    { role: 'Coach', name: '[Coach A]', order: 1, showPhoto: true },
    { role: 'Mentor', name: '[Mentor A]', showPhoto: true },
  ]);

  // hidden and expired photos stay in the list, like every other item. A photo with no picture is dropped.
  assert.deepEqual(content.photos, [
    { id: 'ph1', createdAt: '2026-09-20T10:00:00Z', caption: '[Photo caption]', credit: '[Name]', show: true, address: photoBase + '?w=1920&fit=max&auto=format', focus: { x: 50, y: 50 } },
    { id: 'ph2', createdAt: '2026-09-10T10:00:00Z', show: false, address: photoBase + '?w=1920&fit=max&auto=format', focus: { x: 50, y: 50 } },
    { id: 'ph3', createdAt: '2026-09-01T10:00:00Z', expires: '2020-01-01T00:00:00.000Z', address: photoBase + '?w=1920&fit=max&auto=format', focus: { x: 50, y: 50 } },
  ]);

  assert.deepEqual(content.plan, {
    heading: "[Meeting heading]",
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

test('normalizeContent maps every kind of extra panel block', () => {
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
  assert.equal(content.plan.heading, "[Meeting heading]");

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
    { heading: '[Topic E]', date: '2026-10-03' },
    { heading: '[Today]', date: '2026-10-02' },
    { heading: '[No date]' },
  ];
  assert.equal(normalizeContent(planResult(plans), today).plan.heading, '[Today]');

  const withoutToday = plans.filter(plan => plan.heading !== '[Today]');
  assert.equal(normalizeContent(planResult(withoutToday), today).plan.heading, '[No date]');

  const onlyOtherDays = withoutToday.filter(plan => plan.date);
  assert.equal(normalizeContent(planResult(onlyOtherDays), today).plan, null);

  const lastMinute = new Date(2026, 9, 2, 23, 59);
  assert.equal(normalizeContent(planResult(plans), lastMinute).plan.heading, '[Today]');
  const nextMorning = new Date(2026, 9, 3, 0, 1);
  assert.equal(normalizeContent(planResult(plans), nextMorning).plan.heading, '[Topic E]');
});

test('normalizeContent skips a hidden or expired plan for today, and reads a date it cannot understand as no date', () => {
  const plans = [
    { heading: '[Hidden]', date: '2026-10-02', show: false },
    { heading: '[Expired]', date: '2026-10-02', expires: '2026-10-02T09:00:00' },
    { heading: '[Odd date]', date: 'next friday' },
    { heading: '[Today]', date: '2026-10-02' },
  ];
  assert.equal(normalizeContent(planResult(plans), today).plan.heading, '[Odd date]');
  assert.equal(normalizeContent(planResult(plans.slice(0, 2).concat(plans[3])), today).plan.heading, '[Today]');
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
  logoSettingNames.concat(['frameMetal', 'glint', 'look', 'pageSeconds', 'pageChangeStyle', 'breakSeconds', 'frameFinish', 'silverChance', 'photoOrder', 'photoSeconds'], nightSettingNames).forEach(name => {
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
// The names of the logo settings: the master switch, the entrance, the spin, the
// flying hawk and the name effect
const logoSettingNames = [
  'logoAnimations', 'logoEntrance', 'logoSpin', 'logoSpinEvery', 'logoSpinDuration',
  'logoHawk', 'logoHawkEvery', 'logoHawkDuration', 'nameTransform', 'nameEvery', 'nameDuration',
];

// The names of the night mode settings. The start and end times are fixed in core/constants.js and are not settings.
const nightSettingNames = ['nightEnabled', 'nightStyle', 'nightLogoWidth', 'nightSpeed', 'nightPreview'];

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
  assert.equal(defaults.look, 'polished');
  assert.equal(defaults.pageSeconds, 20);
  assert.equal(defaults.nameTransform, true);
  assert.equal(defaults.nameEvery, 300);
  assert.equal(defaults.nameDuration, 1.43);
  assert.deepEqual(defaults.crt, { on: true, everySeconds: 240, durationSeconds: 2.7 });

  // the logo settings: what the logo did before it had settings. The spin was every third pass of
  // the old 24 second show and took 1.6 seconds. The hawk was every pass and took 3 + 2 + 4 + 2.
  assert.equal(defaults.logoAnimations, true);
  assert.equal(defaults.logoEntrance, true);
  assert.deepEqual([defaults.logoSpin, defaults.logoSpinEvery, defaults.logoSpinDuration], [true, 3 * 24, 1.6]);
  assert.deepEqual([defaults.logoHawk, defaults.logoHawkEvery, defaults.logoHawkDuration], [true, 24, 3 + 2 + 4 + 2]);

  // the page change settings: take turns between the two page changes, 0.6 s to break and the same to
  // rebuild, gold on most changes and silver on one in ten
  assert.deepEqual(live.config.pageChangeStyles, ['alternate', 'slat', 'mechanical']);
  assert.deepEqual(live.config.frameFinishes, ['mostly-gold', 'alternate', 'gold', 'silver']);
  assert.deepEqual(
    [defaults.pageChangeStyle, defaults.breakSeconds, defaults.frameFinish, defaults.silverChance],
    ['alternate', 0.6, 'mostly-gold', 10]
  );

  assert.deepEqual(live.config.limits, {
    pageSeconds: { min: 8, max: 120 },
    nameEvery: { min: 0, shortest: 30, max: 900 },
    nameDuration: { min: 0.5, max: 10 },
    crtEvery: { min: 0, shortest: 30, max: 3600 },
    crtDuration: { min: 0.5, max: 10 },
    logoSpinEvery: { min: 0, shortest: 10, max: 3600 },
    logoSpinDuration: { min: 0.5, max: 10 },
    logoHawkEvery: { min: 0, shortest: 10, max: 3600 },
    logoHawkDuration: { min: 6, max: 30 },
    breakSeconds: { min: 0.3, max: 2 },
    silverChance: { min: 0, max: 100 },
    photoSeconds: { min: 6, max: 120 },
    portraitScale: { min: 60, max: 100 },
    photoScale: { min: 60, max: 100 },
    nightLogoWidth: { min: 120, max: 800 },
    demoSeconds: { min: 5, max: 300 },
    desktopChance: { min: 0, max: 100 },
    redEyesChance: { min: 0, max: 100 },
    desktopEveryHours: { min: 1, max: 1000 },
    redEyesEveryHours: { min: 1, max: 1000 },
    talkMinutes: { min: 5, max: 30 },
    alternateMinutes: { min: 1, max: 30 },
  });

  // the photo settings: random order, and 16 seconds a photo
  assert.deepEqual(live.config.photoOrders, ['random', 'newest-first']);
  assert.deepEqual([defaults.photoOrder, defaults.photoSeconds], ['random', 16]);

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
  logoSettingNames.concat(['frameMetal', 'glint', 'look', 'pageSeconds', 'pageChangeStyle', 'breakSeconds', 'frameFinish', 'silverChance'], nightSettingNames).forEach(name => {
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

// The Polish setting: polished, flat or plain (dashboard/core/look.js). The address
// parts are what shell.js reads from the page address, each null when it is not there.
const noAddress = { look: null, finish: null, glint: null };

test('look is polished, flat or plain, and anything else becomes polished', () => {
  assert.deepEqual(live.config.looks, ['polished', 'flat', 'plain']);
  assert.equal(live.config.defaultSettings.look, 'polished');

  live.config.looks.forEach(name => {
    settingsThrough({ look: name }).forEach(settings => assert.equal(settings.look, name));
  });

  [undefined, null, '', 'Flat', 'PLAIN', 'matte', 'toString', 'finish', 0, true, ['flat'], {}].forEach(value => {
    settingsThrough({ look: value }).forEach(settings => {
      assert.equal(settings.look, 'polished', JSON.stringify(value));
    });
  });
  assert.equal(normalizeContent({ settings: null }).settings.look, 'polished');
  assert.equal(withDefaults(null).settings.look, 'polished');

  // it is a setting of its own: Glint and Frame metal keep their values
  settingsThrough({ look: 'plain', glint: true, frameMetal: 'silver' }).forEach(settings => {
    assert.deepEqual([settings.look, settings.glint, settings.frameMetal], ['plain', true, 'silver']);
  });
});

test('Polished sets the metal finish and follows the Glint setting, Flat and Plain set the flat finish with no glint', () => {
  assert.deepEqual(pageSwitchesFor({ look: 'polished', glint: true }, noAddress), { look: 'polished', finish: 'metal', glint: 'on' });
  assert.deepEqual(pageSwitchesFor({ look: 'polished', glint: false }, noAddress), { look: 'polished', finish: 'metal', glint: 'off' });

  [true, false].forEach(glint => {
    assert.deepEqual(pageSwitchesFor({ look: 'flat', glint: glint }, noAddress), { look: 'flat', finish: 'flat', glint: 'off' });
    assert.deepEqual(pageSwitchesFor({ look: 'plain', glint: glint }, noAddress), { look: 'plain', finish: 'flat', glint: 'off' });
  });

  // a setting that is not a look is Polished, even when the function is given it uncleaned
  [undefined, null, '', 'matte', 0].forEach(value => {
    assert.deepEqual(pageSwitchesFor({ look: value, glint: true }, noAddress), { look: 'polished', finish: 'metal', glint: 'on' }, String(value));
  });
});

test('Polished sets nothing new: it is the look, the finish and the glint that index.html starts with', () => {
  const tag = fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8').match(/<html [^>]*>/)[0];
  const attribute = name => (tag.match(new RegExp(' data-' + name + '="([^"]*)"')) || [])[1];

  const starting = pageSwitchesFor(live.config.defaultSettings, noAddress);
  assert.deepEqual(starting, { look: attribute('look'), finish: attribute('finish'), glint: attribute('glint') });
  assert.equal(starting.look, 'polished');

  // the sample content has the look too, and it is Polished
  const sample = JSON.parse(fs.readFileSync(sampleFile, 'utf8')).settings;
  assert.equal(sample.look, 'polished');
  assert.deepEqual(pageSwitchesFor(normalizeSample({ settings: sample }).settings, noAddress), starting);
});

test('the address wins for one page: ?look= over the setting, ?finish= and ?glint= over what the look says', () => {
  const polished = { look: 'polished', glint: true };
  const flat = { look: 'flat', glint: true };

  // ?look= over the setting, whichever way round
  assert.deepEqual(pageSwitchesFor(polished, { look: 'plain', finish: null, glint: null }), { look: 'plain', finish: 'flat', glint: 'off' });
  assert.deepEqual(pageSwitchesFor({ look: 'plain', glint: true }, { look: 'polished', finish: null, glint: null }), { look: 'polished', finish: 'metal', glint: 'on' });
  assert.deepEqual(pageSwitchesFor({ look: 'plain', glint: false }, { look: 'polished', finish: null, glint: null }), { look: 'polished', finish: 'metal', glint: 'off' });

  // ?finish= changes the finish and nothing else, so the old addresses mean what they meant
  assert.deepEqual(pageSwitchesFor(polished, { look: null, finish: 'flat', glint: null }), { look: 'polished', finish: 'flat', glint: 'on' });
  assert.deepEqual(pageSwitchesFor(flat, { look: null, finish: 'metal', glint: null }), { look: 'flat', finish: 'metal', glint: 'off' });
  assert.deepEqual(pageSwitchesFor(polished, { look: 'plain', finish: 'metal', glint: null }), { look: 'plain', finish: 'metal', glint: 'off' });

  // ?glint= changes the glint and nothing else
  assert.deepEqual(pageSwitchesFor(polished, { look: null, finish: null, glint: 'off' }), { look: 'polished', finish: 'metal', glint: 'off' });
  assert.deepEqual(pageSwitchesFor({ look: 'polished', glint: false }, { look: null, finish: null, glint: 'on' }), { look: 'polished', finish: 'metal', glint: 'on' });
  assert.deepEqual(pageSwitchesFor(flat, { look: null, finish: null, glint: 'on' }), { look: 'flat', finish: 'flat', glint: 'on' });

  // an address that is not one of the words is ignored
  ['', 'matte', 'Flat', 'ON', 'true'].forEach(word => {
    assert.deepEqual(pageSwitchesFor(polished, { look: word, finish: word, glint: word }), { look: 'polished', finish: 'metal', glint: 'on' }, word);
    assert.deepEqual(pageSwitchesFor(flat, { look: word, finish: word, glint: word }), { look: 'flat', finish: 'flat', glint: 'off' }, word);
  });
});

test('every look with every address and every Glint setting gives words the stylesheets know', () => {
  const finishOf = { polished: 'metal', flat: 'flat', plain: 'flat' };
  const words = list => [null, '', 'matte'].concat(list);
  let combinations = 0;

  words(live.config.looks).forEach(settingLook => {
    [true, false].forEach(glintSetting => {
      words(live.config.looks).forEach(askedLook => {
        words(['metal', 'flat']).forEach(askedFinish => {
          words(['on', 'off']).forEach(askedGlint => {
            const settings = { look: settingLook, glint: glintSetting };
            const asked = { look: askedLook, finish: askedFinish, glint: askedGlint };
            const result = pageSwitchesFor(settings, asked);
            const label = JSON.stringify([settings, asked]);

            const look = [askedLook, settingLook].filter(word => live.config.looks.includes(word))[0] || 'polished';
            const finish = ['metal', 'flat'].includes(askedFinish) ? askedFinish : finishOf[look];
            const glint = ['on', 'off'].includes(askedGlint) ? askedGlint : look === 'polished' && glintSetting ? 'on' : 'off';
            assert.deepEqual(result, { look: look, finish: finish, glint: glint }, label);
            assert.deepEqual(Object.keys(result), ['look', 'finish', 'glint'], label);
            combinations += 1;
          });
        });
      });
    });
  });
  assert.equal(combinations, 6 * 2 * 6 * 5 * 5);

  // a look in config.js with no line in core/look.js would stop the screen, so every look must work
  live.config.looks.forEach(name => {
    assert.doesNotThrow(() => pageSwitchesFor({ look: name, glint: true }, noAddress), name);
  });
});

// The Style setting: original, cybertron or minimal (dashboard/core/style.js has the page side)

test('style is original, cybertron or minimal, and anything else becomes original', () => {
  assert.deepEqual(live.config.styles, ['original', 'cybertron', 'minimal']);
  assert.equal(live.config.defaultSettings.style, 'original');

  live.config.styles.forEach(name => {
    settingsThrough({ style: name }).forEach(settings => assert.equal(settings.style, name));
  });

  [undefined, null, '', 'Cybertron', 'MINIMAL', 'bar', 'toString', 'look', 0, true, ['minimal'], {}].forEach(value => {
    settingsThrough({ style: value }).forEach(settings => {
      assert.equal(settings.style, 'original', JSON.stringify(value));
    });
  });
  assert.equal(normalizeContent({ settings: null }).settings.style, 'original');
  assert.equal(withDefaults(null).settings.style, 'original');

  // it is a setting of its own: Look and Frame metal keep their values
  settingsThrough({ style: 'cybertron', look: 'plain', frameMetal: 'silver' }).forEach(settings => {
    assert.deepEqual([settings.style, settings.look, settings.frameMetal], ['cybertron', 'plain', 'silver']);
  });
});

test('the sample content has the original style, which is what index.html starts with', () => {
  const sample = JSON.parse(fs.readFileSync(sampleFile, 'utf8')).settings;
  assert.equal(sample.style, 'original');
  assert.equal(normalizeSample({ settings: sample }).settings.style, 'original');
  assert.ok(/<html [^>]*data-style="original"/.test(fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8')));
});

test('savedStyle gives the style in the saved copy, and nothing when the copy, the style or the storage is missing or broken, or the screen starts on the sample', async () => {
  await inWorld(async world => {
    assert.equal(live.content.savedStyle(), null, 'nothing saved');

    saveCopy(world, { settings: { style: 'cybertron' } }, start);
    assert.equal(live.content.savedStyle(), 'cybertron');
    saveCopy(world, { settings: { style: 'minimal', look: 'flat' } }, start);
    assert.equal(live.content.savedStyle(), 'minimal');

    [{ settings: {} }, { settings: null }, { settings: 'oops' }, {}, { settings: { style: '' } }].forEach(raw => {
      saveCopy(world, raw, start);
      assert.equal(live.content.savedStyle(), null, JSON.stringify(raw));
    });

    world.storage.set(storageKey, 'not json');
    assert.equal(live.content.savedStyle(), null);
    saveCopy(world, { settings: { style: 'minimal' } }, start);
    world.storageBroken = true;
    assert.equal(live.content.savedStyle(), null, 'a storage that throws');
    world.storageBroken = false;

    // the sample has a style of its own, read from its file, so the saved copy is not used for it
    askForSample('1');
    try {
      assert.equal(live.content.savedStyle(), null, 'the screen starts on the sample');
    } finally {
      askForSample(null);
    }
  });
});

function cssFilesIn(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).reduce((files, entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return files.concat(cssFilesIn(full));
    return entry.name.endsWith('.css') ? files.concat(full) : files;
  }, []);
}

test('the rules for Plain are in base.css and hide only the screws and the default // in the panel headers, and only Neon Prime reads the look besides', () => {
  const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');
  const readCss = file => withoutComments(fs.readFileSync(file, 'utf8'));

  // base.css has the rules for Plain. Neon Prime's decor file is the one other reader: see the next lines
  const readers = ['base.css', 'themes/decor/neon-prime-decor.css'];
  cssFilesIn(dashboardFolder).forEach(file => {
    const name = path.relative(dashboardFolder, file);
    assert.equal(readCss(file).includes('data-look="plain"'), readers.includes(name), name + (readers.includes(name) ? ' should read the look' : ' reads data-look="plain"'));
  });

  // In Neon Prime the ridge is the neon trim. The flat finish hides every ridge, and Flat and Plain give this theme's back.
  const decor = readCss(path.join(dashboardFolder, 'themes/decor/neon-prime-decor.css'));
  assert.ok(/html\.theme-neon-prime\[data-look="flat"\] \.edge-ridge,\s*html\.theme-neon-prime\[data-look="plain"\] \.edge-ridge \{ display: inline; \}/.test(decor));
  // and the cyan line along the bars (the rail, the countdown's frame) stays too: one rule that gives the three bar gradients
  // their ridge line and nothing else, and only when the finish is flat
  const barRule = /html\.theme-neon-prime\[data-finish="flat"\]\[data-look="flat"\],\s*html\.theme-neon-prime\[data-finish="flat"\]\[data-look="plain"\] \{([^{}]*)\}/.exec(decor);
  assert.ok(barRule, 'the bars of Neon Prime keep their cyan line in Flat and Plain');
  const barNames = barRule[1].split(';').map(item => item.trim()).filter(Boolean).map(item => item.split(':')[0]);
  assert.deepEqual(barNames, ['--bar-across-8', '--bar-down-8', '--bar-down-16']);
  assert.ok(barRule[1].split(';').filter(item => item.trim()).every(item => item.includes('var(--metal-ridge)') && !item.includes('--metal-rim') && !item.includes('--metal-shade')));
  assert.equal(decor.split('data-look').length - 1, 4, 'and nothing else in that file reads the look');

  // the rules, as selectors and what they set
  const rules = [];
  readCss(path.join(dashboardFolder, 'base.css')).replace(/([^{}]+)\{([^{}]*)\}/g, (all, selectors, declarations) => {
    if (selectors.includes('data-look="plain"')) rules.push({ selectors: selectors.split(',').map(item => item.trim()), declarations: declarations.trim() });
    return all;
  });
  assert.deepEqual(rules, [{
    selectors: [':root[data-look="plain"] .screw', ':root[data-look="plain"] .screw-shadow', ':root[data-look="plain"] .header svg.double-slash'],
    declarations: 'display: none;',
  }]);

  // the screws are the two classes plate.js draws, and a header's slashes are the svg that marks.js draws
  const plate = fs.readFileSync(path.join(dashboardFolder, 'core/plate.js'), 'utf8');
  assert.ok(plate.includes('<use class="screw-shadow"') && plate.includes('<use class="screw"'));
  assert.ok(live.marks.doubleSlash().startsWith('<svg class="double-slash"'));
});

test('the rules for Plain never match a pack mark or a status shape, and the panels draw their header mark inside a header', () => {
  // The selector ends with svg.double-slash: an svg element that has the class. Count what it would match.
  const slashSvgs = html => (html.match(/<svg[^>]*\sclass="(?:[^"]*\s)?double-slash(?:\s[^"]*)?"/g) || []).length;
  const { doubleSlash, setPackMark, statusMark } = live.marks;
  const treeMark = {
    viewBox: '0 0 60 76',
    markup: '<polygon points="30,38 30,68 2,68" fill="#43c47c"/><g class="double-slash"><polygon points="30,0 32.2,4.8 37,7 32.2,9.2 30,14 27.8,9.2 23,7 27.8,4.8"/></g>',
  };

  try {
    setPackMark(null);
    assert.equal(slashSvgs(doubleSlash()), 1, 'the default slashes are matched');

    // a pack's mark is an svg of class pack-mark. Its accent shapes are a g of class double-slash, which is not an svg.
    setPackMark(treeMark);
    const pack = doubleSlash();
    assert.ok(pack.includes('<svg class="pack-mark"') && pack.includes('<g class="double-slash">'), 'the pack mark has the group');
    assert.equal(slashSvgs(pack), 0, 'a pack mark is not matched');
  } finally {
    setPackMark(null);
  }

  ['in-progress', 'up-next', 'done', 'blocked'].forEach(status => {
    const mark = statusMark(status);
    assert.equal(slashSvgs(mark), 0, status);
    assert.ok(/^<svg class="mark mark-/.test(mark) && !/screw|header/.test(mark), status);
  });

  // in the seasonal packs the class double-slash is only ever on a g, never on an svg of its own
  const seasonsFolder = path.join(dashboardFolder, 'seasons');
  fs.readdirSync(seasonsFolder).filter(file => file.endsWith('.js')).forEach(file => {
    const tags = fs.readFileSync(path.join(seasonsFolder, file), 'utf8').match(/<\w+[^<>]*class="double-slash"/g) || [];
    tags.forEach(tag => assert.ok(tag.startsWith('<g '), file + ': ' + tag));
  });

  // Every panel that draws the mark does it in its header, except the bullets of the Extra panel's lists, which stay
  const panelsFolder = path.join(dashboardFolder, 'panels');
  let drawn = 0;
  fs.readdirSync(panelsFolder).forEach(name => {
    const file = path.join(panelsFolder, name, name + '.js');
    if (!fs.existsSync(file)) return;

    const code = fs.readFileSync(file, 'utf8');
    const uses = code.split('${doubleSlash()}').length - 1;
    if (uses === 0) return;

    const bullets = code.split('<span class="list-marker">${doubleSlash()}</span>').length - 1;
    assert.ok(bullets === 0 || name === 'custom', name + ' draws bullets');
    assert.ok(uses - bullets === 1 && code.includes('<div class="header">'), name + ' draws its header mark once, inside a header');
    drawn += 1;
  });
  assert.equal(drawn, 10, 'the ten panels with a header mark');
});

test('shell.js applies Look through core/look.js at the start and at every content change, so a change in Studio shows at once', () => {
  const shell = fs.readFileSync(path.join(dashboardFolder, 'shell.js'), 'utf8');

  assert.ok(shell.includes("import { pageSwitchesFor } from './core/look.js';"));
  assert.ok(/function useLookSetting\(settings\) \{\s*const switches = pageSwitchesFor\(settings, \{ look: params\.get\('look'\), finish: params\.get\('finish'\), glint: params\.get\('glint'\) \}\);\s*Object\.keys\(switches\)\.forEach\(name => setPageSwitch\(name, switches\[name\]\)\);/.test(shell));
  assert.equal(shell.split('useLookSetting(defaultSettings);').length - 1, 1, 'once at the start, so the address shows before the content arrives');

  const rebuild = shell.slice(shell.indexOf('function rebuild() {'), shell.indexOf('// The logo settings of Dashboard Settings (Look tab)'));
  assert.ok(rebuild.includes('useLookSetting(content.settings);'), 'rebuild() runs at every content change');

  // nothing else sets the finish or the glint
  assert.equal(/dataset\.(finish|glint|look)|setPageSwitch\('(finish|glint|look)'/.test(shell), false);
});

test('glint, the master switch, the entrance, the spin, the hawk and the name effect are switches, and anything but true or false becomes on', () => {
  ['glint', 'logoAnimations', 'logoEntrance', 'logoSpin', 'logoHawk', 'nameTransform'].forEach(name => {
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

test('the spin every so many seconds is 0 (never) or 10 to 3600, and anything else is moved into range or becomes 72', () => {
  checkEvery(value => settingsThrough({ logoSpinEvery: value }).map(settings => settings.logoSpinEvery), 10, 3600, 72, [11, 72, 600, 3599]);
});

test('the spin duration is a number from 0.5 to 10 seconds, decimals allowed, and anything else is moved into range or becomes 1.6', () => {
  checkRange('logoSpinDuration', 0.5, 10, 1.6, [0.51, 1.6, 2.5, 9.99]);
});

test('the flying hawk every so many seconds is 0 (never) or 10 to 3600, and anything else is moved into range or becomes 24', () => {
  checkEvery(value => settingsThrough({ logoHawkEvery: value }).map(settings => settings.logoHawkEvery), 10, 3600, 24, [11, 24, 600, 3599]);
});

test('the flying hawk duration is a number from 6 to 30 seconds, decimals allowed, and anything else is moved into range or becomes 11', () => {
  checkRange('logoHawkDuration', 6, 30, 11, [6.5, 11, 12.5, 29.9]);
});

// A setting that is one of a few words: the words stay, and anything else becomes the default
function checkWords(name, words, fallback) {
  words.forEach(word => {
    settingsThrough({ [name]: word }).forEach(settings => assert.equal(settings[name], word, name + ' ' + word));
  });

  [undefined, null, '', 'Slat', 'MECHANICAL', 'mostly gold', 'bronze', 'toString', 0, true, [words[0]], {}].forEach(value => {
    settingsThrough({ [name]: value }).forEach(settings => {
      assert.equal(settings[name], fallback, name + ' with ' + JSON.stringify(value));
    });
  });
}

test('the page change style is alternate, slat or mechanical, and anything else becomes alternate', () => {
  checkWords('pageChangeStyle', ['alternate', 'slat', 'mechanical'], 'alternate');
});

test('the frame finish is mostly-gold, alternate, gold or silver, and anything else becomes mostly-gold', () => {
  checkWords('frameFinish', ['mostly-gold', 'alternate', 'gold', 'silver'], 'mostly-gold');
});

test('the break and rebuild time is a number from 0.3 to 2 seconds, decimals allowed, and anything else is moved into range or becomes 0.6', () => {
  checkRange('breakSeconds', 0.3, 2, 0.6, [0.31, 0.6, 1.25, 1.99]);
});

test('the silver chance is a percent from 0 to 100, and anything else is moved into range or becomes 10', () => {
  checkRange('silverChance', 0, 100, 10, [1, 10, 50, 99]);
});

test('settings saved before the Transitions tab existed get the starting page change and frame finish', () => {
  const defaults = live.config.defaultSettings;

  settingsThrough({ frameMetal: 'silver', nameEvery: 120 }).forEach(settings => {
    assert.equal(settings.frameMetal, 'silver', 'Frame metal is its own setting');
    ['pageChangeStyle', 'breakSeconds', 'frameFinish', 'silverChance'].forEach(name => {
      assert.equal(settings[name], defaults[name], name);
    });
  });
});

test('settings saved before the Logo tab existed keep the name effect values and get the old logo behaviour for the rest', () => {
  const saved = { nameTransform: false, nameEvery: 120, nameDuration: 3 }; // what was published when the tab was Logo and effects
  const defaults = live.config.defaultSettings;

  settingsThrough(saved).forEach(settings => {
    assert.deepEqual([settings.nameTransform, settings.nameEvery, settings.nameDuration], [false, 120, 3]);
    ['logoAnimations', 'logoEntrance', 'logoSpin', 'logoSpinEvery', 'logoSpinDuration', 'logoHawk', 'logoHawkEvery', 'logoHawkDuration'].forEach(name => {
      assert.equal(settings[name], defaults[name], name);
    });
  });
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

// The Look document. The rules for which theme applies are in tools/test-themes.mjs.

test('the query asks for the Look document by its id, and the answer is cleaned into content.theme', () => {
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

test('a missing Look document, or fields missing from it, are the defaults', () => {
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

test('a saved copy from before the Look document existed still gives a theme', async () => {
  await inWorld(async world => {
    saveCopy(world, { settings: document('dashboardSettings', 'dashboardSettings', { motion: 'calm' }) }, world.now - minute);
    world.handler = () => unreachable();
    const first = await readSanity(() => {});
    assert.deepEqual(first.content.theme, live.config.defaultThemeSettings);
    assert.equal(first.content.settings.motion, 'calm');
  });
});

test('the sample content has a Look document with the defaults and two example seasonal pack rules, and they come through cleaned', () => {
  const file = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  const defaults = live.config.defaultThemeSettings;
  const apartFromSchedule = theme => Object.assign({}, theme, { schedule: [] });

  assert.deepEqual(apartFromSchedule(file.theme), defaults);
  assert.deepEqual(apartFromSchedule(normalizeSample(file).theme), defaults);
  assert.deepEqual(apartFromSchedule(withDefaults(file).theme), defaults);

  const rules = withDefaults(file).theme.schedule;
  assert.deepEqual(rules.map(rule => [rule.name, rule.kind, rule.overlay]), [['[Winter pack]', 'overlay', 'christmas'], ['[Fall pack]', 'overlay', 'thanksgiving']]);
  assert.deepEqual(rules.map(rule => [rule.tickerPrefix, rule.bannerLine, rule.cornerArt]), [['[PREFIX]', '[Banner line for the pack]', ''], ['[PREFIX]', '[Banner line for the pack]', 'gears']]);
  assert.deepEqual(normalizeSample(file).theme, withDefaults(file).theme, 'reading the sample twice changes nothing');
});

// The Demo document. When a demo plays is in tools/test-effects.mjs.

test('the query asks for the Demo document by its id, and the answer is cleaned into content.demo', () => {
  assert.ok(contentQuery.includes('"demo": *[_id == "demo"][0]'));

  const stored = document('demo', 'demo', {
    requestedAt: '2026-10-05T12:00:00.000Z',
    steps: [
      { _key: 'a', screen: 'night-mode', seconds: 45 },
      { _key: 'b', screen: 'announcement', seconds: 20 },
    ],
    announcementText: 'HELLO VISITORS',
  });

  const demo = normalizeContent({ demo: stored }).demo;
  assert.equal(demo.requestedAt, '2026-10-05T12:00:00.000Z');
  assert.deepEqual(demo.steps, [{ screen: 'night-mode', seconds: 45 }, { screen: 'announcement', seconds: 20 }]);
  assert.equal(demo.announcementText, 'HELLO VISITORS');
  assert.deepEqual(Object.keys(demo).sort(), ['announcementText', 'requestedAt', 'steps'], 'only the three fields come through, not _id and the rest');
});

test('a missing Demo document is no demo: no request, and the default steps', () => {
  const defaults = live.config.defaultDemo;

  assert.deepEqual(normalizeContent({}).demo, defaults);
  assert.deepEqual(normalizeContent({ demo: null }).demo, defaults);
  assert.deepEqual(normalizeContent({ demo: 'oops' }).demo, defaults);
  assert.deepEqual(withDefaults({}).demo, defaults);
  assert.deepEqual(withDefaults(null).demo, defaults);
  assert.equal(normalizeContent({}).demo.requestedAt, '');
  assert.deepEqual(defaults.steps, [{ screen: 'announcement', seconds: 30 }, { screen: 'night-mode', seconds: 30 }]);
});

test('a step with an unknown or missing screen is dropped, its seconds are kept in the range 5 to 300, and a list that is not a list is the default', () => {
  const demo = normalizeContent({
    demo: document('demo', 'demo', {
      steps: [
        { screen: 'no-such-screen', seconds: 30 },
        { seconds: 30 },
        { screen: 'announcement', seconds: 1 },
        { screen: 'announcement', seconds: 5000 },
        { screen: 'night-mode', seconds: 'soon' },
        { screen: 'night-mode', seconds: 12.5 },
      ],
    }),
  }).demo;
  assert.deepEqual(demo.steps, [
    { screen: 'announcement', seconds: 5 },
    { screen: 'announcement', seconds: 300 },
    { screen: 'night-mode', seconds: 30 },
    { screen: 'night-mode', seconds: 12.5 },
  ]);

  assert.deepEqual(normalizeContent({ demo: document('demo', 'demo', { steps: 'x' }) }).demo.steps, live.config.defaultDemo.steps);
  assert.deepEqual(normalizeContent({ demo: document('demo', 'demo', { steps: [] }) }).demo.steps, [], 'a list the editors emptied stays empty');
});

test('a request that is not a time is no request, and a request cleared with Stop demo is no request', () => {
  assert.equal(normalizeContent({ demo: document('demo', 'demo', { requestedAt: 'whenever' }) }).demo.requestedAt, '');
  assert.equal(normalizeContent({ demo: document('demo', 'demo', { requestedAt: null }) }).demo.requestedAt, '');
  assert.equal(normalizeContent({ demo: document('demo', 'demo', { steps: [] }) }).demo.requestedAt, '');
});

test('a saved copy from before the Demo document existed still gives a demo', async () => {
  await inWorld(async world => {
    saveCopy(world, { settings: document('dashboardSettings', 'dashboardSettings', { motion: 'calm' }) }, world.now - minute);
    world.handler = () => unreachable();
    const first = await readSanity(() => {});
    assert.deepEqual(first.content.demo, live.config.defaultDemo);
  });
});

test('the sample content has a Demo document with the defaults and no request, and it comes through unchanged', () => {
  const file = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  assert.deepEqual(file.demo, live.config.defaultDemo);
  assert.deepEqual(normalizeSample(file).demo, live.config.defaultDemo);
  assert.deepEqual(withDefaults(file).demo, live.config.defaultDemo);
  assert.equal(normalizeSample({}).demo.requestedAt, '');
});

test('a change to the request alone is a change of content, so the screen hears of it', () => {
  const before = normalizeContent({ demo: document('demo', 'demo', {}) });
  const after = normalizeContent({ demo: document('demo', 'demo', { requestedAt: '2026-10-05T12:00:00.000Z' }) });
  assert.notEqual(JSON.stringify(before), JSON.stringify(after));
});

test('the sample content file carries the new settings and they come through unchanged', () => {
  const file = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  const settings = normalizeSample(file).settings;

  logoSettingNames.concat(['frameMetal', 'glint', 'look', 'pageSeconds', 'crt']).forEach(name => {
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
    assert.deepEqual(first.status, { source: 'sample', updated: null, offline: false, reason: '' });
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
    assert.deepEqual(first.status, { source: 'sample', updated: null, offline: true, reason: 'other' });
    assert.equal(world.errors.length, 1);
  });
});

test('the content source is not a setting: config.js and the defaults have no trace of it', () => {
  assert.equal('contentSources' in live.config, false);
  assert.equal('useSampleContent' in live.config, false);
  assert.equal('sampleMode' in live.config, false);
  assert.equal('dataFolder' in live.config, false);
  assert.equal(live.config.sampleFolder, 'data/sample/');
  assert.equal(live.config.liveFolder, 'data/live/');
  assert.notEqual(live.config.sanity.projectId, '');

  ['contentSource', 'switchBackAt'].forEach(name => {
    assert.equal(name in live.config.defaultSettings, false, name);
    assert.equal(name in withDefaults({}).settings, false, name);
  });
});

test('Show connection status starts off, true is kept, and anything that is not true or false becomes off', () => {
  assert.equal(live.config.defaultSettings.showConnectionStatus, false);
  assert.equal(withDefaults({}).settings.showConnectionStatus, false);
  assert.equal(withDefaults(null).settings.showConnectionStatus, false);

  settingsThrough({ showConnectionStatus: true }).forEach(settings => assert.equal(settings.showConnectionStatus, true));
  settingsThrough({ showConnectionStatus: false }).forEach(settings => assert.equal(settings.showConnectionStatus, false));
  settingsThrough({}).forEach(settings => assert.equal(settings.showConnectionStatus, false, 'a field the published settings lack'));

  ['true', 'on', 1, 0, null, '', ['true'], {}].forEach(value => {
    settingsThrough({ showConnectionStatus: value }).forEach(settings => {
      assert.equal(settings.showConnectionStatus, false, JSON.stringify(value));
    });
  });
});

test('chosenSource: production, unless ?sample=1 was asked for, or there is no Sanity project', () => {
  askForSample(null);
  assert.equal(chosenSource(), 'production');

  askForSample('1');
  assert.equal(chosenSource(), 'sample');

  // only the exact text 1 counts. The address gives text, so a number or true is not it
  ['0', '', '11', ' 1', 'true', 'yes', 'sample', 'production', null, undefined, 1, true].forEach(value => {
    askForSample(value);
    assert.equal(chosenSource(), 'production', JSON.stringify(value));
  });

  // a later call replaces the one before
  askForSample('1');
  askForSample('0');
  assert.equal(chosenSource(), 'production');
  askForSample(null);

  // with no project there is nothing to read
  noProject.source.askForSample(null);
  assert.equal(noProject.source.chosenSource(), 'sample');
  noProject.source.askForSample('0');
  assert.equal(noProject.source.chosenSource(), 'sample');
});

// A fake Sanity and a fake web server for startContent. world.server says what
// each answers, and a test can change it while the screen runs. The screen asks
// Sanity for the content only: it asks no question about which content to show.
function serve(world, server) {
  world.server = Object.assign({ content: sanityFixture(), file: JSON.parse(fs.readFileSync(sampleFile, 'utf8')) }, server);

  world.handler = async url => {
    if (url === queryUrl(live.config.sanity)) return sanityReply(copyOf(world.server.content));
    if (url === 'data/sample/content.json') return jsonResponse(copyOf(world.server.file));
    throw new Error('The test did not expect a request for ' + url);
  };
}

function requestsFor(world, url) {
  return world.fetches.filter(request => request.url === url).length;
}

function contentQueries(world) {
  return requestsFor(world, queryUrl(live.config.sanity));
}

function sampleReads(world) {
  return requestsFor(world, 'data/sample/content.json');
}

function sourcesOf(world) {
  return world.changes.map(change => change.status.source);
}

// Dashboard Settings as the Studio stores them, with the two fields the screen no longer reads
function storedSource(world, fields) {
  world.server.content.settings = Object.assign({}, world.server.content.settings, fields);
}

// A world for a page opened with ?sample=1 on its address. The next test starts without it.
async function inSampleWorld(run) {
  await inWorld(async world => {
    askForSample('1');
    try {
      await run(world);
    } finally {
      askForSample(null);
    }
  });
}

test('source: production runs the whole Sanity reader and asks nothing else, whatever Dashboard Settings store', async () => {
  const stored = [
    {},
    { contentSource: 'production' },
    { contentSource: 'production', switchBackAt: '2099-01-01T00:00:00.000Z' },
    { contentSource: 'sample' },
    { contentSource: 'sample', switchBackAt: '' },
    { contentSource: 'sample', switchBackAt: '2099-01-01T00:00:00.000Z' },
    { contentSource: 'Sample' },
  ];

  for (const fields of stored) {
    await inWorld(async world => {
      serve(world, {});
      storedSource(world, fields);

      const first = await startContent(world.onChange);
      const label = JSON.stringify(fields);
      assert.equal(first.status.source, 'sanity', label);
      assert.deepEqual(first.content, normalizeContent(world.server.content), label);

      // the content query and the open stream, and nothing else
      assert.deepEqual(world.fetches.map(request => request.url), [queryUrl(live.config.sanity)], label);
      assert.equal(world.streams.length, 1, label);
      assert.equal(sampleReads(world), 0, label);
      assert.ok(world.storage.has(storageKey), label);
      assert.equal(world.storage.has('teletraan-source'), false, label);
      assert.equal(world.errors.length, 0, label);
    });
  }
});

test('source: ?sample=1 loads only the sample content, with no request to Sanity, whatever Dashboard Settings store', async () => {
  for (const fields of [{}, { contentSource: 'production' }, { contentSource: 'sample' }]) {
    await inSampleWorld(async world => {
      serve(world, {});
      storedSource(world, fields);

      const first = await startContent(world.onChange);
      assert.deepEqual(first.content, normalizeSample(world.server.file));
      assert.deepEqual(first.status, { source: 'sample', updated: null, offline: false, reason: '' });
      assert.deepEqual(world.fetches.map(request => request.url), ['data/sample/content.json']);
      assert.equal(contentQueries(world), 0);
      assert.equal(world.streams.length, 0);
      assert.equal(world.storage.has(storageKey), false);
      assert.equal(world.storage.has('teletraan-source'), false);

      // five minutes later: still no content query and no stream. Only the sample file is read.
      await world.advance(5 * minute);
      assert.equal(contentQueries(world), 0);
      assert.equal(world.streams.length, 0);
      world.fetches.forEach(request => assert.equal(request.url, 'data/sample/content.json'));
      assert.equal(world.errors.length, 0);
    });
  }
});

test('source: sample content is edited in data/sample and shows within 30 seconds', async () => {
  await inSampleWorld(async world => {
    serve(world, {});
    await startContent(world.onChange);

    world.server.file.tasks[0].title = '[Edited task]';
    await world.advance(30 * second);
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].status.source, 'sample');
    assert.equal(world.changes[0].content.tasks[0].title, '[Edited task]');
  });
});

test('source: the page keeps the source it started with, however long it runs and whatever changes in Sanity', async () => {
  await inWorld(async world => {
    serve(world, {});
    await startContent(world.onChange);

    storedSource(world, { contentSource: 'sample', switchBackAt: '2099-01-01T00:00:00.000Z' });
    await world.advance(30 * minute);
    assert.ok(sourcesOf(world).every(source => source === 'sanity'));
    assert.equal(sampleReads(world), 0);
    assert.equal(world.streams.length, 1);
    world.fetches.forEach(request => assert.equal(request.url, queryUrl(live.config.sanity)));
    assert.equal(world.errors.length, 0);
  });

  await inSampleWorld(async world => {
    serve(world, {});
    await startContent(world.onChange);

    storedSource(world, { contentSource: 'production' });
    await world.advance(30 * minute);
    assert.deepEqual(sourcesOf(world), []);
    assert.equal(contentQueries(world), 0);
    assert.equal(world.streams.length, 0);
  });
});

test('source: blocked storage does not stop either source', async () => {
  await inWorld(async world => {
    world.storageBroken = true;
    serve(world, {});

    const first = await startContent(world.onChange);
    assert.equal(first.status.source, 'sanity');
    // one for reading the saved copy, one for saving the new one
    assert.equal(world.errors.length, 2);
  });

  await inSampleWorld(async world => {
    world.storageBroken = true;
    serve(world, {});

    const first = await startContent(world.onChange);
    assert.equal(first.status.source, 'sample');
    assert.equal(world.errors.length, 0);
  });
});

test('source: an empty project ID always shows the sample and asks Sanity for nothing', async () => {
  await inWorld(async world => {
    serve(world, {});

    const first = await noProject.content.startContent(world.onChange);
    assert.equal(first.status.source, 'sample');
    await world.advance(10 * minute);
    assert.deepEqual([...new Set(world.fetches.map(request => request.url))], ['data/sample/content.json']);
    assert.equal(world.streams.length, 0);
  });
});

test('source: shell.js reads ?sample= from the address before the style, the layout and the content', () => {
  const code = fs.readFileSync(path.join(dashboardFolder, 'shell.js'), 'utf8');
  const asked = code.indexOf("askForSample(params.get('sample'));");
  assert.ok(asked > code.indexOf('async function run()'), 'it is asked in run()');
  assert.ok(asked < code.indexOf("startStyle(params.get('style'), savedStyle)"), 'before the style, which reads the saved copy');
  assert.ok(asked < code.indexOf('startContent('), 'before the content starts');
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

test('sanity: a saved copy and no network shows the saved copy, says offline after 2 minutes, and tries again', async () => {
  await inWorld(async world => {
    const saved = sanityFixture();
    saveCopy(world, saved, start - 3 * minute);
    world.handler = unreachable;

    const first = await readSanity(world.onChange);
    assert.equal(first.status.offline, false);

    await world.advance(0);
    assert.equal(world.changes.length, 0);
    assert.equal(world.errors.length, 1);

    await world.advance(30 * second - 1);
    assert.equal(contentQueries(world), 1);
    await world.advance(1);
    assert.equal(contentQueries(world), 2);
    assert.equal(world.errors.length, 2);
    assert.equal(world.changes.length, 0);

    // two minutes after the first failed read, which was at the start
    await world.advance(90 * second - 1);
    assert.equal(world.changes.length, 0);
    await world.advance(1);
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].status.source, 'cache');
    assert.equal(world.changes[0].status.offline, true);
    assert.equal(world.changes[0].status.reason, 'network');
    assert.deepEqual(world.changes[0].content, normalizeContent(saved));

    world.handler = async () => sanityReply(saved);
    await world.advance(30 * second);
    assert.equal(world.changes.length, 2);
    assert.equal(world.changes[1].status.source, 'sanity');
    assert.equal(world.changes[1].status.offline, false);
    assert.equal(world.changes[1].status.reason, '');
  });
});

test('sanity: no saved copy and no network gives empty content, never the sample', async () => {
  await inWorld(async world => {
    world.handler = unreachable;

    const first = await readSanity(world.onChange);
    assert.deepEqual(first.content, withDefaults({}));
    assert.equal(first.status.offline, false);
    assert.equal(first.status.updated, null);
    assert.equal(first.content.tasks.length, 0);
    assert.equal(world.errors.length, 1);
    assert.equal(world.storage.size, 0);

    const sampleTitle = JSON.parse(fs.readFileSync(sampleFile, 'utf8')).tasks[0].title;
    assert.equal(JSON.stringify(first.content).includes(sampleTitle), false);

    await world.advance(2 * minute);
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].status.offline, true);
    assert.equal(world.changes[0].status.updated, null);
    assert.deepEqual(world.changes[0].content, withDefaults({}));

    world.handler = async () => sanityReply(sanityFixture());
    await world.advance(30 * second);
    assert.equal(world.changes.length, 2);
    assert.equal(world.changes[1].status.offline, false);
    assert.equal(world.changes[1].status.source, 'sanity');
    assert.equal(world.changes[1].content.tasks.length, 4);
  });
});

test('sanity: offline comes 2 minutes after the first failed read, and clears on the next good one', async () => {
  await inWorld(async world => {
    const fixture = sanityFixture();
    world.handler = async () => sanityReply(fixture);
    await readSanity(world.onChange);

    // The first failed read is the next one, 5 minutes in. Its 2 minutes are up at 7:00.
    world.handler = unreachable;
    await world.advance(7 * minute - 1);
    assert.equal(contentQueries(world), 5); // the first read, then 5:00, 5:30, 6:00 and 6:30, which all failed
    assert.equal(world.errors.length, 4);
    assert.equal(world.changes.length, 0);

    await world.advance(1);
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].status.offline, true);
    assert.equal(world.changes[0].status.reason, 'network');
    assert.equal(world.changes[0].status.source, 'sanity');
    assert.equal(world.changes[0].status.updated.getTime(), start);
    assert.deepEqual(world.changes[0].content, normalizeContent(fixture));

    await world.advance(30 * second);
    assert.equal(world.changes.length, 1);

    world.handler = async () => sanityReply(fixture);
    await world.advance(30 * second);
    assert.equal(world.changes.length, 2);
    assert.equal(world.changes[1].status.offline, false);
    assert.equal(world.changes[1].status.reason, '');
    assert.equal(world.changes[1].status.updated.getTime(), world.now);
  });
});

test('sanity: a good read stops the 2 minutes, and the next failure starts them again', async () => {
  await inWorld(async world => {
    const fixture = sanityFixture();
    world.handler = async () => sanityReply(fixture);
    await readSanity(world.onChange);

    // fails from 5:00, would be offline at 7:00
    world.handler = unreachable;
    await world.advance(6 * minute);
    assert.equal(world.changes.length, 0);

    // a good read at 6:30 stops the count, so nothing happens at 7:00
    world.handler = async () => sanityReply(fixture);
    await world.advance(30 * second);
    await world.advance(2 * minute);
    assert.equal(world.changes.length, 0);

    // now 8:30. The next read is 5 minutes after the good one, at 11:30, and
    // fails. Its 2 minutes are up at 13:30.
    world.handler = unreachable;
    await world.advance(5 * minute - 1);
    assert.equal(world.changes.length, 0);
    await world.advance(1);
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].status.offline, true);
  });
});

test('sanity: the reason follows the latest failed read while it is offline', async () => {
  await inWorld(async world => {
    world.handler = unreachable;
    await readSanity(world.onChange);
    await world.advance(2 * minute);
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].status.reason, 'network');

    world.handler = async () => jsonResponse({ error: { description: 'Session not found' } }, 401);
    await world.advance(30 * second);
    assert.equal(world.changes.length, 2);
    assert.equal(world.changes[1].status.offline, true);
    assert.equal(world.changes[1].status.reason, 'denied');

    await world.advance(30 * second);
    assert.equal(world.changes.length, 2);
  });
});

test('sanity: stopping the reader cancels the 2 minutes', async () => {
  await inWorld(async world => {
    world.handler = unreachable;
    const reader = await startSanityContent(world.onChange);
    assert.equal(reader.first.status.offline, false);

    reader.stop();
    await world.advance(10 * minute);
    assert.equal(world.changes.length, 0);
    assert.equal(world.timers.length, 0);
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

test('sanity: a read that hangs is given up after 15 seconds, then asked about for 5 more, and the next one still works', async () => {
  await inWorld(async world => {
    saveCopy(world, sanityFixture(), start - minute);
    world.handler = (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('The request was aborted')));
    });

    await readSanity(world.onChange);
    await world.advance(0);
    await world.advance(15 * second - 1);
    assert.equal(world.errors.length, 0);

    // the read is given up, and one small request to the same host finds out why. It hangs too.
    await world.advance(1);
    assert.equal(world.errors.length, 0);
    assert.equal(world.fetches.length, 2);
    await world.advance(5 * second);
    assert.equal(world.errors.length, 1);
    assert.equal(world.changes.length, 0);

    world.handler = async () => sanityReply(sanityFixture());
    await world.advance(30 * second);
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].status.source, 'sanity');
    assert.equal(world.changes[0].status.offline, false);
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
      assert.equal(first.status.offline, false, name);
      assert.equal(world.errors.length, 1, name);

      // An answer Sanity gave is never asked about again with the second request
      assert.equal(world.fetches.length, 1, name);

      await world.advance(2 * minute);
      assert.equal(world.changes.length, 1, name);
      assert.equal(world.changes[0].status.offline, true, name);
      assert.equal(world.changes[0].status.reason, 'other', name);
    });

    await inWorld(async world => {
      world.handler = async () => badAnswers[name]();
      saveCopy(world, sanityFixture(), start);
      const withCopy = await readSanity(world.onChange);
      assert.equal(withCopy.status.source, 'cache', name);

      await world.advance(2 * minute);
      assert.equal(world.changes.length, 1, name);
      assert.equal(world.changes[0].status.source, 'cache', name);
      assert.equal(world.changes[0].status.offline, true, name);
      assert.equal(world.changes[0].content.tasks.length, 4, name);
    });
  }
});

// Why a read failed, in the four words of core/connection.js. The browser gives
// the same error for no network and for a block by CORS, so the second request
// to the same host, with the mode 'no-cors', tells them apart.

function opaqueAnswer() {
  return { type: 'opaque', ok: false, status: 0 };
}

// A read that hangs only ends when the clock moves, so a saved copy is needed
// for the screen to start without waiting for it
async function reasonAfterTwoMinutes(handler, savedCopy) {
  let found = null;
  await inWorld(async world => {
    world.handler = handler;
    if (savedCopy) saveCopy(world, sanityFixture(), start);
    await readSanity(world.onChange);
    await world.advance(savedCopy ? 3 * minute : 2 * minute);
    assert.equal(world.changes.length, 1);
    found = { status: world.changes[0].status, fetches: world.fetches };
  });
  return found;
}

test('sanity: no answer at all from the host is the network', async () => {
  const found = await reasonAfterTwoMinutes(unreachable);
  assert.equal(found.status.reason, 'network');
});

test('sanity: a host that answers the plain request while the read fails is CORS', async () => {
  const found = await reasonAfterTwoMinutes((url, options) => (options.mode === 'no-cors' ? Promise.resolve(opaqueAnswer()) : unreachable()));
  assert.equal(found.status.reason, 'cors');

  // The second request goes to the same host, with no-cors, and nothing is read from it
  const probes = found.fetches.filter(request => request.options.mode === 'no-cors');
  assert.ok(probes.length >= 1);
  probes.forEach(request => {
    assert.equal(request.url, probeUrl(live.config.sanity));
    assert.ok(request.url.startsWith('https://' + live.config.sanity.projectId + '.api.sanity.io/'));
  });
  assert.equal(found.fetches.length, probes.length * 2, 'every failed read makes one second request and no more');
});

test('sanity: 401 and 403 are access denied, and no second request is made', async () => {
  for (const code of [401, 403]) {
    const found = await reasonAfterTwoMinutes(async () => jsonResponse({ error: { description: 'no' } }, code));
    assert.equal(found.status.reason, 'denied', 'status ' + code);
    assert.equal(found.fetches.filter(request => request.options.mode === 'no-cors').length, 0, 'status ' + code);
  }
});

test('sanity: a server error, a missing result and text that is not JSON are other', async () => {
  const answers = [
    async () => jsonResponse({ error: 'no' }, 500),
    async () => jsonResponse({ error: 'no' }, 404),
    async () => jsonResponse({ ms: 1 }),
    async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token'); } }),
  ];
  for (const answer of answers) {
    assert.equal((await reasonAfterTwoMinutes(answer)).status.reason, 'other');
  }
});

test('sanity: a read that times out is other when the host answers, and the network when it does not', async () => {
  function hangs(options) {
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('The request was aborted')));
    });
  }

  const slow = await reasonAfterTwoMinutes((url, options) => (options.mode === 'no-cors' ? Promise.resolve(opaqueAnswer()) : hangs(options)), true);
  assert.equal(slow.status.reason, 'other');

  const dead = await reasonAfterTwoMinutes((url, options) => hangs(options), true);
  assert.equal(dead.status.reason, 'network');
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

test('a person\'s typed title is kept without its spaces, and an empty or missing one is left out', () => {
  assert.equal(personWith({ title: '  Head Coach ' }).title, 'Head Coach');
  assert.equal('title' in personWith({}), false);
  assert.equal('title' in personWith({ title: '   ' }), false);
  assert.equal('title' in personWith({ title: 7 }), false);
  assert.equal(normalizeSample({ people: [{ role: 'Coach', name: '[Coach]', title: '[Head coach]' }] }).people[0].title, '[Head coach]');
});

// Subteam members: the names the Subteam roster panel shows

function subteamWith(fields) {
  return normalizeContent({ subteams: [document('subteam', 'sx', Object.assign({ name: '[Subteam X]' }, fields))] }).subteams[0];
}

function namesCalled(count) {
  const names = [];
  for (let number = 1; number <= count; number++) names.push('[Student ' + String.fromCharCode(64 + number) + ']');
  return names;
}

test('a subteam always has members, an empty list when the field is missing or is not a list', () => {
  assert.deepEqual(subteamWith({}).members, []);
  assert.deepEqual(subteamWith({ members: [] }).members, []);
  assert.deepEqual(subteamWith({ members: null }).members, []);
  assert.deepEqual(subteamWith({ members: '[Alex]' }).members, []);
  assert.deepEqual(subteamWith({ members: { first: '[Alex]' } }).members, []);
  assert.deepEqual(normalizeSample({ subteams: [{ name: '[A]' }] }).subteams[0].members, []);
  assert.deepEqual(normalizeContent({}, today).subteams, []);
});

test('members keep the order they were typed in, from Sanity and from the sample', () => {
  assert.deepEqual(subteamWith({ members: ['[Sam]', '[Alex]', '[Kim]'] }).members, ['[Sam]', '[Alex]', '[Kim]']);
  assert.deepEqual(normalizeSample({ subteams: [{ name: '[A]', members: ['[Sam]', '[Alex]'] }] }).subteams[0].members, ['[Sam]', '[Alex]']);
});

test('members are trimmed, and empty, spaces-only and non-text entries are dropped', () => {
  const members = subteamWith({ members: ['  [Alex] ', '', '   ', null, 7, true, { name: '[Obj]' }, ['[Nested]'], '[Sam]'] }).members;
  assert.deepEqual(members, ['[Alex]', '[Sam]']);
  assert.deepEqual(normalizeSample({ subteams: [{ name: '[A]', members: [' [Alex]', 3, null, ''] }] }).subteams[0].members, ['[Alex]']);
});

test('a member who repeats an earlier name, in any capitals, is dropped and the first spelling stays', () => {
  const members = subteamWith({ members: ['[Alex]', '[Sam]', '[ALEX]', ' [sam] ', '[Kim]', '[alex]'] }).members;
  assert.deepEqual(members, ['[Alex]', '[Sam]', '[Kim]']);
});

test('at most 24 members are kept, the first 24, and a repeat does not use up a place', () => {
  assert.equal(subteamWith({ members: namesCalled(30).concat(['x']) }).members.length, 24);
  assert.deepEqual(subteamWith({ members: namesCalled(30) }).members, namesCalled(24));
  assert.deepEqual(subteamWith({ members: namesCalled(24) }).members, namesCalled(24));

  const withRepeat = namesCalled(25);
  withRepeat.splice(3, 0, '[STUDENT A]');
  assert.deepEqual(subteamWith({ members: withRepeat }).members, namesCalled(24));
});

test('the other fields of a subteam come through next to the members', () => {
  const subteam = subteamWith({ lead: '[Lead]', members: ['[Alex]'], spotlight: true, order: 3, show: false });
  assert.deepEqual(subteam, { name: '[Subteam X]', lead: '[Lead]', members: ['[Alex]'], spotlight: true, order: 3, show: false });
});

test('the sample subteams have members as marked placeholders, a different number each, and two pages for one', () => {
  const sample = normalizeSample(JSON.parse(fs.readFileSync(sampleFile, 'utf8')));
  const counts = sample.subteams.map(subteam => subteam.members.length);

  assert.equal(new Set(counts).size, counts.length, 'two sample subteams have the same number of members');
  assert.ok(counts.every(count => count > 0 && count <= 24), 'a sample subteam has no members or more than 24');
  sample.subteams.forEach(subteam => subteam.members.forEach(name => {
    assert.ok(/^\[[^\]]+\]$/.test(name), name + ' is not a marked placeholder');
    assert.ok(name.length <= 12 && !/\d/.test(name), name + ' breaks the rules of the Members field');
  }));
  assert.ok(counts.some(count => count > membersPerPage), 'no sample subteam needs a second page');
  assert.ok(counts.some(count => count === membersPerPage), 'no sample subteam fills a page exactly');
  assert.ok(rosterPages(sample.subteams).length > sample.subteams.length);
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

// Photos in Studio: the Photo documents, the address the screen asks for, which
// photos show, in what order, and for how long

function photoItem(id, createdAt, changes) {
  return Object.assign({ id: id, address: 'https://cdn.sanity.io/images/abc123/production/' + id + '-800x600.jpg?w=1920&fit=max&auto=format', createdAt: createdAt }, changes);
}

function photosFrom(list) {
  return normalizeContent({ photos: list }).photos;
}

// A repeatable run of numbers from 0 up to but not including 1, for the random order
function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test('the query asks for each photo with its id, when it was made, its words, switches and picture', () => {
  assert.ok(contentQuery.includes('"photos": *[_type == "photo"] | order(_createdAt desc) {'));
  ['"id": _id', '"createdAt": _createdAt', 'caption,', 'credit,', 'show,', 'expires,', '"image": image {'].forEach(piece => {
    assert.ok(contentQuery.includes(piece), 'the query does not ask for ' + piece);
  });
  // the same picture lines as a person's photo, asked for three times: a person, a photo and a team logo
  assert.equal(contentQuery.split('"url": asset->url').length - 1, 3);
});

test('a photo from Studio gets the address the screen asks for: no wider than the screen, a small format', () => {
  const [photo] = photosFrom([{ id: 'a1', createdAt: '2026-09-20T10:00:00Z', caption: '[Caption]', credit: '[Name]', image: photoRecord() }]);

  assert.equal(photo.address, photoBase + '?w=1920&fit=max&auto=format');
  assert.equal(photoMaxWidth, 1920);
  assert.deepEqual(photo, { id: 'a1', createdAt: '2026-09-20T10:00:00Z', caption: '[Caption]', credit: '[Name]', address: photo.address, focus: { x: 50, y: 50 } });
  assert.equal(JSON.stringify(photo).includes('_type'), false);
});

test('screenPhotoUrl is never wider than 1920 and never enlarges a smaller picture', () => {
  [[100, 100], [800, 600], [1920, 1080], [4032, 3024], [60, 4000]].forEach(([width, height]) => {
    const address = screenPhotoUrl(photoRecord({ width: width, height: height }));
    const asked = Number(address.match(/[?&]w=(\d+)/)[1]);

    assert.ok(asked <= 1920, 'asks for ' + asked + ' wide');
    assert.ok(address.includes('&fit=max') && address.includes('auto=format'), address);
    assert.equal(address.includes('&h='), false, 'asks for a height, so it would be cut: ' + address);
  });
  assert.equal(screenPhotoUrl(photoRecord()), photoBase + '?w=1920&fit=max&auto=format');
});

test('the editor\'s crop is sent as the part of the picture to keep, and no crop leaves it out', () => {
  const cropped = photoRecord({ crop: { top: 0.1, bottom: 0, left: 0, right: 0.25 } });
  assert.equal(screenPhotoUrl(cropped), photoBase + '?rect=0,60,600,540&w=1920&fit=max&auto=format');

  // a crop of nothing is no crop
  assert.equal(screenPhotoUrl(photoRecord({ crop: { top: 0, bottom: 0, left: 0, right: 0 } })), photoBase + '?w=1920&fit=max&auto=format');
  assert.equal(screenPhotoUrl(photoRecord({ crop: null })), photoBase + '?w=1920&fit=max&auto=format');
});

test('screenPhotoUrl gives an empty text for a picture that cannot be used', () => {
  [undefined, null, 'text', {}, photoRecord({ url: 'http://cdn.sanity.io/images/a.jpg' }), photoRecord({ width: 0 }), photoRecord({ height: null })].forEach(raw => {
    assert.equal(screenPhotoUrl(raw), '');
  });
});

test('photoFocus says where the hotspot is in what the crop keeps, so the card cuts around it', () => {
  assert.deepEqual(photoFocus(photoRecord({ hotspot: null })), { x: 50, y: 50 });
  assert.deepEqual(photoFocus(photoRecord({ hotspot: { x: 0.25, y: 0.75 } })), { x: 25, y: 75 });

  // the editor cut 25% off the right: the middle of the original is two thirds across what is left
  assert.deepEqual(photoFocus(photoRecord({ crop: { top: 0, bottom: 0, left: 0, right: 0.25 } })), { x: 67, y: 50 });
  // a hotspot inside the part that was cut off is held at the edge
  assert.deepEqual(photoFocus(photoRecord({ crop: { top: 0, bottom: 0, left: 0.5, right: 0 }, hotspot: { x: 0.1, y: 0.5 } })), { x: 0, y: 50 });
  assert.deepEqual(photoFocus(null), { x: 50, y: 50 });
});

test('a photo with no picture that can be used is dropped, and the rest is kept', () => {
  const photos = photosFrom([
    { id: 'a', image: null },
    { id: 'b', image: { url: null, width: null, height: null, crop: null, hotspot: null } },
    { id: 'c', image: photoRecord({ url: 'http://cdn.sanity.io/images/a.jpg' }) },
    { id: 'd' },
    null,
    'text',
    { id: 'e', image: photoRecord() },
  ]);
  assert.deepEqual(photos.map(photo => photo.id), ['e']);
  assert.deepEqual(photosFrom(undefined), []);
  assert.deepEqual(photosFrom(null), []);
  assert.deepEqual(normalizeContent({}).photos, []);
  assert.deepEqual(withDefaults(null).photos, []);
});

test('empty fields of a photo are left out, and a switched off photo keeps its switch', () => {
  const [photo] = photosFrom([{ id: 'a', createdAt: '2026-09-20T10:00:00Z', caption: '', credit: null, show: false, expires: null, image: photoRecord() }]);

  assert.equal('caption' in photo, false);
  assert.equal('credit' in photo, false);
  assert.equal('expires' in photo, false);
  assert.equal(photo.show, false);
});

// Booked talks: the Presentation documents, cleaned for core/presentation.js

function talkRecord(changes) {
  return Object.assign({
    id: 'presentation-a1',
    name: 'Alex',
    subteam: 'Build',
    topic: '[Talk title]',
    start: '2026-10-08T18:45:00.000Z',
    minutes: 15,
    deckLink: 'https://docs.google.com/presentation/d/1AbC-d_Ef/edit?usp=sharing',
    status: 'scheduled',
  }, changes);
}

function talksFrom(list) {
  return normalizeContent({ presentations: list }).presentations;
}

test('the query asks for each booked talk with its id and its fields, soonest first, from the published documents', () => {
  assert.ok(contentQuery.includes('"presentations": *[_type == "presentation"] | order(start asc, _createdAt asc) {'));
  ['"id": _id', 'name,', 'subteam,', 'topic,', 'start,', 'minutes,', 'deckLink,', 'status'].forEach(piece => {
    assert.ok(contentQuery.includes(piece), 'the query does not ask for ' + piece);
  });
  assert.equal(new URL(queryUrl(live.config.sanity)).searchParams.get('perspective'), 'published', 'a draft is never sent');
});

test('a talk from Studio keeps its fields with the start as a Date, and loses Sanity\'s own names', () => {
  const [talk] = talksFrom([Object.assign(talkRecord(), { _id: 'presentation-a1', _type: 'presentation', _rev: 'rev-1', _createdAt: '2026-09-01T10:00:00Z' })]);

  assert.deepEqual(talk, {
    id: 'presentation-a1',
    name: 'Alex',
    subteam: 'Build',
    topic: '[Talk title]',
    start: new Date('2026-10-08T18:45:00.000Z'),
    minutes: 15,
    deckLink: 'https://docs.google.com/presentation/d/1AbC-d_Ef/edit?usp=sharing',
    status: 'scheduled',
  });
  assert.ok(talk.start instanceof Date);
  assert.equal(JSON.stringify(talk).includes('_type'), false);
});

test('a talk\'s name, subteam and title lose the spaces at their ends, and an empty subteam is left out', () => {
  const [talk] = talksFrom([talkRecord({ name: '  Alex ', subteam: ' Build', topic: '\t[Talk title]  ' })]);
  assert.deepEqual([talk.name, talk.subteam, talk.topic], ['Alex', 'Build', '[Talk title]']);

  [undefined, null, '', '   ', 7].forEach(subteam => {
    assert.equal('subteam' in talksFrom([talkRecord({ subteam: subteam })])[0], false, JSON.stringify(subteam));
  });
  [undefined, null, 7].forEach(value => {
    const [odd] = talksFrom([talkRecord({ name: value, topic: value })]);
    assert.deepEqual([odd.name, odd.topic], ['', ''], JSON.stringify(value));
  });
});

test('a talk\'s minutes are 5 to 30, and 15 when they are missing or not a number', () => {
  assert.deepEqual(live.config.limits.talkMinutes, { min: 5, max: 30 });
  assert.equal(live.config.defaultTalk.minutes, 15);

  [[5, 5], [15, 15], [30, 30], [4, 5], [0, 5], [-10, 5], [31, 30], [600, 30]].forEach(([value, wanted]) => {
    assert.equal(talksFrom([talkRecord({ minutes: value })])[0].minutes, wanted, String(value));
  });
  [undefined, null, '', '20', NaN, Infinity, true, [], {}].forEach(value => {
    assert.equal(talksFrom([talkRecord({ minutes: value })])[0].minutes, 15, JSON.stringify(value));
  });
});

test('a slides link is kept only when it is a Google Slides link, and a talk without one stays', () => {
  [
    'https://docs.google.com/presentation/d/1AbC-d_Ef',
    'https://docs.google.com/presentation/d/1AbC-d_Ef/edit?usp=sharing',
  ].forEach(link => assert.equal(talksFrom([talkRecord({ deckLink: link })])[0].deckLink, link, link));

  [
    'http://docs.google.com/presentation/d/1AbC-d_Ef',
    'https://docs.google.com/document/d/1AbC-d_Ef',
    'https://docs.google.com/presentation/d/',
    'https://docs.google.com/presentation/d/%20',
    'https://docs.google.com.example.net/presentation/d/1AbC-d_Ef',
    'https://docsXgoogle.com/presentation/d/1AbC-d_Ef',
    ' https://docs.google.com/presentation/d/1AbC-d_Ef',
    'see https://docs.google.com/presentation/d/1AbC-d_Ef',
    '',
    null,
    undefined,
    42,
  ].forEach(link => {
    const talks = talksFrom([talkRecord({ deckLink: link })]);
    assert.equal(talks.length, 1, 'the talk stays: ' + JSON.stringify(link));
    assert.equal('deckLink' in talks[0], false, JSON.stringify(link));
  });
});

test('a talk\'s status is one of the four and scheduled when it is missing or is none of them', () => {
  assert.deepEqual(live.config.talkStatuses, ['scheduled', 'cancelled', 'done', 'skipped']);
  assert.equal(live.config.defaultTalk.status, 'scheduled');

  live.config.talkStatuses.forEach(status => assert.equal(talksFrom([talkRecord({ status: status })])[0].status, status));
  [undefined, null, '', 'paused', 'Cancelled', 3].forEach(status => {
    assert.equal(talksFrom([talkRecord({ status: status })])[0].status, 'scheduled', JSON.stringify(status));
  });
});

test('a talk that is cancelled, done or skipped stays in the list, for core/presentation.js to leave out', () => {
  const talks = talksFrom(['cancelled', 'done', 'skipped'].map((status, place) => talkRecord({ id: 'presentation-' + place, status: status })));
  assert.deepEqual(talks.map(talk => talk.status), ['cancelled', 'done', 'skipped']);
});

test('a talk with no id, or with no start that can be read, is dropped, and the rest is kept', () => {
  const talks = talksFrom([
    talkRecord({ id: '' }),
    talkRecord({ id: undefined }),
    talkRecord({ id: 7 }),
    talkRecord({ id: 'no-start-1', start: undefined }),
    talkRecord({ id: 'no-start-2', start: null }),
    talkRecord({ id: 'no-start-3', start: '' }),
    talkRecord({ id: 'no-start-4', start: 'soon' }),
    talkRecord({ id: 'no-start-5', start: 1760000000000 }),
    null,
    'text',
    talkRecord({ id: 'presentation-ok' }),
  ]);
  assert.deepEqual(talks.map(talk => talk.id), ['presentation-ok']);
});

test('talks keep the order Sanity sent them in, and the answer with no talks, or talks that are not a list, is an empty list', () => {
  const list = [talkRecord({ id: 'b', start: '2026-10-08T19:00:00.000Z' }), talkRecord({ id: 'a', start: '2026-10-08T18:45:00.000Z' })];
  assert.deepEqual(talksFrom(list).map(talk => talk.id), ['b', 'a']);

  [undefined, null, 'oops', 7, {}].forEach(value => assert.deepEqual(talksFrom(value), []));
  assert.deepEqual(normalizeContent({}).presentations, []);
  assert.deepEqual(normalizeContent(null).presentations, []);
  assert.deepEqual(withDefaults(null).presentations, []);
  assert.deepEqual(withDefaults({}).presentations, []);
});

test('sample talks are cleaned the same way as talks from Sanity, and a sample with none gives an empty list', () => {
  const sample = normalizeSample({ presentations: [talkRecord({ name: ' Alex ', minutes: 99, status: 'later' }), talkRecord({ id: '' })] });
  assert.equal(sample.presentations.length, 1);
  assert.deepEqual([sample.presentations[0].name, sample.presentations[0].minutes, sample.presentations[0].status], ['Alex', 30, 'scheduled']);
  assert.ok(sample.presentations[0].start instanceof Date);

  assert.deepEqual(normalizeSample({}).presentations, []);
  assert.deepEqual(normalizeSample({ presentations: 'oops' }).presentations, []);
  assert.deepEqual(normalizeSample(JSON.parse(fs.readFileSync(sampleFile, 'utf8'))).presentations.filter(talk => !(talk.start instanceof Date)), []);
});

test('a saved copy from before talks existed still gives an empty list of talks', async () => {
  await inWorld(async world => {
    const raw = copyOf(sanityFixture());
    assert.equal('presentations' in raw, false);
    saveCopy(world, raw, start - minute);
    world.handler = async () => unreachable();

    const first = await readSanity(world.onChange);
    assert.deepEqual(first.content.presentations, []);
  });
});

test('a change to a talk\'s start is a change of content, so the screen hears of it', async () => {
  await inWorld(async world => {
    const fixture = sanityFixture();
    fixture.presentations = [talkRecord()];
    world.handler = async () => sanityReply(copyOf(fixture));
    await readSanity(world.onChange);

    fixture.presentations = [talkRecord({ start: '2026-10-08T19:00:00.000Z' })];
    world.streams[0].emit('message');
    await world.advance(2 * second);
    await world.advance(0);

    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].content.presentations[0].start.toISOString(), '2026-10-08T19:00:00.000Z');
  });
});

// Calendar filters: the rules from Studio, cleaned for core/events.js

function filterRecord(changes) {
  return Object.assign({
    name: '[Hide Pre-Season Monday and Thursday]',
    action: 'hide',
    words: ['Pre-Season'],
    days: [1, 4],
    calendar: 'team',
    fromDate: '2027-01-01',
    toDate: '2027-02-28',
    expires: '2027-03-01T12:00:00.000Z',
  }, changes);
}

function filtersFrom(list) {
  return normalizeContent({ calendarFilters: list }).calendarFilters;
}

test('the query asks for the Calendar filters in the order they were made, and content with none has an empty list', () => {
  assert.ok(contentQuery.includes('"calendarFilters": *[_type == "calendarFilter"] | order(_createdAt asc),'));

  assert.deepEqual(normalizeContent({}).calendarFilters, []);
  assert.deepEqual(normalizeContent(null).calendarFilters, []);
  assert.deepEqual(withDefaults(null).calendarFilters, []);
  assert.deepEqual(withDefaults({}).calendarFilters, []);
  assert.deepEqual(normalizeSample({}).calendarFilters, []);
  assert.deepEqual(normalizeSample({ calendarFilters: 'oops' }).calendarFilters, []);
});

test('a rule from Studio keeps its fields and loses Sanity\'s own names, and the switch and the Hide after time stay only when they say something', () => {
  const [rule] = filtersFrom([Object.assign(filterRecord(), { _id: 'filter-1', _type: 'calendarFilter', _rev: 'rev-1', _createdAt: '2026-09-01T10:00:00Z' })]);

  assert.deepEqual(rule, {
    name: '[Hide Pre-Season Monday and Thursday]',
    action: 'hide',
    words: ['Pre-Season'],
    days: [1, 4],
    calendar: 'team',
    fromDate: '2027-01-01',
    toDate: '2027-02-28',
    expires: '2027-03-01T12:00:00.000Z',
  });
  assert.equal(JSON.stringify(rule).includes('_type'), false);

  assert.equal('show' in filtersFrom([filterRecord({ show: true })])[0], false, 'on is the same as not set');
  assert.equal('show' in filtersFrom([filterRecord({ show: undefined })])[0], false);
  assert.equal(filtersFrom([filterRecord({ show: false })])[0].show, false);
  [undefined, null, ''].forEach(value => assert.equal('expires' in filtersFrom([filterRecord({ expires: value })])[0], false, JSON.stringify(value)));
});

test('the words of a rule lose the spaces at their ends and the empty ones go, and the days are the numbers 0 to 6 once each, Sunday first', () => {
  assert.deepEqual(filtersFrom([filterRecord({ words: ['  Pre-Season ', '', '   ', 7, null, 'Kickoff'] })])[0].words, ['Pre-Season', 'Kickoff']);
  [undefined, null, 'Pre-Season', 7, {}].forEach(value => assert.deepEqual(filtersFrom([filterRecord({ words: value })])[0].words, [], JSON.stringify(value)));

  assert.deepEqual(filtersFrom([filterRecord({ days: [4, 1, 4, 7, -1, 1.5, '2', null, 0] })])[0].days, [0, 1, 4]);
  assert.deepEqual(filtersFrom([filterRecord({ days: [3, 2, 1, 6, 5, 4, 0] })])[0].days, [0, 1, 2, 3, 4, 5, 6]);
  [undefined, null, 'Monday', 1, {}].forEach(value => assert.deepEqual(filtersFrom([filterRecord({ days: value })])[0].days, [], JSON.stringify(value)));
});

test('the calendar code loses the spaces at its ends, and a date is kept only when it is written like 2027-04-02', () => {
  assert.equal(filtersFrom([filterRecord({ calendar: '  team ' })])[0].calendar, 'team');
  [undefined, null, 7, {}].forEach(value => assert.equal(filtersFrom([filterRecord({ calendar: value })])[0].calendar, '', JSON.stringify(value)));

  assert.deepEqual(filtersFrom([filterRecord({ fromDate: '2027-04-02', toDate: '2027-04-03' })]).map(rule => [rule.fromDate, rule.toDate]), [['2027-04-02', '2027-04-03']]);
  ['2027-4-2', '04/02/2027', '2027-04-02T10:00:00Z', ' 2027-04-02', '', null, undefined, 20270402].forEach(value => {
    const [rule] = filtersFrom([filterRecord({ fromDate: value, toDate: value })]);
    assert.deepEqual([rule.fromDate, rule.toDate], ['', ''], JSON.stringify(value));
  });
});

test('a rule\'s action is hide or show, and hide when it is missing or is none of them', () => {
  assert.deepEqual(live.config.filterActions, ['hide', 'show']);
  assert.equal(live.config.defaultFilter.action, 'hide');

  live.config.filterActions.forEach(action => assert.equal(filtersFrom([filterRecord({ action: action })])[0].action, action));
  [undefined, null, '', 'Hide', 'always', 'banana', 3].forEach(action => {
    assert.equal(filtersFrom([filterRecord({ action: action })])[0].action, 'hide', JSON.stringify(action));
  });
});

test('a rule with nothing left to match is dropped, since it would match every event, and one that is off or past its time stays', () => {
  const nothing = { words: [], days: [], calendar: '', fromDate: '', toDate: '' };
  const rules = filtersFrom([
    filterRecord(Object.assign({ name: '[No condition]' }, nothing)),
    filterRecord(Object.assign({ name: '[Spaces only]' }, nothing, { words: ['  ', ''], calendar: '   ' })),
    filterRecord(Object.assign({ name: '[Bad dates only]' }, nothing, { fromDate: 'soon', toDate: '04/02/2027' })),
    filterRecord(Object.assign({ name: '[Bad days only]' }, nothing, { days: [7, -1] })),
    filterRecord(Object.assign({ name: '[Off]' }, nothing, { words: ['Pre-Season'], show: false })),
    filterRecord(Object.assign({ name: '[Past]' }, nothing, { calendar: 'team', expires: '2020-01-01T00:00:00Z' })),
    filterRecord(Object.assign({ name: '[Only a day]' }, nothing, { days: [4] })),
    filterRecord(Object.assign({ name: '[Only a date]' }, nothing, { toDate: '2027-04-02' })),
  ]);
  assert.deepEqual(rules.map(rule => rule.name), ['[Off]', '[Past]', '[Only a day]', '[Only a date]']);
});

test('rules that are not a list, and entries that are not rules, give an empty list or are left out', () => {
  [undefined, null, 'oops', 7, {}].forEach(value => assert.deepEqual(filtersFrom(value), [], JSON.stringify(value)));
  assert.deepEqual(filtersFrom([undefined, null, 'text', 5, [], {}, filterRecord({ name: '[Kept]' })]).map(rule => rule.name), ['[Kept]']);
  assert.deepEqual(filtersFrom([filterRecord({ name: '[B]' }), filterRecord({ name: '[A]' })]).map(rule => rule.name), ['[B]', '[A]'], 'in the order Sanity sent them');
  assert.equal(filtersFrom([filterRecord({ name: undefined })])[0].name, '');
});

test('the sample content carries the two example rules, cleaned like the rules from Sanity', () => {
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  assert.equal(raw.calendarFilters.length, 2);

  assert.deepEqual(normalizeSample(raw).calendarFilters, [
    { name: '[Hide Pre-Season Monday and Thursday]', action: 'hide', words: ['Pre-Season'], days: [1, 4], calendar: '', fromDate: '', toDate: '' },
    { name: '[Always show Kickoff]', action: 'show', words: ['Kickoff'], days: [], calendar: '', fromDate: '', toDate: '' },
  ]);
  assert.deepEqual(normalizeSample({ calendarFilters: [filterRecord({ words: [' Pre-Season '], action: 'banana' })] }).calendarFilters.map(rule => [rule.action, rule.words]), [['hide', ['Pre-Season']]]);
});

test('a saved copy from before the filters existed gives an empty list, and a change to a rule is a change of content', async () => {
  await inWorld(async world => {
    const raw = copyOf(sanityFixture());
    assert.equal('calendarFilters' in raw, false);
    saveCopy(world, raw, start - minute);
    world.handler = async () => unreachable();

    const first = await readSanity(world.onChange);
    assert.deepEqual(first.content.calendarFilters, []);
  });

  await inWorld(async world => {
    const fixture = sanityFixture();
    fixture.calendarFilters = [filterRecord()];
    world.handler = async () => sanityReply(copyOf(fixture));
    await readSanity(world.onChange);

    fixture.calendarFilters = [filterRecord({ days: [1, 2, 4] })];
    world.streams[0].emit('message');
    await world.advance(2 * second);
    await world.advance(0);

    assert.equal(world.changes.length, 1);
    assert.deepEqual(world.changes[0].content.calendarFilters[0].days, [1, 2, 4]);
  });
});

test('photosToShow leaves out photos that are switched off, have expired, or have no picture', () => {
  const now = new Date(2026, 9, 4, 12, 0);
  const content = {
    photos: [
      photoItem('on', '2026-09-30T10:00:00Z', { show: true }),
      photoItem('missing-switch', '2026-09-29T10:00:00Z'),
      photoItem('off', '2026-09-28T10:00:00Z', { show: false }),
      photoItem('expired', '2026-09-27T10:00:00Z', { expires: '2026-10-01T12:00:00.000Z' }),
      photoItem('later', '2026-09-26T10:00:00Z', { expires: '2026-10-09T12:00:00.000Z' }),
      photoItem('no-picture', '2026-09-25T10:00:00Z', { address: '' }),
      { id: 'no-address' },
      null,
    ],
  };
  assert.deepEqual(photosToShow(content, now).map(photo => photo.id), ['on', 'missing-switch', 'later']);

  // the same photo expires while the screen runs
  assert.deepEqual(photosToShow(content, new Date(2026, 9, 10)).map(photo => photo.id), ['on', 'missing-switch']);

  // a photo from the sample has an address and nothing else, and shows
  assert.equal(photosToShow({ photos: [{ address: 'data/sample/photo-1.svg' }] }, now).length, 1);
  assert.deepEqual(photosToShow({}, now), []);
  assert.deepEqual(photosToShow({ photos: 'none' }, now), []);
});

test('newestFirst goes by the time each photo was made, and puts photos with no time last, in their own order', () => {
  const list = [
    photoItem('middle', '2026-09-10T10:00:00Z'),
    { address: 'sample-a' },
    photoItem('newest', '2026-09-20T10:00:00Z'),
    { address: 'sample-b', createdAt: 'not a time' },
    photoItem('oldest', '2026-08-01T10:00:00Z'),
    photoItem('twin', '2026-09-10T10:00:00Z'),
  ];
  const sorted = newestFirst(list);

  assert.deepEqual(sorted.map(photo => photo.id || photo.address), ['newest', 'middle', 'twin', 'oldest', 'sample-a', 'sample-b']);
  assert.deepEqual(list.map(photo => photo.id || photo.address), ['middle', 'sample-a', 'newest', 'sample-b', 'oldest', 'twin'], 'the list that was passed in is not changed');
});

test('photoKey is the id, and the address for a photo with no id', () => {
  assert.equal(photoKey({ id: 'a', address: 'x' }), 'a');
  assert.equal(photoKey({ address: 'data/sample/photo-1.svg' }), 'data/sample/photo-1.svg');
});

test('creditText is the first name only, even if a last name got in another way', () => {
  assert.equal(creditText({ credit: 'Sam' }), 'Sam');
  assert.equal(creditText({ credit: 'Mary-Anne' }), 'Mary-Anne');
  assert.equal(creditText({ credit: 'Sam Smith' }), 'Sam');
  assert.equal(creditText({ credit: '  Sam  Smith ' }), 'Sam');
  assert.equal(creditText({ credit: '' }), '');
  assert.equal(creditText({ credit: '   ' }), '');
  assert.equal(creditText({}), '');
});

test('random order never shows the same photo twice in a row, with two, three or ten photos', () => {
  [2, 3, 10].forEach(count => {
    const list = Array.from({ length: count }, (value, index) => photoItem('p' + index, '2026-09-0' + (index % 9 + 1) + 'T10:00:00Z'));
    const queue = makePhotoQueue(seededRandom(count));
    const seen = new Set();
    let last = null;

    for (let turn = 0; turn < 500; turn++) {
      const { photo, next } = queue.take(list, 'random');
      assert.notEqual(photo.id, last, 'the same photo twice in a row with ' + count + ' photos, turn ' + turn);
      assert.notEqual(next.id, photo.id, 'the next photo is the one on screen');
      seen.add(photo.id);
      last = photo.id;
    }
    assert.equal(seen.size, count, 'every photo should come round');
  });
});

test('the photo chosen as next is the one shown next, so the one that was loaded is the one that shows', () => {
  const list = ['a', 'b', 'c', 'd', 'e'].map(id => photoItem(id, '2026-09-01T10:00:00Z'));
  const queue = makePhotoQueue(seededRandom(7));

  let turn = queue.take(list, 'random');
  for (let count = 0; count < 100; count++) {
    const following = queue.take(list, 'random');
    assert.equal(following.photo, turn.next, 'turn ' + count);
    turn = following;
  }
});

test('with one photo it is shown every time, and with none nothing is', () => {
  const only = [photoItem('only', '2026-09-01T10:00:00Z')];
  ['random', 'newest-first'].forEach(order => {
    const queue = makePhotoQueue(seededRandom(1));
    for (let count = 0; count < 3; count++) {
      const { photo, next } = queue.take(only, order);
      assert.equal(photo.id, 'only');
      assert.equal(next.id, 'only');
    }
    assert.deepEqual(queue.take([], order), { photo: null, next: null });
  });
});

test('newest first walks the list from the newest to the oldest and then starts over', () => {
  const list = [
    photoItem('oldest', '2026-08-01T10:00:00Z'),
    photoItem('newest', '2026-09-20T10:00:00Z'),
    photoItem('middle', '2026-09-10T10:00:00Z'),
  ];
  const queue = makePhotoQueue(() => {
    throw new Error('newest first does not use random numbers');
  });

  const shown = [];
  for (let turn = 0; turn < 7; turn++) shown.push(queue.take(list, 'newest-first').photo.id);
  assert.deepEqual(shown, ['newest', 'middle', 'oldest', 'newest', 'middle', 'oldest', 'newest']);
  assert.equal(queue.take(list, 'newest-first').next.id, 'oldest', 'the next one is worked out while this one is up');
});

test('newest first goes on after the photo it showed when a newer one arrives, and starts at the newest when that one is gone', () => {
  const first = photoItem('first', '2026-09-01T10:00:00Z');
  const second = photoItem('second', '2026-08-01T10:00:00Z');
  const third = photoItem('third', '2026-07-01T10:00:00Z');
  const queue = makePhotoQueue();

  assert.equal(queue.take([first, second, third], 'newest-first').photo.id, 'first');
  assert.equal(queue.take([first, second, third], 'newest-first').photo.id, 'second');

  // a newer photo is uploaded: the walk carries on, and the new one comes at the next round
  const newer = photoItem('newer', '2026-10-01T10:00:00Z');
  assert.equal(queue.take([newer, first, second, third], 'newest-first').photo.id, 'third');
  assert.equal(queue.take([newer, first, second, third], 'newest-first').photo.id, 'newer');

  // the photo that was planned to come next is hidden: the one after it takes its place
  const queue2 = makePhotoQueue();
  queue2.take([first, second, third], 'newest-first');
  assert.equal(queue2.take([first, third], 'newest-first').photo.id, 'third');
});

test('a photo that is hidden or expired after it was chosen as next is not shown, and the order setting is followed at once', () => {
  const list = ['a', 'b', 'c'].map((id, index) => photoItem(id, '2026-09-0' + (index + 1) + 'T10:00:00Z'));
  const queue = makePhotoQueue(seededRandom(3));

  const turn = queue.take(list, 'random');
  const without = list.filter(photo => photo.id !== turn.next.id);
  const after = queue.take(without, 'random');
  assert.notEqual(after.photo.id, turn.next.id);
  assert.notEqual(after.photo.id, turn.photo.id);

  // the order is changed in Dashboard Settings: the next turn follows the new order, not the plan
  const queue2 = makePhotoQueue(seededRandom(3));
  queue2.take(list, 'random');
  assert.equal(queue2.take(list, 'newest-first').photo.id, 'c');
});

test('a list that grows from one photo does not show the same photo twice', () => {
  const only = photoItem('only', '2026-09-01T10:00:00Z');
  const another = photoItem('another', '2026-09-02T10:00:00Z');
  const queue = makePhotoQueue(seededRandom(5));

  assert.equal(queue.take([only], 'random').photo.id, 'only');
  assert.equal(queue.take([only, another], 'random').photo.id, 'another');
});

test('ownSeconds: a row with seconds uses them, the Photo row with none uses Seconds per photo, and the others use none', () => {
  const settings = { photoSeconds: 30, pageSeconds: 20 };

  assert.equal(ownSeconds({ panel: 'tasks', seconds: 25 }, settings), 25);
  assert.equal(ownSeconds({ panel: 'photo', seconds: 40 }, settings), 40);
  assert.equal(ownSeconds({ panel: 'photo' }, settings), 30);
  assert.equal(ownSeconds({ panel: 'photo', seconds: 0 }, settings), 30);
  assert.equal(ownSeconds({ panel: 'photo', seconds: null }, settings), 30);
  assert.equal(ownSeconds({ panel: 'tasks' }, settings), 0);
  assert.equal(ownSeconds({ panel: 'events' }, settings), 0);
  assert.equal(ownSeconds({ panel: 'next-event' }, settings), 0);

  // a missing or unusable setting is the default, 16
  assert.equal(ownSeconds({ panel: 'photo' }, {}), 16);
  assert.equal(ownSeconds({ panel: 'photo' }, { photoSeconds: 'soon' }), 16);
  assert.equal(ownSeconds({ panel: 'photo' }, { photoSeconds: -3 }), 16);
});

test('Photo order and Seconds per photo are checked like the other settings', () => {
  live.config.photoOrders.forEach(name => {
    settingsThrough({ photoOrder: name }).forEach(settings => assert.equal(settings.photoOrder, name));
  });
  [undefined, null, '', 'Random', 'newest', 'newest first', 'toString', 3, ['random'], {}].forEach(value => {
    settingsThrough({ photoOrder: value }).forEach(settings => assert.equal(settings.photoOrder, 'random', JSON.stringify(value)));
  });

  // from 6 to 120, and what is outside is brought to the nearest end
  [[6, 6], [16, 16], [120, 120], [3, 6], [0, 6], [-5, 6], [500, 120]].forEach(([value, wanted]) => {
    settingsThrough({ photoSeconds: value }).forEach(settings => assert.equal(settings.photoSeconds, wanted, String(value)));
  });
  [undefined, null, '', '20', NaN, Infinity, true, {}].forEach(value => {
    const results = settingsThrough({ photoSeconds: value });
    results.slice(0, 3).forEach(settings => assert.equal(settings.photoSeconds, Number.isFinite(value) ? value : 16, String(value)));
  });
});

test('the sample content keeps its photo list, now inside the content, and the Photos settings', () => {
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  const content = normalizeSample(raw);

  assert.equal(content.photos.length, 3);
  assert.deepEqual(content.photos.map(photo => photo.address), ['data/sample/photo-1.svg', 'data/sample/photo-2.svg', 'data/sample/photo-3.svg']);
  assert.equal(content.photos[0].caption, '[Photo caption one]');
  assert.equal(content.photos[0].credit, '[Name]');
  assert.equal('credit' in content.photos[1], false);
  assert.equal('caption' in content.photos[2], false, 'an empty caption is left out');
  assert.equal(photosToShow(content).length, 3);
  assert.deepEqual([content.settings.photoOrder, content.settings.photoSeconds], ['random', 16]);

  raw.photos.forEach(photo => {
    assert.ok(fs.existsSync(path.join(dashboardFolder, photo.address)), photo.address + ' is not in the sample folder');
  });

  // an item with no address is dropped, and no list at all gives no photos
  assert.deepEqual(normalizeSample({ photos: [{ caption: 'no address' }, { address: 'a.svg' }] }).photos, [{ address: 'a.svg' }]);
  assert.deepEqual(normalizeSample({}).photos, []);
});

test('the Night mode settings: the starting values, the two choices and the logo width, through all three paths', () => {
  const defaults = live.config.defaultSettings;
  assert.deepEqual(
    [defaults.nightEnabled, defaults.nightStyle, defaults.nightLogoWidth, defaults.nightSpeed, defaults.nightPreview],
    [true, 'bounce', 300, 'normal', false]
  );
  assert.deepEqual(live.config.nightStyles, ['bounce', 'black']);
  assert.deepEqual(Object.keys(live.config.nightSpeeds), ['slow', 'normal', 'fast']);

  // a published page that lacks every one of them gets the starting values
  settingsThrough({}).forEach(settings => nightSettingNames.forEach(name => assert.equal(settings[name], defaults[name], name)));

  // the two choices
  live.config.nightStyles.forEach(name => settingsThrough({ nightStyle: name }).forEach(settings => assert.equal(settings.nightStyle, name)));
  Object.keys(live.config.nightSpeeds).forEach(name => settingsThrough({ nightSpeed: name }).forEach(settings => assert.equal(settings.nightSpeed, name)));
  [undefined, null, '', 'Bounce', 'blank', 'toString', 0, true, ['black'], {}].forEach(value => {
    settingsThrough({ nightStyle: value }).forEach(settings => assert.equal(settings.nightStyle, 'bounce', JSON.stringify(value)));
  });
  [undefined, null, '', 'Fast', 'very-fast', 'constructor', 0, true, ['fast'], {}].forEach(value => {
    settingsThrough({ nightSpeed: value }).forEach(settings => assert.equal(settings.nightSpeed, 'normal', JSON.stringify(value)));
  });

  // the logo width is from 120 to 800, and what is outside is brought to the nearest end
  [[120, 120], [300, 300], [800, 800], [50, 120], [0, 120], [-9, 120], [5000, 800]].forEach(([value, wanted]) => {
    settingsThrough({ nightLogoWidth: value }).forEach(settings => assert.equal(settings.nightLogoWidth, wanted, String(value)));
  });
  [undefined, null, '', '300', NaN, Infinity, true, {}].forEach(value => {
    const results = settingsThrough({ nightLogoWidth: value });
    results.slice(0, 3).forEach(settings => assert.equal(settings.nightLogoWidth, Number.isFinite(value) ? value : 300, String(value)));
  });

  // the two switches: night mode starts on and the preview off, and anything but true or false is that
  [true, false].forEach(value => {
    settingsThrough({ nightEnabled: value, nightPreview: value }).forEach(settings => assert.deepEqual([settings.nightEnabled, settings.nightPreview], [value, value]));
  });
  [undefined, null, '', 'false', 'on', 0, 1, [], {}].forEach(value => {
    settingsThrough({ nightEnabled: value, nightPreview: value }).forEach(settings => {
      assert.deepEqual([settings.nightEnabled, settings.nightPreview], [true, false], JSON.stringify(value));
    });
  });
});

test('the sample content carries the Night mode settings', () => {
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  const settings = normalizeSample(raw).settings;

  nightSettingNames.forEach(name => {
    assert.ok(name in raw.settings, name + ' is in the sample file');
    assert.equal(settings[name], live.config.defaultSettings[name], name);
  });
  assert.equal(normalizeSample({}).theme.timeZone, 'America/New_York', 'night mode reads its zone from the Look page, which starts as New York');
});

// The names of the hidden transition settings, and the last push from the Studio
const hiddenSettingNames = ['hiddenEnabled', 'desktopChance', 'redEyesChance'];

test('the Hidden settings: the starting values, the master switch and the two chances, through all three paths', () => {
  const defaults = live.config.defaultSettings;
  assert.deepEqual([defaults.hiddenEnabled, defaults.desktopChance, defaults.redEyesChance], [true, 1, 1]);
  assert.deepEqual(defaults.hiddenRequest, { kind: '', requestedAt: '' });

  // a published page that lacks every one of them gets the starting values
  settingsThrough({}).forEach(settings => {
    hiddenSettingNames.forEach(name => assert.equal(settings[name], defaults[name], name));
    assert.deepEqual(settings.hiddenRequest, { kind: '', requestedAt: '' });
  });

  // a chance is a percent from 0 to 100, 0 is never, and what is outside is brought to the nearest end
  [[0, 0], [1, 1], [50, 50], [100, 100], [0.5, 0.5], [-3, 0], [101, 100], [5000, 100]].forEach(([value, wanted]) => {
    settingsThrough({ desktopChance: value, redEyesChance: value }).forEach(settings => {
      assert.deepEqual([settings.desktopChance, settings.redEyesChance], [wanted, wanted], String(value));
    });
  });
  [undefined, null, '', '5', NaN, Infinity, true, [], {}].forEach(value => {
    const results = settingsThrough({ desktopChance: value, redEyesChance: value });
    results.slice(0, 3).forEach(settings => {
      assert.deepEqual([settings.desktopChance, settings.redEyesChance], Number.isFinite(value) ? [value, value] : [1, 1], String(value));
    });
  });

  // the master switch starts on, and anything but true or false is on
  [true, false].forEach(value => settingsThrough({ hiddenEnabled: value }).forEach(settings => assert.equal(settings.hiddenEnabled, value)));
  [undefined, null, '', 'false', 'off', 0, 1, [], {}].forEach(value => {
    settingsThrough({ hiddenEnabled: value }).forEach(settings => assert.equal(settings.hiddenEnabled, true, JSON.stringify(value)));
  });
});

// The names of the settings in the Presentations tab. The wait for the speaker and the overrun are
// fixed in core/constants.js and are not settings.
const presentationSettingNames = ['presentationsEnabled'];

test('the Presentations settings: the starting value and the switch, through all three paths', () => {
  const defaults = live.config.defaultSettings;
  assert.equal(defaults.presentationsEnabled, true);

  // a published page that lacks it gets the starting value
  settingsThrough({}).forEach(settings => {
    presentationSettingNames.forEach(name => assert.equal(settings[name], defaults[name], name));
  });

  // the switch starts on, and anything but true or false is on
  [true, false].forEach(value => settingsThrough({ presentationsEnabled: value }).forEach(settings => assert.equal(settings.presentationsEnabled, value)));
  [undefined, null, '', 'false', 'off', 0, 1, [], {}].forEach(value => {
    settingsThrough({ presentationsEnabled: value }).forEach(settings => assert.equal(settings.presentationsEnabled, true, JSON.stringify(value)));
  });
});

test('the sample content carries the Presentations settings', () => {
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  const settings = normalizeSample(raw).settings;

  presentationSettingNames.forEach(name => {
    assert.ok(name in raw.settings, name + ' is in the sample file');
    assert.equal(settings[name], live.config.defaultSettings[name], name);
  });
});

test('the sample content carries one Meeting day, one talk with its text in square brackets, and six slides with a manifest', () => {
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  const sample = normalizeSample(raw);

  // the talk fits the Studio: a name up to 12 characters, a title up to 40, a length of 5 to 30 minutes
  assert.equal(sample.presentations.length, 1);
  const talk = sample.presentations[0];
  ['name', 'subteam', 'topic'].forEach(name => assert.match(talk[name], /^\[.+\]$/, name));
  assert.ok(talk.name.length <= 12 && talk.topic.length <= 40);
  assert.ok(talk.minutes >= live.config.limits.talkMinutes.min && talk.minutes <= live.config.limits.talkMinutes.max);
  assert.equal(talk.status, 'scheduled');
  assert.ok(!('deckLink' in talk), 'no link to a deck that someone else owns');

  // it starts on a slot of the Meeting day
  assert.equal(raw.presentationDays.length, 1);
  const day = raw.presentationDays[0];
  const first = Date.parse(day.firstSlotAt);
  const last = Date.parse(day.lastSlotAt);
  assert.deepEqual(Object.keys(day).sort(), ['closeMinutesBefore', 'firstSlotAt', 'lastSlotAt', 'open', 'slotMinutes']);
  assert.ok(first <= talk.start.getTime() && talk.start.getTime() <= last);
  assert.equal((talk.start.getTime() - first) % (day.slotMinutes * 60000), 0, 'on a slot');
  assert.equal(day.open, true);

  // the folder is where the screen looks for the slides of a sample talk, and the manifest has the shape the Mini writes
  const folder = path.join(dashboardFolder, live.presentation.slidesFolder(true, talk));
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest), ['ok', 'pages', 'fetchedAt', 'refreshed']);
  assert.equal(manifest.ok, true);
  assert.equal(manifest.refreshed, false);
  assert.ok(!isNaN(Date.parse(manifest.fetchedAt)));
  assert.deepEqual(manifest.pages, ['001.svg', '002.svg', '003.svg', '004.svg', '005.svg', '006.svg']);
  assert.deepEqual(live.presentation.slidePages(manifest), manifest.pages);
  assert.deepEqual(fs.readdirSync(folder).filter(name => !name.startsWith('.')).sort(), ['manifest.json'].concat(manifest.pages).sort());

  // each slide is a picture of 1920 by 1080 with the word SLIDE and its number, in text of 44px or more and lines of 3px or more
  manifest.pages.forEach((page, index) => {
    const svg = fs.readFileSync(path.join(folder, page), 'utf8');
    assert.match(svg, /viewBox="0 0 1920 1080"/, page);
    assert.ok(svg.includes('>SLIDE ' + (index + 1) + '</text>'), page);
    (svg.match(/font-size="(\d+)"/g) || []).forEach(size => assert.ok(Number(size.match(/\d+/)[0]) >= 44, page + ' ' + size));
    (svg.match(/stroke-width="([\d.]+)"/g) || []).forEach(width => assert.ok(Number(width.match(/[\d.]+/)[0]) >= 3, page + ' ' + width));
    assert.ok(!/<script|<image|<filter|href=/.test(svg), page + ' holds only plain shapes and text');
  });
});

test('the last push from the Studio is kept as a kind and a time, and anything that is not one is empty', () => {
  const push = { kind: 'redEyes', requestedAt: '2026-10-05T12:00:00.000Z' };
  settingsThrough({ hiddenRequest: push }).forEach(settings => assert.deepEqual(settings.hiddenRequest, push));

  // the kind has to be one in the registry, and the time has to be a time
  settingsThrough({ hiddenRequest: { kind: 'desktop', requestedAt: 'whenever' } }).forEach(settings => {
    assert.deepEqual(settings.hiddenRequest, { kind: 'desktop', requestedAt: '' });
  });
  settingsThrough({ hiddenRequest: { kind: 'megaflash', requestedAt: push.requestedAt } }).forEach(settings => {
    assert.deepEqual(settings.hiddenRequest, { kind: '', requestedAt: push.requestedAt });
  });
  [undefined, null, 'redEyes', 12, [], [push]].forEach(value => {
    settingsThrough({ hiddenRequest: value }).forEach(settings => assert.deepEqual(settings.hiddenRequest, { kind: '', requestedAt: '' }, JSON.stringify(value)));
  });

  // only the two fields come through from a stored page, and the document's own names do not
  const stored = normalizeContent({ settings: document('dashboardSettings', 'dashboardSettings', { hiddenRequest: Object.assign({ _type: 'x', extra: 1 }, push) }) }).settings;
  assert.deepEqual(stored.hiddenRequest, push);
});

test('the sample content carries the Hidden settings and no push', () => {
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  const settings = normalizeSample(raw).settings;

  hiddenSettingNames.forEach(name => {
    assert.ok(name in raw.settings, name + ' is in the sample file');
    assert.equal(settings[name], live.config.defaultSettings[name], name);
  });
  assert.ok(!('hiddenRequest' in raw.settings), 'a push is never part of the sample');
  assert.deepEqual(settings.hiddenRequest, { kind: '', requestedAt: '' });
});

test('the last click of Play announcements is kept as a time, and anything that is not one is empty, through all three paths', () => {
  const defaults = live.config.defaultSettings;
  assert.deepEqual(defaults.announceRequest, { requestedAt: '' });

  // a published page that lacks it gets the starting value
  settingsThrough({}).forEach(settings => assert.deepEqual(settings.announceRequest, { requestedAt: '' }));

  const request = { requestedAt: '2026-10-05T12:00:00.000Z' };
  settingsThrough({ announceRequest: request }).forEach(settings => assert.deepEqual(settings.announceRequest, request));
  settingsThrough({ announceRequest: { requestedAt: 'whenever' } }).forEach(settings => assert.deepEqual(settings.announceRequest, { requestedAt: '' }));
  [undefined, null, '', request.requestedAt, 12, [], [request]].forEach(value => {
    settingsThrough({ announceRequest: value }).forEach(settings => assert.deepEqual(settings.announceRequest, { requestedAt: '' }, JSON.stringify(value)));
  });

  // only the time comes through from a stored page, and the document's own names do not
  const stored = normalizeContent({ settings: document('dashboardSettings', 'dashboardSettings', { announceRequest: Object.assign({ _type: 'x', extra: 1 }, request) }) }).settings;
  assert.deepEqual(stored.announceRequest, request);

  // it does not touch the announcements themselves, and the sample carries no request
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  assert.ok(!('announceRequest' in raw.settings), 'a request is never part of the sample');
  assert.deepEqual(normalizeSample(raw).settings.announceRequest, { requestedAt: '' });
  assert.deepEqual(stored.announcements, live.config.defaultSettings.announcements, 'a page with no announcements list still has the starting ones');
});

test('the last click of Next look now and of Preview competition is kept as a time, and anything that is not one is empty, through all three paths', () => {
  const defaults = live.config.defaultSettings;
  const request = { requestedAt: '2026-10-05T12:00:00.000Z' };

  ['nextLookRequest', 'competitionPreviewRequest'].forEach(name => {
    assert.deepEqual(defaults[name], { requestedAt: '' }, name);

    // a published page that lacks it gets the starting value
    settingsThrough({}).forEach(settings => assert.deepEqual(settings[name], { requestedAt: '' }, name));

    settingsThrough({ [name]: request }).forEach(settings => assert.deepEqual(settings[name], request, name));
    settingsThrough({ [name]: { requestedAt: 'whenever' } }).forEach(settings => assert.deepEqual(settings[name], { requestedAt: '' }, name));
    [undefined, null, '', request.requestedAt, 12, [], [request]].forEach(value => {
      settingsThrough({ [name]: value }).forEach(settings => assert.deepEqual(settings[name], { requestedAt: '' }, name + ' ' + JSON.stringify(value)));
    });

    // only the time comes through from a stored page, and the document's own names do not
    const stored = normalizeContent({ settings: document('dashboardSettings', 'dashboardSettings', { [name]: Object.assign({ _type: 'x', extra: 1 }, request) }) }).settings;
    assert.deepEqual(stored[name], request, name);

    // the sample carries no request
    const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
    assert.ok(!(name in raw.settings), name + ' is never part of the sample');
    assert.deepEqual(normalizeSample(raw).settings[name], { requestedAt: '' }, name);
  });

  // one request does not touch the other
  settingsThrough({ nextLookRequest: request }).forEach(settings => assert.deepEqual(settings.competitionPreviewRequest, { requestedAt: '' }));
});

// The names of the team settings
const teamSettingNames = ['teamMode', 'alternateMinutes'];

test('the Teams settings: Prime only and 5 minutes to start with, one of three modes, and 1 to 30 minutes, through all three paths', () => {
  const defaults = live.config.defaultSettings;
  assert.deepEqual(live.config.teamModes, ['prime', 'nova', 'alternate']);
  assert.deepEqual([defaults.teamMode, defaults.alternateMinutes], ['prime', 5]);
  assert.deepEqual(live.config.limits.alternateMinutes, { min: 1, max: 30 });

  // a published page that lacks both gets the starting values
  settingsThrough({}).forEach(settings => {
    teamSettingNames.forEach(name => assert.equal(settings[name], defaults[name], name));
  });

  // the three modes are kept, and anything else is Prime only
  live.config.teamModes.forEach(mode => settingsThrough({ teamMode: mode }).forEach(settings => assert.equal(settings.teamMode, mode)));
  ['Prime', 'NOVA', 'both', 'prime only', '', ' nova', 0, 1, true, null, [], {}].forEach(value => {
    settingsThrough({ teamMode: value }).forEach(settings => assert.equal(settings.teamMode, 'prime', JSON.stringify(value)));
  });

  // the minutes are 1 to 30, and what is outside is brought to the nearest end
  [[1, 1], [5, 5], [30, 30], [0, 1], [-4, 1], [31, 30], [600, 30]].forEach(([value, wanted]) => {
    settingsThrough({ alternateMinutes: value }).forEach(settings => assert.equal(settings.alternateMinutes, wanted, String(value)));
  });
  [undefined, null, '', '7', NaN, Infinity, true, [], {}].forEach(value => {
    settingsThrough({ alternateMinutes: value }).forEach(settings => assert.equal(settings.alternateMinutes, 5, String(value)));
  });
});

test('the sample content carries the Teams settings', () => {
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  const settings = normalizeSample(raw).settings;

  teamSettingNames.forEach(name => {
    assert.ok(name in raw.settings, name + ' is in the sample file');
    assert.equal(settings[name], live.config.defaultSettings[name], name);
  });
});

test('the last click of Run presentation test is kept as a time, and anything that is not one is empty, through all three paths', () => {
  const defaults = live.config.defaultSettings;
  assert.deepEqual(defaults.presentationTestRequest, { requestedAt: '' });

  // a published page that lacks it gets the starting value
  settingsThrough({}).forEach(settings => assert.deepEqual(settings.presentationTestRequest, { requestedAt: '' }));

  const request = { requestedAt: '2026-10-05T12:00:00.000Z' };
  settingsThrough({ presentationTestRequest: request }).forEach(settings => assert.deepEqual(settings.presentationTestRequest, request));
  settingsThrough({ presentationTestRequest: { requestedAt: 'whenever' } }).forEach(settings => assert.deepEqual(settings.presentationTestRequest, { requestedAt: '' }));
  [undefined, null, '', request.requestedAt, 12, [], [request]].forEach(value => {
    settingsThrough({ presentationTestRequest: value }).forEach(settings => assert.deepEqual(settings.presentationTestRequest, { requestedAt: '' }, JSON.stringify(value)));
  });

  // only the time comes through from a stored page, and the document's own names do not
  const stored = normalizeContent({ settings: document('dashboardSettings', 'dashboardSettings', { presentationTestRequest: Object.assign({ _type: 'x', extra: 1 }, request) }) }).settings;
  assert.deepEqual(stored.presentationTestRequest, request);

  // it does not touch the other Presentations settings, and the sample carries no request
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  assert.ok(!('presentationTestRequest' in raw.settings), 'a request is never part of the sample');
  assert.deepEqual(normalizeSample(raw).settings.presentationTestRequest, { requestedAt: '' });
  assert.equal(stored.presentationsEnabled, true);
});

test('the last click of a Preview button is kept as a kind and a time, and anything that is not one is empty, through all three paths', () => {
  const defaults = live.config.defaultSettings;
  assert.deepEqual(defaults.previewRequest, { kind: '', requestedAt: '' });

  // a published page that lacks it gets the starting value
  settingsThrough({}).forEach(settings => assert.deepEqual(settings.previewRequest, { kind: '', requestedAt: '' }));

  // the kind has to be one in the registry, and the time has to be a time
  const request = { kind: 'next-pack', requestedAt: '2026-10-05T12:00:00.000Z' };
  settingsThrough({ previewRequest: request }).forEach(settings => assert.deepEqual(settings.previewRequest, request));
  ['prime', 'nova', 'cybertron', 'minimal'].forEach(kind => {
    settingsThrough({ previewRequest: { kind: kind, requestedAt: request.requestedAt } }).forEach(settings => assert.equal(settings.previewRequest.kind, kind));
  });
  settingsThrough({ previewRequest: { kind: 'nova', requestedAt: 'whenever' } }).forEach(settings => assert.deepEqual(settings.previewRequest, { kind: 'nova', requestedAt: '' }));
  settingsThrough({ previewRequest: { kind: 'neon', requestedAt: request.requestedAt } }).forEach(settings => assert.deepEqual(settings.previewRequest, { kind: '', requestedAt: request.requestedAt }));
  [undefined, null, '', 'nova', 12, [], [request]].forEach(value => {
    settingsThrough({ previewRequest: value }).forEach(settings => assert.deepEqual(settings.previewRequest, { kind: '', requestedAt: '' }, JSON.stringify(value)));
  });

  // only the two fields come through from a stored page, and the document's own names do not
  const stored = normalizeContent({ settings: document('dashboardSettings', 'dashboardSettings', { previewRequest: Object.assign({ _type: 'x', extra: 1 }, request) }) }).settings;
  assert.deepEqual(stored.previewRequest, request);

  // it does not touch the style or the Teams settings, and the sample carries no request
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  assert.ok(!('previewRequest' in raw.settings), 'a request is never part of the sample');
  assert.deepEqual(normalizeSample(raw).settings.previewRequest, { kind: '', requestedAt: '' });
  assert.deepEqual([stored.style, stored.teamMode, stored.alternateMinutes], ['original', 'prime', 5]);
});

test('photos are read from Sanity with the rest of the content, and nothing reads a photos.json any more', () => {
  const code = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');
  const scripts = [];
  (function walk(folder) {
    fs.readdirSync(path.join(dashboardFolder, folder), { withFileTypes: true }).forEach(entry => {
      const relative = path.join(folder, entry.name);
      if (entry.isDirectory() && entry.name !== 'data' && entry.name !== 'fonts') walk(relative);
      else if (entry.name.endsWith('.js')) scripts.push(relative);
    });
  })('.');

  scripts.forEach(file => {
    assert.equal(/photos\.json|readPhotos/.test(code(file)), false, file + ' still reads a photo list file');
  });
  assert.equal(fs.existsSync(path.join(dashboardFolder, 'data/sample/photos.json')), false);
  assert.equal(code('shell.js').includes('extras.photos'), false);

  // the stay of the Photo panel is worked out from the Photos setting
  const schedule = code('core/schedule.js');
  assert.ok(schedule.includes("import { ownSeconds } from './photos.js';"));
  assert.ok(schedule.includes('stayFor(region, ownSeconds(next.step, settings), settings)'));
});

test('the Photo panel uses the visible photos, the order setting, the credit at 44px, and loads the next photo', () => {
  const panel = fs.readFileSync(path.join(dashboardFolder, 'panels/photo/photo.js'), 'utf8');
  const style = fs.readFileSync(path.join(dashboardFolder, 'panels/photo/photo.css'), 'utf8');

  assert.ok(panel.includes('queue.take(photosToShow(content), content.settings && content.settings.photoOrder)'));
  assert.ok(panel.includes('return photosToShow(content).length > 0;'));
  assert.ok(panel.includes('preloadImages([turn.next.address])'), 'the next photo is not loaded');
  assert.ok(panel.includes('Photo: ${escapeHtml(credit)}'), 'the credit does not say Photo: and the name');
  assert.ok(panel.includes('object-position'), 'the hotspot is not used');
  assert.equal(/Math\.random/.test(panel), false, 'the panel chooses by itself, not through the queue');

  assert.ok(/\.photo \.credit\s*\{[^}]*font: 500 var\(--size-label\)\/56px/.test(style), 'the credit is not at least 44px');
  const credit = style.match(/\.photo \.credit\s*\{[^}]*\}/)[0];
  assert.ok(credit.includes('background: var(--card);') && credit.includes('color: var(--white);'), 'the credit is not white on the card colour, a pair check-themes.mjs tests');
  assert.ok(/--size-label: 44px;/.test(fs.readFileSync(path.join(dashboardFolder, 'tokens.css'), 'utf8')));
  assert.equal(/blur|box-shadow|text-shadow|filter/.test(style), false, 'the photo panel uses an effect that is not allowed');
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
  assert.deepEqual(drawn, ['card-292x292']);
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

  // the photo is asked for at 280 and, at full size, drawn at 280. The sizes in base.css are the
  // fallbacks of the variables that portrait.js sets, so they are the full size
  assert.ok(photoAddress({ photo: tidyPhoto(photoRecord()) }).includes('w=280&h=280'));
  assert.ok(/\.portrait-photo\s*\{[^}]*width: var\(--portrait-photo, 280px\);[^}]*height: var\(--portrait-photo, 280px\);/.test(base));
  assert.ok(/\.portrait\s*\{[^}]*width: var\(--portrait-card, 292px\);[^}]*height: var\(--portrait-card, 292px\);/.test(base));
  // the picture sits 6px in from the card's edge, with its cut corner beside the card's.
  // The cut is in percent, so it scales with the picture: 30.2px and 37.7px of 280px
  assert.ok(/\.portrait-photo\s*\{[^}]*left: var\(--portrait-inset, 6px\);[^}]*top: var\(--portrait-inset, 6px\);/.test(base));
  assert.ok(base.includes('polygon(0 0, 100% 0, 100% 89.214%, 86.536% 100%, 0 100%)'));
  assert.equal(Math.round((1 - 30.2 / 280) * 100000) / 1000, 89.214);
  assert.equal(Math.round((1 - 37.7 / 280) * 100000) / 1000, 86.536);
  assert.ok(/\.portrait \.card-outline\s*\{[^}]*width: 100%;[^}]*height: 100%;/.test(base), 'the card is not drawn smaller with the portrait');
  assert.ok(/\.slot-name\s*\{ font: 500 var\(--size-body\)\//.test(base));
  assert.ok(/\.slot-role\s*\{[^}]*font: 600 var\(--size-label\)\//.test(base));
  assert.ok(tokens.includes('--size-body: 56px;') && tokens.includes('--size-label: 44px;'));
});

// The two size settings of the photo settings: Portrait size and Photo size

test('Portrait size and Photo size start at 100, are whole percents from 60 to 100, and anything odd is 100', () => {
  const defaults = live.config.defaultSettings;
  assert.equal(defaults.portraitScale, 100);
  assert.equal(defaults.photoScale, 100);
  assert.deepEqual(live.config.limits.portraitScale, { min: 60, max: 100 });
  assert.deepEqual(live.config.limits.photoScale, { min: 60, max: 100 });

  ['portraitScale', 'photoScale'].forEach(name => {
    // in range stays, a fraction is rounded, and what is outside is brought to the nearest end
    [[60, 60], [80, 80], [100, 100], [79.6, 80], [60.4, 60], [99.5, 100], [59, 60], [0, 60], [-5, 60], [101, 100], [500, 100]].forEach(([value, wanted]) => {
      settingsThrough({ [name]: value }).forEach(settings => assert.equal(settings[name], wanted, name + ' ' + value));
    });
    // missing or not a number: the full size
    [undefined, null, '', '80', NaN, Infinity, -Infinity, true, {}, [80]].forEach(value => {
      settingsThrough({ [name]: value }).forEach(settings => assert.equal(settings[name], 100, name + ' ' + String(value)));
    });
    // no settings at all
    settingsThrough({}).forEach(settings => assert.equal(settings[name], 100));
  });

  // each setting stands on its own
  settingsThrough({ portraitScale: 70, photoScale: 90 }).forEach(settings => {
    assert.equal(settings.portraitScale, 70);
    assert.equal(settings.photoScale, 90);
  });
  settingsThrough({ portraitScale: 70 }).forEach(settings => assert.equal(settings.photoScale, 100));

  // the panels call the same rule, so a size that did not come through the settings is still safe
  assert.equal(live.content.tidyScale('photoScale', 72.4), 72);
  assert.equal(live.content.tidyScale('portraitScale', 'big'), 100);
});

test('the sample content has both sizes at 100', () => {
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  assert.equal(raw.settings.portraitScale, 100);
  assert.equal(raw.settings.photoScale, 100);

  const settings = normalizeSample(raw).settings;
  assert.deepEqual([settings.portraitScale, settings.photoScale], [100, 100]);
});

test('portraitSizes: the card, the photo and the space round it at 60, 80 and 100 percent', () => {
  const { portraitSizes } = live.portrait;

  // 100 is the size the portraits have always had
  assert.deepEqual(portraitSizes(100), { card: 292, photo: 280, inset: 6 });
  assert.deepEqual(portraitSizes(80), { card: 234, photo: 224, inset: 5 });
  assert.deepEqual(portraitSizes(60), { card: 175, photo: 167, inset: 4 });

  // no value, or one that is not allowed, is the same as the setting being fixed
  assert.deepEqual(portraitSizes(), portraitSizes(100));
  assert.deepEqual(portraitSizes('big'), portraitSizes(100));
  assert.deepEqual(portraitSizes(30), portraitSizes(60));
  assert.deepEqual(portraitSizes(250), portraitSizes(100));
  assert.deepEqual(portraitSizes(79.6), portraitSizes(80));

  // at every whole percent: whole pixels, the photo is the card less the space on both sides,
  // and a bigger setting never gives a smaller portrait
  let before = null;
  for (let percent = 60; percent <= 100; percent++) {
    const size = portraitSizes(percent);
    [size.card, size.photo, size.inset].forEach(number => assert.ok(Number.isInteger(number) && number > 0, percent + ' gave ' + JSON.stringify(size)));
    assert.equal(size.photo, size.card - 2 * size.inset, String(percent));
    assert.ok(Math.abs(size.card - 292 * percent / 100) <= 0.5, 'the card is in proportion at ' + percent);
    if (before) assert.ok(size.card >= before.card && size.photo >= before.photo && size.inset >= before.inset, 'sizes went down at ' + percent);
    before = size;
  }

  // the slot of the Roster panel is 352 wide, so a portrait never needs more than its slot
  assert.ok(portraitSizes(100).card <= 352);
});

test('a slot follows the Portrait size, keeps the card shape and the text, and is the old markup at 100', () => withFakePage(drawn => {
  const slot = { name: '[Alex]', role: 'CAPTAIN', address: photoBase + '?w=280&h=280', metal: 'gold' };
  const full = slotMarkup(slot);
  const same = slotMarkup(Object.assign({ scale: 100 }, slot));
  const small = slotMarkup(Object.assign({ scale: 60 }, slot));
  const medium = slotMarkup(Object.assign({ scale: 80 }, slot));

  // no scale is 100, and 100 is exactly the sizes the slot had before the setting
  assert.equal(same, full);
  assert.ok(full.includes('<div class="portrait" style="--portrait-card: 292px; --portrait-photo: 280px; --portrait-inset: 6px">'));
  assert.ok(full.includes('width="280" height="280" alt="">'));
  assert.ok(medium.includes('--portrait-card: 234px; --portrait-photo: 224px; --portrait-inset: 5px'));
  assert.ok(small.includes('<div class="portrait" style="--portrait-card: 175px; --portrait-photo: 167px; --portrait-inset: 4px">'));
  assert.ok(small.includes('width="167" height="167" alt="">'));

  // the card is always the one shape of 292, which the browser draws smaller: so the metal edge and the cut corner shrink with it
  assert.deepEqual(Array.from(new Set(drawn)), ['card-292x292']);
  assert.ok(small.includes('href="#card-292x292"'));

  // only the three variables and the picture's size differ. The name, the role, the metal and the slat are the same.
  const withoutSizes = markup => markup.replace(/ style="--portrait[^"]*"/, '').replace(/ width="\d+" height="\d+" alt=""/, '');
  assert.equal(withoutSizes(small), withoutSizes(full));
  assert.ok(small.includes('<div class="slot-name">[Alex]</div>') && small.includes('<div class="slot-role">CAPTAIN</div>'));

  // the silhouette is drawn at its own size and the browser stretches it to the portrait
  const noPhoto = slotMarkup({ name: '[Alex]', role: '', address: '', scale: 60 });
  assert.ok(noPhoto.includes('<svg class="silhouette" width="280" height="280" viewBox="0 0 280 280">'));
  assert.ok(noPhoto.includes('--portrait-card: 175px; --portrait-photo: 167px'));
}));

test('photoLayout: the card and the caption at 60, 80 and 100 percent, with and without a caption', () => {
  const { photoLayout } = live.photos;

  // 100 is where the Photo panel always was: 28 from the left, 142 from the top, the caption at 622
  assert.deepEqual(photoLayout(100, true), { card: { left: 28, top: 142, width: 1096, height: 464 }, caption: { left: 52, top: 622, width: 1004 } });
  assert.deepEqual(photoLayout(100, false).card, { left: 28, top: 142, width: 1096, height: 514 });
  assert.deepEqual(photoLayout(undefined, true), photoLayout(100, true));
  assert.deepEqual(photoLayout('large', false), photoLayout(100, false));

  assert.deepEqual(photoLayout(80, true), { card: { left: 138, top: 189, width: 877, height: 371 }, caption: { left: 162, top: 576, width: 894 } });
  assert.deepEqual(photoLayout(80, false).card, { left: 138, top: 194, width: 877, height: 411 });
  assert.deepEqual(photoLayout(60, true), { card: { left: 247, top: 235, width: 658, height: 278 }, caption: { left: 271, top: 529, width: 785 } });
  assert.deepEqual(photoLayout(60, false).card, { left: 247, top: 245, width: 658, height: 308 });
  assert.deepEqual(photoLayout(59, true), photoLayout(60, true));
  assert.deepEqual(photoLayout(1000, true), photoLayout(100, true));

  // the frame's cut corner runs from (1148, 640) to (1068, 704): the most x a point can have at a height
  const frameLimit = y => (y <= 640 ? 1148 : 1148 - (y - 640) * 80 / 64);

  [true, false].forEach(hasCaption => {
    for (let percent = 60; percent <= 100; percent++) {
      const layout = photoLayout(percent, hasCaption);
      const card = layout.card;
      const where = percent + (hasCaption ? ' with' : ' without') + ' a caption';

      // in proportion to the full card, in whole pixels
      assert.ok(Math.abs(card.width - 1096 * percent / 100) <= 0.5, 'width at ' + where);
      assert.ok(Math.abs(card.height - (hasCaption ? 464 : 514) * percent / 100) <= 0.5, 'height at ' + where);
      // in the middle of the panel (1152 wide), to the pixel
      assert.ok(Math.abs(card.left - (1152 - card.width - card.left)) <= 1, 'centred across at ' + where);
      // never above the header's plate (the body starts at 120) and never below the space it has at 100
      assert.ok(card.top >= 142, 'below the header at ' + where);
      const bottom = hasCaption ? layout.caption.top + 64 : card.top + card.height;
      assert.ok(bottom <= (hasCaption ? 686 : 656), 'inside the space it has at 100, ' + where);
      // the card's own cut corner is clear of the frame's
      assert.ok(card.left + card.width <= frameLimit(card.top + card.height - 34) - 20, 'right of the card at ' + where);
      assert.ok(card.left + card.width - 42 <= frameLimit(card.top + card.height) - 20, 'cut corner at ' + where);

      if (hasCaption) {
        const caption = layout.caption;
        assert.equal(caption.top, card.top + card.height + 16, 'the caption is directly under the card at ' + where);
        assert.equal(caption.left, card.left + 24, 'the caption lines up with the card at ' + where);
        assert.ok(caption.width > 0 && caption.width <= 1004, 'caption width at ' + where);
        // it always stops where it stops at full size, which is clear of the frame's cut corner
        assert.equal(caption.left + caption.width, 1056, 'the caption stops at 1056 at ' + where);
        assert.ok(caption.left + caption.width <= frameLimit(caption.top + 64) - 30, 'the caption is clear of the cut corner at ' + where);
      }
      // the credit plate: at most 700 wide and at most the card less 88, from 2 in, so it ends well left of the card's cut corner
      const creditEnd = 2 + Math.min(700, card.width - 88);
      assert.ok(creditEnd <= card.width - 42 - 40, 'the credit is clear of the cut corner at ' + where);
    }
  });
});

test('the Photo panel draws the card and the caption at the Photo size, and the picture still fills the card', () => withFakePage(drawn => {
  const photo = { address: 'data/sample/photo-1.svg', caption: '[Caption]', credit: '[Name]', focus: { x: 30, y: 40 } };
  const draw = (settings, shown) => {
    const target = { innerHTML: '', querySelector: () => null };
    live.photoPanel.mount(target, { photos: [shown || photo], settings: settings });
    return target.innerHTML;
  };

  const full = draw({ photoOrder: 'random', photoScale: 100 });
  assert.ok(full.includes('<div class="card" data-slat="item" style="left: 28px; top: 142px; width: 1096px; height: 464px">'));
  assert.ok(full.includes('<div class="caption" data-slat="item" style="left: 52px; top: 622px; width: 1004px">[Caption]</div>'));
  // content with no settings, or no size in them, is the full size
  assert.equal(draw(undefined), full);
  assert.equal(draw({ photoOrder: 'random' }), full);

  const small = draw({ photoOrder: 'random', photoScale: 60 });
  assert.ok(small.includes('<div class="card" data-slat="item" style="left: 247px; top: 235px; width: 658px; height: 278px">'));
  assert.ok(small.includes('<div class="caption" data-slat="item" style="left: 271px; top: 529px; width: 785px">[Caption]</div>'));
  // the card's edge is drawn at the new size, and the picture, the hotspot and the credit are still in it
  assert.ok(small.includes('width="658" height="278" viewBox="0 0 658 278"'));
  assert.ok(small.includes('<img src="data/sample/photo-1.svg" style="object-position: 30% 40%" alt="">'));
  assert.ok(small.includes('<div class="credit">Photo: [Name]</div>'));
  assert.ok(small.includes('<div class="picture">') && small.includes('PHOTOS'));
  assert.ok(drawn.includes('card-1096x464') && drawn.includes('card-658x278'));

  // with no caption the card is taller, and there is no caption box
  const bare = draw({ photoScale: 60 }, { address: 'data/sample/photo-3.svg' });
  assert.ok(bare.includes('style="left: 247px; top: 245px; width: 658px; height: 308px"'));
  assert.equal(bare.includes('class="caption"'), false);
  assert.ok(drawn.includes('card-658x308'));
  assert.ok(draw({ photoScale: 100 }, { address: 'data/sample/photo-3.svg' }).includes('style="left: 28px; top: 142px; width: 1096px; height: 514px"'));

  // the Portrait size does not touch the Photo panel
  assert.equal(draw({ portraitScale: 60 }), full);

  // the stylesheet leaves the place and the size to photo.js, and keeps the text sizes and the cut of the picture
  const style = fs.readFileSync(path.join(dashboardFolder, 'panels/photo/photo.css'), 'utf8');
  assert.equal(/\.photo \.card\s*\{[^}]*(left|top|width|height):/.test(style), false, 'the card has a place or a size in photo.css');
  assert.equal(/\.photo \.caption\s*\{[^}]*(left|top|width):/.test(style), false, 'the caption has a place or a width in photo.css');
  assert.ok(/\.photo \.caption\s*\{[^}]*height: 64px;[^}]*font: 500 var\(--size-body\)\/64px/.test(style), 'the caption keeps its height and its text size');
  assert.ok(style.includes('max-width: min(700px, calc(100% - 88px));'), 'the credit does not shrink with a smaller card');
  assert.ok(style.includes('object-fit: cover;'));
}));

// The Subteam roster panel: its pages (core/roster.js) and what it draws

function team(name, lead, members, more) {
  return Object.assign({ name: name, lead: lead, members: members }, more);
}

test('rosterPages gives one page for a subteam that has a lead and members', () => {
  const pages = rosterPages([team('[Build]', '[Lead A]', ['[Alex]', '[Sam]'])]);

  assert.deepEqual(pages, [{ subteam: '[Build]', lead: '[Lead A]', members: ['[Alex]', '[Sam]'], pageNumber: 1, pageCount: 1 }]);
});

test('rosterPages with nothing to show gives no pages', () => {
  assert.deepEqual(rosterPages([]), []);
  assert.deepEqual(rosterPages(undefined), []);
  // a subteam with neither a lead nor a member has nothing to put on a page
  assert.deepEqual(rosterPages([team('[Empty]', '', []), team('[Spaces]', '   ', []), { name: '[Bare]' }]), []);
  assert.deepEqual(rosterPages([team('[Blank names]', '', ['', '  '])]), []);
});

test('a subteam with a lead and no members gets one page, and one with members and no lead too', () => {
  const pages = rosterPages([team('[Lead only]', '[Lead A]', []), team('[Members only]', '', ['[Alex]']), { name: '[No members field]', lead: '[Lead B]' }]);

  assert.deepEqual(pages, [
    { subteam: '[Lead only]', lead: '[Lead A]', members: [], pageNumber: 1, pageCount: 1 },
    { subteam: '[Members only]', lead: '', members: ['[Alex]'], pageNumber: 1, pageCount: 1 },
    { subteam: '[No members field]', lead: '[Lead B]', members: [], pageNumber: 1, pageCount: 1 },
  ]);
});

test('the lead and the name are shown without the spaces at their ends', () => {
  const page = rosterPages([team('  [Build] ', '  [Lead A]  ', ['[Alex]'])])[0];

  assert.equal(page.subteam, '[Build]');
  assert.equal(page.lead, '[Lead A]');
});

test('16 members fill one page, and more continue on the next with the lead shown again', () => {
  assert.equal(rowsPerColumn, 8);
  assert.equal(membersPerPage, 16);
  assert.equal(rosterPages([team('[Build]', '[Lead A]', namesCalled(16))]).length, 1);

  const pages = rosterPages([team('[Build]', '[Lead A]', namesCalled(18))]);
  assert.equal(pages.length, 2);
  assert.deepEqual(pages.map(page => page.members.length), [16, 2]);
  assert.deepEqual(pages[0].members, namesCalled(16));
  assert.deepEqual(pages[1].members, namesCalled(18).slice(16));
  assert.deepEqual(pages.map(page => [page.pageNumber, page.pageCount]), [[1, 2], [2, 2]]);
  assert.deepEqual(pages.map(page => [page.subteam, page.lead]), [['[Build]', '[Lead A]'], ['[Build]', '[Lead A]']]);

  // 24 is the most the Studio allows, and 17 and 24 both need two pages
  assert.deepEqual(rosterPages([team('[Build]', '[Lead A]', namesCalled(24))]).map(page => page.members.length), [16, 8]);
  assert.equal(rosterPages([team('[Build]', '[Lead A]', namesCalled(17))]).length, 2);
});

test('hidden and expired subteams are skipped, and the Studio order is kept', () => {
  const pages = rosterPages([
    team('[First]', '[Lead A]', ['[Alex]']),
    team('[Hidden]', '[Lead B]', ['[Sam]'], { show: false }),
    team('[Expired]', '[Lead C]', ['[Kim]'], { expires: '2020-01-01T00:00:00.000Z' }),
    team('[Later expiry]', '[Lead D]', ['[Lee]'], { expires: '2999-01-01T00:00:00.000Z' }),
    team('[Last]', '', namesCalled(17)),
  ]);

  assert.deepEqual(pages.map(page => page.subteam), ['[First]', '[Later expiry]', '[Last]', '[Last]']);
  assert.deepEqual(pages.map(page => page.pageNumber), [1, 1, 1, 2]);
});

test('the turn counter walks the pages one visit at a time and starts over after the last', () => {
  const subteams = [team('[A]', '[Lead A]', namesCalled(17)), team('[B]', '', ['[Alex]'])];
  const next = makeRosterTurns();
  const label = turn => turn.page.subteam + ' ' + turn.page.pageNumber + '/' + turn.page.pageCount;

  const first = next(subteams);
  assert.equal(label(first), '[A] 1/2');
  assert.equal(first.upcoming.pageNumber, 2);
  assert.equal(label(next(subteams)), '[A] 2/2');
  assert.equal(label(next(subteams)), '[B] 1/1');
  // after the last page it starts again, and the page after the last one is the first
  const again = next(subteams);
  assert.equal(label(again), '[A] 1/2');
  assert.equal(next(subteams).upcoming.subteam, '[B]');
});

test('the turn counter copes with one page, with none, and with a list that changes between visits', () => {
  const single = makeRosterTurns();
  assert.deepEqual(single([team('[A]', '[Lead A]', [])]).upcoming, null);
  assert.equal(single([team('[A]', '[Lead A]', [])]).page.subteam, '[A]');

  const nothing = makeRosterTurns();
  assert.deepEqual(nothing([]), { page: null, upcoming: null });
  assert.deepEqual(nothing([team('[Hidden]', '[Lead A]', [], { show: false })]), { page: null, upcoming: null });

  // the roster gets shorter after page 3 was shown: counting goes round the pages as they are now
  const shrinking = makeRosterTurns();
  const three = [team('[A]', '[Lead A]', []), team('[B]', '[Lead B]', []), team('[C]', '[Lead C]', [])];
  shrinking(three);
  shrinking(three);
  assert.equal(shrinking(three).page.subteam, '[C]');
  // the fourth visit would be page 4, which goes round the 2 pages left to page 2, and then the first again
  const two = three.slice(0, 2);
  assert.equal(shrinking(two).page.subteam, '[B]');
  assert.equal(shrinking(two).page.subteam, '[A]');
});

// The panel only draws a page, and the frame turns it over, so what is checked
// here is the markup: the title, the tag, the portrait slot and the two columns
function rosterMarkup(content) {
  const host = { innerHTML: '', querySelectorAll: () => [] };
  live.rosterPanel.mount(host, content);
  return host.innerHTML;
}

function countOf(text, piece) {
  return text.split(piece).length - 1;
}

test('the Subteam roster panel draws the heading, the subteam in the tag, the team lead and the members in two columns', () => withFakePage(() => {
  const content = { people: [], subteams: [team('[Build]', '[Lead A]', namesCalled(16))] };
  const html = rosterMarkup(content);

  assert.ok(live.rosterPanel.hasContent(content));
  assert.ok(html.includes('<h2 class="title" data-slat="title">ROSTER</h2>'));
  assert.ok(html.includes('<span class="tag-text">[Build]</span>'));
  assert.ok(html.includes('<div class="slot-name">[Lead A]</div>'));
  assert.ok(html.includes('<div class="slot-role">TEAM LEAD</div>'));
  assert.equal(countOf(html, 'class="column"'), 2);
  assert.equal(countOf(html, 'class="member" data-slat="item"'), 16);

  const columns = html.split('class="column"').slice(1).map(part => countOf(part.split('</div>\n')[0], 'class="member"'));
  assert.deepEqual(columns, [8, 8]);
}));

test('the Subteam roster panel shares a short list between the columns, and a longer subteam continues with its tag', () => withFakePage(() => {
  const nine = rosterMarkup({ people: [], subteams: [team('[Build]', '[Lead A]', namesCalled(9))] });
  const sizes = nine.split('class="column"').slice(1).map(part => countOf(part.split('</div></div>')[0], 'class="member"'));
  assert.deepEqual(sizes, [5, 4]);

  const one = rosterMarkup({ people: [], subteams: [team('[Build]', '[Lead A]', ['[Alex]'])] });
  assert.equal(countOf(one, 'class="column"'), 1);

  // the module keeps its own turn counter, so this walks the pages of two visits
  const content = { people: [], subteams: [team('[Long]', '[Lead A]', namesCalled(18))] };
  const firstVisit = rosterMarkup(content);
  const secondVisit = rosterMarkup(content);
  assert.ok(firstVisit.includes('<span class="tag-text">[Long]</span>'));
  assert.ok(secondVisit.includes('<span class="tag-text">[Long]</span>'));
  assert.deepEqual([firstVisit, secondVisit].map(html => countOf(html, 'class="member"')).sort((a, b) => a - b), [2, 16]);
  assert.equal(countOf(firstVisit, 'class="member"') + countOf(secondVisit, 'class="member"'), 18);
  assert.ok(firstVisit.includes('TEAM LEAD') && secondVisit.includes('TEAM LEAD'));
}));

test('the Subteam roster panel has no portrait without a lead, and nothing on the right without members', () => withFakePage(() => {
  const noLead = rosterMarkup({ people: [], subteams: [team('[Build]', '', ['[Alex]'])] });
  assert.equal(noLead.includes('class="slot'), false);
  assert.equal(noLead.includes('TEAM LEAD'), false);
  assert.equal(countOf(noLead, 'class="member"'), 1);

  const leadOnly = rosterMarkup({ people: [], subteams: [team('[Build]', '[Lead A]', [])] });
  assert.ok(leadOnly.includes('TEAM LEAD'));
  assert.equal(leadOnly.includes('class="column"'), false);
  assert.equal(leadOnly.includes('class="member"'), false);

  assert.equal(live.rosterPanel.hasContent({ subteams: [team('[Build]', '', [])] }), false);
  assert.equal(live.rosterPanel.hasContent({ subteams: [] }), false);
}));

test('the Subteam roster panel escapes what editors typed, and shows the lead\'s photo from Leadership', () => withFakePage(() => {
  const html = rosterMarkup({ people: [], subteams: [team('<b>Hi</b>', '<i>Lead</i>', ['<u>Alex</u>'])] });
  assert.equal(/<(b|i|u)>/.test(html), false);
  assert.ok(html.includes('&lt;b&gt;Hi&lt;/b&gt;') && html.includes('&lt;i&gt;Lead&lt;/i&gt;') && html.includes('&lt;u&gt;Alex&lt;/u&gt;'));
  assert.ok(html.includes('<use href="#person-silhouette"'));

  const photo = tidyPhoto(photoRecord());
  const withPhoto = rosterMarkup({ people: [{ role: 'Captain', name: ' [lead a] ', photo: photo, showPhoto: true }], subteams: [team('[Build]', '[Lead A]', [])] });
  assert.ok(withPhoto.includes('<img src="' + escapeHtml(photoUrl(photo, 280, 280)) + '"'));
  assert.equal(withPhoto.includes('person-silhouette'), false);
}));

test('the Subteam roster panel is in the registry with the topic of the other subteam panels, and uses the shared pieces', () => {
  const registry = fs.readFileSync(path.join(dashboardFolder, 'registry.js'), 'utf8');
  assert.ok(registry.includes("{ id: 'roster', region: 'grid1', topic: 'subteams' },"));

  const code = fs.readFileSync(path.join(dashboardFolder, 'panels/roster/roster.js'), 'utf8');
  const style = fs.readFileSync(path.join(dashboardFolder, 'panels/roster/roster.css'), 'utf8');
  ['slotMarkup(', 'watchPhotos(', 'preloadPhotos(', 'personNamed(', 'makeRosterTurns(', 'doubleSlash()', 'escapeHtml('].forEach(piece => assert.ok(code.includes(piece), 'roster.js does not use ' + piece));
  assert.equal(/setTimeout|setInterval|requestAnimationFrame|animate\(/.test(code), false, 'the roster panel has animation code');
  assert.equal(/@keyframes|transition:|animation:|box-shadow|text-shadow|filter|blur/.test(style), false, 'roster.css uses an effect that is not allowed');
  assert.ok(/\.roster \.member\s*\{[^}]*font: 500 var\(--size-body\)\//.test(style), 'the names are not at the body size');
  assert.equal(/font-size|font: [^;]*\b\d+px\//.test(style.replace(/var\(--size-[a-z-]+\)\/\d+px/g, '')), false, 'roster.css has a text size of its own');
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

// Events: the list the screen shows, from the BAND calendars (core/events.js).
// Times are given as real moments (...Z) and zones by name, so none of this
// depends on the time zone of the computer that runs the tests.

const newYork = 'America/New_York';

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

test('the query does not ask for the Events Calendar entries, and normalizeContent leaves them out of the content', () => {
  assert.equal(contentQuery.includes('extraEvent'), false);

  const entry = document('extraEvent', 'e1', { title: '[One]', startDate: '2027-04-02' });
  assert.equal('extraEvents' in normalizeContent({ extraEvents: [entry] }, today), false);
  assert.equal('extraEvents' in normalizeContent({}, today), false);
  assert.equal('extraEvents' in withDefaults(null), false);
});

test('the sample content has no Events Calendar entries, since its events are in the sample calendar', () => {
  const file = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  assert.equal('extraEvents' in file, false);
  assert.equal('extraEvents' in normalizeSample(file), false);
});

test('mergeEvents puts the events in one list sorted by start', () => {
  const band = [bandTimed('[Late]', '2027-03-04T23:00:00Z', '2027-03-05T01:00:00Z'), bandDay('[Day]', 2027, 3, 10), bandDay('[Later day]', 2027, 3, 12), bandDay('[First day]', 2027, 3, 4)];
  const now = new Date('2027-03-01T15:00:00Z');

  assert.deepEqual(titlesOf(mergeEvents(band, newYork, now)), ['[First day]', '[Late]', '[Day]', '[Later day]']);
});

test('mergeEvents shows the events as they are, and nothing when there are none or the list is missing', () => {
  const now = new Date('2027-03-01T15:00:00Z');

  assert.deepEqual(titlesOf(mergeEvents([bandDay('[Day]', 2027, 3, 10)], newYork, now)), ['[Day]']);
  assert.deepEqual(mergeEvents([], newYork, now), []);
  assert.deepEqual(mergeEvents(undefined, newYork, now), []);
  assert.deepEqual(mergeEvents(null, undefined, now), []);
});

test('mergeEvents does not change the list it is given', () => {
  const band = [bandDay('[Day]', 2027, 3, 10)];
  const before = JSON.stringify(band);

  const merged = mergeEvents(band, newYork, new Date('2027-03-01T15:00:00Z'));
  assert.equal(JSON.stringify(band), before);
  assert.equal(band[0].firstDay, undefined);
  assert.notEqual(merged[0], band[0]);
});

test('an event is dropped once its end date has passed, by the date in the Look time zone', () => {
  const band = [bandTimed('[Over]', '2027-01-08T19:00:00Z', '2027-01-08T20:00:00Z'), bandTimed('[Today]', '2027-01-09T19:00:00Z', '2027-01-09T20:00:00Z')];

  // 22:00 on 9 January in New York is already 10 January in UTC
  const lateEvening = new Date('2027-01-10T03:00:00Z');
  assert.deepEqual(titlesOf(mergeEvents(band, newYork, lateEvening)), ['[Today]']);
  assert.deepEqual(titlesOf(mergeEvents(band, 'UTC', lateEvening)), [], 'the same moment is the next day in UTC');

  // an event that is over at 00:30 on the 10th in New York
  const justAfterMidnight = new Date('2027-01-10T05:30:00Z');
  assert.deepEqual(titlesOf(mergeEvents(band, newYork, justAfterMidnight)), []);
});

test('an event with an end date stays until the end date has passed, and one with no end date goes after its start date', () => {
  const band = [bandDay('[Weekend]', 2027, 4, 2, 4), bandDay('[One day]', 2027, 4, 2)];
  const shown = day => titlesOf(mergeEvents(band, newYork, new Date('2027-04-0' + day + 'T16:00:00Z')));

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
    bandTimed('[This evening]', '2027-03-05T23:00:00Z', '2027-03-06T01:00:00Z'),
  ];

  const merged = mergeEvents(band, newYork, now);
  assert.deepEqual(titlesOf(merged).sort(), ['[This evening]', '[Three days, still on]', '[Today]']);
});

test('an event with no usable start is left out', () => {
  const band = [{ title: '[No start]', start: 'not a date', end: null, allDay: false }, null, 'oops', bandDay('[Fine]', 2027, 3, 10)];
  assert.deepEqual(titlesOf(mergeEvents(band, newYork, new Date('2027-03-01T15:00:00Z'))), ['[Fine]']);
});

test('mergeEvents adds the dates each event covers, in the Look time zone for timed events', () => {
  const band = [
    bandDay('[Three days]', 2027, 3, 10, 12),
    bandTimed('[Evening]', '2027-03-11T01:30:00Z', '2027-03-11T03:00:00Z'), // 8:30 PM on the 10th in New York
    bandTimed('[Ends at midnight]', '2027-03-11T03:00:00Z', '2027-03-11T05:00:00Z'), // 10 PM to midnight on the 10th
  ];
  const merged = mergeEvents(band, newYork, new Date('2027-03-01T15:00:00Z'));
  const days = title => merged.filter(event => event.title === title).map(event => [event.firstDay, event.lastDay])[0];

  assert.deepEqual(days('[Three days]'), ['2027-03-10', '2027-03-12']);
  assert.deepEqual(days('[Evening]'), ['2027-03-10', '2027-03-10']);
  assert.deepEqual(days('[Ends at midnight]'), ['2027-03-10', '2027-03-10']);
});

test('rangeLabel writes one day, a range in one month, and a range over two months', () => {
  assert.equal(rangeLabel('2027-04-02', '2027-04-02'), 'Apr 2');
  assert.equal(rangeLabel('2027-04-02', '2027-04-04'), 'Apr 2-4');
  assert.equal(rangeLabel('2026-12-30', '2027-01-02'), 'Dec 30-Jan 2');
  assert.equal(rangeLabel('2027-03-31', '2027-04-01'), 'Mar 31-Apr 1');
  assert.equal(rangeLabel('2027-04-09', '2027-04-10'), 'Apr 9-10');
  assert.equal(rangeLabel('2027-04-02', '2027-04-01'), 'Apr 2', 'a last day before the first is one day');
  assert.equal(rangeLabel('2027-03-30', '2027-04-01'), 'Mar 30-Apr 1');
  assert.equal(rangeLabel('2026-12-31', '2027-01-01'), 'Dec 31-Jan 1', 'a range over New Year');
  assert.equal(rangeLabel('2028-02-28', '2028-02-29'), 'Feb 28-29', 'the leap day');
});

test('eventDate writes the weekday, the month and day, and the range, in capitals', () => {
  const dates = (firstDay, lastDay) => eventDate({ firstDay: firstDay, lastDay: lastDay });

  // one day, with the month: the examples from the owner
  assert.deepEqual(dates('2026-10-17', '2026-10-17'), { weekday: 'SAT', monthDay: 'OCT 17', range: '', text: 'SAT OCT 17' });
  assert.deepEqual(dates('2026-12-05', '2026-12-05'), { weekday: 'SAT', monthDay: 'DEC 5', range: '', text: 'SAT DEC 5' });

  // several days in one month
  assert.deepEqual(dates('2027-04-02', '2027-04-04'), { weekday: 'FRI', monthDay: 'APR 2', range: 'APR 2-4', text: 'APR 2-4' });

  // over a month end, and over New Year
  assert.deepEqual(dates('2027-03-30', '2027-04-01'), { weekday: 'TUE', monthDay: 'MAR 30', range: 'MAR 30-APR 1', text: 'MAR 30-APR 1' });
  assert.deepEqual(dates('2026-12-30', '2027-01-02'), { weekday: 'WED', monthDay: 'DEC 30', range: 'DEC 30-JAN 2', text: 'DEC 30-JAN 2' });
  assert.equal(dates('2026-12-31', '2027-01-01').range, 'DEC 31-JAN 1');

  // the edges of a month and a year, and a leap day
  assert.equal(dates('2026-12-31', '2026-12-31').text, 'THU DEC 31');
  assert.equal(dates('2027-01-01', '2027-01-01').text, 'FRI JAN 1');
  assert.equal(dates('2027-03-31', '2027-03-31').text, 'WED MAR 31');
  assert.equal(dates('2027-04-01', '2027-04-01').text, 'THU APR 1');
  assert.equal(dates('2028-02-29', '2028-02-29').text, 'TUE FEB 29');

  // a last day before the first is one day
  assert.equal(dates('2027-04-02', '2027-04-01').range, '');
});

test('eventDate has nothing to say for an event with no date that can be read', () => {
  const none = { weekday: '', monthDay: '', range: '', text: '' };
  assert.deepEqual(eventDate({}), none);
  assert.deepEqual(eventDate(undefined), none);
  assert.deepEqual(eventDate({ firstDay: 'soon', lastDay: 'later' }), none);
  assert.deepEqual(eventDate({ firstDay: '2027-02-30', lastDay: '2027-02-30', start: 'not a date' }), none);
});

test('eventDate reads the dates in the Look time zone, whatever the time zone of the computer', () => {
  // 02:00 UTC on the 18th is 10 PM on the 17th in New York and 11 AM on the 18th in Tokyo
  const late = { title: '[Late]', start: new Date('2026-10-18T02:00:00Z'), end: new Date('2026-10-18T03:00:00Z'), allDay: false, location: '' };
  assert.equal(eventDate(late, newYork).text, 'SAT OCT 17');
  assert.equal(eventDate(late, 'Asia/Tokyo').text, 'SUN OCT 18');
  assert.equal(eventDate(late, 'UTC').text, 'SUN OCT 18');
  assert.equal(eventDate(late).text, 'SAT OCT 17', 'no zone given: the Look page starts as New York');
  assert.equal(eventDate(late, 'Nowhere/Land').text, 'SAT OCT 17', 'a zone that does not exist counts as none');

  // an event that ends at midnight is not on the day after
  const toMidnight = { start: new Date('2026-12-30T22:00:00Z'), end: new Date('2026-12-31T05:00:00Z'), allDay: false }; // 5 PM to midnight in New York
  assert.deepEqual([eventDate(toMidnight, newYork).range, eventDate(toMidnight, newYork).text], ['', 'WED DEC 30']);

  // the same events, with the computer in zones a long way either side of New York
  const before = process.env.TZ;
  try {
    ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Asia/Kolkata', 'UTC'].forEach(zone => {
      process.env.TZ = zone;
      const band = [
        bandDay('[All day]', 2026, 12, 30, 31),
        bandTimed('[Late]', '2026-10-18T02:00:00Z', '2026-10-18T03:00:00Z'),
        bandTimed('[New Year]', '2027-01-01T04:30:00Z', '2027-01-01T04:50:00Z'), // 11:30 PM to 11:50 PM on 31 December in New York
        bandTimed('[Spring]', '2027-04-03T03:30:00Z', '2027-04-03T04:00:00Z'), // 11:30 PM on 2 April in New York
      ];
      const merged = mergeEvents(band, newYork, new Date('2026-10-01T12:00:00Z'));
      const texts = merged.map(event => event.title + ': ' + eventDate(event, newYork).text);

      assert.deepEqual(texts, ['[Late]: SAT OCT 17', '[All day]: DEC 30-31', '[New Year]: THU DEC 31', '[Spring]: FRI APR 2'], 'computer zone ' + zone);

      // with no firstDay or lastDay on them, the same text comes out
      const bare = merged.map(event => eventDate({ start: event.start, end: event.end, allDay: event.allDay }, newYork).text);
      assert.deepEqual(bare, merged.map(event => eventDate(event, newYork).text), 'computer zone ' + zone);
    });
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});

test('timeText is empty for an all-day event, so only its date shows', () => {
  assert.equal(timeText({ allDay: true, start: new Date(2027, 3, 2) }), '');
  assert.equal(timeText({ allDay: false, start: new Date(2027, 0, 9, 18, 30) }), '6:30 PM');
  assert.equal(timeText({ allDay: false, start: new Date(2027, 0, 9, 0, 5).toISOString() }), '12:05 AM');
});

// The two panels write times on the computer's own clock, so these tests use the
// computer's own time zone for the events.
// (On the Mini the two are the same: rebuilding-the-mini.md sets the zone.)
const computerZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;

// FRI for 2027-04-02, from the calendar alone and in UTC
function weekdayOn(year, month, day) {
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

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
  const year = soon.getFullYear();
  const merged = mergeEvents([
    bandDay('Winterfest', year, 4, 2),
    Object.assign(bandDay('Host: Wake County Event', year, 4, 2, 4), { location: 'Holly Springs HS' }),
    Object.assign(bandTimed('Evening', new Date(year, 3, 2, 18, 30).toISOString(), new Date(year, 3, 2, 18, 30).toISOString()), { location: 'Cafeteria' }),
  ], computerZone, now);

  const markup = drawn(eventsPanel, { events: merged });
  assert.ok(markup.includes('Winterfest'));
  assert.ok(markup.includes('<div class="day-name">' + weekdayOn(soon.getFullYear(), 4, 2) + '</div>'), 'the weekday is kept');
  assert.ok(markup.includes('<div class="month-day">APR 2</div>'), 'the month comes with the day');
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
  const tile = event => drawn(nextEventPanel, { events: mergeEvents([event], computerZone, now) });

  const oneDay = tile(bandDay('Game Drop', year, 1, 9));
  assert.ok(oneDay.includes('Game Drop'));
  assert.ok(oneDay.includes('class="when">' + weekdayOn(year, 1, 9) + ' JAN 9</div>'), oneDay);

  const range = tile(Object.assign(bandDay('Weekend', year, 4, 2, 4), { location: 'Holly Springs HS' }));
  assert.ok(/class="when">APR 2-4<\/div>/.test(range), range);
  assert.ok(range.includes('Holly Springs HS'));

  const evening = new Date(year, 0, 9, 18, 30).toISOString();
  const timed = tile(bandTimed('Evening', evening, evening));
  assert.ok(/class="when">[A-Z]{3} JAN 9 · \d{1,2}:\d\d [AP]M<\/div>/.test(timed), timed);
  assert.ok(timed.includes('class="when">' + weekdayOn(year, 1, 9) + ' JAN 9 · '), timed);
});

test('the two panels write the date in the Look time zone, whatever the time zone of the computer', () => {
  const year = new Date().getFullYear() + 1;
  const late = [bandTimed('[Late]', year + '-10-18T02:00:00Z', year + '-10-18T02:30:00Z')]; // 10 PM on the 17th in New York, 11 AM on the 18th in Tokyo

  const before = process.env.TZ;
  try {
    ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Asia/Kolkata'].forEach(zone => {
      process.env.TZ = zone;

      const inNewYork = { theme: { timeZone: newYork }, events: mergeEvents(late, newYork, new Date()) };
      const events = drawn(eventsPanel, inNewYork);
      assert.ok(events.includes('<div class="day-name">' + weekdayOn(year, 10, 17) + '</div>'), 'events, computer zone ' + zone);
      assert.ok(events.includes('<div class="month-day">OCT 17</div>'), 'events, computer zone ' + zone);
      assert.ok(drawn(nextEventPanel, inNewYork).includes('class="when">' + weekdayOn(year, 10, 17) + ' OCT 17 · '), 'tile, computer zone ' + zone);

      const inTokyo = { theme: { timeZone: 'Asia/Tokyo' }, events: mergeEvents(late, 'Asia/Tokyo', new Date()) };
      assert.ok(drawn(eventsPanel, inTokyo).includes('<div class="month-day">OCT 18</div>'), 'events in Tokyo, computer zone ' + zone);
      assert.ok(drawn(nextEventPanel, inTokyo).includes('class="when">' + weekdayOn(year, 10, 18) + ' OCT 18 · '), 'tile in Tokyo, computer zone ' + zone);
    });
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});

test('the two panels still write a date when the events did not come through mergeEvents', () => {
  // shell.js shows the BAND events as they are when merging fails: no firstDay, no lastDay
  const year = new Date().getFullYear() + 1;
  const bare = { theme: { timeZone: newYork }, events: [bandTimed('[Late]', year + '-10-18T02:00:00Z', year + '-10-18T02:30:00Z')] };
  assert.ok(drawn(eventsPanel, bare).includes('<div class="month-day">OCT 17</div>'));
  assert.ok(drawn(nextEventPanel, { events: bare.events }).includes('class="when">' + weekdayOn(year, 10, 17) + ' OCT 17 · '), 'with no theme in the content the default zone is used');
});

test('the Events panel and the Next event tile have nothing to show once the only event is over', () => {
  const content = { events: mergeEvents([bandDay('[Over]', 2020, 5, 5)], newYork, new Date()) };
  assert.deepEqual(content.events, []);
  assert.equal(eventsPanel.hasContent(content), false);
  assert.equal(nextEventPanel.hasContent(content), false);
});

// Daily Agenda: the plan, then the talks booked for today. The clock reads 2:50 PM on
// Thursday 8 October 2026 in New York.
const upNextNow = new Date('2026-10-08T18:50:00Z');

function upNextTalk(start, name, topic, extra) {
  return Object.assign({ id: 'presentation-' + name, name: name, topic: topic, start: new Date(start), minutes: 15, status: 'scheduled' }, extra);
}

function upNextPlan(count) {
  const rows = Array.from({ length: count }, (item, place) => ({ time: '[' + (place + 6) + ' PM]', text: '[Item ' + (place + 1) + ']' }));
  return { heading: '[Plan]', rows: rows };
}

function upNextContent(talks, plan, extra) {
  return Object.assign({ theme: { timeZone: newYork }, settings: {}, plan: plan || null, presentations: talks }, extra);
}

// Talks from 3:00 PM, 15 minutes apart, so none has started at 2:50 PM
function laterTalks(count) {
  return Array.from({ length: count }, (item, place) => upNextTalk(Date.UTC(2026, 9, 8, 19, place * 15), 'Kim' + place, '[Talk ' + place + ']'));
}

function lineOf(row) {
  return [row.kind, row.time, row.text, row.tag].filter(Boolean).join(' | ');
}

function upNextLines(content, now) {
  return tonightPanel.rowsFor(content, now || upNextNow).map(lineOf);
}

test('The Daily Agenda lists the plan first, then today\'s talks soonest first, with the one in progress marked and finished talks left off', () => {
  const content = upNextContent([
    upNextTalk('2026-10-08T19:15:00Z', 'Sam', '[Topic B]'),
    upNextTalk('2026-10-08T18:45:00Z', 'Alex', '[Topic A]'),
    upNextTalk('2026-10-08T18:15:00Z', 'Kim', '[Topic C]'),
    upNextTalk('2026-10-09T19:00:00Z', 'Pat', '[Topic E]'),
    upNextTalk('2026-10-09T02:30:00Z', 'Lee', '[Topic D]'),
  ], upNextPlan(1));

  assert.deepEqual(upNextLines(content), [
    'plan | [6 PM] | [Item 1]',
    'talk | 2:45 PM | Alex: [Topic A] | NOW',
    'talk | 3:15 PM | Sam: [Topic B] | TALK',
    'talk | 10:30 PM | Lee: [Topic D] | TALK',
  ]);

  const rows = tonightPanel.rowsFor(content, upNextNow);
  assert.deepEqual(rows.map(row => row.live), [undefined, true, false, false]);
});

test('The Daily Agenda reads the day and the time on the clock in the Look time zone, not the computer\'s', () => {
  const talks = [upNextTalk('2026-10-08T18:45:00Z', 'Alex', '[Topic A]'), upNextTalk('2026-10-09T02:30:00Z', 'Lee', '[Topic D]')];

  assert.deepEqual(upNextLines(upNextContent(talks)), ['talk | 2:45 PM | Alex: [Topic A] | NOW', 'talk | 10:30 PM | Lee: [Topic D] | TALK']);

  // in Tokyo it is 3:50 AM on the 9th, and Lee's talk is at 11:30 AM that day
  const tokyo = upNextContent(talks, null, { theme: { timeZone: 'Asia/Tokyo' } });
  assert.deepEqual(upNextLines(tokyo), ['talk | 3:45 AM | Alex: [Topic A] | NOW', 'talk | 11:30 AM | Lee: [Topic D] | TALK']);

  // with no zone in the content the default one is used
  assert.deepEqual(upNextLines(upNextContent(talks, null, { theme: undefined })), upNextLines(upNextContent(talks)));
});

test('The Daily Agenda writes midnight and noon as 12:00 AM and 12:00 PM, and keeps the minutes to two digits', () => {
  const early = new Date('2026-10-08T04:00:00Z'); // midnight at the start of the 8th in New York
  const talks = [
    upNextTalk('2026-10-08T04:05:00Z', 'A', '[One]'),
    upNextTalk('2026-10-08T16:00:00Z', 'B', '[Two]'),
    upNextTalk('2026-10-08T16:30:00Z', 'C', '[Three]'),
    upNextTalk('2026-10-08T17:00:00Z', 'D', '[Four]'),
  ];
  assert.deepEqual(upNextLines(upNextContent(talks), early).map(line => line.split(' | ')[1]), ['12:05 AM', '12:00 PM', '12:30 PM', '1:00 PM']);
});

test('The Daily Agenda leaves out a talk that is not scheduled, a draft, one with no start, and every talk while Run presentations is off', () => {
  const kept = upNextTalk('2026-10-08T19:00:00Z', 'Alex', '[Kept]');
  const talks = [
    kept,
    upNextTalk('2026-10-08T19:00:00Z', 'B', '[Cancelled]', { status: 'cancelled' }),
    upNextTalk('2026-10-08T19:00:00Z', 'C', '[Done]', { status: 'done' }),
    upNextTalk('2026-10-08T19:00:00Z', 'D', '[Skipped]', { status: 'skipped' }),
    upNextTalk('2026-10-08T19:00:00Z', 'E', '[Draft]', { id: 'drafts.presentation-E' }),
    upNextTalk('2026-10-08T19:00:00Z', 'F', '[No start]', { start: new Date('soon') }),
    null,
    'oops',
  ];
  assert.deepEqual(upNextLines(upNextContent(talks)), ['talk | 3:00 PM | Alex: [Kept] | TALK']);
  assert.deepEqual(upNextLines(upNextContent([kept], null, { settings: { presentationsEnabled: false } })), []);
  assert.deepEqual(upNextLines(upNextContent([kept], null, { settings: undefined })), ['talk | 3:00 PM | Alex: [Kept] | TALK']);
  assert.deepEqual(upNextLines(upNextContent(undefined)), []);
  assert.deepEqual(upNextLines(upNextContent('oops')), []);
});

test('The Daily Agenda cuts a talk to 18 characters, the width of a plan row, and ends it with an ellipsis', () => {
  const text = (name, topic) => tonightPanel.rowsFor(upNextContent([upNextTalk('2026-10-08T19:00:00Z', name, topic)]), upNextNow)[0].text;

  assert.equal(text('Alex', '[Short]'), 'Alex: [Short]');
  assert.equal(text('Alex', '123456789012'), 'Alex: 123456789012', '18 characters fit');
  assert.equal(text('Alex', '1234567890123'), 'Alex: 12345678901…', '19 do not');
  assert.equal(text('Alex', '1234567890123').length, 18, 'the ellipsis is counted in');
  assert.equal(text('Alex', 'Swerve bas ahead'), 'Alex: Swerve bas…', 'a space before the cut is dropped');

  // a pair of code units is never split
  const clef = '\u{1D11E}';
  assert.equal(text('Al', clef.repeat(20)), 'Al: ' + clef.repeat(13) + '…');

  // a missing name or title leaves no colon
  assert.equal(text('Alex', ''), 'Alex');
  assert.equal(text('', '[Title]'), '[Title]');
  assert.equal(text('  Alex ', ' [Title] '), 'Alex: [Title]');
});

test('The Daily Agenda never has more than five lines: the talks fill what the plan leaves, and the last free line says +N more', () => {
  const count = (content, kind) => tonightPanel.rowsFor(content, upNextNow).filter(row => row.kind === kind).length;

  // no plan: four talks and the line that counts the other three
  const seven = upNextContent(laterTalks(7));
  assert.deepEqual(upNextLines(seven), [
    'talk | 3:00 PM | Kim0: [Talk 0] | TALK',
    'talk | 3:15 PM | Kim1: [Talk 1] | TALK',
    'talk | 3:30 PM | Kim2: [Talk 2] | TALK',
    'talk | 3:45 PM | Kim3: [Talk 3] | TALK',
    'more | +3 more',
  ]);

  // two plan rows keep their lines, so two talks fit and three are left
  assert.deepEqual(upNextLines(upNextContent(laterTalks(5), upNextPlan(2))), [
    'plan | [6 PM] | [Item 1]',
    'plan | [7 PM] | [Item 2]',
    'talk | 3:00 PM | Kim0: [Talk 0] | TALK',
    'talk | 3:15 PM | Kim1: [Talk 1] | TALK',
    'more | +3 more',
  ]);

  // the talks fit exactly: no line that counts
  assert.equal(count(upNextContent(laterTalks(2), upNextPlan(3)), 'more'), 0);
  assert.equal(upNextLines(upNextContent(laterTalks(2), upNextPlan(3))).length, 5);
  assert.equal(count(upNextContent(laterTalks(1), upNextPlan(4)), 'more'), 0);

  // one free line and two talks: the line counts them both
  assert.deepEqual(upNextLines(upNextContent(laterTalks(2), upNextPlan(4))).slice(4), ['more | +2 more']);

  // a plan of five rows leaves nothing for the talks, and none of its rows is lost
  const full = upNextContent(laterTalks(3), upNextPlan(5));
  assert.deepEqual(upNextLines(full), upNextLines(upNextContent([], upNextPlan(5))));
  assert.equal(count(full, 'plan'), 5);
  assert.equal(count(full, 'talk') + count(full, 'more'), 0);

  // however many talks and plan rows, the lines stay at five, with every plan row in
  for (let planRows = 0; planRows <= 5; planRows++) {
    for (let talks = 0; talks <= 8; talks++) {
      const content = upNextContent(laterTalks(talks), upNextPlan(planRows));
      assert.ok(tonightPanel.rowsFor(content, upNextNow).length <= 5, planRows + ' plan rows, ' + talks + ' talks');
      assert.equal(count(content, 'plan'), planRows);
    }
  }
});

test('The Daily Agenda keeps the talk in progress when the talks overflow, since it is the first of them', () => {
  const talks = laterTalks(6).concat(upNextTalk('2026-10-08T18:45:00Z', 'Alex', '[Topic A]'));
  const lines = upNextLines(upNextContent(talks, upNextPlan(1)));

  assert.equal(lines[1], 'talk | 2:45 PM | Alex: [Topic A] | NOW');
  assert.equal(lines.length, 5);
  assert.equal(lines[4], 'more | +4 more');
});

test('a talk is in progress from its start until its slot ends, and gone after, whatever the overrun setting says', () => {
  const talks = [upNextTalk('2026-10-08T18:45:00Z', 'Alex', '[Topic A]')]; // 2:45 to 3:00 PM
  const settings = { presentationsEnabled: true, graceMinutes: 10 };
  const at = (hours, minutes, seconds) => upNextLines(upNextContent(talks, null, { settings: settings }), new Date(Date.UTC(2026, 9, 8, hours, minutes, seconds)));

  assert.deepEqual(at(18, 44, 59), ['talk | 2:45 PM | Alex: [Topic A] | TALK']);
  assert.deepEqual(at(18, 45, 0), ['talk | 2:45 PM | Alex: [Topic A] | NOW']);
  assert.deepEqual(at(18, 59, 59), ['talk | 2:45 PM | Alex: [Topic A] | NOW']);
  assert.deepEqual(at(19, 0, 0), []);

  // no minutes: the length a talk starts with
  assert.deepEqual(upNextLines(upNextContent([upNextTalk('2026-10-08T18:45:00Z', 'Alex', '[Topic A]', { minutes: undefined })])), ['talk | 2:45 PM | Alex: [Topic A] | NOW']);
});

test('The Daily Agenda has nothing to show with no plan and no talks, and shows the talks alone when there is no plan', () => {
  const now = new Date();
  const live = upNextTalk(now, 'Alex', '[Topic A]', { minutes: 30 });
  const over = upNextTalk(new Date(now.getTime() - 60 * 60 * 1000), 'Kim', '[Over]', { minutes: 15 });

  assert.equal(tonightPanel.hasContent(upNextContent([])), false);
  assert.equal(tonightPanel.hasContent(upNextContent([over])), false);
  assert.equal(tonightPanel.hasContent(upNextContent([live], null, { settings: { presentationsEnabled: false } })), false);
  assert.deepEqual(tonightPanel.rowsFor(upNextContent([]), now), []);

  assert.equal(tonightPanel.hasContent(upNextContent([live])), true);
  assert.equal(tonightPanel.hasContent(upNextContent([], upNextPlan(0))), true, 'a plan with no rows still shows, as it did');
  assert.equal(tonightPanel.hasContent(upNextContent([], Object.assign(upNextPlan(1), { show: false }))), false);
  assert.equal(tonightPanel.hasContent(upNextContent([live], Object.assign(upNextPlan(1), { show: false }))), true);
});

test('the Daily Agenda panel draws a plan row as it always did, the heading AGENDA, a talk with its tag, and the line that counts what did not fit', () => {
  const now = new Date();
  const talks = Array.from({ length: 6 }, (item, place) => upNextTalk(now, 'Kim' + place, '[Talk ' + place + ']', { minutes: 30 }));
  const rowsIn = markup => countOf(markup, 'data-slat="item"') - 1; // the first is the card with the heading

  const withPlan = drawn(tonightPanel, upNextContent(talks, upNextPlan(2)));
  assert.equal(rowsIn(withPlan), 5);
  assert.ok(withPlan.includes('<div class="heading">[Plan]</div>'));
  assert.ok(withPlan.includes('<h2 class="title" data-slat="title">AGENDA</h2>'));
  assert.equal(withPlan.includes('UP NEXT'), false);
  assert.ok(withPlan.includes('<div class="row" data-slat="item">'));
  assert.ok(withPlan.includes('<div class="text">[Item 1]</div>'));
  assert.equal(countOf(withPlan, 'class="row talk-row"'), 2);
  assert.equal(countOf(withPlan, 'class="talk-tag talk-now">NOW</div>'), 2);
  assert.ok(withPlan.includes('<div class="text">Kim0: [Talk 0]</div>'));
  assert.ok(withPlan.includes('<div class="row more-row" data-slat="item">'));
  assert.ok(withPlan.includes('<div class="text">+4 more</div>'));
  assert.equal(withPlan.includes('Talks today'), false);

  // the last line has no bar under it, as before
  assert.equal(countOf(withPlan, '<svg class="row-bar"'), 4);

  const alone = drawn(tonightPanel, upNextContent(talks.slice(0, 2)));
  assert.equal(rowsIn(alone), 2);
  assert.ok(alone.includes('<div class="heading">Talks today</div>'));
  assert.equal(alone.includes('+'), false);

  // what the speaker typed is not read as markup
  const odd = drawn(tonightPanel, upNextContent([upNextTalk(now, 'Al', '<b>Hi</b>', { minutes: 30 })]));
  assert.ok(odd.includes('Al: &lt;b&gt;Hi&lt;/b&gt;'));
  assert.equal(odd.includes('<b>'), false);

  // nothing at all: the card with no heading, as it was drawn before
  const empty = drawn(tonightPanel, upNextContent([]));
  assert.ok(empty.includes('<div class="heading"></div>'));
  assert.equal(rowsIn(empty), 0);
});

test('the stylesheet of the Daily Agenda keeps text at 44px or more and lines at 3px or more, and the tag of a talk follows the badge', () => {
  const css = fs.readFileSync(path.join(dashboardFolder, 'panels/tonight/tonight.css'), 'utf8');
  const tokens = fs.readFileSync(path.join(dashboardFolder, 'tokens.css'), 'utf8');
  const size = name => Number((new RegExp('--' + name + ': (\\d+)px;').exec(tokens) || [])[1]);

  const sizes = Array.from(css.matchAll(/font:\s*\d+ var\(--(size-[a-z-]+)\)\//g));
  assert.ok(sizes.length >= 8);
  sizes.forEach(match => assert.ok(size(match[1]) >= 44, match[1] + ' is smaller than 44px'));
  assert.equal(/font(-size)?:[^;]*\b\d+px\b[^;]*\//.test(css), false, 'a size written in pixels');
  assert.equal(/font-size:/.test(css), false);

  Array.from(css.matchAll(/border(-[a-z]+)?:\s*(\d+)px/g)).forEach(match => assert.ok(Number(match[2]) >= 3, match[0]));

  const tag = /\.tonight \.talk-tag\s*\{([^}]*)\}/.exec(css)[1];
  assert.ok(/border: 3px solid var\(--lilac\);/.test(tag));
  assert.ok(/font: 600 var\(--size-label\)\/44px var\(--font-display\);/.test(tag));
  const now = /\.tonight \.talk-now\s*\{([^}]*)\}/.exec(css)[1];
  assert.ok(/background: var\(--yellow\);/.test(now) && /color: var\(--ground\);/.test(now), 'the same pair as the sample badge on the banner');
});

test('shell.js merges the events when content changes and once a minute', () => {
  const shell = fs.readFileSync(path.join(dashboardFolder, 'shell.js'), 'utf8');
  assert.ok(shell.includes("import { mergeEvents } from './core/events.js';"));
  assert.ok(shell.includes('content.events = mergedEvents();'), 'rebuild() should merge');
  assert.ok(/setInterval\(\(\) => \{\s*if \(content\) content\.events = mergedEvents\(\);\s*\}, 60 \* 1000\);/.test(shell), 'a timer should merge once a minute');
  assert.ok(shell.includes('base.theme.timeZone'), 'the Look time zone should be used');
});

// The Mini's name and addresses, shown inside the connection status text while Sanity cannot be reached
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

// The reading of device.json, with a clock and a fetch. The lines go to a
// function, which in the dashboard puts them in the connection status text.

async function withDevice(run) {
  await inWorld(async world => {
    const seen = []; // every list of lines that was handed over, in order
    const use = lines => seen.push(lines);
    try {
      await run(world, seen, use);
    } finally {
      showDeviceInfo(false, use);
    }
  });
}

const fullDeviceLines = [
  'hawktimus-mini · Wi-Fi 192.168.1.23 · Tailscale 100.101.102.103',
  'ssh hawktimus@100.101.102.103',
];

test('the device lines are read from device.json when asked for, with no cache, and handed over', () => withDevice(async (world, seen, use) => {
  world.handler = async () => jsonResponse(fullDevice);

  showDeviceInfo(true, use);
  await settle();

  assert.equal(world.fetches.length, 1);
  assert.ok(world.fetches[0].url.endsWith('data/live/device.json'), world.fetches[0].url);
  assert.equal(deviceFile, 'data/live/device.json');
  assert.equal(world.fetches[0].options.cache, 'no-store');
  assert.deepEqual(seen, [fullDeviceLines]);
}));

test('nothing is read and nothing handed over while the status text is not showing', () => withDevice(async (world, seen, use) => {
  world.handler = async () => jsonResponse(fullDevice);

  showDeviceInfo(false, use);
  showDeviceInfo(false, use);
  await world.advance(5 * 60 * 1000);

  assert.equal(world.fetches.length, 0);
  assert.equal(world.timers.length, 0);
  assert.deepEqual(seen, []);
}));

test('the file is read again every minute while it stays shown, and asking twice starts one timer', () => withDevice(async (world, seen, use) => {
  let reads = 0;
  world.handler = async () => {
    reads += 1;
    return jsonResponse(reads === 1 ? fullDevice : { hostname: 'hawktimus-mini', wifi: '10.0.0.8', tailscale: '' });
  };

  showDeviceInfo(true, use);
  showDeviceInfo(true, use);
  await settle();
  assert.equal(reads, 1);
  assert.equal(world.timers.length, 1);
  assert.equal(refreshSeconds, 60);

  await world.advance(59 * 1000);
  assert.equal(reads, 1);
  await world.advance(1000);
  assert.equal(reads, 2);
  assert.deepEqual(seen[seen.length - 1], ['hawktimus-mini · Wi-Fi 10.0.0.8', 'ssh hawktimus@10.0.0.8']);

  await world.advance(60 * 1000);
  assert.equal(reads, 3);
}));

test('the lines are taken away at once when the text goes away, and the reading stops', () => withDevice(async (world, seen, use) => {
  world.handler = async () => jsonResponse(fullDevice);

  showDeviceInfo(true, use);
  await settle();
  assert.deepEqual(seen[seen.length - 1], fullDeviceLines);

  showDeviceInfo(false, use);
  assert.deepEqual(seen[seen.length - 1], []);
  assert.equal(world.timers.length, 0);

  const count = seen.length;
  await world.advance(5 * 60 * 1000);
  assert.equal(world.fetches.length, 1);
  assert.equal(seen.length, count);
}));

test('an answer that comes after the text went away is thrown away', () => withDevice(async (world, seen, use) => {
  let answer = null;
  world.handler = () => new Promise(resolve => { answer = resolve; });

  showDeviceInfo(true, use);
  await settle();
  showDeviceInfo(false, use);

  answer(jsonResponse(fullDevice));
  await settle();
  assert.deepEqual(seen, [[]]);
}));

test('a missing file, a file that is not JSON and a network error all give no lines, and a good file later gives them', () => withDevice(async (world, seen, use) => {
  const answers = [
    async () => jsonResponse({}, 404),
    async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token'); } }),
    async () => { throw new TypeError('Failed to fetch'); },
    async () => jsonResponse({ hostname: '', wifi: '', tailscale: '' }),
    async () => jsonResponse(fullDevice),
  ];
  world.handler = async () => answers.shift()();

  showDeviceInfo(true, use);
  await settle();
  assert.deepEqual(seen, [[]], 'a missing file');

  await world.advance(60 * 1000);
  assert.deepEqual(seen[seen.length - 1], [], 'bad JSON');

  await world.advance(60 * 1000);
  assert.deepEqual(seen[seen.length - 1], [], 'a network error');

  await world.advance(60 * 1000);
  assert.deepEqual(seen[seen.length - 1], [], 'every value empty');

  await world.advance(60 * 1000);
  assert.deepEqual(seen[seen.length - 1], fullDeviceLines);
  assert.equal(world.errors.length, 0, 'a missing file is not an error to report');
}));

// The connection status text: when it shows, what it says, and the page it is drawn on

const sanityStatus = { source: 'sanity', updated: new Date(2026, 9, 2, 14, 31), offline: false, reason: '' };
const calendarsRead = new Date(2026, 9, 2, 14, 30);

function contentWith(counts) {
  const items = number => Array.from({ length: number }, (value, index) => ({ title: '[Item ' + index + ']' }));
  return {
    tasks: items(counts.tasks || 0),
    sponsors: items(counts.sponsors || 0),
    tipsAndNews: items(counts.tipsAndNews || 0),
    subteams: items(counts.subteams || 0),
    people: items(counts.people || 0),
    plan: counts.plan ? { rows: [] } : null,
    customPanels: items(counts.customPanels || 0),
  };
}

const someContent = contentWith({ tasks: 12, sponsors: 4, tipsAndNews: 9, subteams: 5, people: 8, plan: true, customPanels: 3 });

test('classifyFailure: 401 and 403 are access denied, whatever else is known', () => {
  assert.equal(classifyFailure({ status: 401 }), 'denied');
  assert.equal(classifyFailure({ status: 403 }), 'denied');
  assert.equal(classifyFailure({ status: 403, hostAnswered: false }), 'denied');
});

test('classifyFailure: any other status Sanity answered with is other', () => {
  [400, 404, 429, 500, 503, 200].forEach(status => {
    assert.equal(classifyFailure({ status: status }), 'other', 'status ' + status);
  });
});

test('classifyFailure: no readable answer is the network when the host does not answer, and CORS when it does', () => {
  assert.equal(classifyFailure({ hostAnswered: false }), 'network');
  assert.equal(classifyFailure({ hostAnswered: true }), 'cors');
  assert.equal(classifyFailure({ status: 0, hostAnswered: true, timedOut: false }), 'cors');
});

test('classifyFailure: a timeout is the network when the host does not answer, and not CORS when it does', () => {
  assert.equal(classifyFailure({ timedOut: true, hostAnswered: false }), 'network');
  assert.equal(classifyFailure({ timedOut: true, hostAnswered: true }), 'other');
});

test('classifyFailure: with nothing known, or nothing usable, it is other, and it always gives one of the four words', () => {
  assert.equal(classifyFailure({ hostAnswered: null }), 'other');
  assert.equal(classifyFailure({}), 'other');
  [undefined, null, 'text', 7, { status: 'x' }].forEach(value => assert.equal(classifyFailure(value), 'other'));
  assert.deepEqual(reasons, ['network', 'cors', 'denied', 'other']);
});

test('reasonText has plain words for each reason, and other for one it does not know', () => {
  assert.equal(reasonText('network'), 'network down');
  assert.equal(reasonText('cors'), 'CORS blocked');
  assert.equal(reasonText('denied'), 'access denied');
  assert.equal(reasonText('other'), 'other error');
  assert.equal(reasonText('nonsense'), 'other error');
  assert.equal(reasonText(undefined), 'other error');
});

test('itemCounts counts each kind of content, the agenda as one or none, and copes with missing lists', () => {
  assert.deepEqual(itemCounts(someContent), [
    ['Tasks', 12], ['Sponsors', 4], ['Tips', 9], ['Team leads', 5],
    ['People', 8], ['Agenda', 1], ['Extra panels', 3],
  ]);
  assert.deepEqual(itemCounts(withDefaults({})).map(pair => pair[1]), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(itemCounts(null).map(pair => pair[1]), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(itemCounts({ tasks: 'not a list', plan: {} }).map(pair => pair[1]), [0, 0, 0, 0, 0, 1, 0]);
});

test('connectionLines shows nothing while Sanity is reachable and the switch is off', () => {
  assert.deepEqual(connectionLines({ status: sanityStatus, always: false, content: someContent, calendarsReadAt: calendarsRead }), []);
  assert.deepEqual(connectionLines({ status: { source: 'cache', updated: null, offline: false, reason: '' }, always: false }), []);
  assert.deepEqual(connectionLines({ status: null, always: true }), []);
  assert.deepEqual(connectionLines({ always: true }), []);
});

test('connectionLines gives the reason and the last good read while Sanity is unreachable, then the Mini lines', () => {
  const status = { source: 'sanity', updated: new Date(2026, 9, 2, 14, 31), offline: true, reason: 'cors' };
  assert.deepEqual(connectionLines({ status: status, always: false, deviceLines: fullDeviceLines }), [
    'SANITY UNREACHABLE: CORS BLOCKED',
    'Last good read 2:31 PM',
    'hawktimus-mini · Wi-Fi 192.168.1.23 · Tailscale 100.101.102.103',
    'ssh hawktimus@100.101.102.103',
  ]);
});

test('connectionLines names each of the four reasons, and says so when there has been no good read', () => {
  const words = { network: 'NETWORK DOWN', cors: 'CORS BLOCKED', denied: 'ACCESS DENIED', other: 'OTHER ERROR' };
  Object.keys(words).forEach(reason => {
    const lines = connectionLines({ status: { source: 'sanity', updated: null, offline: true, reason: reason }, always: false });
    assert.deepEqual(lines, ['SANITY UNREACHABLE: ' + words[reason], 'No good read yet']);
  });

  const unknown = connectionLines({ status: { source: 'sanity', updated: null, offline: true, reason: '' }, always: false });
  assert.equal(unknown[0], 'SANITY UNREACHABLE: OTHER ERROR');
});

test('connectionLines with the switch on gives the last read, the counts and the calendar time', () => {
  assert.deepEqual(connectionLines({ status: sanityStatus, always: true, content: someContent, calendarsReadAt: calendarsRead }), [
    'Sanity OK · last read 2:31 PM',
    'Tasks 12 · Sponsors 4 · Tips 9 · Team leads 5',
    'People 8 · Agenda 1 · Extra panels 3',
    'Calendars read 2:30 PM',
  ]);
});

test('connectionLines says when the calendars have not been read, and when Sanity has not been read yet', () => {
  const lines = connectionLines({ status: { source: 'sanity', updated: null, offline: false, reason: '' }, always: true, content: withDefaults({}), calendarsReadAt: null });
  assert.deepEqual(lines, [
    'Sanity not read yet',
    'Tasks 0 · Sponsors 0 · Tips 0 · Team leads 0',
    'People 0 · Agenda 0 · Extra panels 0',
    'Calendars not read yet',
  ]);
});

test('connectionLines says when the screen shows a saved copy, or the sample', () => {
  const saved = connectionLines({ status: { source: 'cache', updated: new Date(2026, 9, 2, 9, 5), offline: false, reason: '' }, always: true, content: someContent });
  assert.equal(saved[0], 'Saved copy from 9:05 AM');

  const none = connectionLines({ status: { source: 'cache', updated: null, offline: false, reason: '' }, always: true, content: someContent });
  assert.equal(none[0], 'Saved copy, Sanity not read yet');

  const sample = connectionLines({ status: { source: 'sample', updated: null, offline: false, reason: '' }, always: true, content: someContent });
  assert.equal(sample[0], 'Sample content, Sanity not read');
});

test('connectionLines puts the reason first and the counts after it when the switch is on and Sanity is unreachable', () => {
  const status = { source: 'cache', updated: new Date(2026, 9, 2, 14, 31), offline: true, reason: 'network' };
  const lines = connectionLines({ status: status, always: true, content: someContent, calendarsReadAt: calendarsRead, deviceLines: ['ssh hawktimus@10.0.0.5'] });
  assert.deepEqual(lines, [
    'SANITY UNREACHABLE: NETWORK DOWN',
    'Last good read 2:31 PM',
    'Tasks 12 · Sponsors 4 · Tips 9 · Team leads 5',
    'People 8 · Agenda 1 · Extra panels 3',
    'Calendars read 2:30 PM',
    'ssh hawktimus@10.0.0.5',
  ]);
});

test('connectionLines says so when the sample file cannot be read, and never blames Sanity for it', () => {
  const lines = connectionLines({ status: { source: 'sample', updated: null, offline: true, reason: 'other' }, always: false });
  assert.deepEqual(lines, ['SAMPLE CONTENT FILE NOT READ']);
});

test('no line is longer than the screen has room for at 44px', () => {
  // The text is nowrap and cut with an ellipsis at 1840px. At 44px a character is
  // at most about 28px wide, so 60 characters is 1680px and fits with its padding.
  const status = { source: 'sanity', updated: new Date(2026, 9, 2, 14, 31), offline: true, reason: 'denied' };
  const lines = connectionLines({ status: status, always: true, content: someContent, calendarsReadAt: calendarsRead, deviceLines: fullDeviceLines });
  const shortLines = lines.filter(line => line.indexOf('hawktimus-mini') !== 0);
  shortLines.forEach(line => assert.ok(line.length <= 60, line));
});

// drawConnection, with a stand-in for the page

function fakeBox() {
  const box = {
    hidden: true,
    dataset: {},
    children: [],
    appendChild(child) {
      this.children.push(child);
    },
  };
  globalThis.document = {
    getElementById: id => (id === 'connection-status' ? box : null),
    createElement: () => ({ textContent: '', className: '' }),
  };
  return box;
}

function withBox(run) {
  const box = fakeBox();
  try {
    return run(box);
  } finally {
    delete globalThis.document;
  }
}

function rowsOf(box) {
  return box.children.map(row => row.textContent);
}

test('drawConnection adds a row for each line, shows the box and sets its tone', () => withBox(box => {
  drawConnection(['SANITY UNREACHABLE: NETWORK DOWN', 'Last good read 2:31 PM'], 'warning');
  assert.equal(box.hidden, false);
  assert.equal(box.dataset.tone, 'warning');
  assert.deepEqual(rowsOf(box), ['SANITY UNREACHABLE: NETWORK DOWN', 'Last good read 2:31 PM']);
}));

test('drawConnection hides the box and empties the rows when there are no lines, and reuses its rows', () => withBox(box => {
  drawConnection(['one', 'two', 'three'], 'info');
  const rows = box.children.slice();

  drawConnection(['four'], 'info');
  assert.deepEqual(rowsOf(box), ['four', '', '']);
  assert.equal(box.children.length, 3, 'no new rows are made for fewer lines');
  assert.equal(box.hidden, false);

  drawConnection([], 'info');
  assert.equal(box.hidden, true);
  assert.deepEqual(rowsOf(box), ['', '', '']);
  assert.ok(box.children.every((row, index) => row === rows[index]), 'the same rows are used');
}));

test('drawConnection marks a line that starts with ssh as the command', () => withBox(box => {
  drawConnection(['Sanity OK', 'ssh hawktimus@100.101.102.103'], 'warning');
  assert.deepEqual(box.children.map(row => row.className), ['', 'command']);

  drawConnection(['ssh hawktimus@10.0.0.5', 'Sanity OK'], 'warning');
  assert.deepEqual(box.children.map(row => row.className), ['command', '']);
}));

test('drawConnection does nothing when the page has no connection status box', () => {
  globalThis.document = { getElementById: () => null };
  try {
    drawConnection(['a line'], 'info');
  } finally {
    delete globalThis.document;
  }
});

test('shell.js draws the connection text from the status and the switch, and keeps the calendar read time', () => {
  const shell = fs.readFileSync(path.join(dashboardFolder, 'shell.js'), 'utf8');
  assert.ok(shell.includes("import { connectionLines, drawConnection } from './core/connection.js';"));
  assert.ok(shell.includes("import { showDeviceInfo } from './core/device.js';"));
  assert.ok(shell.includes('showDeviceInfo(Boolean(status && status.offline), useDeviceLines);'), 'rebuild() should pass status.offline');
  assert.ok(shell.includes('always: content.settings.showConnectionStatus,'), 'the switch should be passed');
  assert.ok(shell.includes("drawConnection(lines, status && status.offline ? 'warning' : 'info');"));
  assert.ok(/if \(result\.failed\.length === 0\) calendarsReadAt = now;/.test(shell), 'readEvents should record when the calendars were read');
  assert.ok(/calendarsReadAt = null;/.test(shell), 'a change of source should forget the time');
  assert.ok(!shell.includes('OFFLINE'), 'the banner no longer says OFFLINE');
});

test('index.html has the empty hidden connection box after the stage and before the overlay, and the banner no longer has a status', () => {
  const page = fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8');
  assert.ok(/<div id="connection-status" hidden><\/div>/.test(page), 'index.html should have the empty hidden box');
  assert.ok(page.indexOf('id="connection-status"') > page.indexOf('id="stage"'), 'the box comes after the stage');
  assert.ok(page.indexOf('id="connection-status"') < page.indexOf('id="overlay"'), 'the box comes before the overlay');
  assert.ok(!page.includes('device-info'), 'the old strip is gone');

  const banner = fs.readFileSync(path.join(dashboardFolder, 'panels/banner/banner.js'), 'utf8');
  assert.ok(!banner.includes('OFFLINE') && !banner.includes('data-part="status"'), 'the banner has no OFFLINE text');
  const frameScript = fs.readFileSync(path.join(dashboardFolder, 'frame.js'), 'utf8');
  assert.ok(!/'status':/.test(frameScript), 'frame.js has no line for the banner status');
});

test('the connection text is at least 44px, sits bottom right, has no animation, and is only shown by the hidden switch', () => {
  const css = fs.readFileSync(path.join(dashboardFolder, 'base.css'), 'utf8');
  const rule = css.match(/#connection-status \{([^}]*)\}/);
  assert.ok(rule, 'base.css should have the #connection-status rule');
  assert.ok(rule[1].includes('font: 600 var(--size-label)/44px'), 'the text is the 44px label size');
  assert.ok(/position: absolute;/.test(rule[1]) && /right: \d+px;/.test(rule[1]) && /bottom: \d+px;/.test(rule[1]), 'it is taken out of the flow, bottom right');
  assert.ok(!/animation|transition|shadow|filter|transform/.test(css.slice(css.indexOf('#connection-status {'), css.indexOf('.panel { position: relative; }'))), 'no animation, shadow or blur');
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

// A task's contact and location, and the Tasks panel that shows them

test('the query follows the task\'s place reference, and says whether the place is showing', () => {
  assert.ok(contentQuery.includes('"location": location->name'));
  assert.ok(contentQuery.includes('"locationShown": location->show != false'));
});

test('a task keeps its contact and the name of its place, and nothing else about it changes', () => {
  const result = {
    tasks: [
      document('task', 't1', { title: '[A]', status: 'in-progress', contact: ' Sam ', location: 'Classroom', locationShown: true, order: 2 }),
      document('task', 't2', { title: '[B]', status: 'up-next', contact: '', location: null, locationShown: true, order: 1 }),
    ],
  };
  const tasks = normalizeContent(result, today).tasks;
  assert.deepEqual(tasks, [
    { title: '[B]', status: 'up-next', order: 1 },
    { title: '[A]', status: 'in-progress', contact: 'Sam', location: 'Classroom', order: 2 },
  ]);
});

test('a hidden, deleted or nameless place gives no location, and the task stays', () => {
  const task = fields => document('task', 't1', Object.assign({ title: '[A]', status: 'in-progress', contact: 'Sam' }, fields));
  const only = fields => normalizeContent({ tasks: [task(fields)] }, today).tasks[0];

  // hidden: the query sends the name and locationShown false
  assert.deepEqual(only({ location: 'Classroom', locationShown: false }), { title: '[A]', status: 'in-progress', contact: 'Sam' });
  // deleted, or never published: the query sends null for both
  assert.deepEqual(only({ location: null, locationShown: null }), { title: '[A]', status: 'in-progress', contact: 'Sam' });
  // a place with no name, a name of spaces, or something that is not text
  assert.equal('location' in only({ location: '   ', locationShown: true }), false);
  assert.equal('location' in only({ location: 7, locationShown: true }), false);
  assert.equal('location' in only({ location: { _ref: 'place-x' } }), false);
  // a place that shows
  assert.equal(only({ location: 'Classroom', locationShown: true }).location, 'Classroom');

  // the task's own hidden switch, expiry and order work as before
  const hiddenTask = normalizeContent({ tasks: [task({ location: 'Classroom', show: false }), task({ location: 'Hallway', expires: '2020-01-01T00:00:00.000Z' }), task({ location: 'Gym' })] }, today).tasks;
  assert.equal(hiddenTask.length, 3);
  assert.deepEqual(visibleItems(hiddenTask, today).map(item => item.location), ['Gym']);
});

test('the sample content is cleaned the same way, and has a contact and a place', () => {
  const sample = normalizeSample(JSON.parse(fs.readFileSync(sampleFile, 'utf8')));
  assert.ok(sample.tasks.some(task => task.contact && task.location));
  assert.ok(sample.tasks.some(task => task.contact && !task.location));
  assert.ok(sample.tasks.some(task => !task.contact && task.location));

  const odd = normalizeSample({ tasks: [{ title: '[A]', status: 'up-next', contact: '  ', location: ' Hallway ', locationShown: false }] });
  assert.deepEqual(odd.tasks, [{ title: '[A]', status: 'up-next' }]);
});

// Each mount of the panel shows the next page, so a test that mounts it gets its own copy
let tasksPanelCopies = 0;
async function freshTasksPanel() {
  const folder = path.join(workFolder, 'live', 'dashboard', 'panels', 'tasks');
  fs.mkdirSync(folder, { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, 'panels', 'tasks', 'tasks.js'), path.join(folder, 'tasks.js'));
  tasksPanelCopies += 1;
  return import(pathToFileURL(path.join(folder, 'tasks.js')).href + '?copy=' + tasksPanelCopies);
}

function taskCalled(title, status, extra) {
  return Object.assign({ title: title, status: status }, extra);
}

// A row as one line of text: the status and the titles
function rowText(row) {
  return row.group.status + ': ' + row.tasks.map(task => task.title).join(' ');
}

test('a task with a contact or a place takes two lines, so a row of two lines holds one, and a done task is always one line', async () => {
  const panel = await freshTasksPanel();
  const content = {
    settings: { doneDays: 7 },
    tasks: [
      taskCalled('[A]', 'blocked'),
      taskCalled('[B]', 'in-progress', { contact: 'Sam' }),
      taskCalled('[C]', 'in-progress', { location: 'Classroom' }),
      taskCalled('[D]', 'in-progress'),
      taskCalled('[E]', 'in-progress'),
      taskCalled('[F]', 'up-next', { contact: 'Kim', location: 'Media center' }),
      taskCalled('[G]', 'done', { contact: 'Lee', location: 'Hallway' }),
      taskCalled('[H]', 'done'),
    ],
  };

  assert.deepEqual(panel.rowsFor(content, today).map(rowText), [
    'blocked: [A]',
    'in-progress: [B]',
    'in-progress: [C]',
    'in-progress: [D] [E]',
    'up-next: [F]',
    'done: [G] [H]',
  ]);

  // a plain task and one with details do not share a row: that would be three lines
  const mixed = { settings: { doneDays: 7 }, tasks: [taskCalled('[A]', 'up-next'), taskCalled('[B]', 'up-next', { location: 'Hallway' }), taskCalled('[C]', 'up-next')] };
  assert.deepEqual(panel.rowsFor(mixed, today).map(rowText), ['up-next: [A]', 'up-next: [B]', 'up-next: [C]']);
});

test('the Tasks panel keeps its rules: hidden and expired tasks stay off, old done tasks drop off, a task with no title is skipped', async () => {
  const panel = await freshTasksPanel();
  const old = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const content = {
    settings: { doneDays: 7 },
    tasks: [
      taskCalled('[Hidden]', 'in-progress', { show: false, location: 'Hallway' }),
      taskCalled('[Expired]', 'in-progress', { expires: '2020-01-01T00:00:00.000Z', contact: 'Sam' }),
      taskCalled('', 'in-progress', { contact: 'Sam' }),
      taskCalled('[Old]', 'done', { finishedOn: old }),
      taskCalled('[Shown]', 'in-progress', { contact: 'Sam' }),
    ],
  };
  assert.deepEqual(panel.rowsFor(content, today).map(rowText), ['in-progress: [Shown]']);
  assert.equal(panel.hasContent(content), true);
  assert.equal(panel.hasContent({ settings: { doneDays: 7 }, tasks: [taskCalled('[Old]', 'done', { finishedOn: old })] }), false);
  assert.equal(panel.hasContent({ settings: { doneDays: 7 }, tasks: [] }), false);
});

test('the Tasks panel shows three rows a page and the next page each time it comes round, blocked first and done last', async () => {
  const panel = await freshTasksPanel();
  const content = {
    settings: { doneDays: 7 },
    tasks: [
      taskCalled('[Done]', 'done'),
      taskCalled('[P1]', 'in-progress', { contact: 'Sam' }),
      taskCalled('[P2]', 'in-progress', { contact: 'Kim' }),
      taskCalled('[P3]', 'in-progress', { location: 'Hallway' }),
      taskCalled('[P4]', 'in-progress', { location: 'Classroom' }),
      taskCalled('[Next]', 'up-next', { contact: 'Lee' }),
      taskCalled('[Blocked]', 'blocked', { contact: 'Pat' }),
    ],
  };

  const first = drawn(panel, content);
  const second = drawn(panel, content);
  const third = drawn(panel, content);

  assert.equal(countOf(first, 'data-slat="item"'), 3);
  ['[Blocked]', '[P1]', '[P2]'].forEach(title => assert.ok(first.includes(title), title + ' should be on the first page'));
  assert.ok(!first.includes('[P3]'));
  assert.equal(countOf(second, 'data-slat="item"'), 3);
  ['[P3]', '[P4]', '[Next]'].forEach(title => assert.ok(second.includes(title), title + ' should be on the second page'));
  assert.equal(countOf(third, 'data-slat="item"'), 1);
  assert.ok(third.includes('[Done]'));

  // then round to the first page again
  assert.equal(drawn(panel, content), first);
});

test('the Tasks panel draws a contact and a place under the name, only for tasks that are not done, and escapes them', async () => {
  const panel = await freshTasksPanel();
  const markup = tasks => drawn(panel, { settings: { doneDays: 7 }, tasks: tasks });

  const both = markup([taskCalled('[A]', 'in-progress', { contact: 'Sam', location: 'Classroom' })]);
  assert.ok(both.includes('<div class="task-detail"><span class="contact">Sam</span><span class="location">Classroom</span></div>'), both);

  const contactOnly = markup([taskCalled('[A]', 'blocked', { contact: 'Sam' })]);
  assert.ok(contactOnly.includes('<span class="contact">Sam</span>') && !contactOnly.includes('class="location"'));
  const locationOnly = markup([taskCalled('[A]', 'up-next', { location: 'Media center' })]);
  assert.ok(locationOnly.includes('<span class="location">Media center</span>') && !locationOnly.includes('class="contact"'));

  const plain = markup([taskCalled('[A]', 'up-next', { subteam: '[Build]' })]);
  assert.ok(!plain.includes('task-detail'));
  assert.ok(plain.includes('<div class="subteam">[Build]</div>'));

  const done = markup([taskCalled('[A]', 'done', { contact: 'Sam', location: 'Classroom' })]);
  assert.ok(done.includes('[A]') && !done.includes('task-detail') && !done.includes('Sam') && !done.includes('Classroom'), done);

  const unsafe = markup([taskCalled('[A]', 'up-next', { contact: '<b>', location: 'A & B' })]);
  assert.ok(unsafe.includes('&lt;b&gt;') && unsafe.includes('A &amp; B') && !unsafe.includes('<b>'), unsafe);
});

// This one comes last: the Roster panel keeps the page it showed last, and the tests above count
// its visits from the first page. The rows of Leadership and Team Leads are in tools/test-person-rows.mjs.
test('the Roster panel draws its portrait at the Portrait size, and at 100 without it', () => withFakePage(() => {
  const host = () => ({ innerHTML: '', querySelector: () => null, querySelectorAll: () => [] });
  const people = [{ role: 'Coach', name: '[Coach A]' }, { role: 'Captain', name: '[Captain A]' }];
  const subteams = [{ name: '[Build]', lead: '[Lead A]', members: ['[Alex]', '[Sam]'] }];
  const panels = [
    ['roster', live.rosterPanel],
  ];

  panels.forEach(([name, panel]) => {
    const draw = settings => {
      const target = host();
      panel.mount(target, { people: people, subteams: subteams, settings: settings });
      return target.innerHTML;
    };

    const at60 = draw({ portraitScale: 60 });
    const at80 = draw({ portraitScale: 80, photoScale: 60 });
    const at100 = draw({ portraitScale: 100 });
    assert.ok(at60.includes('--portrait-card: 175px; --portrait-photo: 167px; --portrait-inset: 4px'), name + ' at 60');
    assert.ok(at80.includes('--portrait-card: 234px; --portrait-photo: 224px; --portrait-inset: 5px'), name + ' at 80, and the Photo size does not change it');
    assert.ok(at100.includes('--portrait-card: 292px; --portrait-photo: 280px; --portrait-inset: 6px'), name + ' at 100');
    // content with no settings, or no size in them, is the full size
    assert.ok(draw(undefined).includes('--portrait-card: 292px'), name + ' with no settings');
    assert.ok(draw({}).includes('--portrait-card: 292px'), name + ' with no size');
    // the text keeps its size: apart from the sizes of the portrait, the markup is the same whatever the setting
    const withoutSizes = (html, variables) => html.replace(variables, '').replace(/ width="\d+" height="\d+"/g, '');
    assert.equal(withoutSizes(at60, '--portrait-card: 175px; --portrait-photo: 167px; --portrait-inset: 4px'),
      withoutSizes(at100, '--portrait-card: 292px; --portrait-photo: 280px; --portrait-inset: 6px'), name);
  });

  // the style of the slot does not name a size of its own for the text or the slot
  const base = fs.readFileSync(path.join(dashboardFolder, 'base.css'), 'utf8');
  assert.ok(/\.roster \.slot\s*\{[^}]*width: 352px;/.test(fs.readFileSync(path.join(dashboardFolder, 'panels/roster/roster.css'), 'utf8')), 'the slot is still 352 wide');
  assert.ok(/\.portrait\s*\{[^}]*margin: 0 auto 8px;/.test(base), 'a smaller portrait is centred in its slot');
}));

// Teams: the team documents, the team each item is for, which team the mode asks for, and the
// one function that leaves out what is for the other team (core/teams.js, sanity.js, content.js).
// The tests that put the team on a page are in tools/test-themes.mjs.

const seededTeams = fs.readFileSync(path.join(dashboardFolder, '../docs/seed/teams.ndjson'), 'utf8')
  .split('\n')
  .filter(line => line.trim() !== '')
  .map(line => JSON.parse(line));

// The teams as the screen holds them, from the two starting teams in docs/seed/teams.ndjson
function startingTeams() {
  return normalizeContent({ teams: seededTeams }, today).teams;
}

// Runs a check with a team on the screen, and puts the built-in team back after it. The
// module is shared by every test in this file, so it has to be left as it was found.
function onTeamScreen(code, run) {
  teamsModule.useTeams({ teams: startingTeams(), settings: { teamMode: code, alternateMinutes: 5 } }, today);
  teamsModule.changeTeamNow();
  try {
    run();
  } finally {
    teamsModule.useTeams(withDefaults(null), today);
    teamsModule.changeTeamNow();
  }
}

test('the query asks for the teams, and for the team code of every kind of content that has a Team field', () => {
  assert.ok(contentQuery.includes('"teams": *[_type == "team"] | order(order asc, _createdAt asc) {'));
  // tasks, sponsors, tips and news, subteams, people, talks, plans and extra panels
  assert.equal(contentQuery.split('"team": team->code').length - 1, 8);

  ['"tasks"', '"sponsors"', '"tipsAndNews"', '"subteams"', '"people"', '"presentations"', '"plans"', '"customPanels"'].forEach(name => {
    const start = contentQuery.indexOf(name + ': *[');
    assert.ok(start !== -1, name);
    const next = contentQuery.indexOf('\n  "', start + 1);
    assert.ok(contentQuery.slice(start, next === -1 ? contentQuery.length : next).includes('"team": team->code'), name + ' does not ask for its team code');
  });

  // a photo is shared by both teams, and nothing on the screen shows a Meeting day
  const photos = contentQuery.slice(contentQuery.indexOf('"photos": *['), contentQuery.indexOf('"presentations": *['));
  assert.equal(photos.includes('team'), false);
  assert.equal(contentQuery.includes('presentationDay'), false);
});

test('the two starting teams become the teams the screen uses, and the built-in team is the starting Prime', () => {
  const [prime, nova] = startingTeams();

  assert.deepEqual(prime, {
    code: 'prime', name: 'HAWKTIMUS PRIME', shortName: 'PRIME', number: '3229', logo: '',
    colors: { primary: '#6C18B6', plate: '#3B2A7A', accent: '#FACA2A', neon: '#35F0FF', pink: '#FF2E8C', background: '#09060F', text: '#FFFFFF' },
    mirror: false, active: true, order: 10,
  });
  assert.deepEqual(nova, {
    code: 'nova', name: 'HAWKTIMUS NOVA', shortName: 'NOVA', number: '3230', logo: '',
    colors: { primary: '#1F7AE0', plate: '#1E3A6E', accent: '#9BF0FF', neon: '#FF2E8C', pink: '#35F0FF', background: '#060D1A', text: '#FFFFFF' },
    mirror: true, active: true, order: 20,
  });

  const builtIn = live.config.primeTeam;
  assert.deepEqual(Object.assign({}, builtIn, { builtIn: undefined }), Object.assign({}, prime, { builtIn: undefined }), 'the team with no documents is the starting Prime');
  assert.equal(builtIn.builtIn, true);
  assert.equal(builtIn.name, live.config.defaultTeam.name);
  assert.equal(builtIn.number, live.config.defaultTeam.number);
});

test('a team document is cleaned: the code is lowercase, the names are capitals, a bad color is the Prime one, and one with no code is dropped', () => {
  const teams = normalizeContent({
    teams: [
      document('team', 'a', { code: ' Blue ', name: '[Blue team]', shortName: 'blue', number: ' 12 ', colors: { primary: '#0000FF', plate: 'blue', accent: '#12', neon: '', pink: '#ABCDEF', background: 7, text: '#fff' }, order: 5 }),
      document('team', 'b', { code: 'blue', name: '[Second blue]' }),
      document('team', 'c', { code: 'No Spaces', name: '[Dropped]' }),
      document('team', 'd', { name: '[No code]' }),
      document('team', 'e', { code: 'plain' }),
      document('team', 'f', { code: 'quiet', name: '[Quiet]', active: false, mirror: 'yes', number: 3232 }),
      'oops',
      null,
    ],
  }, today).teams;

  assert.deepEqual(teams.map(team => team.code), ['blue', 'plain', 'quiet'], 'in order, the first of a code wins, and a code with a space or none is dropped');

  const [blue, plain, quiet] = teams;
  assert.equal(blue.name, '[BLUE TEAM]');
  assert.equal(blue.shortName, 'BLUE');
  assert.equal(blue.number, '12');
  assert.deepEqual(blue.colors, { primary: '#0000FF', plate: '#3B2A7A', accent: '#FACA2A', neon: '#35F0FF', pink: '#ABCDEF', background: '#09060F', text: '#FFFFFF' }, 'only #rrggbb is a color');
  assert.equal(blue.order, 5);

  assert.deepEqual([plain.name, plain.shortName, plain.number, plain.logo, plain.mirror, plain.active, plain.order], ['PLAIN', 'PLAIN', '', '', false, true, 10], 'a team with only a code');
  assert.deepEqual([quiet.mirror, quiet.active, quiet.number], [false, false, '3232'], 'mirror is on only when it is true');
});

test('a team logo is a picture address at most 600 pixels wide, and no picture, or one that cannot be used, is the hawk', () => {
  const withLogo = changes => normalizeContent({ teams: [document('team', 'a', Object.assign({ code: 'blue' }, changes))] }, today).teams[0].logo;

  assert.equal(live.images.logoMaxWidth, 600);
  assert.equal(withLogo({ logo: photoRecord() }), photoBase + '?w=600&fit=max&auto=format');
  assert.equal(withLogo({ logo: photoRecord({ crop: { top: 0, bottom: 0, left: 0.1, right: 0.1 } }) }), photoBase + '?rect=80,0,640,600&w=600&fit=max&auto=format');
  assert.equal(withLogo({}), '');
  assert.equal(withLogo({ logo: null }), '');
  assert.equal(withLogo({ logo: photoRecord({ url: 'http://example.com/a.jpg' }) }), '');
  assert.equal(withLogo({ logo: photoRecord({ width: 0 }) }), '');
  assert.equal(live.images.screenPhotoUrl(photoRecord()), photoBase + '?w=1920&fit=max&auto=format', 'a photo is still asked for at 1920');

  // the sample file gives an address
  const sample = normalizeSample({ teams: [{ code: 'blue', logo: ' data/sample/logo.svg ' }] }).teams;
  assert.equal(sample[0].logo, 'data/sample/logo.svg');
});

test('the teams come out in order, through the editors\' content and the sample, and a missing list is no teams', () => {
  const raw = [{ code: 'second', order: 20 }, { code: 'third' }, { code: 'first', order: 10 }];

  assert.deepEqual(normalizeContent({ teams: raw }, today).teams.map(team => team.code), ['first', 'second', 'third']);
  assert.deepEqual(normalizeSample({ teams: raw }).teams.map(team => team.code), ['first', 'second', 'third']);
  [undefined, null, 'oops', {}, []].forEach(value => {
    assert.deepEqual(normalizeContent({ teams: value }, today).teams, []);
    assert.deepEqual(normalizeSample({ teams: value }).teams, []);
  });
  assert.deepEqual(withDefaults(null).teams, []);
});

// Every kind of content with a Team field, as the query sends it, and as the sample file has it
const teamItems = {
  tasks: { title: '[Task]', status: 'in-progress' },
  sponsors: { name: '[Sponsor]', thankYou: '[Thanks]' },
  tipsAndNews: { kind: 'tip', text: '[Tip]' },
  subteams: { name: '[Subteam]', lead: '[Lead]', members: ['[Student]'], spotlight: true, spotlightHeadline: '[Headline]' },
  people: { name: '[Person]', role: 'Mentor' },
  presentations: { id: 'presentation-a', name: '[Speaker]', topic: '[Topic]', start: '2026-10-02T19:00:00Z', status: 'scheduled' },
  plans: { heading: '[Plan]', rows: [] },
  customPanels: { title: '[Custom]', blocks: [{ _type: 'headingBlock', text: '[Heading]' }] },
};

test('a team reference arrives as the team code, and an empty one, a deleted team or anything else is no team at all', () => {
  Object.keys(teamItems).forEach(list => {
    const through = team => {
      const item = Object.assign({}, teamItems[list], team === undefined ? {} : { team: team });
      const sent = normalizeContent({ [list]: [document('thing', 'x', item)] }, today)[list][0];
      const sample = normalizeSample({ [list]: [item] })[list][0];
      return [sent, sample];
    };

    through('nova').forEach(item => assert.equal(item.team, 'nova', list));
    through(' Prime ').forEach(item => assert.equal(item.team, 'prime', list + ': the code is lowercase'));
    [undefined, null, '', '  ', 7, true, [], { _type: 'reference', _ref: 'team-nova' }].forEach(value => {
      through(value).forEach(item => assert.equal('team' in item, false, list + ' with ' + JSON.stringify(value)));
    });
  });
});

test('the plans that are showing and are for today are kept as a list, the first of them is the plan, and each knows its team', () => {
  const content = normalizeContent({
    plans: [
      document('plan', 'p1', { heading: '[Nova plan]', team: 'nova' }),
      document('plan', 'p2', { heading: '[Both plan]' }),
      document('plan', 'p3', { heading: '[Hidden plan]', show: false }),
      document('plan', 'p4', { heading: '[Other day]', date: '2026-10-09T00:00:00' }),
    ],
  }, today);

  assert.deepEqual(content.plans.map(plan => plan.heading), ['[Nova plan]', '[Both plan]']);
  assert.deepEqual(content.plans.map(plan => plan.team), ['nova', undefined]);
  assert.equal(content.plan, content.plans[0]);
  assert.equal(content.plan.rows.length, 0);
  assert.equal(normalizeContent({}, today).plan, null);
  assert.deepEqual(normalizeContent({}, today).plans, []);

  // the sample has one plan, or a list
  assert.deepEqual(normalizeSample({ plan: { heading: '[One]', team: 'prime' } }).plans.map(plan => plan.heading), ['[One]']);
  assert.equal(normalizeSample({ plans: [{ heading: '[A]' }, { heading: '[B]' }] }).plan.heading, '[A]');
  assert.deepEqual(normalizeSample({}).plans, []);
});

const atMinute = (minutes, seconds) => new Date(Date.UTC(2026, 9, 2, 15, minutes, seconds || 0));

test('the mode logic: Prime only and Nova only ask for that team, and anything else, or a missing team, is Prime', () => {
  const { chooseTeam } = teamsModule;
  const [prime, nova] = startingTeams();

  [atMinute(0), atMinute(5), atMinute(37, 12)].forEach(now => {
    assert.equal(chooseTeam(startingTeams(), 'prime', 5, now).code, 'prime');
    assert.equal(chooseTeam(startingTeams(), 'nova', 5, now).code, 'nova');
    ['', 'both', 'Nova', undefined, null, 7].forEach(mode => assert.equal(chooseTeam(startingTeams(), mode, 5, now).code, 'prime', String(mode)));
  });

  // with no Nova there is nothing to show but Prime, and with no teams at all it is the built-in one
  assert.equal(chooseTeam([prime], 'nova', 5, atMinute(0)).code, 'prime');
  assert.equal(chooseTeam([nova], 'prime', 5, atMinute(0)), live.config.primeTeam, 'a Prime that is not in the list is the built-in team');
  [[], undefined, null, 'oops'].forEach(list => {
    ['prime', 'nova', 'alternate'].forEach(mode => assert.equal(chooseTeam(list, mode, 5, atMinute(0)), live.config.primeTeam, mode));
  });

  // a team that is switched off is still the one a mode names, because the mode is a choice
  const off = [prime, Object.assign({}, nova, { active: false })];
  assert.equal(chooseTeam(off, 'nova', 5, atMinute(0)).code, 'nova');
});

test('the mode logic: Alternate gives each active team the same number of whole minutes in turn, counted from the clock', () => {
  const { chooseTeam, activeTeams } = teamsModule;
  const codeAt = (minutes, now, list) => chooseTeam(list || startingTeams(), 'alternate', minutes, now).code;

  // 5 minutes: the team is the same for the whole slot, and the other one in the next
  const first = codeAt(5, atMinute(0));
  const second = first === 'prime' ? 'nova' : 'prime';
  [atMinute(0), atMinute(2, 30), atMinute(4, 59)].forEach(now => assert.equal(codeAt(5, now), first));
  [atMinute(5), atMinute(7), atMinute(9, 59)].forEach(now => assert.equal(codeAt(5, now), second));
  assert.equal(codeAt(5, atMinute(10)), first);
  assert.equal(codeAt(5, atMinute(15)), second);

  // 1 minute and 30 minutes
  assert.notEqual(codeAt(1, atMinute(0)), codeAt(1, atMinute(1)));
  assert.equal(codeAt(1, atMinute(0)), codeAt(1, atMinute(2)));
  assert.equal(codeAt(30, atMinute(0)), codeAt(30, atMinute(29, 59)));
  assert.notEqual(codeAt(30, atMinute(29, 59)), codeAt(30, atMinute(30)));

  // the same moment is the same team on any computer: it depends on the instant and nothing else
  assert.equal(codeAt(5, new Date(atMinute(7).getTime())), codeAt(5, atMinute(7)));

  // minutes that cannot be used are 5
  [0, -3, NaN, Infinity, '5', null, undefined].forEach(value => {
    [atMinute(0), atMinute(5), atMinute(11)].forEach(now => assert.equal(codeAt(value, now), codeAt(5, now), String(value)));
  });

  // a team that is switched off takes no turn, so one team left is that team all the time
  const [prime, nova] = startingTeams();
  const novaOff = [prime, Object.assign({}, nova, { active: false })];
  [atMinute(0), atMinute(5), atMinute(10)].forEach(now => assert.equal(codeAt(5, now, novaOff), 'prime'));
  assert.deepEqual(activeTeams(novaOff).map(team => team.code), ['prime']);
  assert.deepEqual(activeTeams([]), []);
  assert.deepEqual(activeTeams(null), []);

  // three teams take turns in the order of the list
  const three = [prime, nova, { code: 'third', colors: prime.colors, active: true }];
  const run = [0, 5, 10, 15, 20, 25].map(minutes => codeAt(5, atMinute(minutes), three));
  assert.deepEqual(run.slice(0, 3).sort(), ['nova', 'prime', 'third']);
  assert.deepEqual(run.slice(3), run.slice(0, 3));
  assert.equal(three.map(team => team.code).indexOf(run[1]), (three.map(team => team.code).indexOf(run[0]) + 1) % 3);
});

test('one function says whether an item shows for a team: an empty team, or the same team', () => {
  const { showsForTeam } = teamsModule;

  assert.equal(showsForTeam({ title: '[A]' }, 'nova'), true);
  assert.equal(showsForTeam({ title: '[A]', team: '' }, 'nova'), true);
  assert.equal(showsForTeam({ title: '[A]', team: 'nova' }, 'nova'), true);
  assert.equal(showsForTeam({ title: '[A]', team: 'prime' }, 'nova'), false);
  assert.equal(showsForTeam({ title: '[A]', team: 'nova' }, 'prime'), false);
  [null, undefined, 'oops', 7].forEach(item => assert.equal(showsForTeam(item, 'nova'), true, String(item)));

  // with no code it is the team on the screen. A screen that has not chosen one is Prime
  assert.equal(showsForTeam({ team: 'prime' }), true);
  assert.equal(showsForTeam({ team: 'nova' }), false);
  onTeamScreen('nova', () => {
    assert.equal(showsForTeam({ team: 'prime' }), false);
    assert.equal(showsForTeam({ team: 'nova' }), true);
    assert.equal(showsForTeam({}), true);
  });
  assert.equal(showsForTeam({ team: 'nova' }), false, 'and the built-in team is back');
});

test('visibleItems leaves out what is for the other team as well as what is hidden or expired, and keeps the order', () => {
  const list = [
    { title: '[1]', team: 'nova' },
    { title: '[2]' },
    { title: '[3]', team: 'prime' },
    { title: '[4]', team: 'prime', show: false },
    { title: '[5]', team: '', expires: '2000-01-01T00:00' },
    { title: '[6]', team: 'prime' },
  ];

  assert.deepEqual(visibleItems(list, today).map(item => item.title), ['[2]', '[3]', '[6]']);
  onTeamScreen('nova', () => assert.deepEqual(visibleItems(list, today).map(item => item.title), ['[1]', '[2]']));
  assert.deepEqual(visibleItems(undefined), []);
});

// What a panel draws for one item that is for the team in the first place, for each kind of content that has a Team
// field. Each says whether the panel has something to draw, and a case with several panels needs every one to agree.
// The panels are the real ones, so a panel that took its items some other way, past visibleItems, would fail here.
const noon = new Date('2026-10-02T15:00:00Z'); // 11:00 in New York
const teamCases = [
  { type: 'task', shows: team => {
    const content = withDefaults({ tasks: [{ title: '[Task]', status: 'in-progress', team: team }] });
    return [live.tasksPanel.hasContent(content), live.tasksPanel.rowsFor(content, noon).length > 0, live.taskCountsPanel.hasContent(content)];
  } },
  { type: 'plan', shows: team => {
    const plan = { heading: '[Plan]', rows: [], team: team };
    return [live.tonightPanel.hasContent(withDefaults({ plan: plan })), live.tonightPanel.hasContent(withDefaults({ plan: plan, plans: [plan] }))];
  } },
  { type: 'subteam', shows: team => {
    const content = withDefaults({ subteams: [{ name: '[Subteam]', lead: '[Lead]', members: ['[Student]'], spotlight: true, spotlightHeadline: '[Headline]', team: team }] });
    return [live.spotlightPanel.hasContent(content), live.teamLeadsPanel.hasContent(content), live.rosterPanel.hasContent(content)];
  } },
  { type: 'leadership', shows: team => [live.leadershipPanel.hasContent(withDefaults({ people: [{ name: '[Person]', role: 'Mentor', team: team }] }))] },
  { type: 'sponsor', shows: team => {
    const content = withDefaults({ sponsors: [{ name: '[Sponsor]', thankYou: '[Thanks]', team: team }] });
    return [live.sponsorFeaturePanel.hasContent(content), live.sponsorLogoPanel.hasContent(content), live.tickerPanel.items(content).length > 0];
  } },
  { type: 'presentation', shows: team => {
    const talk = { id: 'presentation-a', name: '[Speaker]', topic: '[Topic]', start: new Date('2026-10-02T19:00:00Z'), minutes: 15, status: 'scheduled', team: team };
    return [live.tonightPanel.rowsFor(withDefaults({ presentations: [talk] }), noon).length > 0];
  } },
  { type: 'customPanel', shows: team => [live.customPanel.hasContent(withDefaults({ customPanels: [{ title: '[Custom]', blocks: [{ type: 'text', text: '[Text]' }], team: team }] }))] },
  { type: 'tip', shows: team => [live.tickerPanel.items(withDefaults({ tipsAndNews: [{ kind: 'tip', text: '[Tip]', team: team }] })).length > 0] },
];

test('every kind of content with a Team field leaves out the items of the other team, in every panel that draws it, and shows an item with no team in both', () => {
  assert.equal(teamCases.length, 8, 'a case for each kind of content the screen draws: no panel draws a Meeting day, and the screen does not read Events Calendar entries');

  teamCases.forEach(({ type, shows }) => {
    ['prime', 'nova'].forEach(screen => {
      onTeamScreen(screen, () => {
        const other = screen === 'prime' ? 'nova' : 'prime';

        shows(screen).forEach(answer => assert.equal(answer, true, type + ' for ' + screen + ' on the ' + screen + ' screen'));
        shows('').forEach(answer => assert.equal(answer, true, type + ' for both teams on the ' + screen + ' screen'));
        shows(undefined).forEach(answer => assert.equal(answer, true, type + ' with no team on the ' + screen + ' screen'));
        shows(other).forEach(answer => assert.equal(answer, false, type + ' for ' + other + ' on the ' + screen + ' screen'));
      });
    });
  });
});

test('the Daily Agenda panel shows the first plan that is for the team on the screen, and a talk for the other team is not listed', () => {
  const content = normalizeContent({
    plans: [
      document('plan', 'p1', { heading: '[Nova plan]', team: 'nova', rows: [{ time: '[6:00 PM]', text: '[Nova row]', lead: '' }] }),
      document('plan', 'p2', { heading: '[Both plan]', rows: [{ time: '[7:00 PM]', text: '[Both row]', lead: '' }] }),
    ],
    presentations: [
      { id: 'presentation-n', name: '[Nova speaker]', topic: '', start: '2026-10-02T19:00:00Z', status: 'scheduled', team: 'nova' },
      { id: 'presentation-p', name: '[Prime speaker]', topic: '', start: '2026-10-02T20:00:00Z', status: 'scheduled', team: 'prime' },
    ],
  }, noon);
  const lines = () => tonightPanel.rowsFor(content, noon).map(row => row.text);

  assert.deepEqual(lines(), ['[Both row]', '[Prime speaker]']);
  onTeamScreen('nova', () => assert.deepEqual(lines(), ['[Nova row]', '[Nova speaker]']));
});

test('a talk still runs at its time whichever team is on the screen: the Daily Agenda list is the only place a team leaves it out', () => {
  const talk = { id: 'presentation-n', name: '[Speaker]', topic: '', start: new Date('2026-10-02T19:00:00Z'), minutes: 15, status: 'scheduled', team: 'nova' };
  const due = () => live.presentation.dueTalk([talk], new Date('2026-10-02T19:05:00Z'), { presentationsEnabled: true, graceMinutes: 5 }, new Set());

  ['prime', 'nova'].forEach(screen => onTeamScreen(screen, () => assert.equal(due(), talk, screen)));
});

test('the shared content shows for both teams: events from BAND, photos, a tip with no team, and the countdown', () => {
  const band = [{ title: '[Band event]', start: new Date('2026-10-09T22:00:00Z'), end: new Date('2026-10-09T23:00:00Z'), allDay: false, location: '', calendarId: 'team' }];
  const photos = [{ id: 'ph1', address: 'data/sample/photo-1.svg', focus: { x: 50, y: 50 } }];
  const content = withDefaults({ photos: photos, tipsAndNews: [{ kind: 'tip', text: '[Tip]' }] });

  ['prime', 'nova'].forEach(screen => onTeamScreen(screen, () => {
    assert.deepEqual(live.events.mergeEvents(band, 'America/New_York', noon).map(event => event.title), ['[Band event]'], screen);
    assert.equal(live.photos.photosToShow(content, noon).length, 1, screen);
    assert.equal(live.tickerPanel.items(content).length, 1, screen);
  }));

  // a rule from Calendar filters has no team, and shows or hides the same for both
  const rules = [{ name: '[Rule]', action: 'hide', words: ['band'], days: [], calendar: '', fromDate: '', toDate: '' }];
  ['prime', 'nova'].forEach(screen => onTeamScreen(screen, () => {
    assert.deepEqual(live.events.mergeEvents(band, 'America/New_York', noon, rules), [], screen);
  }));
});

test('no panel judges the team itself: only the content code and the team module use showsForTeam', () => {
  const users = javascriptFilesIn(dashboardFolder)
    .filter(file => /\bshowsForTeam\b/.test(fs.readFileSync(file, 'utf8')))
    .map(file => path.relative(dashboardFolder, file).split(path.sep).join('/'))
    .sort();

  assert.deepEqual(users, ['core/content.js', 'core/teams.js']);
});

test('with no team documents the screen is the starting Prime: its colors, its name and number from the Team box, and everything with no team showing', () => {
  const { useTeams, currentTeam, teamShown, activeTeams, wantedTeam, teamPending } = teamsModule;

  ['prime', 'nova', 'alternate'].forEach(mode => {
    const content = withDefaults({ settings: { teamMode: mode } });
    assert.deepEqual(content.teams, []);

    useTeams(content, atMinute(5));
    teamsModule.changeTeamNow();
    assert.equal(wantedTeam(), live.config.primeTeam, mode);
    assert.equal(currentTeam(), live.config.primeTeam, mode);
    assert.equal(teamPending(), false, mode);
    assert.deepEqual(teamShown(content), live.config.primeTeam, mode + ': the Team box has the defaults');
  });

  // the Team box in Dashboard Settings still names the team on the screen
  const named = withDefaults({ team: { name: '[TEAM NAME]', number: '1234' } });
  teamsModule.useTeams(named, atMinute(0));
  assert.equal(teamShown(named).name, '[TEAM NAME]');
  assert.equal(teamShown(named).number, '1234');
  assert.equal(teamShown(named).shortName, 'PRIME');
  assert.equal(teamShown(named).logo, '');
  assert.deepEqual(teamShown(named).colors, live.config.primeTeam.colors);
  assert.deepEqual(teamShown(null), live.config.primeTeam, 'a screen with no content yet');

  // and with team documents the team is the document, with the Team box left to the school
  const withTeams = { teams: startingTeams(), settings: { teamMode: 'nova' }, team: { name: '[TEAM NAME]', number: '1234', school: '[SCHOOL]' } };
  onTeamScreen('nova', () => {
    teamsModule.useTeams(withTeams, atMinute(0));
    assert.equal(teamShown(withTeams).name, 'HAWKTIMUS NOVA');
    assert.equal(teamShown(withTeams).number, '3230');
    assert.equal(teamShown(withTeams).shortName, 'NOVA');
  });

  // a screen with no team documents shows the items of no team, and has none of the other team's
  assert.equal(activeTeams().length, 1);
  assert.deepEqual(visibleItems([{ title: '[1]' }, { title: '[2]', team: 'nova' }, { title: '[3]', team: 'prime' }], today).map(item => item.title), ['[1]', '[3]']);
});

test('the sample content has the two starting teams, and every style with every team and every seasonal pack can be chosen from it', () => {
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  const sample = normalizeSample(raw);

  // the same two teams as docs/seed/teams.ndjson, cleaned the same way as the editors' teams
  assert.deepEqual(sample.teams, startingTeams());
  assert.deepEqual(sample.teams.map(team => [team.code, team.number, team.mirror]), [['prime', '3229', false], ['nova', '3230', true]]);
  assert.deepEqual(Object.assign({}, sample.teams[0], { builtIn: undefined }), Object.assign({}, live.config.primeTeam, { builtIn: undefined }), 'the sample Prime is the built-in Prime');
  assert.ok(live.config.styles.includes(sample.settings.style) && live.config.teamModes.includes(sample.settings.teamMode), 'the sample settings pick a style and a team mode');
  assert.deepEqual([sample.settings.style, sample.settings.teamMode], ['original', 'prime'], 'and show Prime in the Original style, as the screen always has');

  // the sample's own rules for the seasonal packs are for packs that exist
  const sampleRules = sample.theme.schedule.filter(rule => rule.kind === 'overlay');
  assert.ok(sampleRules.length >= 2 && sampleRules.every(rule => live.theme.isKnownOverlay(rule.overlay) && /^\[.*\]$/.test(rule.name)));

  // every combination: the style from the setting, the team from Team mode and the pack from Use now, as the sample is read
  const packs = live.overlays.overlays.filter(overlay => overlay.decorations === true).map(overlay => overlay.id);
  assert.equal(packs.length, 7);
  let combinations = 0;
  live.config.styles.forEach(style => {
    ['prime', 'nova'].forEach(mode => {
      packs.forEach(pack => {
        const settings = Object.assign({}, sample.settings, { style: style, teamMode: mode });
        const theme = Object.assign({}, sample.theme, { useNow: { theme: '', overlay: pack, until: '' } });
        const team = teamsModule.chooseTeam(sample.teams, settings.teamMode, settings.alternateMinutes, today);
        const where = style + ', ' + mode + ', ' + pack;

        assert.equal(live.style.chooseStyle(settings.style, null), style, where);
        assert.deepEqual([team.code, team.mirror], [mode, mode === 'nova'], where);
        assert.equal(live.theme.resolveTheme(theme, today).overlay, pack, where);
        assert.equal(live.layout.chooseLayout(theme, null, today, style), style === 'minimal' ? 'bar' : 'standard', where);
        combinations += 1;
      });
    });
  });
  assert.equal(combinations, 42);

  // and the team goes on the screen from the sample: Nova takes its name, its number and its mirror, and Prime comes back
  const shown = mode => Object.assign({}, sample, { settings: Object.assign({}, sample.settings, { teamMode: mode }) });
  try {
    teamsModule.useTeams(shown('nova'), today);
    teamsModule.changeTeamNow();
    assert.equal(teamsModule.currentTeam().code, 'nova');
    assert.deepEqual([teamsModule.teamShown(shown('nova')).name, teamsModule.teamShown(shown('nova')).number], ['HAWKTIMUS NOVA', '3230']);
    teamsModule.useTeams(shown('prime'), today);
    teamsModule.changeTeamNow();
    assert.deepEqual([teamsModule.currentTeam().code, teamsModule.teamShown(shown('prime')).number], ['prime', '3229']);
  } finally {
    teamsModule.useTeams(withDefaults(null), today);
    teamsModule.changeTeamNow();
  }
});

// The ticker prefix of a seasonal pack (core/pack-extras.js, panels/ticker). The rule on the Look page and the
// cleaning of its text are in tools/test-themes.mjs.

// A rule for a pack that covers every day of every year
function packRule(extra) {
  return Object.assign({ name: '[Rule]', kind: 'overlay', overlay: 'christmas', startDate: '01-01', endDate: '12-31', repeatsEveryYear: true }, extra);
}

// The ticker panel draws one line into a host. onPage is the class of the html element, which is where the screen
// knows the pack from, or null for a page with no pack.
function tickerLine(line, theme, onPage) {
  let html = '';
  withFakePage(() => {
    globalThis.document.documentElement = { className: onPage || 'theme-hawktimus' };
    const content = withDefaults({ theme: theme, tipsAndNews: [{ kind: 'tip', text: '[Tip]' }] });
    live.tickerPanel.mount({ set innerHTML(markup) { html = markup; } }, Object.assign({}, content, { tickerLine: line }));
  });
  return html.slice(html.indexOf('<div class="message"'));
}

test('prefixFor keeps the prefix while the prefix, a space and the line are 52 characters or fewer, and drops the prefix and never the line when they are more', () => {
  const { prefixFor, tickerLineLimit } = live.packExtras;

  assert.equal(tickerLineLimit, 52, 'the same 52 characters the Studio allows in a tip');
  assert.equal(prefixFor('HAPPY', '[Bring a water bottle]'), 'HAPPY');
  assert.equal(prefixFor('HAPPY', 'x'.repeat(46)), 'HAPPY', '5 and 1 and 46 are 52');
  assert.equal(prefixFor('HAPPY', 'x'.repeat(47)), '', '53 is one too many');
  assert.equal(prefixFor('TWELVE CHARS', 'x'.repeat(39)), 'TWELVE CHARS', '12 and 1 and 39 are 52');
  assert.equal(prefixFor('TWELVE CHARS', 'x'.repeat(40)), '');
  assert.equal(prefixFor('HAPPY', 'x'.repeat(52)), '', 'a line that is already 52 characters has no room for a prefix');
  assert.equal(prefixFor('HAPPY', 'x'.repeat(54)), '', 'nor does a thank-you of 54');
  assert.equal(prefixFor('  HAPPY  ', '[Tip]'), 'HAPPY', 'spaces at the ends are not part of the prefix');
  assert.equal(prefixFor('A VERY LONG PREFIX', '[Tip]'), 'A VERY LONG', 'cut at 12 characters, as on the Look page');
  ['', '   ', undefined, null, 7].forEach(none => assert.equal(prefixFor(none, '[Tip]'), '', String(none)));
});

test('the ticker shows the prefix of the pack that is on the screen before the line, in its own span, with the line whole', () => {
  const theme = { schedule: [packRule({ tickerPrefix: '[PREFIX]' })] };
  const line = { kind: 'tip', text: '[Bring a water bottle]' };

  const plain = tickerLine(line, theme, null);
  assert.ok(plain.includes('data-slat="content">[Bring a water bottle]</div>'), 'no pack on the page, no prefix');
  assert.equal(plain.includes('prefix'), false);

  const withPack = tickerLine(line, theme, 'theme-hawktimus overlay-christmas');
  assert.ok(withPack.includes('data-slat="content"><span class="prefix">[PREFIX]</span> [Bring a water bottle]</div>'), withPack);

  assert.equal(tickerLine(line, theme, 'theme-hawktimus overlay-halloween').includes('prefix'), false, 'the rule is for Christmas');
  assert.equal(tickerLine(line, { schedule: [packRule({})] }, 'overlay-christmas').includes('prefix'), false, 'a rule with no prefix, and a pack with none of its own');
  assert.equal(tickerLine(line, { schedule: [] }, 'overlay-christmas').includes('prefix'), false, 'no rule at all');
  assert.equal(tickerLine(line, undefined, 'overlay-christmas').includes('prefix'), false, 'no Look document yet');
});

test('a prefix that would not fit is dropped and the line is shown whole, a thank-you gets one too, and what editors typed is escaped', () => {
  const theme = { schedule: [packRule({ tickerPrefix: 'HAPPY' })] };
  const onPage = 'overlay-christmas';
  const fits = 'x'.repeat(46);
  const toolong = 'y'.repeat(47);

  assert.ok(tickerLine({ kind: 'news', text: fits }, theme, onPage).includes('<span class="prefix">HAPPY</span> ' + fits + '</div>'));
  const dropped = tickerLine({ kind: 'news', text: toolong }, theme, onPage);
  assert.ok(dropped.includes('data-slat="content">' + toolong + '</div>'), 'the whole line, with no prefix');
  assert.equal(dropped.includes('prefix'), false);

  assert.ok(tickerLine({ kind: 'thanks', text: '[Thank you, Sponsor]' }, theme, onPage).includes('<span class="prefix">HAPPY</span> [Thank you, Sponsor]'));
  assert.ok(tickerLine({ kind: 'reminder', text: '[Meeting at 6]' }, theme, onPage).includes('<span class="prefix">HAPPY</span> [Meeting at 6]'));

  const escaped = tickerLine({ kind: 'tip', text: '<i>Tip</i> & more' }, { schedule: [packRule({ tickerPrefix: '<b>BIG</b>' })] }, onPage);
  assert.ok(escaped.includes('<span class="prefix">&lt;b&gt;BIG&lt;/b&gt;</span> &lt;i&gt;Tip&lt;/i&gt; &amp; more</div>'), escaped);
});

test('the pack file\'s own prefix is used when the rule has none, and the rule wins when it has one', () => {
  const line = { kind: 'tip', text: '[Tip]' };
  const onPage = 'overlay-christmas';

  live.packExtras.rememberDefaults('christmas', { tickerPrefix: 'OWN' });
  try {
    assert.ok(tickerLine(line, { schedule: [packRule({})] }, onPage).includes('<span class="prefix">OWN</span> [Tip]'));
    assert.ok(tickerLine(line, { schedule: [packRule({ tickerPrefix: 'TYPED' })] }, onPage).includes('<span class="prefix">TYPED</span> [Tip]'));
  } finally {
    live.packExtras.rememberDefaults('christmas', {});
  }
});

test('the ticker panel adds the prefix when it draws a line, and the list of lines has no prefix in it', () => {
  const content = withDefaults({
    tipsAndNews: [{ kind: 'tip', text: '[Tip]' }, { kind: 'news', text: '[News]' }],
    sponsors: [{ name: '[Sponsor]', thankYou: '[Thanks]' }],
    theme: { schedule: [packRule({ tickerPrefix: 'HAPPY' })] },
  });

  withFakePage(() => {
    globalThis.document.documentElement = { className: 'overlay-christmas' };
    assert.deepEqual(live.tickerPanel.items(content).map(item => item.text), ['[Tip]', '[News]', '[Thanks]'], 'the lines are as they were');
  });
  const code = fs.readFileSync(path.join(dashboardFolder, 'panels/ticker/ticker.js'), 'utf8');
  assert.ok(code.includes("import { prefixFor } from '../../core/pack-extras.js';") && code.includes("import { packExtras } from '../../core/theme.js';"));
  assert.ok(code.includes('prefixFor(packExtras(content).tickerPrefix, line.text)'));
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
