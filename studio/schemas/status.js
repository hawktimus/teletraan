// What the Mini last did, in one document with the fixed id 'status-mini'. The
// Mini writes it with deploy/scripts/status-write.sh after each job, so editors
// never open it: it is not in the sidebar or the New menu (structure.js,
// sanity.config.js), and Dashboard Settings shows it in the status block at the
// top of the Screen tab (settingsStatus.js). The dashboard never reads it.
//
// Every time is optional. A job the Mini has not run yet has no time. buildCommit, buildDate and
// buildBranch are the build on the wall, written by the job version of status-write.sh.

import { defineType, defineField } from 'sanity';

function timeField(name, title, description) {
  return defineField({ name: name, title: title, type: 'datetime', description: description });
}

function textField(name, title, description) {
  return defineField({ name: name, title: title, type: 'string', description: description });
}

export default defineType({
  name: 'status',
  title: 'Status of the Mini',
  type: 'document',
  readOnly: true,
  // Keeps it out of Studio's search, so it is not found by accident
  __experimental_omnisearch_visibility: false,
  fields: [
    timeField('lastContentSeenAt', 'Last content update seen', 'The newest change to published content when the Mini last looked. The Mini writes this.'),
    timeField('lastCalendarSyncAt', 'Last calendar sync', 'When the Mini last downloaded the team calendars. The Mini writes this.'),
    timeField('lastSlidesFetchAt', 'Last slides fetch', 'When the Mini last downloaded the slides of the coming talks. The Mini writes this.'),
    timeField('lastMondaySyncAt', 'Last Monday sync', 'When the Mini last read the Monday boards. The Mini writes this.'),
    timeField('lastFrcSyncAt', 'Last FRC data sync', 'When the Mini last read the FRC competition data. The Mini writes this.'),
    timeField('kioskStartedAt', 'Screen started', 'When the browser on the Mini last started the screen. The Mini writes this.'),
    textField('buildCommit', 'Build on the wall', 'The short hash of the files the screen runs. The Mini writes this.'),
    textField('buildDate', 'Build date', 'The day of that build. The Mini writes this.'),
    textField('buildBranch', 'Build branch', 'The branch of that build. The Mini writes this.'),
  ],
  preview: {
    prepare: () => ({ title: 'Status of the Mini' }),
  },
});
