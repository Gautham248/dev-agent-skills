# appstore-submission-guide

An agent skill that walks an iOS or iPadOS developer through an **App Store Connect submission**. It
covers every form section, from account prerequisites through release options. For each field it
drafts a paste-ready value from the codebase and checks it against Apple's current limits and the App
Review Guidelines.

It is the companion to [`apple-appstore-reviewer`](../apple-appstore-reviewer/). That skill audits
the code for rejection risk; this one prepares the submission itself.

- **Runs automatically after the reviewer.** The new skill declares `companion-of:
  apple-appstore-reviewer`, and `setup.sh` injects a managed handoff block into the reviewer's
  `SKILL.md`. The block survives `skill-update` re-imports, because `setup.sh` re-injects it.
- **Can be invoked on its own.** Then it runs the reviewer first, as a compliance gate.

## What you get

A **submission packet** containing:

- a readiness verdict (Ready, Ready with decisions, or Not ready)
- every App Store Connect field with a drafted value, its evidence, a limit check and an action
- App Privacy label answers cross-checked against `PrivacyInfo.xcprivacy`
- age-rating questionnaire answers, including the 2026 Shared Location and Dating and Relationships
  declarations
- the export-compliance (encryption) decision
- paste-ready App Review notes with demo-account placeholders and required documents by guideline
- an asset checklist and an after-submission playbook (statuses, appeals, expedite, phased release)

It never enters anything into App Store Connect and never edits app code.

## Scripts (Python 3 standard library, no installs)

```bash
python3 scripts/harvest_evidence.py <app-repo> --regions EU,US,JP,FR   # evidence JSON
python3 scripts/validate_metadata.py <draft.json>                      # limits and guideline lint
python3 scripts/check_screenshots.py <screenshots-dir> [--ipad]        # sizes, alpha, counts
python3 -m unittest discover -s scripts/tests -v                       # the skill's own tests
```

## Keeping it current

Apple changes limits, sizes and deadlines often. Every fact in `references/` is dated (snapshot
2026-11-26) and flagged **verified**, **search-snippet**, **secondary** or **open** in
`references/sources.md`.

The skill checks Apple's pages for newer changes on every run. When something changes:

1. Update the affected reference file and its row in `sources.md`.
2. If a limit or size changed, also update the mirrored tables in `scripts/validate_metadata.py` or
   `scripts/check_screenshots.py`.
3. Re-run the tests.
