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

## Prerequisites

- `graphify` installed: `pip install graphifyy`
- `gh` CLI authenticated: `gh auth login`
- `git` configured with access to the repository
- A Gemini API key set as `GEMINI_API_KEY` (free tier at aistudio.google.com)
  — only needed if the repo contains docs, images, or non-code files

## Step 1 — Gather information

Ask the developer for:

1. **Repository** — `owner/repo` format (e.g. `Gautham248/edpb-docs-clone`)
2. **Bug description** — what is wrong, where it was noticed, any error messages
3. **Environment** — production / staging / local
4. **Reviewer** — GitHub username to assign on the PR (default: the reporter)

Do not proceed without the repository name and bug description.

## Step 2 — Clone or pull the repository

```bash
# Clone if not present locally
git clone https://github.com/<owner>/<repo>.git /tmp/agent-repos/<repo>

# Or pull latest if already cloned
git -C /tmp/agent-repos/<repo> checkout main
git -C /tmp/agent-repos/<repo> pull origin main
```

Always start from a clean, up-to-date main branch.

## Step 3 — Build the knowledge graph

```bash
graphify extract /tmp/agent-repos/<repo> \
  --output /tmp/agent-repos/<repo>/graphify-out \
  --no-browser
```

If extraction fails because non-code files (docs, images) need semantic
analysis, pass `GEMINI_API_KEY`:

```bash
GEMINI_API_KEY=<key> graphify extract /tmp/agent-repos/<repo> \
  --output /tmp/agent-repos/<repo>/graphify-out \
  --no-browser
```

If graphify reports files it cannot process, remove them from the local clone
before extracting — they are working copies only, the remote repo is untouched.

A successful extraction prints:
```
[graphify extract] wrote graph.json: N nodes, M edges
```

## Step 4 — Query the knowledge graph

```bash
graphify query "<bug description>" \
  --graph /tmp/agent-repos/<repo>/graphify-out/graph.json \
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
cat /tmp/agent-repos/<repo>/<target-file-path>
```

Read the full file. Understand what it does. Identify the specific line or value
that contains the bug based on the description.

Also read the last 5 commits touching this file:

```bash
git -C /tmp/agent-repos/<repo> log -5 --oneline -- <target-file-path>
```

Recent commits often reveal what changed and why the bug was introduced.

## Step 6 — Determine the fix

The fix must be:

- **Minimal** — change only what the bug description identifies.
- **Surgical** — one value, one line, one file whenever possible.
- **Correct** — verify the fix makes sense by re-reading the file after applying it.

If you notice other issues in the file, do NOT fix them. Note them in the PR
description only.

If you cannot determine the correct fix with confidence, report back to the
developer with what you found and ask for clarification. Do not guess.

## Step 7 — Create the branch

Branch naming convention:

```
agent/fix/<slug>-<YYYYMMDD>
```

Where `<slug>` is the first 4–5 words of the bug description, lowercased,
hyphenated, alphanumeric only.

Example: `agent/fix/supabase-url-wrong-20260608`

```bash
git -C /tmp/agent-repos/<repo> checkout -b agent/fix/<slug>-<date>
```

## Step 8 — Apply the fix

Edit the file directly. Write the complete corrected content.

```bash
# Verify the change looks right before committing
git -C /tmp/agent-repos/<repo> diff <target-file-path>
```

The diff must show only the minimal change. If it shows unrelated changes,
revert and redo.

## Step 9 — Commit

Stage only the file you changed. Never `git add .`.

```bash
git -C /tmp/agent-repos/<repo> add <target-file-path>
git -C /tmp/agent-repos/<repo> commit -m "[agent] fix: <bug description, max 60 chars>"
```

## Step 10 — Push and open the PR

```bash
git -C /tmp/agent-repos/<repo> push origin agent/fix/<slug>-<date>

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

**Confidence:** <high / medium / low>

<If medium or low, explain why here>

---
> ⚠️ This PR was opened by an AI agent. Please review carefully before merging.
PR_BODY
)"

# Assign reviewer
gh pr edit <pr-number> --repo <owner>/<repo> --add-reviewer <reviewer>
```

## Step 11 — Report back

Tell the developer:

```
✓ PR opened: <pr-url>
  Branch:    agent/fix/<slug>-<date>
  Changed:   <target-file-path>
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

## Failure modes

| Condition | Behaviour |
|---|---|
| Repository not found | Report and stop. Ask developer to verify the repo name. |
| graphify extract fails | Try removing non-code files from clone; retry once. If still fails, report. |
| Knowledge graph returns no results | Retry with broader query once. If still empty, ask developer for file path. |
| Cannot determine correct fix | Report findings, ask for clarification. Do not guess. |
| Push rejected | Report and stop. Do not force-push. |
| PR creation fails | Report the error with the exact gh output. |

## Self-improvement

When you encounter an edge case not covered by this skill — for example, a new
type of file that graphify misclassifies, a repository layout that requires a
different query strategy, or a bug pattern that needed a different approach —
append it to `references/edge-cases.md` under a new dated entry. Do not modify
any other section of this skill without explicit instruction.

## See also

- [`references/graphify-guide.md`](./references/graphify-guide.md) — detailed
  graphify output format and query strategies
- [`references/github-workflow.md`](./references/github-workflow.md) — branch
  naming, PR format, and guardrails reference
- [`references/edge-cases.md`](./references/edge-cases.md) — known edge cases
  and how to handle them
