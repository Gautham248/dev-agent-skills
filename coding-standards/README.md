# coding-standards

Dispatcher for company coding standards. Investigates the current project and the task, then invokes only the domain-specific coding-standards-* skill(s) that actually apply — see references/manifest.json for the full domain list.

**Prerequisites:** none beyond what's already set up by `setup.sh`.

**Usage examples:**
- Invoked automatically by `coding-standards` when a matching task and project domain are both detected — not usually invoked directly.
