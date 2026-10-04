# The logo and the team name

The hawk at the top left of the banner has a show. It repeats for as long as
the screen is on. The team name beside it has an effect that plays now and
then. This page says what happens when, where the code is, and how to change
a time.

## What happens when

One pass of the show is 24 seconds. The page starts a pass the moment it
loads, so the times below count from then.

| Second | Act | What happens |
|--------|-----|--------------|
| 0 | boot | Only the first pass. The four plates fly in and settle (about 1 second). |
| 2 | turn | Only every third pass. The logo makes one full turn, drawn flat (1.6 seconds). |
| 5 | name | The logo is still. The team name effect plays now if it is due. |
| 13 | robot | The wings swing down into legs, the face and jaw rise into a body and the head lifts clear. |
| 16 | hawk-in | 2 seconds. Each plate pulls back, travels to where its part of the hawk will be and turns edge-on. Then the side view hawk turns in: the body, the wings, the head, and last the tail slides out in two pieces, the near wing unfolds in three panels and the beak snaps out. |
| 18 | flight | Five wingbeats of 0.8 seconds. Each wing turns about its shoulder and the body rides up and down. |
| 22 | hawk-out | 2 seconds. The same steps backwards, then each plate comes back and locks home. |

The rest of the time the logo is the still emblem.

The announcement with the logo (the second one) shows the act `fly`: the same
wingbeats with no end, for as long as the announcement is up.

In calm and none motion nothing moves. The logo stays the still emblem, and a
logo asked to fly shows the hawk still, with its wings up. In the flat finish
(`?finish=flat`) the outline is one plain colour and the shadow is gone.

### The team name

Every Name effect every seconds (Dashboard Settings, 300 by default) each
letter of the team name splits along two slanted cuts into three pieces. The
pieces pull apart, turn once and lock back, one letter after another, 45
milliseconds apart. It takes about 1.5 seconds.

- It starts at the quiet moment (second 5 of a pass), so the name and the logo
  never move together. The first time is in the first pass, then once every
  Name effect every seconds. Those are real seconds. The Speed setting changes
  how fast the effect moves, not how often it plays.
- It is off in calm and none motion, and when Name effect is switched off in
  Dashboard Settings.
- To try it now, open the dashboard in a browser, open the console and type:

      import('./frame.js').then(frame => frame.playNameEffect())

  tools/logo.html has a button for it, and a box to type any name in.
- The Studio allows 16 characters. A name that is too wide for the room
  squeezes its letters a little closer together. The clock never moves.

## Where things are

- `dashboard/core/logo.js` draws the logo. The four plates of the emblem and
  the five parts of the hawk are lists of points on a grid 1100 wide and 884
  high. Each plate and part is its own div with its own svg, so it can turn
  in 3D.
- `dashboard/core/name.js` builds the team name from letters. Each letter is
  the real letter plus three empty pieces that draw it again for the effect,
  so the name stays plain text that can be selected.
- The section "The logo" in `dashboard/frame.css` has the colours and all the
  motion. The rules are grouped by act, and each act is a name written as
  `.logo[data-act="robot"]`. The section "The team name" has the name effect.
- The list `logoShow` in `dashboard/frame.js` says which act plays and for how
  many seconds. The same file has `startLogo`, `playLogoAct` and
  `playNameEffect`.
- The gradient of the outline, `logo-metal`, is in `dashboard/index.html`. It is
  made from the metal colours in `tokens.css`, so Frame metal in Dashboard
  Settings (gold or silver) changes it with the frames.
- The size of each logo is in the stylesheet of the panel that shows it
  (`banner.css`, `announcement.css`). `--k` is the box's width divided by 1100.
- `tools/logo.html` shows the logo large with a button for each act, a slider
  that stops an act at any moment, Speed, Motion, Metal and Finish, the name
  effect, and every key pose, large and at the real size of the banner. Open
  it at http://localhost:8080/tools/logo.html while the server from the README
  is running.

## Changing it

All times are written for normal speed and multiplied by `--pace`, so the
Speed setting changes them too. In frame.css write `calc(.9s * var(--pace))`,
never a plain `.9s`. In frame.js the times in `logoShow` are normal-speed
seconds, and `playLogoAct` multiplies them by `pace()`.

- To change when something happens, change the seconds in `logoShow`. The
  numbers add up to the length of a pass, 24. If you add a second to one act,
  take it from another or the pass gets longer. An act has to be at least as
  long as the animations in it, or the next act cuts them off. The animations
  of an act are the ones with that act's name in frame.css, and each rule says
  how long it takes and how long it waits.
- To change how often the turn plays, change the third number of the `turn`
  row (3 is every third pass).
- To change how a part moves, change its keyframes. The numbers are in the
  logo's own units, a grid 1100 wide, so 100 units is about 20 pixels on the
  banner.
- To add an act, write its rules in frame.css as
  `.logo[data-act="my-act"] .wing-left { animation: ... }`, then add
  `['my-act', seconds]` to `logoShow`.
- Parts reach past the edge of the logo while the show plays: about 28 pixels
  to the left and 27 to the right at the most. The wings swinging down into the
  robot are the widest, and for a moment the right wing tip passes behind the
  corner of the TEAM plate. Check the poses at the banner size in
  tools/logo.html whenever you change a move.

## Why it uses 3D

The rest of the dashboard moves only with flat transforms, opacity and line
drawing. The logo and the team name are allowed to turn in 3D, as the page
change, the frame halves and the bolts are, and nothing else is. A flat
transform can only squash a plate. To turn it edge-on and bring it back as
another part of a bird, or to turn a slice of a letter all the way round, the
shape has to turn in depth. The 3D is kept small: every turning part is a
small div, the browser moves it as one picture and does not draw it again, and
nothing in 3D animates a colour, a size, a blur or a shadow. The dark offset
copy under the outline is a second drawing of the shape, not a shadow effect.

Only transform and opacity are animated. A part that has had a CSS transition
cannot run the animations that come after it on the graphics chip, so the
logo uses animations only, never transitions.
