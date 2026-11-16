# Targets for the health checks, the supervisor, the display and the diagnostic reports. The root Makefile includes
# computer/make/*.mk. docs/OPERATIONS.md explains each one.

.PHONY: version health supervisor-status supervisor-test display-status display-test watchdog-test diag diag-last dns-status

version: ## The build version this copy is, and the release the computer runs
	@printf 'version: %s\n' "$$(cat VERSION 2> /dev/null || echo unknown)"
	@printf 'commit:  %s\n' "$$(git rev-parse --short HEAD 2> /dev/null || echo 'not a checkout')"
	@[ ! -f RELEASE.json ] || printf 'release: %s\n' "$$(sed -n 's/^ *"version": *\([0-9]*\).*/\1/p' RELEASE.json | head -n 1)"

health: ## What each health check says right now (writes the file first)
	@$(SCRIPTS)/health.sh --print

supervisor-status: ## What the supervisor is doing, what it has tried, and whether anything is paused
	@$(SCRIPTS)/supervisor-status.sh

supervisor-test: ## Walk the whole ladder and the reboot gate with a fake clock and fake checks
	@node tests/supervisor.test.mjs

display-status: ## The screen, its mode, and the last display events
	@$(SCRIPTS)/display-watch.sh --status

display-test: ## Print the display recovery path without touching the screen
	@$(SCRIPTS)/display-watch.sh --test

# Never run by anything automatically: it reboots the computer on purpose to find out whether the hardware watchdog
# brings it back (docs/OPERATIONS.md, "The hardware watchdog").
watchdog-test: ## Check whether this computer has a hardware watchdog, and say what turning it on would mean
	@$(SCRIPTS)/watchdog-device.sh

diag: ## Write a diagnostic report and print where it is
	@$(SCRIPTS)/diag.sh

diag-last: ## Print the newest diagnostic report
	@$(SCRIPTS)/diag.sh --list | head -n 1 | cut -f3 | xargs -r cat

dns-status: ## The name servers that are configured and the ones in use, and whether they agree
	@$(SCRIPTS)/dns-status.sh
