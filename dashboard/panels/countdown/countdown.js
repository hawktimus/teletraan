// Counts down to Kickoff, then to Rollout. The nearer the date, the more
// serious the panel looks (see data-level in countdown.css). This is the
// countdown of the standard layout, in its red frame. The parts, and the code
// that writes the numbers, are in core/countdown.js, which the sidebar layout's
// panel (panels/side) uses too.

import { plateMarkup, scanMarkup } from '../../core/plate.js';
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
