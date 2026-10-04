# The logo

The hawk at the top left of the banner has a show. It repeats for as long as
the screen is on. When the screen starts, the plates fly in and latch (1.5
seconds). After that, one pass of the show is:

| Act   | Length | What happens                                                        |
|-------|--------|---------------------------------------------------------------------|
| hover | 7 s    | The hawk hangs in the air and beats its wings seven times. Each beat is 0.9 seconds: a quick down stroke, then a slower up stroke. The body rises as the wings go down. |
| rest  | 5 s    | A still hawk.                                                        |
| soar  | 7 s    | The wings spread wide and the hawk glides, rocking gently from side to side. |
| rest  | 5 s    | A still hawk.                                                        |
| flex  | 2.4 s  | Both wings stretch out in three jerks, like a servo, and come back the same way. |
| rest  | 5 s    | A still hawk.                                                        |

The second announcement (the one with the logo above the words) shows the
`fly` act: the same wingbeats as hover, with no end, for as long as the
announcement is up. In calm mode and with no motion the logo is a still hawk
all the time.

## Where things are

- `dashboard/core/logo.js` draws the logo: five plates (two wings, the head,
  the face and the jaw) and four slashes on the wings. Each plate is drawn
  twice, a gold copy underneath for the outline and a purple copy on top.
- The section headed "The logo" in `dashboard/frame.css` moves the plates.
  There is one group of rules for each act, and a wing turns on its shoulder.
- The list `logoShow` in `dashboard/frame.js` says which act plays and for how
  many seconds. An act has to be at least as long as the animations in it.
- The colours are in `panels/banner/banner.css` and
  `panels/announcement/announcement.css`.
- `tools/logo.html` shows the logo large, with a button for each act, a slider
  that stops an act at any moment, a row of key poses, and a row of poses at
  the real banner size. Open it at http://localhost:8080/tools/logo.html while
  the server from the README is running.

## Changing it

All times are written for normal speed and multiplied by `--pace`, so the
Speed setting changes them too: write `calc(.9s * var(--pace))`, never a plain
`.9s`. The numbers are in the logo's own units, a drawing 1100 wide, so 100
units is about 20 pixels on the banner.

The wings reach furthest to the sides while they are level on the down stroke.
Check that pose in `tools/logo.html` whenever you change a wingbeat: the tips
must stay inside the 40 pixel page margin on the left and short of the TEAM
plate on the right.

To add an act, write its rules in frame.css as
`.logo[data-act="name"] .wing-left { animation: ... }`, then add
`['name', seconds]` to `logoShow`.
