# Trying the dashboard on the Mini

This is a speed test. The aim is to find out how smoothly the Mini and the TV
can move the screen, and whether the metal edges (banded gradients, shadows and
the glint) and the page change (frame halves lifting, rows turning over) slow
it down. It is run on the real Mini and the real TV, and through the same
browser command the kiosk uses, so the result includes the graphics settings
the kiosk uses.

## 1. Check the Mini has the code

Nothing needs copying. The dashboard is already on the Mini: the pull timer
keeps `/opt/teletraan` up to date from the repository, and the web server
shows it at `http://localhost:3229/dashboard/` (3229 is `TELETRAAN_PORT` in
`deploy/local.env`, so use the number that file has). The test runs the code that
has been pushed. To test a change, push it, then wait up to 5 minutes or run
`/opt/teletraan/deploy/scripts/pull.sh`. Do not push while a test is running:
the screen reloads itself on every update, and the readout starts again.

## 2. Open the dashboard the way the screen does

The kiosk service owns the Mini's screen, so stop it first. At the Mini's own
keyboard, press Ctrl+Alt+F1 (with the Fn key too on a Mac keyboard) to get the
text screen, log in as `hawktimus`, stop the service, and start the kiosk
script with an address that ends in `?perf`:

    sudo systemctl stop teletraan-kiosk.service
    xinit /opt/teletraan/deploy/scripts/kiosk.sh 'http://localhost:3229/dashboard/?perf' -- :1 vt8

Keep the quotes. Without them the shell would end the command at the first `&`
in an address.
The script sets the window to exactly 1920 x 1080 with no zoom, and uses the
two graphics flags the real screen uses. The TV's own picture setting should be
"1:1", "Just Scan" or "Dot by Dot" so the TV does not stretch the picture.

To stop the test, press Ctrl+Alt+F1 to go back to the text screen and press
Ctrl+C. When all the tests are finished, start the real screen again:

    sudo systemctl start teletraan-kiosk.service

A black box in the bottom right corner shows how the screen is doing. Press P
to hide it and show it again. Everything it shows is counted from three
seconds after the page started, so a long run gives a fair picture.

| Line | What it means |
|------|---------------|
| motion, speed, draw | the switches in use |
| frame ms typical | the usual time between screen refreshes. 17 is perfect on a 60 Hz TV |
| frame ms p95 | the slow end: 95 out of 100 refreshes were faster than this |
| worst | the single slowest refresh after the first 3 seconds |
| late | how many refreshes took longer than 25 ms, which you can see as a stutter |
| animations running | how many things are moving right now. In normal mode it is usually 5 to 30, and it reaches 40 to 60 for a second or two when pages change at the same time or the logo changes. One slat change of the large panel is about 17 at a time, one mechanical change about 26 (the 13 pieces, the screws and the slats), and the three glints are always 3 of the count. While the hawk flies (4 seconds out of every 24) about 3 are on the hawk, and the changes into it and back start about 13 for 2 seconds each. `stress` reaches about 80. Calm mode stays at about 11 or fewer and `motion=none` at 0. A number that stays far above these for many seconds means something is wrong |
| memory | how much memory the page uses (Chromium browsers only) |

## 3. Switches

Add these to the end of the address in the command above. Join them with `&`,
for example `?perf&stress`.

| Switch | What it does |
|--------|--------------|
| `perf` | shows the readout |
| `motion=full` | all the movement (the normal setting) |
| `motion=calm` | no travel, drawing or effects. The frames stay still and each page fades out and the next fades in |
| `motion=none` | nothing moves, to see how hard the still picture is on its own |
| `speed=very-slow`, `slow`, `normal`, `fast` | the Speed setting from Dashboard Settings, for this page only. Moves take 2, 1.5, 1 or 0.75 times as long, and so do the panels' time on screen. The address wins over Dashboard Settings |
| `finish=metal` | the normal look: purple plates with polished metal edges (a banded gradient, a shadow, a shade and a ridge on every line) |
| `finish=flat` | the same screen with every edge one plain colour, no shadow, shade, ridge or glint. The shapes, text and movement do not change (the rows still turn over and the frame halves still lift), so any difference in the numbers is the cost of the metal |
| `look=polished`, `flat`, `plain` | the Polish setting from Dashboard Settings, for this page only. The address wins over Dashboard Settings. `polished` is the normal look, the same as `finish=metal`. `flat` is `finish=flat` with the glint off. `plain` is `flat` with no screws on the frames and no // in the panel headers, so it draws the least. A `finish=` or `glint=` in the same address wins over the look for that one thing |
| `style=original`, `cybertron`, `minimal` | the Style setting from Dashboard Settings, for this page only. The address wins over Dashboard Settings. `cybertron` and `minimal` have the bar layout whatever the theme says, so the page reloads once if it started in another layout or with the other style's corners (docs/layouts.md, "Styles") |
| `team=prime`, `nova`, `alternate` | the Team mode setting from Dashboard Settings, for this page only. The address wins over Dashboard Settings. `nova` shows the Nova team with its colors and its mirror, from the team documents or from the sample content, which has both. A team the Studio has no document for is the built-in Prime. A Preview button wins over it while the preview lasts (docs/hidden-transitions.md, "Preview a look") |
| `sample=1` | shows the sample content from `dashboard/data/sample/` instead of what the editors published, for this page only. Nothing in Studio switches the content, and any other value is ignored (docs/editing-content.md, "Sample content") |
| `metal=gold`, `silver` | the metal of the permanent frame edges (the banner, the countdown and the logo), for this page only. The address wins over Dashboard Settings |
| `change=alternate`, `slat`, `mechanical` | how the large and small panels change page, for this page only. `mechanical` breaks the frame into pieces and rebuilds it, `slat` turns the rows over and lifts the frame (docs/page-transitions.md). Add `stress` to see a change every few seconds |
| `frames=mostly-gold`, `alternate`, `gold`, `silver` | the metal of the large and small page frames, picked again at every page change, for this page only |
| `theme=<id>` | a theme from `dashboard/themes/registry.js`, for this page only. The address wins over the Look page in Studio. A theme with another layout brings its layout with it (`neon-prime`, section 7) |
| `overlay=<id>`, `none` | a seasonal pack (its colours and its decorations, docs/seasonal-packs.md), or none, for this page only |
| `seasonover=on`, `off` | the small pieces a seasonal pack draws over the panels (snow, leaves...), on or off, for this page only. The address wins over the Look page. Calm motion also hides them. They have not been tested on the Mini, so watch `perf` with and without them |
| `night=on`, `off` | the night screen (the screensaver, docs/night-mode.md) now whatever the time, or never, for this page only. The address wins over Dashboard Settings. The bouncing logo costs two moving layers, so it is far lighter than the dashboard it covers |
| `hidden=desktop`, `redEyes`, `off` | plays that hidden transition (docs/hidden-transitions.md) once, at the next page change of the large panel, whatever the chances say, or never plays any, for this page only. It needs full motion, and the night screen stops it, so add `night=off` at night. While it plays it holds five blocks (four in the sidebar layout), the backdrop, a picture and a red layer or the blue glitch layers as layers, and none when it is over. Play it twice to see both pictures of its set |
| `glint=on`, `off` | the bright dash that runs round each big frame every few seconds, for this page only. Off shows what the glint costs |
| `kit=off` | switches the neon kit (the moving neon of Neon Prime: nine small parts that move all the time, and a name glitch and a burst of bars now and then, docs/layouts.md, "The kit") off, for this page only. It does nothing on a theme that has no kit. Calm motion also stops it. Off shows what the kit costs |
| `stress` | shows the left panel, the small panel and the ticker together. Each is held for 3 seconds, then all three turn their pages over together, about every 5 seconds. The frames stay. The banner and countdown stay |
| `draw=fade` | fades the frame lines in instead of drawing them when the frames assemble, to find out whether drawing is the slow part. The assembly happens once, when the page loads |
| `only=tasks` | shows only the Tasks panel, with no banner, countdown, small panels or ticker, for a fair comparison with the next page |
| `show=events` | shows only that panel, with the banner and the countdown. The panel is held for 30 seconds, then its page turns over and arrives again. Use any panel name from `registry.js` |
| `demo=announcement` | plays the first announcement from Dashboard Settings 4 seconds after the page loads |
| `demo=alert` | shows a sample alert |
| `demo=crt` | plays the screen glitch (the old television effect) every 8 seconds, waiting while a page is changing or another effect is playing |

To compare the finishes, run the same address twice, once as it is and once
with `finish=flat` added. Keep every other switch the same, run both for the
same length of time, and compare the numbers. The readout does not say which
finish is running, so write the address down beside each result. Do the same
with `glint=off` to see what the glint costs on its own. Run it with `look=flat`
and with `look=plain` too, to see how much lighter each look is. Plain also
leaves out the screws and their shadows, which turn at every page change.

The page change is the heaviest thing the screen does, and `stress` makes it
happen every 5 seconds, so a `stress` run shows it best. Watch the `late`
count: a late refresh while the rows turn over or the frame halves lift is the
stutter to look for. Run it once with `change=slat` and once with
`change=mechanical` to compare the two page changes (docs/page-transitions.md):
the mechanical one paints a dozen pieces as it starts, and the frame at rest
again as it ends. If it is clearly worse, set Page change style to Slat change
only.

## 4. The comparison page

A second page shows the same Tasks panel built a different way, with solid
plates and no drawn lines. It takes the same `perf`, `motion`, `stress`,
`finish` and `metal` switches as the dashboard (it has no `speed` or
`glint`). Like the dashboard it shows the metal finish unless it is given
`finish=flat`, which is the plain colours the page started with. Its metal is
CSS gradients on the plates, where the dashboard's is SVG gradients, so the
page times both ways of painting it.

The web server on the Mini only shows the `dashboard` folder, so this page
needs the small server in `tools`. Open a second text screen with Ctrl+Alt+F2,
log in, and run:

    python3 /opt/teletraan/tools/serve.py 8081

Then go back with Ctrl+Alt+F1 and start the kiosk script with this address:

    xinit /opt/teletraan/deploy/scripts/kiosk.sh 'http://localhost:8081/tools/perf/plates.html?perf' -- :1 vt8

Compare it with `'http://localhost:3229/dashboard/?only=tasks&perf'`, and add
the same `finish` to both addresses so the two pages are painted the same way.
Stop the small server with Ctrl+C in the second text screen when you are done.

## 5. What to try

1. Record what the browser does with the Mini's graphics chip. Open the
   browser's graphics page with the kiosk script, take a photo of the screen,
   and note the browser version (`chromium --version`):

       xinit /opt/teletraan/deploy/scripts/kiosk.sh chrome://gpu -- :1 vt8

   Lines that say "Hardware accelerated" mean the chip is doing the work.
   "Software only" means the processor is doing all of it.
2. Check that the two graphics flags in `kiosk.sh` help. Run the first test in
   item 3 twice: once as it is, and once from a copy with the two flag lines
   removed. Make the copy, delete the lines `--enable-gpu-rasterization \` and
   `--ignore-gpu-blocklist \` from it, and start it the same way:

       cp /opt/teletraan/deploy/scripts/kiosk.sh /tmp/kiosk-no-gpu.sh
       nano /tmp/kiosk-no-gpu.sh
       xinit /tmp/kiosk-no-gpu.sh 'http://localhost:3229/dashboard/?perf' -- :1 vt8

   If the run without the flags is smoother, or the picture glitches with
   them, remove the two lines from `deploy/scripts/kiosk.sh` and push. Never
   add `--disable-gpu`. If glitches remain, try adding
   `--disable-gpu-compositing`.
3. Run each of these for 30 minutes and write down typical, p95, worst and late
   at the end of each:
   - `?perf` (normal)
   - `?perf&finish=flat`
   - `?perf&look=flat`
   - `?perf&look=plain`
   - `?perf&motion=calm`
   - `?perf&glint=off`
   - `?perf&stress`
   - `?perf&stress&finish=flat`
   - `?perf&stress&glint=off`
   - the comparison page, `plates.html?perf`
   - the comparison page in plain colours, `plates.html?perf&finish=flat`
4. Run `?perf&motion=none` and `?perf&motion=none&finish=flat` for 10 minutes
   each. With nothing moving, the pair shows what the still metal costs.
5. Run `?perf&demo=crt` for 10 minutes and `?perf&demo=announcement` once.
6. Leave the normal page running overnight. In the morning read the numbers
   again and check that the Mini is not hot and the screen has not frozen.
7. Ask two people to stand 20 feet from the TV and read the screen aloud. Try
   again from 30 feet. Note anything they cannot read.
8. Film `?stress` with a phone. Playing the video slowly makes stutter easy to
   see.

## 6. Write down

- The graphics page photo and the browser version
- The numbers from items 3, 4 and 5, with and without the graphics flags, and
  the address each run used, so metal and flat can be told apart
- Anything the two readers could not make out
- Whether the Mini felt hot or the fan was loud

## 7. The Neon Prime theme (the sidebar layout)

Neon Prime has its own layout (docs/layouts.md): a strip across the top with the
team name, a column on the left, one big frame on the right drawn at 1.0319 times
its size, and the ticker across the whole bottom. It also has the kit, a set of
moving neon (docs/layouts.md, "The kit"): nine small parts that move all the time,
and a glitch of the team name and a burst of bars at each page change as short
events. It has been checked in a desktop browser and **has not been run on the
Mini**, so this is the first speed test of it. The standard layout and the other
two themes are not touched by it, so they need no new test.

Before you start, make sure the Mini has the code (section 1) and that the
editors' Studio has been deployed (`npm run deploy` in the studio folder), so
Neon Prime is in their Look lists. The test does not need Studio: the address
below picks the theme for that page only.

Start the kiosk script as in section 2, with the theme in the address:

    xinit /opt/teletraan/deploy/scripts/kiosk.sh 'http://localhost:3229/dashboard/?theme=neon-prime&perf' -- :1 vt8

Run each of these for 30 minutes, write down typical, p95, worst, late and
"animations running" at the end, and run the same address with `theme=hawktimus`
(or no theme) for 30 minutes as the standard layout to compare with:

| Address ends with | What it shows |
|-------------------|---------------|
| `?theme=neon-prime&perf` | the normal look, with the kit |
| `?theme=neon-prime&perf&kit=off` | what the kit costs: the nine small parts that move all the time and the two short events (docs/layouts.md, "The kit") |
| `?theme=neon-prime&perf&motion=calm` | the calm variant: nothing of the kit moves, the neon lines, ticks and brackets stand still, and a page change is a fade |
| `?theme=neon-prime&perf&finish=flat` | the flat variant: the same with plain edges, to see what the metal costs |
| `?theme=neon-prime&perf&look=plain` | the plain variant: the flat finish with no glint and no screws. The cyan trim on the frames stays, which `finish=flat` alone hides |
| `?theme=neon-prime&perf&motion=calm&finish=flat` | calm and flat together, the lightest this theme can be. If even this is not smooth on the Mini, the layout is too heavy for it |
| `?theme=neon-prime&perf&glint=off` | what the one glint costs |
| `?theme=neon-prime&perf&change=mechanical` | the heaviest page change |
| `?theme=neon-prime&perf&stress` | the large frame and the ticker changing every few seconds (there is no small frame to change) |
| `?theme=neon-prime&perf&show=photo` | the Photo panel, scaled up with the frame |

Then leave `?theme=neon-prime&perf` running overnight. Also run the screen with
Neon Prime chosen in Studio (Look, Use a theme now) and not in the address,
watch that the page reloads once at the next page change, and that nothing
reloads after that.

What to expect. On a desktop browser the "animations running" number averaged
8.6 in this layout with `kit=off` and 18.5 with the kit on, against 15.5 in the
standard one, with a slat page change, and reached 35 at most with the kit off and
54 with it on, against 51 (docs/layouts.md, "Moving elements"). With
`motion=calm` it is 0 at rest. The Mini should
show a similar relation: fewer without the kit, a little more with it. The number is not
the speed: the layout draws the large frame through a scale, and it is the
frame times (typical, p95 and late) that show whether the Mini's graphics chip
minds that. If this layout is clearly worse than the standard one on the same
Mini, write the numbers down and do not use it on the TV until someone has
looked at them.

Also look at the screen itself from 20 feet and from 30 feet. The ground is a
very dark violet, and some TVs show very dark colours as one flat black. Check
that the indigo plates can be told from the ground, that the neon cyan and
magenta and the amber are not too bright to read the text next to them, and
that the text in the large frame is as sharp as in the standard layout (it is
drawn scaled).
Write down anything that is hard to read.

## What counts as good

These are starting points, not rules:

- p95 at or under 20 ms while panels are moving, and `worst` under 100 ms
- `late` stays at or near 0 in normal mode
- calm mode clearly lighter than full mode
- no stutter you can see in the phone video
- the numbers do not get worse overnight
- the metal finish only a little slower than `finish=flat` on the same
  address. If flat is clearly smoother, the metal is too heavy for the Mini.
  If only the glint is the difference, turn it off in Dashboard Settings
  (Glint) and keep the metal.
  Make flat the starting finish with Polish in Dashboard Settings (Screen tab):
  Flat is the flat finish with no glint, and Plain also leaves out the screws and
  the // in the panel headers. No code changes

If the Mini can only manage 30 frames a second, say so. That can still work if
it is steady, and it will help decide what to change.

The dashboard needs a browser at least as new as Chromium 84 or Firefox 75.
