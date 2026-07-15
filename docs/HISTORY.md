# History

A chronological record of major, behavior-changing decisions made in this repo — what changed, why, and how the system's behavior differs before and after. The other docs describe how the system works *now*; this one explains how it got here, so a decision made months ago doesn't have to be re-discovered from git log or re-litigated from scratch.

Entries are added for changes that alter how the system *behaves*, not for routine skill additions or content fixes. If you're adding an entry, follow the format of the ones below: what it used to do, what it does now, and why the change was made.

---

## Governance protocols established (clarification, self-improvement)

**Before:** No consistent cross-skill behavior. Individual skills handled ambiguity and edge-case recording their own way, if at all.

**After:** Two protocol documents (`CLARIFICATION-PROTOCOL.md`, `SELF-IMPROVEMENT-PROTOCOL.md`) injected into every skill's `SKILL.md` automatically by `setup.sh`, as managed blocks that get stripped and rebuilt fresh on every run. Clarification governs investigate-then-ask-then-plan-then-act behavior before any skill acts. Self-improvement governs recording genuine edge cases to `references/edge-cases.md` after a skill finishes. Both apply regardless of which harness loaded the skill.

**Why:** Individual skill instructions couldn't be trusted to consistently get ambiguity-handling and edge-case-recording right on their own — centralizing the rule in one place, injected everywhere, meant fixing or improving the rule once instead of per-skill.

---

## `coding-standards` added as a single skill with a routing table

**Before:** No centralized company coding-standards enforcement — left to individual developer/agent judgment per project.

**After:** One `coding-standards` skill with an internal routing table: base rules applied always, and five `references/*.md` files (`project-structure.md`, `database-standards.md`, `tanstack-query.md`, `e2e-test-writing.md`, plus `edge-cases.md`) loaded conditionally based on matching the task's wording against the table.

**Why:** Needed *some* centralized standard before optimizing *how* it was delivered. This was the simplest version that could ship.

**Known limitations at this stage** (later addressed, see below): the routing table could only match on task wording, with no way to know whether a given project actually had the layer a rule described (e.g. it would apply database rules based on task phrasing alone, with no check for whether the project had a database at all). `project-structure.md` alone bundled unrelated concerns (frontend, backend, project organization, testing standards, VCS) into one 28KB file, so any single match pulled in far more than was relevant.

---

## `coding-standards` redesigned as a manifest-driven dispatcher

**Before:** The single-skill-with-routing-table design above.

**After:** `coding-standards` is now a **dispatcher**. It applies universal rules directly and unconditionally, then:
1. Investigates the actual project (`package.json`, schema files, directory layout) to determine which domains it genuinely has.
2. Matches the task against those present domains.
3. Invokes only the matching domain-specific sub-skill(s) — `coding-standards-frontend`, `coding-standards-backend`, `coding-standards-database`, `coding-standards-tanstack-query`, `coding-standards-e2e`, `coding-standards-project-organization` — each a real, independent skill, not a reference file.

The domain → skill mapping and detection signals live in `coding-standards/references/manifest.json`, readable only by the dispatcher itself — no sub-skill references it, so it functions as master-only without needing any harness-level permission configuration.

**Why:** Two earlier experiments (documented separately, not in this repo) found that OpenCode genuinely auto-selects skills by description, while Hermes does not — making a real dispatch mechanism viable for OpenCode specifically, and exposing that per-project config (allow/deny lists) doesn't scale as project scope changes. The dispatcher re-derives which domains apply fresh every session instead of requiring any static per-project configuration.

**A deliberate simplification made during this redesign:** no caching of the per-project domain-detection results between sessions was built, despite that being the initial instinct (mirroring `graphify`'s staleness-check pattern). Measured cost: domain detection is a handful of cheap shell calls, milliseconds total — nothing like `graphify`'s actual multi-minute graph build, so there was no staleness problem worth solving with a cache.

**Also fixed as part of this redesign — a risk introduced by naive splitting, not present in the original monolithic skill:** in the original design, Frontend/Backend base rules applied automatically the instant the one skill triggered at all. A naive split risked silently dropping those rules for a task that only triggered one sub-skill's narrow match. The dispatcher's task-signal matching on each domain independently (e.g. "add a page" matching `frontend` on its own, not just via inference) closes this.

---

## Round 2 — three pre-existing bugs fixed, dispatcher's Step 3 made graph-grounded

Found while testing the dispatcher above, not caused by it — but fixed in the same round since they were directly relevant to trusting the new skill.

**`skill-factory/scripts/validate_skill.py` false-positived on standard YAML syntax.** Every skill using `description: >` (the standard multi-line YAML block-scalar syntax, used throughout this repo) tripped an "angle brackets in frontmatter" warning, because the validator's belt-and-suspenders scan checked *raw* pre-YAML text for `<`/`>`, and `>` is the literal YAML folding indicator. **Fixed:** the scan now checks parsed frontmatter values instead of raw text, preserving the original intent (catching real angle brackets in fields like `metadata`) without the false positive.

**`validate_skill.py`'s "README.md found inside skill folder" was an error, contradicting actual practice.** 9 of 13 pre-existing skills already had one, and `CONTRIBUTING.md`'s own Step 3 instructs every contributor to write one. **Before:** any skill with a `README.md` failed validation outright. **After:** downgraded to a warning — missing a README is now a nudge, having one is no longer flagged at all.

**Real angle-bracket placeholders existed in three skills' descriptions.** `fix-bug` (`<repo>`, `<issue>`), `skill-add` (`<url>`), `skill-update` (`<skillset>`) — genuine violations of `frontmatter-spec.md`'s documented security rule ("angle brackets could be mistaken for injected instructions"), never caught before because `validate_skill.py` isn't wired into CI anywhere. **Fixed:** reworded to concrete natural-language examples in all three.

**`coding-standards`' Step 3 (task-to-domain matching) made graph-grounded.** **Before:** matched purely on task wording against each domain's `task_signals` — meaning a task that *implied* a domain without naming it (e.g. "add an endpoint for user preferences" on a project with a database, without the words "migration" or "schema" ever appearing) would miss that domain entirely. **After:** Step 3 first queries the project's knowledge graph for what the task actually touches, and classifies the *returned files* against each domain's new `path_patterns` in the manifest — turning "does this touch the database" into a checkable fact instead of a wording guess. Falls back to task-wording matching only when the graph has nothing to return (genuinely new-from-scratch features — a narrower case this change does not fully close). A `depends_on` field was also added per domain (e.g. `tanstack-query` → `frontend`) so a domain match whose dependency is structurally absent surfaces as a specific architectural mismatch instead of a generic "not installed" question.

---

## `session-memory` protocol added (opt-in)

**Before:** Every step in every skill re-ran its own checks every time it was reached, with no way to know — or say — that the same fact had already been established earlier in the same conversation. Cheap-but-frequent steps (like `coding-standards` re-detecting a project's frameworks on every dispatch within one long session, or `sync-prs` re-identifying the authenticated GitHub user on every invocation) paid this cost repeatedly for no benefit.

**After:** A third injected protocol, `SESSION-MEMORY-PROTOCOL.md` — unlike the other two, only injected into skills that opt in via `session-memory: true` in frontmatter. Within an opted-in skill, individual steps are marked `**Session-reusable:**` in the skill's own body; only those exact steps are ever eligible. The reuse test, every time: can the agent point to the specific earlier check in this same conversation that established the fact, and has nothing since then plausibly changed it? Both must hold, or the step re-runs fresh. Reuse must always be stated explicitly in output — never silent.

**Why this design, not a plugin:** an alternative was considered — wiring in an OpenCode-specific tool-call-deduplication plugin (e.g. `opencode-dynamic-context-pruning`) for mechanically-enforced reuse. Rejected as the primary mechanism because it only works on one of the five harnesses this repo supports, and this repo has no existing way to manage third-party OpenCode plugins repo-wide. The instruction-level protocol works identically everywhere, relying on nothing except the model's own conversational context.

**Currently opted in:** `coding-standards` (Step 2, project domain detection) and `sync-prs` (Step 1, identifying the running `gh` user) — the two candidates found by applying the eligibility test (read-only, plausibly repeated within a session, not invalidatable by anything else done in that same session) during testing.

---

## `fix-bug` — ask before committing (parallel effort)

**Before:** `fix-bug` committed the fix, pushed, and opened a PR automatically by default whenever a git repository existed and a GitHub remote was present — no explicit developer opt-in required for that part.

**After:** `fix-bug` stops at the edited file by default. Step 1's clarification questions now include an explicit "commit & push preference" — the developer must opt in before any commit happens. If they don't answer or don't ask for it, the skill reports the change and stops; committing without an explicit go-ahead is now treated as exactly the kind of behavior this skill must avoid.

**Why:** developed independently of the `coding-standards`/session-memory work in this history (different branch, different author), landed on `feat/skill-factory` directly. Included here because it's a real, current behavior change worth the same record-keeping as everything else on this page.

---

## Current state snapshot (at time of writing)

19 skills at the repo root: `coding-standards` + its 6 domain sub-skills, `eslint-rule-author`, `first-principles-review`, `fix-bug`, `graphify`, `investigate-issue`, `plan-feature`, `skill-add`, `skill-factory`, `skill-update`, `sync-prs`, `typescript-conventions`, `webapp-conventions`. Three managed protocols (clarification and self-improvement unconditional; session-memory opt-in, currently on 2 skills). `validate_skill.py` fully passes across all 19.
