// A room or area where a task is done, such as the Classroom. A task points to
// a place instead of holding the words itself, so a place is typed once and
// every task spells it the same way. Places has no line in the sidebar: a place is
// added with Create new in the Location field of a task, and opened from there.
//
// The screen shows the place's name beside the task. A place that is hidden or
// deleted only takes the location off the task: the task stays on the screen
// (dashboard/core/sanity.js).

import { defineType, defineField } from 'sanity';
import { showField, tooLong, aToZ, subtitleFor } from './fields.js';

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// Two places with the same name, capitals ignored, would look the same in the
// list a task is picked from. The Studio's own copy of the place is left out
// of the search: a published place and its draft share an id apart from the
// word "drafts.", and they are one place.
async function nameIsFree(name, context) {
  if (typeof name !== 'string' || name.trim() === '') return true;

  const published = String((context.document && context.document._id) || '').replace(/^drafts\./, '');
  const ownIds = [published, 'drafts.' + published];
  const client = context.getClient({ apiVersion: apiVersion });

  // 'raw' includes drafts, so a place that is typed but not yet published counts
  const names = await client.fetch('*[_type == "place" && !(_id in $ownIds)].name', { ownIds: ownIds }, { perspective: 'raw' });
  const taken = (names || []).some(other => typeof other === 'string' && other.trim().toLowerCase() === name.trim().toLowerCase());
  return taken ? 'There is already a place called "' + name.trim() + '". Pick that one in the task instead.' : true;
}

export default defineType({
  name: 'place',
  title: 'Places',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Place name',
      type: 'string',
      description: 'Where tasks are done, such as Classroom. Up to 16 characters fit. Two places cannot have the same name.',
      validation: Rule => [Rule.required().error('Give the place a name.'), tooLong(Rule, 16), Rule.custom(nameIsFree)],
    }),
    showField(),
  ],
  orderings: [aToZ('name')],
  preview: {
    select: { title: 'name', show: 'show' },
    prepare(item) {
      return { title: item.title || 'Place with no name', subtitle: subtitleFor('', item) };
    },
  },
});
