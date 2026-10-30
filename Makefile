# Teletraan I: the commands to type on the Teletraan computer (over ssh) or in a checkout on a laptop.
# Run "make" or "make help" to see them. They only read and report; none of them changes the screen.
#
# Another file in computer/make/ ending in .mk adds its own targets here without touching this file.

.DEFAULT_GOAL := help

SCRIPTS := computer/scripts
# make logs SERVICE=sync LINES=100 shows one service and more lines
SERVICE ?=
LINES ?= 20

.PHONY: help logs net-status net-test heartbeat-test allowlist sync-once

help: ## List the commands
	@echo "Teletraan I commands (docs/OPERATIONS.md explains each one):"
	@echo
	@grep -hE '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | sed 's/:.*## /\t/' | awk -F'\t' '{ printf "  make %-16s %s\n", $$1, $$2 }'

logs: ## Newest lines of the service logs (SERVICE=sync LINES=100 to pick one)
	@$(SCRIPTS)/logs.sh "$(SERVICE)" "$(LINES)"

net-status: ## How each source and netwatch are doing, from the files they keep
	@$(SCRIPTS)/net-status.sh

net-test: ## Run the full diagnostic once for every source and print a table
	@$(SCRIPTS)/net-hosts.sh test

heartbeat-test: ## Send one ping and one push message and say how each went
	@$(SCRIPTS)/heartbeat.sh --test

allowlist: ## The hostnames this computer contacts, to send to the school IT office
	@$(SCRIPTS)/net-hosts.sh allowlist

sync-once: ## Read Sanity and the weather once into dashboard/data/live (a laptop with no sync service)
	@TELETRAAN_DATA=dashboard/data/live TELETRAAN_LOG_DIR=$${TELETRAAN_LOG_DIR:-/tmp/teletraan-log} node $(SCRIPTS)/sync-service.mjs --once

-include computer/make/*.mk
