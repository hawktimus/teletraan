// Pieces that every kind of content shares, so they look and work the same.

import { defineField } from 'sanity';
import { TeamInput } from '../team-input.js';
import { NoteField } from '../note-field.js';

export function showField() {
  return defineField({
    name: 'show',
    title: 'Show on screen',
    type: 'boolean',
    description: 'Turn this off to hide the item from the screen without deleting it.',
    initialValue: true,
  });
}

export function expiresField() {
  return defineField({
    name: 'expires',
    title: 'Hide after',
    type: 'datetime',
    description: 'Optional. After this date and time the item hides itself. Leave empty to keep it showing.',
  });
}

export function orderField() {
  return defineField({
    name: 'order',
    title: 'Order',
    type: 'number',
    description: 'Optional. A lower number comes first on the screen. Items with no number come last.',
    validation: Rule => Rule.integer().error('Use a whole number such as 1, 2 or 3.'),
  });
}

// Which team the item is for. It has no starting value: empty means Both, so an
// item that was made before teams existed keeps showing for every team. The
// radio is in team-input.js.
export function teamField() {
  return defineField({
    name: 'team',
    title: 'Team',
    type: 'reference',
    to: [{ type: 'team' }],
    description: 'Optional. Pick a team to show this only while that team is on the screen. Leave it on Both to always show it.',
    components: { input: TeamInput },
  });
}

// One plain line in the form with nothing to fill in, such as a pointer to
// another page. The text is the description. It stores nothing. The group is
// the tab of Dashboard Settings it sits in, and is left out on other pages.
export function noteField(name, text, group) {
  const field = {
    name: name,
    title: 'Note',
    type: 'string',
    readOnly: true,
    description: text,
    components: { field: NoteField },
  };
  if (group) field.group = group;
  return defineField(field);
}

// Text that is too long is cut off on the screen, so Studio refuses it first
export function tooLong(Rule, limit) {
  return Rule.max(limit).error('Too long. Up to ' + limit + ' characters fit.');
}

// Seconds between plays of an effect: 0 means never, and a number from just
// above 0 up to the shortest is too often
export function neverOrAtLeast(shortest) {
  return value => (typeof value === 'number' && value > 0 && value < shortest ? 'Use 0 for never, or ' + shortest + ' or more.' : true);
}

export const byOrder = {
  title: 'Order on screen',
  name: 'order',
  by: [{ field: 'order', direction: 'asc' }],
};

export function aToZ(field) {
  return { title: 'A to Z', name: field + 'AToZ', by: [{ field: field, direction: 'asc' }] };
}

// The title of the choice with this value, or empty text if there is none
export function titleOf(choices, value) {
  const match = choices.filter(choice => choice.value === value)[0];
  return match ? match.title : '';
}

// Puts Hidden or Expired in front of a list line, so an editor can see at a
// glance which items are not on the screen. A calendar filter hides events
// rather than showing anything, so its list says Off where the others say Hidden.
export function subtitleFor(text, item, hiddenWord = 'Hidden') {
  let note = '';
  if (item.show === false) note = hiddenWord;
  else if (item.expires && new Date(item.expires) < new Date()) note = 'Expired';

  return [note, text].filter(Boolean).join(' · ');
}
