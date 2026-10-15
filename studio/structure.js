// The sidebar. To change the order, move a line in sidebarEntries below.
// Calendar events are not edited here: they come from the team's BAND
// calendars, and the Calendars page shows what they bring in. Tasks are not typed
// here either: they come from the team's Monday boards, and Monday Tasks lists them
// with one switch each, Show on TV. Three types are kept in the schema with no line
// here, so the documents already typed keep opening: extraEvent (Events Calendar,
// which the screen no longer reads), place (a task's Location field adds and opens
// them) and demo (its buttons are on Start here). The status documents, which the Mini
// writes, have no line either: status, which the status block in Dashboard Settings
// shows, calendarStatus, which the Calendars page shows, and frcStatus and mondayStatus,
// which the connection blocks of the Competition and Monday tabs show. check-schemas.mjs
// lists them with the reason.
//
// One line is one entry:
//   kind 'list'       opens the list of one kind of document (type). With a filter it
//                     lists only the documents the filter keeps, and needs an id of its own.
//                     thenBy sorts the documents that sort alike by a second field. add names
//                     the template in add-templates.js that the plus button of the list makes.
//                     add: [] takes the plus button away
//   kind 'page'       opens the one document of its type, which has a fixed id. The three Screens
//                     are three pages of one type, each with an id of its own (screen-ids.js)
//   kind 'group'      a folder: opens a list of the lines under entries. A folder holds
//                     lists, pages and one more folder, which holds lists or pages. add names
//                     the types, or the templates in add-templates.js, that the plus button
//                     of the folder offers
//   kind 'component'  opens a page that is not a document. component is a plain function
//                     that draws it (start-here.js, calendars-view.js), and it needs an id.
//                     children names a function (S, times) that builds the pane that a link
//                     on the page opens (monday-boards-view.js)
//   kind 'divider'    a thin line between groups. With a title it is a heading
// Every entry except a divider needs an icon, and no two entries share one.
// The icons come from @sanity/icons. Each is imported from its own file, such as
// '@sanity/icons/Home', because the package no longer lists them in its main file.
// A new kind of document needs a line here: check-schemas.mjs fails without it.

import { ArchiveIcon } from '@sanity/icons/Archive';
import { BoltIcon } from '@sanity/icons/Bolt';
import { BulbOutlineIcon } from '@sanity/icons/BulbOutline';
import { CalendarIcon } from '@sanity/icons/Calendar';
import { ClockIcon } from '@sanity/icons/Clock';
import { CogIcon } from '@sanity/icons/Cog';
import { ColorWheelIcon } from '@sanity/icons/ColorWheel';
import { DashboardIcon } from '@sanity/icons/Dashboard';
import { DesktopIcon } from '@sanity/icons/Desktop';
import { EyeClosedIcon } from '@sanity/icons/EyeClosed';
import { FilterIcon } from '@sanity/icons/Filter';
import { HeartIcon } from '@sanity/icons/Heart';
import { HomeIcon } from '@sanity/icons/Home';
import { ImagesIcon } from '@sanity/icons/Images';
import { MicrophoneIcon } from '@sanity/icons/Microphone';
import { PanelLeftIcon } from '@sanity/icons/PanelLeft';
import { PresentationIcon } from '@sanity/icons/Presentation';
import { SquareIcon } from '@sanity/icons/Square';
import { StackIcon } from '@sanity/icons/Stack';
import { StarIcon } from '@sanity/icons/Star';
import { SyncIcon } from '@sanity/icons/Sync';
import { TaskIcon } from '@sanity/icons/Task';
import { ThLargeIcon } from '@sanity/icons/ThLarge';
import { ThListIcon } from '@sanity/icons/ThList';
import { TimelineIcon } from '@sanity/icons/Timeline';
import { TokenIcon } from '@sanity/icons/Token';
import { UsersIcon } from '@sanity/icons/Users';
import { StartHere } from './start-here.js';
import { CalendarsView } from './calendars-view.js';
import { MondayBoardsTabs } from './preview-panels-view.js';
import { screenType, screenStyles, screenTitles, screenIdOf } from './screen-ids.js';

// Pages that exist once. Each is a single document with a fixed id.
export const settingsType = 'dashboardSettings';
export const settingsId = 'dashboardSettings';
export const themeType = 'theme';
export const themeId = 'theme';
export const demoType = 'demo';
export const demoId = 'demo';
export const singletonTypes = [settingsType, themeType, demoType];

// The three Screens, Original, Cybertron and Minimal, are pages of one type with an id each. They
// are the second line of the sidebar, right under Start here.
export { screenType };
export const screenIds = screenStyles.map(screenIdOf);
const screenIcons = { original: SquareIcon, cybertron: BoltIcon, minimal: PanelLeftIcon };
const screenPages = screenStyles.map(style => ({ kind: 'page', title: screenTitles[style], icon: screenIcons[style], type: screenType, id: screenIdOf(style) }));

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// How a list is sorted when it opens
const byOrder = { field: 'order', direction: 'asc' };
const byName = { field: 'name', direction: 'asc' };
const newestDateFirst = { field: 'date', direction: 'desc' };
const newestUploadFirst = { field: '_createdAt', direction: 'desc' };
const byFirstTalk = { field: 'firstSlotAt', direction: 'asc' };
const soonestStart = { field: 'start', direction: 'asc' };
const latestStart = { field: 'start', direction: 'desc' };
const oldestFirst = { field: '_createdAt', direction: 'asc' };
const byBoard = { field: 'mondayBoardName', direction: 'asc' };

// What a filter keeps. $since is a day ago and $now is the time the sidebar opened. Both are
// worked out when the sidebar opens in structure() below: Studio keeps a list live, and a live
// filter cannot use now(). They are UTC text, like the dates in the documents, so comparing
// them as text compares the times. A talk with no start yet stays under Upcoming, so it can
// still be found.
const startedRecently = '!defined(start) || start >= $since';
const startedEarlier = 'defined(start) && start < $since';

// The two lists of Monday Tasks. Each task is in exactly one of them. A task is on the TV when
// it comes from the board and is not switched off. Every other task is hidden, including a task
// typed by hand, which the screen no longer shows: a task with no source counts as typed by hand,
// so every task made before the team board is under Hidden. A task that expires while the Studio
// is open moves when the page is loaded again, because $now is fixed until then.
const tasksOnTv = 'source == "monday" && showOnTv != false && show != false && (!defined(expires) || expires > $now)';
const tasksHidden = 'source != "monday" || showOnTv == false || show == false || (defined(expires) && expires <= $now)';

export const sidebarEntries = [
  { kind: 'component', title: 'Start here', id: 'startHere', icon: HomeIcon, component: StartHere },
  { kind: 'group', title: 'Screens', icon: StackIcon, id: 'screens', entries: screenPages },
  { kind: 'divider', title: 'TASKS' },
  {
    kind: 'group',
    title: 'Daily Agenda',
    icon: CalendarIcon,
    id: 'dailyAgenda',
    add: ['plan', 'presentation'],
    entries: [
      { kind: 'list', title: 'Agenda items', icon: TimelineIcon, type: 'plan', sort: newestDateFirst, add: ['newPlan'] },
      {
        kind: 'group',
        title: 'Presentations',
        icon: PresentationIcon,
        id: 'presentations',
        add: ['newPresentation'],
        entries: [
          { kind: 'list', title: 'Upcoming', icon: MicrophoneIcon, id: 'upcomingTalks', type: 'presentation', sort: soonestStart, filter: startedRecently, add: ['newPresentation'] },
          { kind: 'list', title: 'Past', icon: ArchiveIcon, id: 'pastTalks', type: 'presentation', sort: latestStart, filter: startedEarlier, add: ['newPresentation'] },
        ],
      },
      { kind: 'list', title: 'Meeting days', icon: ClockIcon, type: 'presentationDay', sort: byFirstTalk, add: ['newPresentationDay'] },
    ],
  },
  {
    kind: 'group',
    title: 'Monday Tasks',
    icon: TaskIcon,
    id: 'mondayTasks',
    entries: [
      { kind: 'list', title: 'On the TV', icon: DashboardIcon, id: 'tasksOnTv', type: 'task', sort: byBoard, thenBy: oldestFirst, filter: tasksOnTv, add: [] },
      { kind: 'list', title: 'Hidden', icon: EyeClosedIcon, id: 'tasksHidden', type: 'task', sort: byBoard, thenBy: oldestFirst, filter: tasksHidden, add: [] },
    ],
  },
  { kind: 'component', title: 'Monday Boards', id: 'mondayBoards', icon: ThListIcon, component: MondayBoardsTabs, children: tasksOfBoard },
  { kind: 'list', title: 'Tips and News', icon: BulbOutlineIcon, type: 'tipOrNews', sort: byOrder, add: ['newTip'] },
  { kind: 'divider', title: 'EVENTS' },
  { kind: 'component', title: 'Calendars', id: 'calendars', icon: SyncIcon, component: CalendarsView },
  { kind: 'list', title: 'Calendar filters', icon: FilterIcon, type: 'calendarFilter', sort: byName, add: ['newCalendarFilter'] },
  { kind: 'divider', title: 'ROSTER' },
  { kind: 'list', title: 'Leadership', icon: StarIcon, type: 'person', sort: byOrder, add: ['newPerson'] },
  { kind: 'list', title: 'Team leads', icon: UsersIcon, type: 'subteam', sort: byOrder, add: ['newSubteam'] },
  { kind: 'list', title: 'Sponsors', icon: HeartIcon, type: 'sponsor', sort: byOrder, add: ['newSponsor'] },
  { kind: 'list', title: 'Photos', icon: ImagesIcon, type: 'photo', sort: newestUploadFirst, add: ['newPhoto'] },
  { kind: 'divider', title: 'COACHES ONLY' },
  {
    kind: 'group',
    title: 'Settings',
    icon: CogIcon,
    id: 'settings',
    entries: [
      { kind: 'page', title: 'Dashboard Settings', icon: DesktopIcon, type: settingsType, id: settingsId },
      { kind: 'page', title: 'Look', icon: ColorWheelIcon, type: themeType, id: themeId },
      { kind: 'list', title: 'Teams', icon: TokenIcon, type: 'team', sort: byOrder },
    ],
  },
  { kind: 'list', title: 'Extra panels', icon: ThLargeIcon, type: 'customPanel', sort: byOrder },
];

// A sidebar entry that opens the list of one kind of document. times is { since, now }.
function listOf(S, entry, times) {
  const id = entry.id || entry.type;
  const ordering = entry.thenBy ? [entry.sort, entry.thenBy] : [entry.sort];
  let list = S.documentTypeList(entry.type).title(entry.title).defaultOrdering(ordering);
  if (entry.filter) {
    list = list
      .id(id)
      .apiVersion(apiVersion)
      .filter('_type == $type && (' + entry.filter + ')')
      .params(Object.assign({ type: entry.type, since: times.since, now: times.now }, entry.params));
  }
  // Last, because every change to the list works the templates out again from the type
  if (entry.add) list = list.initialValueTemplates(entry.add.map(name => S.initialValueTemplateItem(name)));
  return S.listItem().title(entry.title).id(id).icon(entry.icon).child(list);
}

// What a board on the Monday Boards page opens: the tasks of that board in the same two lists as
// Monday Tasks. The function it gives back is handed the board number by the link on the page.
function tasksOfBoard(S, times) {
  return boardId => {
    const kept = filter => 'mondayBoardId == $board && (' + filter + ')';
    const lists = [
      { kind: 'list', title: 'On the TV', icon: DashboardIcon, id: 'board' + boardId + 'OnTv', type: 'task', sort: byBoard, thenBy: oldestFirst, filter: kept(tasksOnTv), params: { board: boardId }, add: [] },
      { kind: 'list', title: 'Hidden', icon: EyeClosedIcon, id: 'board' + boardId + 'Hidden', type: 'task', sort: byBoard, thenBy: oldestFirst, filter: kept(tasksHidden), params: { board: boardId }, add: [] },
    ];
    return S.list()
      .title('Tasks of the board')
      .id('board' + boardId)
      .items(lists.map(entry => listOf(S, entry, times)));
  };
}

// A sidebar entry that opens a list of the lines under it. The plus button of a
// folder with add offers a new document of each of those types, the way the
// plus button of a list of one type does, or the new document of a template in add-templates.js.
function groupOf(S, entry, times) {
  let list = S.list()
    .title(entry.title)
    .id(entry.id)
    .items(entry.entries.map(inner => itemFor(S, inner, times)));
  if (entry.add) list = list.menuItems(S.menuItemsFromInitialValueTemplateItems(entry.add.map(type => S.initialValueTemplateItem(type).serialize())));
  return S.listItem().title(entry.title).id(entry.id).icon(entry.icon).child(list);
}

// A sidebar entry that opens the one document of its type
function pageOf(S, entry) {
  return S.listItem()
    .title(entry.title)
    .id(entry.id)
    .icon(entry.icon)
    .child(
      S.document()
        .title(entry.title)
        .schemaType(entry.type)
        .documentId(entry.id)
    );
}

// A sidebar entry that opens a page of its own, which is not a document
function componentOf(S, entry, times) {
  let page = S.component(entry.component).id(entry.id).title(entry.title);
  if (entry.children) page = page.child(entry.children(S, times));
  return S.listItem().title(entry.title).id(entry.id).icon(entry.icon).child(page);
}

// A divider with a title is a heading. Its title method gives back a new divider.
function dividerOf(S, entry) {
  return entry.title ? S.divider().title(entry.title) : S.divider();
}

function itemFor(S, entry, times) {
  if (entry.kind === 'divider') return dividerOf(S, entry);
  if (entry.kind === 'list') return listOf(S, entry, times);
  if (entry.kind === 'group') return groupOf(S, entry, times);
  if (entry.kind === 'page') return pageOf(S, entry);
  if (entry.kind === 'component') return componentOf(S, entry, times);
  throw new Error('structure.js: "' + entry.kind + '" is not a kind of sidebar entry. Use list, page, group, component or divider.');
}

export function structure(S) {
  const now = Date.now();
  const times = { since: new Date(now - 24 * 60 * 60 * 1000).toISOString(), now: new Date(now).toISOString() };
  return S.list()
    .title('Teletraan I')
    .items(sidebarEntries.map(entry => itemFor(S, entry, times)));
}
