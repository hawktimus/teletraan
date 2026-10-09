// The banner of the bar layout (docs/layouts.md, "The bar layout"): the team name at
// one end and, at the other, the slot for the war clock. It is one of the two panels
// that stay on screen in that layout, in place of the banner, and it is drawn into
// #region-banner, inside its own frame (plateMarkup in core/plate.js, "The frames of the
// bar layout", with the corners the page's style has). The clock, the date, the weather,
// the TEAM plate, the school and the logo are in the side column (panels/bar-column).

import { nameMarkup } from '../../core/name.js';
import { frameKind, plateMarkup } from '../../core/plate.js';
import { shapesNow } from '../../core/style.js';
import { teamShown } from '../../core/teams.js';

// The war clock's slot is empty until the war clock is drawn into it. It is 700 by 120
// (barSettings.warClock in core/layout.js), and its place at the other end of the banner
// from the name is what the mirror turns round (layouts/bar.css)
export function mount(host, content) {
  host.innerHTML = `
    <section class="panel bar-banner" data-sequence="bar-banner">
      ${plateMarkup(frameKind('banner', 'bar', shapesNow()))}
      <h1 class="bar-name" data-part="title" data-name-effect></h1>
      <div class="bar-war" data-part="war"></div>
    </section>`;

  const element = host.firstElementChild;
  update(element, content);
}

// The name is made of letters so the name effect can split each one. It is only
// rebuilt when the name changes, because a rebuild in the middle of the effect would
// start it again. It is one line: a name too long for its slot squeezes its letters
// together (panels/bar-banner/bar-banner.css), so the war clock never moves.
export function update(element, content) {
  const heading = element.querySelector('.bar-name');
  const name = teamShown(content).name;
  if (heading.dataset.name === name) return;

  heading.dataset.name = name;
  heading.innerHTML = nameMarkup(name);
}
