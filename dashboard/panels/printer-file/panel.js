// PRINTER FILE: what a 3D printer is printing, in the small panel beside the Printer camera: the name of the file, the printer, the
// time so far, the time left, the time of day it will be done, and the layer. It is for the printer named in its step
// (page.printer, from sidePage of the step of the large panel, core/views-play.js, pairSide). The numbers run on by the second
// between the readings of the printer (liveTimes in core/printers.js). docs/printers.md.

import { escapeHtml } from '../../core/text.js';
import { durationWords, finishWords, hasPrinter, keepFresh, liveTimes, printerOf, printerStillPrinting, zoneOf } from '../../core/printers.js';

export function hasContent(content, page) {
  return hasPrinter(page, new Date());
}

function numbersMarkup(printer, content, now) {
  const times = liveTimes(printer, now);
  const layers = printer.layer !== null && printer.totalLayer !== null && printer.totalLayer > 0 ? printer.layer + ' / ' + printer.totalLayer : '--';

  return `
    <div class="numbers">
      <div class="figure"><span class="key">ELAPSED</span><span class="value" data-elapsed>${escapeHtml(durationWords(times.elapsed))}</span></div>
      <div class="figure"><span class="key">LEFT</span><span class="value" data-left>${escapeHtml(durationWords(times.remaining))}</span></div>
      <div class="figure"><span class="key">DONE</span><span class="value" data-done>${escapeHtml(finishWords(times.etaAt, now, zoneOf(content)))}</span></div>
      <div class="figure"><span class="key">LAYER</span><span class="value" data-layer>${escapeHtml(layers)}</span></div>
    </div>`;
}

export function markupFor(content, now, page) {
  const printer = printerOf(page, now);
  if (!printer) return '<section class="page printer-file"><div class="label" data-slat="label">PRINTING</div><div class="content" data-slat="content"><p class="empty">No printer is printing.</p></div></section>';

  const times = liveTimes(printer, now);
  const percent = times.progress === null ? 0 : times.progress;

  return `
    <section class="page printer-file" data-printer="${escapeHtml(printer.id)}">
      <div class="label" data-slat="label">${escapeHtml(printer.name.toUpperCase())}</div>

      <div class="content" data-slat="content">
        <div class="job"><span class="file" data-file>${escapeHtml(printer.file || 'PRINT')}</span></div>
        <div class="meter"><div class="track"><div class="fill" data-fill style="width: ${percent}%"></div></div><span class="percent" data-percent>${times.progress === null ? '' : percent + '%'}</span></div>
        ${numbersMarkup(printer, content, now)}
      </div>
    </section>`;
}

export function mount(host, content, page) {
  host.innerHTML = markupFor(content, new Date(), page);

  const root = host.firstElementChild;
  const printer = printerOf(page, new Date());
  if (!root || !printer) return;

  const set = (name, value) => {
    const element = root.querySelector('[' + name + ']');
    if (element) element.textContent = value;
  };

  keepFresh(root, () => {
    const now = new Date();
    const live = printerStillPrinting(printer.id, now);
    if (!live) {
      root.classList.add('ended');
      set('data-percent', 'ENDED');
      return;
    }

    const times = liveTimes(live, now);
    const percent = times.progress === null ? 0 : times.progress;
    root.querySelector('[data-fill]').style.width = percent + '%';
    set('data-percent', times.progress === null ? '' : percent + '%');
    set('data-file', live.file || 'PRINT');
    set('data-elapsed', durationWords(times.elapsed));
    set('data-left', durationWords(times.remaining));
    set('data-done', finishWords(times.etaAt, now, zoneOf(content)));
    set('data-layer', live.layer !== null && live.totalLayer !== null && live.totalLayer > 0 ? live.layer + ' / ' + live.totalLayer : '--');
  }, 1);
}
