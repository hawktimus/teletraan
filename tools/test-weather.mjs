// Tests for core/weather.js and core/weather-icons.js, using a pretend network,
// clock and storage. Run them with:  node tools/test-weather.mjs

import assert from 'node:assert/strict';
import { startWeather, describeWeather, parseForecast } from '../dashboard/core/weather.js';
import { weatherIcon } from '../dashboard/core/weather-icons.js';

const place = { latitude: 35.6513, longitude: -78.8336 };
const startTime = Date.UTC(2026, 9, 2, 12, 0);
const minute = 60 * 1000;
const hour = 60 * minute;

// The answer from Open-Meteo, in the shape the real service sends
function answer(values = {}) {
  const numbers = Object.assign({ temperature: 83.4, high: 89.8, low: 64.0, code: 3, isDay: 1 }, values);
  return {
    latitude: 35.64329,
    longitude: -78.84406,
    utc_offset_seconds: -14400,
    timezone: 'America/New_York',
    current: {
      time: '2026-10-02T19:00',
      interval: 900,
      temperature_2m: numbers.temperature,
      weather_code: numbers.code,
      is_day: numbers.isDay,
    },
    daily: {
      time: ['2026-10-02'],
      temperature_2m_max: [numbers.high],
      temperature_2m_min: [numbers.low],
    },
  };
}

// What fetch gives back when the service answers
function reply(data, status = 200) {
  return { ok: status >= 200 && status < 300, status: status, json: async () => data };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

// A clock, a network, a storage and a timer list that the test controls
function pretendWorld() {
  const world = {
    time: startTime,
    urls: [],
    stored: {},
    timers: [],
    timeouts: [],
    sent: [],
    answerWith: async () => reply(answer()),
  };

  // answerWith gets the signal that the request would be stopped with
  world.parts = {
    fetch: async (url, signal) => {
      world.urls.push(url);
      return world.answerWith(signal);
    },
    storage: {
      getItem: key => (key in world.stored ? world.stored[key] : null),
      setItem: (key, value) => { world.stored[key] = value; },
    },
    now: () => world.time,
    setTimeout: (action, milliseconds) => {
      world.timeouts.push({ action: action, milliseconds: milliseconds, cleared: false });
      return world.timeouts.length - 1;
    },
    clearTimeout: id => { world.timeouts[id].cleared = true; },
    setInterval: (action, milliseconds) => {
      world.timers.push({ action: action, milliseconds: milliseconds, stopped: false });
      return world.timers.length - 1;
    },
    clearInterval: id => { world.timers[id].stopped = true; },
  };

  // starts the weather and waits for the first network answer
  world.start = async function (changes = {}) {
    const stop = startWeather(place, weather => world.sent.push(weather), Object.assign({}, world.parts, changes));
    await flush();
    return stop;
  };

  // the 15 minute timer goes off, this much time later
  world.tick = async function (later) {
    world.time += later;
    await world.timers[0].action();
  };

  return world;
}

function savedText(values = {}) {
  return JSON.stringify(Object.assign({
    temperature: 70, high: 75, low: 55, code: 61, isDay: true, savedAt: startTime,
  }, values));
}

// Failed refreshes are logged. The tests that expect that look in here.
let logged = [];

const tests = [];
function test(name, body) {
  tests.push({ name: name, body: body });
}

// describeWeather

test('describeWeather names each range of weather codes', () => {
  const ranges = [
    [[0], 'CLEAR', 'clear'],
    [[1], 'MOSTLY CLEAR', 'clear'],
    [[2], 'PARTLY CLOUDY', 'partly-cloudy'],
    [[3], 'CLOUDY', 'cloudy'],
    [[45, 48], 'FOG', 'fog'],
    [[51, 52, 53, 54, 55, 56, 57], 'DRIZZLE', 'drizzle'],
    [[61, 62, 63, 64, 65, 66, 67], 'RAIN', 'rain'],
    [[71, 72, 73, 74, 75, 76, 77], 'SNOW', 'snow'],
    [[80, 81, 82], 'SHOWERS', 'rain'],
    [[85, 86], 'SNOW SHOWERS', 'snow'],
    [[95, 96, 97, 98, 99], 'STORM', 'storm'],
  ];

  ranges.forEach(([codes, condition, icon]) => {
    codes.forEach(code => {
      assert.deepEqual(describeWeather(code), { condition: condition, icon: icon }, 'code ' + code);
    });
  });
});

test('describeWeather gives a plain cloud for a code it does not know', () => {
  [4, 44, 46, 47, 49, 58, 60, 70, 78, 83, 84, 87, 94, 100, -1, 2.5, NaN, null, undefined, '61', {}].forEach(code => {
    assert.deepEqual(describeWeather(code), { condition: 'UNKNOWN', icon: 'cloudy' }, String(code));
  });
});

// parseForecast

test('parseForecast reads the real answer', () => {
  assert.deepEqual(parseForecast(answer({ isDay: 0, code: 0 })), {
    temperature: 83, high: 90, low: 64, code: 0, isDay: false,
  });
  assert.equal(parseForecast(answer({ isDay: 1, code: 61 })).isDay, true);
});

test('parseForecast rounds to whole degrees and never gives minus zero', () => {
  const reading = parseForecast(answer({ temperature: 72.5, high: -12.6, low: -0.4 }));
  assert.equal(reading.temperature, 73);
  assert.equal(reading.high, -13);
  assert.equal(reading.low, 0);
});

test('parseForecast gives null for an answer that is not in the expected shape', () => {
  const noDaily = answer();
  delete noDaily.daily;
  const noCurrent = answer();
  delete noCurrent.current;
  const emptyLists = answer();
  emptyLists.daily.temperature_2m_max = [];

  [null, undefined, 'text', 42, [], {}, noDaily, noCurrent, emptyLists,
    answer({ temperature: null }),
    answer({ temperature: '83.4' }),
    answer({ high: null }),
    answer({ low: undefined }),
    answer({ code: null }),
    answer({ temperature: NaN }),
    answer({ temperature: Infinity }),
  ].forEach(bad => {
    assert.equal(parseForecast(bad), null, JSON.stringify(bad));
  });
});

// startWeather

test('startWeather asks Open-Meteo for the right place and values', async () => {
  const world = pretendWorld();
  await world.start();

  assert.equal(world.urls.length, 1);
  assert.equal(world.urls[0],
    'https://api.open-meteo.com/v1/forecast?latitude=35.6513&longitude=-78.8336' +
    '&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min' +
    '&temperature_unit=fahrenheit&timezone=auto&forecast_days=1');
});

test('startWeather hands over the first reading from the network', async () => {
  const world = pretendWorld();
  await world.start();

  assert.equal(world.sent.length, 1);
  assert.deepEqual(world.sent[0], {
    temperature: 83,
    high: 90,
    low: 64,
    code: 3,
    isDay: true,
    condition: 'CLOUDY',
    updated: new Date(startTime),
    ageMinutes: 0,
  });
});

test('startWeather hands over a saved reading at once, before the network answers', () => {
  const world = pretendWorld();
  world.stored['teletraan-weather'] = savedText({ savedAt: startTime - 20 * minute });
  world.time = startTime;
  world.answerWith = () => new Promise(() => {}); // never answers

  startWeather(place, weather => world.sent.push(weather), world.parts);

  assert.equal(world.sent.length, 1);
  assert.equal(world.sent[0].temperature, 70);
  assert.equal(world.sent[0].condition, 'RAIN');
  assert.equal(world.sent[0].ageMinutes, 20);
  assert.deepEqual(world.sent[0].updated, new Date(startTime - 20 * minute));
});

test('startWeather saves every good reading', async () => {
  const world = pretendWorld();
  await world.start();

  const saved = JSON.parse(world.stored['teletraan-weather']);
  assert.deepEqual(saved, { temperature: 83, high: 90, low: 64, code: 3, isDay: true, savedAt: startTime });
});

test('startWeather refreshes every 15 minutes and checks the age of the reading every minute', async () => {
  const world = pretendWorld();
  await world.start();

  assert.equal(world.timers.length, 2);
  assert.equal(world.timers[0].milliseconds, 15 * minute);
  assert.equal(world.timers[1].milliseconds, minute);

  world.answerWith = async () => reply(answer({ temperature: 90.2, code: 95 }));
  await world.tick(15 * minute);

  assert.equal(world.urls.length, 2);
  assert.equal(world.sent.length, 2);
  assert.equal(world.sent[1].temperature, 90);
  assert.equal(world.sent[1].condition, 'STORM');
  assert.equal(world.sent[1].ageMinutes, 0);
  assert.deepEqual(world.sent[1].updated, new Date(startTime + 15 * minute));
});

test('startWeather keeps the last reading when a refresh fails', async () => {
  const failures = [
    ['the network is down', async () => { throw new Error('offline'); }],
    ['the service is down', async () => reply({}, 503)],
    ['the answer is not JSON', async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad JSON'); } })],
    ['the answer has the wrong shape', async () => reply({ hello: 'world' })],
  ];

  for (const [why, failure] of failures) {
    logged = [];
    const world = pretendWorld();
    await world.start();

    world.answerWith = failure;
    await world.tick(15 * minute);

    assert.equal(world.sent.length, 2, why);
    assert.equal(world.sent[1].temperature, 83, why);
    assert.equal(world.sent[1].ageMinutes, 15, why);
    assert.deepEqual(world.sent[1].updated, new Date(startTime), why);
    assert.equal(logged.length, 1, why);
    assert.equal(JSON.parse(world.stored['teletraan-weather']).savedAt, startTime, why);
  }
});

test('startWeather says nothing when there has never been a reading', async () => {
  logged = [];
  const world = pretendWorld();
  world.answerWith = async () => { throw new Error('offline'); };
  await world.start();
  await world.tick(15 * minute);
  await world.tick(15 * minute);

  assert.equal(world.sent.length, 0);
  assert.equal(logged.length, 3);
  assert.deepEqual(world.stored, {});
});

test('startWeather gives up on a request that has not answered after 15 seconds', async () => {
  logged = [];
  const world = pretendWorld();
  world.answerWith = signal => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('The request was aborted')));
  });
  await world.start();

  assert.equal(world.timeouts.length, 1);
  assert.equal(world.timeouts[0].milliseconds, 15 * 1000);
  assert.equal(world.timeouts[0].cleared, false);
  assert.equal(logged.length, 0);

  world.timeouts[0].action();
  await flush();
  assert.equal(logged.length, 1);
  assert.equal(world.timeouts[0].cleared, true);
  assert.equal(world.sent.length, 0);

  world.answerWith = async () => reply(answer());
  await world.tick(15 * minute);
  assert.equal(world.sent.length, 1);
  assert.equal(world.sent[0].temperature, 83);
});

test('startWeather stops the 15 second timer when the answer comes in time, and when it is wrong', async () => {
  const world = pretendWorld();
  await world.start();
  assert.equal(world.timeouts.length, 1);
  assert.equal(world.timeouts[0].cleared, true);

  world.answerWith = async () => reply({}, 503);
  await world.tick(15 * minute);
  assert.equal(world.timeouts.length, 2);
  assert.equal(world.timeouts[1].cleared, true);
});

test('startWeather drops a reading older than 3 hours on its minute timer, even when refreshes hang', async () => {
  const world = pretendWorld();
  await world.start();
  assert.equal(world.sent.length, 1);

  world.answerWith = () => new Promise(() => {}); // refreshes never answer
  const check = world.timers[1].action;

  world.time = startTime + 2 * hour;
  check();
  assert.equal(world.sent.length, 1, 'a reading under 3 hours old is left alone');

  world.time = startTime + 3 * hour;
  check();
  assert.equal(world.sent.length, 1, 'exactly 3 hours old is still shown');

  world.time = startTime + 3 * hour + minute;
  check();
  assert.equal(world.sent.length, 2);
  assert.equal(world.sent[1], null);

  world.time += minute;
  check();
  assert.equal(world.sent.length, 2, 'null is sent once, not every minute');
});

test('startWeather treats a reading older than 3 hours as no reading', async () => {
  logged = [];
  const world = pretendWorld();
  await world.start();

  world.answerWith = async () => { throw new Error('offline'); };
  await world.tick(3 * hour);
  assert.equal(world.sent.length, 2);
  assert.equal(world.sent[1].ageMinutes, 180, 'exactly 3 hours old is still shown');

  await world.tick(1 * minute);
  assert.equal(world.sent.length, 3);
  assert.equal(world.sent[2], null);

  await world.tick(15 * minute);
  assert.equal(world.sent.length, 3, 'null is sent once, not every time');

  world.answerWith = async () => reply(answer({ temperature: 61.6 }));
  await world.tick(15 * minute);
  assert.equal(world.sent.length, 4);
  assert.equal(world.sent[3].temperature, 62);
  assert.equal(world.sent[3].ageMinutes, 0);
});

test('startWeather does not show a saved reading older than 3 hours', async () => {
  const world = pretendWorld();
  world.stored['teletraan-weather'] = savedText({ savedAt: startTime - 3 * hour - minute });
  world.answerWith = () => new Promise(() => {});

  startWeather(place, weather => world.sent.push(weather), world.parts);
  assert.deepEqual(world.sent, [null]);
});

test('startWeather replaces a too old saved reading with a good new one', async () => {
  const world = pretendWorld();
  world.stored['teletraan-weather'] = savedText({ savedAt: startTime - 5 * hour });
  await world.start();

  assert.equal(world.sent.length, 2);
  assert.equal(world.sent[0], null);
  assert.equal(world.sent[1].temperature, 83);
});

test('startWeather ignores saved text that is not a reading', async () => {
  const notReadings = [
    'not json at all',
    'null',
    '42',
    '"text"',
    '{}',
    savedText({ temperature: 'hot' }),
    savedText({ isDay: 1 }),
    savedText({ savedAt: null }),
    savedText({ code: undefined }),
  ];

  for (const text of notReadings) {
    const world = pretendWorld();
    world.stored['teletraan-weather'] = text;
    world.answerWith = () => new Promise(() => {});

    startWeather(place, weather => world.sent.push(weather), world.parts);
    assert.equal(world.sent.length, 0, text);
  }
});

test('startWeather still works when storage is missing or breaks', async () => {
  const breaks = () => { throw new Error('storage is blocked'); };
  const brokenStorages = [null, { getItem: breaks, setItem: breaks }];

  for (const storage of brokenStorages) {
    const world = pretendWorld();
    await world.start({ storage: storage });

    assert.equal(world.sent.length, 1);
    assert.equal(world.sent[0].temperature, 83);
  }
});

test('the function startWeather returns stops the timer and later answers', async () => {
  const world = pretendWorld();
  let release;
  world.answerWith = () => new Promise(resolve => { release = () => resolve(reply(answer())); });

  const stop = await world.start();
  stop();
  assert.equal(world.timers[0].stopped, true);
  assert.equal(world.timers[1].stopped, true);

  release();
  await flush();
  assert.equal(world.sent.length, 0);
});

// weatherIcon

function readAttributes(text, tag) {
  const attributes = {};
  const rest = text.replace(/\s([A-Za-z-]+)="([^"]*)"/g, (match, name, value) => {
    attributes[name] = value;
    return '';
  });
  assert.match(rest, /^\s*$/, 'attribute that is not name="value" in ' + tag);
  return attributes;
}

function readTransform(text) {
  const numbers = /^translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)$/.exec(text);
  assert.ok(numbers, 'group transform ' + text);
  return { x: Number(numbers[1]), y: Number(numbers[2]), scale: Number(numbers[3]) };
}

// Reads the markup the way a strict reader would, and returns the shapes in
// it. Every tag must close, every attribute must be quoted, and nothing but
// white space may sit between tags.
function readMarkup(markup) {
  const shapes = [];
  const open = [];
  const noTransform = { x: 0, y: 0, scale: 1 };
  let transform = noTransform;
  let position = 0;

  const tagPattern = /<(\/?)([a-z]+)([^<>]*?)(\/?)>/g;
  let tag;
  while ((tag = tagPattern.exec(markup)) !== null) {
    const [whole, closing, name, attributeText, selfClosing] = tag;
    assert.match(markup.slice(position, tag.index), /^\s*$/, 'text between tags in ' + markup);
    position = tag.index + whole.length;

    if (closing) {
      assert.equal(open.pop(), name, 'closing tag does not match in ' + markup);
      if (name === 'g') transform = noTransform;
      continue;
    }
    if (!selfClosing) open.push(name);

    const attributes = readAttributes(attributeText, whole);
    if (name === 'g') transform = readTransform(attributes.transform);
    if (name === 'svg') shapes.push({ name: name, attributes: attributes });
    if (name === 'polygon') shapes.push(shapeOf(name, attributes, transform, pointsOf(attributes.points)));
    if (name === 'rect') shapes.push(shapeOf(name, attributes, transform, cornersOf(attributes)));
  }

  assert.equal(open.length, 0, 'unclosed tag in ' + markup);
  assert.equal(position, markup.length, 'trailing text in ' + markup);
  return shapes;
}

function pointsOf(text) {
  return text.split(' ').map(pair => pair.split(',').map(Number));
}

function cornersOf(rect) {
  const left = Number(rect.x);
  const top = Number(rect.y);
  const right = left + Number(rect.width);
  const bottom = top + Number(rect.height);
  return [[left, top], [right, top], [right, bottom], [left, bottom]];
}

function shapeOf(name, attributes, transform, points) {
  const moved = points.map(point => [
    point[0] * transform.scale + transform.x,
    point[1] * transform.scale + transform.y,
  ]);
  return { name: name, attributes: attributes, points: moved };
}

const everyCode = [];
for (let code = -1; code <= 100; code++) everyCode.push(code);
everyCode.push(NaN, null, undefined, '3', 2.5);

test('weatherIcon gives well formed markup for every code, day and night', () => {
  everyCode.forEach(code => {
    [true, false].forEach(isDay => {
      const shapes = readMarkup(weatherIcon(code, isDay));
      assert.equal(shapes[0].name, 'svg');
      assert.ok(shapes.length > 1, 'no shapes for code ' + code);
    });
  });
});

test('weatherIcon is 44 pixels by default and takes a size', () => {
  const small = readMarkup(weatherIcon(61, true))[0].attributes;
  assert.equal(small.width, '44');
  assert.equal(small.height, '44');
  assert.equal(small.viewBox, '0 0 48 48');

  const large = readMarkup(weatherIcon(61, true, 132))[0].attributes;
  assert.equal(large.width, '132');
  assert.equal(large.height, '132');
  assert.equal(large.viewBox, '0 0 48 48');
});

test('weatherIcon never prints undefined, null or NaN', () => {
  everyCode.forEach(code => {
    [true, false, undefined].forEach(isDay => {
      assert.doesNotMatch(weatherIcon(code, isDay), /undefined|null|NaN/);
    });
  });
});

test('weatherIcon draws only straight shapes in token colours', () => {
  const colors = /^fill: var\(--(yellow|white|status-progress|status-next)\)$/;

  everyCode.forEach(code => {
    [true, false].forEach(isDay => {
      readMarkup(weatherIcon(code, isDay)).slice(1).forEach(shape => {
        assert.ok(shape.name === 'polygon' || shape.name === 'rect', shape.name);
        assert.match(shape.attributes.style, colors);
        assert.equal(shape.attributes.fill, undefined, 'a fill attribute cannot use var()');
      });
    });
  });
});

test('weatherIcon keeps every shape inside the 48 by 48 box', () => {
  everyCode.forEach(code => {
    [true, false].forEach(isDay => {
      readMarkup(weatherIcon(code, isDay)).slice(1).forEach(shape => {
        shape.points.forEach(([x, y]) => {
          assert.ok(x >= 0 && x <= 48 && y >= 0 && y <= 48, 'code ' + code + ' point ' + x + ',' + y);
        });
      });
    });
  });
});

test('weatherIcon draws a different picture for each kind of weather', () => {
  const samples = [
    [0, true], [0, false], [2, true], [2, false], [3, true],
    [45, true], [51, true], [61, true], [71, true], [95, true],
  ];
  const pictures = samples.map(([code, isDay]) => weatherIcon(code, isDay));
  assert.equal(new Set(pictures).size, samples.length);

  assert.equal(weatherIcon(65, true), weatherIcon(61, true));
  assert.equal(weatherIcon(81, true), weatherIcon(61, true));
  assert.equal(weatherIcon(1, true), weatherIcon(0, true));
  assert.equal(weatherIcon(999, true), weatherIcon(3, true));
  assert.equal(weatherIcon(61, true), weatherIcon(61, false), 'rain looks the same by night');
});

async function run() {
  const realError = console.error;
  let failed = 0;

  for (const { name, body } of tests) {
    logged = [];
    console.error = (...details) => { logged.push(details); };
    try {
      await body();
      console.log('ok    ' + name);
    } catch (error) {
      failed++;
      console.log('FAIL  ' + name);
      console.log(String(error.stack || error).split('\n').map(line => '      ' + line).join('\n'));
    }
  }

  console.error = realError;
  console.log('\n' + (tests.length - failed) + ' of ' + tests.length + ' passed');
  if (failed > 0) process.exitCode = 1;
}

run();
