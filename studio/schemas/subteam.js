import { defineType, defineField, defineArrayMember } from 'sanity';
import { showField, expiresField, orderField, tooLong, byOrder, aToZ, subtitleFor } from './fields.js';

// The two spotlight fields only matter when the spotlight is on
const spotlightOff = ({ document }) => !document || !document.spotlight;

// A member is a first name. Spaces alone or a number in it are almost always a slip.
function checkMember(name) {
  if (typeof name !== 'string') return true;
  if (name.trim() === '') return 'Type a name, or remove the empty line.';
  return /\d/.test(name) ? 'Use a first name, with no numbers.' : true;
}

// The same name twice, with or without capitals, shows twice on the screen
function checkNoRepeats(names) {
  const seen = [];

  for (let i = 0; i < (names || []).length; i++) {
    const name = String(names[i] || '').trim().toLowerCase();
    if (name === '') continue;
    if (seen.indexOf(name) !== -1) return 'The name "' + String(names[i]).trim() + '" is on the list twice. Add a last initial to tell them apart, such as Sam K.';
    seen.push(name);
  }
  return true;
}

export default defineType({
  name: 'subteam',
  title: 'Subteam',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Subteam name',
      type: 'string',
      description: 'The name of the subteam. Up to 11 characters fit.',
      validation: Rule => [Rule.required().error('Give the subteam a name.'), tooLong(Rule, 11)],
    }),
    defineField({
      name: 'lead',
      title: 'Lead',
      type: 'string',
      description: 'Who leads the subteam. Up to 17 characters fit.',
      validation: Rule => tooLong(Rule, 17),
    }),
    defineField({
      name: 'members',
      title: 'Members',
      type: 'array',
      description: 'First names only. Drag to change the order. Up to 24 names fit, 12 characters each.',
      of: [
        defineArrayMember({
          type: 'string',
          validation: Rule => [Rule.required().error('Type a name, or remove the empty line.'), tooLong(Rule, 12), Rule.custom(checkMember)],
        }),
      ],
      initialValue: [],
      validation: Rule => [Rule.max(24).error('Only 24 names fit on the screen.'), Rule.custom(checkNoRepeats)],
    }),
    defineField({
      name: 'spotlight',
      title: 'In the spotlight',
      type: 'boolean',
      description: 'Turn this on to feature the subteam on the spotlight panel.',
      initialValue: false,
    }),
    defineField({
      name: 'spotlightHeadline',
      title: 'Spotlight headline',
      type: 'string',
      description: 'A headline for the spotlight, such as what the subteam did this week. Up to 40 characters fit.',
      hidden: spotlightOff,
      validation: Rule => tooLong(Rule, 40),
    }),
    defineField({
      name: 'spotlightText',
      title: 'Spotlight text',
      type: 'text',
      rows: 3,
      description: "Two or three short sentences about the subteam's work. Up to 100 characters fit.",
      hidden: spotlightOff,
      validation: Rule => tooLong(Rule, 100),
    }),
    orderField(),
    showField(),
    expiresField(),
  ],
  orderings: [byOrder, aToZ('name')],
  preview: {
    select: { title: 'name', lead: 'lead', members: 'members', spotlight: 'spotlight', show: 'show', expires: 'expires' },
    prepare(item) {
      const count = Array.isArray(item.members) ? item.members.length : 0;
      const members = count === 1 ? '1 member' : count > 1 ? count + ' members' : '';
      const text = [item.lead, members, item.spotlight ? 'In the spotlight' : ''].filter(Boolean).join(' · ');
      return { title: item.title || 'Subteam with no name', subtitle: subtitleFor(text, item) };
    },
  },
});
