# The half-drawn screen: what was found, and what to capture on the computer

The fault, seen two days in a row: when the TV is switched to the Mini's input, or powered on, the dashboard shows a
half-rendered frame. Black upper area with wireframe and plates, a solid light-blue block over the lower half, gold
fragments, corner screws. "Reset screen" from the Control page fixes the picture, but the four status dots then show
amber for a while. The Control page shows all green the whole time. A full reboot fixes everything, dots included.

## This was worked out from the code, not from the hardware

**Nothing here was reproduced on the computer.** There is no Mac Mini, no TV and no kiosk browser on the machine this
was written on. What follows is from reading the code, and it explains every part of what was seen, including the parts
that looked unrelated. The fixes are in build 1.1.0. The first real rollout is the first real test, and the list at the
end says what to capture if it happens again.

## Why the picture stops half way

A transition is built out of waits for the next painted frame. `nextFrame()` was
`new Promise(resolve => requestAnimationFrame(resolve))`, with no timeout, and the Light transitions awaited
`animation.finished` the same way.

When Chromium stops painting — the TV off, the input switched away, the output gone — it does not run those callbacks
and does not finish those animations. It keeps the page's timers running. So:

1. A transition starts. It draws flat copies of the old and new panels over the real page, opens the plates, and starts
   the camera move. This is the half-drawn picture: it is a transition that is correct for its first frame.
2. Painting stops. The next `await nextFrame()` never returns.
3. The run never reaches its `finally`, so the layer is never emptied, the copies are never removed, the lock on the
   rotation is never let go and the busy flag stays set.
4. Painting comes back. Nothing finishes the transition, because the code that would is parked on an await that will
   never resolve. The frame that was correct for one moment stays on the wall.

The rotation is stopped as well, which is why it never moves on to a different panel and fixes itself by accident.

## Why the watchdog did not restart it

`heartbeat.js` wrote the time into the page title every 30 seconds from a `setInterval`. `watchdog.sh` reads that title
over the browser's debugging port and restarts the screen when the clock stops moving.

A `setInterval` keeps firing when painting has stopped. So the title kept updating, the watchdog saw a healthy page,
and the one thing that could have restarted the screen by itself had no reason to. The heartbeat was proving that the
clock was running, which was never the question.

## Why the dots went amber after a restart, while the Control page stayed green

Two different questions, answered from two different places:

- The TV's Monday and Band dots came from Sanity status documents that the computer writes, round-tripped through
  Sanity and back into `content.json`.
- The Control page reads the live files on the computer and probes Sanity itself.

After a restart the sync service **restored the read times from the file it wrote before the restart**, and the
calendar and Monday timers were not run at boot. So the wall showed stamps that were up to fifteen or thirty minutes
old and drew them amber, while the Control page looked at the live files and saw everything was fine. Both were telling
the truth about different things. Nothing was broken; the wall was reporting on a read that had not happened yet in
this run.

## Why a reboot fixed it and a reset did not

"Reset screen" restarts the browser, which fixes the picture. It does not restart the sync service, so the restored
stale stamps were still there and the dots stayed amber until the next real read. A reboot restarts everything, so the
stamps were rewritten from scratch.

## Why the display can come back at the wrong size

`set_display` runs once, from `kiosk.sh`, when the screen session starts. Nothing listened for the output going away
and returning. A TV that was off, or on another input, renegotiates when it comes back and can come back at its own
4K mode with no scaling, and nothing re-applied the setup. The dashboard then draws 1920x1080 into a framebuffer that
is not 1920x1080.

## Why Full transitions were probably never seen on this wall

The frame budget was a fixed 34 ms. The TV offers only 3840x2160 at 30 Hz, where every frame takes 33.3 ms. Against
34 ms, nearly every frame of every transition counted as slow, two transitions in a row "missed", and the page dropped
itself to Light transitions for the rest of the day. This is not the fault above, but it was found while reading it,
and it means the heavy transitions almost certainly never played on the wall.

## What to capture if it happens again

The Control page now does all of this in one go: **Details, Debug, Create a report**. The computer also writes one by
itself before it restarts anything, in `/var/lib/teletraan/incidents`. Read that first — it was written while the wall
was still wrong.

If the report cannot be made, capture these by hand before restarting anything, because a restart destroys the
evidence:

```bash
DISPLAY=:1 xrandr --verbose
journalctl -k --since '30 min ago' --no-pager | grep -iE 'drm|hdmi|edid|i915|gpu'
curl -s http://127.0.0.1:9222/json | head -40          # the page title: a clock, or FROZEN
python3 computer/scripts/page-command.py frames        # seconds since the last painted frame
cat /var/lib/teletraan/health.json
cat /var/lib/teletraan/display.json
tail -40 /var/lib/teletraan/display-events
cat /var/lib/teletraan/data/sync-status.json
journalctl -u teletraan-kiosk -n 100 --no-pager
ps -o pid,rss,etimes,comm -C chromium
```

And a photograph of the TV. Which parts of the frame are drawn says which stage of which transition it stopped at.

## What tells us whether the fixes worked

- The page title says `FROZEN` while nothing is being painted, and the watchdog log says `no frames`.
- A transition that overstays logs "did not finish in time, so the screen was put in its end state".
- `display-events` logs `display_connected`, `reapplied_mode`, `reload` and, only if the reload did not help,
  `kiosk_restart`.
- The dots after a restart start as "not known yet" rather than amber, and go green within a minute of a boot.
- `make health` says `frames` passes, and the Screen dot on Now is green only when it does.
