# Finding schema

Every finding is one JSON object. `scripts/review-cli.mjs validate` enforces
this; anything failing it never reaches GitHub.

```json
{
  "lens": "coding-standards-backend",
  "severity": "blocker",
  "file": "src/routes/api/docs.ts",
  "line": 4,
  "side": "RIGHT",
  "start_line": null,
  "evidence": "return db.query(`SELECT * FROM docs WHERE owner = '${id}'`);",
  "rationale": "`req.query.id` is interpolated into SQL with no validation at the boundary. A crafted `id` closes the quote and appends arbitrary SQL.",
  "confidence": 0.95,
  "suggestion": "  return db.query('SELECT * FROM docs WHERE owner = $1', [id]);"
}
```

| Field | Required | Rule |
|---|---|---|
| `lens` | yes | Which registry lens raised it. Makes the finding traceable to a written standard. |
| `severity` | yes | `blocker` \| `should` \| `nit`. `first-principles-review` owns this vocabulary — do not add levels, and do not use "suggestion". |
| `file` | yes | Path as it appears in the diff (the **new** path for renames). |
| `line` | yes | Line in the new file for `RIGHT`, old file for `LEFT`. Must be inside a hunk. |
| `side` | no | `RIGHT` (default) for added/context, `LEFT` for removed lines. |
| `start_line` | no | For multi-line comments. Must be `< line` and itself anchorable. |
| `evidence` | yes | The line, quoted **verbatim**. Validated against the diff. |
| `rationale` | yes | The failure mode and the fix. Not a restatement of the rule. |
| `confidence` | yes | 0–1. Below 0.6 is held back from posting; a `blocker` posts regardless. |
| `suggestion` | no | Replacement text, rendered as a GitHub suggestion block. |

## Why evidence is mandatory

A finding that cannot quote its own line is a finding about a line that may
not exist. This is the single check that separates a review you can trust
from a plausible-sounding one — and it is mechanical, so it does not depend
on the model being honest about its own output.

The validator rejects a finding whose `evidence` does not match the actual
line content. Substring matches are accepted (quoting the relevant fragment
of a long line is fine); unrelated text is not.

## Severity, concretely

- **blocker** — must change before merge. Data loss, security, a broken
  invariant, an unrevertable migration. Always surfaced regardless of
  confidence.
- **should** — push back unless the author defends it. Design choice, missing
  test coverage of the actual property, scope creep.
- **nit** — strictly cosmetic. If you have more than two or three, you have a
  style argument that belongs in a separate PR, not this review.

## Rationale quality

Specific beats general, every time.

Good: ``` `cache.get(id) || fetch(id)` races when two requests hit `fetch`
simultaneously; the second result overwrites the first. Dedupe on in-flight
promises, or drop the cache and use the existing `RequestQueue`. ```

Bad: `Consider thread safety here.`
