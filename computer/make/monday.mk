# Targets for the Monday panels. The root Makefile includes computer/make/*.mk.

# The pictures of the Department tasks, Projects and TV charts panels at 1920 by 1080, in three states (full, half full, empty) in
# every theme and in the views that can play each panel, written to docs/reference/ (docs/monday.md, "The pictures"). They are
# drawn from made-up tasks and projects. Playwright must load: run npm install in tools/ on a laptop, or give NODE_PATH a folder that has
# it. Never run this on the Teletraan computer.
.PHONY: monday-screens
monday-screens:
	node tools/monday-screens.mjs
