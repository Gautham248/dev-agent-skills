---
name: fix-bug
description: >
  Use when a developer reports a bug in a GitHub repository and wants an
  automated fix — phrases like "fix this bug", "there's an error in production",
  "something is broken in <repo>", or "open a PR to fix <issue>". Queries the
  repository's knowledge graph to find the relevant file, applies a minimal
  targeted fix, commits it on a new branch, opens a pull request, and notifies
  the developer. Never merges. Never deletes files. Never touches more than what
  the bug report describes.
---

# Fix bug

Receives a bug description, finds the relevant file using the repository
knowledge graph, applies the minimal fix, and opens a pull request for review.

Follow these steps in order. Do not skip the graph step because the bug looks
simple — building it once and reusing it is the whole point; skipping it just
means the next job pays to rebuild what this one should have left behind.

## Prerequisites

- `graphify` installed: `pip install graphifyy`
- `gh` CLI authenticated: `gh auth login`
- `git` configured with access to the repository
- An LLM API key for the configured backend, available in the environment —
  only needed if the repo contains docs, images, or non-code files. Use
  whichever provider is already configured for this deployment; do not
  substitute a different provider's key (see `references/edge-cases.md`,
  2026-06-08, for why that fails).

## Step 1 — Gather information

Ask the developer for:

1. **Repository** — `owner/repo` format (e.g. `Gautham248/edpb-docs-clone`)
2. **Bug description** — what is wrong, where it was noticed, any error messages
3. **Environment** — production / staging / local
4. **Reviewer** — GitHub username to assign on the PR (default: the reporter)

Do not proceed without the repository name and bug description.

## Step 2 — Clone or pull the repository (persistent location)

Repos are cloned to a **persistent** path, not `/tmp` — this lets the graph
built in Step 3 be reused across jobs instead of rebuilt from scratch every
single time.

```bash
REPO_DIR=/app/data/repos/<owner>__<repo>

if [ -d "$REPO_DIR/.git" ]; then
  # Already cloned — pull latest rather than cloning fresh
  git -C "$REPO_DIR" checkout main
  git -C "$REPO_DIR" pull origin main
else
  mkdir -p /app/data/repos
  git clone https://github.com/<owner>/<repo>.git "$REPO_DIR"
fi
```

Always end this step on a clean, up-to-date main branch. Record the current
HEAD sha — Step 3 needs it to decide whether an existing graph is stale:

```bash
CURRENT_SHA=$(git -C "$REPO_DIR" rev-parse HEAD)
```

## Step 3 — Build or reuse the knowledge graph (persistent, staleness-checked)

The graph lives outside the repo clone, at a fixed path keyed by repo, so it
survives across jobs and container restarts.

```bash
GRAPH_DIR=/app/data/graphs/<owner>__<repo>
GRAPH_FILE="$GRAPH_DIR/graphify-out/graph.json"
SHA_FILE="$GRAPH_DIR/built-at-sha.txt"
```

**Reuse check — always do this before extracting anything:**

```bash
if [ -f "$GRAPH_FILE" ] && [ -f "$SHA_FILE" ] && \
   [ "$(cat "$SHA_FILE")" = "$CURRENT_SHA" ]; then
  echo "Graph is fresh (built at current HEAD) — reusing $GRAPH_FILE"
  # Skip directly to Step 4. Do not re-extract.
fi
```

Only if that check fails (no graph yet, or the repo has moved since the graph
was last built) — rebuild:

```bash
mkdir -p "$GRAPH_DIR"
graphify extract "$REPO_DIR" --output "$GRAPH_DIR/graphify-out" --no-browser --backend openai
echo "$CURRENT_SHA" > "$SHA_FILE"
```

`--backend openai` here is not real OpenAI — `OPENAI_BASE_URL`/`OPENAI_MODEL`
are configured to point this at the same OpenCode Go endpoint everything else
in this deployment uses, so graphify's semantic extraction runs on the same
provider as the rest of the agent's work, not a second one.

If extraction fails needing semantic analysis of non-code files, the
configured backend's API key should already be present in the environment —
do not hardcode a specific provider's key here, and do not try a different
provider's key as a workaround (see `references/edge-cases.md`, 2026-06-08).
If it still fails, report the exact error rather than guessing at a fix.

If graphify reports files it cannot process, remove them from the local clone
before extracting — they are working copies only, the remote repo is untouched.

A successful extraction prints:

```
[graphify extract] wrote graph.json: N nodes, M edges
```

## Step 4 — Query the knowledge graph

```bash
graphify query "<bug description>" \
  --graph "$GRAPH_FILE" \
  --budget 3000
```

Parse the output. Every result line follows this format:

```
NODE <name> [src=<filepath> loc=L<n> community=<n>]
```

Extract every unique `src=` value. Count how many NODE lines reference each
file — more references means higher relevance to the query. Sort by count
descending.

**Picking the target file:**

1. If any file with high reference count has role `config` or is named `client`,
   prefer it — configuration and client files are the most common location for
   the kind of bugs agents fix (wrong URLs, wrong keys, wrong constants).
2. Otherwise take the most-referenced file.
3. If two files tie and both are plausible, read both before deciding.

If the query returns no results, broaden the search terms and retry once.
If still no results, report to the developer: "I could not find a relevant file.
Please specify the file path directly."

## Step 5 — Read and understand the file

```bash
cat "$REPO_DIR/<target-file-path>"
```

Read the full file. Understand what it does. Identify the specific line or value
that contains the bug based on the description.

Also read the last 5 commits touching this file:

```bash
git -C "$REPO_DIR" log -5 --oneline -- <target-file-path>
```

Recent commits often reveal what changed and why the bug was introduced.

## Step 6 — Check for applicable convention skills

Before deciding on the fix, check whether a more specific skill governs this
change — do not rely on general judgment alone when a skill already encodes
the project's actual conventions:

- Editing TypeScript? Load `typescript-conventions`.
- Editing a SvelteKit/webapp feature? Load `webapp-conventions`.
- Adding or modifying an ESLint rule? Load `eslint-rule-author`.

If one applies, follow its conventions for the fix below. If none apply,
proceed with Step 7 using only this skill's own guardrails.

## Step 7 — Determine the fix

The fix must be:

- **Minimal** — change only what the bug description identifies.
- **Surgical** — one value, one line, one file whenever possible.
- **Correct** — verify the fix makes sense by re-reading the file after applying it.
- **Consistent** with any convention skill loaded in Step 6.

If you notice other issues in the file, do NOT fix them. Note them in the PR
description only.

If you cannot determine the correct fix with confidence, report back to the
developer with what you found and ask for clarification. Do not guess.

## Step 8 — Create the branch

Branch naming convention:

```
agent/fix/<slug>-<YYYYMMDD>
```

Where `<slug>` is the first 4–5 words of the bug description, lowercased,
hyphenated, alphanumeric only.

Example: `agent/fix/supabase-url-wrong-20260608`

```bash
git -C "$REPO_DIR" checkout -b agent/fix/<slug>-<date>
```

## Step 9 — Apply the fix

Edit the file directly. Write the complete corrected content.

```bash
# Verify the change looks right before committing
git -C "$REPO_DIR" diff <target-file-path>
```

The diff must show only the minimal change. If it shows unrelated changes,
revert and redo.

## Step 10 — Commit

Stage only the file you changed. Never `git add .`.

```bash
git -C "$REPO_DIR" add <target-file-path>
git -C "$REPO_DIR" commit -m "[agent] fix: <bug description, max 60 chars>"
```

## Step 11 — Push and open the PR

```bash
git -C "$REPO_DIR" push origin agent/fix/<slug>-<date>

gh pr create \
  --repo <owner>/<repo> \
  --head agent/fix/<slug>-<date> \
  --base main \
  --title "[Agent] Fix: <bug description, max 60 chars>" \
  --body "$(cat <<'PR_BODY'
## [Agent] Fix

**Issue:** <bug description>
**Reported by:** @<reporter>
**Environment:** <environment>

---

**Root cause / Change made:** <one sentence explaining what was wrong and what was changed>

**File changed:** `<target-file-path>`
**Files read but not changed:** <list other files inspected, or "none">
**Knowledge graph:** <reused existing graph / rebuilt — state which>
**Convention skill applied:** <name, or "none applicable">

**Confidence:** <high / medium / low>

<If medium or low, explain why here>

---
> ⚠️ This PR was opened by an AI agent. Please review carefully before merging.
PR_BODY
)"

# Assign reviewer
gh pr edit <pr-number> --repo <owner>/<repo> --add-reviewer <reviewer>
```

**Verifying the PR:** After creation, confirm it looks right:

```bash
# Use --json for reliable output (plain gh pr view can fail with
# GraphQL deprecation warnings on newer repos)
gh pr view <pr-number> --repo <owner>/<repo> --json title,state,url,reviewRequests
```

**Reviewer edge case:** If `gh pr edit --add-reviewer` returns HTTP 422
("Review cannot be requested from pull request author"), the authenticated gh
user is the same as the requested reviewer. GitHub blocks self-review — note
this in the Step 12 report so the developer knows to assign a different reviewer.

## Step 12 — Report back

Tell the developer:

```
✓ PR opened: <pr-url>
  Branch:    agent/fix/<slug>-<date>
  Changed:   <target-file-path>
  Graph:     <reused / rebuilt>
  Skills used: fix-bug<, + any convention skill from Step 6>
  Summary:   <one sentence>
  Confidence: <high/medium/low>
```

If confidence is medium or low, explain what you were uncertain about so the
reviewer knows where to focus.

## What the agent must NEVER do

- Merge the PR — humans merge, always.
- Delete any file.
- Push directly to `main`.
- Fix more than what the bug description describes.
- Touch environment variables, secrets, or `.env` files.
- Open more than one PR per bug report.
- Retry more than twice if something fails — report the failure instead.
- Substitute a different provider's API key when the configured one fails for
  graphify — report the failure instead (see `references/edge-cases.md`).

## Failure modes

| Condition | Behaviour |
|---|---|
| Repository not found | Report and stop. Ask developer to verify the repo name. |
| graphify extract fails | Report the exact error. Do not swap to a different provider's key. |
| Knowledge graph returns no results | Retry with broader query once. If still empty, ask developer for file path. |
| Cannot determine correct fix | Report findings, ask for clarification. Do not guess. |
| Push rejected | Report and stop. Do not force-push. |
| PR creation fails | Report the error with the exact gh output. |

## See also

- [`references/graphify-guide.md`](./references/graphify-guide.md) — detailed
  graphify output format and query strategies
- [`references/github-workflow.md`](./references/github-workflow.md) — branch
  naming, PR format, and guardrails reference
- [`references/edge-cases.md`](./references/edge-cases.md) — known edge cases
  and how to handle them

## Self-improvement

If you encounter an edge case not covered by this skill:

1. Append it to `references/edge-cases.md` under a new dated entry
2. Format: date, condition, and exact handling steps used
3. Do not modify any other section of this skill
