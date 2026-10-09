// The sidebar. To change the order, move a line in sidebarEntries below.
// Calendar events are not edited here: they come from the team's BAND
// calendars, and the Calendars page shows what they bring in. Three types are
// kept in the schema with no line here, so the documents already typed keep
// opening: extraEvent (Events Calendar, which the screen no longer reads),
// place (a task's Location field adds and opens them) and demo (its
// buttons are on Start here). The status document, which the Mini writes and the
// status block in Dashboard Settings shows, has no line either. check-schemas.mjs
// lists them with the reason.
//
// One line is one entry:
//   kind 'list'       opens the list of one kind of document (type). With a filter it
//                     lists only the documents the filter keeps, and needs an id of its own
//   kind 'page'       opens the one document of its type, which has a fixed id
//   kind 'group'      a folder: opens a list of the lines under entries. A folder holds
//                     lists, pages and one more folder, which holds lists only. add names
//                     the types that the plus button of the folder offers
//   kind 'component'  opens a page that is not a document. component is a plain function
//                     that draws it (start-here.js, calendars-view.js), and it needs an id
//   kind 'divider'    a thin line between groups. With a title it is a heading
// Every entry except a divider needs an icon, and no two entries share one.
// The icons come from @sanity/icons. Each is imported from its own file, such as
// '@sanity/icons/Home', because the package no longer lists them in its main file.
// A new kind of document needs a line here: check-schemas.mjs fails without it.

import { ArchiveIcon } from '@sanity/icons/Archive';
import { BulbOutlineIcon } from '@sanity/icons/BulbOutline';
import { CalendarIcon } from '@sanity/icons/Calendar';
import { ClockIcon } from '@sanity/icons/Clock';
import { CogIcon } from '@sanity/icons/Cog';
import { ColorWheelIcon } from '@sanity/icons/ColorWheel';
import { DesktopIcon } from '@sanity/icons/Desktop';
import { FilterIcon } from '@sanity/icons/Filter';
import { HeartIcon } from '@sanity/icons/Heart';
import { HomeIcon } from '@sanity/icons/Home';
import { ImagesIcon } from '@sanity/icons/Images';
import { MicrophoneIcon } from '@sanity/icons/Microphone';
import { PresentationIcon } from '@sanity/icons/Presentation';
import { StarIcon } from '@sanity/icons/Star';
import { SyncIcon } from '@sanity/icons/Sync';
import { TaskIcon } from '@sanity/icons/Task';
import { ThLargeIcon } from '@sanity/icons/ThLarge';
import { TimelineIcon } from '@sanity/icons/Timeline';
import { TokenIcon } from '@sanity/icons/Token';
import { UsersIcon } from '@sanity/icons/Users';
import { StartHere } from './start-here.js';
import { CalendarsView } from './calendars-view.js';

// Pages that exist once. Each is a single document with a fixed id.
export const settingsType = 'dashboardSettings';
export const settingsId = 'dashboardSettings';
export const themeType = 'theme';
export const themeId = 'theme';
export const demoType = 'demo';
export const demoId = 'demo';
export const singletonTypes = [settingsType, themeType, demoType];

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

// What a filter keeps. $since is a day ago, worked out when the sidebar opens in
// structure() below: Studio keeps a list live, and a live filter cannot use now().
// Both are UTC text, so comparing them as text compares the times. A talk with
// no start yet stays under Upcoming, so it can still be found.
const startedRecently = '!defined(start) || start >= $since';
const startedEarlier = 'defined(start) && start < $since';

export const sidebarEntries = [
  { kind: 'component', title: 'Start here', id: 'startHere', icon: HomeIcon, component: StartHere },
  { kind: 'divider', title: 'EVERY MEETING' },
  {
    kind: 'group',
    title: 'Daily Agenda',
    icon: CalendarIcon,
    id: 'dailyAgenda',
    add: ['plan', 'presentation'],
    entries: [
      { kind: 'list', title: 'Agenda items', icon: TimelineIcon, type: 'plan', sort: newestDateFirst },
      {
        kind: 'group',
        title: 'Presentations',
        icon: PresentationIcon,
        id: 'presentations',
        entries: [
          { kind: 'list', title: 'Upcoming', icon: MicrophoneIcon, id: 'upcomingTalks', type: 'presentation', sort: soonestStart, filter: startedRecently },
          { kind: 'list', title: 'Past', icon: ArchiveIcon, id: 'pastTalks', type: 'presentation', sort: latestStart, filter: startedEarlier },
        ],
      },
      { kind: 'list', title: 'Meeting days', icon: ClockIcon, type: 'presentationDay', sort: byFirstTalk },
    ],
  },
  { kind: 'list', title: 'Tasks', icon: TaskIcon, type: 'task', sort: byOrder },
  { kind: 'list', title: 'Tips and News', icon: BulbOutlineIcon, type: 'tipOrNews', sort: byOrder },
  { kind: 'divider', title: 'EVENTS' },
  { kind: 'component', title: 'Calendars', id: 'calendars', icon: SyncIcon, component: CalendarsView },
  { kind: 'list', title: 'Calendar filters', icon: FilterIcon, type: 'calendarFilter', sort: byName },
  { kind: 'divider', title: 'ROSTER' },
  { kind: 'list', title: 'Leadership', icon: StarIcon, type: 'person', sort: byOrder },
  { kind: 'list', title: 'Team leads', icon: UsersIcon, type: 'subteam', sort: byOrder },
  { kind: 'list', title: 'Sponsors', icon: HeartIcon, type: 'sponsor', sort: byOrder },
  { kind: 'list', title: 'Photos', icon: ImagesIcon, type: 'photo', sort: newestUploadFirst },
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

// A sidebar entry that opens the list of one kind of document
function listOf(S, entry, since) {
  const id = entry.id || entry.type;
  let list = S.documentTypeList(entry.type).title(entry.title).defaultOrdering([entry.sort]);
  if (entry.filter) {
    list = list
      .id(id)
      .apiVersion(apiVersion)
      .filter('_type == $type && (' + entry.filter + ')')
      .params({ type: entry.type, since: since });
  }
  return S.listItem().title(entry.title).id(id).icon(entry.icon).child(list);
}

// A sidebar entry that opens a list of the lines under it. The plus button of a
// folder with add offers a new document of each of those types, the way the
// plus button of a list of one type does.
function groupOf(S, entry, since) {
  let list = S.list()
    .title(entry.title)
    .id(entry.id)
    .items(entry.entries.map(inner => itemFor(S, inner, since)));
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
function componentOf(S, entry) {
  return S.listItem()
    .title(entry.title)
    .id(entry.id)
    .icon(entry.icon)
    .child(S.component(entry.component).id(entry.id).title(entry.title));
}

// A divider with a title is a heading. Its title method gives back a new divider.
function dividerOf(S, entry) {
  return entry.title ? S.divider().title(entry.title) : S.divider();
}

function itemFor(S, entry, since) {
  if (entry.kind === 'divider') return dividerOf(S, entry);
  if (entry.kind === 'list') return listOf(S, entry, since);
  if (entry.kind === 'group') return groupOf(S, entry, since);
  if (entry.kind === 'page') return pageOf(S, entry);
  if (entry.kind === 'component') return componentOf(S, entry);
  throw new Error('structure.js: "' + entry.kind + '" is not a kind of sidebar entry. Use list, page, group, component or divider.');
}

export function structure(S) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return S.list()
    .title('Teletraan I')
    .items(sidebarEntries.map(entry => itemFor(S, entry, since)));
}
