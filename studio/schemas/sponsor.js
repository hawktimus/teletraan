import { defineType, defineField } from 'sanity';
import { showField, expiresField, orderField, tooLong, byOrder, aToZ, subtitleFor } from './fields.js';

export default defineType({
  name: 'sponsor',
  title: 'Sponsor',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Sponsor name',
      type: 'string',
      description: "The sponsor's name. Up to 19 characters fit.",
      validation: Rule => [Rule.required().error("Add the sponsor's name."), tooLong(Rule, 19)],
    }),
    defineField({
      name: 'tier',
      title: 'Tier',
      type: 'string',
      description: "The sponsor's level, as the team names its levels. Up to 12 characters fit.",
      validation: Rule => tooLong(Rule, 12),
    }),
    defineField({
      name: 'blurb',
      title: 'About the sponsor',
      type: 'text',
      rows: 3,
      description: 'One or two sentences about what the sponsor does for the team. Up to 80 characters fit.',
      validation: Rule => tooLong(Rule, 80),
    }),
    defineField({
      name: 'thankYou',
      title: 'Thank-you line',
      type: 'string',
      description: 'The thank-you shown on the ticker at the bottom of the screen. Up to 54 characters fit.',
      validation: Rule => tooLong(Rule, 54),
    }),
    defineField({
      name: 'logoAddress',
      title: 'Logo address',
      type: 'url',
      description: 'The web address of the logo picture. Logos are not uploaded to Studio.',
    }),
    orderField(),
    showField(),
    expiresField(),
  ],
  orderings: [byOrder, aToZ('name')],
  preview: {
    select: { title: 'name', tier: 'tier', show: 'show', expires: 'expires' },
    prepare(item) {
      return { title: item.title || 'Sponsor with no name', subtitle: subtitleFor(item.tier || '', item) };
    },
  },
});
