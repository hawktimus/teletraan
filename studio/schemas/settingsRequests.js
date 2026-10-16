// The hidden nextLookRequest and competitionPreviewRequest of Dashboard Settings, in the
// Screen tab. The Next look now and Preview competition buttons on the Start here page
// (start-here.js) write the time into them (screen-requests.js), and the screen answers a
// request once. Each has one read only field, requestedAt. Editors never see them: hidden
// keeps them out of the form, and their values stay in the document.
//
// The starting values are the same as defaultSettings.nextLookRequest and
// defaultSettings.competitionPreviewRequest in dashboard/config.js, and a missing one means
// no request. tests/schemas.test.mjs fails if they differ.
//
// To take the section out later: delete this file, remove its import and the two lines that
// use nextLookRequestField and competitionPreviewRequestField in dashboardSettings.js, remove
// the buttons in start-here-parts.js and the functions in screen-requests.js, and remove the
// same names from tests/schemas.test.mjs and config.js.

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
  return requestField('nextLookRequest', 'Last next look', 'Next look now', 'The main panel moves on to its next row, once.');
}

export function competitionPreviewRequestField() {
  return requestField('competitionPreviewRequest', 'Last competition preview', 'Preview competition', 'The screen shows the competition cards for 2 minutes, once.');
}

// The requests of the control page (dashboard/core/screen-requests.js). The page writes them and
// each ends at its until time, so a forgotten one does nothing after that.
function untilField() {
  return defineField({
    name: 'until',
    title: 'Until',
    type: 'datetime',
    readOnly: true,
    description: 'When the request ends.',
  });
}

function controlField(name, title, what, extra) {
  return defineField({
    name: name,
    title: title,
    type: 'object',
    group: 'screen',
    hidden: true,
    description: 'Filled in by the control page. ' + what + ' Do not edit it.',
    fields: extra.concat(untilField()),
  });
}

function wordField(name, title, list) {
  return defineField({
    name: name,
    title: title,
    type: 'string',
    readOnly: true,
    description: list ? 'What the request names.' : 'What the request names, up to 60 characters.',
    options: list ? { list: list } : undefined,
    validation: list ? undefined : rule => rule.max(60).error('Use 60 characters or fewer.'),
  });
}

export function screenRequestFields() {
  return [
    controlField('holdPanel', 'Hold panel', 'The large frame keeps one panel.', [wordField('panel', 'Panel')]),
    controlField('showView', 'Show view', 'The screen shows one view.', [wordField('key', 'View', ['general', 'prime', 'nova', 'family'])]),
    controlField('previewTheme', 'Preview theme', 'The screen shows one theme.', [wordField('theme', 'Theme', ['original', 'cybertron', 'retro', 'foundry'])]),
    controlField('pauseRotation', 'Pause rotation', 'The rotation stops.', []),
  ];
}
