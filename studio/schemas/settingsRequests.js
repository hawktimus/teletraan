// The hidden nextLookRequest and competitionPreviewRequest of Dashboard Settings, in the
// Screen tab. The Next look now and Preview competition buttons on the Start here page
// (start-here.js) write the time into them (screen-requests.js), and the screen answers a
// request once. Each has one read only field, requestedAt. Editors never see them: hidden
// keeps them out of the form, and their values stay in the document.
//
// The starting values are the same as defaultSettings.nextLookRequest and
// defaultSettings.competitionPreviewRequest in dashboard/config.js, and a missing one means
// no request. check-schemas.mjs fails if they differ.
//
// To take the section out later: delete this file, remove its import and the two lines that
// use nextLookRequestField and competitionPreviewRequestField in dashboardSettings.js, remove
// the buttons in start-here-parts.js and the functions in screen-requests.js, and remove the
// same names from check-schemas.mjs and config.js.

import { defineField } from 'sanity';

function requestField(name, title, button, what) {
  return defineField({
    name: name,
    title: title,
    type: 'object',
    group: 'screen',
    hidden: true,
    description: 'Filled in by the ' + button + ' button on the Start here page. ' + what + ' Do not edit it.',
    fields: [
      defineField({
        name: 'requestedAt',
        title: 'Requested at',
        type: 'datetime',
        readOnly: true,
        description: 'When the button was last clicked. The screen answers a request once, and only for a minute after this time.',
      }),
    ],
  });
}

export function nextLookRequestField() {
  return requestField('nextLookRequest', 'Last next look', 'Next look now', 'The screen moves on to the next look, once.');
}

export function competitionPreviewRequestField() {
  return requestField('competitionPreviewRequest', 'Last competition preview', 'Preview competition', 'The screen shows the competition cards for 2 minutes, once.');
}
