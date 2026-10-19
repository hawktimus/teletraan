// The Status tab: what is on the wall, a live preview, the buttons that change it, and the health of the computer.
// The pieces are in now.js (card, preview, controls) and health.js (dots, reads, restart and sync).
//
// One page for every screen. A width word on the root (wide from 900 px, medium from 600, narrow below) picks the
// layout in tabs.css: two columns when wide, one column with a bar of three buttons at the bottom when not. The groups
// of controls and the health block are folded sections. When wide they are always open; when narrow one group is open
// at a time and health starts closed.

import { registerTab } from '../tabs.js';
import { mountNow } from './now.js';
import { mountHealth } from './health.js';
import { quickBarHtml } from './render.js';

export function widthWord(width) {
  return width >= 900 ? 'wide' : width >= 600 ? 'medium' : 'narrow';
}

// Keeps the width word, the open state of the folds and the one-open-at-a-time rule. Returns { again, stop }.
function arrange(root) {
  const folds = () => Array.from(root.querySelectorAll('details[data-fold]'));
  let word = '';

  function apply() {
    const next = widthWord(window.innerWidth);
    if (next === word) return;
    const before = word;
    word = next;
    root.dataset.width = word;
    if (word === 'wide') folds().forEach(fold => { fold.open = true; });
    else if (before === 'wide' || before === '') {
      // folding a wide page: the groups close but the one most people want stays
      folds().forEach(fold => { fold.open = fold.dataset.fold === 'open'; });
    }
  }

  // A wide page is not folded: the heading does not close anything
  const onClick = event => {
    if (word === 'wide' && event.target.closest('details[data-fold] > summary')) event.preventDefault();
  };
  // toggle does not bubble, so it is caught on the way down
  const onToggle = event => {
    const fold = event.target;
    if (word === 'wide' || !fold.matches || !fold.matches('details[data-group]') || !fold.open) return;
    folds().forEach(other => { if (other !== fold && other.matches('[data-group]')) other.open = false; });
  };

  root.addEventListener('click', onClick);
  root.addEventListener('toggle', onToggle, true);
  window.addEventListener('resize', apply);
  apply();
  return {
    // groups drawn after the first run are folded or opened by the same rule
    again() { word = ''; apply(); },
    stop() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('toggle', onToggle, true);
      window.removeEventListener('resize', apply);
    },
  };
}

registerTab({
  id: 'status',
  title: 'Status',
  order: 10,
  async render(container) {
    container.innerHTML = '<div class="tab status-page">' +
      '<div class="cols">' +
      '<div class="left"><p class="held" data-held-box data-held="no">Following the schedule.</p><div data-card></div><div data-preview-card></div></div>' +
      '<div class="right" data-controls></div>' +
      '</div>' +
      '<details class="health" data-fold><summary>Health</summary>' +
      '<div data-health-body></div>' +
      '<section class="card"><h2>Restart and sync</h2><div data-health-buttons></div></section>' +
      '</details>' +
      quickBarHtml() +
      '</div>';
    const root = container.querySelector('.status-page');
    const find = name => container.querySelector('[' + name + ']');
    const layout = arrange(root);
    const stops = await Promise.all([
      mountNow({ root: root, cardBox: find('data-card'), previewBox: find('data-preview-card'), controls: find('data-controls'), heldBox: find('data-held-box') }),
      mountHealth(find('data-health-body'), find('data-health-buttons')),
    ]);
    layout.again();
    return () => { layout.stop(); stops.forEach(stop => { if (typeof stop === 'function') stop(); }); };
  },
});
