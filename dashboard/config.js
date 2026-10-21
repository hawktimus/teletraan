// Settings that rarely change and are not secret. Secret things, like the
// calendar feed addresses, never go in this file.

// Where the weather is taken from
export const location = {
  name: 'Holly Springs, NC',
  latitude: 35.6513,
  longitude: -78.8336,
};

// The content editor (Sanity). The project ID is public, since it is part of
// every address the screen asks for, so it is fine to keep it in the repository.
export const sanity = {
  projectId: 'ybfqe345',
  dataset: 'production',
  apiVersion: '2025-02-19',
};

// Calendar files and sample content live in one of these folders. The sample
// folder is kept in git. The live folder is filled in
// by the Teletraan computer and is never committed.
export const sampleFolder = 'data/sample/';
export const liveFolder = 'data/live/';

// The countdown looks more serious as the date gets closer
export const threat = {
  tenseDays: 30,
  criticalDays: 7,
};

export {
  speeds, metals, looks, themeIds, barStyle, styles, screenIds, weekdays, defaultSchedule, standardSwapSeconds,
  defaultScreen, teamPanels, mondayRows, mondayKinds, mondayDepartments, mondayLists, mondayCharts, mondayTeams,
  retiredMondayPanels, retiredWords, teamModes, lookSwaps, competitionModes,
  competitionSwitches, competitionLeadDays, competitionPreviewDays, competitionRecapDays, competitionEstimateSpread,
  competitionTrendPoints, competitionPreviewSeconds, pageChangeStyles, frameFinishes,
  photoOrders, photoSources, photoFits, portraitShapes, portraitFrames, nightStyles, nightSpeeds, nightFirstHit, limits,
  defaultPhotoRow, screenLimits, viewKeys, scheduledThemeIds, defaultThemeByWeekday, viewIds, viewTeams,
  viewLimits, viewLayoutNames, countdownPlaces, viewColors, defaultViews, familyPanels,
} from './config-lists.js';
export { backgrounds, motions, screenFits } from './config-lists.js';
export { defaultSettings, defaultThemeSettings } from './config-settings.js';
export {
  demoWindowSeconds, demoSkewSeconds, demoMaxSteps, demoDefaultSeconds, demoPlaceholderText, hiddenAdvanceSeconds,
  hiddenWindowSeconds, hiddenForceSeconds,
  hiddenGapHours, previewSeconds, defaultDemo, defaultPerson, talkStatuses, defaultTalk, filterActions,
  defaultFilter, calendarKinds, noCalendarKind, teamTrim, teamMetals, teamPalettes, glowClass, defaultTeam,
  primeTeam, invertedHeaderInk, invertedColors,
} from './config-more.js';
export {
  defaultRotationRows, rotationViews, rotationAliases, rotationKeyOfView, roboticsTitle, olderGeneralTitle,
  transitionSecondsRange, placeholderPanels, designDepartment, rosterPageRows, roboticsWidePanels,
} from './config-rotation.js';
