// Announcements, a block of the Content tab: the Announcement documents of the Studio, the thin bar under the banner of the wall.
// Each shows its text, when it starts and ends, the team and the level, and a chip: Live now, Waiting or Over. They can be added,
// edited and deleted like the other lists (a change is a draft until Publish). There is no Show switch on this type, so the way
// to take one down is to delete it or to move its end. Above the list, Post now makes a published announcement that starts this
// minute and ends in 5 to 120 minutes, for a notice that cannot wait for a Publish.

import { api as realApi } from './api.js';
import { h } from '../settings-all-fields.js';
import { button, mountList } from './content-list.js';
import { announcementChips, announcementLongest, announcementState, liveCount, postMinutes, sortAnnouncements } from './content-items.js';

const when = iso => (iso && !isNaN(Date.parse(iso)) ? new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'no time');

function row(item, page) {
  const doc = item.document;
  const team = page.teams.filter(one => one.id === (doc.team && doc.team._ref))[0];
  const sub = [
    'Starts ' + when(doc.start),
    'Ends ' + when(doc.end),
    team ? 'For ' + team.name : 'For both teams',
    doc.level === 'important' ? 'Important' : 'Notice',
    item.id === 'push-notice' ? 'Posted from the Display tab' : '',
  ].filter(Boolean).join(' · ');
  return h('div', { class: 'ct-row' }, h('p', { class: 'ct-title', text: doc.text || 'Announcement with no text' }), h('p', { class: 'ct-sub', text: sub }));
}

function postForm(host, ctx, list) {
  const call = ctx.api || realApi;
  const state = { text: '', level: 'notice', minutes: 15, team: '', working: false };
  const flash = h('p', { class: 'ct-flash', role: 'status' });
  const count = h('p', { class: 'ct-sub', 'aria-live': 'polite' });
  const text = h('input', { id: 'ct-post-text', type: 'text', autocomplete: 'off', placeholder: 'Meeting moved to 5:30 today' });
  const level = h('select', { id: 'ct-post-level' }, h('option', { value: 'notice', text: 'Notice' }), h('option', { value: 'important', text: 'Important (red)' }));
  const minutes = h('select', { id: 'ct-post-minutes' }, postMinutes.map(one => h('option', { value: String(one), text: one + ' minutes', selected: one === state.minutes })));
  const team = h('select', { id: 'ct-post-team' }, h('option', { value: '', text: 'Both teams' }));
  const go = button('Post now for 15 minutes', { 'data-act': 'post-now', class: 'act' }, post);

  function refresh() {
    state.text = text.value;
    state.level = level.value;
    state.minutes = Number(minutes.value);
    state.team = team.value;
    const length = state.text.trim().length;
    count.textContent = length + ' of ' + announcementLongest + ' characters.' + (length > announcementLongest ? ' Too long.' : '');
    count.dataset.over = length > announcementLongest ? 'yes' : 'no';
    go.textContent = 'Post now for ' + state.minutes + ' minutes';
    go.disabled = state.working || length === 0 || length > announcementLongest || !list.canWrite();
  }

  async function post() {
    state.working = true;
    refresh();
    flash.dataset.state = 'wait';
    flash.textContent = 'Posting.';
    const answer = await call('POST', '/content/announcement/post', { text: state.text, level: state.level, minutes: state.minutes, team: state.team });
    state.working = false;
    if (answer.ok) {
      text.value = '';
      flash.dataset.state = 'done';
      flash.textContent = 'Posted. The bar goes up within a minute and comes down by itself in ' + state.minutes + ' minutes.';
      refresh();
      return list.reload('done', 'Posted. The bar goes up within a minute.');
    }
    flash.dataset.state = 'bad';
    flash.textContent = answer.error;
    refresh();
  }

  [text, level, minutes, team].forEach(control => {
    control.addEventListener('input', refresh);
    control.addEventListener('change', refresh);
  });
  call('GET', '/docs/announcement').then(answer => {
    if (!answer.ok) return;
    answer.data.teams.forEach(one => team.append(h('option', { value: one.id, text: one.name })));
    refresh();
  });

  host.replaceChildren(h('section', { class: 'ct-post', 'aria-label': 'Post now' },
    h('h3', { class: 'ct-group', text: 'Post now' }),
    h('p', { class: 'word', text: 'For a notice that cannot wait. It starts this minute, is published at once and comes down by itself.' }),
    h('label', { for: 'ct-post-text', text: 'Text' }), text, count,
    h('div', { class: 'ct-triple' },
      h('div', {}, h('label', { for: 'ct-post-level', text: 'Level' }), level),
      h('div', {}, h('label', { for: 'ct-post-minutes', text: 'For how long' }), minutes),
      h('div', {}, h('label', { for: 'ct-post-team', text: 'Team' }), team)),
    h('div', { class: 'buttons' }, go),
    flash));
  refresh();
  return refresh;
}

export async function mountAnnouncements(body, ctx = {}) {
  const postHost = h('div', { 'data-part': 'post' });
  const listHost = h('div', { 'data-part': 'announcements' });
  const note = h('p', { class: 'word', 'data-part': 'live-note' });
  body.replaceChildren(
    h('p', { class: 'word', text: 'The bar under the banner of the wall, for a notice people must see today. It is live from its start to its end. With two live at once the wall shows one for 12 seconds and then the other. Times here are in the time zone of this device.' }),
    postHost, note, listHost);
  const list = await mountList(listHost, {
    type: 'announcement',
    noun: 'announcement',
    empty: 'No announcements yet. Press Add announcement, or use Post now.',
    hideSwitch: false,
    nameOf: doc => doc.text || 'Announcement with no text',
    row: row,
    chips: announcementChips,
    sort: sortAnnouncements,
  }, ctx);
  const refreshPost = postForm(postHost, ctx, list);

  function words() {
    const live = liveCount(list.items(), new Date());
    const waiting = list.items().filter(item => announcementState(item, new Date()) && announcementState(item, new Date()).id === 'waiting').length;
    note.textContent = live === 0 ? 'No announcement is live now.' : live === 1 ? 'One announcement is live now.' : live === 2 ? 'Two announcements are live now, so the wall alternates them every 12 seconds.' : live + ' announcements are live now. The wall alternates two of them every 12 seconds, so end or delete the others.';
    if (waiting > 0) note.textContent += ' ' + waiting + (waiting === 1 ? ' is' : ' are') + ' waiting for the start time or for Publish.';
    refreshPost();
  }
  words();
  // The list draws itself again after every action, so the note follows it
  new MutationObserver(words).observe(listHost, { childList: true, subtree: true });
}
