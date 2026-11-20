// The sync service of the Teletraan computer (teletraan-sync.service, docs/OPERATIONS.md).
//
// The dashboard never asks the internet for anything. This service does, on its own timers, and writes what it got as
// plain files in the data folder, which the web server shows to the dashboard as data/live/:
//
//   content.json      the answer of the content query of Sanity: { syncedAt, result }
//   weather.json      the reading of Open-Meteo, as core/weather.js keeps it
//   images/           the pictures of the content, and images/index.json: the address that the dashboard asks for -> the file
//   sync-status.json  { generatedAt, sources: { name: { lastSuccessAt, lastFailureAt, lastFailureReason } }, network: { ok, since } }, every 10 seconds
//
// A file is written to a temporary name and renamed, and only from an answer that was checked, so a failed fetch leaves
// the last good copy where it is and never blanks anything. Monday, the competition feed and the calendars are read by
// their own timers (monday-sync.sh, frc-sync.sh, fetch-calendars.sh); this service only reports how they are doing.
//
//   node sync-service.mjs          run until stopped
//   node sync-service.mjs --once   read every source once, write the files and stop (a laptop, and make net-test)
//
// Tests and laptops set TELETRAAN_DATA (the data folder), SYNC_SANITY_BASE and SYNC_WEATHER_URL (other addresses) and
// TELETRAAN_LOG_DIR.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanity, sanityImageHost, location } from '../../dashboard/config.js';
import { addressOf, contentQuery } from '../../dashboard/core/sanity-query.js';
import { forecastUrl, parseForecast } from '../../dashboard/core/weather.js';
import { logoUrl, photoUrl, screenPhotoUrl, tidyPhoto } from '../../dashboard/core/images.js';
import { logEvent } from './jsonlog.mjs';
import { probeAndLog } from './net-probe.mjs';
import { checkContent, problemsFile } from './ingest-validate.mjs';
import { execFile } from 'node:child_process';

const service = 'sync';
export const sourceNames = ['sanity', 'weather', 'images', 'monday', 'competition', 'calendars'];

// Seconds. The check is cheap (a count and the newest edit), so a publish shows within a minute, and the whole read still
// happens at least every five minutes in case a change was missed.
export const timing = {
  checkEvery: 60,
  fullReadEvery: 300,
  weatherEvery: 900,
  weatherRetryEvery: 60,
  imagesRetryEvery: 60,
  statusEvery: 60,
  probeEveryWhenWell: 900,
  probeEveryWhenFailing: 60,
  noteEveryWhenWell: 300,
  networkWindow: 120, // the network is up when any source was read well inside this many seconds
  netwatchFailures: 3, // failures counted by netwatch.sh from which the network is down whatever the sources say
  requestLimit: 20,
  imageLimit: 40,
};

const portraitSize = 280; // the size core/portrait.js asks a portrait for
const biggestImage = 15 * 1024 * 1024;
const imageTypes = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif' };

export function oneLine(text) {
  return String(text).replace(/[^\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

// A failure in a few plain words. fetch hides the system code in error.cause.
function reasonOf(error) {
  if (error && error.reason) return error.reason;
  if (error && error.name === 'AbortError') return 'timeout';
  const cause = error && error.cause ? error.cause : null;
  const inner = cause && Array.isArray(cause.errors) && cause.errors[0] ? cause.errors[0] : null;
  const code = (cause && cause.code) || (inner && inner.code) || '';
  return oneLine(code ? 'network ' + code : (error && error.message) || 'failed');
}

function failure(reason) {
  const error = new Error(reason);
  error.reason = reason;
  return error;
}

// Writes a file by way of a temporary name in the same folder, so the web server never reads half a file
export function writeFileAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp.' + process.pid;
  fs.writeFileSync(temporary, content, { mode: 0o644 });
  fs.renameSync(temporary, file);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

// ----- the pictures a content answer needs -----

function isCdnImage(text) {
  return typeof text === 'string' && text.startsWith('https://' + sanityImageHost + '/images/');
}

// The addresses the dashboard will ask for, found by asking images.js the same questions the panels ask. Portraits are
// asked for at one size, the Photo panel at the width of the screen and a logo at its own limit. Any other picture
// address (the pictures of a subtheme) is asked for as it is.
export function wantedImages(result) {
  const found = new Set();

  function walk(node, trail) {
    if (Array.isArray(node)) {
      node.forEach(item => walk(item, trail));
    } else if (node && typeof node === 'object') {
      if (isCdnImage(node.url) && tidyPhoto(node)) {
        if (trail.includes('people') || trail.includes('subteams')) found.add(photoUrl(node, portraitSize, portraitSize));
        else if (trail.includes('photos')) found.add(screenPhotoUrl(node));
        else found.add(logoUrl(node));
        return;
      }
      Object.keys(node).forEach(key => walk(node[key], trail.concat(key)));
    } else if (isCdnImage(node)) {
      found.add(node);
    }
  }

  walk(result, []);
  found.delete('');
  return Array.from(found);
}

// ----- the Sanity read token -----

// The dataset is public today, so a read with no token works. It will not once the dataset is made private
// (docs/OPERATIONS.md), and then every read needs a token. SANITY_READ_TOKEN (Viewer role) is the one to use; the write
// token is the fallback so that a computer that has only that one keeps reading. The value is read from local.env by
// this one name, held only for the request and never written to a log, a status file or a message. A line that still
// holds the [paste ...] placeholder counts as no token.
export function readSanityToken(envFile) {
  let text = '';
  try {
    text = fs.readFileSync(envFile, 'utf8');
  } catch (error) {
    return '';
  }
  const found = {};
  text.split('\n').forEach(line => {
    const match = /^(?:export\s+)?(SANITY_READ_TOKEN|SANITY_WRITE_TOKEN)=(.*)$/.exec(line.trim());
    if (match) found[match[1]] = match[2].trim().replace(/^['"]/, '').replace(/['"]$/, '');
  });
  const usable = value => Boolean(value) && !value.startsWith('[');
  if (usable(found.SANITY_READ_TOKEN)) return found.SANITY_READ_TOKEN;
  return usable(found.SANITY_WRITE_TOKEN) ? found.SANITY_WRITE_TOKEN : '';
}

// The reasons Monday tasks are stuck are typed by students and can say anything, so they stay off Sanity, which is
// public. monday-sync.sh writes them to monday/notes.json in the data folder, and they are put on the tasks here, in
// the local copy the screen reads and nowhere else. A missing or damaged file means no notes.
export function withStuckNotes(result, notesFile) {
  if (!result || !Array.isArray(result.tasks)) return result;
  const notes = readJson(notesFile, {});
  if (!notes || typeof notes !== 'object') return result;
  const tasks = result.tasks.map(task => {
    const note = task && typeof task._id === 'string' ? notes[task._id] : undefined;
    return typeof note === 'string' && note !== '' ? Object.assign({}, task, { note: note }) : task;
  });
  return Object.assign({}, result, { tasks: tasks });
}

// ----- the service -----

// options (all optional): dataDir, sanityBase, weatherUrl, now(), fetch, envFile, token
export function createSync(options = {}) {
  const dataDir = options.dataDir || process.env.TELETRAAN_DATA || '/var/lib/teletraan/data';
  const sanityBase = options.sanityBase || process.env.SYNC_SANITY_BASE || 'https://' + sanity.projectId + '.apicdn.sanity.io';
  const weatherUrl = options.weatherUrl || process.env.SYNC_WEATHER_URL || forecastUrl(location);
  const now = options.now || (() => Date.now());
  const doFetch = options.fetch || fetch;
  const envFile = options.envFile || process.env.TELETRAAN_ENV_FILE || path.join(process.env.TELETRAAN_ROOT || '/opt/teletraan', 'local.env');
  const sanityToken = () => (typeof options.token === 'string' ? options.token : readSanityToken(envFile));
  const imageFolder = path.join(dataDir, 'images');
  const statusFile = path.join(dataDir, 'sync-status.json');
  const healthFile = options.healthFile || process.env.SYNC_HEALTH_FILE || '/var/lib/teletraan/health.json';
  const netwatchFile = options.netwatchFile || process.env.SYNC_NETWATCH_FILE || '/var/lib/teletraan/netwatch.json';

  const state = {};
  sourceNames.forEach(name => {
    state[name] = { lastSuccessAt: null, lastFailureAt: null, lastFailureReason: '' };
  });
  // The failures of the last run are worth keeping: they say what went wrong before this service started, and the
  // control page shows the reason. The successes are not. A stamp from before a reboot says "Monday was read at 14:02"
  // when nothing has been read since the computer came back, and the dots on the wall then stay amber for up to half an
  // hour while the control page, which looks at the live files, shows green. Starting with no success stamp is the
  // truth: nothing has been read yet in this run, and the dots say "not known yet" until the first read lands.
  const before = readJson(statusFile, null);
  if (before && before.sources) {
    sourceNames.forEach(name => {
      const kept = before.sources[name];
      if (!kept) return;
      state[name].lastFailureAt = kept.lastFailureAt || null;
      state[name].lastFailureReason = kept.lastFailureReason || '';
    });
  }

  const memory = {
    signature: '',
    lastFullRead: 0,
    lastNote: {},
    lastProbe: {},
    failing: {},
    result: readJson(path.join(dataDir, 'content.json'), { result: null }).result,
    imageIndex: readJson(path.join(imageFolder, 'index.json'), {}),
    imagesBusy: false,
    networkSince: null,
    imagesRun: null,
  };

  const stamp = () => new Date(now()).toISOString();
  // status-write.sh problems sends the count of the rows to look at. A failure never stops the read.
  const tellStudio = options.tellStudio || (options.noProbe ? () => {} : () => {
    execFile(path.join(path.dirname(fileURLToPath(import.meta.url)), 'status-write.sh'), ['problems'], { timeout: 60000 }, () => {});
  });
  // When this service started. The dots on the wall and on the control page say "not known yet", not "late", for the
  // first minutes, until the first reads land.
  const startedAt = stamp();

  function succeeded(name) {
    const was = memory.failing[name];
    state[name].lastSuccessAt = stamp();
    memory.failing[name] = false;
    if (was) logEvent(service, name, 'recovered', 'the source answers again');
  }

  function failed(name, reason) {
    state[name].lastFailureAt = stamp();
    state[name].lastFailureReason = oneLine(reason);
    const first = !memory.failing[name];
    memory.failing[name] = true;
    if (first || now() - (memory.lastNote[name + 'failed'] || 0) > timing.noteEveryWhenWell * 1000) {
      memory.lastNote[name + 'failed'] = now();
      logEvent(service, name, 'check_failed', oneLine(reason));
    }
  }

  // The full network probe (dns, tcp, tls, http) of a source: at once when it fails (at most once a minute), and now and
  // then while it works, so the log shows what a good answer looks like too
  async function probeSometimes(name, url, expectedType, failedNow) {
    const gap = (failedNow ? timing.probeEveryWhenFailing : timing.probeEveryWhenWell) * 1000;
    if (now() - (memory.lastProbe[name] || 0) < gap) return;
    memory.lastProbe[name] = now();
    if (options.noProbe) return;
    try {
      await probeAndLog(service, name, url, { expectedType: expectedType });
    } catch (error) {
      logEvent(service, name, 'probe_error', reasonOf(error));
    }
  }

  // The token goes to Sanity's own hosts and to no other address: not the weather service, not any other site
  function sendsToken(url) {
    return url.startsWith(sanityBase + '/') || url.startsWith('https://' + sanityImageHost + '/');
  }

  async function fetchBody(url, seconds, asJson) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), seconds * 1000);
    try {
      const headers = { 'User-Agent': 'teletraan-sync' };
      const token = sendsToken(url) ? sanityToken() : '';
      if (token) headers.Authorization = 'Bearer ' + token;
      const response = await doFetch(url, { signal: controller.signal, headers: headers });
      if (!response.ok) throw failure('http ' + response.status);
      const type = String(response.headers.get('content-type') || '');
      if (asJson) {
        // A school filter answers 200 with a page of its own, which is not JSON
        if (!type.includes('json')) throw failure('not json, maybe a block page (' + oneLine(type.split(';')[0] || 'no type') + ')');
        return await response.json();
      }
      return { type: type.split(';')[0].trim().toLowerCase(), bytes: Buffer.from(await response.arrayBuffer()) };
    } finally {
      clearTimeout(timer);
    }
  }

  function queryUrl(query) {
    return addressOf(sanity, query, sanityBase);
  }

  // ----- Sanity -----

  const checkQuery = '{ "count": count(*), "latest": *[] | order(_updatedAt desc)[0]._updatedAt }';

  // Asks the cheap question. A change, or five minutes since the last full read, makes the full read. Returns true when
  // the content file was written.
  async function checkSanity(force = false) {
    let wrote = false;
    try {
      const answer = await fetchBody(queryUrl(checkQuery), timing.requestLimit, true);
      const signature = JSON.stringify(answer && answer.result);
      if (!answer || typeof answer.result !== 'object' || answer.result === null) throw failure('sanity sent no result');

      const due = now() - memory.lastFullRead >= timing.fullReadEvery * 1000;
      if (force || due || signature !== memory.signature || !memory.result) {
        const full = await fetchBody(queryUrl(contentQuery), timing.requestLimit, true);
        if (!full || typeof full.result !== 'object' || full.result === null) throw failure('sanity sent no content');
        // What was sent is checked first. An answer that is empty or the wrong shape never replaces the last good content, so
        // the wall keeps what it has; a value that can be repaired is repaired and every repair is listed (ingest-validate.mjs)
        const checked = checkContent(full.result, memory.result);
        if (!checked.ok) throw failure(checked.reason);
        memory.result = checked.result;
        memory.signature = signature;
        memory.lastFullRead = now();
        writeFileAtomic(path.join(dataDir, 'content.json'), JSON.stringify({ syncedAt: stamp(), result: withStuckNotes(checked.result, path.join(dataDir, 'monday', 'notes.json')) }));
        writeFileAtomic(path.join(dataDir, 'data-problems.json'), JSON.stringify(problemsFile(checked.problems, stamp())));
        // The Studio status document gets the number, when it changes
        if (checked.problems.length !== memory.problemCount) {
          memory.problemCount = checked.problems.length;
          tellStudio();
        }
        wrote = true;
        logEvent(service, 'sanity', 'content_written', 'the content was read and written');
      } else if (now() - (memory.lastNote.sanity || 0) > timing.noteEveryWhenWell * 1000) {
        memory.lastNote.sanity = now();
        logEvent(service, 'sanity', 'check_ok', 'nothing changed');
      }
      succeeded('sanity');
      await probeSometimes('sanity', queryUrl(checkQuery), 'json', false);
    } catch (error) {
      failed('sanity', reasonOf(error));
      await probeSometimes('sanity', queryUrl(checkQuery), 'json', true);
    }
    // The pictures are fetched in the background, so a slow picture never delays the next check. A test waits for imagesRun.
    if (wrote) memory.imagesRun = syncImages().catch(error => logEvent(service, 'images', 'error', reasonOf(error)));
    return wrote;
  }

  // ----- weather -----

  async function syncWeather() {
    try {
      const reading = parseForecast(await fetchBody(weatherUrl, timing.requestLimit, true));
      if (!reading) throw failure('the weather answer was not in the expected shape');
      writeFileAtomic(path.join(dataDir, 'weather.json'), JSON.stringify(Object.assign(reading, { savedAt: now() })));
      succeeded('weather');
      await probeSometimes('weather', weatherUrl, 'json', false);
      return true;
    } catch (error) {
      failed('weather', reasonOf(error));
      await probeSometimes('weather', weatherUrl, 'json', true);
      return false;
    }
  }

  // ----- images -----

  function fileNameFor(address, type) {
    return crypto.createHash('sha1').update(address).digest('hex').slice(0, 24) + '.' + (imageTypes[type] || 'img');
  }

  // Downloads what the content needs and the folder lacks. An address goes into index.json only after its file is
  // complete, so the dashboard keeps the Sanity address of a picture that has not arrived yet.
  async function syncImages() {
    if (memory.imagesBusy || !memory.result) return;
    memory.imagesBusy = true;
    try {
      const wanted = wantedImages(memory.result);
      const index = Object.assign({}, memory.imageIndex);
      let missing = 0;
      let reason = '';
      let downloaded = 0;

      for (const address of wanted) {
        if (index[address] && fs.existsSync(path.join(imageFolder, path.basename(index[address])))) continue;
        if (downloaded >= timing.imageLimit) {
          missing += 1;
          continue;
        }
        try {
          const picture = await fetchBody(address, 30, false);
          if (!imageTypes[picture.type]) throw failure('not a picture (' + oneLine(picture.type || 'no type') + ')');
          if (picture.bytes.length === 0 || picture.bytes.length > biggestImage) throw failure('picture size ' + picture.bytes.length);
          const name = fileNameFor(address, picture.type);
          writeFileAtomic(path.join(imageFolder, name), picture.bytes);
          index[address] = 'images/' + name;
          downloaded += 1;
        } catch (error) {
          missing += 1;
          reason = reasonOf(error);
        }
      }

      // Pictures the content no longer names are removed, but only when every wanted picture is in
      if (missing === 0) {
        Object.keys(index).forEach(address => {
          if (!wanted.includes(address)) delete index[address];
        });
        const keep = new Set(Object.values(index).map(file => path.basename(file)).concat(['index.json']));
        if (fs.existsSync(imageFolder)) {
          fs.readdirSync(imageFolder).forEach(name => {
            if (!keep.has(name)) fs.rmSync(path.join(imageFolder, name), { force: true });
          });
        }
      }

      if (JSON.stringify(index) !== JSON.stringify(memory.imageIndex) || !fs.existsSync(path.join(imageFolder, 'index.json'))) {
        writeFileAtomic(path.join(imageFolder, 'index.json'), JSON.stringify(index));
        memory.imageIndex = index;
      }
      if (downloaded > 0) logEvent(service, 'images', 'downloaded', downloaded + ' pictures');
      if (missing === 0) succeeded('images');
      else failed('images', missing + ' pictures not downloaded' + (reason ? ' (' + reason + ')' : ''));
    } finally {
      memory.imagesBusy = false;
    }
  }

  // The pictures are read only when the content changes, so with nothing to download they are as current as the content
  function touchImages() {
    if (memory.result && !memory.imagesBusy && !imagesPending()) succeeded('images');
  }

  function imagesPending() {
    return Boolean(memory.result) && wantedImages(memory.result).some(address => !memory.imageIndex[address]);
  }

  // ----- the sources other timers read -----

  // Monday, the competition feed and the calendars have their own timers. Their state is read from what they already
  // write: two documents inside the content answer, and the notes file of the calendar download.
  function readOthers() {
    const result = memory.result || {};
    // monday-sync.sh leaves its own answer in the data folder, so the dot does not wait for the round trip through Sanity
    // and back (a write, a change check, a full read). The Sanity document is the fallback for a computer without it.
    const local = readJson(path.join(dataDir, 'monday', 'status.json'), null);
    const monday = local && typeof local === 'object' ? local : result.monday;
    if (monday) {
      if (monday.lastSyncAt) state.monday.lastSuccessAt = monday.lastSyncAt;
      if (monday.lastError && state.monday.lastFailureReason !== oneLine(monday.lastError)) {
        state.monday.lastFailureAt = stamp();
        state.monday.lastFailureReason = oneLine(monday.lastError);
      }
    }
    const frc = result.frc;
    if (frc && frc.lastSyncAt) state.competition.lastSuccessAt = frc.lastSyncAt;

    try {
      const lines = fs.readFileSync(path.join(dataDir, 'calendar-sync.txt'), 'utf8').split('\n').filter(Boolean);
      let newest = null;
      let problem = '';
      lines.forEach(line => {
        const parts = line.split('|');
        if (parts[1] && (!newest || parts[1] > newest)) newest = parts[1];
        if (parts[2]) problem = parts[2];
      });
      if (newest) state.calendars.lastSuccessAt = newest;
      if (problem && state.calendars.lastFailureReason !== oneLine(problem)) {
        state.calendars.lastFailureAt = stamp();
        state.calendars.lastFailureReason = oneLine(problem);
      }
    } catch (error) {
      // No calendars downloaded yet
    }
  }

  // The network as the dot on the TV and the control page show it: { ok, since }. Up when any source was read well in the
  // last two minutes, down when netwatch.sh has counted three failed checks. Nothing known yet counts as up. since is when it
  // went down and is null while it is up.
  function networkState() {
    const nowMs = now();
    const times = sourceNames.map(name => Date.parse(state[name].lastSuccessAt)).filter(time => !isNaN(time));
    const failures = sourceNames.map(name => Date.parse(state[name].lastFailureAt)).filter(time => !isNaN(time));
    const recent = times.some(time => nowMs - time <= timing.networkWindow * 1000);
    const watch = readJson(netwatchFile, null);
    const watchDown = watch !== null && typeof watch === 'object' && Number(watch.failures) >= timing.netwatchFailures;
    const ok = watchDown ? false : (recent || failures.length === 0);

    if (ok) {
      memory.networkSince = null;
    } else if (!memory.networkSince) {
      memory.networkSince = new Date(failures.length > 0 ? Math.max(...failures) : nowMs).toISOString();
    }
    return { ok: ok, since: ok ? null : memory.networkSince };
  }

  // health.json is what the health timer writes every minute (computer/scripts/health.sh): one answer to "is the screen
  // painting, is the display at its mode, is each service up". The names of the checks that fail go into sync-status.json, so the
  // TV, the control page and the Studio read one file for what is wrong. Nothing here is a verdict of its own.
  function healthSummary() {
    const health = readJson(healthFile, null);
    const checks = health && typeof health === 'object' && health.checks && typeof health.checks === 'object' ? health.checks : null;
    if (!checks) return null;
    const failing = Object.keys(checks).filter(name => checks[name] && checks[name].ok === false).slice(0, 12).map(name => oneLine(name));
    return { ok: failing.length === 0, failing: failing, at: typeof health.generatedAt === 'string' ? health.generatedAt : null };
  }

  function writeStatus() {
    readOthers();
    const status = { generatedAt: stamp(), startedAt: startedAt, sources: {}, network: networkState(), health: healthSummary() };
    sourceNames.forEach(name => {
      status.sources[name] = Object.assign({}, state[name]);
    });
    writeFileAtomic(statusFile, JSON.stringify(status));
    return status;
  }

  return { checkSanity, syncWeather, syncImages, imagesPending, touchImages, writeStatus, state, memory };
}

// ----- running -----

function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function forever(name, job, everySeconds) {
  for (;;) {
    let wait = everySeconds;
    try {
      const next = await job();
      if (typeof next === 'number') wait = next;
    } catch (error) {
      logEvent(service, name, 'error', reasonOf(error));
    }
    await sleep(wait);
  }
}

async function main() {
  const sync = createSync();
  logEvent(service, 'service', 'started', process.argv.includes('--once') ? 'once' : 'running');

  if (process.argv.includes('--once')) {
    await sync.checkSanity(true);
    await sync.syncWeather();
    await sync.syncImages();
    sync.writeStatus();
    return;
  }

  process.on('uncaughtException', error => logEvent(service, 'service', 'uncaught', reasonOf(error)));
  process.on('unhandledRejection', error => logEvent(service, 'service', 'unhandled', reasonOf(error)));

  forever('sanity', () => sync.checkSanity(), timing.checkEvery);
  forever('weather', async () => ((await sync.syncWeather()) ? timing.weatherEvery : timing.weatherRetryEvery), timing.weatherEvery);
  forever('images', async () => {
    if (sync.imagesPending()) await sync.syncImages();
    else sync.touchImages();
  }, timing.imagesRetryEvery);
  forever('status', async () => {
    sync.writeStatus();
  }, timing.statusEvery);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
  if (process.argv.includes('--once')) process.exit(0);
}
