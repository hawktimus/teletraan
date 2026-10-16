// The PARTS REQUEST panel of the small frame: a QR code of the address in Dashboard Settings (partsRequestUrl) and the words
// SCAN TO REQUEST A PART. With no address, or one the code cannot hold, it says LINK NOT SET and the rotation skips it
// (core/qr.js draws the code as the rects of one path).

import { qrMatrix, qrPath } from '../../core/qr.js';
import { escapeHtml } from '../../core/text.js';

const quiet = 4;

function codeFor(content) {
  const settings = content && content.settings ? content.settings : {};
  const url = typeof settings.partsRequestUrl === 'string' ? settings.partsRequestUrl : '';

  return url === '' ? null : qrMatrix(url);
}

export function hasContent(content) {
  return codeFor(content) !== null;
}

function codeMarkup(matrix) {
  const side = matrix.size + quiet * 2;

  return `
    <svg class="qr" viewBox="0 0 ${side} ${side}" width="224" height="224" role="img" aria-label="QR code to request a part" shape-rendering="crispEdges">
      <rect class="qr-light" width="${side}" height="${side}"/>
      <path class="qr-dark" d="${qrPath(matrix, quiet)}"/>
    </svg>
    <div class="caption">SCAN TO REQUEST A PART</div>`;
}

export function mount(host, content) {
  const matrix = codeFor(content);

  host.innerHTML = `
    <section class="page qr-parts">
      <div class="label" data-slat="label">PARTS REQUEST</div>

      <div class="content" data-slat="content">${matrix ? codeMarkup(matrix) : `<div class="not-set">${escapeHtml('LINK NOT SET')}</div>`}</div>
    </section>`;
}
