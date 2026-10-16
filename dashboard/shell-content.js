// Reading the content, choosing the team, rebuilding, and drawing the panels that stay and the ones that come and go (part of shell.js).

import * as frame from './frame.js';
import { fixedPanels } from './registry.js';
import { frameFinishes, metals, pageChangeStyles } from './config.js';
import { savedContent } from './core/content.js';
import { mergeEvents } from './core/events.js';
import { connectionLines, drawConnection } from './core/connection.js';
import { pageSwitchesFor } from './core/look.js';
import { backgroundFor } from './core/theme-bg.js';
import { showDeviceInfo } from './core/device.js';
import { checkTheme } from './core/theme-apply.js';
import { changeLayout } from './core/layout-apply.js';
import { layoutNow } from './core/layout.js';
import { redrawFrames } from './core/areas.js';
import { shapesNow } from './core/style.js';
import { cadenceOf, currentScreen } from './core/screens.js';
import { holdBootView, viewPlaylist, viewSidePlaylist } from './core/views.js';
import { resumePreview } from './core/preview.js';
import { mountPanel, updatePanel } from './core/panels.js';
import { withPages, withStandIns } from './core/panel-order.js';
import { withCompetition } from './core/competition.js';
import { currentTeam, frameTrim, recordTrim, trimNow, useTeams } from './core/teams.js';
import { showPagesNow, startRotation, startRotationForLayouts, startTicker, startTogether } from './core/schedule.js';
import { startOptional, usePackExtras, useSeasonSwitch, writeViewLabels } from './shell-extras.js';
import { params, stillAsk, stress, onlyTasks, screen, extras, shellState } from './shell-state.js';

// The views (core/views.js) hold the view, the style and the team of the first step of the first view, from the
// saved copy of the content, so that the screen starts in them. The test views leave the Screens out.
export function holdSavedScreen() {
  if (params.get('show') || stress || onlyTasks) return;

  try {
    holdBootView(savedContent(), new Date());
  } catch (error) {
    console.error('Could not work out the look to start with', error);
  }
}

// A preview is kept in localStorage while it is on (core/preview.js). Asking for the storage can throw.
export function resumeSavedPreview() {
  try {
    resumePreview(window.localStorage);
  } catch (error) {
    console.error('Could not look for a preview that was on', error);
  }
}

// Joins the editors' content with the weather and events. The screen can
// start on the defaults and get the sample content a moment later (?sample=1,
// see core/source.js). When the content switches between the sample and the
// editors' own, the events that were read for the old one are thrown away and
// read again from the right folder, and the pages on screen are replaced now
// instead of at their next turn. The photos are part of the content itself,
// so they switch with it.
export function setBase(newBase, newStatus) {
  const sample = newStatus.source === 'sample';
  const switched = shellState.extrasStarted && sample !== shellState.showingSample;

  shellState.showingSample = sample;
  shellState.base = newBase;
  shellState.status = newStatus;

  if (switched) {
    delete extras.events;
    shellState.calendarsKey = null; // makes rebuild() read the calendars again
    shellState.calendarsReadAt = null;
  }
  rebuild();
  checkTheme(); // a changed theme waits for the next page change

  if (switched) showPagesNow();
}

// The BAND events with the Calendar filters applied and the finished ones left
// out. If that fails the BAND events are shown as they are, so a bad rule never
// takes the Events panel away.
export function mergedEvents() {
  try {
    return mergeEvents(extras.events, shellState.base.theme.timeZone, new Date(), shellState.base.calendarFilters);
  } catch (error) {
    console.error('Could not apply the Calendar filters to the calendar events', error);
    return extras.events || [];
  }
}

// The team that the Teams settings and the clock ask for. A problem here leaves the team that is on the screen.
function chooseTeam() {
  shellState.choosingTeam = true;
  try {
    useTeams(shellState.content, new Date());
  } catch (error) {
    console.error('Could not choose the team', error);
  } finally {
    shellState.choosingTeam = false;
  }
}

export function rebuild() {
  shellState.content = Object.assign({}, shellState.base, extras, { status: shellState.status });
  chooseTeam(); // before the events, so everything below is built for the team on the screen
  shellState.content.events = mergedEvents();
  if (!params.has('motion')) frame.setMotion(shellState.content.settings.motion); // so a change in Dashboard Settings shows at once
  if (!params.has('speed')) frame.setSpeed(shellState.content.settings.speed);
  const glitch = shellState.content.settings.crt;
  frame.setCrt(glitch.on, glitch.everySeconds, glitch.durationSeconds);
  useLogoSettings(shellState.content.settings, currentScreen(shellState.content));
  usePageChangeSettings(shellState.content.settings);
  useSeasonSwitch();
  usePackExtras();
  writeViewLabels();
  if (!metals.includes(params.get('metal'))) setPageSwitch('metal', shellState.content.settings.frameMetal);
  useLookSetting(shellState.content.settings);
  updatePanel('banner', shellState.content);
  updatePanel('countdown', shellState.content);
  updatePanel('side', shellState.content); // does nothing in a layout that does not draw it
  updatePanel('bar-banner', shellState.content); // nor do these two
  updatePanel('bar-column', shellState.content);

  // The connection status text, and the Teletraan computer's address inside it while Sanity cannot be reached
  try {
    showDeviceInfo(Boolean(shellState.status && shellState.status.offline), useDeviceLines);
    drawConnectionText();
  } catch (error) {
    console.error('Could not update the connection status text', error);
  }

  // hiding, renaming or adding a calendar shows at once, not at the next 10 minute read
  const key = JSON.stringify(shellState.content.settings.calendars);
  if (shellState.rereadEvents && key !== shellState.calendarsKey) shellState.rereadEvents();
}

// The logo settings of Dashboard Settings (Look tab): the master switch, the entrance, and the
// switch, seconds between plays and seconds one play lasts of the spin, the
// flying hawk and the name effect (see "Effects that play now and then" in frame.js). How often the hawk and the name
// effect play is the minutes of the Screen on the screen, not a setting of Dashboard Settings
export function useLogoSettings(settings, screen) {
  const cadence = cadenceOf(screen);

  frame.setLogoAnimations(settings.logoAnimations, settings.logoEntrance);
  frame.setSpin(settings.logoSpin, settings.logoSpinEvery, settings.logoSpinDuration);
  frame.setHawk(settings.logoHawk, cadence.hawkEverySeconds, settings.logoHawkDuration);
  frame.setNameEffect(settings.nameTransform, cadence.nameEverySeconds, settings.nameDuration);
}

// The page change settings of Dashboard Settings (Look tab): how a page change looks and what
// metal the page frames have. The address wins, like the other switches above.
function usePageChangeSettings(settings) {
  const style = pageChangeStyles.includes(params.get('change')) ? params.get('change') : settings.pageChangeStyle;
  const finish = frameFinishes.includes(params.get('frames')) ? params.get('frames') : settings.frameFinish;
  frame.setPageChange(style, finish, settings.silverChance, settings.breakSeconds);
}

// The device lines arrive a moment after the text first shows, and every
// minute after that
function useDeviceLines(lines) {
  shellState.deviceText = lines;
  drawConnectionText();
}

// The text at the bottom right (core/connection.js). It shows by itself while
// status.offline is true, and all the time when Show connection status is on.
function drawConnectionText() {
  const lines = connectionLines({
    status: shellState.status,
    always: shellState.content.settings.showConnectionStatus,
    content: shellState.content,
    calendarsReadAt: shellState.calendarsReadAt,
    deviceLines: shellState.deviceText,
  });
  drawConnection(lines, shellState.status && shellState.status.offline ? 'warning' : 'info');
}

// An attribute on the html element that the stylesheets read. It is only
// written when the value changes, so a rebuild does not make the browser
// restyle the whole screen.
function setPageSwitch(name, value) {
  if (document.documentElement.dataset[name] !== value) document.documentElement.dataset[name] = value;
}

// The Look setting (core/look.js) sets three of those switches: look, finish and
// glint. The address wins, for this page only. rebuild() calls it at every
// content change, so a new Look in Dashboard Settings shows at once. (The look
// that showDecorations() and useKit() take is a theme and overlay, which is
// another thing.)
export function useLookSetting(settings) {
  const switches = pageSwitchesFor(settings, { look: params.get('look'), finish: params.get('finish'), glint: params.get('glint') });
  Object.keys(switches).forEach(name => setPageSwitch(name, switches[name]));
  setPageSwitch('background', backgroundFor(settings, params.get('background')));
}

export function getContent() {
  return shellState.content;
}

// The banner and countdown stay on screen the whole time. The sidebar layout
// has the one panel, side, in their place (registry.js, fixedPanels)
export function startWhatStays() {
  if (onlyTasks) return;

  shellState.stayStarted = true;
  fixedPanels(layoutNow()).forEach(id => showFixedPanel(id, true));
}

// Each is started on its own, so one that fails to draw leaves the other
// and the rest of the screen working. animate is false for a panel that takes the place of one
// that is on screen, which is there at once
function showFixedPanel(id, animate) {
  try {
    const element = mountPanel(id, shellState.content);
    const logo = element.querySelector('.logo'); // only the panel that has the logo gives the effects something to move
    if (logo) frame.startLogo(logo);
    if (animate) frame.enter(element);
    else element.dataset.state = 'shown';
  } catch (error) {
    console.error('The ' + id + ' panel could not be drawn', error);
  }
}

// A look with another layout than the page has: the layout is changed in the page, in the step that puts the look on
// (core/layout-apply.js, changeLayout), and a swap has the screen apart for it (core/swap-run.js). The areas draw their
// frames again for the layout, and the panels that stay on screen are the layout's own. A problem here never stops the colors.
export function useLayout(look) {
  try {
    if (!changeLayout(look)) return;

    redrawFrames();
    drawWhatStays();
  } catch (error) {
    console.error('Could not put the layout on the page', error);
  }
}

// The banner, the countdown and the side column are not the same panels in every layout, so their regions are emptied
// and the panels of the layout are drawn
function drawWhatStays() {
  if (!shellState.stayStarted || onlyTasks) return;

  ['banner', 'countdown', 'column'].forEach(region => { document.getElementById('region-' + region).innerHTML = ''; });
  fixedPanels(layoutNow()).forEach(id => showFixedPanel(id, false));
}

// The banner and the countdown of the standard layout draw their own frame, and Cybertron
// gives them another (a plate behind the banner, and the war clock in place of the red
// countdown). They are drawn again when that style goes on. The other layouts draw the same
// panel in every style
export function redrawWhatStays() {
  if (!shellState.stayStarted || onlyTasks || layoutNow() !== 'standard') return;

  fixedPanels('standard').forEach(id => showFixedPanel(id, false));
}

// The corners a team cuts and the end of its header tab change the shape of every frame (core/plate.js,
// frameKind). They are written on the page when the team goes on, like the corners of a style, and the areas and
// the panels that draw their own plate draw their frames again in the same step. The sidebar layout has no
// plate of its own. The banner has one only in Cybertron. A problem here never stops the team going on.
export function useTrim() {
  try {
    const wanted = frameTrim(currentTeam());
    const drawn = trimNow();
    if (wanted.corner === drawn.corner && wanted.notch === drawn.notch) return;

    recordTrim(wanted);
    redrawFrames();
    redrawPlates();
  } catch (error) {
    console.error('Could not draw the frames for the team', error);
  }
}

function redrawPlates() {
  if (!shellState.stayStarted || onlyTasks) return;

  const drawsPlate = id => id === 'countdown' || id === 'bar-banner' || (id === 'banner' && shapesNow() === 'cybertron');
  fixedPanels(layoutNow()).filter(drawsPlate).forEach(id => showFixedPanel(id, false));
}

// The panels that come and go
export function startWhatComesAndGoes() {
  if (stillAsk) {
    startOptional('./core/still-run.js', module => module.holdPanel(stillAsk, getContent));
    return;
  }

  if (params.get('show')) {
    startTogether([params.get('show')], getContent, 30);
    return;
  }

  if (stress) {
    startTogether(['tasks', 'stand-in-tile', 'stand-in-ticker'], getContent, 3);
    return;
  }

  // The large panel plays the rows of the view that is on the screen, and the small panel its side rows
  // (core/views.js). A panel that says it has pages in registry.js is a step for each page (withPages). None does now: the
  // Events panel draws both of its pages and scrolls from the first to the next (core/schedule.js, scrollPages).
  // The competition cards that are due are mixed into the large panel's list each time it is read (core/competition.js)
  startRotation('grid1', () => (onlyTasks ? [{ panel: 'tasks', show: true, seconds: 12 }] : withPages(withCompetition(viewPlaylist(shellState.content, new Date()), shellState.content, new Date()))), getContent);
  if (!onlyTasks) {
    startRotationForLayouts('grid2', () => withStandIns(withPages(viewSidePlaylist(shellState.content))), getContent); // waits while the layout has no small frame

    startTicker(getContent);
  }
}
