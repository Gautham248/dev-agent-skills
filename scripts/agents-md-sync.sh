#!/usr/bin/env bash
# agents-md-sync.sh — manage a project's AGENTS.md against this repo's
# canonical standing rules (config/AGENT-STANDING-RULES.md), using a sha256
# sidecar file for ownership/integrity detection instead of an in-file marker.
#
# Why this exists: Rule 0 in AGENT-STANDING-RULES.md used to tell the agent
# to hand-copy its own standing rules into AGENTS.md verbatim, and to treat
# ANY existing AGENTS.md as equivalent to its own. Two failure modes followed
# from that: (1) an AGENTS.md created by something else entirely — most
# commonly `opencode /init` run before this repo was set up — got silently
# treated as if it were ours, with none of these rules actually in it; (2)
# LLM-driven "copy verbatim" is inherently unreliable for a large document.
# This script fixes both: it reads the canonical file directly (no
# regeneration risk) and tracks provenance via a committed hash sidecar
# rather than trusting file content alone.
#
# Run from the target PROJECT's root directory (the workspace, not this
# skills repo). Usage:
#   agents-md-sync.sh status   # prints one state word, see below, exit 0 always
#   agents-md-sync.sh write    # create AGENTS.md, or refresh it if stale (case 1 / case 3)
#   agents-md-sync.sh append   # merge into an existing foreign AGENTS.md (case 2)
#   agents-md-sync.sh accept   # re-baseline the sidecar to whatever AGENTS.md
#                               # currently contains, without touching the file.
#                               # For a deliberate hand-edit of a file we
#                               # generated (AGENTS_TAMPERED), or a pre-existing
#                               # foreign file the team decides to keep as-is
#                               # (AGENTS_FOREIGN) rather than merge into.
#
# States printed by `status`:
#   NO_AGENTS          — no AGENTS.md in this project yet
#   AGENTS_OURS_FRESH   — ours, sidecar matches, and rules haven't changed since
#   AGENTS_OURS_STALE   — ours (sidecar matches file), but the canonical rules
#                         have changed since this copy was written — safe to
#                         auto-refresh, nobody has hand-edited it
#   AGENTS_TAMPERED     — sidecar exists but doesn't match the file's current
#                         content — someone edited it since we last wrote it.
#                         Treated cautiously, same as foreign: don't auto-touch.
#   AGENTS_FOREIGN      — AGENTS.md exists but there's no sidecar at all — most
#                         likely created by something else (e.g. `opencode
#                         /init`) or hand-written before this repo was set up.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STANDING_RULES="$SKILLS_DIR/config/AGENT-STANDING-RULES.md"

AGENTS_FILE="AGENTS.md"
SIDECAR_FILE=".agents-md.sha256"

BEGIN_MARK="<!-- BEGIN dev-agent-skills managed block (do not edit by hand -- source of truth is $STANDING_RULES) -->"
END_MARK="<!-- END dev-agent-skills managed block -->"

hash_file() {
  # Portable sha256: prefer sha256sum (GNU/Linux), fall back to shasum -a 256
  # (macOS/BSD), fall back to openssl if neither is present.
  if command -v sha256sum &>/dev/null; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum &>/dev/null; then
    shasum -a 256 "$1" | awk '{print $1}'
  elif command -v openssl &>/dev/null; then
    openssl dgst -sha256 "$1" | awk '{print $NF}'
  else
    echo "agents-md-sync.sh: no sha256sum, shasum, or openssl found — cannot hash." >&2
    exit 2
  fi
}

require_standing_rules() {
  if [ ! -f "$STANDING_RULES" ]; then
    echo "agents-md-sync.sh: canonical file not found at $STANDING_RULES" >&2
    exit 2
  fi
}

resolve_placeholders() {
  # Prints the canonical rules to stdout with the two machine-specific script
  # pointers substituted in — never touches $STANDING_RULES on disk. This is
  # the ONLY place either placeholder is ever resolved: config/AGENT-STANDING-RULES.md
  # stays a stable, byte-identical template on every machine and in every
  # commit, forever. Resolution and hashing (in cmd_write/cmd_append) happen
  # on the exact same in-memory content, so the sidecar can never describe
  # anything other than what's actually on disk in $AGENTS_FILE.
  require_standing_rules
  local sync_script_path="$SKILLS_DIR/scripts/agents-md-sync.sh"
  local work_log_cli_path="$SKILLS_DIR/scripts/work-log-cli.mjs"
  sed \
    -e "s|__AGENTS_MD_SYNC_SCRIPT__|$sync_script_path|g" \
    -e "s|__WORK_LOG_CLI_SCRIPT__|$work_log_cli_path|g" \
    "$STANDING_RULES"
}

write_sidecar() {
  # $1 = full-file hash, $2 = canonical-rules hash, at the moment of writing
  {
    echo "$1"
    echo "$2"
  } > "$SIDECAR_FILE"
}

cmd_status() {
  if [ ! -f "$AGENTS_FILE" ]; then
    echo "NO_AGENTS"
    return 0
  fi
  if [ ! -f "$SIDECAR_FILE" ]; then
    echo "AGENTS_FOREIGN"
    return 0
  fi

  local stored_full stored_canonical actual_full actual_canonical
  stored_full=$(sed -n '1p' "$SIDECAR_FILE")
  stored_canonical=$(sed -n '2p' "$SIDECAR_FILE")
  actual_full=$(hash_file "$AGENTS_FILE")

  if [ "$actual_full" != "$stored_full" ]; then
    echo "AGENTS_TAMPERED"
    return 0
  fi

  require_standing_rules
  actual_canonical=$(hash_file "$STANDING_RULES")
  if [ "$actual_canonical" = "$stored_canonical" ]; then
    echo "AGENTS_OURS_FRESH"
  else
    echo "AGENTS_OURS_STALE"
  fi
}

cmd_write() {
  local force="${1:-}"
  local state
  state=$(cmd_status)

  case "$state" in
    NO_AGENTS|AGENTS_OURS_STALE)
      : # proceed below
      ;;
    AGENTS_OURS_FRESH)
      echo "AGENTS.md is already up to date — nothing to do."
      return 0
      ;;
    AGENTS_FOREIGN|AGENTS_TAMPERED)
      if [ "$force" != "--force" ]; then
        echo "Refusing to overwrite: current state is $state. Use 'append' for a foreign AGENTS.md, or pass --force to overwrite anyway." >&2
        exit 1
      fi
      ;;
  esac

  require_standing_rules
  resolve_placeholders > "$AGENTS_FILE"
  local full_hash canonical_hash
  full_hash=$(hash_file "$AGENTS_FILE")
  canonical_hash=$(hash_file "$STANDING_RULES")
  write_sidecar "$full_hash" "$canonical_hash"
  echo "Wrote $AGENTS_FILE from $STANDING_RULES (was: $state)."
}

cmd_append() {
  local force="${1:-}"
  local state
  state=$(cmd_status)

  if [ "$state" = "NO_AGENTS" ]; then
    echo "No existing AGENTS.md — use 'write' instead of 'append'." >&2
    exit 1
  fi
  if [ "$state" != "AGENTS_FOREIGN" ] && [ "$force" != "--force" ]; then
    echo "Refusing to append: current state is $state, not AGENTS_FOREIGN. Pass --force to append anyway." >&2
    exit 1
  fi

  require_standing_rules
  {
    echo ""
    echo "$BEGIN_MARK"
    resolve_placeholders
    echo ""
    echo "$END_MARK"
  } >> "$AGENTS_FILE"

  local full_hash canonical_hash
  full_hash=$(hash_file "$AGENTS_FILE")
  canonical_hash=$(hash_file "$STANDING_RULES")
  write_sidecar "$full_hash" "$canonical_hash"
  echo "Appended dev-agent-skills managed block to the existing $AGENTS_FILE (was: $state). Nothing above the BEGIN marker was touched."
}

cmd_accept() {
  local state
  state=$(cmd_status)

  if [ "$state" = "NO_AGENTS" ]; then
    echo "No $AGENTS_FILE exists yet — nothing to accept. Use 'write' to create one." >&2
    exit 1
  fi

  local full_hash stored_canonical
  full_hash=$(hash_file "$AGENTS_FILE")
  # accept's job is narrow: "stop flagging THIS content as tampered." It is
  # not "declare this content in sync with current canonical rules" — those
  # are different claims, and only the first one is actually being verified
  # here. Preserve whatever canonical-rules hash was already tracked (if a
  # sidecar existed at all, i.e. AGENTS_TAMPERED) so a genuine rules change
  # still correctly surfaces as AGENTS_OURS_STALE on the next status check,
  # instead of being masked as fresh. Recomputing it fresh here was the bug:
  # it let a later `write` see "canonical hash already matches" and skip a
  # real resync that should have happened.
  if [ -f "$SIDECAR_FILE" ]; then
    stored_canonical=$(sed -n '2p' "$SIDECAR_FILE")
  else
    # AGENTS_FOREIGN case: no prior sidecar, so there is no prior canonical
    # baseline to preserve — this content has no relationship to canonical
    # rules at all yet. Fall back to the current canonical hash; the first
    # `status` after any real rules change will correctly report STALE from
    # that point forward, which is the best available baseline here.
    require_standing_rules
    stored_canonical=$(hash_file "$STANDING_RULES")
  fi
  write_sidecar "$full_hash" "$stored_canonical"

  case "$state" in
    AGENTS_TAMPERED)
      echo "Accepted the current $AGENTS_FILE as the new baseline (was: $state). Content left exactly as it is -- whoever edited it, that edit is now the tracked version. Future status checks will treat this as ours until it's edited again."
      ;;
    AGENTS_FOREIGN)
      echo "Accepted the current $AGENTS_FILE as the new baseline (was: $state). Content left exactly as it is -- note this file still contains none of dev-agent-skills' standing rules, since 'accept' only changes what gets tracked, not what the file says. Run 'append' instead if you actually want the rules merged in."
      ;;
    *)
      echo "Accepted the current $AGENTS_FILE as the new baseline (was: $state)."
      ;;
  esac
}

case "${1:-status}" in
  status) cmd_status ;;
  write)  cmd_write "${2:-}" ;;
  append) cmd_append "${2:-}" ;;
  accept) cmd_accept ;;
  *)
    echo "Usage: agents-md-sync.sh {status|write [--force]|append [--force]|accept}" >&2
    exit 2
    ;;
esac
