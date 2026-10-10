// The full screen alert typed in by the editors. It stays until they turn it
// off or its "until" time passes (takeover.js decides that).

import { frameMarkup, rowBarMarkup } from '../../core/plate.js';
import { trimNow } from '../../core/teams.js';
import { escapeHtml, hasText } from '../../core/text.js';

const FALLBACK_HEADLINE = 'ALERT';

// A headline longer than this gets a smaller size, so that even 24 wide
// letters fit in the lines there is room for (see .headline.long in alert.css)
const LONG_HEADLINE = 16;

export function mount(host, content) {
  const alert = content.settings.alert;
  const headline = hasText(alert.headline) ? alert.headline : FALLBACK_HEADLINE;

  // When the headline already says ALERT the label above it would say it twice
  const isFallback = headline.trim().toUpperCase() === FALLBACK_HEADLINE;
  const label = isFallback ? '' : FALLBACK_HEADLINE;

  const size = headline.trim().length > LONG_HEADLINE ? ' long' : '';

  host.innerHTML = `
    <section class="panel alert" data-sequence="alert">
      ${frameMarkup({ red: true, corner: trimNow().corner })}
      <div class="scan-clip" style="width: 1920px; height: 1080px;">
        <div class="scan" data-part="scan" style="height: 1080px; --sweep: 1920px;"></div>
      </div>
      <div class="stripe stripe-top red-metal" data-part="stripe">${rowBarMarkup(1920)}</div>
      <div class="stripe stripe-bottom red-metal" data-part="stripe">${rowBarMarkup(1920)}</div>

      <div class="content">
        <div class="lamp-row"><span class="lamp" data-idle="pulse"></span>${label}</div>
        <div class="headline${size}" data-part="headline">${escapeHtml(headline)}</div>
        <div class="message" data-part="message">${escapeHtml(alert.message)}</div>
      </div>
    </section>`;
}
