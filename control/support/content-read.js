// What the Calendar, news and roster blocks of the Display tab read: the coming BAND events from the document the Mini writes
// (calendar-status), the FRC news headlines (frc-news), and the existing Leadership and Team leads documents. The rules for a
// calendar event are the Studio's own: this file loads studio/inputs/calendars-list-parts.js and news-parts.js of the live release
// and uses their plain functions, so the Control page and the Studio Calendars page can never judge an event differently.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pictureUrl } from './collection-doc.js';

async function studioFile(ctx, name) {
  const root = fs.realpathSync(ctx.root);
  return import(pathToFileURL(path.join(root, 'studio', 'inputs', name)).href);
}

export const calendarParts = ctx => studioFile(ctx, 'calendars-list-parts.js');
export const newsParts = ctx => studioFile(ctx, 'news-parts.js');

// A published document by its fixed id, or null. The Mini writes these, so a draft never exists.
export async function readFixed(sanity, id) {
  const found = await sanity.query('*[_id in ["' + id + '"]]');
  return Array.isArray(found) && found[0] ? found[0] : null;
}

function withoutSystemFields(doc) {
  const copy = Object.assign({}, doc);
  ['_rev', '_createdAt', '_updatedAt'].forEach(name => delete copy[name]);
  return copy;
}

// ----- the calendar -----

export const rulesQuery = '*[_type == "calendarFilter"]';

// Everything the calendar block needs from Sanity. A part that cannot be read is null and the block says so.
export async function readCalendarWorld(sanity) {
  const read = async fn => {
    try {
      return await fn();
    } catch (error) {
      return undefined;
    }
  };
  const status = await read(() => readFixed(sanity, 'calendar-status'));
  const settings = await read(() => readFixed(sanity, 'dashboardSettings'));
  const theme = await read(() => readFixed(sanity, 'theme'));
  const rules = await read(() => sanity.queryRaw(rulesQuery));
  return {
    status: status || null,
    statusUnreadable: status === undefined,
    entries: settings && Array.isArray(settings.calendars) ? settings.calendars : [],
    zone: theme && typeof theme.timeZone === 'string' ? theme.timeZone : '',
    rules: Array.isArray(rules) ? rules : null,
  };
}

// The listed rows and the state of each, from the Studio functions
export function calendarRows(parts, world, now) {
  const rows = parts.eventRows(world.status, world.entries, now, world.zone).filter(row => !row.earlier);
  const groups = world.rules === null ? null : parts.ruleGroups(world.rules);
  return { rows: rows, groups: groups, today: parts.dayIn(now, world.zone) };
}

export function calendarAnswer(parts, world, now, canWrite) {
  const { rows, groups, today } = calendarRows(parts, world, now);
  const pending = groups === null ? 0 : groups.filter(group => group.draft && group.id.indexOf(parts.oneEventIdPrefix) === 0).length;
  const days = parts.groupByDay(rows, today).map(group => ({
    day: group.day,
    label: group.label,
    events: group.rows.map(row => {
      const state = parts.stateOf(row, groups, now);
      const judged = groups === null || row.titleKept === false ? null : parts.judge(row, parts.effectiveRules(groups), now);
      return {
        key: row.key,
        title: row.title,
        time: row.time,
        calendar: row.calendarName,
        kind: row.kind,
        state: { id: state.id, text: state.text, reason: state.reason, on: state.on, pending: state.pending, canSwitch: state.canSwitch, note: state.note },
        rule: judged && judged.by === 'rule' ? judged.rule : state.id === 'hidden-rule' ? row.listedRule : '',
      };
    }),
  }));
  return {
    canWrite: canWrite,
    updatedAt: world.status && typeof world.status.updatedAt === 'string' ? world.status.updatedAt : '',
    notice: world.statusUnreadable ? 'The list of events could not be read from Sanity. Press Refresh.' : parts.emptyNotice(world.status),
    download: parts.downloadLine(world.status, now),
    calendars: parts.calendarLines(world.status, world.entries, now),
    rulesReadable: groups !== null,
    pending: pending,
    count: rows.length,
    days: days,
  };
}

// What a click on one event's switch writes: drafts of one event rules, as the Studio Calendars page makes them
export function switchMutations(parts, world, now, key) {
  const { rows, groups } = calendarRows(parts, world, now);
  const row = rows.filter(item => item.key === key)[0];
  if (!row) return { problem: 'That event is not in the list any more. Press Refresh.', status: 404 };
  if (groups === null) return { problem: 'The rules could not be read, so the switch is off. Press Refresh.', status: 502 };
  const state = parts.stateOf(row, groups, now);
  if (!state.canSwitch) return { problem: state.note || 'This event cannot be switched.', status: 400 };

  const plan = parts.planSwitch(row, groups, now);
  const mutations = [];
  plan.make.forEach(rule => mutations.push({ createOrReplace: Object.assign({}, rule, { _id: 'drafts.' + rule._id }) }));
  plan.withdraw.forEach(id => {
    const group = groups.filter(item => item.id === id)[0];
    if (group.published) mutations.push({ createOrReplace: Object.assign(withoutSystemFields(group.published), { _id: 'drafts.' + id, show: false }) });
    else mutations.push({ delete: { id: 'drafts.' + id } });
  });
  if (mutations.length === 0) return { problem: 'There is nothing to change for this event.', status: 400 };
  return { mutations: mutations, row: row };
}

// Publishing the waiting one event rules, and only those: a rule an editor is still writing in the Studio is left alone
export function publishRuleMutations(parts, world) {
  const groups = world.rules === null ? [] : parts.ruleGroups(world.rules);
  const waiting = groups.filter(group => group.draft && group.id.indexOf(parts.oneEventIdPrefix) === 0);
  const mutations = [];
  waiting.forEach(group => {
    mutations.push({ createOrReplace: Object.assign(withoutSystemFields(group.draft), { _id: group.id }) });
    mutations.push({ delete: { id: 'drafts.' + group.id } });
  });
  return mutations;
}

// ----- the news -----

export async function newsAnswer(parts, sanity, now, canWrite) {
  const news = await readFixed(sanity, 'frc-news');
  let settings = null;
  let draft = null;
  try {
    const found = await sanity.queryRaw('*[_id in ["dashboardSettings", "drafts.dashboardSettings"]]');
    const list = Array.isArray(found) ? found : [];
    draft = list.filter(doc => doc._id === 'drafts.dashboardSettings')[0] || null;
    settings = draft || list.filter(doc => doc._id === 'dashboardSettings')[0] || null;
  } catch (error) {
    settings = null;
  }
  return {
    canWrite: canWrite,
    hasSettings: settings !== null,
    isDraft: draft !== null,
    rev: settings ? settings._rev || '' : '',
    enabled: !settings || settings.newsEnabled !== false,
    inTicker: Boolean(settings && settings.newsInTicker === true),
    categories: parts.categoriesOf(settings),
    hiddenLinks: parts.hiddenLinksOf(settings),
    mostHidden: parts.mostHidden,
    lines: parts.readLines(news, now),
    rows: parts.rowsOf(news, settings),
  };
}

// ----- the people the Studio already has -----

function teamName(teams, doc) {
  const id = doc.team && doc.team._ref;
  const team = teams.filter(item => item.id === id)[0];
  return team ? team.name : '';
}

export async function peopleAnswer(sanity, teams) {
  const read = async type => {
    const found = await sanity.query('*[_type == "' + type + '"]');
    return (Array.isArray(found) ? found : []).filter(doc => doc && typeof doc._id === 'string');
  };
  const leaders = await read('person');
  const leads = await read('subteam');
  const common = doc => ({ id: doc._id, team: teamName(teams, doc), show: doc.show !== false, expires: doc.expires || '', order: typeof doc.order === 'number' ? doc.order : null, picture: pictureUrl(sanity.config, doc) });
  return {
    leadership: leaders.map(doc => Object.assign(common(doc), { name: doc.name || '', role: doc.title || '', listedWith: doc.role || '' })),
    teamLeads: leads.map(doc => Object.assign(common(doc), { name: doc.lead || '', department: doc.name || '', members: Array.isArray(doc.members) ? doc.members.length : 0 })),
  };
}
