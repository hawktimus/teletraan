// Starts the dashboard. The order matters: fonts, panels, content, then the
// fixed panels, then everything that comes and goes. Each step that can
// fail is wrapped so the screen carries on with what it has.
//
// Switches you can add to the address, for example index.html?motion=calm
//   motion=full|calm|none             how much things move
//   speed=very-slow|slow|normal|fast  how fast things move and how long panels stay
//   finish=metal|flat                 gradients and brushed steel, or plain colours (to test speed)
//   draw=stroke|fade                  draw lines, or fade them in (to find out which is slower)
//   stress                            show Grid 1, Grid 2 and the ticker together, leaving together
//   only=tasks                        show only the Tasks panel: no banner, countdown, small panels or ticker
//   perf                              show the frame timing readout
//   show=<panel id>                   show only that panel, for example show=events
//   demo=announcement|alert|crt       play one of the special effects now

import * as frame from './frame.js';
import { panels } from './registry.js';
import { sampleMode, sampleFolder, liveFolder, defaultSettings, location as place } from './config.js';
import { startContent, withDefaults } from './core/content.js';
import { loadPanel, mountPanel, updatePanel } from './core/panels.js';
import { startRotation, startTicker, startTogether } from './core/schedule.js';
import { startTakeovers, runAnnouncement, takeoverRunning } from './core/takeover.js';

const params = new URLSearchParams(window.location.search);
const stress = params.has('stress');
const onlyTasks = params.get('only') === 'tasks';

const screen = document.getElementById('screen');

let base = null; // the content from the editors, or the sample
let status = null;
const extras = {}; // events, photos and weather: things that do not come from the editors. Each may be missing.
let content = null; // base and extras together, always the newest
let rereadEvents = null; // set once the calendar reader is running
let calendarsKey = null; // the calendar list the events were last read for
let liveReadsToSkip = 0; // sample mode: reads that go straight to the sample calendars

window.teletraanStarted = true; // index.html reloads the page if this never happens
run();

async function run() {
  fitToScreen();
  window.addEventListener('resize', fitToScreen);
  // The finish in index.html is the default. The address overrides it for testing.
  const finish = params.get('finish');
  if (finish === 'flat' || finish === 'metal') document.documentElement.dataset.finish = finish;

  try {
    frame.start({ motion: params.get('motion') || 'full', speed: params.get('speed') || 'normal', draw: params.get('draw') });

    // A font problem should not stop the screen, so only wait a few seconds
    await Promise.race([waitForFonts(), frame.wait(4000)]);
    await Promise.all(panels.filter(panel => stress || !panel.testOnly).map(loadPanel));

    const loading = startContent(change => setBase(change.content, change.status));

    // With nothing saved on this computer and Sanity slow to answer, the
    // content can take 15 seconds. The screen does not wait that long: it
    // starts with the defaults and swaps in the content when it arrives.
    const early = await Promise.race([loading, frame.wait(2000).then(() => null)]);
    if (early) {
      setBase(early.content, early.status);
    } else {
      setBase(withDefaults(null), { source: 'sanity', updated: null, offline: false });
    }

    startWhatStays();

    // Alerts and announcements do not need the weather or events, so they
    // start looking at the clock at once. An announcement must never be
    // missed because the screen was still loading.
    if (!params.get('show') && !stress) startTakeovers(getContent);

    if (!early) {
      const first = await loading;
      setBase(first.content, first.status);
    }

    await startExtras();
    startWhatComesAndGoes();
    await startPerf();
    startDemo();
  } catch (error) {
    showFatal(error);
  }
}

// Joins the editors' content with the weather, events and photos
function setBase(newBase, newStatus) {
  base = newBase;
  status = newStatus;
  rebuild();
}

function rebuild() {
  content = Object.assign({}, base, extras, { status: status });
  if (!params.has('motion')) frame.setMotion(content.settings.motion); // so a change in Dashboard Settings shows at once
  if (!params.has('speed')) frame.setSpeed(content.settings.speed);
  frame.setCrt(content.settings.crt.on ? content.settings.crt.everyMinutes : 0);
  updatePanel('banner', content);
  updatePanel('countdown', content);

  // hiding, renaming or adding a calendar shows at once, not at the next 10 minute read
  const key = JSON.stringify(content.settings.calendars);
  if (rereadEvents && key !== calendarsKey) rereadEvents();
}

function getContent() {
  return content;
}

// The banner and countdown stay on screen the whole time
function startWhatStays() {
  if (onlyTasks) return;

  // Each is started on its own, so one that fails to draw leaves the other
  // and the rest of the screen working
  try {
    const banner = mountPanel('banner', content);
    frame.startLogo(banner.querySelector('.logo'));
    frame.enter(banner);
  } catch (error) {
    console.error('The banner could not be drawn', error);
  }

  try {
    frame.enter(mountPanel('countdown', content));
  } catch (error) {
    console.error('The countdown could not be drawn', error);
  }
}

// The panels that come and go
function startWhatComesAndGoes() {
  if (params.get('show')) {
    startTogether([params.get('show')], getContent, 30);
    return;
  }

  if (stress) {
    startTogether(['tasks', 'stand-in-tile', 'stand-in-ticker'], getContent, 3);
    return;
  }

  const rotation = () => content.settings.rotation;
  startRotation('grid1', () => (onlyTasks ? [{ panel: 'tasks', show: true, seconds: 12 }] : rotation().grid1), getContent);
  if (!onlyTasks) {
    startRotation('grid2', () => rotation().grid2, getContent);
    startTicker(() => rotation().tickerSeconds, getContent);
  }
}

// Weather, calendar events and photos. Each is loaded on its own, so one
// failing leaves the others working. The first events and photos are worth
// a short wait, so the first panels have something to show, but never more
// than a few seconds.
async function startExtras() {
  const ready = [];

  ready.push(startOptional('./core/weather.js', module => new Promise(resolve => {
    module.startWeather(place, weather => {
      extras.weather = weather;
      rebuild();
      resolve();
    });
  })));

  ready.push(startOptional('./core/calendar.js', async module => {
    rereadEvents = () => readEvents(module);
    await readEvents(module);
    setInterval(rereadEvents, 10 * 60 * 1000);
  }));

  ready.push(readPhotos());
  setInterval(readPhotos, 10 * 60 * 1000);

  watchVersion();
  await Promise.race([Promise.all(ready), frame.wait(3000)]);
}

async function readEvents(module) {
  try {
    const now = new Date();
    const calendars = content.settings.calendars;
    calendarsKey = JSON.stringify(calendars);

    // In sample mode the Mini's downloaded files usually do not exist. Once
    // none is found, the next 5 reads skip the look (and the 404 it causes).
    let result = { events: [], failed: calendars.map(calendar => calendar.id) };
    if (liveReadsToSkip > 0) {
      liveReadsToSkip--;
    } else {
      result = await module.loadEvents({ folder: liveFolder + 'calendars/', calendars: calendars, now: now, daysAhead: 60 });
      if (sampleMode && calendars.length > 0 && result.failed.length === calendars.length) liveReadsToSkip = 5;
    }
    let events = result.events;
    let failed = result.failed;

    // While the screen shows sample content, a calendar the Mini has not
    // downloaded yet falls back to the sample file, which is marked as sample
    if (sampleMode && failed.length > 0) {
      const retry = await module.loadEvents({
        folder: sampleFolder + 'calendars/',
        calendars: calendars.filter(calendar => failed.includes(calendar.id)),
        now: now,
        daysAhead: 60,
      });
      events = events.concat(retry.events);
      failed = retry.failed;
    }

    // A calendar that could not be read keeps what it had last time, so one
    // failed download does not empty the screen
    const kept = (extras.events || []).filter(event => failed.includes(event.calendarId) && event.end > now);
    extras.events = kept.concat(events).sort((first, second) => first.start - second.start);
    rebuild();
  } catch (error) {
    console.error('Could not read the calendars', error);
  }
}

async function readPhotos() {
  const folders = sampleMode ? [liveFolder, sampleFolder] : [liveFolder];

  for (const folder of folders) {
    try {
      const response = await fetch(folder + 'photos.json', { cache: 'no-store' });
      if (!response.ok) continue;

      extras.photos = await response.json();
      rebuild();
      return;
    } catch (error) {
      console.error('Could not read the photo list', error);
    }
  }
}

// A module that is allowed to be missing or to fail without stopping the screen
async function startOptional(path, use) {
  try {
    await use(await import(path));
  } catch (error) {
    console.error('Could not start ' + path, error);
  }
}

// When the Mini downloads a new version of the dashboard it also writes a
// new number into version.txt. Seeing the number change, reload the page.
function watchVersion() {
  let known = null;

  async function check() {
    try {
      const response = await fetch(liveFolder + 'version.txt', { cache: 'no-store' });
      if (!response.ok) return;

      const version = (await response.text()).trim();
      if (known === null) {
        known = version;
      } else if (version !== known && !takeoverRunning()) {
        // Not in the middle of an announcement or alert, because the new page
        // would not bring it back. The next check in a minute tries again.
        window.location.reload();
      }
    } catch (error) {
      // offline for the moment, try again next time
    }
  }

  check(); // read it once now, so an update in the first minute is not missed
  setInterval(check, 60 * 1000);
}

async function startPerf() {
  if (!params.has('perf')) return;

  try {
    const perf = await import('./perf.js'); // only loaded when asked for
    perf.start();
  } catch (error) {
    console.error('Could not start the readout', error);
  }
}

function startDemo() {
  const demo = params.get('demo');
  if (demo === 'announcement') {
    // the first announcement, or the starting one if the editors have removed them all
    const announcement = content.settings.announcements[0] || defaultSettings.announcements[0];
    setTimeout(() => runAnnouncement(announcement, getContent), 4000);
  }
  if (demo === 'crt') {
    setInterval(frame.playCrt, 8000);
    setTimeout(frame.playCrt, 2500);
  }
  if (demo === 'alert') {
    base.settings.alert = { on: true, headline: '[ALERT HEADLINE]', message: '[The message for the alert goes here.]', until: '' };
    rebuild();
  }
}

// The weight and family must match fonts.css. Add a line when you add a weight.
function waitForFonts() {
  return Promise.all([
    document.fonts.load('700 96px Tomorrow'),
    document.fonts.load('600 44px Tomorrow'),
    document.fonts.load('500 56px "Atkinson Hyperlegible Next"'),
  ]).catch(() => {});
}

// On the TV the window is exactly 1920x1080 and nothing is scaled. On a
// smaller screen the whole picture shrinks to fit, and stays centred.
function fitToScreen() {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);

  if (Math.abs(scale - 1) < 0.01) {
    screen.style.transform = '';
    screen.style.marginLeft = '';
    screen.style.marginTop = '';
    return;
  }

  screen.style.transform = 'scale(' + scale + ')';
  screen.style.marginLeft = Math.max(0, (window.innerWidth - 1920 * scale) / 2) + 'px';
  screen.style.marginTop = Math.max(0, (window.innerHeight - 1080 * scale) / 2) + 'px';
}

// A wall display must never sit blank without saying why
function showFatal(error) {
  console.error(error);

  const message = document.createElement('div');
  message.style.cssText = 'position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; z-index: 100;' +
    'display: flex; flex-direction: column; justify-content: center; align-items: center;' +
    'background: var(--ground); color: var(--gold); font: 700 96px/120px sans-serif; text-align: center;';
  message.textContent = 'Teletraan I could not start. Trying again in 30 seconds.';
  screen.appendChild(message);

  setTimeout(() => window.location.reload(), 30000);
}
