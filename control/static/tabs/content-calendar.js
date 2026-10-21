// Calendar, a block of the Content section of the Display tab: the coming events the Mini downloaded from BAND, by day, with the
// calendar each comes from, whether a Calendar filter hides it from the wall (and which rule), and a Hide or Show button that drafts
// a one event rule exactly as the Studio Calendars page does. Events themselves are edited in BAND, never here.

import { api as realApi } from './api.js';
import { h } from '../settings-all-fields.js';
import { button, useContentStyles } from './content-list.js';
import { actionWords } from '../actions.js';

export async function mountCalendar(body, ctx = {}) {
  useContentStyles();
  const call = ctx.api || realApi;
  const page = { data: null, error: '', working: false, ask: false, flash: { state: '', words: '' }, calendar: '', search: '' };
  const root = h('div', { class: 'ct-calendar' });
  body.replaceChildren(root);

  async function load() {
    const answer = await call('GET', '/content/calendar');
    page.data = answer.ok ? answer.data : null;
    page.error = answer.ok ? '' : answer.error;
  }

  async function run(path, payload, doneWords) {
    page.working = true;
    draw();
    const answer = await call('POST', '/content/calendar' + path, payload);
    page.working = false;
    page.ask = false;
    if (answer.ok) {
      page.data = answer.data;
      page.flash = { state: 'done', words: doneWords };
    } else {
      page.flash = { state: 'bad', words: answer.error };
      await load();
    }
    draw();
  }

  const stateWords = event => (event.state.on ? 'Shown on the wall' : event.state.id === 'hidden-you' ? 'Hidden by you' : event.state.id === 'hidden-calendar' ? 'Calendar is off' : event.state.text);

  function eventRow(event) {
    const state = event.state;
    const reason = [state.reason, event.rule && !state.reason ? 'Hidden by the rule ' + event.rule + '.' : '', state.note, state.pending ? 'Waiting for Publish to the wall.' : ''].filter(Boolean).join(' ');
    return h('article', { class: 'ct-item ct-event', 'data-state': state.id, 'data-on': state.on ? 'yes' : 'no' },
      h('div', { class: 'ct-main' },
        h('div', { class: 'ct-row' },
          h('p', { class: 'ct-title' }, h('span', { class: 'ct-time', text: event.time }), ' ', event.title),
          h('p', { class: 'ct-sub', text: [event.calendar, event.kind].filter(Boolean).join(' · ') }),
          reason ? h('p', { class: 'ct-sub', text: reason }) : null),
        h('div', { class: 'ct-chips' }, h('span', { class: 'ct-chip', 'data-chip': state.on ? 'shown' : 'hidden', text: stateWords(event) }))),
      h('div', { class: 'ct-actions' },
        button(state.on ? 'Hide' : 'Show', {
          'data-act': 'switch',
          'aria-label': (state.on ? 'Hide ' : 'Show ') + event.title,
          disabled: !state.canSwitch || page.working || !page.data.canWrite || !page.data.rulesReadable,
        }, () => run('/switch', { key: event.key }, state.on ? 'Hidden in a draft rule. It is on the wall until you press Publish to the wall.' : 'Shown again in a draft rule. It changes on the wall when you press Publish to the wall.'))));
  }

  function matches(event) {
    const words = page.search.trim().toLowerCase();
    return (page.calendar === '' || event.calendar === page.calendar) && (words === '' || [event.title, event.calendar].join(' ').toLowerCase().includes(words));
  }

  function draw() {
    if (page.error) {
      root.replaceChildren(h('p', { class: 'bad', text: page.error }), button('Try again', { class: 'act', 'data-act': 'cal-again' }, async () => { await load(); draw(); }));
      return;
    }
    const data = page.data;
    const names = [];
    data.days.forEach(day => day.events.forEach(event => { if (!names.includes(event.calendar)) names.push(event.calendar); }));
    const parts = [
      h('p', { class: 'word', text: 'These are the coming events the Teletraan computer downloaded from BAND. Events are edited in BAND, not here. The button on an event only chooses whether the wall shows it. It makes a draft rule like the Studio Calendars page, and the wall changes when you press Publish.' }),
    ];
    if (data.notice) parts.push(h('p', { class: 'ct-notice', text: data.notice }));
    if (data.download) parts.push(h('p', { class: 'word', text: data.download }));
    if (data.calendars.length > 0) parts.push(h('ul', { class: 'ct-reads' }, data.calendars.map(line => h('li', { 'data-failed': line.failed ? 'yes' : 'no', text: line.name + ': ' + line.text }))));
    if (!data.canWrite) parts.push(h('p', { class: 'bad', text: 'SANITY_WRITE_TOKEN is not set on the Teletraan computer, so nothing can be changed here. Add it in Settings, Keys.' }));
    if (!data.rulesReadable) parts.push(h('p', { class: 'bad', text: 'The Calendar filters could not be read, so the buttons are off. Press Refresh.' }));

    const calendar = h('select', { id: 'ct-cal-pick', 'aria-label': 'Calendar' }, h('option', { value: '', text: 'Every calendar' }), names.map(name => h('option', { value: name, text: name })));
    calendar.value = page.calendar;
    calendar.addEventListener('change', () => { page.calendar = calendar.value; draw(); });
    const search = h('input', { type: 'search', id: 'ct-cal-search', 'aria-label': 'Search events', placeholder: 'Search events', autocomplete: 'off', value: page.search });
    search.addEventListener('input', () => { page.search = search.value; draw(); const again = root.querySelector('#ct-cal-search'); again.focus(); again.setSelectionRange(again.value.length, again.value.length); });
    parts.push(h('div', { class: 'ct-filters' }, calendar, search));

    const waiting = data.pending;
    const bar = h('div', { class: 'buttons ct-bar' },
      button(actionWords.publish, { 'data-act': 'cal-publish', class: 'act', disabled: waiting === 0 || !data.canWrite || page.working }, () => { page.ask = true; draw(); }),
      button(actionWords.refresh, { 'data-act': 'cal-refresh', disabled: page.working }, async () => { await load(); page.flash = { state: '', words: 'Read again from Sanity.' }; draw(); }));
    parts.push(bar, h('p', { class: 'note', 'data-waiting': String(waiting), text: waiting === 0 ? 'Nothing is waiting for the wall.' : waiting + (waiting === 1 ? ' event change is' : ' event changes are') + ' saved as a draft and waiting for Publish to the wall.' }));
    if (page.ask) {
      parts.push(h('div', { class: 'ct-ask', role: 'group', 'aria-label': 'Confirm', 'data-ask': 'calendar' },
        h('p', { text: 'Publish ' + waiting + (waiting === 1 ? ' event change' : ' event changes') + ' to the wall now? The wall shows them within a minute.' }),
        h('div', { class: 'buttons' }, button('Publish now', { 'data-act': 'cal-publish-now', class: 'act' }, () => run('/publish', { confirm: true }, 'Published. The wall shows it within a minute.')), button('Cancel', {}, () => { page.ask = false; draw(); }))));
    }
    parts.push(h('p', { class: 'ct-flash', role: 'status', 'data-state': page.flash.state, text: page.flash.words }));

    let shown = 0;
    data.days.forEach(day => {
      const events = day.events.filter(matches);
      if (events.length === 0) return;
      shown += events.length;
      parts.push(h('h3', { class: 'ct-group', text: day.label + ' (' + events.length + ')' }));
      events.forEach(event => parts.push(eventRow(event)));
    });
    if (shown === 0) parts.push(h('p', { class: 'ct-none', text: data.count === 0 ? 'No coming events.' : 'No event matches. Clear the search or the calendar.' }));
    root.replaceChildren(...parts);
  }

  await load();
  draw();
}
