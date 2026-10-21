// The settings menus of Show a panel on the Display tab. They are the menus the row editor shows for a row of the same panel
// (Department, List and Team for Department tasks; Chart and Team for TV charts), built here from the same panel choices the
// service sends (choices.monday, and choices.roster for the roster when the service has them). Kept in one small file so it can be
// swapped for the field list of display-rows.js once that file exports one.
//
// panelFieldsOf gives the menus as data and showFieldsHtml draws them. Nothing here touches the page.

import { mondayFieldsOf } from '../display-rows.js';
import { choiceHtml } from '../choice.js';
import { esc } from './render.js';

// The names a pushed panel may carry. They are the same as the settings of a row, so the large picture can draw them.
export const showFieldNames = ['department', 'list', 'chart', 'team'];

// [{ field, label, value, choices: [{ value, title }] }] for a panel, or [] when the panel has no menus of its own.
// values holds what is chosen now (a row of the rotation with the panel, then what was picked here on top of it).
export function panelFieldsOf(panel, values, choices) {
  if (!panel || !choices) return [];
  const row = Object.assign({}, values, { panel: panel });
  const fields = mondayFieldsOf(row, choices.monday);
  if (fields.length > 0) return fields;

  const roster = choices.roster;
  if (roster && panel === 'roster') {
    const list = [];
    if (roster.teams) list.push({ field: 'team', label: 'Team', value: row.team || '', choices: roster.teams });
    if (roster.departments) list.push({ field: 'department', label: 'Department', value: row.department || '', choices: roster.departments });
    return list;
  }
  return [];
}

// The picked settings that count for this panel: only the names it has a menu for, and none that are empty
export function settingsOf(panel, picked, choices) {
  const names = panelFieldsOf(panel, picked, choices).map(item => item.field);
  const kept = {};
  names.forEach(name => {
    if (picked && picked[name] !== undefined && picked[name] !== '') kept[name] = picked[name];
  });
  return kept;
}

// A short list is a row of buttons and Department, which has nine, is a menu, as in the row editor
export function showFieldsHtml(panel, values, choices) {
  const fields = panelFieldsOf(panel, values, choices);
  if (fields.length === 0) return '';
  return '<div class="fields">' + fields.map(item => {
    if (item.field === 'department') {
      const options = item.choices.map(option => '<option value="' + esc(option.value) + '"' + (option.value === item.value ? ' selected' : '') + '>' + esc(option.title) + '</option>').join('');
      return '<label class="pick"><span>' + esc(item.label) + '</span><select data-show-field="department">' + options + '</select></label>';
    }
    const items = item.choices.map(option => ({ value: option.value, label: option.title, checked: option.value === item.value, attrs: 'data-show-field="' + esc(item.field) + '"' }));
    return '<div class="pick" role="group" aria-label="' + esc(item.label) + '"><span>' + esc(item.label) + '</span>' + choiceHtml({ name: 'show-' + item.field, items: items }) + '</div>';
  }).join('') + '</div>';
}
