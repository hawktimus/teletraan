// The Presentations section of the Show area: the decks of the Google Drive folder, and the button that
// plays one on the TV (docs/presentations-drive.md).
//
//   GET  /control/api/decks        the list the Teletraan computer keeps, with a line for each deck
//   POST /control/api/decks/play   { id } hands the pick to the screen with its next report (routes/now.js)
//
// The pick never goes through Sanity, so it plays on the screen of this computer and on no other.

import { Refusal, mount, readJson, send } from '../support/http.js';
import { makeSanity } from '../support/sanity.js';
import { keepPick, readDeckList } from '../support/decks.js';
import { canPlay, checkedText, deckNote, findDeck, listNote } from '../../dashboard/core/decks.js';
import { reportSeconds } from '../../dashboard/core/now-report-parts.js';

// The screen reports every reportSeconds. One that has been quiet for four reports would not get the pick.
const quietSeconds = reportSeconds * 4;

// true, false, or null when Sanity could not be asked. A read that fails is not a reason to stop.
async function presentationsOn(ctx) {
  try {
    return (await makeSanity(ctx).query('*[_id == "dashboardSettings"][0].presentationsEnabled')) !== false;
  } catch (error) {
    return null;
  }
}

function wallReporting(ctx, now) {
  const seen = ctx.state && ctx.state.wallSeen;
  return Boolean(seen && seen.received && now.getTime() - seen.received.getTime() <= quietSeconds * 1000);
}

export function register(router, ctx) {
  mount(router, ctx, 'GET', '/decks', async (req, res) => {
    const now = new Date();
    const list = readDeckList(ctx);
    send(res, 200, {
      state: list.state,
      note: listNote(list),
      checked: checkedText(list, now),
      decks: list.decks.map(deck => ({ id: deck.id, name: deck.name, kind: deck.kind, note: deckNote(deck), canPlay: canPlay(deck) })),
      enabled: await presentationsOn(ctx),
      wallReporting: wallReporting(ctx, now),
    });
  });

  mount(router, ctx, 'POST', '/decks/play', async (req, res) => {
    const body = await readJson(req);
    const deck = findDeck(readDeckList(ctx), typeof body.id === 'string' ? body.id : '');
    if (deck === null) throw new Refusal(404, 'That presentation is not in the folder any more. Press Refresh.');
    if (!canPlay(deck)) throw new Refusal(409, 'That presentation is not ready yet. Wait until it shows its number of slides.');
    if ((await presentationsOn(ctx)) === false) {
      throw new Refusal(409, 'Run presentations is switched off, so the screen would not start it. Switch it on under Dashboard Settings, Presentations in the Studio, publish, then press the button again.');
    }
    const now = new Date();
    if (!wallReporting(ctx, now)) throw new Refusal(409, 'The screen is not reporting to this computer right now, so it would not get the pick. Check the TV and try again.');

    keepPick(ctx, deck.id, now);
    send(res, 200, { ok: true, name: deck.name, withinSeconds: reportSeconds });
  });
}
