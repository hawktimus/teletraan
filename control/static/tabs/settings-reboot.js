// The Scheduled reboot section of Settings: the switch, the time, the days and the skip rule of the reboot of the Teletraan
// computer. The Studio stays the source of truth: this reads Dashboard Settings from Sanity (through the control service),
// saves to the draft the Studio also uses, and publishes with its own button after the owner says yes. The write key is
// never in the browser. The markup functions touch nothing, so tests/control-reboot.test.mjs can try them with node.

import { api, showResult, useStyles } from './api.js';
import { agoText, esc } from './render.js';

// Sunday first, as the Studio lists them
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const publishQuestion = 'Publish puts every waiting change of Dashboard Settings on the wall, including edits made in the Studio. The Teletraan computer reads the schedule within 5 minutes. Publish now?';
export const replaceQuestion = 'The Studio has a newer copy of Dashboard Settings. Replace the reboot values in it with the ones on this page?';

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
  const days = dayNames.map((name, index) =>
    '<label class="check"><input type="checkbox" data-day="' + index + '"' + (setting.rebootDays.includes(index) ? ' checked' : '') + '> ' + esc(name) + '</label>').join(' ');
  const zone = page.status && page.status.zone ? ' It uses the time zone on the Look page (' + esc(page.status.zone) + ').' : '';
  const lines = [];
  if (!page.hasDocument) lines.push('<p class="warn">Dashboard Settings has not been published yet. Open it in the Studio, click Publish once, and come back.</p>');
  if (!page.canWrite) lines.push('<p class="warn">SANITY_WRITE_TOKEN is not set on the Teletraan computer, so this card can read but not save. Add it in Keys.</p>');
  if (page.status && page.status.unreadable) lines.push('<p class="warn">The next and last reboot could not be read from Sanity just now.</p>');
  if (page.isDraft && page.studioNewer) lines.push('<p class="note">A draft is waiting. The computer uses the published schedule until it is published.</p>');

  return '<section class="card reboot-card"><h2>Scheduled reboot</h2>' +
    '<p data-next><strong>' + esc(words.next) + '</strong></p><p data-last>' + esc(words.last) + '</p>' +
    lines.join('') +
    '<label class="check"><input type="checkbox" data-enabled' + (setting.rebootEnabled ? ' checked' : '') + '> Reboot on a schedule</label>' +
    '<label class="pick"><span>Reboot at</span><input type="time" data-time value="' + esc(setting.rebootTime) + '"></label>' +
    '<div class="pick"><span>Reboot on</span>' + days + '</div>' +
    '<label class="check"><input type="checkbox" data-skip' + (setting.rebootSkipBusy ? ' checked' : '') + '> Not while a talk, an alert or an announcement is playing</label>' +
    '<label class="pick"><span>Wait up to (minutes), then reboot anyway</span><input type="number" inputmode="numeric" min="1" max="120" step="1" data-wait value="' + esc(setting.rebootWaitMinutes) + '"></label>' +
    '<div class="buttons"><button type="button" class="act" data-save>Save to draft</button>' +
    '<button type="button" class="act" data-publish>Publish</button></div>' +
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
  container.innerHTML = '<p class="note">Reading the schedule.</p>';
  let page = null;

  async function load() {
    const answer = await api('GET', '/reboot');
    if (!answer.ok) {
      container.innerHTML = '<p class="warn">' + esc(answer.error) + '</p>';
      return false;
    }
    page = answer.data;
    container.innerHTML = rebootHtml(page);
    container.querySelector('[data-save]').addEventListener('click', event => save(event.currentTarget, false));
    container.querySelector('[data-publish]').addEventListener('click', event => publish(event.currentTarget, false));
    return true;
  }

  async function save(button, force) {
    const setting = readForm(container);
    if (Number.isNaN(setting.rebootWaitMinutes)) return showResult(button, 'bad', 'Wait up to should be a whole number of minutes from 1 to 120.');
    showResult(button, 'working', 'Saving to the draft.');
    const answer = await api('POST', '/reboot/save', { setting: setting, baseRev: page.rev, force: force });
    if (!answer.ok && answer.data && answer.data.conflict) {
      if (window.confirm(replaceQuestion)) return save(button, true);
      return showResult(button, 'wait', 'Nothing was saved. Press Refresh in the browser to see the Studio copy.');
    }
    if (!answer.ok) return showResult(button, 'bad', answer.error);
    if (await load()) showResult(container.querySelector('[data-save]'), 'done', 'Saved to the draft. Press Publish when you are ready.');
  }

  async function publish(button, force) {
    if (!force && !window.confirm(publishQuestion)) return showResult(button, 'wait', 'Nothing was published.');
    showResult(button, 'working', 'Publishing.');
    const answer = await api('POST', '/reboot/publish', { rev: page.rev, force: force, confirm: true });
    if (!answer.ok && answer.data && answer.data.conflict) {
      if (window.confirm('The draft changed in the Studio after this page loaded it. Publish the newer draft?')) return publish(button, true);
      return showResult(button, 'wait', 'Nothing was published.');
    }
    if (!answer.ok) return showResult(button, 'bad', answer.error);
    if (await load()) showResult(container.querySelector('[data-publish]'), 'done', 'Published. The computer reads the schedule within 5 minutes.');
  }

  await load();
}
