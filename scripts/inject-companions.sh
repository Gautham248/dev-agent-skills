#!/usr/bin/env bash
# inject-companions.sh — wire "companion" skills into the skills they follow.
#
# Usage: bash scripts/inject-companions.sh [skills-dir]   (default: repo root)
#
# A skill declares, in its OWN frontmatter:
#     companion-of: <target-skill>[, <another-target>]
# and this script writes one managed block into each target's SKILL.md telling
# the agent to invoke the companion(s) after the target finishes. The declaring
# side owns the link, so a target imported from an upstream skillset (tracked in
# .skillsets.json, overwritten by skill-update) never needs a hand edit:
# skill-update re-runs setup.sh, which re-runs this, which re-injects the block.
#
# Same managed-block discipline as setup.sh's inject_protocol_pointers:
#   - exact-line BEGIN/END markers, stripped and rebuilt on every run;
#   - placed right after the last other dev-agent-skills managed block (or the
#     frontmatter when there is none);
#   - a target no skill declares any more loses its block;
#   - a file is only rewritten when its content actually changes, so a second
#     run is byte-identical.
# Plain bash 3.2 (macOS default) — no associative arrays.

set -e

SKILLS_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

CB_BEGIN="<!-- BEGIN dev-agent-skills companion skills (managed by setup.sh -- do not edit this block manually; declare companion-of in the companion skill's frontmatter instead) -->"
CB_END="<!-- END dev-agent-skills companion skills -->"

strip_block() {
  awk -v b="$CB_BEGIN" -v e="$CB_END" '
    $0==b {skip=1; next}
    $0==e {skip=0; next}
    skip==1 {next}
    {print}
  ' "$1"
}

frontmatter_end() {
  grep -n '^---$' "$1" | head -2 | tail -1 | cut -d: -f1
}

skill_dirs=()
for dir in "$SKILLS_DIR"/*/; do
  [ -f "$dir/SKILL.md" ] && skill_dirs+=("$dir")
done

pairs=$(mktemp)
trap 'rm -f "$pairs"' EXIT
warnings=0

# Pass 1 — collect target<TAB>companion pairs from every skill's frontmatter.
for skill_dir in "${skill_dirs[@]}"; do
  skill_md="${skill_dir}SKILL.md"
  name=$(basename "$skill_dir")
  fm_end=$(frontmatter_end "$skill_md")
  [ -n "$fm_end" ] || continue
  targets=$(head -n "$fm_end" "$skill_md" \
    | sed -n 's/^companion-of:[[:space:]]*//p' \
    | tr ',' '\n' | tr -d " \t\"'" | grep -v '^$' || true)
  for target in $targets; do
    if [ "$target" = "$name" ]; then
      echo "  ⚠️  $name: companion-of names itself — ignored."
      warnings=$((warnings + 1))
      continue
    fi
    if [ ! -f "$SKILLS_DIR/$target/SKILL.md" ]; then
      echo "  ⚠️  $name: companion-of target '$target' is not a skill in this repo — ignored."
      warnings=$((warnings + 1))
      continue
    fi
    printf '%s\t%s\n' "$target" "$name" >> "$pairs"
  done
done

injected=0 refreshed=0 unchanged=0 removed=0

# Pass 2 — rebuild (or remove) the block in every skill.
for skill_dir in "${skill_dirs[@]}"; do
  skill_md="${skill_dir}SKILL.md"
  name=$(basename "$skill_dir")
  companions=$(awk -F'\t' -v t="$name" '$1==t {print $2}' "$pairs" | sort -u | tr '\n' ' ' | sed 's/ *$//')
  had="false"
  grep -qF "$CB_BEGIN" "$skill_md" && had="true"
  [ -z "$companions" ] && [ "$had" = "false" ] && continue

  stripped=$(mktemp)
  rebuilt=$(mktemp)
  strip_block "$skill_md" > "$stripped"

  if [ -n "$companions" ]; then
    anchor=$(grep -n '^<!-- END dev-agent-skills .* -->$' "$stripped" | tail -1 | cut -d: -f1)
    [ -n "$anchor" ] || anchor=$(frontmatter_end "$stripped")
    if [ -z "$anchor" ]; then
      echo "  ⚠️  $name: no frontmatter — companion block not injected."
      warnings=$((warnings + 1))
      rm -f "$stripped" "$rebuilt"
      continue
    fi
    list=""
    for c in $companions; do list="${list:+$list, }\`$c\`"; done
    {
      head -n "$anchor" "$stripped"
      echo ""
      echo "$CB_BEGIN"
      echo "Companion skills: $list (each declares \`companion-of: $name\` in its own frontmatter)."
      if [ "$(echo "$companions" | wc -w)" -gt 1 ]; then
        echo "After you deliver this skill's final report, ask the user which companion skill to run, then load"
        echo "it by name (with its SKILL.md) and hand it this skill's report as its input, starting with this line:"
      else
        echo "After you deliver this skill's final report, load the companion skill by name (with its SKILL.md)"
        echo "and hand it this skill's report as its input, starting with this line:"
      fi
      echo "\`handoff: from=$name; reviewed_at=<ISO 8601 time>; commit=<git rev-parse HEAD, or unknown>\`"
      echo "The companion decides whether to continue (it asks the user, and stops when no one can answer)."
      echo "A companion invoked this way must reuse that report and must not invoke this skill again."
      echo "$CB_END"
      echo ""
      tail -n "+$((anchor + 1))" "$stripped"
    } | cat -s > "$rebuilt"
  else
    cat -s "$stripped" > "$rebuilt"
  fi

  if cmp -s "$rebuilt" "$skill_md"; then
    unchanged=$((unchanged + 1))
  else
    cat "$rebuilt" > "$skill_md"
    if [ -z "$companions" ]; then
      removed=$((removed + 1))
    elif [ "$had" = "true" ]; then
      refreshed=$((refreshed + 1))
    else
      injected=$((injected + 1))
    fi
  fi
  rm -f "$stripped" "$rebuilt"
done

summary="  ✓ Companion skills — injected into $injected skill(s), refreshed $refreshed, unchanged $unchanged"
[ "$removed" -gt 0 ] && summary="$summary, removed from $removed (no companion declares them any more)"
[ "$warnings" -gt 0 ] && summary="$summary, $warnings warning(s) above"
echo "$summary"
