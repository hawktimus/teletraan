// Ticker and news, a block of the Content section of the Display tab: the Tips and News documents of the Studio (add, edit, Hide and
// Show, expiry, order, delete), a line that shows how the ticker draws each one, and under them the FRC news headlines the Mini
// read, which only the Hide switch of each can change.

import { api as realApi } from './api.js';
import { h } from '../settings-all-fields.js';
import { button, mountList } from './content-list.js';
import { actionWords } from '../actions.js';
import { hiddenAfter, newsLine, tickerLimit, tickerLine } from './content-items.js';

const when = iso => (iso && !isNaN(Date.parse(iso)) ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const shortDate = iso => (iso && !isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

// The ticker draws a tag and one line. A seasonal pack can put a few words in front, which is not shown here.
function tickerView(kind, text, word) {
  const line = tickerLine(kind, text);
  if (!line) return h('p', { class: 'ct-skipped', text: word });
  return h('div', { class: 'ct-ticker' },
    h('span', { class: 'ct-tag', 'data-kind': kind || 'news', text: line.tag }),
    h('span', { class: 'ct-text', text: line.text }));
}

function previewInto(box, values) {
  box.replaceChildren(
    h('p', { class: 'ct-label', text: 'How the ticker shows it' }),
    tickerView(values.kind, values.text, 'Nothing to show yet. The ticker skips a line with no text.'),
    h('p', { class: 'ct-sub', text: 'The ticker shows one line at a time. Up to ' + tickerLimit + ' characters fit.' }));
}

function lineRow(item, page) {
  const doc = item.document;
  const team = page.teams.filter(one => one.id === (doc.team && doc.team._ref))[0];
  const sub = [team ? 'For ' + team.name : 'For both teams', doc.expires ? 'Hides after ' + when(doc.expires) : '', typeof doc.order === 'number' ? 'Order ' + doc.order : ''].filter(Boolean).join(' · ');
  return h('div', { class: 'ct-row' }, tickerView(doc.kind, doc.text, 'Line with no text. The ticker skips it.'), h('p', { class: 'ct-sub', text: sub }));
}

// ----- the FRC news, read only except for the Hide switch -----

async function mountNews(host, ctx) {
  const call = ctx.api || realApi;
  const page = { data: null, error: '', working: false, flash: { state: '', words: '' }, ask: false };

  async function load() {
    const answer = await call('GET', '/content/news');
    page.data = answer.ok ? answer.data : null;
    page.error = answer.ok ? '' : answer.error;
  }

  async function hide(row, hideIt) {
    const next = hiddenAfter(page.data.hiddenLinks, row.link, hideIt, page.data.mostHidden);
    if (next.problem) { page.flash = { state: 'bad', words: next.problem }; return draw(); }
    page.working = true;
    const answer = await call('POST', '/doc/dashboardSettings/save', { baseRev: page.data.rev, set: { newsHiddenLinks: next.list } });
    page.working = false;
    await load();
    page.flash = answer.ok
      ? { state: 'done', words: 'Saved to the draft of Dashboard Settings. The wall changes when you press Publish to the wall below.' }
      : { state: 'bad', words: answer.data && answer.data.conflict ? 'Dashboard Settings changed in the Studio. The list was read again, so press the button once more.' : answer.error };
    draw();
  }

  async function publish() {
    page.working = true;
    const answer = await call('POST', '/doc/dashboardSettings/publish', { confirm: true, rev: page.data.rev });
    page.working = false;
    page.ask = false;
    await load();
    page.flash = answer.ok ? { state: 'done', words: 'Published. The wall shows it within a minute.' } : { state: 'bad', words: answer.error };
    draw();
  }

  function draw() {
    if (page.error) {
      host.replaceChildren(h('h3', { class: 'ct-group', text: 'FRC news' }), h('p', { class: 'bad', text: page.error }), button('Try again', { class: 'act', 'data-act': 'news-again' }, async () => { await load(); draw(); }));
      return;
    }
    const data = page.data;
    const shown = data.rows.filter(row => !row.hidden);
    const inTicker = data.inTicker && data.enabled ? shown.slice(0, 3) : [];
    const parts = [
      h('h3', { class: 'ct-group', text: 'FRC news (from FIRST)' }),
      h('p', { class: 'word', text: 'Headlines the Teletraan computer read from the FIRST blog. They are not edited here. Only posts in these categories are kept: ' + data.categories.join(', ') + '. Change the categories in Settings, All settings, Competition.' }),
      h('p', { class: 'word', text: data.enabled ? (data.inTicker ? 'The ticker shows the newest three that are not hidden, as FIRST: and the headline.' : 'Show news in the ticker is off, so no headline reaches the ticker.') : 'Read FRC news is off, so the wall shows no headlines.' }),
      h('ul', { class: 'ct-reads' }, data.lines.map(line => h('li', { text: line.label + ': ' + line.text }))),
    ];
    if (data.rows.length === 0) parts.push(h('p', { class: 'ct-none', text: 'No headlines yet. The Teletraan computer reads the blog every 2 hours.' }));
    data.rows.forEach(row => {
      const first = inTicker.includes(row);
      parts.push(h('article', { class: 'ct-item', 'data-news': row.hidden ? 'hidden' : 'shown' },
        h('div', { class: 'ct-main' },
          h('div', { class: 'ct-row' },
            h('p', { class: 'ct-title', text: row.title }),
            first ? tickerView('news', newsLine(row.title), '') : null,
            h('p', { class: 'ct-sub', text: [shortDate(row.date), row.systemcore ? 'SystemCore' : ''].filter(Boolean).join(' · ') })),
          h('div', { class: 'ct-chips' }, h('span', { class: 'ct-chip', 'data-chip': row.hidden ? 'hidden' : 'shown', text: row.hidden ? 'Hidden' : 'Shown' }))),
        h('div', { class: 'ct-actions' },
          button(row.hidden ? 'Show' : 'Hide', { 'data-act': 'news-toggle', 'aria-label': (row.hidden ? 'Show ' : 'Hide ') + row.title, disabled: !data.canWrite || page.working || !data.hasSettings }, () => hide(row, !row.hidden)))));
    });
    if (data.isDraft) {
      parts.push(h('p', { class: 'word', text: 'Dashboard Settings has waiting changes. Publishing sends all of them to the wall, not only this list.' }));
      parts.push(page.ask
        ? h('div', { class: 'ct-ask', role: 'group', 'aria-label': 'Confirm', 'data-ask': 'news' },
          h('p', { text: 'Publish the Dashboard Settings draft to the wall now?' }),
          h('div', { class: 'buttons' }, button('Publish now', { 'data-act': 'news-publish-now', class: 'act' }, publish), button('Cancel', {}, () => { page.ask = false; draw(); })))
        : h('div', { class: 'buttons' }, button(actionWords.publish, { 'data-act': 'news-publish', class: 'act', disabled: !data.canWrite || page.working }, () => { page.ask = true; draw(); })));
    }
    parts.push(h('p', { class: 'ct-flash', role: 'status', 'data-state': page.flash.state, text: page.flash.words }));
    host.replaceChildren(...parts);
  }

  await load();
  draw();
}

export async function mountTicker(body, ctx = {}) {
  const listHost = h('div', { 'data-part': 'lines' });
  const newsHost = h('div', { 'data-part': 'news' });
  body.replaceChildren(
    h('p', { class: 'word', text: 'The tips, news and reminders on the ticker along the bottom of the wall. It shows one at a time. A change is a draft until you press Publish to the wall, the same as in the Studio.' }),
    listHost,
    newsHost);
  await mountList(listHost, {
    type: 'tipOrNews',
    noun: 'line',
    empty: 'No ticker lines yet. Press Add line.',
    reorder: true,
    nameOf: doc => doc.text || 'Line with no text',
    row: lineRow,
    preview: previewInto,
  }, ctx);
  await mountNews(newsHost, ctx);
}
