# Switch the look

For the students who edit the Studio. The look of the TV has three parts, and
each is its own setting: the style (the layout and the frames), the team (the
name, the number, the colors and whether the screen is flipped left to right) and
the seasonal pack (a holiday overlay). The style is the Screen of the day, and the
team is the team of the row that is playing (docs/layouts.md, "The Screens"). Do the
four steps in order. Nothing here needs a change to the code.

## 1. Pick the Screen of each day

A style is a Screen. In Studio open Dashboard Settings, then the Look tab, and find
Weekday schedule. It has a picker for each day, Monday to Sunday. Original plays
on Monday, Wednesday, Friday and Sunday, and Cybertron on Tuesday, Thursday and
Saturday. Minimal is not scheduled to start with. Pick Minimal for a day to use it.
What plays on each Screen is set in Screens, the second line of the sidebar,
under Start here. The Screen of a day goes on at the first row change after midnight. The styles are:

- Original is the screen as it has always been. Its layout comes from the theme.
- Cybertron has the same layout as Original: the banner, the large frame, the
  countdown over the small frame and the ticker. The frames are plates in the team's
  body color with the team's metal for the edge (gold for Prime, steel for Nova), a neon
  line inside the edge, bolts at the joints and a hazard stripe under each header. The
  countdown is the war clock in place of the red frame.
- Minimal has a banner across the top with the team name at one end and the war
  clock at the other, a thin side column, one main panel and the ticker across the
  bottom. Its frames have the team's metal with smaller cut corners, rivets, rust at two corners
  and tick marks along the header line.

The war clock is the countdown to Kickoff, then to Rollout, in a steel housing. It
uses the dates and the label from the Countdown tab. Minimal has no small frame, so
the next event, task counts, safety days and sponsor logo do not show with it. The
main panel plays the rows of the Screen Minimal, one after another, and each panel
keeps the rows and the line limits it always had. Cybertron shows every panel Original does.

While a Monday row plays, the screen takes the Monday style of the Screen, which is
Minimal to start with, and goes back to the Screen of the day when the Monday rows
are over.

When the style gives another layout than the one on the TV, the layout changes in the
same move as the look: the frames pull apart and re-form in the new layout. The screen
does not reload.

## 2. Pick the team

The team changes by the rows of a Screen. In Screens, under Start here, open a Screen and
click B on the map. Each row has a Team. A row with a team other than the one on the banner
swaps the screen to that team. A row with no team keeps the team that is on the banner.

- Keep the Prime rows together and the Nova rows together. The screen transforms every
  time the team changes, so a list that goes Prime, Nova, Prime, Nova transforms four times.
- A Monday row needs a team. Milestones and Progress can also be Both teams.
- The screen goes from one team or style to the next in one move: the frames pull apart, the new look
  goes on while they are apart, and they re-form, with the icon of the logo going to its new place. The
  move is the same for every change, so there is nothing to pick (docs/layouts.md, "The swap").
  Swap time on A changes how long it takes.

The team sets the name, the number, the logo, the colors, the mirror and the trim
(the bolts, the cut corners and a few more small things, docs/add-the-nova-team.md). A team
with Mirror the layout on has the whole screen flipped left to right: the
columns, the banner and the tag on the ticker change sides. The sidebar layout of
the theme Neon Prime is not flipped. Everything changes together in one swap, so nothing
changes in the middle of a panel.

Items that have a Team show only for that team. Items with Both, the countdown, the
weather, the BAND events and the photos show for every team
(docs/team-on-an-item.md). The teams are edited under Settings, then Teams, in the sidebar
(docs/add-the-nova-team.md).

## 3. Pick the seasonal pack

Open Settings, then Look, in the sidebar. There are two ways to turn a pack on.

- Use a theme now, with Seasonal pack picked, shows the pack at once. Set Until, so
  it ends by itself.
- A Schedule rule with the Kind Seasonal pack shows the pack on set dates. Pick the
  pack, a Start date and an End date. Turn on Repeats every year to use the same
  days every year.

A rule has three more fields that only a pack uses. Ticker prefix is a word
before each ticker line, up to 12 characters. Banner line is one short line in the
banner, up to 40 characters. Corner art is line art in the cut corners: leaves,
snowflakes, gears, fireworks or None. Leave one empty and the pack's own is used,
if it has one.

A pack lies over every style and every team. Its accent colors, its header mark
and its slow pieces drifting over the screen show with all of them. The
decorations along the edges and the corner art draw only in Original with the
standard layout, when the screen is not flipped.

## 4. Publish and look at the TV

Click Publish. A change of Screen, row or pack does not happen in front of people.
It waits for the next page change of the large panel, which takes up to a minute.

To see a look first, open the menu next to Publish on Dashboard Settings (the
three dots) and click Preview Prime, Preview Nova, Preview Cybertron, Preview
Minimal or Preview next pack. The TV shows that look for 2 minutes and then goes
back to the saved settings. No setting is changed, so there is nothing to put back.

On a computer, `?style=minimal`, `?team=nova` and `?overlay=christmas` on the end
of the address show a look for that one page, with the sample content, which has
both teams (docs/try-it-on-the-mini.md lists every switch).

## Afterwards

- To go back to the screen as it was, pick Original for every day of the Weekday
  schedule, take the Nova rows and the Monday rows out of the main panel rows of
  Original, and turn the pack rule off, or pick No seasonal pack under Use a theme now.
- The team gives its main, accent, background and text colors to the theme
  Hawktimus. The other themes keep their own colors. The plate, neon and second
  bright colors of a team are read by Cybertron and Minimal only.
- Every setting is explained in docs/editing-content.md, and the layouts and the
  frames are in docs/layouts.md.
