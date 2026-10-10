// A team the screen can show, such as Hawktimus Prime. A team is a name, a set
// of colors and a switch that flips the layout left to right. Tasks, sponsors
// and the other kinds of content point to a team with the Team field
// (fields.js, teamField), and the screen shows the content of the team that is
// on the screen. Content with no team shows for every team.
//
// The two starting teams are in docs/seed/teams.ndjson. The starting colors of
// a new team are the Prime ones, so a team that is typed in by hand has
// colors that work until they are changed. The trim starts the same way: eight choices in the
// Trim box that make a team look like itself beyond its colors and the mirror (teamTrim in
// dashboard/config.js, and "Team trim" in docs/layouts.md). The first choice of each is the one
// Prime has, and a team made before the trim existed has none stored and reads as Prime.

import { defineType, defineField } from 'sanity';
import { tooLong, byOrder, aToZ, subtitleFor } from './fields.js';

// A hex color: # and six characters from 0 to 9 and A to F
const hexColor = /^#[0-9A-Fa-f]{6}$/;
const hexMessage = 'Use # and six characters from 0 to 9 and A to F, such as #6C18B6.';

// The code is used in the data, so it has no capitals, spaces or marks
const teamCode = /^[a-z0-9]+$/;

// The values are the names in teamTrim in dashboard/config.js, in the same order
const trimChoices = {
  bolts: [{ title: 'Hex nuts', value: 'hex' }, { title: 'Round rivets', value: 'round' }],
  cornerCut: [{ title: 'Top left and bottom right', value: 'tl-br' }, { title: 'Top right and bottom left', value: 'tr-bl' }],
  headerNotch: [{ title: 'Notch', value: 'step' }, { title: 'Slant', value: 'slant' }],
  grid: [{ title: 'Lines', value: 'lines' }, { title: 'Dots', value: 'dots' }],
  logoPose: [{ title: 'Auto', value: 'auto' }, { title: 'Flight', value: 'flight' }],
  nameStyle: [{ title: 'Solid', value: 'solid' }, { title: 'Outline', value: 'outline' }],
  tickerLabel: [{ title: 'Plate', value: 'plate' }, { title: 'Bar', value: 'bar' }],
  countAccent: [{ title: 'Red', value: 'red' }, { title: 'Neon', value: 'neon' }],
};

function trimField(name, title, description) {
  const list = trimChoices[name];

  return defineField({
    name: name,
    title: title,
    type: 'string',
    fieldset: 'trim',
    description: description,
    options: { list: list, layout: 'radio', direction: 'horizontal' },
    initialValue: list[0].value,
    validation: Rule => Rule.valid(list.map(item => item.value)).error('Pick ' + list.map(item => item.title.toLowerCase()).join(' or ') + '.'),
  });
}

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
  fieldsets: [
    {
      name: 'trim',
      title: 'Trim',
      description: 'How the team looks on the screen beyond its colors. The first choice of each is how Hawktimus Prime looks.',
      options: { collapsible: true, collapsed: false },
    },
  ],
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
    trimField('bolts', 'Bolts', 'The bolts at the joints of the frames. Hex nuts have six sides. Round rivets are round, with a slot.'),
    trimField('cornerCut', 'Cut corners', 'Which two corners every panel cuts. The other two stay square.'),
    trimField('headerNotch', 'Header end', 'How the colored tab at the top of a panel ends. Notch is the usual step. Slant is one cut at 60 degrees.'),
    trimField('grid', 'Page grid', 'The grid on the page behind Cybertron and Minimal. Lines cross the page. Dots are one in each square.'),
    trimField('logoPose', 'Bird pose', 'How the bird sits in the banner when it is not moving. Auto is the emblem. Flight is the hawk with its wings up.'),
    trimField('nameStyle', 'Team name look', 'The team name in the banner. Outline has letters with no fill, and a line under them in the accent color.'),
    trimField('tickerLabel', 'Ticker label', 'The word at the start of the ticker. Plate is a cut plate. Bar is a thin bar with a block of the accent color in front.'),
    trimField('countAccent', 'Countdown color', 'The color of the red parts of the countdown. Red is the usual. Neon is the neon color of this team.'),
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
