# GitHub workflow reference

Branch naming, PR format, and guardrails for the fix-bug skill.

## Branch naming

```
agent/fix/<slug>-<YYYYMMDD>
```

- `<slug>` — first 4–5 words of the bug description, lowercase, hyphenated,
  alphanumeric only. Remove articles (a, the, an).
- `<YYYYMMDD>` — today's date.

Examples:
```
agent/fix/supabase-url-wrong-20260608
agent/fix/homepage-link-broken-20260609
agent/fix/api-endpoint-wrong-20260610
```

## Commit message

```
[agent] fix: <bug description, max 60 chars>
```

Examples:
```
[agent] fix: Supabase URL pointing to wrong project
[agent] fix: Homepage Play Store link wrong URL
```

## PR title

```
[Agent] Fix: <bug description, max 60 chars>
```

## PR body template

```markdown
## [Agent] Fix

**Issue:** <bug description>
**Reported by:** @<reporter>
**Environment:** <production / staging / local>

---

**Root cause / Change made:** <one sentence>

**File changed:** `<path>`
**Files read but not changed:** <list or "none">

**Confidence:** <high / medium / low>

<If medium or low, explain here>

---
> ⚠️ This PR was opened by an AI agent. Please review carefully before merging.
```

## Guardrails — what the agent must never do

| Action | Rule |
|---|---|
| Merge the PR | ❌ Never — humans merge |
| Delete any file | ❌ Never |
| Push to main directly | ❌ Never |
| Fix more than reported | ❌ Never — note extras in PR body only |
| Touch .env or secrets | ❌ Never |
| Open multiple PRs per bug | ❌ Never |
| Force-push | ❌ Never |
| Retry more than twice | ❌ Never — report failure instead |

## Confidence levels

| Level | When to use |
|---|---|
| **High** | Single clear file, single clear change, obvious fix |
| **Medium** | Fix is plausible but file could be wrong, or change is non-trivial |
| **Low** | Agent is uncertain about root cause — reviewer must verify carefully |

Always state confidence in the PR description. Medium or low confidence means
the reviewer should read the change extra carefully.
