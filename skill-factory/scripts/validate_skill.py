#!/usr/bin/env python3
"""
validate_skill.py — Structural validator for an Agent Skill folder.

Checks the things a description review won't catch: frontmatter shape,
forbidden characters, naming rules, file layout, size, and (for skills
destined for dev-agent-skills) name collisions against the known roster.

Usage:
    python3 validate_skill.py <path-to-skill-folder> [--roster name1,name2,...]

Exit code 0 = no errors (warnings may still be printed).
Exit code 1 = at least one error found.
"""

import re
import sys
import argparse
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

ALLOWED_FRONTMATTER_KEYS = {
    "name", "description", "license", "compatibility", "allowed-tools", "metadata"
}

# Known dev-agent-skills roster, kept here so a fresh clone still gets a useful
# collision check even before anyone wires up something fancier. Override with
# --roster if the repo has moved on since this was written.
DEFAULT_ROSTER = {
    "fix-bug", "plan-feature", "sync-prs", "first-principles-review",
    "typescript-conventions", "webapp-conventions", "eslint-rule-author",
    "skill-factory",
}

RESERVED_NAME_PREFIXES = ("claude", "anthropic")

MAX_SKILL_MD_LINES = 500
MAX_SKILL_MD_WORDS = 5000


def fail(errors, message):
    errors.append(message)


def warn(warnings, message):
    warnings.append(message)


def validate(skill_path: Path, roster: set[str]):
    errors: list[str] = []
    warnings: list[str] = []

    if not skill_path.is_dir():
        fail(errors, f"'{skill_path}' is not a directory.")
        return errors, warnings

    # --- SKILL.md presence and uniqueness ---
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        fail(errors, "SKILL.md not found at the skill root (name is case-sensitive).")
        return errors, warnings

    all_skill_mds = [p for p in skill_path.rglob("SKILL.md")]
    if len(all_skill_mds) > 1:
        extras = sorted(str(p.relative_to(skill_path)) for p in all_skill_mds if p != skill_md)
        fail(
            errors,
            f"Found {len(all_skill_mds)} SKILL.md files; only <folder>/SKILL.md is allowed. "
            f"Extra: {', '.join(extras)}. Rename supporting docs to non-SKILL.md filenames "
            f"under references/.",
        )

    # --- No README.md inside the skill folder ---
    if (skill_path / "README.md").exists():
        fail(
            errors,
            "README.md found inside the skill folder. All instructions belong in SKILL.md "
            "or references/ — a repo-level README for human visitors is a separate concern "
            "and doesn't belong inside the skill's own folder.",
        )

    content = skill_md.read_text(encoding="utf-8")

    # --- Frontmatter parsing ---
    match = re.match(r"^---\n(.*?)\n---\s*\n?", content, re.DOTALL)
    if not match:
        fail(errors, "No valid YAML frontmatter block found (need opening and closing '---').")
        frontmatter = {}
        body = content
    else:
        frontmatter_text = match.group(1)
        body = content[match.end():]
        if yaml is None:
            fail(errors, "PyYAML not installed — cannot parse frontmatter. Run: pip install pyyaml --break-system-packages")
            frontmatter = {}
        else:
            try:
                frontmatter = yaml.safe_load(frontmatter_text) or {}
                if not isinstance(frontmatter, dict):
                    fail(errors, "Frontmatter must be a YAML mapping (key: value pairs).")
                    frontmatter = {}
            except yaml.YAMLError as e:
                fail(errors, f"Invalid YAML in frontmatter: {e}")
                frontmatter = {}

    # --- Unexpected keys ---
    unexpected = set(frontmatter.keys()) - ALLOWED_FRONTMATTER_KEYS
    if unexpected:
        fail(errors, f"Unexpected frontmatter key(s): {', '.join(sorted(unexpected))}. "
                      f"Allowed: {', '.join(sorted(ALLOWED_FRONTMATTER_KEYS))}")

    # --- name ---
    name = str(frontmatter.get("name", "")).strip()
    if not name:
        fail(errors, "Missing required 'name' field.")
    else:
        if not re.match(r"^[a-z0-9-]+$", name):
            fail(errors, f"'name: {name}' must be kebab-case (lowercase letters, digits, hyphens only).")
        if name.startswith("-") or name.endswith("-") or "--" in name:
            fail(errors, f"'name: {name}' cannot start/end with a hyphen or contain consecutive hyphens.")
        if len(name) > 64:
            fail(errors, f"'name' is {len(name)} characters; maximum is 64.")
        if any(name == p or name.startswith(p + "-") for p in RESERVED_NAME_PREFIXES):
            fail(errors, f"'name: {name}' uses a reserved prefix ({'/'.join(RESERVED_NAME_PREFIXES)}).")
        if name != skill_path.name:
            warn(warnings, f"'name: {name}' doesn't match folder name '{skill_path.name}' — they should match.")
        if name in roster:
            warn(warnings, f"'name: {name}' collides with an existing skill in the roster: {sorted(roster)}. "
                            f"Confirm this is an intentional update, not an accidental duplicate.")

    # --- description ---
    description = str(frontmatter.get("description", "")).strip()
    if not description:
        fail(errors, "Missing required 'description' field.")
    else:
        if "<" in description or ">" in description:
            fail(errors, "'description' contains '<' or '>' — angle brackets are forbidden (security restriction).")
        if len(description) > 1024:
            fail(errors, f"'description' is {len(description)} characters; maximum is 1024.")
        if len(description.split()) < 8:
            warn(warnings, "'description' looks very short — confirm it states both WHAT the skill does "
                            "and WHEN to use it, with concrete trigger phrases.")
        if "use when" not in description.lower() and "use for" not in description.lower() and "use to" not in description.lower():
            warn(warnings, "'description' doesn't contain an obvious trigger-condition phrase "
                            "(e.g. 'Use when...'). Double check it states WHEN to use the skill, not just WHAT it does.")

    # --- compatibility ---
    compatibility = frontmatter.get("compatibility")
    if compatibility is not None:
        if not isinstance(compatibility, str):
            fail(errors, f"'compatibility' must be a string, got {type(compatibility).__name__}.")
        elif len(compatibility) > 500:
            fail(errors, f"'compatibility' is {len(compatibility)} characters; maximum is 500.")

    # --- overall angle-bracket scan of frontmatter block (belt and suspenders) ---
    if match and ("<" in match.group(1) or ">" in match.group(1)):
        # Only warn here since the description-specific check above is authoritative;
        # this catches angle brackets in other fields like metadata values.
        warn(warnings, "Angle brackets found somewhere in the frontmatter block — verify none are in "
                        "user-facing fields like description or metadata values.")

    # --- size guidance ---
    line_count = content.count("\n") + 1
    word_count = len(body.split())
    if line_count > MAX_SKILL_MD_LINES:
        warn(warnings, f"SKILL.md is {line_count} lines (guideline: under {MAX_SKILL_MD_LINES}). "
                        f"Consider moving detail into references/ and leaving a pointer.")
    if word_count > MAX_SKILL_MD_WORDS:
        warn(warnings, f"SKILL.md body is ~{word_count} words (guideline: under {MAX_SKILL_MD_WORDS}). "
                        f"Consider moving detail into references/.")

    # --- bundled resource sanity ---
    for subdir in ("scripts", "references", "assets"):
        d = skill_path / subdir
        if d.exists() and d.is_dir() and not any(d.rglob("*")):
            warn(warnings, f"'{subdir}/' exists but is empty — remove it or populate it.")

    # --- edge-case consultation ("closing the loop") ---
    # SELF-IMPROVEMENT-PROTOCOL.md (injected into every skill) covers the write
    # side: append a new edge case after hitting one. It says nothing about the
    # read side — checking edge-cases.md when something looks off *during* a
    # run. Unless SKILL.md itself says to consult it, a documented, already-
    # solved gotcha can get silently re-discovered from scratch every time.
    if "edge-cases.md" not in body:
        warn(
            warnings,
            "SKILL.md doesn't mention 'edge-cases.md' anywhere in the body. Add a short "
            "'If something goes wrong' section telling the acting agent to consult "
            "references/edge-cases.md before improvising a fix — see assets/skill-template.md "
            "for the standard wording.",
        )

    return errors, warnings


def main():
    parser = argparse.ArgumentParser(description="Validate an Agent Skill folder's structure.")
    parser.add_argument("skill_path", help="Path to the skill folder to validate")
    parser.add_argument("--roster", default="",
                         help="Comma-separated list of existing skill names to check collisions against "
                              "(defaults to the known dev-agent-skills roster)")
    args = parser.parse_args()

    roster = DEFAULT_ROSTER if not args.roster else set(s.strip() for s in args.roster.split(",") if s.strip())

    errors, warnings = validate(Path(args.skill_path), roster)

    if warnings:
        print("Warnings:")
        for w in warnings:
            print(f"  - {w}")
        print()

    if errors:
        print("Errors:")
        for e in errors:
            print(f"  - {e}")
        print(f"\n{len(errors)} error(s) found.")
        sys.exit(1)

    print("No errors found." + (f" ({len(warnings)} warning(s) above worth a look.)" if warnings else ""))
    sys.exit(0)


if __name__ == "__main__":
    main()
