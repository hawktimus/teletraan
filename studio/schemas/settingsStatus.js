// The status block at the top of the Screen tab of Dashboard Settings: when the
// Mini last read the content, the calendars, the slides, Monday and the FRC
// feed, and when the screen last started. It is one read only field with an
// input of its own (../status-input.js) that reads the document status-mini
// (status.js). The field stores nothing, so it is not in the published settings
// and the dashboard never reads it.
//
// To take the whole section out later: delete this file, remove its import and
// the line that uses statusBlockField in dashboardSettings.js, and remove the
// same name from check-schemas.mjs.

import { defineField } from 'sanity';
import { StatusInput } from '../status-input.js';

export function statusBlockField() {
  return defineField({
    name: 'miniStatus',
    title: 'Status of the Mini',
    type: 'string',
    group: 'screen',
    readOnly: true,
    description: 'What the Mini last did. The Mini writes this by itself, so there is nothing to type here.',
    components: { input: StatusInput },
  });
}
