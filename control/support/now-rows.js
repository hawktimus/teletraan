// The first rows of the data behind a panel, for the Now on the wall card. They come from the
// published dataset, the way the dashboard reads it. Panels that draw from files on the Mini
// (events, weather) or from the competition feed have no rows here.

import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './sanity.js';

// The topic of a panel is the word registry.js gives it. Each topic has one question to Sanity that
// gives a few plain lines of text.
const questions = {
  tasks: '*[_type == "task" && show == true] | order(_updatedAt desc)[0...3].title',
  monday: '*[_type == "task" && source == "monday" && show == true] | order(_updatedAt desc)[0...3].title',
  plan: '*[_type == "plan"] | order(date desc)[0...1].heading',
  subteams: '*[_type == "subteam"] | order(order asc)[0...3].name',
  sponsors: '*[_type == "sponsor"] | order(order asc)[0...3].name',
  people: '*[_type == "person"] | order(order asc)[0...3].name',
  custom: '*[_type == "customPanel"][0...3].title',
};

export function topicsFrom(registryText) {
  const topics = {};
  const pattern = /\{\s*id:\s*'([a-z0-9-]+)'[^}]*?topic:\s*'([a-z]+)'/g;
  let match;
  while ((match = pattern.exec(registryText))) topics[match[1]] = match[2];
  return topics;
}

export function gridPanels(registryText) {
  const found = [];
  const pattern = /\{\s*id:\s*'([a-z0-9-]+)'\s*,\s*region:\s*'grid1'/g;
  let match;
  while ((match = pattern.exec(registryText))) found.push(match[1]);
  return found;
}

export function registryText(ctx) {
  try {
    return fs.readFileSync(path.join(repoRoot(ctx), 'dashboard', 'registry.js'), 'utf8');
  } catch (error) {
    return '';
  }
}

export function questionFor(panel, topics) {
  const topic = topics[panel];
  return topic && questions[topic] ? questions[topic] : '';
}

// Up to three lines of text, or none
export async function rowsFor(panel, ctx, sanity) {
  const question = questionFor(panel, topicsFrom(registryText(ctx)));
  if (question === '') return [];

  const result = await sanity.query(question);
  return (Array.isArray(result) ? result : [])
    .filter(item => typeof item === 'string' && item.trim() !== '')
    .slice(0, 3)
    .map(item => item.trim().slice(0, 80));
}
