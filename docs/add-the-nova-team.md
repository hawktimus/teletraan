# Add the Nova team

For the coaches. The TV can show a second team, Hawktimus Nova, with its own name,
number, logo and colors. The team starts as a document in the Teams list. The
colors in the starting file are placeholders until the team has chosen its own. Do
the four steps in order.

## 1. Import the two teams

The file `docs/seed/teams.ndjson` holds Hawktimus Prime, with the colors the screen
has today, and Hawktimus Nova. Import it once, from a Mac, with the Studio set up
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
team, and Nova only and Alternate stay on Prime.

## 2. Fill in the Nova team

In Studio open Settings, then Teams, then Hawktimus Nova. These are the fields.

- Team name: up to 20 characters. It is the name in the banner.
- Short name: up to 8 characters, such as NOVA.
- Team number: up to 6 characters. The file starts with 3230. Check that it is the
  right number.
- Team code: nova. The data uses it, so do not change it.
- Logo: optional. A picture for the banner. Leave it empty to use the shared
  Hawktimus bird.
- Colors: seven colors, each # and six characters from 0 to 9 and A to F, such as
  #1F7AE0. The ones in the file are placeholders.
  - Main color: the header tabs and the bird.
  - Plate color: the team plate and the inset of the header tab.
  - Accent color: small marks and key words.
  - Neon color: the thin neon lines and the digits of the war clock in Minimal.
  - Second bright color: the conduit line and the corner brackets of Cybertron.
  - Background color: the color behind everything.
  - Text color: the main text.
- Mirror the layout: on to start with. The whole screen is flipped left to right
  while Nova is showing.
- Active: on. Turn it off to leave the team out of Alternate mode and out of the
  Team choice on items.
- Order: a lower number comes first. Prime is 10 and Nova is 20.

Click Publish. A change to the team that is on the screen goes on within a few
seconds, without waiting for a page change.

## 3. Set the team mode

Open Dashboard Settings, then the Teams tab.

- Team mode: Prime only is picked to start with. Pick Nova only to show Nova all the
  time, or Alternate to swap.
- Minutes for each team: in Alternate mode, how long one team stays, from 1 to 30.
  It starts at 5. The swaps are counted from the clock, so two screens agree.

Click Publish. The swap waits for a page change. The name, the number, the logo, the
colors and the mirror change together, and nothing changes in the middle of a panel.

## 4. Check the TV

Open the menu next to Publish on Dashboard Settings (the three dots) and click
Preview Nova. The TV shows Nova for 2 minutes whatever Team mode says, then goes
back. Look at the name, the number, the colors and which side the columns are on.
With the sample content showing, `?team=nova` on the end of the address does the
same for one page.

Content only shows for Nova when it is for Nova or for both teams
(docs/team-on-an-item.md). If Nova has no tasks of its own yet, it shows the tasks
that are for both.

## Afterwards

- To stop showing Nova, set Team mode to Prime only. The Nova team and its content
  stay in Studio.
- To change the colors later, edit the Nova team and publish. Style and pack are
  separate settings (docs/switch-the-look.md).
- A third team can be added as another document in Teams. It takes its turn in
  Alternate mode. Team mode has a choice for Prime only and Nova only, and none for
  a third team on its own.
