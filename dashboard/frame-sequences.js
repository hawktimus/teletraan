// The table of how each whole panel is put together, part by part (part of frame.js).

// How each kind of whole panel is put together. One line per part:
//   part name: [effect, start time in ms, gap in ms between repeated parts]
// Screws, countdown segments and letters use the gap so they appear one after
// another. A part with no line here just appears and stays. The effects are
// the data-fx rules at the top of frame.css.
export const sequences = {
  // The banner has the first four parts only in Cybertron, where it stands on a plate
  // (core/plate.js, "The frames of the bar layout"): the plate unfolds, its lines are drawn,
  // and its decoration and bolts come after
  banner: {
    'body':         ['unfold', 200],
    'outline':      ['draw', 700],
    'decor':        ['fade', 1350],
    'stud':         ['servo', 1300, 50],
    'title':        ['latch-left', 500],
    'team-plate':   ['latch-left', 700],
    'clock':        ['latch-right', 700],
    'wordmark':     ['fade', 1000],
    'subtitle':     ['fade', 1000],
    'rule':         ['grow', 1100],
    'line':         ['fade', 1100],
    'school':       ['fade', 1300],
    'sample-badge': ['fade', 1500],
  },

  countdown: {
    'body':          ['unfold', 200],
    'outline':       ['draw', 700],
    'lamp':          ['pop', 950],
    'label':         ['fade', 1000],
    'chevron-left':  ['latch-left', 900],
    'chevron-right': ['latch-right', 900],
    'days':          ['slam', 1100],
    'days-word':     ['fade', 1250],
    'time':          ['fade', 1300],
    'stripes':       ['grow', 1350],
    'segment':       ['pop', 1450, 35],
    'stud':          ['servo', 1300, 50],
    'rivets':        ['fade', 1350],
    'scan':          ['scan', 1200],
  },

  // The countdown of Cybertron, the wide war clock (panels/countdown). The clock comes in as
  // one piece, and none of its parts has a line of its own
  'countdown-war': {
    'war':           ['unfold', 300],
  },

  // The sidebar layout's one panel, in place of the banner and the countdown
  // (panels/side). The countdown's parts keep the names and the order they
  // have above, a little later, and the logo's own show runs beside them. The
  // team name, the clock and the weather are not here: they are in the strip,
  // outside the panel.
  side: {
    'body':          ['unfold', 800],
    'lamp':          ['pop', 1150],
    'label':         ['fade', 1200],
    'chevron-left':  ['latch-left', 1100],
    'chevron-right': ['latch-right', 1100],
    'days':          ['slam', 1300],
    'days-word':     ['fade', 1450],
    'time':          ['fade', 1500],
    'stripes':       ['grow', 1550],
    'segment':       ['pop', 1650, 35],
    'team-plate':    ['latch-left', 1400],
    'school':        ['fade', 1700],
    'sample-badge':  ['fade', 1900],
  },

  // The bar layout's two panels that stay on screen: the banner (panels/bar-banner) and
  // the side column (panels/bar-column). The banner draws its own frame, as the countdown
  // does: the plate unfolds, the lines are drawn, the decoration and the hex bolts come
  // after, and in Minimal so do the rivets and the rust. The war clock is in the
  // war slot and arrives with it, so it has no parts of its own
  'bar-banner': {
    'body':         ['unfold', 200],
    'outline':      ['draw', 700],
    'title':        ['latch-left', 500],
    'war':          ['fade', 900],
    'decor':        ['fade', 1350],
    'rivets':       ['fade', 1350],
    'wear':         ['fade', 1350],
    'stud':         ['servo', 1300, 50],
  },
  'bar-column': {
    'clock':        ['latch-right', 700],
    'line':         ['fade', 900],
    'team-plate':   ['latch-left', 800],
    'school':       ['fade', 1100],
    'sample-badge': ['fade', 1300],
  },

  // Full screen: an alert from the editors
  alert: {
    'stripe':   ['grow', 0],
    'frame':    ['draw', 150],
    'headline': ['slam', 400],
    'message':  ['fade', 900],
    'stud':     ['servo', 500, 50],
    'scan':     ['scan', 600],
  },

  // Full screen: the 2:30 and 5:00 announcements
  announce: {
    'stripe':  ['grow', 0],
    'frame':   ['draw', 100],
    'logo':    ['fade', 200],
    'letter':  ['slam', 450, 55],
    'caption': ['fade', 1500],
    'stud':    ['servo', 500, 50],
    'scan':    ['scan', 900],
  },

  // Full screen: the cards of a booked talk, for the title, for slides that are not
  // ready and for the thanks (panels/talk). The slides themselves are not here, since
  // they change at once.
  talk: {
    'ground':   ['fade', 0],
    'label':    ['fade', 200],
    'headline': ['latch-left', 200],
    'detail':   ['latch-right', 350],
    'prompt':   ['fade', 1000],
  },
};
