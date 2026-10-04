// Live weather from Open-Meteo, which is free and needs no key. The newest good
// reading is saved in the browser, so the screen has weather after a restart.

const refreshMinutes = 15;

// A request that has not answered by then is given up, so one hanging
// connection cannot stop the refreshes
const requestSeconds = 15;

// Past this a reading is dropped, so old weather is never shown as current
const tooOldHours = 3;
const saveKey = 'teletraan-weather';

// What each weather code means. Codes in the same range look the same on
// the screen. icon is a name that weather-icons.js knows how to draw.
const descriptions = [
  { from: 0, to: 0, condition: 'CLEAR', icon: 'clear' },
  { from: 1, to: 1, condition: 'MOSTLY CLEAR', icon: 'clear' },
  { from: 2, to: 2, condition: 'PARTLY CLOUDY', icon: 'partly-cloudy' },
  { from: 3, to: 3, condition: 'CLOUDY', icon: 'cloudy' },
  { from: 45, to: 45, condition: 'FOG', icon: 'fog' },
  { from: 48, to: 48, condition: 'FOG', icon: 'fog' },
  { from: 51, to: 57, condition: 'DRIZZLE', icon: 'drizzle' },
  { from: 61, to: 67, condition: 'RAIN', icon: 'rain' },
  { from: 71, to: 77, condition: 'SNOW', icon: 'snow' },
  { from: 80, to: 82, condition: 'SHOWERS', icon: 'rain' },
  { from: 85, to: 86, condition: 'SNOW SHOWERS', icon: 'snow' },
  { from: 95, to: 99, condition: 'STORM', icon: 'storm' },
];

const unknown = { condition: 'UNKNOWN', icon: 'cloudy' };

// Anything that is not a known code gets a plain cloud
export function describeWeather(code) {
  if (!Number.isInteger(code)) return unknown;

  const match = descriptions.find(item => code >= item.from && code <= item.to);
  return match ? { condition: match.condition, icon: match.icon } : unknown;
}

// Whole degrees. Math.round gives -0 for a value like -0.3, which prints as
// 0 but is not equal to 0, so turn it into a plain 0.
function wholeDegrees(value) {
  const rounded = Math.round(value);
  return rounded === 0 ? 0 : rounded;
}

function firstOf(list) {
  return Array.isArray(list) ? list[0] : undefined;
}

// null when the answer is not what we expect
export function parseForecast(answer) {
  const current = answer && answer.current;
  const daily = answer && answer.daily;
  if (!current || !daily) return null;

  const temperature = current.temperature_2m;
  const high = firstOf(daily.temperature_2m_max);
  const low = firstOf(daily.temperature_2m_min);
  const code = current.weather_code;
  if (![temperature, high, low, code].every(Number.isFinite)) return null;

  return {
    temperature: wholeDegrees(temperature),
    high: wholeDegrees(high),
    low: wholeDegrees(low),
    code: code,
    isDay: current.is_day === 1,
  };
}

function forecastUrl(place) {
  return 'https://api.open-meteo.com/v1/forecast' +
    '?latitude=' + place.latitude +
    '&longitude=' + place.longitude +
    '&current=temperature_2m,weather_code,is_day' +
    '&daily=temperature_2m_max,temperature_2m_min' +
    '&temperature_unit=fahrenheit&timezone=auto&forecast_days=1';
}

// The browser pieces this file uses. A test passes its own in options.
// Calls go through window so they have the right this.
function browserParts() {
  return {
    fetch: (url, signal) => window.fetch(url, { cache: 'no-store', signal: signal }),
    storage: browserStorage(),
    now: () => Date.now(),
    setTimeout: (action, milliseconds) => window.setTimeout(action, milliseconds),
    clearTimeout: timer => window.clearTimeout(timer),
    setInterval: (action, milliseconds) => window.setInterval(action, milliseconds),
    clearInterval: timer => window.clearInterval(timer),
  };
}

// Asking for localStorage can throw, for example when site data is blocked
function browserStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

// A saved reading is { temperature, high, low, code, isDay, savedAt }, where
// savedAt is the time in milliseconds. Anything else in there is ignored.
function isSavedReading(saved) {
  return Boolean(saved) &&
    [saved.temperature, saved.high, saved.low, saved.code, saved.savedAt].every(Number.isFinite) &&
    typeof saved.isDay === 'boolean';
}

function loadSaved(storage) {
  try {
    const saved = JSON.parse(storage.getItem(saveKey));
    return isSavedReading(saved) ? saved : null;
  } catch (error) {
    return null;
  }
}

function save(storage, reading) {
  try {
    storage.setItem(saveKey, JSON.stringify(reading));
  } catch (error) {
    // not being able to save only costs us the head start after a restart
  }
}

function ageInMinutes(saved, now) {
  return Math.max(0, Math.floor((now - saved.savedAt) / 60000));
}

function isTooOld(saved, now) {
  return now - saved.savedAt > tooOldHours * 3600 * 1000;
}

// What the panels receive
function toWeather(saved, now) {
  return {
    temperature: saved.temperature,
    high: saved.high,
    low: saved.low,
    code: saved.code,
    isDay: saved.isDay,
    condition: describeWeather(saved.code).condition,
    updated: new Date(saved.savedAt),
    ageMinutes: ageInMinutes(saved, now),
  };
}

// place is { latitude, longitude }. onChange(weather) is called with the
// reading, or with null once the reading is too old to show. The result is a
// function that stops everything. options replaces the browser pieces, which
// is how the tests run without a network or a clock.
export function startWeather(place, onChange, options = {}) {
  const parts = Object.assign(browserParts(), options);
  const url = forecastUrl(place);

  let latest = loadSaved(parts.storage); // null until there has been a reading
  let sentEmpty = false;
  let stopped = false;

  function publish() {
    if (latest === null || stopped) return;

    const now = parts.now();
    if (isTooOld(latest, now)) {
      if (!sentEmpty) onChange(null);
      sentEmpty = true;
      return;
    }
    sentEmpty = false;
    onChange(toWeather(latest, now));
  }

  // The timer covers reading the answer as well as waiting for it
  async function readForecast() {
    const controller = new AbortController();
    const timer = parts.setTimeout(() => controller.abort(), requestSeconds * 1000);

    try {
      const response = await parts.fetch(url, controller.signal);
      if (!response.ok) throw new Error('The weather service answered ' + response.status);

      const reading = parseForecast(await response.json());
      if (!reading) throw new Error('The weather answer was not in the expected shape');
      return reading;
    } finally {
      parts.clearTimeout(timer);
    }
  }

  async function refresh() {
    try {
      latest = Object.assign(await readForecast(), { savedAt: parts.now() });
      save(parts.storage, latest);
    } catch (error) {
      console.error('Could not refresh the weather, keeping the last reading', error);
    }
    publish();
  }

  // Runs every minute, so an old reading goes away even when no refresh finishes
  function dropIfTooOld() {
    if (latest !== null && !sentEmpty && isTooOld(latest, parts.now())) publish();
  }

  publish();
  refresh();
  const refreshTimer = parts.setInterval(refresh, refreshMinutes * 60 * 1000);
  const checkTimer = parts.setInterval(dropIfTooOld, 60 * 1000);

  return function stop() {
    stopped = true;
    parts.clearInterval(refreshTimer);
    parts.clearInterval(checkTimer);
  };
}
