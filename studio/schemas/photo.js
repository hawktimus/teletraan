// A photo for the Photo panel on the TV. The picture is uploaded here, so there
// is no web address to paste. The screen asks Sanity for each photo no wider
// than the screen (dashboard/core/images.js). There is no approval field: a
// photo that is on shows as soon as it is published, so check it before you do.

import { defineType, defineField } from 'sanity';
import { showField, expiresField, tooLong, subtitleFor } from './fields.js';

// The credit is a first name, so a space or a digit means a last name or
// something else is in there. A hyphen is fine, as in Mary-Anne.
function firstNameOnly(value) {
  if (typeof value === 'string' && /[\s\d]/.test(value)) return 'Use a first name only, with no spaces or numbers.';
  return true;
}

// The values are the names in photoFits in dashboard/config.js, and setting
// means the photo follows Photo fit in Dashboard Settings
const fits = [
  { title: 'Same as Dashboard Settings', value: 'setting' },
  { title: 'Fill the frame', value: 'fill' },
  { title: 'Show the whole photo', value: 'whole' },
];

const newestFirst = {
  title: 'Newest first',
  name: 'newestFirst',
  by: [{ field: '_createdAt', direction: 'desc' }],
};

export default defineType({
  name: 'photo',
  title: 'Photo',
  type: 'document',
  fields: [
    defineField({
      name: 'image',
      title: 'Picture',
      type: 'image',
      description: 'Upload a photo. Wide photos fill the screen best. Drag the circle onto the main subject so the screen keeps it in view when the photo is cut to the card.',
      options: { hotspot: true, accept: 'image/*' },
      validation: Rule => Rule.required().error('Add a picture.'),
    }),
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'string',
      description: 'Optional. A short line under the picture. No last names. Up to 36 characters fit.',
      validation: Rule => tooLong(Rule, 36),
    }),
    defineField({
      name: 'credit',
      title: 'Credit',
      type: 'string',
      description: 'Optional. The first name of the person who took it, with no last name. The screen shows Photo: and the name. Up to 14 characters fit.',
      validation: Rule => [tooLong(Rule, 14), Rule.custom(firstNameOnly)],
    }),
    defineField({
      name: 'fit',
      title: 'Fit',
      type: 'string',
      description: 'Optional. Fill the frame cuts this photo to the card. Show the whole photo keeps its shape. The first choice follows Photo fit in Dashboard Settings.',
      options: { list: fits, layout: 'radio', direction: 'horizontal' },
      initialValue: 'setting',
      validation: Rule => Rule.valid(fits.map(fit => fit.value)).error('Pick one of the three choices.'),
    }),
    showField(),
    expiresField(),
  ],
  orderings: [newestFirst],
  preview: {
    select: { title: 'caption', credit: 'credit', show: 'show', expires: 'expires', media: 'image' },
    prepare(item) {
      return {
        title: item.title || 'Photo with no caption',
        subtitle: subtitleFor(item.credit ? 'Photo: ' + item.credit : '', item),
        media: item.media,
      };
    },
  },
});
