# Testing Checklist

Hand this to the requester in Phase 6 rather than running automated evaluations yourself — this skill's job is to produce a good, testable skill and a clear plan for checking it, not to be the test harness. If the requester wants to go further (scripted or programmatic evals), that's a separate, heavier-weight effort than what this skill produces by default.

## The three things worth checking

### 1. Triggering
**Goal:** the skill loads when it should, and doesn't when it shouldn't.

Give the requester:
- 2–3 prompts phrased the obvious way (matching the trigger phrases from the spec)
- 1–2 prompts phrased as a paraphrase of the same intent, to check the description generalizes
- 1–2 prompts on an adjacent-but-different topic, to check it doesn't over-trigger

### 2. Functional correctness
**Goal:** when it does trigger, it produces the right output.

Only relevant if the spec's `test_cases` slot was "yes." Frame each test as: given a specific input, when the skill runs, then these specific things should be true (a file exists with expected content, an API call succeeded, no errors were raised). Concrete and checkable beats a narrative description of what happened.

### 3. Comparison against no-skill baseline
**Goal:** confirm the skill is actually saving effort, not just adding structure for its own sake.

Worth doing once, informally, for anything nontrivial: run the same request with the skill disabled and note how many back-and-forth messages, tool-call failures, or retries it took versus with the skill active. If there's no real difference, the skill isn't earning its place yet — that's worth surfacing rather than shipping anyway.

### 4. Regression check (refinements only)
**Goal:** confirm the fix didn't break something that already worked.

When refining an existing skill (`references/refining-skills.md`, Track B), always include at least one test of prior, already-working behavior alongside tests of the new change — a trigger phrase or scenario that worked before. A refine that fixes the reported problem but silently breaks something else is a net loss, and nothing in a testing plan built only around the new change would ever catch it.

## Full pre/during/post checklist

**Before starting:**
- [ ] 2–3 concrete use cases identified
- [ ] Tools identified (built-in, specific MCP, or bundled scripts)
- [ ] Folder structure planned

**During development:**
- [ ] Folder named in kebab-case
- [ ] `SKILL.md` exists, exact spelling
- [ ] YAML frontmatter has `---` delimiters
- [ ] `name`: kebab-case, no spaces/capitals
- [ ] `description` includes both what and when
- [ ] No XML angle brackets anywhere
- [ ] Instructions are clear and actionable
- [ ] Error handling included
- [ ] At least one example provided
- [ ] References clearly linked

**Before upload/commit:**
- [ ] Tested triggering on obvious phrasing
- [ ] Tested triggering on paraphrased phrasing
- [ ] Verified it does NOT trigger on unrelated topics
- [ ] Functional tests pass, if applicable
- [ ] Any tool integration actually works end-to-end

**After it's live:**
- [ ] Test in real conversations, not just the prepared prompts
- [ ] Watch for under-triggering (not loading when expected) or over-triggering (loading when it shouldn't)
- [ ] Collect real feedback from whoever uses it
- [ ] Iterate on the description first if triggering is off — that's almost always the fastest fix
- [ ] Bump the version in `metadata` when making a meaningful change

## Reading the signals

**Under-triggering** — the skill doesn't load when it should, people are manually invoking it by name, or someone asks "how do I get it to use the new skill": the description needs more specific detail and more of the literal keywords/phrases people actually use, especially technical terms if the domain is technical.

**Over-triggering** — the skill loads for things it shouldn't, or someone starts disabling/avoiding it: add an explicit negative-trigger clause and narrow the "what it does" half of the description.
