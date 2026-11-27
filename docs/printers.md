# 3D printers

For the coaches and the students who look after the screen. When one of the Elegoo Centauri Carbon printers is printing, the dashboard adds two panels to its normal rotation: a large one with the live camera picture, and a small one with the file, the times and the progress. When nothing is printing, neither panel shows. This page says how it works, how to set it up, how to read the screen and what to do when it does not show.

## What the screen shows

- **PRINTING** (large frame): the live camera picture of the printer, with the file name, the percent done and a progress bar under it. The tag says LIVE and the printer's name. The picture is a still that is replaced about twice a second. It says WAITING FOR THE CAMERA until the first picture arrives, and PRINT ENDED when the print stops.
- **Printer name** (small frame): the file being printed, a progress bar and percent, and three figures: ELAPSED, LEFT and DONE (the estimated time it finishes, in the dashboard's time zone).
- Each printer that is printing gets its own turn of **2 minutes**. With two or three printing, the rotation goes through them one after another, each 2 minutes, mixed in with the other panels. A printer that finishes drops out at the end of its turn.
- Only the file name is shown, never a picture of the model. No thumbnail is fetched on purpose: asking a printer for a command it does not know can stop a print.

## How it works

1. `computer/scripts/printer-sync.mjs` runs all the time as the service `teletraan-printers` (`computer/systemd/teletraan-printers.service`). It talks to each printer on the local network with the printer's own protocol (SDCP v3, a WebSocket on port 3030) and asks for its status every 4 seconds. It uses no key and no login.
2. It writes `<data>/printers/status.json` every 2 seconds. Each printer has an entry: online or offline, printing or not, and while printing the file, percent, layer, times and the estimated finish. The addresses of the printers and their board ids are never written to it.
3. While a printer is printing, the service also opens its camera (`http://<ip>:3031/video`) and writes the newest picture to `<data>/printers/<id>/frame.jpg` about 2.5 times a second. The picture is deleted when the print ends.
4. The dashboard reads `printers/status.json` every 3 seconds (`dashboard/core/printers.js`) and adds the two panels `printer` and `printer-file` to the rotation for each printer that is printing.

A printer allows 5 connections in all. The service keeps one per printer and never more. If a printer has been reached by another program (the Elegoo app, Cura, a slicer), close that program if the service says the printer is busy.

## Setting it up

1. The printers and the Teletraan computer must be on the same network. At the team's room that is HawktimusDotNet. At the school the computer is on the school wifi, where the printers cannot be reached, so the panels never show there.
2. Give each printer a fixed address on the router, so it does not change.
3. On the Teletraan computer, run `sudo /opt/teletraan/computer/scripts/install-printers.sh`. It copies the service into place, turns it on and makes `/var/lib/teletraan/printers.json` with no printers if it is not there yet. It installs nothing else and needs no key.
4. Put the printers in `/var/lib/teletraan/printers.json` (the example is `computer/config/printers.example.json`):

```json
{
  "printers": [
    { "id": "1", "name": "Printer 1", "ip": "192.168.0.101" },
    { "id": "2", "name": "Printer 2", "ip": "192.168.0.102" },
    { "id": "3", "name": "Printer 3", "ip": "192.168.0.103" }
  ]
}
```

   `id` is short and unique, `name` is what the screen shows, `ip` is the printer's address. The optional fields are `port` (3030), `videoPort` (3031) and `mainboardId` (found by the service by itself). At most 8 printers. The service re-reads the file every minute, so no restart is needed after changing it.

## When it does not show

| What you see | What it means |
|---|---|
| No printer panel while a print is running | The computer cannot reach the printer (different network), the address is wrong, or `status.json` is missing. Run `journalctl -u teletraan-printers -n 50` and look at `/var/lib/teletraan/data/printers/status.json` |
| The panel shows WAITING FOR THE CAMERA | The print is seen but the camera picture is not coming. The service asks the printer for its camera address once and tries that. Open `http://<ip>:3031/video` in a browser on the same network to check the camera itself |
| Times look wrong by a large factor | The printer reports times in a unit the service did not guess right. The service treats a very large number as milliseconds. Tell the team mentor, with one line of `status.json` |
| The service is not running | `systemctl status teletraan-printers`. It restarts itself after 10 seconds. Run the install script again after an update of the files. The control page says so too: when `status.json` has not been written for two minutes, the Attention list on Now has a line about the printer service (never the TV) |

## What is checked

`tests/printer-sync.test.mjs` runs the service against a pretend printer (`tests/helpers/printer-sim.mjs`), `tests/printers.test.mjs` covers the dashboard side and `tests/install-printers.test.mjs` the install script. To try it by hand without a printer, run `node tests/helpers/printer-sim.mjs 3030 3031 printing` on a computer and put its address in the printers file.

The real printers were not reachable when this was written, so the first print on the HawktimusDotNet network is the real test: check that the times, the percent and the camera look right, and tell the team mentor if not.
