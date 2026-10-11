// Runs the look rotation on the real screen (docs/layouts.md, "The look rotation"). Deciding which
// pass comes when is in core/look-rotation.js, which has no page in it. This file gives it the real
// screen: the one clock, localStorage, what else has the screen, and the swap.
//
// The style and the team of a pass are handed to the two modules that already hold them for a
// preview (rotateStyle in core/style.js, rotateTeam in core/teams.js), and they go on the page the way
// a preview does: at the moment the large frame is apart (core/areas.js, changeThemeNow and
// changeTeamNow). That moment is a swap (core/swap-run.js): the pieces of the screen pull apart, the look
// goes on, and the pieces re-form, with the hawk flying. It is the one way the screen changes, whatever
// changes: the style, the team, a Monday card, or going into or out of the Monday block. Dashboard
// Settings still has How the look changes (lookSwap), hidden, and the screen ignores it.
//
// A change of layout (to or from Minimal) reloads the page in every case (core/layout-apply.js), and
// the pass it was reloaded for is written down in localStorage, so the page goes on in it.

import * as frame from '../frame.js';
import { makeLookRotation, makeNextLookRunner } from './look-rotation.js';
import { moveOn, rewindRotation, setLookHooks } from './schedule.js';
import { rotateStyle } from './style.js';
import { queueSwap, startSwaps, swapRunning } from './swap-run.js';
import { noteWantedTeam } from './team-run.js';
import { takeoverRunning } from './takeover.js';
import { rotateTeam, useTeams } from './teams.js';
import { checkTheme } from './theme-apply.js';

let getContent = null;
let rotation = null;

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
    console.error('The look rotation cannot ask ' + path + ' about ' + name, error);
    return () => false;
  }
}

// True while something other than a swap has the screen: an alert, an announcement, a talk, a demo, the
// night screen or a hidden transition
function busyElsewhere() {
  return takeoverRunning() || demoRunning() || nightIsUp() || hiddenPlaying();
}

// True while something else has the screen, or a swap is playing. The look waits and is asked again.
function busy() {
  return swapRunning() || busyElsewhere();
}

function pagesAgain() {
  moveOn(['grid1', 'grid2', 'ticker']);
}

// The one way a look is handed to the screen. The team's items follow at once, so every page built from
// now on is the new team's, and checkTheme() makes the style wait for the next moment the frame is apart.
function holdLook(look) {
  rotateStyle(look.style);
  rotateTeam(look.team);
  useTeams(getContent(), new Date());
  noteWantedTeam();
  checkTheme();
}

// A look is held, and goes on in the swap that is the next page change of the large panel. If a swap
// cannot play then, the look goes on in the page change itself.
function changeLook(look) {
  holdLook(look);
  queueSwap();
}

// schedule.js asks at the end of every pass of the large panel. True means the list starts again.
function atPass(now) {
  const result = rotation.boundary(now);
  if (result.look) changeLook(result.look);
  return result.moved;
}

// The Next look now button: the rotation moves to the next pass at once, and every list starts again
// from its first panel
function pressed(now) {
  const result = rotation.next(now);
  if (!result.moved && !result.look) return;

  rewindRotation();
  if (result.look) changeLook(result.look);
  pagesAgain();
}

// getContent() returns the newest content. Start this after the takeovers, the demo runner, the night
// screen and the hidden transitions, which it asks about. addressAsks is true when the address has
// ?style= or ?team=, which win over the rotation: then there is nothing for the rotation to do.
export async function startLookRotation(contentGetter, addressAsks) {
  getContent = contentGetter;
  if (addressAsks) return;

  demoRunning = await askOptional('./demo-runner.js', 'demoRunning');
  nightIsUp = await askOptional('./night-screen.js', 'nightIsUp');
  hiddenPlaying = await askOptional('./hidden-run.js', 'hiddenPlaying');

  const storage = savedStorage();
  rotation = makeLookRotation({ getContent: getContent, storage: storage, busy: busy });
  holdLook(rotation.begin(new Date()));
  startSwaps(busyElsewhere);
  setLookHooks({ atPass: atPass, playlist: list => rotation.playlist(list, getContent()) });

  const button = makeNextLookRunner({ getContent: getContent, storage: storage, busy: busy, next: pressed });
  frame.onSecond(now => {
    rotation.keep(now);
    button.look(now);
  });
}
