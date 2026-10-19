// What the Teletraan computer last did, in one document with the fixed id 'status-mini'. The
// computer writes it with computer/scripts/status-write.sh after each job, so editors
// never open it: it is not in the sidebar or the New menu (structure.js,
// sanity.config.js), and Dashboard Settings shows it in the status block at the
// top of the Screen tab (settingsStatus.js). The dashboard never reads it.
//
// Every time is optional. A job the Teletraan computer has not run yet has no time. buildVersion, buildCommit, buildDate and
// buildBranch are the build on the wall, written by the job version of status-write.sh.

import { defineType, defineField } from 'sanity';
import { textField } from './fields.js';

function timeField(name, title, description) {
  return defineField({ name: name, title: title, type: 'datetime', description: description });
}

export default defineType({
  name: 'status',
  title: 'Status of the Teletraan computer',
  type: 'document',
  readOnly: true,
  // Keeps it out of Studio's search, so it is not found by accident
  __experimental_omnisearch_visibility: false,
  fields: [
    timeField('lastContentSeenAt', 'Last content update seen', 'The newest change to published content when the Teletraan computer last looked. The computer writes this.'),
    timeField('lastCalendarSyncAt', 'Last calendar sync', 'When the Teletraan computer last downloaded the team calendars. The computer writes this.'),
    timeField('lastSlidesFetchAt', 'Last slides fetch', 'When the Teletraan computer last downloaded the slides of the coming talks. The computer writes this.'),
    timeField('lastMondaySyncAt', 'Last Monday sync', 'When the Teletraan computer last read the Monday boards. The computer writes this.'),
    timeField('lastFrcSyncAt', 'Last FRC data sync', 'When the Teletraan computer last read the FRC competition data. The computer writes this.'),
    timeField('match13At', 'Last Match13 read', 'When the Teletraan computer last read the Match13 forecasts. The computer writes this.'),
    timeField('kioskStartedAt', 'Screen started', 'When the browser on the Teletraan computer last started the screen. The computer writes this.'),
    textField('buildCommit', 'Build on the wall', 'The short hash of the files the screen runs. The Teletraan computer writes this.'),
    textField('buildDate', 'Build date', 'The day of that build. The Teletraan computer writes this.'),
    textField('buildBranch', 'Build branch', 'The branch of that build. The Teletraan computer writes this.'),
    defineField({ name: 'buildVersion', title: 'Build version', type: 'number', description: 'The release number of that build, as the control page counts them. Empty when the files did not come from a release. The Teletraan computer writes this.' }),
    // The watchdog (computer/scripts/watchdog.sh) and the nightly backup (backup-dataset.sh)
    defineField({ name: 'kioskRestarts', title: 'Screen restarts today', type: 'number', description: 'How many times the watchdog restarted the screen on the day of the last restart. The Teletraan computer writes this.' }),
    defineField({ name: 'lastKioskRestartAt', title: 'Last screen restart', type: 'datetime', description: 'When the watchdog last restarted the screen, or stopped restarting it. The Teletraan computer writes this.' }),
    defineField({ name: 'lastBackupAt', title: 'Last backup', type: 'datetime', description: 'When the nightly backup of the dataset last finished. The Teletraan computer writes this.' }),
    // The Google Drive photo folder (computer/scripts/photos-drive-sync.sh, status-write.sh photos-drive)
    timeField('photosDriveAt', 'Last Drive photos read', 'When the Teletraan computer last looked at the Google Drive photo folder. The computer writes this.'),
    textField('photosDriveState', 'Drive photos state', 'How the last read of the Google Drive photo folder went: ok, off, no-folder, no-key, bad-key, api-off or not-shared. The Teletraan computer writes this.'),
    defineField({ name: 'photosDriveCount', title: 'Drive photos', type: 'number', description: 'How many pictures the Google Drive photo folder had at the last read. The Teletraan computer writes this.' }),
    // Match13 state and count (computer/scripts/match13-sync.sh, status-write.sh match13): no forecast is stored here
    textField('match13State', 'Match13 state', 'How the last read of Match13 went: ok, no-key, bad-key, limit or down. The Teletraan computer writes this.'),
    defineField({ name: 'match13Count', title: 'Match13 teams', type: 'number', description: 'How many teams the Match13 file held at the last read. The Teletraan computer writes this.' }),
    // The FIRST news headlines (computer/scripts/news-sync.sh, status-write.sh news)
    timeField('newsAt', 'Last news read', 'When the Teletraan computer last read the FIRST news headlines. The computer writes this.'),
    defineField({ name: 'newsCount', title: 'News headlines', type: 'number', description: 'How many headlines the last read of the FIRST news kept. The Teletraan computer writes this.' }),
  ],
  preview: {
    prepare: () => ({ title: 'Status of the Teletraan computer' }),
  },
});
