// The Show area: what is on the TV. The first section, On the TV, says what the TV plays now (view, theme, panel, whether
// the rotation is paused and who decides), shows a live picture of it, and holds everything that changes how the TV plays:
// the rotation rows, the themes by weekday, Pause, Next, Show on the wall, the previews and the quick hide buttons. The other
// sections are what the TV says: Photos, Announcements, Roster, Ticker and news, and Calendar. Each starts from the same answers
// the old Status, Display and Content tabs used, so nothing about saving, publishing or the revision check changed.

import { el } from '../dom.js';
import { mountSections } from './sections.js';
import { mountCard } from '../tabs/now.js';
import { mountDisplay } from '../tabs/display.js';
import { previewCardHtml } from '../tabs/render.js';
import { wirePreview } from '../tabs/preview.js';
import { blocks, mountBlock } from '../tabs/content-blocks.js';

// The held line, the card of what the TV shows, the live picture and then the Display page
async function mountPlaying(body) {
  const top = el('div', 'show-top');
  top.innerHTML = '<p class="held" data-held-box data-held="no">Following the schedule.</p>' +
    '<div class="show-live"><div data-wall-card></div><div data-live-card></div></div>';
  const display = el('div', 'show-display');
  body.append(top, display);
  const previewBox = top.querySelector('[data-live-card]');
  previewBox.innerHTML = previewCardHtml();
  const stopPreview = wirePreview(previewBox);
  const stops = await Promise.all([
    mountCard({ cardBox: top.querySelector('[data-wall-card]'), heldBox: top.querySelector('[data-held-box]') }),
    mountDisplay(display),
  ]);
  return () => { stopPreview(); stops.forEach(stop => { if (typeof stop === 'function') stop(); }); };
}

export const sections = [
  { id: 'playing', title: 'On the TV', mount: mountPlaying },
].concat(blocks.map(block => ({ id: block.id, title: block.title, lead: block.says, mount: body => mountBlock(body, block.id) })));

export function mountShow(box, section) {
  return mountSections(box, { area: 'show', title: 'Show', sections: sections }, section === 'playing' ? '' : section);
}
