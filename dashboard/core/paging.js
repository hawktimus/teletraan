// How long a card of many pages is held in one visit (core/schedule-run.js). Nothing here touches the page, so a test can
// run it.

// A card with many pages (the Events list, the Monday cards) is held for at most this many pages in one visit, and for at
// most this many seconds in all. Without a limit a list of ten pages held the frame for five minutes while the block clock
// of its row ran out.
export const maxPagedPages = 3;
export const maxPanelSeconds = 90;
const shortestHoldMs = 1000;

// How many of a card's pages one visit holds: all of them up to maxPagedPages, and no more than fit in maxPanelSeconds when
// each is held for heldMs. Always at least the first page.
export function pagesToHold(pages, heldMs) {
  const byTime = Math.floor(maxPanelSeconds * 1000 / Math.max(Number(heldMs) || 0, shortestHoldMs));
  return Math.max(1, Math.min(Math.floor(pages) || 1, maxPagedPages, byTime));
}
