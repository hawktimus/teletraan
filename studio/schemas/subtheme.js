// A dated layer drawn over a theme and a view: small pictures at fixed places on the
// screen. The dashboard reads it in core/subthemes.js and draws it in
// core/subthemes-layer.js. The anchors and motions below are the same lists as in
// dashboard/core/anchors.js and core/subthemes.js, and tests/subthemes.test.mjs fails
// when they differ. Two live subthemes at once: the one with the higher priority wins.

import { defineType, defineField, defineArrayMember } from 'sanity';
import { tooLong, titleOf } from './fields.js';
import { subthemePresets } from '../inputs/themes.js';

const themes = [
  { title: 'Any theme', value: '' },
  { title: 'Original', value: 'original' },
  { title: 'Cybertron', value: 'cybertron' },
  { title: 'Retro', value: 'retro' },
  { title: 'Foundry', value: 'foundry' },
];

const views = [
  { title: 'Any view', value: '' },
  { title: 'General', value: 'general' },
  { title: 'Prime', value: 'prime' },
  { title: 'Nova', value: 'nova' },
  { title: 'Condensed', value: 'family' },
];

const anchors = [
  { title: 'Banner, left end', value: 'banner-left' },
  { title: 'Banner, right end', value: 'banner-right' },
  { title: 'Above the countdown', value: 'countdown-top' },
  { title: 'Ticker, end', value: 'ticker-end' },
  { title: 'Side, bottom', value: 'side-bottom' },
  { title: 'Main panel, corner', value: 'main-corner' },
];

const motions = [
  { title: 'None', value: 'none' },
  { title: 'Drift (a slow sway)', value: 'drift' },
  { title: 'Blink (fades in and out)', value: 'blink' },
  { title: 'Fall (a slow descent that loops)', value: 'fall' },
];

const presets = [{ title: 'None, my own pictures', value: '' }].concat(subthemePresets.map(preset => ({ title: preset.name, value: preset.id })));

const slotCode = /^[a-z0-9-]+$/;
const slotMessage = 'Use lowercase letters, digits and hyphens only, such as star.';

function values(list) {
  return list.map(item => item.value);
}

// Two dates, the end not before the start
function endIsNotBefore(value, context) {
  const start = context.document && context.document.start;
  if (!value || !start) return true;
  return value >= start || 'The end is before the start.';
}

export default defineType({
  name: 'subtheme',
  title: 'Subtheme',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'A name so editors can tell the subthemes apart. It does not show on the screen. Up to 40 characters.',
      validation: Rule => [Rule.required().error('Give the subtheme a name.'), tooLong(Rule, 40)],
    }),
    defineField({
      name: 'enabled',
      title: 'Subtheme on',
      type: 'boolean',
      description: 'Turn this off to keep the subtheme without drawing it.',
      initialValue: true,
    }),
    defineField({
      name: 'start',
      title: 'First day',
      type: 'date',
      description: 'The first day it is drawn. Leave empty to start at once.',
    }),
    defineField({
      name: 'end',
      title: 'Last day',
      type: 'date',
      description: 'The last day it is drawn, that day included. Leave empty to keep it drawn.',
      validation: Rule => Rule.custom(endIsNotBefore),
    }),
    defineField({
      name: 'priority',
      title: 'Priority',
      type: 'number',
      description: 'Optional. When two subthemes are live at once, the higher number is drawn. Empty counts as 0.',
      validation: Rule => Rule.integer().error('Use a whole number such as 1, 2 or 3.'),
    }),
    defineField({
      name: 'preset',
      title: 'Subtheme',
      type: 'string',
      description: 'Optional. Halloween, Winter or Kickoff, drawn on the frames from the first day to the last. Empty uses your own pictures and rules below.',
      options: { list: presets },
      initialValue: '',
      validation: Rule => Rule.valid(values(presets)).error('Pick a subtheme from the list.'),
    }),
    defineField({
      name: 'assets',
      title: 'Pictures',
      type: 'array',
      description: 'The pictures, as SVG or PNG. Each has a slot, a short name that the rules below use. Up to 12.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'subthemeAsset',
          title: 'Picture',
          fields: [
            defineField({
              name: 'slot',
              title: 'Slot',
              type: 'string',
              description: 'A short name such as star. A rule picks the picture by this name. Up to 20 characters.',
              validation: Rule => [
                Rule.required().error('Give the picture a slot name.'),
                tooLong(Rule, 20),
                Rule.regex(slotCode, { name: 'lowercase code' }).error(slotMessage),
              ],
            }),
            defineField({
              name: 'image',
              title: 'Picture',
              type: 'image',
              description: 'An SVG or PNG file. A drawing of lines works best. Other kinds of picture are not drawn.',
              options: { hotspot: true, accept: 'image/*' },
              validation: Rule => Rule.required().error('Add a picture.'),
            }),
          ],
          preview: {
            select: { slot: 'slot', media: 'image' },
            prepare({ slot, media }) {
              return { title: slot || 'No slot', media: media };
            },
          },
        }),
      ],
      validation: Rule => Rule.max(12).error('Only 12 pictures fit. Remove one.'),
    }),
    defineField({
      name: 'rules',
      title: 'Rules',
      type: 'array',
      description: 'Where each picture is drawn. A rule fits only the theme and view it names. Up to 20.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'subthemeRule',
          title: 'Rule',
          fields: [
            defineField({
              name: 'theme',
              title: 'Theme',
              type: 'string',
              description: 'The theme the rule fits. Any theme means every theme.',
              options: { list: themes },
              initialValue: '',
              validation: Rule => Rule.valid(values(themes)).error('Pick a theme from the list.'),
            }),
            defineField({
              name: 'view',
              title: 'View',
              type: 'string',
              description: 'The view the rule fits. Any view means every view.',
              options: { list: views },
              initialValue: '',
              validation: Rule => Rule.valid(values(views)).error('Pick a view from the list.'),
            }),
            defineField({
              name: 'slot',
              title: 'Slot',
              type: 'string',
              description: 'The slot of the picture to draw, as typed in Pictures. Up to 20 characters.',
              validation: Rule => [
                Rule.required().error('Type the slot of a picture.'),
                tooLong(Rule, 20),
                Rule.regex(slotCode, { name: 'lowercase code' }).error(slotMessage),
              ],
            }),
            defineField({
              name: 'anchor',
              title: 'Place',
              type: 'string',
              description: 'The place on the screen. Each place is a small box clear of the text.',
              options: { list: anchors },
              validation: Rule => [Rule.required().error('Pick a place.'), Rule.valid(values(anchors)).error('Pick a place from the list.')],
            }),
            defineField({
              name: 'size',
              title: 'Size',
              type: 'number',
              description: 'The most it grows, from 40 to 240. The box of the place can make it smaller.',
              initialValue: 80,
              validation: Rule => [
                Rule.required().error('Type a size from 40 to 240.'),
                Rule.integer().min(40).max(240).error('Use a whole number from 40 to 240.'),
              ],
            }),
            defineField({
              name: 'motion',
              title: 'Motion',
              type: 'string',
              description: 'How it moves. Calm motion draws it still.',
              options: { list: motions, layout: 'radio', direction: 'horizontal' },
              initialValue: 'none',
              validation: Rule => [Rule.required().error('Pick a motion.'), Rule.valid(values(motions)).error('Pick a motion from the list.')],
            }),
          ],
          preview: {
            select: { slot: 'slot', anchor: 'anchor', theme: 'theme', view: 'view' },
            prepare({ slot, anchor, theme, view }) {
              return {
                title: (slot || 'No slot') + ' at ' + (titleOf(anchors, anchor) || 'no place'),
                subtitle: (titleOf(themes, theme || '') || 'Any theme') + ', ' + (titleOf(views, view || '') || 'Any view'),
              };
            },
          },
        }),
      ],
      validation: Rule => Rule.max(20).error('Only 20 rules fit. Remove one.'),
    }),
  ],
  preview: {
    select: { name: 'name', enabled: 'enabled', start: 'start', end: 'end' },
    prepare({ name, enabled, start, end }) {
      const days = start && end ? start + ' to ' + end : start ? 'from ' + start : end ? 'until ' + end : 'no dates';
      return { title: name || 'Unnamed subtheme', subtitle: (enabled === false ? 'Off, ' : '') + days };
    },
  },
});
