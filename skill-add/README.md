# skill-add

An Agent Skill that adds a new external skill (or entire skillset) from a
remote git repository into your local dev-agent-skills repo — one command,
everything wired.

Point your coding agent at this skill and say *"add skill
https://github.com/obra/superpowers-skills.git"*. It will clone the repo, flatten
each skill into its own folder at the dev-agent-skills root, rewrite cross-skill
references, record provenance, and run `setup.sh` to symlink and inject
protocols.

## Who it's for

Anyone maintaining a dev-agent-skills repo who regularly pulls in external
skillsets and is tired of remembering the install script's flag names and exact
invocation syntax.

## What it is (and isn't)

This is a **skill** — a `SKILL.md` that tells the agent how to invoke the
`skill-add/scripts/install-skillset.sh` script with the right arguments. The
script does all the real work (clone, flatten, rewrite, manifest, setup). This
skill just means you don't have to memorize the flags — you describe what you
want and the agent translates it.

It does **not** update skills you've already installed — use `skill-update`
for that. It does **not** commit or push — review the diff first.

## Prerequisites

- [`git`](https://git-scm.com/)
- [Node.js](https://nodejs.org/)

## Usage

Ask your agent, from inside the dev-agent-skills repo:

> add skill https://github.com/obra/superpowers-skills.git --subdir skills --prefix superpowers

> install this skillset: https://github.com/some-org/some-skills.git, only grab fix-flaky-tests and api-design-review

Or run the script directly:

```bash
bash skill-add/scripts/install-skillset.sh <git-url> [--subdir <path>] [--prefix <name>] [--only <a,b,c>] [--ref <branch>] [--dry-run] [--skip-setup]
```

## Options

| Flag | What it does |
|---|---|
| `--subdir <path>` | Skills live under a subdirectory of the source repo. |
| `--prefix <name>` | Prefix skill folders with `<name>-` to avoid collisions. |
| `--only <a,b,c>` | Only import specific skills (comma-separated). |
| `--ref <branch/tag>` | Clone a specific ref. |
| `--dry-run` | Preview without writing. |
| `--skip-setup` | Skip `setup.sh` — review the diff first. |

## License

See the repository this skill ships in.
