// The Scheduled reboot section of Settings: the switch, the time, the days and the skip rule of the reboot of the Teletraan
// computer. The Studio stays the source of truth: this reads Dashboard Settings from Sanity (through the control service),
// saves to the draft the Studio also uses, and publishes with its own button after the owner says yes. The write key is
// never in the browser. The markup functions touch nothing, so tests/control-reboot.test.mjs can try them with node.

import { api, useStyles } from './api.js';
import { agoText, esc } from './render.js';
import { choiceHtml, switchHtml } from '../choice.js';
import { failedHtml, noWriteWords } from '../actions.js';
import { countChanged, mountDraftBar } from '../draft-bar.js';

// Sunday first, as the Studio lists them
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const publishQuestion = 'Publish to the wall puts every waiting change of Dashboard Settings on the wall, including edits made in the Studio. The Teletraan computer reads the schedule within 5 minutes. Publish now?';

// "Next reboot: Tue 03:30" and "Last reboot: 3 hours ago (Tue 03:30, as scheduled)", in plain words
export function statusWords(status, now = new Date()) {
  const info = status || {};
  const next = info.nextText ? info.nextText : 'none planned';
  const last = info.lastAt ? agoText(info.lastAt, now) + (info.lastWhy ? ' (' + info.lastWhy + ')' : '') : 'not yet';
  return { next: 'Next reboot: ' + next, last: 'Last reboot: ' + last };
}

export function rebootHtml(page, now = new Date()) {
  const setting = page.setting;
  const words = statusWords(page.status, now);
  const days = choiceHtml({ multiple: true, label: 'Reboot on', items: dayNames.map((name, index) => ({ value: String(index), label: name, checked: setting.rebootDays.includes(index), attrs: 'data-day="' + index + '"' })) });
  const zone = page.status && page.status.zone ? ' It uses the time zone on the Look page (' + esc(page.status.zone) + ').' : '';
  const lines = [];
  if (!page.hasDocument) lines.push('<p class="warn">Dashboard Settings has not been published yet. Open it in the Studio, click Publish once, and come back.</p>');
  if (!page.canWrite) lines.push('<p class="warn">' + esc(noWriteWords) + '</p>');
  if (page.status && page.status.unreadable) lines.push('<p class="warn">The next and last reboot could not be read from Sanity just now.</p>');
  if (page.isDraft && page.studioNewer) lines.push('<p class="note">A draft is waiting. The computer uses the published schedule until you press Publish to the wall.</p>');

  return '<section class="card reboot-card"><h2>Scheduled reboot</h2>' +
    '<p data-next><strong>' + esc(words.next) + '</strong></p><p data-last>' + esc(words.last) + '</p>' +
    lines.join('') +
    switchHtml({ checked: setting.rebootEnabled, label: 'Reboot on a schedule', attrs: 'data-enabled' }) +
    '<label class="pick"><span>Reboot at</span><input type="time" data-time value="' + esc(setting.rebootTime) + '"></label>' +
    '<div class="pick"><span>Reboot on</span>' + days + '</div>' +
    switchHtml({ checked: setting.rebootSkipBusy, label: 'Not while a talk, an alert or an announcement is playing', attrs: 'data-skip' }) +
    '<label class="pick"><span>Wait up to (minutes), then reboot anyway</span><input type="number" inputmode="numeric" min="1" max="120" step="1" data-wait value="' + esc(setting.rebootWaitMinutes) + '"></label>' +
    '<div data-draft></div>' +
    '<p class="note">' + 'The Studio shows the same values in Dashboard Settings, Advanced, Scheduled reboot.' + zone + ' The screen goes dark while the computer restarts.</p>' +
    '</section>';
}

// The values on the page, as the stored fields
export function readForm(container) {
  const days = Array.from(container.querySelectorAll('[data-day]')).filter(box => box.checked).map(box => Number(box.dataset.day));
  const wait = container.querySelector('[data-wait]').value.trim();
  return {
    rebootEnabled: container.querySelector('[data-enabled]').checked,
    rebootTime: container.querySelector('[data-time]').value,
    rebootDays: days,
    rebootSkipBusy: container.querySelector('[data-skip]').checked,
    rebootWaitMinutes: /^[0-9]{1,3}$/.test(wait) ? Number(wait) : NaN,
  };
}

export async function mountReboot(container) {
  useStyles();
  container.innerHTML = '<p class="note">Reading the schedule from Sanity.</p>';
  let page = null;
  let draft = null;

  // Drawing the card again is also the undo: it puts back the values that were loaded
  function draw() {
    container.innerHTML = rebootHtml(page);
    draft = mountDraftBar(container.querySelector('[data-draft]'), {
      canWrite: () => page.canWrite,
      isDraft: () => page.isDraft,
      dirty: () => countChanged(page.setting, readForm(container)),
      problem: () => (Number.isNaN(readForm(container).rebootWaitMinutes) ? 'Wait up to should be a whole number of minutes from 1 to 120.' : ''),
      save: force => api('POST', '/reboot/save', { setting: readForm(container), baseRev: page.rev, force: force }),
      publish: force => api('POST', '/reboot/publish', { rev: page.rev, force: force, confirm: true }),
      reload: load,
      undo: draw,
      publishQuestion: publishQuestion,
      publishedWords: 'Published. The computer reads the schedule within 5 minutes.',
    });
  }

  async function load() {
    const answer = await api('GET', '/reboot');
    if (!answer.ok) {
      container.innerHTML = failedHtml('The reboot schedule', answer.error);
      return false;
    }
    page = answer.data;
    draw();
    return true;
  }

  container.addEventListener('input', () => { if (draft) draft.paint(); });
  container.addEventListener('change', () => { if (draft) draft.paint(); });
  container.addEventListener('click', event => { if (event.target.closest('[data-act="retry"]')) load(); });
  await load();
}
