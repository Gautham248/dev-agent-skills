---
name: investigate-issue
description: >
  Use when a developer points at an existing GitHub issue and wants it
  investigated and taken forward — phrases like "investigate issue #42",
  "look into this issue", "pick up issue 17 and handle it", or an issue URL
  plus a request to deal with it. Understands the issue, checks for linked
  open PRs and the assignee, then branches: an open linked PR gets a full
  code review delivered in chat only; an unclaimed bug gets fixed via the
  fix-bug skill with a PR referencing the issue; a feature gets an
  implementation plan via plan-feature posted as a comment on the issue.
  Do NOT use for a bug report that has no GitHub issue (use fix-bug
  directly), a direct PR review request with no issue involved (use
  first-principles-review), or planning a feature that has no issue yet
  (use plan-feature directly).
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

# Investigate issue

Takes an existing GitHub issue from "someone should look at this" to a
concrete outcome: a chat review of the in-flight PR, a fix PR, or an
implementation plan — with hard stops before it ever duplicates work a
human or another PR already has in progress.

The single most important rule: **never do code work while an open linked
PR exists or while someone else's assignment is unconfirmed.** Both gates
below are hard stops, not formalities.

## Prerequisites

- `gh` CLI authenticated: `gh auth login`
- `git` configured with access to the repository
- The `fix-bug` and `plan-feature` skills available (this skill delegates
  to them; their own prerequisites — graphify etc. — apply when delegated)

## Step 1 — Identify and understand the issue

Resolve the issue reference first:

- A full URL (`https://github.com/owner/repo/issues/N`) gives you both repo
  and number.
- A bare `#N` or "issue N" means the repo must come from the current
  checkout's remote (`gh repo view --json nameWithOwner`) — if there is no
  checkout and no repo was named, ask for the repo; do not guess.

```bash
gh issue view <number> --repo <owner>/<repo> \
  --json number,title,body,state,labels,assignees,url,comments
```

Read the title, body, labels, and every comment. Then restate the problem
in one or two sentences back to the developer — this restatement is the
anchor for everything that follows, so get it confirmed implicitly by
stating it, not by silently moving on.

**If the issue does not exist or is already CLOSED:** report exactly that
and stop. No code changes, no further steps.

## Step 2 — Check for linked pull requests

Only **open** PRs that reference/close the issue count as "linked." Full
command details (GraphQL query and the timeline fallback) are in
`references/linked-pr-detection.md`.

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $issue: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $issue) {
      closedByPullRequestsReferences(first: 10, includeClosedPrs: true) {
        nodes { number title state isDraft url updatedAt author { login } }
      }
    }
  }
}' -F owner='<owner>' -F repo='<repo>' -F issue=<number>
```

Interpret the results:

- **At least one OPEN PR** → Branch A (Step 3). The fix path is closed.
- **Only MERGED/CLOSED linked PRs** → treat as "no PR," but flag it
  explicitly in your output before continuing ("a linked PR was already
  merged/closed — this issue may be stale or reopened; confirm it is still
  live") and then continue to Branch B (Step 4).
- **No linked PRs at all** → Branch B (Step 4).

## Step 3 — Branch A: an open linked PR exists — review it, chat only

Do not write any code. Review the PR against the issue:

1. If **multiple** open PRs are linked, review the most recently updated
   one and list the others in the report.
2. Pull the PR and its diff:
   ```bash
   gh pr view <pr-number> --repo <owner>/<repo> --json title,body,state,isDraft,author,files,url
   gh pr diff <pr-number> --repo <owner>/<repo>
   ```
3. Review **every changed file** in the diff against the issue's stated
   requirements. Structure the report per
   `references/review-report-format.md`.
4. Deliver the full report **in chat only**. Never post anything to
   GitHub in this branch — no PR comments, no reviews, no approvals, no
   request-changes. The report is for the requester, not the PR thread.

Then stop. Branch A ends here by default. Only if the developer replies
explicitly insisting on a fix anyway ("fix it regardless", "I still want
a PR from you") do you continue — and even then, continue at Step 4, not
Step 6: the assignee gate still applies.

## Step 4 — Branch B: the assignee gate

Compare the issue's assignees against the authenticated user:

```bash
gh api user --jq .login
```

- **Assigned to the current user, or unassigned** → proceed to Step 5.
- **Assigned to someone else** → hard stop. Report who is assigned and ask
  the developer explicitly whether to proceed anyway. Silence or a topic
  change is not a yes. Only an explicit confirmation unlocks Step 5.

## Step 5 — Classify the issue

Decide: is this a **bug**, a **feature request**, or **neither**?

- Labels first: `bug`/`defect`/`regression` style labels → bug;
  `feature`/`enhancement` style labels → feature.
- No usable labels: classify from the body. A description of broken
  existing behavior is a bug; a description of new desired behavior is a
  feature.
- Genuinely ambiguous → ask the developer one closed question ("Treat this
  as a bug to fix, or a feature to plan?") rather than guessing.

## Step 6 — Act by classification

**Bug → delegate to the `fix-bug` skill.** Load it and follow it in full —
its operating-context step, knowledge-graph reuse, minimal-fix rules,
branch naming, and PR format all apply unchanged. Two additions this skill
imposes on top:

- The PR title/body must reference the issue with a closing keyword:
  `Fixes #<number>` in the body.
- The bug description fed to fix-bug is the issue title + body + your
  Step 1 restatement — do not re-interview the developer for what the
  issue already states.

**Feature → delegate to the `plan-feature` skill, with one override.**
First check the issue description is actually sufficient as a spec: what
should exist, for whom, and any constraints. If it is too thin, ask the
developer targeted questions (same clarification discipline as a bug fix)
before planning. Then follow plan-feature for the graph queries and plan
structure, but **override its save step**: do not create a new issue and
do not open a plan PR — post the plan as a comment on the existing issue:

```bash
gh issue comment <number> --repo <owner>/<repo> --body-file <plan-file>
```

No implementation code is written on the feature path.

**Neither (question/discussion/support)** → report your findings from
Step 1 in chat, state why no action fits this skill, and stop. No code,
no comments posted.

## Step 7 — Report back

```
✓ Review delivered in chat (Branch A)          — PR: <pr-url>
  OR
✓ Fix PR opened: <pr-url>  (references Fixes #<number>)
  OR
✓ Plan posted on issue: <comment-url>
  OR
✓ No action taken: <reason — closed issue / other assignee unconfirmed / not actionable>

  Issue:      <issue-url> (<state>)
  Linked PRs: <none / list with states>
  Assignee:   <none / me / other-user (confirmed|unconfirmed)>
  Confidence: <high / medium / low>
```

If confidence is medium or low, say what you were uncertain about.

## What the agent must NEVER do

- Post a review, comment, approval, or request-changes on a PR — Branch A
  output goes to chat only.
- Open a PR, commit, or write code while an open linked PR exists, unless
  the developer explicitly insisted after seeing the review.
- Do any code work while the issue is assigned to someone else, without
  that explicit confirmation.
- Merge any PR, close the issue, or push to main.
- Create a new issue (the feature plan goes on the existing one).
- Reclassify a "neither" issue into a bug or feature just to have
  something to do.

## Failure modes

| Condition | Behaviour |
|---|---|
| Issue not found | Report and stop. Ask developer to verify the number/repo. |
| Issue already closed | Report the state and stop. No code changes. |
| Repo cannot be inferred from a bare issue number | Ask for `owner/repo`. Do not guess. |
| Multiple open linked PRs | Review the most recently updated; list the rest in the report. |
| Linked PR merged/closed only | Flag possible staleness, then continue to Branch B. |
| Assigned to someone else, no confirmation given | Stop. Report assignee status only. |
| Issue too thin to classify or act on | Ask targeted questions before touching code. |
| gh/GraphQL query fails | Use the timeline fallback in `references/linked-pr-detection.md`; if that also fails, report the exact error and stop. |
| Delegated skill (fix-bug / plan-feature) fails | Report its failure verbatim; do not improvise a replacement workflow. |

## See also

- [`references/linked-pr-detection.md`](./references/linked-pr-detection.md)
  — exact commands for finding linked PRs and the current user, plus the
  timeline-events fallback when the GraphQL field comes back empty
- [`references/review-report-format.md`](./references/review-report-format.md)
  — required structure for the Branch A chat review report
- [`references/workflow-diagram.md`](./references/workflow-diagram.md)
  — the full flow as a Mermaid diagram
