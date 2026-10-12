# Add the Nova team

For the coaches. The TV can show a second team, Hawktimus Nova, with its own name,
number, logo and colors. The team starts as a document in the Teams list. The
colors in the starting file are placeholders until the team has chosen its own. Do
the four steps in order.

## 1. Import the two teams

The file `docs/seed/teams.ndjson` holds Hawktimus Prime, with the colors and the trim the
screen has today, and Hawktimus Nova. Import it once, from a Mac, with the Studio set up
and signed in (studio/README.md, steps 1 to 4). It changes the real content that
the TV shows, so ask the team mentor first. From the `studio` folder, run this one
command:

    npx sanity dataset import ../docs/seed/teams.ndjson --missing

Each team has a fixed id, `team-prime` and `team-nova`. `--missing` skips any team
whose id is already there, so running it again changes nothing, even if someone has
edited a team in Studio since. Do not use `--replace`: it would put the original
colors back. The parts of the command are explained in docs/editing-content.md,
"Importing the starting list".

A Studio with no team documents works too. The TV then shows the built-in Prime
team, and the Nova rows of a Screen stay on Prime.

## 2. Fill in the Nova team

In Studio open Settings, then Teams, then Hawktimus Nova. These are the fields.

- Team name: up to 20 characters. It is the name in the banner.
- Short name: up to 8 characters, such as NOVA.
- Team number: up to 6 characters. The file starts with 3230. Check that it is the
  right number.
- Team code: nova. The data uses it, so do not change it.
- Logo: optional. A picture for the banner. Leave it empty to use the shared
  Hawktimus bird.
- Colors: nine colors, each # and six characters from 0 to 9 and A to F, such as
  #1B6FD6. The file starts Nova on the blue set: main #1B6FD6, plate #0E2A4A, accent #8FF0FF,
  neon #3FD8FF, second bright #9BF0FF, background #050910, body #07131F and label #C58CFF.
  - Main color: the header tabs and the bird.
  - Plate color: the team plate, the inset of the header tab and the cards.
  - Accent color: small marks and key words.
  - Neon color: the thin neon lines, the page grid and the digits of the war clock in Minimal.
  - Second bright color: the conduit line and the corner brackets of Cybertron.
  - Background color: the color behind everything.
  - Text color: the main text.
  - Body color: the inside of the panels in Cybertron and Minimal.
  - Label color: the department names in rows. It is light purple on Nova, because light blue
    is lost against the blue frame.
- Metal: gold or steel. It is the metal of the frame edges, the bolts and the war clock in
  Cybertron and Minimal. Nova has steel, and Prime has gold.
- Glow: on for Nova. A soft glow round the neon lines of the frames in Cybertron and Minimal.
  Prime has it off.
- Mirror the layout: on to start with. The whole screen is flipped left to right
  while Nova is showing.
- Trim: seven choices that make Nova look like its own team and not Prime in other colors.
  Each is one of two. The first of each is how Prime looks, and the file starts Nova on the
  second:
  - Bolts: hex nuts, or round rivets with a slot. Nova has round rivets.
  - Cut corners: top left and bottom right, or top right and bottom left. Nova has top right
    and bottom left.
  - Header end: the notch at the end of the colored tab on every panel header, or one slant at
    60 degrees. Nova has the slant.
  - Page grid: lines or dots, on the page behind Cybertron and Minimal. Nova has dots.
  - Bird pose: auto is the emblem, and flight is the hawk with its wings up. Nova has flight.
  - Ticker label: the cut plate, or a thin bar with a block of the accent color in front of it.
    Nova has the bar.
  - Countdown color: red, or the neon color of the team. Nova has neon.

  Outlined name is a switch in the same box. Off draws the team name solid. It is off on
  both teams to start with, and turning it on draws outlined letters with a line under them in
  the accent color. The older choice Team name look is hidden and the screen does not read it.

  A team with none of them stored, such as one saved before the trim existed, looks like Prime.
  The frames change shape when the team goes on, in the same moment as the colors and the
  mirror. docs/layouts.md, "Team trim", says how each one is drawn.
- Active: on. Turn it off to leave the team out of the team pickers of a Screen and out of the
  Team choice on items.
- Order: a lower number comes first. Prime is 10 and Nova is 20.

Click Publish. A change to the team that is on the screen goes on within a few
seconds, without waiting for a page change. A change of the colors or the trim of the team on
the screen draws the frames again, so give it a moment.

## 3. Put Nova in the rows of a Screen

Open Screens, under Start here, then a Screen, and click B on the map. Each row of the main
panel has a Team. The rows of Prime and the rows of Nova are separate: keep the Prime rows
together and the Nova rows together, because the screen transforms every time the team
changes. A Screen that was filled from the old Panel order already has the rows of Prime,
then the three Monday rows of Prime, then the same for Nova, then the panels for both teams.
Add the Nova rows if they are not there. Take the Nova rows out to show Prime all the time.

Click Publish. The swap from one team to the next comes when the next row is for the other
team. The name, the number, the logo, the colors and the mirror change together, and nothing
changes in the middle of a panel.

## 4. Check the TV

Open the menu next to Publish on Dashboard Settings (the three dots) and click
Preview Nova. The TV shows Nova for 2 minutes whatever the rows of the Screen say, then goes
back. Look at the name, the number, the colors and which side the columns are on. Then look at the
trim: the round bolts, the corners cut at the top right and the bottom left of every panel, the
slanted end of each header tab, the solid name, the bar at the start of the ticker and the
neon countdown. The bird has its wings up. Cybertron and Minimal have dots on the page, in place
of lines.
With the sample content showing, `?team=nova` on the end of the address does the
same for one page.

Content only shows for Nova when it is for Nova or for both teams
(docs/team-on-an-item.md). If Nova has no tasks of its own yet, it shows the tasks
that are for both.

## Afterwards

- To stop showing Nova, take its rows out of the Screens. The Nova team and its content
  stay in Studio.
- To change the colors or the trim later, edit the Nova team and publish. Style and pack are
  separate settings (docs/switch-the-look.md).
- A third team can be added as another document in Teams, and then given rows in a Screen,
  where it takes its turn.
