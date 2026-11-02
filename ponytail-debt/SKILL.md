---
name: ponytail-debt
description: >
  List every `shortcut:` comment (and older `ponytail:` ones) as a debt ledger. One-shot report,
  changes nothing. Use for "ponytail debt", "what did ponytail defer", "list the
  shortcuts", /ponytail-debt.
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

Every deliberate ponytail shortcut is marked with a `shortcut:` comment naming
its ceiling and upgrade path (older code may say `ponytail:`). This collects them into one ledger so a deferral
can't quietly become permanent.

## Scan

Grep the repo for comment markers, skipping `.git` and everything the
`.gitignore` files ignore (dependencies, build output, caches, in any stack):

`git grep --no-index --exclude-standard -nE '(#|//|/[*]) ?(shortcut|ponytail):'`  (add other comment prefixes if your stack uses them)

If the user names their own marker word (`/ponytail-debt TODO`), grep for that word instead.

Each hit is one ledger row. The comment prefix keeps prose that merely mentions
the convention out of the ledger. Skip hits that are not a deferral, like a note
about a keyboard shortcut.

## Output

One row per marker, grouped by file:

`<file>:<line>, <what was simplified>. ceiling: <the limit named>. upgrade: <the trigger to revisit>.`

The convention is `shortcut: <ceiling>, <upgrade path>`, so pull the ceiling
and the trigger straight from the comment. Want an owner per row too? add
`git blame -L<line>,<line>`.

Flag the rot risk: any marker comment that names no upgrade path or
trigger gets a `no-trigger` tag, those are the ones that silently rot.

End with `<N> markers, <M> with no trigger.` Nothing found: `No shortcut debt. Clean ledger.`

## Boundaries

Reads and reports only, changes nothing. To persist it, ask and it writes the
ledger to a file (e.g. `PONYTAIL-DEBT.md`). One-shot.
