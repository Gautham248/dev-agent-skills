# Usage Guide — How to Work With the Agent

This guide covers how to communicate with the agent when using skills from this repo, what to expect at each stage of a session, and how to get consistently good results. The biggest gains come not from learning special syntax but from understanding what the system is actually doing and aligning your communication with that.

---

## The mental model

When you start a session, the agent is not reading your request in isolation. It is executing a fixed sequence of steps before it does anything else, regardless of what you said. Those steps are:

1. **Create `AGENTS.md`** at the project root if it doesn't exist (copies the full standing rules into the project so every harness that reads `AGENTS.md` gets them too).
2. **Check for a knowledge graph** (`graphify-out/graph.json`). If present, query it. If absent, build it first using the `graphify` skill.
3. **Load the matching workflow skill** (`fix-bug`, `plan-feature`, etc.) via the skill-loading tool.
4. **Clarify before acting** — investigate, ask at most one focused question, present a plan with explicit scope and a hard stop.
5. **Act only after your explicit confirmation.**
6. **After finishing, record any real edge cases** the skill didn't cover into that skill's `references/edge-cases.md`.

Understanding this sequence tells you what to expect and what is and isn't your job to specify.

---

## What you need to provide vs. what the agent finds itself

**Your job:** Tell the agent *what* you want — in plain language, as specifically as you can about the symptom or desired outcome.

**Not your job:** Tell the agent *where* to look, which files are involved, or which lines to change. The agent queries the knowledge graph to find that. If you ask it to "fix the broken link on the homepage," you do not need to name the component file — it will find it.

**Specific values beat vague descriptions every time.** "The hyperlink to the App Store is pointing to the wrong URL" is better than "there's a link problem." An exact error message is better than "it's throwing an error." A precise before/after ("it says 'Explore' but should say 'Shop Now'") is better than "the button text is wrong."

---

## How to prompt a skill

### OpenCode

Skills are invoked via the skill-loading tool (the tab key opens the skills picker). Never type a skill name as plain chat text — that doesn't invoke the skill's instructions, it just produces a description of what the skill is. The correct flow:

```
Press Tab → type the skill name → select → press Enter
```

Then describe your request in the same message:

```
[loaded fix-bug skill]
The "Download on App Store" button on the hero section is pointing to the old iOS app link instead of the new one.
```

If you're using Hermes, explicitly name the skill in your prompt — Hermes does not auto-select skills based on the request description:

```
Use the fix-bug skill to fix the App Store link in the hero section.
```

### Claude Code / Codex / Gemini CLI

Use the slash command syntax to load a skill:

```
/fix-bug
The App Store link in the hero section points to the wrong URL.
```

Or name it in natural language (these harnesses will usually auto-select based on the `description` field in the skill's frontmatter):

```
Fix the broken App Store link on the hero section — it should point to <new-url>.
```

---

## The clarification step — what to expect and how to respond

After loading the skill and querying the graph, the agent will do one of two things:

**Case A — it has enough.** The request was concrete. It investigated with the graph, found the relevant file, and now presents a plan directly without asking a question. This is the ideal case. Let it present the plan, read it carefully, then confirm or push back.

**Case B — it needs one more thing.** The request had an ambiguity it couldn't resolve by investigation alone. It will ask exactly one focused question, grounded in what it actually found:

> "I found two places where an App Store URL is referenced — one in `HeroSection.tsx:47` and another in `Footer.tsx:23`. Which one should be updated, or both?"

This is different from a generic "which file is it in?" question — the agent already found the candidates and is asking you to choose between them. Answer directly:

> "Both."

or

> "Just the hero, leave the footer."

Do not provide additional information that wasn't asked for in response to a clarification question — that often causes the agent to restart its investigation cycle. Answer only what was asked, then let it continue.

**If the agent asks more than one question:** Push back. The protocol permits exactly one question per turn. Say "ask me one thing at a time" and it will comply.

**If the agent keeps asking questions across multiple turns:** After 3–4 exchanges, it should stop and present a plan with its best current understanding flagged as uncertain. If it isn't doing this, say explicitly: "That's enough information, present your plan now." This is a valid instruction and it will comply.

---

## The plan — how to read and respond to it

Every action is preceded by a plan in this format:

> **What I'm going to do:** Update the `appStoreUrl` constant in `HeroSection.tsx` from the old URL to the new one.
>
> **What I'm NOT going to do:** Touch the App Store link in `Footer.tsx`, modify any other URL references, or change anything about the hero section's layout or styling.
>
> **What "done" looks like:** The hero section's App Store button opens the correct URL. TypeScript compiles cleanly. No other files are modified.
>
> Want me to go ahead with this?

Read all three parts before responding. The "what I'm NOT going to do" section is particularly important — it's where the agent tells you what scope it's deliberately excluding. If something you expected to be included is excluded there, say so before confirming.

**Confirming:** Any clear affirmative works — "yes," "go ahead," "do it," "looks good." The agent is looking for an explicit yes, not a description of your approval.

**Pushing back:** If anything in the plan is wrong, say what's wrong specifically:

> "The footer link also needs to be updated, include that."

The agent will revise the plan and re-present it. You will see the plan again before anything changes. Do not say "yes" to the revised plan until you've read it again.

**Tangential replies are not confirmations.** If you ask "how long will this take?" in response to the plan, the agent will answer your question but will not proceed. It is waiting for a yes or no, not a tangential reply treated as implicit approval.

---

## What a good session looks like

Here is an annotated example of a correct full session flow:

**Your prompt:**
```
/fix-bug
The "Download on App Store" button link is broken — it's still pointing to the old app.
```

**Agent (turn 1):** Checks for `AGENTS.md` (creates it if missing), checks for `graphify-out/graph.json`, reports `GRAPH EXISTS`, queries the graph for "App Store URL components," finds two relevant components, asks one question:
> "I found App Store URL references in `HeroSection.tsx:47` and `AppBanner.tsx:23`. Do you want both updated, or just the hero?"

**You:** "Just the hero."

**Agent (turn 2):** Presents the plan. What it will do (update line 47), what it won't do (touch AppBanner), what done looks like (button works, tsc clean, no other changes).

**You:** "Yes, go ahead."

**Agent (turn 3):** Makes the change, runs `tsc --noEmit`, reports the result, shows the diff.

**Agent (turn 4, end of session):** Checks whether any real edge case was encountered that the skill didn't cover. If yes, appends an entry to `fix-bug/references/edge-cases.md`. If no genuine edge case, does nothing.

Total confirmation cycles: 1. Total questions asked: 1. Total unexpected edits: 0.

---

## What bad sessions look like and how to recover

### The agent skips the graph step and greps directly

**Symptom:** The agent says "let me search for App Store" and starts running `grep` without mentioning `graphify` first.

**Why it happens:** The request seemed too simple to warrant a graph query, or the agent is not correctly reading `AGENT-STANDING-RULES.md`.

**What to do:** Interrupt immediately. Say: "Stop — check for the knowledge graph first before investigating. Run `test -f graphify-out/graph.json && echo 'GRAPH EXISTS' || echo 'NO GRAPH YET'`." Once it does that, the session can continue normally.

**Prevention:** Verify OpenCode is loading `AGENT-STANDING-RULES.md` correctly (see Setup guide, Step 4). For Hermes, explicitly include "following AGENT-STANDING-RULES.md" in your prompt.

### The agent presents the plan and immediately acts in the same turn

**Symptom:** The plan appears and changes are already made before you've responded.

**Why it happens:** The agent treated the plan presentation as a formality rather than a hard stop, or interpreted something in your prior message as pre-approval.

**What to do:** If the change is wrong, ask it to revert: "Revert those changes, I hadn't confirmed yet." If the change happens to be correct, note it as a protocol violation for future reference but proceed.

**Prevention:** Make sure your prior messages don't include phrases like "just do it" or "go ahead and X" before the plan is presented — those can be misread as pre-authorization. Wait for the plan, then confirm.

### The agent asks for a file path or line number

**Symptom:** "Which file should I edit?" or "Can you give me the line number?"

**Why it happens:** The graph query didn't find clear candidates, or the request was too vague even after investigation.

**What to do:** Do not answer the file path question — that's the agent's job, not yours. Instead, give it more detail about the symptom or the outcome you want:
> "The broken link is the one on the main homepage hero section — the big 'Download on App Store' button."
If the graph truly can't find it, the agent should fall back to ordinary file exploration and say so — not ask you to do its investigation for it.

### The agent ignores the skill and answers directly

**Symptom:** You asked to fix a bug and the agent just describes what the fix would be without actually doing anything, without loading a skill, and without a plan/confirm cycle.

**Why it happens:** For Hermes, the skill name wasn't explicit in the prompt. For other harnesses, the `description` field in the skill's frontmatter didn't match the request well enough to trigger auto-selection.

**What to do:** Be explicit: "Load the fix-bug skill and then fix this." For Hermes, always name the skill.

---

## Prompting patterns that work well

**Bug fixes:**
```
Fix [specific symptom] — [what it should do instead].
```
```
Fix the broken App Store link on the hero section — it should open https://apps.apple.com/...
```

**Feature planning:**
```
Plan [what you want built]. Here's the context: [paste relevant doc or describe the feature].
Save the plan to plans/ when you're done.
```

**Code review:**
```
Review [what was changed / what PR] using first-principles-review.
Focus on [the thing you're most uncertain about].
```

**Bringing in context the agent doesn't have:**
```
Here's the relevant background: [paste the doc/spec/ticket].
Use [skill name] to [task].
```

**Constraining scope explicitly:**
```
Fix only [this specific thing]. Do not touch [adjacent thing].
```
Stating explicit scope in your prompt reinforces the "what I won't do" section of the plan and reduces the risk of a broader-than-intended change.

---

## Verifying a session actually followed the protocol

After any session, these are the things worth checking — especially for high-stakes changes:

**1. Did the graph run?**
```bash
ls -la graphify-out/graph.json
# Check the mtime — it should be from this session if the graph was freshly built,
# or older if it already existed and was queried.
```

**2. Did the agent make only what it said it would make?**
```bash
git diff --stat
```
Compare against what the plan said. If the diff includes files not mentioned in the plan, ask the agent to explain and revert the unexpected changes.

**3. Did TypeScript compile clean after?**
```bash
npx tsc --noEmit; echo "exit: $?"
```
A clean session should leave exit 0. Any new errors introduced by the change need to be fixed before committing.

**4. Did the self-improvement step fire correctly?**
```bash
# For whichever skill was used:
cat fix-bug/references/edge-cases.md 2>/dev/null || echo "no entries yet"
```
If the session hit a genuine edge case, a dated entry should appear here. If it didn't hit one, the file should be unchanged. A new entry for a routine run (no edge cases) means the protocol was applied too liberally — that entry should be removed.
