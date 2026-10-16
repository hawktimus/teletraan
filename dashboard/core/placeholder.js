// The panels that are placed in the rotation now and designed later (config.js, placeholderPanels): a title and a dashed
// inner frame, nothing else. They have content always, so a row for one is never skipped.

import { escapeHtml } from './text.js';

export function placeholderMarkup(id, title) {
  return `
    <section class="page monday placeholder ${id}">
      <div class="header"><h2 class="title" data-slat="title">${escapeHtml(title)}</h2></div>
      <div class="body" data-slat="item"><div class="placeholder-frame"></div></div>
    </section>`;
}
