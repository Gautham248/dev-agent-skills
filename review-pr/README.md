# review-pr

Reviews a GitHub pull request and posts the review back as line-anchored comments plus a summary. Applies company standards by reading other skills as review *lenses* (see `references/lens-registry.json`) rather than restating them — adding a new standards skill to the review is one registry entry, not a rewrite.

**Prerequisites:** `gh` CLI authenticated (`gh auth login`); Node 18+ (already required by `setup.sh --check-security`); `graphify` for blast-radius grounding.

**Usage examples:**
- "review PR #42"
- "I've been assigned as reviewer on this PR"
- "what would a tough reviewer say about https://github.com/org/repo/pull/42"

**Not for:** writing or fixing code (`fix-bug`), triaging your own open PRs (`sync-prs`), or reviewing local changes with no PR yet.

**Tests:** `node --test review-pr/scripts/tests/review-lib.test.mjs`
