// A room or area where a task is done, such as the Classroom. A task points to
// a location instead of holding the words itself, so a location is typed once
// and every task spells it the same way. The sidebar calls the list Locations.
//
// The screen shows the location's name beside the task. A location that is hidden
// or deleted only takes the location off the task: the task stays on the screen
// (dashboard/core/sanity.js).

import { defineType, defineField } from 'sanity';
import { showField, tooLong, aToZ, subtitleFor } from './fields.js';

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// Two locations with the same name, capitals ignored, would look the same in the
// list a task is picked from. The Studio's own copy of the location is left out
// of the search: a published location and its draft share an id apart from the
// word "drafts.", and they are one location.
async function nameIsFree(name, context) {
  if (typeof name !== 'string' || name.trim() === '') return true;

  const published = String((context.document && context.document._id) || '').replace(/^drafts\./, '');
  const ownIds = [published, 'drafts.' + published];
  const client = context.getClient({ apiVersion: apiVersion });

  // 'raw' includes drafts, so a location that is typed but not yet published counts
  const names = await client.fetch('*[_type == "place" && !(_id in $ownIds)].name', { ownIds: ownIds }, { perspective: 'raw' });
  const taken = (names || []).some(other => typeof other === 'string' && other.trim().toLowerCase() === name.trim().toLowerCase());
  return taken ? 'There is already a location called "' + name.trim() + '". Pick that one in the task instead.' : true;
}

export default defineType({
  name: 'place',
  title: 'Locations',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Location name',
      type: 'string',
      description: 'Where tasks are done, such as Classroom. Up to 16 characters fit. Two locations cannot have the same name.',
      validation: Rule => [Rule.required().error('Give the location a name.'), tooLong(Rule, 16), Rule.custom(nameIsFree)],
    }),
    showField(),
  ],
  orderings: [aToZ('name')],
  preview: {
    select: { title: 'name', show: 'show' },
    prepare(item) {
      return { title: item.title || 'Location with no name', subtitle: subtitleFor('', item) };
    },
  },
});
