// The panels that are placed in the rotation now and designed later (config.js, placeholderPanels): a title and a dashed
// inner frame, nothing else. They have no content until they are designed (each panel's hasContent says false), so the
// rotation passes them over instead of showing a dashed box.

import { escapeHtml } from './text.js';

export function placeholderMarkup(id, title) {
  return `
    <section class="page monday placeholder ${id}">
      <div class="header"><h2 class="title" data-slat="title">${escapeHtml(title)}</h2></div>
      <div class="body" data-slat="item"><div class="placeholder-frame"></div></div>
    </section>`;
}
