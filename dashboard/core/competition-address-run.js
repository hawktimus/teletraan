// Puts the cards on the screen when the address has ?competition=1 (core/competition-address.js). It holds
// the data for ten years, which no one waits for: the screen is a try-out and is not left like that.

import { sampleFolder } from '../config.js';
import { fixtureFile, fixtureFrc, frcForEvent } from './competition-address.js';
import { previewCompetition } from './competition.js';
import { tidyFrc } from './frc.js';

const tenYears = 10 * 365 * 24 * 60 * 60 * 1000;

async function readFixture(key) {
  try {
    const response = await fetch(sampleFolder + fixtureFile, { cache: 'no-store' });
    if (!response.ok) return null;

    const frc = fixtureFrc(await response.json(), key);
    return frc ? tidyFrc(frc) : null;
  } catch (error) {
    console.error('Could not read ' + fixtureFile, error);
    return null;
  }
}

// ask is { event }. getContent() returns the newest content, and sample says the page shows the sample content.
export async function startCompetitionAddress(ask, getContent, sample) {
  let frc = sample ? await readFixture(ask.event) : null;

  if (!frc) {
    const content = getContent();
    frc = frcForEvent(content && content.frc ? content.frc : null, ask.event);
  }
  if (!frc) {
    console.error('?competition=1 has no competition data to show');
    return;
  }

  previewCompetition(frc, Date.now() + tenYears);
}
