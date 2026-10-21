# FRC news

For the coaches and the students who look after the screen. The FRC news panel shows the newest headlines from the FIRST community blog, such as news about the SystemCore control system, so the team sees what is going on in FRC. This page says where the news comes from, what is stored, what the screen shows, how to hide a headline, how to add a category and what to do when it stops.

Headlines only. The text of a post stays on FIRST's site.

## Where the news comes from

The FIRST community blog has a public feed at `https://community.firstinspires.org/rss.xml`. Every 2 hours the Teletraan computer reads it with `computer/scripts/news-sync.sh`. The script needs `curl` and `jq`, and reads the feed with a small awk program, `news-rss.awk`, so nothing else has to be installed. It sends one polite request with a plain name in it and keeps no copy of the feed.

The script keeps the posts that have one of the categories chosen in Studio. The starting categories are FRC and Control System. It keeps the newest 10.

## What is stored

One document in Sanity with the fixed id `frc-news` and the type `frcNews`. The script replaces it as a whole. The dataset is public, so only public facts are in it:

- `lastSyncAt`: when the script last read the blog
- `lastError`: what went wrong in the last read, in plain words. It is only there after a failed read
- `items`: up to 10 headlines, newest first. Each has `title` (cut to 140 characters at a word), `link`, `date`, `categories`, `systemcore` (true when the title or a category says SystemCore, in any case) and `source` (always FIRST)
- `hiddenItems`: the headlines an editor hid, in the same shape, so Studio can offer to show them again

The description and the text of a post are never read into the document. The date is the date the blog gives, as UTC time.

When the blog cannot be read, the old list stays and `lastError` says why. A blog with no post in the chosen categories gives an empty list and no error. A page that is not a feed, or a feed with no posts, counts as a failed read and changes nothing.

## What the screen shows

- The panel FRC news in the large frame. The header says FRC NEWS and FROM FIRST. Up to five headlines show, newest first, each with its date such as Sep 23. The first one is bigger. A SystemCore chip sits after a headline about SystemCore. A headline wraps, up to three lines. A long one is cut at a word with three dots, which is the one case a headline is cut. Rows are left out before they would not fit.
- Headlines older than 60 days are not shown. The panel is skipped when there is nothing to show, when Read FRC news is off, and when the document is missing.
- An amber STALE chip shows in the header when the list was written more than 12 hours ago.
- The panel is for both teams. It is not in the default rotation: add it yourself (below).
- With Show news in the ticker on, the newest three headlines join the ticker as FIRST: and the headline, at most 90 characters and cut at a word.

`?sample=1` shows three sample headlines in brackets. The Studio preview list has FRC news too.

## Turn it on

1. The timer is installed by the update from the Mac tool (`tools/teletraan/teletraan-tool update`, which runs `install-news.sh` with the others). By hand: `sudo /opt/teletraan/computer/scripts/install-news.sh`. It installs no package. The computer needs `SANITY_WRITE_TOKEN` in `local.env`, the same key the other timers use.
2. In Studio open Competition. Under FRC news check Read FRC news and the categories. Click Publish all.
3. Open Rotation and add a row with the panel FRC news (group Competition, news, drive and robot). Click Publish all.
4. To read the blog now, open the control page, Settings, Sync and restart, and click Sync news now. The Last reads card says FRC news with the time and the number of headlines. Studio's status block says Last news read.

## Hide a headline

Open Competition, then FRC news. Each headline has a Show switch. Turn Show off and click Publish all in the top bar. The TV drops it at the next refresh of the content, and the next one takes its place. The address of a hidden headline is saved in Dashboard Settings, so it stays hidden when the computer reads the blog again. A hidden headline stays in the list marked Hidden, and turning Show on again brings it back.

## Add a category

The categories are the ones the blog puts on a post, such as FRC, FTC, Control System, Featured or Kickoff. Open Competition, FRC news, type the name under Add a category and click Add. Case does not matter. Up to 12 categories. Remove all of them and the starting two are used again. Click Publish all, then Sync news now on the control page to see the change.

## If it stops

| What you see | What to do |
|--------------|------------|
| The panel is not in the rotation | Add it to a row of the Rotation, and check that Read FRC news is on |
| No headlines yet | Wait up to 2 hours, or click Sync news now. Check that the categories match the ones on the blog |
| STALE in the header | The computer has not read the blog for 12 hours. Check Settings, Sync and restart, Last reads, and Last error under FRC news in Studio |
| Last error says it could not find the server | The network is down. The old list stays and the next read is in 2 hours |
| Last error says the answer is not the feed | The blog changed its address or its form. Check the address in `news-sync.sh` (`feed_url`) |
| Nothing on the control page | The timer is not installed. Run `install-news.sh` |

To run it by hand on the Teletraan computer: `/opt/teletraan/computer/scripts/news-sync.sh`. With `--dry-run` it prints the document and writes nothing. `systemctl status teletraan-news.service` and `journalctl -u teletraan-news.service` say how the last run went.

## Settings, in short

Four fields of Dashboard Settings hold the choices, and the FRC news section of the Competition page writes them to the draft: `newsEnabled` (on to start), `newsCategories` (FRC and Control System), `newsInTicker` (off) and `newsHiddenLinks` (empty). Dashboard Settings hides them.
