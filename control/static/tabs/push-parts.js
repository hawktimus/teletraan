// The text of the top of the Display tab as HTML strings: Now on the wall with the theme picker, and Temporary push. Every value
// is escaped. tabs/push.js puts the markup in the page and wires the buttons. Nothing here touches the page, so
// tests/control-push.test.mjs can try it with node.

import { dayWords, holdChoices, holdWords, leftWords, pushWords, usualHold } from '../push-lib.js';
import { esc, hiddenRunHtml } from './render.js';
import { lead } from '../guide.js';

const hiddenOrder = ['desktop', 'redEyes'];

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

// ----- Now on the wall -----

export function nowThemeHtml(state, draft, names) {
  const pushedTheme = (state.pushes || []).find(push => push.kind === 'theme');
  const id = pushedTheme ? pushedTheme.id : (state.week && state.week[state.today]) || '';
  const source = pushedTheme ? 'Pushed by hand.' : (dayWords[state.today] || 'Today') + ' schedule.';
  return '<section class="card now-card" data-now-card><h2>Now on the wall</h2>' + lead('display.now-theme') +
    '<p class="big-theme" data-now-theme-name>' + esc(names.themes[id] || id || 'Not known') + '</p>' +
    '<p class="word" data-now-theme-source>' + esc(source) + '</p>' +
    '<p class="word" data-now-view>The wall has not reported yet.</p>' +
    '<h3>Theme</h3>' +
    tilesHtml(state.themes || [], 'data-theme-pick', draft.theme, 'Theme') +
    '<div data-hold-box>' + holdHtml(draft.hold) + '</div>' +
    '<div class="buttons"><button type="button" class="act" data-action="push-theme"' + (state.canWrite ? '' : ' disabled') + '>Push theme to the wall</button>' +
    '<button type="button" class="act quiet" data-action="cancel" data-kind="theme">Back to the schedule</button></div>' +
    '<p class="note" data-theme-note>Pick a theme to see it in the preview. It goes on the wall only when you press Push.</p>' +
    '<div data-active>' + activeHtml(state.pushes || [], state, names) + '</div></section>';
}

// ----- what is pushed now -----

export function activeHtml(pushes, state, names, nowMilliseconds = Date.now()) {
  if (pushes.length === 0) return '<p class="word" data-none>Nothing is pushed. The wall follows its schedule.</p>';
  const items = pushes.map(push => {
    const words = pushWords(push, names);
    const left = push.until ? leftWords(push.until, nowMilliseconds) : 'one time';
    return '<li class="active" data-push="' + esc(push.kind) + '"><div><strong>' + esc(words.title) + '</strong> <span class="word">' + esc(words.detail) + '</span>' +
      '<br><span class="left" data-left="' + esc(push.until) + '">' + esc(left) + '</span></div>' +
      '<button type="button" class="act quiet" data-action="cancel" data-kind="' + esc(push.kind) + '">Cancel</button></li>';
  }).join('');
  return '<h3>Pushed now</h3><ul class="actives">' + items + '</ul>' +
    '<div class="buttons"><button type="button" class="act" data-action="reset">Reset to today\'s schedule</button></div>';
}

// ----- Temporary push -----

export function pushBlockHtml(state, draft, choices, names) {
  const panelGroups = (choices.panelGroups || []).map(group => '<optgroup label="' + esc(group.title) + '">' + options(group.panels, draft.panel) + '</optgroup>').join('');
  const views = (state.views || []).map(view => ({ value: view.key, title: view.name }));
  const off = state.canWrite ? '' : ' disabled';
  const teams = [{ value: '', title: 'Both teams' }].concat((state.teams || []).map(team => ({ value: team.code, title: team.name })));

  return '<section class="card push-card" data-push-card><h2>Temporary push</h2>' + lead('display.push') +
    '<div data-hold-box>' + holdHtml(draft.hold) + '</div>' +
    (state.canWrite ? '' : '<p class="note">SANITY_WRITE_TOKEN is not set on the Teletraan computer, so nothing can be pushed. Add it in Settings, Keys.</p>') +

    '<h3>View</h3>' + tilesHtml(views, 'data-view-pick', draft.view, 'View') +
    '<div class="buttons"><button type="button" class="act" data-action="push-view"' + off + '>Push view</button></div>' +

    '<h3>Panel</h3>' +
    field('Choose a panel', '<select data-panel-pick><option value="">Pick a panel</option>' + panelGroups + '</select>') +
    '<p class="word">The wall shows this panel on its own, with the settings of its first row in the rotation. The rotation waits.</p>' +
    '<div class="buttons"><button type="button" class="act" data-action="push-panel"' + off + '>Push panel</button></div>' +

    '<h3>Announcement</h3>' +
    '<div class="fields">' +
    field('Text (up to 90 characters)', '<textarea data-notice-text rows="2" maxlength="90">' + esc(draft.text) + '</textarea>') +
    field('Level', '<select data-notice-level>' + options([{ value: 'notice', title: 'Notice' }, { value: 'important', title: 'Important (red)' }], draft.level) + '</select>') +
    field('Team', '<select data-notice-team>' + options(teams, draft.noticeTeam) + '</select>') +
    '</div><p class="word" data-notice-count>' + esc(draft.text.length + ' of 90 characters.') + '</p>' +
    '<div class="buttons"><button type="button" class="act" data-action="push-announcement"' + off + '>Post announcement</button></div>' +

    '<h3>Pause rotation</h3>' +
    '<p class="word">Keeps the panel that is on the wall where it is.</p>' +
    '<div class="buttons"><button type="button" class="act" data-action="push-pause"' + off + '>Pause rotation</button></div>' +
    '<div class="buttons"><button type="button" class="act" data-action="reset">Reset to today\'s schedule</button></div>' +
    '</section>';
}

// The Hidden transitions card, which lives under More tools. The buttons are wired with the other pushes (push.js). report is the
// report of the wall, or null.
export function hiddenBlockHtml(state, report) {
  const kinds = (state.hiddenKinds || []).slice().sort((a, b) => hiddenOrder.indexOf(a.value) - hiddenOrder.indexOf(b.value));
  const off = state.canWrite ? '' : ' disabled';
  return '<section class="card hidden-card" data-hidden-card><h2>Hidden transitions</h2>' + lead('display.hidden') +
    '<div class="buttons">' + kinds.map(kind => '<button type="button" class="act quiet" data-action="push-hidden" data-kind="' + esc(kind.value) + '"' + off + '>Play ' + esc(kind.title) + '</button>').join('') + '</div>' +
    '<p class="note">Allow hidden transitions must be on in Dashboard Settings, in the Studio.</p>' +
    '<div class="hidden-run" data-hidden-run>' + hiddenRunHtml(report) + '</div></section>';
}

export { holdWords, usualHold };
