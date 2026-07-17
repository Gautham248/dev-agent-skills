# Graph-memory protocol

Applies only to skills that opt in via `graph-memory: true` in frontmatter, and only at the specific points in that skill's own body marked `**Graph-memory:**`. Governs `graphify`'s built-in `save-result`/`reflect` mechanism — a persistent, cross-session record of whether a specific graph query actually helped, kept separate from and complementary to the other two protocols in this repo:

- **Self-improvement** records that *this skill's instructions* were missing something.
- **Session-memory** avoids redundant re-checking *within one conversation*.
- **Graph-memory** records whether *a specific part of the codebase graph* has reliably been useful for answering a kind of question — persisted *across* conversations and developers, at the level of the code, not the skill.

None of these substitute for either of the others. A skill can opt into any combination.

---

## Before relying on a graph query's results

At the marked point, before acting on what a graph query returned:

```bash
graphify reflect
cat graphify-out/reflections/LESSONS.md 2>/dev/null
```

Cheap and deterministic — no LLM call, typically well under a second — safe to run every time this point is reached, not something to ration.

Check whether any node or question you're about to rely on appears under **Known dead ends** or **Corrections**. If it does:

- **Known dead end** — don't re-derive it from scratch the same way; say explicitly that this path is already known not to lead anywhere, and look elsewhere.
- **Correction** — the corrected understanding takes precedence over what a fresh read of the code might suggest, unless you have specific reason to think the correction itself is now stale.
- **Tentative or Contested** — treat as a weak signal, not a fact. Verify against the actual current code before relying on it either way.

**Known limitation, confirmed by testing, not a guess:** `reflect` cross-references live against the current graph on every run, so a renamed or deleted node's structural signal (Tentative/Contested/dead-end bucketing) is silently dropped rather than shown stale — that part is safe. But this dropping is *silent*: nothing in `reflect`'s output flags that a reference was excluded. If a lesson seems to be missing something you'd expect, that may be why — check the actual current code rather than assuming the memory system has nothing to say.

## After finishing

At the marked point, once the actual outcome is known — not before:

```bash
graphify save-result \
  --question "<the actual question the graph was queried to answer>" \
  --answer "<what was found>" \
  --nodes "<node1>" "<node2>" \
  --outcome useful|dead_end|corrected \
  [--correction "<what's actually true, if outcome=corrected>"]
```

Be honest about the outcome — `useful` for a query result that actually helped, `dead_end` for one that led nowhere, `corrected` for one that turned out to be wrong once you actually checked. Recording `useful` by default because it's the path of least resistance defeats the entire point: the value of this system is entirely in the *accuracy* of what gets recorded, not the volume.

## Anti-patterns — explicitly forbidden

- Skipping the before-check because the query "obviously" already has a good answer. The check is cheap specifically so there's no reason to skip it.
- Recording an outcome you didn't actually observe (e.g. marking `useful` without having verified the answer was actually used correctly).
- Treating `reflect`'s output as authoritative over directly reading the current code. It's orientation, stated explicitly in its own output — verify before relying, always.
- Silently not calling `save-result` because the outcome was `dead_end` or `corrected` and feels like reporting a failure. A recorded dead end is exactly as valuable as a recorded success — it's what stops the next session from re-deriving the same mistake.
