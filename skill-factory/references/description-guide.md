# Writing a Description That Actually Triggers

The `description` field is the single highest-leverage sentence (or two) in a skill. It's the only thing evaluated before Claude decides to load the rest, so it has to do two jobs at once: say what the skill does, and say precisely when to reach for it.

## Structure

```
[What it does] + [When to use it] + [key trigger phrases / file types, if relevant]
```

Write it a little assertively about when it applies. Models tend to under-trigger skills that exist — a description that reads as one capability among many rather than "use this whenever X comes up" gets passed over more often than it should. It's fine, even good, for the description to explicitly nudge toward use: "make sure to use this whenever the user mentions X, even if they don't ask for it by name" is a legitimate and often necessary framing, not overselling.

## Good examples

> Analyzes design files and generates developer handoff documentation. Use when the user uploads design files, asks for "design specs," "component documentation," or "design-to-code handoff."

> Manages sprint planning, task creation, and status tracking for a project tool. Use when the user mentions "sprint," "tasks," "project planning," or asks to "create tickets."

> End-to-end customer onboarding: account creation, payment setup, subscription management. Use when the user says "onboard new customer," "set up subscription," or "create account."

Each of these names concrete literal phrases a user would type, not just an abstract capability.

## Bad examples, and why

> "Helps with projects." — too vague to distinguish from a dozen other things; gives Claude nothing to match against.

> "Creates sophisticated multi-page documentation systems." — describes capability with no trigger condition at all; Claude has no idea *when* to reach for it.

> "Implements the Project entity model with hierarchical relationships." — internal/technical framing with no user-facing trigger; nobody types anything resembling this.

## Negative triggers matter as much as positive ones

If a skill risks firing on adjacent-but-wrong requests, say so directly in the description:

> Advanced statistical modeling, regression, and clustering for data files. Do NOT use for simple data exploration or quick summaries — those don't need this skill.

Skipping this is the most common cause of over-triggering, and it's cheap to fix once you know to look for it.

## Debugging a triggering problem

**Under-triggers** (loads too rarely): the description is too generic, or missing the literal words people actually say. Fix by adding specific trigger phrases and, if it's a technical domain, the relevant jargon terms too — don't be afraid of technical keywords if that's genuinely how people will phrase the request.

**Over-triggers** (loads for unrelated things): the description is too broad, or missing a negative-trigger clause. Fix by narrowing the "what it does" half and adding an explicit "do NOT use for X" clause pointing at the correct alternative.

A fast diagnostic: ask "when would you use the `<skill-name>` skill?" in a fresh context and see what comes back — it will effectively echo the description back at you, which makes gaps obvious.

## Checklist before finalizing

- [ ] States what it does in plain language
- [ ] States when to use it, with literal example phrases
- [ ] Mentions relevant file types, if applicable
- [ ] Under 1024 characters
- [ ] No `<` or `>` anywhere
- [ ] Includes a negative-trigger clause if there's a plausible confusable skill
- [ ] Reads as slightly assertive about applicability, not hedged
