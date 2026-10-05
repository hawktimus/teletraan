// The three areas that keep their frame while the page inside changes: the
// large panel (grid1), the small panel (grid2) and the ticker.
//
// An area is made the first time a page needs it, so a screen that shows
// only the Tasks panel (?show=tasks) draws only the large frame. It is a
// <div class="area"> in the region's element:
//
//   <div class="area" data-area="grid1" data-state="in">
//     the plate and the frame's four layers and the glint (plate.js)
//     <div class="page-host">the page of the panel on screen</div>
//   </div>
//
// changePage() is the one call that moves a region from the page it shows to
// the next. The scheduler decides which page and when; frame.js does the
// moving; this file puts the right things in the right places.
//
// The banner, the countdown, the alert and the announcement have no area.
// Each draws its own frame and arrives and leaves as one piece (frame.enter
// and frame.exit). shell.js and takeover.js show them directly. Only ?show
// sends one through changePage, and then it takes the second path below.

import * as frame from '../frame.js';
import { areaMarkup } from './plate.js';
import { hostFor, placeWholePanel } from './panels.js';
import { changeThemeNow } from './theme-apply.js';

const areaRegions = ['grid1', 'grid2', 'ticker'];
const themeRegion = 'grid1'; // a new theme goes on when this region's frame is apart
const areaOf = {};  // region -> its area element, while it exists
const showing = {}; // region -> the page on screen there, as buildPage() made it

// grid1 and grid2 have a frame. The ticker has none, only its two slats.
function makeArea(region) {
  const element = document.createElement('div');
  element.className = 'area';
  element.dataset.area = region;
  element.dataset.state = 'in';
  element.innerHTML = (region === 'ticker' ? '' : areaMarkup(region)) + '<div class="page-host"></div>';

  document.getElementById('region-' + region).appendChild(element);
  areaOf[region] = element;
  return element;
}

// Moves a region from its page to the next one. next is what buildPage()
// returned, or null to leave the region empty. It resolves when the next
// page has arrived, with how many milliseconds the arrival took (the old
// page leaving is not counted). It is not called again for a region until it
// resolves.
export async function changePage(region, next) {
  if (!areaRegions.includes(region)) return changeWholePanel(region, next);

  const old = showing[region] || null;
  const area = areaOf[region] || null;
  showing[region] = next;

  if (old && next) {
    // The old page's last second. The frame stays.
    await frame.leave(area);
    // The frame is apart now, the moment a waiting theme goes on (core/theme-apply.js)
    if (region === themeRegion) changeThemeNow();
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
