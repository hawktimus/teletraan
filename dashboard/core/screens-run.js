// Runs the Screens on the real screen (docs/layouts.md, "The Screens"). Deciding which look a row has is in
// core/screens.js, which has no page in it. This file gives it the real screen: the one clock, localStorage, what else
// has the screen, the large panel's list and the swap.
//
// The style and the team of a row are handed to the two modules that already hold them for a preview
// (rotateStyle in core/style.js, rotateTeam in core/teams.js), and they go on the page the way a preview does: at
// the moment the large frame is apart (core/areas.js, changeThemeNow and changeTeamNow). That moment is a swap
// (core/swap-run.js): the pieces of the screen pull apart, the look goes on, and the pieces re-form, with the hawk
// flying. It is the one way the screen changes, whatever changes: the style, the team, a Monday card, or going into
// or out of the Monday cards. The swap takes as long as the Screen it goes to says (swapSeconds).
//
// A change of layout (to or from Minimal) is put on the running page in the same step (core/layout-apply.js,
// changeLayout). The page does not reload. If that ever fails, the page reloads once, and a Monday row whose style the
// page then cannot show waits (mondayStyleFits).

import * as frame from '../frame.js';
import { drawnFor, layoutNow, layoutOf, reloadKey } from './layout.js';
import { layoutsChangeLive } from './layout-apply.js';
import { setLookHooks, skipRow } from './schedule.js';
import { changesBetween, currentScreen, heldLook, holdScreenLook, isMondayPanel, lookForStep, makeNextLookRunner, planFor, styleCanGoOn, swapScaleOf } from './screens.js';
import { layoutFor, shapesFor, shapesNow } from './style.js';
import { queueSwap, startSwaps, swapRunning } from './swap-run.js';
import { noteWantedTeam } from './team-run.js';
import { takeoverRunning } from './takeover.js';
import { asTeam, useTeams } from './teams.js';
import { checkTheme } from './theme-apply.js';
import { resolveTheme } from './theme.js';

let getContent = null;

// The demo, the night screen and the hidden transitions are optional parts of the
// screen. If one did not start, it is never in the way.
let demoRunning = () => false;
let nightIsUp = () => false;
let hiddenPlaying = () => false;

// Even asking for localStorage can throw, for example when the browser has storage switched off
function savedStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

async function askOptional(path, name) {
  try {
    return (await import(path))[name];
  } catch (error) {
    console.error('The Screens cannot ask ' + path + ' about ' + name, error);
    return () => false;
  }
}

// True while something other than a swap has the screen: an alert, an announcement, a talk, a demo, the
// night screen or a hidden transition
function busyElsewhere() {
  return takeoverRunning() || demoRunning() || nightIsUp() || hiddenPlaying();
}

// True while something else has the screen, or a swap is playing. Next look now waits and is asked again.
function busy() {
  return swapRunning() || busyElsewhere();
}

// The one way a look is handed to the screen. The team's items follow at once, so every page built from
// now on is the new team's, and checkTheme() makes the style wait for the next moment the frame is apart.
function holdLook(look) {
  holdScreenLook(look);
  useTeams(getContent(), new Date());
  noteWantedTeam();
  checkTheme();
}

// Whether the Monday style can go on the page now (styleCanGoOn in core/screens.js). The layout the style asks for
// is worked out as holdForLayout does in core/layout-apply.js. A page that changes layout while it runs can always
// show it. One that cannot may reload for it, unless it reloaded for that layout a moment ago (mustReload in core/layout.js).
function mondayStyleFits(style) {
  try {
    const theme = resolveTheme(getContent().theme, new Date()).theme;
    const wantedLayout = layoutFor(style, layoutOf(theme));
    const wanted = drawnFor(wantedLayout, shapesFor(style, wantedLayout));
    const onPage = drawnFor(layoutNow(), shapesNow());
    if (wanted === onPage || layoutsChangeLive()) return true;

    let canReload = false;
    try {
      canReload = window.sessionStorage.getItem(reloadKey) !== wanted;
    } catch (error) {
      canReload = false; // a note that cannot be kept cannot stop a reload loop, so the page does not reload
    }
    return styleCanGoOn(onPage, wanted, canReload);
  } catch (error) {
    console.error('The Screens cannot tell whether the Monday style fits the page', error);
    return true;
  }
}

// What the large panel asks about a step (setLookHooks in core/schedule.js)

function lookOf(step) {
  return lookForStep(step, heldLook(), planFor(getContent(), new Date()));
}

// Runs the question as the team the step is drawn for, which is not yet the team on the screen
function viewAs(step, run) {
  return asTeam(lookOf(step).team, run);
}

// A Monday card waits while its style cannot go on the page. Every other step is in the style of the day.
function fits(step) {
  return !isMondayPanel(step.panel) || mondayStyleFits(planFor(getContent(), new Date()).mondayStyle);
}

// A step is chosen and its page is about to be built. When its look is not the one held, it is held now, and when the
// team or the style changes the next page change of the large panel is a swap. Going into the Monday cards or out of
// them with the same style is only noted: swap-run.js swaps at every Monday card in full motion.
function begin(step) {
  const from = heldLook();
  const to = lookOf(step);
  const changes = changesBetween(from, to);

  if (!changes.team && !changes.style && !changes.monday) return;

  holdLook(to);
  if (changes.swap) queueSwap();
}

// The length of the swap that is about to play, as a scale of the standard one: the Screen that is held is the one it goes to
function swapScaleNow() {
  return swapScaleOf(currentScreen(getContent(), new Date()));
}

// The Next look now button: the large panel plays the first step of the next row at once
function pressed() {
  skipRow();
}

// getContent() returns the newest content. Start this after the takeovers, the demo runner, the night
// screen and the hidden transitions, which it asks about. addressAsks is true when the address has
// ?style= or ?team=, which win over the Screens: then there is nothing for them to hold.
export async function startScreens(contentGetter, addressAsks) {
  getContent = contentGetter;
  if (addressAsks) return;

  demoRunning = await askOptional('./demo-runner.js', 'demoRunning');
  nightIsUp = await askOptional('./night-screen.js', 'nightIsUp');
  hiddenPlaying = await askOptional('./hidden-run.js', 'hiddenPlaying');

  startSwaps(busyElsewhere, swapScaleNow);
  setLookHooks({ viewAs: viewAs, fits: fits, begin: begin });

  const button = makeNextLookRunner({ getContent: getContent, storage: savedStorage(), busy: busy, next: pressed });
  frame.onSecond(now => button.look(now));
}
