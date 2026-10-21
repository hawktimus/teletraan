// The Log section of Settings: the last 200 lines of the control log and of the helper log (1000 with Verbose), and a
// download of one text file for a coach. The service takes the keys and calendar links out of everything it sends.

import { api, showResult, useStyles } from './api.js';
import { logHtml, outcome, pageLoadsLine } from './render.js';

export const hiddenWords = 'Keys and calendar links are hidden in this file. It is safe to send to a coach.';

// The name the service gave the file, or a name made here when the header cannot be read
function fileNameOf(response) {
  const found = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '');
  return found ? found[1] : 'teletraan-log-' + new Date().toISOString().slice(0, 10) + '.txt';
}

async function download() {
  try {
    const response = await fetch('/control/api/log/download', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) {
      let reason = 'The log file could not be made (' + response.status + ').';
      try { reason = (await response.json()).error || reason; } catch (error) { /* keep the status text */ }
      return { ok: false, error: reason };
    }
    const name = fileNameOf(response);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(await response.blob());
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    return { ok: true, name: name };
  } catch (error) {
    return { ok: false, error: 'The Teletraan computer could not be reached. Check the WiFi, or use the Tailscale name.' };
  }
}

export async function mountLog(container) {
  useStyles();
  container.innerHTML = '<div class="buttons"><button type="button" class="act" data-refresh>Refresh</button>' +
    '<label class="check"><input type="checkbox" data-verbose> Verbose (1000 lines)</label></div>' +
    '<div class="buttons"><button type="button" class="act quiet" data-download>Download the verbose log</button></div>' +
    '<p class="note">' + hiddenWords + '</p><p class="note" data-loads></p><div data-body></div>';
  const body = container.querySelector('[data-body]');
  const refresh = container.querySelector('[data-refresh]');
  const verbose = container.querySelector('[data-verbose]');
  const save = container.querySelector('[data-download]');

  async function load(shown) {
    const now = await api('GET', '/now');
    container.querySelector('[data-loads]').textContent = now.ok ? pageLoadsLine(now.data) : 'Page loads in the last 24 hours: the wall could not be asked.';
    const answer = await api('GET', '/log' + (verbose.checked ? '?verbose=1' : ''));
    body.innerHTML = answer.ok
      ? logHtml(answer.data.lines, 'Control log') + logHtml(answer.data.helperLines, 'Helper log')
      : '<section class="card"><h2>Log</h2><p></p></section>';
    if (!answer.ok) body.querySelector('p').textContent = answer.error;
    body.querySelectorAll('.log').forEach(log => { log.scrollTop = log.scrollHeight; });
    if (shown) {
      const result = outcome(answer, 'refresh');
      showResult(refresh, result.state, result.state === 'done' ? result.words + ' ' + (answer.data.lines || []).length + ' lines.' : result.words);
    }
  }
  refresh.addEventListener('click', () => load(true));
  verbose.addEventListener('change', () => load(false));
  save.addEventListener('click', async () => {
    save.disabled = true;
    showResult(save, 'working', 'Making the file.');
    const result = await download();
    save.disabled = false;
    if (result.ok) showResult(save, 'done', 'Done. The file ' + result.name + ' is saved in your downloads. ' + hiddenWords);
    else showResult(save, 'bad', result.error);
  });
  await load(false);
}
