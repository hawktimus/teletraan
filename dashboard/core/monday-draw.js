// What the three Monday cards share: the page with its header, and the name of the team in it. They are
// plain functions that return markup, so tools/test-monday-cards.mjs can run them. The sentence a card says
// when it has nothing to show, the text in a chart and the age of the data are the competition cards' too
// (core/competition-draw.js). A card is a panel in panels/monday-*, and core/monday.js decides what it draws.

import { doubleSlash } from './marks.js';
import { escapeHtml } from './text.js';
import { wantedTeam } from './teams.js';

// The name of the team on the screen, in capitals, the one its items follow. The team's short name,
// PRIME or NOVA, which is the one the Studio sends for it.
export function teamNameShown() {
  const team = wantedTeam();
  return String(team.shortName || team.name || team.code).trim().toUpperCase();
}

// The longest name that fits at the size of a heading beside TEAM and the name of the team. A longer
// name is drawn smaller (the class lead-long in the stylesheet of the card).
const headingFits = 7;

// The title of a lead's page: the lead's name in capitals at the size of a heading, and TEAM and the
// team's name after it in the small yellow type of a tag. Read together it is BUILD TEAM · PRIME. A name
// that already ends in TEAM does not get a second one.
export function leadTitleMarkup(leadName, teamName) {
  const lead = String(leadName).trim().toUpperCase();
  const word = /(^|\s)TEAM$/.test(lead) ? '' : 'TEAM ';
  const size = lead.length > headingFits ? 'lead lead-long' : 'lead';

  return `<span class="${size}">${escapeHtml(lead)}</span> <span class="side">${word}· ${escapeHtml(teamName)}</span>`;
}

// The page of a card: the header, with the title already as markup and the tag, and the body. The body is one slat.
export function pageMarkup(cardId, titleMarkup, tag, inner) {
  const tagText = tag ? `<span class="tag-text">${escapeHtml(tag)}</span>` : '';

  return `
    <section class="page monday ${cardId}">
      <div class="header">
        <h2 class="title" data-slat="title">${titleMarkup}</h2>
        <div class="tag" data-slat="tag">${tagText}${doubleSlash()}</div>
      </div>

      <div class="body" data-slat="item">${inner}</div>
    </section>`;
}
