// Starts the dashboard. The order matters: fonts, panels, content, then the
// fixed panels, then everything that comes and goes. Each step that can
// fail is wrapped so the screen carries on with what it has.
//
// Switches you can add to the address, for example index.html?motion=calm
//   motion=full|calm|none             how much things move
//   speed=very-slow|slow|normal|fast  how fast things move and how long panels stay
//   finish=metal|flat                 polished metal edges, or one plain colour (to test speed)
//   metal=gold|silver                 the metal of the permanent frame edges (the banner, the countdown, the logo)
//   change=alternate|slat|mechanical  how the large and small panels change page
//   frames=mostly-gold|alternate|gold|silver   the metal of the large and small page frames
//   glint=on|off                      the bright dash that runs round the big frames
//   draw=stroke|fade                  draw lines, or fade them in (to find out which is slower)
//   stress                            show Grid 1, Grid 2 and the ticker together, changing together
//   only=tasks                        show only the Tasks panel: no banner, countdown, small panels or ticker
//   perf                              show the frame timing readout
//   show=<panel id>                   show only that panel, for example show=events
//   demo=announcement|alert|crt       play one of the special effects now
//   theme=<id>                        show a theme from themes/registry.js, whatever the Theme settings say
//   overlay=<id>|none                 show an overlay from themes/overlays/registry.js, or none
//   night=on|off                      show the night screen (the screensaver) now, or never, whatever the time
//   hidden=desktop|redEyes|off        play that hidden transition at the next page change of the large panel, or never play any

import * as frame from './frame.js';
import { panels } from './registry.js';
import { sampleFolder, liveFolder, defaultSettings, frameFinishes, metals, pageChangeStyles, location as place } from './config.js';
import { startContent, withDefaults } from './core/content.js';
import { mergeEvents } from './core/events.js';
import { connectionLines, drawConnection } from './core/connection.js';
import { makeSilverGradients } from './core/plate.js';
import { showDeviceInfo } from './core/device.js';
import { checkTheme, showThemeNow, startThemes } from './core/theme-apply.js';
import { loadPanel, mountPanel, updatePanel } from './core/panels.js';
import { showPagesNow, startRotation, startTicker, startTogether } from './core/schedule.js';
import { startTakeovers, runAnnouncement, takeoverRunning } from './core/takeover.js';

const params = new URLSearchParams(window.location.search);
const stress = params.has('stress');
const onlyTasks = params.get('only') === 'tasks';

const screen = document.getElementById('screen');

let base = null; // the content from the editors, or the sample
let status = null;
const extras = {}; // events and weather: things that do not come from the editors. Each may be missing. extras.events are the BAND events only.
let content = null; // base and extras together, always the newest
let rereadEvents = null; // set once the calendar reader is running
let calendarsKey = null; // the calendar list the events were last read for
let showingSample = false; // true while Dashboard Settings has the screen on the sample content
let extrasStarted = false; // the events are being read, so a change of source has to redo them
let calendarsReadAt = null; // when every calendar file was last read well, for the connection status text
let deviceText = []; // the Mini's name and ssh line, read only while Sanity cannot be reached

window.teletraanStarted = true; // index.html reloads the page if this never happens
run();

async function run() {
  try {
    makeSilverGradients(); // before any frame is drawn, so a silver frame has its gradients
  } catch (error) {
    console.error('The silver gradients could not be made. Silver frames will have no metal.', error);
  }
  fitToScreen();
  window.addEventListener('resize', fitToScreen);
  // The finish in index.html is the default. The address overrides it for testing.
  const finish = params.get('finish');
  if (finish === 'flat' || finish === 'metal') document.documentElement.dataset.finish = finish;

  // The metal of the frame edges and the glint. The address wins, then
  // rebuild() applies the Dashboard Settings values to the same two attributes.
  const metal = params.get('metal');
  if (metals.includes(metal)) document.documentElement.dataset.metal = metal;
  const glint = params.get('glint');
  if (glint === 'on' || glint === 'off') document.documentElement.dataset.glint = glint;

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

    // The theme goes on before the first panel is drawn, so nothing flashes in the wrong colours
    try {
      await startThemes(getContent, { theme: params.get('theme'), overlay: params.get('overlay') });
    } catch (error) {
      console.error('The theme could not be started. The screen keeps the default look.', error);
    }

    // The night screen goes up before the panels are drawn, so a Mini that
    // restarts in the middle of the night does not show the dashboard first.
    // It is left out of the test views (?show and ?stress) unless asked for.
    if (params.has('night') || (!params.get('show') && !stress)) {
      await startOptional('./core/night-screen.js', module => module.startNight(getContent, params.get('night')));
    }

    startWhatStays();

    // Alerts and announcements do not need the weather or events, so they
    // start looking at the clock at once. An announcement must never be
    // missed because the screen was still loading.
    if (!params.get('show') && !stress) {
      startTakeovers(getContent);

      // The Demo page in the Studio. After the takeovers, so that an alert that
      // comes due on the same second has the screen before the demo looks.
      startOptional('./core/demo-runner.js', module => module.startDemoRunner(getContent));

      // The hidden transitions. After the demo runner and the night screen, which they ask about
      startOptional('./core/hidden-run.js', module => module.startHidden(getContent, params.get('hidden')));

      // The Play announcements button in the Studio. Last, because it asks the ones above whether they have the screen
      startOptional('./core/announce-run.js', module => module.startAnnounceRunner(getContent));
    }

    if (!early) {
      const first = await loading;
      setBase(first.content, first.status);
      showThemeNow(); // the first real content, so its theme goes on at once, not at a page change
    }

    await startExtras();
    startWhatComesAndGoes();
    await startPerf();
    startDemo();
  } catch (error) {
    showFatal(error);
  }
}

// Joins the editors' content with the weather and events. When the content
// switches between the sample and the editors' own (Dashboard Settings
// decides, see core/source.js), the events that were read for the old one are
// thrown away and read again from the right folder, and the pages on screen
// are replaced now instead of at their next turn. The photos are part of the
// content itself, so they switch with it.
function setBase(newBase, newStatus) {
  const sample = newStatus.source === 'sample';
  const switched = extrasStarted && sample !== showingSample;

  showingSample = sample;
  base = newBase;
  status = newStatus;

  if (switched) {
    delete extras.events;
    calendarsKey = null; // makes rebuild() read the calendars again
    calendarsReadAt = null;
  }
  rebuild();
  checkTheme(); // a changed theme waits for the next page change

  if (switched) showPagesNow();
}

// The BAND events and the Events Calendar entries from the Studio as one list.
// If merging fails the BAND events are shown as they are, so a bad entry never
// takes the Events panel away.
function mergedEvents() {
  try {
    return mergeEvents(extras.events, base.extraEvents, base.theme.timeZone);
  } catch (error) {
    console.error('Could not merge the Events Calendar entries with the calendar events', error);
    return extras.events || [];
  }
}

function rebuild() {
  content = Object.assign({}, base, extras, { status: status });
  content.events = mergedEvents();
  if (!params.has('motion')) frame.setMotion(content.settings.motion); // so a change in Dashboard Settings shows at once
  if (!params.has('speed')) frame.setSpeed(content.settings.speed);
  const glitch = content.settings.crt;
  frame.setCrt(glitch.on, glitch.everySeconds, glitch.durationSeconds);
  useLogoSettings(content.settings);
  usePageChangeSettings(content.settings);
  if (!metals.includes(params.get('metal'))) setPageSwitch('metal', content.settings.frameMetal);
  if (!['on', 'off'].includes(params.get('glint'))) setPageSwitch('glint', content.settings.glint ? 'on' : 'off');
  updatePanel('banner', content);
  updatePanel('countdown', content);

  // The connection status text, and the Mini's address inside it while Sanity cannot be reached
  try {
    showDeviceInfo(Boolean(status && status.offline), useDeviceLines);
    drawConnectionText();
  } catch (error) {
    console.error('Could not update the connection status text', error);
  }

  // hiding, renaming or adding a calendar shows at once, not at the next 10 minute read
  const key = JSON.stringify(content.settings.calendars);
  if (rereadEvents && key !== calendarsKey) rereadEvents();
}

// The Logo tab of Dashboard Settings: the master switch, the entrance, and the
// switch, seconds between plays and seconds one play lasts of the spin, the
// flying hawk and the name effect (see "Effects that play now and then" in frame.js)
function useLogoSettings(settings) {
  frame.setLogoAnimations(settings.logoAnimations, settings.logoEntrance);
  frame.setSpin(settings.logoSpin, settings.logoSpinEvery, settings.logoSpinDuration);
  frame.setHawk(settings.logoHawk, settings.logoHawkEvery, settings.logoHawkDuration);
  frame.setNameEffect(settings.nameTransform, settings.nameEvery, settings.nameDuration);
}

// The Transitions tab of Dashboard Settings: how a page change looks and what
// metal the page frames have. The address wins, like the other switches above.
function usePageChangeSettings(settings) {
  const style = pageChangeStyles.includes(params.get('change')) ? params.get('change') : settings.pageChangeStyle;
  const finish = frameFinishes.includes(params.get('frames')) ? params.get('frames') : settings.frameFinish;
  frame.setPageChange(style, finish, settings.silverChance, settings.breakSeconds);
}

// The device lines arrive a moment after the text first shows, and every
// minute after that
function useDeviceLines(lines) {
  deviceText = lines;
  drawConnectionText();
}

// The text at the bottom right (core/connection.js). It shows by itself while
// status.offline is true, and all the time when Show connection status is on.
function drawConnectionText() {
  const lines = connectionLines({
    status: status,
    always: content.settings.showConnectionStatus,
    content: content,
    calendarsReadAt: calendarsReadAt,
    deviceLines: deviceText,
  });
  drawConnection(lines, status && status.offline ? 'warning' : 'info');
}

// An attribute on the html element that the stylesheets read. It is only
// written when the value changes, so a rebuild does not make the browser
// restyle the whole screen.
function setPageSwitch(name, value) {
  if (document.documentElement.dataset[name] !== value) document.documentElement.dataset[name] = value;
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
    startTicker(getContent);
  }
}

// Weather and calendar events. Each is loaded on its own, so one failing
// leaves the other working. The first events are worth a short wait, so the
// first panels have something to show, but never more than a few seconds.
async function startExtras() {
  const ready = [];
  extrasStarted = true;

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

  // An event that has finished must leave the list even when nothing else
  // changes, and a new day starts at midnight in the Theme time zone
  setInterval(() => {
    if (content) content.events = mergedEvents();
  }, 60 * 1000);

  watchVersion();
  await Promise.race([Promise.all(ready), frame.wait(3000)]);
}

// The sample content has its own calendar file in data/sample. The editors'
// content uses the files the Mini downloads into data/live. Each reads only
// its own folder, so the two never mix. A read that finishes after the source
// has switched belongs to the old source, and is dropped.
async function readEvents(module) {
  try {
    const reading = showingSample;
    const now = new Date();
    const calendars = content.settings.calendars;
    calendarsKey = JSON.stringify(calendars);

    const folder = (reading ? sampleFolder : liveFolder) + 'calendars/';
    const result = await module.loadEvents({ folder: folder, calendars: calendars, now: now, daysAhead: 60 });
    if (reading !== showingSample) return;

    // A calendar that could not be read keeps what it had last time, so one
    // failed download does not empty the screen
    const kept = (extras.events || []).filter(event => result.failed.includes(event.calendarId) && event.end > now);
    extras.events = kept.concat(result.events).sort((first, second) => first.start - second.start);
    if (result.failed.length === 0) calendarsReadAt = now; // one calendar that fails keeps the time of the last time all of them worked
    rebuild();
  } catch (error) {
    console.error('Could not read the calendars', error);
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
    'background: var(--ground); color: var(--yellow); font: 700 96px/120px sans-serif; text-align: center;';
  message.textContent = 'Teletraan I could not start. Trying again in 30 seconds.';
  screen.appendChild(message);

  setTimeout(() => window.location.reload(), 30000);
}
