# Detecting Linked PRs and the Assignee State

Exact commands behind Steps 2 and 4 of `SKILL.md`, plus the fallback for
when the primary GraphQL field comes back empty.

## Primary: `closedByPullRequestsReferences` (GraphQL)

This field returns PRs that reference the issue with a **closing keyword**
(`fixes #N`, `closes #N`, `resolves #N`) — which is exactly the "linked"
relationship GitHub shows in the issue sidebar.

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
}' -F owner='<owner>' -F repo='<repo>' -F issue=<number> \
   --jq '.data.repository.issue.closedByPullRequestsReferences.nodes'
```

Keep `includeClosedPrs: true` — merged/closed linked PRs change the
behavior (staleness flag) even though they don't block the fix path.

### Interpreting `state`

| `state` value | Meaning for this skill |
|---|---|
| `OPEN` | Counts as a linked PR → Branch A. A draft PR still counts — someone is actively working. |
| `MERGED` | Does not block, but flag: the issue may be stale/reopened. |
| `CLOSED` | Does not block; a previous attempt was abandoned — worth mentioning in the report. |

## Fallback: timeline cross-references (REST)

Some PRs reference an issue without a closing keyword ("see #42") and
won't appear above. If the GraphQL field returns nothing but you suspect
in-flight work (e.g. a comment mentions a PR), check cross-referenced
events:

```bash
gh api "repos/<owner>/<repo>/issues/<number>/timeline" --paginate \
  --jq '[.[] | select(.event == "cross-referenced")
           | .source.issue
           | select(.pull_request != null)
           | {number, title, state, url: .pull_request.html_url}]'
```

Note: `state` here is lowercase (`open`/`closed`) and a merged PR still
reports `closed` — check `.pull_request.merged_at` if the distinction
matters. Cross-references are weaker evidence than closing keywords:
mention them in the report, but a cross-reference alone from another
repository should not trigger Branch A without a sanity check that the PR
actually addresses this issue.

## Current user (for the assignee gate)

```bash
gh api user --jq .login
```

Compare against `assignees[].login` from the `gh issue view` call in
Step 1. The gate:

- current user is among the assignees, or assignees is empty → proceed
- anyone else is the sole assignee (or the current user is not among
  multiple assignees) → hard stop; explicit developer confirmation
  required before any code work

## Known quirks

- `closedByPullRequestsReferences` requires a recent `gh` version; on very
  old versions the field is unknown and the query errors — upgrade `gh`
  or use the timeline fallback.
- Fork-based PRs appear normally in both queries; nothing special needed.
- If both queries error (network, auth, permissions), report the exact
  error and stop — do not assume "no linked PR" from a failed query.
