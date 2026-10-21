// The Now on the wall card of Status. It only shows. The card refreshes every 10 seconds, the length of the dashboard's own report.
// The Live preview card is in preview.js. The buttons that change the wall are on the Display tab (push.js).

import { api, useStyles } from './api.js';
import { heldLine, nowCardHtml } from './render.js';

// The line that says who decides what the wall shows: the requests that run now, drawn again every 5 seconds so a
// request that ended goes away. options is the answer of GET request. Returns { set(requests), stop() }.
function makeHeld(heldBox, options) {
  const data = options.ok && options.data ? options.data : {};
  const names = { theme: data.themeNames || {}, view: {}, panel: data.panelNames || {} };
  (data.views || []).forEach(view => { names.view[view.key] = view.name; });
  let requests = data.requests || null;
  const draw = () => {
    const words = heldLine(requests, names, new Date());
    heldBox.textContent = words;
    heldBox.dataset.held = words === 'Following the schedule.' ? 'no' : 'yes';
  };
  draw();
  const timer = setInterval(draw, 5000);
  return { set(next) { requests = next; draw(); }, stop() { clearInterval(timer); } };
}

// Status: the line of who decides, and the card of the wall. Nothing here writes. Returns the function that stops it.
export async function mountCard(boxes) {
  useStyles();
  const { cardBox, heldBox } = boxes;
  let left = false;
  let timer = null;
  let held = null;
  const leave = () => { left = true; clearInterval(timer); if (held) held.stop(); };

  // Only the card is redrawn, and only when its words changed, so the scroll position stays
  let last = '';
  async function refresh() {
    const [answer, asked] = await Promise.all([api('GET', '/now'), api('GET', '/request')]);
    if (left) return;
    if (held && asked.ok && asked.data) held.set(asked.data.requests);
    const html = nowCardHtml(answer.ok ? answer.data : { message: answer.error });
    if (html === last) return;
    last = html;
    cardBox.innerHTML = html;
  }
  held = makeHeld(heldBox, await api('GET', '/request'));
  if (left) return leave;
  await refresh();
  if (!left) timer = setInterval(refresh, 10000);
  return leave;
}
