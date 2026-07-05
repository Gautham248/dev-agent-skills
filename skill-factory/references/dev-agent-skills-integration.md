# Integrating a New Skill into dev-agent-skills

This skill exists specifically to feed the `dev-agent-skills` repo. Everything generic about writing a good skill lives in the other reference files; this one is about the things that are true of *this* repo and nowhere else, including a real bug class already found here once.

## Where the folder goes

New skills live at the repo root: `dev-agent-skills/<skill-name>/`. Same shape as every other skill in the repo (`SKILL.md`, optional `scripts/`, `references/`, `assets/`).

## Do not hand-author the managed protocol blocks

This repo's `setup.sh` injects two things into every skill in a single ordered pass, using a shared `strip_managed_block` function: a universal self-improvement protocol (`SELF-IMPROVEMENT-PROTOCOL.md`) and a clarification protocol. **A newly generated `SKILL.md` should not contain hand-written versions of either.** Writing your own version risks a block `strip_managed_block` doesn't recognize as managed, which then either duplicates on the next `setup.sh` run or doesn't get updated when the shared protocol text changes. Leave that content out entirely and let injection handle it.

If the new skill's own content genuinely needs to point at one of these shared docs (rare — usually only the injected block itself does this), use a relative path like `../CLARIFICATION-PROTOCOL.md`, never an absolute host path. Relative paths are what makes the pointer resolve correctly no matter where the repo is checked out; an absolute path baked in at commit time will be wrong inside the container.

## The SkillsSync gotcha — this matters at commit time, not runtime

`SkillsSync` (the component that pulls skill updates into a running `dev-agent` instance) only performs `git merge --ff-only`. **It never re-runs `setup.sh`.** That means whatever is committed to `dev-agent-skills` is exactly what a running agent gets — there's no injection step happening later in the pipeline to fix an incomplete skill.

Practical consequence: run `./setup.sh` from the repo root **before** committing the new skill, not after, and not "whenever." The sequence is:

1. Generate the skill folder with this factory.
2. Run `scripts/validate_skill.py` on it (Phase 4 of `SKILL.md`).
3. Run `./setup.sh` from the `dev-agent-skills` root — this is what actually injects the managed blocks.
4. Diff the result — literally read the diff, not a summary of it — and confirm only the expected managed blocks changed, nothing else was touched.
5. Commit.

Skipping step 3 before commit means the skill ships without the self-improvement or clarification protocol wired in, and nothing downstream will catch that for you.

## Naming collisions to check against

Before finalizing `skill_name`, check it against the current roster to avoid confusion or an accidental near-duplicate:

`fix-bug`, `plan-feature`, `sync-prs`, `first-principles-review`, `typescript-conventions`, `webapp-conventions`, `eslint-rule-author`, `skill-factory` (this skill itself).

Also worth checking against Hermes' own built-in skills where relevant — `github-issues` ships built-in and has no org-specific rules for ownership routing or label taxonomy, which is exactly the kind of gap a custom skill in this repo is meant to fill rather than duplicate wholesale.

## If the skill should be reachable from the job pipeline, not just invoked manually

A good description is necessary but not sufficient inside this system: confirmed behavior is that Hermes only reliably uses a custom skill when it's **explicitly named** in the prompt — auto-selection off the description alone is not dependable here, unlike the general Agent Skills guidance elsewhere. If this new skill is meant to be selected automatically for certain job types coming through `dev-agent`'s `POST /jobs` pipeline, it needs an explicit entry in the `JOB_TYPE_SKILL` mapping used by `buildPrompt()` in the `dev-agent` repo — that's a change in a different repo, and this factory skill won't make it for you. Flag it in the Phase 7 handoff so it doesn't get missed.

## `normalizeForHash` note (background, not usually actionable here)

`dev-agent-skills` graph/import tooling strips managed blocks before hashing to detect real content changes versus injection noise. Historically this missed the self-improvement block and caused false-positive "updated" reports. Not something this factory skill needs to touch, but worth knowing if a newly added skill shows up as unexpectedly "changed" right after `setup.sh` runs — that's very likely this, not a real problem with the new skill.

## What "done" looks like for a skill submitted through this factory

- Passes `scripts/validate_skill.py`
- Contains no hand-authored self-improvement or clarification-protocol content
- Any internal cross-references use relative paths
- Name doesn't collide with the existing roster above
- `setup.sh` has been run and its diff reviewed before commit
- If pipeline-invokable, the `JOB_TYPE_SKILL` follow-up in `dev-agent` has been flagged to the requester explicitly
