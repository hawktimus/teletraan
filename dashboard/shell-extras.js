// The events, the kit, the style, the view, the decorations, the version watch, the demo and the fit to the screen (part of shell.js).

import * as frame from './frame.js';
import { sampleFolder, liveFolder, defaultSettings, location as place } from './config.js';
import { showStamp } from './core/build-stamp.js';
import { versionLabel } from './core/version-label.js';
import { overlayShown, ruleExtras } from './core/theme.js';
import { decorationLayers, hasKit, layoutNow } from './core/layout.js';
import { redrawFrames } from './core/areas.js';
import { applyStyle, recordShapes, shapesFor, shapesNow, themeOf } from './core/style.js';
import { applyTheme, applyView, applyViewLabels, viewNow } from './core/view-apply.js';
import { viewNameOf, viewShowsTag, viewTitleOf } from './core/views.js';
import { updatePanel } from './core/panels.js';
import { runAnnouncement, takeoverRunning } from './core/takeover.js';
import { startHeartbeat } from './core/heartbeat.js';
import { getContent, mergedEvents, rebuild, redrawWhatStays, useLayout } from './shell-content.js';
import { params, screen, extras, shellState } from './shell-state.js';

// Weather and calendar events. Each is loaded on its own, so one failing
// leaves the other working. The first events are worth a short wait, so the
// first panels have something to show, but never more than a few seconds.
export async function startExtras() {
  const ready = [];
  shellState.extrasStarted = true;

  ready.push(startOptional('./core/weather.js', module => new Promise(resolve => {
    module.startWeather(place, weather => {
      extras.weather = weather;
      rebuild();
      resolve();
    });
  })));

  ready.push(startOptional('./core/calendar.js', async module => {
    shellState.rereadEvents = () => readEvents(module);
    await readEvents(module);
    setInterval(shellState.rereadEvents, 10 * 60 * 1000);
  }));

  // An event that has finished must leave the list even when nothing else
  // changes, and a new day starts at midnight in the Look time zone
  setInterval(() => {
    if (shellState.content) shellState.content.events = mergedEvents();
  }, 60 * 1000);

  watchVersion();
  startHeartbeat();
  await Promise.race([Promise.all(ready), frame.wait(3000)]);
}

// The sample content has its own calendar file in data/sample. The editors'
// content uses the files the Teletraan computer downloads into data/live. Each reads only
// its own folder, so the two never mix. A read that finishes after the source
// has switched belongs to the old source, and is dropped.
async function readEvents(module) {
  try {
    const reading = shellState.showingSample;
    const now = new Date();
    const calendars = shellState.content.settings.calendars;
    shellState.calendarsKey = JSON.stringify(calendars);

    const folder = (reading ? sampleFolder : liveFolder) + 'calendars/';
    const result = await module.loadEvents({ folder: folder, calendars: calendars, now: now, daysAhead: 60 });
    if (reading !== shellState.showingSample) return;

    // A calendar that could not be read keeps what it had last time, so one
    // failed download does not empty the screen
    const kept = (extras.events || []).filter(event => result.failed.includes(event.calendarId) && event.end > now);
    extras.events = kept.concat(result.events).sort((first, second) => first.start - second.start);
    if (result.failed.length === 0) shellState.calendarsReadAt = now; // one calendar that fails keeps the time of the last time all of them worked
    rebuild();
  } catch (error) {
    console.error('Could not read the calendars', error);
  }
}

// The neon kit (docs/layouts.md, "The kit") is on for Neon Prime in the sidebar
// layout, and off for every other look, and for ?kit=off. A problem here never
// stops the colours.
function useKit(look) {
  try {
    frame.setKit(hasKit(look.theme, layoutNow()) && params.get('kit') !== 'off');
  } catch (error) {
    console.error('Could not switch the neon kit', error);
  }
}

// The style of the look (core/style.js). It goes on in the same step as the theme's
// classes, so the screen is never drawn with half of each. A style with other frames than
// the page has drawn also gets them in this step: the areas have their frame drawn again
// and so do the banner and the countdown. A problem here never stops the colours.
function useStyle(look) {
  try {
    applyStyle(look.style);
    if (shapesFor(look.style, layoutNow()) === shapesNow()) return;

    recordShapes(look.style, document.documentElement, layoutNow());
    redrawFrames();
    redrawWhatStays();
  } catch (error) {
    console.error('Could not put the style on the page', error);
  }
}

// The view of the look (core/view-apply.js). It goes on in the same step as the layout and the style, and the two banners,
// which carry the name of the view, are drawn again when it changes. A problem here never stops the colors.
function useView(look) {
  try {
    applyTheme(themeOf(look.style));
    const changed = applyView(look.view);
    if (!shellState.content) return;

    writeViewLabels();
    if (!changed) return;

    updatePanel('banner', shellState.content);
    updatePanel('bar-banner', shellState.content);
  } catch (error) {
    console.error('Could not put the view on the page', error);
  }
}

// The words of the view for the banners (core/view-apply.js, viewLabelsNow). They follow the content, so a new name in
// Dashboard Settings shows at once.
export function writeViewLabels() {
  const key = viewNow();
  if (key === '' || !shellState.content) return;

  applyViewLabels({ name: viewNameOf(shellState.content, key), title: viewTitleOf(shellState.content, key), tag: viewShowsTag(shellState.content, key) });
}

// What goes with each look that goes on the page: the style, the neon kit, and the
// decorations of the overlay's seasonal pack (core/season.js,
// docs/seasonal-packs.md). theme-apply.js calls this each time a look goes on
// the page. The module is read only when a pack is wanted, or when one has to be
// taken away, and a problem in it is logged and never stops the colours.
export function showDecorations(look) {
  useLayout(look);
  useStyle(look);
  useView(look);
  useKit(look);
  if (!look.overlay && !shellState.decorationsUsed) return;

  shellState.decorationsUsed = true;
  startOptional('./core/season.js', module => {
    module.setLayers(decorationLayers(layoutNow())); // the zones and the back layer are for the standard layout only
    module.setOverPanels(wantOverPanels());
    module.setCornerArt(typedCornerArt(look.overlay));
    return module.showSeason(look.overlay);
  }).then(refreshBannerLines); // the pack's own banner line is known once its file is read
}

// The corner art typed on the rule of this pack on the Look page, or '' (core/theme.js, ruleExtras)
function typedCornerArt(overlayId) {
  if (!shellState.base || !overlayId) return '';
  return ruleExtras(shellState.base.theme, overlayId, new Date()).cornerArt;
}

// The panels that show the banner line (core/theme.js, packExtras) are told again when a
// pack comes or goes, because that does not change the content
function refreshBannerLines() {
  if (!shellState.content) return;

  updatePanel('banner', shellState.content);
  updatePanel('bar-column', shellState.content);
}

// The pieces over the panels: the Look page's switch, and the address wins
// like the other switches. A change in Studio shows at once because rebuild()
// calls useSeasonSwitch() each time the content changes.
function wantOverPanels() {
  const asked = params.get('seasonover');
  if (asked === 'on' || asked === 'off') return asked === 'on';

  return !shellState.base || !shellState.base.theme || shellState.base.theme.seasonOverPanels !== false;
}

export function useSeasonSwitch() {
  if (!shellState.decorationsUsed) return; // core/season.js is not loaded, and reads the switch when it is
  startOptional('./core/season.js', module => module.setOverPanels(wantOverPanels()));
}

// The corner art typed on the rule of the pack on the page follows the Look page while
// the screen runs, like the switch above
export function usePackExtras() {
  if (!shellState.decorationsUsed) return;
  startOptional('./core/season.js', module => module.setCornerArt(typedCornerArt(overlayShown())));
}

// A module that is allowed to be missing or to fail without stopping the screen
export async function startOptional(path, use) {
  try {
    await use(await import(path));
  } catch (error) {
    console.error('Could not start ' + path, error);
  }
}

// When the Teletraan computer downloads a new version of the dashboard it also writes a
// new number into version.txt. Seeing the number change, reload the page.
function watchVersion() {
  let known = null;

  showStamp(versionLabel(window.teletraanVersion, window.teletraanCommit) || window.teletraanBuild, params, screen);

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

export async function startPerf() {
  if (!params.has('perf')) return;

  try {
    const perf = await import('./perf.js'); // only loaded when asked for
    perf.start();
  } catch (error) {
    console.error('Could not start the readout', error);
  }
}

export function startDemo() {
  const demo = params.get('demo');
  if (demo === 'announcement') {
    // the first announcement, or the starting one if the editors have removed them all
    const announcement = shellState.content.settings.announcements[0] || defaultSettings.announcements[0];
    setTimeout(() => runAnnouncement(announcement, getContent), 4000);
  }
  if (demo === 'crt') {
    setInterval(frame.playCrt, 8000);
    setTimeout(frame.playCrt, 2500);
  }
  if (demo === 'alert') {
    shellState.base.settings.alert = { on: true, headline: '[ALERT HEADLINE]', message: '[The message for the alert goes here.]', until: '' };
    rebuild();
  }
}

// The weight and family must match fonts.css. Add a line when you add a weight.
export function waitForFonts() {
  return Promise.all([
    document.fonts.load('700 96px Tomorrow'),
    document.fonts.load('600 44px Tomorrow'),
    document.fonts.load('500 56px "Atkinson Hyperlegible Next"'),
  ]).catch(() => {});
}

// On the TV the window is exactly 1920x1080 and nothing is scaled. On a
// smaller screen the whole picture shrinks to fit, and stays centred.
export function fitToScreen() {
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
export function showFatal(error) {
  console.error(error);

  const message = document.createElement('div');
  message.style.cssText = 'position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; z-index: 100;' +
    'display: flex; flex-direction: column; justify-content: center; align-items: center;' +
    'background: var(--ground); color: var(--yellow); font: 700 96px/120px sans-serif; text-align: center;';
  message.textContent = 'Teletraan I could not start. Trying again in 30 seconds.';
  screen.appendChild(message);

  setTimeout(() => window.location.reload(), 30000);
}
