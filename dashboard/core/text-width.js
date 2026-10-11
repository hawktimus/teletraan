// How wide a line of capitals is in the display font (Tomorrow), for a place that has to decide before
// it draws whether two things fit side by side, such as the header of a Monday card (core/monday-draw.js).
// The numbers are the advance widths of the font in thousandths of the size, without kerning, which
// only makes a word narrower, so a line that fits by this count fits on the screen.

const advances = {
  700: {
    digits: [692, 478, 683, 695, 709, 708, 715, 603, 696, 730],
    space: 246,
    letters: { A: 736, B: 747, C: 670, D: 744, E: 680, F: 639, G: 818, H: 765, I: 420, J: 681, K: 692, L: 610, M: 885, N: 766, O: 754, P: 689, Q: 754, R: 742, S: 722, T: 609, U: 777, V: 708, W: 1010, X: 702, Y: 678, Z: 680 },
  },
  600: {
    digits: [682, 455, 672, 668, 672, 666, 695, 569, 689, 699],
    space: 239,
    letters: { A: 711, B: 727, C: 673, D: 732, E: 657, F: 611, G: 737, H: 749, I: 408, J: 635, K: 686, L: 591, M: 892, N: 752, O: 729, P: 657, Q: 729, R: 718, S: 696, T: 587, U: 745, V: 697, W: 964, X: 683, Y: 669, Z: 669 },
  },
};

// The middle dot, which is a narrow mark with room each side. Any other character is counted as wide as a
// wide capital, so the answer is never too small.
const dot = 400;
const unknown = 800;

// The width in pixels of text at a size. weight is 600 or 700.
export function textWidth(text, weight, size) {
  const table = advances[weight] || advances[700];

  return Array.from(String(text)).reduce((sum, character) => {
    const advance = /\d/.test(character) ? table.digits[Number(character)] : character === ' ' ? table.space : character === '·' ? dot : table.letters[character] || unknown;
    return sum + advance / 1000 * size;
  }, 0);
}
