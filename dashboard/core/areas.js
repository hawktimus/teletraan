// The three areas that keep their frame while the page inside changes: the
// large panel (grid1), the small panel (grid2) and the ticker.
//
// An area is made the first time a page needs it, so a screen that shows
// only the Tasks panel (?show=tasks) draws only the large frame. It is a
// <div class="area"> in the region's element:
//
//   <div class="area" data-area="grid1" data-state="in" data-metal="gold">
//     the plate and the frame's four layers and the glint (plate.js)
//     the pieces the frame breaks into, hidden until a mechanical change (plate.js)
//     <div class="page-host">the page of the panel on screen</div>
//   </div>
//
// changePage() is the one call that moves a region from the page it shows to
// the next. The scheduler decides which page and when; frame.js does the
// moving and chooses how (planChange); this file puts the right things in the
// right places, and changes the frame's metal while the frame is apart.
//
// The banner, the countdown, the alert and the announcement have no area.
// Each draws its own frame and arrives and leaves as one piece (frame.enter
// and frame.exit). shell.js and takeover.js show them directly. Only ?show
// sends one through changePage, and then it takes the second path below.
//
// Now and then a hidden transition replaces the page change of the large panel
// (core/hidden-run.js, docs/hidden-transitions.md). The whole screen comes
// apart, the pages of all three areas are swapped while nothing can be seen,
// and the screen comes back together. This file only makes room for it: it
// asks for the transition at each page change of the large panel, and the
// other areas wait for the moment the screen is apart (startWholeScreen).

import * as frame from '../frame.js';
import { areaMarkup, frameKind } from './plate.js';
import { hostFor, placeWholePanel } from './panels.js';
import { changeThemeNow } from './theme-apply.js';
import { changeTeamNow } from './teams.js';
import { hasRegion, layoutNow } from './layout.js';
import { shapesNow } from './style.js';

const areaRegions = ['grid1', 'grid2', 'ticker'];
const themeRegion = 'grid1'; // a new theme and a new team go on when this region's frame is apart
const hiddenRegion = 'grid1'; // a hidden transition may replace a page change of this region
const areaOf = {};  // region -> its area element, while it exists
const showing = {}; // region -> the page on screen there, as buildPage() made it

// grid1 and grid2 have a frame. The ticker has none, only its two slats, except in
// the bar layout, where it has a frame of its own and so does the large panel
// (frameKind in plate.js, with the corners the page's style has).
function makeArea(region) {
  const kind = frameKind(region, layoutNow(), shapesNow());
  const element = document.createElement('div');
  element.className = 'area';
  element.dataset.area = region;
  element.dataset.state = 'in';
  if (region !== 'ticker') element.dataset.metal = frame.firstFinish(); // the page frame's own metal, see tokens.css
  element.innerHTML = (kind === 'ticker' ? '' : areaMarkup(kind)) + '<div class="page-host"></div>';

  document.getElementById('region-' + region).appendChild(element);
  areaOf[region] = element;
  return element;
}

// core/hidden-run.js gives this function, once, when it starts. It is called at
// each page change of hiddenRegion and answers null (change page as usual) or
// { play(swapPage) }. play() puts on the show and calls swapPage() at the moment
// the screen is apart. It resolves with how many milliseconds the screen took to
// come back together, and never throws.
let hiddenOffer = null;

export function setHiddenOffer(offer) {
  hiddenOffer = offer;
}

// While a hidden transition has the screen there is a gate. It goes from
// 'before' (the screen is still together) to 'apart' (swap the pages now,
// nobody can see it) to 'after' (the screen is coming back together). A region
// that wants to change page in the meantime waits at the gate. startWholeScreen()
// makes it and hands the transition the way to move it along.
let gate = null;

export function startWholeScreen() {
  const mine = { state: 'before' };
  gate = mine;

  return {
    apart: () => { mine.state = 'apart'; },
    together: () => { mine.state = 'after'; },
    // Ends the transition, however it ended. Regions that waited carry on.
    end: () => { if (gate === mine) gate = null; },
  };
}

// The change a frame makes now, from frame.planChange(). The bar layout has steel
// frames in both of its styles, and steel is the metal whatever the page change says
// (tokens.css), so the finish is never changed there: a frame that fades out and in to
// change a color that does not change would only flicker.
function planFor(area) {
  const change = frame.planChange(area);
  return layoutNow() === 'bar' ? { style: change.style, finish: null } : change;
}

// Puts the next page in a region at once, with nothing to see: for a screen that
// is apart. The frame's metal is chosen as in a page change, so it still varies.
function swapUnseen(region, next) {
  const area = areaOf[region] || null;

  if (!next) {
    if (area) area.remove();
    delete areaOf[region];
    return;
  }

  if (area && region !== 'ticker') {
    const change = planFor(area);
    if (change.finish) area.dataset.metal = change.finish;
  }
  const made = area || makeArea(region);
  made.dataset.state = 'shown'; // a new area would start its first assembly, and nobody is there to see it
  const host = made.querySelector('.page-host');
  host.innerHTML = '';
  host.appendChild(next.element);
  if (region === themeRegion) changeThemeNow();
  if (region === themeRegion) changeTeamNow();
}

// Moves a region from its page to the next one. next is what buildPage()
// returned, or null to leave the region empty. It resolves when the next
// page has arrived, with how many milliseconds the arrival took (the old
// page leaving is not counted). It is not called again for a region until it
// resolves.
export async function changePage(region, next) {
  if (!hasRegion(layoutNow(), region)) return 0; // the layout has no such region, so no area is made for it
  if (!areaRegions.includes(region)) return changeWholePanel(region, next);

  const old = showing[region] || null;
  const area = areaOf[region] || null;
  showing[region] = next;

  // A hidden transition has the screen. Wait for the moment it is apart and
  // swap the page then. If it ends some other way, change page as usual once the
  // screen is whole again.
  if (gate) {
    while (gate && gate.state === 'before') await frame.wait(100);
    if (gate && gate.state === 'apart') {
      swapUnseen(region, next);
      return 0;
    }
    while (gate) await frame.wait(100);
    showing[region] = old; // as it was, so the call below starts from the page that is on screen
    return changePage(region, next);
  }

  // The page change of the large panel may become a hidden transition
  if (old && next && region === hiddenRegion && hiddenOffer) {
    const offered = hiddenOffer();
    if (offered) {
      let swapped = false;
      const took = await offered.play(() => {
        swapped = true;
        swapUnseen(region, next);
      });
      // If the screen was stopped before the pages swapped, change page as usual below
      if (swapped) return took;
    }
  }

  if (old && next) {
    // The old page leaves, in the style planChange picked. The frame stays, or
    // breaks into pieces, depending on the style.
    const change = planFor(area);
    await frame.leave(area, change);
    // The frame is apart now, the moment the new metal goes on and a waiting
    // theme goes on (core/theme-apply.js)
    if (change.finish) area.dataset.metal = change.finish;
    if (region === themeRegion) changeThemeNow();
    if (region === themeRegion) changeTeamNow();
  } else if (old) {
    // There is no next page, so the frame goes too
    await frame.retire(area);
    area.remove();
    delete areaOf[region];
  }

  if (!next) return 0;

  const arrivalStart = performance.now();
  const first = !areaOf[region];
  const host = (areaOf[region] || makeArea(region)).querySelector('.page-host');
  host.innerHTML = ''; // the old page, with its elements and listeners, is gone for good
  host.appendChild(next.element);
  await frame.arrive(areaOf[region], first);
  return performance.now() - arrivalStart;
}

// A region with no area: the panel in it draws everything, and leaves as one piece
async function changeWholePanel(region, next) {
  const old = showing[region] || null;
  showing[region] = next;

  if (old) {
    await frame.exit(old.element);
    old.element.remove();
  }
  if (!next) return 0;

  const arrivalStart = performance.now();
  placeWholePanel(next);
  await frame.enter(next.element);
  return performance.now() - arrivalStart;
}

// After something went wrong: takes whatever is in the region off the
// screen at once, so the next page starts from nothing.
export function clearRegion(region) {
  if (areaOf[region]) areaOf[region].remove();
  delete areaOf[region];
  if (showing[region] && !areaRegions.includes(region)) hostFor(region).innerHTML = '';
  showing[region] = null;
}
