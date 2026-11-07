#!/bin/bash
# Usage: supervisor-status.sh   (make supervisor-status)
# What the computer thinks is wrong, what it has tried, and whether it has stopped trying. Reads only the files the
# health timer and the supervisor write, so it works with the network down and needs no key.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

state_dir=${TELETRAAN_STATE_DIR:-/var/lib/teletraan}
node_bin=${TELETRAAN_NODE:-node}

if [ ! -s "$state_dir/health.json" ]; then
  echo "There is no health file yet. Is teletraan-health.timer installed and on?"
  echo "  computer/scripts/install-health.sh installs it."
  exit 0
fi

if ! command -v "$node_bin" > /dev/null 2>&1; then
  echo "node is not installed, so the files cannot be read." >&2
  exit 1
fi

"$node_bin" -e '
const fs = require("node:fs");
const dir = process.argv[1];

function read(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(dir + "/" + name, "utf8"));
  } catch (error) {
    return fallback;
  }
}

const health = read("health.json", { checks: {} });
const supervisor = read("supervisor.json", {});
const ledger = read("reboot-ledger.json", {});
const checks = health.checks || {};
const names = Object.keys(checks);
const bad = names.filter(name => checks[name].ok === false);
const ago = at => {
  const ms = Date.now() - (typeof at === "number" ? at : Date.parse(at));
  if (!isFinite(ms)) return "at an unknown time";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return minutes + " minutes ago";
  const hours = Math.round(minutes / 60);
  return hours < 48 ? hours + " hours ago" : Math.round(hours / 24) + " days ago";
};

console.log(supervisor.words || (bad.length === 0 ? "Everything is fine." : bad.length + " checks are failing."));
console.log("mode: " + (supervisor.mode === "fix" ? "fixing" : "watching only, so nothing is restarted")
  + (supervisor.firstDay === "yes" ? " (the first day after it was installed)" : ""));
console.log("the checks were last written " + ago(health.generatedAt) + ", " + names.length + " of them, " + bad.length + " failing");

if (bad.length > 0) {
  console.log("\nfailing:");
  bad.forEach(name => {
    const kept = (ledger.problems || {})[name] || {};
    const paused = kept.degradedSince > 0 ? "  [automatic fixes paused: " + (kept.degradedWhy || "") + "]" : "";
    console.log("  " + name.padEnd(14) + checks[name].detail + " (since " + ago(checks[name].since) + ")"
      + (kept.lastStep > 0 ? ", last at step " + kept.lastStep : "") + paused);
  });
}

if (ledger.degradedAll) {
  console.log("\nAutomatic fixes are paused for the whole computer: " + ledger.degradedAll.why);
  console.log("Turn them back on with: node computer/scripts/ledger.mjs clear");
}

const actions = (ledger.actions || []).slice(-10).reverse();
if (actions.length > 0) {
  console.log("\nthe last things it did:");
  actions.forEach(item => console.log("  " + ago(item.at).padEnd(18) + "step " + item.step + " " + item.action + " for " + item.problem + " (" + item.note + ")"));
}

const reboots = (ledger.reboots || []).slice(-5).reverse();
console.log("\nreboots on record: " + (ledger.reboots || []).length);
reboots.forEach(item => console.log("  " + ago(item.at).padEnd(18) + item.reason + (item.problem ? " for " + item.problem : "")));
' "$state_dir"
