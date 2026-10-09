// A team the screen can show, such as Hawktimus Prime. A team is a name, a set
// of colors and a switch that flips the layout left to right. Tasks, sponsors
// and the other kinds of content point to a team with the Team field
// (fields.js, teamField), and the screen shows the content of the team that is
// on the screen. Content with no team shows for every team.
//
// The two starting teams are in docs/seed/teams.ndjson. The starting colors of
// a new team are the Prime ones, so a team that is typed in by hand has
// colors that work until they are changed.

import { defineType, defineField } from 'sanity';
import { tooLong, byOrder, aToZ, subtitleFor } from './fields.js';

// A hex color: # and six characters from 0 to 9 and A to F
const hexColor = /^#[0-9A-Fa-f]{6}$/;
const hexMessage = 'Use # and six characters from 0 to 9 and A to F, such as #6C18B6.';

// The code is used in the data, so it has no capitals, spaces or marks
const teamCode = /^[a-z0-9]+$/;

function colorField(name, title, description, start) {
  return defineField({
    name: name,
    title: title,
    type: 'string',
    description: description,
    initialValue: start,
    validation: Rule => [Rule.required().error('Add the color.'), Rule.regex(hexColor, { name: 'hex color' }).error(hexMessage)],
  });
}

export default defineType({
  name: 'team',
  title: 'Teams',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Team name',
      type: 'string',
      description: 'The team name shown in the banner, such as Hawktimus Prime. Up to 20 characters fit.',
      validation: Rule => [Rule.required().error('Give the team a name.'), tooLong(Rule, 20)],
    }),
    defineField({
      name: 'shortName',
      title: 'Short name',
      type: 'string',
      description: 'A short name for the panel headers, such as PRIME. Up to 8 characters fit.',
      validation: Rule => [Rule.required().error('Give the team a short name.'), tooLong(Rule, 8)],
    }),
    defineField({
      name: 'number',
      title: 'Team number',
      type: 'string',
      description: 'Optional. The FRC team number, such as 3229. Up to 6 characters fit.',
      validation: Rule => tooLong(Rule, 6),
    }),
    defineField({
      name: 'code',
      title: 'Team code',
      type: 'string',
      description: 'Lowercase letters and digits, such as prime. The data uses it, so do not change it later. Up to 10 characters fit.',
      validation: Rule => [
        Rule.required().error('Give the team a code.'),
        tooLong(Rule, 10),
        Rule.regex(teamCode, { name: 'lowercase code' }).error('Use lowercase letters and digits only, with no spaces, such as prime.'),
      ],
    }),
    defineField({
      name: 'logo',
      title: 'Logo',
      type: 'image',
      description: 'Optional. A picture for the banner. Leave it empty to use the shared Hawktimus bird.',
      options: { hotspot: true, accept: 'image/*' },
    }),
    defineField({
      name: 'colors',
      title: 'Colors',
      type: 'object',
      description: 'The colors of the team on the screen. Each is # and six characters from 0 to 9 and A to F, such as #6C18B6.',
      fields: [
        colorField('primary', 'Main color', 'The main color of the team, for header tabs and the bird.', '#6C18B6'),
        colorField('plate', 'Plate color', 'The color of the team plate and of the header inset.', '#3B2A7A'),
        colorField('accent', 'Accent color', 'The accent, for small marks and key words.', '#FACA2A'),
        colorField('neon', 'Neon color', 'The bright color of thin lines and clock digits.', '#35F0FF'),
        colorField('pink', 'Second bright color', 'A second bright color, for thin lines and small marks.', '#FF2E8C'),
        colorField('background', 'Background color', 'The color behind everything, such as the page and the banner.', '#09060F'),
        colorField('text', 'Text color', 'The color of the main text.', '#FFFFFF'),
      ],
    }),
    defineField({
      name: 'mirror',
      title: 'Mirror the layout',
      type: 'boolean',
      description: 'Turn this on to flip the whole screen left to right while this team is showing.',
      initialValue: false,
    }),
    defineField({
      name: 'active',
      title: 'Active',
      type: 'boolean',
      description: 'Turn this off to leave the team out of the Team choice and out of Alternate mode.',
      initialValue: true,
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
      description: 'A lower number comes first, in this list and in the Team choice. It starts at 10.',
      initialValue: 10,
      validation: Rule => Rule.integer().error('Use a whole number such as 1, 2 or 3.'),
    }),
  ],
  orderings: [byOrder, aToZ('name')],
  preview: {
    select: { title: 'name', number: 'number', mirror: 'mirror', active: 'active', media: 'logo' },
    prepare(item) {
      const text = [item.number, item.mirror ? 'Mirror on' : 'Mirror off'].filter(Boolean).join(' · ');
      // a team that is not active is left out of the rotation, like an item that is hidden
      return { title: item.title || 'Team with no name', subtitle: subtitleFor(text, { show: item.active }), media: item.media };
    },
  },
});
