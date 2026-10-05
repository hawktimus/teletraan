# Adding a theme

A theme is a set of colours for the whole screen. The example adds a theme
called Ocean. Do the steps in order.

A theme changes colours and nothing else. It cannot move anything, change a
size or add an animation. The metal on the frame edges is not part of a theme:
Frame metal in Dashboard Settings chooses it. The hawk logo keeps its brand
colours unless the theme sets the three logo variables below.

## 1. The CSS file

1. Copy `dashboard/themes/alternate.css` to `dashboard/themes/ocean.css`. The
   file name is the theme's id. Use lowercase letters, digits and dashes.
2. In the new file, change the selector `html.theme-alternate` to
   `html.theme-ocean`. The part after `theme-` must be the id.
3. Change the colours. Keep every variable in the list below. A theme file
   holds variables and nothing else: no sizes, no rules for panels.
4. Write the colours as `#rrggbb`, or as `rgba(r, g, b, .16)` for
   `--yellow-faint`. A value like `var(--lilac)` is allowed and means "the
   same as that variable in this file".

The variables a theme must set, and what each is for:

| Variable | What it colours |
|----------|-----------------|
| `--ground` | behind everything, the banner and the full screen announcement |
| `--plate` | the body of a plate |
| `--card` | a card standing on a plate |
| `--purple` | the header tabs, the team plate and the ticker tag. The name is old: it is whatever colour the tabs are |
| `--purple-dark` | a darker shade of the tab colour, for the shaded side of the silhouette |
| `--yellow` | the accent, for text and small marks |
| `--white` | the main text |
| `--lilac` | the quiet text, such as the subteam beside a task |
| `--yellow-faint` | the accent at 16 percent strength, for the sweeping bar of light |
| `--danger` | red lamps, stripes and the bar beside a blocked task |
| `--danger-bright` | red text on a dark red plate, such as OFFLINE |
| `--danger-plate` | the countdown plate and the band behind a blocked task |
| `--danger-hot` | the full screen alert and the countdown in its last week |
| `--danger-dark` | the unlit blocks of the countdown rail |
| `--status-progress` | an in progress task |
| `--status-next` | an up next task |
| `--status-done` | a done task |
| `--status-blocked` | a blocked task |

A theme may also set these, and leaves them out to keep the brand look:
`--logo-purple`, `--logo-tail` and `--logo-far` (the three colours of the hawk)
and the four `--silhouette-` variables (the picture shown for a person with no
photo, which follow the colours above).

The same list is in `dashboard/themes/required.js`, which the check reads, and
at the top of `dashboard/themes/hawktimus.css`.

## 2. The registry

Open `dashboard/themes/registry.js` and add a line to the list:

    {
      id: 'ocean',
      name: 'Ocean',
      description: 'A deep blue look.',
    },

The name is what editors see in Studio. It starts with a capital letter and has
no dash. The description is one line.

You do not need to link the file anywhere. The screen reads the registry and
links `themes/ocean.css` itself. Only `hawktimus.css` is linked in
`index.html`, because the screen needs it before anything is drawn.

## 3. The Studio's copy of the registry

The Studio is built on its own and cannot read the dashboard folder, so it has
its own copy of the list. Open `studio/themes.js` and add the same entry to
`themes`, with the same id, name and description.

## 4. Check it

Run these in the terminal, from the top folder:

    node tools/check-themes.mjs
    node tools/test-themes.mjs
    node studio/check-schemas.mjs

`check-themes.mjs` fails if the file is missing a variable, holds anything but
variables, or has no entry in the registry. It also fails if any text colour is
under 7 to 1 contrast against the background it is drawn on, for example
`--lilac` on `--plate`. It tries your theme alone and with every holiday
overlay on top. The pairs it tests are listed at the top of the script. A
colour that fails is printed with its ratio. Make the text lighter or the
background darker. A screen is read from 20 feet away, so this is not a
suggestion.

`check-schemas.mjs` fails if `studio/themes.js` and the dashboard registry say
different things. It also runs `check-themes.mjs`, so it fails when that does.

## 5. Look at it

Open the dashboard with `?theme=ocean` on the end of the address, for example
`http://localhost:8080/dashboard/?theme=ocean`. The address wins over the Theme
page in Studio, for that page only. Look at every panel. Use `?demo=alert` for
the alert, and `?overlay=none` to be sure no overlay is on top.

## 6. Use it

Run `npm run deploy` in the studio folder so the editors see Ocean in their
list. The dashboard has it when the Mini next pulls the repo. Then, in Studio,
open Theme and either:

- pick it as the Default theme,
- pick it under "Use a theme now" to show it at once (set Until to end it by
  itself), or
- add a rule to the Schedule with the kind Theme, a start date and an end date.

## How the screen picks a theme

The screen works out the theme and the overlay when it starts and again every
minute, in the Time zone set on the Theme page. In this order:

1. Use a theme now, until its Until time. A part left empty is decided by the
   next step.
2. The Schedule. The first rule of each kind that covers today. Themes and
   overlays are picked on their own.
3. The Default theme, and no overlay.

A change does not happen in front of people. It waits for the next page change
in the large panel and goes on in the moment its frame is apart. If no page
change comes for a minute, it goes on anyway. At start it goes on at once.
