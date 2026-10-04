// Panels the editors build from blocks. Each time this one comes round it
// shows the next custom panel in the list. About three blocks fit.

import { cardMarkup, rowBarMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { visibleItems } from '../../core/content.js';
import { timeLeft, parseLocalDateTime } from '../../core/time.js';
import { makeTurns } from '../../core/turns.js';

const MAX_LIST_ITEMS = 5;

// The width of every block, and the height of the blocks that sit on a card.
// custom.css has the same numbers. Change them together.
const BLOCK_WIDTH = 1056;
const CARD_HEIGHT = 184;
const IMAGE_HEIGHT = 220;

const nextCustomPanel = makeTurns();

// The markup for one block, or '' when the block is of a type we do not
// know or is missing what it needs. Those blocks are left out.
function blockMarkup(block, now) {
  if (!block) return '';

  switch (block.type) {
    case 'heading': return headingBlock(block);
    case 'text': return textBlock(block);
    case 'stat': return statBlock(block);
    case 'list': return listBlock(block);
    case 'image': return imageBlock(block);
    case 'progress': return progressBlock(block);
    case 'countdown': return countdownBlock(block, now);
    default: return '';
  }
}

function blocksFor(customPanel, now) {
  const blocks = Array.isArray(customPanel.blocks) ? customPanel.blocks : [];
  return blocks.map(block => blockMarkup(block, now)).filter(markup => markup !== '');
}

function panelsFor(content, now) {
  return visibleItems(content.customPanels, now).filter(customPanel => blocksFor(customPanel, now).length > 0);
}

export function hasContent(content) {
  return panelsFor(content, new Date()).length > 0;
}

export function mount(host, content) {
  const now = new Date();
  const customPanel = nextCustomPanel(panelsFor(content, now));
  const blocks = customPanel ? blocksFor(customPanel, now) : [];

  host.innerHTML = `
    <section class="page custom">
      <div class="header">
        <h2 class="title" data-slat="title">${escapeHtml(customPanel && customPanel.title)}</h2>
        <div data-slat="tag">${doubleSlash()}</div>
      </div>

      <div class="blocks">${blocks.join('')}</div>
    </section>`;

  // a picture that cannot be loaded is left out, and the blocks below move up
  host.querySelectorAll('.block-image img').forEach(image => {
    image.addEventListener('error', () => image.parentNode.remove());
  });
}

// A heading has a thin metal bar under it
function headingBlock(block) {
  if (!hasText(block.text)) return '';

  return `
    <div class="block block-heading" data-slat="item">
      <div class="heading-text">${escapeHtml(block.text)}</div>
      ${rowBarMarkup(BLOCK_WIDTH)}
    </div>`;
}

function textBlock(block) {
  if (!hasText(block.text)) return '';
  return `<div class="block block-text" data-slat="item">${escapeHtml(block.text)}</div>`;
}

function statBlock(block) {
  if (!hasText(block.value) && !hasText(block.label)) return '';

  return `
    <div class="block block-stat" data-slat="item">
      ${cardMarkup(BLOCK_WIDTH, CARD_HEIGHT)}
      <div class="card-text">
        <div class="stat-value">${escapeHtml(block.value)}</div>
        <div class="stat-label">${escapeHtml(block.label)}</div>
      </div>
    </div>`;
}

function listBlock(block) {
  const items = (Array.isArray(block.items) ? block.items : [])
    .filter(item => typeof item === 'string' && hasText(item))
    .slice(0, MAX_LIST_ITEMS);
  if (items.length === 0) return '';

  const lines = items.map(item => `
      <div class="list-item">
        <span class="list-marker">${doubleSlash()}</span>
        <span class="list-text">${escapeHtml(item)}</span>
      </div>`).join('');
  return `<div class="block block-list" data-slat="item">${lines}</div>`;
}

function imageBlock(block) {
  if (!hasText(block.address)) return '';

  // The picture sits inside a card, so its edge is metal like the others
  return `
    <div class="block block-image" data-slat="item">
      ${cardMarkup(BLOCK_WIDTH, IMAGE_HEIGHT)}
      <img src="${escapeHtml(block.address)}" alt="">
    </div>`;
}

// A whole number from 0 to 100. Anything that is not a number counts as 0.
function percentOf(value) {
  const number = parseFloat(value);
  if (isNaN(number)) return 0;
  return Math.min(100, Math.max(0, Math.round(number)));
}

function progressBlock(block) {
  if (!hasText(block.label) && !hasText(block.percent)) return '';
  const percent = percentOf(block.percent);

  return `
    <div class="block block-progress" data-slat="item">
      <div class="progress-top">
        <div class="progress-label">${escapeHtml(block.label)}</div>
        <div class="progress-percent">${percent}%</div>
      </div>
      <div class="progress-track"><div class="progress-fill bar" style="width: ${percent}%;"></div></div>
    </div>`;
}

// 1 DAY, 2 DAYS
function unit(count, word) {
  return count + ' ' + word + (count === 1 ? '' : 'S');
}

// Worked out once, when the panel is built, which is close enough for a
// panel that is on screen for a few seconds
function countdownBlock(block, now) {
  const target = parseLocalDateTime(block.target);
  if (!target) return '';

  const left = timeLeft(target, now);
  const time = left.total === 0 ? 'PASSED' : unit(left.days, 'DAY') + ' ' + unit(left.hours, 'HR');

  return `
    <div class="block block-countdown" data-slat="item">
      ${cardMarkup(BLOCK_WIDTH, CARD_HEIGHT)}
      <div class="card-text">
        <div class="countdown-label">${escapeHtml(block.label)}</div>
        <div class="countdown-time">${time}</div>
      </div>
    </div>`;
}
