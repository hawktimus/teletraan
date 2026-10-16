# Add the Nova team

For the coaches. The TV can show a second team, Hawktimus Nova, with its own name,
number, logo and colors. The team starts as a document in the Teams list. The
colors in the starting file are placeholders until the team has chosen its own. Do
the four steps in order.

The name, short name and number of a team are read from its Team document and nowhere else. To
rename a team or change its number, change them in Settings, Teams. The Monday board is not
connected to the name, so a rename there is done by hand.

## 1. Import the two teams

The file `docs/seed/teams.ndjson` holds Hawktimus Prime, with the colors and the trim the
screen has today, and Hawktimus Nova. Import it once, from a Mac, with the Studio set up
and signed in (docs/laptop-setup.md). It changes the real content that
the TV shows, so ask the team mentor first. From the `studio` folder, run this one
command:

    npx sanity dataset import ../docs/seed/teams.ndjson --missing

Each team has a fixed id, `team-prime` and `team-nova`. `--missing` skips any team
whose id is already there, so running it again changes nothing, even if someone has
edited a team in Studio since. Do not use `--replace`: it would put the original
colors back. The parts of the command are explained in docs/editing-content.md,
"Importing the starting list".

A Studio with no team documents works too. The TV then shows the built-in Prime
team, and the Nova view stays on Prime.

## 2. Fill in the Nova team

In Studio open Settings, then Teams, then Hawktimus Nova. These are the fields.

- Team name: up to 20 characters. It is the name in the banner.
- Short name: up to 8 characters, such as NOVA.
- Team number: up to 6 characters. The file starts with 3426. Check that it is the
  right number.
- Team code: nova. The data uses it, so do not change it.
- Logo: optional. A picture for the banner. Leave it empty to use the shared
  Hawktimus bird.
- Colors: twelve colors, each # and six characters from 0 to 9 and A to F, such as
  #D4A017. The file starts Nova on the inverse of Prime, gold and purple: main #D4A017, plate #6B4C08,
  accent #C86BFF, neon #B23CFF, second bright #D4A017, background #17110A, body #241A04, label #D9A6FF,
  header text #1A1200, dark #3D2A05 and retro #E0A400.
  - Main color: the header tabs and the bird.
  - Plate color: the team plate, the inset of the header tab and the cards.
  - Accent color: small marks and key words.
  - Neon color: the thin neon lines, the page grid and the digits of the war clock in the bar layout.
  - Second bright color: the conduit line and the corner brackets of Cybertron.
  - Background color: the color behind everything.
  - Text color: the main text.
  - Header text color: optional. Text that sits on the main color, such as the panel titles. It is dark on Nova,
    because white on the gold is too faint from across the room.
  - Dark color and Retro color: optional. The darkest shade of the main color, and the main color of the Retro theme.
  - Body color: the inside of the panels in Cybertron and the bar layout.
  - Label color: the department names in rows. It is light purple on Nova, because light blue
    is lost against the blue frame.
- Metal: gold or steel. It is the metal of the frame edges, the bolts and the war clock in
  Cybertron and the bar layout. Both teams start on gold, so Nova stays metallic.
- Glow: on for Nova. A soft glow round the neon lines of the frames in Cybertron and the bar layout.
  Prime has it off.
- Mirror the layout: on to start with. The whole screen is flipped left to right
  while Nova is showing.
- Trim: six choices that make Nova look like its own team and not Prime in other colors.
  Each is one of two. The first of each is how Prime looks, and the file starts Nova on the
  second:
  - Bolts: hex nuts, or round rivets with a slot. Nova has round rivets.
  - Cut corners: top left and bottom right, or top right and bottom left. Nova has top right
    and bottom left.
  - Header end: the notch at the end of the colored tab on every panel header, or one slant at
    60 degrees. Nova has the slant.
  - Page grid: lines or dots, on the page behind Cybertron and the bar layout. Nova has dots.
  - Ticker label: the cut plate, or a thin bar with a block of the accent color in front of it.
    Nova has the bar.
  - Countdown color: red, or the neon color of the team. Nova has neon.

  Outlined name is a switch in the same box. Off draws the team name solid. It is off on
  both teams to start with, and turning it on draws outlined letters with a line under them in
  the accent color. The older choice Team name look is hidden and the screen does not read it.

  A team with none of them stored, such as one saved before the trim existed, looks like Prime.
  The frames change shape when the team goes on, in the same moment as the colors and the
  mirror. docs/layouts.md, "Team trim", says how each one is drawn.
- Active: on. Turn it off to leave the team out of the team picker of a view and out of the
  Team choice on items.
- Order: a lower number comes first. Prime is 10 and Nova is 20.

Click Publish. A change to the team that is on the screen goes on within a few
seconds, without waiting for a page change. A change of the colors or the trim of the team on
the screen draws the frames again, so give it a moment.

## 3. Put Nova in the Nova view

Open Settings, then Views, then Nova, and click B on the map. The Nova view plays as the Nova
team, and the Prime view plays as Prime, so the rows of the two teams are separate documents.
A view that was filled from the old Panel order already has its rows. Add rows if they are not
there. Take Nova out of the order of the views (Dashboard Settings, Look tab) to show Prime all
the time.

Click Publish. The swap from one team to the next comes when the next view is for the other
team. The name, the number, the logo, the colors and the mirror change together, and nothing
changes in the middle of a panel.

## 4. Check the TV

Open the menu next to Publish on Dashboard Settings (the three dots) and click
Preview Nova. The TV shows Nova for 2 minutes whatever the views say, then goes
back. Look at the name, the number, the colors and which side the columns are on. Then look at the
trim: the round bolts, the corners cut at the top right and the bottom left of every panel, the
slanted end of each header tab, the solid name, the bar at the start of the ticker and the
neon countdown. The bird has its wings up. Cybertron and the bar arrangement have dots on the page, in place
of lines.
With the sample content showing, `?team=nova` on the end of the address does the
same for one page.

Content only shows for Nova when it is for Nova or for both teams
(docs/team-on-an-item.md). If Nova has no tasks of its own yet, it shows the tasks
that are for both.

## Afterwards

- To stop showing Nova, take it out of the order of the views. The Nova team and its content
  stay in Studio.
- To change the colors or the trim later, edit the Nova team and publish. Theme and pack are
  separate settings (docs/switch-the-look.md).
- A third team can be added as another document in Teams, and then given a view of its own,
  where it takes its turn.
