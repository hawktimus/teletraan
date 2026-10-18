// The buttons of the Now showing tab. POST /control/api/request { action, ... } writes the request
// into Dashboard Settings, where the screen reads it (support/requests.js lists the actions and
// what each one writes). GET /control/api/request gives the tab its choices: the views with the
// names of the Team documents, the themes, the panels that can be held, the announcements that are
// live and the talks booked for the next day.

import { Refusal, mount, readJson, send } from '../support/http.js';
import { makeSanity } from '../support/sanity.js';
import { actions, buildRequest, mutationsFor, themeIds, themeNames, viewKeys, viewNames as plainViewNames } from '../support/requests.js';
import { gridPanels, registryText } from '../support/now-rows.js';

const optionsQuery = '{ "teams": *[_type == "team"] | order(order asc) { code, name, shortName, number }, ' +
  '"live": count(*[_type == "announcement" && dateTime(start) <= dateTime(now()) && dateTime(end) > dateTime(now())]), ' +
  '"talks": *[_type == "presentation" && status == "scheduled" && dateTime(start) > dateTime(now()) - 14400 && dateTime(start) < dateTime(now()) + 86400] | order(start asc) { name, topic, start }, ' +
  '"requests": *[_id == "dashboardSettings"][0] { holdPanel, showView, previewTheme, pauseRotation } }';

// The names of the four views. The two team views take the name of their Team document.
function viewNames(teams) {
  const named = {};
  (Array.isArray(teams) ? teams : []).forEach(team => {
    if (team && typeof team.code === 'string') named[team.code] = team.shortName || team.name || team.code;
  });
  return viewKeys.map(key => ({ key: key, name: named[key] || plainViewNames[key] }));
}

// The screen ignores the test while Run presentations is off, so the page says so instead of reporting a send that does nothing.
// A read that fails is not a reason to stop: the write will say what is wrong.
async function checkPresentationsOn(ctx) {
  let enabled;
  try {
    enabled = await makeSanity(ctx).query('*[_id == "dashboardSettings"][0].presentationsEnabled');
  } catch (error) {
    return;
  }
  if (enabled === false) {
    throw new Refusal(409, 'Run presentations is switched off, so the screen would ignore the test. Switch it on under Dashboard Settings, Presentations in the Studio, publish, then press the button again.');
  }
}

export function register(router, ctx) {
  mount(router, ctx, 'GET', '/request', async (req, res) => {
    let data = null;
    try {
      data = await makeSanity(ctx).query(optionsQuery);
    } catch (error) {
      data = null;
    }
    const found = data || {};

    send(res, 200, {
      actions: actions,
      views: viewNames(found.teams),
      themes: themeIds,
      themeNames: themeNames,
      panels: gridPanels(registryText(ctx)),
      liveAnnouncements: typeof found.live === 'number' ? found.live : null,
      talks: Array.isArray(found.talks) ? found.talks : [],
      requests: found.requests || null,
      canWrite: makeSanity(ctx).hasToken(),
    });
  });

  mount(router, ctx, 'POST', '/request', async (req, res) => {
    const body = await readJson(req);
    const built = buildRequest(body.action, body, new Date());
    if (body.action === 'presentation-test') await checkPresentationsOn(ctx);
    await makeSanity(ctx).mutate(mutationsFor(built));
    const until = (built.set && ((built.set.previewTheme && built.set.previewTheme.until) || (built.set.showView && built.set.showView.until))) || '';
    send(res, 200, { ok: true, action: body.action, until: until });
  });
}
