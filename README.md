# dev-agent-skills

A collection of agent skills for 10xMinds developers. Clone once, get all skills
in your AI IDE instantly.

## Skills

<!-- BEGIN dev-agent-skills skills table (managed by scripts/regen-readme.mjs -- do not edit this block by hand, edit the source SKILL.md instead and re-run setup.sh) -->
| Skill | What it does |
|---|---|
| [`eslint-rule-author`](./eslint-rule-author/) | Use when authoring or modifying rules in a custom ESLint plugin — adding a new rule, fixing a false positive… |
| [`first-principles-review`](./first-principles-review/) | Critical, first-principles PR review that enumerates and challenges every assumption the author made, traces… |
| [`fix-bug`](./fix-bug/) | Use when a developer reports a bug in a GitHub repository and wants an automated fix — phrases like "fix this… |
| [`plan-feature`](./plan-feature/) | Use when a developer wants to plan a new feature before building it — phrases like "plan this feature", "writ… |
| [`superpowers-brainstorming`](./superpowers-brainstorming/) | Interactive idea refinement using Socratic method to develop fully-formed designs |
| [`superpowers-collision-zone-thinking`](./superpowers-collision-zone-thinking/) | Force unrelated concepts together to discover emergent properties - "What if we treated X like Y?" |
| [`superpowers-condition-based-waiting`](./superpowers-condition-based-waiting/) | Replace arbitrary timeouts with condition polling for reliable async tests |
| [`superpowers-defense-in-depth`](./superpowers-defense-in-depth/) | Validate at every layer data passes through to make bugs impossible |
| [`superpowers-dispatching-parallel-agents`](./superpowers-dispatching-parallel-agents/) | Use multiple Claude agents to investigate and fix independent problems concurrently |
| [`superpowers-executing-plans`](./superpowers-executing-plans/) | Execute detailed plans in batches with review checkpoints |
| [`superpowers-finishing-a-development-branch`](./superpowers-finishing-a-development-branch/) | Complete feature development with structured options for merge, PR, or cleanup |
| [`superpowers-gardening-skills-wiki`](./superpowers-gardening-skills-wiki/) | Maintain skills wiki health - check links, naming, cross-references, and coverage |
| [`superpowers-inversion-exercise`](./superpowers-inversion-exercise/) | Flip core assumptions to reveal hidden constraints and alternative approaches - "what if the opposite were tr… |
| [`superpowers-meta-pattern-recognition`](./superpowers-meta-pattern-recognition/) | Spot patterns appearing in 3+ domains to find universal principles |
| [`superpowers-preserving-productive-tensions`](./superpowers-preserving-productive-tensions/) | Recognize when disagreements reveal valuable context, preserve multiple valid approaches instead of forcing p… |
| [`superpowers-pulling-updates-from-skills-repository`](./superpowers-pulling-updates-from-skills-repository/) | Sync local skills repository with upstream changes from obra/superpowers-skills |
| [`superpowers-receiving-code-review`](./superpowers-receiving-code-review/) | Receive and act on code review feedback with technical rigor, not performative agreement or blind implementat… |
| [`superpowers-remembering-conversations`](./superpowers-remembering-conversations/) | Search previous Claude Code conversations for facts, patterns, decisions, and context using semantic or text… |
| [`superpowers-requesting-code-review`](./superpowers-requesting-code-review/) | Dispatch code-reviewer subagent to review implementation against plan or requirements before proceeding |
| [`superpowers-root-cause-tracing`](./superpowers-root-cause-tracing/) | Systematically trace bugs backward through call stack to find original trigger |
| [`superpowers-scale-game`](./superpowers-scale-game/) | Test at extremes (1000x bigger/smaller, instant/year-long) to expose fundamental truths hidden at normal scal… |
| [`superpowers-sharing-skills`](./superpowers-sharing-skills/) | Contribute skills back to upstream via branch and PR |
| [`superpowers-simplification-cascades`](./superpowers-simplification-cascades/) | Find one insight that eliminates multiple components - "if this is true, we don't need X, Y, or Z" |
| [`superpowers-subagent-driven-development`](./superpowers-subagent-driven-development/) | Execute implementation plan by dispatching fresh subagent for each task, with code review between tasks |
| [`superpowers-systematic-debugging`](./superpowers-systematic-debugging/) | Four-phase debugging framework that ensures root cause investigation before attempting fixes. Never jump to s… |
| [`superpowers-test-driven-development`](./superpowers-test-driven-development/) | Write the test first, watch it fail, write minimal code to pass |
| [`superpowers-testing-anti-patterns`](./superpowers-testing-anti-patterns/) | Never test mock behavior. Never add test-only methods to production classes. Understand dependencies before m… |
| [`superpowers-testing-skills-with-subagents`](./superpowers-testing-skills-with-subagents/) | RED-GREEN-REFACTOR for process documentation - baseline without skill, write addressing failures, iterate clo… |
| [`superpowers-tracing-knowledge-lineages`](./superpowers-tracing-knowledge-lineages/) | Understand how ideas evolved over time to find old solutions for new problems and avoid repeating past failur… |
| [`superpowers-using-git-worktrees`](./superpowers-using-git-worktrees/) | Create isolated git worktrees with smart directory selection and safety verification |
| [`superpowers-using-skills`](./superpowers-using-skills/) | Skills wiki intro - mandatory workflows, search tool, brainstorming triggers |
| [`superpowers-verification-before-completion`](./superpowers-verification-before-completion/) | Run verification commands and confirm output before claiming success |
| [`superpowers-when-stuck`](./superpowers-when-stuck/) | Dispatch to the right problem-solving technique based on how you're stuck |
| [`superpowers-writing-plans`](./superpowers-writing-plans/) | Create detailed implementation plans with bite-sized tasks for engineers with zero codebase context |
| [`superpowers-writing-skills`](./superpowers-writing-skills/) | TDD for process documentation - test with subagents before writing, iterate until bulletproof |
| [`sync-prs`](./sync-prs/) | Use when the user asks to sync, check, refresh, or triage their own open GitHub pull requests — phrases like… |
| [`typescript-conventions`](./typescript-conventions/) | A TypeScript convention baseline for typing, validation, enum handling, imports, and naming — favoring types… |
| [`webapp-conventions`](./webapp-conventions/) | Portable conventions for building features in a SvelteKit + Tailwind web app — the layer above raw framework… |
<!-- END dev-agent-skills skills table -->

This table is regenerated automatically by `setup.sh` (and by
`install-skillset.sh`) from whatever skill folders actually exist at the
repo root — don't edit it by hand, it'll just get overwritten on the next
run. Edit the relevant `SKILL.md`'s frontmatter instead.

## Installing an external skillset

You're not limited to the 7 skills above. Any repo that follows the open
[Agent Skills format](https://github.com/anthropics/skills) (a folder per
skill, `SKILL.md` at its root — at any depth, including nested under a
`skills/` subdirectory) can be pulled in wholesale and become part of this
repo's superset:

```bash
bash install-skillset.sh <git-url> [--subdir <path>] [--prefix <name>] [--only a,b,c] [--dry-run]
```

For example, to pull in [obra/superpowers-skills](https://github.com/obra/superpowers-skills):

```bash
bash install-skillset.sh https://github.com/obra/superpowers-skills.git \
  --subdir skills --prefix superpowers
```

This clones the source repo, flattens every skill it finds into its own
folder at this repo's root (handling collisions, rewriting cross-skill
references where it can resolve them, and flagging anything it can't),
regenerates the table above, and runs `setup.sh` so the new skills get
symlinked and get the clarification-protocol pointer injected — same as
any other skill here. Always review the diff (and the cross-reference
warnings it prints) before committing.

`--prefix` is strongly recommended for any large or general-purpose
skillset, to avoid name collisions with skills you already have. See
`bash install-skillset.sh --help` for the rest of the options, and
[`SKILLSETS.md`](./SKILLSETS.md) (created on first use) for the provenance
log of what's been imported from where.

### Keeping installed skillsets current

`install-skillset.sh` is for bringing a new skillset in. To pull the
latest version of everything you've already installed:

```bash
bash update-skillsets.sh           # check + refresh every tracked skillset
bash update-skillsets.sh --dry-run # see what would change, touch nothing
bash update-skillsets.sh --source superpowers   # just one
```

It reads `.skillsets.json` (the record `install-skillset.sh` keeps of
every external source you've pulled from), re-clones each source, and
only rewrites a skill's files if its content actually changed — re-running
this with nothing new upstream is a no-op, not a no-op-shaped diff. By
default it only refreshes skills you already have; pass `--include-new`
if you also want to pick up anything added upstream since your last
install. `setup.sh` runs once at the end automatically if anything
changed.

## Install

### Step 1 — Clone the repo

```bash
git clone https://github.com/YOUR-ORG/dev-agent-skills.git ~/dev-agent-skills
```

### Step 2 — Wire into your IDE

```bash
cd ~/dev-agent-skills && bash setup.sh
```

The setup script detects which AI IDEs you have installed and links the skills
directory automatically. Run it again after pulling new skills.

### Step 3 — Use a skill

In your AI IDE, from inside any repo:

```
/fix-bug
/plan-feature
/first-principles-review
/sync-prs
/typescript-conventions
/webapp-conventions
/eslint-rule-author
```

Or describe what you want naturally — the agent will load the right skill.

## Manual install (if setup.sh doesn't cover your IDE)

| Agent | Command |
|---|---|
| Claude Code | `mkdir -p ~/.claude/skills && ln -s ~/dev-agent-skills/* ~/.claude/skills/` |
| Hermes | Add `~/dev-agent-skills` to `external_dirs` in `~/.hermes/config.yaml` |
| Codex | `mkdir -p ~/.codex/skills && ln -s ~/dev-agent-skills/* ~/.codex/skills/` |
| Cursor / OpenCode | `mkdir -p .agents/skills && ln -s ~/dev-agent-skills/* .agents/skills/` |
| Gemini CLI | `mkdir -p ~/.config/gemini/skills && ln -s ~/dev-agent-skills/* ~/.config/gemini/skills/` |

## Adding a new skill

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Keeping skills up to date

```bash
cd ~/dev-agent-skills
git pull
bash setup.sh
```
