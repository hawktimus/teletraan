// Only used by ?stress. It fills the small panel area with a panel of the
// real size and the widest numbers, so the hardware test sees the whole
// screen moving and not just one panel.

import { plateMarkup } from '../../core/plate.js';
import { bayMarkup } from '../../core/marks.js';

export function mount(host) {
  host.innerHTML = `
    <section class="panel stand-in-tile" data-sequence="grid2">
      ${plateMarkup('grid2')}
      ${bayMarkup()}
      <div class="tile-label" data-part="label">OPEN TASKS</div>
      <div class="tile-content" data-part="content">
        <div class="tile-count">[8]</div>
        <div class="tile-groove"></div>
        <div class="tile-lines">
          <div>[2 blocked]</div>
          <div>[2 up next]</div>
        </div>
      </div>
    </section>`;
}
