// The presentations of the Google Drive folder, for the control service (routes/decks.js and routes/now.js).
// computer/scripts/decks-sync.sh keeps the list in the data folder. A pick made on the control page is kept
// here, in memory, and handed to the screen with the answer to its next report (routes/now.js), so it reaches
// the screen of this computer only and needs no key.

import fs from 'node:fs';
import path from 'node:path';
import { tidyDeckList, tidyDeckRequest } from '../../dashboard/core/decks.js';

// A pick is handed over for this long. The screen plays it once (shouldPlayDeck in dashboard/core/decks.js).
export const pickSeconds = 60;

// decks/manifest.json of the data folder, tidied. A file that is missing or cannot be read is the empty list.
export function readDeckList(ctx) {
  try {
    return tidyDeckList(JSON.parse(fs.readFileSync(path.join(ctx.dataDir || '', 'decks', 'manifest.json'), 'utf8')));
  } catch (error) {
    return tidyDeckList(null);
  }
}

export function keepPick(ctx, id, now) {
  if (!ctx.state) ctx.state = {};
  ctx.state.deckPick = { id: id, requestedAt: now.toISOString() };
  return ctx.state.deckPick;
}

// The pick to hand to the screen, or null when there is none or it is too old
export function pickFor(ctx, now) {
  const pick = tidyDeckRequest(ctx.state && ctx.state.deckPick);
  if (pick.id === '') return null;
  return now.getTime() - Date.parse(pick.requestedAt) <= pickSeconds * 1000 ? pick : null;
}
