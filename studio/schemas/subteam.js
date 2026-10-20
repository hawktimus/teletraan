import { defineType, defineField, defineArrayMember } from 'sanity';
import { limits } from './limits.js';
import { firstNameOnlyWarning, noContact } from '../tools/content-rules.js';
import { showField, expiresField, orderField, teamField, tooLong, byOrder, aToZ, subtitleFor } from './fields.js';

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
  title: 'Team lead',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Subteam name',
      type: 'string',
      description: 'The name of the subteam. Up to 11 characters fit.',
      validation: Rule => [Rule.required().error('Give the subteam a name.'), tooLong(Rule, limits.leadDepartment)],
    }),
    defineField({
      name: 'lead',
      title: 'Lead',
      type: 'string',
      description: 'Who leads the subteam. Up to 17 characters fit.',
      validation: Rule => [tooLong(Rule, limits.leadName), Rule.custom(noContact).warning(), Rule.custom(firstNameOnlyWarning).warning()],
    }),
    defineField({
      name: 'photo',
      title: 'Photo',
      type: 'image',
      description: 'A square photo of the lead with a plain background. First name only goes in Lead. Drag the circle onto the face so the screen crops around it.',
      options: { hotspot: true, accept: 'image/*' },
    }),
    defineField({
      name: 'showPhoto',
      title: 'Show photo on screen',
      type: 'boolean',
      description: 'Turn this off to show a plain silhouette instead of the photo, without deleting the photo.',
      initialValue: true,
    }),
    defineField({
      name: 'line',
      title: 'Line under the lead',
      type: 'string',
      description: 'One short line under TEAM LEAD, such as a year or a note. Leave blank to show the subteam name. Up to 48 characters fit. Shown on pages of 3 people or fewer.',
      validation: Rule => [tooLong(Rule, limits.leadLine), Rule.custom(noContact).warning()],
    }),
    defineField({
      name: 'members',
      title: 'Members',
      type: 'array',
      description: 'First names only. Drag to change the order. Up to 24 names fit, 12 characters each.',
      of: [
        defineArrayMember({
          type: 'string',
          validation: Rule => [Rule.required().error('Type a name, or remove the empty line.'), tooLong(Rule, limits.leadMember), Rule.custom(checkMember), Rule.custom(noContact).warning(), Rule.custom(firstNameOnlyWarning).warning()],
        }),
      ],
      initialValue: [],
      validation: Rule => [Rule.max(limits.leadMembers).error('Only 24 names fit on the screen. Remove one.'), Rule.custom(checkNoRepeats)],
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
      validation: Rule => tooLong(Rule, limits.spotlightHeadline),
    }),
    defineField({
      name: 'spotlightText',
      title: 'Spotlight text',
      type: 'text',
      rows: 3,
      description: "Two or three short sentences about the subteam's work. Up to 100 characters fit.",
      hidden: spotlightOff,
      validation: Rule => [tooLong(Rule, limits.spotlightText), Rule.custom(noContact).warning()],
    }),
    defineField({
      name: 'monday',
      title: 'On the Monday board',
      type: 'boolean',
      hidden: true,
      description: 'Not read any more: the Rotation board chooses which department is on the TV.',
      initialValue: true,
    }),
    teamField(),
    orderField(),
    showField(),
    expiresField(),
  ],
  orderings: [byOrder, aToZ('name')],
  preview: {
    select: { title: 'name', lead: 'lead', members: 'members', spotlight: 'spotlight', show: 'show', expires: 'expires', media: 'photo' },
    prepare(item) {
      // the Team Leads panel shows the lead, with the department at the right end, or the department and [lead]
      const lead = typeof item.lead === 'string' ? item.lead.trim() : '';
      const department = typeof item.title === 'string' ? item.title.trim() : '';
      const role = lead === '' ? '[lead]' : department === '' ? 'Lead' : department + ' lead';
      const count = Array.isArray(item.members) ? item.members.length : 0;
      const members = count === 1 ? '1 member' : count > 1 ? count + ' members' : '';
      const text = [role, members, item.spotlight ? 'In the spotlight' : ''].filter(Boolean).join(' · ');
      return { title: lead || department || 'Team lead with no name', subtitle: subtitleFor(text, item), media: item.media };
    },
  },
});
