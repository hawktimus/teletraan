// The Status tab: what is on the wall now, a live view of it, and the health of the computer. It only shows. Nothing on
// this tab changes the wall: the buttons are on Display (how the wall looks and plays), Content (what it says) and Settings (sync, restart, keys, updates).
//
// One page for every screen. A width word on the root (wide from 900 px, medium from 600, narrow below) picks the layout
// in tabs.css: two columns when wide, one column when not. The health block is a folded section; when wide it is open,
// when narrow it starts closed.

import { registerTab, tabOrder } from '../tabs.js';
import { arrange } from './arrange.js';
import { mountCard } from './now.js';
import { mountHealth } from './health.js';
import { previewCardHtml } from './render.js';
import { wirePreview } from './preview.js';

export const statusLinks = [
  { address: '#display', label: 'Change what is shown: Display' },
  { address: '#content', label: 'Change what it says: Content' },
  { address: '#settings/sync', label: 'Sync and restart: Settings' },
];

registerTab({
  id: 'status',
  title: 'Status',
  order: tabOrder.status,
  async render(container) {
    container.innerHTML = '<div class="tab status-page">' +
      '<div class="cols">' +
      '<div class="info"><p class="held" data-held-box data-held="no">Following the schedule.</p><div data-card></div>' +
      '<section class="card next-links" aria-label="Where to change things"><div class="buttons">' +
      statusLinks.map(link => '<a class="act" href="' + link.address + '">' + link.label + '</a>').join('') + '</div></section></div>' +
      '<div class="live" data-preview-card></div>' +
      '</div>' +
      '<details class="health" data-fold><summary>Health</summary><div data-health-body></div></details>' +
      '</div>';
    const root = container.querySelector('.status-page');
    const find = name => container.querySelector('[' + name + ']');
    const previewBox = find('data-preview-card');
    previewBox.innerHTML = previewCardHtml();
    const stopPreview = wirePreview(previewBox);
    const layout = arrange(root);
    const stops = await Promise.all([
      mountCard({ cardBox: find('data-card'), heldBox: find('data-held-box') }),
      mountHealth(find('data-health-body')),
    ]);
    layout.again();
    return () => { layout.stop(); stopPreview(); stops.forEach(stop => { if (typeof stop === 'function') stop(); }); };
  },
});
