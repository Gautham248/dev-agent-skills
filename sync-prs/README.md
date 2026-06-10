# sync-prs

An Agent Skill that keeps **your own** open GitHub pull requests current and
green, one safe step at a time.

Point your coding agent at this skill and say *"sync my PRs"*. It will, for
every open PR you authored:

- **Merge the base branch** into the PR when GitHub flags it `CONFLICTING` —
  clean auto-merges are committed and pushed; lockfile-only conflicts are
  regenerated; anything needing real judgment is reported and left untouched.
- **Triage CI** — auto-fix safe lint/format failures (configurable command),
  and for everything else produce a categorized report with a log excerpt and a
  proposed fix.
- **Surface unresolved review threads** and `CHANGES_REQUESTED` reviews so you
  know what still needs a human reply.

Every PR is worked in its **own git worktree**, so your current branch and
working directory are never touched.

## Who it's for

Anyone juggling several in-flight PRs in a single GitHub repo who is tired of
the manual "rebase the base, re-run lint, scroll the review tab" loop. It is
built around the GitHub CLI (`gh`) and assumes a JavaScript/pnpm project for the
auto-fix step (overridable — see [Configuration](#configuration)).

## What it is (and isn't)

This is a **skill** — a `SKILL.md` of step-by-step guidance plus a `sync.ts`
helper script. The script automates the deterministic parts (merge, push,
lockfile regen, lint auto-fix, CI/review triage). Fixing test/type/build
failures and addressing review comments still needs the agent's (and your)
judgment — the skill tells the agent exactly when to stop reporting and start
fixing. It does **not** silently rewrite history, force-push, or touch PRs you
don't own.

## Prerequisites

- [`git`](https://git-scm.com/) with `worktree` support (2.5+)
- [`gh`](https://cli.github.com/), authenticated (`gh auth login`)
- [Node.js](https://nodejs.org/) with [`tsx`](https://github.com/privatenumber/tsx)
  available (e.g. `pnpm dlx tsx`, `npx tsx`, or a project dev-dependency)
- For the default auto-fix step: a `pnpm run lint:fix` script (or set
  `SYNC_PRS_LINTFIX_CMD` to your own)

## Install

This skill follows the open [Agent Skills](https://agentskills.io) layout
(`SKILL.md` + `scripts/`), so it works with any agent that loads skills. Drop
the `sync-prs/` folder into your agent's skills directory.

**Portable (recommended for repos shared across agents):**

```bash
mkdir -p .agents/skills
cp -R sync-prs .agents/skills/
```

**Per-agent personal/project paths:**

| Agent | Personal | Project |
|---|---|---|
| Claude Code | `~/.claude/skills/sync-prs/` | `.claude/skills/sync-prs/` |
| Cursor | native global path | `.agents/skills/sync-prs/` or `.cursor/skills/sync-prs/` |
| OpenCode | `~/.config/opencode/skills/sync-prs/` | `.agents/skills/sync-prs/` or `.opencode/skills/sync-prs/` |
| Codex | `~/.codex/skills/sync-prs/` | `.agents/skills/sync-prs/` |
| Gemini CLI | installer-managed | `.agents/skills/sync-prs/` |

Skill discovery, metadata, and invocation UI differ between these agents — this
skill relies only on the cross-agent `name` + `description` frontmatter, so the
core behavior is the same, but feature depth (auto-loading, permissions, slash
invocation) is not identical across platforms. Verify global-path behavior in
your agent's current version.

> Built and verified against **Claude Code**. Other agents that implement the
> Agent Skills format should load it too, but are not independently tested here.

## Usage

Ask your agent, from inside the repo whose PRs you want to sync:

> sync my PRs

> sync my PRs, check CI status, and fix the failures

> sync #1798 and address the review comments

Or run the helper script directly:

```bash
# From inside the skill folder (repo auto-detected from the current git repo):
pnpm tsx scripts/sync.ts

# Preview only — no fetch/merge/push/commit:
pnpm tsx scripts/sync.ts --dry-run

# Target a specific repo and include older PRs:
pnpm tsx scripts/sync.ts --repo owner/name --pr 1798,3405
```

The script prints a Markdown table (sync / CI / reviews per PR) followed by
detail blocks for anything needing investigation.

## Configuration

Nothing is hardcoded to one repo or machine. Flags take precedence over env
vars, which take precedence over the auto-detected default.

| Setting | Flag | Env var | Default |
|---|---|---|---|
| Repo | `--repo owner/name` | `SYNC_PRS_REPO` | `gh repo view` of the current repo |
| Worktrees dir | `--worktrees-dir <path>` | `SYNC_PRS_WORKTREES_DIR` | `<repo-root>/.worktrees/` |
| Auto-fix command | — | `SYNC_PRS_LINTFIX_CMD` | `pnpm run lint:fix` |
| Skipped-check pattern | — | `SYNC_PRS_SKIP_CHECK_PATTERN` | `argos\|visual-test\|percy\|chromatic` |
| Recency window (months) | — | `SYNC_PRS_MAX_AGE_MONTHS` | `2` |
| Dry run | `--dry-run` | — | off |
| Include a PR by number | `--pr N[,N…]` | — | recency-filtered |

Each PR's base branch is read per-PR from the GitHub API, so there's no global
base-branch setting. If the worktrees directory lives inside the repo (the
default does), add it to `.gitignore`.

### Adapting to non-pnpm projects

The lint/format auto-fix and lockfile regeneration assume pnpm. For npm/yarn,
set `SYNC_PRS_LINTFIX_CMD` (e.g. `npm run lint:fix`) and adapt the lockfile
regeneration step described in `SKILL.md`.

## How it decides

The full decision tables — how each PR is classified, which CI failures are
auto-fixable vs. report-only, what counts as an unresolved review thread, and
the exact report format — live in [`SKILL.md`](./SKILL.md). The script and the
skill share the same logic; the script is the automation, the skill is the
contract the agent follows when it has to go beyond what the script does.

## License

See the repository this skill ships in.
