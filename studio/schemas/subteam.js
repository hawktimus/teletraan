import { defineType, defineField } from 'sanity';
import { showField, expiresField, orderField, tooLong, byOrder, aToZ, subtitleFor } from './fields.js';

// The two spotlight fields only matter when the spotlight is on
const spotlightOff = ({ document }) => !document || !document.spotlight;

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
    select: { title: 'name', lead: 'lead', spotlight: 'spotlight', show: 'show', expires: 'expires' },
    prepare(item) {
      const text = [item.lead, item.spotlight ? 'In the spotlight' : ''].filter(Boolean).join(' · ');
      return { title: item.title || 'Subteam with no name', subtitle: subtitleFor(text, item) };
    },
  },
});
