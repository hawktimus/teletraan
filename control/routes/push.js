// The temporary pushes of the Display tab (docs/control-page.md, "Display"). A push holds a theme, a view, a panel, a pause,
// an announcement or a hidden transition on the wall for 1 to 60 minutes, and the wall returns to its schedule by itself.
// These write the fields the Status buttons write (support/requests.js) and the same announcement document type, with the
// same write helper as the other routes. The PIN check is the one every route has.
//
//   GET  /control/api/push          what is pushed now, the schedule of the week and the choices
//   POST /control/api/push          { kind, minutes, ... } starts one push (support/push.js lists the kinds)
//   POST /control/api/push/cancel   { kind } ends one push
//   POST /control/api/push/reset    ends every push at once and the wall returns to the schedule

import { Refusal, mount, readJson, send } from '../support/http.js';
import { makeSanity } from '../support/sanity.js';
import { motionOf, themeOf } from '../support/display.js';
import { themeIds, themeNames, viewKeys, viewNames } from '../support/requests.js';
import { buildCancel, buildPush, buildReset, endNoticeMutation, noticeId, noticeMutation, pushKinds, pushMinutes, pushesOf, settingsMutations, weekdayOf } from '../support/push.js';
import { checkHiddenOn } from './request.js';
import { hiddenTransitions } from '../../dashboard/core/hidden-transitions.js';

const stateQuery = '{ "settings": *[_id == "dashboardSettings"][0] { holdPanel, showView, previewTheme, pauseRotation, hiddenRequest, themeByWeekday, generalViewTitle, transitionSeconds }, ' +
  '"zone": *[_id == "theme"][0].timeZone, ' +
  '"notice": *[_id == "' + noticeId + '"][0] { text, start, end, level, "team": team->code }, ' +
  '"teams": *[_type == "team"] | order(order asc) { _id, code, name, shortName } }';

async function readState(ctx) {
  try {
    return (await makeSanity(ctx).query(stateQuery)) || {};
  } catch (error) {
    throw new Refusal(502, 'The Teletraan computer could not read the wall settings from Sanity. Check its internet connection, then try again.');
  }
}

// The names of the views. The two team views take the name of their Team document, as the Status tab does.
function viewList(teams) {
  const named = {};
  (Array.isArray(teams) ? teams : []).forEach(team => {
    if (team && typeof team.code === 'string') named[team.code] = team.shortName || team.name || team.code;
  });
  return viewKeys.map(key => ({ key: key, name: named[key] || viewNames[key] }));
}

function answerFor(found, now, ctx) {
  const settings = found.settings || {};
  const zone = found.zone || '';
  const theme = themeOf(settings);
  return {
    pushes: pushesOf(settings, found.notice, now),
    today: weekdayOf(zone, now),
    timeZone: zone,
    week: theme.themeByWeekday,
    themes: themeIds.map(id => ({ value: id, title: themeNames[id] })),
    views: viewList(found.teams),
    teams: (found.teams || []).map(team => ({ code: team.code, name: team.shortName || team.name || team.code })),
    hiddenKinds: Object.keys(hiddenTransitions).map(id => ({ value: id, title: hiddenTransitions[id].name })),
    holds: pushMinutes,
    motion: motionOf(settings).motion,
    serverTime: now.toISOString(),
    canWrite: makeSanity(ctx).hasToken(),
  };
}

export function register(router, ctx) {
  mount(router, ctx, 'GET', '/push', async (req, res) => {
    send(res, 200, answerFor(await readState(ctx), new Date(), ctx));
  });

  mount(router, ctx, 'POST', '/push', async (req, res) => {
    const body = await readJson(req);
    if (!pushKinds.includes(body.kind)) throw new Refusal(400, 'The Teletraan computer does not know that push.');
    const sanity = makeSanity(ctx);
    const now = new Date();

    let teamId = '';
    if (body.kind === 'announcement' && typeof body.team === 'string' && body.team !== '') {
      const teams = (await readState(ctx)).teams || [];
      const team = teams.find(item => item.code === body.team);
      if (!team) throw new Refusal(400, 'That team has no document in the Studio yet. Pick Both teams.');
      teamId = team._id;
    }
    const built = buildPush(body.kind, body, now, teamId);
    if (body.kind === 'hidden') await checkHiddenOn(ctx);

    await sanity.mutate(built.notice ? [noticeMutation(built.notice)] : settingsMutations(built));
    ctx.log('display push: ' + body.kind);
    // The hidden transition is one shot and has no end time
    const field = built.set ? Object.values(built.set)[0] : null;
    send(res, 200, { ok: true, kind: body.kind, until: built.notice ? built.notice.end : (field && field.until) || '' });
  });

  mount(router, ctx, 'POST', '/push/cancel', async (req, res) => {
    const body = await readJson(req);
    const built = buildCancel(body.kind, new Date());
    if (built.endNotice) {
      // Nothing to end when there is no document: say so and write nothing
      const found = await readState(ctx);
      if (!found.notice) return send(res, 200, { ok: true, kind: body.kind, nothing: true });
      await makeSanity(ctx).mutate([endNoticeMutation(built.endNotice)]);
    } else {
      await makeSanity(ctx).mutate(settingsMutations(built));
    }
    ctx.log('display push ended: ' + body.kind);
    send(res, 200, { ok: true, kind: body.kind });
  });

  mount(router, ctx, 'POST', '/push/reset', async (req, res) => {
    const sanity = makeSanity(ctx);
    const mutations = settingsMutations(buildReset());
    const found = await readState(ctx);
    if (found.notice && Date.parse(found.notice.end) > Date.now()) mutations.push(endNoticeMutation(new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')));
    await sanity.mutate(mutations);
    ctx.log('display pushes reset to the schedule');
    send(res, 200, { ok: true });
  });
}
