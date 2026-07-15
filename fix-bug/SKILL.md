---
name: fix-bug
description: >
  Use when a developer reports a bug in a GitHub repository and wants an
  automated fix — phrases like "fix this bug", "there's an error in production",
  "something is broken in the payments repo", or "open a PR to fix issue 42". Also use for
  the same kind of bug report in a local, not-yet-GitHub-connected repository —
  the clarification and investigation steps still apply; only the clone/PR
  mechanics differ (see Step 0). Queries the repository's knowledge graph to
  find the relevant file and applies a minimal targeted fix. Only commits,
  pushes, and opens a pull request when the developer explicitly asks — by
  default it stops at the edited file for the developer to review. Never
  merges. Never deletes files. Never touches more than what the bug report
  describes.
---

<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->
Before doing anything else in this skill, read and follow the clarification protocol at:
../config/CLARIFICATION-PROTOCOL.md
<!-- END dev-agent-skills clarification protocol -->

<!-- BEGIN dev-agent-skills self-improvement protocol (managed by setup.sh -- do not edit this block manually; edit SELF-IMPROVEMENT-PROTOCOL.md instead) -->
While using this skill, and especially when you finish, read and follow the self-improvement protocol at:
../config/SELF-IMPROVEMENT-PROTOCOL.md
(Append real edge cases to this skill's own references/edge-cases.md — create it if missing. See the protocol file for what qualifies.)
<!-- END dev-agent-skills self-improvement protocol -->

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

## Step 0 — Determine the operating context

Before anything else: are you already running inside the target repository's
own working directory (a teammate's local checkout), or are you the dev-agent
service operating on a separate, persistent clone
(`/app/data/repos/<owner>__<repo>`)?

- **Already inside the repo's working directory:** skip Step 2's clone step
  entirely — work directly in the current directory, no separate clone.
  Confirm a git repository actually exists first
  (`git rev-parse --is-inside-work-tree`).
- **No git repository here at all:** stop and say so directly to the user.
  Ask whether to proceed without any git/PR steps at all (edit files in place
  only — no branch, no commit, no PR) or to initialize git first. Do not
  silently invent your own workflow around this mismatch — surfacing it is
  exactly what the clarification protocol is for, not something to route
  around quietly.
- **You ARE the dev-agent service** (operating on the known persistent-clone
  path): follow Step 2 as written, unchanged.

This decision determines how much of Steps 2–4 and 8–11 below actually apply.
Say explicitly which mode you're in before proceeding, so the developer can
correct you if you guessed wrong.

## Step 1 — Gather information

Ask the developer for:

1. **Repository** — `owner/repo` format (e.g. `Gautham248/edpb-docs-clone`) —
   only if you're NOT already inside the working directory per Step 0; if you
   are, you already know which repo this is.
2. **Bug description** — what is wrong, where it was noticed, any error messages
3. **Environment** — production / staging / local
4. **Reviewer** — GitHub username to assign on the PR (default: the reporter) —
   only applicable if a PR will actually be opened (see Step 0)
5. **Commit & push preference** — after the fix is applied, should the agent
   commit and push it (and open a PR), or stop at the edited file for the
   developer to review and handle git themselves? **Default: do NOT commit or
   push.** Ask this explicitly and wait for an answer — never commit or push
   on your own initiative just because the fix is ready.

Do not proceed without the bug description.

## Step 2 — Clone or pull the repository (persistent location)

**Only applies in dev-agent-service mode (see Step 0).** If you're already
inside the repository's own working directory, skip this step entirely.

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
graphify extract "$REPO_DIR" --out "$GRAPH_DIR" --no-browser --backend openai
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

Also read the last 5 commits touching this file (if a git history exists —
skip this if Step 0 determined there is no git repository here):

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

**Only if Step 0 determined a git repository exists.** If there's no git
repository here and the developer chose to proceed without one, skip directly
to Step 9 and edit the file in place — there is no branch to create.

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
# Verify the change looks right before committing — only if a git repository
# exists here (see Step 0); otherwise just re-read the file directly.
git -C "$REPO_DIR" diff <target-file-path>
```

The diff must show only the minimal change. If it shows unrelated changes,
revert and redo.

## Step 10 — Commit

**Gate — do not commit unless BOTH are true:**

1. Step 0 determined a git repository exists, AND
2. The developer explicitly opted in to committing (see Step 1, item 5).

If the developer did not ask for a commit — or did not answer — **stop here.**
Report the change you made to the file (Step 12) and let the developer commit
it themselves. Committing without an explicit go-ahead is exactly the behaviour
this skill must avoid.

Only when the developer has confirmed: stage only the file you changed. Never
`git add .`.

```bash
git -C "$REPO_DIR" add <target-file-path>
git -C "$REPO_DIR" commit -m "[agent] fix: <bug description, max 60 chars>"
```

## Step 11 — Push and open the PR

**Gate — only run this step if ALL are true:** a commit was actually made in
Step 10 (i.e. the developer opted in), this repository has a real GitHub
remote, and the developer wants a PR opened (Step 1, item 5). If the developer
only asked for the fix — or did not explicitly ask to push — do not push and
do not open a PR. A local-only repository with no GitHub remote likewise has
nothing to push to — report the local commit and stop instead.

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

Tell the developer what actually happened — adapt this to whichever mode
Step 0 determined applied:

```
✓ PR opened: <pr-url>                      (only if Step 11 ran)
  OR
✓ Change committed locally: <commit sha>   (only if Step 10 ran, no PR)
  OR
✓ Change made (no git tracking): <file>    (if Step 0 found no git repo)

  Changed:   <target-file-path>
  Graph:     <reused / rebuilt / not used — no GitHub-backed graph for this run>
  Skills used: fix-bug<, + any convention skill from Step 6>
  Summary:   <one sentence>
  Confidence: <high/medium/low>
```

If confidence is medium or low, explain what you were uncertain about so the
reviewer knows where to focus.

## What the agent must NEVER do

- Merge the PR — humans merge, always.
- Commit or push a fix without the developer's explicit go-ahead (see Step 1,
  item 5, and Steps 10–11). Default is to stop at the edited file.
- Delete any file.
- Push directly to `main`.
- Fix more than what the bug description describes.
- Touch environment variables, secrets, or `.env` files.
- Open more than one PR per bug report.
- Retry more than twice if something fails — report the failure instead.
- Substitute a different provider's API key when the configured one fails for
  graphify — report the failure instead (see `references/edge-cases.md`).
- Silently invent a workflow when the actual environment doesn't match what
  this skill assumes — say so explicitly instead (see Step 0).

## Failure modes

| Condition | Behaviour |
|---|---|
| Repository not found | Report and stop. Ask developer to verify the repo name. |
| No git repository present | Stop and ask the developer how to proceed (see Step 0). Do not improvise silently. |
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
