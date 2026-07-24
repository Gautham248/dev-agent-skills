#!/usr/bin/env python3
"""
verify_plan_paths.py — Deterministic check that a drafted feature plan only
references real files.

Parses the plan's "Files to change" and "Files to create" tables and checks
them against the actual repository:

- Every path under "Files to change" MUST exist in the repo. A missing one
  means the plan references a phantom file — the exact failure the skill's
  never-do list forbids.
- Every path under "Files to create" must NOT already exist. One that does
  means the plan mislabeled a change as a creation.

Usage:
    python3 verify_plan_paths.py <plan-file.md> <repo-dir>

Exit code 0 = plan paths check out (warnings may still print).
Exit code 1 = at least one error; fix the plan and re-run before saving.
"""

import re
import sys
from pathlib import Path


def extract_table_paths(lines, start_index):
    """Collect first-column paths from a markdown table following start_index."""
    paths = []
    for line in lines[start_index:]:
        stripped = line.strip()
        if stripped.startswith("#"):
            break
        if not stripped.startswith("|"):
            continue
        cells = [c.strip() for c in stripped.strip("|").split("|")]
        if not cells:
            continue
        first = cells[0].strip().strip("`").strip()
        # Skip header/separator rows and template placeholders
        if not first or first.lower() == "file" or set(first) <= {"-", ":", " "}:
            continue
        if first.startswith("<") and first.endswith(">"):
            continue
        paths.append(first)
    return paths


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    plan_file = Path(sys.argv[1])
    repo_dir = Path(sys.argv[2])

    if not plan_file.is_file():
        print(f"Error: plan file '{plan_file}' not found.")
        sys.exit(1)
    if not repo_dir.is_dir():
        print(f"Error: repo directory '{repo_dir}' not found.")
        sys.exit(1)

    lines = plan_file.read_text(encoding="utf-8").splitlines()

    to_change, to_create = [], []
    for i, line in enumerate(lines):
        heading = re.sub(r"^#+\s*", "", line.strip()).lower()
        if line.strip().startswith("#") and heading.startswith("files to change"):
            to_change = extract_table_paths(lines, i + 1)
        elif line.strip().startswith("#") and heading.startswith("files to create"):
            to_create = extract_table_paths(lines, i + 1)

    errors, warnings = [], []

    if not to_change and not to_create:
        warnings.append(
            "No paths found under 'Files to change' or 'Files to create' — "
            "either the plan genuinely touches no files (unusual) or the "
            "section headings/tables don't match the template."
        )

    for p in to_change:
        if not (repo_dir / p).exists():
            errors.append(f"'Files to change' lists '{p}' but it does not exist in {repo_dir}.")

    for p in to_create:
        if (repo_dir / p).exists():
            errors.append(f"'Files to create' lists '{p}' but it ALREADY exists — move it to 'Files to change'.")

    for w in warnings:
        print(f"Warning: {w}")
    if errors:
        print("Errors:")
        for e in errors:
            print(f"  - {e}")
        print(f"\n{len(errors)} error(s) — fix the plan, then re-run this check before saving.")
        sys.exit(1)

    print(f"OK: {len(to_change)} existing file(s) verified, {len(to_create)} new file(s) confirmed absent.")
    sys.exit(0)


if __name__ == "__main__":
    main()
