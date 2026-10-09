// Counts down to Kickoff, then to Rollout. The nearer the date, the more
// serious the panel looks (see data-level in countdown.css). This is the
// countdown of the standard layout, in its red frame. The parts, and the code
// that writes the numbers, are in core/countdown.js, which the sidebar layout's
// panel (panels/side) uses too.
//
// The bar layout has no countdown panel. Its banner draws the war clock instead,
// which is this countdown a third time: warMarkup() is put in the banner's slot
// (panels/bar-banner), and startWar() gives it the same dates, label and tick.

import { plateMarkup, scanMarkup, warHousingMarkup } from '../../core/plate.js';
import { countdownParts, startCountdown, updateCountdown } from '../../core/countdown.js';

export function mount(host, content) {
  host.innerHTML = `
    <section class="panel countdown" data-sequence="countdown" data-level="calm">
      ${plateMarkup('countdown')}
      ${scanMarkup('countdown')}
      ${countdownParts(564)}
    </section>`;

  startCountdown(host.firstElementChild, content);
}

// New content from the editors, for example a changed date
export function update(element, content) {
  updateCountdown(element, content);
}


// The war clock. It is 700 by 120 and has a few parts, all placed by hand (countdown.css):
// the housing, the label over the date, the days on a plate and the hours, minutes and
// seconds on another. The parts carry the class names that core/countdown.js looks for,
// and none of them is named in the entrance table of frame.js, so the clock arrives with
// the slot it is in.
export function warMarkup() {
  return `
    <div class="war-clock" data-level="calm" data-over="no">
      ${warHousingMarkup()}
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
