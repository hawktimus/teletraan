// Runs the Views on the real screen (docs/views.md). Deciding what a view plays and which look a step has is in
// core/views.js, which has no page in it. This file gives it the real screen: the one clock, localStorage, what else
// has the screen, the large panel's list and the swap.
//
// The style, the team and the view of a step are handed to the modules that already hold them for a preview
// (rotateStyle in core/style.js, rotateTeam in core/teams.js, holdView in core/views.js), and they go on the page the
// way a preview does: at the moment the large frame is apart (core/areas.js, changeThemeNow and changeTeamNow). That
// moment is a swap (core/swap-run.js): the pieces of the screen pull apart, the look goes on, and the pieces re-form,
// with the hawk flying. A swap plays at every change of view, whatever else changes with it. The layout of the view
// (core/views.js, drawStyleFor) goes on the running page in the same step (core/layout-apply.js, changeLayout).
//
// The clock of the minutes of a view runs once a second here and stands still while an alert, an announcement, a talk,
// a demo, the night screen or a hidden transition has the screen. The lists are not touched then, so the view that was
// interrupted comes back at the panel that was next. The control page can hold a view or the clock
// (core/screen-requests.js, showView and pauseRotation).

import * as frame from '../frame.js';
import { drawnFor, layoutNow, layoutOf, reloadKey } from './layout.js';
import { layoutsChangeLive } from './layout-apply.js';
import { canShow } from './panels.js';
import { moveOn, pauseRotation, resumeRotation, setLookHooks, skipRow, startListsOver } from './schedule.js';
import { changesBetween, currentScreen, heldLook, holdScreenLook, makeNextLookRunner, styleCanGoOn, swapScaleOf } from './screens.js';
import { activeRequests } from './screen-requests.js';
import { layoutFor, requestStyle, rotateLayout, shapesFor, shapesNow } from './style.js';
import { queueSwap, startSwaps, swapRunning } from './swap-run.js';
import { noteWantedTeam } from './team-run.js';
import { takeoverRunning } from './takeover.js';
import { asTeam, useTeams } from './teams.js';
import { checkTheme } from './theme-apply.js';
import { resolveTheme } from './theme.js';
import { noteTransition, transitionKindNow, transitionSecondsOf } from './rotation.js';
import { startReforms } from './reform-run.js';
import { heldView, holdView } from './view-apply.js';
import { cycleKey, findViewWithPanel, holdPanelId, layoutOfStep, lookForViewStep, pairSide, stepInView, tickView, viewPlan } from './views.js';

let getContent = null;

// The layout of the step that began last, so that a change of layout inside a view is a swap too (Robotics rows choose theirs)
let heldLayout = '';

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
    console.error('The views cannot ask ' + path + ' about ' + name, error);
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

// Whether a style can go on the page now (styleCanGoOn in core/screens.js). The layout the style asks for
// is worked out as holdForLayout does in core/layout-apply.js. A page that changes layout while it runs can always
// show it. One that cannot may reload for it, unless it reloaded for that layout a moment ago (mustReload in core/layout.js).
function styleFits(style, layout) {
  try {
    const theme = resolveTheme(getContent().theme, new Date()).theme;
    const wantedLayout = layout === 'bar' ? 'bar' : layoutFor(style, layoutOf(theme));
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
    console.error('The views cannot tell whether a style fits the page', error);
    return true;
  }
}

// What the large panel asks about a step (setLookHooks in core/schedule.js)

function placed(step) {
  return stepInView(step, getContent(), heldView() || cycleKey());
}

function lookOf(step) {
  const content = getContent();
  return lookForViewStep(placed(step), viewPlan(content, new Date()), layoutOfStep(content, placed(step)));
}

// Runs the question as the team the step is drawn for, which is not yet the team on the screen
function viewAs(step, run) {
  return asTeam(lookOf(step).team, run);
}

// A step waits while its style cannot go on the page
function fits(step) {
  return styleFits(lookOf(step).style, layoutOfStep(getContent(), placed(step)));
}

// A step is chosen and its page is about to be built. When its look is not the one held, it is held now, and when the
// team, the style or the view changes the next page change of the large panel is a swap. Going into the Monday cards or
// out of them with the same style is only noted: swap-run.js swaps at every Monday card in full motion.
function begin(step) {
  const from = heldLook();
  const to = lookOf(step);
  const changes = changesBetween(from, to);
  const view = placed(step).view;
  const moved = heldView() !== '' && view !== heldView();

  noteTransition({ view: heldView() }, { view: view });
  if (pairSide(step)) moveOn(['grid2']);
  const layout = layoutOfStep(getContent(), placed(step));
  const reshaped = heldLayout !== '' && layout !== heldLayout;

  heldLayout = layout;
  holdView(view);
  rotateLayout(layout);
  if (!changes.team && !changes.style && !changes.monday && !moved && !reshaped) return;

  holdLook(to);
  if (changes.swap || moved || reshaped) queueSwap();
}

// The length of the swap that is about to play, as a scale of the standard one: the Screen that is held is the one it goes to
function swapScaleNow() {
  return swapScaleOf(currentScreen(getContent(), new Date()));
}

// The Next look now button: the large panel plays the first step of the next row at once
function pressed() {
  skipRow();
}

// True when the page of a step has something to show, asked as the team the step is drawn for. The clock of the
// minutes uses it to skip a view with nothing to show.
function canShowStep(step) {
  return fits(step) && viewAs(step, () => canShow(step.panel, getContent(), step.page));
}

// The requests of the control page that were on at the last second, so that a change is acted on once
let wasPaused = false;
let wasPreviewing = '';
let wasHolding = '';

// Acts on what the control page asks (core/screen-requests.js): the pause of the pages, the theme preview and the panel
// held. Returns { view, paused } for the clock: the view to hold, and whether the clock stands still.
function actOnRequests(content, now) {
  const asked = activeRequests(content.settings, now);

  if (asked.pauseRotation !== wasPaused) {
    wasPaused = asked.pauseRotation;
    if (wasPaused) pauseRotation();
    else resumeRotation();
  }
  if (asked.previewTheme !== wasPreviewing) {
    wasPreviewing = asked.previewTheme;
    requestStyle(asked.previewTheme);
    checkTheme();
    moveOn(['grid1']); // the theme goes on in the swap of the next page change, so that comes now and not at the end of this page
  }
  if (asked.holdPanel !== wasHolding) {
    wasHolding = asked.holdPanel;
    holdPanelId(wasHolding);
    startListsOver();
    moveOn(['grid1']);
  }

  let view = asked.showView;
  if (asked.holdPanel !== '') {
    if (view === '') view = findViewWithPanel(content, asked.holdPanel, now) || cycleKey();
  }
  return { view: view, paused: asked.pauseRotation || asked.holdPanel !== '' };
}

// Once a second: the clock of the minutes, and when the view changes, both lists begin again at the first step of the
// view that comes, and the pages on screen leave at their next chance. The look of that first step is held when it is
// chosen (begin), and the swap plays at its page change.
function second(now) {
  const content = getContent();
  if (!content || !content.settings) return;

  try {
    const asked = actOnRequests(content, now);
    const moved = tickView(content, now, { frozen: busyElsewhere() || asked.paused, forced: asked.view, canShow: canShowStep });
    if (!moved.changed) return;

    startListsOver();
    moveOn(['grid1', 'grid2']);
  } catch (error) {
    console.error('The views could not move on', error);
  }
}

// getContent() returns the newest content. Start this after the takeovers, the demo runner, the night
// screen and the hidden transitions, which it asks about. addressAsks is true when the address has
// ?style= or ?team=, which win over the views: then there is nothing for them to hold.
export async function startViews(contentGetter, addressAsks) {
  getContent = contentGetter;
  if (addressAsks) return;

  demoRunning = await askOptional('./demo-runner.js', 'demoRunning');
  nightIsUp = await askOptional('./night-screen.js', 'nightIsUp');
  hiddenPlaying = await askOptional('./hidden-run.js', 'hiddenPlaying');

  startSwaps(busyElsewhere, swapScaleNow);
  startReforms(() => transitionSecondsOf(getContent()), transitionKindNow);
  setLookHooks({ viewAs: viewAs, fits: fits, begin: begin });

  const button = makeNextLookRunner({ getContent: getContent, storage: savedStorage(), busy: busy, next: pressed });
  frame.onSecond(now => {
    button.look(now);
    second(now);
  });
}
