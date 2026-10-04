// Only used by ?stress. See stand-in-tile.js.

import { tagMarkup } from '../../core/plate.js';

export function mount(host) {
  host.innerHTML = `
    <section class="page stand-in-ticker">
      <div class="ticker-tag" data-slat="label">
        ${tagMarkup()}
        <span>NEWS</span>
      </div>
      <div class="ticker-message" data-slat="content">[Placeholder message at about the longest the line allows]</div>
    </section>`;
}
