# Clean up expired items

Items in the Studio that have a Hide after date, an end or a day (a tip, an announcement, a photo, an agenda item and so on) stay in the lists after they expire. The Teletraan computer can delete them for you, a while after they expired. It is off to start with, and when you turn it on it only makes a list until you tell it to delete.

Deleting cannot be undone from the Studio, so the job is careful. Read "What it never deletes" before turning it on.

## Turn it on, safely

1. Open Dashboard Settings in the Studio, tab Advanced, section Clean up expired items. The control page has the same card: Settings, Clean up expired items.
2. Leave Mode on Only show what would be deleted. Turn on Clean up expired items and click Publish.
3. Press Show what would be deleted now on the control page, or wait for the next morning. Every night at 03:40 the computer writes a list of what it would delete. The control page shows it with the title, the kind, the day it expired and how long ago. The Check the screen page in the Studio says whether the clean up is on and what it last did.
4. Read the list for a few days. When every line on it is something you would delete by hand, set Mode to Delete the items and publish. From then on the computer deletes at 03:40, and the control page shows a Delete these now button when the list is not empty.

The Studio and the control page change the same three fields, so what one shows, the other shows.

## What is deleted

An item is deleted when it expired more than the number of days in Wait this many days ago (14 to start with, from 1 to 365). The published item and its draft go together. The rules, one for each kind:

| Kind (Studio name) | Expired when |
| --- | --- |
| Tips and news | Hide after has passed |
| Announcements | Ends at has passed |
| Photos | Hide after has passed. The picture file stays in Sanity |
| Agenda items | the Date and Hide after have both passed (the later one counts) |
| Leadership (people) | Hide after has passed |
| Team leads (roster) | Hide after has passed |
| Subteams | Hide after has passed |
| Sponsors | Hide after has passed |
| Calendar filters | To date and Hide after have both passed (the later one counts) |
| Talks (presentations) | the start is more than the wait ago |

## What it never deletes

- Anything that is not in the table: teams, Dashboard Settings, the Look rules, the views and screens, Monday tasks and milestones (the Monday sync owns them), the status documents the computer writes, FRC news, calendar status, extra panels and the Events Calendar.
- An item with no date, or a date that cannot be read. An unreadable one is named in the list so that you can fix it.
- An item that was edited in the last 48 hours, published or draft. Editing an old item keeps it for two more days.
- A draft that was never published and was edited in the last 14 days.
- An item whose draft has a later date than the published copy: every copy has to be old enough.
- An item that was edited while a run was going.

## The limits

- At most 100 documents a run, the oldest first. The rest wait for the next night.
- If the list holds more than 40 percent of all the documents of one kind, the run stops and deletes nothing at all. That many usually means a wrong date, not a clean up. The status says which kind. Look at the dates in the Studio, or delete the old ones by hand once, and the next run goes on. A kind with only a few documents, such as sponsors, can reach 40 percent with one expired item. Delete that one by hand.
- Every run writes a list first, and a delete run saves a backup of the documents before the first delete. If the backup cannot be made or saved, nothing is deleted.
- One document that Sanity refuses to delete does not hold back the others. It is named in the list and in the status.

## The files, and getting an item back

The files are in the data folder of the computer (`/var/lib/teletraan/data/cleanup`), kept for 30 days:

- `list-<time>.txt` is the plain text list of a run: what was on it, what was kept and why, and what was deleted.
- `backup-<time>.json` is every document a delete run deleted, with its draft, as it was.
- `status.json` is what the Studio and the control page show as the last run.

To put the items of a backup back, open a terminal on the computer (or use SSH, docs/updating-the-computer.md) and run:

```
/opt/teletraan/computer/scripts/expired-cleanup.sh --restore /var/lib/teletraan/data/cleanup/backup-20261021T034000Z.json
```

It puts back every document of the file that is not there now, and leaves a document that exists alone. It only puts back the kinds in the table above. A restored item still has its old date, so change the date in the Studio, or it is deleted again after 48 hours plus the wait when the clean up is on. The picture of a restored photo is still in Sanity, because the clean up never deletes picture files.

The backup of the whole dataset (docs/coaches-guide.md, "Restoring a backup") is a second safety net. It runs at 03:15, before the clean up at 03:40.

## Install and check

`install-cleanup.sh` copies two unit files (`teletraan-cleanup.service` and `teletraan-cleanup.timer`) and turns on the timer. The update from the Mac tool runs it with the others. It needs `curl`, `jq`, Node 18 or newer and `flock`, and the key SANITY_WRITE_TOKEN in Keys. The job runs as the login user and needs no sudo rule.

To run it by hand on the computer:

```
/opt/teletraan/computer/scripts/expired-cleanup.sh --dry-run
```

shows the list and writes the list file, and deletes nothing. `journalctl -u teletraan-cleanup.service -n 20` shows the last night.

| What you see | What it means |
| --- | --- |
| Last run: not yet | The timer has not run since it was installed, or the switch is off |
| 0 deleted and some on the list | Mode is Only show, or the run stopped. Read the problem line |
| Stopped, more than 40 percent | See "The limits". Nothing was deleted |
| The backup could not be made | Sanity did not answer or the disk is full. Nothing was deleted |
| Mode is List only, so nothing was deleted | The Delete these now button was pressed while the published Mode is Only show |
