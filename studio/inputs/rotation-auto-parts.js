// The Automatic panels section of the Rotation board (rotation-board-view.js): a card for each thing the wall adds by itself,
// with the mode of the competition cards and one status line from the frc-status document. It is closed on a phone.
// The words and rules are in tools/rotation-auto.js (docs/rotation-board.md).
//
// It is written without JSX, so it reads as plain JavaScript: h(tag, props, ...children) is React's createElement.

import { createElement } from 'react';
import { Link } from 'sanity/router';
import { addedByWall, autoCards, competitionStatus, modeTitles, otherCards, rowWords, todayText } from '../tools/rotation-auto.js';
import { styles } from './rotation-board-parts.js';

const h = createElement;

const competitionPath = '/structure/competition';

export const autoWords = {
  title: 'Automatic panels',
  intro: 'These are shown by the wall without a row in the list, so they are not in the table. Each says when it comes in.',
  competition: 'Competition cards',
  mode: 'Competition cards mode: ',
  change: 'Change the mode on the Competition page',
  reading: 'Reading the competition data.',
  others: 'Other things the wall adds',
};

export const autoCss = `
.rb-auto { margin: 0 0 24px; border: 1px solid var(--card-border-color, rgba(128, 128, 128, 0.4)); border-radius: 4px; padding: 0 16px; }
.rb-auto > summary { min-height: 44px; display: flex; align-items: center; font-weight: 600; cursor: pointer; }
.rb-auto-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin: 0 0 16px; }
.rb-auto-card { box-sizing: border-box; border: 1px solid var(--card-border-color, rgba(128, 128, 128, 0.4)); border-radius: 4px; padding: 8px 12px; min-width: 0; }
.rb-auto-card h4 { margin: 0 0 4px; font-size: 16px; overflow-wrap: anywhere; }
.rb-auto-card p { margin: 0 0 4px; font-size: 14px; line-height: 1.4; overflow-wrap: anywhere; }
.rb-auto-tag { font-weight: 600; }
`;

export function cardOf(card) {
  return h(
    'div',
    { key: card.id, className: 'rb-auto-card', 'data-auto': card.id },
    h('h4', null, card.title),
    h('p', null, card.shows),
    h('p', null, 'When: ' + card.when),
    h('p', { className: 'rb-auto-tag' }, addedByWall + ' ' + rowWords(card))
  );
}

// state.mode is the mode of Dashboard Settings, state.frc is { read, doc, unreadable } for the frc-status document
export function autoSection(state, now = new Date()) {
  const frc = state.frc || { read: false, doc: null, unreadable: false };
  const mode = state.mode || 'auto';
  const wide = typeof window === 'undefined' || window.innerWidth > 600;

  return h(
    'details',
    { className: 'rb-auto', open: wide, 'data-block': 'automatic' },
    h('summary', null, autoWords.title),
    h('p', { style: styles.muted }, autoWords.intro),
    h('h3', { style: styles.subheading }, autoWords.competition),
    h('p', { style: styles.text, 'data-auto-mode': mode }, autoWords.mode + modeTitles[mode] + '. ',
      h(Link, { href: competitionPath, style: { textDecoration: 'underline' } }, autoWords.change)),
    h('p', { style: styles.text, 'data-auto-status': 'competition' }, frc.read ? competitionStatus(frc.doc, mode, todayText(now), frc.unreadable) : autoWords.reading),
    h('div', { className: 'rb-auto-cards' }, autoCards.map(cardOf)),
    h('h3', { style: styles.subheading }, autoWords.others),
    h('div', { className: 'rb-auto-cards' }, otherCards.map(cardOf))
  );
}
