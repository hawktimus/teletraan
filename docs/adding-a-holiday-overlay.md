# Adding a holiday overlay

An overlay lays a few accent colours over whichever theme is showing, for a set of dates.
The editors see it as a **seasonal pack** on the Look page in Studio, because an overlay may also
have **decorations**: small pictures in the empty places along the edges of the screen. This page
is about the colours. Everything about decorations, the seven packs that exist, the zones, the
data format and the motions is in **docs/seasonal-packs.md**, which is also where to start if you
are adding a whole pack.

An overlay with no decorations is the simplest kind: one CSS file and two registry lines. The
example adds an overlay called Winter. Do the steps in order.

An overlay may change only these variables:

| Variable | What it colours |
|----------|-----------------|
| `--yellow` | the accent, for text and small marks |
| `--yellow-faint` | the accent at 16 percent strength, for the sweeping bar of light |
| `--lilac` | the quiet text |

An overlay must set `--yellow` and `--yellow-faint` together, because the
second is the first at 16 percent strength. `--lilac` is optional. The lists
are `overlayVariables` and `requiredOverlayVariables` in
`dashboard/themes/required.js`. What each variable is for is at the top of
`dashboard/themes/hawktimus.css`.

## 1. The CSS file

1. Copy `dashboard/themes/overlays/example.css` to
   `dashboard/themes/overlays/winter.css`. The file name is the overlay's id.
2. Change the selector `html.overlay-example` to `html.overlay-winter`.
3. Change the colours. Write them as `#rrggbb`, or as `rgba(r, g, b, .16)` for
   `--yellow-faint`. The file holds variables and nothing else.

## 2. The registry

Open `dashboard/themes/overlays/registry.js` and add a block to the list:

    {
      id: 'winter',
      name: 'Winter',
      description: 'A pale blue accent.',
      decorations: false,
    },

`decorations` says whether the overlay has a pack file in `dashboard/seasons/`. Write `false` for
colours only. To give it decorations, write `true` and add the pack file
(docs/seasonal-packs.md, "How to add a pack"). `tools/check-seasons.mjs` fails when the flag and the
file disagree.

The screen links `themes/overlays/winter.css` itself. Overlay files are linked
after the theme files, so an overlay wins when it sets the same variable.

## 3. The Studio's copy

Open `studio/themes.js` and add the same entry to `overlays`, with the same
id, name, description and `decorations`. The Studio cannot read the dashboard folder.

## 4. Check it

    node tools/check-themes.mjs
    node tools/check-seasons.mjs
    node tools/test-themes.mjs
    node studio/check-schemas.mjs

`check-themes.mjs` lays the overlay over every theme and fails if any text
colour is under 7 to 1 contrast against its background. A pale accent is the
safe choice on these dark plates. The check also fails if the overlay sets
anything but the three accent variables. `check-seasons.mjs` checks the decorations.

## 5. Look at it

Open the dashboard with `?overlay=winter` on the end of the address, for
example `http://localhost:8080/dashboard/?overlay=winter`. Add `&theme=alternate`
to see it over another theme. The address wins over Studio, for that page only.

## 6. Put it on the calendar

Run `npm run deploy` in the studio folder so the editors see Winter in their
list. The dashboard has it when the Mini next pulls the repo. Then, in Studio,
open Settings, then Look, and add a rule to the Schedule:

- Name: for the editors only, up to 24 characters.
- Kind: Seasonal pack, then pick Winter.
- Start date and End date: both are needed. The end day counts.
- Repeats every year: turn it on to use the same days every year. Only the
  month and the day count then, and the year you pick is ignored.

A rule may run over New Year. For 20 December to 5 January, turn on "Repeats
every year", set the start to 20 December of any year and the end to 5 January
of any year. A rule that does not repeat runs over New Year when its end date
is in the next year, for example 2026-12-20 to 2027-01-05.

The first rule of each kind that covers today is used, so put the rule that
should win first. "Use a theme now" on the same page wins over the schedule.
Choose No seasonal pack there to switch a scheduled one off for a while.

The dates are read in the Time zone on the Look page, which starts as
America/New_York, and not in the zone of the computer that shows the screen.
