// The buttons that change what the wall shows now (Playlist, Theme and view, Hold a panel, Messages), as a block at the top
// of the Display tab. They moved here from Status, which only shows. The block is added with extendTab, so the Display
// tab file does not have to know about it; the Display lane can move the groups into its own page and delete this file.

import { extendTab } from '../tabs.js';
import { arrange } from './arrange.js';
import { mountControls } from './now.js';
import { quickBarHtml } from './render.js';

extendTab('display', {
  place: 'before',
  async mount(box) {
    box.innerHTML = '<div class="tab wall-controls">' +
      '<section class="card"><h2>Show on the wall now</h2>' +
      '<p class="word">These change the wall at once and end by themselves, or when you press Back to schedule. The rows below are the saved order.</p></section>' +
      '<p class="held" data-held-box data-held="no">Following the schedule.</p>' +
      '<div class="groups" data-controls></div>' +
      quickBarHtml() +
      '</div>';
    const root = box.querySelector('.wall-controls');
    const layout = arrange(root);
    const stop = await mountControls({ root: root, controls: root.querySelector('[data-controls]'), heldBox: root.querySelector('[data-held-box]') });
    layout.again();
    return () => { layout.stop(); if (typeof stop === 'function') stop(); };
  },
});
