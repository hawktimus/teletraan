// Counts down to Kickoff, then to Rollout. The nearer the date, the more
// serious the panel looks (see data-level in countdown.css). This is the
// countdown of the standard layout, in its red frame. The parts, and the code
// that writes the numbers, are in core/countdown.js, which the sidebar layout's
// panel (panels/side) uses too.
//
// Cybertron has the same region and shows the war clock in its wide form in it, in
// place of the red frame. The bar layout has no countdown panel. Its banner draws the
// war clock instead, in its narrow form. The war clock is this countdown again:
// warMarkup() is put in a slot (here, or in panels/bar-banner), and startWar() gives
// it the same dates, label and tick.

import { plateMarkup, scanMarkup, trimmedKind, warHousingMarkup } from '../../core/plate.js';
import { shapesNow } from '../../core/style.js';
import { trimNow } from '../../core/teams.js';
import { countdownParts, startCountdown, updateCountdown } from '../../core/countdown.js';

// The war clock inside each panel that has one, which is the element the countdown code keeps
// its state for
const clocks = new WeakMap();

export function mount(host, content) {
  if (shapesNow() === 'cybertron') {
    mountWar(host, content);
    return;
  }

  const kind = trimmedKind('countdown', trimNow()); // the frame with the corners the team on the page cuts

  host.innerHTML = `
    <section class="panel countdown" data-sequence="countdown" data-level="calm">
      ${plateMarkup(kind)}
      ${scanMarkup(kind)}
      ${countdownParts(564)}
    </section>`;

  startCountdown(host.firstElementChild, content);
}

// The wide war clock is 616 of the region's 656, in the middle of its height
// (countdown.css). It arrives as one piece: the part called war in the table of frame.js
function mountWar(host, content) {
  host.innerHTML = `
    <section class="panel countdown-war" data-sequence="countdown-war">
      <div class="war-slot" data-part="war">${warMarkup('wide')}</div>
    </section>`;

  const clock = host.querySelector('.war-clock');
  clocks.set(host.firstElementChild, clock);
  startWar(clock, content);
}

// New content from the editors, for example a changed date
export function update(element, content) {
  updateCountdown(clocks.get(element) || element, content);
}


// The war clock. The narrow form is 700 by 120 and the wide form 616 by 200 (form is 'narrow'
// or 'wide'). It has a few parts, all placed by hand (countdown.css): the housing, the label
// and the date, the days on a plate and the hours, minutes and seconds on another. The
// parts carry the class names that core/countdown.js looks for, and none of them is named
// in the entrance table of frame.js, so the clock arrives with the slot it is in.
export function warMarkup(form = 'narrow') {
  const wide = form === 'wide';

  return `
    <div class="war-clock${wide ? ' war-wide' : ''}" data-level="calm" data-over="no">
      ${warHousingMarkup(wide ? 'wide' : 'narrow', trimNow())}
      <span class="war-status"></span>
      <div class="war-lines">
        <span class="label"></span>
        <span class="date"></span>
      </div>
      <div class="war-plate war-days-plate">
        <div class="war-days-group">
          <span class="days-number"><span></span></span>
          <span class="days-word"></span>
        </div>
      </div>
      <div class="war-plate war-time-plate">
        <div class="war-cell"><span class="digits hours"><span></span></span><span class="unit">HRS</span></div>
        <div class="war-cell"><span class="digits minutes"><span></span></span><span class="unit">MIN</span></div>
        <div class="war-cell"><span class="digits seconds"><span></span></span><span class="unit">SEC</span></div>
      </div>
    </div>`;
}

export function startWar(element, content) {
  startCountdown(element, content, { war: true });
}

export function updateWar(element, content) {
  updateCountdown(element, content);
}
