// Pieces that every kind of content shares, so they look and work the same.

import { defineField } from 'sanity';

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
// glance which items are not on the screen
export function subtitleFor(text, item) {
  let note = '';
  if (item.show === false) note = 'Hidden';
  else if (item.expires && new Date(item.expires) < new Date()) note = 'Expired';

  return [note, text].filter(Boolean).join(' · ');
}
