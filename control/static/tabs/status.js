// The Status tab: what is on the wall, a live preview, the buttons that change it, and the health of the computer.
// The pieces are in now.js (card, preview, controls) and health.js (dots, reads, restart and sync).

import { registerTab } from '../tabs.js';
import { mountNow } from './now.js';
import { mountHealth } from './health.js';

registerTab({
  id: 'status',
  title: 'Status',
  order: 10,
  async render(container) {
    container.innerHTML = '<div class="tab status-page">' +
      '<div class="cols">' +
      '<div class="left"><div data-card></div><div data-preview-card></div></div>' +
      '<div class="right" data-controls></div>' +
      '</div>' +
      '<div data-health-body></div>' +
      '<section class="card"><h2>Restart and sync</h2><div data-health-buttons></div></section>' +
      '</div>';
    const find = name => container.querySelector('[' + name + ']');
    const stops = await Promise.all([
      mountNow({ cardBox: find('data-card'), previewBox: find('data-preview-card'), controls: find('data-controls') }),
      mountHealth(find('data-health-body'), find('data-health-buttons')),
    ]);
    return () => stops.forEach(stop => { if (typeof stop === 'function') stop(); });
  },
});
