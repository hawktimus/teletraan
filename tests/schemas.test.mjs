// Loads every schema without installing anything and checks it against what
// the dashboard reads. Run it with: node tests/schemas.test.mjs

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readModule } from './helpers/read-module.mjs';
import { textOf } from './helpers/script-parts.mjs';

const here = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'studio');
const dashboardFolder = path.join(here, '..', 'dashboard');

// The shape of the content, as the dashboard reads it. A field name that is
// not listed here is a field the dashboard would ignore, and a name that is
// listed but missing from a schema is something the dashboard expects.
//   text(30)   a string or text field that must stop at 30 characters
//   'string'   a string picked from a fixed list
//   hexColor   a string written as # and six hex characters, such as #6C18B6
const text = max => ({ kind: 'text', max: max });
//   title(28, 40, 'words')   a string that is only warned about above 28 characters, with the words of the
//                            warning, and refused above 40
const title = (warn, max, message) => ({ kind: 'title', warn: warn, max: max, message: message });
const number = (min, max) => ({ kind: 'number', min: min, max: max });
const object = fields => ({ kind: 'object', fields: fields });
const rows = (fields, maxItems) => ({ kind: 'rows', fields: fields, maxItems: maxItems });
const strings = (max, maxItems) => ({ kind: 'strings', max: max, maxItems: maxItems });
const teamRef = { kind: 'reference', to: 'team' };
const hexColor = { kind: 'hex' };

const titleOfClock = title(28, 40, 'Long titles wrap to two lines on the screen.');

const blockNames = ['headingBlock', 'textBlock', 'statBlock', 'listBlock', 'imageBlock', 'progressBlock', 'countdownBlock'];
const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const panelStep = { panel: 'string', show: 'boolean', seconds: number(6, 120) };
const olderStep = { panel: 'string', show: 'boolean', seconds: 'number' }; // the rows of the hidden older lists have no rules

function withFlags(fields) {
  return Object.assign({}, fields, { show: 'boolean', expires: 'datetime' });
}

// The limits are what fits on the screen, measured with ordinary mixed case
// text. Change one here only after measuring the panel again.
const contract = {
  task: withFlags({
    title: text(22),
    subteam: { kind: 'reference', to: 'subteam' },
    status: 'string',
    finishedOn: 'datetime',
    contact: text(12),
    location: { kind: 'reference', to: 'place' },
    source: 'string',
    priority: 'string',
    dueDate: 'date',
    showOnTv: 'boolean',
    team: teamRef,
    order: 'number',
    startDate: 'date',
    estHours: 'number',
    completedOn: 'date',
    owners: strings(12, 6),
    milestoneIds: strings(20, 50),
    showOnBoard: 'boolean',
    hiddenReason: 'string',
  }),
  milestone: { name: text(40), targetDate: 'date', team: teamRef, subteam: { kind: 'reference', to: 'subteam' }, status: 'string', show: 'boolean' },
  place: { name: text(16), show: 'boolean' },
  plan: withFlags({
    heading: text(26),
    date: 'date',
    location: text(30),
    rows: rows({ time: text(9), text: text(18), lead: text(10) }, 5),
    team: teamRef,
  }),
  presentationDay: {
    firstSlotAt: 'datetime',
    lastSlotAt: 'datetime',
    slotMinutes: number(5, 30),
    open: 'boolean',
    team: teamRef,
  },
  presentation: {
    name: text(12),
    subteam: 'string',
    topic: text(40),
    start: 'datetime',
    minutes: number(5, 30),
    deckLink: 'url',
    status: 'string',
    team: teamRef,
  },
  // the dashboard no longer reads these. The type stays in the schema, so its limits are still checked
  extraEvent: { title: text(30), startDate: 'date', endDate: 'date', startTime: 'time', endTime: 'time', location: text(24), team: teamRef, show: 'boolean' },
  calendarFilter: {
    name: text(40),
    action: 'string',
    force: 'boolean',
    words: strings(30, 5),
    days: { kind: 'weekdays', startsOn: 1 },
    calendar: text(20),
    fromDate: 'date',
    toDate: 'date',
    show: 'boolean',
    expires: 'datetime',
  },
  subtheme: {
    name: text(40),
    enabled: 'boolean',
    start: 'date',
    end: 'date',
    priority: 'number',
    preset: 'string',
    assets: rows({ slot: text(20), image: 'image' }, 12),
    rules: rows({ theme: 'string', view: 'string', slot: text(20), anchor: 'string', size: number(40, 240), motion: 'string' }, 20),
  },
  sponsor: withFlags({ name: text(19), tier: text(12), blurb: text(80), thankYou: text(54), logoAddress: 'url', team: teamRef, order: 'number' }),
  tipOrNews: withFlags({ kind: 'string', text: text(52), team: teamRef, order: 'number' }),
  announcement: { text: text(90), start: 'datetime', end: 'datetime', team: teamRef, level: 'string' },
  subteam: withFlags({
    name: text(11),
    lead: text(17),
    photo: 'image',
    showPhoto: 'boolean',
    line: text(48),
    monday: 'boolean',
    members: strings(12, 24),
    spotlight: 'boolean',
    spotlightHeadline: text(40),
    spotlightText: text(100),
    team: teamRef,
    order: 'number',
  }),
  person: withFlags({ role: 'string', name: text(17), title: text(22), line: text(48), photo: 'image', showPhoto: 'boolean', team: teamRef, order: 'number' }),
  team: {
    name: text(20),
    shortName: text(8),
    number: text(6),
    code: text(10),
    logo: 'image',
    colors: object({ primary: hexColor, plate: hexColor, accent: hexColor, neon: hexColor, pink: hexColor, background: hexColor, text: hexColor, body: hexColor, label: hexColor, headerInk: hexColor, dark: hexColor, retro: hexColor }),
    metal: 'string',
    palette: 'string',
    glow: 'boolean',
    mirror: 'boolean',
    bolts: 'string',
    cornerCut: 'string',
    headerNotch: 'string',
    grid: 'string',
    logoPose: 'string',
    nameStyle: 'string',
    outlinedName: 'boolean',
    tickerLabel: 'string',
    countAccent: 'string',
    active: 'boolean',
    order: 'number',
  },
  photo: withFlags({ image: 'image', caption: text(36), credit: text(14), fit: 'string' }),
  customPanel: withFlags({ title: text(7), blocks: { kind: 'blocks', max: 6 }, team: teamRef, order: 'number' }),
  dashboardSettings: {
    team: object({ name: text(16), number: text(5), school: text(30) }),
    motion: 'string',
    speed: 'string',
    frameMetal: 'string',
    contentSource: 'string',
    glint: 'boolean',
    look: 'string',
    style: 'string',
    pageSeconds: number(8, 120),
    partsRequestUrl: text(200),
    logoAnimations: 'boolean',
    logoEntrance: 'boolean',
    logoSpin: 'boolean',
    logoSpinEvery: number(0, 3600),
    logoSpinDuration: number(0.5, 10),
    logoHawk: 'boolean',
    logoHawkEvery: number(0, 3600),
    logoHawkDuration: number(6, 30),
    nameTransform: 'boolean',
    nameEvery: number(0, 900),
    nameDuration: number(0.5, 10),
    pageChangeStyle: 'string',
    breakSeconds: number(0.3, 2),
    frameFinish: 'string',
    silverChance: number(0, 100),
    photoOrder: 'string',
    photoSeconds: number(6, 120),
    portraitScale: number(60, 200),
    photoScale: number(60, 100),
    photoFit: 'string',
    leadershipPortrait: number(60, 220),
    rosterPortrait: number(60, 220),
    portraitShape: 'string',
    portraitFrame: 'string',
    nightEnabled: 'boolean',
    nightStyle: 'string',
    nightLogoWidth: number(120, 800),
    nightSpeed: 'string',
    nightPreview: 'boolean',
    hiddenEnabled: 'boolean',
    desktopEveryHours: number(1, 1000),
    desktopChance: 'number',
    redEyesEveryHours: number(1, 1000),
    redEyesChance: 'number',
    hiddenRequest: object({ kind: 'string', requestedAt: 'datetime' }),
    presentationsEnabled: 'boolean',
    presentationTestRequest: object({ requestedAt: 'datetime' }),
    teamMode: 'string',
    alternateMinutes: number(1, 30),
    dailyStyles: { kind: 'choiceList' },
    mondayStyle: 'string',
    teamOrder: { kind: 'references', to: 'team' },
    lookSwap: 'string',
    generalViewName: text(16),
    generalViewTitle: text(28),
    viewOrder: { kind: 'choiceList' },
    transitionSeconds: number(2, 4),
    rotationRows: rows({ view: 'string', panel: 'string', seconds: number(6, 120), shown: 'boolean', side: 'string', part: number(1, 2), department: { kind: 'plainString' }, photoCount: number(1, 20), secondsPerPhoto: number(5, 60) }),
    themeByWeekday: object({ monday: 'string', tuesday: 'string', wednesday: 'string', thursday: 'string', friday: 'string', saturday: 'string', sunday: 'string' }),
    background: 'string',
    screenSchedule: object({ monday: 'string', tuesday: 'string', wednesday: 'string', thursday: 'string', friday: 'string', saturday: 'string', sunday: 'string' }),
    announceRequest: object({ requestedAt: 'datetime' }),
    previewRequest: object({ kind: 'string', requestedAt: 'datetime' }),
    nextLookRequest: object({ requestedAt: 'datetime' }),
    competitionPreviewRequest: object({ requestedAt: 'datetime' }),
    holdPanel: object({ panel: text(60), until: 'datetime' }),
    showView: object({ key: 'string', until: 'datetime' }),
    previewTheme: object({ theme: 'string', until: 'datetime' }),
    pauseRotation: object({ until: 'datetime' }),
    countdown: object({ kickoffLabel: titleOfClock, kickoff: 'datetime', rolloutLabel: titleOfClock, rollout: 'datetime' }),
    alert: object({ on: 'boolean', headline: text(24), message: text(90), until: 'datetime' }),
    rotation: object({ order: rows(panelStep), grid1: rows(olderStep), grid2: rows(olderStep), tickerSeconds: number(6, 120) }),
    doneDays: 'number',
    safetyDaysSince: 'date',
    crt: object({ on: 'boolean', everySeconds: number(0, 3600), durationSeconds: number(0.5, 10) }),
    announcements: rows({
      time: 'time',
      title: text(24),
      followUp: text(24),
      titleSeconds: number(3, 60),
      followUpSeconds: number(3, 60),
      days: { kind: 'weekdays' },
      show: 'boolean',
    }),
    calendars: rows({ id: text(20), name: text(20), kind: 'string', show: 'boolean' }),
    groupEventsByKind: 'boolean',
    showConnectionStatus: 'boolean',
    competitionMode: 'string',
    competitionTimeline: 'boolean',
    competitionLastSeason: 'boolean',
    competitionRank: 'boolean',
    competitionNextMatch: 'boolean',
    competitionResults: 'boolean',
    competitionAlliance: 'boolean',
    competitionDistrict: 'boolean',
    mondayBoards: rows({
      boardId: text(20),
      team: teamRef,
      statusFrom: 'string',
      statusColumn: text(50),
      backlogLabel: text(30),
      progressLabel: text(30),
      doneLabel: text(30),
      priorityColumn: text(50),
      priorityHigh: text(30),
      priorityMedium: text(30),
      priorityLow: text(30),
      dueColumn: text(50),
      ownerColumn: text(50),
      teamColumn: text(50),
    }, 10),
    mondayShowOwners: 'boolean',
    mondayEveryMinutes: number(5, 120),
    mondayTaskBoard: object({
      boardId: text(20),
      departmentColumn: text(50),
      statusColumn: text(50),
      teamColumn: text(50),
      priorityColumn: text(50),
      showColumn: text(50),
      assignedColumn: text(50),
      pocColumn: text(50),
      timelineColumn: text(50),
      hoursColumn: text(50),
      completedColumn: text(50),
      milestoneColumn: text(50),
      teamLabels: rows({ index: number(0, 999), team: teamRef }, 10),
      statusIndexes: object({ todo: number(0, 999), inProgress: number(0, 999), inReview: number(0, 999), stuck: number(0, 999), done: number(0, 999) }),
      priorityIndexes: object({ high: number(0, 999), medium: number(0, 999), low: number(0, 999) }),
      hideLabel: text(30),
      departmentLabels: rows({ index: number(0, 999), name: text(30), subteam: { kind: 'reference', to: 'subteam' }, neverShown: 'boolean' }, 30),
    }),
    mondayMilestoneBoard: object({
      boardId: text(20),
      dateColumn: text(50),
      teamColumn: text(50),
      departmentColumn: text(50),
      statusColumn: text(50),
      teamLabels: rows({ index: number(0, 999), team: teamRef }, 10),
      statusIndexes: object({ notStarted: number(0, 999), onTrack: number(0, 999), atRisk: number(0, 999), done: number(0, 999) }),
      departmentLabels: rows({ index: number(0, 999), name: text(30), subteam: { kind: 'reference', to: 'subteam' } }, 30),
    }),
  },
  theme: {
    defaultTheme: 'string',
    useNow: object({ theme: 'string', overlay: 'string', until: 'datetime' }),
    schedule: rows({
      name: text(24),
      kind: 'string',
      theme: 'string',
      overlay: 'string',
      startDate: 'date',
      endDate: 'date',
      repeatsEveryYear: 'boolean',
      tickerPrefix: text(12),
      bannerLine: text(40),
      cornerArt: 'string',
      subtheme: 'string',
    }, 24),
    timeZone: text(40),
    seasonOverPanels: 'boolean',
  },
  demo: {
    requestedAt: 'datetime',
    steps: rows({ screen: 'string', seconds: number(5, 300) }, 10),
    announcementText: text(24),
  },
  // the three Screens: a row names a registry panel, and the team of a row is a team code, both or nothing
  screen: {
    nameEffectEveryMinutes: number(1, 240),
    hawkEveryMinutes: number(1, 240),
    swapSeconds: number(0.5, 3),
    mainRows: rows({ panel: 'string', team: { kind: 'plainString' }, department: { kind: 'plainString' }, seconds: number(6, 120), photoCount: number(1, 20), secondsPerPhoto: number(5, 60), photoTotal: { kind: 'plainString' } }),
    mondayStyle: 'string',
    sideRows: rows({ panel: 'string', seconds: number(6, 120) }),
  },
  // the four Views: a row names a registry panel, and the team of a row is a team code or nothing
  view: {
    key: 'string',
    title: text(16),
    team: teamRef,
    layout: 'string',
    mirror: 'boolean',
    viewTag: 'boolean',
    teamChip: 'boolean',
    colors: 'string',
    minutes: number(1, 30),
    panels: rows({ panel: 'string', team: { kind: 'plainString' }, department: { kind: 'plainString' }, seconds: number(6, 120), photoCount: number(1, 20), secondsPerPhoto: number(5, 60), photoTotal: { kind: 'plainString' } }),
    countdownIn: 'string',
    sidePanels: rows({ panel: 'string', seconds: number(6, 120) }),
  },
  headingBlock: { text: text(30) },
  textBlock: { text: text(100) },
  statBlock: { value: text(6), label: text(24) },
  listBlock: { items: strings(34, 5) },
  imageBlock: { address: 'url' },
  progressBlock: { label: text(30), percent: number(0, 100) },
  countdownBlock: { label: text(24), target: 'datetime' },
};

// Fields and types in the Studio that the dashboard never reads, with the reason for each.
// The notes and the status block store nothing, and the status document is written by the Teletraan computer.
const studioOnlyFields = {
  'dashboardSettings.miniStatus': 'the status block at the top of the Screen tab. It stores nothing',
  'dashboardSettings.lookNote': 'the note on the Look tab. It stores nothing',
  'view.rotationNote': 'the note on the Main panel tab of a view, which points to the Rotation list. It stores nothing',
  'dashboardSettings.cycleNote': 'the second note on the Look tab, which says what a cycle is. It stores nothing',
  'dashboardSettings.mondayConnection': 'the block at the top of the Monday tab. It stores nothing',
  'dashboardSettings.mondayTokenTest': 'the Test the token button of the Monday tab. It stores nothing',
  'dashboardSettings.frcConnection': 'the block at the top of the Competition tab. It stores nothing',
  'theme.settingsNote': 'the note on the Look page. It stores nothing',
  'dashboardSettings.nightStart': 'hidden. The screen uses the fixed time in dashboard/core/constants.js',
  'dashboardSettings.nightEnd': 'hidden. The screen uses the fixed time in dashboard/core/constants.js',
  'dashboardSettings.noShowMinutes': 'hidden. The screen uses the fixed number in dashboard/core/constants.js',
  'dashboardSettings.graceMinutes': 'hidden. The screen uses the fixed number in dashboard/core/constants.js',
  'presentationDay.closeMinutesBefore': 'hidden. The booking script reads it, and the dashboard never does',
  'task.boardNote': 'the line at the top of a task from the team board. It stores nothing',
  'task.manualNote': 'the line at the top of a task typed by hand, which the screen does not show. It stores nothing',
  'task.mondayId': 'hidden. The board sync uses it to find the task of a board item, and the dashboard never reads it',
  'task.mondayBoardId': 'hidden. The board sync writes the board of the item, and Monday Boards uses it to list the tasks of a board',
  'task.mondayBoardName': 'hidden. The board sync writes the name of the board, and Monday Tasks lists the tasks by it',
  'screen.bannerTeam': 'the button of the Banner section that opens the Team document. It stores nothing',
  'screen.countdownShown': 'the title and dates of the Countdown section, shown from Dashboard Settings. It stores nothing',
  'screen.tickerLink': 'the link of the Ticker section to Tips and News. It stores nothing',
  'view.countdownShown': 'the title and dates of the Countdown section, shown from Dashboard Settings. It stores nothing',
  'view.tickerLink': 'the link of the Ticker section to Tips and News. It stores nothing',
};
const studioOnlyTypes = {
  status: 'the Teletraan computer writes it for the status block, and the dashboard never reads it',
  calendarStatus: 'the Teletraan computer writes it for the Calendars page, and the dashboard never reads it',
};

// Types the Teletraan computer writes and the dashboard reads as a whole. Their fields are checked together in
// checkFrcStatus and not one by one against the contract above.
const writtenByTheComputer = {
  frcStatus: 'the Teletraan computer writes it, and the dashboard reads it to draw the competition cards',
  mondayStatus: 'the Teletraan computer writes it, the Monday tab shows it, and the dashboard reads its daily counts',
};

const itemTypes = ['task', 'plan', 'sponsor', 'tipOrNews', 'subteam', 'person', 'photo', 'customPanel'];

const choices = {
  'task.status': ['blocked', 'in-progress', 'in-review', 'up-next', 'done'],
  'task.source': ['manual', 'monday'],
  'task.priority': ['high', 'medium', 'low'],
  'tipOrNews.kind': ['tip', 'news', 'reminder'],
  'calendarFilter.action': ['hide', 'show'],
  'subtheme.preset': ['', 'halloween', 'winter', 'kickoff'],
  'theme.schedule.subtheme': ['halloween', 'winter', 'kickoff', 'none'],
  'subtheme.rules.theme': ['', 'original', 'cybertron', 'retro', 'foundry'],
  'subtheme.rules.view': ['', 'general', 'prime', 'nova', 'family'],
  'subtheme.rules.anchor': ['banner-left', 'banner-right', 'countdown-top', 'ticker-end', 'side-bottom', 'main-corner'],
  'subtheme.rules.motion': ['none', 'drift', 'blink', 'fall'],
  'dashboardSettings.calendars.kind': ['meetings', 'competitions', 'outreach', 'deadlines', 'other'],
  'presentation.subteam': ['Build', 'Programming', 'Design', 'Electrical', 'Outreach', 'Business', 'Other'],
  'presentation.status': ['scheduled', 'cancelled', 'done', 'skipped'],
  'person.role': ['Coach', 'Captain', 'Mentor'],
  'dashboardSettings.motion': ['full', 'calm'],
  'dashboardSettings.speed': ['very-slow', 'slow', 'normal', 'fast'],
  'dashboardSettings.frameMetal': ['gold', 'silver'],
  'dashboardSettings.look': ['polished', 'flat', 'plain'],
  'dashboardSettings.style': ['original', 'cybertron', 'minimal'],
  'dashboardSettings.pageChangeStyle': ['alternate', 'slat', 'mechanical'],
  'dashboardSettings.frameFinish': ['mostly-gold', 'alternate', 'gold', 'silver'],
  'dashboardSettings.photoOrder': ['random', 'newest-first'],
  'dashboardSettings.photoFit': ['fill', 'whole'],
  'photo.fit': ['setting', 'fill', 'whole'],
  'dashboardSettings.nightStyle': ['bounce', 'black'],
  'dashboardSettings.nightSpeed': ['slow', 'normal', 'fast'],
  'dashboardSettings.contentSource': ['production', 'sample'],
  'dashboardSettings.teamMode': ['prime', 'nova', 'alternate'],
  'dashboardSettings.mondayStyle': ['original', 'cybertron', 'minimal'],
  'dashboardSettings.lookSwap': ['assemble', 'slats', 'cut'],
  'dashboardSettings.competitionMode': ['auto', 'always', 'off'],
  'dashboardSettings.hiddenRequest.kind': ['desktop', 'redEyes'],
  'dashboardSettings.previewRequest.kind': ['prime', 'nova', 'cybertron', 'minimal', 'next-pack'],
  'demo.steps.screen': ['announcement', 'all-announcements', 'night-mode'],
  'dashboardSettings.portraitShape': ['square', 'rounded', 'circle'],
  'dashboardSettings.portraitFrame': ['metal', 'line', 'none'],
};

// The panels that can be put in each area of the screen. The Studio lists and
// defaultSettings in config.js must offer the same panels as registry.js.
const rotationAreas = ['grid1', 'grid2'];

// The field each sidebar list is sorted by. Where a line sits in structure.js
// is up to whoever edits that file, so only the sort of each list is checked.
const listSort = {
  task: 'mondayBoardName',
  plan: 'date',
  calendarFilter: 'name',
  subtheme: 'name',
  sponsor: 'order',
  tipOrNews: 'order',
  subteam: 'order',
  person: 'order',
  team: 'order',
  photo: '_createdAt',
  customPanel: 'order',
  presentationDay: 'firstSlotAt',
  presentation: 'start',
};

// The pages that exist once. Each is one document whose id is its type, except the three Screens, which are
// three pages of the type screen with an id each.
const pageTypes = ['dashboardSettings', 'theme', 'demo', 'screen', 'view'];
const screenPageIds = ['screen-original', 'screen-cybertron', 'screen-minimal'];
const viewPageIds = ['view-general', 'view-prime', 'view-nova', 'view-family'];

// Document types that have no line in structure.js, with the reason for each.
// Types that are only objects inside another document are not documents and
// are left out of the check without being listed here.
const notInSidebar = {
  extraEvent: 'events come from the calendars now, and the screen no longer reads these entries. The type stays, so the entries already typed still open',
  place: 'a task\'s Location field adds a place with Create new and opens it from there',
  demo: 'its buttons are on Start here',
  status: 'the Teletraan computer writes it, and Dashboard Settings shows it in the status block at the top of the Screen tab',
  calendarStatus: 'the Teletraan computer writes it, and the Calendars page shows it',
  frcStatus: 'the Teletraan computer writes it, and Dashboard Settings shows it in the block at the top of the Competition tab',
  mondayStatus: 'the Teletraan computer writes it, and Dashboard Settings shows it in the block at the top of the Monday tab',
  milestone: 'the Teletraan computer writes it, and the Monday Boards page opens it as its second list, Milestones',
};

// The sidebar titles that people look for by name
const sidebarTitles = {
  plan: 'Agenda items',
  calendarFilter: 'Calendar filters',
  subteam: 'Team leads',
  customPanel: 'Extra panels',
  presentationDay: 'Meeting days',
  team: 'Teams',
  theme: 'Look',
};

// The titles of the types, which the New menu and the plus button of Daily Agenda show. They follow
// the words of the sidebar, one document at a time. The types with no line in the sidebar keep their own.
const typeTitles = {
  plan: 'Agenda item',
  presentation: 'Presentation',
  subteam: 'Team lead',
  customPanel: 'Extra panel',
  theme: 'Look',
  place: 'Places',
  demo: 'Demo',
  extraEvent: 'Events Calendar',
};

// The sidebar as agreed. A heading is the first thing before
// the colon, and the lines under it come after. The first group has no heading.
const sidebarGroups = [
  'Start here',
  'SCREEN: Rotation, Views, Themes and backgrounds, Subthemes, Announcements, Extra panels',
  'TASKS: Daily Agenda, Monday Tasks, Monday Boards, Tips and News',
  'EVENTS: Calendars, Calendar filters',
  'PEOPLE: Leadership, Team leads, Sponsors, Photos',
  'COACHES ONLY: Dashboard Settings, Teams, Look, Old screens (not used)',
];

// What each folder holds, in order. A folder inside a folder has its lines in brackets.
const folderLines = {
  'Views': 'Robotics, Prime, Nova',
  'Daily Agenda': 'Agenda items, Presentations (Upcoming, Past), Meeting days',
  'Monday Tasks': 'On the TV, Hidden',
  'Old screens (not used)': 'The wall does not play these. They are kept so nothing is lost., Original, Cybertron, Minimal, Family',
};

// The types, or the templates of add-templates.js, that the plus button of a folder offers
const folderAdds = { 'Daily Agenda': 'plan,presentation' };

// The titles the sidebar used to have, in the first rebuild or before it. None of them may be left
// in a title, a description or a message that an editor reads.
const oldTitles = [
  { words: /\bSubteams\b/, was: 'Subteams', now: 'Team leads' },
  { words: /\bRoster (list|page|line)\b/i, was: 'Roster', now: 'Team leads' },
  { words: /\bLocations\b/, was: 'Locations', now: 'Places' },
  { words: /\bLocation name\b/, was: 'Location name', now: 'Place name' },
  { words: /\bCustom Panels?\b/i, was: 'Custom Panels', now: 'Extra panels' },
  { words: /\bTheme (page|document)\b/i, was: 'Theme', now: 'Look' },
  { words: /\bUp Next\b/, was: 'Up Next', now: 'Daily Agenda' },
  { words: /\bTest the screen\b/i, was: 'Test the screen', now: 'Demo' },
  { words: /\bPin a task\b/, was: 'Pin a task', now: 'Monday Tasks' },
  { words: /\bFrom the board\b/, was: 'From the board', now: 'On the TV' },
];

// The real 'sanity' and 'react' packages are not installed, so stand-ins with
// the same function names sit next to a copy of the files that import them.
const standIns = {
  sanity: {
    'package.json': JSON.stringify({
      name: 'sanity',
      type: 'module',
      exports: { '.': './index.js', './structure': './structure.js', './cli': './cli.js', './router': './router.js' },
    }),
    'index.js': [
      'export const defineType = type => type;',
      'export const defineField = field => field;',
      'export const defineArrayMember = member => member;',
      'export const defineConfig = config => config;',
      // writes down what an action does, so checkContentSource can read it back
      // only the names the Publish all tool imports, so that its file can be loaded
      // the client is the one a check puts in globalThis.studioClient: the Start here page sends through it
      'export const useClient = () => globalThis.studioClient || {};',
      'export const useSchema = () => ({ get: () => undefined });',
      'export const useWorkspace = () => ({});',
      'export const useCurrentUser = () => null;',
      // only the names the team input (team-input.js) imports besides useClient: the two patches it writes
      // set takes a path when a form patches a field other than its own (screen-input.js)
      "export const set = (value, path) => (path ? { type: 'set', value: value, path: path } : { type: 'set', value: value });",
      "export const unset = () => ({ type: 'unset' });",
      // the panel order input (panel-order-input.js) reads two lists of the document, which a check puts in globalThis.studioForm
      "export const useFormValue = path => (globalThis.studioForm || {})[path.join('.')];",
      'export const validateDocument = async () => [];',
      'export const useDocumentOperation = () => ({',
      '  patch: { execute: patches => globalThis.studioCalls.push({ patch: patches }) },',
      '  publish: { execute: () => globalThis.studioCalls.push({ publish: true }) },',
      '});',
    ].join('\n'),
    // the Monday Boards page (monday-boards-view.js) takes its links from the pane router: a check can put its own in globalThis.studioPaneRouter
    'structure.js': [
      'export const structureTool = options => ({ options: options });',
      "export const usePaneRouter = () => globalThis.studioPaneRouter || { ChildLink: 'ChildLink', navigateIntent: (...given) => { (globalThis.studioIntents = globalThis.studioIntents || []).push(given); } };",
    ].join('\n'),
    'cli.js': 'export const defineCliConfig = config => config;',
    // the link of the Ticker section (screen-fields.js) and the link that posts an announcement (start-here.js)
    'router.js': "export const Link = 'a'; export const IntentLink = 'a';",
  },
  react: {
    'package.json': JSON.stringify({ name: 'react', type: 'module', exports: { '.': './index.js' } }),
    'index.js': [
      'export const useState = value => [value, () => {}];',
      // a context holds its starting value, and a check can put the value a field should see in globalThis.studioContextValue
      "export const createContext = value => ({ current: value, Provider: 'ContextProvider' });",
      'export const useContext = context => (globalThis.studioContextValue === undefined ? context.current : globalThis.studioContextValue);',
      // a ref holds its starting value, which a check can read back
      'export const useRef = value => ({ current: value });',
      // writes down the effect, so a check can run it
      'export const useEffect = effect => { (globalThis.studioEffects = globalThis.studioEffects || []).push(effect); };',
      'export const createElement = (type, props, ...children) => ({ type: type, props: props, children: children });',
    ].join('\n'),
  },
};

// The icons structure.js imports, each from its own file of @sanity/icons:
// [file, name], such as ['Home', 'HomeIcon']
function iconImportsOf(source) {
  return Array.from(source.matchAll(/import \{ (\w+) \} from '@sanity\/icons\/(\w+)';/g)).map(match => [match[2], match[1]]);
}

function makeSandbox() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-studio-'));
  ['schemas', 'structure.js', 'inputs', 'tools', 'project.js', 'sanity.config.js', 'sanity.cli.js'].forEach(name => {
    fs.cpSync(path.join(here, name), path.join(folder, name), { recursive: true });
  });
  fs.writeFileSync(path.join(folder, 'package.json'), JSON.stringify({ type: 'module' }));

  Object.keys(standIns).forEach(packageName => {
    const stub = path.join(folder, 'node_modules', packageName);
    fs.mkdirSync(stub, { recursive: true });
    Object.keys(standIns[packageName]).forEach(name => fs.writeFileSync(path.join(stub, name), standIns[packageName][name]));
  });

  // An icon stand-in for each file of @sanity/icons that structure.js imports
  const icons = iconImportsOf(readModule(path.join(folder, 'structure.js'), 'utf8'));
  const iconFolder = path.join(folder, 'node_modules', '@sanity', 'icons');
  const iconExports = {};
  fs.mkdirSync(iconFolder, { recursive: true });
  icons.forEach(icon => {
    iconExports['./' + icon[0]] = './' + icon[0] + '.js';
    fs.writeFileSync(path.join(iconFolder, icon[0] + '.js'), 'export const ' + icon[1] + ' = () => null;');
  });
  fs.writeFileSync(path.join(iconFolder, 'package.json'), JSON.stringify({ name: '@sanity/icons', type: 'module', exports: iconExports }));
  return folder;
}

function load(file) {
  return import(pathToFileURL(file).href);
}

// A Rule that writes down what it is asked to do, so the limits can be read
// back without Sanity. Each call gives a new Rule, as the real one does.
const ruleMethods = [
  'required', 'min', 'max', 'length', 'integer', 'positive', 'regex', 'uri', 'email', 'custom', 'unique', 'valid',
  'error', 'warning', 'info',
];

function makeRule(constraints) {
  const rule = { constraints: constraints };
  ruleMethods.forEach(name => {
    rule[name] = function (...args) {
      return makeRule(constraints.concat([{ name: name, args: args }]));
    };
  });
  return rule;
}

function constraintsOf(item) {
  if (!item.validation) return [];

  const result = item.validation(makeRule([]));
  const rules = Array.isArray(result) ? result : [result];
  return rules.reduce((all, rule) => all.concat(rule.constraints), []);
}

function constraintNamed(constraints, name) {
  return constraints.filter(constraint => constraint.name === name)[0];
}

// The words of the error that comes right after a constraint
function messageAfter(constraints, name) {
  const index = constraints.indexOf(constraintNamed(constraints, name));
  const next = constraints[index + 1];
  return next && next.name === 'error' && next.args[0] ? String(next.args[0]) : '';
}

function typeByName(name) {
  return world.types.filter(type => type.name === name)[0];
}

// The fields of a type or of an object field, or of the items of a list
function fieldsIn(item) {
  if (item.fields) return item.fields;
  return item.of && item.of.length === 1 && item.of[0].fields ? item.of[0].fields : [];
}

// 'task.status' or 'dashboardSettings.rotation.grid1.panel'
function fieldAt(pathText) {
  const names = pathText.split('.');
  let current = typeByName(names[0]);
  for (let i = 1; i < names.length && current; i++) {
    current = fieldsIn(current).filter(field => field.name === names[i])[0];
  }
  return current;
}

function eachField(visit) {
  function walk(item, where) {
    fieldsIn(item).forEach(field => {
      visit(where + '.' + field.name, field);
      walk(field, where + '.' + field.name);
    });
  }
  world.types.forEach(type => walk(type, type.name));
}

// Every preview: on a type, or on the items of a list
function eachPreview(visit) {
  world.types.forEach(type => {
    if (type.preview) visit(type.name, type.preview);
  });
  eachField((where, field) => {
    (field.of || []).forEach(member => {
      if (member.preview) visit(where + ' item', member.preview);
    });
  });
}

function sameData(a, b) {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return a === b;

  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => sameData(a[key], b[key]));
}

function need(problems, condition, message) {
  if (!condition) problems.push(message);
}

function without(object, name) {
  const copy = Object.assign({}, object);
  delete copy[name];
  return copy;
}

// 2027-01-09T17:00:00.000Z written as 2027-01-09T12:00, as it reads in Holly Springs
function localTime(isoText) {
  const format = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return format.format(new Date(isoText)).replace(' ', 'T');
}

function compareFields(where, fields, expected, problems) {
  const names = fields.map(field => field.name);
  Object.keys(expected).forEach(name => {
    const field = fields.filter(item => item.name === name)[0];
    if (!field) problems.push(where + '.' + name + ': the dashboard expects this field and it is missing');
    else checkField(where + '.' + name, field, expected[name], problems);
  });
  names.forEach(name => {
    if (!expected[name] && !studioOnlyFields[where + '.' + name]) problems.push(where + '.' + name + ': the dashboard does not read this field');
  });
}

// Kinds with their own check. Any other kind is a plain Sanity type name.
const kindChecks = {
  text: checkText,
  title: checkTitle,
  string: checkChoice,
  time: checkTime,
  number: checkNumber,
  object: checkObject,
  reference: checkReference,
  rows: checkRows,
  strings: checkStrings,
  choiceList: checkChoiceList,
  references: checkReferences,
  weekdays: checkWeekdays,
  blocks: checkBlocks,
  image: checkImage,
  hex: checkHex,
  plainString: (field, want, say) => {
    if (field.type !== 'string') say('should be a string');
  },
};

function checkField(where, field, spec, problems) {
  const want = typeof spec === 'string' ? { kind: spec } : spec;
  const say = message => problems.push(where + ': ' + message);
  const specific = kindChecks[want.kind];

  if (specific) specific(field, want, say, problems, where);
  else if (field.type !== want.kind) say('should be type ' + want.kind + ', it is ' + field.type);
}

function checkLimit(item, max, say, what) {
  const constraints = constraintsOf(item);
  const limit = constraintNamed(constraints, 'max');

  if (!limit || limit.args[0] !== max) say(what + ' needs a limit of ' + max);
  else if (messageAfter(constraints, 'max').indexOf(String(max)) === -1) say('the error for the limit of ' + max + ' does not say ' + max);
}

function checkText(field, want, say) {
  if (field.type !== 'string' && field.type !== 'text') say('should be a string or text field');
  checkLimit(field, want.max, say, 'it');
  if ((field.description || '').indexOf(String(want.max)) === -1) say('the description does not mention the limit of ' + want.max);
}

function checkTitle(field, want, say) {
  if (field.type !== 'string') say('should be a string');

  const constraints = constraintsOf(field);
  const wordsAfter = (limit, name) => {
    const index = constraints.findIndex(constraint => constraint.name === 'max' && constraint.args[0] === limit);
    const next = constraints[index + 1];
    return index !== -1 && next && next.name === name ? String(next.args[0]) : null;
  };

  if (wordsAfter(want.warn, 'warning') !== want.message) say('it needs a warning above ' + want.warn + ' characters that says: ' + want.message);
  const refusal = wordsAfter(want.max, 'error');
  if (refusal === null || refusal.indexOf(String(want.max)) === -1) say('it needs an error above ' + want.max + ' characters that says ' + want.max);
  [want.warn, want.max].forEach(number => {
    if ((field.description || '').indexOf(String(number)) === -1) say('the description does not mention ' + number);
  });
}

function checkChoice(field, want, say) {
  if (field.type !== 'string') say('should be a string');
  if (!field.options || !field.options.list || field.options.list.length === 0) say('should be picked from a list');
}

function checkTime(field, want, say) {
  const pattern = constraintNamed(constraintsOf(field), 'regex');
  if (field.type !== 'string' || !pattern) return say('should be a string checked with a pattern');

  ['00:00', '09:05', '14:30', '23:59'].forEach(good => {
    if (!pattern.args[0].test(good)) say('the pattern refuses ' + good);
  });
  ['24:00', '9:05', '14:60', '1430', '14:3', '', 'ab:cd', '14:30 '].forEach(bad => {
    if (pattern.args[0].test(bad)) say('the pattern accepts "' + bad + '"');
  });
}

function checkNumber(field, want, say) {
  if (field.type !== 'number') say('should be a number');
  if (want.min === undefined) return;

  const constraints = constraintsOf(field);
  ['min', 'max'].forEach(name => {
    const found = constraintNamed(constraints, name);
    if (!found || found.args[0] !== want[name]) say('needs ' + name + ' ' + want[name]);
  });
}

function checkReference(field, want, say) {
  const target = field.to && field.to[0];
  if (field.type !== 'reference' || !target || target.type !== want.to) say('should be a reference to ' + want.to);
}

function checkObject(field, want, say, problems, where) {
  if (field.type !== 'object') say('should be an object');
  compareFields(where, field.fields || [], want.fields, problems);
}

function checkRows(field, want, say, problems, where) {
  if (field.type !== 'array' || fieldsIn(field).length === 0) return say('should be a list of objects');

  compareFields(where, fieldsIn(field), want.fields, problems);
  if (want.maxItems) checkLimit(field, want.maxItems, say, 'the list');
}

function checkStrings(field, want, say) {
  const member = field.of && field.of[0];
  if (field.type !== 'array' || !member || member.type !== 'string') return say('should be a list of strings');

  checkLimit(member, want.max, say, 'each line');
  checkLimit(field, want.maxItems, say, 'the list');
}

// A list of words, each picked from a list in its own row
function checkChoiceList(field, want, say) {
  const member = field.of && field.of[0];
  if (field.type !== 'array' || !member || member.type !== 'string') return say('should be a list of strings');

  if (!member.options || !member.options.list || member.options.list.length === 0) say('each row should be picked from a list');
}

// A list of references to one type
function checkReferences(field, want, say) {
  const member = field.of && field.of[0];
  const target = member && member.to && member.to[0];
  if (field.type !== 'array' || !member || member.type !== 'reference' || !target || target.type !== want.to) say('should be a list of references to ' + want.to);
}

function checkWeekdays(field, want, say) {
  const member = field.of && field.of[0];
  if (field.type !== 'array' || !member || member.type !== 'number') return say('should be a list of numbers');

  // the week starts on Sunday unless the contract says startsOn
  const first = want.startsOn || 0;
  const order = weekdayNames.map((name, index) => (index + first) % 7);
  const list = (field.options && field.options.list) || [];
  const wanted = order.map(day => day + ':' + weekdayNames[day]);
  if (list.map(item => item.value + ':' + item.title).join() !== wanted.join()) say('should be a checkbox list of 0 to 6 titled ' + weekdayNames[first] + ' to ' + weekdayNames[(first + 6) % 7]);
}

// A picture field: images only, with the crop and hotspot tools on, so an
// editor can keep a face in the middle of the square the screen cuts
function checkImage(field, want, say) {
  const options = field.options || {};

  if (field.type !== 'image') say('should be an image');
  if (options.hotspot !== true) say('should have the crop and hotspot tools on (options.hotspot)');
  if (options.accept !== 'image/*') say('should accept images only (options.accept should be "image/*")');
}

// A color field: a string written as # and six characters from 0 to 9 and A to F,
// refused with a message in plain words that gives an example
function checkHex(field, want, say) {
  const rules = constraintsOf(field);
  const pattern = constraintNamed(rules, 'regex');
  if (field.type !== 'string') say('should be a string');
  if (!pattern) return say('should be checked with a pattern');

  ['#6C18B6', '#6c18b6', '#000000', '#FFFFFF', '#0B0714'].forEach(good => {
    if (!pattern.args[0].test(good)) say('the pattern refuses ' + good);
  });
  ['6C18B6', '#6C18B', '#6C18B6F', '#GGGGGG', '#12345', 'purple', '#6C18B6 ', ' #6C18B6', '#6C18B6\n', ''].forEach(bad => {
    if (pattern.args[0].test(bad)) say('the pattern accepts "' + bad + '"');
  });

  const message = messageAfter(rules, 'regex');
  if (message.indexOf('#6C18B6') === -1 || /regex|hexadecimal|pattern/i.test(message)) say('the error for a color that is not written right should say what to write in plain words, with an example such as #6C18B6');
}

function checkBlocks(field, want, say) {
  const used = (field.of || []).map(member => member.type);
  if (used.join() !== blockNames.join()) say('should allow exactly: ' + blockNames.join(', '));
  checkLimit(field, want.max, say, 'the list');
}

function checkShape() {
  const problems = [];
  Object.keys(contract).forEach(name => {
    const type = typeByName(name);
    if (type) compareFields(name, fieldsIn(type), contract[name], problems);
    else problems.push(name + ' is missing from schemas/index.js');
  });
  world.types.forEach(type => {
    if (!contract[type.name] && !studioOnlyTypes[type.name] && !writtenByTheComputer[type.name]) problems.push(type.name + ' is a type the dashboard does not read');
  });
  return problems;
}

function checkNamesAndTitles() {
  const problems = [];
  world.types.forEach(type => {
    if (!type.name) problems.push('a type has no name');
    if (!type.title) problems.push(type.name + ' has no title');
  });
  return problems;
}

function checkDescriptions() {
  const problems = [];
  eachField((where, field) => {
    const words = field.description || '';
    if (!field.title) problems.push(where + ' has no title');
    if (!words) problems.push(where + ' has no description');
    else if (words.indexOf('\n') !== -1 || words.length > 160) problems.push(where + ' description should be one line of 160 characters or fewer');
  });
  return problems;
}

function checkValidations() {
  const problems = [];
  eachField((where, field) => {
    [field].concat(field.of || []).forEach(item => {
      try {
        constraintsOf(item);
      } catch (error) {
        problems.push(where + ': the validation does not run (' + error.message + ')');
      }
    });
  });
  return problems;
}

function checkItemFields() {
  const problems = [];
  itemTypes.forEach(name => {
    const show = fieldAt(name + '.show');
    const expires = fieldAt(name + '.expires');
    const showOk = show && show.type === 'boolean' && show.title === 'Show on screen' && show.initialValue === true;
    const expiresOk = expires && expires.type === 'datetime' && expires.title === 'Hide after' && /optional/i.test(expires.description || '');
    need(problems, showOk, name + '.show should be a switch titled Show on screen that starts on');
    need(problems, expiresOk, name + '.expires should be a datetime titled Hide after, described as optional');
  });
  return problems;
}

function checkPreviews() {
  const problems = [];
  eachPreview((where, preview) => {
    const result = preview.prepare ? preview.prepare({}) : {};
    if (!result.title) problems.push(where + ': the preview has no title when every field is empty');
    ['title', 'subtitle'].forEach(key => {
      const unfinished = typeof result[key] === 'string' && /\b(undefined|null)\b/.test(result[key]);
      need(problems, !unfinished, where + ': the preview ' + key + ' shows undefined or null');
    });
  });

  itemTypes.forEach(name => {
    const type = typeByName(name);
    const preview = type && type.preview;
    if (!preview || !preview.select || !preview.prepare) return problems.push(name + ' needs a preview with select and prepare');

    const hidden = preview.prepare({ title: 'Example', show: false }).subtitle || '';
    const expired = preview.prepare({ title: 'Example', expires: '2000-01-01T00:00:00.000Z' }).subtitle || '';
    if (hidden.indexOf('Hidden') === -1) problems.push(name + ': the preview does not say when an item is hidden');
    if (expired.indexOf('Expired') === -1) problems.push(name + ': the preview does not say when an item has expired');

    const names = fieldsIn(type).map(field => field.name);
    Object.keys(preview.select).forEach(alias => {
      const first = preview.select[alias].split('.')[0];
      if (names.indexOf(first) === -1) problems.push(name + ': the preview selects ' + first + ', which is not a field');
    });
  });
  return problems;
}

function checkOrderings() {
  const problems = [];
  itemTypes.forEach(name => {
    // a photo has no Order field: its list goes by when it was uploaded
    const wanted = name === 'plan' ? 'date' : name === 'photo' ? '_createdAt' : 'order';
    const type = typeByName(name);
    const found = (type.orderings || []).some(item => item.by && item.by[0].field === wanted);
    if (!found) problems.push(name + ' needs an ordering by ' + wanted);
  });
  return problems;
}

function isPlainTitle(item) {
  return /^[A-Z]/.test(item.title || '') && item.title.indexOf('-') === -1;
}

function choicesOf(pathText) {
  const field = fieldAt(pathText);
  return (field && field.options && field.options.list) || [];
}

function checkChoices() {
  const problems = [];
  Object.keys(choices).forEach(pathText => {
    const list = choicesOf(pathText);
    if (list.map(item => item.value).join() !== choices[pathText].join()) problems.push(pathText + ' should offer: ' + choices[pathText].join(', '));
    list.forEach(item => need(problems, isPlainTitle(item), pathText + ': "' + item.title + '" is not a plain-words title'));
  });

  const statuses = ((fieldAt('task.status') || {}).options || {}).list || [];
  const titles = statuses.map(item => item.title).join();
  need(problems, titles === 'Blocked,In progress,In review,Up next,Done', 'task.status titles should be Blocked, In progress, In review, Up next, Done');
  return problems;
}

// Panel names in one list that the other list does not have, both ways round
function differences(expected, actual, expectedName, actualName, problems) {
  expected.filter(id => actual.indexOf(id) === -1).forEach(id => {
    problems.push(actualName + ' is missing ' + id + ', which ' + expectedName + ' has');
  });
  actual.filter(id => expected.indexOf(id) === -1).forEach(id => {
    problems.push(actualName + ' has ' + id + ', which ' + expectedName + ' does not have for this area');
  });
  need(problems, new Set(actual).size === actual.length, actualName + ' lists a panel twice');
}

// A panel the editors can pick has to be one the dashboard has, and the other
// way round, or a new panel can never be switched on
function checkPanelIds() {
  const problems = [];
  const registered = world.registry.panels.filter(panel => !panel.testOnly && !panel.competition && !panel.monday && !panel.lastResort && !panel.placeholder && !panel.rotationOnly);

  rotationAreas.forEach(area => {
    const inRegistry = registered.filter(panel => panel.region === area).map(panel => panel.id);
    const offered = choicesOf('dashboardSettings.rotation.' + area + '.panel');
    const inConfig = world.dashboard.defaultSettings.rotation[area].map(step => step.panel);

    differences(inRegistry, offered.map(item => item.value), 'registry.js', 'the Studio list for ' + area, problems);
    differences(inRegistry, inConfig, 'registry.js', 'defaultSettings.rotation.' + area + ' in config.js', problems);
    offered.forEach(item => need(problems, isPlainTitle(item), area + ': "' + item.title + '" is not a plain-words title'));
  });
  return problems;
}

// The Teletraan computer saves CALENDAR_BUILD_SEASON_URL as build_season.ics, so a calendar
// code is lowercase letters, digits and underscores
function checkRules() {
  const problems = [];
  const announcement = name => fieldAt('dashboardSettings.announcements.' + name);

  const days = constraintsOf(announcement('days'));
  const atLeastOne = constraintNamed(days, 'min');
  const daysOk = constraintNamed(days, 'required') && atLeastOne && atLeastOne.args[0] === 1;
  need(problems, daysOk, 'announcements.days should be required and need at least 1 day');

  const show = announcement('show');
  need(problems, show && show.type === 'boolean' && show.initialValue === true, 'announcements.show should be a switch that starts on');

  const code = constraintNamed(constraintsOf(fieldAt('dashboardSettings.calendars.id')), 'regex');
  if (!code) return problems.concat('calendars.id should be checked with a pattern');

  ['team', 'build_season', 'band2'].forEach(good => {
    if (!code.args[0].test(good)) problems.push('the calendar code pattern refuses ' + good);
  });
  ['Team', 'build-season', 'build season', 'team.ics', 'team\n', ''].forEach(bad => {
    if (code.args[0].test(bad)) problems.push('the calendar code pattern accepts "' + bad + '"');
  });
  return problems;
}

// The Speed setting offers the speeds that dashboard/config.js knows, and
// refuses any other value
function checkSpeed() {
  const problems = [];
  const field = fieldAt('dashboardSettings.speed');
  const known = Object.keys(world.dashboard.speeds);

  const offered = choicesOf('dashboardSettings.speed').map(item => item.value);
  need(problems, offered.join() === known.join(), 'speed should offer the same names as speeds in config.js: ' + known.join(', '));

  const constraints = field ? constraintsOf(field) : [];
  const allowed = constraintNamed(constraints, 'valid');
  need(problems, constraintNamed(constraints, 'required'), 'speed should be required');
  need(problems, allowed && allowed.args[0].join() === known.join(), 'speed should only allow: ' + known.join(', '));

  const pace = known.map(name => world.dashboard.speeds[name]).join();
  need(problems, pace === '2,1.5,1,0.75', 'speeds in config.js should be 2, 1.5, 1 and 0.75 times, not ' + pace);
  need(problems, world.dashboard.speeds[world.dashboard.defaultSettings.speed] === 1, 'the default speed in config.js should be normal, which is 1');
  return problems;
}

// The logo fields: the master switch, the entrance, and a switch, seconds between
// plays and seconds one play lasts for each animation that repeats. The name
// effect keeps its old stored names. The section is all in schemas/settingsLogo.js.
const logoSwitches = ['logoAnimations', 'logoEntrance', 'logoSpin', 'logoHawk', 'nameTransform'];
const logoNumbers = ['logoSpinEvery', 'logoSpinDuration', 'logoHawkEvery', 'logoHawkDuration', 'nameEvery', 'nameDuration'];

function checkLogoTab(problems) {
  const settings = typeByName('dashboardSettings');
  const logoFieldNames = logoSwitches.concat(logoNumbers);

  // The master switch is the first of the logo fields. Which tab they are in is checked in checkSettingsTabs.
  const inOrder = fieldsIn(settings).map(field => field.name).filter(name => logoFieldNames.indexOf(name) !== -1);
  need(problems, inOrder[0] === 'logoAnimations', 'the master switch logoAnimations should be the first of the logo fields');

  const titles = { logoAnimations: 'Logo animations', logoEntrance: 'Entrance', logoSpin: 'Spin', logoHawk: 'Flying hawk', nameTransform: 'Name effect' };
  Object.keys(titles).forEach(name => {
    const field = fieldAt('dashboardSettings.' + name);
    need(problems, field && field.title === titles[name], name + ' should be titled ' + titles[name]);
  });

  // The entrance plays once, so it has no seconds. Every Logo field has a one-line description.
  need(problems, !fieldAt('dashboardSettings.logoEntranceEvery') && !fieldAt('dashboardSettings.logoEntranceDuration'), 'the entrance plays once, so it has no timing fields');
  logoFieldNames.forEach(name => {
    const field = fieldAt('dashboardSettings.' + name);
    const words = field ? field.description || '' : '';
    need(problems, words.length > 0 && words.indexOf('\n') === -1, name + ' needs a one-line description');
  });
}

// The page change fields: Page change style, Break and rebuild time, Frame finish
// and Silver chance. The section is all in schemas/settingsTransitions.js. The
// number fields and their limits are compared with config.js in checkLookAndTiming.
const transitionNames = ['pageChangeStyle', 'breakSeconds', 'frameFinish', 'silverChance'];
const photoNames = ['photoOrder', 'photoSeconds', 'portraitScale', 'photoScale', 'photoFit', 'leadershipPortrait', 'rosterPortrait', 'portraitShape', 'portraitFrame'];
const nightNames = ['nightEnabled', 'nightStyle', 'nightStart', 'nightEnd', 'nightLogoWidth', 'nightSpeed', 'nightPreview'];
const hiddenNames = ['hiddenEnabled', 'desktopEveryHours', 'desktopChance', 'redEyesEveryHours', 'redEyesChance', 'hiddenRequest'];
const presentationNames = ['presentationsEnabled', 'noShowMinutes', 'graceMinutes'];

function checkTransitionsTab() {
  const problems = [];
  const config = world.dashboard;
  const settings = typeByName('dashboardSettings');
  const at = name => fieldAt('dashboardSettings.' + name);

  const inOrder = fieldsIn(settings).map(field => field.name).filter(name => transitionNames.indexOf(name) !== -1);
  need(problems, inOrder.join() === transitionNames.join(), 'the page change fields should come in this order: ' + transitionNames.join(', ') + ', not ' + inOrder.join(', '));

  const titles = { pageChangeStyle: 'Page change style', breakSeconds: 'Break and rebuild time', frameFinish: 'Frame finish', silverChance: 'Silver chance (percent)' };
  Object.keys(titles).forEach(name => {
    need(problems, at(name) && at(name).title === titles[name], name + ' should be titled ' + titles[name]);
  });

  // The two choice lists offer the names in config.js, as radio lists, and only those
  [['pageChangeStyle', config.pageChangeStyles, 'alternate'], ['frameFinish', config.frameFinishes, 'mostly-gold']].forEach(entry => {
    const field = at(entry[0]);
    const rules = field ? constraintsOf(field) : [];
    const allowed = constraintNamed(rules, 'valid');
    need(problems, field && field.options && field.options.layout === 'radio', entry[0] + ' should be a radio list');
    need(problems, choicesOf('dashboardSettings.' + entry[0]).map(item => item.value).join() === entry[1].join(), entry[0] + ' should offer the names in config.js: ' + entry[1].join(', '));
    need(problems, constraintNamed(rules, 'required'), entry[0] + ' should be required');
    need(problems, allowed && allowed.args[0].join() === entry[1].join(), entry[0] + ' should only allow: ' + entry[1].join(', '));
    need(problems, config.defaultSettings[entry[0]] === entry[2], 'the default ' + entry[0] + ' in config.js should be ' + entry[2]);
  });
  need(problems, config.pageChangeStyles.join() === 'alternate,slat,mechanical', 'pageChangeStyles in config.js should be alternate, slat and mechanical');
  need(problems, config.frameFinishes.join() === 'mostly-gold,alternate,gold,silver', 'frameFinishes in config.js should be mostly-gold, alternate, gold and silver');

  // Silver chance is a whole number of percent, from 0 to 100
  const chance = at('silverChance');
  need(problems, chance && /Mostly gold/.test(chance.description || ''), 'the silverChance description should say that Mostly gold uses it');

  // The two settings that share a word with Frame metal say how they differ
  const finish = at('frameFinish');
  need(problems, finish && /Frame metal/.test(finish.description || ''), 'the frameFinish description should say how it relates to Frame metal');
  const metal = at('frameMetal');
  need(problems, metal && /Frame finish/.test(metal.description || ''), 'the frameMetal description should say that page frames follow Frame finish');

  // The sample content carries the settings, with values the dashboard accepts
  const sample = world.sample.settings;
  need(problems, config.pageChangeStyles.indexOf(sample.pageChangeStyle) !== -1, 'the sample settings need a pageChangeStyle of ' + config.pageChangeStyles.join(', '));
  need(problems, config.frameFinishes.indexOf(sample.frameFinish) !== -1, 'the sample settings need a frameFinish of ' + config.frameFinishes.join(', '));
  ['breakSeconds', 'silverChance'].forEach(name => {
    const limit = config.limits[name];
    need(problems, sample[name] >= limit.min && sample[name] <= limit.max, 'the sample settings need ' + name + ' from ' + limit.min + ' to ' + limit.max);
  });
  return problems;
}

// Frame metal, glint, seconds per page and the name effect. The Studio and
// dashboard/config.js must agree on the choices, the limits and the defaults,
// and a row or the ticker may leave seconds empty to follow Seconds per page.
function checkLookAndTiming() {
  const problems = [];
  const config = world.dashboard;
  const settings = config.defaultSettings;
  const at = name => fieldAt('dashboardSettings.' + name);

  const metal = at('frameMetal');
  const metalRules = metal ? constraintsOf(metal) : [];
  const allowed = constraintNamed(metalRules, 'valid');
  const offered = choicesOf('dashboardSettings.frameMetal').map(item => item.value);
  need(problems, config.metals.join() === 'gold,silver', 'metals in config.js should be gold and silver, not ' + config.metals.join());
  need(problems, settings.frameMetal === 'gold', 'the default frame metal in config.js should be gold');
  need(problems, offered.join() === config.metals.join(), 'frameMetal should offer the same names as metals in config.js: ' + config.metals.join(', '));
  need(problems, metal && metal.options && metal.options.layout === 'radio', 'frameMetal should be a radio list');
  need(problems, constraintNamed(metalRules, 'required'), 'frameMetal should be required');
  need(problems, allowed && allowed.args[0].join() === config.metals.join(), 'frameMetal should only allow: ' + config.metals.join(', '));

  logoSwitches.concat(['glint']).forEach(name => {
    const field = at(name);
    const ok = field && field.type === 'boolean' && field.initialValue === true && settings[name] === true;
    need(problems, ok, name + ' should be a switch that starts on, and so should its default in config.js');
  });

  // The numbers in a range: the same limits and starting value in both places.
  //   [field, name in config.limits, starting value, whole numbers only]
  [
    ['pageSeconds', 'pageSeconds', 20, true],
    ['nameEvery', 'nameEvery', 300, true],
    ['nameDuration', 'nameDuration', 1.43, false],
    ['crt.everySeconds', 'crtEvery', 240, true],
    ['crt.durationSeconds', 'crtDuration', 2.7, false],
    ['logoSpinEvery', 'logoSpinEvery', 72, true],
    ['logoSpinDuration', 'logoSpinDuration', 1.6, false],
    ['logoHawkEvery', 'logoHawkEvery', 24, true],
    ['logoHawkDuration', 'logoHawkDuration', 11, false],
    ['breakSeconds', 'breakSeconds', 0.6, false],
    ['silverChance', 'silverChance', 10, true],
    ['photoSeconds', 'photoSeconds', 16, true],
    ['portraitScale', 'portraitScale', 100, true],
    ['photoScale', 'photoScale', 100, true],
    ['nightLogoWidth', 'nightLogoWidth', 300, true],
  ].forEach(entry => {
    const name = entry[0];
    const field = at(name);
    const limit = config.limits[entry[1]];
    const rules = field ? constraintsOf(field) : [];
    const low = constraintNamed(rules, 'min');
    const high = constraintNamed(rules, 'max');
    const start = name.split('.').reduce((object, key) => object[key], settings);

    need(problems, start === entry[2], 'the default ' + name + ' in config.js should be ' + entry[2] + ', not ' + start);
    need(problems, limit && low && high && low.args[0] === limit.min && high.args[0] === limit.max, name + ' should have the limits in config.js, ' + JSON.stringify(limit));
    need(problems, constraintNamed(rules, 'required') || (field && field.hidden === true), name + ' should be required, unless it is hidden');
    need(problems, !!constraintNamed(rules, 'integer') === entry[3], name + (entry[3] ? ' should be a whole number' : ' should allow decimals, so no integer rule'));
  });

  // Seconds between plays: 0 means never, and a number from 1 to 29 is too often
  // [field, name in config.limits, the shortest number of seconds that is not 0]
  [
    ['nameEvery', 'nameEvery', 30],
    ['crt.everySeconds', 'crtEvery', 30],
    ['logoSpinEvery', 'logoSpinEvery', 10],
    ['logoHawkEvery', 'logoHawkEvery', 10],
  ].forEach(entry => {
    const field = at(entry[0]);
    const custom = field ? constraintNamed(constraintsOf(field), 'custom') : null;
    const limit = config.limits[entry[1]];
    const shortest = entry[2];

    need(problems, limit && limit.min === 0 && limit.shortest === shortest, 'limits.' + entry[1] + ' in config.js should have min 0 and shortest ' + shortest);
    const notUsed = field && field.hidden === true;
    need(problems, field && (notUsed ? /^Not used any more\./.test(field.description || '') : /0 to never|never/.test(field.description || '')), entry[0] + (notUsed ? ' is hidden, so its description should begin Not used any more' : ' description should say that 0 means never'));
    need(problems, entry[0] !== 'nameEvery' && entry[0] !== 'logoHawkEvery' ? !notUsed : notUsed, entry[0] + (entry[0] === 'nameEvery' || entry[0] === 'logoHawkEvery' ? ' should be hidden: each Screen sets how often the effect plays' : ' should not be hidden'));
    if (!custom) return problems.push(entry[0] + ' should refuse 1 to ' + (shortest - 1) + ' with a custom rule (0 or at least ' + shortest + ')');

    const check = custom.args[0];
    need(problems, check(0) === true && check(shortest) === true && check(limit.max) === true && check(undefined) === true, entry[0] + ' should accept 0, ' + shortest + ' and above, and empty');
    need(problems, typeof check(1) === 'string' && typeof check(shortest - 1) === 'string', entry[0] + ' should refuse 1 and ' + (shortest - 1) + ' with a message');
  });

  // The name effect lasts .8 s for a letter and each later letter starts 45 ms
  // after the one before it (frame.css). nameDuration is that, on the default name.
  const defaultLetters = Array.from(world.dashboard.defaultTeam.name).length;
  const measured = 0.8 + (defaultLetters - 1) * 0.045;
  need(problems, Math.abs(measured - settings.nameDuration) < 0.0005, 'nameDuration in config.js should be the length of the name effect on ' + world.dashboard.defaultTeam.name + ', ' + measured.toFixed(2) + ' seconds');

  const pageWords = (at('pageSeconds') || {}).description || '';
  need(problems, /three quarters/.test(pageWords) && /one and a half/.test(pageWords), 'the pageSeconds description should give the small panel and ticker times');

  // Seconds in the lists and on the ticker are optional, and an empty field follows pageSeconds
  [['rotation.order.seconds', 6, 120], ['rotation.tickerSeconds', 6, 120]].forEach(entry => {
    const field = at(entry[0]);
    const rules = field ? constraintsOf(field) : [];
    const low = constraintNamed(rules, 'min');
    const high = constraintNamed(rules, 'max');

    need(problems, field && !constraintNamed(rules, 'required'), entry[0] + ' should be optional');
    need(problems, field && field.initialValue === undefined, entry[0] + ' should start empty');
    need(problems, low && high && low.args[0] === entry[1] && high.args[0] === entry[2], entry[0] + ' should allow ' + entry[1] + ' to ' + entry[2]);
    need(problems, field && /Seconds per page/.test(field.description || ''), entry[0] + ' should say that empty follows Seconds per page');
  });

  rotationAreas.forEach(area => {
    const withSeconds = settings.rotation[area].filter(step => step.seconds !== undefined);
    need(problems, withSeconds.length === 0, 'defaultSettings.rotation.' + area + ' in config.js should have rows with no seconds, so they follow pageSeconds');
  });
  need(problems, settings.rotation.tickerSeconds === undefined, 'defaultSettings.rotation in config.js should have no tickerSeconds');

  // The tabs are checked in checkSettingsTabs
  need(problems, at('crt') && at('crt').title === 'Screen glitch', 'crt should be titled Screen glitch');
  checkLogoTab(problems);

  // The sample content carries the new settings, with values the dashboard accepts
  const sample = world.sample.settings;
  need(problems, config.metals.indexOf(sample.frameMetal) !== -1, 'the sample settings need a frameMetal of ' + config.metals.join(' or '));
  need(problems, typeof sample.glint === 'boolean', 'the sample settings need glint, true or false');
  logoSwitches.forEach(name => {
    need(problems, typeof sample[name] === 'boolean', 'the sample settings need ' + name + ', true or false');
  });
  need(problems, !('contentSource' in sample), 'the sample settings should not carry contentSource, which the screen ignores');
  ['pageSeconds'].concat(logoNumbers).forEach(name => {
    const limit = config.limits[name];
    need(problems, sample[name] >= limit.min && sample[name] <= limit.max, 'the sample settings need ' + name + ' from ' + limit.min + ' to ' + limit.max);
  });
  const glitch = sample.crt || {};
  need(problems, typeof glitch.on === 'boolean', 'the sample settings need crt.on, true or false');
  [['everySeconds', 'crtEvery'], ['durationSeconds', 'crtDuration']].forEach(entry => {
    const limit = config.limits[entry[1]];
    need(problems, glitch[entry[0]] >= limit.min && glitch[entry[0]] <= limit.max, 'the sample settings need crt.' + entry[0] + ' from ' + limit.min + ' to ' + limit.max);
  });
  return problems;
}

// Look, in the Screen tab. The Studio list is the dashboard's list (the looks in
// config.js), in the same order, the starting value is Polished, which changes
// nothing on the screen, and the sample content has a look the dashboard accepts.
function checkLookSetting() {
  const problems = [];
  const config = world.dashboard;
  const look = fieldAt('dashboardSettings.look');
  const rules = look ? constraintsOf(look) : [];
  const allowed = constraintNamed(rules, 'valid');
  const offered = choicesOf('dashboardSettings.look');
  const titles = { polished: 'Polished (as now)', flat: 'Flat', plain: 'Plain' };

  need(problems, config.looks.join() === 'polished,flat,plain', 'looks in config.js should be polished, flat and plain, not ' + config.looks.join());
  need(problems, config.defaultSettings.look === 'polished', 'the default look in config.js should be polished');
  need(problems, look && look.initialValue === 'polished', 'look should start as polished');
  need(problems, look && look.group === 'screen', 'look should be in the Screen tab');
  need(problems, look && look.title === 'Polish', 'look should be titled Polish');
  need(problems, look && look.options && look.options.layout === 'radio', 'look should be a radio list');
  need(problems, offered.map(item => item.value).join() === config.looks.join(), 'look should offer the same names, in the same order, as looks in config.js: ' + config.looks.join(', '));
  offered.forEach(item => need(problems, item.title === titles[item.value], 'the look ' + item.value + ' should be titled ' + titles[item.value]));
  need(problems, allowed && allowed.args[0].join() === config.looks.join(), 'look should only allow: ' + config.looks.join(', '));
  // Dashboard Settings published before Look existed has no look, and the screen reads that as Polished.
  // A required field would stop that page being published until someone picked one.
  need(problems, !constraintNamed(rules, 'required'), 'look should not be required: an empty look is Polished, and the page must still publish');

  // The description says what each look does, and which one is the default
  const words = look ? look.description || '' : '';
  need(problems, /Polished is the default/.test(words) && /Flat/.test(words) && /Plain/.test(words) && /computer/.test(words), 'the look description should say that Polished is the default, what Flat and Plain do, and that the Teletraan computer is lighter with them');

  need(problems, config.looks.indexOf(world.sample.settings.look) !== -1, 'the sample settings need a look of ' + config.looks.join(', '));
  return problems;
}

// Style, in the Look tab. The Studio list is the dashboard's list (the styles in
// config.js), in the same order, the starting value is Original, which changes
// nothing on the screen, and the sample content has a style the dashboard accepts.
// The dashboard has a layout for the two styles that force one, and the Look page
// says that the style and the team set the base values.
function checkStyleSetting() {
  const problems = [];
  const config = world.dashboard;
  const style = fieldAt('dashboardSettings.style');
  const rules = style ? constraintsOf(style) : [];
  const allowed = constraintNamed(rules, 'valid');
  const offered = choicesOf('dashboardSettings.style');
  const titles = { original: 'Original', cybertron: 'Cybertron', minimal: 'Minimal' };

  need(problems, config.styles.join() === 'original,cybertron,minimal', 'styles in config.js should be original, cybertron and minimal, not ' + config.styles.join());
  need(problems, config.defaultSettings.style === 'original', 'the default style in config.js should be original');
  need(problems, style && style.initialValue === 'original', 'style should start as original');
  need(problems, style && style.group === 'look', 'style should be in the Look tab');
  need(problems, style && style.title === 'Style', 'style should be titled Style');
  need(problems, style && style.type === 'string' && style.options && style.options.layout === 'radio', 'style should be a radio list');
  need(problems, offered.map(item => item.value).join() === config.styles.join(), 'style should offer the same names, in the same order, as styles in config.js: ' + config.styles.join(', '));
  offered.forEach(item => need(problems, item.title === titles[item.value], 'the style ' + item.value + ' should be titled ' + titles[item.value]));
  need(problems, allowed && allowed.args[0].join() === config.styles.join(), 'style should only allow: ' + config.styles.join(', '));
  // Dashboard Settings published before Style existed has no style, and the screen reads that as Original.
  // A required field would stop that page being published until someone picked one.
  need(problems, !constraintNamed(rules, 'required'), 'style should not be required: an empty style is Original, and the page must still publish');

  // The description says what each style is, and that the theme does not decide the layout of one of them
  const words = style ? style.description || '' : '';
  need(problems, /Original/.test(words) && /Cybertron/.test(words) && /Minimal/.test(words) && /whatever the theme/.test(words), 'the style description should say what Original is, what Cybertron and Minimal have, and that the theme does not change the layout of Minimal');

  need(problems, config.styles.indexOf(world.sample.settings.style) !== -1, 'the sample settings need a style of ' + config.styles.join(', '));
  need(problems, world.layoutModule.layouts.indexOf('bar') !== -1, 'the dashboard needs the bar layout, which Minimal has');

  const theme = fieldAt('theme.defaultTheme');
  need(problems, theme && theme.title === 'Default color theme' && /Not the same as the theme of each day/.test(theme.description || ''), 'the Look page should call its theme the color theme and say it is not the theme of each day');
  return problems;
}

// Content source and Switch back to production at. Both stay in the schema, hidden, so that
// nothing already saved changes, and the dashboard ignores them: it always shows production,
// and the sample content is reached with ?sample=1 on its address (dashboard/core/source.js).
// The Use sample content and Use production content buttons are gone.
function checkContentSource() {
  const problems = [];
  const config = world.dashboard;
  const at = name => fieldAt('dashboardSettings.' + name);

  ['contentSource'].forEach(name => {
    const field = at(name);
    need(problems, field, name + ' should stay in the schema, so that a saved value is kept');
    need(problems, field && field.hidden === true, name + ' should be hidden (hidden: true)');
    need(problems, field && field.group === 'advanced', name + ' should stay in the Advanced tab');
    need(problems, !(name in config.defaultSettings), name + ' should not be in defaultSettings in config.js: the dashboard ignores it');
  });
  need(problems, at('contentSource') && at('contentSource').initialValue === 'production', 'contentSource should still start as production');
  need(problems, !at('switchBackAt'), 'switchBackAt should be gone from the schema: no document held a value');
  ['contentSource'].forEach(name => need(problems, at(name) && !constraintNamed(constraintsOf(at(name)), 'required'), name + ' should not be required: nobody can fill in a hidden field, and a page saved before it existed must still publish'));
  need(problems, choicesOf('dashboardSettings.contentSource').map(item => item.value).join() === 'production,sample', 'contentSource should still offer production and sample, so that a saved value stays valid');
  need(problems, at('contentSource') && /sample=1/.test(at('contentSource').description || ''), 'the contentSource description should say how to see the sample content, with ?sample=1');
  need(problems, !('contentSources' in config) && !('useSampleContent' in config), 'config.js should have no contentSources and no useSampleContent: the screen shows production unless the address has ?sample=1');

  // No button switches the content source any more
  const actions = world.config.document.actions([], { schemaType: 'dashboardSettings' }).map(item => item.action);
  need(problems, actions.indexOf('useSampleContent') === -1 && actions.indexOf('useProductionContent') === -1, 'the settings page should have no Use sample content and Use production content buttons');
  return problems;
}

// The night mode fields (the screensaver): a switch that starts on, a style, a start
// and an end time, the logo width, a speed and a preview switch. The section is
// all in schemas/settingsNight.js. There is no time zone field: night mode uses
// the time zone of the Look page, so the descriptions say so. The choices, the
// limit and the starting values are compared with config.js here and in
// checkChoices, checkLookAndTiming and checkStartingValues.
function checkNightTab() {
  const problems = [];
  const config = world.dashboard;
  const settings = typeByName('dashboardSettings');
  const at = name => fieldAt('dashboardSettings.' + name);

  const inOrder = fieldsIn(settings).map(field => field.name).filter(name => nightNames.indexOf(name) !== -1);
  need(problems, inOrder.join() === nightNames.join(), 'the night mode fields should come in this order: ' + nightNames.join(', ') + ', not ' + inOrder.join(', '));

  const titles = {
    nightEnabled: 'Use night mode',
    nightStyle: 'Night style',
    nightStart: 'Night starts at',
    nightEnd: 'Night ends at',
    nightLogoWidth: 'Logo width (pixels)',
    nightSpeed: 'Bounce speed',
    nightPreview: 'Preview night mode',
  };
  Object.keys(titles).forEach(name => {
    need(problems, at(name) && at(name).title === titles[name], name + ' should be titled ' + titles[name]);
  });

  // The switches: night mode starts on, the preview starts off
  need(problems, at('nightEnabled') && at('nightEnabled').type === 'boolean' && at('nightEnabled').initialValue === true && config.defaultSettings.nightEnabled === true, 'nightEnabled should be a switch that starts on, and so should its default in config.js');
  need(problems, at('nightPreview') && at('nightPreview').type === 'boolean' && at('nightPreview').initialValue === false && config.defaultSettings.nightPreview === false, 'nightPreview should be a switch that starts off, and so should its default in config.js');

  // The two choice lists offer the names in config.js, as radio lists, and only those
  [['nightStyle', config.nightStyles, 'bounce'], ['nightSpeed', Object.keys(config.nightSpeeds), 'normal']].forEach(entry => {
    const field = at(entry[0]);
    const rules = field ? constraintsOf(field) : [];
    const allowed = constraintNamed(rules, 'valid');
    need(problems, field && field.options && field.options.layout === 'radio', entry[0] + ' should be a radio list');
    need(problems, choicesOf('dashboardSettings.' + entry[0]).map(item => item.value).join() === entry[1].join(), entry[0] + ' should offer the names in config.js: ' + entry[1].join(', '));
    need(problems, constraintNamed(rules, 'required'), entry[0] + ' should be required');
    need(problems, allowed && allowed.args[0].join() === entry[1].join(), entry[0] + ' should only allow: ' + entry[1].join(', '));
    need(problems, config.defaultSettings[entry[0]] === entry[2], 'the default ' + entry[0] + ' in config.js should be ' + entry[2]);
  });

  // The times are fixed. The two fields are hidden and the screen uses dashboard/core/constants.js (checkFixedValues).
  need(problems, !fieldsIn(settings).some(field => /zone/i.test(field.name)), 'night mode has no time zone field of its own, because it uses the one on the Look page');

  // The logo width is in pixels, and the speed says how often a corner is reached
  const speed = at('nightSpeed');
  need(problems, speed && /corner/.test(speed.description || ''), 'the nightSpeed description should say how often the logo reaches a corner');
  need(problems, at('nightPreview') && /even with Use night mode off/.test(at('nightPreview').description || ''), 'the nightPreview description should say that it works with Use night mode off');

  // The sample content carries the settings, with values the dashboard accepts
  const sample = world.sample.settings;
  need(problems, config.nightStyles.indexOf(sample.nightStyle) !== -1, 'the sample settings need a nightStyle of ' + config.nightStyles.join(' or '));
  need(problems, Object.keys(config.nightSpeeds).indexOf(sample.nightSpeed) !== -1, 'the sample settings need a nightSpeed of ' + Object.keys(config.nightSpeeds).join(', '));
  need(problems, typeof sample.nightEnabled === 'boolean' && typeof sample.nightPreview === 'boolean', 'the sample settings need nightEnabled and nightPreview as true or false');
  const width = config.limits.nightLogoWidth;
  need(problems, sample.nightLogoWidth >= width.min && sample.nightLogoWidth <= width.max, 'the sample settings need nightLogoWidth from ' + width.min + ' to ' + width.max);
  return problems;
}

// The hidden transition fields: the master switch, the hours and the hidden percent of each
// transition, and the last push, all in
// schemas/settingsHidden.js, and one Play button for each hidden transition on the
// settings page (actions.js). The list of transitions in hidden-transitions.js is a
// copy of the dashboard's registry, so it is compared here too. The limits and
// starting values are also compared in checkLookAndTiming and checkStartingValues.
function checkHiddenTab() {
  const problems = [];
  const config = world.dashboard;
  const settings = typeByName('dashboardSettings');
  const at = name => fieldAt('dashboardSettings.' + name);

  const inOrder = fieldsIn(settings).map(field => field.name).filter(name => hiddenNames.indexOf(name) !== -1);
  need(problems, inOrder.join() === hiddenNames.join(), 'the hidden transition fields should come in this order: ' + hiddenNames.join(', ') + ', not ' + inOrder.join(', '));

  const titles = {
    hiddenEnabled: 'Allow hidden transitions',
    desktopEveryHours: 'Desktop reveal every (hours)',
    desktopChance: 'Desktop reveal chance (percent)',
    redEyesEveryHours: 'Red eyes every (hours)',
    redEyesChance: 'Red eyes chance (percent)',
    hiddenRequest: 'Last push',
  };
  Object.keys(titles).forEach(name => need(problems, at(name) && at(name).title === titles[name], name + ' should be titled ' + titles[name]));

  // The master switch starts on, and its description says what it stops
  need(problems, at('hiddenEnabled') && at('hiddenEnabled').type === 'boolean' && at('hiddenEnabled').initialValue === true && config.defaultSettings.hiddenEnabled === true, 'hiddenEnabled should be a switch that starts on, and so should its default in config.js');
  need(problems, at('hiddenEnabled') && /push/.test(at('hiddenEnabled').description || '') && /calm/.test(at('hiddenEnabled').description || ''), 'the hiddenEnabled description should say that it stops a push too, and that calm motion never plays one');

  // Each transition in the registry has hours: a whole number from 1 to 1000, 60 in the Studio and 0 (not set)
  // in config.js, so that a page saved before the hours existed keeps rolling by its percent. The hours are
  // optional, for the same reason.
  const registry = world.hiddenRegistry.hiddenTransitions;
  Object.keys(registry).forEach(id => {
    const name = registry[id].hoursField;
    const field = at(name);
    const rules = field ? constraintsOf(field) : [];
    const low = constraintNamed(rules, 'min');
    const high = constraintNamed(rules, 'max');
    const limit = config.limits[name];

    need(problems, field && field.type === 'number' && field.initialValue === 60, name + ' should be a number that starts at 60');
    need(problems, field && field.description === 'About once every this many hours of screen time.', name + ' should have the description: About once every this many hours of screen time.');
    need(problems, field && field.hidden !== true, name + ' should show in the form');
    need(problems, limit && limit.min === 1 && limit.max === 1000, 'limits.' + name + ' in config.js should be 1 to 1000');
    need(problems, limit && low && high && low.args[0] === limit.min && high.args[0] === limit.max, name + ' should have the limits in config.js, ' + JSON.stringify(limit));
    need(problems, constraintNamed(rules, 'integer'), name + ' should be a whole number');
    need(problems, !constraintNamed(rules, 'required'), name + ' should be optional, so a page saved before it existed still publishes');
    need(problems, config.defaultSettings[name] === 0, 'the default ' + name + ' in config.js should be 0, which means not set');
  });

  // The percent of each transition is kept, hidden and with no rules, for a page that has no hours
  Object.keys(registry).forEach(id => {
    const name = registry[id].chanceField;
    const field = at(name);

    need(problems, field && field.type === 'number' && field.hidden === true, name + ' should be a hidden number');
    need(problems, field && field.initialValue === 1 && config.defaultSettings[name] === 1, name + ' should start at 1, and so should its default in config.js');
    need(problems, field && constraintsOf(field).length === 0, name + ' should have no rules, because nobody can fix a value in a hidden field');
    need(problems, config.limits[name] && config.limits[name].min === 0 && config.limits[name].max === 100, 'limits.' + name + ' in config.js should be 0 to 100');
  });

  // The last push is read only, optional, has no starting value, and its description names the two buttons
  const push = at('hiddenRequest');
  need(problems, push && push.type === 'object' && push.initialValue === undefined, 'hiddenRequest should be an object with no starting value');
  need(problems, sameData(config.defaultSettings.hiddenRequest, { kind: '', requestedAt: '' }), 'the default hiddenRequest in config.js should be a kind and a time that are both empty');
  need(problems, push && /Play desktop reveal/.test(push.description || '') && /Play red eyes/.test(push.description || ''), 'the hiddenRequest description should name the buttons Play desktop reveal and Play red eyes');
  ['kind', 'requestedAt'].forEach(name => {
    const field = fieldAt('dashboardSettings.hiddenRequest.' + name);
    need(problems, field && field.readOnly === true, 'hiddenRequest.' + name + ' should be read only');
    need(problems, field && !constraintNamed(constraintsOf(field), 'required'), 'hiddenRequest.' + name + ' should be optional');
  });
  need(problems, fieldAt('dashboardSettings.hiddenRequest.requestedAt') && fieldAt('dashboardSettings.hiddenRequest.requestedAt').type === 'datetime', 'hiddenRequest.requestedAt should be a datetime');
  const kindField = fieldAt('dashboardSettings.hiddenRequest.kind');
  const allowed = kindField ? constraintNamed(constraintsOf(kindField), 'valid') : null;
  need(problems, allowed && allowed.args[0].join() === Object.keys(registry).join(), 'hiddenRequest.kind should only allow: ' + Object.keys(registry).join(', '));

  // The sample content carries the settings, with values the dashboard accepts, and never a push
  const sample = world.sample.settings;
  need(problems, typeof sample.hiddenEnabled === 'boolean', 'the sample settings need hiddenEnabled as true or false');
  Object.keys(registry).forEach(id => {
    const name = registry[id].chanceField;
    need(problems, sample[name] >= 0 && sample[name] <= 100, 'the sample settings need ' + name + ' from 0 to 100');
    const hours = registry[id].hoursField;
    need(problems, sample[hours] >= 1 && sample[hours] <= 1000, 'the sample settings need ' + hours + ' from 1 to 1000');
  });
  need(problems, !('hiddenRequest' in sample), 'the sample settings should not carry a hiddenRequest');

  // The Studio's list is the dashboard's registry: the same ids, names and chance fields, in the same order
  const copy = world.studioHidden.hiddenTransitions;
  const ids = Object.keys(registry);
  need(problems, ids.length > 0, 'the registry in dashboard/core/hidden-transitions.js has no transitions');
  need(problems, copy.length === ids.length, 'studio/inputs/hidden-transitions.js has ' + copy.length + ' transitions and the dashboard registry has ' + ids.length);
  ids.forEach((id, index) => {
    const entry = registry[id];
    need(problems, typeof entry.name === 'string' && entry.name !== '', 'the hidden transition "' + id + '" needs a name');
    need(problems, typeof entry.run === 'function', 'the hidden transition "' + id + '" needs a run function');
    const other = copy[index];
    if (!other || other.id !== id) return problems.push('hidden transition number ' + (index + 1) + ' is "' + id + '" in the dashboard registry but "' + (other && other.id) + '" in studio/inputs/hidden-transitions.js');
    need(problems, other.name === entry.name, 'the hidden transition "' + id + '" has name "' + entry.name + '" in the dashboard registry but "' + other.name + '" in studio/inputs/hidden-transitions.js');
    need(problems, other.hoursField === entry.hoursField, 'the hidden transition "' + id + '" has hours field "' + entry.hoursField + '" in the dashboard registry but "' + other.hoursField + '" in studio/inputs/hidden-transitions.js');
    need(problems, other.chanceField === entry.chanceField, 'the hidden transition "' + id + '" has chance field "' + entry.chanceField + '" in the dashboard registry but "' + other.chanceField + '" in studio/inputs/hidden-transitions.js');
  });
  const offered = choicesOf('dashboardSettings.hiddenRequest.kind');
  need(problems, offered.map(item => item.title).join() === ids.map(id => registry[id].name).join(), 'hiddenRequest.kind should show the names in the dashboard registry');

  // The Play buttons come first: one for each transition, plain functions, and only on this page.
  // Play announcements and Run presentation test come after them (checkPlayAnnouncements, checkRunPresentationTest).
  const buttons = world.config.document.actions([], { schemaType: 'dashboardSettings' }).slice(0, Object.keys(registry).length);
  if (buttons.length !== ids.length || !buttons.every(button => typeof button === 'function')) {
    return problems.concat('the settings page should add one Play button for each hidden transition, written as plain functions');
  }
  need(problems, world.config.document.actions([], { schemaType: 'demo' }).every(button => !/^play/.test(button.action)), 'only the settings page should get the Play buttons');

  function press(button, published, draft) {
    globalThis.studioCalls = [];
    const props = { id: 'dashboardSettings', type: 'dashboardSettings', published: published, draft: draft || null, onComplete: () => {} };
    const state = button(props);
    if (!state.disabled) state.onHandle();
    return { state: state, calls: globalThis.studioCalls };
  }

  ids.forEach((id, index) => {
    const button = buttons[index];
    const label = 'Play ' + registry[id].name.toLowerCase();
    const before = Date.now();
    const pressed = press(button, null);
    const after = Date.now();
    const set = pressed.calls[0] && pressed.calls[0].patch && pressed.calls[0].patch[0] && pressed.calls[0].patch[0].set;
    const request = set && set.hiddenRequest;

    need(problems, pressed.state.label === label, 'the button for ' + id + ' should be labelled ' + label);
    need(problems, button.action === 'play' + id.charAt(0).toUpperCase() + id.slice(1), 'the button for ' + id + ' should be called play' + id.charAt(0).toUpperCase() + id.slice(1));
    need(problems, pressed.calls.length === 2 && pressed.calls[0].patch.length === 1 && Object.keys(set).join() === 'hiddenRequest' && pressed.calls[1].publish === true, label + ' should set hiddenRequest and then publish');
    need(problems, request && Object.keys(request).join() === 'kind,requestedAt' && request.kind === id, label + ' should write the kind ' + id);
    need(problems, request && typeof request.requestedAt === 'string' && new Date(request.requestedAt).toISOString() === request.requestedAt && Date.parse(request.requestedAt) >= before && Date.parse(request.requestedAt) <= after, label + ' should write the time now, as new Date().toISOString() writes it');
    need(problems, press(button, { hiddenRequest: { kind: id, requestedAt: '2026-06-01T12:00:00.000Z' } }).state.disabled === false, label + ' should be on when a push is already published, so it can be played again');
  });
  return problems;
}

// The Presentations tab: the switch and the two minutes, all in
// schemas/settingsPresentations.js. The limits and starting values are also
// compared in checkLookAndTiming and checkStartingValues.
function checkPresentationsTab() {
  const problems = [];
  const config = world.dashboard;
  const settings = typeByName('dashboardSettings');
  const at = name => fieldAt('dashboardSettings.' + name);

  need(problems, settings.groups.filter(group => group.title === 'Presentations').length === 1, 'Dashboard Settings should have exactly one tab named Presentations');
  need(problems, settings.groups.filter(group => group.name === 'presentations' && group.title === 'Presentations').length === 1, 'the Presentations tab should be the group presentations');

  // Nothing else is in the tab, so deleting settingsPresentations.js removes the whole section. The last field is
  // the hidden one that Run presentation test fills in (checkRunPresentationTest).
  const inTab = fieldsIn(settings).filter(field => field.group === 'presentations').map(field => field.name);
  const wanted = presentationNames.concat('presentationTestRequest');
  need(problems, inTab.join() === wanted.join(), 'the Presentations tab should hold, in this order: ' + wanted.join(', ') + ', not ' + inTab.join(', '));

  const titles = { presentationsEnabled: 'Run presentations', noShowMinutes: 'Wait for the speaker (minutes)', graceMinutes: 'Overrun allowed (minutes)' }; // the last two are hidden, see checkFixedValues
  Object.keys(titles).forEach(name => need(problems, at(name) && at(name).title === titles[name], name + ' should be titled ' + titles[name]));

  // The switch starts on, here and in config.js
  const switchField = at('presentationsEnabled');
  need(problems, switchField && switchField.type === 'boolean' && switchField.initialValue === true && config.defaultSettings.presentationsEnabled === true, 'presentationsEnabled should be a switch that starts on, and so should its default in config.js');

  // The two minutes are fixed: the fields are hidden and the screen uses dashboard/core/constants.js (checkFixedValues)

  // The sample content carries the settings, with values the dashboard accepts
  const sample = world.sample.settings;
  need(problems, typeof sample.presentationsEnabled === 'boolean', 'the sample settings need presentationsEnabled, true or false');
  return problems;
}

// Play announcements: the hidden announceRequest field in the Screen tab
// (schemas/settingsAnnouncements.js), its starting value in config.js, the button that
// fills it in (actions.js) and the Demo step that plays the same announcements
// (the registry in dashboard/core/demo-screens.js and the Studio's copy of it).
function checkPlayAnnouncements() {
  const problems = [];
  const config = world.dashboard;
  const settings = typeByName('dashboardSettings');
  const request = fieldAt('dashboardSettings.announceRequest');
  const time = fieldAt('dashboardSettings.announceRequest.requestedAt');

  // The field: an object with one read only time, hidden from editors, with no starting value of its own
  need(problems, request && request.type === 'object', 'announceRequest should be an object');
  need(problems, request && request.hidden === true, 'announceRequest should be hidden from editors (hidden: true)');
  need(problems, request && request.initialValue === undefined, 'announceRequest should have no starting value in the Studio');
  need(problems, request && /Play announcements/.test(request.description || ''), 'the announceRequest description should name the button Play announcements');
  need(problems, time && time.type === 'datetime' && time.readOnly === true, 'announceRequest.requestedAt should be a read only datetime');
  need(problems, time && !constraintNamed(constraintsOf(time), 'required'), 'announceRequest.requestedAt should be optional');
  const inOrder = fieldsIn(settings).map(field => field.name).filter(name => name === 'announcements' || name === 'announceRequest');
  need(problems, inOrder.join() === 'announcements,announceRequest', 'the announcements should come before announceRequest, not ' + inOrder.join(', '));

  // The starting value is a request with no time, and the sample content never carries a request
  need(problems, sameData(config.defaultSettings.announceRequest, { requestedAt: '' }), 'the default announceRequest in config.js should be a time that is empty');
  need(problems, !('announceRequest' in world.sample.settings), 'the sample settings should not carry an announceRequest');

  // A Demo step can play the same announcements: the same id and name in the registry and in the Studio's copy
  const registry = world.demoRegistry.demoScreens;
  const copy = world.studioDemoScreens.demoScreens.filter(entry => entry.id === 'all-announcements')[0];
  need(problems, registry['all-announcements'] && registry['all-announcements'].name === 'All announcements', 'the dashboard demo screens should have all-announcements, named All announcements');
  need(problems, copy && copy.name === 'All announcements', 'studio/inputs/demo-screens.js should have all-announcements, named All announcements');

  // The button comes after the Play buttons of the hidden transitions, and nowhere else. Run presentation test and the Preview buttons are the ones after it.
  const played = Object.keys(world.hiddenRegistry.hiddenTransitions).length;
  const buttons = world.config.document.actions([], { schemaType: 'dashboardSettings' });
  const button = buttons[played];
  if (buttons.length !== 2 + played + world.studioPreviews.previews.length || typeof button !== 'function') {
    return problems.concat('the settings page should have the Play announcements button, a plain function, after the Play buttons of the hidden transitions, and then Run presentation test and the Preview buttons');
  }
  need(problems, world.config.document.actions([], { schemaType: 'demo' }).every(item => item.action !== 'playAnnouncements'), 'only the settings page should get the Play announcements button');

  function press(published, draft) {
    globalThis.studioCalls = [];
    const props = { id: 'dashboardSettings', type: 'dashboardSettings', published: published, draft: draft || null, onComplete: () => {} };
    const state = button(props);
    if (!state.disabled) state.onHandle();
    return { state: state, calls: globalThis.studioCalls };
  }

  // It writes the time now, only that, and publishes
  const before = Date.now();
  const pressed = press(null);
  const after = Date.now();
  const set = pressed.calls[0] && pressed.calls[0].patch && pressed.calls[0].patch[0] && pressed.calls[0].patch[0].set;
  const written = set && set.announceRequest;

  need(problems, pressed.state.label === 'Play announcements', 'the button should be labelled Play announcements');
  need(problems, button.action === 'playAnnouncements', 'the button should be called playAnnouncements');
  need(problems, pressed.calls.length === 2 && pressed.calls[0].patch.length === 1 && Object.keys(set).join() === 'announceRequest' && pressed.calls[1].publish === true, 'Play announcements should set announceRequest and then publish');
  need(problems, written && Object.keys(written).join() === 'requestedAt', 'Play announcements should write only requestedAt');
  need(problems, written && typeof written.requestedAt === 'string' && new Date(written.requestedAt).toISOString() === written.requestedAt && Date.parse(written.requestedAt) >= before && Date.parse(written.requestedAt) <= after, 'Play announcements should write the time now, as new Date().toISOString() writes it');
  need(problems, press({ announceRequest: { requestedAt: '2026-06-01T12:00:00.000Z' } }).state.disabled === false, 'Play announcements should be on when a request is already published, so it can be played again');
  return problems;
}

// Run presentation test: the hidden presentationTestRequest field in the Presentations tab
// (schemas/settingsPresentations.js), its starting value in config.js and the button that
// fills it in (actions.js). The Preview buttons come after it (checkPreviewButtons).
function checkRunPresentationTest() {
  const problems = [];
  const config = world.dashboard;
  const request = fieldAt('dashboardSettings.presentationTestRequest');
  const time = fieldAt('dashboardSettings.presentationTestRequest.requestedAt');

  // The field: an object with one read only time, hidden from editors, with no starting value of its own
  need(problems, request && request.type === 'object', 'presentationTestRequest should be an object');
  need(problems, request && request.group === 'presentations', 'presentationTestRequest should be in the Presentations tab');
  need(problems, request && request.hidden === true, 'presentationTestRequest should be hidden from editors (hidden: true)');
  need(problems, request && request.initialValue === undefined, 'presentationTestRequest should have no starting value in the Studio');
  need(problems, request && /Run presentation test/.test(request.description || ''), 'the presentationTestRequest description should name the button Run presentation test');
  need(problems, time && time.type === 'datetime' && time.readOnly === true, 'presentationTestRequest.requestedAt should be a read only datetime');
  need(problems, time && !constraintNamed(constraintsOf(time), 'required'), 'presentationTestRequest.requestedAt should be optional');

  // The starting value is a request with no time, and the sample content never carries a request
  need(problems, sameData(config.defaultSettings.presentationTestRequest, { requestedAt: '' }), 'the default presentationTestRequest in config.js should be a time that is empty');
  need(problems, !('presentationTestRequest' in world.sample.settings), 'the sample settings should not carry a presentationTestRequest');

  // The button comes after Play announcements and before the Preview buttons, and is on no other page
  const played = Object.keys(world.hiddenRegistry.hiddenTransitions).length;
  const buttons = world.config.document.actions([], { schemaType: 'dashboardSettings' });
  const button = buttons[1 + played];
  if (buttons.length !== 2 + played + world.studioPreviews.previews.length || typeof button !== 'function') {
    return problems.concat('the settings page should have the Run presentation test button, a plain function, after Play announcements and before the Preview buttons');
  }
  need(problems, world.config.document.actions([], { schemaType: 'demo' }).every(item => item.action !== 'runPresentationTest'), 'only the settings page should get the Run presentation test button');

  function press(published, draft) {
    globalThis.studioCalls = [];
    const props = { id: 'dashboardSettings', type: 'dashboardSettings', published: published, draft: draft || null, onComplete: () => {} };
    const state = button(props);
    if (!state.disabled) state.onHandle();
    return { state: state, calls: globalThis.studioCalls };
  }

  // It writes the time now, only that, and publishes
  const before = Date.now();
  const pressed = press(null);
  const after = Date.now();
  const set = pressed.calls[0] && pressed.calls[0].patch && pressed.calls[0].patch[0] && pressed.calls[0].patch[0].set;
  const written = set && set.presentationTestRequest;

  need(problems, pressed.state.label === 'Run presentation test', 'the button should be labelled Run presentation test');
  need(problems, button.action === 'runPresentationTest', 'the button should be called runPresentationTest');
  need(problems, pressed.calls.length === 2 && pressed.calls[0].patch.length === 1 && Object.keys(set).join() === 'presentationTestRequest' && pressed.calls[1].publish === true, 'Run presentation test should set presentationTestRequest and then publish');
  need(problems, written && Object.keys(written).join() === 'requestedAt', 'Run presentation test should write only requestedAt');
  need(problems, written && typeof written.requestedAt === 'string' && new Date(written.requestedAt).toISOString() === written.requestedAt && Date.parse(written.requestedAt) >= before && Date.parse(written.requestedAt) <= after, 'Run presentation test should write the time now, as new Date().toISOString() writes it');
  need(problems, press({ presentationTestRequest: { requestedAt: '2026-06-01T12:00:00.000Z' } }).state.disabled === false, 'Run presentation test should be on when a request is already published, so it can be run again');
  return problems;
}

// The Preview buttons: the hidden previewRequest field in the Screen tab
// (schemas/settingsPreview.js), its starting value in config.js, the list of previews
// that the Studio copies from the dashboard (previews.js), and the buttons that fill the
// field in (actions.js). They are the last buttons on the settings page.
function checkPreviewButtons() {
  const problems = [];
  const config = world.dashboard;
  const request = fieldAt('dashboardSettings.previewRequest');
  const kind = fieldAt('dashboardSettings.previewRequest.kind');
  const time = fieldAt('dashboardSettings.previewRequest.requestedAt');
  const registry = world.previewModule.previewKinds;
  const ids = Object.keys(registry);
  const copy = world.studioPreviews.previews;

  // The field: an object with a read only kind and a read only time, hidden from editors, with no starting value of its own
  need(problems, request && request.type === 'object', 'previewRequest should be an object');
  need(problems, request && request.group === 'screen', 'previewRequest should be in the Screen tab');
  need(problems, request && request.hidden === true, 'previewRequest should be hidden from editors (hidden: true)');
  need(problems, request && request.initialValue === undefined, 'previewRequest should have no starting value in the Studio');
  need(problems, request && /Preview buttons/.test(request.description || ''), 'the previewRequest description should name the Preview buttons');
  need(problems, kind && kind.readOnly === true && !constraintNamed(constraintsOf(kind), 'required'), 'previewRequest.kind should be read only and optional');
  need(problems, time && time.type === 'datetime' && time.readOnly === true, 'previewRequest.requestedAt should be a read only datetime');
  need(problems, time && !constraintNamed(constraintsOf(time), 'required'), 'previewRequest.requestedAt should be optional');
  const allowed = kind ? constraintNamed(constraintsOf(kind), 'valid') : null;
  need(problems, allowed && allowed.args[0].join() === ids.join(), 'previewRequest.kind should only allow: ' + ids.join(', '));

  // The starting value is a request with no kind and no time, and the sample content never carries a request
  need(problems, sameData(config.defaultSettings.previewRequest, { kind: '', requestedAt: '' }), 'the default previewRequest in config.js should be a kind and a time that are both empty');
  need(problems, !('previewRequest' in world.sample.settings), 'the sample settings should not carry a previewRequest');
  need(problems, config.previewSeconds === 120, 'previewSeconds in config.js should be 120, the 2 minutes the buttons say');

  // The Studio's list is the dashboard's registry: the same ids and names, in the same order, and each kind holds something that exists
  need(problems, ids.length === 5, 'the registry in dashboard/core/preview.js should have five previews, not ' + ids.length);
  need(problems, copy.length === ids.length, 'studio/inputs/previews.js has ' + copy.length + ' previews and the dashboard registry has ' + ids.length);
  ids.forEach((id, index) => {
    const entry = registry[id];
    const other = copy[index];
    if (!other || other.id !== id) return problems.push('preview number ' + (index + 1) + ' is "' + id + '" in the dashboard registry but "' + (other && other.id) + '" in studio/inputs/previews.js');
    need(problems, other.name === entry.name, 'the preview "' + id + '" has name "' + entry.name + '" in the dashboard registry but "' + other.name + '" in studio/inputs/previews.js');
    need(problems, typeof other.shows === 'string' && other.shows !== '', 'the preview "' + id + '" needs words for what it shows in studio/inputs/previews.js');

    const holds = ['team', 'style', 'pack'].filter(name => entry[name] !== undefined);
    need(problems, holds.length === 1, 'the preview "' + id + '" should hold one thing: a team, a style or a pack');
    need(problems, entry.team === undefined || config.teamModes.indexOf(entry.team) !== -1, 'the preview "' + id + '" holds the team mode "' + entry.team + '", which is not one in teamModes in config.js');
    need(problems, entry.style === undefined || config.styles.indexOf(entry.style) !== -1, 'the preview "' + id + '" holds the style "' + entry.style + '", which is not one in styles in config.js');
    need(problems, entry.pack === undefined || entry.pack === 'next', 'the preview "' + id + '" holds a pack that is not "next"');
  });
  const offered = choicesOf('dashboardSettings.previewRequest.kind');
  need(problems, offered.map(item => item.title).join() === ids.map(id => 'Preview ' + registry[id].name).join(), 'previewRequest.kind should show the names in the dashboard registry, each after the word Preview');

  // The buttons come last, one for each preview, as plain functions, and are on no other page
  const before = 2 + Object.keys(world.hiddenRegistry.hiddenTransitions).length;
  const buttons = world.config.document.actions([], { schemaType: 'dashboardSettings' }).slice(before);
  if (buttons.length !== ids.length || !buttons.every(button => typeof button === 'function')) {
    return problems.concat('the settings page should end with one Preview button for each preview, written as plain functions');
  }
  need(problems, world.config.document.actions([], { schemaType: 'demo' }).every(item => !/^preview/.test(item.action)), 'only the settings page should get the Preview buttons');

  function press(button, published, draft) {
    globalThis.studioCalls = [];
    const props = { id: 'dashboardSettings', type: 'dashboardSettings', published: published, draft: draft || null, onComplete: () => {} };
    const state = button(props);
    if (!state.disabled) state.onHandle();
    return { state: state, calls: globalThis.studioCalls };
  }

  // Each writes its kind and the time now, only that, and publishes
  const pascal = id => id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  ids.forEach((id, index) => {
    const button = buttons[index];
    const label = 'Preview ' + registry[id].name;
    const earlier = Date.now();
    const pressed = press(button, null);
    const later = Date.now();
    const set = pressed.calls[0] && pressed.calls[0].patch && pressed.calls[0].patch[0] && pressed.calls[0].patch[0].set;
    const written = set && set.previewRequest;

    need(problems, pressed.state.label === label, 'the button for ' + id + ' should be labelled ' + label);
    need(problems, button.action === 'preview' + pascal(id), 'the button for ' + id + ' should be called preview' + pascal(id));
    need(problems, /2 minutes/.test(pressed.state.title || '') && /No setting is changed/.test(pressed.state.title || ''), label + ' should say in its hover text that it lasts 2 minutes and changes no setting');
    need(problems, pressed.calls.length === 2 && pressed.calls[0].patch.length === 1 && Object.keys(set).join() === 'previewRequest' && pressed.calls[1].publish === true, label + ' should set previewRequest and then publish');
    need(problems, written && Object.keys(written).join() === 'kind,requestedAt' && written.kind === id, label + ' should write the kind ' + id);
    need(problems, written && typeof written.requestedAt === 'string' && new Date(written.requestedAt).toISOString() === written.requestedAt && Date.parse(written.requestedAt) >= earlier && Date.parse(written.requestedAt) <= later, label + ' should write the time now, as new Date().toISOString() writes it');
    need(problems, press(button, { previewRequest: { kind: id, requestedAt: '2026-06-01T12:00:00.000Z' } }).state.disabled === false, label + ' should be on when a request is already published, so it can be clicked again');
  });
  return problems;
}

// The Start here page (start-here.js, with its words and numbers in start-here-parts.js): six
// blocks in this order, a picture of the screen with the areas A to E, the status of the Teletraan computer and three links.
const startBlocks = ['what', 'picture', 'steps', 'status', 'links', 'coaches'];
const startLinks = ['The control page', 'The Studio on the web', 'The guides'];
const startAreas = ['A Banner', 'B Main panel', 'C Countdown', 'D Side panel', 'E Ticker'];

// Every element of a tree that the createElement stand-in made, in the order they are drawn,
// that test keeps
function nodesWhere(node, test, found) {
  const list = found || [];
  if (Array.isArray(node)) {
    node.forEach(item => nodesWhere(item, test, list));
  } else if (node && typeof node === 'object') {
    if (test(node)) list.push(node);
    nodesWhere(node.children || [], test, list);
  }
  return list;
}

// The words of a tree, as one line
function wordsIn(node) {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(wordsIn).join(' ').replace(/\s+/g, ' ').trim();
  return node && typeof node === 'object' ? wordsIn(node.children || []) : '';
}

// What a student reads is short plain sentences: none long, no dash, no exclamation mark, no emoji
function checkPlainSentences(problems, where, text) {
  text.split(/[.?]\s+|[.?]$/).forEach(sentence => {
    const length = sentence.trim().split(/\s+/).filter(Boolean).length;
    need(problems, length <= 20, where + ' has a sentence of ' + length + ' words: "' + sentence.trim() + '". Use short sentences.');
  });
  need(problems, !/[\u2014\u2013!]/.test(text), where + ' has a dash or an exclamation mark in it');
  need(problems, !/\p{Extended_Pictographic}/u.test(text), where + ' has an emoji in it');
}

// The boxes of the standard layout, worked out from the sizes in dashboard/base.css: [banner, main
// panel, countdown, side panel, ticker], each { x, y, width, height }
function standardBoxes() {
  const block = name => (world.baseCss.match(new RegExp(name + ' \\{[^}]*\\}')) || [''])[0];
  const numbers = (text, property) => ((text.match(new RegExp(property + ': ([^;]*);')) || ['', ''])[1].match(/\d+/g) || []).map(Number);
  const stage = block('#stage');
  const right = block('#region-right');
  const [padY, padX] = numbers(stage, 'padding');
  const [leftWidth, rightWidth] = numbers(stage, 'grid-template-columns');
  const [bannerHeight, mainHeight, tickerHeight] = numbers(stage, 'grid-template-rows');
  const [rowGap, columnGap] = numbers(stage, 'gap');
  const [countdownHeight, sideHeight] = numbers(right, 'grid-template-rows');
  const [rightGap] = numbers(right, 'gap');

  const wide = leftWidth + columnGap + rightWidth;
  const middleY = padY + bannerHeight + rowGap;
  const rightX = padX + leftWidth + columnGap;
  return [
    { x: padX, y: padY, width: wide, height: bannerHeight },
    { x: padX, y: middleY, width: leftWidth, height: mainHeight },
    { x: rightX, y: middleY, width: rightWidth, height: countdownHeight },
    { x: rightX, y: middleY + countdownHeight + rightGap, width: rightWidth, height: sideHeight },
    { x: padX, y: middleY + mainHeight + rowGap, width: wide, height: tickerHeight },
  ];
}

function checkStartHere() {
  const problems = [];
  const parts = world.startHereParts;
  globalThis.studioClient = undefined;
  const page = world.startHere.StartHere();

  // The six blocks, in the order of the list
  const blocks = nodesWhere(page, node => node.props && node.props['data-block'] !== undefined);
  need(problems, blocks.map(node => node.props['data-block']).join() === startBlocks.join(), 'the Start here page should have these six blocks, in this order: ' + startBlocks.join(', ') + '. It has: ' + blocks.map(node => node.props['data-block']).join(', '));
  need(problems, wordsIn(nodesWhere(page, node => node.type === 'h1')) === 'Start here', 'the Start here page should open with the heading Start here');
  const block = name => blocks.filter(node => node.props['data-block'] === name)[0];

  // 1. what it is, and that Publish all is the last step. 3. the steps and Draft and Published. 5. Coaches only.
  const what = wordsIn(block('what'));
  need(problems, /Teletraan I/.test(what) && /Publish all is the last step/.test(what), 'the first block should say what Teletraan I is and that Publish all is the last step of every change');
  const steps = block('steps') ? nodesWhere(block('steps'), node => node.type === 'li').map(wordsIn) : [];
  need(problems, steps.length === 3 && /Daily Agenda/.test(steps[0]) && /Tasks/.test(steps[0]) && /Publish all/.test(steps[2]), 'the steps should be three lines: open Daily Agenda or Tasks, make the change, click Publish all');
  need(problems, /Draft/.test(wordsIn(block('steps'))) && /Published/.test(wordsIn(block('steps'))), 'the steps block should have the sentence about Draft and Published');
  need(problems, /Coaches only/.test(wordsIn(block('coaches'))) && /coach/.test(wordsIn(block('coaches'))), 'the last block should say that anything under Coaches only is for a coach');

  // 2. the picture: the shape of the screen, a box for each of the five areas
  const picture = nodesWhere(page, node => node.type === 'svg')[0];
  const size = parts.screen;
  need(problems, picture && picture.props.viewBox === '0 0 ' + size.width + ' ' + size.height, 'the picture should be an inline svg drawn on the 1920 by 1080 of the screen');
  need(problems, size.width * 9 === size.height * 16, 'the picture should have the 16 to 9 shape of the screen');
  need(problems, picture && picture.props.role === 'img' && String(picture.props['aria-label'] || '') !== '', 'the picture should have role img and a label for a screen reader');
  const caption = nodesWhere(page, node => node.type === 'figcaption').map(wordsIn)[0] || '';
  need(problems, parts.clickLine === 'Rotation says which panel plays and for how long.' && caption.indexOf(parts.clickLine) !== -1 && caption.indexOf(parts.dotsLine) !== -1, 'the line under the picture should say what Rotation does and what the three dots mean');
  need(problems, /Monday/.test(parts.dotsLine) && /calendars/.test(parts.dotsLine) && /Sanity/.test(parts.dotsLine), 'the line about the dots should name Monday, the calendars and Sanity');
  need(problems, world.structure.sidebarEntries[0] && world.structure.sidebarEntries[0].title === 'Start here' && world.structure.sidebarEntries.some(entry => entry.title === 'Rotation'), 'Start here should be the first line of the sidebar and Rotation should be a line of it');
  need(problems, !/Screens|Family|General|theme tag|view tag/i.test(wordsIn(page)), 'the Start here page should not mention Screens, Family, General or a view tag');
  need(problems, /Use the standard colors for this team/.test(wordsIn(block('coaches'))) && /own colors/.test(wordsIn(block('coaches'))), 'the last block should say that a team keeps its own colors and how to put the standard ones back');
  const shown = picture ? nodesWhere(picture, node => node.type === 'text').map(wordsIn) : [];
  need(problems, shown.filter(text => /^[A-Z]$/.test(text)).join('') === 'ABCDE', 'the picture should have the letters A to E, in order, one for each area. It has: ' + shown.filter(text => /^[A-Z]$/.test(text)).join(''));
  need(problems, parts.areas.map(area => area.letter + ' ' + area.name).join() === startAreas.join(), 'the picture should have the areas ' + startAreas.join(', '));
  need(problems, picture && nodesWhere(picture, node => node.type === 'image').length === 0 && !/\.(png|jpe?g|svg|webp)/i.test(world.startHereSource), 'the picture should be drawn in the page, not an image file');

  // Each box is where the standard layout puts the area, and holds the sidebar items that fill it
  const boxes = standardBoxes();
  const sidebarTitlesNow = allLines(world.structure.sidebarEntries).map(entry => entry.title);
  const above = 0.8;
  const below = 0.25;
  parts.areas.forEach((area, index) => {
    const name = area.letter + ' ' + area.name;
    const want = boxes[index];
    need(problems, want && ['x', 'y', 'width', 'height'].every(key => area[key] === want[key]), name + ' should be the box of the standard layout in dashboard/base.css: ' + JSON.stringify(want) + '. It is ' + JSON.stringify({ x: area.x, y: area.y, width: area.width, height: area.height }));
    need(problems, area.x >= 0 && area.y >= 0 && area.x + area.width <= size.width && area.y + area.height <= size.height, name + ' should be inside the screen');
    parts.areas.slice(index + 1).forEach(other => {
      const apart = other.x >= area.x + area.width || area.x >= other.x + other.width || other.y >= area.y + area.height || area.y >= other.y + other.height;
      need(problems, apart, name + ' and ' + other.letter + ' ' + other.name + ' should not overlap');
    });

    need(problems, area.feeds.length > 0 && area.feeds.every(line => line.length > 0), name + ' should name the sidebar items that fill it');
    area.feeds.forEach(line => line.forEach(title => {
      need(problems, sidebarTitlesNow.indexOf(title) !== -1, name + ' names "' + title + '", which is not a line of the sidebar');
    }));
    need(problems, shown.indexOf(area.name) !== -1 && area.feeds.every(line => shown.indexOf(line.join(', ')) !== -1), name + ' should be written in the picture with the sidebar items that fill it');

    // The words fit the box. The width is a wide guess (widthOf), since nothing is drawn here.
    const labels = parts.labelsOf(area);
    const inside = (left, right, top, bottom) => left >= area.x && right <= area.x + area.width && top >= area.y && bottom <= area.y + area.height;
    need(problems, inside(labels.badge.x, labels.badge.x + labels.badge.size, labels.badge.y, labels.badge.y + labels.badge.size), name + ': the square with the letter should be inside its box');
    need(problems, labels.letter.x - parts.widthOf(labels.letter.text, labels.letter.size) / 2 >= labels.badge.x && labels.letter.y <= labels.badge.y + labels.badge.size, name + ': the letter should be inside its square');
    [labels.name].concat(labels.feeds).forEach(words => {
      const fits = inside(words.x, words.x + parts.widthOf(words.text, words.size), words.y - words.size * above, words.y + words.size * below);
      need(problems, fits, name + ': "' + words.text + '" should fit inside its box');
    });
  });

  // 4. the status of the Teletraan computer, drawn by the same input as the status block of Dashboard Settings
  need(problems, block('status') && nodesWhere(block('status'), node => node.type === world.statusInput.StatusInput).length === 1, 'the status block should hold the status of the Teletraan computer, drawn by StatusInput (status-input.js)');

  // 5. the links: the control page, the Studio on the web and the guides, in new tabs. An address that is a placeholder is words.
  need(problems, parts.links.map(item => item.label).join() === startLinks.join(), 'the links in start-here-parts.js should be, in this order: ' + startLinks.join(', '));
  const linkNodes = block('links') ? nodesWhere(block('links'), node => node.type === 'a') : [];
  const real = parts.links.filter(parts.isReal);
  need(problems, linkNodes.length === real.length && linkNodes.every((node, index) => node.props.href === real[index].address && node.props.target === '_blank' && /noopener/.test(node.props.rel || '')), 'each link with a real address should open it in a new tab, with rel noopener');
  need(problems, parts.links[0].address === world.controlAddress.controlAddress && parts.isReal(parts.links[0]), 'the first link should be the control page, at controlAddress in control-address.js');
  need(problems, !parts.isReal(parts.links[1]) ? /^\[.*\]$/.test(parts.studioAddress) : /^https:\/\//.test(parts.studioAddress), 'the address of the Studio on the web should be a marked placeholder in brackets or an https address');
  need(problems, world.startHereSource.indexOf(world.controlAddress.controlAddress) === -1 && world.startHerePartsSource.indexOf(world.controlAddress.controlAddress) === -1, 'the control page address should be written once, in control-address.js');
  need(problems, nodesWhere(page, node => node.type === 'button').length === 0, 'the Start here page should have no buttons that act on the screen. They are on the control page');

  // The words a student reads, one heading, line or paragraph at a time
  nodesWhere(page, node => ['h1', 'h2', 'p', 'li', 'figcaption'].indexOf(node.type) !== -1).forEach(node => checkPlainSentences(problems, 'the Start here page ("' + wordsIn(node).slice(0, 30) + '")', wordsIn(node)));
  checkPlainSentences(problems, 'the label of the picture', picture ? String(picture.props['aria-label']) : '');
  parts.links.forEach(item => checkPlainSentences(problems, 'the line under ' + item.label, item.says));

  // The buttons do not repeat the work of the buttons beside Publish: the fields are only in screen-requests.js
  const writesRequest = source => /\b(announceRequest|presentationTestRequest|nextLookRequest|competitionPreviewRequest|hiddenRequest|previewRequest)\s*:/.test(source);
  need(problems, !writesRequest(world.actionsSource), 'actions.js should not write a request field itself. It uses the functions in screen-requests.js');
  need(problems, !writesRequest(world.startHereSource) && !writesRequest(world.startHerePartsSource) && !/requestedAt/.test(world.startHereSource + world.startHerePartsSource), 'the Start here page should not write a request field itself. It uses the functions in screen-requests.js');
  need(problems, !/useDocumentOperation/.test(world.startHereSource), 'the Start here page should send through the Studio client and not through the document operations of an action');
  return problems;
}

// The buttons that send a request, in the menu beside Publish (actions.js) and on the Start here page,
// write the same fields, and both use the functions in screen-requests.js. Next look now and Preview
// competition are on the Start here page only. Each request is a hidden field of Dashboard Settings
// that holds the time it was asked for. The shapes below are what the buttons in actions.js wrote
// before the work was moved: a time is written as TIME.
async function checkScreenRequests() {
  const problems = [];
  const requests = world.screenRequests;
  const structure = world.structure;
  const pascal = id => id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  const isTime = text => typeof text === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(text);

  // The same value with every time written as TIME, and the times that were found
  function shapeOf(value, times) {
    if (isTime(value)) {
      times.push(value);
      return 'TIME';
    }
    if (value && typeof value === 'object') {
      const copy = {};
      Object.keys(value).forEach(key => {
        copy[key] = shapeOf(value[key], times);
      });
      return copy;
    }
    return value;
  }

  // The page the requests are written to is Dashboard Settings, the one structure.js opens
  need(problems, requests.settingsDocument.type === structure.settingsType && requests.settingsDocument.id === structure.settingsId, 'settingsDocument in screen-requests.js should be the type ' + structure.settingsType + ' and the id ' + structure.settingsId + ', as in structure.js');

  // A client that writes down what it is asked. failing is an error the commit gives back.
  function clientWriting(failing) {
    const calls = [];
    return {
      calls: calls,
      patch: id => {
        calls.push({ patch: id });
        return {
          set: fields => {
            calls.push({ set: fields });
            return {
              commit: () => {
                calls.push({ commit: true });
                return failing ? Promise.reject(failing) : Promise.resolve({});
              },
            };
          },
        };
      },
    };
  }

  const actions = world.config.document.actions([], { schemaType: 'dashboardSettings' });
  const action = name => actions.filter(item => item.action === name)[0];

  // What a button beside Publish writes: the fields it sets, and that it then publishes
  function pressAction(name) {
    const button = action(name);
    globalThis.studioCalls = [];
    if (typeof button !== 'function') return null;
    button({ id: 'dashboardSettings', type: 'dashboardSettings', published: null, draft: null, onComplete: () => {} }).onHandle();
    return globalThis.studioCalls;
  }

  const cases = [
    { action: 'playAnnouncements', fields: () => requests.announceRequest(), shape: { announceRequest: { requestedAt: 'TIME' } } },
    { action: 'runPresentationTest', fields: () => requests.presentationTestRequest(), shape: { presentationTestRequest: { requestedAt: 'TIME' } } },
    // these two have no button beside Publish, only the one on the Start here page
    { action: '', where: 'nextLookNow', fields: () => requests.nextLookRequest(), shape: { nextLookRequest: { requestedAt: 'TIME' } } },
    { action: '', where: 'previewCompetition', fields: () => requests.competitionPreviewRequest(), shape: { competitionPreviewRequest: { requestedAt: 'TIME' } } },
  ];
  world.studioHidden.hiddenTransitions.forEach(kind => {
    cases.push({ action: 'play' + pascal(kind.id), fields: () => requests.hiddenRequest(kind.id), shape: { hiddenRequest: { kind: kind.id, requestedAt: 'TIME' } } });
  });
  world.studioPreviews.previews.forEach(kind => {
    cases.push({ action: 'preview' + pascal(kind.id), fields: () => requests.previewRequest(kind.id), shape: { previewRequest: { kind: kind.id, requestedAt: 'TIME' } } });
  });

  for (const item of cases) {
    const where = item.action || item.where;
    const client = clientWriting();
    const before = Date.now();
    await requests.sendWithClient(client, item.fields());
    const after = Date.now();

    // The button beside Publish: set the fields, then publish, as it always did
    if (item.action) {
      const sentByAction = pressAction(item.action);
      const actionSet = sentByAction && sentByAction[0] && sentByAction[0].patch && sentByAction[0].patch[0] && sentByAction[0].patch[0].set;
      need(problems, sentByAction && sentByAction.length === 2 && sentByAction[0].patch.length === 1 && sentByAction[1].publish === true, where + ' (beside Publish) should set the fields and then publish');
      need(problems, JSON.stringify(shapeOf(actionSet, [])) === JSON.stringify(item.shape), where + ' (beside Publish) should set ' + JSON.stringify(item.shape) + ', not ' + JSON.stringify(shapeOf(actionSet, [])));
    }

    // The same fields, set on the published Dashboard Settings through the client (screen-requests.js)
    const times = [];
    const clientSet = client.calls[1] && client.calls[1].set;
    need(problems, client.calls.length === 3 && client.calls[0].patch === structure.settingsId && client.calls[2].commit === true, where + ' (through the client) should patch ' + structure.settingsId + ', set the fields and commit');
    need(problems, JSON.stringify(shapeOf(clientSet, times)) === JSON.stringify(item.shape), where + ' (through the client) should set ' + JSON.stringify(item.shape) + ', not ' + JSON.stringify(shapeOf(clientSet, [])));
    need(problems, times.length === 1 && Date.parse(times[0]) >= before && Date.parse(times[0]) <= after, where + ' (through the client) should write the time now, as new Date().toISOString() writes it');
  }

  // The Start here page has no button that sends a request: they are on the control page
  need(problems, nodesWhere(world.startHere.StartHere(), node => node.type === 'button').length === 0, 'the Start here page should have no buttons');
  globalThis.studioClient = undefined;
  return problems;
}

// Next look now and Preview competition: the hidden nextLookRequest and competitionPreviewRequest fields
// in the Screen tab (schemas/settingsRequests.js), their starting values in config.js, and the buttons
// on the Start here page that fill them in. They have no button beside Publish.
function checkNewRequests() {
  const problems = [];
  const config = world.dashboard;
  const settings = typeByName('dashboardSettings');
  const wanted = [
    { name: 'nextLookRequest', button: 'Next look now' },
    { name: 'competitionPreviewRequest', button: 'Preview competition' },
  ];

  wanted.forEach(item => {
    const request = fieldAt('dashboardSettings.' + item.name);
    const time = fieldAt('dashboardSettings.' + item.name + '.requestedAt');

    // The field: an object with one read only time, hidden from editors, with no starting value of its own
    need(problems, request && request.type === 'object', item.name + ' should be an object');
    need(problems, request && request.group === 'screen', item.name + ' should be in the Screen tab');
    need(problems, request && request.hidden === true, item.name + ' should be hidden from editors (hidden: true)');
    need(problems, request && request.initialValue === undefined, item.name + ' should have no starting value in the Studio');
    need(problems, request && (request.fields || []).map(field => field.name).join() === 'requestedAt', item.name + ' should have one field, requestedAt');
    need(problems, request && request.description && request.description.indexOf(item.button) !== -1, 'the ' + item.name + ' description should name the button ' + item.button);
    need(problems, time && time.type === 'datetime' && time.readOnly === true, item.name + '.requestedAt should be a read only datetime');
    need(problems, time && !constraintNamed(constraintsOf(time), 'required'), item.name + '.requestedAt should be optional');
    need(problems, fieldsIn(settings).filter(field => field.name === item.name).length === 1, item.name + ' should be in Dashboard Settings once');

    // The starting value is a request with no time, and the sample content never carries a request
    need(problems, sameData(config.defaultSettings[item.name], { requestedAt: '' }), 'the default ' + item.name + ' in config.js should be a time that is empty');
    need(problems, !(item.name in world.sample.settings), 'the sample settings should not carry a ' + item.name);
  });

  // The buttons are on the Start here page only: no page gets an action for them
  ['dashboardSettings', 'theme', 'demo', 'task'].forEach(type => {
    const names = world.config.document.actions([], { schemaType: type }).map(button => String(button.action));
    need(problems, !names.some(name => /nextLook|competition/i.test(name)), 'the ' + type + ' page should have no button for Next look now or Preview competition. They are on the Start here page');
  });
  return problems;
}

// Show connection status is a switch that starts off, in the Advanced tab. The
// connection status text comes up by itself when Sanity cannot be reached,
// whatever the switch says (dashboard/core/connection.js).
function checkConnectionStatus() {
  const problems = [];
  const field = fieldAt('dashboardSettings.showConnectionStatus');

  need(problems, world.dashboard.defaultSettings.showConnectionStatus === false, 'the default showConnectionStatus in config.js should be false');
  need(problems, field && field.type === 'boolean' && field.initialValue === false, 'showConnectionStatus should be a switch that starts off');
  need(problems, field && field.title === 'Show connection status', 'showConnectionStatus should be titled Show connection status');
  return problems;
}

// The values a new Studio starts with are copies of the dashboard's defaults
function checkStartingValues() {
  const problems = [];
  const settings = world.dashboard.defaultSettings;
  const team = world.dashboard.defaultTeam;

  function expect(pathText, expected) {
    const field = fieldAt('dashboardSettings.' + pathText);
    const actual = field && field.initialValue;
    const message = pathText + ' starts as ' + JSON.stringify(actual) + ' but config.js says ' + JSON.stringify(expected);
    need(problems, sameData(actual, expected), message);
  }

  ['name', 'number', 'school'].forEach(name => expect('team.' + name, team[name]));
  expect('motion', settings.motion);
  expect('speed', settings.speed);
  expect('frameMetal', settings.frameMetal);
  expect('glint', settings.glint);
  expect('look', settings.look);
  expect('style', settings.style);
  expect('showConnectionStatus', settings.showConnectionStatus);
  expect('pageSeconds', settings.pageSeconds);
  const fixedNames = Object.keys(fixedValues).filter(pathText => pathText.startsWith('dashboardSettings.')).map(pathText => pathText.split('.')[1]);
  // The hours of the hidden transitions start at 60 here and at 0 in config.js, which checkHiddenTab checks
  const hiddenStarting = ['hiddenEnabled', 'desktopChance', 'redEyesChance'];
  logoSwitches.concat(logoNumbers, transitionNames, photoNames, nightNames, hiddenStarting, presentationNames, teamNames).filter(name => fixedNames.indexOf(name) === -1).forEach(name => expect(name, settings[name]));
  expect('countdown.kickoffLabel', settings.countdown.kickoffLabel);
  expect('countdown.rolloutLabel', settings.countdown.rolloutLabel);
  expect('alert.on', settings.alert.on);
  expect('rotation.grid1', settings.rotation.grid1);
  expect('rotation.grid2', settings.rotation.grid2);
  expect('rotation.order', world.panelOrder.orderFromLists(settings.rotation));
  expect('rotation.tickerSeconds', settings.rotation.tickerSeconds);
  expect('doneDays', settings.doneDays);
  expect('crt.on', settings.crt.on);
  expect('crt.everySeconds', settings.crt.everySeconds);
  expect('crt.durationSeconds', settings.crt.durationSeconds);
  expect('calendars', settings.calendars);

  // A missing show means on. The Studio writes it out so its switch shows on.
  expect('announcements', settings.announcements.map(item => Object.assign({ show: true }, item)));

  const kickoff = fieldAt('dashboardSettings.countdown.kickoff').initialValue;
  const kickoffOk = kickoff && localTime(kickoff) === settings.countdown.kickoff;
  need(problems, kickoffOk, 'countdown.kickoff should start at ' + settings.countdown.kickoff + ' in Holly Springs');
  if (fieldAt('dashboardSettings.countdown.rollout').initialValue) problems.push('countdown.rollout should start empty');
  return problems;
}

// Names in an object that no field of the schema carries
function unknownKeys(value, fields, where) {
  const problems = [];
  Object.keys(value).forEach(key => {
    const field = fields.filter(item => item.name === key)[0];
    if (!field) return problems.push(where + '.' + key + ' is read by the dashboard but the Studio has no such field');

    const inside = fieldsIn(field);
    const items = Array.isArray(value[key]) ? value[key] : [value[key]];
    items.forEach(item => {
      if (item && typeof item === 'object' && inside.length > 0) problems.push.apply(problems, unknownKeys(item, inside, where + '.' + key));
    });
  });
  return problems;
}

function checkDashboardNames() {
  const problems = [];
  const sample = world.sample;
  const settingsFields = fieldsIn(typeByName('dashboardSettings'));
  const add = list => problems.push.apply(problems, list);

  add(unknownKeys(Object.assign({ team: world.dashboard.defaultTeam }, world.dashboard.defaultSettings), settingsFields, 'config.js'));
  add(unknownKeys(Object.assign({ team: sample.team }, sample.settings), settingsFields, 'sample settings'));
  add(unknownKeys(sample.plan, fieldsIn(typeByName('plan')), 'sample plan'));
  add(unknownKeys(world.dashboard.defaultThemeSettings, fieldsIn(typeByName('theme')), 'defaultThemeSettings in config.js'));
  add(unknownKeys(sample.theme || {}, fieldsIn(typeByName('theme')), 'sample theme'));
  add(unknownKeys(world.dashboard.defaultDemo, fieldsIn(typeByName('demo')), 'defaultDemo in config.js'));
  add(unknownKeys(sample.demo || {}, fieldsIn(typeByName('demo')), 'sample demo'));

  const lists = { tasks: 'task', sponsors: 'sponsor', tipsAndNews: 'tipOrNews', subteams: 'subteam', people: 'person', calendarFilters: 'calendarFilter', presentationDays: 'presentationDay', presentations: 'presentation' };
  Object.keys(lists).forEach(key => {
    // a talk has its Sanity id under the plain name id, the way the query sends it
    // a task also has the id of its Team lead (subteamId, which the query takes from the reference) and, in the sample, a Notes
    // text of the board, which the screen never reads and which proves that no name or address reaches it
    sample[key].forEach(item => add(unknownKeys(key === 'tasks' ? without(without(without(item, 'id'), 'subteamId'), 'notes') : without(item, 'id'), fieldsIn(typeByName(lists[key])), 'sample ' + key)));
  });

  sample.customPanels.forEach(panel => {
    add(unknownKeys(without(panel, 'blocks'), fieldsIn(typeByName('customPanel')), 'sample customPanels'));
    panel.blocks.forEach(block => {
      const type = typeByName(block.type + 'Block');
      if (!type) return problems.push('sample block type ' + block.type + ' has no block in the Studio');
      add(unknownKeys(without(block, 'type'), fieldsIn(type), 'sample ' + block.type + ' block'));
    });
  });
  return problems;
}

// A stand-in for the Studio's structure builder that writes down each call
function fakeBuilder() {
  const methods = ['title', 'id', 'icon', 'child', 'items', 'menuItems', 'schemaType', 'documentId', 'defaultOrdering', 'apiVersion', 'filter', 'params', 'initialValueTemplates'];
  function node(start) {
    const made = Object.assign({}, start);
    const builder = { made: made };
    methods.forEach(name => {
      builder[name] = value => {
        made[name] = value;
        return builder;
      };
    });
    return builder;
  }

  return {
    list: () => node({}),
    listItem: () => node({}),
    documentTypeList: type => node({ type: type }),
    document: () => node({}),
    component: component => node({ component: component }),
    divider: () => node({ divider: true }),
    initialValueTemplateItem: templateId => ({ serialize: () => ({ templateId: templateId }) }),
    menuItemsFromInitialValueTemplateItems: items => items.map(item => ({ intent: { type: 'create', params: { template: item.templateId } } })),
  };
}

// structure.js holds the whole sidebar as one list, sidebarEntries. Each line
// has to name a type that exists, and each kind of document has to have a
// line, or editors could not reach it, unless it is in notInSidebar with a reason.
// A folder holds lists, pages and one more folder of lists, and its lines count
// like the others. The headings, the lines under each and their order are the
// ones in sidebarGroups and folderLines, and every line has an icon of its own.

// Every line of the sidebar, the lines inside each folder too, however deep
function allLines(entries) {
  return entries.reduce((lines, entry) => lines.concat(entry.kind === 'group' ? [entry].concat(allLines(entry.entries || [])) : [entry]), []);
}

// The titles of the lines of a folder, a folder inside it with its own lines in brackets:
// "Agenda items, Presentations (Upcoming, Past), Meeting days"
function folderShape(entries) {
  return entries.map(entry => entry.title + (entry.kind === 'group' ? ' (' + folderShape(entry.entries || []) + ')' : '')).join(', ');
}

// The headings and the lines under each, as text such as "TASKS: Daily Agenda, Monday Tasks"
function sidebarShape(entries) {
  const groups = [];
  entries.forEach(entry => {
    if (entry.kind === 'divider') return groups.push({ heading: entry.title || '', titles: [] });
    if (groups.length === 0) groups.push({ heading: '', titles: [] });
    groups[groups.length - 1].titles.push(entry.title);
  });
  return groups.map(group => (group.heading ? group.heading + ': ' : '') + group.titles.join(', '));
}

function checkSidebarLines(problems) {
  const entries = world.structure.sidebarEntries;
  const typeNames = world.types.map(type => type.name);
  const named = [];
  const ids = [];
  const icons = [];

  // The id of a line is how Studio tells the lines of one list apart
  function checkId(entry, where) {
    const id = entry.id || entry.type;
    need(problems, ids.indexOf(id) === -1, where + ' has the id "' + id + '", which another line in the sidebar has too. Remove the repeated line, or, for lists of one type with a filter, give each line an id of its own.');
    ids.push(id);
  }

  // The icon is how the lines are told apart at a glance, so no two lines share one
  function checkIcon(entry, where) {
    need(problems, Boolean(entry.icon), where + ' has no icon. Import one from @sanity/icons and add icon: to the line.');
    need(problems, !entry.icon || icons.indexOf(entry.icon) === -1, where + ' has an icon that another line has too. Pick another one.');
    icons.push(entry.icon);
  }

  function checkLine(entry, line) {
    const where = line + ' ("' + entry.title + '")';
    if (!entry.title) problems.push(line + ' has no title');
    checkIcon(entry, where);
    if (typeNames.indexOf(entry.type) === -1) return problems.push(where + ' names the type "' + entry.type + '", and schemas/index.js has no type with that name. Fix the spelling or remove the line.');

    checkId(entry, where);
    named.push(entry.type);

    if (entry.kind === 'page') {
      need(problems, pageTypes.indexOf(entry.type) !== -1, where + ' is a page, but "' + entry.type + '" is not one of the pages that exist once: ' + pageTypes.join(', '));
      if (entry.type === 'screen') need(problems, screenPageIds.indexOf(entry.id) !== -1, where + ' should open one of the Screens: ' + screenPageIds.join(', ') + ', not ' + entry.id);
      else if (entry.type === 'view') need(problems, viewPageIds.indexOf(entry.id) !== -1, where + ' should open one of the Views: ' + viewPageIds.join(', ') + ', not ' + entry.id);
      else need(problems, entry.id === entry.type, where + ' should open the document with id ' + entry.type + ', not ' + entry.id);
      return;
    }

    need(problems, pageTypes.indexOf(entry.type) === -1, where + ' is a list, but "' + entry.type + '" exists once and should be a page');
    const field = entry.sort && entry.sort.field;
    const sortable = field && (field.charAt(0) === '_' || fieldsIn(typeByName(entry.type)).some(item => item.name === field));
    need(problems, sortable, where + ' is sorted by "' + field + '", which is not a field of ' + entry.type);
    if (listSort[entry.type]) need(problems, field === listSort[entry.type], where + ' should be listed by ' + listSort[entry.type] + ', not ' + field);

    if (entry.thenBy !== undefined) {
      const second = entry.thenBy.field;
      need(problems, second && (second.charAt(0) === '_' || fieldsIn(typeByName(entry.type)).some(item => item.name === second)), where + ' is then sorted by "' + second + '", which is not a field of ' + entry.type);
    }

    if (entry.filter !== undefined) {
      need(problems, typeof entry.filter === 'string' && /\$(since|now)\b/.test(entry.filter), where + ' has a filter that should use $since, the time a day ago, or $now, the time the sidebar opened. structure.js works both out when the sidebar opens');
      need(problems, !/now\s*\(/.test(String(entry.filter)), where + ' has a filter that uses now(). Studio keeps lists live and a live filter cannot use it. Use $since or $now.');
    }
  }

  // A page that is not a document: a title, an id and a plain function that draws it
  function checkComponent(entry, line) {
    const where = line + ' ("' + entry.title + '")';
    if (!entry.title) problems.push(line + ' has no title');
    need(problems, typeof entry.id === 'string' && entry.id !== '', where + ' needs an id');
    need(problems, typeof entry.component === 'function', where + ' needs a component, a plain function that draws the page');
    checkId(entry, where);
    checkIcon(entry, where);
  }

  // A folder: an id, an icon and lines. depth is 1 for a folder in the sidebar and 2 for one inside it.
  // A folder holds lists and pages, and at depth 1 one more folder, which holds lists or pages.
  function checkFolder(entry, line, depth) {
    const where = line + ' ("' + entry.title + '")';
    if (!entry.title) problems.push(line + ' has no title');
    need(problems, typeof entry.id === 'string' && entry.id !== '', where + ' needs an id');
    checkId(entry, where);
    checkIcon(entry, where);
    if (!Array.isArray(entry.entries) || entry.entries.length === 0) return problems.push(where + ' has no lines under entries');

    entry.entries.forEach((inner, position) => {
      const innerLine = where + ', line ' + (position + 1);
      if (inner.kind === 'group') {
        need(problems, depth === 1, innerLine + ' is a folder inside a folder inside a folder. Only one folder may sit inside another.');
        return checkFolder(inner, innerLine, depth + 1);
      }
      if (inner.kind === 'component') return checkComponent(inner, innerLine);
      if (inner.kind === 'divider') return need(problems, typeof inner.title === 'string' && inner.title !== '', innerLine + ' is a divider with no words. A divider inside a folder is one plain line that says what the folder is.');
      if (inner.kind !== 'page' && inner.kind !== 'list') return problems.push(innerLine + ' has the kind "' + inner.kind + '". A folder holds lists, pages, components and one more folder.');
      checkLine(inner, innerLine);
    });
  }

  entries.forEach((entry, index) => {
    const line = 'structure.js line ' + (index + 1) + ' of sidebarEntries';
    if (entry.kind === 'divider') return need(problems, typeof entry.title === 'string' && entry.title !== '', line + ' is a divider with no heading. Give it a title, such as TASKS.');
    if (entry.kind === 'component') return checkComponent(entry, line);
    if (entry.kind === 'group') return checkFolder(entry, line, 1);

    if (entry.kind !== 'list' && entry.kind !== 'page') return problems.push(line + ' has the kind "' + entry.kind + '". Use list, page, group, component or divider.');
    checkLine(entry, line);
  });

  world.types.filter(type => type.type === 'document').forEach(type => {
    const reason = notInSidebar[type.name];
    if (reason) return need(problems, named.indexOf(type.name) === -1, type.name + ' is listed in notInSidebar in tests/schemas.test.mjs ("' + reason + '") and also has a line in structure.js. Remove one of the two.');
    need(problems, named.indexOf(type.name) !== -1, 'the document type "' + type.name + '" (' + type.title + ') has no line in the sidebar. Add a line for it to sidebarEntries in studio/structure.js, or, if editors should not see it there, list it in notInSidebar in tests/schemas.test.mjs with the reason.');
  });

  Object.keys(sidebarTitles).forEach(typeName => {
    const entry = allLines(entries).filter(item => item.type === typeName)[0];
    need(problems, !entry || entry.title === sidebarTitles[typeName], 'the sidebar line for ' + typeName + ' should be titled ' + sidebarTitles[typeName] + ', not ' + (entry && entry.title));
  });
}

// The headings, the lines under each, the order, the folders, and Start here and Calendars
function checkSidebarGroups(problems) {
  const entries = world.structure.sidebarEntries;
  const shape = sidebarShape(entries);
  need(problems, shape.join('\n') === sidebarGroups.join('\n'), 'the sidebar should read, with a heading and then its lines:\n    ' + sidebarGroups.join('\n    ') + '\nstructure.js has:\n    ' + shape.join('\n    '));

  // Views, Daily Agenda, Monday Tasks and Old screens are the folders, and Presentations is the one folder inside a folder.
  // A heading is a divider, not a folder.
  const folders = entries.filter(entry => entry.kind === 'group');
  need(problems, folders.map(entry => entry.title).join() === Object.keys(folderLines).join(), 'The only folders in the sidebar should be ' + Object.keys(folderLines).join(' and ') + ', and the headings should be dividers with a title. The folders are: ' + (folders.map(entry => entry.title).join() || 'none'));
  folders.forEach(folder => {
    const want = folderLines[folder.title];
    if (want) need(problems, folderShape(folder.entries) === want, folder.title + ' should hold: ' + want + '. It holds: ' + folderShape(folder.entries));
    need(problems, (folder.add || []).join() === (folderAdds[folder.title] || ''), 'the plus button of ' + folder.title + ' should offer: ' + (folderAdds[folder.title] || 'nothing') + '. It offers: ' + ((folder.add || []).join() || 'nothing'));
  });
  need(problems, allLines(entries).filter(entry => entry.kind === 'group').length === 5, 'the sidebar should have five folders in all: Views, Daily Agenda, Presentations inside it, Monday Tasks and Old screens (not used)');

  ['Start here', 'Calendars'].forEach(title => {
    const entry = entries.filter(item => item.title === title)[0];
    need(problems, entry && entry.kind === 'component' && typeof entry.component === 'function', 'the sidebar should have a ' + title + ' line that opens a page drawn by a component');
  });
}

// The icons are files of the installed @sanity/icons. That package is only read when it is installed.
function checkIconFiles(problems) {
  const manifest = path.join(here, 'node_modules', '@sanity', 'icons', 'package.json');
  if (!fs.existsSync(manifest)) return;

  const files = JSON.parse(readModule(manifest, 'utf8')).exports || {};
  iconImportsOf(readModule(path.join(here, 'structure.js'), 'utf8')).forEach(icon => {
    need(problems, files['./' + icon[0]] !== undefined, 'structure.js imports @sanity/icons/' + icon[0] + ', and the installed @sanity/icons has no such file');
    need(problems, icon[1] === icon[0] + 'Icon', 'structure.js imports ' + icon[1] + ' from @sanity/icons/' + icon[0] + ', and that file holds ' + icon[0] + 'Icon');
  });
}

// What structure() built for one line has to match the line. For a group, its lines are checked the same way.
function checkBuiltItem(entry, item, what, problems) {
  const child = item.child && item.child.made;

  if (entry.kind === 'divider') {
    need(problems, item.divider === true, what + ' should be a divider');
    return need(problems, item.title === entry.title, what + ' should have the heading ' + entry.title + ', it has ' + item.title);
  }
  if (item.title !== entry.title) return problems.push(what + ' should be titled ' + entry.title + ', it is ' + item.title);
  need(problems, item.icon === entry.icon, what + ' should have the icon of its line');

  if (entry.kind === 'group') {
    const inside = ((child && child.items) || []).map(inner => inner.made);
    need(problems, child && child.id === entry.id && child.title === entry.title, what + ' should open a list titled ' + entry.title + ' with the id ' + entry.id);

    // the plus button of the folder: a create entry for each type of add, and a line in the folder where the new document is listed
    const offered = ((child && child.menuItems) || []).map(menu => menu.intent && menu.intent.type === 'create' && menu.intent.params.template);
    need(problems, offered.join() === (entry.add || []).join(), what + ' should offer a new ' + ((entry.add || []).join(' and a new ') || 'document of no type') + ' in its plus button. It offers: ' + (offered.join() || 'nothing'));
    (entry.add || []).forEach(name => {
      // a name is a type, or a template of add-templates.js that makes a document of a type
      const template = world.addTemplates.filter(item => item.id === name)[0];
      const type = template ? template.schemaType : name;
      need(problems, allLines(entry.entries).some(inner => inner.type === type), what + ' offers a new ' + type + ' but has no list of them');
      need(problems, pageTypes.indexOf(type) === -1 && notInSidebar[type] === undefined, what + ' offers a new ' + type + ', which is not a kind of document an editor adds here');
    });
    if (inside.length !== entry.entries.length) return problems.push(what + ' should open ' + entry.entries.length + ' lines, it opens ' + inside.length);
    entry.entries.forEach((inner, index) => checkBuiltItem(inner, inside[index], what + ', line ' + (index + 1) + ' ("' + inner.title + '")', problems));
  } else if (entry.kind === 'component') {
    const pageOk = child && child.component === entry.component && child.id === entry.id && child.title === entry.title;
    need(problems, pageOk, what + ' should open the page ' + entry.title + ', drawn by its component, with the id ' + entry.id);
    need(problems, item.id === entry.id, what + ' should have the id ' + entry.id + ', it has ' + item.id);
    // a page that links to a pane of its own (Monday Boards) is given the function that builds the pane
    need(problems, (typeof entry.children === 'function') === (child && typeof child.child === 'function'), what + (entry.children ? ' should give its page a function that builds the pane its links open' : ' should not give its page a pane to open'));
  } else if (entry.kind === 'list') {
    const listOk = child && child.type === entry.type && child.title === entry.title && child.defaultOrdering[0].field === entry.sort.field;
    need(problems, listOk, what + ' should open the ' + entry.type + ' list, titled ' + entry.title + ', sorted by ' + entry.sort.field);
    if (entry.thenBy && child) need(problems, child.defaultOrdering.length === 2 && child.defaultOrdering[1].field === entry.thenBy.field, what + ' should then sort by ' + entry.thenBy.field);
    need(problems, item.id === (entry.id || entry.type), what + ' should have the id ' + (entry.id || entry.type) + ', it has ' + item.id);

    if (entry.filter && child) {
      const aDay = 24 * 60 * 60 * 1000;
      const since = child.params && child.params.since;
      need(problems, typeof child.filter === 'string' && child.filter.indexOf(entry.filter) !== -1 && child.params && child.params.type === entry.type, what + ' should filter the ' + entry.type + ' list with: ' + entry.filter);
      need(problems, typeof since === 'string' && Math.abs(Date.now() - aDay - Date.parse(since)) < 60 * 1000, what + ' should pass $since as the time a day ago, worked out when the sidebar opens');
      const opened = child.params && child.params.now;
      need(problems, typeof opened === 'string' && Math.abs(Date.now() - Date.parse(opened)) < 60 * 1000, what + ' should pass $now as the time the sidebar opened');
      need(problems, child.id === (entry.id || entry.type) && typeof child.apiVersion === 'string', what + ' should give the filtered list its id and an apiVersion');
    }
  } else {
    const pageOk = child && child.schemaType === entry.type && child.documentId === entry.id;
    need(problems, pageOk, what + ' should open the one document with id ' + entry.id);
  }
}

function checkSidebar() {
  const problems = [];
  const entries = world.structure.sidebarEntries;
  if (!Array.isArray(entries) || entries.length === 0) return ['structure.js should export sidebarEntries, the one list that holds every line of the sidebar'];

  checkSidebarLines(problems);
  checkSidebarGroups(problems);
  checkIconFiles(problems);

  // What the Studio gets is those lines, in the same order, with the same sorting
  const items = world.structure.structure(fakeBuilder()).made.items.map(item => item.made);
  if (items.length !== entries.length) return problems.concat('structure() should make one sidebar item for each line of sidebarEntries (' + entries.length + '), it makes ' + items.length);

  entries.forEach((entry, index) => {
    checkBuiltItem(entry, items[index], 'sidebar line ' + (index + 1) + ' ("' + (entry.title || entry.kind) + '")', problems);
  });
  return problems;
}

// Every text an editor reads: the titles of the types and fields, the tabs, the
// descriptions, the words a list line shows when it has nothing to show, the
// messages of the rules and the sidebar. None may still use a title the sidebar
// had before, because an editor would look for a line that is not there.
function checkOldTitles() {
  const problems = [];
  const texts = [];
  const add = (where, text) => {
    if (typeof text === 'string') texts.push([where, text]);
  };

  world.types.forEach(type => {
    add(type.name + ' title', type.title);
    (type.groups || []).forEach(group => add(type.name + ' tab ' + group.name, group.title));
  });
  eachField((where, field) => {
    add(where + ' title', field.title);
    add(where + ' description', field.description);
    [field].concat(field.of || []).forEach(item => {
      try {
        constraintsOf(item).filter(rule => ['error', 'warning', 'info'].indexOf(rule.name) !== -1).forEach(rule => add(where + ' message', rule.args[0]));
      } catch (error) {
        // checkValidations reports a rule that does not run
      }
    });
  });
  eachPreview((where, preview) => {
    try {
      const shown = typeof preview.prepare === 'function' ? preview.prepare({}) : {};
      add(where + ' list line', shown.title);
      add(where + ' list line', shown.subtitle);
    } catch (error) {
      // a preview that needs its fields is checked with the others
    }
  });
  allLines(world.structure.sidebarEntries).forEach(entry => add('the sidebar', entry.title));

  texts.forEach(text => oldTitles.forEach(old => {
    const hit = text[1].match(old.words);
    need(problems, !hit, text[0] + ' says "' + (hit && hit[0]) + '". The sidebar calls it ' + old.now + ' now, not ' + old.was + '.');
  }));

  // The title of a type is the word of the sidebar for one document, which the New menu and the plus button show
  Object.keys(typeTitles).forEach(name => {
    const type = typeByName(name);
    need(problems, type && type.title === typeTitles[name], 'the type ' + name + ' should be titled ' + typeTitles[name] + ', not ' + (type && type.title));
  });

  // The title of a type or a line is never one the sidebar used to have
  const oldNames = ['Subteams', 'Subteam', 'Roster', 'Locations', 'Up Next', 'Custom Panels', 'Custom Panel', 'Theme', 'Test the screen'];
  world.types.forEach(type => need(problems, oldNames.indexOf(type.title) === -1, 'the type ' + type.name + ' is still titled ' + type.title));
  allLines(world.structure.sidebarEntries).forEach(entry => need(problems, oldNames.indexOf(entry.title) === -1, 'the sidebar still has a line titled ' + entry.title));
  return problems;
}

function checkSettingsPage() {
  const problems = [];
  // The buttons are added to the settings page after the ones Studio keeps
  const actions = ['publish', 'discardChanges', 'delete', 'duplicate', 'unpublish'].map(action => ({ action: action }));
  const kept = world.config.document.actions(actions, { schemaType: 'dashboardSettings' }).map(item => item.action).join();
  const others = world.config.document.actions(actions, { schemaType: 'task' }).length;
  const wanted = 'publish,discardChanges,playDesktop,playRedEyes,playAnnouncements,runPresentationTest,previewPrime,previewNova,previewCybertron,previewMinimal,previewNextPack';
  if (kept !== wanted) problems.push('the settings page should have these actions: ' + wanted + '. It has: ' + kept);
  if (others !== actions.length) problems.push('other types should keep every action');

  // The Look page is made the same way: nothing that copies it or takes it away, and no buttons of its own
  const themeActions = world.config.document.actions(actions, { schemaType: 'theme' }).map(item => item.action).join();
  if (themeActions !== 'publish,discardChanges') problems.push('the Look page should have these actions: publish,discardChanges. It has: ' + themeActions);

  // The Demo page is the same, and has no buttons of its own: the Start here page has the ones that try the screen
  const demoActions = world.config.document.actions(actions, { schemaType: 'demo' }).map(item => item.action).join();
  if (demoActions !== 'publish,discardChanges') problems.push('the Demo page should have these actions: publish,discardChanges. It has: ' + demoActions);

  // The New menu in the top bar offers the types an editor adds, and not the pages that exist once, the
  // status document that the Teletraan computer writes, the tasks that the computer makes or the types with no line in the
  // sidebar. A place is still offered while a document is open, which is where the Location field of a task
  // has Create new.
  const templates = ['task', 'plan', 'presentation', 'dashboardSettings', 'theme', 'demo', 'status', 'calendarStatus', 'frcStatus', 'mondayStatus', 'extraEvent', 'place'].map(name => ({ templateId: name }));
  const offeredIn = creationContext => world.config.document.newDocumentOptions(templates, creationContext === undefined ? {} : { creationContext: creationContext }).map(item => item.templateId).join();
  const menu = 'plan,presentation';
  if (offeredIn(undefined) !== menu) problems.push('the New menu should offer: ' + menu + '. It offers: ' + offeredIn(undefined));
  if (offeredIn({ type: 'global' }) !== menu) problems.push('the New menu in the top bar should offer: ' + menu + '. It offers: ' + offeredIn({ type: 'global' }));
  if (offeredIn({ type: 'structure', schemaType: 'task' }) !== menu) problems.push('the plus button of a list should offer: ' + menu + '. It offers: ' + offeredIn({ type: 'structure', schemaType: 'task' }));
  const inField = offeredIn({ type: 'document', documentId: 'task-1', schemaType: 'task' });
  if (inField !== 'plan,presentation,place') problems.push('a reference field should be able to create a place, and nothing is changed for the other types. It offers: ' + inField);

  const named = world.structure.settingsType === 'dashboardSettings' && world.structure.settingsId === 'dashboardSettings';
  need(problems, named, 'structure.js should name the settings type and id dashboardSettings');
  const themeNamed = world.structure.themeType === 'theme' && world.structure.themeId === 'theme';
  need(problems, themeNamed, 'structure.js should name the theme type and id theme');
  const demoNamed = world.structure.demoType === 'demo' && world.structure.demoId === 'demo';
  need(problems, demoNamed, 'structure.js should name the demo type and id demo');
  need(problems, world.structure.singletonTypes.join() === 'dashboardSettings,theme,demo', 'structure.js should list the pages that exist once: dashboardSettings, theme, demo');
  if (world.config.schema.types.length !== world.types.length) problems.push('sanity.config.js does not use every schema');
  const agree = world.cli.api.projectId === world.config.projectId && world.cli.api.dataset === world.config.dataset;
  need(problems, agree, 'sanity.cli.js and sanity.config.js disagree about the project');

  // The Studio and the dashboard must talk about the same project and dataset
  const screen = world.dashboard.sanity;
  need(problems, /^[a-z0-9]{8,}$/.test(world.config.projectId), 'project.js should hold the Sanity project ID, lowercase letters and digits');
  need(problems, screen.projectId === world.config.projectId, 'dashboard/config.js has project ID "' + screen.projectId + '" but project.js has "' + world.config.projectId + '"');
  need(problems, screen.dataset === world.config.dataset, 'dashboard/config.js has dataset "' + screen.dataset + '" but project.js has "' + world.config.dataset + '"');
  return problems;
}

// The Photo type and the photo settings. A photo has a picture (required, images
// only, crop and hotspot on, checked with the contract above), an optional
// short caption, a credit that is a first name only, a show switch and an
// optional expiry, and no approval field. The settings have the order and the seconds
// per photo, with the names, limits and starting values of config.js, and the
// sample content has a photo list the Photo panel can show.
function checkPhotos() {
  const problems = [];
  const config = world.dashboard;
  const at = name => fieldAt('photo.' + name);
  const setting = name => fieldAt('dashboardSettings.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const type = typeByName('photo');

  need(problems, type && type.title === 'Photo', 'the photo type should be titled Photo');
  need(problems, at('image') && constraintNamed(rulesOf(at('image')), 'required'), 'photo.image should be required');
  need(problems, at('image') && at('image').title === 'Picture', 'photo.image should be titled Picture');

  // The caption and the credit are optional
  ['caption', 'credit'].forEach(name => {
    need(problems, at(name) && !constraintNamed(rulesOf(at(name)), 'required'), 'photo.' + name + ' should be optional');
    need(problems, at(name) && /optional/i.test(at(name).description || ''), 'the photo.' + name + ' description should say it is optional');
  });
  need(problems, at('caption') && /last name/i.test(at('caption').description || ''), 'the photo.caption description should say no last names');

  // The credit is a first name: a space or a digit is refused with a message, a hyphen is fine
  const custom = constraintNamed(rulesOf(at('credit')), 'custom');
  if (!custom) {
    problems.push('photo.credit should be checked so that it is a first name only');
  } else {
    const run = custom.args[0];
    ['Sam', 'Mary-Anne', "O'Neil", 'Zoë', '', undefined].forEach(good => need(problems, run(good) === true, 'the credit check refuses "' + good + '"'));
    ['Sam Smith', 'Sam2', '7', ' Sam', 'Sam '].forEach(bad => {
      const answer = run(bad);
      need(problems, typeof answer === 'string' && answer.length > 0, 'the credit check accepts "' + bad + '"');
    });
  }
  need(problems, at('credit') && /first name/i.test(at('credit').description || ''), 'the photo.credit description should say first name');

  // No approval of any kind: the show switch and the expiry date are the only controls
  const names = fieldsIn(type || {}).map(field => field.name);
  need(problems, !names.some(name => /approv|status|review/i.test(name)), 'a photo should have no approval field, not ' + names.join(', '));

  const newest = (type.orderings || []).some(item => item.by && item.by[0].field === '_createdAt' && item.by[0].direction === 'desc');
  need(problems, newest, 'photo needs an ordering by _createdAt, newest first');
  need(problems, type.preview && type.preview.select && type.preview.select.media === 'image', 'the photo list should show each picture (select media: image)');

  // The photo settings come in this order
  const settings = typeByName('dashboardSettings');
  const inOrder = fieldsIn(settings).map(field => field.name).filter(name => photoNames.indexOf(name) !== -1);
  need(problems, inOrder.join() === photoNames.join(), 'the photo settings should come in this order: ' + photoNames.join(', ') + ', not ' + inOrder.join(', '));
  need(problems, setting('photoOrder') && setting('photoOrder').title === 'Photo order', 'photoOrder should be titled Photo order');
  need(problems, setting('photoSeconds') && setting('photoSeconds').title === 'Seconds per photo', 'photoSeconds should be titled Seconds per photo');
  need(problems, setting('portraitScale') && setting('portraitScale').title === 'Portrait size, percent', 'portraitScale should be titled Portrait size, percent');
  need(problems, setting('photoScale') && setting('photoScale').title === 'Photo size, percent', 'photoScale should be titled Photo size, percent');

  // The Photo size is hidden, because a photo fills the panel: it stays in the schema with its limits and its starting
  // value, so what was saved in it stays, and it is not required, because nobody can fill in a hidden field.
  // The portrait sizes have their own range and words, in checkPortraitSettings.
  ['photoScale'].forEach(name => {
    const words = setting(name) ? setting(name).description || '' : '';
    need(problems, setting(name) && setting(name).hidden === true, name + ' should be hidden but stay in the schema');
    need(problems, !constraintNamed(rulesOf(setting(name)), 'required'), name + ' should not be required: nobody can fill in a hidden field');
    need(problems, words.length > 0 && words.indexOf('\n') === -1 && /Not used any more/.test(words), name + ' needs a one-line description that says it is not used any more');
    need(problems, config.limits[name] && config.limits[name].min === 60 && config.limits[name].max === 100, 'limits.' + name + ' in config.js should be 60 to 100');
    need(problems, config.defaultSettings[name] === 100, 'the default ' + name + ' in config.js should be 100');
    need(problems, world.sample.settings[name] === 100, 'the sample settings need ' + name + ' of 100');
  });

  // The order is a radio list of the names in config.js, required, and random to start with
  const order = setting('photoOrder');
  const orderRules = rulesOf(order);
  const allowed = constraintNamed(orderRules, 'valid');
  need(problems, config.photoOrders.join() === 'random,newest-first', 'photoOrders in config.js should be random and newest-first, not ' + config.photoOrders.join());
  need(problems, order && order.options && order.options.layout === 'radio', 'photoOrder should be a radio list');
  need(problems, choicesOf('dashboardSettings.photoOrder').map(item => item.value).join() === config.photoOrders.join(), 'photoOrder should offer the names in config.js: ' + config.photoOrders.join(', '));
  need(problems, constraintNamed(orderRules, 'required'), 'photoOrder should be required');
  need(problems, allowed && allowed.args[0].join() === config.photoOrders.join(), 'photoOrder should only allow: ' + config.photoOrders.join(', '));
  need(problems, config.defaultSettings.photoOrder === 'random', 'the default photoOrder in config.js should be random');

  // Seconds per photo is not used any more: a Photos row of a Screen has its own photos and seconds each
  need(problems, setting('photoSeconds') && setting('photoSeconds').hidden === true && /^Not used any more\./.test(setting('photoSeconds').description || ''), 'the photoSeconds field should be hidden, with a description that starts Not used any more.');

  // The sample content carries the settings and a list of photos with addresses
  const sample = world.sample;
  need(problems, config.photoOrders.indexOf(sample.settings.photoOrder) !== -1, 'the sample settings need a photoOrder of ' + config.photoOrders.join(' or '));
  const limit = config.limits.photoSeconds;
  need(problems, sample.settings.photoSeconds >= limit.min && sample.settings.photoSeconds <= limit.max, 'the sample settings need photoSeconds from ' + limit.min + ' to ' + limit.max);
  need(problems, Array.isArray(sample.photos) && sample.photos.length > 0, 'the sample content needs a photos list for the Photo panel');
  (sample.photos || []).forEach((photo, index) => {
    need(problems, typeof photo.address === 'string' && photo.address.length > 0, 'sample photo ' + (index + 1) + ' needs an address');
    Object.keys(photo).forEach(key => need(problems, ['address', 'caption', 'credit', 'fit', 'size'].indexOf(key) !== -1, 'sample photo ' + (index + 1) + ' has ' + key + ', which the sample photos do not use'));
  });
  return problems;
}

// The members of a subteam are first names for the Subteam roster panel. Each
// one is needed, has no digits and stops at 12 characters, the list stops at
// 24 and refuses the same name twice in any capitals, and it starts empty.
// The sample subteams have to follow the same rules.
function checkSubteamMembers() {
  const problems = [];
  const field = fieldAt('subteam.members');
  if (!field) return ['subteam.members is missing'];

  const member = field.of && field.of[0];
  const eachRules = member ? constraintsOf(member) : [];
  const listRules = constraintsOf(field);
  const eachCheck = constraintNamed(eachRules, 'custom');
  const listCheck = constraintNamed(listRules, 'custom');

  need(problems, constraintNamed(eachRules, 'required'), 'each member should be required, so an empty line is refused');
  need(problems, Array.isArray(field.initialValue) && field.initialValue.length === 0, 'subteam.members should start as an empty list');
  need(problems, /first names/i.test(field.description || ''), 'the subteam.members description should say first names only');
  need(problems, /drag/i.test(field.description || ''), 'the subteam.members description should say that the order can be changed by dragging');
  need(problems, constraintNamed(listRules, 'required') === undefined, 'subteam.members should be optional');

  if (!eachCheck) {
    problems.push('each member should be checked: no digits, and not only spaces');
  } else {
    const run = eachCheck.args[0];
    ['Sam', 'Mary Anne', "O'Neil", 'Zoë', 'Sam K.', '[Student A]'].forEach(good => need(problems, run(good) === true, 'the member check refuses "' + good + '"'));
    ['Sam2', '7', '   ', ''].forEach(bad => need(problems, typeof run(bad) === 'string' && run(bad).length > 0, 'the member check accepts "' + bad + '"'));
  }

  if (!listCheck) {
    problems.push('the list of members should be checked for the same name twice');
  } else {
    const run = listCheck.args[0];
    [undefined, [], ['Sam'], ['Sam', 'Alex'], ['Sam', '', 'Alex']].forEach(good => need(problems, run(good) === true, 'the repeat check refuses ' + JSON.stringify(good)));
    [['Sam', 'sam'], ['Sam', ' SAM '], ['Alex', 'Sam', 'alex']].forEach(bad => need(problems, typeof run(bad) === 'string' && run(bad).length > 0, 'the repeat check accepts ' + JSON.stringify(bad)));
  }

  // The list in the Studio shows how many members a subteam has
  const preview = typeByName('subteam').preview;
  need(problems, preview.select.members === 'members', 'the subteam list should select the members');
  need(problems, preview.prepare({ title: 'Build', members: ['a', 'b', 'c'] }).subtitle.indexOf('3 members') !== -1, 'the subteam list should say how many members');
  need(problems, preview.prepare({ title: 'Build', members: ['a'] }).subtitle.indexOf('1 member') !== -1, 'the subteam list should say 1 member');
  need(problems, preview.prepare({ title: 'Build', members: [] }).subtitle.indexOf('member') === -1, 'the subteam list should not mention members when there are none');

  // The sample content follows the same rules as the Studio
  world.sample.subteams.forEach(subteam => {
    const names = subteam.members || [];
    need(problems, names.length <= 24, 'sample subteam ' + subteam.name + ' has more than 24 members');
    names.forEach(name => need(problems, name.length <= 12 && (!eachCheck || eachCheck.args[0](name) === true), 'sample member ' + name + ' breaks the Members rules'));
    need(problems, !listCheck || listCheck.args[0](names) === true, 'sample subteam ' + subteam.name + ' has the same member twice');
  });
  return problems;
}

// A person's photo and its switch. The photo is optional, its description has
// the advice for the people who upload, the switch starts at the value
// defaultPerson has in config.js, and the sample people have no photos.
function checkPersonPhoto() {
  const problems = [];
  const photo = fieldAt('person.photo');
  const shown = fieldAt('person.showPhoto');
  const words = photo ? (photo.description || '').toLowerCase() : '';
  const defaultPerson = world.dashboard.defaultPerson || {};

  need(problems, photo && photo.title === 'Photo', 'person.photo should be titled Photo');
  need(problems, photo && !constraintNamed(constraintsOf(photo), 'required'), 'person.photo should be optional, so a person can have no photo');
  ['square', 'plain background', 'first name'].forEach(advice => {
    need(problems, words.indexOf(advice) !== -1, 'the person.photo description should say "' + advice + '"');
  });

  need(problems, shown && shown.type === 'boolean' && shown.title === 'Show photo on screen', 'person.showPhoto should be a switch titled Show photo on screen');
  need(problems, shown && shown.initialValue === true, 'person.showPhoto should start on');
  need(problems, shown && defaultPerson.showPhoto === shown.initialValue, 'defaultPerson.showPhoto in config.js should be the same as the starting value of person.showPhoto');

  const preview = typeByName('person').preview;
  need(problems, preview && preview.select && preview.select.media === 'photo', 'the person list should show each photo (select media: photo)');
  need(problems, world.sample.people.every(person => person.photo === undefined), 'the sample people should have no photo, so the sample shows silhouettes');
  return problems;
}

// A team lead's photo and its switch, the same as a person's. The photo is optional and sits right
// after the lead, the switch starts at the value defaultPerson has in config.js, the list shows each
// photo, and the dashboard asks Sanity for the photo the way it does for a person.
function checkLeadPhoto() {
  const problems = [];
  const photo = fieldAt('subteam.photo');
  const shown = fieldAt('subteam.showPhoto');
  const words = photo ? (photo.description || '').toLowerCase() : '';
  const defaultPerson = world.dashboard.defaultPerson || {};
  const names = fieldsIn(typeByName('subteam')).map(field => field.name);

  need(problems, photo && photo.type === 'image' && photo.title === 'Photo', 'subteam.photo should be a picture titled Photo');
  need(problems, photo && !constraintNamed(constraintsOf(photo), 'required'), 'subteam.photo should be optional, so a team lead can have no photo');
  ['square', 'plain background', 'first name'].forEach(advice => {
    need(problems, words.indexOf(advice) !== -1, 'the subteam.photo description should say "' + advice + '"');
  });
  need(problems, shown && shown.type === 'boolean' && shown.title === 'Show photo on screen', 'subteam.showPhoto should be a switch titled Show photo on screen');
  need(problems, shown && shown.initialValue === true, 'subteam.showPhoto should start on');
  need(problems, shown && defaultPerson.showPhoto === shown.initialValue, 'defaultPerson.showPhoto in config.js should be the same as the starting value of subteam.showPhoto');
  need(problems, names.indexOf('lead') !== -1 && names[names.indexOf('lead') + 1] === 'photo' && names[names.indexOf('lead') + 2] === 'showPhoto', 'subteam.photo and subteam.showPhoto should come right after subteam.lead, not ' + names.join(', '));

  const preview = typeByName('subteam').preview;
  need(problems, preview && preview.select && preview.select.media === 'photo', 'the team lead list should show each photo (select media: photo)');
  need(problems, preview && preview.prepare({ title: 'Build', lead: 'Sam', media: 'picture' }).media === 'picture', 'the team lead list should hand the photo over as its media');

  // The dashboard asks for the photo of a team lead the way it asks for the photo of a person
  const query = world.sanitySource.split('"subteams":')[1].split('"people":')[0];
  ['"photo": photo {', '"url": asset->url', 'asset->metadata.dimensions.width', 'asset->metadata.dimensions.height', 'crop', 'hotspot'].forEach(piece => {
    need(problems, query.indexOf(piece) !== -1, 'the subteams part of the content query in dashboard/core/sanity.js should ask for ' + piece);
  });
  need(problems, world.sample.subteams.every(subteam => subteam.photo === undefined), 'the sample team leads should have no photo, so the sample shows silhouettes');
  return problems;
}

// The Portraits box of the Screen tab: two sizes, a shape and a frame. A size is a whole percent from 60
// to 220 that starts at 100, and is not required, so Dashboard Settings published before it can still be
// published. The descriptions give the people a page holds at each size, and those numbers are worked
// out here from rowLayout in core/portrait.js, so the words cannot drift from the screen. The old
// portraitScale stays, hidden, and the screen reads it only while neither size is saved.
function checkPortraitSettings() {
  const problems = [];
  const config = world.dashboard;
  const rows = percent => world.portrait.rowLayout(percent).rows;
  const sizes = ['leadershipPortrait', 'rosterPortrait'];
  const old = fieldAt('dashboardSettings.portraitScale');

  need(problems, old && old.hidden === true, 'portraitScale should be hidden but stay in the schema, so that a saved value is kept');
  need(problems, config.limits.portraitScale && config.limits.portraitScale.min === 60 && config.limits.portraitScale.max === 200, 'limits.portraitScale in config.js should stay 60 to 200');
  need(problems, config.defaultSettings.portraitScale === 100 && world.sample.settings.portraitScale === 100, 'portraitScale should still be 100 in config.js and in the sample settings');
  need(problems, old && /neither/.test(old.description || ''), 'the portraitScale description should say that it is used only while neither new size has a value');
  need(problems, config.limits.photoScale && config.limits.photoScale.max === 100, 'limits.photoScale in config.js should stay 60 to 100');

  // The steps of the table, worked out for every size: the largest percent that still holds each number of people
  const steps = [];
  for (let percent = config.limits.leadershipPortrait.min; percent <= config.limits.leadershipPortrait.max; percent++) {
    const last = steps[steps.length - 1];
    if (last && last.rows === rows(percent)) last.upTo = percent;
    else steps.push({ rows: rows(percent), upTo: percent });
  }
  const table = steps.map(step => step.rows + ' up to ' + step.upTo).join(', ') + '.';
  need(problems, steps.map(step => step.rows).join() === '4,3,2,1', 'a page should hold 4, then 3, 2 and 1 rows as the size grows, not ' + steps.map(step => step.rows).join());

  sizes.forEach(name => {
    const field = fieldAt('dashboardSettings.' + name);
    const words = field ? field.description || '' : '';
    const rules = field ? constraintsOf(field) : [];
    const low = constraintNamed(rules, 'min');
    const high = constraintNamed(rules, 'max');
    const limit = config.limits[name];

    need(problems, field && field.type === 'number' && field.group === 'screen' && field.fieldset === 'portraits', name + ' should be a number in the Portraits box of the Screen tab');
    need(problems, limit && limit.min === 60 && limit.max === 220, 'limits.' + name + ' in config.js should be 60 to 220');
    need(problems, config.defaultSettings[name] === 100, 'the default ' + name + ' in config.js should be 100');
    need(problems, world.sample.settings[name] === 100, 'the sample settings need ' + name + ' of 100');
    need(problems, field && field.initialValue === 100, name + ' should start at 100');
    need(problems, low && high && low.args[0] === 60 && high.args[0] === 220 && !!constraintNamed(rules, 'integer'), name + ' should be a whole number from 60 to 220');
    need(problems, !constraintNamed(rules, 'required'), name + ' should not be required: Dashboard Settings saved before it existed has none');
    need(problems, words.length > 0 && words.indexOf('\n') === -1, name + ' needs a one-line description');
    need(problems, /60 to 220/.test(words) && /100 fills a row of four/.test(words), 'the ' + name + ' description should give the range, 60 to 220, and say that 100 fills a row of four');
    need(problems, words.indexOf('People per page on ') !== -1 && words.indexOf(table) !== -1, 'the ' + name + ' description should give the people a page holds, as rowLayout works them out: ' + table);
  });
  need(problems, /Leadership/.test((fieldAt('dashboardSettings.leadershipPortrait') || {}).description || ''), 'the leadershipPortrait description should say that it is for Leadership');
  need(problems, /Team leads/.test((fieldAt('dashboardSettings.rosterPortrait') || {}).description || '') && /Roster portrait stays at 100/.test((fieldAt('dashboardSettings.rosterPortrait') || {}).description || ''), 'the rosterPortrait description should say that it is for Team leads and that the Roster portrait stays at 100');

  // The shape and the frame: a radio list of the names in config.js, starting at the first, not required
  [['portraitShape', config.portraitShapes, 'portraitShapes', 'square'], ['portraitFrame', config.portraitFrames, 'portraitFrames', 'metal']].forEach(([name, list, listName, first]) => {
    const field = fieldAt('dashboardSettings.' + name);
    const rules = field ? constraintsOf(field) : [];
    const allowed = constraintNamed(rules, 'valid');
    const words = field ? field.description || '' : '';

    need(problems, field && field.type === 'string' && field.group === 'screen' && field.fieldset === 'portraits', name + ' should be a string in the Portraits box of the Screen tab');
    need(problems, field && field.options && field.options.layout === 'radio', name + ' should be a radio list');
    need(problems, choicesOf('dashboardSettings.' + name).map(item => item.value).join() === list.join(), name + ' should offer the names in config.js: ' + list.join(', '));
    need(problems, allowed && allowed.args[0].join() === list.join(), name + ' should only allow: ' + list.join(', '));
    need(problems, !constraintNamed(rules, 'required'), name + ' should not be required: Dashboard Settings saved before it existed has none');
    need(problems, field && field.initialValue === first && config.defaultSettings[name] === first, name + ' should start as ' + first + ', here and in config.js');
    need(problems, world.sample.settings[name] === first, 'the sample settings need ' + name + ' of ' + first);
    need(problems, words.length > 0 && words.indexOf('\n') === -1 && /same on all three panels/.test(words), name + ' needs a one-line description that says it is the same on all three panels');
    need(problems, rules.some(rule => rule.name === 'error' && rule.args[0]), name + ' has rules and no error message in plain words');
    need(problems, Array.isArray(config[listName]) && config[listName][0] === first, listName + ' in config.js should start with ' + first);
  });

  // The box itself, and the order of the fields: the two sizes, then the shape, then the frame
  const settings = typeByName('dashboardSettings');
  need(problems, (settings.fieldsets || []).some(set => set.name === 'portraits' && set.title === 'Portraits'), 'Dashboard Settings should have a Portraits box (a fieldset called portraits)');
  const inBox = fieldsIn(settings).filter(field => field.fieldset === 'portraits').map(field => field.name);
  need(problems, inBox.join() === 'leadershipPortrait,rosterPortrait,portraitShape,portraitFrame', 'the Portraits box should hold leadershipPortrait, rosterPortrait, portraitShape and portraitFrame, in that order, not ' + inBox.join());
  return problems;
}

// The rows of Leadership and Team leads: a line under the name (person.line and subteam.line, up to 48
// characters). Each is optional and has no starting value, so what is saved before they existed stays as
// it is. The chip of a Leadership row is the Role (person.title, required), and the
// sample people and team leads have a line.
function checkPersonRows() {
  const problems = [];
  const leadership = world.leadershipModule;
  const personNames = fieldsIn(typeByName('person')).map(field => field.name);
  const checkLine = (pathText, wanted) => {
    const field = fieldAt(pathText);
    const words = field ? field.description || '' : '';

    need(problems, field && field.type === 'string' && !constraintNamed(constraintsOf(field), 'required') && field.initialValue === undefined, pathText + ' should be an optional string with no starting value');
    need(problems, words.indexOf('One short line under ') === 0 && words.indexOf(wanted) !== -1, pathText + ' should say it is one short line under the name or the role and ' + wanted);
  };

  checkLine('person.line', 'Leave blank to hide.');
  checkLine('subteam.line', 'Leave blank to show the subteam name.');
  need(problems, /3 people or fewer/.test((fieldAt('person.line') || {}).description || '') && /3 people or fewer/.test((fieldAt('subteam.line') || {}).description || ''), 'the line descriptions should say that it shows on pages of 3 people or fewer, because a row of four has no room for it');
  need(problems, personNames.indexOf('line') === personNames.indexOf('title') + 1, 'person.line should come right after person.title, not ' + personNames.join(', '));

  need(problems, personNames.indexOf('group') === -1, 'person.group should be gone from the schema: no document held a value');

  // The chip is the Role: person.title, required, with the words given
  const role = fieldAt('person.title');
  const roleRules = role ? constraintsOf(role) : [];
  const roleHelp = 'Shown in the chip at the right of the row, for example Coach, Co-President, Mentor, Parent. Up to 22 characters fit.';
  need(problems, role && role.title === 'Role' && role.type === 'string', 'person.title should be titled Role');
  need(problems, role && role.description === roleHelp, 'the person.title description should be: ' + roleHelp);
  need(problems, constraintNamed(roleRules, 'required') && messageAfter(roleRules, 'required') === roleHelp, 'person.title should be required, with the description as its message');
  need(problems, constraintNamed(roleRules, 'max') && constraintNamed(roleRules, 'max').args[0] === 22, 'person.title should allow up to 22 characters');
  const listedWith = fieldAt('person.role');
  need(problems, listedWith && listedWith.title !== 'Role' && constraintNamed(constraintsOf(listedWith), 'required'), 'person.role should be required and not titled Role, because the field titled Role is person.title');

  // The chip is the Role in capitals, and an entry with no Role shows its role
  need(problems, leadership.chipOf({ role: 'Captain', title: 'Co-President' }) === 'CO-PRESIDENT', 'a person with the Role Co-President should have the chip CO-PRESIDENT');
  [['Coach', 'COACH'], ['Mentor', 'MENTOR'], ['Captain', 'CAPTAIN'], ['Head Coach', 'HEAD COACH']].forEach(([roleText, chip]) => {
    need(problems, leadership.chipOf({ role: roleText }) === chip, 'a person with the role "' + roleText + '" and no Role should have the chip ' + chip);
  });
  need(problems, leadership.chipOf({ role: 'Coach', group: 'MENTOR' }) === 'COACH', 'the group should not change the chip');

  world.sample.people.forEach(person => need(problems, typeof person.line === 'string' && person.line.length > 0 && person.line.length <= 48, 'every sample person should have a line of up to 48 characters, ' + person.name + ' has none'));
  world.sample.people.forEach(person => need(problems, typeof person.title === 'string' && person.title.length > 0 && person.title.length <= 22, 'every sample person should have a Role of up to 22 characters, ' + person.name + ' has none'));
  need(problems, ['Mentor', 'Parent'].every(word => world.sample.people.some(person => person.title === word)), 'the sample people should have a Mentor and a Parent');
  world.sample.subteams.forEach(subteam => need(problems, typeof subteam.line === 'string' && subteam.line.length > 0 && subteam.line.length <= 48, 'every sample team lead should have a line of up to 48 characters, ' + subteam.name + ' has none'));
  return problems;
}

// The lists of themes and overlays, one entry at a time. The Studio's copy
// (themes.js) must say the same as the dashboard's registries, because the
// editors pick from the Studio's list and the screen looks the ids up in its own.
function sameRegistry(name, dashboardList, studioList, problems) {
  need(problems, studioList.length === dashboardList.length, 'studio/inputs/themes.js has ' + studioList.length + ' ' + name + ' and the dashboard registry has ' + dashboardList.length);

  dashboardList.forEach((entry, index) => {
    const copy = studioList[index];
    if (!copy) return problems.push('studio/inputs/themes.js is missing the ' + name + ' "' + entry.id + '"');

    // decorations is on the overlays only: whether the pack has a file in dashboard/seasons/
    const keys = ['id', 'name', 'description'].concat(name === 'overlays' ? ['decorations'] : []);
    keys.forEach(key => {
      if (copy[key] !== entry[key]) problems.push('the ' + name + ' number ' + (index + 1) + ' has ' + key + ' "' + copy[key] + '" in studio/inputs/themes.js but "' + entry[key] + '" in the dashboard registry');
    });

    // layout is on the themes only, and a theme that says nothing has the standard layout (dashboard/core/layout.js)
    if (name === 'themes') {
      const layoutOf = item => (item.layout === undefined ? world.layoutModule.defaultLayout : item.layout);
      if (layoutOf(copy) !== layoutOf(entry)) problems.push('the themes number ' + (index + 1) + ' has layout "' + layoutOf(copy) + '" in studio/inputs/themes.js but "' + layoutOf(entry) + '" in the dashboard registry');
      need(problems, world.layoutModule.isLayout(layoutOf(entry)), 'the theme "' + entry.id + '" has the layout "' + layoutOf(entry) + '", which is not one of: ' + world.layoutModule.layouts.join(', '));
      if (layoutOf(entry) === 'sidebar') {
        need(problems, /sidebar/i.test(copy.description || '') && /no small frame/i.test(copy.description || ''), 'the Studio description of the theme "' + entry.id + '" should say it has a sidebar and no small frame, so editors know what they are picking');
      }
    }
  });
}

function checkThemeLists() {
  const problems = [];
  sameRegistry('themes', world.themeRegistry.themes, world.studioThemes.themes, problems);
  sameRegistry('overlays', world.overlayRegistry.overlays, world.studioThemes.overlays, problems);

  // What the editors are offered is the dashboard's list, in the same order, in plain words
  const themeIds = world.themeRegistry.themes.map(entry => entry.id);
  const overlayIds = world.overlayRegistry.overlays.map(entry => entry.id);
  const lists = [
    ['theme.defaultTheme', themeIds],
    ['theme.useNow.theme', themeIds],
    ['theme.useNow.overlay', overlayIds.concat('none')],
    ['theme.schedule.theme', themeIds],
    ['theme.schedule.overlay', overlayIds],
    ['theme.schedule.kind', ['theme', 'overlay']],
    ['theme.schedule.cornerArt', world.cornerArt.cornerArtChoices],
  ];
  lists.forEach(entry => {
    const list = choicesOf(entry[0]);
    if (list.map(item => item.value).join() !== entry[1].join()) problems.push(entry[0] + ' should offer: ' + entry[1].join(', '));
    list.forEach(item => need(problems, isPlainTitle(item), entry[0] + ': "' + item.title + '" is not a plain-words title'));
  });

  const shown = choicesOf('theme.defaultTheme').map(item => item.title).join();
  need(problems, shown === world.themeRegistry.themes.map(entry => entry.name).join(), 'theme.defaultTheme should show the names in the dashboard registry');

  // The editors see an overlay as a seasonal pack, which also brings decorations. The stored values stay as they are.
  world.overlayRegistry.overlays.forEach(entry => need(problems, typeof entry.decorations === 'boolean', 'the overlay "' + entry.id + '" should say decorations: true or false in its registry entry'));
  const packKind = choicesOf('theme.schedule.kind').filter(item => item.value === 'overlay')[0];
  need(problems, packKind && packKind.title === 'Seasonal pack', 'the schedule kind stored as overlay should be shown as Seasonal pack');
  ['theme.schedule.kind', 'theme.schedule.overlay', 'theme.useNow.overlay'].forEach(name => {
    const field = fieldAt(name);
    need(problems, field && /decoration/i.test(field.description || ''), name + ' should say in its description that a seasonal pack also adds decorations');
  });
  need(problems, fieldAt('theme.schedule.overlay') && fieldAt('theme.schedule.overlay').title === 'Seasonal pack', 'theme.schedule.overlay should be titled Seasonal pack');
  need(problems, fieldAt('theme.useNow.overlay') && fieldAt('theme.useNow.overlay').title === 'Seasonal pack', 'theme.useNow.overlay should be titled Seasonal pack');
  return problems;
}

// The Look page. The Studio and dashboard/config.js agree on the starting
// values, a rule has to have a start and an end, and the time zone is checked.
function checkTheme() {
  const problems = [];
  const defaults = world.dashboard.defaultThemeSettings;
  const at = name => fieldAt('theme.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);

  // The starting values
  need(problems, world.themeRegistry.themes.some(entry => entry.id === defaults.defaultTheme), 'the default theme in config.js should be one of the themes in the dashboard registry');
  need(problems, at('defaultTheme') && at('defaultTheme').initialValue === defaults.defaultTheme, 'theme.defaultTheme should start as ' + defaults.defaultTheme + ', as in config.js');
  need(problems, at('timeZone') && at('timeZone').initialValue === defaults.timeZone, 'theme.timeZone should start as ' + defaults.timeZone + ', as in config.js');
  need(problems, defaults.timeZone === 'America/New_York', 'the default time zone in config.js should be America/New_York');
  need(problems, defaults.seasonOverPanels === true && at('seasonOverPanels') && at('seasonOverPanels').initialValue === true, 'theme.seasonOverPanels should start on (true), and so should seasonOverPanels in config.js');
  need(problems, at('seasonOverPanels') && at('seasonOverPanels').title === 'Seasonal pieces over the panels', 'theme.seasonOverPanels should be titled Seasonal pieces over the panels');
  need(problems, at('seasonOverPanels') && /off/i.test(at('seasonOverPanels').description || ''), 'the theme.seasonOverPanels description should say what Off does');
  need(problems, sameData(defaults.useNow, { theme: '', overlay: '', until: '' }), 'useNow in config.js should be empty');
  need(problems, sameData(defaults.schedule, []), 'the schedule in config.js should be empty');
  need(problems, !at('schedule').initialValue && !at('useNow').initialValue, 'theme.useNow and theme.schedule should start empty');
  need(problems, sameData(without(world.sample.theme, 'schedule'), without(defaults, 'schedule')), 'the sample content should carry the theme settings in config.js, apart from its schedule');

  // Default theme: required, and only the registry's themes
  const defaultRules = rulesOf(at('defaultTheme'));
  need(problems, constraintNamed(defaultRules, 'required'), 'theme.defaultTheme should be required');
  const allowed = constraintNamed(defaultRules, 'valid');
  need(problems, allowed && allowed.args[0].join() === world.themeRegistry.themes.map(entry => entry.id).join(), 'theme.defaultTheme should only allow the themes in the registry');

  // Use a theme now: everything is optional, Until has a smallest and a largest time
  ['useNow.theme', 'useNow.overlay', 'useNow.until'].forEach(name => {
    const field = at(name);
    need(problems, field && !constraintNamed(rulesOf(field), 'required'), 'theme.' + name + ' should be optional');
    need(problems, field && /optional/i.test(field.description || ''), 'the theme.' + name + ' description should say it is optional');
  });
  const untilRules = rulesOf(at('useNow.until'));
  need(problems, constraintNamed(untilRules, 'min') && constraintNamed(untilRules, 'max'), 'theme.useNow.until should have a smallest and a largest time');

  // A rule has a start and an end, and both are limited to 2020 to 2099
  ['startDate', 'endDate'].forEach(name => {
    const rules = rulesOf(at('schedule.' + name));
    const low = constraintNamed(rules, 'min');
    const high = constraintNamed(rules, 'max');
    need(problems, constraintNamed(rules, 'required'), 'theme.schedule.' + name + ' should be required, so a rule always has a start and an end');
    need(problems, low && high && low.args[0] === '2020-01-01' && high.args[0] === '2099-12-31', 'theme.schedule.' + name + ' should allow 2020-01-01 to 2099-12-31');
  });
  need(problems, constraintNamed(rulesOf(at('schedule.name')), 'required'), 'theme.schedule.name should be required');
  need(problems, constraintNamed(rulesOf(at('schedule.kind')), 'required'), 'theme.schedule.kind should be required');
  const repeats = at('schedule.repeatsEveryYear');
  need(problems, repeats && repeats.initialValue === false && repeats.title === 'Repeats every year', 'theme.schedule.repeatsEveryYear should be a switch titled Repeats every year that starts off');

  // The theme and the overlay of a rule show only for their kind, and are required for it
  const rule = (kind, value) => ({ parent: { kind: kind }, value: value });
  ['theme', 'overlay'].forEach(kind => {
    const other = kind === 'theme' ? 'overlay' : 'theme';
    const field = at('schedule.' + kind);
    const custom = constraintNamed(rulesOf(field), 'custom');

    need(problems, field && field.hidden && field.hidden(rule(other)) === true && field.hidden(rule(kind)) === false, 'theme.schedule.' + kind + ' should show only when the kind is ' + kind);
    if (!custom) return problems.push('theme.schedule.' + kind + ' should be required when the kind is ' + kind);

    need(problems, typeof custom.args[0](undefined, { parent: { kind: kind } }) === 'string', 'a rule of kind ' + kind + ' with no ' + kind + ' picked should be refused');
    need(problems, custom.args[0]('picked', { parent: { kind: kind } }) === true, 'a rule of kind ' + kind + ' with a ' + kind + ' picked should be accepted');
    need(problems, custom.args[0](undefined, { parent: { kind: other } }) === true, 'a rule of kind ' + other + ' should not need a ' + kind);
  });

  // An end before the start is refused unless the rule repeats every year
  const member = at('schedule').of[0];
  const endCheck = constraintNamed(constraintsOf(member), 'custom');
  if (!endCheck) {
    problems.push('a schedule rule should check that its end is not before its start');
  } else {
    const run = rule => endCheck.args[0](rule);
    const dates = (start, end, repeats) => ({ startDate: start, endDate: end, repeatsEveryYear: repeats });

    need(problems, typeof run(dates('2026-12-20', '2026-12-01', false)) === 'string', 'a rule that does not repeat should not end before it starts');
    need(problems, run(dates('2026-12-20', '2027-01-05', false)) === true, 'a rule that does not repeat may run over New Year');
    need(problems, run(dates('2026-12-20', '2026-12-20', false)) === true, 'a rule may start and end on the same day');
    need(problems, run(dates('2026-12-20', '2026-01-05', true)) === true, 'a rule that repeats every year may end before it starts, to run over New Year');
    need(problems, run(dates('2026-12-20', undefined, false)) === true && run(undefined) === true, 'a rule with no end yet is left to the required check');
  }

  // The extras of a seasonal pack rule: a ticker prefix, a banner line and a corner art. They show only
  // for the kind seasonal pack, are optional, start empty, and have the limits the screen fits
  const extras = world.packExtras;
  [['tickerPrefix', extras.tickerPrefixLimit], ['bannerLine', extras.bannerLineLimit]].forEach(item => {
    const field = at('schedule.' + item[0]);
    const max = field ? constraintNamed(rulesOf(field), 'max') : null;
    need(problems, field && field.type === 'string' && /^Optional\./.test(field.description || ''), 'theme.schedule.' + item[0] + ' should be text, and its description should start with Optional');
    need(problems, field && field.initialValue === undefined && !constraintNamed(rulesOf(field), 'required'), 'theme.schedule.' + item[0] + ' should be optional and start empty');
    need(problems, max && max.args[0] === item[1], 'theme.schedule.' + item[0] + ' should allow up to ' + item[1] + ' characters, as pack-extras.js in the dashboard does');
    need(problems, field && new RegExp('Up to ' + item[1] + ' characters').test(field.description || ''), 'the theme.schedule.' + item[0] + ' description should say it takes up to ' + item[1] + ' characters');
  });
  const art = at('schedule.cornerArt');
  const artAllowed = art ? constraintNamed(rulesOf(art), 'valid') : null;
  need(problems, art && art.initialValue === undefined && !constraintNamed(rulesOf(art), 'required') && /^Optional\./.test(art.description || ''), 'theme.schedule.cornerArt should be optional and start empty, so a pack\'s own corner art is used');
  need(problems, art && /pack's own/.test(art.description || '') && /None/.test(art.description || ''), 'the theme.schedule.cornerArt description should say that empty is the pack\'s own and that None draws nothing');
  need(problems, artAllowed && artAllowed.args[0].join() === world.cornerArt.cornerArtChoices.join(), 'theme.schedule.cornerArt should only allow: ' + world.cornerArt.cornerArtChoices.join(', '));
  need(problems, world.cornerArt.cornerArtIds.join() === 'leaves,snowflakes,gears,fireworks', 'the four ornaments should be leaves, snowflakes, gears and fireworks');
  ['tickerPrefix', 'bannerLine', 'cornerArt'].forEach(name => {
    const field = at('schedule.' + name);
    need(problems, field && field.hidden && field.hidden({ parent: { kind: 'theme' } }) === true && field.hidden({ parent: { kind: 'overlay' } }) === false, 'theme.schedule.' + name + ' should show only when the kind is overlay');
  });

  // The sample content has two example rules for packs, with names and texts marked with square brackets
  const sampleRules = world.sample.theme.schedule;
  const packIds = world.overlayRegistry.overlays.filter(entry => entry.decorations === true).map(entry => entry.id);
  need(problems, sampleRules.length === 2, 'the sample content should have two example rules in its schedule');
  sampleRules.forEach(rule => {
    need(problems, rule.kind === 'overlay' && packIds.indexOf(rule.overlay) !== -1, 'a sample rule should be for a seasonal pack that has decorations');
    need(problems, /^\[.+\]$/.test(rule.name || '') && rule.name.length <= 24, 'a sample rule name should be marked with square brackets, up to 24 characters: ' + rule.name);
    need(problems, /^\[.+\]$/.test(rule.tickerPrefix || '') && rule.tickerPrefix.length <= extras.tickerPrefixLimit, 'a sample ticker prefix should be marked with square brackets, up to ' + extras.tickerPrefixLimit + ' characters');
    need(problems, /^\[.+\]$/.test(rule.bannerLine || '') && rule.bannerLine.length <= extras.bannerLineLimit, 'a sample banner line should be marked with square brackets, up to ' + extras.bannerLineLimit + ' characters');
    need(problems, rule.cornerArt === undefined || world.cornerArt.cornerArtChoices.indexOf(rule.cornerArt) !== -1, 'a sample corner art should be one of: ' + world.cornerArt.cornerArtChoices.join(', '));
    need(problems, rule.startDate >= '2020-01-01' && rule.endDate <= '2099-12-31' && (rule.repeatsEveryYear || rule.startDate <= rule.endDate), 'a sample rule should have real dates');
  });

  // The time zone: a name Intl knows. Browsers that cannot list the names get a plain pattern.
  const zone = constraintNamed(rulesOf(at('timeZone')), 'custom');
  need(problems, constraintNamed(rulesOf(at('timeZone')), 'required'), 'theme.timeZone should be required');
  if (!zone) {
    problems.push('theme.timeZone should be checked against the time zones Intl knows');
  } else {
    const run = zone.args[0];
    ['America/New_York', 'America/Chicago', 'Europe/London', 'UTC', ''].forEach(good => {
      need(problems, run(good) === true, 'the time zone check refuses "' + good + '"');
    });
    ['Nowhere/Land', 'new york', 'America/New York', 'EST5EDT now'].forEach(bad => {
      need(problems, typeof run(bad) === 'string', 'the time zone check accepts "' + bad + '"');
    });

    const supported = Intl.supportedValuesOf;
    try {
      Intl.supportedValuesOf = undefined;
      ['America/New_York', 'Etc/GMT+5', 'UTC'].forEach(good => need(problems, run(good) === true, 'with no Intl list, the time zone pattern refuses "' + good + '"'));
      ['new york', 'America/', '/New_York', 'a b'].forEach(bad => need(problems, typeof run(bad) === 'string', 'with no Intl list, the time zone pattern accepts "' + bad + '"'));
    } finally {
      Intl.supportedValuesOf = supported;
    }
  }
  return problems;
}

// The screens a demo can show, one at a time. The Studio's copy
// (demo-screens.js) must say the same as the dashboard's registry, because the
// editors pick from the Studio's list and the screen looks the id up in its own.
function checkDemoScreens() {
  const problems = [];
  const registry = world.demoRegistry.demoScreens;
  const ids = Object.keys(registry);
  const copy = world.studioDemoScreens.demoScreens;

  need(problems, ids.length > 0, 'the registry in dashboard/core/demo-screens.js has no screens');
  need(problems, copy.length === ids.length, 'studio/inputs/demo-screens.js has ' + copy.length + ' screens and the dashboard registry has ' + ids.length);
  need(problems, new Set(copy.map(entry => entry.id)).size === copy.length, 'studio/inputs/demo-screens.js lists a screen twice');

  ids.forEach((id, index) => {
    const entry = registry[id];
    need(problems, typeof entry.name === 'string' && entry.name !== '', 'the dashboard demo screen "' + id + '" needs a name');
    need(problems, typeof entry.run === 'function', 'the dashboard demo screen "' + id + '" needs a run function');

    const other = copy[index];
    if (!other) return problems.push('studio/inputs/demo-screens.js is missing the demo screen "' + id + '"');
    if (other.id !== id) problems.push('demo screen number ' + (index + 1) + ' has id "' + id + '" in the dashboard registry but "' + other.id + '" in studio/inputs/demo-screens.js');
    if (other.name !== entry.name) problems.push('the demo screen "' + id + '" has name "' + entry.name + '" in the dashboard registry but "' + other.name + '" in studio/inputs/demo-screens.js');
  });

  // What the editors are offered on a step is the registry's list, in order, in plain words
  const offered = choicesOf('demo.steps.screen');
  need(problems, offered.map(item => item.value).join() === ids.join(), 'demo.steps.screen should offer: ' + ids.join(', '));
  need(problems, offered.map(item => item.title).join() === ids.map(id => registry[id].name).join(), 'demo.steps.screen should show the names in the dashboard registry');

  const screen = fieldAt('demo.steps.screen');
  const allowed = screen ? constraintNamed(constraintsOf(screen), 'valid') : null;
  need(problems, allowed && allowed.args[0].join() === ids.join(), 'demo.steps.screen should only allow: ' + ids.join(', '));
  return problems;
}

// The Demo page. The Studio and dashboard/config.js agree on the starting
// values and the limits, Requested at is read only, and the page has no buttons. The
// sample content carries the same starting values.
function checkDemo() {
  const problems = [];
  const config = world.dashboard;
  const defaults = config.defaultDemo;
  const at = name => fieldAt('demo.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);

  // The starting values
  need(problems, at('steps') && sameData(at('steps').initialValue, defaults.steps), 'demo.steps should start as ' + JSON.stringify(defaults.steps) + ', as in config.js');
  need(problems, defaults.steps.length === 2 && defaults.steps[0].screen === 'announcement' && defaults.steps[1].screen === 'night-mode', 'defaultDemo in config.js should start with the announcement and then night mode');
  need(problems, defaults.steps.every(step => step.seconds === config.demoDefaultSeconds), 'every starting step should last demoDefaultSeconds, ' + config.demoDefaultSeconds);
  need(problems, defaults.requestedAt === '' && defaults.announcementText === '', 'defaultDemo in config.js should have no request and no announcement text');
  need(problems, at('requestedAt') && at('requestedAt').initialValue === undefined, 'demo.requestedAt should start empty');
  need(problems, at('announcementText') && at('announcementText').initialValue === undefined, 'demo.announcementText should start empty, so the screen uses the first announcement');
  need(problems, /^\[.+\]$/.test(config.demoPlaceholderText), 'demoPlaceholderText in config.js should be marked with square brackets');
  need(problems, sameData(world.sample.demo, defaults), 'the sample content should carry the demo settings in config.js');

  // Requested at cannot be typed in, and may be empty
  need(problems, at('requestedAt') && at('requestedAt').readOnly === true, 'demo.requestedAt should be read only');
  need(problems, !constraintNamed(rulesOf(at('requestedAt')), 'required'), 'demo.requestedAt should be optional');

  // The announcement text is optional
  need(problems, !constraintNamed(rulesOf(at('announcementText')), 'required'), 'demo.announcementText should be optional');
  need(problems, at('announcementText') && /optional/i.test(at('announcementText').description || ''), 'the demo.announcementText description should say it is optional');
  need(problems, at('announcementText') && at('announcementText').title === 'Demo announcement text', 'demo.announcementText should be titled Demo announcement text');

  // The steps: a list of at most demoMaxSteps, each with a screen and the seconds in the limits
  const listLimit = constraintNamed(rulesOf(at('steps')), 'max');
  need(problems, listLimit && listLimit.args[0] === config.demoMaxSteps, 'demo.steps should allow demoMaxSteps steps, ' + config.demoMaxSteps);
  need(problems, config.limits.demoSeconds && config.limits.demoSeconds.min === 5 && config.limits.demoSeconds.max === 300, 'limits.demoSeconds in config.js should be 5 to 300');

  const seconds = at('steps.seconds');
  const secondsRules = rulesOf(seconds);
  const low = constraintNamed(secondsRules, 'min');
  const high = constraintNamed(secondsRules, 'max');
  need(problems, seconds && seconds.initialValue === config.demoDefaultSeconds, 'demo.steps.seconds should start as ' + config.demoDefaultSeconds);
  need(problems, low && high && low.args[0] === config.limits.demoSeconds.min && high.args[0] === config.limits.demoSeconds.max, 'demo.steps.seconds should have the limits in config.js, ' + JSON.stringify(config.limits.demoSeconds));
  need(problems, constraintNamed(secondsRules, 'integer'), 'demo.steps.seconds should be whole seconds');
  need(problems, constraintNamed(secondsRules, 'required'), 'demo.steps.seconds should be required');
  need(problems, constraintNamed(rulesOf(at('steps.screen')), 'required'), 'demo.steps.screen should be required');

  // Run demo and Stop demo are gone: the page has no buttons, and nothing else fills Requested at in
  need(problems, world.config.document.actions([], { schemaType: 'demo' }).length === 0, 'the Demo page should add no actions. Run demo and Stop demo were taken out');
  need(problems, !/\brunDemo\b|\bstopDemo\b|useRunDemo|useStopDemo/.test(world.actionsSource), 'actions.js should not have Run demo or Stop demo');
  return problems;
}

// Events Calendar: events that are not on BAND. The type stays so that the entries already
// typed open and publish, but it has no line in the sidebar and the dashboard does not read it.
// The title, start date and show switch are asked for, the rest is optional, the end date may
// not come before the start date, and an end time needs a start time. The seed file in
// docs/seed has to be something `sanity dataset import --missing` can load
// twice with no change: fixed ids, real fields and values the Studio accepts.
function checkExtraEvents() {
  const problems = [];
  const at = name => fieldAt('extraEvent.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);

  ['title', 'startDate'].forEach(name => {
    need(problems, constraintNamed(rulesOf(at(name)), 'required'), 'extraEvent.' + name + ' should be required');
  });
  ['endDate', 'startTime', 'endTime', 'location'].forEach(name => {
    need(problems, at(name) && !constraintNamed(rulesOf(at(name)), 'required'), 'extraEvent.' + name + ' should be optional');
    need(problems, at(name) && /optional/i.test(at(name).description || ''), 'the extraEvent.' + name + ' description should say it is optional');
  });

  const show = at('show');
  need(problems, show && show.type === 'boolean' && show.title === 'Show on screen' && show.initialValue === true, 'extraEvent.show should be a switch titled Show on screen that starts on');
  need(problems, !at('expires'), 'extraEvent should have no Hide after field: its dates say when it is over');

  // Both dates are limited to 2020 to 2099, like the dates in the Theme schedule
  ['startDate', 'endDate'].forEach(name => {
    const rules = rulesOf(at(name));
    const low = constraintNamed(rules, 'min');
    const high = constraintNamed(rules, 'max');
    need(problems, low && high && low.args[0] === '2020-01-01' && high.args[0] === '2099-12-31', 'extraEvent.' + name + ' should allow 2020-01-01 to 2099-12-31');
  });

  // The end date is not before the start date, and may be empty
  const endDate = constraintNamed(rulesOf(at('endDate')), 'custom');
  if (!endDate) {
    problems.push('extraEvent.endDate should be checked so that it is not before the start date');
  } else {
    const run = (value, start) => endDate.args[0](value, { document: { startDate: start } });
    need(problems, typeof run('2027-04-01', '2027-04-02') === 'string', 'an end date before the start date should be refused');
    need(problems, run('2027-04-02', '2027-04-02') === true && run('2027-04-04', '2027-04-02') === true, 'an end date on or after the start date should be accepted');
    need(problems, run(undefined, '2027-04-02') === true && run('2027-04-04', undefined) === true, 'an empty end date, or an end date with no start date yet, is left to the other checks');
  }

  // The end time needs a start time, and on a one day event may not come before it
  const endTime = constraintNamed(rulesOf(at('endTime')), 'custom');
  if (!endTime) {
    problems.push('extraEvent.endTime should be checked against the start time');
  } else {
    const run = (value, event) => endTime.args[0](value, { document: event });
    const oneDay = { startTime: '18:30', startDate: '2027-04-02', endDate: '2027-04-02' };
    need(problems, run(undefined, {}) === true, 'an empty end time should be accepted');
    need(problems, typeof run('20:00', {}) === 'string', 'an end time with no start time should be refused');
    need(problems, run('20:00', oneDay) === true && run('20:00', { startTime: '18:30', startDate: '2027-04-02' }) === true, 'an end time after the start time should be accepted');
    need(problems, typeof run('17:00', oneDay) === 'string', 'an end time before the start time on a one day event should be refused');
    need(problems, run('17:00', Object.assign({}, oneDay, { endDate: '2027-04-03' })) === true, 'an end time before the start time is fine when the event runs over days');
  }

  const type = typeByName('extraEvent');
  const soonestFirst = (type.orderings || []).some(item => item.by && item.by[0].field === 'startDate' && item.by[0].direction === 'asc');
  need(problems, soonestFirst, 'extraEvent needs an ordering by startDate, soonest first');
  const hidden = type.preview.prepare({ title: 'Example', startDate: '2027-04-02', show: false }).subtitle || '';
  need(problems, hidden.indexOf('Hidden') !== -1, 'the extraEvent preview does not say when an event is hidden');

  // The seed file: one JSON document a line, fixed ids, only fields the Studio has
  const lines = world.seed.split('\n').filter(line => line.trim() !== '');
  need(problems, lines.length > 0, 'docs/seed/extra-events.ndjson has no documents');

  const names = fieldsIn(type).map(field => field.name);
  const ids = [];
  lines.forEach((line, index) => {
    const where = 'docs/seed/extra-events.ndjson line ' + (index + 1);
    let doc;
    try {
      doc = JSON.parse(line);
    } catch (error) {
      return problems.push(where + ' is not JSON');
    }

    need(problems, doc._type === 'extraEvent', where + ' should have _type extraEvent');
    need(problems, typeof doc._id === 'string' && /^extraEvent-[A-Za-z0-9-]+$/.test(doc._id), where + ' should have a fixed _id such as extraEvent-2026-10-17-doyenne-east, with hyphens and no dots');
    ids.push(doc._id);
    Object.keys(doc).forEach(key => need(problems, key.charAt(0) === '_' || names.indexOf(key) !== -1, where + ': ' + key + ' is not a field of extraEvent'));

    const day = /^\d{4}-\d{2}-\d{2}$/;
    need(problems, typeof doc.title === 'string' && doc.title.length > 0 && doc.title.length <= 30, where + ' needs a title of 1 to 30 characters');
    need(problems, day.test(doc.startDate || ''), where + ' needs a startDate such as 2026-10-17');
    need(problems, doc.endDate === undefined || (day.test(doc.endDate) && doc.endDate >= doc.startDate), where + ': endDate should be a date that is not before startDate');
    need(problems, doc.startTime === undefined && doc.endTime === undefined, where + ' should have no times: the events are all-day');
    need(problems, doc.location === undefined || (typeof doc.location === 'string' && doc.location.length <= 24), where + ': location should be at most 24 characters');
    need(problems, doc.show === true, where + ' should have show true');
  });
  need(problems, new Set(ids).size === ids.length, 'docs/seed/extra-events.ndjson uses an _id twice');
  return problems;
}

// The Place type, and the two fields of a task that use it. A place has a name
// (required, up to 16 characters, different from every other place) and a
// Show on screen switch. A task's contact and location are optional, and the
// location keeps Sanity's Create new option, so an editor can add a place
// while editing a task: Places has no line in the sidebar, so that is the only
// way to add one. The seed file holds the three starting places.
function checkPlaces() {
  const problems = [];
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const type = typeByName('place');
  if (!type) return ['place is missing from schemas/index.js'];

  need(problems, constraintNamed(rulesOf(fieldAt('place.name')), 'required'), 'place.name should be required');
  const show = fieldAt('place.show');
  need(problems, show && show.type === 'boolean' && show.title === 'Show on screen' && show.initialValue === true, 'place.show should be a switch titled Show on screen that starts on');
  need(problems, type.title === 'Places', 'the place type should have the title Places');
  need(problems, (type.orderings || []).some(item => item.by && item.by[0].field === 'name'), 'place needs an ordering by name');
  const hidden = type.preview.prepare({ title: 'Classroom', show: false }).subtitle || '';
  need(problems, hidden.indexOf('Hidden') !== -1, 'the place preview does not say when a place is hidden');

  ['contact', 'location'].forEach(name => {
    const field = fieldAt('task.' + name);
    need(problems, field && !constraintNamed(rulesOf(field), 'required'), 'task.' + name + ' should be optional');
    need(problems, field && /optional/i.test(field.description || ''), 'the task.' + name + ' description should say it is optional');
  });

  const location = fieldAt('task.location');
  const options = (location && location.options) || {};
  need(problems, !options.disableNew, 'task.location should leave Create new on: do not set disableNew');
  need(problems, !options.filter && !options.weak, 'task.location should be an ordinary reference to a place');

  // the contact is a first name, with no space or digit
  const firstName = constraintNamed(rulesOf(fieldAt('task.contact')), 'custom');
  if (!firstName) {
    problems.push('task.contact should be checked so that it is a first name only');
  } else {
    const run = value => firstName.args[0](value);
    need(problems, run(undefined) === true && run('Sam') === true && run('Mary-Anne') === true, 'a first name, or an empty contact, should be accepted');
    need(problems, typeof run('Sam K') === 'string' && typeof run('Sam2') === 'string', 'a contact with a space or a number in it should be refused');
  }

  // the sample content shows a contact and a place, and keeps to the limits
  const tasks = world.sample.tasks;
  need(problems, tasks.some(task => task.contact && task.location), 'the sample content needs a task with a contact and a location');
  need(problems, tasks.some(task => task.contact && !task.location) && tasks.some(task => task.location && !task.contact), 'the sample content needs a task with only a contact and one with only a location');
  tasks.forEach(task => {
    need(problems, task.contact === undefined || (typeof task.contact === 'string' && task.contact.length <= 12), 'sample task "' + task.title + '": contact should be text of 12 characters or fewer');
    need(problems, task.location === undefined || (typeof task.location === 'string' && task.location.length <= 16), 'sample task "' + task.title + '": location should be the place name, 16 characters or fewer');
  });

  // The seed file: one JSON document a line, fixed ids, only fields the Studio has
  const lines = world.placeSeed.split('\n').filter(line => line.trim() !== '');
  const names = fieldsIn(type).map(field => field.name);
  const ids = [];
  const seeded = [];
  lines.forEach((line, index) => {
    const where = 'docs/seed/places.ndjson line ' + (index + 1);
    let doc;
    try {
      doc = JSON.parse(line);
    } catch (error) {
      return problems.push(where + ' is not JSON');
    }

    need(problems, doc._type === 'place', where + ' should have _type place');
    need(problems, typeof doc._id === 'string' && /^place-[a-z0-9-]+$/.test(doc._id), where + ' should have a fixed _id such as place-classroom, with lowercase letters, digits and hyphens');
    // the CSV importer makes the same id from a place's name, so a task in a CSV can point at a seeded place
    const importerId = 'place-' + String(doc.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    need(problems, doc._id === importerId, where + ': the _id should be ' + importerId + ', which is the one studio/scripts/import-csv.mjs makes from the name');
    ids.push(doc._id);
    seeded.push(String(doc.name).toLowerCase());
    Object.keys(doc).forEach(key => need(problems, key.charAt(0) === '_' || names.indexOf(key) !== -1, where + ': ' + key + ' is not a field of place'));
    need(problems, typeof doc.name === 'string' && doc.name.length > 0 && doc.name.length <= 16, where + ' needs a name of 1 to 16 characters');
    need(problems, doc.show === true, where + ' should have show true');
  });
  need(problems, new Set(ids).size === ids.length, 'docs/seed/places.ndjson uses an _id twice');
  need(problems, new Set(seeded).size === seeded.length, 'docs/seed/places.ndjson has the same name twice');
  need(problems, seeded.join() === 'classroom,programming room,media center', 'docs/seed/places.ndjson should hold Classroom, Programming room and Media center, in that order');
  return problems;
}

// The name check asks Sanity for the other places, so it waits for an answer.
// A stand-in client gives the answer here and writes down what it was asked.
async function checkPlaceNames() {
  const problems = [];
  const custom = constraintNamed(constraintsOf(fieldAt('place.name')), 'custom');
  if (!custom) return ['place.name should be checked against the names of the other places'];

  async function ask(name, document, others) {
    const asked = [];
    const getClient = () => ({ fetch: async (query, params, options) => { asked.push({ query: query, params: params, options: options }); return others; } });
    const answer = await custom.args[0](name, { document: document, getClient: getClient });
    return { answer: answer, asked: asked[0] };
  }

  const others = ['Classroom', 'Media center'];
  const same = await ask('Classroom', { _id: 'drafts.place-new' }, others);
  need(problems, typeof same.answer === 'string', 'a name that another place has should be refused');
  need(problems, typeof (await ask('  mEDIA CENTER ', { _id: 'place-new' }, others)).answer === 'string', 'a name that another place has, in other capitals or with spaces round it, should be refused');
  need(problems, (await ask('Programming room', { _id: 'place-new' }, others)).answer === true, 'a name no other place has should be accepted');
  need(problems, (await ask('Classroom', { _id: 'place-new' }, [])).answer === true, 'a name should be accepted when there are no other places');
  need(problems, (await ask('Classroom', { _id: 'place-new' }, null)).answer === true, 'a name should be accepted when Sanity lists no places');
  need(problems, (await ask('', { _id: 'place-new' }, others)).answer === true && (await ask(undefined, { _id: 'place-new' }, others)).answer === true, 'an empty name is left to the required check');

  // the place itself, as published and as a draft, is not another place, and a draft of another place counts
  const own = same.asked;
  need(problems, own && JSON.stringify(own.params.ownIds) === JSON.stringify(['place-new', 'drafts.place-new']), 'the lookup should leave out the place being edited, both as published and as a draft');
  need(problems, own && own.options && own.options.perspective === 'raw', 'the lookup should include drafts (perspective raw), so a place that is not yet published counts');
  need(problems, own && own.query.indexOf('_type == "place"') !== -1, 'the lookup should look at places only');
  return problems;
}

// Every field that has rules says what is wrong in plain words, so the message
// an editor reads is ours and not Sanity's
function checkPlainMessages(typeName, problems) {
  fieldsIn(typeByName(typeName)).forEach(field => {
    const rules = constraintsOf(field);
    const messages = rules.filter(rule => rule.name === 'error' && rule.args[0]);
    need(problems, rules.length === 0 || messages.length > 0, typeName + '.' + field.name + ' has rules and no error message in plain words');
  });
}

// Calendar filters: only the name is asked for in the fields. The action starts
// on Hide, the days start from Monday, the calendar code has the pattern of the
// calendars in Dashboard Settings, and the to date may not come before the from
// date. The rule as a whole needs at least one of words, days, a calendar or a
// date, which is a check on the document and not on a field.
function checkCalendarFilters() {
  const problems = [];
  const at = name => fieldAt('calendarFilter.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const type = typeByName('calendarFilter');
  if (!type) return ['calendarFilter is missing from schemas/index.js'];

  need(problems, type.title === 'Calendar filters', 'the calendarFilter type should have the title Calendar filters');
  const titles = { name: 'Rule name', action: 'Action', words: 'Title words', days: 'Days', calendar: 'Calendar', fromDate: 'From date', toDate: 'To date', show: 'Rule on', expires: 'Hide after' };
  Object.keys(titles).forEach(name => need(problems, at(name) && at(name).title === titles[name], 'calendarFilter.' + name + ' should be titled ' + titles[name]));

  need(problems, constraintNamed(rulesOf(at('name')), 'required'), 'calendarFilter.name should be required');
  need(problems, at('name') && /screen/.test(at('name').description || ''), 'the calendarFilter.name description should say the name does not show on the screen');
  ['words', 'days', 'calendar', 'fromDate', 'toDate', 'expires'].forEach(name => {
    need(problems, at(name) && !constraintNamed(rulesOf(at(name)), 'required'), 'calendarFilter.' + name + ' should be optional');
    need(problems, at(name) && /optional/i.test(at(name).description || ''), 'the calendarFilter.' + name + ' description should say it is optional');
  });

  // Hide or Always show, and Hide to start with
  const action = at('action');
  const allowed = action ? constraintNamed(rulesOf(action), 'valid') : null;
  need(problems, action && action.options && action.options.layout === 'radio' && action.initialValue === 'hide', 'calendarFilter.action should be a radio list that starts as hide');
  need(problems, constraintNamed(rulesOf(action), 'required'), 'calendarFilter.action should be required');
  need(problems, allowed && allowed.args[0].join() === choices['calendarFilter.action'].join(), 'calendarFilter.action should only allow: ' + choices['calendarFilter.action'].join(', '));
  need(problems, choicesOf('calendarFilter.action').map(item => item.title).join() === 'Hide,Always show', 'calendarFilter.action should be shown as Hide and Always show');

  // A word of spaces is inside every title, so it is refused
  const words = at('words');
  const wordRules = words && words.of && words.of[0] ? constraintsOf(words.of[0]) : [];
  const wordCheck = constraintNamed(wordRules, 'custom');
  need(problems, constraintNamed(wordRules, 'required'), 'each calendarFilter word should be required, so a line cannot be left empty');
  if (!wordCheck) {
    problems.push('calendarFilter.words should refuse a word that is only spaces');
  } else {
    ['Pre-Season', 'kickoff', 'a'].forEach(good => need(problems, wordCheck.args[0](good) === true, 'the word check refuses "' + good + '"'));
    ['', '   '].forEach(bad => need(problems, typeof wordCheck.args[0](bad) === 'string', 'the word check accepts "' + bad + '"'));
  }

  const days = at('days');
  need(problems, days && days.initialValue === undefined, 'calendarFilter.days should start with no day ticked');

  // The same pattern as the calendar codes in Dashboard Settings, so a code that is typed here can match
  const code = constraintNamed(rulesOf(at('calendar')), 'regex');
  const settingsCode = constraintNamed(rulesOf(fieldAt('dashboardSettings.calendars.id')), 'regex');
  if (!code || !settingsCode) {
    problems.push('calendarFilter.calendar should be checked with the code pattern of the calendars in Dashboard Settings');
  } else {
    need(problems, code.args[0].source === settingsCode.args[0].source, 'calendarFilter.calendar should use the same code pattern as the calendars in Dashboard Settings');
    ['team', 'group', 'build_season'].forEach(good => need(problems, code.args[0].test(good), 'the calendar code pattern refuses ' + good));
    ['Team', 'build-season', 'build season', 'team.ics', ''].forEach(bad => need(problems, !code.args[0].test(bad), 'the calendar code pattern accepts "' + bad + '"'));
  }
  const where = at('calendar') ? at('calendar').description || '' : '';
  need(problems, /Dashboard Settings/.test(where) && /Calendars/.test(where), 'the calendarFilter.calendar description should point to Calendars in Dashboard Settings');
  need(problems, /every calendar/i.test(where), 'the calendarFilter.calendar description should say that empty means every calendar');

  // Both dates are limited to 2020 to 2099, like the dates in the Theme schedule
  ['fromDate', 'toDate'].forEach(name => {
    const rules = rulesOf(at(name));
    const low = constraintNamed(rules, 'min');
    const high = constraintNamed(rules, 'max');
    need(problems, at(name) && at(name).type === 'date', 'calendarFilter.' + name + ' should be a date');
    need(problems, low && high && low.args[0] === '2020-01-01' && high.args[0] === '2099-12-31', 'calendarFilter.' + name + ' should allow 2020-01-01 to 2099-12-31');
  });

  // The to date is not before the from date, and either may be empty
  const toDate = constraintNamed(rulesOf(at('toDate')), 'custom');
  if (!toDate) {
    problems.push('calendarFilter.toDate should be checked so that it is not before the from date');
  } else {
    const run = (value, from) => toDate.args[0](value, { document: { fromDate: from } });
    need(problems, typeof run('2027-04-01', '2027-04-02') === 'string', 'a to date before the from date should be refused');
    need(problems, run('2027-04-02', '2027-04-02') === true && run('2027-04-04', '2027-04-02') === true, 'a to date on or after the from date should be accepted');
    need(problems, run(undefined, '2027-04-02') === true && run('2027-04-04', undefined) === true, 'an empty to date, or a to date with no from date, should be accepted');
  }

  const show = at('show');
  need(problems, show && show.type === 'boolean' && show.initialValue === true, 'calendarFilter.show should be a switch that starts on');
  need(problems, at('expires') && at('expires').type === 'datetime', 'calendarFilter.expires should be a datetime');

  // The rule as a whole needs at least one condition, or it would match every event
  const whole = constraintNamed(constraintsOf(type), 'custom');
  if (!whole) {
    problems.push('calendarFilter should be checked as a whole: a rule needs at least one of words, days, a calendar or a date');
  } else {
    const run = rule => whole.args[0](rule);
    [
      ['a word', { words: ['Pre-Season'] }],
      ['a day', { days: [1] }],
      ['Sunday, which is day 0', { days: [0] }],
      ['a calendar', { calendar: 'group' }],
      ['a from date', { fromDate: '2027-01-01' }],
      ['a to date', { toDate: '2027-01-01' }],
      ['a word and a day', { words: ['Pre-Season'], days: [1, 4] }],
    ].forEach(entry => need(problems, run(entry[1]) === true, 'a rule with ' + entry[0] + ' should be accepted'));
    [
      ['nothing', {}],
      ['a name and an action only', { name: '[Rule]', action: 'hide' }],
      ['empty lists', { words: [], days: [] }],
      ['words that are only spaces', { words: ['  '] }],
      ['a calendar of spaces', { calendar: '  ' }],
      ['an empty calendar', { calendar: '' }],
    ].forEach(entry => need(problems, typeof run(entry[1]) === 'string', 'a rule with ' + entry[0] + ' should be refused'));
    need(problems, /at least one/.test(run({})), 'the message for a rule with no condition should say that at least one is needed');
    need(problems, run(undefined) === true, 'a missing document is left to the other checks');
  }

  need(problems, (type.orderings || []).some(item => item.by && item.by[0].field === 'name' && item.by[0].direction === 'asc'), 'calendarFilter needs an ordering by name, A to Z');
  checkPlainMessages('calendarFilter', problems);

  // The list line: the name, then Off or Expired, the action and each condition the rule has
  const line = fields => type.preview.prepare(Object.assign({ title: '[Rule]' }, fields));
  [
    [line({ action: 'hide', words: ['Pre-Season'], days: [4, 1] }).subtitle, 'Hide · Pre-Season · Mon, Thu'],
    [line({ action: 'show', words: ['Kickoff'] }).subtitle, 'Always show · Kickoff'],
    [line({ action: 'hide', words: ['Pre-Season', 'Practice'], days: [4, 1], calendar: 'group', from: '2027-01-01', to: '2027-02-01' }).subtitle, 'Hide · Pre-Season or Practice · Mon, Thu · group · 2027-01-01 to 2027-02-01'],
    [line({ action: 'hide', days: [0, 6] }).subtitle, 'Hide · Sat, Sun'],
    [line({ action: 'hide', from: '2027-01-01' }).subtitle, 'Hide · from 2027-01-01'],
    [line({ action: 'hide', to: '2027-02-01' }).subtitle, 'Hide · until 2027-02-01'],
    [line({ action: 'hide', words: ['', 'Kickoff'] }).subtitle, 'Hide · Kickoff'],
    [line({ action: 'hide', words: ['Pre-Season'], show: false }).subtitle, 'Off · Hide · Pre-Season'],
    [line({ action: 'hide', words: ['Pre-Season'], expires: '2000-01-01T00:00:00.000Z' }).subtitle, 'Expired · Hide · Pre-Season'],
    [line({ action: 'hide', words: ['Pre-Season'], expires: '2999-01-01T00:00:00.000Z' }).subtitle, 'Hide · Pre-Season'],
    [type.preview.prepare({}).title, 'Rule with no name'],
  ].forEach(entry => need(problems, entry[0] === entry[1], 'the calendar filter list should read "' + entry[1] + '", it reads "' + entry[0] + '"'));
  return problems;
}

// Meeting days: the first and last talk are needed, the length of a talk and the
// time booking closes have a starting value and a range, and the list reads each
// day on one line. The last talk is checked against the first in
// checkMeetingDayTimes.
function checkMeetingDays() {
  const problems = [];
  const at = name => fieldAt('presentationDay.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const type = typeByName('presentationDay');
  if (!type) return ['presentationDay is missing from schemas/index.js'];

  need(problems, type.title === 'Meeting days', 'the presentationDay type should have the title Meeting days');
  const titles = {
    firstSlotAt: 'First talk starts',
    lastSlotAt: 'Last talk starts',
    slotMinutes: 'Length of each talk',
    closeMinutesBefore: 'Booking closes this long before a slot',
    open: 'Open for booking',
  };
  Object.keys(titles).forEach(name => need(problems, at(name) && at(name).title === titles[name], 'presentationDay.' + name + ' should be titled ' + titles[name]));

  ['firstSlotAt', 'lastSlotAt'].forEach(name => {
    need(problems, at(name) && at(name).type === 'datetime' && constraintNamed(rulesOf(at(name)), 'required'), 'presentationDay.' + name + ' should be a required datetime');
  });
  const gap = at('firstSlotAt') ? at('firstSlotAt').description || '' : '';
  need(problems, /gap/.test(gap) && /announcement/.test(gap), 'the presentationDay.firstSlotAt description should tell coaches to leave a gap for the announcement');

  // Whole minutes in a range, with a starting value: [field, starting value, smallest, largest].
  // closeMinutesBefore is hidden and is checked in checkFixedValues.
  [['slotMinutes', 15, 5, 30]].forEach(entry => {
    const field = at(entry[0]);
    const rules = rulesOf(field);
    const low = constraintNamed(rules, 'min');
    const high = constraintNamed(rules, 'max');
    const name = 'presentationDay.' + entry[0];

    need(problems, field && field.type === 'number' && field.initialValue === entry[1], name + ' should be a number that starts as ' + entry[1]);
    need(problems, low && high && low.args[0] === entry[2] && high.args[0] === entry[3], name + ' should allow ' + entry[2] + ' to ' + entry[3]);
    need(problems, constraintNamed(rules, 'required') && constraintNamed(rules, 'integer'), name + ' should be required and a whole number');
    need(problems, field && (field.description || '').indexOf('from ' + entry[2] + ' to ' + entry[3]) !== -1, 'the ' + name + ' description should give the range, from ' + entry[2] + ' to ' + entry[3]);
  });

  const open = at('open');
  need(problems, open && open.type === 'boolean' && open.initialValue === true, 'presentationDay.open should be a switch that starts on');
  need(problems, (type.orderings || []).some(item => item.by && item.by[0].field === 'firstSlotAt' && item.by[0].direction === 'asc'), 'presentationDay needs an ordering by firstSlotAt, soonest first');
  checkPlainMessages('presentationDay', problems);

  // The list line, in New York time: the day, then the first and last talk
  const line = (firstAt, lastAt, open) => type.preview.prepare({ first: firstAt, last: lastAt, open: open });
  const first = '2026-10-08T18:45:00.000Z';
  const last = '2026-10-08T20:45:00.000Z';
  [
    [line(first, last), 'Thu Oct 8', '2:45 PM to 4:45 PM'],
    [line(first, '2026-10-08T20:50:00.000Z'), 'Thu Oct 8', '2:45 PM to 4:50 PM'],
    [line(first, first), 'Thu Oct 8', '2:45 PM'],
    [line(first, '2026-10-08T17:45:00.000Z'), 'Thu Oct 8', '2:45 PM to 1:45 PM'],
    [line(first, undefined), 'Thu Oct 8', '2:45 PM'],
    [line('2026-10-08T16:30:00.000Z', undefined), 'Thu Oct 8', '12:30 PM'],
    [line('2026-10-08T04:05:00.000Z', undefined), 'Thu Oct 8', '12:05 AM'],
    [line(undefined, last), 'Meeting day with no times', ''],
  ].forEach(entry => need(problems, entry[0].title === entry[1] && entry[0].subtitle === entry[2], 'the meeting day list should read "' + entry[1] + '" then "' + entry[2] + '", it reads "' + entry[0].title + '" then "' + entry[0].subtitle + '"'));

  need(problems, line(first, last, false).subtitle === 'Closed for booking · 2:45 PM to 4:45 PM', 'the meeting day list should say Closed for booking before the times when the day is not open');
  need(problems, line(undefined, undefined, false).subtitle === 'Closed for booking', 'the meeting day list should say Closed for booking even with no times');
  need(problems, line(first, last, true).subtitle === '2:45 PM to 4:45 PM' && line(first, last, undefined).subtitle === '2:45 PM to 4:45 PM', 'the meeting day list should say nothing more when the day is open');
  return problems;
}

// The last talk is a slot of the same meeting: not before the first talk, and on
// the same calendar day on the kiosk's clock. The kiosk's time zone is the one on
// the Look page, which the check asks Sanity for, so it waits for an answer. A
// stand-in client gives the answer here and writes down what it was asked.
async function checkMeetingDayTimes() {
  const problems = [];
  const custom = constraintNamed(constraintsOf(fieldAt('presentationDay.lastSlotAt')), 'custom');
  if (!custom) return ['presentationDay.lastSlotAt should be checked against the first talk'];

  // answer is the time zone Sanity gives back, or an Error for a question that fails
  async function ask(lastAt, firstAt, answer) {
    const asked = [];
    const getClient = () => ({
      fetch: async (query, params, options) => {
        asked.push({ query: query, options: options });
        if (answer instanceof Error) throw answer;
        return answer;
      },
    });
    const result = await custom.args[0](lastAt, { document: { firstSlotAt: firstAt }, getClient: getClient });
    return { answer: result, asked: asked[0] };
  }

  const newYork = 'America/New_York';
  const first = '2026-10-08T18:45:00.000Z';
  const accepted = [
    ['two hours after the first talk', '2026-10-08T20:45:00.000Z', first],
    ['the same time as the first talk', first, first],
    ['6 PM then 9 PM, which is the next day in UTC and the same day in New York', '2026-10-09T01:00:00.000Z', '2026-10-08T22:00:00.000Z'],
    ['no last talk yet', undefined, first],
    ['no first talk yet', '2026-10-08T20:45:00.000Z', undefined],
  ];
  const refused = [
    ['an hour before the first talk', '2026-10-08T17:45:00.000Z', first],
    ['the next day', '2026-10-09T18:45:00.000Z', first],
    ['past midnight in New York', '2026-10-09T05:00:00.000Z', first],
  ];
  for (const entry of accepted) need(problems, (await ask(entry[1], entry[2], newYork)).answer === true, 'a last talk ' + entry[0] + ' should be accepted');
  for (const entry of refused) need(problems, typeof (await ask(entry[1], entry[2], newYork)).answer === 'string', 'a last talk ' + entry[0] + ' should be refused');

  // The Look page's zone decides the day, so the same two times can be on different days
  const evening = ['2026-10-09T01:00:00.000Z', '2026-10-08T22:00:00.000Z'];
  need(problems, typeof (await ask(evening[0], evening[1], 'UTC')).answer === 'string', 'with the Look page time zone UTC, 22:00 and 01:00 UTC are on different days and should be refused');

  // No usable answer from Sanity means America/New_York
  const noAnswer = [['no Look page', null], ['an empty zone', ''], ['a zone Intl does not know', 'Nowhere/Land'], ['a question that fails', new Error('offline')]];
  for (const entry of noAnswer) {
    need(problems, (await ask(evening[0], evening[1], entry[1])).answer === true, 'with ' + entry[0] + ', the zone should be America/New_York, where those times are on the same day');
  }

  const question = (await ask('2026-10-08T20:45:00.000Z', first, newYork)).asked;
  need(problems, question && question.query.indexOf('"theme"') !== -1 && question.query.indexOf('timeZone') !== -1, 'the lookup should ask for the timeZone of the Look page, which has the id theme');
  need(problems, question && question.options && question.options.perspective === 'published', 'the lookup should read the published Look page (perspective published), as the screen does');
  return problems;
}

// Presentations: a first name, a title for the TV, a start, a length, a Google Slides
// link and a status. The slides link has to match the pattern the booking form and
// the slide fetcher on the Teletraan computer use, so a link that is not a Google Slides deck never gets in.
function checkPresentations() {
  const problems = [];
  const at = name => fieldAt('presentation.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const type = typeByName('presentation');
  if (!type) return ['presentation is missing from schemas/index.js'];

  need(problems, type.title === 'Presentation', 'the presentation type should have the title Presentation');
  const titles = { name: 'First name', subteam: 'Subteam', topic: 'Title shown on the TV', start: 'Starts at', minutes: 'Length of the talk', deckLink: 'Slides link', status: 'Status' };
  Object.keys(titles).forEach(name => need(problems, at(name) && at(name).title === titles[name], 'presentation.' + name + ' should be titled ' + titles[name]));

  ['name', 'topic', 'start', 'minutes', 'deckLink', 'status'].forEach(name => {
    need(problems, at(name) && constraintNamed(rulesOf(at(name)), 'required'), 'presentation.' + name + ' should be required');
  });
  need(problems, at('subteam') && !constraintNamed(rulesOf(at('subteam')), 'required') && /optional/i.test(at('subteam').description || ''), 'presentation.subteam should be optional, and its description should say so');
  need(problems, at('start') && at('start').type === 'datetime', 'presentation.start should be a datetime');

  // The name is a first name: a space or a digit is refused with a message, a hyphen is fine
  const firstName = constraintNamed(rulesOf(at('name')), 'custom');
  if (!firstName) {
    problems.push('presentation.name should be checked so that it is a first name only');
  } else {
    const run = firstName.args[0];
    ['Alex', 'Mary-Anne', "O'Neil", '', undefined].forEach(good => need(problems, run(good) === true, 'the name check refuses "' + good + '"'));
    ['Alex K', 'Alex2', ' Alex'].forEach(bad => need(problems, typeof run(bad) === 'string' && run(bad).length > 0, 'the name check accepts "' + bad + '"'));
  }
  need(problems, at('name') && /first name/i.test(at('name').description || ''), 'the presentation.name description should say first name');

  // The subteam is picked from a list and nothing else
  const subteam = at('subteam');
  const allowed = subteam ? constraintNamed(rulesOf(subteam), 'valid') : null;
  need(problems, allowed && allowed.args[0].join() === choices['presentation.subteam'].join(), 'presentation.subteam should only allow: ' + choices['presentation.subteam'].join(', '));

  // The length is whole minutes from 5 to 30 and starts at 15
  const minutes = at('minutes');
  const minutesRules = rulesOf(minutes);
  need(problems, minutes && minutes.type === 'number' && minutes.initialValue === 15, 'presentation.minutes should be a number that starts as 15');
  need(problems, constraintNamed(minutesRules, 'integer') && constraintNamed(minutesRules, 'min') && constraintNamed(minutesRules, 'max'), 'presentation.minutes should be a whole number with a smallest and a largest');
  need(problems, minutes && (minutes.description || '').indexOf('from 5 to 30') !== -1, 'the presentation.minutes description should give the range, from 5 to 30');

  // The dashboard cleans a talk with the same length, statuses and starting values (config.js)
  const config = world.dashboard;
  const least = constraintNamed(minutesRules, 'min');
  const most = constraintNamed(minutesRules, 'max');
  need(problems, least && most && least.args[0] === config.limits.talkMinutes.min && most.args[0] === config.limits.talkMinutes.max, 'presentation.minutes should have the limits in config.js, ' + JSON.stringify(config.limits.talkMinutes));
  need(problems, minutes && minutes.initialValue === config.defaultTalk.minutes, 'defaultTalk.minutes in config.js should be the starting length, ' + (minutes && minutes.initialValue));
  need(problems, config.talkStatuses.join() === choices['presentation.status'].join(), 'talkStatuses in config.js should be: ' + choices['presentation.status'].join(', '));
  need(problems, at('status') && at('status').initialValue === config.defaultTalk.status, 'defaultTalk.status in config.js should be the starting status, ' + (at('status') && at('status').initialValue));

  // The slides link: the pattern is the one the booking form uses, and only a Google Slides deck matches it
  const link = at('deckLink');
  const linkRule = constraintNamed(rulesOf(link), 'regex');
  need(problems, link && link.type === 'url', 'presentation.deckLink should be a url');
  if (!linkRule) {
    problems.push('presentation.deckLink should be checked with a pattern');
  } else {
    const pattern = linkRule.args[0];
    need(problems, pattern.source === new RegExp('^https://docs\\.google\\.com/presentation/d/[A-Za-z0-9_-]+').source, 'the presentation.deckLink pattern should be ^https://docs\\.google\\.com/presentation/d/[A-Za-z0-9_-]+');
    [
      'https://docs.google.com/presentation/d/1AbC-d_Ef',
      'https://docs.google.com/presentation/d/1AbC-d_Ef/edit?usp=sharing',
    ].forEach(good => need(problems, pattern.test(good), 'the slides link pattern refuses ' + good));
    [
      'http://docs.google.com/presentation/d/1AbC-d_Ef',
      'https://docs.google.com/document/d/1AbC-d_Ef',
      'https://docs.google.com/presentation/d/',
      'https://docs.google.com/presentation/d/%20',
      'https://docs.google.com.example.net/presentation/d/1AbC-d_Ef',
      'https://docsXgoogle.com/presentation/d/1AbC-d_Ef',
      ' https://docs.google.com/presentation/d/1AbC-d_Ef',
      'see https://docs.google.com/presentation/d/1AbC-d_Ef',
    ].forEach(bad => need(problems, !pattern.test(bad), 'the slides link pattern accepts ' + bad));
  }

  // The status is a radio list of four, scheduled to start with, and nothing else is allowed
  const status = at('status');
  const statusAllowed = status ? constraintNamed(rulesOf(status), 'valid') : null;
  need(problems, status && status.options && status.options.layout === 'radio' && status.initialValue === 'scheduled', 'presentation.status should be a radio list that starts as scheduled');
  need(problems, statusAllowed && statusAllowed.args[0].join() === choices['presentation.status'].join(), 'presentation.status should only allow: ' + choices['presentation.status'].join(', '));

  need(problems, (type.orderings || []).some(item => item.by && item.by[0].field === 'start' && item.by[0].direction === 'asc'), 'presentation needs an ordering by start, soonest first');
  checkPlainMessages('presentation', problems);

  // The list line, in New York time: the title, then when the talk starts and the first name. A talk that is not scheduled says so first.
  const talk = fields => type.preview.prepare(Object.assign({ start: '2026-10-08T18:45:00.000Z', name: 'Alex', topic: '[Talk title]' }, fields));
  [
    [talk({}).title, '[Talk title]'],
    [talk({ topic: undefined }).title, 'Talk with no title'],
    [talk({}).subtitle, 'Thu Oct 8, 2:45 PM · Alex'],
    [talk({ start: '2026-10-08T16:30:00.000Z' }).subtitle, 'Thu Oct 8, 12:30 PM · Alex'],
    [talk({ start: '2026-10-08T04:05:00.000Z' }).subtitle, 'Thu Oct 8, 12:05 AM · Alex'],
    [talk({ start: undefined }).subtitle, 'Alex'],
    [talk({ status: 'scheduled' }).subtitle, 'Thu Oct 8, 2:45 PM · Alex'],
    [talk({ subteam: 'Build' }).subtitle, 'Thu Oct 8, 2:45 PM · Alex · Build'],
    [talk({ status: 'cancelled', subteam: 'Build' }).subtitle, 'Cancelled · Thu Oct 8, 2:45 PM · Alex · Build'],
    [talk({ status: 'done' }).subtitle, 'Done · Thu Oct 8, 2:45 PM · Alex'],
    [talk({ status: 'skipped' }).subtitle, 'Skipped · Thu Oct 8, 2:45 PM · Alex'],
  ].forEach(entry => need(problems, entry[0] === entry[1], 'the presentation list should read "' + entry[1] + '", it reads "' + entry[0] + '"'));
  return problems;
}

// The Team type: a name, a short name, a number and a code, an optional logo, nine
// colors, the metal and the glow, the mirror switch, the active switch and the order. The starting colors are
// the Prime ones, which are the colors of the screen today (themes/hawktimus.css). The
// seed file docs/seed/teams.ndjson holds the two teams, and the Teams list comes right
// after Look in the sidebar.
const teamColorNames = ['primary', 'plate', 'accent', 'neon', 'pink', 'background', 'text', 'body', 'label', 'headerInk', 'dark', 'retro'];
// the colors added later are optional, because a team document made before has none and falls back on the screen
const optionalTeamColors = ['headerInk', 'dark', 'retro'];

function checkTeams() {
  const problems = [];
  const at = name => fieldAt('team.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const type = typeByName('team');
  if (!type) return ['team is missing from schemas/index.js'];

  need(problems, type.title === 'Teams', 'the team type should have the title Teams');
  const titles = {
    name: 'Team name', shortName: 'Short name', number: 'Team number', code: 'Team code', logo: 'Logo', colors: 'Colors', metal: 'Metal', palette: 'Palette', glow: 'Glow', mirror: 'Mirror the layout',
    bolts: 'Bolts', cornerCut: 'Cut corners', headerNotch: 'Header end', grid: 'Page grid', logoPose: 'Bird pose', nameStyle: 'Team name look', outlinedName: 'Outlined name', tickerLabel: 'Ticker label', countAccent: 'Countdown color',
    active: 'Active', order: 'Order',
  };
  Object.keys(titles).forEach(name => need(problems, at(name) && at(name).title === titles[name], 'team.' + name + ' should be titled ' + titles[name]));
  need(problems, fieldsIn(type).map(field => field.name).join() === Object.keys(titles).join(), 'the team fields should be, in this order: ' + Object.keys(titles).join(', '));

  ['name', 'shortName', 'code'].forEach(name => need(problems, constraintNamed(rulesOf(at(name)), 'required'), 'team.' + name + ' should be required'));
  ['number', 'logo'].forEach(name => {
    need(problems, at(name) && !constraintNamed(rulesOf(at(name)), 'required'), 'team.' + name + ' should be optional');
    need(problems, at(name) && /optional/i.test(at(name).description || ''), 'the team.' + name + ' description should say it is optional');
  });
  need(problems, at('logo') && /shared Hawktimus bird/.test(at('logo').description || ''), 'the team.logo description should say that empty means the shared Hawktimus bird');

  // The code is lowercase letters and digits, because the data and the screen use it
  const code = constraintNamed(rulesOf(at('code')), 'regex');
  if (!code) {
    problems.push('team.code should be checked so that it is lowercase');
  } else {
    ['prime', 'nova', 'team2'].forEach(good => need(problems, code.args[0].test(good), 'the team code pattern refuses ' + good));
    ['Prime', 'my team', 'team-2', 'team_2', 'prime\n', ''].forEach(bad => need(problems, !code.args[0].test(bad), 'the team code pattern accepts "' + bad + '"'));
  }

  // The nine colors, in this order, each needed and starting at the Prime value
  const seeded = {};
  world.teamSeed.split('\n').filter(line => line.trim() !== '').forEach(line => {
    try {
      const doc = JSON.parse(line);
      seeded[doc._id] = doc;
    } catch (error) {
      // checked with the seed file below
    }
  });
  const prime = seeded['team-prime'] || { colors: {} };

  need(problems, at('colors') && at('colors').type === 'object', 'team.colors should be an object');
  need(problems, fieldsIn(at('colors') || {}).map(field => field.name).join() === teamColorNames.join(), 'team.colors should hold, in this order: ' + teamColorNames.join(', '));
  teamColorNames.forEach(name => {
    const field = fieldAt('team.colors.' + name);
    const optional = optionalTeamColors.includes(name);
    need(problems, field && Boolean(constraintNamed(rulesOf(field), 'required')) === !optional, 'team.colors.' + name + (optional ? ' should be optional' : ' should be required'));
    need(problems, field && field.initialValue === prime.colors[name], 'team.colors.' + name + ' should start as ' + prime.colors[name] + ', the Prime value in the seed file, and it starts as ' + (field && field.initialValue));
  });

  // The metal is gold or steel, as teamMetals in dashboard/config.js has it, and starts on gold. The glow is a switch that starts off
  const metal = at('metal');
  need(problems, metal && metal.type === 'string' && metal.initialValue === 'gold' && metal.options && metal.options.layout === 'radio', 'team.metal should be a radio that starts on gold');
  need(problems, metal && metal.options && (metal.options.list || []).map(item => item.value).join() === Object.keys(world.dashboard.teamMetals).join(), 'team.metal should offer ' + Object.keys(world.dashboard.teamMetals).join(' and ') + ', as teamMetals in dashboard/config.js has them');
  need(problems, metal && constraintNamed(rulesOf(metal), 'valid'), 'team.metal should only accept its two values');
  const glow = at('glow');
  need(problems, glow && glow.type === 'boolean' && glow.initialValue === false, 'team.glow should be a switch that starts off');

  // The switches and the order
  const mirror = at('mirror');
  need(problems, mirror && mirror.type === 'boolean' && mirror.initialValue === false, 'team.mirror should be a switch that starts off');
  const active = at('active');
  need(problems, active && active.type === 'boolean' && active.initialValue === true, 'team.active should be a switch that starts on');
  const order = at('order');
  need(problems, order && order.type === 'number' && order.initialValue === 10, 'team.order should be a number that starts as 10');
  need(problems, constraintNamed(rulesOf(order), 'integer'), 'team.order should be a whole number');
  need(problems, order && /10/.test(order.description || ''), 'the team.order description should say that it starts at 10');

  need(problems, (type.orderings || []).some(item => item.by && item.by[0].field === 'order' && item.by[0].direction === 'asc'), 'team needs an ordering by order');
  need(problems, (type.orderings || []).some(item => item.by && item.by[0].field === 'name' && item.by[0].direction === 'asc'), 'team needs an ordering by name, A to Z');
  checkPlainMessages('team', problems);

  // The list line: the name and the number, then Mirror on or off. A team that is not active says Hidden first.
  const line = fields => type.preview.prepare(Object.assign({ title: 'Team Name', number: '1234', mirror: false }, fields));
  [
    [line({}).title, 'Team Name · 1234'],
    [line({}).subtitle, 'Mirror off'],
    [line({ active: true }).subtitle, 'Mirror off'],
    [line({ mirror: true }).subtitle, 'Mirror on'],
    [line({ mirror: undefined }).subtitle, 'Mirror off'],
    [line({ active: false }).subtitle, 'Hidden · Mirror off'],
    [line({ number: undefined }).title, 'Team Name'],
    [type.preview.prepare({}).title, 'Team with no name'],
  ].forEach(entry => need(problems, entry[0] === entry[1], 'the team list should read "' + entry[1] + '", it reads "' + entry[0] + '"'));
  need(problems, /Change the name, number or colors here and the screen follows\. The Monday board is not connected to this name; a rename there is done by hand\./.test(type.description || ''), 'the team document should open with its description about the name and number');
  need(problems, type.preview.select && type.preview.select.media === 'logo', 'the team list should show each logo (select media: logo)');

  // The Teams line is right after Dashboard Settings, under COACHES ONLY, and is a list sorted by order
  const entries = world.structure.sidebarEntries;
  const after = entries[entries.map(entry => entry.title).indexOf('Dashboard Settings') + 1];
  need(problems, after && after.kind === 'list' && after.type === 'team' && after.title === 'Teams', 'the Teams line should come right after Dashboard Settings under COACHES ONLY in structure.js');

  return problems.concat(checkTeamSeed(type));
}

// The seed file: one JSON document a line, fixed ids, only fields the Studio has. The
// values of the two teams are the ones in the work order, and the Prime ones that the
// order leaves out (the background and the text) are the colors of the screen today.
function checkTeamSeed(type) {
  const problems = [];
  const names = fieldsIn(type).map(field => field.name);
  const lines = world.teamSeed.split('\n').filter(line => line.trim() !== '');
  const docs = {};
  const hex = /^#[0-9A-Fa-f]{6}$/;

  const wanted = {
    'team-prime': { number: '3229', code: 'prime', mirror: false, metal: 'gold', glow: false, colors: { primary: '#6C18B6', plate: '#3B2A7A', accent: '#FACA2A', neon: '#FACA2A', pink: '#B23CFF', body: '#1A0F2E', label: '#FACA2A', headerInk: '#FFFFFF', dark: '#29054A', retro: '#FACA2A' } },
    'team-nova': { number: '3426', code: 'nova', mirror: true, metal: 'gold', glow: true, colors: { primary: '#D4A017', plate: '#6B4C08', accent: '#C86BFF', neon: '#B23CFF', pink: '#D4A017', background: '#17110A', body: '#241A04', label: '#D9A6FF', headerInk: '#1A1200', dark: '#3D2A05', retro: '#E0A400' } },
  };
  need(problems, lines.length === 2, 'docs/seed/teams.ndjson should have two teams, Prime and Nova, it has ' + lines.length);

  lines.forEach((line, index) => {
    const where = 'docs/seed/teams.ndjson line ' + (index + 1);
    let doc;
    try {
      doc = JSON.parse(line);
    } catch (error) {
      return problems.push(where + ' is not JSON');
    }

    docs[doc._id] = doc;
    need(problems, doc._type === 'team', where + ' should have _type team');
    need(problems, typeof doc._id === 'string' && doc._id === 'team-' + doc.code, where + ' should have a fixed _id that is team- and the code, such as team-prime');
    Object.keys(doc).forEach(key => need(problems, key.charAt(0) === '_' || names.indexOf(key) !== -1, where + ': ' + key + ' is not a field of team'));
    need(problems, typeof doc.name === 'string' && doc.name.length > 0 && doc.name.length <= 20, where + ' needs a name of 1 to 20 characters');
    need(problems, typeof doc.shortName === 'string' && doc.shortName.length > 0 && doc.shortName.length <= 8, where + ' needs a shortName of 1 to 8 characters');
    need(problems, typeof doc.number === 'string' && doc.number.length > 0 && doc.number.length <= 6, where + ' needs a number of 1 to 6 characters');
    need(problems, typeof doc.code === 'string' && /^[a-z0-9]{1,10}$/.test(doc.code), where + ' needs a code of 1 to 10 lowercase letters and digits');
    need(problems, doc.colors && Object.keys(doc.colors).join() === teamColorNames.join(), where + ' should have the colors ' + teamColorNames.join(', ') + ', in this order');
    teamColorNames.forEach(name => need(problems, doc.colors && hex.test(doc.colors[name]), where + ': colors.' + name + ' should be # and six hex characters'));
    need(problems, typeof doc.mirror === 'boolean', where + ' should have mirror true or false');
    need(problems, Object.keys(world.dashboard.teamMetals).indexOf(doc.metal) !== -1, where + ' should have the metal gold or steel');
    need(problems, typeof doc.glow === 'boolean', where + ' should have glow true or false');
    need(problems, doc.active === true, where + ' should have active true');
    need(problems, Number.isInteger(doc.order), where + ' should have a whole number for order');
  });

  Object.keys(wanted).forEach(id => {
    const doc = docs[id];
    if (!doc) return problems.push('docs/seed/teams.ndjson should have the team ' + id);
    const want = wanted[id];
    need(problems, doc.number === want.number && doc.code === want.code && doc.mirror === want.mirror, id + ' should have number ' + want.number + ', code ' + want.code + ' and mirror ' + want.mirror);
    need(problems, doc.metal === want.metal && doc.glow === want.glow, id + ' should have metal ' + want.metal + ' and glow ' + want.glow);
    Object.keys(want.colors).forEach(name => need(problems, doc.colors && doc.colors[name] === want.colors[name], id + ' should have colors.' + name + ' ' + want.colors[name]));
  });

  // Prime is the screen as it is today: its main color, accent, background and text are the Hawktimus theme's
  const themeColor = name => {
    const found = new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})').exec(world.hawktimusCss);
    return found ? found[1].toUpperCase() : '';
  };
  const prime = docs['team-prime'];
  if (prime && prime.colors) {
    [['primary', 'purple'], ['accent', 'yellow'], ['background', 'ground'], ['text', 'white']].forEach(entry => {
      need(problems, prime.colors[entry[0]] && prime.colors[entry[0]].toUpperCase() === themeColor(entry[1]), 'team-prime colors.' + entry[0] + ' should be the --' + entry[1] + ' of themes/hawktimus.css, ' + themeColor(entry[1]));
    });
  }
  const nova = docs['team-nova'];
  need(problems, !prime || !nova || prime.order < nova.order, 'Prime should come before Nova in order');
  return problems;
}

// The Team field: the same on every kind of content that can be for one team. It is
// optional and has no starting value, so empty means Both, and every item that exists
// keeps showing with no change. It uses the radio in team-input.js.
const teamTypes = ['task', 'milestone', 'plan', 'subteam', 'person', 'sponsor', 'presentation', 'presentationDay', 'customPanel', 'tipOrNews', 'announcement', 'extraEvent'];

function checkTeamField() {
  const problems = [];

  teamTypes.forEach(name => {
    const field = fieldAt(name + '.team');
    const where = name + '.team';
    if (!field) return problems.push(name + ' should have a team field');

    const words = field.description || '';
    need(problems, field.type === 'reference' && field.to && field.to.length === 1 && field.to[0].type === 'team', where + ' should be a reference to team');
    need(problems, field.title === 'Team', where + ' should be titled Team');
    need(problems, !constraintNamed(constraintsOf(field), 'required'), where + ' should be optional, because empty means Both');
    need(problems, field.initialValue === undefined, where + ' should have no starting value, so it starts on Both');
    need(problems, words === 'Leave blank when it is for both teams.', 'the ' + where + ' description should be "Leave blank when it is for both teams."');
    need(problems, field.components && field.components.input === world.teamInput.TeamInput, where + ' should use the radio input, TeamInput in studio/inputs/team-input.js (components.input)');
    need(problems, !(field.options && (field.options.disableNew || field.options.filter)), where + ' should be an ordinary reference to a team');
  });

  // No other kind of content points to a team, so the list above is the whole list
  world.types.forEach(type => {
    const field = fieldAt(type.name + '.team');
    const reference = field && field.type === 'reference';
    need(problems, !reference || type.name === 'view' || teamTypes.indexOf(type.name) !== -1, type.name + ' has a team reference that is not in teamTypes in tests/schemas.test.mjs');
  });
  return problems;
}

// The radio. The names and the choices come from the team documents, a team that cannot
// be read leaves Both, and the patches are the ones Studio gives (set and unset).
async function checkTeamInput() {
  const problems = [];
  const input = world.teamInput;
  const prime = { _id: 'team-prime', name: 'Hawktimus Prime', active: true };
  const nova = { _id: 'team-nova', name: 'Hawktimus Nova' };
  const listed = (teams, current) => input.teamChoices(teams, current).map(choice => choice.id + '=' + choice.label).join();

  // the choices
  const onlyBoth = '=Both';
  need(problems, listed([], '') === onlyBoth, 'with no teams the radio should show only Both, it shows ' + listed([], ''));
  [undefined, null, 'text', 5, {}, [null, {}, { _id: 5 }, 'text']].forEach(odd => need(problems, listed(odd, '') === onlyBoth, 'teams that are not a list of teams (' + JSON.stringify(odd) + ') should leave only Both'));
  need(problems, listed([prime, nova], '') === '=Both,team-prime=Hawktimus Prime,team-nova=Hawktimus Nova', 'Both and then each active team, in the order they are given, it shows ' + listed([prime, nova], ''));
  need(problems, listed([prime, Object.assign({}, nova, { active: false })], '') === '=Both,team-prime=Hawktimus Prime', 'a team that is not active should be left out');
  need(problems, listed([prime, Object.assign({}, nova, { active: false })], 'team-nova') === '=Both,team-prime=Hawktimus Prime,team-nova=Hawktimus Nova (not active)', 'a team that is not active but is picked should stay on the list, marked');
  need(problems, listed([prime], 'team-gone') === '=Both,team-prime=Hawktimus Prime,team-gone=A team that could not be read', 'a picked team that is not in the list should still be shown');
  need(problems, listed([], 'team-nova') === '=Both,team-nova=A team that could not be read', 'with no teams read, the picked team should still be shown');
  need(problems, listed([{ _id: 'team-x' }], '') === '=Both,team-x=Team with no name', 'a team with no name should still be a line');

  // the patches: Both clears the field, a team writes a reference
  need(problems, JSON.stringify(input.teamPatch('')) === JSON.stringify({ type: 'unset' }), 'picking Both should clear the field (unset)');
  need(problems, JSON.stringify(input.teamPatch('team-nova')) === JSON.stringify({ type: 'set', value: { _type: 'reference', _ref: 'team-nova' } }), 'picking a team should write a reference to it (set)');

  // reading the teams: the published ones, in order, and nothing that throws
  function clientAnswering(answer) {
    const asked = [];
    return { asked: asked, fetch: async (query, params, options) => { asked.push({ query: query, options: options }); if (answer instanceof Error) throw answer; return answer; } };
  }
  const good = clientAnswering([prime, nova]);
  need(problems, JSON.stringify(await input.readTeams(good)) === JSON.stringify({ teams: [prime, nova], unreadable: false }), 'readTeams should give the teams it is given');
  need(problems, good.asked[0] && good.asked[0].options && good.asked[0].options.perspective === 'published', 'readTeams should read the published teams (perspective published)');
  need(problems, good.asked[0] && good.asked[0].query.indexOf('_type == "team"') !== -1 && /order\(order asc/.test(good.asked[0].query), 'readTeams should ask for the teams, by order');
  need(problems, JSON.stringify(await input.readTeams(clientAnswering(null))) === JSON.stringify({ teams: [], unreadable: false }), 'readTeams with no answer should give no teams');
  const failing = [
    ['a question that fails', clientAnswering(new Error('offline'))],
    ['a client that throws at once', { fetch: () => { throw new Error('no client'); } }],
    ['a client with no fetch', {}],
    ['no client', null],
  ];
  for (const entry of failing) {
    const result = await input.readTeams(entry[1]);
    need(problems, JSON.stringify(result) === JSON.stringify({ teams: [], unreadable: true }), 'readTeams with ' + entry[0] + ' should give no teams and say they could not be read');
  }

  // the screen of it: a radio group, Both first and picked when nothing is, and a team picked when it is the value
  function collect(node, test, found) {
    if (Array.isArray(node)) node.forEach(item => collect(item, test, found));
    else if (node && typeof node === 'object') {
      if (test(node)) found.push(node);
      collect(node.children || [], test, found);
    }
    return found;
  }
  const radios = view => collect(view, node => node.type === 'input' && node.props.type === 'radio', []);
  const patches = [];
  const show = (value, readOnly) => input.TeamInput({ id: 'team', value: value, readOnly: readOnly, onChange: patch => patches.push(patch) });

  const empty = show(undefined, false);
  need(problems, collect(empty, node => node.props && node.props.role === 'radiogroup', []).length === 1, 'the input should be one radio group');
  need(problems, radios(empty).length === 1 && radios(empty)[0].props.checked === true && radios(empty)[0].props.disabled === false, 'with no value and no teams read, the input should show Both, picked');
  radios(empty)[0].props.onChange();
  need(problems, JSON.stringify(patches) === JSON.stringify([{ type: 'unset' }]), 'picking Both in the input should clear the field');

  const picked = radios(show({ _type: 'reference', _ref: 'team-nova' }, false));
  need(problems, picked.length === 2 && picked[0].props.checked === false && picked[1].props.checked === true, 'with a team as the value, that team should be the one picked');
  picked[1].props.onChange();
  need(problems, JSON.stringify(patches[1]) === JSON.stringify({ type: 'set', value: { _type: 'reference', _ref: 'team-nova' } }), 'picking a team in the input should write a reference to it');
  need(problems, radios(show(undefined, true)).every(radio => radio.props.disabled === true), 'a field that is read only should have every line off');
  need(problems, radios(show({ _ref: 5 }, false)).length === 1, 'a value that is not a reference should be read as Both');
  return problems;
}

// The team fields of Dashboard Settings: the mode and the minutes of Alternate. The
// choices, the limits and the starting values are the ones in dashboard/config.js.
// Neither is required, because Dashboard Settings published before the fields existed has
// neither and must still publish, and the screen reads that as Prime only and 5 minutes.
const teamNames = ['teamMode', 'alternateMinutes'];
const rotationNames = ['dailyStyles', 'mondayStyle', 'teamOrder', 'lookSwap'];

function checkTeamsTab() {
  const problems = [];
  const config = world.dashboard;
  const settings = typeByName('dashboardSettings');
  const at = name => fieldAt('dashboardSettings.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);

  const inOrder = fieldsIn(settings).map(field => field.name).filter(name => teamNames.indexOf(name) !== -1);
  need(problems, inOrder.join() === teamNames.join(), 'the team fields should come in this order: ' + teamNames.join(', ') + ', not ' + inOrder.join(', '));

  need(problems, at('teamMode') && at('teamMode').title === 'Team mode', 'teamMode should be titled Team mode');
  need(problems, at('alternateMinutes') && at('alternateMinutes').title === 'Minutes for each team', 'alternateMinutes should be titled Minutes for each team');

  // The mode is a radio list of the names in config.js, Prime only to start with
  const mode = at('teamMode');
  const modeRules = rulesOf(mode);
  const allowed = constraintNamed(modeRules, 'valid');
  const offered = choicesOf('dashboardSettings.teamMode');
  const modeTitles = { prime: 'Prime only', nova: 'Nova only', alternate: 'Alternate' };
  need(problems, config.teamModes.join() === 'prime,nova,alternate', 'teamModes in config.js should be prime, nova and alternate, not ' + config.teamModes.join());
  need(problems, mode && mode.type === 'string' && mode.options && mode.options.layout === 'radio', 'teamMode should be a radio list');
  need(problems, offered.map(item => item.value).join() === config.teamModes.join(), 'teamMode should offer the names in config.js, in the same order: ' + config.teamModes.join(', '));
  offered.forEach(item => need(problems, item.title === modeTitles[item.value], 'the team mode ' + item.value + ' should be titled ' + modeTitles[item.value]));
  need(problems, allowed && allowed.args[0].join() === config.teamModes.join(), 'teamMode should only allow: ' + config.teamModes.join(', '));
  need(problems, !constraintNamed(modeRules, 'required'), 'teamMode should not be required: an empty mode is Prime only, and the page must still publish');
  need(problems, mode && mode.initialValue === 'prime' && config.defaultSettings.teamMode === 'prime', 'teamMode should start as prime, and so should its default in config.js');
  need(problems, mode && /Alternate/.test(mode.description || '') && /Prime only/.test(mode.description || ''), 'the teamMode description should say what Prime only and Alternate do');

  // The minutes are whole, 1 to 30, 5 to start with, and the description gives the range
  const minutes = at('alternateMinutes');
  const minutesRules = rulesOf(minutes);
  const low = constraintNamed(minutesRules, 'min');
  const high = constraintNamed(minutesRules, 'max');
  need(problems, sameData(config.limits.alternateMinutes, { min: 1, max: 30 }), 'limits.alternateMinutes in config.js should be 1 to 30');
  need(problems, minutes && minutes.type === 'number' && minutes.initialValue === 5 && config.defaultSettings.alternateMinutes === 5, 'alternateMinutes should be a number that starts as 5, and so should its default in config.js');
  need(problems, low && high && low.args[0] === config.limits.alternateMinutes.min && high.args[0] === config.limits.alternateMinutes.max, 'alternateMinutes should have the limits in config.js, ' + JSON.stringify(config.limits.alternateMinutes));
  need(problems, constraintNamed(minutesRules, 'integer'), 'alternateMinutes should be a whole number');
  need(problems, !constraintNamed(minutesRules, 'required'), 'alternateMinutes should not be required: an empty one is 5, and the page must still publish');
  need(problems, minutes && /from 1 to 30/.test(minutes.description || ''), 'the alternateMinutes description should give the range, from 1 to 30');
  teamNames.forEach(name => need(problems, rulesOf(at(name)).some(rule => rule.name === 'error' && rule.args[0]), name + ' has rules and no error message in plain words'));

  // The sample content carries the settings, with values the dashboard accepts
  const sample = world.sample.settings;
  need(problems, config.teamModes.indexOf(sample.teamMode) !== -1, 'the sample settings need a teamMode of ' + config.teamModes.join(', '));
  need(problems, sample.alternateMinutes >= config.limits.alternateMinutes.min && sample.alternateMinutes <= config.limits.alternateMinutes.max, 'the sample settings need alternateMinutes from ' + config.limits.alternateMinutes.min + ' to ' + config.limits.alternateMinutes.max);
  return problems;
}

// The tabs of Dashboard Settings, in order, and the tab of every field. A new field has to be given a
// tab here. Advanced is the last tab because Studio has no tab that starts folded. Screen opens first.
// The order of the fields inside a tab is the order of the fields in dashboardSettings.js.
const settingsTabTitles = ['Screen', 'Logo and motion', 'Countdown', 'Calendars', 'Presentations', 'Monday', 'Competition', 'Advanced'];
const logoNames = logoSwitches.concat(logoNumbers);
const competitionNames = ['competitionTimeline', 'competitionLastSeason', 'competitionRank', 'competitionNextMatch', 'competitionResults', 'competitionAlliance', 'competitionDistrict'];
const settingsTabs = {
  screen: ['miniStatus', 'team', 'motion', 'speed', 'frameMetal', 'glint', 'look', 'crt', 'previewRequest', 'nextLookRequest', 'competitionPreviewRequest', 'holdPanel', 'showView', 'previewTheme', 'pauseRotation', 'alert', 'pageSeconds', 'partsRequestUrl', 'rotation', 'doneDays', 'safetyDaysSince']
    .concat(photoNames, ['announcements', 'announceRequest']),
  look: ['lookNote', 'cycleNote', 'generalViewName', 'generalViewTitle', 'viewOrder', 'themeByWeekday', 'background', 'screenSchedule'].concat(rotationNames, ['style'], teamNames, logoNames, transitionNames, ['transitionSeconds']),
  countdown: ['countdown'],
  calendars: ['calendars', 'groupEventsByKind'],
  presentations: presentationNames.concat('presentationTestRequest'),
  monday: ['mondayConnection', 'mondayTokenTest', 'mondayEveryMinutes', 'mondayTaskBoard', 'mondayMilestoneBoard', 'mondayShowOwners', 'mondayBoards'],
  competition: ['frcConnection', 'competitionMode'].concat(competitionNames),
  advanced: nightNames.concat(hiddenNames, ['contentSource', 'showConnectionStatus', 'rotationRows']),
};

function checkSettingsTabs() {
  const problems = [];
  const settings = typeByName('dashboardSettings');
  const fields = fieldsIn(settings);

  // The tabs are these eight, in this order, and only Screen is the default
  need(problems, settings.groups.map(group => group.title).join() === settingsTabTitles.join(), 'Dashboard Settings should have these tabs, in this order: ' + settingsTabTitles.join(', ') + '. It has: ' + settings.groups.map(group => group.title).join(', '));
  need(problems, settings.groups.map(group => group.name).join() === Object.keys(settingsTabs).join(), 'the tabs should be the groups ' + Object.keys(settingsTabs).join(', '));
  need(problems, settings.groups.filter(group => group.default === true).map(group => group.name).join() === 'screen', 'Screen should be the one tab that opens first (default: true)');

  // Every field is in the tab the table says, and the table has no field the schema lacks
  Object.keys(settingsTabs).forEach(tab => {
    settingsTabs[tab].forEach(name => {
      const field = fields.filter(item => item.name === name)[0];
      if (!field) return problems.push(name + ' is in the ' + tab + ' tab in tests/schemas.test.mjs, and Dashboard Settings has no such field');
      need(problems, field.group === tab, name + ' should be in the ' + tab + ' tab, not ' + field.group);
    });
  });
  const listed = Object.keys(settingsTabs).reduce((all, tab) => all.concat(settingsTabs[tab]), []);
  fields.forEach(field => need(problems, listed.indexOf(field.name) !== -1, field.name + ' is not in settingsTabs in tests/schemas.test.mjs. Decide which tab it belongs in and add it.'));
  need(problems, new Set(listed).size === listed.length, 'a field is in two tabs in settingsTabs');

  // The status block and the notes are the first field of their tab
  const first = tab => fields.filter(field => field.group === tab)[0];
  need(problems, first('screen') && first('screen').name === 'miniStatus', 'the status block miniStatus should be the first field of the Screen tab');
  need(problems, first('look') && first('look').name === 'lookNote', 'the first field of the Look tab should be its note, lookNote');
  need(problems, first('monday') && first('monday').name === 'mondayConnection', 'the first field of the Monday tab should be the connection block, mondayConnection');
  need(problems, first('competition') && first('competition').name === 'frcConnection', 'the first field of the Competition tab should be the connection block, frcConnection');

  // The fields that leave the form stay in the schema
  ['contentSource'].forEach(name => need(problems, fieldAt('dashboardSettings.' + name) && fieldAt('dashboardSettings.' + name).hidden === true, name + ' should be hidden but stay in the schema'));

  // The notes store nothing and say one thing each in one line, and the Look tab and the Look page point to each other
  const notes = ['dashboardSettings.lookNote', 'dashboardSettings.cycleNote', 'theme.settingsNote'];
  notes.forEach(pathText => {
    const field = fieldAt(pathText);
    need(problems, field && field.type === 'string' && field.readOnly === true && field.title === 'Note', pathText + ' should be a read only string titled Note');
    need(problems, field && field.initialValue === undefined && !field.validation, pathText + ' should store nothing: no starting value and no rules');
    need(problems, field && field.components && typeof field.components.field === 'function', pathText + ' should draw itself with a field component (note-field.js)');
  });
  const lookNote = fieldAt('dashboardSettings.lookNote');
  const themeNote = fieldAt('theme.settingsNote');
  need(problems, lookNote && /Look/.test(lookNote.description || '') && /sidebar/.test(lookNote.description || ''), 'the note on the Look tab should point to Look in the sidebar');
  need(problems, themeNote && /Themes and backgrounds page/.test(themeNote.description || ''), 'the note on the Look page should point to the Themes and backgrounds page');
  need(problems, fieldsIn(typeByName('theme'))[0].name === 'settingsNote', 'the note should be the first field of the Look page');
  need(problems, world.noteField.NoteField({ schemaType: { description: 'A line.' } }).children[0] === 'A line.' && world.noteField.NoteField({ schemaType: {} }) === null, 'NoteField should draw the description, and nothing without one');

  // The status block: a read only field with an input of its own that stores nothing
  const status = fieldAt('dashboardSettings.miniStatus');
  need(problems, status && status.type === 'string' && status.readOnly === true, 'miniStatus should be a read only string');
  need(problems, status && status.initialValue === undefined && !status.validation, 'miniStatus should store nothing: no starting value and no rules');
  need(problems, status && status.components && typeof status.components.input === 'function', 'miniStatus should have an input component (status-input.js)');
  const source = readModule(path.join(here, 'inputs', 'status-input.js'), 'utf8');
  need(problems, !/onChange|\bset\(|unset\(|patch/.test(source), 'status-input.js should never change the value: no onChange, set, unset or patch');
  return problems;
}

// The watchdog and backup lines of the status block (status-input.js, watchdog.sh, backup-dataset.sh)
function checkStatusWatchdog() {
  const problems = [];
  const type = typeByName('status');
  const input = world.statusInput;
  const names = ['kioskRestarts', 'lastKioskRestartAt', 'lastBackupAt'];
  const at = name => fieldsIn(type || {}).find(field => field.name === name);

  need(problems, input.watchdogFields.join() === names.join(), 'the watchdog lines should read these fields: ' + names.join(', '));
  need(problems, at('kioskRestarts') && at('kioskRestarts').type === 'number', 'status.kioskRestarts should be a number');
  need(problems, at('lastKioskRestartAt') && at('lastKioskRestartAt').type === 'datetime', 'status.lastKioskRestartAt should be a datetime');
  need(problems, at('lastBackupAt') && at('lastBackupAt').type === 'datetime', 'status.lastBackupAt should be a datetime');
  names.forEach(name => {
    need(problems, at(name) && !constraintNamed(constraintsOf(at(name)), 'required'), 'status.' + name + ' should not be required');
    need(problems, world.statusScript.indexOf(name) !== -1, 'status-write.sh should write the field ' + name);
  });

  const now = new Date('2026-10-09T15:00:00.000Z');
  const ago = minutes => new Date(now.getTime() - minutes * 60000).toISOString();
  const none = input.describeWatchdog(null, now);
  need(problems, none.length === 2 && none[0].label === 'Screen restarts today' && none[0].text === '0' && none[1].label === 'Last backup' && none[1].text === 'Not yet', 'a missing document should say 0 restarts and Not yet for the backup');
  const some = input.describeWatchdog({ kioskRestarts: 2, lastKioskRestartAt: ago(5), lastBackupAt: ago(600) }, now);
  need(problems, some[0].text === '2 (last 5 minutes ago)', 'two restarts today should read 2 and when the last was, not ' + some[0].text);
  need(problems, /^10 hours ago \(/.test(some[1].text), 'a backup ten hours ago should read 10 hours ago, not ' + some[1].text);
  const old = input.describeWatchdog({ kioskRestarts: 3, lastKioskRestartAt: ago(3 * 24 * 60) }, now);
  need(problems, old[0].text === '0', 'restarts from an earlier day should not count as today');
  need(problems, JSON.stringify(input.statusView({ doc: {}, unreadable: false }, now)).indexOf('Last backup') !== -1, 'the block should show the Last backup line');
  return problems;
}

// The status document the Teletraan computer writes (schemas/status.js, computer/scripts/status-write.sh) and the block that shows it
function checkStatusBlock() {
  const problems = [];
  const type = typeByName('status');
  const wanted = ['lastContentSeenAt', 'lastCalendarSyncAt', 'lastSlidesFetchAt', 'lastMondaySyncAt', 'lastFrcSyncAt', 'kioskStartedAt'];
  const input = world.statusInput;

  need(problems, type && type.type === 'document', 'status should be a document type');
  const build = ['buildCommit', 'buildDate', 'buildBranch'];
  need(problems, type && fieldsIn(type).map(field => field.name).slice(0, wanted.length + build.length).join() === wanted.concat(build).join(), 'status should start with these fields, in this order: ' + wanted.concat(build).join(', '));
  fieldsIn(type || {}).filter(field => wanted.concat(build).includes(field.name)).forEach(field => {
    if (build.indexOf(field.name) !== -1) return need(problems, field.type === 'string', 'status.' + field.name + ' should be a string');
    need(problems, field.type === 'datetime', 'status.' + field.name + ' should be a datetime');
    need(problems, !constraintNamed(constraintsOf(field), 'required'), 'status.' + field.name + ' should not be required: the Teletraan computer writes each one after its own job');
  });
  need(problems, type && type.readOnly === true, 'status should be read only: the Teletraan computer writes it');
  need(problems, type && type.__experimental_omnisearch_visibility === false, 'status should be kept out of Studio search');
  need(problems, input.statusId === 'status-mini', 'the status document should have the fixed id status-mini');
  need(problems, input.statusLines.map(line => line.field).join() === wanted.join(), 'the block should show these fields, in this order: ' + wanted.join(', '));

  // Editors never find it: no line in the sidebar and no place in the New menu
  need(problems, allLines(world.structure.sidebarEntries).every(entry => entry.type !== 'status'), 'the sidebar should have no line for the status document');
  const offered = world.config.document.newDocumentOptions([{ templateId: 'status' }, { templateId: 'plan' }], {}).map(item => item.templateId).join();
  need(problems, offered === 'plan', 'the New menu should not offer the status document');

  // The script on the Teletraan computer writes the same document and fields
  const script = world.statusScript;
  need(problems, script.indexOf("'" + input.statusId + "'") !== -1 || script.indexOf('"' + input.statusId + '"') !== -1 || script.indexOf('=' + input.statusId) !== -1, 'status-write.sh should write the document ' + input.statusId);
  wanted.concat(build).forEach(name => need(problems, script.indexOf(name) !== -1, 'status-write.sh should write the field ' + name));

  // The build on the wall: a hash and a date, or not yet
  need(problems, input.buildLine({ buildCommit: 'abc1234', buildDate: '2026-10-14' }) === 'On the wall: abc1234 · 2026-10-14', 'the build line should read On the wall: <hash> · <date>');
  need(problems, input.buildLine({ buildCommit: 'abc1234' }) === 'On the wall: abc1234' && input.buildLine(null) === 'On the wall: not yet' && input.buildLine({ buildCommit: 5 }) === 'On the wall: not yet', 'the build line should survive a missing date, a missing document and a bad value');
  need(problems, JSON.stringify(input.statusView({ doc: { buildCommit: 'abc1234', buildDate: '2026-10-14' }, unreadable: false }, new Date())).indexOf('On the wall: abc1234') !== -1, 'the block should show the build on the wall');

  // The ages in words, the lines, and a document that is missing or cannot be read
  const now = new Date('2026-10-09T15:00:00.000Z');
  const ago = minutes => new Date(now.getTime() - minutes * 60000).toISOString();
  need(problems, input.ageText(ago(0), now) === 'just now' && input.ageText(ago(-5), now) === 'just now', 'a time that is now or ahead of the clock should read just now');
  need(problems, input.ageText(ago(1), now) === '1 minute ago' && input.ageText(ago(5), now) === '5 minutes ago', 'ages in minutes should read 1 minute ago and 5 minutes ago');
  need(problems, input.ageText(ago(60), now) === '1 hour ago' && input.ageText(ago(180), now) === '3 hours ago', 'ages in hours should read 1 hour ago and 3 hours ago');
  need(problems, input.ageText(ago(3 * 24 * 60), now) === '3 days ago', 'an age of three days should read 3 days ago');
  need(problems, [undefined, null, '', 'soon', 5, {}].every(value => input.ageText(value, now) === ''), 'a time that cannot be read should give no words');
  const none = input.describeStatus(null, now);
  need(problems, none.length === 6 && none.every(line => line.text === 'Not yet'), 'a missing document should give six lines that all say Not yet');
  const some = input.describeStatus({ lastCalendarSyncAt: ago(5), kioskStartedAt: 'oops' }, now);
  need(problems, some[1].label === 'Last calendar sync' && /^5 minutes ago \(/.test(some[1].text) && some[0].text === 'Not yet' && some[5].text === 'Not yet', 'a line should say its age and its time, and Not yet when the time is missing or unreadable');
  need(problems, JSON.stringify(input.statusView(null, now)).indexOf('Reading the status') !== -1, 'the block should say it is reading while it waits');
  need(problems, JSON.stringify(input.statusView({ doc: null, unreadable: false }, now)).indexOf('No status yet') !== -1, 'the block should say No status yet when the document is missing');
  need(problems, JSON.stringify(input.statusView({ doc: null, unreadable: true }, now)).indexOf('could not be read') !== -1, 'the block should say so when the status cannot be read');
  need(problems, JSON.stringify(input.statusView({ doc: { lastCalendarSyncAt: ago(5) }, unreadable: false }, now)).indexOf('Last calendar sync') !== -1, 'the block should show the lines when there is a document');
  need(problems, typeof input.StatusInput === 'function' && JSON.stringify(input.StatusInput()).indexOf('Reading the status') !== -1, 'StatusInput should start by saying it is reading');
  return problems;
}

// readStatus asks the published document by its id, and never fails. The stand-in client gives the answers.
async function checkStatusRead() {
  const problems = [];
  const read = world.statusInput.readStatus;
  const asked = [];
  const answering = value => ({ fetch: async (...args) => { asked.push(args); return value; } });

  const found = await read(answering({ _id: 'status-mini', lastCalendarSyncAt: '2026-10-09T15:00:00.000Z' }));
  need(problems, found.doc && found.doc._id === 'status-mini' && found.unreadable === false, 'a document that is there should be handed over');
  need(problems, asked.length === 1 && /_id == \$id/.test(asked[0][0]) && asked[0][1].id === 'status-mini' && asked[0][2].perspective === 'published', 'readStatus should ask for the published document with the id status-mini');
  need(problems, sameData(await read(answering(null)), { doc: null, unreadable: false }), 'no document is a good answer, not a failure');
  need(problems, sameData(await read(answering('text')), { doc: null, unreadable: false }), 'an answer that is not a document should be read as no document');
  need(problems, sameData(await read({ fetch: async () => { throw new Error('offline'); } }), { doc: null, unreadable: true }), 'a client that fails should give unreadable');
  need(problems, sameData(await read({}), { doc: null, unreadable: true }), 'a client with no fetch should give unreadable');
  return problems;
}

// The Competition tab of Dashboard Settings (schemas/settingsCompetition.js): the connection block, the
// mode and one switch for each competition card. The names, the choices and the starting values are the
// ones in dashboard/config.js, and each switch is a card in dashboard/core/competition.js and a panel in
// dashboard/registry.js.
function checkCompetitionTab() {
  const problems = [];
  const config = world.dashboard;
  const at = name => fieldAt('dashboardSettings.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);

  // The mode is a radio list of the names in config.js, Auto to start with, and not required
  const mode = at('competitionMode');
  const modeRules = rulesOf(mode);
  const allowed = constraintNamed(modeRules, 'valid');
  const offered = choicesOf('dashboardSettings.competitionMode');
  const modeTitles = { auto: 'Auto', always: 'Always', off: 'Off' };
  need(problems, config.competitionModes.join() === 'auto,always,off', 'competitionModes in config.js should be auto, always and off, not ' + config.competitionModes.join());
  need(problems, mode && mode.type === 'string' && mode.options && mode.options.layout === 'radio', 'competitionMode should be a radio list');
  need(problems, offered.map(item => item.value).join() === config.competitionModes.join(), 'competitionMode should offer the names in config.js, in the same order: ' + config.competitionModes.join(', '));
  offered.forEach(item => need(problems, item.title === modeTitles[item.value], 'the competition mode ' + item.value + ' should be titled ' + modeTitles[item.value]));
  need(problems, allowed && allowed.args[0].join() === config.competitionModes.join(), 'competitionMode should only allow: ' + config.competitionModes.join(', '));
  need(problems, !constraintNamed(modeRules, 'required'), 'competitionMode should not be required: an empty mode is Auto, and the page must still publish');
  need(problems, mode && mode.initialValue === 'auto' && config.defaultSettings.competitionMode === 'auto', 'competitionMode should start as auto, and so should its default in config.js');
  need(problems, mode && /Auto/.test(mode.description || '') && /Always/.test(mode.description || '') && /Off/.test(mode.description || ''), 'the competitionMode description should say what Auto, Always and Off do');

  // One switch for each card, in this order, all on to start with, in the names of config.js
  const titles = ['Season timeline', 'Last season at a glance', 'Live rank', 'Next match', 'Results strip', 'Alliance board', 'District points'];
  need(problems, config.competitionSwitches.join() === competitionNames.join(), 'competitionSwitches in config.js should be the switches of the Competition tab, in order: ' + competitionNames.join(', '));
  competitionNames.forEach((name, index) => {
    const field = at(name);
    need(problems, field && field.type === 'boolean' && field.initialValue === true && config.defaultSettings[name] === true, name + ' should be a switch that starts on, and so should its default in config.js');
    need(problems, field && field.title === titles[index], name + ' should be titled ' + titles[index]);
    need(problems, field && field.group === 'competition' && rulesOf(field).length === 0, name + ' should be in the Competition tab and have no rules');
    need(problems, world.sample.settings[name] === true, 'the sample settings need ' + name);
  });
  need(problems, config.competitionModes.indexOf(world.sample.settings.competitionMode) !== -1, 'the sample settings need a competitionMode of ' + config.competitionModes.join(', '));

  // Each switch is a card of the dashboard, and each card is a panel with the competition flag in registry.js
  const cards = world.competition.cards;
  need(problems, cards.map(card => card.setting).sort().join() === competitionNames.slice().sort().join(), 'the cards in core/competition.js should have the switches of the Competition tab: ' + competitionNames.join(', '));
  const flagged = world.registry.panels.filter(panel => panel.competition).map(panel => panel.id);
  need(problems, flagged.slice().sort().join() === cards.map(card => card.id).sort().join(), 'registry.js should have a panel with competition: true for each card in core/competition.js: ' + cards.map(card => card.id).join(', '));
  flagged.forEach(id => need(problems, world.registry.panels.filter(panel => panel.id === id)[0].region === 'grid1', id + ' should be in the large panel, grid1'));
  const rotation = [].concat(config.defaultSettings.rotation.grid1, config.defaultSettings.rotation.grid2).map(step => step.panel);
  flagged.forEach(id => need(problems, rotation.indexOf(id) === -1 && choicesOf('dashboardSettings.rotation.order.panel').every(item => item.value !== id), id + ' should not be in Panel order or the rotation lists of config.js: the Competition tab switches it'));

  // The connection block stores nothing, and its input never changes the value
  const block = at('frcConnection');
  need(problems, block && block.type === 'string' && block.readOnly === true, 'frcConnection should be a read only string');
  need(problems, block && block.initialValue === undefined && !block.validation, 'frcConnection should store nothing: no starting value and no rules');
  need(problems, block && block.components && block.components.input === world.frcStatusInput.FrcStatusInput, 'frcConnection should draw itself with FrcStatusInput (frc-status-input.js)');
  const source = readModule(path.join(here, 'inputs', 'frc-status-input.js'), 'utf8');
  need(problems, !/onChange|\bset\(|unset\(|patch/.test(source), 'frc-status-input.js should never change the value: no onChange, set, unset or patch');
  return problems;
}

// The FRC data document the Teletraan computer writes (schemas/frcStatus.js, computer/scripts/frc-sync.sh) and the
// block that shows it. The dashboard reads the document with the rest of the content (core/sanity.js).
function checkFrcStatus() {
  const problems = [];
  const type = typeByName('frcStatus');
  const input = world.frcStatusInput;
  const script = world.frcScript;

  need(problems, type && type.type === 'document', 'frcStatus should be a document type');
  need(problems, type && type.readOnly === true, 'frcStatus should be read only: the Teletraan computer writes it');
  need(problems, type && type.__experimental_omnisearch_visibility === false, 'frcStatus should be kept out of Studio search');
  need(problems, input.frcStatusId === 'frc-status', 'the FRC data document should have the fixed id frc-status');
  need(problems, script.indexOf('_id: "frc-status"') !== -1 && script.indexOf('_type: "frcStatus"') !== -1, 'frc-sync.sh should write the document frc-status of the type frcStatus');
  need(problems, world.sanitySource.indexOf('"frc": *[_id == "frc-status"][0]') !== -1, 'the content query in core/sanity.js should read the document frc-status');

  // The Teletraan computer does not know which fields are required, so none is, at any depth
  eachField((where, field) => {
    if (where.split('.')[0] !== 'frcStatus') return;
    need(problems, !constraintNamed(constraintsOf(field), 'required'), where + ' should not be required: the Teletraan computer leaves out what it did not find');
  });

  // The fields are the ones the dashboard cleans (core/frc.js), the sample uses, and the script writes
  const sample = world.sample.frc;
  need(problems, sample && sample.sample === true, 'the sample content needs frc with sample: true, so the cards say SAMPLE');
  unknownKeys(without(sample || {}, 'sample'), fieldsIn(type || {}), 'sample frc').forEach(message => problems.push(message));
  const named = fields => fields.map(field => field.name);
  const teamFields = fieldsIn(fieldAt('frcStatus.teams'));
  const eventFields = fieldsIn(fieldAt('frcStatus.teams.events'));
  [named(fieldsIn(type || {})), named(teamFields), named(eventFields)].forEach(names => {
    names.forEach(name => need(problems, script.indexOf(name + ':') !== -1, 'frc-sync.sh should write the field ' + name));
  });
  need(problems, named(teamFields).join() === 'team,number,key,events,focusEvent,nextMatch,results,ranking,alliance,awards,epa,districtPoints,snapshots,lastSeason', 'frcStatus.teams should have these fields, in this order: team, number, key, events, focusEvent, nextMatch, results, ranking, alliance, awards, epa, districtPoints, snapshots, lastSeason');

  // Editors never find it: no line in the sidebar and no place in the New menu
  need(problems, allLines(world.structure.sidebarEntries).every(entry => entry.type !== 'frcStatus'), 'the sidebar should have no line for the FRC data document');
  const offered = world.config.document.newDocumentOptions([{ templateId: 'frcStatus' }, { templateId: 'plan' }], {}).map(item => item.templateId).join();
  need(problems, offered === 'plan', 'the New menu should not offer the FRC data document');

  // The lines of the block, in plain words, and a document that is missing or cannot be read
  const now = new Date('2027-03-12T15:00:00.000Z');
  const ago = minutes => new Date(now.getTime() - minutes * 60000).toISOString();
  const none = input.describeFrcStatus(null, now);
  need(problems, none.length === 3 && none[0].text === 'Not yet' && none[1].text === 'No team was read' && none[2].label === 'Last error' && none[2].text === 'None', 'a missing document should say Not yet, that no team was read, and no error');
  const some = input.describeFrcStatus({ lastSyncAt: ago(5), lastError: 'a key was refused', notes: ['A source was skipped.'], teams: [{ team: 'prime', number: 3229, events: 3 }, { team: 'nova', number: 3426, events: 0 }] }, now);
  need(problems, /^5 minutes ago \(/.test(some[0].text), 'the first line should say how long ago the Teletraan computer last read the data');
  need(problems, some[1].label === 'Events found, prime 3229' && some[1].text === '3 events' && some[2].label === 'Events found, nova 3426' && some[2].text === 'None', 'each team should have a line with the number of events the Teletraan computer found');
  need(problems, some[3].label === 'Notes' && some[3].text === 'A source was skipped.' && some[4].label === 'Last error' && some[4].text === 'a key was refused', 'the notes and the last error should be lines of their own');
  need(problems, input.describeFrcStatus({ lastSyncAt: ago(5), teams: [{ team: 'prime', number: 3229, events: 1 }] }, now)[1].text === '1 event', 'one event should read 1 event');
  need(problems, JSON.stringify(input.frcStatusView(null, now)).indexOf('Reading the competition data') !== -1, 'the block should say it is reading while it waits');
  const missing = JSON.stringify(input.frcStatusView({ doc: null, unreadable: false }, now));
  need(problems, missing.indexOf('No connection yet') !== -1 && missing.indexOf('TBA_AUTH_KEY') !== -1 && missing.indexOf('local.env') !== -1, 'the block should say No connection yet, with the key to add to local.env on the Teletraan computer, when the document is missing');
  need(problems, JSON.stringify(input.frcStatusView({ doc: null, unreadable: true }, now)).indexOf('could not be read') !== -1, 'the block should say so when the data cannot be read');
  need(problems, JSON.stringify(input.frcStatusView({ doc: { lastSyncAt: ago(5) }, unreadable: false }, now)).indexOf('Last sync') !== -1, 'the block should show the lines when there is a document');
  need(problems, typeof input.FrcStatusInput === 'function' && JSON.stringify(input.FrcStatusInput()).indexOf('Reading the competition data') !== -1, 'FrcStatusInput should start by saying it is reading');
  return problems;
}

// readFrcStatus asks the published document by its id, and never fails. The stand-in client gives the answers.
async function checkFrcRead() {
  const problems = [];
  const read = world.frcStatusInput.readFrcStatus;
  const asked = [];
  const answering = value => ({ fetch: async (...args) => { asked.push(args); return value; } });

  const found = await read(answering({ lastSyncAt: '2027-03-12T15:00:00.000Z', teams: [] }));
  need(problems, found.doc && found.doc.lastSyncAt === '2027-03-12T15:00:00.000Z' && found.unreadable === false, 'a document that is there should be handed over');
  need(problems, asked.length === 1 && /_id == \$id/.test(asked[0][0]) && asked[0][1].id === 'frc-status' && asked[0][2].perspective === 'published', 'readFrcStatus should ask for the published document with the id frc-status');
  need(problems, sameData(await read(answering(null)), { doc: null, unreadable: false }), 'no document is a good answer, not a failure');
  need(problems, sameData(await read(answering('text')), { doc: null, unreadable: false }), 'an answer that is not a document should be read as no document');
  need(problems, sameData(await read({ fetch: async () => { throw new Error('offline'); } }), { doc: null, unreadable: true }), 'a client that fails should give unreadable');
  need(problems, sameData(await read({}), { doc: null, unreadable: true }), 'a client with no fetch should give unreadable');
  return problems;
}

const world = {};
const results = [];

function check(name, run) {
  let problems;
  try {
    problems = run();
  } catch (error) {
    problems = ['the check stopped: ' + error.message];
  }
  results.push({ name: name, problems: problems });
}

function report() {
  results.forEach(result => {
    console.log((result.problems.length === 0 ? 'PASS  ' : 'FAIL  ') + result.name);
    result.problems.forEach(problem => console.log('        ' + problem));
  });

  const failed = results.filter(result => result.problems.length > 0).length;
  console.log('\n' + (results.length - failed) + ' of ' + results.length + ' checks passed.');
  return failed;
}

// Publish all (studio/tools/publish-all-tool.js) is a tool in the top bar. What it
// publishes comes from publish-all.js, whose logic tests/publish-all.test.mjs
// runs. Here: the tool is registered, the pages that exist once keep their
// fixed ids, and every kind of document has a name in its list.
function checkPublishAll() {
  const problems = [];
  const tool = (world.config.tools || []).filter(entry => entry.name === 'publish-all')[0];
  if (!tool) return ['sanity.config.js should add a tool named publish-all'];
  need(problems, tool.title === 'Publish all', 'the Publish all tool should have the title Publish all');
  need(problems, typeof tool.component === 'function', 'the Publish all tool needs a component, written as a plain function');

  const ids = world.publishAllTool.singletonIds;
  need(problems, Object.keys(ids).join() === world.structure.singletonTypes.join(), 'the Publish all tool should know the pages that exist once: ' + world.structure.singletonTypes.join(', '));

  const schema = { get: name => typeByName(name) };
  world.structure.singletonTypes.forEach(type => {
    const right = world.publishAll.chooseDrafts([{ _id: 'drafts.' + type, _type: type }], schema, ids)[0];
    const wrong = world.publishAll.chooseDrafts([{ _id: 'drafts.another', _type: type }], schema, ids)[0];
    need(problems, right && right.problem === '' && right.publishedId === type, type + ' should publish to the fixed id ' + type);
    need(problems, wrong && wrong.problem !== '', 'a draft of ' + type + ' with some other id should be left alone');
  });

  world.types.filter(type => type.type === 'document').forEach(type => {
    const item = world.publishAll.chooseDrafts([{ _id: 'drafts.example', _type: type.name }], schema, ids)[0];
    need(problems, item && item.typeTitle !== '' && item.title !== '', type.name + ' should have a type title and a title in the Publish all list, even with every field empty');
  });
  return problems;
}

// The theme files are checked by their own script, so a failure there fails
// this run too. Its output is kept so the failing lines are shown here.
function checkThemeGuard() {
  const script = path.join(here, '..', 'tests', 'check-themes.test.mjs');
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  if (run.error) return ['the theme check could not start: ' + run.error.message];
  if (run.status === 0) return [];
  const lines = (run.stdout + run.stderr).split('\n').filter(line => line.trim() !== '');
  return ['tests/check-themes.test.mjs failed:'].concat(lines.map(line => '  ' + line));
}

// The seasonal packs (decorations) are checked by their own script too, so a
// pack that is broken, or an overlay that says it has decorations and has no
// file, fails this run as well.
function checkSeasonGuard() {
  const script = path.join(here, '..', 'tests', 'check-seasons.test.mjs');
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  if (run.error) return ['the season check could not start: ' + run.error.message];
  if (run.status === 0) return [];
  const lines = (run.stdout + run.stderr).split('\n').filter(line => line.trim() !== '');
  return ['tests/check-seasons.test.mjs failed:'].concat(lines.map(line => '  ' + line));
}

// The fields that have one right answer. Each stays in the schema, hidden, with its starting
// value, so a page saved with another value still opens and publishes, and the screen ignores
// what is stored. The four settings have a constant in dashboard/core/constants.js. The close
// time of a meeting day is read by the booking script and never by the dashboard, so it has none.
//   path: { constant in constants.js, the starting value, the tab }
const fixedValues = {
  'dashboardSettings.nightStart': { constant: 'nightStart', value: '23:30', group: 'advanced' },
  'dashboardSettings.nightEnd': { constant: 'nightEnd', value: '11:30', group: 'advanced' },
  'dashboardSettings.noShowMinutes': { constant: 'noShowMinutes', value: 5, group: 'presentations' },
  'dashboardSettings.graceMinutes': { constant: 'graceMinutes', value: 5, group: 'presentations' },
  'presentationDay.closeMinutesBefore': { constant: '', value: 30, group: '' },
};

function checkFixedValues() {
  const problems = [];
  const config = world.dashboard;
  const constants = world.constants;
  const sample = world.sample.settings;

  Object.keys(fixedValues).forEach(pathText => {
    const wanted = fixedValues[pathText];
    const name = pathText.split('.')[1];
    const field = fieldAt(pathText);

    need(problems, field, pathText + ' should stay in the schema, so that a saved value is kept');
    if (!field) return;
    need(problems, field.hidden === true, pathText + ' should be hidden (hidden: true)');
    need(problems, field.initialValue === wanted.value, pathText + ' should still start as ' + JSON.stringify(wanted.value) + ', not ' + JSON.stringify(field.initialValue));
    need(problems, !field.validation, pathText + ' should have no rules: nobody can fix a value in a hidden field, and a page saved with another value must still publish');
    need(problems, !wanted.group || field.group === wanted.group, pathText + ' should stay in the ' + wanted.group + ' tab');
    need(problems, /^Not (used any more|edited here)/.test(field.description || ''), pathText + ' description should begin by saying that it is not used any more or not edited here');

    if (!wanted.constant) return;
    need(problems, constants[wanted.constant] === wanted.value, 'constants.js should have ' + wanted.constant + ' = ' + JSON.stringify(wanted.value) + ', the value the field starts as');
    need(problems, !(name in config.defaultSettings), name + ' should not be in defaultSettings in config.js: the dashboard uses constants.js');
    need(problems, !(name in config.limits), name + ' should not be in limits in config.js: the dashboard uses constants.js');
    need(problems, !(name in sample), 'the sample settings should not carry ' + name + ', which the screen ignores');
  });

  const wantedConstants = Object.keys(fixedValues).map(pathText => fixedValues[pathText].constant).filter(Boolean);
  need(problems, Object.keys(constants).sort().join() === wantedConstants.slice().sort().join(), 'dashboard/core/constants.js should export exactly: ' + wantedConstants.join(', '));
  return problems;
}

// Panel order: one list with every panel, in Dashboard Settings (schemas/settingsRotation.js). The older
// lists, Large panels and Small panels, stay in the schema, hidden. The screen builds the one list from
// them while it is empty (dashboard/core/panel-order.js), and the input fills it in the form the first time
// it is opened (panel-order-input.js), with the same rows.
function checkPanelOrder() {
  const problems = [];
  const config = world.dashboard;
  const at = name => fieldAt('dashboardSettings.rotation.' + name);
  const registered = world.registry.panels.filter(panel => !panel.testOnly && !panel.competition && !panel.monday && !panel.lastResort && !panel.placeholder && !panel.rotationOnly);
  const ids = rotationAreas.reduce((all, area) => all.concat(registered.filter(panel => panel.region === area).map(panel => panel.id)), []);

  const order = at('order');
  need(problems, order && order.type === 'array' && order.title === 'Panel order', 'rotation.order should be a list titled Panel order');
  need(problems, order && order.hidden === true && /^Not used any more\./.test(order.description || ''), 'rotation.order should be hidden but stay in the schema, with a description that begins Not used any more: the rows of the Screens replace it');
  need(problems, order && !constraintNamed(constraintsOf(order), 'required') && !constraintNamed(constraintsOf(order), 'min'), 'rotation.order should have no rules: a page saved before it existed has none, and must still publish');

  // One list with every panel the registry has for the large and the small frame, the large panels first. The Monday
  // cards are not in it: they are the Monday block of the look rotation
  const offeredIds = ids;
  const offered = choicesOf('dashboardSettings.rotation.order.panel');
  differences(offeredIds, offered.map(item => item.value), 'registry.js', 'the Studio list for Panel order', problems);
  need(problems, offered.map(item => item.value).join() === offeredIds.join(), 'Panel order should offer the large panels and then the small panels, in the order of registry.js: ' + offeredIds.join(', '));
  offered.forEach(item => need(problems, isPlainTitle(item), 'Panel order: "' + item.title + '" is not a plain-words title'));

  // The older lists are kept and hidden, with no rules on their rows, and the ticker seconds stay in the form
  ['grid1', 'grid2'].forEach(name => {
    need(problems, at(name) && at(name).hidden === true, 'rotation.' + name + ' should be hidden but stay in the schema');
    need(problems, at(name) && at(name).initialValue.length > 0, 'rotation.' + name + ' should keep its starting rows');
    ['panel', 'seconds'].forEach(inner => need(problems, at(name + '.' + inner) && !at(name + '.' + inner).validation, 'rotation.' + name + '.' + inner + ' should have no rules: nobody can fix a row in a hidden list, and a page saved with an odd row must still publish'));
  });
  ['panel', 'seconds'].forEach(inner => need(problems, at('order.' + inner) && at('order.' + inner).validation, 'rotation.order.' + inner + ' should keep its rules'));
  need(problems, at('tickerSeconds') && !at('tickerSeconds').hidden, 'rotation.tickerSeconds should show in the form');

  // A row in the list says which kind of panel it is
  const member = order && order.of && order.of[0];
  const line = panel => member.preview.prepare({ panel: panel, show: true });
  need(problems, member && line('tasks').subtitle === 'Large panel · Follows Seconds per page' && line('forecast').subtitle === 'Small panel · Follows Seconds per page', 'a row of Panel order should say Large panel or Small panel in its subtitle');
  need(problems, member && line('photo').subtitle === 'Large panel · Follows Seconds per photo', 'the Photo row should say that it follows Seconds per photo');
  need(problems, member && member.preview.prepare({}).title === 'Panel not chosen', 'a row with no panel should read Panel not chosen');

  // The starting rows are the dashboard's own list. The Studio's copy of the builder gives the same rows.
  const lists = {
    grid1: [{ panel: 'events', show: false, seconds: 30 }, { panel: 'tasks', show: true }, { panel: 'events', show: true }],
    grid2: [{ panel: 'forecast', show: true, seconds: 9 }, { panel: 'task-counts', show: false }],
  };
  const withoutKeys = rowsOf => rowsOf.map(row => without(row, '_key'));
  const dashboardRows = world.panelOrder.orderFromLists(lists);
  const studioRows = world.panelOrderInput.orderFromLists(lists.grid1, lists.grid2);
  need(problems, sameData(withoutKeys(studioRows), dashboardRows), 'the Studio builds ' + JSON.stringify(withoutKeys(studioRows)) + ' from the older lists but the dashboard builds ' + JSON.stringify(dashboardRows));
  need(problems, new Set(studioRows.map(row => row._key)).size === studioRows.length, 'every row the input builds needs a key of its own');
  need(problems, sameData(withoutKeys(world.panelOrderInput.orderFromLists(config.defaultSettings.rotation.grid1, config.defaultSettings.rotation.grid2)), world.panelOrder.orderFromLists(config.defaultSettings.rotation)), 'the rows built from the default lists should be the same in the Studio and the dashboard');

  // The input: it fills an empty list once from the older lists, and otherwise only draws the form
  need(problems, order && order.components && order.components.input === world.panelOrderInput.PanelOrderInput, 'rotation.order should draw itself with PanelOrderInput (panel-order-input.js)');
  const open = props => {
    const changes = [];
    globalThis.studioForm = { 'rotation.grid1': lists.grid1, 'rotation.grid2': lists.grid2 };
    globalThis.studioEffects = [];
    const drawn = world.panelOrderInput.PanelOrderInput(Object.assign({ value: undefined, readOnly: false, onChange: patch => changes.push(patch), renderDefault: () => 'the usual list' }, props));
    globalThis.studioEffects.forEach(effect => effect());
    return { drawn: drawn, changes: changes };
  };
  const empty = open({});
  need(problems, empty.drawn === 'the usual list', 'the input should draw the usual list');
  need(problems, empty.changes.length === 1 && empty.changes[0].type === 'set' && sameData(empty.changes[0].value, studioRows), 'an empty list should be filled once from the older lists');
  need(problems, open({ value: [] }).changes.length === 1, 'a list with no rows should be filled too');
  need(problems, open({ value: [{ _key: 'a', panel: 'tasks', show: true }] }).changes.length === 0, 'a list with rows should be left as it is');
  need(problems, open({ readOnly: true }).changes.length === 0, 'a list that cannot be edited should not be filled');
  globalThis.studioForm = {};
  globalThis.studioEffects = [];
  world.panelOrderInput.PanelOrderInput({ value: undefined, readOnly: false, onChange: () => problems.push('a page with no older lists should not be filled'), renderDefault: () => null });
  globalThis.studioEffects.forEach(effect => effect());
  globalThis.studioForm = undefined;
  return problems;
}

// The Monday cards. Each is a panel of the large frame with the monday flag in registry.js, not offered in Panel order
// and in neither its starting rows nor the rotation lists of config.js, and each has its script and its stylesheet
// (dashboard/core/monday.js, docs/layouts.md, "The Monday cards"). The last four are the older cards, which stay registered and
// are marked older: the Studio does not offer them.
function checkMondayCards() {
  const problems = [];
  const ids = ['monday-tasks', 'monday-done', 'monday-status-depts', 'monday-overall', 'monday-timeline', 'monday-board', 'monday-milestones', 'monday-progress', 'monday-milestones-both', 'monday-progress-both', 'monday-pie'];
  const flagged = world.registry.panels.filter(panel => panel.monday).map(panel => panel.id);
  need(problems, flagged.join() === ids.join(), 'registry.js should have the panels ' + ids.join(', ') + ' with monday: true, in that order');

  const rotation = [].concat(world.dashboard.defaultSettings.rotation.grid1, world.dashboard.defaultSettings.rotation.grid2).map(step => step.panel);
  const choices = choicesOf('dashboardSettings.rotation.order.panel').map(item => item.value);
  const field = fieldAt('dashboardSettings.rotation.order');
  ids.forEach(id => {
    const entry = world.registry.panels.filter(panel => panel.id === id)[0];
    need(problems, entry && entry.region === 'grid1', id + ' should be in the large panel, grid1');
    need(problems, rotation.indexOf(id) === -1, id + ' should not be in the rotation lists of config.js');
    need(problems, choices.indexOf(id) === -1, id + ' should not be offered in Panel order, because it runs in the Monday block of the look rotation');
    need(problems, field && field.initialValue.every(row => row.panel !== id), id + ' should not be in the starting rows of Panel order');
    ['js', 'css'].forEach(kind => need(problems, fs.existsSync(path.join(dashboardFolder, 'panels', id, 'panel.' + kind)), 'panels/' + id + '/panel.' + kind + ' is missing'));
  });
  return problems;
}

// Tasks from the team board. A task has a source, a board item number, the number and name of its board,
// a priority and a Show on TV switch. Every task opens read only except Show on TV, with one line at the
// top that says where it comes from. Nobody adds a task: there is no plus button and no template. Monday
// Tasks has two lists, On the TV and Hidden, and between them they hold every task once, which is tried
// below with the real filters of structure.js (docs/editing-content.md, "Tasks").
const boardNoteText = 'This task comes from the team board. Change it there. Use Show on TV to hide it here.';
const manualNoteText = 'This task was typed by hand. The screen shows only the tasks from the team board, so it is not shown. It stays here until it is deleted.';
const stayEditable = ['boardNote', 'manualNote', 'source', 'mondayId', 'mondayBoardId', 'mondayBoardName', 'showOnTv'];

// A filter of structure.js as a function of a task, so a test can run it. Only the forms the
// task filters use are turned over: ==, != and defined().
function filterOf(filter) {
  const js = filter
    .replace(/(?<![=!<>])==/g, '===')
    .replace(/!=/g, '!==')
    .replace(/defined\((\w+)\)/g, '($1 !== undefined && $1 !== null)')
    .replace(/\$now/g, 'now')
    .replace(/\$board/g, 'board');
  const test = new Function('source', 'showOnTv', 'showOnBoard', 'show', 'expires', 'mondayBoardId', 'now', 'board', 'return ' + js + ';');
  return (task, now, board) => test(task.source, task.showOnTv, task.showOnBoard, task.show, task.expires, task.mondayBoardId, now, board);
}

function checkBoardTasks() {
  const problems = [];
  const at = name => fieldAt('task.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);

  // the fields the board sync sets, and the ones an editor sees
  const source = at('source');
  need(problems, source && source.type === 'string' && source.hidden === true && source.initialValue === 'manual', 'task.source should be a string, hidden, that starts on manual');
  ['mondayId', 'mondayBoardId', 'mondayBoardName'].forEach(name => {
    const field = at(name);
    need(problems, field && field.type === 'string' && field.hidden === true, 'task.' + name + ' should be a string, hidden');
  });
  const priority = at('priority');
  need(problems, priority && priority.type === 'string' && priority.hidden === undefined && priority.initialValue === undefined && !constraintNamed(rulesOf(priority), 'required'), 'task.priority should be an optional string with no starting value');
  need(problems, priority && /optional/i.test(priority.description || ''), 'the task.priority description should say it is optional');
  const showOnTv = at('showOnTv');
  need(problems, showOnTv && showOnTv.type === 'boolean' && showOnTv.title === 'Show on TV' && showOnTv.initialValue === true && showOnTv.hidden === undefined, 'task.showOnTv should be a switch titled Show on TV that starts on');
  need(problems, showOnTv && showOnTv.components && showOnTv.components.input === world.showOnTvInput.ShowOnTvInput, 'task.showOnTv should use the input in studio/inputs/show-on-tv-input.js, which draws a task with no value as on');

  // the two lines at the top: one for a task from the board and one for any other, each shown for its own tasks and storing nothing
  const names = fieldsIn(typeByName('task')).map(field => field.name);
  need(problems, names[0] === 'boardNote' && names[1] === 'manualNote', 'the notes should be the first two fields of a task, and the first two are ' + names.slice(0, 2).join(', '));
  const board = { document: { source: 'monday', status: 'in-progress' } };
  const typed = { document: { source: 'manual', status: 'up-next' } };
  const older = { document: { title: 'A task made before the board' } };
  [['boardNote', boardNoteText, true], ['manualNote', manualNoteText, false]].forEach(item => {
    const note = at(item[0]);
    need(problems, note && note.description === item[1], 'the note ' + item[0] + ' should say: ' + item[1]);
    need(problems, note && note.readOnly === true && note.components && note.components.field === world.noteField.NoteField && !note.validation, 'the note ' + item[0] + ' should be read only, drawn by the note field, with no rules');
    if (note && typeof note.hidden === 'function') {
      const shows = context => note.hidden(context) === false;
      need(problems, shows(board) === item[2], 'the note ' + item[0] + (item[2] ? ' should show on a task from the board' : ' should be hidden on a task from the board'));
      need(problems, shows(typed) === !item[2] && shows(older) === !item[2] && shows({ document: undefined }) === !item[2], 'the note ' + item[0] + (item[2] ? ' should be hidden on a task typed by hand, on one with no source and on a new one' : ' should show on a task typed by hand, on one with no source and on a new one'));
    } else {
      problems.push('the note ' + item[0] + ' should have a hidden function');
    }
  });

  // read only: every field but the ones above, on every task
  fieldsIn(typeByName('task')).forEach(field => {
    const where = 'task.' + field.name;
    if (stayEditable.indexOf(field.name) !== -1) return need(problems, field.name === 'boardNote' || field.name === 'manualNote' || !field.readOnly, where + ' should stay editable');
    need(problems, field.readOnly === true, where + ' should be read only on every task');
  });

  // a list line says the status, the priority, the owner, the due date and the board, Hidden when the task is off the TV, and Manual (not shown) for a task typed by hand
  const preview = typeByName('task').preview;
  const line = fields => preview.prepare(Object.assign({ title: 'Wire the robot', status: 'in-progress', board: 'Build board', source: 'monday' }, fields)).subtitle;
  const says = (fields, want) => need(problems, line(fields) === want, 'a task with ' + JSON.stringify(fields) + ' should read "' + want + '", it reads "' + line(fields) + '"');
  says({}, 'In progress · Build board');
  says({ priority: 'high', contact: 'Sam', due: '2026-10-14' }, 'In progress · High priority · Sam · Due Oct 14 · Build board');
  says({ priority: 'urgent' }, 'In progress · Build board');
  says({ due: 'next week' }, 'In progress · Build board');
  says({ board: undefined }, 'In progress');
  says({ showOnTv: false }, 'Hidden · In progress · Build board');
  says({ show: false }, 'Hidden · In progress · Build board');
  says({ showOnBoard: false }, 'Hidden · In progress · Build board');
  says({ show: false, reason: 'unassigned' }, 'Hidden · In progress · Build board · No department');
  says({ showOnTv: true }, 'In progress · Build board');
  says({ source: 'manual' }, 'Manual (not shown) · In progress · Build board');
  says({ source: undefined, board: undefined }, 'Manual (not shown) · In progress');
  says({ source: 'manual', showOnTv: false }, 'Hidden · Manual (not shown) · In progress · Build board');
  need(problems, preview.select.source === 'source' && preview.select.priority === 'priority' && preview.select.showOnTv === 'showOnTv' && preview.select.board === 'mondayBoardName' && preview.select.due === 'dueDate', 'the preview should select source, priority, showOnTv, the board name and the due date');

  // the input: a task with no value is drawn as on, nothing is written on opening, a click writes the switch
  const input = world.showOnTvInput;
  need(problems, input.isShownOnTv(undefined) === true && input.isShownOnTv(null) === true && input.isShownOnTv(true) === true && input.isShownOnTv(false) === false, 'only a switch turned off should read as off');
  const written = [];
  const drawn = value => input.ShowOnTvInput({ id: 'x', value: value, readOnly: false, onChange: patch => written.push(patch) });
  const box = element => element.children[0];
  need(problems, box(drawn(undefined)).props.checked === true && box(drawn(true)).props.checked === true && box(drawn(false)).props.checked === false, 'the box should be ticked unless the switch was turned off');
  need(problems, written.length === 0, 'drawing the input should write nothing');
  box(drawn(undefined)).props.onChange({ target: { checked: false } });
  box(drawn(false)).props.onChange({ target: { checked: true } });
  need(problems, JSON.stringify(written) === JSON.stringify([{ type: 'set', value: false }, { type: 'set', value: true }]), 'a click should write the switch, off and then on');
  need(problems, input.ShowOnTvInput({ value: true, readOnly: true, onChange: () => {} }).children[0].props.disabled === true, 'the box should be disabled when the field is read only');

  // Monday Tasks: two lists in order, no plus button, no template, and no New menu offers a task
  const folder = world.structure.sidebarEntries.filter(entry => entry.title === 'Monday Tasks')[0];
  if (!folder || folder.kind !== 'group') return problems.concat('the Monday Tasks line of the sidebar should be a folder');
  need(problems, folder.entries.map(entry => entry.title).join() === 'On the TV,Hidden', 'the Monday Tasks folder should hold On the TV and Hidden, in that order');
  need(problems, folder.add === undefined, 'the Monday Tasks folder should have no plus button');
  folder.entries.forEach(entry => {
    need(problems, entry.type === 'task' && entry.sort.field === 'mondayBoardName' && entry.sort.direction === 'asc' && entry.thenBy && entry.thenBy.field === '_createdAt' && entry.thenBy.direction === 'asc', entry.title + ' should list tasks by the name of their board, then the oldest first');
    need(problems, Array.isArray(entry.add) && entry.add.length === 0, entry.title + ' should have no plus button: its add should be an empty list');
  });
  need(problems, !world.addTemplates.some(item => item.id === 'pinnedTask' || item.schemaType === 'task'), 'add-templates.js should have no template that makes a task');
  const offered = world.config.schema.templates([{ id: 'task' }]).map(item => item.id).join();
  need(problems, offered === ['task'].concat(world.addTemplates.map(item => item.id)).join(), 'sanity.config.js should add the templates of add-templates.js to the templates of the Studio. It gives: ' + offered);
  const choicesIn = creationContext => world.config.document.newDocumentOptions([{ templateId: 'task' }], { creationContext: creationContext }).map(item => item.templateId).join();
  [undefined, { type: 'global' }, { type: 'structure', schemaType: 'task' }, { type: 'document', documentId: 'task-1', schemaType: 'task' }].forEach(creationContext => {
    need(problems, choicesIn(creationContext) === '', 'no New menu should offer a task, because the Teletraan computer makes them. They offer: ' + choicesIn(creationContext));
  });

  // the two lists hold every task once. The filters are the ones structure.js gives the Studio.
  const now = '2026-10-09T12:00:00.000Z';
  const past = '2026-10-01T12:00:00.000Z';
  const future = '2026-11-01T12:00:00.000Z';
  const tasks = [
    { name: 'a task made before the board: no new field', where: 'Hidden' },
    { name: 'no source, empty values', task: { source: null, showOnTv: null, show: null, expires: null }, where: 'Hidden' },
    { name: 'typed by hand', task: { source: 'manual', showOnTv: true, show: true }, where: 'Hidden' },
    { name: 'typed by hand and expiring later', task: { source: 'manual', expires: future }, where: 'Hidden' },
    { name: 'from the board', task: { source: 'monday', showOnTv: true }, where: 'On the TV' },
    { name: 'from the board with no switches at all', task: { source: 'monday' }, where: 'On the TV' },
    { name: 'from the board, expiring later', task: { source: 'monday', expires: future }, where: 'On the TV' },
    { name: 'typed by hand and off the TV', task: { source: 'manual', showOnTv: false }, where: 'Hidden' },
    { name: 'from the board and off the TV', task: { source: 'monday', showOnTv: false }, where: 'Hidden' },
    { name: 'from the board and hidden by the Show on TV column of the board', task: { source: 'monday', showOnBoard: false }, where: 'Hidden' },
    { name: 'from the board with the column on', task: { source: 'monday', showOnBoard: true }, where: 'On the TV' },
    { name: 'switched off on screen', task: { show: false }, where: 'Hidden' },
    { name: 'from the board and switched off on screen', task: { source: 'monday', show: false }, where: 'Hidden' },
    { name: 'expired', task: { expires: past }, where: 'Hidden' },
    { name: 'from the board and expired', task: { source: 'monday', expires: past }, where: 'Hidden' },
    { name: 'from the board and expiring this second', task: { source: 'monday', expires: now }, where: 'Hidden' },
  ];
  tasks.forEach(item => {
    const sits = folder.entries.filter(entry => filterOf(entry.filter)(item.task || {}, now)).map(entry => entry.title);
    need(problems, sits.join() === item.where, 'a task ' + item.name + ' should be in ' + item.where + ' only. It is in: ' + (sits.join() || 'no list'));
  });

  return problems;
}

// The plus button of each list under Tasks, Events and Roster. A list makes the template
// named in its add (add-templates.js): a new document of the type the list shows, with the starting
// values of the group, which are no team, the switch that puts it on the screen turned on and, for
// a tip, the kind set. The two lists of Monday Tasks have no plus button, because the Teletraan computer makes
// the tasks, and their add is an empty list. The New menus of the Studio, and the templates they
// offer, stay as they were, except that none offers a task (docs/reordering-the-sidebar.md).
const addGroups = ['SCREEN', 'TASKS', 'EVENTS', 'PEOPLE'];

// The template each list makes, by the title of the list
const listAdds = {
  Subthemes: 'newSubtheme',
  Announcements: 'newAnnouncement',
  'Extra panels': null,
  'Agenda items': 'newPlan',
  Upcoming: 'newPresentation',
  Past: 'newPresentation',
  'Meeting days': 'newPresentationDay',
  'On the TV': '',
  Hidden: '',
  'Tips and News': 'newTip',
  'Calendar filters': 'newCalendarFilter',
  Leadership: 'newPerson',
  'Team leads': 'newSubteam',
  Sponsors: 'newSponsor',
  Photos: 'newPhoto',
}; // null is the plain plus button of the type

// The switch that puts a new document on the screen, when it is not called show
const onSwitches = { presentation: ['status', 'scheduled'], presentationDay: ['open', true], announcement: ['level', 'notice'], subtheme: ['enabled', true] };

// Every line of the sidebar with the heading it sits under, the lines inside the folders too
function linesUnderHeadings() {
  const lines = [];
  let heading = '';
  world.structure.sidebarEntries.forEach(entry => {
    if (entry.kind === 'divider') heading = entry.title;
    else allLines([entry]).forEach(line => lines.push({ heading: heading, line: line }));
  });
  return lines;
}

// Each line of the sidebar next to what structure() built for it, folders opened
function builtPairs(entries, items) {
  return entries.reduce((pairs, entry, index) => {
    const pair = [{ entry: entry, item: items[index] }];
    const inside = entry.kind === 'group' ? items[index].child.made.items.map(inner => inner.made) : [];
    return pairs.concat(pair, entry.kind === 'group' ? builtPairs(entry.entries, inside) : []);
  }, []);
}

function checkListAdds() {
  const problems = [];
  const templates = world.addTemplates;
  const documentTypes = world.types.filter(type => type.type === 'document');

  // the templates: an id of their own, a type, a title, and starting values that are fields of the type
  need(problems, new Set(templates.map(template => template.id)).size === templates.length, 'add-templates.js has two templates with the same id');
  templates.forEach(template => {
    const where = 'the template ' + template.id;
    const type = documentTypes.filter(item => item.name === template.schemaType)[0];
    need(problems, typeof template.title === 'string' && template.title !== '', where + ' has no title');
    need(problems, documentTypes.every(item => item.name !== template.id), where + ' has the id of a type. Every type has a plain template with its own name, so give this one another id.');
    if (!type) return problems.push(where + ' makes the type "' + template.schemaType + '", which is not a kind of document');

    const fields = fieldsIn(type);
    const value = (typeof template.value === 'function' ? template.value() : template.value) || {};
    Object.keys(value).forEach(name => {
      const field = fields.filter(item => item.name === name)[0];
      if (!field) return problems.push(where + ' sets ' + name + ', which is not a field of ' + template.schemaType);
      const choices = field.options && field.options.list;
      if (choices) need(problems, choices.some(choice => (choice.value !== undefined ? choice.value : choice) === value[name]), where + ' sets ' + name + ' to "' + value[name] + '", which the field does not offer');
    });
    need(problems, !('team' in value), where + ' sets a team. A new document starts with no team, so it shows for every team.');
    const on = onSwitches[template.schemaType] || ['show', true];
    need(problems, value[on[0]] === on[1], where + ' should start with ' + on[0] + ' set to ' + on[1]);
    if (fields.some(item => item.name === 'kind')) need(problems, typeof value.kind === 'string' && value.kind !== '', where + ' should set the kind, because ' + template.schemaType + ' has one');
  });
  const tip = templates.filter(template => template.id === 'newTip')[0];
  need(problems, tip && tip.value.kind === 'tip', 'Tips and News should make a tip, so newTip should set the kind to tip');

  // the lists of the three groups, and no others, each name the template of the table above
  const lines = linesUnderHeadings();
  const inGroups = lines.filter(item => addGroups.indexOf(item.heading) !== -1 && item.line.kind === 'list').map(item => item.line);
  need(problems, inGroups.map(line => line.title).join() === Object.keys(listAdds).join(), 'the lists under ' + addGroups.join(', ') + ' should be: ' + Object.keys(listAdds).join(', ') + '. They are: ' + inGroups.map(line => line.title).join(', ') + '. Add the new list to listAdds in tests/schemas.test.mjs.');
  inGroups.forEach(line => {
    if (listAdds[line.title] === null) return need(problems, line.add === undefined, line.title + ' should keep the plain plus button');
    if (listAdds[line.title] === '') return need(problems, Array.isArray(line.add) && line.add.length === 0, line.title + ' should have no plus button. Its add should be an empty list.');

    const template = templates.filter(item => item.id === listAdds[line.title])[0];
    need(problems, (line.add || []).join() === listAdds[line.title], line.title + ' should make ' + listAdds[line.title] + ' in its plus button. Its add is: ' + ((line.add || []).join() || 'empty'));
    need(problems, template && template.schemaType === line.type, line.title + ' lists ' + line.type + ', and its template makes ' + (template && template.schemaType));
  });
  lines.filter(item => addGroups.indexOf(item.heading) === -1 && item.line.kind === 'list').forEach(item => {
    need(problems, item.line.add === undefined, item.line.title + ' is not under ' + addGroups.join(', ') + ' and should keep the plain plus button');
  });

  // what structure() builds: the plus button of a list makes that one template and nothing else
  const entries = world.structure.sidebarEntries;
  const items = world.structure.structure(fakeBuilder()).made.items.map(item => item.made);
  builtPairs(entries, items).filter(pair => pair.entry.kind === 'list').forEach(pair => {
    const given = pair.item.child.made.initialValueTemplates;
    const names = given && given.map(template => template.serialize().templateId);
    need(problems, (names || []).join() === (pair.entry.add || []).join() && (pair.entry.add === undefined) === (given === undefined), pair.entry.title + ' should give the Studio the templates ' + ((pair.entry.add || []).join() || 'of the plain plus button') + '. It gives: ' + ((names || []).join() || 'none'));
  });
  const talks = entries.filter(entry => entry.title === 'Daily Agenda')[0].entries.filter(entry => entry.title === 'Presentations')[0];
  need(problems, talks && talks.add && talks.add.join() === 'newPresentation', 'the Presentations folder should make a presentation in its plus button');

  // the Studio's own templates and New menus are as they were: the plain templates first and in order,
  // then these, which no New menu offers
  const plain = documentTypes.map(type => ({ id: type.name, schemaType: type.name }));
  const given = world.config.schema.templates(plain);
  need(problems, sameData(given.slice(0, plain.length), plain), 'sanity.config.js should keep the templates the Studio makes for every type, and add its own after them');
  need(problems, given.slice(plain.length).map(template => template.id).join() === templates.map(template => template.id).join(), 'sanity.config.js should add the templates of add-templates.js, and no others');

  const hidden = pageTypes.concat(['extraEvent', 'status', 'calendarStatus', 'frcStatus', 'mondayStatus', 'task', 'milestone']);
  const choicesIn = (list, creationContext) => world.config.document.newDocumentOptions(list, { creationContext: creationContext }).map(item => item.templateId).join();
  const plainChoices = plain.map(template => ({ templateId: template.id }));
  const allChoices = plainChoices.concat(templates.map(template => ({ templateId: template.id })));
  [undefined, { type: 'global' }, { type: 'structure', schemaType: 'task' }, { type: 'structure', schemaType: 'tipOrNews' }, { type: 'document', documentId: 'task-1', schemaType: 'task' }].forEach(creationContext => {
    const inDocument = Boolean(creationContext && creationContext.type === 'document');
    const want = plain.map(template => template.id).filter(id => hidden.indexOf(id) === -1 && (inDocument || id !== 'place')).join();
    need(problems, choicesIn(plainChoices, creationContext) === want, 'the New menus should offer every kind of document except ' + hidden.join(', ') + ' and, outside a document, place. They offer: ' + choicesIn(plainChoices, creationContext));
    need(problems, choicesIn(allChoices, creationContext) === want, 'the New menus should not offer the templates of add-templates.js. They offer: ' + choicesIn(allChoices, creationContext));
  });
  return problems;
}

// The document the Teletraan computer writes for the Calendars page (schemas/calendarStatus.js, written by
// computer/scripts/calendar-status.sh and status-write.sh calendar-status), and the page under
// Events that shows it beside the calendars of Dashboard Settings (calendars-view.js, with its
// words and rows in calendars-view-parts.js).
const calendarStatusFields = ['updatedAt', 'eventsNote', 'calendars'];
const calendarEntryFields = ['code', 'fetchedAt', 'error', 'eventCount', 'hiddenCount', 'occurrences'];
const calendarEventFields = ['title', 'date', 'day', 'time', 'shown', 'rule'];

function checkCalendarStatusType() {
  const problems = [];
  const type = typeByName('calendarStatus');
  const entry = fieldAt('calendarStatus.calendars');
  const events = fieldAt('calendarStatus.calendars.occurrences');
  const names = item => fieldsIn(item || {}).map(field => field.name).join();

  need(problems, type && type.type === 'document', 'calendarStatus should be a document type');
  need(problems, names(type) === calendarStatusFields.join(), 'calendarStatus should have these fields, in this order: ' + calendarStatusFields.join(', '));
  need(problems, names(entry) === calendarEntryFields.join(), 'a calendar of calendarStatus should have these fields, in this order: ' + calendarEntryFields.join(', '));
  need(problems, names(events) === calendarEventFields.join(), 'an event of calendarStatus should have these fields, in this order: ' + calendarEventFields.join(', '));

  const kinds = { 'updatedAt': 'datetime', 'eventsNote': 'string', 'calendars': 'array', 'calendars.code': 'string', 'calendars.fetchedAt': 'datetime', 'calendars.error': 'string', 'calendars.eventCount': 'number', 'calendars.hiddenCount': 'number', 'calendars.occurrences': 'array', 'calendars.occurrences.title': 'string', 'calendars.occurrences.date': 'string', 'calendars.occurrences.day': 'string', 'calendars.occurrences.time': 'string', 'calendars.occurrences.shown': 'boolean', 'calendars.occurrences.rule': 'string' };
  Object.keys(kinds).forEach(name => {
    const field = fieldAt('calendarStatus.' + name);
    need(problems, field && field.type === kinds[name], 'calendarStatus.' + name + ' should be a ' + kinds[name]);
    need(problems, field && !constraintNamed(constraintsOf(field), 'required'), 'calendarStatus.' + name + ' should not be required: the Teletraan computer writes only what it knows');
  });
  need(problems, type && type.readOnly === true, 'calendarStatus should be read only: the Teletraan computer writes it');
  need(problems, type && type.__experimental_omnisearch_visibility === false, 'calendarStatus should be kept out of Studio search');

  // Editors never find it: no line in the sidebar and no place in the New menu
  need(problems, allLines(world.structure.sidebarEntries).every(entry => entry.type !== 'calendarStatus'), 'the sidebar should have no line for the calendar status document');
  const offered = world.config.document.newDocumentOptions([{ templateId: 'calendarStatus' }, { templateId: 'plan' }], {}).map(item => item.templateId).join();
  need(problems, offered === 'plan', 'the New menu should not offer the calendar status document');

  // The page and the scripts on the Teletraan computer use the same id and the same type
  need(problems, world.calendarsParts.calendarStatusId === 'calendar-status', 'the Calendars page should read the document calendar-status');
  const start = '{"_id":"calendar-status","_type":"calendarStatus",';
  need(problems, world.statusScript.indexOf(start) !== -1, 'status-write.sh should only send a document that starts with ' + start);
  need(problems, world.calendarStatusScript.indexOf(start) !== -1, 'calendar-status.sh should write a document that starts with ' + start);
  need(problems, world.calendarStatusHelper.indexOf("_id: 'calendar-status'") !== -1 && world.calendarStatusHelper.indexOf("_type: 'calendarStatus'") !== -1, 'calendar-status.mjs should write the document calendar-status of the type calendarStatus');
  calendarEntryFields.concat(calendarEventFields, ['updatedAt']).forEach(name => {
    need(problems, world.calendarStatusHelper.indexOf(name) !== -1, 'calendar-status.mjs should write the field ' + name);
  });
  need(problems, world.calendarStatusScript.indexOf('eventsNote') !== -1, 'calendar-status.sh should write the field eventsNote');
  return problems;
}

function checkCalendarsPage() {
  const problems = [];
  const parts = world.calendarsParts;
  const view = world.calendarsView;
  const line = allLines(world.structure.sidebarEntries).filter(entry => entry.title === 'Calendars')[0];
  const now = new Date('2026-10-09T15:00:00.000Z');
  const ago = minutes => new Date(now.getTime() - minutes * 60000).toISOString();
  const entries = [{ id: 'team', name: 'Team calendar', show: true }, { id: 'outreach', name: 'Outreach', show: false }];
  const status = {
    _id: 'calendar-status',
    updatedAt: ago(1),
    calendars: [
      {
        code: 'team',
        fetchedAt: ago(5),
        eventCount: 14,
        hiddenCount: 3,
        occurrences: [
          { _key: 'o1', title: 'Team meeting', date: 'MON OCT 12', time: '6:00 PM', shown: true, rule: '' },
          { _key: 'o2', title: 'Pre-Season', date: 'TUE OCT 13', time: '', shown: false, rule: 'Hide Pre-Season' },
        ],
      },
      { code: 'old', error: 'download failed, the server said no, so the address may be wrong or expired' },
    ],
  };

  // The line in the sidebar opens this page, under Events, and is no longer a placeholder
  need(problems, line && line.kind === 'component' && line.component === view.CalendarsView, 'the Calendars line of the sidebar should open CalendarsView from calendars-view.js');
  need(problems, typeof view.calendarsPage === 'function' && typeof view.readCalendars === 'function', 'calendars-view.js should export calendarsPage and readCalendars');

  // The page: the heading, the one line of help, and then the two sides
  const page = view.calendarsPage({ entries: entries, status: status, entriesUnreadable: false, statusUnreadable: false }, 'outreach', () => {}, now);
  need(problems, wordsIn(nodesWhere(page, node => node.type === 'h1')) === 'Calendars', 'the page should open with the heading Calendars');
  const paragraphs = nodesWhere(page, node => node.type === 'p').map(wordsIn);
  need(problems, paragraphs[0] === parts.helpLine, 'the first line under the heading should be the help line');
  need(problems, parts.helpLine.indexOf(parts.hideOneLabel) !== -1 && parts.helpLine.indexOf(parts.hideAllLabel) !== -1 && /same title/.test(parts.helpLine) && /rules are listed under Calendar filters/.test(parts.helpLine) && /ask a coach/.test(parts.helpLine) && /address on the Teletraan computer/.test(parts.helpLine), 'the help line should name the two Hide buttons, say what each one hides, say that the rules are listed under Calendar filters and say to ask a coach to add the address on the computer');
  need(problems, !/repeating meeting/.test(parts.helpLine), 'the help line should not send people to Calendar filters to hide a repeating meeting now that the events have Hide buttons');
  const left = nodesWhere(page, node => node.props && node.props['data-side'] === 'calendars')[0];
  const right = nodesWhere(page, node => node.props && node.props['data-side'] === 'events')[0];
  need(problems, left && right, 'the page should have a left side with the calendars and a right side with the events');

  // The left side: a button for each calendar of Dashboard Settings and then the one only the Teletraan computer knows, the second picked
  const picks = [];
  const buttons = left ? nodesWhere(left, node => node.type === 'button') : [];
  need(problems, buttons.length === 3 && buttons.every(button => button.props.type === 'button' && typeof button.props.onClick === 'function'), 'the left side should have a button for each calendar: the two of Dashboard Settings and the one only the Teletraan computer has');
  need(problems, buttons.map(button => button.props['aria-pressed']).join() === 'false,true,false', 'the picked calendar should be marked pressed');
  const first = view.calendarsPage({ entries: entries, status: status, entriesUnreadable: false, statusUnreadable: false }, 'team', code => picks.push(code), now);
  nodesWhere(first, node => node.type === 'button').forEach(button => button.props.onClick());
  need(problems, picks.join() === 'team,outreach,old', 'a button should pick the calendar of its row');
  need(problems, buttons[0] && /Team calendar/.test(wordsIn(buttons[0])) && /14 events, 3 hidden/.test(wordsIn(buttons[0])) && /Downloaded 5 minutes ago/.test(wordsIn(buttons[0])), 'a row should say the name, the number of events and when it was downloaded');
  need(problems, buttons[1] && /Switched off on the screen/.test(wordsIn(buttons[1])) && /Nothing yet/.test(wordsIn(buttons[1])), 'a row for a calendar the Teletraan computer has not described should say Nothing yet');

  // The right side: the 12 events with a badge, and the rule for a hidden one
  const tab = view.calendarsPage({ entries: entries, status: status, entriesUnreadable: false, statusUnreadable: false }, 'team', () => {}, now);
  const events = nodesWhere(tab, node => node.type === 'li').map(wordsIn);
  need(problems, events.length === 2 && /MON OCT 12 6:00 PM Team meeting SHOWN/.test(events[0]), 'an event should say its date, time, title and SHOWN');
  need(problems, /TUE OCT 13 All day Pre-Season HIDDEN Hidden by Hide Pre-Season/.test(events[1]), 'a hidden event should say HIDDEN and the name of the rule');
  const failed = wordsIn(view.calendarsPage({ entries: entries, status: status, entriesUnreadable: false, statusUnreadable: false }, 'old', () => {}, now));
  need(problems, /Download failed, the server said no, so the address may be wrong or expired\./.test(failed), 'a calendar that failed to download should say why in a sentence');

  // The line that says how old the document is
  need(problems, /The Teletraan computer wrote this 1 minute ago\./.test(wordsIn(first)), 'the page should say when the computer wrote the document');
  need(problems, wordsIn(view.calendarsPage({ entries: entries, status: Object.assign({}, status, { updatedAt: undefined }), entriesUnreadable: false, statusUnreadable: false }, '', () => {}, now)).indexOf('The Teletraan computer wrote this') === -1, 'the page should say nothing about when the document was written when it has no time');

  // Nothing yet, reading, and a document that cannot be read
  const nothing = wordsIn(view.calendarsPage({ entries: [], status: null, entriesUnreadable: false, statusUnreadable: false }, '', () => {}, now));
  need(problems, nothing.indexOf(parts.nothingYet) !== -1 && nothing.indexOf(parts.noCalendarsLine) !== -1, 'with no status and no calendars the page should say Nothing yet and that Dashboard Settings has no calendars');
  const waiting = wordsIn(view.calendarsPage({ entries: entries, status: null, entriesUnreadable: false, statusUnreadable: false }, '', () => {}, now));
  need(problems, nodesWhere(view.calendarsPage({ entries: entries, status: null, entriesUnreadable: false, statusUnreadable: false }, '', () => {}, now), node => node.type === 'button').length === 2 && waiting.indexOf(parts.nothingYet) !== -1, 'before the Teletraan computer has synced the page should list the calendars of Dashboard Settings and say Nothing yet');
  need(problems, wordsIn(view.calendarsPage(null, '', () => {}, now)).indexOf('Reading the calendars') !== -1, 'the page should say it is reading while it waits');
  need(problems, wordsIn(view.calendarsPage({ entries: entries, status: null, entriesUnreadable: false, statusUnreadable: true }, '', () => {}, now)).indexOf('could not be read') !== -1, 'the page should say so when the status cannot be read');
  need(problems, wordsIn(view.calendarsPage({ entries: [], status: status, entriesUnreadable: true, statusUnreadable: false }, '', () => {}, now)).indexOf('Dashboard Settings could not be read') !== -1, 'the page should say so when Dashboard Settings cannot be read, and still list the calendars of the Teletraan computer');
  need(problems, typeof view.CalendarsView === 'function' && JSON.stringify(view.CalendarsView()).indexOf('Reading the calendars') !== -1, 'CalendarsView should start by saying it is reading');

  // The page draws and never writes itself. The Hide buttons write through calendars-view-parts.js, which
  // makes a rule with createIfNotExists and deletes it with delete, and does nothing else to a document.
  need(problems, !/onChange|\.patch\(|\.create\(|\.createIfNotExists\(|\.createOrReplace\(|\.delete\(|\.mutate\(|\.transaction\(|useDocumentOperation/.test(world.calendarsViewSource), 'calendars-view.js should not write itself: its buttons call hideEvent and showAgain in calendars-view-parts.js');
  need(problems, !/onChange|\.patch\(|\.create\(|\.createOrReplace\(|\.mutate\(|\.transaction\(|useDocumentOperation/.test(world.calendarsPartsSource), 'calendars-view-parts.js should write only with createIfNotExists and delete');

  // What a student reads is short plain sentences
  [parts.helpLine, parts.nothingYet, parts.settingsLine, parts.publicLine, parts.noCalendarsLine].forEach(text => checkPlainSentences(problems, 'the Calendars page ("' + text.slice(0, 30) + '")', text));
  need(problems, /dataset/.test(parts.publicLine) && /anyone can read/.test(parts.publicLine) && /hides/.test(parts.publicLine), 'the page should say the titles are in the dataset that anyone can read, even the ones a rule hides');
  return problems;
}

// readCalendars asks for the published Dashboard Settings and the published status document by their ids, and never fails
async function checkCalendarsRead() {
  const problems = [];
  const read = world.calendarsView.readCalendars;
  const asked = [];
  const answering = answers => ({
    fetch: async (...args) => {
      asked.push(args);
      const answer = answers[args[1].id];
      if (answer instanceof Error) throw answer;
      return answer;
    },
  });

  const found = await read(answering({ dashboardSettings: { calendars: [{ id: 'team', name: 'Team calendar', show: true }] }, 'calendar-status': { _id: 'calendar-status', calendars: [] } }));
  need(problems, found.entries.length === 1 && found.status && found.status._id === 'calendar-status' && !found.entriesUnreadable && !found.statusUnreadable, 'both documents that are there should be handed over');
  need(problems, asked.length === 2 && asked.every(call => call[2].perspective === 'published' && /_id == \$id/.test(call[0])), 'readCalendars should ask for the published documents by their ids');
  need(problems, asked.map(call => call[1].id).join() === 'dashboardSettings,calendar-status', 'readCalendars should ask for dashboardSettings and calendar-status');

  const none = await read(answering({ dashboardSettings: null, 'calendar-status': null }));
  need(problems, sameData(none, { entries: [], status: null, entriesUnreadable: false, statusUnreadable: false }), 'no documents are a good answer, not a failure');
  const odd = await read(answering({ dashboardSettings: { calendars: 'text' }, 'calendar-status': 'text' }));
  need(problems, sameData(odd, { entries: [], status: null, entriesUnreadable: false, statusUnreadable: false }), 'answers that are not documents should be read as no documents');
  const oneBad = await read(answering({ dashboardSettings: new Error('offline'), 'calendar-status': { _id: 'calendar-status', calendars: [] } }));
  need(problems, oneBad.entriesUnreadable === true && oneBad.statusUnreadable === false && oneBad.status !== null, 'one document that cannot be read should not stop the other');
  const failing = await read({ fetch: async () => { throw new Error('offline'); } });
  need(problems, failing.entriesUnreadable === true && failing.statusUnreadable === true && failing.status === null && failing.entries.length === 0, 'a client that fails should give both as unreadable');
  const empty = await read({});
  need(problems, empty.entriesUnreadable === true && empty.statusUnreadable === true, 'a client with no fetch should give both as unreadable');
  return problems;
}

// The kind of each calendar and the Hide buttons of the Calendars page (calendars-view.js, with the
// rules in calendars-view-parts.js). The buttons make a rule in Calendar filters (schemas/calendarFilter.js).
// Every rule the page can make is run through the checks of that schema, so a rule that Studio would
// refuse can never be made. The kinds are the ones in schemas/dashboardSettings.js and dashboard/config.js.
function refusalsOf(rule) {
  const out = [];
  const type = typeByName('calendarFilter');

  const run = (item, value, where) => {
    constraintsOf(item).forEach(constraint => {
      const limit = constraint.args[0];
      if (constraint.name === 'required' && (value === undefined || value === '')) out.push(where + ' is empty');
      if (value === undefined) return;
      if (constraint.name === 'max' && (item.type === 'date' ? value > limit : value.length > limit)) out.push(where + ' is over its limit of ' + limit);
      if (constraint.name === 'min' && item.type === 'date' && value < limit) out.push(where + ' is under its limit of ' + limit);
      if (constraint.name === 'regex' && !limit.test(value)) out.push(where + ' does not fit its pattern');
      if (constraint.name === 'valid' && limit.indexOf(value) === -1) out.push(where + ' is not one of the choices');
      if (constraint.name === 'custom' && limit(value, { document: rule }) !== true) out.push(where + ' is refused: ' + limit(value, { document: rule }));
    });
  };

  fieldsIn(type).forEach(field => {
    run(field, rule[field.name], field.name);
    if (field.name === 'words' && Array.isArray(rule.words)) rule.words.forEach((word, index) => run(field.of[0], word, 'word ' + (index + 1)));
  });
  const whole = constraintNamed(constraintsOf(type), 'custom');
  if (whole && whole.args[0](rule) !== true) out.push('the rule as a whole is refused: ' + whole.args[0](rule));
  return out;
}

function checkCalendarsHide() {
  const problems = [];
  const parts = world.calendarsParts;
  const view = world.calendarsView;
  const config = world.dashboard;
  const now = new Date('2026-10-09T15:00:00.000Z');

  // The kinds are the ones of the schema and of config.js, with the same titles, in the same order
  const offered = choicesOf('dashboardSettings.calendars.kind');
  need(problems, sameData(parts.calendarKinds, offered), 'calendars-view-parts.js should list the kinds of dashboardSettings.calendars.kind, with the same titles and values, in the same order');
  need(problems, parts.calendarKinds.map(kind => kind.value).join() === config.calendarKinds.join(), 'calendars-view-parts.js should list the kinds in calendarKinds of config.js');

  const events = [
    { _key: 'o1', title: 'Team meeting', date: 'MON OCT 12', day: '2026-10-12', time: '6:00 PM', shown: true, rule: '' },
    { _key: 'o2', title: 'Pre-Season Meeting', date: 'TUE OCT 13', day: '2026-10-13', time: '6:30 PM', shown: false, rule: 'Hide Pre-Season' },
    { _key: 'o3', title: 'Food drive', date: 'WED OCT 14', day: '2026-10-14', time: '', shown: false, rule: '' },
    { _key: 'o4', title: 'No title', date: 'THU OCT 15', day: '2026-10-15', time: '', shown: true, rule: '' },
    { _key: 'o5', title: 'Old list event', date: 'FRI OCT 16', time: '5:00 PM', shown: true, rule: '' },
  ];
  const madeRule = parts.hideRuleFor('team', events[2], false);
  events[2].rule = madeRule ? madeRule.name : '';
  const status = { _id: 'calendar-status', updatedAt: now.toISOString(), calendars: [{ code: 'team', fetchedAt: now.toISOString(), eventCount: 5, hiddenCount: 2, occurrences: events }] };
  const entries = [{ id: 'team', name: 'Team calendar', show: true, kind: 'meetings' }, { id: 'outreach', name: 'Outreach', show: true }];
  const read = { entries: entries, status: status, entriesUnreadable: false, statusUnreadable: false };

  const calls = [];
  const hiding = (changes) => Object.assign({
    rules: [madeRule],
    unreadable: false,
    gone: [],
    asking: '',
    busy: false,
    problem: '',
    ask: row => calls.push('ask ' + row),
    cancel: () => calls.push('cancel'),
    hide: rule => calls.push('hide ' + rule._id),
    show: rule => calls.push('show ' + rule._id),
  }, changes);
  const buttonsOf = node => nodesWhere(node, item => item.type === 'button');
  const labels = node => buttonsOf(node).map(wordsIn).join(' | ');
  const itemsOf = page => nodesWhere(page, node => node.type === 'li');

  // The kind: a line in each row and a fact on the right, and a note under the help line while a calendar has none
  const page = view.calendarsPage(read, 'team', () => {}, now, hiding());
  const left = nodesWhere(page, node => node.props && node.props['data-side'] === 'calendars')[0];
  const rowButtons = left ? buttonsOf(left) : [];
  need(problems, rowButtons.length === 2 && /Kind: Meetings/.test(wordsIn(rowButtons[0])), 'a row of the left side should say the kind: Kind: Meetings');
  need(problems, rowButtons[1] && /Kind: no chip/.test(wordsIn(rowButtons[1])), 'a calendar with no kind should say Kind: no chip');
  const right = nodesWhere(page, node => node.props && node.props['data-side'] === 'events')[0];
  need(problems, right && /Kind Meetings/.test(wordsIn(nodesWhere(right, node => node.type === 'p').slice(0, 5))), 'the facts of the right side should say Kind and the kind');
  const paragraphs = nodesWhere(page, node => node.type === 'p').map(wordsIn);
  need(problems, paragraphs[1] === parts.kindLine && /Leave it blank for no chip/.test(parts.kindLine) && /Dashboard Settings/.test(parts.kindLine) && /Calendars tab/.test(parts.kindLine), 'a muted note under the help line should say that a kind left blank has no chip and where to set it');
  const allKinds = view.calendarsPage({ entries: [entries[0], Object.assign({}, entries[1], { kind: 'outreach' })], status: status, entriesUnreadable: false, statusUnreadable: false }, 'team', () => {}, now, hiding());
  need(problems, nodesWhere(allKinds, node => node.type === 'p').map(wordsIn).indexOf(parts.kindLine) === -1, 'the note about the kind should go when every calendar has one');
  const unknown = view.calendarsPage({ entries: [Object.assign({}, entries[0], { kind: 'party' })], status: status, entriesUnreadable: false, statusUnreadable: false }, 'team', () => {}, now);
  need(problems, /Kind: no chip/.test(wordsIn(nodesWhere(unknown, node => node.type === 'button'))), 'a kind that is not in the list should read as no chip, as it does on the screen');

  // The events: the buttons each one has
  const items = itemsOf(page);
  need(problems, items.length === 5, 'the right side should list the five events');
  need(problems, items[0] && labels(items[0]) === 'Hide this one | Hide all like this', 'a shown event should have Hide this one and Hide all like this');
  need(problems, items[1] && labels(items[1]) === '' && /Hidden by Hide Pre-Season\. Change it under Calendar filters\./.test(wordsIn(items[1])), 'an event that another rule hides should name the rule and say to change it under Calendar filters, with no button');
  need(problems, items[2] && labels(items[2]) === 'Show again' && /Hidden by Hide: Food drive, 2026-10-14/.test(wordsIn(items[2])), 'an event that a rule made here hides should say so and have Show again');
  need(problems, items[3] && labels(items[3]) === '' && !/Change it under/.test(wordsIn(items[3])), 'an event with the title No title should have no button');
  need(problems, items[4] && labels(items[4]) === 'Hide all like this' && wordsIn(items[4]).indexOf(parts.noDayLine) !== -1, 'an event from an older list, with no day, should have only Hide all like this, and a note');
  need(problems, items.every(item => buttonsOf(item).every(button => button.props.type === 'button' && button.props.disabled === false && typeof button.props.onClick === 'function')), 'every button should be a plain button that works while nothing is being saved');

  // What each button does
  const clicks = (item, label) => buttonsOf(item).filter(button => wordsIn(button) === label).forEach(button => button.props.onClick());
  clicks(items[0], 'Hide this one');
  clicks(items[0], 'Hide all like this');
  clicks(items[2], 'Show again');
  clicks(items[4], 'Hide all like this');
  const one = parts.hideRuleFor('team', events[0], false);
  need(problems, calls.join() === 'hide ' + one._id + ',ask team:o1,show ' + madeRule._id + ',ask team:o5', 'Hide this one should make its rule, Hide all like this should ask first, and Show again should delete the rule of the event. The buttons did: ' + calls.join());

  // Hide all like this says what it does, and only Hide makes the rule
  calls.length = 0;
  const asking = view.calendarsPage(read, 'team', () => {}, now, hiding({ asking: 'team:o1' }));
  const asked = itemsOf(asking)[0];
  need(problems, asked && wordsIn(asked).indexOf(parts.askText('Team calendar', 'Team meeting')) !== -1 && parts.askText('Team calendar', 'Team meeting') === 'This hides every event in Team calendar with Team meeting in its title, on every day.', 'the question should say: This hides every event in Team calendar with Team meeting in its title, on every day.');
  need(problems, asked && labels(asked) === 'Hide | Cancel', 'the question should have Hide and Cancel');
  clicks(asked, 'Cancel');
  clicks(asked, 'Hide');
  const all = parts.hideRuleFor('team', events[0], true);
  need(problems, calls.join() === 'cancel,hide ' + all._id, 'Cancel should only close the question and Hide should make the rule for every day. The buttons did: ' + calls.join());
  need(problems, labels(itemsOf(asking)[2]) === 'Show again' && labels(itemsOf(asking)[4]) === 'Hide all like this', 'the question belongs to one event, and the other events keep their buttons');

  // Nothing can be pressed while a change is saved, and a failed change shows one red line
  const busy = view.calendarsPage(read, 'team', () => {}, now, hiding({ busy: true }));
  need(problems, buttonsOf(itemsOf(busy)).length === 4 && buttonsOf(itemsOf(busy)).every(button => button.props.disabled === true), 'every button should be off while a change is being saved');
  const failed = view.calendarsPage(read, 'team', () => {}, now, hiding({ problem: 'The change was not saved.' }));
  need(problems, nodesWhere(failed, node => node.type === 'p').map(wordsIn).filter(text => text === 'The change was not saved.').length === 1, 'a failed change should show its line once');
  const redLine = nodesWhere(failed, node => node.type === 'p' && wordsIn(node) === 'The change was not saved.')[0];
  need(problems, redLine && /critical/.test(redLine.props.style.color), 'the line about a failed change should be red');
  need(problems, redLine && redLine.props.style.position === 'sticky' && redLine.props.style.bottom === 0 && Boolean(redLine.props.style.background), 'the line about a failed change should stay in view at the bottom of the window, on a background, because the list has up to 40 events');

  // The muted line under the list, and a page that only shows
  need(problems, nodesWhere(page, node => node.type === 'p').map(wordsIn).indexOf(parts.hideLine) !== -1 && /at once/.test(parts.hideLine) && /Calendar filters/.test(parts.hideLine) && /edit or delete/.test(parts.hideLine), 'a muted line under the list should say that a rule made here is on the screen at once, and that Calendar filters lists it');
  const plain = view.calendarsPage(read, 'team', () => {}, now);
  need(problems, buttonsOf(itemsOf(plain)).length === 0 && nodesWhere(plain, node => node.type === 'p').map(wordsIn).indexOf(parts.hideLine) === -1, 'a page that is given no rules should only show: no button and no line about the buttons');
  const waiting = view.calendarsPage(read, 'team', () => {}, now, hiding({ rules: null }));
  need(problems, buttonsOf(itemsOf(waiting)).length === 0, 'there should be no button while the rules made here are being read');
  const unreadable = view.calendarsPage(read, 'team', () => {}, now, hiding({ rules: null, unreadable: true }));
  need(problems, buttonsOf(itemsOf(unreadable)).length === 0 && nodesWhere(unreadable, node => node.type === 'p').map(wordsIn).indexOf(parts.rulesUnreadableLine) !== -1, 'rules that cannot be read should turn the buttons off, and the page should say so');
  const stale = view.calendarsPage(read, 'team', () => {}, now, hiding({ gone: [madeRule.name], rules: [] }));
  need(problems, itemsOf(stale)[2] && labels(itemsOf(stale)[2]) === 'Hide this one | Hide all like this' && /SHOWN/.test(wordsIn(itemsOf(stale)[2])), 'an event that the list says a deleted rule hides should read as shown, with the Hide buttons');
  const hidAtOnce = view.calendarsPage(read, 'team', () => {}, now, hiding({ rules: [madeRule, one] }));
  need(problems, itemsOf(hidAtOnce)[0] && labels(itemsOf(hidAtOnce)[0]) === 'Show again' && /HIDDEN/.test(wordsIn(itemsOf(hidAtOnce)[0])), 'an event that a new rule hides should read as hidden at once, before the Teletraan computer lists it again');

  // The sentences a student reads
  [parts.kindLine, parts.hideLine, parts.changeLine, parts.noDayLine, parts.longCodeLine, parts.rulesUnreadableLine, parts.askText('Team calendar', 'Team meeting'), parts.failureText({ statusCode: 403, message: 'Insufficient permissions' }), parts.failureText(new Error('offline')), parts.restingText('Hide all: Team meeting')].forEach(text => checkPlainSentences(problems, 'the Hide buttons ("' + text.slice(0, 30) + '")', text));
  ['Hide this one', 'Hide all like this', 'Show again', 'Hide', 'Cancel'].forEach(label => need(problems, [parts.hideOneLabel, parts.hideAllLabel, parts.showAgainLabel, parts.confirmLabel, parts.cancelLabel].indexOf(label) !== -1, 'the buttons should be called ' + label));

  // Every rule the buttons can make is accepted by the schema, and the limits are the ones the schema has
  const titles = ['Team meeting', 'Pre-Season Meeting...', 'A'.repeat(100), 'A'.repeat(60) + '...', 'x'.repeat(29) + '\u{1F600}\u{1F600}', 'Say "hello" \\ now', '会議'.repeat(40), ' ', '...', 'Food drive: 5k', 'a'];
  const codes = ['team', 'a'.repeat(20), 'build_season', 'g1'];
  const days = ['2026-10-12', '2020-01-01', '2099-12-31', '2028-02-29'];
  let made = 0;
  titles.forEach(title => codes.forEach(code => days.forEach(day => [true, false].forEach(whole => {
    const rule = parts.hideRuleFor(code, { title: title, day: day }, whole);
    if (rule === null) return;
    made += 1;
    const refused = refusalsOf(rule);
    need(problems, refused.length === 0, 'Studio would refuse the rule for "' + title + '" in ' + code + ' on ' + day + ' (all ' + whole + '): ' + refused.join('; '));
    need(problems, rule._id.indexOf('calendarFilter-hide-') === 0 && /^[A-Za-z0-9_-]+$/.test(rule._id), 'the id of a rule should be letters, digits, hyphens and underscores that start calendarFilter-hide-');
    need(problems, rule.action === 'hide' && rule.show === true && rule.calendar === code && rule.words.length === 1 && rule.words[0].length <= 30, 'a rule should hide, be on, name its calendar and have one word of up to 30 characters');
  }))));
  need(problems, made > 100, 'the grid of titles, calendars and days should make many rules, not ' + made);

  const longTitle = { title: 'A'.repeat(100), day: '2026-10-12' };
  need(problems, parts.hideRuleFor('team', longTitle, false).name === 'Hide: ' + 'A'.repeat(19) + '..., 2026-10-12' && parts.hideRuleFor('team', longTitle, false).name.length === 40, 'a long title should be cut so that the name of the rule is 40 characters and keeps the day');
  need(problems, parts.hideRuleFor('team', longTitle, true).name === 'Hide all: ' + 'A'.repeat(30), 'the name of a rule for every day should be Hide all: and the title cut to 30 characters');
  need(problems, sameData(parts.hideRuleFor('team', { title: 'Team meeting', day: '2026-10-12' }, false), { _id: parts.hideRuleFor('team', { title: 'Team meeting', day: '2026-10-12' }, false)._id, _type: 'calendarFilter', name: 'Hide: Team meeting, 2026-10-12', action: 'hide', words: ['Team meeting'], calendar: 'team', fromDate: '2026-10-12', toDate: '2026-10-12', show: true }), 'Hide this one should make a published calendarFilter with the name, action, words, calendar, from date, to date and show');
  need(problems, sameData(parts.hideRuleFor('team', { title: 'Team meeting', day: '2026-10-12' }, true), { _id: parts.hideRuleFor('team', { title: 'Team meeting' }, true)._id, _type: 'calendarFilter', name: 'Hide all: Team meeting', action: 'hide', words: ['Team meeting'], calendar: 'team', show: true }), 'Hide all like this should make the same rule with no dates');

  // No rule where Studio would refuse one
  [['Team', { title: 'x', day: '2026-10-12' }], ['a'.repeat(21), { title: 'x', day: '2026-10-12' }], ['bad-code', { title: 'x', day: '2026-10-12' }], ['team', { title: 'No title', day: '2026-10-12' }], ['team', { title: '', day: '2026-10-12' }], ['team', { title: '...' }]].forEach(item => {
    need(problems, parts.hideRuleFor(item[0], item[1], false) === null && parts.hideRuleFor(item[0], item[1], true) === null, 'no rule should be made for the calendar "' + item[0] + '" and the title "' + item[1].title + '"');
  });
  ['2019-12-31', '2100-01-01', '2026-02-30', '', undefined, 5].forEach(day => {
    need(problems, parts.hideRuleFor('team', { title: 'x', day: day }, false) === null && parts.hideRuleFor('team', { title: 'x', day: day }, true) !== null, 'a rule for one day should not be made for the day "' + day + '", and a rule for every day still can be');
  });

  // The limits of the schema, which the page keeps to
  const filter = name => fieldAt('calendarFilter.' + name);
  const maxOf = field => (constraintNamed(constraintsOf(field), 'max') || { args: [] }).args[0];
  need(problems, maxOf(filter('name')) === 40, 'the rule name of the schema should allow 40 characters, which is what the page keeps to');
  need(problems, maxOf(filter('words')) === 5 && maxOf(filter('words').of[0]) === 30, 'the schema should allow up to 5 words of 30 characters, which is what the page keeps to');
  need(problems, maxOf(filter('calendar')) === 20, 'the calendar code of the schema should allow 20 characters, which is what the page keeps to');
  need(problems, constraintNamed(constraintsOf(filter('fromDate')), 'min').args[0] === '2020-01-01' && constraintNamed(constraintsOf(filter('toDate')), 'max').args[0] === '2099-12-31', 'the dates of the schema should run from 2020-01-01 to 2099-12-31, which is what the page keeps to');
  return problems;
}

// The writes of the Hide buttons, with a fake client that keeps documents in a list
async function checkCalendarsHideWrite() {
  const problems = [];
  const parts = world.calendarsParts;
  const documents = {};
  const calls = [];
  const client = {
    createIfNotExists: async doc => {
      calls.push('create ' + doc._id);
      if (!documents[doc._id]) documents[doc._id] = doc;
      return documents[doc._id];
    },
    delete: async id => {
      calls.push('delete ' + id);
      delete documents[id];
    },
  };

  const rule = parts.hideRuleFor('team', { title: 'Team meeting', day: '2026-10-12' }, false);
  const first = await parts.hideEvent(client, rule);
  const second = await parts.hideEvent(client, rule);
  need(problems, Object.keys(documents).length === 1 && documents[rule._id] === first && second === first, 'a second click should make no second rule: the same id is stored once and handed back');
  need(problems, calls.join() === 'create ' + rule._id + ',create ' + rule._id, 'Hide should ask the client to createIfNotExists, and nothing else');

  documents['drafts.' + rule._id] = { _id: 'drafts.' + rule._id };
  calls.length = 0;
  await parts.showAgain(client, rule);
  need(problems, calls.join() === 'delete ' + rule._id + ',delete drafts.' + rule._id && Object.keys(documents).length === 0, 'Show again should delete the published rule and a draft of it');

  const noDraft = { delete: async id => { if (id.indexOf('drafts.') === 0) throw new Error('no draft'); } };
  let stopped = null;
  await parts.showAgain(noDraft, rule).catch(error => { stopped = error; });
  need(problems, stopped === null, 'a draft that cannot be deleted should not stop Show again');
  let refused = null;
  await parts.showAgain({ delete: async () => { throw new Error('Insufficient permissions'); } }, rule).catch(error => { refused = error; });
  need(problems, refused && /permissions/.test(refused.message), 'a rule that cannot be deleted should be reported, not hidden');
  let refusedHide = null;
  await parts.hideEvent({ createIfNotExists: async () => { throw new Error('Insufficient permissions'); } }, rule).catch(error => { refusedHide = error; });
  need(problems, refusedHide && /permissions/.test(refusedHide.message), 'a rule that cannot be made should be reported, not hidden');
  need(problems, /refused/.test(parts.failureText(refusedHide)) && /permissions/.test(parts.failureText(refusedHide)) && /refused/.test(parts.failureText({ statusCode: 403 })) && !/refused/.test(parts.failureText(new Error('offline'))), 'a failure should say Studio refused it when the account may not edit, and give the reason');

  // The rules made on the page are read by their id, from the published documents
  const asked = [];
  const answering = value => ({ fetch: async (...args) => { asked.push(args); if (value instanceof Error) throw value; return value; } });
  const stored = [
    { _id: 'calendarFilter-hide-0123456789abcdef', name: 'Hide all: Team meeting', words: ['Team meeting'], calendar: 'team', show: true },
    { _id: 'calendarFilter-other', name: 'Hide Pre-Season', words: ['Pre-Season'] },
    { _id: 'calendarFilter-hide-fedcba9876543210', name: 'Always: Kickoff', action: 'show', words: ['Kickoff'] },
    { _id: 'calendarFilter-hide-1111111111111111' },
    null,
    'text',
  ];
  const found = await parts.readHideRules(answering(stored));
  need(problems, found.unreadable === false && found.rules.length === 1 && found.rules[0]._id === 'calendarFilter-hide-0123456789abcdef', 'only the rules with the id prefix, with a name, that are not Always show rules, should be handed over');
  need(problems, asked.length === 1 && /_type == "calendarFilter"/.test(asked[0][0]) && asked[0][2].perspective === 'published', 'readHideRules should ask for the published calendarFilter documents');
  need(problems, sameData(await parts.readHideRules(answering(null)), { rules: [], unreadable: false }) && sameData(await parts.readHideRules(answering('text')), { rules: [], unreadable: false }), 'answers that are not a list should be read as no rules');
  need(problems, sameData(await parts.readHideRules(answering(new Error('offline'))), { rules: [], unreadable: true }) && sameData(await parts.readHideRules({}), { rules: [], unreadable: true }), 'a client that fails should give the rules as unreadable');

  // The list of rules the page keeps
  const list = [{ _id: 'a' }, { _id: 'b' }];
  need(problems, parts.withRule(list, { _id: 'c' }).map(item => item._id).join() === 'a,b,c' && parts.withRule(list, { _id: 'a', x: 1 }).map(item => item._id).join() === 'b,a' && parts.withoutRule(list, 'a').map(item => item._id).join() === 'b' && list.length === 2, 'withRule and withoutRule should give a new list and leave the old one alone');
  return problems;
}

// The look rotation (schemas/settingsLook.js): the styles by day, the Monday style, the team order and the swap. The choices
// and the starting values are the ones in dashboard/config.js. None is required, because an empty list gives the choice back
// to Style and Team mode, which are hidden now and keep what is saved in them. The starting teams are the two of the seed file,
// which the dashboard reads by their codes.
function checkLookRotation() {
  const problems = [];
  const config = world.dashboard;
  const at = name => fieldAt('dashboardSettings.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const titles = { original: 'Original', cybertron: 'Cybertron', minimal: 'Minimal', assemble: 'Assemble', slats: 'Slats', cut: 'Cut' };
  const offered = list => list.map(item => item.value).join();

  const names = fieldsIn(typeByName('dashboardSettings')).map(field => field.name);
  const from = names.indexOf('lookNote');
  need(problems, names.slice(from, from + 8 + rotationNames.length).join() === ['lookNote', 'cycleNote', 'generalViewName', 'generalViewTitle', 'viewOrder', 'themeByWeekday', 'background', 'screenSchedule'].concat(rotationNames).join(), 'the Look tab should start with lookNote, cycleNote, the view fields, screenSchedule and then ' + rotationNames.join(', '));
  rotationNames.forEach(name => {
    need(problems, at(name) && at(name).group === 'look', name + ' should be in the Look tab');
    if (name === 'lookSwap') {
      need(problems, at(name) && at(name).hidden === true, 'lookSwap should be hidden but stay in the schema: every change of look is one swap now, and a saved value is kept');
      need(problems, /^Not used any more\./.test((at(name) && at(name).description) || ''), 'the lookSwap description should begin Not used any more');
    } else {
      need(problems, at(name) && at(name).hidden === true, name + ' should be hidden but stay in the schema: the Screens replace it, and a saved value is kept');
      need(problems, /^Not used any more\./.test((at(name) && at(name).description) || ''), 'the ' + name + ' description should begin Not used any more');
    }
    need(problems, !constraintNamed(rulesOf(at(name)), 'required'), name + ' should not be required: an empty one gives the choice back to the old setting, and the page must still publish');
    need(problems, rulesOf(at(name)).some(rule => rule.name === 'error' && rule.args[0]) || (at(name).of || []).some(member => constraintsOf(member).some(rule => rule.name === 'error' && rule.args[0])), name + ' has rules and no error message in plain words');
  });
  need(problems, at('dailyStyles') && at('dailyStyles').title === 'Styles by day', 'dailyStyles should be titled Styles by day');
  need(problems, at('mondayStyle') && at('mondayStyle').title === 'Monday style', 'mondayStyle should be titled Monday style');
  need(problems, at('teamOrder') && at('teamOrder').title === 'Team order', 'teamOrder should be titled Team order');
  need(problems, at('lookSwap') && at('lookSwap').title === 'How the look changes', 'lookSwap should be titled How the look changes');

  // The names the dashboard has, and the lists the Studio offers
  need(problems, config.lookSwaps.join() === 'assemble,slats,cut', 'lookSwaps in config.js should be assemble, slats and cut, not ' + config.lookSwaps.join());
  const rows = at('dailyStyles') && at('dailyStyles').of && at('dailyStyles').of[0];
  const rowList = (rows && rows.options && rows.options.list) || [];
  need(problems, offered(rowList) === config.styles.join(), 'each row of dailyStyles should offer the styles in config.js, in the same order: ' + config.styles.join(', '));
  need(problems, offered(choicesOf('dashboardSettings.mondayStyle')) === config.styles.join(), 'mondayStyle should offer the styles in config.js, in the same order');
  need(problems, offered(choicesOf('dashboardSettings.lookSwap')) === config.lookSwaps.join(), 'lookSwap should offer the swaps in config.js, in the same order');
  rowList.concat(choicesOf('dashboardSettings.mondayStyle'), choicesOf('dashboardSettings.lookSwap')).forEach(item => need(problems, item.title === titles[item.value], 'the choice ' + item.value + ' should be titled ' + titles[item.value]));
  ['mondayStyle', 'lookSwap'].forEach(name => {
    const allowed = constraintNamed(rulesOf(at(name)), 'valid');
    const known = name === 'lookSwap' ? config.lookSwaps : config.styles;
    need(problems, at(name) && at(name).options && at(name).options.layout === 'radio', name + ' should be a radio list');
    need(problems, allowed && allowed.args[0].join() === known.join(), name + ' should only allow: ' + known.join(', '));
  });
  const rowAllowed = rows && constraintNamed(constraintsOf(rows), 'valid');
  need(problems, rowAllowed && rowAllowed.args[0].join() === config.styles.join(), 'each row of dailyStyles should only allow: ' + config.styles.join(', '));

  // The starting values are the dashboard's defaults. The teams are written as references, to the ids of the seed file.
  const settings = config.defaultSettings;
  need(problems, sameData(at('dailyStyles') && at('dailyStyles').initialValue, settings.dailyStyles), 'dailyStyles should start as ' + JSON.stringify(settings.dailyStyles) + ', the default in config.js');
  need(problems, at('mondayStyle') && at('mondayStyle').initialValue === settings.mondayStyle && settings.mondayStyle === 'minimal', 'mondayStyle should start as minimal, and so should its default in config.js');
  need(problems, at('lookSwap') && at('lookSwap').initialValue === settings.lookSwap && settings.lookSwap === 'assemble', 'lookSwap should start as assemble, and so should its default in config.js');
  need(problems, sameData(settings.dailyStyles, ['original', 'cybertron']) && sameData(settings.teamOrder, ['prime', 'nova']), 'the defaults in config.js should be Original then Cybertron, and Prime then Nova');
  const seeded = world.teamSeed.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
  const starting = ((at('teamOrder') && at('teamOrder').initialValue) || []).map(item => {
    const team = seeded.filter(doc => doc._id === item._ref)[0];
    return item._type === 'reference' && team ? team.code : '(' + item._ref + ' is not in the seed file)';
  });
  need(problems, sameData(starting, settings.teamOrder), 'teamOrder should start with the teams ' + JSON.stringify(settings.teamOrder) + ', as references to the documents of docs/seed/teams.ndjson, not ' + JSON.stringify(starting));

  // Only the teams that are switched on can be picked, and each once
  const order = at('teamOrder') && at('teamOrder').of && at('teamOrder').of[0];
  need(problems, order && order.options && order.options.filter === 'active != false', 'teamOrder should offer only the teams that are switched on (options.filter)');
  need(problems, constraintNamed(rulesOf(at('teamOrder')), 'unique'), 'teamOrder should refuse a team that is in the list twice');

  // The old choices stay in the schema, hidden, with their starting values. The screen uses them until a Screen has chosen a style or a team.
  teamNames.concat('style').forEach(name => {
    need(problems, at(name) && at(name).hidden === true, name + ' should be hidden but stay in the schema, so that a saved value is kept');
    need(problems, at(name) && at(name).group === 'look', name + ' should stay in the Look tab');
    need(problems, at(name) && /^Used only until a Screen has chosen the (style|team)/.test(at(name).description || ''), 'the ' + name + ' description should begin by saying that it is used only until a Screen has chosen the style or the team');
  });

  // The notes say what the tab does
  const cycle = at('cycleNote');
  need(problems, cycle && /Rotation page/.test(cycle.description || '') && /Views, under SCREEN/.test(cycle.description || ''), 'the second note on the Logo and motion tab should say that what plays is the Rotation page and that a view holds its arrangement in Views, under SCREEN');
  need(problems, at('lookNote') && /The theme of each day and the Original background are on the Themes and backgrounds page/.test(at('lookNote').description || ''), 'the first note on the Logo and motion tab should say that the Themes and backgrounds page sets the theme of each day');
  need(problems, at('screenSchedule') && at('screenSchedule').hidden === true && /^Not used any more/.test(at('screenSchedule').description || ''), 'screenSchedule should be hidden, kept in the schema, and say Not used any more');

  // The sample content carries the four settings, with values the dashboard accepts
  const sample = world.sample.settings;
  need(problems, Array.isArray(sample.dailyStyles) && sample.dailyStyles.length > 0 && sample.dailyStyles.every(name => config.styles.indexOf(name) !== -1), 'the sample settings need dailyStyles, each of ' + config.styles.join(', '));
  need(problems, config.styles.indexOf(sample.mondayStyle) !== -1, 'the sample settings need a mondayStyle of ' + config.styles.join(', '));
  need(problems, config.lookSwaps.indexOf(sample.lookSwap) !== -1, 'the sample settings need a lookSwap of ' + config.lookSwaps.join(', '));
  const codes = world.sample.teams.map(team => team.code);
  need(problems, Array.isArray(sample.teamOrder) && sample.teamOrder.length > 0 && sample.teamOrder.every(code => codes.indexOf(code) !== -1), 'the sample settings need a teamOrder of the codes of the sample teams: ' + codes.join(', '));
  return problems;
}

// The Events panel has two pages, which it scrolls between (dashboard/core/event-pages.js). Each calendar in Dashboard Settings has a kind,
// the switch Group events by kind is in the Calendars tab, and an Always show rule in Calendar filters can pin its events
// to page one. The choices and the starting values are the ones in dashboard/config.js. None is required, because a
// calendar or a rule saved before these fields existed has none, and must still publish.
function checkEventPages() {
  const problems = [];
  const config = world.dashboard;
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const titles = { meetings: 'Meetings', competitions: 'Competitions', outreach: 'Outreach', deadlines: 'Deadlines', other: 'Other (no chip)' };

  const kind = fieldAt('dashboardSettings.calendars.kind');
  const offered = choicesOf('dashboardSettings.calendars.kind');
  need(problems, kind && kind.title === 'Kind', 'calendars.kind should be titled Kind');
  need(problems, offered.map(item => item.value).join() === config.calendarKinds.join(), 'calendars.kind should offer the kinds in config.js, in the same order: ' + config.calendarKinds.join(', '));
  offered.forEach(item => need(problems, item.title === titles[item.value], 'the kind ' + item.value + ' should be titled ' + titles[item.value]));
  need(problems, kind && kind.options && kind.options.layout === 'radio', 'calendars.kind should be a radio list');
  // A calendar has no kind until somebody picks one, so there is no starting value and its events have no chip. Other is
  // the old starting value: it stays offered and valid, and the screen counts it as no kind (noCalendarKind in config.js)
  need(problems, kind && kind.initialValue === undefined, 'calendars.kind should have no starting value: a calendar has no kind until somebody picks one');
  need(problems, config.noCalendarKind === 'other' && !('defaultCalendarKind' in config), 'config.js should name noCalendarKind as other, and have no defaultCalendarKind');
  need(problems, kind && kind.description === 'Pick a kind to show a chip on each event from this calendar. Leave it blank for no chip.', 'the calendars.kind description should read: Pick a kind to show a chip on each event from this calendar. Leave it blank for no chip.');
  const calendars = fieldAt('dashboardSettings.calendars');
  need(problems, calendars && calendars.initialValue.every(row => !('kind' in row)), 'the starting calendar row in dashboardSettings.js should have no kind');
  need(problems, kind && !constraintNamed(rulesOf(kind), 'required'), 'calendars.kind should not be required: a calendar saved before kinds existed has none');
  const allowed = constraintNamed(rulesOf(kind), 'valid');
  need(problems, allowed && allowed.args[0].join() === config.calendarKinds.join(), 'calendars.kind should only allow: ' + config.calendarKinds.join(', '));
  need(problems, rulesOf(kind).some(rule => rule.name === 'error' && rule.args[0]), 'calendars.kind has rules and no error message in plain words');
  need(problems, config.defaultSettings.calendars.every(row => !('kind' in row)), 'each default calendar in config.js should have no kind');
  need(problems, sameData(calendars.initialValue, config.defaultSettings.calendars), 'the starting calendar row in dashboardSettings.js should be the default calendar in config.js');

  const group = fieldAt('dashboardSettings.groupEventsByKind');
  need(problems, group && group.type === 'boolean' && group.title === 'Group events by kind' && group.group === 'calendars', 'groupEventsByKind should be a switch titled Group events by kind, in the Calendars tab');
  need(problems, group && group.initialValue === false && config.defaultSettings.groupEventsByKind === false, 'groupEventsByKind should start off, and so should its default in config.js');
  need(problems, group && /Meetings, Deadlines and Other/.test(group.description || '') && /Competitions and Outreach/.test(group.description || ''), 'the groupEventsByKind description should say which kinds are on each page');
  need(problems, [undefined, true, false].indexOf(world.sample.settings.groupEventsByKind) !== -1, 'the sample settings need groupEventsByKind to be on or off, or to leave it out');

  const force = fieldAt('calendarFilter.force');
  const names = fieldsIn(typeByName('calendarFilter')).map(field => field.name);
  need(problems, force && force.type === 'boolean' && force.title === 'Pin to page one' && force.initialValue === false, 'calendarFilter.force should be a switch titled Pin to page one that starts off');
  need(problems, force && force.description === 'Show this event even when it is not one of the next 8.', 'the calendarFilter.force description should be: Show this event even when it is not one of the next 8.');
  need(problems, force && !constraintNamed(rulesOf(force), 'required'), 'calendarFilter.force should not be required: a rule saved before it existed has none');
  need(problems, names.indexOf('force') === names.indexOf('action') + 1, 'calendarFilter.force should come straight after the action');
  const showsFor = action => force && typeof force.hidden === 'function' ? !force.hidden({ document: { action: action } }) : null;
  need(problems, showsFor('show') === true && showsFor('hide') === false, 'calendarFilter.force should show only on an Always show rule');
  need(problems, force && typeof force.hidden === 'function' && force.hidden({ document: undefined }) === true, 'calendarFilter.force should stay hidden while the rule has no document yet');

  const events = world.registry.panels.filter(panel => panel.id === 'events')[0];
  need(problems, events && events.pages === undefined, 'the events panel in registry.js should not have pages: it draws both of its pages in one list and scrolls from the first to the second (scrollPages in panels/events/panel.js)');
  return problems;
}

// The trim of a team (dashboard/config.js, teamTrim): eight radio lists in the Trim box of the Team document. The choices
// are the ones in config.js in the same order, the first is the one Prime has and the one each field starts with, and
// none is required, because a team saved before the trim existed has none and must still publish. The seed file gives
// Prime the first choice of each and Nova the values of the work order, except the name look, which is solid on both, and the
// bird pose, which is auto on both. The first choice has no class, and the others have the one the dashboard puts on the page:
// plain lower case words with hyphens, and no two the same. The bird pose is the exception: flight is not used any more and has none.
const trimOfNova = { bolts: 'round', cornerCut: 'tr-bl', headerNotch: 'slant', grid: 'dots', logoPose: 'auto', nameStyle: 'solid', tickerLabel: 'bar', countAccent: 'neon' };

function checkTeamTrim() {
  const problems = [];
  const config = world.dashboard;
  const type = typeByName('team');
  const names = Object.keys(config.teamTrim);
  const classes = [];

  need(problems, names.join() === Object.keys(trimOfNova).join(), 'teamTrim in config.js should have these fields, in this order: ' + Object.keys(trimOfNova).join(', '));
  need(problems, type && (type.fieldsets || []).some(set => set.name === 'trim' && set.title === 'Trim'), 'the team should have a Trim box (a fieldset called trim)');

  names.forEach(name => {
    const field = fieldAt('team.' + name);
    const values = Object.keys(config.teamTrim[name]);
    const rules = field ? constraintsOf(field) : [];
    const allowed = constraintNamed(rules, 'valid');
    const where = 'team.' + name;

    need(problems, field && field.type === 'string' && field.options && field.options.layout === 'radio', where + ' should be a radio list');
    need(problems, choicesOf(where).map(item => item.value).join() === values.join(), where + ' should offer the values in teamTrim in config.js, in the same order: ' + values.join(', '));
    need(problems, field && field.initialValue === values[0] && config.primeTeam[name] === values[0], where + ' should start as ' + values[0] + ', and so should primeTeam in config.js: it is the Prime value');
    need(problems, field && field.fieldset === 'trim', where + ' should be in the Trim box');
    need(problems, field && !constraintNamed(rules, 'required'), where + ' should not be required: a team saved before the trim existed has none');
    need(problems, allowed && allowed.args[0].join() === values.join(), where + ' should only allow: ' + values.join(', '));
    need(problems, rules.some(rule => rule.name === 'error' && rule.args[0]), where + ' has rules and no error message in plain words');
    need(problems, field && /^[A-Z][^\n]*\.$/.test(field.description || '') && field.description.length <= 130, where + ' needs a description of one short sentence line that ends with a full stop');
    need(problems, field && choicesOf(where).every(item => item.title && item.title !== item.value), where + ' should show each choice with a title in words');

    values.forEach((value, index) => {
      const word = config.teamTrim[name][value];
      if (index === 0) return need(problems, word === '', where + ' ' + value + ' is the Prime value and should have no class');
      if (name === 'logoPose') return need(problems, word === '', where + ' ' + value + ' is not used any more and should have no class');

      need(problems, /^[a-z]+(-[a-z]+)+$/.test(word), where + ' ' + value + ' should have a class of lower case words and hyphens, not ' + word);
      need(problems, classes.indexOf(word) === -1, 'the class ' + word + ' is used twice in teamTrim');
      classes.push(word);
    });
  });

  // The seed file: both teams have all eight, Prime the first choice of each and Nova the values of the table in the order
  const docs = {};
  world.teamSeed.split('\n').filter(line => line.trim() !== '').forEach(line => {
    const doc = JSON.parse(line);
    docs[doc._id] = doc;
  });
  names.forEach(name => {
    const values = Object.keys(config.teamTrim[name]);
    need(problems, docs['team-prime'] && docs['team-prime'][name] === values[0], 'team-prime in docs/seed/teams.ndjson should have ' + name + ' ' + values[0]);
    need(problems, docs['team-nova'] && docs['team-nova'][name] === trimOfNova[name], 'team-nova in docs/seed/teams.ndjson should have ' + name + ' ' + trimOfNova[name]);
  });

  // and so do the two teams of the sample content
  names.forEach(name => {
    const sample = world.sample.teams.reduce((all, team) => Object.assign(all, { [team.code]: team }), {});
    need(problems, sample.prime && sample.prime[name] === config.primeTeam[name], 'the Prime team of the sample content should have ' + name + ' ' + config.primeTeam[name]);
    need(problems, sample.nova && sample.nova[name] === trimOfNova[name], 'the Nova team of the sample content should have ' + name + ' ' + trimOfNova[name]);
  });
  // Team name look is not read any more and both teams store solid, so nothing contradicts the switch Outlined name, which is off on both teams and draws the name solid
  ['team-prime', 'team-nova'].forEach(id => need(problems, docs[id] && docs[id].outlinedName === false, id + ' in docs/seed/teams.ndjson should have outlinedName false: both starting teams draw the name solid'));

  // Bird pose is hidden and kept, and the screen ignores it: the seed and the sample leave both teams at auto
  const pose = fieldAt('team.logoPose');
  need(problems, pose && pose.hidden === true && /^Not used any more\./.test(pose.description || ''), 'team.logoPose should be hidden but stay in the schema, with a description that begins Not used any more');

  // Team name look is hidden and kept, and Outlined name, a switch in the Trim box that starts off, replaces it
  const look = fieldAt('team.nameStyle');
  need(problems, look && look.hidden === true && /^Not used any more\./.test(look.description || ''), 'team.nameStyle should be hidden but stay in the schema, with a description that begins Not used any more');
  const outlined = fieldAt('team.outlinedName');
  need(problems, outlined && outlined.type === 'boolean' && outlined.initialValue === false && outlined.fieldset === 'trim' && !outlined.hidden, 'team.outlinedName should be a switch in the Trim box that starts off');
  need(problems, outlined && outlined.description === 'Off draws the name solid' && !constraintNamed(outlined ? constraintsOf(outlined) : [], 'required'), 'the team.outlinedName description should be: Off draws the name solid. It is optional');
  need(problems, world.dashboard.primeTeam.outlinedName === undefined || world.dashboard.primeTeam.outlinedName === false, 'the built-in Prime team should draw its name solid');
  return problems;
}

// The Monday tab of Dashboard Settings (schemas/settingsMonday.js): the connection block, how often the Teletraan computer reads, the
// task board and the milestones board, the owner switch and the older board rows, which are hidden. The names and the
// starting values are the ones in dashboard/config.js and at the top of computer/scripts/monday-sync.sh. The boards and the
// columns are picked from lists that the Teletraan computer fills in (monday-pickers.js).
const mondayTabNames = ['mondayConnection', 'mondayTokenTest', 'mondayEveryMinutes', 'mondayTaskBoard', 'mondayMilestoneBoard', 'mondayShowOwners', 'mondayBoards'];
const taskBlockNames = ['boardId', 'departmentColumn', 'statusColumn', 'teamColumn', 'priorityColumn', 'showColumn', 'assignedColumn', 'pocColumn', 'timelineColumn', 'hoursColumn', 'completedColumn', 'milestoneColumn', 'teamLabels', 'statusIndexes', 'priorityIndexes', 'hideLabel', 'departmentLabels'];
const milestoneBlockNames = ['boardId', 'dateColumn', 'teamColumn', 'departmentColumn', 'statusColumn', 'teamLabels', 'statusIndexes', 'departmentLabels'];
const mondayEntryNames = ['boardId', 'team', 'statusFrom', 'statusColumn', 'backlogLabel', 'progressLabel', 'doneLabel', 'priorityColumn', 'priorityHigh', 'priorityMedium', 'priorityLow', 'dueColumn', 'ownerColumn', 'teamColumn'];

function checkMondayTab() {
  const problems = [];
  const config = world.dashboard;
  const settings = typeByName('dashboardSettings');
  const at = pathText => fieldAt('dashboardSettings.' + pathText);
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const inTab = fieldsIn(settings).filter(field => field.group === 'monday').map(field => field.name);
  const namesOf = field => fieldsIn(field || {}).map(item => item.name).join();

  need(problems, inTab.join() === mondayTabNames.join(), 'the Monday tab should hold ' + mondayTabNames.join(', ') + ', in that order, not ' + inTab.join());

  // The connection block stores nothing, and its input never changes the value
  const block = at('mondayConnection');
  need(problems, block && block.type === 'string' && block.readOnly === true, 'mondayConnection should be a read only string');
  need(problems, block && block.initialValue === undefined && !block.validation, 'mondayConnection should store nothing: no starting value and no rules');
  need(problems, block && block.components && block.components.input === world.mondayStatusInput.MondayStatusInput, 'mondayConnection should draw itself with MondayStatusInput (monday-status-input.js)');
  const source = readModule(path.join(here, 'inputs', 'monday-status-input.js'), 'utf8');
  need(problems, !/onChange|\bset\(|unset\(|patch/.test(source), 'monday-status-input.js should never change the value: no onChange, set, unset or patch');

  // How often: 5 to 120 whole minutes, starting at 30, in the words given
  const every = at('mondayEveryMinutes');
  need(problems, every && every.type === 'number' && every.title === 'How often' && every.initialValue === 30 && every.group === 'monday', 'mondayEveryMinutes should be a number titled How often that starts at 30, in the Monday tab');
  need(problems, every && every.description === 'How often the Teletraan computer reads the boards. The free plan allows about 1,000 reads a day; 30 minutes uses about 150.', 'mondayEveryMinutes should say how often the computer reads, and what the free plan allows');
  ['min', 'max'].forEach(name => need(problems, constraintNamed(rulesOf(every), name) && constraintNamed(rulesOf(every), name).args[0] === (name === 'min' ? 5 : 120), 'mondayEveryMinutes needs ' + name + ' ' + (name === 'min' ? 5 : 120)));
  need(problems, constraintNamed(rulesOf(every), 'integer') && !constraintNamed(rulesOf(every), 'required'), 'mondayEveryMinutes should take whole minutes and not be required');
  need(problems, config.defaultSettings.mondayEveryMinutes === 30, 'config.js should start at 30 minutes');

  // The two blocks: the fields, in order, and the starting values equal the ones in defaultSettings
  const task = at('mondayTaskBoard');
  const milestones = at('mondayMilestoneBoard');
  need(problems, task && task.type === 'object' && task.group === 'monday' && task.title === 'Task board' && namesOf(task) === taskBlockNames.join(), 'mondayTaskBoard should be a block titled Task board with these fields, in this order: ' + taskBlockNames.join(', '));
  need(problems, milestones && milestones.type === 'object' && milestones.group === 'monday' && milestones.title === 'Milestones board' && namesOf(milestones) === milestoneBlockNames.join(), 'mondayMilestoneBoard should be a block titled Milestones board with these fields, in this order: ' + milestoneBlockNames.join(', '));
  need(problems, task && sameData(task.initialValue, config.defaultSettings.mondayTaskBoard), 'the Task board block starts as ' + JSON.stringify(task && task.initialValue) + ' but config.js says ' + JSON.stringify(config.defaultSettings.mondayTaskBoard));
  need(problems, milestones && sameData(milestones.initialValue, config.defaultSettings.mondayMilestoneBoard), 'the Milestones board block starts as ' + JSON.stringify(milestones && milestones.initialValue) + ' but config.js says ' + JSON.stringify(config.defaultSettings.mondayMilestoneBoard));
  need(problems, task && !constraintNamed(rulesOf(task), 'required') && milestones && !constraintNamed(rulesOf(milestones), 'required'), 'the two blocks should not be required: a page saved before they existed must still publish');

  // The seeds are the rebuilt workspace of the brief (docs/monday.md, "The contract")
  const seed = config.defaultSettings.mondayTaskBoard;
  const labelRows = rows => rows.map(row => row.index + '=' + (row.team ? row.team._ref : 'both')).join();
  need(problems, seed.boardId === '18435126893' && config.defaultSettings.mondayMilestoneBoard.boardId === '18435272887', 'the boards should start as the task board 18435126893 and the milestones board 18435272887');
  need(problems, labelRows(seed.teamLabels) === '1=team-prime,0=team-nova,5=both', 'the team labels of the task board should start as 1 for Prime, 0 for Nova and 5 for both teams');
  need(problems, labelRows(config.defaultSettings.mondayMilestoneBoard.teamLabels) === '109=team-prime,8=team-nova,5=both', 'the team labels of the milestones board should start as 109 for Prime, 8 for Nova and 5 for both teams');
  need(problems, sameData(seed.statusIndexes, { todo: 5, inProgress: 0, inReview: 3, stuck: 2, done: 1 }), 'the status indexes should start as To Do 5, In Progress 0, In Review 3, Stuck 2, Done 1');
  need(problems, sameData(seed.priorityIndexes, { high: 2, medium: 0, low: 1 }) && seed.hideLabel === 'Hide', 'the priority indexes should start as High 2, Medium 0, Low 1, and the Hide label as Hide');
  need(problems, sameData(config.defaultSettings.mondayMilestoneBoard.statusIndexes, { notStarted: 5, onTrack: 1, atRisk: 2, done: 3 }), 'the milestone status indexes should start as Not Started 5, On Track 1, At Risk 2, Done 3');
  need(problems, seed.departmentLabels.map(row => row.index + '=' + row.name).join() === '0=Electrical,1=Build,2=Programming,3=Design,4=CNC,5=Unassigned,6=Strategy,7=Business,8=Marketing,9=Operations', 'the department labels of the task board should start as the table of the brief');
  need(problems, seed.departmentLabels.filter(row => row.neverShown).map(row => row.name).join() === 'Unassigned', 'only Unassigned should be marked never shown');
  need(problems, config.defaultSettings.mondayMilestoneBoard.departmentLabels.map(row => row.index + '=' + row.name).join() === '107=Build,9=Electrical,19=Programming,1=Design,11=CNC,104=Strategy,0=Business,18=Marketing,7=Operations,5=All Departments', 'the department labels of the milestones board should start as the table of the brief');

  // Every column is picked from the columns of the board in its block, and takes only the letters, digits, hyphens and underscores of a column id
  const columnNames = ['departmentColumn', 'statusColumn', 'teamColumn', 'priorityColumn', 'showColumn', 'assignedColumn', 'pocColumn', 'timelineColumn', 'hoursColumn', 'completedColumn', 'milestoneColumn'];
  const inputs = { departmentColumn: 'StatusColumnInput', statusColumn: 'StatusColumnInput', teamColumn: 'StatusColumnInput', priorityColumn: 'PriorityColumnInput', showColumn: 'StatusColumnInput', assignedColumn: 'OwnerColumnInput', pocColumn: 'OwnerColumnInput', timelineColumn: 'TimelineColumnInput', hoursColumn: 'HoursColumnInput', completedColumn: 'DateColumnInput', milestoneColumn: 'RelationColumnInput' };
  columnNames.forEach(name => {
    const field = at('mondayTaskBoard.' + name);
    need(problems, field && field.type === 'string' && field.components && field.components.input === world.mondayPickers[inputs[name]], 'mondayTaskBoard.' + name + ' should be a string drawn by ' + inputs[name] + ' (monday-pickers.js)');
    const pattern = constraintNamed(rulesOf(field), 'regex');
    need(problems, pattern && pattern.args[0].test('color_mkx12abc') && pattern.args[0].test('date4') && !pattern.args[0].test('a b') && !pattern.args[0].test('a;b'), 'mondayTaskBoard.' + name + ' should only take the letters, digits, hyphens and underscores of a column id');
    need(problems, field && /cannot be read/.test(field.description || '') && /type/.test(field.description || ''), 'mondayTaskBoard.' + name + ' should say in its description what to do when the list cannot be read');
  });
  const milestoneInputs = { dateColumn: 'DateColumnInput', teamColumn: 'StatusColumnInput', departmentColumn: 'StatusColumnInput', statusColumn: 'StatusColumnInput' };
  Object.keys(milestoneInputs).forEach(name => {
    const field = at('mondayMilestoneBoard.' + name);
    need(problems, field && field.type === 'string' && field.components && field.components.input === world.mondayPickers[milestoneInputs[name]], 'mondayMilestoneBoard.' + name + ' should be a string drawn by ' + milestoneInputs[name]);
  });
  ['mondayTaskBoard.boardId', 'mondayMilestoneBoard.boardId'].forEach(name => {
    const field = at(name);
    need(problems, field && field.type === 'string' && field.components && field.components.input === world.mondayPickers.BoardInput, name + ' should be a string drawn by BoardInput (monday-pickers.js)');
    const pattern = constraintNamed(rulesOf(field), 'regex');
    need(problems, pattern && pattern.args[0].test('123456789') && !pattern.args[0].test('12 34'), name + ' should be digits only');
    need(problems, field && /cannot be read/.test(field.description || '') && /type/.test(field.description || ''), name + ' should say in its description what to do when the list cannot be read');
  });

  // The tables: an index is a whole number from 0 to 999, a team is a reference to a team and blank means both, a department row names a Team lead
  const rowNames = (pathText, expected) => need(problems, namesOf(at(pathText)) === expected, pathText + ' should have these fields in a row, in this order: ' + expected);
  rowNames('mondayTaskBoard.teamLabels', 'index,team');
  rowNames('mondayTaskBoard.departmentLabels', 'index,name,subteam,neverShown');
  rowNames('mondayMilestoneBoard.teamLabels', 'index,team');
  rowNames('mondayMilestoneBoard.departmentLabels', 'index,name,subteam');
  ['mondayTaskBoard.teamLabels.index', 'mondayTaskBoard.departmentLabels.index', 'mondayMilestoneBoard.teamLabels.index', 'mondayMilestoneBoard.departmentLabels.index', 'mondayTaskBoard.statusIndexes.todo', 'mondayTaskBoard.statusIndexes.inProgress', 'mondayTaskBoard.statusIndexes.inReview', 'mondayTaskBoard.statusIndexes.stuck', 'mondayTaskBoard.statusIndexes.done', 'mondayTaskBoard.priorityIndexes.high', 'mondayTaskBoard.priorityIndexes.medium', 'mondayTaskBoard.priorityIndexes.low', 'mondayMilestoneBoard.statusIndexes.notStarted', 'mondayMilestoneBoard.statusIndexes.onTrack', 'mondayMilestoneBoard.statusIndexes.atRisk', 'mondayMilestoneBoard.statusIndexes.done'].forEach(name => {
    const field = at(name);
    const min = constraintNamed(rulesOf(field), 'min');
    const max = constraintNamed(rulesOf(field), 'max');
    need(problems, field && field.type === 'number' && constraintNamed(rulesOf(field), 'integer') && min && min.args[0] === 0 && max && max.args[0] === 999, name + ' should be a whole number from 0 to 999');
  });
  ['mondayTaskBoard.teamLabels.team', 'mondayMilestoneBoard.teamLabels.team'].forEach(name => {
    const field = at(name);
    need(problems, field && field.type === 'reference' && field.to[0].type === 'team' && /blank/.test(field.description || ''), name + ' should be a reference to team that says blank means both teams');
  });
  ['mondayTaskBoard.departmentLabels.subteam', 'mondayMilestoneBoard.departmentLabels.subteam'].forEach(name => {
    const field = at(name);
    need(problems, field && field.type === 'reference' && field.to[0].type === 'subteam', name + ' should be a reference to a Team lead');
  });
  const never = at('mondayTaskBoard.departmentLabels.neverShown');
  need(problems, never && never.type === 'boolean' && never.initialValue === false, 'neverShown should be a switch that starts off');
  const hide = at('mondayTaskBoard.hideLabel');
  need(problems, hide && hide.title === 'Hide label text' && hide.initialValue === 'Hide' && constraintNamed(rulesOf(hide), 'max') && constraintNamed(rulesOf(hide), 'max').args[0] === 30, 'hideLabel should be titled Hide label text, start as Hide, and take up to 30 characters');
  const rowsFor = name => (at(name).of || [])[0];
  need(problems, rowsFor('mondayTaskBoard.departmentLabels').preview.prepare({ index: 5, name: 'Unassigned', never: true }).subtitle === 'Never shown', 'the row of Unassigned should read Never shown');
  need(problems, rowsFor('mondayTaskBoard.teamLabels').preview.prepare({ index: 5 }).subtitle === 'Both teams' && rowsFor('mondayTaskBoard.teamLabels').preview.prepare({ index: 1, team: 'Prime' }).subtitle === 'Prime', 'a team label row with no team should read Both teams');

  // The older board rows are hidden and ignored, and the fields stay so that nothing typed is lost
  const list = at('mondayBoards');
  need(problems, list && list.type === 'array' && list.group === 'monday' && list.hidden === true && /^Not used any more\./.test(list.description || ''), 'mondayBoards should be hidden, with a description that begins Not used any more.');
  need(problems, namesOf(list) === mondayEntryNames.join(), 'a board row of the older tab should keep these fields: ' + mondayEntryNames.join(', '));
  need(problems, list && !list.initialValue && !constraintNamed(rulesOf(list), 'required'), 'mondayBoards should start empty and not be required');
  need(problems, config.defaultSettings.mondayShowOwners === false && sameData(config.defaultSettings.mondayBoards, []), 'config.js should start with no older board rows and the owner names off');
  need(problems, sameData(world.sample.settings.mondayBoards, []) && world.sample.settings.mondayShowOwners === false, 'the sample settings should have no older board rows and the owner names off');
  need(problems, world.mondayScript.indexOf('mondayBoards') === -1 && world.mondayScript.indexOf('backlogLabel') === -1, 'monday-sync.sh should never read the older board rows');

  // The owner switch starts off
  const owners = at('mondayShowOwners');
  need(problems, owners && owners.type === 'boolean' && owners.initialValue === false && owners.group === 'monday' && owners.title === 'Show owner first names on the TV', 'mondayShowOwners should be a switch titled Show owner first names on the TV that starts off, in the Monday tab');
  need(problems, rulesOf(owners).length === 0, 'mondayShowOwners should have no rules');

  // Tasks: the due date is optional and the board sync writes it
  const due = fieldAt('task.dueDate');
  need(problems, due && due.type === 'date' && due.initialValue === undefined && !constraintNamed(rulesOf(due), 'required') && /optional/i.test(due.description || ''), 'task.dueDate should be an optional date with no starting value');
  need(problems, !fieldsIn(settings).some(field => /rows/i.test(field.name) && /monday/i.test(field.name)), 'rows per card are fixed and are not a field');
  return problems;
}

// The Monday data document the Teletraan computer writes (schemas/mondayStatus.js, computer/scripts/monday-sync.sh), the block
// that shows it and the task fields the script writes
const mondayStatusFields = ['connectedAs', 'lastSyncAt', 'lastError', 'boards', 'readings', 'snapshots', 'taskCount', 'hiddenUnassigned', 'callsToday', 'callsDate'];

function checkMondayStatus() {
  const problems = [];
  const type = typeByName('mondayStatus');
  const input = world.mondayStatusInput;
  const script = world.mondayScript;
  const names = item => fieldsIn(item || {}).map(field => field.name).join();

  need(problems, type && type.type === 'document', 'mondayStatus should be a document type');
  need(problems, names(type) === mondayStatusFields.join(), 'mondayStatus should have these fields, in this order: ' + mondayStatusFields.join(', '));
  need(problems, names(fieldAt('mondayStatus.boards')) === 'id,name,itemCount,columns', 'a board of mondayStatus should have these fields, in this order: id, name, itemCount, columns');
  need(problems, names(fieldAt('mondayStatus.boards.columns')) === 'id,title,type', 'a column of mondayStatus should have these fields, in this order: id, title, type');
  need(problems, names(fieldAt('mondayStatus.snapshots')) === 'date,open', 'a count of mondayStatus should have these fields, in this order: date, open');
  need(problems, names(fieldAt('mondayStatus.readings')) === 'boardId,boardName,itemsRead,readAt,note', 'a reading of mondayStatus should have these fields, in this order: boardId, boardName, itemsRead, readAt, note');
  const kinds = { connectedAs: 'string', lastSyncAt: 'datetime', lastError: 'string', boards: 'array', readings: 'array', 'readings.boardId': 'string', 'readings.boardName': 'string', 'readings.itemsRead': 'number', 'readings.readAt': 'datetime', 'readings.note': 'string', snapshots: 'array', taskCount: 'number', hiddenUnassigned: 'number', callsToday: 'number', callsDate: 'date', 'boards.id': 'string', 'boards.name': 'string', 'boards.itemCount': 'number', 'boards.columns': 'array', 'boards.columns.id': 'string', 'boards.columns.title': 'string', 'boards.columns.type': 'string', 'snapshots.date': 'date', 'snapshots.open': 'number' };
  Object.keys(kinds).forEach(name => need(problems, fieldAt('mondayStatus.' + name) && fieldAt('mondayStatus.' + name).type === kinds[name], 'mondayStatus.' + name + ' should be a ' + kinds[name]));
  need(problems, type && type.readOnly === true, 'mondayStatus should be read only: the Teletraan computer writes it');
  need(problems, type && type.__experimental_omnisearch_visibility === false, 'mondayStatus should be kept out of Studio search');
  eachField((where, field) => {
    if (where.split('.')[0] !== 'mondayStatus') return;
    need(problems, !constraintNamed(constraintsOf(field), 'required'), where + ' should not be required: the Teletraan computer leaves out what it did not find');
  });

  // Editors never find it: no line in the sidebar and no place in the New menu
  need(problems, allLines(world.structure.sidebarEntries).every(entry => entry.type !== 'mondayStatus'), 'the sidebar should have no line for the Monday data document');
  const offered = world.config.document.newDocumentOptions([{ templateId: 'mondayStatus' }, { templateId: 'plan' }], {}).map(item => item.templateId).join();
  need(problems, offered === 'plan', 'the New menu should not offer the Monday data document');

  // The script writes the same document, with the same fields, and the tasks with fields that a task has
  need(problems, input.mondayStatusId === 'monday-status', 'the Monday data document should have the fixed id monday-status');
  need(problems, script.indexOf('_id: "monday-status"') !== -1 && script.indexOf('_type: "mondayStatus"') !== -1, 'monday-sync.sh should write the document monday-status of the type mondayStatus');
  ['connectedAs', 'lastSyncAt', 'lastError', 'boards', 'readings', 'snapshots', 'taskCount', 'hiddenUnassigned', 'callsToday', 'callsDate', 'itemCount', 'columns', 'title', 'type', 'date', 'open', 'boardId', 'boardName', 'itemsRead', 'readAt', 'note'].forEach(name => need(problems, script.indexOf(name + ':') !== -1, 'monday-sync.sh should write the field ' + name));
  const task = typeByName('task');
  const written = ['title', 'subteam', 'team', 'status', 'priority', 'showOnBoard', 'contact', 'owners', 'startDate', 'dueDate', 'estHours', 'completedOn', 'milestoneIds', 'hiddenReason', 'show', 'source', 'mondayId', 'mondayBoardId', 'mondayBoardName'];
  written.forEach(name => {
    need(problems, fieldsIn(task).some(field => field.name === name), 'monday-sync.sh writes task.' + name + ', which the task does not have');
    need(problems, script.indexOf(name) !== -1, 'monday-sync.sh should write the field ' + name + ' of a task');
  });
  need(problems, script.indexOf('showOnTv') === -1, 'monday-sync.sh should never write showOnTv: an editor owns it');
  need(problems, script.indexOf('statusIndexes') !== -1 && script.indexOf('group_status') === -1 && script.indexOf('groups_done') === -1, 'monday-sync.sh should read the status by index and never by the title of the group');
  need(problems, script.indexOf('item_group') === -1 && script.indexOf('group {') === -1, 'monday-sync.sh should never ask for the group of an item');
  const milestone = typeByName('milestone');
  ['name', 'targetDate', 'team', 'subteam', 'status', 'show'].forEach(name => need(problems, fieldsIn(milestone).some(field => field.name === name) && script.indexOf(name) !== -1, 'monday-sync.sh should write the field ' + name + ' of a milestone'));
  need(problems, script.indexOf('task-monday-') !== -1 && script.indexOf('milestone-monday-') !== -1, 'monday-sync.sh should write the ids task-monday-<item> and milestone-monday-<item>');
  need(problems, script.indexOf('daily_limit=900') !== -1 && script.indexOf('Daily read limit reached; reads resume at midnight.') !== -1 && script.indexOf('max_requests=4') !== -1, 'monday-sync.sh should stop at 900 reads a day with the words Daily read limit reached; reads resume at midnight., and make at most 4 requests');
  need(problems, script.indexOf('\ntitle_limit=' + contract.task.title.max + '\n') !== -1, 'title_limit in monday-sync.sh should be the limit of the task title, ' + contract.task.title.max);
  need(problems, script.indexOf('\ncontact_limit=' + contract.task.contact.max + '\n') !== -1, 'contact_limit in monday-sync.sh should be the limit of the task contact, ' + contract.task.contact.max);
  need(problems, script.indexOf('\nsnapshots_kept=120\n') !== -1, 'snapshots_kept in monday-sync.sh should be 120, as the description of mondayStatus.snapshots says');
  const statuses = choicesOf('task.status').map(item => item.value);
  ['up-next', 'in-progress', 'done'].forEach(value => need(problems, statuses.indexOf(value) !== -1 && script.indexOf('"' + value + '"') !== -1, 'monday-sync.sh should write the task status ' + value));
  ['blocked', 'in-review'].forEach(value => need(problems, statuses.indexOf(value) !== -1 && script.indexOf('"' + value + '"') !== -1, 'monday-sync.sh should write the task status ' + value));
  choicesOf('task.priority').forEach(item => need(problems, script.indexOf('"' + item.value + '"') !== -1, 'monday-sync.sh should write the task priority ' + item.value));
  need(problems, script.indexOf('subteam-unmatched') === -1 && script.indexOf('[Unmatched]') === -1, 'monday-sync.sh should make no Team lead for tasks that match nobody: they are hidden with the reason unassigned');
  need(problems, script.indexOf('\nmilestone_limit=' + contract.milestone.name.max + '\n') !== -1, 'milestone_limit in monday-sync.sh should be the limit of the milestone name, ' + contract.milestone.name.max);

  // The lines of the block, in plain words, and a document that is missing or cannot be read
  const now = new Date('2027-01-12T15:00:00.000Z');
  const ago = minutes => new Date(now.getTime() - minutes * 60000).toISOString();
  const none = input.describeMondayStatus(null, now);
  need(problems, none.map(line => line.label).join() === 'Connected as,Last sync,Boards the token can see,Last error', 'the block should have these lines: Connected as, Last sync, Boards the token can see, Last error');
  need(problems, none[0].text === 'Not known' && none[1].text === 'Not yet' && none[2].text === 'None' && none[3].text === 'None', 'a missing document should say Not known, Not yet, None and None');
  const some = input.describeMondayStatus({ connectedAs: 'Jordan', lastSyncAt: ago(5), boards: 3, lastError: 'Monday refused the token.' }, now);
  need(problems, some[0].text === 'Jordan' && /^5 minutes ago \(/.test(some[1].text) && some[2].text === '3 boards' && some[3].text === 'Monday refused the token.', 'the lines should say who, how long ago, how many boards and the last error');
  need(problems, input.describeMondayStatus({ boards: 1 }, now)[2].text === '1 board', 'one board should read 1 board');
  need(problems, JSON.stringify(input.mondayStatusView(null, now)).indexOf('Reading the connection to Monday') !== -1, 'the block should say it is reading while it waits');
  const missing = JSON.stringify(input.mondayStatusView({ doc: null, unreadable: false }, now));
  need(problems, missing.indexOf('No connection yet') !== -1 && missing.indexOf('MONDAY_API_TOKEN') !== -1 && missing.indexOf('local.env') !== -1 && missing.indexOf('5 minutes') !== -1, 'the block should say No connection yet, with the token to add to local.env on the Teletraan computer and the 5 minutes to wait, when the document is missing');
  need(problems, JSON.stringify(input.mondayStatusView({ doc: null, unreadable: true }, now)).indexOf('could not be read') !== -1, 'the block should say so when the document cannot be read');
  need(problems, JSON.stringify(input.mondayStatusView({ doc: { lastSyncAt: ago(5) }, unreadable: false }, now)).indexOf('Last sync') !== -1, 'the block should show the lines when there is a document');
  need(problems, typeof input.MondayStatusInput === 'function' && JSON.stringify(input.MondayStatusInput()).indexOf('Reading the connection to Monday') !== -1, 'MondayStatusInput should start by saying it is reading');
  return problems;
}

// readMondayStatus asks the published document by its id, and never fails. The stand-in client gives the answers.
async function checkMondayRead() {
  const problems = [];
  const read = world.mondayStatusInput.readMondayStatus;
  const asked = [];
  const answering = value => ({ fetch: async (...args) => { asked.push(args); return value; } });

  const found = await read(answering({ lastSyncAt: '2027-01-12T15:00:00.000Z', boards: 2 }));
  need(problems, found.doc && found.doc.boards === 2 && found.unreadable === false, 'a document that is there should be handed over');
  need(problems, asked.length === 1 && /_id == \$id/.test(asked[0][0]) && asked[0][1].id === 'monday-status' && asked[0][2].perspective === 'published', 'readMondayStatus should ask for the published document with the id monday-status');
  need(problems, sameData(await read(answering(null)), { doc: null, unreadable: false }), 'no document is a good answer, not a failure');
  need(problems, sameData(await read(answering('text')), { doc: null, unreadable: false }), 'an answer that is not a document should be read as no document');
  need(problems, sameData(await read({ fetch: async () => { throw new Error('offline'); } }), { doc: null, unreadable: true }), 'a client that fails should give unreadable');
  need(problems, sameData(await read({}), { doc: null, unreadable: true }), 'a client with no fetch should give unreadable');
  return problems;
}

// The lines under the connection block: how often the Teletraan computer reads, the reads used today, and the tasks made with how many are
// hidden for want of a department. A number that cannot be read leaves its line out.
function checkMondayCounts() {
  const problems = [];
  const input = world.mondayStatusInput;
  const now = new Date('2027-01-12T15:00:00.000Z');
  const doc = { connectedAs: 'Jordan', lastSyncAt: '2027-01-12T14:55:00.000Z', boards: 21 };
  const words = node => JSON.stringify(node);

  need(problems, input.describeMondayStatus(doc, now).map(line => line.label).join() === 'Connected as,Last sync,Boards the token can see,Last error', 'the four lines of the block should not change');
  const some = input.describeMondayWork({ every: 30, tasks: 12, hidden: 2, calls: 6, callsDate: '2027-01-12' });
  need(problems, some.map(line => line.label).join() === 'Reads every,Reads today,Tasks from the board', 'the work lines should be Reads every, Reads today and Tasks from the board, in that order');
  need(problems, some[0].text === '30 minutes' && some[1].text === '6 of 900 on 2027-01-12' && some[2].text === '12 tasks, 2 hidden (no department)', 'the work lines should read "Reads every 30 minutes", "6 of 900 on 2027-01-12" and "12 tasks, 2 hidden (no department)"');
  const one = input.describeMondayWork({ every: 1, tasks: 1, hidden: 0 });
  need(problems, one[0].text === '1 minute' && one[1].text === '1 task, 0 hidden (no department)', 'one minute and one task should read 1 minute and 1 task');
  need(problems, input.describeMondayWork({ every: 5, tasks: 0 })[1].text === 'None', 'no tasks should read None');
  need(problems, input.describeMondayWork({ tasks: 3 }).map(line => line.label).join() === 'Tasks from the board' && input.describeMondayWork({ tasks: 3 })[0].text === '3 tasks', 'a number that could not be read should leave its line out, and a hidden count that is not known should leave its words out');
  need(problems, input.describeMondayWork(null).length === 0 && input.describeMondayWork({ every: 'x', tasks: 'y', calls: null }).length === 0 && input.describeMondayWork(undefined).length === 0, 'a value that is not a number should leave its line out');
  need(problems, input.dailyReads === 900 && input.startingMinutes === 30, 'the block should know the daily limit of 900 reads and the starting 30 minutes');

  // The two boards of the form
  need(problems, sameData(input.boardRowsOf({ boardId: '1' }, { boardId: '2' }), [{ boardId: '1' }, { boardId: '2' }]), 'boardRowsOf should give the task board and the milestones board of the form');
  need(problems, sameData(input.boardRowsOf(undefined, null), [{ boardId: '18435126893' }, { boardId: '18435272887' }]) && sameData(input.boardRowsOf({ boardId: '' }, 'text'), [{ boardId: '18435126893' }, { boardId: '18435272887' }]), 'a block nobody has filled in should be the starting board');

  // The view: the lines come after the four, taken from the document when it has them
  const full = Object.assign({ taskCount: 9, hiddenUnassigned: 1, callsToday: 7, callsDate: '2027-01-12' }, doc);
  const view = words(input.mondayStatusView({ doc: full, unreadable: false }, now, { every: 30, tasks: 12 }));
  need(problems, view.indexOf('Reads every') !== -1 && view.indexOf('30 minutes') !== -1 && view.indexOf('9 tasks, 1 hidden (no department)') !== -1 && view.indexOf('7 of 900 on 2027-01-12') !== -1 && view.indexOf('Last error') < view.indexOf('Reads every'), 'the work lines should come below the four lines, and the counts of the document win');
  const older = words(input.mondayStatusView({ doc: doc, unreadable: false }, now, { every: 30, tasks: 12 }));
  need(problems, older.indexOf('12 tasks') !== -1 && older.indexOf('hidden (no department)') === -1 && older.indexOf('Reads today') === -1, 'a document with no counts should show the tasks that were counted, and no hidden words');
  const unknown = words(input.mondayStatusView({ doc: doc, unreadable: false }, now, { every: null, tasks: null }));
  need(problems, unknown.indexOf('Reads every') === -1 && unknown.indexOf('Tasks from the board') === -1 && unknown.indexOf('Last error') !== -1, 'numbers that cannot be read should leave out their lines and keep the four');
  need(problems, words(input.mondayStatusView({ doc: doc, unreadable: false }, now)).indexOf('Reads every') === -1, 'a view with no work argument should show the four lines only');
  need(problems, input.noBoardNote === undefined && input.boardsChosen === undefined, 'the block has two fixed boards, so it needs no line for a form with no board');

  // A line for each board row of the form: the name, the items read, the tasks on the TV, when it was read, and why a board gave nothing
  const ago = minutes => new Date(now.getTime() - minutes * 60000).toISOString();
  const status = {
    names: [{ id: '111', name: 'Build board' }, { id: '222', name: 'Outreach board' }, { id: '333', name: 'Parts board' }],
    readings: [
      { boardId: '111', boardName: 'Build board', itemsRead: 12, readAt: ago(5) },
      { boardId: '222', boardName: 'Outreach board', itemsRead: 0, readAt: ago(5), note: 'monday gave no items for board 222' },
      { boardId: '999', itemsRead: 4, readAt: ago(5) },
    ],
  };
  const entries = [{ boardId: '111' }, { boardId: '222' }, { boardId: '333' }, { boardId: '999' }, { boardId: '' }, { team: 'x' }, null, { boardId: '111' }];
  const rows = input.describeBoardRows(entries, status, ['111', '111', '111', '222', null], now);
  const line = id => rows.filter(row => row.key === id)[0];
  need(problems, rows.map(row => row.key).join() === '111,222,333,999', 'the block should have a line for each board row that has a board, once each, in the order of the form');
  need(problems, line('111').label === 'Build board' && line('111').text === '12 items read · 3 shown on the TV · Read 5 minutes ago' && line('111').reason === '', 'a board that was read should say its items, the tasks on the TV and when. It reads "' + line('111').text + '"');
  need(problems, line('222').text === '0 items read · 1 shown on the TV · Read 5 minutes ago' && line('222').reason === 'Monday gave no items for board 222.', 'a board that gave no items should say 0 items read and the reason of the Teletraan computer');
  need(problems, line('333').text === '0 items read · 0 shown on the TV · Not read yet' && line('333').reason === 'The Teletraan computer has not read this board yet. Wait for the next sync.', 'a board the computer has not read yet should say so');
  need(problems, line('999').label === 'Board 999' && line('999').text === '0 items read · 0 shown on the TV · Not read yet' && line('999').reason === 'The token cannot see this board, or the board number is wrong.', 'a board number the token cannot see should read 0 items with the reason, whatever an old reading says');
  need(problems, input.describeBoardRows([{ boardId: '111' }], status, null, now)[0].text === '12 items read · Read 5 minutes ago', 'tasks that cannot be counted should leave their words out');
  need(problems, input.describeBoardRows([{ boardId: '111' }], { readings: [{ boardId: '111', itemsRead: 1, readAt: ago(1) }] }, [], now)[0].reason === '' && input.describeBoardRows([{ boardId: '111' }], null, [], now)[0].reason === 'The Teletraan computer has not read this board yet. Wait for the next sync.', 'a document with no list of boards cannot say a board is unseen');
  need(problems, input.describeBoardRows([{ boardId: '111' }], { names: [{ id: '111', name: 'Empty' }], readings: [{ boardId: '111', itemsRead: 0, readAt: ago(1) }] }, [], now)[0].reason === 'The board has no items.', 'a board with no items and no note should say it has none');
  need(problems, input.describeBoardRows('text', 'text', 'text', now).length === 0 && input.describeBoardRows(undefined, undefined, undefined, now).length === 0, 'answers of an odd shape should give no lines');
  const withRows = JSON.stringify(input.mondayStatusView({ doc: doc, unreadable: false }, now, { every: 30, tasks: 12, boards: rows }));
  need(problems, withRows.indexOf('Build board') !== -1 && withRows.indexOf('12 items read') !== -1 && withRows.indexOf('The token cannot see this board') !== -1 && withRows.indexOf('Last error') < withRows.indexOf('Build board'), 'the block should show the lines of the boards below its other lines');
  need(problems, JSON.stringify(input.mondayStatusView({ doc: doc, unreadable: false }, now, { every: 30, tasks: 1 })).indexOf('data-board') === -1, 'a block given no board lines should show none');
  need(problems, words(input.mondayStatusView(null, now, { every: 30, tasks: 0 })).indexOf('Reads every') === -1 && words(input.mondayStatusView({ doc: null, unreadable: true }, now, { every: 30, tasks: 0 })).indexOf('Reads every') === -1, 'while reading, or when the document cannot be read, the block should show no work lines');
  return problems;
}

// readMondayShownBoards asks for the board of each published task from the board that is on the TV, and never fails
async function checkMondayShownBoards() {
  const problems = [];
  const read = world.mondayStatusInput.readMondayShownBoards;
  const asked = [];
  const answering = value => ({ fetch: async (...args) => { asked.push(args); return value; } });

  need(problems, sameData(await read(answering(['111', null, '222', 7])), ['111', '222']), 'the board numbers of the tasks on the TV should be handed over, and what is not a number should be left out');
  need(problems, asked.length === 1 && /source == "monday"/.test(asked[0][0]) && /showOnTv != false/.test(asked[0][0]) && /showOnBoard != false/.test(asked[0][0]) && /show != false/.test(asked[0][0]) && /drafts/.test(asked[0][0]) && /mondayBoardId/.test(asked[0][0]) && asked[0][2].perspective === 'published', 'the question should ask for the published tasks from the board that are on the TV, and their board numbers');
  need(problems, (await read(answering(null))) === null && (await read(answering('text'))) === null, 'an answer that is not a list cannot be counted');
  need(problems, (await read({ fetch: async () => { throw new Error('offline'); } })) === null && (await read({})) === null, 'a client that fails should give null');
  return problems;
}

// readMondayTaskCount asks for the number of published tasks with the source monday, and never fails
async function checkMondayTaskCount() {
  const problems = [];
  const read = world.mondayStatusInput.readMondayTaskCount;
  const asked = [];
  const answering = value => ({ fetch: async (...args) => { asked.push(args); return value; } });

  need(problems, await read(answering(21)) === 21 && await read(answering(0)) === 0, 'a number should be handed over, and so should 0');
  need(problems, asked.length === 2 && /_type == "task"/.test(asked[0][0]) && /source == "monday"/.test(asked[0][0]) && /^count\(/.test(asked[0][0]) && asked[0][2].perspective === 'published', 'readMondayTaskCount should count the published tasks with the source monday');
  need(problems, /drafts\.\*\*/.test(asked[0][0]), 'readMondayTaskCount should leave out drafts');
  need(problems, await read(answering(null)) === null && await read(answering('text')) === null && await read(answering(-1)) === null && await read(answering({ count: 3 })) === null, 'an answer that is not a count should give null');
  need(problems, await read({ fetch: async () => { throw new Error('offline'); } }) === null, 'a client that fails should give null');
  need(problems, await read({}) === null, 'a client with no fetch should give null');
  return problems;
}

// The pickers of a board entry (monday-pickers.js): the lists they build, the plain box they fall back to,
// and what they write
function checkMondayPickers() {
  const problems = [];
  const pickers = world.mondayPickers;
  const columns = [
    { id: 'name', title: 'Name', type: 'name' },
    { id: 'status', title: 'Status', type: 'status' },
    { id: 'date4', title: 'Due', type: 'date' },
    { id: 'person', title: 'Owner', type: 'people' },
    { id: 'text', title: '', type: '' },
  ];
  const boards = [{ id: '111', name: '[Build board]', columns: columns }, { id: '222', name: '[Same name]', columns: [] }, { id: '333', name: '[Same name]', columns: [] }, { id: '444', name: '', columns: [] }];
  const ids = list => list.map(choice => choice.id).join();
  const labels = list => list.map(choice => choice.label).join(' | ');

  // What is kept of the document
  const cleaned = pickers.cleanBoards({ boards: [{ id: '1', name: 'A', columns: [{ id: 'x', title: 'X', type: 'status' }, { title: 'No id' }, 'text'] }, { name: 'No id' }, 'text', null, { id: 7 }] });
  need(problems, sameData(cleaned, [{ id: '1', name: 'A', columns: [{ id: 'x', title: 'X', type: 'status' }] }]), 'cleanBoards should keep a board and a column only when it has an id');
  need(problems, sameData(pickers.cleanBoards(null), []) && sameData(pickers.cleanBoards({ boards: 'text' }), []) && sameData(pickers.cleanBoards({}), []), 'cleanBoards should give no boards for a document that is not one');

  // The board list: an empty line, the names, the number when two boards share a name, and a stored board that is gone
  need(problems, ids(pickers.boardChoices(boards, '')) === ',111,222,333,444', 'the board list should start with an empty line and then list the boards in order');
  need(problems, labels(pickers.boardChoices(boards, '')) === 'Pick the board | [Build board] | [Same name] (222) | [Same name] (333) | Board 444', 'the board list should show names, the number of a board that shares its name, and Board 444 for a board with no name');
  need(problems, labels(pickers.boardChoices(boards, '999')).endsWith('Board 999 (not in the list)') && ids(pickers.boardChoices(boards, '999')).endsWith(',999'), 'a stored board that is not in the list should stay, with a note');
  need(problems, !labels(pickers.boardChoices(boards, '111')).includes('not in the list'), 'a stored board that is in the list needs no note');

  // The column lists: the columns that fit first, the others with their type, the empty line by kind, and nothing for a board that is not there
  const status = pickers.columnChoices(boards, '111', 'status', '');
  need(problems, ids(status) === ',status,name,date4,person,text' && status[0].label === 'Pick the column', 'the status column list should start with an empty line, then the columns that fit, then the others');
  need(problems, status.filter(choice => choice.group === 'fits').map(choice => choice.label).join() === 'Status (Status)' && status.filter(choice => choice.group === 'others').map(choice => choice.label).join() === 'Name (Name),Due (Date),Owner (People),text', 'every column should show its title and its type in words, and a column with no title and no type shows its id');
  need(problems, labels(pickers.columnChoices(boards, '111', 'due', '')).startsWith('No due date column | Due (Date) |'), 'the due date list should offer No due date column first and the date column next');
  const kinds = [['status', 'Status'], ['color', 'Status'], ['date', 'Date'], ['timeline', 'Timeline'], ['people', 'People'], ['multiple-person', 'People'], ['text', 'Text'], ['long_text', 'Long text'], ['numbers', 'Numbers'], ['', ''], [undefined, ''], [7, '']];
  kinds.forEach(pair => need(problems, pickers.typeText(pair[0]) === pair[1], 'the column type ' + pair[0] + ' should read ' + pair[1] + ', it reads ' + pickers.typeText(pair[0])));
  const another = [{ id: '111', name: 'A', columns: [{ id: 'mine', title: 'Mine', type: 'status' }] }, { id: '222', name: 'B', columns: [{ id: 'theirs', title: 'Theirs', type: 'status' }] }];
  need(problems, ids(pickers.columnChoices(another, '111', 'status', '')) === ',mine' && ids(pickers.columnChoices(another, '222', 'status', '')) === ',theirs', 'a column list should hold the columns of the board of its own entry and no other');
  need(problems, sameData(pickers.columnChoices(boards, '222', 'status', ''), []), 'a board whose columns the Teletraan computer has not listed yet gives no columns');
  need(problems, pickers.columnChoices(boards, '111', 'owner', '')[0].label === 'No owner column' && pickers.columnChoices(boards, '111', 'priority', '')[0].label === 'No priority column' && pickers.columnChoices(boards, '111', 'team', '')[0].label === 'Use the group names', 'the empty lines should say what no column means');
  need(problems, pickers.columnChoices(boards, '111', 'owner', '').filter(choice => choice.group === 'fits').map(choice => choice.id).join() === 'person', 'the owner list should put the people column first');
  need(problems, sameData(pickers.columnChoices(boards, '999', 'status', ''), []) && sameData(pickers.columnChoices(boards, '', 'status', ''), []), 'a board that is not in the list gives no columns');
  need(problems, labels(pickers.columnChoices(boards, '111', 'status', 'gone')).endsWith('gone (not on the board)'), 'a stored column that is not on the board should stay, with a note');
  need(problems, Object.keys(pickers.columnKinds).join() === 'status,priority,due,owner,team,timeline,hours,date,relation', 'the kinds of column field should be status, priority, due, owner, team, timeline, hours, date and relation');
  need(problems, pickers.columnChoices(boards, '111', 'date', '')[0].label === 'Pick the column' && pickers.columnChoices(boards, '111', 'date', '').filter(choice => choice.group === 'fits').map(choice => choice.id).join() === 'date4', 'the date list should put the date columns first');

  // The path of the board in the same entry, and what a pick writes
  need(problems, sameData(pickers.siblingPath(['mondayBoards', { _key: 'k1' }, 'statusColumn'], 'boardId'), ['mondayBoards', { _key: 'k1' }, 'boardId']) && sameData(pickers.siblingPath('text', 'boardId'), ['boardId']), 'siblingPath should swap the last name of the path');
  need(problems, sameData(pickers.pickPatch('111'), { type: 'set', value: '111' }) && sameData(pickers.pickPatch(''), { type: 'unset' }), 'a pick should write the id, and the empty line should clear the field');
  const clears = pickers.clearsOnNewBoard;
  need(problems, clears('111', '222', 'status') === true && clears('111', '', 'status') === true && clears('', '222', 'status') === true, 'a column should be cleared when the board of its entry changes, to another board or to none');
  need(problems, clears('111', '111', 'status') === false && clears('111', '222', '') === false && clears('111', '222', undefined) === false && clears('', '', 'status') === false, 'a column should stay when the board is the same, and there is nothing to clear in an empty field');

  // The views. While reading, a note. Unreadable or empty, the plain box and the reason. Otherwise the list.
  const written = [];
  const props = value => ({ id: 'x', value: value, readOnly: false, onChange: patch => written.push(patch), renderDefault: () => ({ type: 'plain-box' }) });
  const words = node => JSON.stringify(node);
  need(problems, words(pickers.boardPickerView(null, props(''))).indexOf('Reading the list of boards') !== -1, 'the board picker should say it is reading while it waits');
  const unreadable = pickers.boardPickerView({ boards: [], unreadable: true }, props('123'));
  need(problems, words(unreadable).indexOf('plain-box') !== -1 && words(unreadable).indexOf('could not be read, so type the board number') !== -1, 'a board picker whose list cannot be read should be the plain box, with the reason');
  const empty = pickers.boardPickerView({ boards: [], unreadable: false }, props(''));
  need(problems, words(empty).indexOf('plain-box') !== -1 && words(empty).indexOf('has not listed any boards yet') !== -1, 'a board picker with no boards listed should be the plain box, with the reason');
  need(problems, words(pickers.boardPickerView({ boards: [], unreadable: true }, { id: 'x', value: '1', onChange: () => {} })).indexOf('could not be read') !== -1, 'a picker should still work when renderDefault is missing');

  const list = pickers.boardPickerView({ boards: boards, unreadable: false }, props('222'));
  need(problems, list.type === 'select' && list.props.value === '222' && list.props.disabled === false, 'the board picker should be a list with the stored board picked');
  need(problems, list.children.map(option => option.props.value).join() === ',111,222,333,444' && list.children[1].children[0] === '[Build board]', 'the board picker should list the boards by name, storing their numbers');
  list.props.onChange({ target: { value: '111' } });
  list.props.onChange({ target: { value: '' } });
  need(problems, sameData(written, [{ type: 'set', value: '111' }, { type: 'unset' }]), 'picking a board should write its number, and the empty line should clear it');
  need(problems, pickers.boardPickerView({ boards: boards, unreadable: false }, Object.assign(props(''), { readOnly: true })).props.disabled === true, 'the board picker should be disabled when the field is read only');

  need(problems, words(pickers.columnPickerView(null, props(''), 'status', '111')).indexOf('Reading the list of columns') !== -1, 'the column picker should say it is reading while it waits');
  need(problems, words(pickers.columnPickerView({ boards: [], unreadable: true }, props('status'), 'status', '111')).indexOf('could not be read, so type the column id') !== -1, 'a column picker whose list cannot be read should be the plain box, with the reason');
  need(problems, words(pickers.columnPickerView({ boards: boards, unreadable: false }, props(''), 'status', '')).indexOf('Pick the board first') !== -1, 'a column picker with no board picked should say to pick the board first');
  need(problems, pickers.waitForSync === 'Read the board first: wait for the next sync.', 'the picker should say: Read the board first: wait for the next sync.');
  ['999', '222'].forEach(boardId => {
    const away = pickers.columnPickerView({ boards: boards, unreadable: false }, props('status'), 'status', boardId);
    need(problems, away.type === 'p' && words(away).indexOf(pickers.waitForSync) !== -1 && words(away).indexOf('plain-box') === -1, 'a column picker for board ' + boardId + ', whose columns the Teletraan computer has not listed, should say to wait for the next sync and not list the columns of another board');
  });
  need(problems, words(pickers.columnPickerView({ boards: [], unreadable: false }, props(''), 'status', '111')).indexOf(pickers.waitForSync) !== -1, 'a column picker should say to wait for the next sync when the Teletraan computer has listed no board at all');

  const columnList = pickers.columnPickerView({ boards: boards, unreadable: false }, props('date4'), 'status', '111');
  need(problems, columnList.type === 'select' && columnList.props.value === 'date4', 'the column picker should be a list with the stored column picked');
  need(problems, columnList.children.map(child => child.type + ':' + (child.props.label || child.props.value)).join() === 'option:,optgroup:Fits,optgroup:Other', 'the column picker should have the empty line, then the columns that fit under Fits and the others under Other');
  need(problems, columnList.children[2].children[0].map(option => option.props.value).join() === 'name,date4,person,text', 'the other columns should store their ids');
  const onlyOthers = pickers.columnPickerView({ boards: [{ id: '5', name: 'Five', columns: [{ id: 'a', title: 'A', type: 'text' }] }], unreadable: false }, props(''), 'status', '5');
  need(problems, onlyOthers.children.map(child => child.type + ':' + (child.props.label || child.props.value)).join() === 'option:,optgroup:Other', 'with no column that fits, the others are one group called Other');

  // The inputs: one for the board and one for each kind of column, reading the board of the same entry
  ['BoardInput', 'StatusColumnInput', 'PriorityColumnInput', 'DueColumnInput', 'OwnerColumnInput', 'TeamColumnInput', 'TimelineColumnInput', 'HoursColumnInput', 'DateColumnInput', 'RelationColumnInput'].forEach(name => {
    need(problems, typeof pickers[name] === 'function', name + ' should be a component');
    const drawn = pickers[name]({ id: 'x', value: '', path: ['mondayTaskBoard', 'statusColumn'], onChange: () => {} });
    need(problems, JSON.stringify(drawn).indexOf('Reading the list of') !== -1, name + ' should start by saying it is reading');
  });

  // Read only: the pickers write only what the person picks, and only through onChange
  const text = readModule(path.join(here, 'inputs', 'monday-pickers.js'), 'utf8');
  need(problems, !/\.patch\(|\.create\(|\.createOrReplace\(|\.delete\(|\.mutate\(|\.transaction\(|useDocumentOperation/.test(text), 'monday-pickers.js should never change a document itself: no patch, create, delete or mutate');
  return problems;
}

// readMondayBoards asks the published document by its id, and never fails
async function checkMondayBoardsRead() {
  const problems = [];
  const read = world.mondayPickers.readMondayBoards;
  const asked = [];
  const answering = value => ({ fetch: async (...args) => { asked.push(args); return value; } });

  const found = await read(answering({ boards: [{ id: '111', name: 'A', columns: [{ id: 'x', title: 'X', type: 'status' }] }] }));
  need(problems, found.unreadable === false && found.boards.length === 1 && found.boards[0].columns[0].id === 'x', 'boards that are there should be handed over');
  need(problems, asked.length === 1 && /_id == \$id/.test(asked[0][0]) && asked[0][1].id === 'monday-status' && asked[0][2].perspective === 'published', 'readMondayBoards should ask for the published document with the id monday-status');
  need(problems, sameData(await read(answering(null)), { boards: [], unreadable: false }), 'no document is a good answer, not a failure');
  need(problems, sameData(await read(answering('text')), { boards: [], unreadable: false }), 'an answer that is not a document should be read as no boards');
  need(problems, sameData(await read({ fetch: async () => { throw new Error('offline'); } }), { boards: [], unreadable: true }), 'a client that fails should give unreadable');
  need(problems, sameData(await read({}), { boards: [], unreadable: true }), 'a client with no fetch should give unreadable');
  return problems;
}

// The Photo fit setting (Dashboard Settings, Screen tab) and the Fit of one photo. The choices, the starting value and
// the sample are the ones in dashboard/config.js. Neither is required, because Dashboard Settings and a photo saved
// before these fields existed have none, and must still publish. The screen reads a missing one as fill and as the setting.
function checkPhotoFit() {
  const problems = [];
  const config = world.dashboard;
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const setting = fieldAt('dashboardSettings.photoFit');
  const own = fieldAt('photo.fit');
  const titles = { setting: 'Same as Dashboard Settings', fill: 'Fill the frame', whole: 'Show the whole photo' };

  need(problems, config.photoFits.join() === 'fill,whole', 'photoFits in config.js should be fill and whole, not ' + config.photoFits.join());
  need(problems, config.defaultSettings.photoFit === 'fill', 'the default photoFit in config.js should be fill');

  need(problems, setting && setting.title === 'Photo fit' && setting.group === 'screen', 'photoFit should be titled Photo fit, in the Screen tab');
  need(problems, setting && setting.options && setting.options.layout === 'radio', 'photoFit should be a radio list');
  need(problems, choicesOf('dashboardSettings.photoFit').map(item => item.value).join() === config.photoFits.join(), 'photoFit should offer the names in config.js: ' + config.photoFits.join(', '));
  choicesOf('dashboardSettings.photoFit').forEach(item => need(problems, item.title === titles[item.value], 'the photoFit choice ' + item.value + ' should be titled ' + titles[item.value]));
  need(problems, setting && setting.initialValue === 'fill', 'photoFit should start as fill');
  need(problems, setting && !constraintNamed(rulesOf(setting), 'required'), 'photoFit should not be required: Dashboard Settings saved before it existed has none');
  const allowed = constraintNamed(rulesOf(setting), 'valid');
  need(problems, allowed && allowed.args[0].join() === config.photoFits.join(), 'photoFit should only allow: ' + config.photoFits.join(', '));
  need(problems, rulesOf(setting).some(rule => rule.name === 'error' && rule.args[0]), 'photoFit has rules and no error message in plain words');

  need(problems, own && own.title === 'Fit' && /optional/i.test(own.description || ''), 'photo.fit should be titled Fit and described as optional');
  need(problems, own && own.options && own.options.layout === 'radio', 'photo.fit should be a radio list');
  choicesOf('photo.fit').forEach(item => need(problems, item.title === titles[item.value], 'the photo.fit choice ' + item.value + ' should be titled ' + titles[item.value]));
  need(problems, choicesOf('photo.fit').map(item => item.value).join() === ['setting'].concat(config.photoFits).join(), 'photo.fit should offer setting and then the names in config.js');
  need(problems, own && own.initialValue === 'setting', 'photo.fit should start as setting, the same as Dashboard Settings');
  need(problems, own && !constraintNamed(rulesOf(own), 'required'), 'photo.fit should not be required: a photo saved before it existed has none');
  const ownAllowed = constraintNamed(rulesOf(own), 'valid');
  need(problems, ownAllowed && ownAllowed.args[0].join() === ['setting'].concat(config.photoFits).join(), 'photo.fit should only allow setting and the names in config.js');

  // The Photo size does nothing now, so the choices of the Photo fit say what the photo fills
  need(problems, setting && /whole panel/.test(setting.description || '') && own && /fill the panel/.test(own.description || ''), 'the photoFit and photo.fit descriptions should say that a photo fills the panel');

  // The screen asks for the field, and the sample content shows both fits on photos of different shapes
  need(problems, /"photos": \*\[_type == "photo"\][^}]*\bfit,/.test(world.sanitySource), 'the photos part of contentQuery should ask for fit');
  const sample = world.sample;
  need(problems, config.photoFits.indexOf(sample.settings.photoFit) !== -1, 'the sample settings need a photoFit of ' + config.photoFits.join(' or '));
  const photos = sample.photos || [];
  photos.forEach((photo, index) => {
    const where = 'sample photo ' + (index + 1);
    need(problems, photo.fit === undefined || photo.fit === 'setting' || config.photoFits.indexOf(photo.fit) !== -1, where + ' has a fit that is not setting, ' + config.photoFits.join(' or '));
    const size = photo.size;
    need(problems, size && size.width > 0 && size.height > 0, where + ' needs a size, with a width and a height in pixels');
  });
  need(problems, photos.some(photo => photo.fit === 'whole'), 'one sample photo should have fit whole');
  const shapes = photos.filter(photo => photo.size).map(photo => Math.round(photo.size.width / photo.size.height * 100));
  need(problems, new Set(shapes).size === shapes.length, 'the sample photos should each have a different shape');
  return problems;
}

// The Monday Boards page, under Tasks (monday-boards-view.js, with its words and rows in
// monday-boards-parts.js). It lists the boards the token can see, opens Dashboard Settings at the board
// rows, and links each chosen board to the tasks of that board, which structure.js builds in two lists.
function checkMondayBoardsPage() {
  const problems = [];
  const parts = world.mondayBoardsParts;
  const view = world.mondayBoardsView;
  const line = world.structure.sidebarEntries.filter(entry => entry.title === 'Monday Boards')[0];
  const now = new Date('2026-10-09T15:00:00.000Z');
  const ago = minutes => new Date(now.getTime() - minutes * 60000).toISOString();

  need(problems, line && line.kind === 'component' && line.component === world.previewPanelsView.MondayBoardsTabs && typeof line.children === 'function', 'the Monday Boards line of the sidebar should open MondayBoardsTabs (the Boards tab is MondayBoardsView) and give it the function that builds the tasks of a board');
  need(problems, typeof view.boardsPage === 'function' && typeof parts.readBoardsPage === 'function', 'the Monday Boards files should export boardsPage and readBoardsPage');

  // Choose boards goes to the board rows, which sit on the Monday tab
  const rows = fieldAt('dashboardSettings.mondayTaskBoard');
  need(problems, parts.chooseTarget.id === 'dashboardSettings' && parts.chooseTarget.type === 'dashboardSettings' && parts.chooseTarget.path === 'mondayTaskBoard', 'Choose boards should open the field mondayTaskBoard of the document dashboardSettings');
  need(problems, rows && rows.group === 'monday', 'the field mondayTaskBoard should be on the Monday tab, because Choose boards opens it');

  const status = {
    lastSyncAt: ago(3),
    boards: [{ id: '111', name: 'Build board', itemCount: 12 }, { id: '222', name: 'Outreach board', itemCount: 1 }, { id: '333', name: 'Parts board', itemCount: 0 }],
    readings: [{ boardId: '111', itemsRead: 12, readAt: ago(5), note: '' }],
  };
  const entries = [{ boardId: '111', team: 'PRIME' }, { boardId: '999', team: 'NOVA' }];
  const read = { status: status, entries: entries, statusUnreadable: false, entriesUnreadable: false };
  const clicks = [];
  const links = { ChildLink: 'ChildLink', choose: () => clicks.push('choose') };

  const page = view.boardsPage(read, now, links);
  need(problems, wordsIn(nodesWhere(page, node => node.type === 'h1')) === 'Monday Boards', 'the page should open with the heading Monday Boards');
  const paragraphs = nodesWhere(page, node => node.type === 'p').map(wordsIn);
  need(problems, paragraphs[0] === parts.helpLine && /task board and the milestones board/.test(parts.helpLine), 'the first line under the heading should name the task board and the milestones board');
  const button = nodesWhere(page, node => node.type === 'button')[0];
  need(problems, button && wordsIn(button) === 'Choose boards' && button.props.onClick === links.choose, 'the page should have a Choose boards button');
  need(problems, nodesWhere(page, node => node.type === 'h1' || node.type === 'p' || node.type === 'button').findIndex(node => node.type === 'button') === 2, 'the button should come right after the heading and the first line');

  // One row for each board: the chosen ones first, the board the token cannot see too, then the others
  const items = nodesWhere(page, node => node.type === 'li').map(wordsIn);
  need(problems, items.length === 4, 'the page should list the three boards of the token and the chosen board it cannot see. It lists ' + items.length);
  need(problems, items[0] === 'Build board 12 items · Read 5 minutes ago · Chosen for PRIME', 'a chosen board should say its items, when it was read and its team. It reads "' + items[0] + '"');
  need(problems, items[1] === 'Board 999 Items not counted · Not read yet · Chosen for NOVA The token cannot see this board, or the board number is wrong.', 'a chosen board the token cannot see should say so. It reads "' + items[1] + '"');
  need(problems, items[2] === 'Outreach board 1 item · Not read · Not chosen' && items[3] === 'Parts board 0 items · Not read · Not chosen', 'a board that is not chosen should say Not read and Not chosen. They read "' + items[2] + '" and "' + items[3] + '"');
  const linked = nodesWhere(page, node => node.type === 'ChildLink').filter(node => node.props.childId !== parts.milestonesChild);
  need(problems, linked.length === 1 && linked[0].props.childId === '111' && wordsIn(linked[0]) === 'Build board', 'only the name of the chosen board that the token can see should open its tasks, with the board number as the child');
  const milestoneLinks = nodesWhere(page, node => node.type === 'ChildLink').filter(node => node.props.childId === parts.milestonesChild);
  need(problems, parts.milestonesChild === 'milestones' && milestoneLinks.length === 1 && wordsIn(milestoneLinks[0]) === 'Milestones', 'the page should link to the second list, Milestones, with the child id milestones');
  const noted = view.boardsPage({ status: status, entries: [{ boardId: '111', team: '' }], statusUnreadable: false, entriesUnreadable: false }, now, links);
  need(problems, /Chosen for both teams/.test(wordsIn(noted)), 'a chosen board with no team should say it is for both teams');
  const reasons = view.boardsPage({ status: Object.assign({}, status, { readings: [{ boardId: '111', itemsRead: 0, readAt: ago(2), note: 'monday gave no items for this board' }] }), entries: entries, statusUnreadable: false, entriesUnreadable: false }, now, links);
  need(problems, /Monday gave no items for this board\./.test(wordsIn(reasons)), 'the note of a reading should be a sentence under its board');
  need(problems, /The Teletraan computer last read Monday 3 minutes ago\./.test(wordsIn(page)) && wordsIn(page).indexOf(parts.openLine) !== -1 && wordsIn(page).indexOf(parts.publicLine) !== -1, 'the page should say when the computer last read Monday, how to open the tasks of a board, and that the names are public');
  need(problems, /dataset/.test(parts.publicLine) && /anyone can read/.test(parts.publicLine), 'the page should say the names are in the dataset that anyone can read');
  need(problems, wordsIn(view.boardsPage({ status: Object.assign({}, status, { lastError: 'Monday refused the token' }), entries: entries, statusUnreadable: false, entriesUnreadable: false }, now, links)).indexOf('Monday refused the token.') !== -1, 'the last error of the Teletraan computer should show as a sentence');

  // Nothing yet, reading, nothing to list, and documents that cannot be read
  need(problems, wordsIn(view.boardsPage(null, now, links)).indexOf('Reading the boards') !== -1, 'the page should say it is reading while it waits');
  need(problems, wordsIn(view.boardsPage({ status: null, entries: [], statusUnreadable: false, entriesUnreadable: false }, now, links)).indexOf(parts.nothingYet) !== -1, 'with no status document the page should say Nothing yet');
  need(problems, wordsIn(view.boardsPage({ status: { boards: [] }, entries: [], statusUnreadable: false, entriesUnreadable: false }, now, links)).indexOf(parts.noBoardsLine) !== -1, 'with no boards the page should say the token can see none');
  need(problems, wordsIn(view.boardsPage({ status: null, entries: [], statusUnreadable: true, entriesUnreadable: false }, now, links)).indexOf(parts.unreadableLine) !== -1, 'the page should say so when the status cannot be read');
  need(problems, wordsIn(view.boardsPage({ status: status, entries: [], statusUnreadable: false, entriesUnreadable: true }, now, links)).indexOf(parts.settingsUnreadableLine) !== -1, 'the page should say so when Dashboard Settings cannot be read, and still list the boards');
  const odd = view.boardsPage({ status: { boards: [null, 'text', { id: 5 }, { id: '7', name: 7, itemCount: 'many' }], readings: 'text' }, entries: [null, { boardId: 3 }], statusUnreadable: false, entriesUnreadable: false }, now, links);
  need(problems, nodesWhere(odd, node => node.type === 'li').map(wordsIn).join() === 'Board 7 Items not counted · Not read · Not chosen', 'answers of an odd shape should be left out or read as missing, not stop the page');

  // The component: it starts by saying it is reading, and Choose boards asks the pane router for Dashboard Settings
  globalThis.studioIntents = [];
  const start = view.MondayBoardsView();
  need(problems, wordsIn(start).indexOf('Reading the boards') !== -1, 'MondayBoardsView should start by saying it is reading');
  nodesWhere(start, node => node.type === 'button')[0].props.onClick();
  need(problems, sameData(globalThis.studioIntents, [['edit', parts.chooseTarget]]), 'Choose boards should ask the pane router for the edit intent of Dashboard Settings at mondayTaskBoard. It asked for ' + JSON.stringify(globalThis.studioIntents));
  globalThis.studioIntents = undefined;

  // The page shows and never writes
  need(problems, !/\.patch\(|\.create\(|\.createIfNotExists\(|\.createOrReplace\(|\.delete\(|\.mutate\(|\.transaction\(|useDocumentOperation/.test(world.mondayBoardsViewSource + world.mondayBoardsPartsSource), 'the Monday Boards page should not write anything');

  // What a student reads is short plain sentences
  [parts.helpLine, parts.nothingYet, parts.noBoardsLine, parts.openLine, parts.publicLine, parts.unreadableLine, parts.settingsUnreadableLine, parts.milestonesLine].forEach(text => checkPlainSentences(problems, 'the Monday Boards page ("' + text.slice(0, 30) + '")', text));

  // A board of the page opens its tasks in the same two lists as Monday Tasks, kept to that board
  const built = world.structure.structure(fakeBuilder()).made.items.map(item => item.made).filter(item => item.title === 'Monday Boards')[0];
  const resolver = built && built.child && built.child.made && built.child.made.child;
  if (typeof resolver !== 'function') return problems.concat('the Monday Boards page should be given a function that builds the tasks of a board');

  // the second list: the milestones the Teletraan computer made, by target date, with no plus button
  const milestonePane = resolver(parts.milestonesChild, {}).made;
  need(problems, milestonePane.type === 'milestone' && milestonePane.title === 'Milestones' && sameData(milestonePane.defaultOrdering, [{ field: 'targetDate', direction: 'asc' }]) && Array.isArray(milestonePane.initialValueTemplates) && milestonePane.initialValueTemplates.length === 0, 'the second list under Monday Boards should list milestones by target date, with no plus button');

  const opened = resolver('111', {}).made;
  const lists = (opened.items || []).map(item => item.made);
  need(problems, lists.map(item => item.title).join() === 'On the TV,Hidden', 'a board should open two lists, On the TV and Hidden. It opens: ' + lists.map(item => item.title).join());
  const folder = world.structure.sidebarEntries.filter(entry => entry.title === 'Monday Tasks')[0];
  lists.forEach((item, index) => {
    const list = item.child && item.child.made;
    const want = folder.entries[index];
    need(problems, list && list.type === 'task' && list.params && list.params.board === '111' && list.params.type === 'task', item.title + ' of a board should list tasks and pass the board number as $board');
    need(problems, list && list.filter === '_type == $type && (mondayBoardId == $board && (' + want.filter + '))', item.title + ' of a board should keep the filter of ' + want.title + ' of Monday Tasks and add the board');
    need(problems, list && Array.isArray(list.initialValueTemplates) && list.initialValueTemplates.length === 0, item.title + ' of a board should have no plus button');
    need(problems, list && sameData(list.defaultOrdering, [want.sort, want.thenBy]), item.title + ' of a board should be ordered as ' + want.title + ' of Monday Tasks');
  });
  need(problems, resolver('111', {}).made.id !== resolver('222', {}).made.id && lists[0].id !== resolver('222', {}).made.items[0].made.id, 'each board should have lists with ids of their own, so Studio keeps them apart');

  // The filters keep each task in one list of one board
  const now2 = '2026-10-09T12:00:00.000Z';
  const sample = [
    { task: { source: 'monday', mondayBoardId: '111' }, board: '111', where: 'On the TV' },
    { task: { source: 'monday', mondayBoardId: '111', showOnTv: false }, board: '111', where: 'Hidden' },
    { task: { source: 'monday', mondayBoardId: '222' }, board: '111', where: '' },
    { task: { source: 'monday' }, board: '111', where: '' },
    { task: { source: 'manual', mondayBoardId: '111' }, board: '111', where: 'Hidden' },
    { task: { source: 'manual' }, board: '111', where: '' },
  ];
  sample.forEach((item, index) => {
    const sits = lists.map(list => ({ title: list.title, filter: list.child.made.filter.replace(/^_type == \$type && /, '') })).filter(list => filterOf(list.filter)(item.task, now2, item.board)).map(list => list.title);
    need(problems, sits.join() === item.where, 'task ' + (index + 1) + ' of the check should be in ' + (item.where || 'no list of the board') + '. It is in: ' + (sits.join() || 'no list'));
  });
  return problems;
}

// readBoardsPage asks for the published status document and the published board rows by their ids, and never fails
async function checkMondayBoardsPageRead() {
  const problems = [];
  const read = world.mondayBoardsParts.readBoardsPage;
  const asked = [];
  const answering = answers => ({
    fetch: async (...args) => {
      asked.push(args);
      const answer = answers[args[1].id];
      if (answer instanceof Error) throw answer;
      return answer;
    },
  });

  const found = await read(answering({ 'monday-status': { lastSyncAt: 'x', boards: [] }, dashboardSettings: { entries: [{ boardId: '111', team: 'PRIME' }] } }));
  need(problems, found.status && found.entries.length === 1 && !found.statusUnreadable && !found.entriesUnreadable, 'both answers that are there should be handed over');
  need(problems, asked.length === 2 && asked.every(call => call[2].perspective === 'published' && /_id == \$id/.test(call[0])), 'readBoardsPage should ask for the published documents by their ids');
  need(problems, asked.map(call => call[1].id).join() === 'monday-status,dashboardSettings', 'readBoardsPage should ask for monday-status and dashboardSettings');
  need(problems, /readings\[\]/.test(asked[0][0]) && /boards\[\]/.test(asked[0][0]) && /mondayTaskBoard/.test(asked[1][0]) && /mondayMilestoneBoard/.test(asked[1][0]), 'readBoardsPage should ask for the boards, the readings and the two boards of the Monday tab');

  need(problems, sameData(await read(answering({ 'monday-status': null, dashboardSettings: null })), { status: null, entries: [], statusUnreadable: false, entriesUnreadable: false }), 'no documents are a good answer, not a failure');
  need(problems, sameData(await read(answering({ 'monday-status': 'text', dashboardSettings: { entries: 'text' } })), { status: null, entries: [], statusUnreadable: false, entriesUnreadable: false }), 'answers that are not documents should be read as no documents');
  const oneBad = await read(answering({ 'monday-status': new Error('offline'), dashboardSettings: { entries: [] } }));
  need(problems, oneBad.statusUnreadable === true && oneBad.entriesUnreadable === false, 'one document that cannot be read should not stop the other');
  const failing = await read({ fetch: async () => { throw new Error('offline'); } });
  need(problems, failing.statusUnreadable === true && failing.entriesUnreadable === true && failing.status === null && failing.entries.length === 0, 'a client that fails should give both as unreadable');
  const empty = await read({});
  need(problems, empty.statusUnreadable === true && empty.entriesUnreadable === true, 'a client with no fetch should give both as unreadable');
  return problems;
}

// The three Screens (schemas/screen.js, structure.js, screen-input.js). Original, Cybertron and Minimal are three
// documents of the type screen, each with an id of its own. The form opens on a map of the screen whose letters are
// the five tabs, A Banner, B Main panel, C Countdown, D Side panel and E Ticker. The weekday schedule that picks
// the Screen of a day is a field of Dashboard Settings, Look tab. The names, starting values and limits are the
// ones in dashboard/config.js.
const screenGroupFields = {
  banner: ['bannerTeam', 'nameEffectEveryMinutes', 'hawkEveryMinutes', 'swapSeconds'],
  main: ['mainRows', 'mondayStyle'],
  countdown: ['countdownShown'],
  side: ['sideRows'],
  ticker: ['tickerLink'],
};
const mainRowTip = 'Not used any more. The rows of each View (Views, under SCREEN) replace this list. It stays so that a saved list is kept.';
const weekdayStarts = { monday: 'original', tuesday: 'cybertron', wednesday: 'original', thursday: 'cybertron', friday: 'original', saturday: 'cybertron', sunday: 'original' };

function checkScreenType() {
  const problems = [];
  const config = world.dashboard;
  const type = typeByName('screen');
  if (!type) return ['screen is missing from schemas/index.js'];

  const at = name => fieldAt('screen.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const registered = area => world.registry.panels.filter(panel => panel.region === area && !panel.testOnly && !panel.competition && !panel.monday && !panel.lastResort && !panel.placeholder && !panel.rotationOnly).map(panel => panel.id);
  const listOf = pathText => choicesOf(pathText).map(item => item.value + '=' + item.title).join();
  const titleFor = id => ({ tasks: 'Tasks', events: 'Upcoming events', tonight: 'Daily Agenda', spotlight: 'Subteam spotlight', 'sponsor-feature': 'Sponsor feature', photo: 'Photo', leadership: 'Leadership', 'team-leads': 'Team leads', roster: 'Subteam roster', custom: 'Extra panel', 'task-counts': 'Task counts', 'next-event': 'Next event', forecast: 'Weather forecast', 'safety-days': 'Safety days', 'sponsor-logo': 'Sponsor logo' }[id]);
  const monday = ['monday-tasks=Monday: Tasks by team and department', 'monday-done=Monday: Done by team', 'monday-status-depts=Monday: Status by department', 'monday-overall=Monday: Overall progress', 'monday-timeline=Monday: Timeline by team', 'monday-board=Monday: Board by team'];

  // the tabs are the five letters of the map, in order
  need(problems, type.type === 'document' && type.title === 'Screen', 'screen should be a document titled Screen');
  need(problems, (type.groups || []).map(group => group.title).join() === startAreas.join(), 'the Screen should have these tabs, in this order: ' + startAreas.join(', '));
  need(problems, (type.groups || []).filter(group => group.default === true).map(group => group.name).join() === 'banner', 'A Banner should be the tab that opens first (default: true)');
  need(problems, Object.keys(world.screenMap.letterGroups).join() === 'A,B,C,D,E' && Object.values(world.screenMap.letterGroups).join() === (type.groups || []).map(group => group.name).join(), 'the letters of the map should open the tabs of the Screen, in order: ' + (type.groups || []).map(group => group.name).join(', '));
  need(problems, world.startHereParts.areas.map(area => area.letter + ' ' + area.name).join() === (type.groups || []).map(group => group.title).join(), 'the tabs of the Screen should be the areas of Start here: ' + startAreas.join(', '));
  need(problems, type.components && type.components.input === world.screenInput.ScreenInput, 'the Screen should draw itself with ScreenInput (screen-input.js)');
  Object.keys(screenGroupFields).forEach(group => screenGroupFields[group].forEach(name => need(problems, at(name) && at(name).group === group, 'screen.' + name + ' should be in the ' + group + ' tab')));
  need(problems, fieldsIn(type).map(field => field.name).join() === Object.keys(screenGroupFields).reduce((all, group) => all.concat(screenGroupFields[group]), []).join(), 'the fields of the Screen should be in the order of the tabs');
  need(problems, fieldsIn(type).every(field => !constraintNamed(rulesOf(field), 'required')), 'no field of a Screen should be required: a Screen with none uses the starting values, and the rows are filled by the form');
  checkPlainMessages('screen', problems);

  // the banner settings: whole minutes from 1 to 240 and a swap time from 0.5 to 3, as in config.js
  const defaults = config.defaultScreen;
  need(problems, sameData(defaults, { nameEffectEveryMinutes: 10, hawkEveryMinutes: 5, swapSeconds: 1.25 }), 'defaultScreen in config.js should be 10 minutes, 5 minutes and 1.25 seconds');
  need(problems, sameData(config.screenLimits, { nameEffectEveryMinutes: { min: 1, max: 240 }, hawkEveryMinutes: { min: 1, max: 240 }, swapSeconds: { min: 0.5, max: 3 } }), 'screenLimits in config.js should be 1 to 240, 1 to 240 and 0.5 to 3');
  ['nameEffectEveryMinutes', 'hawkEveryMinutes', 'swapSeconds'].forEach(name => {
    const field = at(name);
    const rules = rulesOf(field);
    need(problems, field && field.type === 'number' && field.initialValue === defaults[name], 'screen.' + name + ' should be a number that starts as ' + defaults[name] + ', the default in config.js');
    need(problems, constraintNamed(rules, 'min') && constraintNamed(rules, 'min').args[0] === config.screenLimits[name].min && constraintNamed(rules, 'max') && constraintNamed(rules, 'max').args[0] === config.screenLimits[name].max, 'screen.' + name + ' should have the limits in config.js, ' + JSON.stringify(config.screenLimits[name]));
    need(problems, (name === 'swapSeconds') === !constraintNamed(rules, 'integer'), 'screen.' + name + (name === 'swapSeconds' ? ' should allow decimals' : ' should be a whole number'));
    need(problems, field && new RegExp('from ' + config.screenLimits[name].min + ' to ' + config.screenLimits[name].max).test(field.description || '') && new RegExp('Starts at ' + defaults[name] + '\\.').test(field.description || ''), 'the screen.' + name + ' description should give the range and the starting value');
  });
  need(problems, config.standardSwapSeconds === 1.25 && config.defaultScreen.swapSeconds === config.standardSwapSeconds, 'standardSwapSeconds in config.js should be 1.25, the length of the swap until now');

  // the sections that store nothing: a button or a link, drawn by an input of their own
  [['bannerTeam', world.screenFields.BannerTeamInput], ['countdownShown', world.screenFields.CountdownInput], ['tickerLink', world.screenFields.TickerInput]].forEach(entry => {
    const field = at(entry[0]);
    need(problems, field && field.type === 'string' && field.readOnly === true && field.initialValue === undefined && !field.validation, 'screen.' + entry[0] + ' should be a read only string that stores nothing');
    need(problems, field && field.components && field.components.input === entry[1], 'screen.' + entry[0] + ' should draw itself with its input (screen-fields.js)');
  });
  need(problems, at('tickerLink') && at('tickerLink').description === 'The ticker shows every published tip and news item in order.', 'the Ticker section should say: The ticker shows every published tip and news item in order.');

  // B Main panel: the tip, then rows of a panel, a team and seconds. The Monday rows are offered like any other panel.
  const rows = at('mainRows');
  need(problems, rows && rows.type === 'array' && rows.description === mainRowTip, 'screen.mainRows should say Not used any more in its description: ' + mainRowTip);
  need(problems, listOf('screen.mainRows.panel') === registered('grid1').map(id => id + '=' + titleFor(id)).concat(monday).join(), 'a row of the main panel should offer the large panels of registry.js and then the six Monday panels of the task board: ' + registered('grid1').concat(monday.map(line => line.split('=')[0])).join(', '));
  need(problems, fieldsIn(rows || {}).map(field => field.name).join() === 'panel,team,department,seconds,photoCount,secondsPerPhoto,photoTotal', 'a row of the main panel should have a panel, a team, a department (shown for the Monday tasks panel only) seconds and, for the Photos row, a count, the seconds of each photo and the total');
  const departmentField = fieldAt('screen.mainRows.department');
  need(problems, departmentField && departmentField.type === 'string' && departmentField.components && departmentField.components.input === world.screenFields.RowDepartmentInput && typeof departmentField.hidden === 'function' && departmentField.hidden({ parent: { panel: 'monday-tasks' } }) === false && departmentField.hidden({ parent: { panel: 'monday-board' } }) === true && departmentField.hidden({ parent: { panel: 'photo' } }) === true, 'the department of a row should be drawn by RowDepartmentInput and shown for the Monday tasks panel only');
  const panelRules = rulesOf(fieldAt('screen.mainRows.panel'));
  need(problems, constraintNamed(panelRules, 'required') && messageAfter(panelRules, 'required') === 'Pick a panel.', 'the panel of a row should be required, with the message Pick a panel.');
  need(problems, fieldAt('screen.mainRows.team') && fieldAt('screen.mainRows.team').components && fieldAt('screen.mainRows.team').components.input === world.screenFields.RowTeamInput, 'the team of a row should be drawn by RowTeamInput (screen-fields.js)');
  const secondsRules = rulesOf(fieldAt('screen.mainRows.seconds'));
  need(problems, constraintNamed(secondsRules, 'integer') && constraintNamed(secondsRules, 'min').args[0] === 6 && constraintNamed(secondsRules, 'max').args[0] === 120 && !constraintNamed(secondsRules, 'required'), 'the seconds of a row should be a whole number from 6 to 120, and optional');
  const teamRule = constraintNamed(rulesOf(fieldAt('screen.mainRows.team')), 'custom');
  const teamSays = (panel, team) => (teamRule ? teamRule.args[0](team, { parent: { panel: panel } }) : 'no rule');
  need(problems, teamSays('monday-tasks', '') === 'Pick the team for this Monday row.' && teamSays('monday-overall', '') === true && teamSays('monday-board', 'both') !== true && teamSays('monday-tasks', 'both') !== true && teamSays('photo', 'nova') === 'This panel is for both teams. Clear the team.' && teamSays('tasks', '') === true && teamSays('tasks', 'nova') === true, 'the team of a row should follow the rules of its panel: a Monday row needs a team, Status by department and Overall progress have none, and a panel for both teams has none');
  const mainRow = rows && rows.of && rows.of[0];
  const mainLine = fields => mainRow.preview.prepare(fields);
  need(problems, mainRow && mainLine({}).title === 'Panel not chosen' && mainLine({ panel: 'tasks', team: 'prime' }).title === 'Tasks' && mainLine({ panel: 'tasks', team: 'prime' }).subtitle === 'Prime · Follows Seconds per page', 'a row of the main panel should read the panel, then the team and the seconds');
  need(problems, mainRow && mainLine({ panel: 'tasks' }).subtitle === 'Keeps the team on the screen · Follows Seconds per page' && mainLine({ panel: 'events', seconds: 30 }).subtitle === '30 seconds' && mainLine({ panel: 'monday-tasks', team: 'prime' }).subtitle === 'Prime · First department with tasks · Follows Seconds per page' && mainLine({ panel: 'monday-tasks', team: 'prime', department: 'subteam-build' }).subtitle === 'Prime · One department · Follows Seconds per page', 'a row with no team should say whether it keeps the team on the screen, and a tasks row should say whether it names a department');
  need(problems, mainRow && mainLine({ panel: 'photo' }).subtitle === '4 photos of 10 seconds, 40 seconds' && mainLine({ panel: 'photo', photoCount: 7, secondsPerPhoto: 12 }).subtitle === '7 photos of 12 seconds, 84 seconds' && mainLine({ panel: 'photo', photoCount: 1, secondsPerPhoto: 5 }).subtitle === '1 photo of 5 seconds, 5 seconds', 'the Photo row should say its photos, the seconds of each and the total');

  // A Photos row has a count (1 to 20, starting at 4), the seconds of each photo (5 to 60, starting at 10) and the total, read only
  const photoRowField = name => fieldAt('screen.mainRows.' + name);
  const countRules = rulesOf(photoRowField('photoCount'));
  const eachRules = rulesOf(photoRowField('secondsPerPhoto'));
  need(problems, photoRowField('photoCount') && photoRowField('photoCount').initialValue === config.defaultPhotoRow.photoCount && config.defaultPhotoRow.photoCount === 4 && constraintNamed(countRules, 'integer') && constraintNamed(countRules, 'min').args[0] === config.limits.photoCount.min && constraintNamed(countRules, 'max').args[0] === config.limits.photoCount.max && config.limits.photoCount.min === 1 && config.limits.photoCount.max === 20, 'photoCount of a Photos row should be a whole number from 1 to 20, starting at 4, as config.js says');
  need(problems, photoRowField('secondsPerPhoto') && photoRowField('secondsPerPhoto').initialValue === config.defaultPhotoRow.secondsPerPhoto && config.defaultPhotoRow.secondsPerPhoto === 10 && constraintNamed(eachRules, 'integer') && constraintNamed(eachRules, 'min').args[0] === config.limits.secondsPerPhoto.min && constraintNamed(eachRules, 'max').args[0] === config.limits.secondsPerPhoto.max && config.limits.secondsPerPhoto.min === 5 && config.limits.secondsPerPhoto.max === 60, 'secondsPerPhoto of a Photos row should be a whole number from 5 to 60, starting at 10, as config.js says');
  const total = photoRowField('photoTotal');
  need(problems, total && total.readOnly === true && total.components && total.components.input === world.screenFields.PhotoTotalInput, 'the total of a Photos row should be read only and drawn by PhotoTotalInput (screen-fields.js)');
  const forRow = panel => ({ parent: { panel: panel } });
  need(problems, ['photoCount', 'secondsPerPhoto', 'photoTotal'].every(name => photoRowField(name).hidden(forRow('events')) === true && photoRowField(name).hidden(forRow('photo')) === false) && photoRowField('seconds').hidden(forRow('photo')) === true && photoRowField('seconds').hidden(forRow('events')) !== true, 'the three photo fields should show on a Photos row only, and the plain seconds should be hidden on it');
  need(problems, world.screenFields.photoTotalText(4, 10) === '40 seconds' && world.screenFields.photoTotalText(20, 60) === '1200 seconds' && world.screenFields.photoTotalText(undefined, undefined) === '40 seconds', 'the total of a Photos row should read the photos times the seconds, such as 40 seconds');

  // Monday style: one of the styles, and no starting value, so that the form can copy the old setting into it
  const mondayStyle = at('mondayStyle');
  const mondayAllowed = constraintNamed(rulesOf(mondayStyle), 'valid');
  need(problems, mondayStyle && mondayStyle.type === 'string' && mondayStyle.options && mondayStyle.options.layout === 'radio' && mondayStyle.initialValue === undefined, 'screen.mondayStyle should be a radio list with no starting value');
  need(problems, listOf('screen.mondayStyle') === config.styles.map(style => style + '=' + style.charAt(0).toUpperCase() + style.slice(1)).join() && mondayAllowed && mondayAllowed.args[0].join() === config.styles.join(), 'screen.mondayStyle should offer the styles in config.js, in the same order');

  // D Side panel: the small panels, no team, and none at all for Minimal
  const side = at('sideRows');
  need(problems, side && side.type === 'array' && fieldsIn(side).map(field => field.name).join() === 'panel,seconds', 'the side panel list should hold rows of a panel and seconds, and no team');
  need(problems, listOf('screen.sideRows.panel') === registered('grid2').map(id => id + '=' + titleFor(id)).join(), 'a row of the side panel should offer the small panels of registry.js: ' + registered('grid2').join(', '));
  need(problems, side && side.hidden === true && rows && rows.hidden === true && side.description === mainRowTip, 'the main panel and side panel lists of a Screen should be hidden, kept in the schema, and say Not used any more')
  const sideRow = side && side.of && side.of[0];
  need(problems, sideRow && sideRow.preview.prepare({ panel: 'forecast', seconds: 9 }).subtitle === '9 seconds' && sideRow.preview.prepare({}).title === 'Panel not chosen', 'a row of the side panel should read the panel and the seconds');

  // the list line of a Screen, and Publish all
  const line = id => type.preview.prepare({ id: id }).title;
  need(problems, type.preview.select && type.preview.select.id === '_id' && line('drafts.screen-original') === 'Original' && line('screen-cybertron') === 'Cybertron' && line('screen-minimal') === 'Minimal' && type.preview.prepare({}).title === 'Screen', 'the list line of a Screen should be its name: Original, Cybertron or Minimal');
  const schema = { get: name => typeByName(name) };
  const draft = world.publishAll.chooseDrafts([{ _id: 'drafts.screen-cybertron', _type: 'screen' }], schema, world.publishAllTool.singletonIds)[0];
  need(problems, draft && draft.problem === '' && draft.publishedId === 'screen-cybertron' && draft.title === 'Cybertron' && world.publishAll.labelOf(draft) === 'Screen: Cybertron', 'Publish all should publish a draft of each Screen under its own id and call it Screen: Cybertron');

  // the three pages in the sidebar, and what a page of a Screen can and cannot do
  const folder = allLines(world.structure.sidebarEntries).filter(entry => entry.title === 'Old screens (not used)' && entry.kind === 'group')[0];
  need(problems, folder && folder.entries.filter(entry => entry.kind === 'page' && entry.type === 'screen').map(entry => entry.title + '=' + entry.id + '=' + entry.type).join() === 'Original=screen-original=screen,Cybertron=screen-cybertron=screen,Minimal=screen-minimal=screen', 'Old screens (not used), under COACHES ONLY, should list the pages Original, Cybertron and Minimal, each of the type screen with the id screen- and its style');
  need(problems, world.structure.screenIds.join() === screenPageIds.join() && world.screenIds.screenStyles.join() === config.styles.join() && Object.keys(config.screenIds).join() === config.styles.join() && config.styles.every(style => config.screenIds[style] === 'screen-' + style && world.screenIds.screenIdOf(style) === 'screen-' + style), 'the ids of the Screens should be screen-original, screen-cybertron and screen-minimal in the Studio and in config.js');
  const actions = ['publish', 'discardChanges', 'delete', 'duplicate', 'unpublish'].map(action => ({ action: action }));
  need(problems, world.config.document.actions(actions, { schemaType: 'screen' }).map(item => item.action).join() === 'publish,discardChanges', 'a Screen should have these actions: publish,discardChanges. Nothing copies it or takes it away');
  need(problems, world.config.document.newDocumentOptions([{ templateId: 'screen' }, { templateId: 'plan' }], { creationContext: { type: 'document' } }).map(item => item.templateId).join() === 'plan', 'the New menu should not offer a Screen, not even while a document is open');

  // the fields the Screens replace: hidden, kept in the schema with their starting values, and described as not used
  [['dashboardSettings.rotation.order', true], ['dashboardSettings.dailyStyles', true], ['dashboardSettings.mondayStyle', true], ['dashboardSettings.teamOrder', true], ['team.nameStyle', false]].forEach(entry => {
    const field = fieldAt(entry[0]);
    need(problems, field && field.hidden === true && /^Not used any more\./.test(field.description || ''), entry[0] + ' should be hidden, kept in the schema, and described as Not used any more');
    need(problems, !entry[1] || (field && field.initialValue !== undefined), entry[0] + ' should keep its starting value');
  });

  // the weekday schedule: Monday to Sunday, each one of the Screens, and the starting week of config.js
  const schedule = fieldAt('dashboardSettings.screenSchedule');
  const days = config.weekdays;
  need(problems, days.join() === Object.keys(weekdayStarts).join(), 'weekdays in config.js should be monday to sunday, in that order');
  need(problems, sameData(config.defaultSettings.screenSchedule, weekdayStarts), 'screenSchedule in config.js should be Original on Monday, Wednesday, Friday and Sunday, and Cybertron on Tuesday, Thursday and Saturday: Minimal is not scheduled');
  need(problems, schedule && schedule.type === 'object' && schedule.group === 'look' && schedule.title === 'Weekday schedule', 'screenSchedule should be an object titled Weekday schedule in the Look tab');
  need(problems, schedule && fieldsIn(schedule).map(field => field.name).join() === days.join() && fieldsIn(schedule).map(field => field.title).join() === days.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(), 'screenSchedule should have a picker for each day, Monday to Sunday, titled with the day');
  days.forEach(day => {
    const field = fieldAt('dashboardSettings.screenSchedule.' + day);
    const allowed = constraintNamed(rulesOf(field), 'valid');
    need(problems, field && field.type === 'string' && field.options && field.options.layout === 'radio' && field.initialValue === config.defaultSettings.screenSchedule[day], 'screenSchedule.' + day + ' should be a radio list that starts as ' + config.defaultSettings.screenSchedule[day] + ', as in config.js');
    need(problems, listOf('dashboardSettings.screenSchedule.' + day) === config.styles.map(style => style + '=' + style.charAt(0).toUpperCase() + style.slice(1)).join(), 'screenSchedule.' + day + ' should offer the Screens Original, Cybertron and Minimal');
    need(problems, allowed && allowed.args[0].join() === config.styles.join() && !constraintNamed(rulesOf(field), 'required'), 'screenSchedule.' + day + ' should only allow ' + config.styles.join(', ') + ', and not be required: a day with none follows the starting week');
    checkPlainSentences(problems, 'the screenSchedule.' + day + ' description', (field && field.description) || '');
  });
  return problems;
}

// The map: the boxes are where the layout puts the parts, the words fit their boxes, and nothing overlaps.
// Original and Cybertron have the boxes of Start here (base.css). Minimal has the bar layout of core/layout.js.
function checkScreenMap() {
  const problems = [];
  const map = world.screenMap;
  const bar = world.layoutModule.barGeometry;
  const above = 0.8;
  const below = 0.25;
  const same = (box, want) => want && ['x', 'y', 'width', 'height'].every(key => box[key] === want[key]);
  const find = (boxes, letter, index) => boxes.filter(box => box.letter === letter)[index || 0];

  ['original', 'cybertron', 'minimal'].forEach(style => {
    const picture = map.mapFor(style, { main: 16, side: 5 });
    const letters = Array.from(new Set(picture.boxes.map(box => box.letter))).sort().join('');
    need(problems, letters === 'ABCDE', style + ': the map should have the letters A to E');
    need(problems, picture.width === 1920 && picture.height >= 1080, style + ': the map should be drawn on the 1920 by 1080 of the screen');
    picture.boxes.forEach((box, index) => {
      const name = style + ' ' + box.letter + ' ' + box.name;
      need(problems, box.x >= 0 && box.y >= 0 && box.x + box.width <= picture.width && box.y + box.height <= picture.height, name + ' should be inside the picture');
      picture.boxes.slice(index + 1).forEach(other => {
        const apart = other.x >= box.x + box.width || box.x >= other.x + other.width || other.y >= box.y + box.height || box.y >= other.y + other.height;
        need(problems, apart, name + ' and ' + other.letter + ' ' + other.name + ' should not overlap');
      });

      // the words fit the box. The width is a wide guess (widthOf), since nothing is drawn here.
      const labels = map.labelsFor(box);
      const inside = (left, right, top, bottom) => left >= box.x && right <= box.x + box.width && top >= box.y && bottom <= box.y + box.height;
      need(problems, inside(labels.badge.x, labels.badge.x + labels.badge.size, labels.badge.y, labels.badge.y + labels.badge.size), name + ': the square with the letter should be inside its box');
      need(problems, labels.letter.x - world.startHereParts.widthOf(labels.letter.text, labels.letter.size) / 2 >= labels.badge.x && labels.letter.y <= labels.badge.y + labels.badge.size, name + ': the letter should be inside its square');
      [labels.name].concat(labels.lines).forEach(words => need(problems, inside(words.x, words.x + world.startHereParts.widthOf(words.text, words.size), words.y - words.size * above, words.y + words.size * below), name + ': "' + words.text + '" should fit inside its box'));
    });
  });

  // Original and Cybertron: the standard layout, the boxes of base.css and of Start here
  const standard = standardBoxes();
  ['original', 'cybertron'].forEach(style => {
    const boxes = map.mapFor(style).boxes;
    need(problems, boxes.map(box => box.letter + ' ' + box.name).join() === startAreas.join(), style + ': the map should have the areas ' + startAreas.join(', '));
    boxes.forEach((box, index) => need(problems, same(box, standard[index]) && box.opens === true && box.dashed === false, style + ' ' + box.letter + ' should be the box of the standard layout in dashboard/base.css: ' + JSON.stringify(standard[index])));
  });

  // Minimal: the bar layout. The name's slot, the side column with its rail, the war clock, the main panel
  // and the ticker are the boxes of barGeometry. D is dashed, under the screen, and opens nothing.
  const minimal = map.mapFor('minimal', { main: 16, side: 0 });
  need(problems, same(find(minimal.boxes, 'A', 0), bar.name) && same(find(minimal.boxes, 'A', 1), bar.side), 'minimal: A should be the name slot of the banner and the side column, as in barGeometry in dashboard/core/layout.js');
  need(problems, same(find(minimal.boxes, 'C'), bar.war), 'minimal: C should be the slot of the war clock, as in barGeometry');
  need(problems, same(find(minimal.boxes, 'B'), bar.main), 'minimal: B should be the main panel, as in barGeometry');
  need(problems, same(find(minimal.boxes, 'E'), bar.ticker), 'minimal: E should be the ticker, as in barGeometry');
  const none = find(minimal.boxes, 'D');
  need(problems, none && none.dashed === true && none.opens === false && none.y >= 1080 && none.lines.join() === 'This screen has no side panel.', 'minimal: D should be dashed under the screen, say This screen has no side panel, and open nothing');
  need(problems, minimal.boxes.filter(box => box.letter !== 'D').every(box => box.opens === true && box.dashed === false), 'minimal: every box but D should open its section');

  // the words under the letters
  const lines = style => map.mapFor(style, { main: 16, side: 5 }).boxes.map(box => box.letter + ':' + box.lines.join('|')).join(' ');
  need(problems, lines('original') === 'A:Team and effects B:16 rows C:Title and dates D:5 rows E:Tips and News', 'the map should say the rows of the two lists and what the other parts hold, it says: ' + lines('original'));
  need(problems, map.mapFor('original', {}).boxes.filter(box => box.letter === 'B' || box.letter === 'D').every(box => box.lines.join() === 'No rows yet') && map.mapFor('original', { main: 1 }).boxes[1].lines.join() === '1 row', 'a list with no rows should say No rows yet and a list with one should say 1 row');
  return problems;
}

// The form of a Screen: the map and the switch above the fields, the letters that open the tabs, the first fill of a Screen
// from the Panel order, and the inputs inside the sections.
async function checkScreenForm() {
  const problems = [];
  const input = world.screenInput;
  const fields = world.screenFields;
  const parts = world.screenParts;
  const wait = () => new Promise(resolve => setTimeout(resolve, 0));
  const prime = { _id: 'team-prime', name: 'Hawktimus Prime', shortName: 'PRIME', code: 'prime' };
  const nova = { _id: 'team-nova', name: 'Hawktimus Nova', shortName: 'NOVA', code: 'nova' };
  const ownersOrder = ['tonight', 'forecast', 'leadership', 'team-leads', 'photo', 'next-event', 'task-counts', 'sponsor-logo', 'task-counts', 'events', 'tasks'].map(panel => ({ _key: 'k' + panel, panel: panel, show: true }));
  const countdown = { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN' };
  const answer = { settings: { rotation: { order: ownersOrder }, mondayStyle: 'cybertron', countdown: countdown }, teams: [prime, nova] };
  const clientAnswering = result => {
    const asked = [];
    return { asked: asked, fetch: async (question, params, options) => { asked.push({ question: question, options: options }); if (result instanceof Error) throw result; return result; } };
  };
  const resetGlobals = () => {
    globalThis.studioClient = undefined;
    globalThis.studioForm = undefined;
    globalThis.studioEffects = [];
    globalThis.studioContextValue = undefined;
  };
  const groupsOpen = name => ['banner', 'main', 'countdown', 'side', 'ticker'].map(group => ({ name: group, selected: group === name }));
  const letterOf = node => node.props['data-letter'];
  const boxes = tree => nodesWhere(tree, node => node.type === 'g' && node.props && node.props['data-letter'] !== undefined);

  // reading: the published settings and teams, and nothing that throws
  const good = clientAnswering(answer);
  const read = await parts.readSources(good);
  need(problems, read.unreadable === false && read.teams.length === 2 && read.settings && read.settings.mondayStyle === 'cybertron', 'readSources should give the settings and the teams it is given');
  need(problems, good.asked[0] && good.asked[0].options && good.asked[0].options.perspective === 'published' && /_id == "dashboardSettings"/.test(good.asked[0].question) && /_type == "team" && active != false/.test(good.asked[0].question) && /order\(order asc/.test(good.asked[0].question), 'readSources should ask for the published Dashboard Settings and the active teams, by order');
  const failing = [['a question that fails', clientAnswering(new Error('offline'))], ['a client with no fetch', {}], ['no client', null]];
  for (const entry of failing) {
    need(problems, JSON.stringify(await parts.readSources(entry[1])) === JSON.stringify({ settings: null, teams: [], unreadable: true }), 'readSources with ' + entry[0] + ' should give nothing and say it could not be read');
  }
  const bare = await parts.readSources(clientAnswering(null));
  need(problems, bare.unreadable === false && bare.settings === null && bare.teams.length === 0, 'readSources with no answer should give no settings and no teams, and not say they could not be read');

  // the teams for the pickers and for the first rows
  need(problems, parts.pickerTeams([prime, nova]).map(team => team.code + '=' + team.label + '=' + team.id).join() === 'prime=Prime=team-prime,nova=Nova=team-nova', 'the pickers should list each active team by its short name, with the id of its document');
  need(problems, parts.pickerTeams([]).map(team => team.code + '=' + team.label + '=' + team.id).join() === 'prime=Prime=,nova=Nova=', 'with no team document the pickers should offer the two built-in teams, with no document');
  need(problems, parts.teamCodes([prime, nova]).join() === 'prime,nova' && parts.teamCodes([]).length === 0, 'the first rows should be worked out from the codes of the active teams, and from none when there is no team document');
  need(problems, parts.teamLabel({ code: 'x', name: 'Team X' }) === 'Team X' && parts.teamLabel({ code: 'x' }) === 'X', 'a team with no short name should be shown by its name, or its code');

  // the first fill of a Screen: the rows, the side rows and the Monday style, and when nothing is filled
  const owners = (style, value, readOnly, result) => input.fillPatches(value, style, result === undefined ? read : result, readOnly);
  const patchOf = (patches, field) => patches.filter(patch => patch.path && patch.path[0] === field)[0];
  const filled = owners('original', { mainRows: [] }, false);
  need(problems, filled.length === 3 && filled.every(patch => patch.type === 'set'), 'an empty Screen should be filled with three patches: the main panel rows, the side panel rows and the Monday style');
  need(problems, patchOf(filled, 'mainRows') && patchOf(filled, 'mainRows').value.length === 16 && patchOf(filled, 'mainRows').value[0].panel === 'tonight' && patchOf(filled, 'mainRows').value[0].team === 'prime' && patchOf(filled, 'mainRows').value[15].panel === 'events', 'the owner Panel order should give 16 main rows, Prime tonight first and events last');
  need(problems, new Set(patchOf(filled, 'mainRows').value.map(row => row._key)).size === 16, 'every main row needs a key of its own');
  need(problems, patchOf(filled, 'sideRows') && patchOf(filled, 'sideRows').value.map(row => row.panel).join() === 'forecast,next-event,task-counts,sponsor-logo,task-counts', 'the owner Panel order should give the five side rows, task counts twice');
  need(problems, patchOf(filled, 'mondayStyle') && patchOf(filled, 'mondayStyle').value === 'cybertron', 'the Monday style should be copied from Dashboard Settings');
  need(problems, !patchOf(owners('minimal', {}, false), 'sideRows') && patchOf(owners('minimal', undefined, false), 'mainRows'), 'Minimal should be filled with main rows and no side rows');
  need(problems, owners('original', { mainRows: [{ _key: 'a', panel: 'tasks' }] }, false).length === 0, 'a Screen that has main rows should be left as it is');
  need(problems, owners('original', { mainRows: [] }, true).length === 0, 'a Screen that cannot be edited should not be filled');
  need(problems, owners('original', { mainRows: [] }, false, { settings: null, teams: [], unreadable: true }).length === 0, 'a Screen should not be filled when the Panel order could not be read');
  need(problems, owners('original', { mainRows: [] }, false, null).length === 0, 'a Screen should not be filled before anything is read');
  const kept = owners('original', { sideRows: [{ _key: 's', panel: 'forecast' }], mondayStyle: 'original' }, false);
  need(problems, !patchOf(kept, 'sideRows') && !patchOf(kept, 'mondayStyle') && patchOf(kept, 'mainRows'), 'side rows and a Monday style that are there already should be kept');
  const empty = owners('original', {}, false, { settings: null, teams: [], unreadable: false });
  need(problems, patchOf(empty, 'mainRows') && patchOf(empty, 'mainRows').value.length === 13 && patchOf(empty, 'sideRows') && patchOf(empty, 'sideRows').value.length === 5 && patchOf(empty, 'mondayStyle').value === 'minimal', 'with no Dashboard Settings and no team document the Screen should be filled with every panel for the built-in team, and the Monday style minimal');

  // the form: switch, map and the usual form. Opened on an empty Original Screen with a client that answers.
  resetGlobals();
  globalThis.studioClient = clientAnswering(answer);
  globalThis.studioForm = { _id: 'drafts.screen-original' };
  const changes = [];
  const selected = [];
  const open = (extra, style) => {
    globalThis.studioForm = { _id: 'drafts.screen-' + (style || 'original') };
    return input.ScreenInput(Object.assign({ value: { mainRows: [] }, readOnly: false, groups: groupsOpen('banner'), onFieldGroupSelect: name => selected.push(name), onChange: patch => changes.push(patch), renderDefault: () => 'the usual form' }, extra));
  };
  const tree = open({});
  await Promise.all(globalThis.studioEffects.map(effect => effect())).then(wait);
  need(problems, changes.length === 1 && Array.isArray(changes[0]) && changes[0].length === 3, 'opening an empty Screen should fill it once, in one change');
  need(problems, tree && tree.props && typeof tree.props.value === 'object' && tree.props.value.style === 'original' && tree.props.value.editing === 'prime' && tree.props.value.teams.length === 2, 'the form should share the style, the team of the switch and the teams with the inputs inside it');
  need(problems, wordsIn(nodesWhere(tree, node => node.props && node.props['data-block'] === 'section')) === 'the usual form', 'the fields should be drawn by Studio below the map (renderDefault)');
  const radios = nodesWhere(tree, node => node.type === 'input' && node.props.type === 'radio');
  need(problems, radios.length === 2 && wordsIn(nodesWhere(tree, node => node.props && node.props['data-block'] === 'switch')) === 'Editing: Prime Nova' && radios[0].props.checked === true && radios[1].props.checked === false, 'the Editing switch should show Prime and Nova, with Prime picked');
  need(problems, boxes(tree).map(letterOf).join('') === 'ABCDE' && boxes(tree).every(node => node.props.role === 'button' && node.props.tabIndex === 0 && typeof node.props.onClick === 'function' && typeof node.props.onKeyDown === 'function'), 'the map should have a box for each letter A to E, and each should be a button for the mouse and the keyboard');

  // a click on a letter opens its tab, and the open tab has its box highlighted
  ['A:banner', 'B:main', 'C:countdown', 'D:side', 'E:ticker'].forEach(entry => {
    const node = boxes(open({})).filter(item => letterOf(item) === entry[0])[0];
    node.props.onClick();
    need(problems, selected[selected.length - 1] === entry.split(':')[1], 'a click on ' + entry[0] + ' should open the ' + entry.split(':')[1] + ' tab');
  });
  const keyed = boxes(open({})).filter(item => letterOf(item) === 'B')[0];
  const before = selected.length;
  keyed.props.onKeyDown({ key: 'Enter', preventDefault: () => {} });
  keyed.props.onKeyDown({ key: ' ', preventDefault: () => {} });
  keyed.props.onKeyDown({ key: 'Tab', preventDefault: () => problems.push('the Tab key should not open a section') });
  need(problems, selected.length === before + 2 && selected.slice(before).join() === 'main,main', 'Enter and Space on a box should open its section, and no other key');
  const lit = group => boxes(open({ groups: groupsOpen(group) })).filter(node => node.props['aria-pressed'] === true).map(letterOf).join('');
  need(problems, lit('banner') === 'A' && lit('main') === 'B' && lit('countdown') === 'C' && lit('side') === 'D' && lit('ticker') === 'E', 'the box of the open tab, and only that one, should be highlighted');
  const outline = group => nodesWhere(boxes(open({ groups: groupsOpen(group) })).filter(node => letterOf(node) === 'B')[0], node => node.type === 'rect')[0].props.style.strokeWidth;
  need(problems, outline('main') > outline('banner'), 'the box of the open tab should have a heavier outline');
  need(problems, boxes(open({ groups: [] })).every(node => node.props['aria-pressed'] === false) && boxes(open({ groups: undefined })).length === 5, 'with no groups the map should still be drawn, with nothing highlighted');

  // Minimal: D is drawn, dashed, with its line, and opens nothing
  const minimalTree = open({}, 'minimal');
  const minimalD = boxes(minimalTree).filter(node => letterOf(node) === 'D')[0];
  need(problems, minimalD && minimalD.props.onClick === undefined && minimalD.props.role === undefined && wordsIn(minimalD).indexOf('This screen has no side panel.') !== -1, 'on Minimal the D box should be drawn with the line This screen has no side panel, and open nothing');
  need(problems, boxes(minimalTree).filter(node => letterOf(node) !== 'D').every(node => typeof node.props.onClick === 'function') && boxes(minimalTree).map(letterOf).join('') === 'AACBED', 'on Minimal the other boxes should open their sections');
  need(problems, nodesWhere(minimalTree, node => node.type === 'svg')[0].props.viewBox === '0 0 1920 ' + world.screenMap.mapFor('minimal').height, 'the picture of Minimal should be taller than the screen to hold the dashed D box');
  need(problems, nodesWhere(tree, node => node.type === 'svg')[0].props.viewBox === '0 0 1920 1080' && nodesWhere(tree, node => node.type === 'svg')[0].props.role === 'group', 'the picture of Original should be drawn on the 1920 by 1080 of the screen');
  const rowsWord = value => wordsIn(boxes(open({ value: value })).filter(node => letterOf(node) === 'B')[0]);
  need(problems, /16 rows/.test(rowsWord({ mainRows: new Array(16).fill({}) })) && /No rows yet/.test(rowsWord({})), 'the B box should say how many rows the list has');

  // nothing is filled while the Screen cannot be edited, nor when the read fails
  resetGlobals();
  const quiet = [];
  globalThis.studioClient = clientAnswering(answer);
  open({ readOnly: true, onChange: patch => quiet.push(patch) });
  await Promise.all(globalThis.studioEffects.map(effect => effect())).then(wait);
  resetGlobals();
  globalThis.studioClient = clientAnswering(new Error('offline'));
  open({ onChange: patch => quiet.push(patch) });
  await Promise.all(globalThis.studioEffects.map(effect => effect())).then(wait);
  need(problems, quiet.length === 0, 'a Screen that cannot be edited, or whose settings cannot be read, should not be filled');
  resetGlobals();
  globalThis.studioClient = clientAnswering(answer);
  open({ value: { mainRows: [{ _key: 'a', panel: 'tasks' }] }, onChange: patch => quiet.push(patch) });
  await Promise.all(globalThis.studioEffects.map(effect => effect())).then(wait);
  need(problems, quiet.length === 0, 'a Screen with rows should not be filled again');
  resetGlobals();

  // the team link of the Banner section, for the team the switch is on
  const context = (editing, teams) => ({ style: 'original', teams: teams || parts.pickerTeams([prime, nova]), editing: editing, settings: { countdown: countdown }, read: true, unreadable: false });
  const navigated = [];
  globalThis.studioPaneRouter = { navigateIntent: (...given) => navigated.push(given), ChildLink: 'ChildLink' };
  globalThis.studioContextValue = context('nova');
  const link = fields.BannerTeamInput();
  link.props.onClick();
  need(problems, link.type === 'button' && /Nova/.test(wordsIn(link)) && JSON.stringify(navigated[0]) === JSON.stringify(['edit', { id: 'team-nova', type: 'team' }]), 'the Banner section should open the Team document of the team the switch is on (' + JSON.stringify(navigated[0]) + ')');
  globalThis.studioContextValue = context('', parts.pickerTeams([prime, nova]));
  need(problems, /Prime/.test(wordsIn(fields.BannerTeamInput())), 'with the switch on no team the Banner section should open the first team');
  globalThis.studioContextValue = context('prime', parts.pickerTeams([]));
  need(problems, fields.BannerTeamInput().type === 'p' && wordsIn(fields.BannerTeamInput()) === parts.words.noTeamDocument, 'with no team document the Banner section should say there is none yet');

  // the Countdown section: the title and dates, read only, and the button that opens them in Dashboard Settings
  globalThis.studioContextValue = context('prime');
  const shown = fields.CountdownInput();
  const countdownText = wordsIn(shown);
  need(problems, countdownText.indexOf(parts.words.sharedCountdown) !== -1 && countdownText.indexOf('KICKOFF IN') !== -1 && countdownText.indexOf('ROLLOUT IN') !== -1 && /Kickoff date .*2027/.test(countdownText) && /Rollout date Not set/.test(countdownText), 'the Countdown section should say the title and dates are shared, and show both titles and both dates (' + countdownText + ')');
  nodesWhere(shown, node => node.type === 'button')[0].props.onClick();
  need(problems, JSON.stringify(navigated[1]) === JSON.stringify(['edit', { id: 'dashboardSettings', type: 'dashboardSettings', path: 'countdown' }]), 'the Countdown section should open Dashboard Settings at the countdown (' + JSON.stringify(navigated[1]) + ')');
  need(problems, parts.countdownTarget.id === world.structure.settingsId && parts.settingsTarget.type === world.structure.settingsType, 'the Countdown section should open the page of settingsType and settingsId in structure.js');
  globalThis.studioContextValue = Object.assign(context('prime'), { read: false });
  need(problems, wordsIn(fields.CountdownInput()).indexOf(parts.words.readingCountdown) !== -1, 'the Countdown section should say that it is reading the countdown');
  globalThis.studioContextValue = Object.assign(context('prime'), { unreadable: true, settings: null });
  need(problems, wordsIn(fields.CountdownInput()).indexOf(parts.words.countdownUnreadable) !== -1, 'the Countdown section should say when the countdown could not be read');
  globalThis.studioContextValue = Object.assign(context('prime'), { settings: null });
  need(problems, wordsIn(fields.CountdownInput()).indexOf(parts.words.noSettings) !== -1, 'the Countdown section should say when Dashboard Settings has not been published');
  need(problems, parts.countdownLines({ kickoffLabel: '  ' }).every(line => line.text === 'Not set') && parts.countdownLines(null).length === 4, 'a countdown with nothing in it should say Not set for every line');

  // the Ticker section: a link to the line of Tips and News in the sidebar
  const tips = world.structure.sidebarEntries.filter(entry => entry.title === 'Tips and News')[0];
  const tipsLink = fields.TickerInput();
  need(problems, tips && parts.tipsAndNewsPath === '/structure/' + (tips.id || tips.type) && tipsLink.props.href === parts.tipsAndNewsPath && wordsIn(tipsLink) === 'Open Tips and News', 'the Ticker section should link to Tips and News in the sidebar (' + parts.tipsAndNewsPath + ')');

  // the team of a row: the choices of its panel, a patch for each, and a team that is no longer in the list
  const teamsNow = parts.pickerTeams([prime, nova]);
  const radiosOf = (panel, value, readOnly) => {
    globalThis.studioContextValue = context('prime', teamsNow);
    globalThis.studioForm = { 'mainRows.row.panel': panel };
    const patches = [];
    const view = fields.RowTeamInput({ id: 'team', value: value, readOnly: readOnly, path: ['mainRows', 'row', 'team'], onChange: patch => patches.push(patch) });
    return { view: view, patches: patches, radios: nodesWhere(view, node => node.type === 'input' && node.props.type === 'radio') };
  };
  need(problems, radiosOf('tasks', undefined).radios.length === 3 && wordsIn(radiosOf('tasks', undefined).view).indexOf('Keep the team on the screen') !== -1, 'a team-specific panel should offer Keep the team on the screen, Prime and Nova');
  const keep = radiosOf('tasks', undefined);
  need(problems, keep.radios[0].props.checked === true && keep.radios[1].props.checked === false, 'a row with no team should have Keep the team on the screen picked');
  keep.radios[2].props.onChange();
  keep.radios[0].props.onChange();
  need(problems, JSON.stringify(keep.patches) === JSON.stringify([{ type: 'set', value: 'nova' }, { type: 'unset' }]), 'picking a team should write its code, and Keep the team on the screen should clear the field');
  need(problems, radiosOf('monday-tasks', 'prime').radios.map(node => node.props.checked).join() === 'true,false' && radiosOf('monday-milestones', 'both').radios.map(node => node.props.checked).join() === 'false,false,true', 'a Monday row should offer the teams, and Milestones and Progress also Both teams');
  need(problems, radiosOf('monday-tasks', 'nova', true).radios.every(node => node.props.disabled === true), 'a team that cannot be edited should have every line off');
  const stale = radiosOf('tasks', 'oldteam');
  need(problems, stale.radios.length === 4 && stale.radios[3].props.checked === true, 'a team that is not in the list should stay on the list, picked, so it can be seen and changed');
  const shared = radiosOf('photo', 'nova');
  const clear = nodesWhere(shared.view, node => node.type === 'button')[0];
  need(problems, shared.radios.length === 0 && wordsIn(shared.view).indexOf(parts.words.bothTeamsPanel) !== -1 && clear && wordsIn(clear) === parts.words.clearTeam, 'a panel for both teams should say so, and offer to clear a team left on the row');
  clear.props.onClick();
  need(problems, JSON.stringify(shared.patches) === JSON.stringify([{ type: 'unset' }]), 'clearing the team of a row on a panel for both teams should clear the field');
  need(problems, nodesWhere(radiosOf('photo', undefined).view, node => node.type === 'button').length === 0, 'a panel for both teams with no team should have nothing to clear');
  need(problems, wordsIn(radiosOf(undefined, undefined).view) === parts.words.pickPanelFirst, 'a row with no panel should say to pick the panel first');
  globalThis.studioContextValue = undefined;
  globalThis.studioPaneRouter = undefined;
  globalThis.studioForm = undefined;

  // the words an editor reads
  Object.keys(parts.words).forEach(name => checkPlainSentences(problems, 'the Screen form words.' + name, parts.words[name]));
  return problems;
}

// The four Views, the Themes page and the weekday theme schedule, the Look tab fields, the first fill of a
// View from the Screens, and Test the token (schemas/view.js, schemas/settingsViews.js, inputs/view-input.js,
// inputs/themes-view.js, tools/view-seed.js, tools/monday-check.js). The starting values of a view are the ones in
// tools/view-defaults.js, which defaultViews in dashboard/config.js copies once the runtime has it.
const viewGroupFields = {
  banner: ['key', 'title', 'team', 'layout', 'mirror', 'viewTag', 'teamChip', 'colors'],
  main: ['rotationNote', 'minutes', 'panels'],
  countdown: ['countdownIn', 'countdownShown'],
  side: ['sidePanels'],
  ticker: ['tickerLink'],
};

function checkViewType() {
  const problems = [];
  const config = world.dashboard;
  const type = typeByName('view');
  if (!type) return ['view is missing from schemas/index.js'];

  const at = name => fieldAt('view.' + name);
  const ids = world.viewIds;
  const defaults = world.viewDefaults.defaultViews;

  need(problems, type.type === 'document' && type.title === 'View', 'view should be a document titled View');
  need(problems, (type.groups || []).map(group => group.title).join() === startAreas.join(), 'the View should have the tabs of the map, in order: ' + startAreas.join(', '));
  need(problems, Object.values(world.screenMap.letterGroups).join() === (type.groups || []).map(group => group.name).join(), 'the letters of the map should open the tabs of the View, in order');
  need(problems, type.components && type.components.input === world.viewInput.ViewInput, 'the View should draw itself with ViewInput (view-input.js)');
  Object.keys(viewGroupFields).forEach(group => viewGroupFields[group].forEach(name => need(problems, at(name) && at(name).group === group, 'view.' + name + ' should be in the ' + group + ' tab')));
  need(problems, fieldsIn(type).map(field => field.name).join() === Object.keys(viewGroupFields).reduce((all, group) => all.concat(viewGroupFields[group]), []).join(), 'the fields of the View should be in the order of the tabs');
  need(problems, fieldsIn(type).every(field => !constraintNamed(constraintsOf(field), 'required')), 'no field of a View should be required: a View with none uses the starting values');
  checkPlainMessages('view', problems);

  // the four views, their ids and their words
  need(problems, ids.viewKeys.join() === 'general,prime,nova,family' && ids.viewKeys.every(key => ids.viewIdOf(key) === 'view-' + key && ids.keyOfViewId(ids.viewIdOf(key)) === key && ids.keyOfViewId('drafts.view-' + key) === key) && ids.keyOfViewId('view-other') === '' && ids.keyOfViewId(undefined) === '', 'the four views should be general, prime, nova and family, with the ids view- and the key');
  need(problems, config.viewKeys && config.viewKeys.join() === ids.viewKeys.join(), 'viewKeys in config.js should be the four views in the same order');
  need(problems, Object.keys(defaults).join() === ids.viewKeys.join() && ids.viewKeys.every(key => defaults[key].minutes === ids.viewMinutes[key]) && ids.viewMinutes.general === 6 && ids.viewMinutes.prime === 6 && ids.viewMinutes.nova === 6 && ids.viewMinutes.family === 2, 'the views should start at 6, 6, 6 and 2 minutes');
  const key = at('key');
  need(problems, key && key.hidden === true && key.readOnly === true && constraintNamed(constraintsOf(key), 'valid') && constraintNamed(constraintsOf(key), 'valid').args[0].join() === ids.viewKeys.join(), 'view.key should be hidden, read only and one of the four keys');

  // minutes: whole, 1 to 30
  const minutes = at('minutes');
  const minutesRules = constraintsOf(minutes);
  need(problems, minutes && minutes.type === 'number' && constraintNamed(minutesRules, 'integer') && constraintNamed(minutesRules, 'min').args[0] === 1 && constraintNamed(minutesRules, 'max').args[0] === 30 && /from 1 to 30/.test(minutes.description || ''), 'view.minutes should be a whole number from 1 to 30, and say so');

  // the arrangement fields start as defaultViews says; the choices are the two arrangements, the two countdown places and the two sets of colors
  const options = name => ((at(name).options || {}).list || []).map(item => item.value).join();
  need(problems, options('layout') === 'standard,bar' && options('countdownIn') === 'side,banner' && options('colors') === 'team,general', 'the arrangement fields should offer standard or bar, side or banner, and team or general');
  need(problems, defaults.general.layout === 'standard' && defaults.general.countdownIn === 'side' && ['prime', 'nova', 'family'].every(name => defaults[name].layout === 'bar' && defaults[name].countdownIn === 'banner'), 'General should start in the standard arrangement with the countdown in the side column, and the other three in the bar arrangement with the countdown in the banner');
  need(problems, defaults.nova.mirror === true && ['general', 'prime', 'family'].every(name => defaults[name].mirror === false), 'only Nova should start mirrored');
  need(problems, defaults.family.viewTag === false && defaults.family.teamChip === false && defaults.family.colors === 'general' && defaults.prime.colors === 'team' && defaults.nova.colors === 'team' && defaults.general.colors === 'general' && defaults.prime.teamChip === true, 'Family should start with no view tag and no team chip, in the general colors');

  // the team: a reference, shown on Prime and Nova only
  const team = at('team');
  const shownFor = key => (team && typeof team.hidden === 'function' ? !team.hidden({ document: { _id: 'drafts.view-' + key } }) : null);
  need(problems, team && team.type === 'reference' && team.to[0].type === 'team' && shownFor('prime') === true && shownFor('nova') === true && shownFor('general') === false && shownFor('family') === false, 'view.team should be a reference to a team, shown on Prime and Nova only');

  // the rows: the panels of a Screen row, Family locked, the side panels only in the standard arrangement
  const panels = at('panels');
  need(problems, panels && panels.type === 'array' && panels.of[0] === fieldAt('screen.mainRows').of[0] && fieldsIn(panels).map(field => field.name).join() === 'panel,team,department,seconds,photoCount,secondsPerPhoto,photoTotal', 'the main panel rows of a View should be the rows of a Screen: a panel, a team, a department, seconds and the photo fields');
  need(problems, panels && typeof panels.readOnly === 'function' && panels.readOnly({ document: { _id: 'view-family' } }) === true && panels.readOnly({ document: { _id: 'drafts.view-family' } }) === true && panels.readOnly({ document: { _id: 'view-prime' } }) === false && panels.readOnly({ document: { key: 'family' } }) === true, 'the rows of Family should be locked and the rows of the others open');
  need(problems, world.viewDefaults.familyPanels.join() === 'monday-overall,monday-status-depts' && defaults.family.panels.map(row => row.panel).join() === 'monday-overall,monday-status-depts', 'Family should play Overall progress and Status by department');
  const side = at('sidePanels');
  need(problems, side && side.type === 'array' && side.of[0] === fieldAt('screen.sideRows').of[0] && typeof side.hidden === 'function' && side.hidden({ document: { layout: 'bar' } }) === true && side.hidden({ document: { layout: 'standard' } }) === false && side.hidden({ document: undefined }) === false, 'the side panel rows should be the rows of a Screen, and hidden in the bar arrangement');
  need(problems, (type.preview.prepare({ id: 'drafts.view-nova' }).title === 'Nova') && type.preview.prepare({}).title === 'View', 'the list line of a View should be its name');

  // the starting rows: General has the five main panels and five small ones; the team views the Monday rows of their team
  const rowsOf = list => list.map(row => row.panel).join();
  need(problems, rowsOf(defaults.general.panels) === 'tonight,events,leadership,photo,sponsor-feature' && rowsOf(defaults.general.sidePanels) === 'next-event,task-counts,safety-days,forecast,sponsor-logo', 'General should start with Daily Agenda, Events, Leadership, Photos and Sponsors, and the small panels Next event, Task counts, Safety days, Weather and Sponsor logo');
  need(problems, defaults.general.panels[0].seconds === 45 && defaults.general.panels[2].seconds === 20 && defaults.general.panels[4].seconds === 15 && defaults.general.panels[3].photoCount === 4 && defaults.general.panels[3].secondsPerPhoto === 10 && defaults.general.sidePanels.map(row => row.seconds).join() === '30,20,20,15,15', 'General should start with the seconds the order names');
  ['prime', 'nova'].forEach(name => need(problems, rowsOf(defaults[name].panels) === 'monday-tasks,monday-done,monday-timeline,monday-board' && defaults[name].panels.every(row => row.team === name && row.seconds === 30) && defaults[name].sidePanels.length === 0, name + ' should start with its Monday rows, 30 seconds each'));
  const allRows = Object.values(defaults).reduce((all, view) => all.concat(view.panels), []);
  const registryIds = world.registry.panels.map(panel => panel.id);
  need(problems, allRows.concat(...Object.values(defaults).map(view => view.sidePanels)).every(row => registryIds.indexOf(row.panel) !== -1), 'every starting row should name a panel in registry.js');
  need(problems, allRows.every(row => !row.seconds || (row.seconds >= 6 && row.seconds <= 120)), 'every starting row should have seconds from 6 to 120');

  // when the dashboard has defaultViews, it has the same starting values
  if (config.defaultViews) need(problems, sameData(JSON.parse(JSON.stringify(config.defaultViews)), JSON.parse(JSON.stringify(defaults))), 'defaultViews in config.js should be the same as defaultViews in studio/tools/view-defaults.js');

  // the pages: four, in a folder under Settings, each of the type view with an id of its own
  const folder = world.structure.sidebarEntries.filter(entry => entry.title === 'Views')[0];
  const old = world.structure.sidebarEntries.filter(entry => entry.title === 'Old screens (not used)')[0];
  need(problems, folder && folder.entries.map(entry => entry.title + '=' + entry.id + '=' + entry.type).join() === 'Robotics=view-general=view,Prime=view-prime=view,Nova=view-nova=view', 'Views, under SCREEN, should list the pages Robotics (id view-general), Prime and Nova, each of the type view with the id view- and its key');
  need(problems, old && old.entries.filter(entry => entry.type === 'view').map(entry => entry.title + '=' + entry.id).join() === 'Family=view-family', 'Family, which the rotation does not play, should be a page in Old screens (not used)');
  need(problems, world.structure.viewIds.join() === viewPageIds.join(), 'the ids of the Views in structure.js should be ' + viewPageIds.join(', '));
  const actions = ['publish', 'discardChanges', 'delete', 'duplicate', 'unpublish'].map(action => ({ action: action }));
  need(problems, world.config.document.actions(actions, { schemaType: 'view' }).map(item => item.action).join() === 'publish,discardChanges', 'a View should have these actions: publish,discardChanges. Nothing copies it or takes it away');
  need(problems, world.config.document.newDocumentOptions([{ templateId: 'view' }, { templateId: 'plan' }], { creationContext: { type: 'document' } }).map(item => item.templateId).join() === 'plan', 'the New menu should not offer a View');
  const draft = world.publishAll.chooseDrafts([{ _id: 'drafts.view-nova', _type: 'view' }], { get: name => typeByName(name) }, world.publishAllTool.singletonIds)[0];
  need(problems, draft && draft.problem === '' && draft.publishedId === 'view-nova' && world.publishAll.labelOf(draft) === 'View: Nova', 'Publish all should publish a draft of each View under its own id and call it View: Nova');

  // a Team lead says whether the Monday tasks panel plays a page for it
  const monday = fieldAt('subteam.monday');
  need(problems, monday && monday.type === 'boolean' && monday.initialValue === true && /Starts on/.test(monday.description || ''), 'subteam.monday should be a switch that starts on');
  return problems;
}

function checkViewSettings() {
  const problems = [];
  const config = world.dashboard;
  const at = name => fieldAt('dashboardSettings.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);

  // the Look tab: name, title and order of the views, and the theme of each weekday
  need(problems, at('generalViewName') && at('generalViewName').initialValue === 'General' && config.defaultSettings.generalViewName === 'General', 'generalViewName should start as General, as config.js says');
  need(problems, at('generalViewTitle') && at('generalViewTitle').initialValue === 'HAWKTIMUS ROBOTICS' && config.defaultSettings.generalViewTitle === 'HAWKTIMUS ROBOTICS', 'generalViewTitle should start as HAWKTIMUS ROBOTICS, as config.js says');
  need(problems, at('viewOrder') && at('viewOrder').type === 'array' && at('viewOrder').initialValue.join() === 'general,prime,nova,family' && config.defaultSettings.viewOrder.join() === 'general,prime,nova,family' && constraintNamed(rulesOf(at('viewOrder')), 'unique'), 'viewOrder should start as General, Prime, Nova, Family, as config.js says, and hold each view once');
  const member = at('viewOrder') && at('viewOrder').of[0];
  need(problems, member && member.options.list.map(item => item.value).join() === 'general,prime,nova,family' && constraintNamed(constraintsOf(member), 'valid'), 'each row of viewOrder should be one of the four views');
  need(problems, at('generalViewTitle') && at('generalViewTitle').group === 'look' && !at('generalViewTitle').hidden, 'generalViewTitle should show in the Logo and motion tab');
  need(problems, at('generalViewName') && at('generalViewName').group === 'look' && at('generalViewName').hidden === true && /^Not used any more\./.test(at('generalViewName').description || ''), 'generalViewName should be hidden but stay in the schema, because the view tag is not drawn any more');
  need(problems, at('viewOrder') && at('viewOrder').group === 'look' && at('viewOrder').hidden === true && /Not used any more/.test(at('viewOrder').description || ''), 'viewOrder should be hidden in the Look tab and say Not used any more');
  need(problems, fieldAt('theme.timeZone') && fieldAt('theme.timeZone').type === 'string', 'the time zone should stay a field of the Look page');

  // the weekday themes
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const themes = world.themeIds;
  need(problems, themes.themeIds.join() === 'original,cybertron,retro,foundry' && config.scheduledThemeIds.join() === themes.themeIds.join(), 'the themes should be original, cybertron, retro and foundry, in the Studio and in config.js');
  need(problems, themes.themeWeekdays.map(day => day.name).join() === days.join() && sameData(themes.startingThemeByWeekday, config.defaultThemeByWeekday) && sameData(config.defaultSettings.themeByWeekday, config.defaultThemeByWeekday), 'the weekday themes should start the same in the Studio and in config.js');
  need(problems, Object.keys(themes.startingThemeByWeekday).every(day => themes.startingThemeByWeekday[day] === (['monday', 'wednesday', 'friday', 'sunday'].indexOf(day) !== -1 ? 'original' : 'cybertron')), 'Original should start on Monday, Wednesday, Friday and Sunday and Cybertron on Tuesday, Thursday and Saturday, with Retro and Foundry unscheduled');
  const schedule = at('themeByWeekday');
  need(problems, schedule && schedule.type === 'object' && schedule.hidden === true && schedule.group === 'look' && /Themes and backgrounds page/.test(schedule.description || ''), 'themeByWeekday should be hidden in the Look tab, and say the Themes and backgrounds page sets it');
  days.forEach(day => {
    const field = fieldAt('dashboardSettings.themeByWeekday.' + day);
    need(problems, field && field.initialValue === config.defaultThemeByWeekday[day] && field.options.list.map(item => item.value).join() === 'original,cybertron,retro,foundry' && constraintNamed(constraintsOf(field), 'valid'), 'themeByWeekday.' + day + ' should start as in config.js and offer the four themes');
  });
  const old = at('screenSchedule');
  need(problems, old && old.hidden === true && days.every(day => /^Not used any more/.test(fieldAt('dashboardSettings.screenSchedule.' + day).description || '')), 'screenSchedule should be hidden, with every day saying Not used any more');

  // the dashboard keeps the values tidy
  const tidy = { viewOrder: ['nova', 'bogus', 'nova', 'general'], generalViewName: '  ', themeByWeekday: { monday: 'retro', tuesday: 'minimal' } };
  world.dashboardContent.tidyViewSettings(tidy);
  need(problems, tidy.viewOrder.join() === 'nova,general' && tidy.generalViewName === 'General' && tidy.generalViewTitle === 'HAWKTIMUS ROBOTICS' && tidy.themeByWeekday.monday === 'retro' && tidy.themeByWeekday.tuesday === 'cybertron' && Object.keys(tidy.themeByWeekday).join() === days.join(), 'the dashboard should keep the view settings tidy: known views once, words kept, a theme for every day');
  const bare = {};
  world.dashboardContent.tidyViewSettings(bare);
  need(problems, bare.viewOrder.join() === 'general,prime,nova,family' && sameData(bare.themeByWeekday, config.defaultThemeByWeekday), 'view settings that are missing should be the starting ones');
  need(problems, sameData(themes.tidyThemeByWeekday({ monday: 'retro', friday: 'nope' }), Object.assign({}, config.defaultThemeByWeekday, { monday: 'retro' })), 'the Themes page should keep the schedule tidy the same way');

  // No theme is a placeholder
  need(problems, themes.themeChoices.every(theme => !theme.placeholder) && !fs.existsSync(path.join(dashboardFolder, 'styles', 'retro', 'PLACEHOLDER')), 'no theme should be marked as a placeholder, and Retro has no marker file');
  const bgField = at('background');
  need(problems, bgField && bgField.group === 'look' && bgField.initialValue === 'sweep' && bgField.options.list.map(item => item.value).join() === config.backgrounds.join() && bgField.hidden === true && /Themes and backgrounds page/.test(bgField.description || ''), 'the background field should stay in the Look tab, start on sweep, offer the dashboard\'s five words, be hidden and point to the Themes and backgrounds page, where it is edited');

  // the old look lists stay
  need(problems, fieldAt('theme.schedule') && fieldAt('dashboardSettings.teamOrder') && fieldAt('dashboardSettings.dailyStyles'), 'the stored schedule of the Look page and the older lists should stay in the schema');
  return problems;
}

async function checkThemesPage() {
  const problems = [];
  const view = world.themesView;
  const published = { _id: 'dashboardSettings', _type: 'dashboardSettings', _rev: 'r1', _createdAt: 'c', _updatedAt: 'u', motion: 'calm', themeByWeekday: { monday: 'cybertron' } };
  const draft = { _id: 'drafts.dashboardSettings', _type: 'dashboardSettings', themeByWeekday: { monday: 'retro' } };

  // what the page shows: the draft first, then the published document, and nothing when there is neither
  need(problems, view.scheduleFrom([published, draft]).monday === 'retro' && view.scheduleFrom([published]).monday === 'cybertron' && view.scheduleFrom([published]).tuesday === 'cybertron' && view.scheduleFrom([]) === null && view.scheduleFrom('text') === null, 'the page should show the draft schedule, then the published one, and nothing when Dashboard Settings does not exist');

  // the page: four themes, seven pickers in order, and a message for each state
  const wordsOf = node => wordsIn(node);
  const schedule = world.themeIds.tidyThemeByWeekday({});
  const page = view.pageOf({ read: true, schedule: schedule, busy: false, text: '', failed: false }, () => {});
  need(problems, wordsOf(nodesWhere(page, node => node.type === 'h1')) === 'Themes and backgrounds', 'the Themes and backgrounds page should open with the heading Themes and backgrounds');
  const listed = nodesWhere(page, node => node.type === 'li').map(wordsOf);
  need(problems, listed.length === 4 && listed[0].indexOf('Original') === 0 && listed[1].indexOf('Cybertron') === 0 && listed[2].indexOf('Retro') === 0 && listed[3].indexOf('Foundry') === 0, 'the page should list Original, Cybertron, Retro and Foundry');
  const selects = nodesWhere(page, node => node.type === 'select');
  need(problems, selects.length === 7 && selects.map(node => node.props['aria-label']).join() === 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday' && selects.every(node => nodesWhere(node, option => option.type === 'option').map(wordsOf).join() === 'Original,Cybertron,Retro,Foundry'), 'the page should have a picker for each day, Monday first, offering the four themes');
  need(problems, selects.map(node => node.props.value).join() === 'original,cybertron,original,cybertron,original,cybertron,original', 'the pickers should show the starting themes');
  const changes = [];
  const picked = nodesWhere(view.pageOf({ read: true, schedule: schedule, busy: false, text: '', failed: false }, (day, theme) => changes.push(day + '=' + theme)), node => node.type === 'select');
  picked[2].props.onChange({ target: { value: 'retro' } });
  need(problems, changes.join() === 'wednesday=retro', 'a picker should hand the day and the theme to the page');
  need(problems, wordsOf(view.pageOf({ read: false }, () => {})).indexOf(view.words.reading) !== -1 && wordsOf(view.pageOf({ read: true, schedule: null }, () => {})).indexOf(view.words.notPublished) !== -1 && nodesWhere(view.pageOf({ read: true, schedule: null }, () => {}), node => node.type === 'select').length === 0, 'the page should say it is reading, and say when Dashboard Settings has never been published, with no pickers');
  need(problems, nodesWhere(view.pageOf({ read: true, schedule: schedule, busy: true }, () => {}), node => node.type === 'select').every(node => node.props.disabled === true), 'the pickers should wait while a change is being saved');
  nodesWhere(page, node => ['h1', 'h2', 'p', 'li'].indexOf(node.type) !== -1).forEach(node => checkPlainSentences(problems, 'the Themes page ("' + wordsOf(node).slice(0, 30) + '")', wordsOf(node)));
  Object.values(view.words).forEach(text => checkPlainSentences(problems, 'a line of the Themes page', text));

  // saving: the whole schedule goes to the draft, which is made from the published document when it is not there
  function client(documents, failing) {
    const calls = [];
    return {
      calls: calls,
      getDocument: async id => documents[id] || null,
      createIfNotExists: async doc => { calls.push({ create: doc }); },
      patch: id => ({ set: fields => ({ commit: async () => { calls.push({ patch: id, set: fields }); if (failing) throw failing; return {}; } }) }),
    };
  }
  const fresh = client({ dashboardSettings: published });
  await view.saveSchedule(fresh, schedule);
  need(problems, fresh.calls.length === 2 && fresh.calls[0].create && fresh.calls[0].create._id === 'drafts.dashboardSettings' && fresh.calls[0].create.motion === 'calm' && fresh.calls[0].create._rev === undefined && fresh.calls[0].create._createdAt === undefined, 'with no draft the page should make one from the published Dashboard Settings, without its revision');
  need(problems, fresh.calls[1].patch === 'drafts.dashboardSettings' && sameData(fresh.calls[1].set, { themeByWeekday: schedule }) && Object.keys(fresh.calls[1].set).join() === 'themeByWeekday', 'the page should set themeByWeekday on the draft and nothing else');
  const have = client({ dashboardSettings: published, 'drafts.dashboardSettings': draft });
  await view.saveSchedule(have, schedule);
  need(problems, have.calls.length === 1 && have.calls[0].patch === 'drafts.dashboardSettings', 'with a draft the page should only set the field on it');
  let refused = '';
  await view.saveSchedule(client({}), schedule).catch(error => { refused = error.message; });
  need(problems, refused === view.words.notPublished, 'with no Dashboard Settings at all the page should say to publish it once');

  // the background of the Original theme: five choices, written alone to the draft
  need(problems, view.backgroundFrom([published]) === 'sweep' && view.backgroundFrom([Object.assign({}, published, { background: 'rays' }), Object.assign({}, draft, { background: 'embers' })]) === 'embers' && view.backgroundFrom([]) === null && view.backgroundFrom([Object.assign({}, published, { background: 'nope' })]) === 'sweep', 'the page should show the draft background, then the published one, sweep when it has none, and nothing without Dashboard Settings');
  const picks = [];
  const withBackground = view.pageOf({ read: true, schedule: schedule, background: 'rays', busy: false, text: '', failed: false }, () => {}, value => picks.push(value));
  const radios = nodesWhere(withBackground, node => node.type === 'input' && node.props.type === 'radio');
  need(problems, radios.map(node => node.props.value).join() === world.backgroundIds.backgroundIds.join() && radios.filter(node => node.props.checked).map(node => node.props.value).join() === 'rays', 'the page should offer the five backgrounds as choices and mark the one in use');
  radios[4].props.onChange();
  need(problems, picks.join() === 'embers', 'a background choice should hand its word to the page');
  need(problems, nodesWhere(page, node => node.type === 'input').length === 0, 'with no background read the page should draw no background choices');
  const backgroundSave = client({ dashboardSettings: published, 'drafts.dashboardSettings': draft });
  await view.saveBackground(backgroundSave, 'blueprint');
  need(problems, backgroundSave.calls.length === 1 && Object.keys(backgroundSave.calls[0].set).join() === 'background' && backgroundSave.calls[0].set.background === 'blueprint', 'the page should set background on the draft and nothing else');

  // the component: reads on open and writes on a change, and survives a client that fails
  globalThis.studioEffects = [];
  globalThis.studioClient = { fetch: async () => { throw new Error('offline'); } };
  const tree = view.ThemesView();
  await Promise.all(globalThis.studioEffects.map(effect => effect()));
  need(problems, tree && tree.props && wordsOf(tree).indexOf(view.words.reading) !== -1, 'the page should open on a line saying it is reading');
  globalThis.studioEffects = [];
  globalThis.studioClient = undefined;
  return problems;
}

// The Rotation page (inputs/rotation-view.js): the one sentence at the top, a card for each row with big buttons, and a
// save that sets rotationRows on the draft of Dashboard Settings and nothing else. Every value of a row the page does not
// show is kept when the row changes.
async function checkRotationPage() {
  const problems = [];
  const view = world.rotationView;
  const rows = view.withKeys([
    { _key: 'a', view: 'robotics', panel: 'events', part: 1, side: 'task-counts', seconds: 30, shown: true },
    { _key: 'b', view: 'prime', panel: 'monday-tasks', department: 'build', seconds: 30, shown: true },
    { view: 'nova', panel: 'photo', photoCount: 4, secondsPerPhoto: 10, shown: false },
  ]);
  need(problems, rows.length === 3 && rows.every(row => typeof row._key === 'string' && row._key !== '') && new Set(rows.map(row => row._key)).size === 3, 'every row should get its own key');

  // the sentence the owner asked for, word for word
  need(problems, view.words.intro === 'The wall plays this list top to bottom. Drag a row to move it. Turn Shown off to skip a row. Seconds is how long it stays.', 'the Rotation page should open with: The wall plays this list top to bottom. Drag a row to move it. Turn Shown off to skip a row. Seconds is how long it stays.');

  // the pure changes keep what they do not touch
  need(problems, view.moveRow(rows, 0, 1).map(row => row._key).join() === [rows[1]._key, 'a', rows[2]._key].join() && view.moveRow(rows, 0, -1) === rows && view.moveRow(rows, 2, 1) === rows, 'moving a row down should swap it with the next, and the first row cannot go up');
  const edited = view.setRowValue(rows, 0, 'seconds', 45);
  need(problems, edited[0].seconds === 45 && edited[0].part === 1 && edited[0].side === 'task-counts' && rows[0].seconds === 30, 'changing seconds should keep the part and the small panel, and not change the old rows');
  need(problems, !('seconds' in view.setRowValue(rows, 0, 'seconds', '')[0]) && view.setRowValue(rows, 2, 'shown', true)[2].photoCount === 4, 'an empty value should take the field away, and the photo values stay');
  const copied = view.copyRow(rows, 1);
  need(problems, copied.length === 4 && copied[2].department === 'build' && copied[2]._key !== rows[1]._key, 'copy should put a row with the same values and a new key under the row');
  need(problems, view.removeRow(rows, 1).length === 2 && view.addRow(rows, 'nova', 'events')[3].shown === true, 'remove takes a row out and add puts a shown row at the end');
  need(problems, view.secondsFrom('') === '' && view.secondsFrom('45') === 45 && view.secondsFrom('5') === null && view.secondsFrom('121') === null && view.secondsFrom('4.5') === null && view.secondsFrom('abc') === null, 'seconds should be empty or a whole number from 6 to 120');
  need(problems, view.detailsOf(rows[0]) === 'Page 1 · With Task counts' && view.detailsOf(rows[1]) === 'Department: build' && /4 photos/.test(view.detailsOf(rows[2])), 'the line under a row should name its department, page, small panel and photos');
  need(problems, view.startingRows().length === world.defaultRotation.defaultRotationRows().length, 'Start from the standard rotation should give the standard list');

  // what the page shows: the draft first, then the published one
  const published = { _id: 'dashboardSettings', rotationRows: [{ _key: 'p', view: 'robotics', panel: 'tonight' }] };
  const draft = { _id: 'drafts.dashboardSettings', rotationRows: [{ _key: 'd', view: 'prime', panel: 'events' }] };
  need(problems, view.rowsFrom([published, draft])[0]._key === 'd' && view.rowsFrom([published])[0]._key === 'p' && view.rowsFrom([]) === null && view.rowsFrom('x') === null, 'the page should show the draft rows, then the published ones, and nothing without Dashboard Settings');

  // the page: a card for each row with the buttons, big enough for a thumb
  const noActions = { edit() {}, seconds() {}, move() {}, copy() {}, remove() {}, toggle() {}, pick() {}, add() {}, start() {} };
  const state = { read: true, rows: rows, busy: false, text: '', failed: false, open: 'b', newView: 'robotics', newPanel: 'tasks' };
  const page = view.pageOf(state, noActions);
  need(problems, wordsIn(nodesWhere(page, node => node.type === 'h1')) === 'Rotation', 'the page should open with the heading Rotation');
  const cards = nodesWhere(page, node => node.props && node.props['data-row'] !== undefined);
  need(problems, cards.length === 3, 'the page should draw a card for each row');
  const buttons = nodesWhere(page, node => node.type === 'button');
  need(problems, buttons.length > 0 && buttons.every(node => node.props.style.minHeight >= 44), 'every button of the page should be at least 44 pixels high');
  const controls = nodesWhere(page, node => ['select', 'input'].indexOf(node.type) !== -1 && node.props.type !== 'checkbox' && node.props.type !== 'radio');
  need(problems, controls.length > 0 && controls.every(node => node.props.style.minHeight >= 44), 'every picker and box of the page should be at least 44 pixels high');
  need(problems, nodesWhere(page, node => node.props && node.props['data-more'] === 'b').length === 1 && nodesWhere(page, node => node.props && node.props['data-more'] === 'a').length === 0, 'only the open row should show its details');
  const upButtons = buttons.filter(node => node.props['aria-label'] === 'Move up');
  need(problems, upButtons[0].props.disabled === true && upButtons[1].props.disabled === false, 'the first row cannot move up');
  const calls = [];
  const live = view.pageOf(state, Object.assign({}, noActions, { move: (index, delta) => calls.push('move' + index + ':' + delta), edit: (index, field, value) => calls.push(field + index + '=' + value), copy: index => calls.push('copy' + index) }));
  const liveButtons = nodesWhere(live, node => node.type === 'button');
  liveButtons.filter(node => node.props['aria-label'] === 'Move down')[0].props.onClick();
  liveButtons.filter(node => node.children.join() === 'Copy')[1].props.onClick();
  nodesWhere(live, node => node.type === 'input' && node.props['aria-label'] === 'Shown')[0].props.onChange({ target: { checked: false } });
  need(problems, calls.join() === 'move0:1,copy1,shown0=false', 'the buttons should hand the row and the change to the page. They did: ' + calls.join());
  need(problems, nodesWhere(view.pageOf(Object.assign({}, state, { busy: true }), noActions), node => node.type === 'button' && !node.props.disabled).length === 0, 'the buttons should wait while a change is being saved');
  need(problems, wordsIn(view.pageOf({ read: false }, noActions)).indexOf(view.words.reading) !== -1 && wordsIn(view.pageOf({ read: true, rows: null }, noActions)).indexOf(view.words.notPublished) !== -1 && wordsIn(view.pageOf({ read: true, rows: [] }, noActions)).indexOf(view.words.start) !== -1, 'the page should say when it is reading, when Dashboard Settings was never published, and offer the standard rotation when the list is empty');
  nodesWhere(page, node => ['h1', 'h2', 'p'].indexOf(node.type) !== -1).forEach(node => checkPlainSentences(problems, 'the Rotation page ("' + wordsIn(node).slice(0, 30) + '")', wordsIn(node)));
  Object.values(view.words).forEach(text => checkPlainSentences(problems, 'a line of the Rotation page', text));
  need(problems, view.panelChoices.every(panel => world.screenPanels.panelTitle(panel.value) === panel.title), 'the panels the page offers should have the titles of screen-panels.js');

  // saving: the rows go to the draft, which is made from the published document when it is not there, and nothing else is set
  function client(documents) {
    const written = [];
    return {
      calls: written,
      getDocument: async id => documents[id] || null,
      createIfNotExists: async doc => { written.push({ create: doc }); },
      patch: id => ({ set: fields => ({ commit: async () => { written.push({ patch: id, set: fields }); return {}; } }) }),
    };
  }
  const fresh = client({ dashboardSettings: Object.assign({ _rev: 'r1', motion: 'calm' }, published) });
  await view.saveRows(fresh, rows);
  need(problems, fresh.calls.length === 2 && fresh.calls[0].create._id === 'drafts.dashboardSettings' && fresh.calls[0].create.motion === 'calm' && fresh.calls[0].create._rev === undefined, 'with no draft the page should make one from the published Dashboard Settings');
  need(problems, fresh.calls[1].patch === 'drafts.dashboardSettings' && Object.keys(fresh.calls[1].set).join() === 'rotationRows' && fresh.calls[1].set.rotationRows === rows, 'the page should set rotationRows on the draft and nothing else');
  let refused = '';
  await view.saveRows(client({}), rows).catch(error => { refused = error.message; });
  need(problems, refused === view.words.notPublished, 'with no Dashboard Settings at all the page should say to publish it once');

  // the field of Dashboard Settings is the full form, in the Advanced tab, and says to use the page
  const field = fieldAt('dashboardSettings.rotationRows');
  need(problems, field && field.group === 'advanced' && /Rotation page/.test(field.description || ''), 'the rotationRows field should be in the Advanced tab and point to the Rotation page');
  const line = world.structure.sidebarEntries.filter(entry => entry.title === 'Rotation')[0];
  need(problems, line && line.kind === 'component' && line.component === view.RotationView && world.structure.sidebarEntries.indexOf(line) === 2, 'Rotation should be the first line under SCREEN and open the Rotation page');
  return problems;
}

// The pages of the Studio that are not documents (inputs/) must work on a phone 390 pixels wide: a 16 pixel gutter
// at each side, no box fixed wider than the screen, and buttons and pickers at least 44 pixels high.
function checkPhonePages() {
  const problems = [];
  const pages = ['start-here.js', 'themes-view.js', 'rotation-view.js', 'calendars-view.js', 'monday-boards-view.js', 'preview-panels-view.js'];
  pages.forEach(file => {
    const text = fs.readFileSync(path.join(here, 'inputs', file), 'utf8');
    need(problems, /page: \{[^}]*padding: '24px 16px'/.test(text), file + ' should have a page with a 16 pixel gutter (padding: 24px 16px)');
    need(problems, !/padding: '24px 32px'/.test(text), file + ' should not have the 32 pixel gutter');
  });
  fs.readdirSync(path.join(here, 'inputs')).filter(file => file.endsWith('.js')).forEach(file => {
    const text = fs.readFileSync(path.join(here, 'inputs', file), 'utf8');
    (text.match(/min[Ww]idth: \d+/g) || []).forEach(found => need(problems, Number(found.replace(/\D/g, '')) < 300, file + ' has "' + found + '", which does not fit a phone. Use min(Npx, 100%) or a smaller number.'));
    (['start-here-parts.js', 'preview-panels.js'].indexOf(file) !== -1 ? [] : text.match(/\bwidth: [3-9]\d\d\b/g) || []).forEach(found => need(problems, false, file + ' has "' + found + '", a fixed width that does not fit a phone'));
    (text.match(/minHeight: \d+/g) || []).forEach(found => need(problems, Number(found.replace(/\D/g, '')) === 0 || Number(found.replace(/\D/g, '')) >= 44, file + ' has "' + found + '". A button or picker should be at least 44 pixels high.'));
  });
  const preview = fs.readFileSync(path.join(here, 'inputs', 'panel-preview.js'), 'utf8');
  need(problems, /aspectRatio: '16 \/ 9'/.test(preview) && /maxWidth: frameSize\.width/.test(preview), 'the panel preview should keep the shape of the screen and shrink to the width of the page');
  return problems;
}

async function checkViewSeed() {
  const problems = [];
  const seed = world.viewSeed;
  const form = world.viewInput;
  const defaults = world.viewDefaults.defaultViews;
  const prime = { _id: 'team-prime', name: 'Hawktimus Prime', shortName: 'PRIME', code: 'prime' };
  const nova = { _id: 'team-nova', name: 'Hawktimus Nova', shortName: 'NOVA', code: 'nova' };
  const row = (panel, team, extra) => Object.assign({ _key: 'k' + panel + (team || ''), panel: panel }, team ? { team: team } : {}, extra || {});
  const screens = [
    { _id: 'screen-original', mainRows: [row('tonight', 'prime', { seconds: 20 }), row('monday-tasks', 'prime', { department: 'subteam-build' }), row('monday-board', 'prime'), row('monday-tasks', 'nova'), row('events'), row('monday-overall'), row('leadership', 'nova')], sideRows: [row('forecast', '', { seconds: 12 }), row('next-event')] },
    { _id: 'screen-cybertron', mainRows: [row('photo')], sideRows: [] },
  ];
  const read = { settings: null, teams: [prime, nova], screens: screens, unreadable: false };
  const panelsOf = view => view.panels.map(item => item.panel + (item.team ? ':' + item.team : '')).join();

  // the split: Prime rows to Prime, Nova rows to Nova, rows with no team to General, and the two panels of Family always
  const general = seed.seedView('general', read);
  const primeView = seed.seedView('prime', read);
  const novaView = seed.seedView('nova', read);
  const family = seed.seedView('family', read);
  need(problems, panelsOf(general) === 'events,monday-overall' && general.sidePanels.map(item => item.panel + ':' + (item.seconds || '')).join() === 'forecast:12,next-event:', 'General should take the rows with no team and the side rows of the first Screen that has them');
  need(problems, panelsOf(primeView) === 'tonight:prime,monday-tasks:prime,monday-board:prime' && primeView.panels[1].department === 'subteam-build' && primeView.panels[0].seconds === 20 && primeView.sidePanels.length === 0, 'Prime should take the rows of Prime, with their seconds and departments, and have no side panels');
  need(problems, panelsOf(novaView) === 'monday-tasks:nova,leadership:nova', 'Nova should take the rows of Nova');
  need(problems, panelsOf(family) === 'monday-overall,monday-status-depts' && family.sidePanels.length === 0, 'Family should have Overall progress and Status by department, whatever the Screens hold');
  need(problems, primeView.team && primeView.team._ref === 'team-prime' && novaView.team._ref === 'team-nova' && !general.team && !family.team, 'Prime and Nova should point at their Team documents, General and Family at none');
  need(problems, [general, primeView, novaView, family].every(view => !JSON.stringify(view.panels).includes('_key')), 'the rows should be given without the keys of the Screen, so they can have their own');

  // a view with no rows of its own starts with the rows of defaultViews; with nothing read, the Panel order builds General
  const bare = seed.seedView('nova', { settings: null, teams: [], screens: [] });
  need(problems, panelsOf(bare) === panelsOf(defaults.nova) && !bare.team, 'with no Screens and no team document Nova should start with its starting rows and no team');
  const fromOrder = seed.seedView('general', { settings: { rotation: { order: [{ panel: 'tonight', show: true }, { panel: 'forecast', show: true }, { panel: 'events', show: true }] } }, teams: [prime], screens: [] });
  need(problems, panelsOf(fromOrder) === 'events' && fromOrder.sidePanels.map(item => item.panel).join() === 'forecast', 'with no Screen rows General should be built from the Panel order the same way a Screen was');
  const starts = seed.seedView('family', read);
  need(problems, ['minutes', 'layout', 'mirror', 'countdownIn', 'viewTag', 'teamChip', 'colors'].every(name => JSON.stringify(starts[name]) === JSON.stringify(defaults.family[name])) && novaView.mirror === true && primeView.mirror === false && general.layout === 'standard' && primeView.layout === 'bar', 'a View should start with the arrangement of defaultViews');
  need(problems, seed.needsViewSeed(null) && seed.needsViewSeed({}) && seed.needsViewSeed({ panels: [] }) && !seed.needsViewSeed({ panels: [{ panel: 'tasks' }] }), 'a View is filled while its main panel list has no rows');
  need(problems, seed.withKeys([{ panel: 'a' }, { panel: 'b' }], 'panels').map(item => item._key).join() === 'panels-1,panels-2', 'every row should get a key of its own');

  // the form fill
  const patchOf = (patches, field) => patches.filter(patch => patch.path && patch.path[0] === field)[0];
  const filled = form.fillPatches({ panels: [] }, 'prime', read, false);
  need(problems, patchOf(filled, 'key') && patchOf(filled, 'key').value === 'prime' && patchOf(filled, 'minutes').value === 6 && patchOf(filled, 'layout').value === 'bar' && patchOf(filled, 'panels').value.length === 3 && patchOf(filled, 'team').value._ref === 'team-prime' && !patchOf(filled, 'sidePanels'), 'an empty View should be filled with its key, minutes, arrangement, team and rows');
  need(problems, new Set(patchOf(filled, 'panels').value.map(item => item._key)).size === 3, 'every row of a filled View needs a key of its own');
  const side = form.fillPatches({}, 'general', read, false);
  need(problems, patchOf(side, 'sidePanels') && patchOf(side, 'sidePanels').value.length === 2 && patchOf(side, 'countdownIn').value === 'side', 'General should be filled with its side rows too');
  const kept = form.fillPatches({ key: 'general', minutes: 9, layout: 'bar', panels: [{ _key: 'a', panel: 'tasks' }] }, 'general', read, false);
  need(problems, kept.length === 0, 'a View that has rows should be left as it is');
  const keyed = form.fillPatches({ panels: [{ _key: 'a', panel: 'tasks' }] }, 'nova', read, false);
  need(problems, keyed.length === 1 && patchOf(keyed, 'key').value === 'nova', 'a View with rows and no key should only get its key');
  const partly = form.fillPatches({ key: 'general', minutes: 9, panels: [] }, 'general', read, false);
  need(problems, !patchOf(partly, 'minutes') && patchOf(partly, 'layout') && patchOf(partly, 'panels'), 'minutes that are there already should be kept when the rows are filled');
  need(problems, form.fillPatches({ panels: [] }, 'prime', read, true).length === 0, 'a View that cannot be edited should not be filled');
  need(problems, form.fillPatches({ panels: [] }, 'prime', { settings: null, teams: [], screens: [], unreadable: true }, false).length === 1 && form.fillPatches({ panels: [] }, 'prime', null, false).length === 1, 'a View should get its key but no rows when the Screens could not be read');

  // reading
  const answering = result => {
    const asked = [];
    return { asked: asked, fetch: async (question, params, options) => { asked.push({ question: question, options: options }); if (result instanceof Error) throw result; return result; } };
  };
  const good = answering({ settings: { rotation: {} }, teams: [prime, nova], screens: screens });
  const found = await form.readViewSources(good);
  need(problems, found.unreadable === false && found.teams.length === 2 && found.screens.length === 2 && good.asked[0].options.perspective === 'published' && /_type == "screen"/.test(good.asked[0].question) && /_type == "team" && active != false/.test(good.asked[0].question) && /_id == "dashboardSettings"/.test(good.asked[0].question), 'the form should ask for the published Screens, teams and Dashboard Settings');
  for (const entry of [answering(new Error('offline')), {}, null]) {
    need(problems, JSON.stringify(await form.readViewSources(entry)) === JSON.stringify({ settings: null, teams: [], screens: [], unreadable: true }), 'a read that fails should give nothing and say so');
  }
  const none = await form.readViewSources(answering(null));
  need(problems, none.unreadable === false && none.settings === null && none.teams.length === 0 && none.screens.length === 0, 'no answer should give nothing and not say it failed');

  // the form: picker, map, and the usual fields
  const wait = () => new Promise(resolve => setTimeout(resolve, 0));
  const navigated = [];
  globalThis.studioPaneRouter = { navigateIntent: (...given) => navigated.push(given), ChildLink: 'ChildLink' };
  const groupsOpen = name => ['banner', 'main', 'countdown', 'side', 'ticker'].map(group => ({ name: group, selected: group === name }));
  const changes = [];
  const selected = [];
  const open = (id, extra) => {
    globalThis.studioForm = { _id: id };
    globalThis.studioEffects = [];
    return form.ViewInput(Object.assign({ value: { panels: [] }, readOnly: false, groups: groupsOpen('banner'), onFieldGroupSelect: name => selected.push(name), onChange: patch => changes.push(patch), renderDefault: () => 'the usual form' }, extra));
  };
  globalThis.studioClient = answering({ settings: null, teams: [prime, nova], screens: screens });
  const tree = open('drafts.view-nova');
  await Promise.all(globalThis.studioEffects.map(effect => effect())).then(wait);
  need(problems, changes.length === 1 && Array.isArray(changes[0]) && patchOf(changes[0], 'key').value === 'nova' && patchOf(changes[0], 'team').value._ref === 'team-nova', 'opening an empty View should fill it once, in one change');
  const radios = nodesWhere(tree, node => node.type === 'input' && node.props.type === 'radio');
  need(problems, wordsIn(nodesWhere(tree, node => node.props && node.props['data-block'] === 'picker')) === 'Editing view: Robotics Prime Nova Family' && radios.map(node => node.props.checked).join() === 'false,false,true,false', 'the picker should show the four views with the open one picked');
  radios[1].props.onChange();
  need(problems, JSON.stringify(navigated[0]) === JSON.stringify(['edit', { id: 'view-prime', type: 'view' }]), 'a choice in the picker should open that view (' + JSON.stringify(navigated[0]) + ')');
  const boxes = node => nodesWhere(node, item => item.type === 'g' && item.props && item.props['data-letter'] !== undefined);
  need(problems, boxes(tree).map(item => item.props['data-letter']).join('') === 'AACBED', 'a bar View should draw the map of the bar arrangement');
  need(problems, boxes(open('view-general', { value: { panels: [] } })).map(item => item.props['data-letter']).join('') === 'ABCDE', 'General should draw the map of the standard arrangement');
  need(problems, boxes(open('view-general', { value: { layout: 'bar' } })).map(item => item.props['data-letter']).join('') === 'AACBED' && boxes(open('view-prime', { value: { layout: 'standard' } })).map(item => item.props['data-letter']).join('') === 'ABCDE', 'the map should follow the Arrangement the View is set to');
  boxes(open('view-prime', {})).filter(item => item.props['data-letter'] === 'B')[0].props.onClick();
  need(problems, selected[selected.length - 1] === 'main', 'a click on B should open the Main panel tab');
  need(problems, wordsIn(nodesWhere(open('view-prime', {}), node => node.props && node.props['data-block'] === 'section')) === 'the usual form', 'the fields should be drawn by Studio below the map');

  // nothing is filled while the View cannot be edited, nor when the read fails, nor when it has rows
  const quiet = [];
  for (const setup of [[answering({ settings: null, teams: [prime], screens: [] }), { readOnly: true }], [answering(new Error('offline')), {}], [answering({ settings: null, teams: [prime], screens: [] }), { value: { key: 'prime', panels: [{ _key: 'a', panel: 'tasks' }] } }]]) {
    globalThis.studioClient = setup[0];
    open('view-prime', Object.assign({ onChange: patch => quiet.push(patch) }, setup[1]));
    await Promise.all(globalThis.studioEffects.map(effect => effect())).then(wait);
  }
  need(problems, quiet.length === 1 && patchOf(quiet[0], 'key'), 'a View that cannot be edited should not be filled, one whose read fails gets only its key, and one with rows is left alone');
  globalThis.studioClient = undefined;
  globalThis.studioForm = undefined;
  globalThis.studioEffects = [];
  globalThis.studioPaneRouter = undefined;
  return problems;
}

async function checkMondayToken() {
  const problems = [];
  const check = world.mondayCheck;
  const input = world.mondayTokenInput;
  const field = fieldAt('dashboardSettings.mondayTokenTest');

  need(problems, field && field.group === 'monday' && field.readOnly === true && field.initialValue === undefined && field.components && field.components.input === input.MondayTokenInput, 'the Monday tab should have a read only Test the token field, drawn by MondayTokenInput (monday-token-input.js)');
  need(problems, field && field.title === 'Test the token' && /computer/.test(field.description || '') && /account name or the error/.test(field.description || ''), 'Test the token should say that the Teletraan computer answers with the account name or the error');
  need(problems, check.checkWord === 'monday-check', 'the helper word should be monday-check');

  // what the Teletraan computer answers, in words
  const line = answer => check.answerLine(answer);
  need(problems, line({ ok: true, account: 'Pat Example' }).text === 'Connected as Pat Example.' && line({ ok: true, account: 'Pat Example' }).failed === false && line({ ok: true, output: 'Sam\nsecond line' }).text === 'Connected as Sam.', 'a good answer should say Connected as and the account name');
  need(problems, line({ ok: false, error: 'Not authorized' }).text === 'Not authorized' && line({ ok: false, error: 'Not authorized' }).failed === true && line({ ok: false }).text === check.words.noAnswer && line(null).failed === true && line({ ok: true }).failed === true, 'a bad answer should give the error, or say the Teletraan computer gave no answer');

  // the call: a POST of the word to the helper endpoint of the control page, with the cookie
  const sent = [];
  const answering = result => async (address, options) => { sent.push({ address: address, options: options }); if (result instanceof Error) throw result; return { json: async () => result }; };
  const good = await check.checkToken(answering({ ok: true, account: 'Pat Example' }));
  const call = sent[0];
  need(problems, good.text === 'Connected as Pat Example.' && call.address === world.controlAddress.helperAddress && call.address.indexOf(world.controlAddress.controlAddress) === 0 && call.options.method === 'POST' && call.options.credentials === 'include' && JSON.parse(call.options.body).word === 'monday-check', 'Test the token should post the word monday-check to the helper of the control page');
  need(problems, !/token|key|secret/i.test(call.options.body), 'the request should carry the word and nothing secret');
  const down = await check.checkToken(answering(new Error('network')));
  need(problems, down.failed === true && down.text === check.words.unreachable, 'a control page that cannot be reached should be a line, not an error');
  need(problems, (await check.checkToken(async () => ({}))).failed === true && (await check.checkToken(async () => ({ json: async () => { throw new Error('not json'); } }))).failed === true, 'an answer that is not JSON should be a line, not an error');
  checkPlainSentences(problems, 'the lines of Test the token', Object.values(check.words).join(' '));

  // the button: asks, shows the answer, and waits while it asks
  const tree = input.MondayTokenInput({ fetcher: answering({ ok: true, account: 'Pat Example' }) });
  const button = nodesWhere(tree, node => node.type === 'button')[0];
  need(problems, button && wordsIn(button) === 'Test the token' && button.props.type === 'button' && typeof button.props.onClick === 'function' && button.props.style.minHeight >= 44, 'the field should draw a Test the token button');
  await button.props.onClick();
  need(problems, sent.length === 3, 'a click should ask the control page once');
  need(problems, !/MONDAY_API_TOKEN|local\.env|Authorization/.test(world.mondayTokenInputSource + readModule(path.join(here, 'tools', 'monday-check.js'), 'utf8')), 'the Studio should not name the key or its file, or send an authorization header');
  return problems;
}

async function main() {
  const folder = makeSandbox();
  try {
    world.types = (await load(path.join(folder, 'schemas', 'index.js'))).schemaTypes;
    world.config = (await load(path.join(folder, 'sanity.config.js'))).default;
    world.cli = (await load(path.join(folder, 'sanity.cli.js'))).default;
    world.structure = await load(path.join(folder, 'structure.js'));
    world.dashboard = await load(path.join(dashboardFolder, 'config.js'));
    world.registry = await load(path.join(dashboardFolder, 'registry.js'));
    world.themeRegistry = await load(path.join(dashboardFolder, 'themes', 'registry.js'));
    world.layoutModule = await load(path.join(dashboardFolder, 'core', 'layout.js'));
    world.overlayRegistry = await load(path.join(dashboardFolder, 'themes', 'overlays', 'registry.js'));
    world.studioThemes = await load(path.join(folder, 'inputs', 'themes.js'));
    world.cornerArt = await load(path.join(dashboardFolder, 'core', 'corner-art.js'));
    world.packExtras = await load(path.join(dashboardFolder, 'core', 'pack-extras.js'));
    world.demoRegistry = await load(path.join(dashboardFolder, 'core', 'demo-screens.js'));
    world.studioDemoScreens = await load(path.join(folder, 'inputs', 'demo-screens.js'));
    world.hiddenRegistry = await load(path.join(dashboardFolder, 'core', 'hidden-transitions.js'));
    world.studioHidden = await load(path.join(folder, 'inputs', 'hidden-transitions.js'));
    world.previewModule = await load(path.join(dashboardFolder, 'core', 'preview.js'));
    world.studioPreviews = await load(path.join(folder, 'inputs', 'previews.js'));
    world.publishAll = await load(path.join(folder, 'tools', 'publish-all.js'));
    world.publishAllTool = await load(path.join(folder, 'tools', 'publish-all-tool.js'));
    world.teamInput = await load(path.join(folder, 'inputs', 'team-input.js'));
    world.startHere = await load(path.join(folder, 'inputs', 'start-here.js'));
    world.startHereParts = await load(path.join(folder, 'inputs', 'start-here-parts.js'));
    world.screenRequests = await load(path.join(folder, 'tools', 'screen-requests.js'));
    world.dashboardAddress = await load(path.join(folder, 'inputs', 'dashboard-address.js'));
    world.controlAddress = await load(path.join(folder, 'inputs', 'control-address.js'));
    world.viewIds = await load(path.join(folder, 'inputs', 'view-ids.js'));
    world.viewDefaults = await load(path.join(folder, 'tools', 'view-defaults.js'));
    world.viewSeed = await load(path.join(folder, 'tools', 'view-seed.js'));
    world.viewInput = await load(path.join(folder, 'inputs', 'view-input.js'));
    world.themeIds = await load(path.join(folder, 'inputs', 'theme-ids.js'));
    world.backgroundIds = await load(path.join(folder, 'inputs', 'background-ids.js'));
    world.themesView = await load(path.join(folder, 'inputs', 'themes-view.js'));
    world.rotationView = await load(path.join(folder, 'inputs', 'rotation-view.js'));
    world.screenPanels = await load(path.join(folder, 'inputs', 'screen-panels.js'));
    world.defaultRotation = await load(path.join(folder, 'tools', 'default-rotation.js'));
    world.mondayCheck = await load(path.join(folder, 'tools', 'monday-check.js'));
    world.mondayTokenInput = await load(path.join(folder, 'inputs', 'monday-token-input.js'));
    world.mondayTokenInputSource = readModule(path.join(here, 'inputs', 'monday-token-input.js'), 'utf8');
    world.dashboardContent = await load(path.join(dashboardFolder, 'core', 'content.js'));
    world.startHereSource = readModule(path.join(here, 'inputs', 'start-here.js'), 'utf8');
    world.startHerePartsSource = readModule(path.join(here, 'inputs', 'start-here-parts.js'), 'utf8');
    world.actionsSource = readModule(path.join(here, 'tools', 'actions.js'), 'utf8');
    world.baseCss = readModule(path.join(dashboardFolder, 'base.css'), 'utf8');
    world.noteField = await load(path.join(folder, 'inputs', 'note-field.js'));
    world.showOnTvInput = await load(path.join(folder, 'inputs', 'show-on-tv-input.js'));
    world.statusInput = await load(path.join(folder, 'inputs', 'status-input.js'));
    world.frcStatusInput = await load(path.join(folder, 'inputs', 'frc-status-input.js'));
    world.mondayStatusInput = await load(path.join(folder, 'inputs', 'monday-status-input.js'));
    world.mondayPickers = await load(path.join(folder, 'inputs', 'monday-pickers.js'));
    world.competition = await load(path.join(dashboardFolder, 'core', 'competition.js'));
    world.sanitySource = readModule(path.join(dashboardFolder, 'core', 'sanity.js'), 'utf8');
    world.frcScript = textOf(path.join(here, '..', 'computer', 'scripts', 'frc-sync.sh'));
    world.mondayScript = textOf(path.join(here, '..', 'computer', 'scripts', 'monday-sync.sh'));
    world.panelOrderInput = await load(path.join(folder, 'inputs', 'panel-order-input.js'));
    world.screenIds = await load(path.join(folder, 'inputs', 'screen-ids.js'));
    world.screenMap = await load(path.join(folder, 'tools', 'screen-map.js'));
    world.screenParts = await load(path.join(folder, 'inputs', 'screen-parts.js'));
    world.screenFields = await load(path.join(folder, 'inputs', 'screen-fields.js'));
    world.screenInput = await load(path.join(folder, 'inputs', 'screen-input.js'));
    world.panelOrder = await load(path.join(dashboardFolder, 'core', 'panel-order.js'));
    world.constants = await load(path.join(dashboardFolder, 'core', 'constants.js'));
    world.portrait = await load(path.join(dashboardFolder, 'core', 'portrait.js'));
    world.leadershipModule = await load(path.join(dashboardFolder, 'core', 'leadership.js'));
    world.statusScript = readModule(path.join(here, '..', 'computer', 'scripts', 'status-write.sh'), 'utf8');
    world.sample = JSON.parse(readModule(path.join(dashboardFolder, 'data', 'sample', 'content.json'), 'utf8'));
    world.seed = readModule(path.join(here, '..', 'docs', 'seed', 'extra-events.ndjson'), 'utf8');
    world.placeSeed = readModule(path.join(here, '..', 'docs', 'seed', 'places.ndjson'), 'utf8');
    world.teamSeed = readModule(path.join(here, '..', 'docs', 'seed', 'teams.ndjson'), 'utf8');
    world.hawktimusCss = readModule(path.join(dashboardFolder, 'themes', 'hawktimus.css'), 'utf8');
    world.addTemplates = (await load(path.join(folder, 'tools', 'add-templates.js'))).addTemplates;
    world.timeText = await load(path.join(folder, 'inputs', 'time-text.js'));
    world.calendarsParts = await load(path.join(folder, 'inputs', 'calendars-view-parts.js'));
    world.calendarsView = await load(path.join(folder, 'inputs', 'calendars-view.js'));
    world.calendarsViewSource = fs.readFileSync(path.join(here, 'inputs', 'calendars-view.js'), 'utf8');
    world.calendarsPartsSource = ['calendars-view-parts.js', 'calendars-hide-rules.js'].map(name => fs.readFileSync(path.join(here, 'inputs', name), 'utf8')).join('\n');
    world.mondayBoardsParts = await load(path.join(folder, 'inputs', 'monday-boards-parts.js'));
    world.mondayBoardsView = await load(path.join(folder, 'inputs', 'monday-boards-view.js'));
    world.previewPanelsView = await load(path.join(folder, 'inputs', 'preview-panels-view.js'));
    world.mondayBoardsViewSource = readModule(path.join(here, 'inputs', 'monday-boards-view.js'), 'utf8');
    world.mondayBoardsPartsSource = readModule(path.join(here, 'inputs', 'monday-boards-parts.js'), 'utf8');
    world.calendarStatusScript = readModule(path.join(here, '..', 'computer', 'scripts', 'calendar-status.sh'), 'utf8');
    world.calendarStatusHelper = readModule(path.join(here, '..', 'computer', 'scripts', 'calendar-status.mjs'), 'utf8');
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }

  check('every type has a name and a title', checkNamesAndTitles);
  check('field names, kinds and limits match what the dashboard reads', checkShape);
  check('every field has a title and a one line description', checkDescriptions);
  check('every validation rule runs', checkValidations);
  check('every item has Show on screen and Hide after', checkItemFields);
  check('previews are readable and say when an item is hidden or expired', checkPreviews);
  check('lists can be ordered', checkOrderings);
  check('choice lists offer the right values', checkChoices);
  check('the panels editors can pick match dashboard/registry.js', checkPanelIds);
  check('the rules for announcement days and calendar codes work', checkRules);
  check('the Speed setting offers the speeds the dashboard has', checkSpeed);
  check('frame metal, glint, seconds per page and the name effect agree with dashboard/config.js', checkLookAndTiming);
  check('the Polish setting offers the looks in dashboard/config.js and starts on Polished', checkLookSetting);
  check('the Style setting offers the styles in dashboard/config.js and starts on Original, and the Look page calls its theme the color theme', checkStyleSetting);
  check('the page change fields agree with dashboard/config.js', checkTransitionsTab);
  check('the night mode fields agree with dashboard/config.js', checkNightTab);
  check('the hidden transition fields agree with dashboard/config.js and the dashboard registry, and the Play buttons work', checkHiddenTab);
  check('Play announcements has its hidden field, its button and its Demo step', checkPlayAnnouncements);
  check('Run presentation test has its hidden field and its button', checkRunPresentationTest);
  check('the Preview buttons have their hidden field and the list the dashboard has, and each one writes its kind and the time', checkPreviewButtons);
  check('the Start here page has its six blocks in order, a picture of the screen with the areas A to E, the status of the Teletraan computer and three links, and no buttons', checkStartHere);
  results.push({ name: 'the requests of the buttons beside Publish and the client write the same request fields, through screen-requests.js', problems: await checkScreenRequests().catch(error => ['the check stopped: ' + error.message]) });
  check('Next look now and Preview competition have their hidden request fields and starting values', checkNewRequests);
  check('Content source and the switch back time are hidden, kept in the schema and ignored by the dashboard, and the two buttons are gone', checkContentSource);
  check('Show connection status is a switch that starts off', checkConnectionStatus);
  check('a subteam has an optional list of first names, up to 24 of 12 characters, with no repeats', checkSubteamMembers);
  check('a person has an optional photo and a switch that starts on, as in dashboard/config.js', checkPersonPhoto);
  check('a team lead has an optional photo right after the lead and a switch that starts on, and the dashboard asks Sanity for the photo', checkLeadPhoto);
  check('the Portraits box has two sizes from 60 to 220, a shape and a frame, agrees with dashboard/config.js, and its descriptions give the people a page holds', checkPortraitSettings);
  check('a person and a team lead have an optional line, a person has a required Role that is the chip, and the old group is hidden', checkPersonRows);
  check('a photo has a picture, a short caption and a first name credit, and the photo settings agree with dashboard/config.js', checkPhotos);
  check('the themes and overlays in studio/inputs/themes.js are the ones in the dashboard registries', checkThemeLists);
  check('the Look page agrees with dashboard/config.js, needs a start and an end for each rule, and checks the time zone', checkTheme);
  check('the demo screens in studio/inputs/demo-screens.js are the ones in the dashboard registry', checkDemoScreens);
  check('the Demo page agrees with dashboard/config.js and has no buttons', checkDemo);
  check('an Events Calendar entry needs a title and a start date, and the seed file can be imported', checkExtraEvents);
  check('a calendar filter has a name, an action, title words, days, a calendar and dates, and needs at least one of them', checkCalendarFilters);
  check('a place has a name and a switch, a task has an optional contact and place, and the places seed file can be imported', checkPlaces);
  results.push({ name: 'two places cannot have the same name, capitals ignored', problems: await checkPlaceNames().catch(error => ['the check stopped: ' + error.message]) });
  check('the Presentations tab agrees with dashboard/config.js', checkPresentationsTab);
  check('the team fields agree with dashboard/config.js', checkTeamsTab);
  check('a meeting day has a first and a last talk, a talk length, a booking close time and a one line list entry', checkMeetingDays);
  results.push({ name: 'the last talk of a meeting day is on the same day as the first, in the Look page time zone', problems: await checkMeetingDayTimes().catch(error => ['the check stopped: ' + error.message]) });
  check('a presentation has a first name, a title, a start, a length, a Google Slides link and a status, and a one line list entry', checkPresentations);
  check('a team has a name, a short name, a number, a code, a logo and seven colors, the Teams line follows Look, and the seed file can be imported', checkTeams);
  check('every kind of content that can be for one team has an optional Team field that uses the radio', checkTeamField);
  results.push({ name: 'the Team radio shows Both and each active team, writes and clears the reference, and survives teams that cannot be read', problems: await checkTeamInput().catch(error => ['the check stopped: ' + error.message]) });
  check('starting values match dashboard/config.js', checkStartingValues);
  check('every name in config.js and the sample content has a field', checkDashboardNames);
  check('the sidebar has the headings, groups and icons it should, every document type has a line, and each line opens the right list, page or component', checkSidebar);
  check('no title, description or message an editor reads still uses an old sidebar name', checkOldTitles);
  check('Dashboard Settings, Look and Demo exist once, the New menu offers the right types, and the project files agree', checkSettingsPage);
  check('the Publish all tool is in the top bar and keeps the pages that exist once on their fixed ids', checkPublishAll);
  check('Dashboard Settings has its eight tabs, every field is in the tab the table says, and the notes and the status block store nothing', checkSettingsTabs);
  check('the status document has the fields the Teletraan computer writes, is kept out of the sidebar and the New menu, and the block shows its lines in plain words', checkStatusBlock);
  check('the status block shows the screen restarts of the day and the last backup', checkStatusWatchdog);
  results.push({ name: 'the status block asks for the published document by its id, and survives a client that fails', problems: await checkStatusRead().catch(error => ['the check stopped: ' + error.message]) });
  check('the Competition tab has the mode, one switch for each card and the connection block, as in dashboard/config.js, core/competition.js and registry.js', checkCompetitionTab);
  check('the FRC data document has the fields the Teletraan computer writes and the dashboard reads, is kept out of the sidebar and the New menu, and the connection block shows its lines in plain words', checkFrcStatus);
  results.push({ name: 'the connection block asks for the published FRC data document by its id, and survives a client that fails', problems: await checkFrcRead().catch(error => ['the check stopped: ' + error.message]) });
  check('Panel order is one list of every panel, the older lists are hidden, and the input fills an empty list from them as the dashboard does', checkPanelOrder);
  check('the Monday cards are panels of the large frame, kept out of Panel order, its starting rows and the lists of config.js', checkMondayCards);
  check('the night times, the speaker wait, the overrun and the booking close time are hidden, keep their starting values and are not read by the dashboard', checkFixedValues);
  check('the look rotation fields offer the styles, teams and swaps the dashboard has, start as its defaults, and the old Style and Team mode are hidden but kept', checkLookRotation);
  check('the Events panel has two pages that it scrolls between: each calendar has a kind, Group events by kind starts off, and an Always show rule can be pinned to page one', checkEventPages);
  check('a team has the eight trim choices, each a radio list that agrees with dashboard/config.js and starts as Prime, and the seed file and the sample give Nova its own', checkTeamTrim);
  check('every theme and overlay is complete and readable (tests/check-themes.test.mjs)', checkThemeGuard);
  check('every seasonal pack is complete, and draws only in the empty places (tests/check-seasons.test.mjs)', checkSeasonGuard);
  check('a task has a source, a board, a priority and Show on TV, every task is read only except Show on TV, no New menu offers one, and Monday Tasks holds every task once', checkBoardTasks);
  check('each list under Tasks, Events and Roster has a plus button that makes its own type with the starting values of the group, and the New menus are as they were', checkListAdds);
  check('the calendar status document has the fields the Teletraan computer writes, is kept out of the sidebar and the New menu, and the scripts on the computer write the same document', checkCalendarStatusType);
  check('the Calendars page has the help line, the calendars of Dashboard Settings on the left and the next events with SHOWN or HIDDEN on the right, and writes nothing itself', checkCalendarsPage);
  results.push({ name: 'the Calendars page asks for the published documents by their ids, and survives a client that fails', problems: await checkCalendarsRead().catch(error => ['the check stopped: ' + error.message]) });
  check('the Calendars page shows the kind of each calendar and the Hide buttons of each event, and every rule they make is accepted by the Calendar filters schema', checkCalendarsHide);
  results.push({ name: 'the Hide buttons make a rule once with createIfNotExists, Show again deletes the rule and its draft, and the rules made on the page are read by their id', problems: await checkCalendarsHideWrite().catch(error => ['the check stopped: ' + error.message]) });
  check('the Monday tab has the connection block, up to 10 board entries with pickers and a choice of group names or a status column, the labels for in progress and done (the Backlog label is hidden and ignored) and the owner switch, as in dashboard/config.js', checkMondayTab);
  check('the Monday data document has the fields the Teletraan computer writes, is kept out of the sidebar and the New menu, the script writes the same fields and task fields, and the connection block shows its lines in plain words', checkMondayStatus);
  results.push({ name: 'the connection block asks for the published Monday data document by its id, and survives a client that fails', problems: await checkMondayRead().catch(error => ['the check stopped: ' + error.message]) });
  check('the connection block shows how often the Teletraan computer reads, the reads used today and the tasks made with the hidden ones below its four lines, a line for each of the two boards, and leaves out a number it cannot read', checkMondayCounts);
  results.push({ name: 'the connection block counts the published tasks from the board, and survives a client that fails', problems: await checkMondayTaskCount().catch(error => ['the check stopped: ' + error.message]) });
  results.push({ name: 'the connection block asks for the board of each published task that is on the TV, and survives a client that fails', problems: await checkMondayShownBoards().catch(error => ['the check stopped: ' + error.message]) });
  check('the board and column pickers list the boards and the columns of that board only, with their types in words, clear a column when the board changes, say to wait for the sync when a board has no columns yet, and write only the id', checkMondayPickers);
  results.push({ name: 'the pickers ask for the published Monday data document by its id, and survive a client that fails', problems: await checkMondayBoardsRead().catch(error => ['the check stopped: ' + error.message]) });
  check('the Monday Boards page lists the boards, has a Choose boards button, links each chosen board to its tasks in the two lists of Monday Tasks, and writes nothing', checkMondayBoardsPage);
  results.push({ name: 'the Monday Boards page asks for the published status document and board rows by their ids, and survives a client that fails', problems: await checkMondayBoardsPageRead().catch(error => ['the check stopped: ' + error.message]) });
  check('the Photo fit setting and the Fit of a photo agree with dashboard/config.js, start as fill and as the setting, and the sample shows both on photos of different shapes', checkPhotoFit);
  check('a Screen has the five tabs of the map, banner settings that start as in dashboard/config.js, rows of a panel, a team and seconds, and the weekday schedule picks one of the three Screens for each day', checkScreenType);
  check('the map of a Screen has the boxes of its layout, words that fit them and no overlap, and Minimal has a dashed D under the screen', checkScreenMap);
  results.push({ name: 'the form of a Screen has the Editing switch and the map, a click or a key on a letter opens its tab, an empty Screen is filled once from the Panel order, and the inputs of the sections work', problems: await checkScreenForm().catch(error => ['the check stopped: ' + error.message]) });
  check('a View has the five tabs of the map, a team on Prime and Nova, rows that are the rows of a Screen, Family locked, and starting values that agree with the order', checkViewType);
  check('the Look tab has the name, title and order of the views, the weekday themes start as in dashboard/config.js and are kept tidy, and no theme is a placeholder', checkViewSettings);
  results.push({ name: 'the Rotation page has the owner\'s sentence, a card for each row with big buttons, keeps every value it does not show, and writes only rotationRows to the draft of Dashboard Settings', problems: await checkRotationPage().catch(error => ['the check stopped: ' + error.stack]) });
  results.push({ name: 'the pages of the Studio fit a phone: a 16 pixel gutter, nothing fixed wider than 390 pixels and buttons of 44 pixels', problems: checkPhonePages() });
  results.push({ name: 'the Themes page lists the themes, has a picker for each weekday, and writes only themeByWeekday to the draft of Dashboard Settings', problems: await checkThemesPage().catch(error => ['the check stopped: ' + error.stack]) });
  results.push({ name: 'a View is filled once from the Screens split by team, Family keeps its two panels, and the form has the picker and the map', problems: await checkViewSeed().catch(error => ['the check stopped: ' + error.stack]) });
  results.push({ name: 'Test the token asks the control page for the monday-check word and shows the account name or the error', problems: await checkMondayToken().catch(error => ['the check stopped: ' + error.stack]) });

  process.exitCode = report() > 0 ? 1 : 0;
}

main().catch(error => {
  console.error('Could not load the Studio files: ' + error.message);
  process.exitCode = 1;
});
