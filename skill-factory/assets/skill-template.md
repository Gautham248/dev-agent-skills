---
name: your-skill-name
description: One sentence stating what it does. Use when the user says "TRIGGER_PHRASE_ONE", "TRIGGER_PHRASE_TWO", or "TRIGGER_PHRASE_THREE". Do NOT use for THE_CONFUSABLE_ADJACENT_CASE — use OTHER-SKILL-NAME instead.
---

# [Skill Display Name]

One or two sentences: what this skill lets someone accomplish, and the outcome it produces. State the most critical instruction here at the top if there is one — don't bury it lower in the file.

## When this applies

- Triggers on: [literal phrase 1], [literal phrase 2], [literal phrase 3]
- Does NOT apply to: [adjacent case] — that belongs to [other-skill]

## Instructions

### Step 1: [First major step]
What happens, concretely. Name the exact tool/command/call if there is one:
```bash
python scripts/example.py --input {filename}
```
Expected result: [what success looks like for this step]

### Step 2: [Next step]
...

(Add or remove steps to match the actual workflow. If there's a decision point, state the condition and both branches explicitly — don't leave a branch implicit.)

## Edge cases and error handling

**If [specific failure condition]:**
[What to do instead of failing silently or generically]

**If [another realistic failure]:**
[What to do]

## If something goes wrong

Before improvising a fix, check `references/edge-cases.md` — this may already be a documented, solved problem. If it's genuinely new once you're done, follow the self-improvement protocol and add it there.

## Examples

**Example 1: [common scenario]**
User says: "[example request]"
Actions: [step], [step], [step]
Result: [concrete outcome]

**Example 2: [a second, meaningfully different scenario]**
...

## Troubleshooting

**Error: [common error message or symptom]**
Cause: [why it happens]
Solution: [how to fix it]

## References

- `references/[topic].md` — [when to open this: what's in it, when it's needed]

(Only add scripts/, references/, assets/ directories that are actually used — an empty or unused directory is a sign the skill scope drifted during drafting.)
