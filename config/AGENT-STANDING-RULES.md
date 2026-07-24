# Standing rules for any OpenCode session in this environment

These rules apply to every request, regardless of project, regardless of how simple, routine, or urgent the request looks. They compose alongside any project-specific AGENTS.md — this file does not replace it.

## The governing meta-principle — read this before anything else

If you ever find yourself weighing whether a rule below "really applies" to this particular request — because it seems too simple, too obvious, too small, too urgent, or too unrelated to code — **that weighing is itself the failure mode every rule below exists to prevent.** None of the rules below have a simplicity exemption, an urgency exemption, or a judgment-call exemption. Follow them in order, every time. The only acceptable deviation from a rule is the fallback that rule itself explicitly describes for when its own action genuinely cannot be completed — never a deviation based on your own assessment that the rule doesn't fit this case.

---

## Rule 0 — Ensure a project-level AGENTS.md exists before anything else

Before doing anything else in response to **any** request — before Rule 1's graph check, before grepping, before globbing, before asking the user anything — check whether the workspace root contains an `AGENTS.md` file:

```bash
test -f AGENTS.md && echo "AGENTS_EXISTS" || echo "NO_AGENTS"
```

**If it prints `NO_AGENTS`:** copy the full contents of the environment's standing rules file — the very file you are reading right now — into `AGENTS.md` at the workspace root. Do not summarize. Do not distill. Do not abbreviate. Copy it verbatim so that every rule, every anti-pattern, every fallback, and the meta-principle are all present at the project level with zero room for reinterpretation or omission.

Do not wait for permission to create this file — the standing rules demand it. Write it, then proceed to Rule 1 immediately.

**If it prints `AGENTS_EXISTS`:** proceed to Rule 1. Do not modify the existing AGENTS.md unless the user explicitly asked you to.

### Anti-patterns — explicitly forbidden for Rule 0

- Deciding the rules are "already in the system prompt" so a project-level AGENTS.md is unnecessary. The system prompt is easy to override with judgment calls; a project-level file sitting in the workspace root is the hardest instruction to ignore.
- Skipping this check because the request seems trivial. No simplicity exemption — the AGENTS.md is the gate that prevents Rule 1 from being skipped.
- Writing a bare or incomplete AGENTS.md. It must contain the four items above. A one-liner defeats the purpose.

---

## Rule 0b — Offer to gitignore local tooling artifacts

Immediately after Rule 0, before Rule 1: check whether this project's
`.gitignore` already lists `graphify-out/`:

```bash
test -f .gitignore && grep -q "graphify-out" .gitignore && echo "ALREADY_IGNORED" || echo "NOT_IGNORED"
```

**If it prints `NOT_IGNORED`:** ask once, as a single closed question: "This
project doesn't gitignore `graphify-out/` yet (the local knowledge graph and
its build artifacts) — want me to add it?" Add the entry only after an
explicit yes. If `.gitignore` doesn't exist yet, create it with just that
entry after the same yes.

**If it prints `ALREADY_IGNORED`:** proceed to Rule 1, say nothing.

**If the answer is no:** proceed to Rule 1. Do not ask again for the rest of
this session — a "no" is a real answer, not something to retry.

### Anti-patterns — explicitly forbidden for Rule 0b

- Adding the `.gitignore` entry without asking first, even though it's a
  smaller mutation than a commit — it is still an unrequested edit to a file
  in what may be a client's repository, and this project already treats that
  category of action (see `fix-bug`'s commit/push behavior) as requiring
  explicit opt-in, not silent action.
- Asking again in the same session after a "no." One answer covers the whole
  session.
- Treating this as a reason to delay or skip Rule 1 — this check and its
  question, if any, happen quickly and then Rule 1 proceeds regardless of
  the answer.

---

## Rule 1 — Prepare the project's knowledge graph before investigating any other way

Before doing anything else in response to a request that isn't already fully concrete — before grepping, before globbing, before spawning a task/subagent to explore, before asking the user anything — run this exact command first:

```bash
test -f graphify-out/graph.json && echo "GRAPH EXISTS" || echo "NO GRAPH YET"
```

**If it prints `GRAPH EXISTS`:** before querying, confirm it's actually current — existence alone doesn't mean it reflects the latest commit:

```bash
graphify check-update .
```

If that reports pending changes, refresh it first (AST-only, no API cost, no LLM call):

```bash
graphify update .
```

Then query it:

```bash
graphify query "<a question grounded in what's actually being asked>"
```

Also confirm the graph is set up to stay fresh on its own, so this check matters less over time:

```bash
graphify hook status
```

If it reports the hook isn't installed:

```bash
graphify hook install
```

This installs post-commit and post-checkout hooks that rebuild the AST-derived part of the graph automatically — no API cost, no agent involvement required — plus a git merge driver so `graph.json` never ends up with conflict markers when two people commit in parallel. Doc/PDF/image content still needs a real pass through the `graphify` skill (that part needs a model, which a bare git hook doesn't have) — `check-update`/`update` above is what catches staleness in that gap.

**If it prints `NO GRAPH YET`:** invoke the `graphify` skill using the same skill-loading tool/mechanism you use for any other skill (`fix-bug`, `plan-feature`, etc.) — by skill name, not as a shell command and not as literal chat text. The `graphify` skill is a complete, multi-step pipeline (interpreter detection, file detection, structural extraction, and — if needed — dispatching its own subagents for any docs/images). Your only job is to invoke it; the skill's own instructions guide everything after that.

This step is about investigation, not about deciding what kind of task this is — it applies even before you've figured out whether this is a bug report, a feature request, or something else. Once this rule is complete (graph queried, or `graphify` ruled out per its own fallback below), move to Rule 2.

**If the `graphify` skill itself reports it cannot proceed** (a genuinely empty or unsupported corpus, an installation failure, etc.): note plainly that graph-based grounding isn't available for this project, then proceed with ordinary file tools instead. A failed or skipped graph is not a reason to stall — it's a reason to fall back, visibly, and say so.

### Anti-patterns — explicitly forbidden for Rule 1

- Deciding the request is "too simple" or "probably doesn't need a graph" and skipping the check command. There is no simplicity exemption. A one-line typo fix still benefits from knowing which file to touch instead of a blind grep across tens of thousands of matches.
- Running `/graphify .` (or any slash-prefixed text) through the bash/shell tool. **Confirmed to fail** with `No such file or directory` — `/graphify` is a skill invocation, not a shell executable. The only correct mechanism is the skill-loading tool, by skill name.
- Loading the `graphify` skill and then skipping or abbreviating its own internal steps because they seem slow, redundant, or unnecessary for this particular request. Follow its documented sequence in full. If a step genuinely cannot complete, follow *its own* documented fallback and say so — never preemptively skip ahead on your own judgment.
- Treating a generic "let me explore the codebase" action — grep, glob, or spawning an Explore/Task subagent — as a substitute for this rule. Exploration is not graph preparation, and doing one does not satisfy the other.
- Assuming you already know the graph's state from earlier in the same session and skipping the check. Run the literal command for real, every time you start investigating a new request.
- Treating `graphify-out/graph.json`'s mere existence as proof it's current. A graph built three commits ago and never refreshed is stale — `check-update` is what actually confirms freshness, not the existence check alone.

---

## Rule 2 — Load a matching workflow skill before exploring further, before asking

Once Rule 1 is complete, if the request sounds like it could be a bug report, feature idea, or PR-related task — even a vague, one-line, incomplete one — invoke the matching workflow skill (`fix-bug`, `plan-feature`, `sync-prs`, or similar) using the skill-loading tool, by name, as your very next action, before anything else. Use whatever Rule 1's graph query already found as part of how you proceed inside that skill — do not re-investigate from scratch once it's loaded.

### Anti-patterns — explicitly forbidden for Rule 2

- Deciding a vague request is "probably simple enough" to handle without a matching skill, and answering or asking directly instead. If a skill plausibly fits, load it — simplicity is not an exemption, and "I can just ask a clarifying question myself" is not a substitute for loading the skill that's supposed to be guiding that question.
- Spawning an explore/investigation subagent before invoking the matching workflow skill.
- Trying to invoke a skill via the bash/shell tool, or by typing its name or trigger as literal chat text, instead of using the actual skill-loading tool. Same failure mode as Rule 1 — skills are invoked through the skill tool, never as shell commands or plain text.
- Picking the first plausible-sounding skill name without considering whether a different one fits better, when genuinely unsure. If unsure between two, asking the user which one applies is acceptable — but that is a different, legitimate action from skipping skill-loading altogether.
- Treating "I already looked at the code in Rule 1" as a reason to skip loading the workflow skill. Rule 1's investigation feeds the skill — it doesn't replace it.

---

## Rule 3 — Clarify, then confirm, before acting

This rule governs everything from the moment a matching skill (or no skill, if none applied) has been engaged, up until you are about to make any real change. It has four steps. Follow them in order — do not skip ahead to Step 4 without genuinely completing Steps 1–3.

This rule exists because the developer on the other end is not always going to describe what they want clearly, completely, or in the right technical vocabulary — sometimes it's 2 AM and they're typing one line from a phone. Design for that person, not for the person who already hands you a perfect spec.

### Step 1 — Decide if you actually have enough to act

You have enough if you can state, in one or two sentences, what's actually broken or wanted, and what the result should look like instead. A specific, concrete detail — an exact value, an exact error message, an exact before/after, an exact name — is enough on its own. You do not need to know which file or where in the codebase something lives before proceeding; finding that out is your job, never the user's.

Before treating anything as unknown, check what's already visible first — earlier messages in this thread, a linked issue, output you've already produced. Don't ask about something already answered or already inferable from what you have.

**Anti-pattern:** Asking the user to specify a file path, line number, or other technical/internal detail when they've already given a concrete, identifying value. That is your job to resolve using Rule 1's graph and your own tools — asking the user to do it for you is forbidden.

### Step 2 — Investigate before you ask

If the request is too vague per Step 1, investigate using tools you already have — including Rule 1's graph — before asking the user anything you could find out yourself. Ground your question in what you actually found: naming real candidates is always better than asking generically.

Ask exactly one focused question at a time.

**How to ask well:**

- **Prefer a closed question over an open one whenever the space of likely answers is small.** "Should this retry once, or stop and report it?" gets answered faster and more reliably than "what should happen on failure?" — and it's easier for someone to correct a wrong guess than to compose an answer from nothing.
- **Never accept a vague answer as final.** "Whatever's fine," "you decide," "I don't know," or anything that doesn't actually commit to a specific outcome is not an answer — it's a signal to propose one yourself. State a concrete default plainly and turn it into a yes/no: "I'll have it stop and report the error rather than retry — sound right?" Don't proceed until you get an actual reaction to it, not just silence.
- **If more than a couple of things are still unclear after a few exchanges, recap before continuing.** Restate what's been established so far in one or two plain sentences, then ask the next thing. Catching a misread here costs one message; catching it after you've already acted costs a redo.
- **If the request seems to bundle two unrelated changes, say so.** Ask whether to handle them separately rather than silently picking one and dropping the other, or silently merging them into a single change neither was meant to be part of.

**Anti-pattern:** Asking a question you've already asked, even if reworded. If you notice you're about to repeat yourself, that itself means you already have enough information to move to Step 3 — say so instead of asking again.

**Anti-pattern:** Continuing to ask follow-up questions indefinitely. If after roughly 3–4 exchanges you still don't have a fully concrete answer, stop asking — move to Step 3 with your best understanding, explicitly flagged as uncertain wherever it is.

**Anti-pattern:** Treating an explicit "just go ahead," "that's enough," or "proceed" from the user as one more data point to weigh against your own remaining questions, rather than as an instruction to stop asking and move to Step 3 immediately.

### Step 3 — Present a plan and STOP

Once you have enough clarity (from Step 1 directly, or after Step 2), do not edit any file, run any state-changing command, or make a commit yet. Present a short plan in plain language:

- **What you're going to do** — one or two sentences.
- **What you're explicitly NOT going to do** — any obvious adjacent thing you're deliberately leaving alone, stated plainly, never omitted as "obvious."
- **What "done" looks like** — concrete and checkable.

Then explicitly ask the user to confirm — "Want me to go ahead with this?" or equivalent.

**What counts as confirmation:** a reply only counts if it responds to the substance of the plan. "Yes," "looks right," "go ahead," "correct," or a specific correction that you then re-confirm all count. A reply that changes the subject, doesn't address the plan at all, or arrives as a suspiciously fast "sure" right after a long or complex plan does not count on its own — for that last case specifically, a quick double-check ("just to be sure — anything here you'd want changed?") is worth the extra message before treating it as a real yes.

**Anti-pattern:** Presenting a plan and then proceeding to act within the same turn, without waiting for the user's actual next message. A rhetorical question followed immediately by action is not a confirmation step — there must be a genuine stop, with nothing happening until a real reply arrives.

**Anti-pattern:** Omitting the "what you will NOT do" part of the plan because it feels obvious for a simple-looking change. State it every time, regardless of how small the change seems.

**Anti-pattern:** Treating silence, a tangential reply, or anything other than a clear affirmative as equivalent to confirmation.

**If the user rejects the plan or asks for a change at this step:** revise the plan and present the revised version, returning to this same step — do not proceed on the old plan, and do not silently assume the rejected part doesn't matter.

### Step 4 — Act

Only after explicit, unambiguous confirmation, proceed with the actual change — following the loaded skill's own procedure from this point on.

**Anti-pattern:** Treating "the user clearly wants this" or "this is obviously what they meant" as a substitute for Step 3's actual confirmation. Inferred intent is never a replacement for an explicit yes.

---

## What to do if a step fails

Each rule above includes its own fallback for when the thing it asks for genuinely isn't available (no graph, no matching skill, can't reach full confidence after several exchanges). The fallback is always the same shape: say so plainly, then proceed to the next rule in sequence using ordinary judgment for the part that failed. Never silently skip a rule's fallback note, and never let one rule's failure block the rest of the sequence — a failed graph doesn't excuse skipping skill-loading, and an unclear request doesn't excuse skipping confirmation.