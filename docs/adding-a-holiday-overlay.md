# Adding a holiday overlay

A holiday overlay lays a few accent colours over whichever theme is showing,
for a set of dates. It changes colours and nothing else. There are no
decorations. The example adds an overlay called Winter. Do the steps in order.

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

Open `dashboard/themes/overlays/registry.js` and add a line to the list:

    {
      id: 'winter',
      name: 'Winter',
      description: 'A pale blue accent.',
    },

The screen links `themes/overlays/winter.css` itself. Overlay files are linked
after the theme files, so an overlay wins when it sets the same variable.

## 3. The Studio's copy

Open `studio/themes.js` and add the same entry to `overlays`, with the same
id, name and description. The Studio cannot read the dashboard folder.

## 4. Check it

    node tools/check-themes.mjs
    node tools/test-themes.mjs
    node studio/check-schemas.mjs

`check-themes.mjs` lays the overlay over every theme and fails if any text
colour is under 7 to 1 contrast against its background. A pale accent is the
safe choice on these dark plates. The check also fails if the overlay sets
anything but the three accent variables.

## 5. Look at it

Open the dashboard with `?overlay=winter` on the end of the address, for
example `http://localhost:8080/dashboard/?overlay=winter`. Add `&theme=alternate`
to see it over another theme. The address wins over Studio, for that page only.

## 6. Put it on the calendar

Run `npm run deploy` in the studio folder so the editors see Winter in their
list. The dashboard has it when the Mini next pulls the repo. Then, in Studio,
open Theme and add a rule to the Schedule:

- Name: for the editors only, up to 24 characters.
- Kind: Holiday overlay, then pick Winter.
- Start date and End date: both are needed. The end day counts.
- Repeats every year: turn it on to use the same days every year. Only the
  month and the day count then, and the year you pick is ignored.

A rule may run over New Year. For 20 December to 5 January, turn on "Repeats
every year", set the start to 20 December of any year and the end to 5 January
of any year. A rule that does not repeat runs over New Year when its end date
is in the next year, for example 2026-12-20 to 2027-01-05.

The first rule of each kind that covers today is used, so put the rule that
should win first. "Use a theme now" on the same page wins over the schedule.
Choose No overlay there to switch a scheduled overlay off for a while.

The dates are read in the Time zone on the Theme page, which starts as
America/New_York, and not in the zone of the computer that shows the screen.
