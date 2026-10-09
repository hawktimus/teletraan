// The hidden previewRequest of Dashboard Settings, in the Screen tab. The Preview buttons
// (actions.js) write the kind and the time into it and publish, and the screen then holds
// that team, style or seasonal pack for 2 minutes (dashboard/core/preview.js). It has two
// read only fields, kind and requestedAt. Editors never see it: hidden keeps it out of the
// form, and its value stays in the document.
//
// The kinds are the ones in previews.js, a copy of previewKinds in dashboard/core/preview.js.
// The starting value is the same as defaultSettings.previewRequest in dashboard/config.js,
// and a missing one means no request. check-schemas.mjs fails if any of them differ.
//
// To take the whole section out later: delete this file, remove its import and the line that
// uses previewRequestField in dashboardSettings.js, remove the buttons in actions.js and
// sanity.config.js, and remove the same names from check-schemas.mjs and config.js.

import { defineField } from 'sanity';
import { previews } from '../previews.js';

// The kinds a click can ask for: the ones in previews.js. The list is only there to show
// which one was asked for, because the field is read only.
const kinds = previews.map(entry => ({ title: 'Preview ' + entry.name, value: entry.id }));

export function previewRequestField() {
  return defineField({
    name: 'previewRequest',
    title: 'Last preview',
    type: 'object',
    group: 'screen',
    hidden: true,
    description: 'Filled in by the Preview buttons beside Publish. The screen shows that look for 2 minutes, once. Do not edit it.',
    fields: [
      defineField({
        name: 'kind',
        title: 'Which preview',
        type: 'string',
        readOnly: true,
        description: 'The look the last click asked for. A button fills it in.',
        options: { list: kinds, layout: 'radio', direction: 'horizontal' },
        validation: Rule => Rule.valid(kinds.map(kind => kind.value)).error('This is filled in by the Preview buttons.'),
      }),
      defineField({
        name: 'requestedAt',
        title: 'Requested at',
        type: 'datetime',
        readOnly: true,
        description: 'When the button was last clicked. The screen shows a preview once, and only for a minute after this time.',
      }),
    ],
  });
}
