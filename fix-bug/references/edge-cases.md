# Edge cases

Known edge cases encountered when running the fix-bug skill, and how to handle them.
This file is updated automatically by Hermes when new edge cases are discovered.

---

## 2026-06-08 — Graphify fails on non-code files

**Condition:** Repository contains `.toml`, `.sql`, `.lockb`, `.env`, or image
files. Graphify requires an LLM API key to process these.

**Handling:**
1. First try passing `GEMINI_API_KEY` — free tier at aistudio.google.com.
2. If the key is unavailable, find and remove the non-code files from the local
   clone before running `graphify extract`. The remote repo is unaffected.
3. Common offenders: `supabase/config.toml`, `*.sql` migrations, `bun.lockb`,
   `README.md`, image files in `src/assets/` or `public/`.

---

## 2026-06-08 — Knowledge graph query returns wrong file (tsconfig vs source)

**Condition:** Query terms like "URL", "link", or "connection" match TypeScript
`baseUrl` config in `tsconfig.json` or `tsconfig.app.json`, which ranks higher
than the actual application config file because tsconfig files have many nodes.

**Handling:**
When the top result is a `tsconfig*.json` file and the bug is about an
application-level URL or connection string, skip it and look at the next
candidate. `tsconfig.baseUrl` is a TypeScript path alias, not an application URL.

---

## 2026-06-08 — OpenRouter API key does not work with Graphify

**Condition:** Using an OpenRouter API key as `ANTHROPIC_API_KEY` for Graphify
extraction fails with `401 invalid x-api-key`.

**Handling:**
Graphify calls `api.anthropic.com` directly. OpenRouter keys are not accepted.
Use a native Anthropic API key, or use a Gemini API key (`GEMINI_API_KEY`) from
Google AI Studio (free tier) instead.

---

## 2026-06-10 — Local clone already exists; simple constant bug found without graphify

**Condition:** The repository is already cloned locally and the bug is a simple
wrong constant (URL, key, version) in a known file pattern (e.g., `*client.ts`,
`*config.ts`). The fix value can be recovered from git history.

**Handling:**
1. Skip graphify — use `search_files`/`grep` to find the wrong value directly.
2. Read the file to confirm context.
3. Check git history for the correct value:
   ```bash
   git log --oneline -20 -- <file-path>
   git show <commit-hash>:<file-path>
   ```
4. Apply the minimal fix.
5. If this is a local-only fix (no PR needed), stop after verifying the change
   with `git diff`. No branch/PR required.

**Rationale:** For simple constant-value bugs in local repos, the full graphify+
PR workflow adds unnecessary overhead. The fix is verifiable by git history
alone.

---

## 2026-06-11 — Bug already fixed on main; existing PR found

**Condition:** During the standard workflow, the target file on `main` already
contains the correct value. Git history reveals an intentional-bug commit
followed by a fix commit on a PR branch, and an open PR already exists for the
exact same bug.

**Handling:**
1. Verify the net diff between the PR branch and main is empty (fix already
   applied):
   ```bash
   git diff main..origin/<pr-branch> -- <target-file>
   ```
2. Check for existing open PRs:
   ```bash
   gh pr list --repo <owner>/<repo> --state open
   ```
3. Report to the developer: the fix is already in place on main (or on an open
   PR branch). Do NOT open a duplicate PR — the skill prohibits more than one
   PR per bug report.
4. Offer to close the stale PR or clean up the branch if appropriate.

**Rationale:** Some repos use intentional test bugs for agent evaluation. The
bug may have been introduced on a branch (not main), fixed, and a PR opened —
all before this session started. Creating a second PR is worse than doing
nothing.

---

## 2026-06-11 — Text files misclassified as docs by graphify (robots.txt, etc.)

**Condition:** After removing obvious non-code files (`.md`, images, `.html`),
`graphify extract` still reports "1 doc/paper/image file(s) need semantic
extraction". The culprit is a text-based file like `robots.txt`, `.htaccess`,
or similar that graphify classifies as a "doc".

**Handling:**
Instead of guessing which files graphify considers non-code, use a systematic
find that catches everything. After the first failure:

```bash
# Find ALL files graphify might classify as non-code
find <repo> -type f \
  \( -name "*.md" -o -name "*.html" -o -name "*.htm" -o -name "*.txt" \
     -o -name "*.rst" -o -name "*.adoc" -o -name "*.png" -o -name "*.jpg" \
     -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" -o -name "*.ico" \
     -o -name "*.webp" -o -name "*.pdf" \) \
  -not -path "*/node_modules/*" \
  -delete
```

Then re-run `graphify extract`. The `-delete` flag removes them in one pass
instead of requiring multiple attempts.

---

## 2026-06-11 — Intentional test bug commit reintroduces previously-fixed bug

**Condition:** A new intentional-bug commit on `main` (e.g., "bug: wrong Supabase
URL (edge case test)") reintroduces a bug that was previously fixed. Git history
shows: original clean commit → intentional-bug commit → no fix applied yet.
Previous PRs for the bug are already closed/merged and no longer open.

**Handling:**
1. Verify no open PRs exist for this bug: `gh pr list --state open`
2. Find the correct value from git history (the commit before the intentional
   bug): `git show <clean-commit>:<file-path>`
3. Follow the full fix-bug workflow normally — the bug IS present on main and
   needs fixing. The fact that it was previously fixed does not change the
   current workflow.

**Rationale:** Intentional test-bug commits are valid targets for the fix-bug
skill. The "already fixed" edge case only applies when main already has the
correct value AND an open PR exists.

---

## 2026-06-11 — GitHub reviewer assignment fails (PR author = reviewer)

**Condition:** `gh pr edit --add-reviewer <user>` or the REST API returns
`HTTP 422: "Review cannot be requested from pull request author."` when the
authenticated gh user is the same as the requested reviewer, and the PR branch
was pushed from that user's account.

**Handling:**
1. Check who is authenticated: `gh auth status`
2. If the authenticated user matches the requested reviewer, do not block on
   this — GitHub's API correctly prevents self-review. Note the issue in the
   final report to the developer so they can assign a different reviewer.
3. If the reviewer is a different GitHub user and still fails, check the
   reviewer username against the GH API — the user may not have access to the
   repo or the username may be mistyped.
