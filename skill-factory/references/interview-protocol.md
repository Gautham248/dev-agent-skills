# Interview Protocol

Full detail behind the "Core rule" and "Communicating with a weak or vague brief" sections of `SKILL.md`. Read this before running Phase 1 on any request that isn't already fully specified.

## Why this exists

A skill's description and instructions are the only things standing between "loads at the right time and does the right thing" and "silently mistriggers or half-works forever." Both failure modes are expensive to discover after the fact — they show up as production incidents, not error messages. The interview is cheap insurance against both, and it is the entire reason this skill exists rather than just handing someone the template.

Design for the requester who is bad at describing what they want. That person will under-specify triggers, skip edge cases entirely, and answer questions with "just make it work." The protocol below is built around that person, not the person who already hands you a perfect spec (that person just breezes through it faster).

## Question bank, by slot

For each slot, prefer the closed/example-anchored form on the left when the space of likely answers is small; fall back to the open form only when it genuinely isn't.

**skill_name**
- Closed: "Would `fix-payments-link` or `payments-link-fixer` read better to you? Either works, kebab-case only."
- Open (only if no draft name has come up yet): "If you had to name this in a few hyphenated words, what would you call it?"
- Always check it against the existing roster in `references/dev-agent-skills-integration.md` before finalizing.

**one_line_purpose**
- "In one sentence, if this worked perfectly, what would someone be able to do that they can't easily do now?"
- If the answer is a workflow description rather than an outcome, reflect it back as an outcome and confirm: "So the outcome is: a broken link gets found and a PR gets opened without anyone touching the code by hand — right?"

**category**
- Don't ask this as jargon. Infer it from the purpose and confirm: "This sounds like it's mostly about producing a specific kind of output (a document/PR/plan) — does that match, or is it more about coordinating a bunch of steps across different tools?" Use `references/design-patterns.md` to help place it.

**trigger_phrases_positive / negative**
- "What are two or three things you'd actually type to kick this off?" — literal phrasing matters more than a paraphrase.
- Then, always: "And what's something similar-sounding that should NOT trigger this?" — people almost never volunteer negative triggers unprompted, and skipping this is the single most common cause of over-triggering later. Don't skip it even if the requester seems to think it's obvious.

**workflow_steps**
- Walk it chronologically: "Once it triggers, what's the very first thing that should happen? And after that?"
- Watch for hidden decision points ("it depends") — when you hear that, stop and ask what the decision actually turns on, and what happens on each branch. An unstated branch is a bug waiting to happen, not an implementation detail.

**tools_required**
- "Does this need to reach out to anything — GitHub, Graphify, a specific MCP-connected service — or is it working with what's already in the conversation/repo?"
- If the requester doesn't know what's available, that's fine — note it as an open dependency rather than guessing a tool name.

**inputs_and_outputs**
- "What does the skill start with, and what should exist when it's done — a file, a PR, a comment, a plain answer?"

**edge_cases_and_errors**
- Never skip this slot even under pushback. "What's one way this could reasonably fail or go sideways, and what should happen instead of just breaking?" If they say "it won't fail," ask about the most boring failure anyway — bad input, a missing permission, an empty result — and get at least one answer on record.

**success_criteria**
- Quantitative: "How would you notice, from the outside, that this is working well versus poorly?"
- Qualitative: "What would make you trust the output without double-checking it every time?"

**test_cases**
- Skills with objectively checkable output (a file transform, a fixed-format PR, extracted data) benefit from test prompts; skills with subjective output (tone, style, planning prose) usually don't need them. Suggest the default that matches, but let the requester override it.

**dependencies**
- Only ask if `tools_required` implied a script: "Does whatever runs this need anything special installed, or network access beyond what's already available?"

**bundled_resources**
- Usually inferable from everything else — confirm rather than ask from scratch: "Sounds like this needs a couple of reference docs for the detailed rules and a template for the output — does that match, or is it simpler/more complex than that?"

## Weak-communicator patterns and what to do

| What you see | What it actually means | What to do |
|---|---|---|
| One-word or under-4-word answers to substantive questions | The question was too abstract, or they don't have a firm opinion yet | Re-ask with a concrete guess attached; make it a yes/no |
| "You decide" / "whatever's best" / "I don't know" | They trust you to propose, not to silently pick | Propose one specific default, state it plainly, ask for a thumbs up — never proceed on silence |
| Long rambling answer covering three topics at once | Multiple slots answered at once, possibly two skills' worth of scope | Split it back out slot by slot in your recap; flag if it looks like two skills |
| Answer contradicts something said two messages ago | Either changed their mind or the two answers describe different scenarios | Point out the apparent conflict directly and ask which one is current — don't silently pick one |
| Frustration / "just make something" | The interview is taking too long for their patience | Compress: batch the remaining closed-form questions into one short numbered list, but do not skip confirmation on the final spec summary — that step stays non-negotiable |
| Pastes a whole document or transcript | The workflow already exists somewhere | Extract everything inferable, list what you inferred, ask only about what's still missing |

## The "sign-off" bar

A confirmation only counts if it responds to the substance. "Yes," "looks right," "go ahead," "correct," or a specific edit followed by re-confirmation all count. A response that changes topic, a "sure" that arrives suspiciously fast after a long spec summary (worth a light double-check: "just to be sure — anything in there you want changed?"), or no response at all do not count as sign-off. When in doubt, ask once more in the shortest possible form: "Good to go with this as written?"

## Refining vs. creating

Everything above is written for a from-scratch interview (Track A). Refining an existing skill (Track B, `references/refining-skills.md`) uses the same underlying technique — one closed question at a time, propose-and-confirm for vague answers, periodic recaps — but only against the slots that are actually changing. Don't re-ask about a slot just because this section describes a good question for it; check `references/refining-skills.md`'s Phase R0/R1 first to see whether it's already been backfilled from the existing skill.
