# Switch the look

For the students who edit the Studio. The look of the TV has three parts, and
each is its own setting: the style (the layout and the frames), the team (the
name, the number, the colors and whether the screen is flipped left to right) and
the seasonal pack (a holiday overlay). Do the four steps in order. Nothing here
needs a change to the code.

## 1. Pick the style

In Studio open Dashboard Settings, then the Look tab, and find Style.

- Original is the screen as it has always been. Its layout comes from the theme.
- Cybertron has a banner across the top with the team name at one end and the war
  clock at the other, a thin side column, one main panel and the ticker across the
  bottom. The frames are steel with a neon line inside the edge, bolts at the
  joints and a hazard stripe under each header.
- Minimal has the same layout. Its frames have smaller cut corners, rivets, rust at
  two corners and tick marks along the header line.

The war clock is the countdown to Kickoff, then to Rollout, in a steel housing. It
uses the dates and the label from the Countdown tab. Cybertron and Minimal have no
small frame, so the next event, task counts, safety days and sponsor logo do not
show with them. The main panel shows the large panels of the Panel order list, one after
another, with the rows and the line limits each panel always had.

When the style gives another layout than the one on the TV, the screen reloads
once, at the next page change.

## 2. Pick the team

Still in the Look tab of Dashboard Settings, find Team mode.

- Prime only shows the Prime team all the time. It is picked to start with.
- Nova only shows the Nova team all the time.
- Alternate swaps between the teams. Minutes for each team is how long one stays,
  from 1 to 30, and starts at 5.

The team sets the name, the number, the logo, the colors and the mirror. A team
with Mirror the layout on has the whole screen flipped left to right: the
columns, the banner and the tag on the ticker change sides. The sidebar layout of
the theme Neon Prime is not flipped. The swap in Alternate mode waits for a page
change and then everything changes together, so nothing changes in the middle of
a panel.

Items that have a Team show only for that team. Items with Both, the countdown, the
weather, the BAND events and the photos show for every team
(docs/team-on-an-item.md). The teams are edited under Teams in the sidebar
(docs/add-the-nova-team.md).

## 3. Pick the seasonal pack

Open Look in the sidebar. There are two ways to turn a pack on.

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

Click Publish. A change of style, team or pack does not happen in front of people.
It waits for the next page change of the large panel, which takes up to a minute.

To see a look first, open the menu next to Publish on Dashboard Settings (the
three dots) and click Preview Prime, Preview Nova, Preview Cybertron, Preview
Minimal or Preview next pack. The TV shows that look for 2 minutes and then goes
back to the saved settings. No setting is changed, so there is nothing to put back.

On a computer, `?style=minimal`, `?team=nova` and `?overlay=christmas` on the end
of the address show a look for that one page, with the sample content, which has
both teams (docs/try-it-on-the-mini.md lists every switch).

## Afterwards

- To go back to the screen as it was, set Style to Original, Team mode to Prime
  only, and turn the pack rule off, or pick No seasonal pack under Use a theme now.
- The team gives its main, accent, background and text colors to the theme
  Hawktimus. The other themes keep their own colors. The plate, neon and second
  bright colors of a team are read by Cybertron and Minimal only.
- Every setting is explained in docs/editing-content.md, and the layouts and the
  frames are in docs/layouts.md.
