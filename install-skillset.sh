#!/usr/bin/env bash
# install-skillset.sh — pull an external skill repo into dev-agent-skills
# so it becomes part of the superset, automatically.
#
# Usage:
#   bash install-skillset.sh <git-url> [options]
#
# Options:
#   --subdir <path>     Skills live under this subdirectory of the source
#                        repo, not at its root (e.g. "skills" for
#                        obra/superpowers-skills). Default: search the
#                        whole repo.
#   --prefix <name>      Prefix every imported skill's folder name with
#                        "<name>-" (e.g. --prefix superpowers gives you
#                        superpowers-brainstorming/). Use this whenever the
#                        source repo's skill names might collide with
#                        skills you already have, or with another skillset
#                        you've already installed. Strongly recommended
#                        for large/general-purpose skillsets; optional for
#                        a small skillset you've checked by hand.
#   --only <a,b,c>       Only import these specific skills (match by their
#                        folder name in the source repo), not the whole
#                        repo. Comma-separated, no spaces.
#   --ref <branch/tag>   Clone this ref instead of the default branch.
#   --dry-run            Show what would be imported/skipped without
#                        touching the filesystem.
#   --skip-setup         Don't automatically run setup.sh afterwards.
#
# What this actually does:
#   1. Shallow-clones the source repo to a temp directory.
#   2. Hands off to scripts/install-skillset.mjs, which finds every
#      SKILL.md in it (at any depth), flattens each into its own folder
#      at this repo's root (the same one-folder-per-skill convention
#      CONTRIBUTING.md already documents), handles name collisions,
#      rewrites cross-skill references it can resolve, and records
#      provenance in .skillsets.json + SKILLSETS.md.
#   3. Regenerates the README skills table.
#   4. Runs setup.sh, so the newly-imported skills get symlinked into
#      every detected IDE/harness and get the clarification-protocol
#      pointer injected, exactly like any other skill in this repo.
#      (Skip with --skip-setup if you want to review the diff first.)
#
# Examples:
#   bash install-skillset.sh https://github.com/obra/superpowers-skills.git \
#     --subdir skills --prefix superpowers
#
#   bash install-skillset.sh https://github.com/some-org/some-skills.git \
#     --only fix-flaky-tests,api-design-review --dry-run

set -euo pipefail

SKILLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REPO_URL=""
SUBDIR=""
PREFIX=""
ONLY=""
REF=""
DRY_RUN="false"
SKIP_SETUP="false"

usage() {
  sed -n '2,41p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

if [ $# -eq 0 ]; then usage; fi
REPO_URL="$1"; shift

while [ $# -gt 0 ]; do
  case "$1" in
    --subdir) SUBDIR="$2"; shift 2 ;;
    --prefix) PREFIX="$2"; shift 2 ;;
    --only) ONLY="$2"; shift 2 ;;
    --ref) REF="$2"; shift 2 ;;
    --dry-run) DRY_RUN="true"; shift ;;
    --skip-setup) SKIP_SETUP="true"; shift ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

if ! command -v node &>/dev/null; then
  echo "✗ install-skillset.sh requires Node.js (used for skill discovery, cross-reference rewriting, and the README/manifest update). Install Node and re-run." >&2
  exit 1
fi
if ! command -v git &>/dev/null; then
  echo "✗ install-skillset.sh requires git, to clone the source repo." >&2
  exit 1
fi

CLONE_DIR="$(mktemp -d)"
cleanup() { rm -rf "$CLONE_DIR"; }
trap cleanup EXIT

echo "Cloning $REPO_URL ${REF:+(ref: $REF) }..."
if [ -n "$REF" ]; then
  git clone --depth 1 --branch "$REF" "$REPO_URL" "$CLONE_DIR" --quiet
else
  git clone --depth 1 "$REPO_URL" "$CLONE_DIR" --quiet
fi
COMMIT="$(git -C "$CLONE_DIR" rev-parse HEAD)"
echo "  at commit $COMMIT"
echo ""

NODE_ARGS=(
  "$SKILLS_DIR/scripts/install-skillset.mjs"
  --clone-dir "$CLONE_DIR"
  --skills-dir "$SKILLS_DIR"
  --repo-url "$REPO_URL"
  --commit "$COMMIT"
)
[ -n "$SUBDIR" ] && NODE_ARGS+=(--subdir "$SUBDIR")
[ -n "$PREFIX" ] && NODE_ARGS+=(--prefix "$PREFIX")
[ -n "$ONLY" ] && NODE_ARGS+=(--only "$ONLY")
[ -n "$REF" ] && NODE_ARGS+=(--ref "$REF")
[ "$DRY_RUN" = "true" ] && NODE_ARGS+=(--dry-run)

node "${NODE_ARGS[@]}"

if [ "$DRY_RUN" = "true" ]; then
  echo ""
  echo "(--dry-run: nothing was written. Re-run without --dry-run to actually import.)"
  exit 0
fi

if [ "$SKIP_SETUP" = "true" ]; then
  echo ""
  echo "Skipped setup.sh per --skip-setup. Run 'bash setup.sh' when ready to symlink the new skills into your IDEs."
else
  echo ""
  echo "Running setup.sh to symlink the new skills and inject the clarification protocol..."
  echo ""
  bash "$SKILLS_DIR/setup.sh"
fi

echo ""
echo "Review .skillsets.json / SKILLSETS.md, check git diff, then commit:"
echo "  git add -A && git commit -m \"install: skillset from $REPO_URL\""
