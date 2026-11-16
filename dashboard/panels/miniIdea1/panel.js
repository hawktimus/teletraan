// The MINI PANEL IDEA 1 placeholder of the small frame: its title and a dashed inner frame, until the panel is designed.

import { escapeHtml } from '../../core/text.js';

// A panel that has not been designed has nothing to show: the rotation passes it over until it is (core/placeholder.js)
export function hasContent() {
  return false;
}

export function mount(host) {
  host.innerHTML = `
    <section class="page mini-idea-1">
      <div class="label" data-slat="label">${escapeHtml('MINI PANEL IDEA 1')}</div>

      <div class="content" data-slat="content"><div class="placeholder-frame"></div></div>
    </section>`;
}
