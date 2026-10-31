# Remote access

How a coach controls the Teletraan computer when nobody is on the school Wi-Fi. There are two layers. Layer A works today. Layer B is designed and not turned on.

## Layer A: control through Sanity (usable now)

Layer A needs nothing installed beyond what the Teletraan computer already runs. The Studio writes a request into Sanity. The computer asks Sanity every 30 seconds, outbound only, and does what the request says. No port is opened and no address of the school network is used.

### How to send a request

1. Open the Studio from any network and sign in.
2. Open Coaches only, Remote actions, Send an action.
3. Open the menu beside Publish and click a button.
4. Within about 30 seconds the fields Handled at and Result on the same page show what the computer did. Status of the computer, next to it, shows the rest.

The button writes the action, the time now and your first name into the page and publishes it. Nothing else is stored.

### What each button does

| Button | What it does |
| --- | --- |
| Restart dashboard | Restarts the browser that shows the screen. About a minute. |
| Restart services | Restarts the timers and the web server. The screen goes blank for a moment. Asks "Are you sure?" first. |
| Reboot computer | Restarts the whole computer. The screen is off for a few minutes. Asks "Are you sure?" first. |
| Sync now | Opens a short list: All sources, Calendars, Monday, Competition, News, Match13, Photos. The computer reads that source now instead of waiting for its timer. |
| Show a view | Opens a list: General, Prime, Nova, Family, Back to the schedule. The screen shows that view for an hour, then returns by itself. |
| Show a theme | Opens a list: Original, Cybertron, Retro, Foundry, Back to the schedule. The same, for a theme. |
| Pause rotation | Stops the pages changing for an hour. |
| Resume rotation | Starts the pages changing again. |

Show a view, Show a theme, Pause and Resume write the same hidden request fields of Dashboard Settings (`showView`, `previewTheme`, `pauseRotation`) that the control page writes. They end by themselves at the time written in them. Choosing Back to the schedule clears the request.

### What Status of the computer shows

- For each source: the last good read, the last failure and its reason (host names and addresses are removed).
- The network: whether the computer could reach the internet at its last sync, and since when.
- The last repair the network watchdog tried.
- The last request that was answered, who asked, and the result.
- The time of the last check.

The computer writes the same last result to `remote-last.json` in its data folder, for the control page to show, so the Studio and the control page tell one story.

### Limits

- The computer must be on and must reach Sanity. If the school blocks Sanity itself, Layer A does not work. The network watchdog and the heartbeat cover that case.
- A request older than 10 minutes is not run. It is marked `ignored: too old`. Click the button again.
- A request runs once. The answer is written to Sanity before anything runs.
- One reboot in 10 minutes. A second one is marked `ignored: a reboot already ran in the last 10 minutes`.
- One sync in a minute, of any kind. A second one is marked `ignored: a sync already ran in the last minute`.
- Only a fixed list of actions runs. The stored action and the view or theme must be exactly one of the words in `computer/scripts/remote-plan.mjs`. Anything else is marked `refused` and nothing runs. No text from Sanity is passed to a shell or to the helper.
- A show request is written to the published Dashboard Settings. If someone has an unpublished draft of Dashboard Settings open in the Studio, publishing that draft later can put the old request fields back. Use Back to the schedule if the screen is stuck on a view.
- The dataset is public. Requests hold a first name and times only.

More detail on the poller, its log and `make remote-status` is in docs/OPERATIONS.md, "Remote actions from Sanity".

## Layer B: the control page from anywhere (designed, not turned on)

Nothing in Layer B is installed or enabled by this repository. It needs the school's okay first.

The control page (`control/`, port 3229) is reachable only on the school network. To reach it from home, the Teletraan computer and your phone or laptop both join a private tunnel, such as a mesh VPN. The tunnel carries traffic between your devices only. The page is not put on the public internet.

### What the page already does for this

- It uses relative URLs only. No `teletraan.local` or school address is written in the page or its links, so it works under whatever hostname the tunnel gives it.
- It works over HTTPS served from a different hostname.
- It keeps its PIN, and locks for a short time after repeated wrong PINs.

### What to install, when the school agrees

1. On the Teletraan computer: a private tunnel client, signed in to a team account. Run it as a service so it starts at boot.
2. On each phone or laptop that may use it: the same client, signed in to the same account.
3. Give the computer a name in the tunnel, and open the control page at that name from a device that is on the tunnel.
4. If HTTPS is wanted on that name, use the certificate the tunnel provides, in front of the control page. Keep port 3229 closed to everything else.
5. Write down which accounts have access and remove a student's device when they leave.

### What to ask school IT

- Is it allowed to run a private tunnel client on a device on the school network?
- Does the network allow the outbound connections the client needs (usually HTTPS to the provider and UDP for direct links)?
- Who owns the account, and who may add or remove devices?
- Is there a rule about remote access to devices in classrooms?

If the answer to any of these is no, stay on Layer A.

### What does not change

The PIN, the keys on the Teletraan computer and the rule that no secret is stored in the repository or in Sanity stay as they are. Never put a key in a message when asking for access.
