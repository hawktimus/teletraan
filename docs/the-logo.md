# The logo and the team name

The hawk at the top left of the banner has four animations: an entrance, a
spin, a flying hawk and, in the team name beside it, the name effect. Each one
has its own settings in the Look tab of Dashboard Settings. This page
says what each animation does, when it plays, where the code is, and how to
change one.

## What happens when

The page starts the logo the moment the banner is drawn. The times below count
from then.

| Animation | Starts | Then | Lasts | What happens |
|-----------|--------|------|-------|--------------|
| Entrance | at 0 | never again | about 2 seconds | The four plates fly in and settle (the act `boot`). It plays once, so it has a switch and no timing. |
| Name effect | at 2 seconds | every 300 seconds | 1.43 seconds | Each letter of the team name splits and turns (see The team name). |
| Flying hawk | at 13 seconds | every 24 seconds | 11 seconds | Four acts one after the other, below. |
| Spin | at 50 seconds | every 72 seconds | 1.6 seconds | The logo makes one full turn, drawn flat (the act `turn`). |

The flying hawk is these acts, with the seconds each takes at the starting
duration of 11:

| Act | Seconds | What happens |
|-----|---------|--------------|
| robot | 3 | The wings swing down into legs, the face and jaw rise into a body and the head lifts clear, and the pose is held. |
| hawk-in | 2 | Each plate pulls back, travels to where its part of the hawk will be and turns edge-on. Then the side view hawk turns in: the body, the wings, the head, and last the tail slides out in two pieces, the near wing unfolds in three panels and the beak snaps out. |
| flight | 4 | Five wingbeats of 0.8 seconds. Each wing turns about its shoulder and the body rides up and down. |
| hawk-out | 2 | The same steps backwards, then each plate comes back and locks home. |

The starting values are what the logo did before it had settings. It used to
run one fixed show of 24 seconds, over and over. The hawk was in every pass
(13 seconds in), the spin in every third pass (2 seconds in) and the name
effect in the first quiet moment, so the first plays are at 13, 50 and 2
seconds, as in the table. The rest of the time the logo is the still emblem.

The announcement with the logo (the second one) shows the act `fly`: the same
wingbeats with no end, for as long as the announcement is up. It has no timing
of its own. The master switch below turns it into the still emblem.

In calm and none motion nothing moves. The logo stays the still emblem, and a
logo asked to fly shows the hawk still, with its wings up. In the flat finish
(`?finish=flat`) the outline is one plain colour and the shadow is gone.

## The logo settings

The Look tab of Dashboard Settings has all of this, after Style and Team mode.
Everything in it is about the logo and its name, so it can all be taken out
later in one go (see the end of this page).

| Field | Starting value | Allowed |
|-------|----------------|---------|
| Logo animations | on | The master switch. Off stops all of the rest, the name effect too, and leaves the still emblem. |
| Entrance | on | A switch. It plays once, when the screen starts. |
| Spin | on | A switch. |
| Spin every (seconds) | 72 | 0 for never, or 10 to 3600. |
| Spin duration (seconds) | 1.6 | 0.5 to 10, decimals allowed. |
| Flying hawk | on | A switch. |
| Flying hawk every (seconds) | 24 | 0 for never, or 10 to 3600. |
| Flying hawk duration (seconds) | 11 | 6 to 30, decimals allowed. |
| Name effect | on | A switch. |
| Name effect every (seconds) | 300 | 0 for never, or 30 to 900. |
| Name effect duration (seconds) | 1.43 | 0.5 to 10, decimals allowed. |

A duration is how long one play lasts at Normal speed. The Speed setting
stretches it like every other time. Setting a duration stretches or squeezes
every part of the animation by the same amount: a flying hawk of 22 seconds is
the whole sequence at half speed, with five wingbeats of 1.6 seconds. The
seconds between plays are real seconds, and they are counted from when the
animation last started, so a flight of 11 seconds every 24 leaves 13 seconds
of rest, and an interval shorter than the duration plays the animation again
as soon as the line is free.

The name effect keeps the stored names it had before the tab was renamed
(`nameTransform`, `nameEvery`, `nameDuration`), so content that was already
published still works. The screen glitch used to be in this tab. It is not a
logo animation, so it is now in the Screen tab as Screen glitch.

### When an animation may play

All of them, and the screen glitch, go through one scheduler in
`dashboard/frame.js` (see "Effects that play now and then" there):

- Only one plays at a time. The logo never moves while the name effect plays,
  and the spin and the flying hawk never overlap. One that comes due while
  another plays waits in line and starts when the line is free.
- None starts while a page is changing in the large panel, the small panel or
  the ticker. The entrance is the one exception, because it plays as the
  screen starts, beside the banner arriving.
- Calm and none motion play none of them, and switching to either puts the
  logo back to the still emblem at once.
- An animation that waited plays once, late. It never plays extra times to
  catch up, because its next play is counted from when it started.
- A play asked for by hand does not wait for the spin, the flying hawk or the
  entrance. It ends them on the spot and plays. The announcement asks for the
  screen glitch between its two lines this way: the banner is hidden under the
  announcement, so the logo has nothing to finish, and the glitch must not
  wait up to 11 seconds for a flight to end.
- The master switch, turned off while something is playing, ends it at once.

### The team name

Every Name effect every seconds (300 by default, 0 for never) each letter of
the team name splits along two slanted cuts into three pieces. The pieces pull
apart, turn once and lock back, one letter after another. A letter takes 0.8
seconds and each starts 45 milliseconds after the one before, so on HAWKTIMUS
PRIME the whole effect takes 1.43 seconds. Name effect duration (seconds) sets
that total: frame.js turns it into `--name-scale`, and every letter time and gap
in `frame.css` is multiplied by it.

- It never starts while the logo is moving, because only one animation plays at
  a time. The first time is 2 seconds after the logo starts (the entrance has
  finished by then), then once every Name effect every seconds, counted from
  when it last started. Those are real seconds. The Speed setting changes how
  fast the effect moves, not how often it plays.
- It never starts at the same moment as the screen glitch, or while a page is
  changing.
- It is off in calm and none motion, when Name effect is switched off, and when
  the master switch Logo animations is off.
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
- `dashboard/frame.js` has the one scheduler that decides when each animation
  may start: the table `effects` has the entrance, the spin, the flying hawk,
  the name effect and the screen glitch. `hawkActs` there is the list of the
  four acts of the flying hawk and how many seconds each takes. The same file
  has `startLogo`, `playLogoAct` and `playNameEffect`, and `setSpin`,
  `setHawk` and `setLogoAnimations`, which `shell.js` calls with the logo
  settings every time the content changes.
- The settings are `logoAnimations`, `logoEntrance`, `logoSpin`,
  `logoSpinEvery`, `logoSpinDuration`, `logoHawk`, `logoHawkEvery`,
  `logoHawkDuration`, `nameTransform`, `nameEvery` and `nameDuration` in
  `defaultSettings` and `limits` in `dashboard/config.js`. A missing or silly
  published value becomes the starting value (`fixSettingValues` in
  `dashboard/core/content.js`). The Studio fields are all in
  `studio/schemas/settingsLogo.js`.
- The gradient of the outline, `logo-metal`, is in `dashboard/index.html`. It is
  made from the metal colours in `tokens.css`, so Frame metal in Dashboard
  Settings (gold or silver) changes it with the frames.
- The three purples of the hawk are the variables `--logo-purple`, `--logo-tail`
  and `--logo-far` in `dashboard/themes/hawktimus.css`. They are written out as
  plain colours, so a theme that recolours the plates leaves the logo in its
  brand colours unless the theme sets those three itself.
- The size of each logo is in the stylesheet of the panel that shows it
  (`banner.css`, `announcement.css`). `--k` is the box's width divided by 1100.
- `tools/logo.html` shows the logo large with a button for each act, a slider
  that stops an act at any moment, Speed, Motion, Metal and Finish, the name
  effect, and every key pose, large and at the real size of the banner. Open
  it at http://localhost:8080/tools/logo.html while the server from the README
  is running.

## Changing it

All times are written for normal speed and multiplied by `--pace`, so the
Speed setting changes them too. The spin and the flying hawk are also
multiplied by their own time scale, which is the duration in Dashboard
Settings divided by the length written in the code. frame.js sets it on the
logo as `--spin-scale` or `--hawk-scale` (1 is today's length, 2 is twice as
long), and removes it when the play ends. In frame.css the spin writes
`calc(1.6s * var(--spin-pace))` and the acts of the hawk write
`calc(.9s * var(--hawk-pace))`, where `--spin-pace` and `--hawk-pace` are the
scale and `--pace` multiplied together (defined once, on `.logo`). The
entrance writes `var(--pace)`. Never write a plain `.9s`. In frame.js the
seconds of the acts are normal-speed seconds, and `playLogoAct` multiplies them
by `pace()`.

- To change how long an act of the flying hawk takes, change its seconds in
  `hawkActs` in frame.js, and change `logoHawkDuration` in config.js and in
  `studio/schemas/settingsLogo.js` to the new total, because the setting is
  that total (`tools/test-effects.mjs` fails if they differ). An act has to be
  at least as long as the animations in it, or the next act cuts them off. The
  animations of an act are the ones with that act's name in frame.css, and each
  rule says how long it takes and how long it waits.
- To change when the spin or the flying hawk first plays, change `firstAfter`
  in its entry in the table `effects` in frame.js. How often they play is the
  setting, not code.
- To change how a part moves, change its keyframes. The numbers are in the
  logo's own units, a grid 1100 wide, so 100 units is about 20 pixels on the
  banner.
- To add an animation that plays now and then, write its rules in frame.css as
  `.logo[data-act="my-act"] .wing-left { animation: ... }`, using a time scale
  like the spin's. Add an entry to `effects` in frame.js with a function that
  plays it (copy `playSpinNow`), a `setMyAct` function, and the three fields
  (a switch, seconds between plays and seconds one play lasts) to
  `studio/schemas/settingsLogo.js`, `defaultSettings`, `limits` and
  `fixSettingValues`, as docs/adding-a-field.md says.
- To take the logo settings out of the Studio, delete
  `studio/schemas/settingsLogo.js` and the lines in `dashboardSettings.js` that
  import it and use `logoFields()`. Remove the same names from
  `studio/check-schemas.mjs`. The dashboard keeps working: it uses the starting
  values in `dashboard/config.js` for anything the published settings do not
  have, so the logo goes on with its old behaviour.
- Parts reach past the edge of the logo while the show plays: about 28 pixels
  to the left and 27 to the right at the most. The wings swinging down into the
  robot are the widest, and for a moment the right wing tip passes behind the
  corner of the TEAM plate. Check the poses at the banner size in
  tools/logo.html whenever you change a move.

## Why it uses 3D

The rest of the dashboard moves only with flat transforms, opacity and line
drawing. The logo and the team name are allowed to turn in 3D, as the page
change, the screws and the hidden transitions are, and nothing else is. A flat
transform can only squash a plate. To turn it edge-on and bring it back as
another part of a bird, or to turn a slice of a letter all the way round, the
shape has to turn in depth. The 3D is kept small: every turning part is a
small div, the browser moves it as one picture and does not draw it again, and
nothing in 3D animates a colour, a size, a blur or a shadow. The dark offset
copy under the outline is a second drawing of the shape, not a shadow effect.

Only transform and opacity are animated. A part that has had a CSS transition
cannot run the animations that come after it on the graphics chip, so the
logo uses animations only, never transitions.
