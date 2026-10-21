// What the Calendar, news and roster blocks of the Content tab show beside the editable lists (collection-doc.js).
//
//   GET  /control/api/content/calendar            the coming BAND events by day, each with its state, from the Mini's calendar-status
//   POST /control/api/content/calendar/switch     { key } hides or shows one event with a draft one event rule, as the Studio does
//   POST /control/api/content/calendar/publish    { confirm } publishes the waiting one event rules
//   GET  /control/api/content/news                the FIRST headlines the Mini read, the news settings and the hidden links
//   GET  /control/api/content/people              the Leadership and Team leads documents of the Studio, read only
//   GET  /control/api/content/photo-source        where the Photo panel gets its pictures, as published, and how the last read of the Drive folder went
//   POST /control/api/content/announcement/post   { text, level, minutes, team } makes a published announcement that starts now
//
// Events are edited in BAND, never here. A switch writes only a calendarFilter draft, and nothing reaches the wall before Publish.

import { randomUUID } from 'node:crypto';
import { Refusal, mount, readJson, send } from '../support/http.js';
import { makeSanity } from '../support/sanity.js';
import { calendarAnswer, calendarParts, newsAnswer, newsParts, peopleAnswer, publishRuleMutations, readCalendarWorld, switchMutations } from '../support/content-read.js';
import { buildPush } from '../support/push.js';
import { readTeams } from './settings-doc.js';

const noToken = 'SANITY_WRITE_TOKEN is not set on the Teletraan computer. Add it in Settings, Keys.';

async function guarded(words, run) {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Refusal) throw error;
    throw new Refusal(502, words);
  }
}

export function register(router, ctx) {
  mount(router, ctx, 'GET', '/content/calendar', async (req, res) => {
    const sanity = makeSanity(ctx);
    const parts = await calendarParts(ctx);
    const world = await readCalendarWorld(sanity);
    send(res, 200, calendarAnswer(parts, world, new Date(), sanity.hasToken()));
  });

  mount(router, ctx, 'POST', '/content/calendar/switch', async (req, res) => {
    const body = await readJson(req);
    if (typeof body.key !== 'string' || body.key === '') throw new Refusal(400, 'Pick an event first.');
    const sanity = makeSanity(ctx);
    if (!sanity.hasToken()) throw new Refusal(503, noToken);
    const parts = await calendarParts(ctx);
    const now = new Date();
    const planned = switchMutations(parts, await readCalendarWorld(sanity), now, body.key);
    if (planned.problem) throw new Refusal(planned.status, planned.problem);
    await guarded('The Teletraan computer could not reach Sanity. Check its internet connection, then press the switch again.', () => sanity.mutate(planned.mutations));
    ctx.log('calendar event switched in a draft rule: ' + planned.row.calendarName);
    send(res, 200, Object.assign({ ok: true }, calendarAnswer(parts, await readCalendarWorld(sanity), new Date(), true)));
  });

  mount(router, ctx, 'POST', '/content/calendar/publish', async (req, res) => {
    const body = await readJson(req);
    if (body.confirm !== true) throw new Refusal(400, 'Confirm to publish. Nothing was published.');
    const sanity = makeSanity(ctx);
    if (!sanity.hasToken()) throw new Refusal(503, noToken);
    const parts = await calendarParts(ctx);
    const mutations = publishRuleMutations(parts, await readCalendarWorld(sanity));
    if (mutations.length === 0) throw new Refusal(409, 'No event change is waiting to be published.');
    await sanity.mutate(mutations);
    ctx.log('calendar event rules published: ' + mutations.length / 2);
    send(res, 200, Object.assign({ ok: true }, calendarAnswer(parts, await readCalendarWorld(sanity), new Date(), true)));
  });

  mount(router, ctx, 'GET', '/content/news', async (req, res) => {
    const sanity = makeSanity(ctx);
    const parts = await newsParts(ctx);
    send(res, 200, await guarded('The Teletraan computer could not read the news from Sanity. Press Refresh.', () => newsAnswer(parts, sanity, new Date(), sanity.hasToken())));
  });

  mount(router, ctx, 'GET', '/content/people', async (req, res) => {
    const sanity = makeSanity(ctx);
    const teams = await readTeams(ctx);
    send(res, 200, await guarded('The Teletraan computer could not read the Leadership and Team leads from Sanity. Press Refresh.', () => peopleAnswer(sanity, teams)));
  });

  // Read only: the source is changed in Settings, All settings. The folder is shown by the end of its id, never by a file name,
  // because the Mini does not keep names (they can hold last names).
  mount(router, ctx, 'GET', '/content/photo-source', async (req, res) => {
    const sanity = makeSanity(ctx);
    const found = await guarded('The Teletraan computer could not read the Photos setting from Sanity. Press Refresh.', () => sanity.query('*[_id in ["dashboardSettings", "status-mini"]]{ _id, photoSource, photoDriveFolder, photosDriveAt, photosDriveCount, photosDriveState }'));
    const byId = id => (Array.isArray(found) ? found : []).filter(doc => doc && doc._id === id)[0] || {};
    const settings = byId('dashboardSettings');
    const status = byId('status-mini');
    const source = ['upload', 'drive', 'both'].includes(settings.photoSource) ? settings.photoSource : 'upload';
    const folder = /^(?:https:\/\/drive\.google\.com\/drive\/(?:u\/[0-9]+\/)?folders\/)?([A-Za-z0-9_-]{10,100})(?:[/?#].*)?$/.exec(String(settings.photoDriveFolder || '').trim());
    send(res, 200, {
      source: source,
      folderEnd: folder ? folder[1].slice(-6) : '',
      read: status.photosDriveAt ? { at: status.photosDriveAt, count: Number(status.photosDriveCount) || 0, state: status.photosDriveState || '' } : null,
    });
  });

  // The shortcut of the Announcements block: the text, the level and the minutes are held to the same rules as the push of the
  // Display tab (support/push.js), but the result is an announcement of its own, so it never replaces another one. It is published
  // at once, because Post now means now.
  mount(router, ctx, 'POST', '/content/announcement/post', async (req, res) => {
    const body = await readJson(req);
    const sanity = makeSanity(ctx);
    if (!sanity.hasToken()) throw new Refusal(503, noToken);
    let teamId = '';
    if (typeof body.team === 'string' && body.team !== '') {
      const team = (await readTeams(ctx)).find(item => item.id === body.team);
      if (!team) throw new Refusal(400, 'That team has no document in the Studio yet. Pick Both teams.');
      teamId = team.id;
    }
    const built = buildPush('announcement', { text: body.text, level: body.level, minutes: body.minutes }, new Date(), teamId);
    const notice = Object.assign({}, built.notice, { _id: 'announcement-' + randomUUID() });
    await guarded('The Teletraan computer could not reach Sanity. Check its internet connection, then press the button again.', () => sanity.mutate([{ create: notice }]));
    ctx.log('announcement posted now on the Control page: ' + notice._id);
    send(res, 200, { ok: true, id: notice._id, start: notice.start, end: notice.end });
  });
}
