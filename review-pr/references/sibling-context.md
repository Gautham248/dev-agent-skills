# Sibling-PR and general-comment context

Full detail for SKILL.md's Step 0 "General (non-inline) comments and a
linked sibling PR" section. SKILL.md keeps the command sequence; this file
has the reasoning behind it.

## Why this exists

`gh pr view`'s `comments` field is the PR's general conversation — not
inline review comments, which come later in Step 6. This is where a
directive like "match how PR #17 did this" lives, and nothing else in this
skill reads it otherwise: it isn't a line-anchored finding, and dedup
against prior reviews only ever covers *inline* comments, never general
conversation. Before this, `review-pr` had no mechanism to see this kind of
directive at all.

## What counts as a sibling PR

`extractSiblingPrRefs` is deliberately scoped to the same owner/org as the
PR under review, and excludes a self-reference to that PR's own number. An
org's own convention-setting PR (as in the PR that motivated this feature —
one PR's comment pointing reviewers at another PR in the same org as the
reference implementation) is the realistic case this exists for. Following
an arbitrary external repo's PR link has no such justification and a much
larger blast radius — fetching and reasoning over a stranger's PR on the
strength of a comment mentioning it is not something this skill should do
unprompted.

## What happens with a sibling PR's content

Pull its review comments the same way Step 6 pulls this PR's own prior
reviews (`gh api repos/<owner>/<repo>/pulls/<number>/comments --paginate`).
Read through them once — this becomes shared framing, the same treatment
Step 2b's architecture narrative already gets: carried into Step 4's lens
passes, never turned into findings that need validating against *this*
diff. A convention match ("do it the way the sibling PR's reviewer asked
for") isn't a verifiable claim the way a line of code is, so it doesn't
belong in the findings pipeline at all.

If a sibling PR was found but following it changes nothing about what
you'd flag on this PR, that's a completely fine outcome — say so rather
than manufacturing findings to justify having looked. The point is that
the context was available to inform judgment, not that it must produce
output.

## What gets reported

Record `{ generalCommentCount, siblingPr }` and pass it to Step 9's
`--sibling-context` flag. This renders as a one-line transparency note in
the posted summary — what informed the review — matching how Step 2b
already discloses when its `architecture-context` cache was built fresh
instead of reused. It is not a finding and carries no severity or
confidence.
