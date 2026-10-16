// How the header of a large panel is shared between its title, the line that ends the colored tab (core/plate.js
// draws it) and the words at the right end. The numbers are pixels of the 1152 wide panel that every page is written
// for. The stylesheets of the panels repeat the two rooms as max-width, so change them together, and
// tests/title-plate.test.mjs holds them to the shapes of the frames.
//
// The title starts titleLeft in, and has titleRoom: it stops 16 short of the metal of the line, which is at its
// leftmost in the notch of Original (x = 756, with 8 of metal). The words have wordsRoom: they start 14 past the
// notch, its metal and its shadow (x = 796 and 13 more), and end at x = 1112, where the 40 of padding begins.
// LEADERSHIP at 96 px is the widest title that is always that size, 652 wide, and PROGRAMMING TEAM is the widest
// department, 685 at 60 px and 639 at 56. The widest Daily Agenda date, MON MAR 29, is 288 wide.

export const titleLeft = 76;
export const titleRoom = 656;
export const titleSpare = 8; // a Monday title keeps this much of its room free
export const wordsRoom = 289;

// The slashes at the right end of a header, with the gap before them. A seasonal pack's mark is no wider.
export const markRoom = 24 + 54;

// True when words that are this wide have room beside the slashes. The slashes go first: a header whose
// words need the room has none.
export function markFits(width) {
  return width + markRoom <= wordsRoom;
}
