#!/usr/bin/env bash
# update-skillsets.sh — pull the latest version of every (or one) tracked
# external skillset and refresh it in place.
#
# Reads .skillsets.json — the record install-skillset.sh keeps of every
# external skillset that's been imported, where it came from, and exactly
# which skills were imported — and re-syncs each one against its source.
#
# Usage:
#   bash update-skillsets.sh [options]
#
# Options:
#   --source <substring>   Only update tracked skillsets whose source repo
#                          URL contains this substring (e.g. --source
#                          superpowers). Default: check and update all of
#                          them.
#   --include-new           Also pick up skills that exist upstream now but
#                          weren't imported originally (new skills added to
#                          the source repo since, or ones excluded with
#                          --only the first time). Default: only refresh
#                          what's already here — never silently expands
#                          what you have.
#   --dry-run               Check every tracked source for upstream changes
#                          and report what would update, without touching
#                          the filesystem.
#   --skip-setup             Don't run setup.sh at the end even if
#                          something changed.
#
# This is the "single update command" half of the workflow —
# install-skillset.sh is for bringing a NEW skillset in for the first
# time; this is for keeping ones you already have current. Run it
# whenever, or wire it into the same scheduled job that does `git pull`
# for the repo itself.
#
# Examples:
#   bash update-skillsets.sh --dry-run
#   bash update-skillsets.sh --source superpowers

set -euo pipefail

SKILLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

usage() {
  sed -n '2,33p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

for arg in "$@"; do
  case "$arg" in
    -h|--help) usage ;;
  esac
done

if ! command -v node &>/dev/null; then
  echo "✗ update-skillsets.sh requires Node.js." >&2
  exit 1
fi
if ! command -v git &>/dev/null; then
  echo "✗ update-skillsets.sh requires git." >&2
  exit 1
fi

node "$SKILLS_DIR/skill-update/scripts/update-skillsets.mjs" "$@"
