// The view and theme fields of Dashboard Settings, in the Look tab.
//
//   generalViewName   the name of the General view in the view tag, "General" to start with
//   generalViewTitle  the title across the banner while the Robotics view (stored as general) is on, "HAWKTIMUS ROBOTICS" to start with
//   viewOrder         the views in the order they take the screen, General, Prime, Nova, Family to start with
//   themeByWeekday    the theme of each day of the week: original, cybertron, retro or foundry. It is edited on the
//                     Themes page (sidebar, Settings, Themes), so the field is hidden here. It replaces screenSchedule.
//
// The time zone the days are read in is a field of the Look page (theme.js), where it has always been.
//
// The starting values are the same as defaultSettings in dashboard/config.js, and tests/schemas.test.mjs
// fails if they differ. None of the fields is required: Dashboard Settings published before they existed
// has none, and the screen uses the starting values.
//
// To take the whole section out later: delete this file, remove its import and the line that uses
// viewsFields in dashboardSettings.js, and remove the same names from tests/schemas.test.mjs and config.js.

import { defineField, defineArrayMember } from 'sanity';
import { tooLong } from './fields.js';
import { viewKeys, viewTitles } from '../inputs/view-ids.js';
import { themeChoices, themeWeekdays } from '../inputs/theme-ids.js';

const viewChoices = viewKeys.map(key => ({ title: viewTitles[key], value: key }));

function themeDayField(day) {
  return defineField({
    name: day.name,
    title: day.title,
    type: 'string',
    description: 'The theme that plays on ' + day.title + '. It is set on the Themes page.',
    options: { list: themeChoices.map(theme => ({ title: theme.title, value: theme.id })), layout: 'radio', direction: 'horizontal' },
    initialValue: day.start,
    validation: Rule => Rule.valid(themeChoices.map(theme => theme.id)).error('Pick original, cybertron, retro or foundry.'),
  });
}

export function viewsFields() {
  return [
    defineField({
      name: 'generalViewName',
      title: 'Name of the Robotics view',
      type: 'string',
      group: 'look',
      description: 'The name in the view tag at the edge of the banner while the General view is on. Starts at General. Up to 16 characters fit.',
      initialValue: 'General',
      validation: Rule => tooLong(Rule, 16),
    }),
    defineField({
      name: 'generalViewTitle',
      title: 'Title of the Robotics view',
      type: 'string',
      group: 'look',
      description: 'The title across the banner while the Robotics view is on. Starts at HAWKTIMUS ROBOTICS. Up to 28 characters fit.',
      initialValue: 'HAWKTIMUS ROBOTICS',
      validation: Rule => tooLong(Rule, 28),
    }),
    defineField({
      name: 'viewOrder',
      title: 'Order of the views',
      type: 'array',
      group: 'look',
      hidden: true,
      description: 'Not used any more. The Rotation list sets the order. It stays so that a saved order is kept, and the Rotation list is filled from it.',
      of: [
        defineArrayMember({
          type: 'string',
          title: 'View',
          options: { list: viewChoices },
          validation: Rule => Rule.valid(viewKeys).error('Pick general, prime, nova or family.'),
        }),
      ],
      initialValue: viewKeys.slice(),
      validation: Rule => Rule.unique().error('A view can be in the list once. Remove the repeat.'),
    }),
    defineField({
      name: 'themeByWeekday',
      title: 'Theme of each weekday',
      type: 'object',
      group: 'look',
      hidden: true,
      description: 'Set on the Themes page, under Settings. Original on Monday, Wednesday, Friday and Sunday, Cybertron on the other days to start.',
      fields: themeWeekdays.map(themeDayField),
    }),
  ];
}
