// The text of the top of the Display tab as HTML strings: the strip of what is pushed now and three cards, On the wall now, Theme,
// and Announce and effects. Every value is escaped. tabs/push.js puts the markup in the page and wires the buttons. Nothing here
// touches the page, so tests/control-push.test.mjs can try it with node.

import { dayWords, holdChoices, holdWords, leftWords, pushWords, usualHold } from '../push-lib.js';
import { esc, hiddenRunHtml, pauseStateWords, pauseToggleHtml } from './render.js';
import { showFieldsHtml } from './show-panel-fields.js';
import { lead } from '../guide.js';

const hiddenOrder = ['desktop', 'redEyes'];
// What a push of these kinds is called in the Held line of the status
const heldKinds = ['theme', 'view', 'panel', 'pause'];

function field(label, control) {
  return '<label class="field"><span>' + esc(label) + '</span>' + control + '</label>';
}

function options(list, selected) {
  return list.map(item => '<option value="' + esc(item.value) + '"' + (item.value === selected ? ' selected' : '') + '>' + esc(item.title) + '</option>').join('');
}

// The names the words of a push use, from the answer of GET /control/api/push and the panel titles of the Display tab
export function namesOf(state, titles) {
  const names = { themes: {}, views: {}, panels: titles || {}, hidden: {} };
  (state.themes || []).forEach(item => { names.themes[item.value] = item.title; });
  (state.views || []).forEach(item => { names.views[item.key] = item.name; });
  (state.hiddenKinds || []).forEach(item => { names.hidden[item.value] = item.title; });
  return names;
}

// One choice of how long a push stays. The pressed one is marked for a screen reader as well as by color.
export function holdHtml(minutes) {
  return '<div class="hold" role="group" aria-label="Hold for"><span class="word">Hold for</span>' +
    holdChoices.map(value => '<button type="button" class="act tile small' + (value === minutes ? '' : ' quiet') + '" data-hold="' + value + '" aria-pressed="' + (value === minutes ? 'true' : 'false') + '">' + esc(value + (value === 1 ? ' minute' : ' minutes')) + '</button>').join('') + '</div>';
}

function tilesHtml(items, attribute, selected, label) {
  return '<div class="tiles" role="group" aria-label="' + esc(label) + '">' + items.map(item =>
    '<button type="button" class="act tile' + (item.value === selected ? '' : ' quiet') + '" ' + attribute + '="' + esc(item.value) + '" aria-pressed="' + (item.value === selected ? 'true' : 'false') + '">' + esc(item.title) + '</button>').join('') + '</div>';
}

export const pausedIn = pushes => (pushes || []).some(push => push.kind === 'pause');

// ----- what is pushed now: a slim strip at the top of the page -----

export function activeHtml(pushes, state, names, nowMilliseconds = Date.now()) {
  if (pushes.length === 0) return '<p class="word" data-none><strong>Pushed now:</strong> nothing. The wall follows its schedule.</p>';
  const items = pushes.map(push => {
    const words = pushWords(push, names);
    const left = push.until ? leftWords(push.until, nowMilliseconds) : 'one time';
    return '<li class="active" data-push="' + esc(push.kind) + '"><div><strong>' + esc(words.title) + '</strong> <span class="word">' + esc(words.detail) + '</span>' +
      ' <span class="left" data-left="' + esc(push.until) + '">' + esc(left) + '</span></div>' +
      '<button type="button" class="act quiet" data-action="cancel" data-kind="' + esc(push.kind) + '">Cancel</button></li>';
  }).join('');
  return '<p class="strip-title"><strong>Pushed now</strong></p><ul class="actives">' + items + '</ul>' +
    '<div class="buttons"><button type="button" class="act" data-action="reset">Reset to today\'s schedule</button></div>';
}

// The Held line of the status: what is pushed and how long it has left, or that nothing is
export function heldHtml(pushes, names, nowMilliseconds = Date.now()) {
  const held = (pushes || []).filter(push => heldKinds.includes(push.kind) && push.until);
  if (held.length === 0) return 'Nothing is held. The wall follows its schedule.';
  return held.map(push => {
    const words = pushWords(push, names);
    return esc(words.title + (push.kind === 'pause' ? '' : ': ' + words.detail)) + ', <span class="left" data-left="' + esc(push.until) + '">' + esc(leftWords(push.until, nowMilliseconds)) + '</span>';
  }).join('; ') + '.';
}

export function themeOfNow(state) {
  const pushedTheme = (state.pushes || []).find(push => push.kind === 'theme');
  const id = pushedTheme ? pushedTheme.id : (state.week && state.week[state.today]) || '';
  const source = pushedTheme ? 'Pushed by hand.' : (dayWords[state.today] || 'Today') + ' schedule.';
  return { id: id, pushed: Boolean(pushedTheme), source: source };
}

// ----- card 1: On the wall now -----

// The status line, the playback buttons and Show a panel. choices is the answer of GET /control/api/display (the panel menu and the
// settings menus come from it). draft holds what is picked and not sent yet.
export function onWallHtml(state, draft, choices, names, now = Date.now()) {
  const theme = themeOfNow(state);
  const paused = pausedIn(state.pushes);
  const off = state.canWrite ? '' : ' disabled';
  const views = (state.views || []).map(view => ({ value: view.key, title: view.name }));
  const panelGroups = (choices.panelGroups || []).map(group => '<optgroup label="' + esc(group.title) + '">' + options(group.panels, draft.panel) + '</optgroup>').join('');
  const quiet = state.canWrite ? '' : '<p class="note">SANITY_WRITE_TOKEN is not set on the Teletraan computer, so nothing can be sent to the wall. Add it in Settings, Keys.</p>';

  return '<section class="card now-card" data-now-card><h2>On the wall now</h2>' + lead('display.onwall') + quiet +
    '<dl class="facts">' +
    '<div><dt>Playing now</dt><dd data-play-now>not known yet</dd></div>' +
    '<div><dt>Next</dt><dd data-play-next>not known yet</dd></div>' +
    '<div><dt>Theme</dt><dd><span data-now-theme-name>' + esc(names.themes[theme.id] || theme.id || 'Not known') + '</span> <span class="word" data-now-theme-source>' + esc(theme.source) + '</span></dd></div>' +
    '<div><dt>Held</dt><dd data-held-now>' + heldHtml(state.pushes, names, now) + '</dd></div>' +
    '</dl>' +
    '<p class="note" data-play-loop></p>' +
    '<div class="buttons"><button type="button" class="act quiet" data-action="edit-rows">Edit the rotation</button></div>' +

    '<h3>Playback</h3>' +
    '<div class="buttons playback">' + pauseToggleHtml(paused).replace('<button ', '<button ' + (state.canWrite ? '' : 'disabled ')) +
    '<button type="button" class="act" data-action="next"' + off + '>Next</button>' +
    '<button type="button" class="act quiet" data-action="schedule"' + off + '>Back to schedule</button>' +
    '<button type="button" class="act quiet" data-action="reset"' + off + '>Reset to today\'s schedule</button></div>' +
    '<p class="note" data-pause-state>' + esc(paused ? pauseStateWords.paused : pauseStateWords.running) + '</p>' +

    '<h3>Show a panel</h3>' +
    '<p class="word">Pick a view, a panel or both. The picture on the right shows your choice first. It goes on the wall when you press Show on the wall, and the wall goes back to its schedule by itself after the hold.</p>' +
    '<div class="pick" role="group" aria-label="View"><span>View</span>' + tilesHtml(views, 'data-view-pick', draft.view, 'View') + '</div>' +
    field('Panel', '<select data-panel-pick><option value="">Pick a panel</option>' + panelGroups + '</select>') +
    '<div class="show-settings" data-show-settings>' + showSettingsHtml(draft, choices) + '</div>' +
    '<div data-hold-box>' + holdHtml(draft.hold) + '</div>' +
    '<div class="buttons"><button type="button" class="act" data-action="show-on-wall"' + off + '>Show on the wall</button></div>' +
    '</section>';
}

// The menus of the chosen panel, with the note that says what the wall does with them. rowOfPanel is the first row of the
// rotation with that panel, or null.
export function showSettingsHtml(draft, choices, rowOfPanel = null) {
  if (!draft.panel) return '';
  const menus = showFieldsHtml(draft.panel, Object.assign({}, rowOfPanel, draft.settings), choices);
  if (menus === '') return '';
  return menus + '<p class="note">The picture on the right draws these settings. The wall holds the rows of this panel that are in the Rotation.</p>';
}

// ----- card 2: Theme -----

export function themeCardHtml(state, draft, names) {
  const theme = themeOfNow(state);
  const off = state.canWrite ? '' : ' disabled';
  const today = (state.week && state.week[state.today]) || '';
  const line = today ? (dayWords[state.today] || 'Today') + ' the schedule uses ' + (names.themes[today] || today) + '.' : '';
  return '<section class="card theme-now-card" data-theme-now-card><h2>Theme</h2>' + lead('display.theme-card') +
    '<p class="big-theme" data-now-theme-name>' + esc(names.themes[theme.id] || theme.id || 'Not known') + '</p>' +
    '<p class="word" data-now-theme-source>' + esc(theme.source) + '</p>' +
    tilesHtml(state.themes || [], 'data-theme-pick', draft.theme, 'Theme') +
    '<div data-hold-box>' + holdHtml(draft.hold) + '</div>' +
    '<div class="buttons"><button type="button" class="act" data-action="push-theme"' + off + '>Switch to this theme</button>' +
    '<button type="button" class="act quiet" data-action="preview-theme"' + off + '>Preview for 10 minutes</button>' +
    '<button type="button" class="act quiet" data-action="cancel" data-kind="theme">Back to the schedule</button></div>' +
    '<p class="note" data-theme-note>Pick a theme to see it in the picture on the right. It goes on the wall only when you press a button here.' + (line ? ' ' + esc(line) : '') + '</p>' +
    '</section>';
}

// ----- card 3: Announce and effects -----

// The Hidden transitions part of the card. report is the report of the wall, or null.
export function hiddenPartHtml(state, report) {
  const kinds = (state.hiddenKinds || []).slice().sort((a, b) => hiddenOrder.indexOf(a.value) - hiddenOrder.indexOf(b.value));
  const off = state.canWrite ? '' : ' disabled';
  return '<h3>Hidden transitions</h3>' +
    '<div class="buttons">' + kinds.map(kind => '<button type="button" class="act quiet" data-action="push-hidden" data-kind="' + esc(kind.value) + '"' + off + '>Play ' + esc(kind.title) + '</button>').join('') + '</div>' +
    '<p class="note">Allow hidden transitions must be on in Dashboard Settings, in the Studio.</p>' +
    '<div class="hidden-run" data-hidden-run>' + hiddenRunHtml(report) + '</div>';
}

// request is the answer of GET /control/api/request: the announcements that are live and the talks booked for the next day
export function announceHtml(state, draft, report, request = {}) {
  const off = state.canWrite ? '' : ' disabled';
  const teams = [{ value: '', title: 'Both teams' }].concat((state.teams || []).map(team => ({ value: team.code, title: team.name })));
  const live = request.liveAnnouncements === null || request.liveAnnouncements === undefined ? 'not known' : request.liveAnnouncements;
  const talks = (request.talks || []).map(talk => '<li>' + esc(talk.name || talk.topic || 'Talk') + ', ' + esc(talk.start) + '</li>').join('');

  return '<details class="more-tools announce-card" data-more="announce"><summary aria-describedby="lead-display-announce">Announce and effects</summary>' + lead('display.announce') +
    '<div class="more-body">' +
    '<div><h3>Announcement under the banner</h3>' +
    '<div class="fields">' +
    field('Text (up to 90 characters)', '<textarea data-notice-text rows="2" maxlength="90">' + esc(draft.text) + '</textarea>') +
    field('Level', '<select data-notice-level>' + options([{ value: 'notice', title: 'Notice' }, { value: 'important', title: 'Important (red)' }], draft.level) + '</select>') +
    field('Team', '<select data-notice-team>' + options(teams, draft.noticeTeam) + '</select>') +
    '</div><p class="word" data-notice-count>' + esc(draft.text.length + ' of 90 characters.') + '</p>' +
    '<div data-hold-box>' + holdHtml(draft.hold) + '</div>' +
    '<div class="buttons"><button type="button" class="act" data-action="push-announcement"' + off + '>Post announcement</button>' +
    '<button type="button" class="act quiet" data-action="post-announcement"' + off + '>Post for 2 hours</button></div></div>' +

    '<div><h3>Messages</h3><p class="word" data-live-count>' + esc(live) + ' live now.</p>' +
    '<div class="buttons"><button type="button" class="act quiet" data-action="announce"' + off + '>Play announcement</button>' +
    '<button type="button" class="act quiet" data-action="presentation-test"' + off + '>Run presentation test</button></div>' +
    (talks ? '<ul class="rows">' + talks + '</ul>' : '<p class="word">No talks booked in the next day.</p>') + '</div>' +

    '<div data-hidden-part>' + hiddenPartHtml(state, report) + '</div>' +
    '</div></details>';
}

export { holdWords, usualHold };
