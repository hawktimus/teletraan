// Builds the plates that panels are made from: flat purple shapes with a
// polished metal edge. Measurements are pixels on the 1920x1080 screen. The
// frame line sits 4px inside the edge of its panel.
//
// An edge is one shape drawn five times (shadow, rim, face, shade, ridge),
// and its colours come from tokens.css. The shape of each frame is added once
// to the hidden defs in index.html, the first time a plate of that kind is
// built, and every later plate points at it with <use>. The gradients and the
// screw are in index.html too. The five layer classes are described in
// base.css.
//
// The frame round a plate is drawn in two halves, each in its own svg:
//   half a: the left side, the top left corner and the top
//   half b: the right side, the bottom right corner and the bottom
// They meet at the top right and the bottom left. Each half carries the screws
// of its own corners, so it can move on its own as one piece.
//
// Every piece is labelled with data-part so frame.js can move it. The panel
// sizes here are repeated in base.css and in each panel's own stylesheet.
// Change them together.
//
// The Original style adds rivets to the frames of the large panel, the small
// panel and the countdown, along their long straight edges. They are always
// in the markup. base.css draws them only while the style is Original, and
// nothing about them moves. The rivets are in the halves of the frame and in its
// pieces, so they go where the frame goes.
//
// The frames of the steel styles are made by makeBarShape() below ("The frames of the
// bar layout"): the metal edge, a neon line just inside it, hex bolts where the screws
// are, and what only a style draws. All of it is in the markup, and base.css and the
// style's own stylesheet show what the style has.
//
// Cybertron has four of them on the layouts of Original, the standard layout and the
// sidebar layout: the large frame, the small frame, the banner and the ticker
// (cybertron-grid1 and the other three, "The frames of Cybertron"). They have the sizes
// of the frames they stand in for, so nothing about the layout changes. Its countdown is
// the war clock, in its wide form (warHousingMarkup, "The war clock's housing").
//
// The Minimal style has three frames of its own in the bar layout, the main panel, the
// banner and the ticker, cut less deep (bar-main-minimal and the other two). It adds to
// them the rivets that Original has, and rust at two corners, a weld seam, and a row of
// ticks along the foot of the header. The style
// whose frames the page draws is chosen when the page starts (core/style.js, shapesFor),
// and when a style with other frames goes on later the frames are drawn again
// (core/areas.js, redrawFrames). frameKind() gives the name of the frame for a style.
//
// Every frame here is the one Prime has: the top left and bottom right corners cut, and the
// header tab ended the way each frame has always ended it. A team can have the other two corners
// cut and a tab with one 60 degree slant (the Cut corners and Header end fields of the team, "Team
// trim" in docs/layouts.md). Such a frame is made from the Prime one the first time a page asks for it,
// and its name is the Prime name with -tr for the other corners and -slant for the slanted tab, in
// that order (grid1-tr-slant). frameKind() gives the name for a style and a trim.
//
// The TEAM plate (teamPlateMarkup), the ticker's tag (tagMarkup) and the frame round the ticker have a
// thinner metal edge than the other frames, so that no text is cut by it (base.css, "The thin plate edge").
// Their lines are placed so that the outer edge of the metal stays where it was.
//
// There are three ways to get a frame. areaMarkup() is the frame of an area
// that stays on screen while its pages change (the large panel, the small
// panel, the ticker of Cybertron, and the main panel and the ticker of the bar
// layout). It also holds the same frame cut into pieces, hidden, for the
// mechanical page change. plateMarkup() is the whole plate of a panel that sits
// outside the areas and draws its own, the countdown, the banner of Cybertron and
// the banner of the bar layout. frameMarkup() is the full screen frame of the
// alert and the announcement.

export { rivetsAlong, rivetsOf } from './plate-shapes.js';
export { offsetPoint, offsetOutline } from './plate-trim.js';
export { makeBarShape } from './plate-bar.js';
export { trimmedKind, barShape, frameKind, frameExtent, makeSilverGradients } from './plate-draw.js';
export {
  warHousingMarkup, plateMarkup, areaMarkup, frameMarkup, scanMarkup, rowBarMarkup, cardMarkup, teamPlateMarkup,
  tagMarkup,
} from './plate-markup.js';
