// Puts the cards on the screen when the address has ?competition=1 (core/competition-address.js). It holds
// the data for ten years, which no one waits for: the screen is a try-out and is not left like that.

import { sampleFolder } from '../config.js';
import { fixtureFile, fixtureFrc, frcForEvent, frcInPhase } from './competition-address.js';
import { previewCompetition, todayOf } from './competition.js';
import { tidyFrc } from './frc.js';

const tenYears = 10 * 365 * 24 * 60 * 60 * 1000;

// phase says the newer cards are asked for. The placeholder fixture is a past event with none of their data, so then the
// sample content is used in its place.
async function readFixture(key, phase) {
  try {
    const response = await fetch(sampleFolder + fixtureFile, { cache: 'no-store' });
    if (!response.ok) return null;

    const fixture = await response.json();
    if (phase && fixture && fixture.placeholder === true) return null;

    const frc = fixtureFrc(fixture, key);
    return frc ? tidyFrc(frc) : null;
  } catch (error) {
    console.error('Could not read ' + fixtureFile, error);
    return null;
  }
}

// ask is { event }. getContent() returns the newest content, and sample says the page shows the sample content.
export async function startCompetitionAddress(ask, getContent, sample) {
  let frc = sample ? await readFixture(ask.event, ask.phase) : null;

  if (!frc) {
    const content = getContent();
    frc = frcForEvent(content && content.frc ? content.frc : null, ask.event);
  }
  if (!frc) {
    console.error('?competition=1 has no competition data to show');
    return;
  }

  if (ask.phase) frc = frcInPhase(frc, ask.phase, todayOf(getContent()));
  previewCompetition(frc, Date.now() + tenYears);
}
