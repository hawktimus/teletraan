# Targets for the control page. The root Makefile includes computer/make/*.mk.

# Pictures of the five areas of the control page (Now, Show, Update, Computer, Details) at 390 by 844, 768 by 1024 and 1440 by 900, in
# light and dark, for the states all good, calendar failed, syncing, computer unreachable, publish in progress and empty, written
# to docs/reference/control-page/ (docs/control-page.md, "Pictures"). The page runs against a test copy of the service with made-up
# data and a fake computer, so no key is read and nothing leaves this machine. Playwright must load: run npm install in tools/ on a
# laptop, or give NODE_PATH a folder that has it. Never run this on the Teletraan computer.
.PHONY: control-screens
control-screens:
	node tools/control-screens.mjs
