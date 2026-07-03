# skill-update

An Agent Skill that keeps every tracked external skillset in your
dev-agent-skills repo current — one command, all sources checked.

Point your coding agent at this skill and say *"update my skills"*. It will
read `.skillsets.json`, re-clone each tracked source, and refresh any skill
whose upstream content actually changed. Skills with identical content are
left alone (`setup.sh` only re-runs if something genuinely changed, and only
once at the end).

## Who it's for

Anyone maintaining a dev-agent-skills repo with one or more externally-imported
skillsets who wants a single command to check and refresh everything, without
manually tracking which source got which flags last time.

## What it is (and isn't)

This is a **skill** — a `SKILL.md` that tells the agent how to invoke the
`skill-update/scripts/update-skillsets.sh` script with the right arguments. The
script does all the real work (clone, compare, re-import, setup). This skill
just means you say *"update my skills"* instead of remembering which flags to
pass.

It does **not** install brand-new skillsets that were never imported before —
use `skill-add` for that. It also does **not** pick up newly-added upstream
skills by default (the `--include-new` flag gates that explicitly).

## Prerequisites

- [`git`](https://git-scm.com/)
- [Node.js](https://nodejs.org/)
- At least one skillset already installed via `skill-add` (a `.skillsets.json`
  must exist)

## Usage

Ask your agent, from inside the dev-agent-skills repo:

> update my skills

> sync skillsets — check for updates

> refresh the superpowers skillset

> check for skillset updates, dry-run first

Or run the script directly:

```bash
bash skill-update/scripts/update-skillsets.sh [--source <substring>] [--include-new] [--dry-run] [--skip-setup]
```

## Options

| Flag | What it does |
|---|---|
| `--source <substring>` | Only update skillsets whose source repo URL contains this substring. Default: everything. |
| `--include-new` | Also pick up skills that exist upstream now but weren't imported originally. Default: only refresh what's already here. |
| `--dry-run` | Check for changes and report without writing. |
| `--skip-setup` | Skip `setup.sh` at the end even if something changed. |

## How it works

1. Reads `.skillsets.json` — the manifest of every external import.
2. For each tracked skillset, shallow-clones the source repo at its latest
   commit (or the original `--ref`).
3. Compares the new commit to the last installed commit. If identical and
   `--include-new` is not set, marks it "already up to date" and skips.
4. If different (or `--include-new` forces re-check), re-runs the install
   skill with the exact same parameters (`--subdir`, `--prefix`, `--only` list)
   it was originally installed with — reconstructed automatically from the
   manifest.
5. Compares content hashes of each skill before and after re-import. Only
   skills with actual content changes show as "updated"; byte-identical
   re-imports are reported "unchanged".
6. Runs `setup.sh` once at the very end if *anything* changed.

## License

See the repository this skill ships in.
