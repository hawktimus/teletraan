// Runs the look rotation on the real screen (docs/layouts.md, "The look rotation"). Deciding which
// pass comes when is in core/look-rotation.js, which has no page in it. This file gives it the real
// screen: the one clock, localStorage, what else has the screen, and the three swaps.
//
// The style and the team of a pass are handed to the two modules that already hold them for a
// preview (rotateStyle in core/style.js, rotateTeam in core/teams.js). They go on the page in the
// same step as a preview does: at the moment the large frame is apart (core/areas.js, changeThemeNow
// and changeTeamNow). The swap only decides how that page change looks:
//
//   assemble  everything leaves, the look goes on while nothing is on the screen, and everything
//             comes in again from the first panel, with the first assembly
//   slats     the next page change of each area is the slat change, and the frames stay
//   cut       the pages of all three areas swap at once, with nothing leaving or arriving
//
// A change of layout (to or from Minimal) reloads the page in every case (core/layout-apply.js), and
// the pass it was reloaded for is written down in localStorage, so the page goes on in it.

import * as frame from '../frame.js';
import { lookCutMilliseconds } from '../config.js';
import { fixedPanels } from '../registry.js';
import { cutScreen, retireAreas, useSlatsOnce } from './areas.js';
import { layoutNow } from './layout.js';
import { makeLookRotation, makeNextLookRunner } from './look-rotation.js';
import { moveOn, pauseRotation, restartRotation, resumeRotation, rewindRotation, setLookHooks } from './schedule.js';
import { rotateStyle } from './style.js';
import { noteWantedTeam } from './team-run.js';
import { takeoverRunning } from './takeover.js';
import { changeTeamNow, rotateTeam, useTeams } from './teams.js';
import { checkTheme, showThemeNow } from './theme-apply.js';

let getContent = null;
let rotation = null;
let swapping = false; // a swap of look is playing

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

// True while something else has the screen: an alert, an announcement, a talk, a demo, the night
// screen, a hidden transition, or a swap that is playing. The look waits and is asked again.
function busy() {
  return swapping || takeoverRunning() || demoRunning() || nightIsUp() || hiddenPlaying();
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

// The panels that stay on the screen, as they are drawn now
function fixedElements() {
  return fixedPanels(layoutNow())
    .map(id => document.querySelector('[data-panel="' + id + '"]'))
    .filter(element => element !== null);
}

// Everything leaves, the look goes on with nothing on the screen, and everything comes in again. The
// rotation is paused meanwhile. restartRotation() clears the areas and starts every list from its
// first panel, so the frames assemble as they do when the screen starts. Whatever goes wrong on the
// way, the screen is brought back.
async function assemble(look) {
  pauseRotation();
  try {
    await Promise.all(fixedElements().map(element => frame.exit(element)).concat(retireAreas()));
    holdLook(look);
    showThemeNow();
    changeTeamNow();
  } finally {
    restartRotation();
    resumeRotation();
    fixedElements().forEach(element => frame.enter(element));
  }
}

// Hands the look on and plays the swap. A swap that fails is not played, and the look goes on at the
// next page change of the large panel.
async function swap(look, how) {
  swapping = true;
  try {
    if (how === 'assemble') {
      await assemble(look);
      return;
    }

    holdLook(look);
    if (how === 'slats') useSlatsOnce();
    if (how === 'cut') setTimeout(cutScreen(), lookCutMilliseconds);
    pagesAgain();
  } catch (error) {
    console.error('The look could not change by the swap "' + how + '". It changes at the next page change.', error);
    try {
      holdLook(look);
    } catch (second) {
      console.error('The look could not be held either', second);
    }
  } finally {
    swapping = false;
  }
}

// schedule.js asks at the end of every pass of the large panel. True means the list starts again.
async function atPass(now) {
  const result = rotation.boundary(now);
  if (result.look) await swap(result.look, result.swap);
  return result.moved;
}

// The Next look now button: the rotation moves to the next pass at once, and every list starts again
// from its first panel
function pressed(now) {
  const result = rotation.next(now);
  if (!result.moved && !result.look) return;

  rewindRotation();
  if (result.look) swap(result.look, result.swap);
  else pagesAgain();
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
  setLookHooks({ atPass: atPass, playlist: list => rotation.playlist(list, getContent()) });

  const button = makeNextLookRunner({ getContent: getContent, storage: storage, busy: busy, next: pressed });
  frame.onSecond(now => {
    rotation.keep(now);
    button.look(now);
  });
}
