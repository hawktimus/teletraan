// Tests for the plain functions of presentation mode (dashboard/core/presentation.js):
// when a talk is due, how it goes from the title card to the thanks card, what each
// key of the clicker does, and what is remembered so that a talk does not start twice.
// Nothing is drawn and no clock runs. A test gives the functions a time and reads the
// state that comes back. The screen that draws it all is tested in tools/test-effects.mjs.
//
//   node tools/test-presentation.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-presentation-'));
fs.mkdirSync(path.join(workFolder, 'dashboard', 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'core/presentation.js', 'core/time.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(workFolder, 'dashboard', file));
});
const presentation = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/presentation.js')).href);

const {
  canRun, chipShown, dueTalk, escapeTwice, holdsScreen, idleState, keyAction, keyActions, nextState, preloadIndexes,
  pressKey, readSkipped, rememberEnded, skipKey, skippedStorageKey, slidePages, talkEnd, thanksSeconds, notReadySeconds,
} = presentation;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const second = 1000;
const minute = 60 * second;
const start = new Date('2026-10-08T19:00:00Z'); // 3:00 PM in New York

// The moment this many milliseconds after the start of the talk
const at = (offset, from = start) => new Date(from.getTime() + offset);

// Dashboard Settings as the Studio starts them
const settings = { presentationsEnabled: true, noShowMinutes: 5, graceMinutes: 5 };

// A talk as core/sanity.js hands it over
function booked(extra) {
  return Object.assign({ id: 'presentation-a1', name: 'Alex', subteam: 'Programming', topic: '[Swerve drive]', start: start, minutes: 15, status: 'scheduled' }, extra);
}

// What the screen gives nextState once a second
function inputAt(now, extra) {
  return Object.assign({ now: now, talks: [booked()], settings: settings, skipped: new Set(), announcing: false, slides: undefined }, extra);
}

// The manifest.json of a deck with five slides
const manifest = { ok: true, pages: ['001.jpg', '002.jpg', '003.jpg', '004.jpg', '005.jpg'], fetchedAt: '2026-10-08T18:00:00Z', refreshed: false };

function memoryStorage() {
  const items = {};
  return {
    items: items,
    getItem: key => (key in items ? items[key] : null),
    setItem: (key, value) => { items[key] = value; },
  };
}

// The loop of the screen (core/presentation-run.js): one state, the skipped set that lives in
// the storage, a look once a second and a press for each key. A state that is skipped or over
// is remembered as soon as it comes.
function makeScreen(parts) {
  const screen = {
    state: idleState(),
    storage: parts.storage === undefined ? memoryStorage() : parts.storage,
    talks: parts.talks || [booked()],
    settings: Object.assign({}, settings, parts.settings),
    announcing: false,
    slides: manifest,
  };
  screen.skipped = readSkipped(screen.storage);

  function move(next) {
    if (next === screen.state) return next;
    screen.state = next;
    rememberEnded(screen.storage, screen.skipped, next);
    return next;
  }

  screen.look = now => move(nextState(screen.state, {
    now: now, talks: screen.talks, settings: screen.settings, skipped: screen.skipped, announcing: screen.announcing, slides: screen.slides,
  }));
  screen.press = (key, now) => move(pressKey(screen.state, key, now));
  return screen;
}

// A screen with the talk on its first slide. Two looks come first because the slides are
// counted on the look after the title card comes up. The key is pressed two seconds in.
function presenting(parts) {
  const screen = makeScreen(parts || {});
  screen.look(at(0));
  screen.look(at(second));
  screen.press(' ', at(2 * second));
  assert.equal(screen.state.name, 'presenting');
  return screen;
}

// A screen with the title card up and the slides counted
function waitingOnTitle(parts) {
  const screen = makeScreen(parts || {});
  screen.look(at(0));
  screen.look(at(second));
  assert.equal(screen.state.name, 'title');
  assert.equal(screen.state.count, 5);
  return screen;
}

// The talk after nobody started it
function skippedScreen() {
  const screen = makeScreen({});
  screen.look(at(0));
  screen.look(at(5 * minute));
  assert.equal(screen.look(at(5 * minute + second)).name, 'idle');
  return screen;
}

const clickerKeys = {
  forward: ['PageDown', 'ArrowRight', 'ArrowDown', ' ', 'Enter', 'n', 'F5'],
  back: ['PageUp', 'ArrowLeft', 'ArrowUp', 'p'],
  black: ['b', '.'],
  home: ['Home'],
  end: ['End'],
  escape: ['Escape'],
};

test('every key of the clicker has its action, a letter counts in either case, and no other key has one', () => {
  Object.keys(clickerKeys).forEach(action => {
    clickerKeys[action].forEach(key => assert.equal(keyAction(key), action, JSON.stringify(key)));
  });
  assert.equal(Object.keys(keyActions).length, Object.values(clickerKeys).flat().length, 'the map holds these keys and no more');

  assert.equal(keyAction('N'), 'forward');
  assert.equal(keyAction('P'), 'back');
  assert.equal(keyAction('B'), 'black');
  ['a', 'Tab', 'Shift', 'Backspace', 'F4', 'PageDownn', '', 'toString', 'constructor', '__proto__', undefined, null, 5, {}].forEach(key => {
    assert.equal(keyAction(key), null, JSON.stringify(key));
  });
});

test('a talk is due at its start and not a moment before', () => {
  const talk = booked();
  assert.equal(dueTalk([talk], at(-1), settings, new Set()), null);
  assert.equal(dueTalk([talk], at(0), settings, new Set()), talk);
  assert.equal(dueTalk([talk], at(1), settings, new Set()), talk);
  assert.equal(dueTalk([booked({ start: '2026-10-08T19:00:00Z' })], at(0), settings, new Set()).id, talk.id, 'a start written as text');

  const idle = idleState();
  assert.equal(nextState(idle, inputAt(at(-1))), idle, 'the screen stays as it is, the same state');
  const title = nextState(idle, inputAt(at(0)));
  assert.equal(title.name, 'title');
  assert.equal(title.talk.id, talk.id);
  assert.equal(title.since, at(0).getTime());
});

test('a talk is due until its slot and its grace are used up, and not after', () => {
  const talk = booked();
  assert.equal(dueTalk([talk], at(20 * minute - 1), settings, new Set()), talk);
  assert.equal(dueTalk([talk], at(20 * minute), settings, new Set()), null);
  assert.equal(nextState(idleState(), inputAt(at(20 * minute))).name, 'idle');
});

test('a talk ends at its start plus its minutes plus graceMinutes, and a number that is not usable is replaced by the usual one', () => {
  const end = (talk, change) => talkEnd(booked(talk), Object.assign({}, settings, change)).toISOString();

  assert.equal(end({}, {}), '2026-10-08T19:20:00.000Z');
  assert.equal(end({}, { graceMinutes: 0 }), '2026-10-08T19:15:00.000Z');
  assert.equal(end({}, { graceMinutes: 10 }), '2026-10-08T19:25:00.000Z');
  assert.equal(end({ minutes: 30 }, { graceMinutes: 10 }), '2026-10-08T19:40:00.000Z');
  assert.equal(end({ minutes: 5 }, { graceMinutes: 2 }), '2026-10-08T19:07:00.000Z');
  assert.equal(end({ start: '2026-10-08T19:00:00Z' }, {}), '2026-10-08T19:20:00.000Z', 'a start written as text');

  [undefined, 0, -5, 'ten', NaN].forEach(minutes => assert.equal(end({ minutes: minutes }, {}), '2026-10-08T19:20:00.000Z', 'minutes ' + minutes));
  [undefined, -1, 'x', NaN, null].forEach(grace => assert.equal(end({}, { graceMinutes: grace }), '2026-10-08T19:20:00.000Z', 'grace ' + grace));
});

test('a presenting talk ends at its end on whatever slide it is on, and not a moment before', () => {
  const onSlides = talk => ({ name: 'presenting', talk: talk, count: 5, slide: 2, black: false, keyAt: null, escapedAt: null });
  const rows = [
    { talk: {}, change: {}, minutes: 20 },
    { talk: {}, change: { graceMinutes: 0 }, minutes: 15 },
    { talk: {}, change: { graceMinutes: 10 }, minutes: 25 },
    { talk: { minutes: 30 }, change: { graceMinutes: 10 }, minutes: 40 },
    { talk: { minutes: 5 }, change: { graceMinutes: 2 }, minutes: 7 },
    { talk: { minutes: undefined }, change: {}, minutes: 20 },
    { talk: {}, change: { graceMinutes: undefined }, minutes: 20 },
    { talk: {}, change: { graceMinutes: -3 }, minutes: 20 },
  ];

  rows.forEach(row => {
    const state = onSlides(booked(row.talk));
    const input = now => inputAt(now, { settings: Object.assign({}, settings, row.change) });
    const label = JSON.stringify([row.talk, row.change]);

    assert.equal(nextState(state, input(at(row.minutes * minute - 1))), state, 'just before the end ' + label);
    const ended = nextState(state, input(at(row.minutes * minute)));
    assert.equal(ended.name, 'thanks', 'at the end ' + label);
    assert.equal(ended.since, at(row.minutes * minute).getTime());
    assert.equal(ended.talk, state.talk);
  });
});

test('when two talks are due the one that started first is shown, and the other comes after it', () => {
  const alex = booked({ id: 'presentation-a', name: 'Alex' });
  const sam = booked({ id: 'presentation-b', name: 'Sam', start: at(15 * minute) });

  assert.equal(dueTalk([sam, alex], at(14 * minute), settings, new Set()), alex);
  assert.equal(dueTalk([sam, alex], at(16 * minute), settings, new Set()), alex, 'both are due, whatever the order of the list');
  assert.equal(dueTalk([alex, sam], at(16 * minute), settings, new Set()), alex);
  assert.equal(dueTalk([alex, sam], at(16 * minute), settings, new Set([skipKey(alex)])), sam);
  assert.equal(dueTalk([alex, sam], at(21 * minute), settings, new Set()), sam, 'the first is over');
});

test('a cancelled, done or skipped talk, a draft, and a talk with no start never start', () => {
  const never = [
    booked({ status: 'cancelled' }),
    booked({ status: 'done' }),
    booked({ status: 'skipped' }),
    booked({ status: 'later' }),
    booked({ status: undefined }),
    booked({ id: 'drafts.presentation-a1' }),
    booked({ id: undefined }),
    booked({ start: new Date('soon') }),
    booked({ start: undefined }),
    booked({ start: '' }),
    null,
    'oops',
    [],
    7,
  ];

  never.forEach(talk => assert.equal(canRun(talk), false, JSON.stringify(talk)));
  assert.equal(canRun(booked()), true);

  for (let minutes = 0; minutes <= 25; minutes++) {
    assert.equal(dueTalk(never, at(minutes * minute), settings, new Set()), null, 'at minute ' + minutes);
    assert.equal(nextState(idleState(), inputAt(at(minutes * minute), { talks: never })).name, 'idle', 'at minute ' + minutes);
  }

  const ok = booked({ id: 'presentation-ok' });
  assert.equal(dueTalk(never.concat([ok]), at(minute), settings, new Set()), ok, 'a talk that can run among them still starts');
  assert.equal(dueTalk(undefined, at(minute), settings, new Set()), null);
  assert.equal(dueTalk('talks', at(minute), settings, new Set()), null);
});

test('with Run presentations off nothing starts, and a talk on the screen ends at once', () => {
  const off = Object.assign({}, settings, { presentationsEnabled: false });
  assert.equal(dueTalk([booked()], at(minute), off, new Set()), null);

  const idle = idleState();
  assert.equal(nextState(idle, inputAt(at(minute), { settings: off })), idle);

  const title = waitingOnTitle().state;
  const slides = presenting().state;
  const thanks = nextState(slides, inputAt(at(20 * minute)));
  assert.equal(thanks.name, 'thanks');
  [title, slides, thanks].forEach(state => {
    assert.equal(nextState(state, inputAt(at(3 * minute), { settings: off })).name, 'idle', state.name);
  });

  // a setting that is missing counts as on
  assert.equal(dueTalk([booked()], at(minute), {}, new Set()).id, 'presentation-a1');
});

test('a title card waits while an announcement or an alert has the screen, then comes up and starts its wait from there', () => {
  const screen = makeScreen({});
  screen.announcing = true;
  const idle = screen.state;

  assert.equal(screen.look(at(0)), idle, 'the talk is due and the announcement plays');
  assert.equal(screen.look(at(3 * minute)), idle);

  screen.announcing = false;
  const title = screen.look(at(3 * minute + second));
  assert.equal(title.name, 'title');
  assert.equal(title.since, at(3 * minute + second).getTime(), 'the wait for the speaker runs from the moment the card appears');
  assert.equal(screen.look(at(8 * minute)).name, 'title', 'five minutes after the start, but not after the card');
  assert.equal(screen.look(at(8 * minute + second)).name, 'skipped');
});

test('an announcement that lasts past the end of the slot leaves no talk to start', () => {
  const screen = makeScreen({});
  screen.announcing = true;
  screen.look(at(19 * minute + 59 * second));
  screen.announcing = false;
  assert.equal(screen.look(at(20 * minute)).name, 'idle');
  assert.equal(screen.look(at(21 * minute)).name, 'idle');
});

test('the title card is a copy of the talk, so a later edit in Studio does not change it', () => {
  const talk = booked({ deckLink: 'https://docs.google.com/presentation/d/1AbC-d_Ef' });
  const title = nextState(idleState(), inputAt(at(0), { talks: [talk] }));

  talk.topic = '[Edited topic]';
  talk.name = 'Kim';
  talk.start = at(10 * minute);
  talk.minutes = 5;
  talk.subteam = 'Design';

  assert.deepEqual(
    [title.talk.id, title.talk.name, title.talk.subteam, title.talk.topic, title.talk.start.getTime(), title.talk.minutes, title.talk.deckLink],
    ['presentation-a1', 'Alex', 'Programming', '[Swerve drive]', start.getTime(), 15, 'https://docs.google.com/presentation/d/1AbC-d_Ef'],
  );

  const later = nextState(title, inputAt(at(second), { talks: [talk], slides: manifest }));
  assert.equal(later.talk.topic, '[Swerve drive]');
  assert.equal(later.talk.start.getTime(), start.getTime());
});

test('a talk that nobody starts is skipped after noShowMinutes, and stays skipped when the page loads again', () => {
  const screen = makeScreen({});
  screen.look(at(0));
  assert.equal(screen.state.name, 'title');
  assert.equal(screen.state.since, start.getTime());

  assert.equal(screen.look(at(5 * minute - 1)).name, 'title', 'one millisecond short of five minutes');
  assert.equal(screen.look(at(5 * minute)).name, 'skipped');
  assert.equal(screen.state.reason, 'no-show');
  assert.equal(screen.skipped.size, 1);
  assert.equal(screen.look(at(5 * minute + second)).name, 'idle', 'a skip lasts one look');
  assert.equal(screen.look(at(8 * minute)).name, 'idle', 'the slot is not over, and the talk does not come back');

  const reloaded = makeScreen({ storage: screen.storage });
  assert.equal(reloaded.skipped.size, 1);
  assert.equal(reloaded.look(at(8 * minute)).name, 'idle', 'the page loaded again and remembered');

  const forgetful = makeScreen({});
  assert.equal(forgetful.look(at(8 * minute)).name, 'title', 'with nothing remembered the same talk would start');
});

test('noShowMinutes decides how long the card waits, and a number that is not usable is five minutes', () => {
  const skippedAfter = noShow => {
    const screen = makeScreen({ settings: { noShowMinutes: noShow } });
    screen.look(at(0));
    for (let seconds = 1; seconds <= 20 * 60; seconds++) {
      if (screen.look(at(seconds * second)).name === 'skipped') return seconds;
    }
    return null;
  };

  assert.equal(skippedAfter(1), 60);
  assert.equal(skippedAfter(2), 120);
  assert.equal(skippedAfter(10), 600);
  [undefined, null, -1, 'soon', NaN].forEach(value => assert.equal(skippedAfter(value), 300, String(value)));
});

test('a title card is skipped when the slot is over, if that comes before the wait does', () => {
  const short = { settings: { noShowMinutes: 15, graceMinutes: 0 }, talks: [booked({ minutes: 5 })] };
  const screen = makeScreen(short);
  screen.look(at(0));
  assert.equal(screen.look(at(5 * minute - 1)).name, 'title');
  assert.equal(screen.look(at(5 * minute)).name, 'skipped');
  assert.equal(screen.state.reason, 'no-show');

  // a page that loads late: the wait starts when the card comes up, and the slot ends at 3:20
  const late = makeScreen({});
  late.look(at(18 * minute));
  assert.equal(late.state.name, 'title');
  assert.equal(late.look(at(20 * minute - 1)).name, 'title');
  assert.equal(late.look(at(20 * minute)).name, 'skipped');
});

test('a talk that is moved in Studio is a new talk, so a skipped one can run again', () => {
  const unchanged = skippedScreen();
  assert.equal(unchanged.look(at(10 * minute)).name, 'idle', 'the same talk at the same start');

  const moved = skippedScreen();
  moved.talks = [booked({ start: at(10 * minute) })];
  assert.equal(moved.look(at(10 * minute - 1)).name, 'idle', 'not before the new start');
  const again = moved.look(at(10 * minute));
  assert.equal(again.name, 'title');
  assert.equal(again.talk.start.getTime(), at(10 * minute).getTime());

  const retitled = skippedScreen();
  retitled.talks = [booked({ topic: '[A new title]', name: 'Kim', minutes: 20 })];
  assert.equal(retitled.look(at(10 * minute)).name, 'idle', 'only the start makes it a new talk');

  const other = skippedScreen();
  other.talks = [booked({ id: 'presentation-b1' })];
  assert.equal(other.look(at(10 * minute)).name, 'title', 'another talk at the same start was never skipped');

  assert.notEqual(skipKey(booked()), skipKey(booked({ start: at(minute) })));
  assert.notEqual(skipKey(booked()), skipKey(booked({ id: 'presentation-b1' })));
  assert.equal(skipKey(booked()), skipKey(booked({ start: new Date(start.getTime()) })));
  assert.equal(skipKey(booked()), skipKey(booked({ start: '2026-10-08T19:00:00Z' })));
});

test('slides that are not ready show for sixty seconds, a forward key does nothing meanwhile, and then the talk is skipped', () => {
  [null, { ok: false, error: 'not shared', fetchedAt: '2026-10-08T18:00:00Z' }, { ok: true, pages: [] }].forEach(missing => {
    const screen = makeScreen({});
    screen.slides = missing;

    screen.look(at(0));
    assert.equal(screen.state.notReadyAt, null);
    screen.look(at(second));
    assert.equal(screen.state.notReadyAt, at(second).getTime(), 'the minute runs from the first look at the missing slides');

    const waiting = screen.state;
    assert.equal(screen.press(' ', at(2 * second)), waiting, 'the forward key does nothing');
    assert.equal(screen.press('Enter', at(3 * second)), waiting);
    assert.equal(screen.look(at(second + notReadySeconds * second - 1)), waiting);

    assert.equal(screen.look(at(second + notReadySeconds * second)).name, 'skipped');
    assert.equal(screen.state.reason, 'not-ready');
    assert.equal(screen.look(at(2 * minute)).name, 'idle');
    assert.equal(screen.look(at(3 * minute)).name, 'idle', 'it does not start again');
  });

  // the slides were counted, and then the manifest went missing
  const stale = { name: 'title', talk: booked(), since: 0, count: 5, notReadyAt: second, escapedAt: null };
  assert.equal(pressKey(stale, ' ', at(2 * second)), stale, 'a card that says the slides are not ready does not start the talk');

  assert.equal(notReadySeconds, 60);
});

test('slidePages gives the pictures of a manifest that is ok and nothing for any other', () => {
  assert.deepEqual(slidePages(manifest), manifest.pages);
  assert.deepEqual(slidePages({ ok: true, pages: ['001.jpg', '', 7, null, '002.jpg'] }), ['001.jpg', '002.jpg']);

  [undefined, null, 'text', 7, [], {}, { ok: false, pages: ['001.jpg'] }, { ok: 'true', pages: ['001.jpg'] }, { ok: true }, { ok: true, pages: '001.jpg' }, { ok: true, pages: [] }].forEach(value => {
    assert.deepEqual(slidePages(value), [], JSON.stringify(value));
  });
});

test('on the title card the first forward key starts the talk once the slides are counted, and no other key does', () => {
  const early = makeScreen({});
  early.slides = undefined;
  early.look(at(0));
  const nothingYet = early.state;
  assert.equal(early.press(' ', at(second)), nothingYet, 'the manifest has not been read, so there is nothing to show');

  clickerKeys.forward.forEach(key => {
    const screen = waitingOnTitle();
    const title = screen.state;
    const started = screen.press(key, at(3 * second));

    assert.equal(started.name, 'presenting', JSON.stringify(key));
    assert.deepEqual([started.slide, started.count, started.black, started.keyAt], [0, 5, false, at(3 * second).getTime()]);
    assert.equal(started.talk, title.talk);
  });

  const screen = waitingOnTitle();
  const title = screen.state;
  ['ArrowLeft', 'PageUp', 'p', 'Home', 'End', 'b', '.', 'Tab', 'x'].forEach(key => {
    assert.equal(screen.press(key, at(3 * second)), title, JSON.stringify(key));
  });
});

test('Esc once on the title card does nothing, and twice within two seconds skips the talk for good', () => {
  const screen = waitingOnTitle();
  const first = screen.press('Escape', at(10 * second));
  assert.equal(first.name, 'title');
  assert.equal(first.escapedAt, at(10 * second).getTime());

  const late = screen.press('Escape', at(12 * second + 1));
  assert.equal(late.name, 'title', 'more than two seconds after the first');
  assert.equal(late.escapedAt, at(12 * second + 1).getTime());

  const ended = screen.press('Escape', at(14 * second));
  assert.equal(ended.name, 'skipped');
  assert.equal(ended.reason, 'ended');
  assert.equal(screen.skipped.size, 1);

  assert.equal(screen.look(at(15 * second)).name, 'idle');
  assert.equal(screen.look(at(3 * minute)).name, 'idle', 'the talk does not come back');
});

test('on the slides forward goes on, back goes before, home and end jump, and none goes past the first or the last', () => {
  const screen = presenting();
  let seconds = 2;
  const press = key => screen.press(key, at(++seconds * second));
  const slide = () => screen.state.slide;

  assert.equal(slide(), 0);
  press('ArrowRight');
  press('n');
  assert.equal(slide(), 2);
  press('PageUp');
  assert.equal(slide(), 1);

  press('Home');
  assert.equal(slide(), 0);
  press('ArrowUp');
  press('p');
  assert.equal(slide(), 0, 'back stops at the first slide');
  press('End');
  assert.equal(slide(), 4);
  assert.equal(screen.state.count, 5);
  press('ArrowLeft');
  assert.equal(slide(), 3);
  press('PageDown');
  assert.equal(slide(), 4);
  press('End');
  assert.equal(slide(), 4, 'end on the last slide stays');

  assert.equal(screen.state.keyAt, at(seconds * second).getTime(), 'every key counts as a press, for the chip');

  const done = press('Enter');
  assert.equal(done.name, 'thanks', 'forward on the last slide gives the thanks card');
  assert.equal(done.since, at(seconds * second).getTime());
  assert.equal(screen.skipped.size, 1);
});

test('the black screen comes and goes with b and the full stop, and any key that moves turns it off', () => {
  const screen = presenting();
  let seconds = 2;
  const press = key => screen.press(key, at(++seconds * second));

  assert.equal(press('b').black, true);
  assert.equal(screen.state.slide, 0, 'black does not move the slide');
  assert.equal(press('B').black, false);
  assert.equal(press('.').black, true);
  assert.equal(press('.').black, false);

  ['PageDown', 'ArrowLeft', 'Home', 'End'].forEach(key => {
    assert.equal(press('b').black, true);
    const moved = press(key);
    assert.equal(moved.black, false, key);
    assert.equal(moved.name, 'presenting');
  });

  press('End');
  press('b');
  assert.equal(press('PageDown').name, 'thanks', 'forward from a black last slide still ends the talk');
});

test('Esc once on the slides does nothing, and twice within two seconds ends the talk', () => {
  assert.equal(escapeTwice(null, 5000), false);
  assert.equal(escapeTwice(1000, 2000), true);
  assert.equal(escapeTwice(1000, 3000), true, 'two seconds exactly');
  assert.equal(escapeTwice(1000, 3001), false);

  const screen = presenting();
  const first = screen.press('Escape', at(10 * second));
  assert.equal(first.name, 'presenting');
  assert.equal(first.slide, 0);
  assert.equal(first.escapedAt, at(10 * second).getTime());

  const late = screen.press('Escape', at(12 * second + 1));
  assert.equal(late.name, 'presenting', 'the first one was more than two seconds ago');

  const ended = screen.press('Escape', at(13 * second));
  assert.equal(ended.name, 'thanks');
  assert.equal(ended.since, at(13 * second).getTime());
  assert.equal(screen.skipped.size, 1);

  assert.equal(screen.look(at(13 * second + thanksSeconds * second - 1)).name, 'thanks');
  assert.equal(screen.look(at(13 * second + thanksSeconds * second)).name, 'idle', 'the thanks card lasts five seconds');
  assert.equal(screen.look(at(5 * minute)).name, 'idle', 'a talk that was ended early does not start again inside its slot');
});

test('a talk that overruns is ended at its own end, and then the next title card shows', () => {
  const alex = booked({ id: 'presentation-a', name: 'Alex' });
  const sam = booked({ id: 'presentation-b', name: 'Sam', start: at(15 * minute) });
  const screen = makeScreen({ talks: [sam, alex] });

  screen.look(at(0));
  screen.look(at(second));
  screen.press(' ', at(2 * second));
  assert.equal(screen.state.talk.name, 'Alex');

  const slides = screen.state;
  assert.equal(screen.look(at(15 * minute)), slides, 'the next talk is due and has to wait');
  assert.equal(screen.look(at(20 * minute - 1)), slides);

  const thanks = screen.look(at(20 * minute));
  assert.equal(thanks.name, 'thanks');
  assert.equal(thanks.talk.name, 'Alex');
  assert.equal(screen.look(at(20 * minute + thanksSeconds * second - 1)), thanks);
  assert.equal(screen.look(at(20 * minute + thanksSeconds * second)).name, 'idle');

  const next = screen.look(at(20 * minute + thanksSeconds * second + second));
  assert.equal(next.name, 'title');
  assert.equal(next.talk.name, 'Sam');
  assert.equal(next.since, at(20 * minute + thanksSeconds * second + second).getTime());
});

test('keys do nothing when no talk is on its title card or its slides', () => {
  const states = [
    idleState(),
    { name: 'thanks', talk: booked(), since: 0 },
    { name: 'skipped', talk: booked(), reason: 'no-show' },
  ];
  states.forEach(state => {
    Object.values(clickerKeys).flat().forEach(key => {
      assert.equal(pressKey(state, key, at(second)), state, state.name + ' ' + JSON.stringify(key));
    });
  });

  const slides = presenting().state;
  ['Tab', 'x', 'a', 'Shift', '', undefined, 'toString'].forEach(key => {
    assert.equal(pressKey(slides, key, at(second)), slides, JSON.stringify(key));
  });
});

test('every state but idle holds the screen, and a state the screen does not know goes back to idle', () => {
  assert.equal(holdsScreen(idleState()), false);
  ['title', 'presenting', 'thanks', 'skipped'].forEach(name => assert.equal(holdsScreen({ name: name }), true, name));
  assert.equal(nextState({ name: 'unknown' }, inputAt(at(0))).name, 'idle');
});

test('the thanks card lasts five seconds, then the screen is given back', () => {
  const thanks = { name: 'thanks', talk: booked(), since: at(0).getTime() };
  assert.equal(thanksSeconds, 5);
  assert.equal(nextState(thanks, inputAt(at(5 * second - 1))), thanks);
  assert.equal(nextState(thanks, inputAt(at(5 * second))).name, 'idle');
});

test('the skipped set is saved after a talk is skipped or over, read back when the page loads, and kept to the last 100', () => {
  const storage = memoryStorage();
  const skipped = new Set();
  const talk = booked();

  ['idle', 'title', 'presenting'].forEach(name => {
    assert.equal(rememberEnded(storage, skipped, { name: name, talk: talk }), false, name);
  });
  assert.equal(skipped.size, 0);
  assert.equal(storage.items[skippedStorageKey], undefined, 'nothing is saved for a talk that is still going');

  assert.equal(rememberEnded(storage, skipped, { name: 'skipped', talk: talk }), true);
  assert.equal(rememberEnded(storage, skipped, { name: 'skipped', talk: talk }), false, 'it is in the set already');
  const other = booked({ id: 'presentation-b1' });
  assert.equal(rememberEnded(storage, skipped, { name: 'thanks', talk: other }), true);

  assert.deepEqual(JSON.parse(storage.items[skippedStorageKey]), [skipKey(talk), skipKey(other)]);
  assert.deepEqual(readSkipped(storage), skipped);

  const many = new Set();
  const full = memoryStorage();
  for (let place = 0; place < 130; place++) {
    rememberEnded(full, many, { name: 'skipped', talk: booked({ id: 'presentation-' + place }) });
  }
  const saved = JSON.parse(full.items[skippedStorageKey]);
  assert.equal(saved.length, 100);
  assert.equal(saved[0], skipKey(booked({ id: 'presentation-30' })));
  assert.equal(saved[99], skipKey(booked({ id: 'presentation-129' })));
  assert.equal(many.size, 130, 'the set in memory keeps every one');
});

test('what is in the storage is read with care: text that is not a list, or not text, gives an empty set', () => {
  const holding = value => ({ getItem: () => value, setItem: () => {} });

  ['not json', '{"a":1}', '"text"', '5', 'null', '', null].forEach(value => {
    assert.deepEqual(readSkipped(holding(value)), new Set(), JSON.stringify(value));
  });
  assert.deepEqual(readSkipped(holding('[1, null, "kept", {}]')), new Set(['kept']));
});

test('storage that cannot be read or written still keeps a skipped talk skipped while the page is open', () => {
  const broken = {
    getItem() { throw new Error('storage is off'); },
    setItem() { throw new Error('storage is full'); },
  };
  assert.deepEqual(readSkipped(broken), new Set());
  assert.deepEqual(readSkipped(null), new Set());

  [broken, null].forEach(storage => {
    const screen = makeScreen({ storage: storage });
    screen.look(at(0));
    screen.look(at(second));
    screen.press('Escape', at(2 * second));
    assert.equal(screen.press('Escape', at(3 * second)).name, 'skipped');
    assert.equal(screen.skipped.size, 1, 'kept in memory');

    assert.equal(screen.look(at(4 * second)).name, 'idle');
    assert.equal(screen.look(at(2 * minute)).name, 'idle');
  });

  const set = new Set();
  assert.equal(rememberEnded(broken, set, { name: 'skipped', talk: booked() }), false, 'it says the save failed');
  assert.equal(set.size, 1);
});

test('the slide number chip shows for three seconds after a key, and the slides to decode are the next three', () => {
  const state = { name: 'presenting', talk: booked(), count: 24, slide: 6, black: false, keyAt: at(0).getTime(), escapedAt: null };

  assert.equal(chipShown(state, at(0)), true);
  assert.equal(chipShown(state, at(3 * second - 1)), true);
  assert.equal(chipShown(state, at(3 * second)), false);
  assert.equal(chipShown(Object.assign({}, state, { keyAt: null }), at(0)), false);
  assert.equal(chipShown({ name: 'title', keyAt: at(0).getTime() }, at(0)), false);

  const decode = (name, count, slide) => preloadIndexes({ name: name, count: count, slide: slide });
  assert.deepEqual(decode('title', 5), [0, 1, 2]);
  assert.deepEqual(decode('title', 2), [0, 1]);
  assert.deepEqual(decode('title', 0), []);
  assert.deepEqual(decode('presenting', 5, 0), [1, 2, 3]);
  assert.deepEqual(decode('presenting', 24, 6), [7, 8, 9]);
  assert.deepEqual(decode('presenting', 5, 3), [4]);
  assert.deepEqual(decode('presenting', 5, 4), []);
  ['idle', 'thanks', 'skipped'].forEach(name => assert.deepEqual(decode(name, 5, 0), [], name));
});

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
