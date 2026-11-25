// PRINTER: the live camera of a 3D printer while it prints, in the large panel. The Printer file panel beside it (the small frame)
// says what is being printed and how long it takes. core/printers.js adds the panel to the rotation by itself while a printer is
// printing, once for each printer that prints, two minutes each, and takes it out when the print ends (docs/printers.md).
// The page is for the printer named in its step (page.printer). The picture is the file printers/<id>/frame.jpg that the
// Teletraan computer keeps while the printer prints; it is read again twice a second, and the old picture stays up until the new
// one has arrived, so there is no flash. Without a picture yet the page says so.

import { escapeHtml } from '../../core/text.js';
import { frameAddress, hasPrinter, keepFresh, liveTimes, printerOf, printerStillPrinting } from '../../core/printers.js';

const frameSeconds = 0.5;

export function hasContent(content, page) {
  return hasPrinter(page, new Date());
}

export function markupFor(content, now, page) {
  const printer = printerOf(page, now);
  if (!printer) return '<section class="page printer"><p class="empty" data-slat="item">No printer is printing.</p></section>';

  const times = liveTimes(printer, now);
  const percent = times.progress === null ? 0 : times.progress;

  return `
    <section class="page printer" data-printer="${escapeHtml(printer.id)}">
      <div class="header">
        <h2 class="title" data-slat="title">PRINTING</h2>
        <div class="tag" data-slat="tag"><span class="live">LIVE</span><span class="name">${escapeHtml(printer.name.toUpperCase())}</span></div>
      </div>

      <div class="stage" data-slat="item">
        <img class="picture" alt="" data-picture>
        <div class="waiting" data-waiting>${printer.camera ? '' : 'WAITING FOR THE CAMERA'}</div>
        <div class="caption">
          <span class="file" data-file>${escapeHtml(printer.file || 'PRINT')}</span>
          <span class="percent" data-percent>${times.progress === null ? '' : percent + '%'}</span>
          <div class="meter"><div class="fill" data-fill style="width: ${percent}%"></div></div>
        </div>
      </div>
    </section>`;
}

export function mount(host, content, page) {
  host.innerHTML = markupFor(content, new Date(), page);

  const root = host.firstElementChild;
  const printer = printerOf(page, new Date());
  if (!root || !printer) return;

  const picture = root.querySelector('[data-picture]');
  const waiting = root.querySelector('[data-waiting]');
  let loading = false;
  let shown = false;

  // The next picture is loaded away from the page and put in when it is there
  function loadPicture() {
    if (loading || root.classList.contains('ended')) return;

    loading = true;
    const probe = new Image();
    probe.onload = () => {
      loading = false;
      picture.src = probe.src;
      if (!shown) {
        shown = true;
        root.classList.add('has-picture');
      }
    };
    probe.onerror = () => {
      loading = false;
    };
    probe.src = frameAddress(printer.id);
  }

  keepFresh(root, () => {
    const now = new Date();
    const live = printerStillPrinting(printer.id, now);
    if (!live) {
      root.classList.add('ended');
      waiting.textContent = 'PRINT ENDED';
      return;
    }

    const times = liveTimes(live, now);
    const percent = times.progress === null ? 0 : times.progress;
    root.querySelector('[data-percent]').textContent = times.progress === null ? '' : percent + '%';
    root.querySelector('[data-fill]').style.width = percent + '%';
    root.querySelector('[data-file]').textContent = live.file || 'PRINT';
    if (!shown) waiting.textContent = live.camera ? '' : 'WAITING FOR THE CAMERA';
  }, 1);
  keepFresh(root, loadPicture, frameSeconds);
}
