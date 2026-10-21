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
// A string and not a datetime: the control page clears a request by writing an empty text, and
// a datetime field refuses an empty text. A text that is not empty must still be a date and time.
export function untilProblem(value) {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) {
    return 'Must be a valid ISO-8601 formatted date string';
  }
  return true;
}

function untilField() {
  return defineField({
    name: 'until',
    title: 'Until',
    type: 'string',
    readOnly: true,
    description: 'When the request ends. Empty when there is no request.',
    validation: rule => rule.custom(untilProblem),
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

// The words are checked here and not by a list on the field, because a list refuses the empty
// text that the control page writes when a request is cleared.
export function wordProblem(list) {
  return value => {
    if (value === undefined || value === null || value === '') return true;
    if (list) return list.includes(value) ? true : 'Value did not match any allowed values';
    return typeof value === 'string' && value.length <= 60 ? true : 'Use 60 characters or fewer.';
  };
}

function wordField(name, title, list) {
  return defineField({
    name: name,
    title: title,
    type: 'string',
    readOnly: true,
    description: list ? 'What the request names. Empty when there is no request.' : 'What the request names, up to 60 characters.',
    validation: rule => (list ? rule.custom(wordProblem(list)) : [rule.max(60).error('Use 60 characters or fewer.'), rule.custom(wordProblem(list))]),
  });
}

// The row the held panel plays, as JSON. Empty when the hold has none, and then the wall plays the first row of the Rotation
// with that panel. The control page writes it and clears it with the hold.
function holdRowField() {
  return defineField({
    name: 'holdRow',
    title: 'Hold row',
    type: 'string',
    group: 'screen',
    hidden: true,
    readOnly: true,
    description: 'Filled in by the control page. The row the held panel plays, up to 400 characters. Do not edit it.',
    validation: rule => rule.max(400).error('Use 400 characters or fewer.'),
  });
}

export function screenRequestFields() {
  return [
    controlField('holdPanel', 'Hold panel', 'The large frame keeps one panel.', [wordField('panel', 'Panel')]),
    holdRowField(),
    controlField('showView', 'Show view', 'The screen shows one view.', [wordField('key', 'View', ['general', 'prime', 'nova', 'family'])]),
    controlField('previewTheme', 'Preview theme', 'The screen shows one theme.', [wordField('theme', 'Theme', ['original', 'cybertron', 'retro', 'foundry'])]),
    controlField('pauseRotation', 'Pause rotation', 'The rotation stops.', []),
  ];
}
