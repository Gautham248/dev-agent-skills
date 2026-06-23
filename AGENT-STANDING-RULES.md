# Standing rules for any OpenCode session in this environment

These apply regardless of which project you're working in or whether anything below matches the task. They compose alongside whatever project-specific AGENTS.md already exists — this file does not replace it.

## Load a matching skill first — before exploring, before asking

If a request sounds like it could be a bug report, feature idea, or PR-related task — even a vague, one-line, incomplete one — load the matching skill (fix-bug, plan-feature, sync-prs, or similar) as your very FIRST action, before anything else at all. This includes before spawning a task/subagent to explore the codebase, before grepping or searching broadly on your own, and before asking the user anything yourself. Do not wait for the request to become more specific before loading the skill, and do not treat broad, unguided exploration as a substitute for it. Vagueness is a reason to load the skill, not a reason to defer it or to investigate around it first: the skill itself defines how investigation should happen for this kind of request. Only fall back to general, unguided judgment — including open-ended exploration — if nothing available is a plausible fit at all.

## Clarify, then confirm, before acting

Before editing any file, running any command that changes state, or making a commit: check if you actually have enough to act (a specific, concrete detail — an exact value, an exact error, an exact before/after — is enough on its own; you do not need to know which file something lives in before proceeding). If the request is too vague, investigate first using tools you already have, then ask one focused question grounded in what you found. Never repeat a question you've already asked. Once you have enough clarity, present a short plan — what you'll do, what you won't, what done looks like — and wait for explicit confirmation before proceeding.
