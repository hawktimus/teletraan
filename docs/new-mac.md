# Setting up a new Mac

This is for a coach or student who needs the repository on another Mac. To change content you only need a browser and the Studio. You need the repository on a Mac to change the code.

1. Install the command line tools: open Terminal and run `xcode-select --install`. Follow the window that opens.
2. Install Node with nvm. The Studio needs Node 22.12 or newer. Get nvm from its page (github.com/nvm-sh/nvm), then run `nvm install 22` and `node --version` to check.
3. Get the repository. Either copy the Teletraan folder from another Mac, or clone it from the Teletraan computer with the git path (docs/control-page.md, The git path): `git clone <user>@<host>:/srv/teletraan.git teletraan`. Copying a folder needs no key and no account.
4. In Terminal, go to `teletraan/studio` and run `npm install`. This installs the Studio's packages. It takes a few minutes.
5. To try the dashboard, go to the `teletraan` folder and run `python3 tools/serve.py`, then open `http://localhost:8080/dashboard/?sample=1`.
6. To put your changes on the wall, open `http://teletraan.local:3229/control/` in a browser, sign in with the PIN, and use the Update tab (docs/control-page.md). You do not need an SSH key for that. Off the school WiFi, use the computer's Tailscale name in place of `teletraan.local`.

An SSH key is only needed for the git path and for the Mac tool (`tools/teletraan/teletraan-tool`). The Mac tool is the way in when the control page cannot be reached. docs/laptop-setup.md covers GitHub and signing in to Sanity for the Ship app.
