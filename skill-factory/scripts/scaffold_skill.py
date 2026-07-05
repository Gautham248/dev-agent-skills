#!/usr/bin/env python3
"""
scaffold_skill.py — Create an empty, correctly-shaped skill folder from the
bundled template, ready to be filled in from a confirmed Skill Specification.

Usage:
    python3 scaffold_skill.py <skill-name> [--dest .] [--with scripts,references,assets]

Only creates the subdirectories explicitly requested via --with (default: none
beyond SKILL.md) — an unused empty directory is itself a lint warning from
validate_skill.py, so don't create what won't be used.
"""

import argparse
import re
import shutil
import sys
from pathlib import Path

TEMPLATE_RELATIVE_PATH = Path(__file__).resolve().parent.parent / "assets" / "skill-template.md"


def is_valid_kebab_case(name: str) -> bool:
    return bool(re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", name))


def main():
    parser = argparse.ArgumentParser(description="Scaffold a new skill folder from the template.")
    parser.add_argument("skill_name", help="kebab-case name for the new skill")
    parser.add_argument("--dest", default=".", help="Directory to create the skill folder in (default: current directory)")
    parser.add_argument("--with", dest="with_dirs", default="",
                         help="Comma-separated subset of scripts,references,assets to create")
    args = parser.parse_args()

    if not is_valid_kebab_case(args.skill_name):
        print(f"Error: '{args.skill_name}' is not valid kebab-case (lowercase letters, digits, single hyphens).")
        sys.exit(1)

    if any(args.skill_name == p or args.skill_name.startswith(p + "-") for p in ("claude", "anthropic")):
        print(f"Error: '{args.skill_name}' uses a reserved prefix (claude/anthropic).")
        sys.exit(1)

    dest_root = Path(args.dest) / args.skill_name
    if dest_root.exists():
        print(f"Error: '{dest_root}' already exists — refusing to overwrite.")
        sys.exit(1)

    dest_root.mkdir(parents=True)

    if not TEMPLATE_RELATIVE_PATH.exists():
        print(f"Error: template not found at {TEMPLATE_RELATIVE_PATH}.")
        sys.exit(1)

    template_text = TEMPLATE_RELATIVE_PATH.read_text(encoding="utf-8")
    template_text = template_text.replace("name: your-skill-name", f"name: {args.skill_name}")
    (dest_root / "SKILL.md").write_text(template_text, encoding="utf-8")

    requested_dirs = {d.strip() for d in args.with_dirs.split(",") if d.strip()}
    valid_dirs = {"scripts", "references", "assets"}
    unknown = requested_dirs - valid_dirs
    if unknown:
        print(f"Warning: ignoring unrecognized --with entries: {', '.join(sorted(unknown))}")

    for d in requested_dirs & valid_dirs:
        (dest_root / d).mkdir()

    print(f"Created skill scaffold at: {dest_root}")
    print("Next: fill in SKILL.md from the confirmed Skill Specification, "
          "then run validate_skill.py before going further.")


if __name__ == "__main__":
    main()
