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

## `coding-standards` manifest broadened; `graphify` extended for generic stack detection; local-artifact gitignore offer added

Three related items, finalized and applied together after a review comment surfaced a real gap.

**The trigger:** a reviewer asked whether `coding-standards`' database-domain detection was intentionally limited to Prisma, Drizzle, and ZenStack. It wasn't — TypeORM, Sequelize, Knex, and Mongoose projects were silently undetectable, and the equivalent gap existed on the frontend side (Angular, Astro, Preact missing). Manifest broadened to cover the common cases explicitly, with an added note in the manifest's own `_comment` field stating plainly that these lists can't be exhaustive and should be extended as real gaps are found — same honesty already used for the round-2 "brand-new feature" limitation.

**Before:** `coding-standards` Step 2 (project domain detection) ran its own independent `package.json`/`find` commands every time it needed to know what a project actually contains — a second, separate mechanism from `graphify`'s own full-codebase pass, despite both answering overlapping "what does this project have" questions.

**After:** `graphify` gained a new, unconditional Step 2.6 — generic stack detection, recording `package.json` dependencies (the complete list, not curated) and a bounded set of notable config files/directories to `graphify-out/.graphify_stack.json`. Deliberately generic: `graphify` has no knowledge of `coding-standards` or any other specific consumer, it just records reusable facts once. `coding-standards` Step 2 now reads this file and checks its manifest's new `dependency_patterns` field (npm package name matching, separate from the existing `path_patterns` field which handles file/directory matching) against it, falling back to the original direct-detection commands only if the file is somehow missing.

**Why this way, not a new cache:** the actual payoff is that this detection now inherits `graphify`'s existing staleness-refresh mechanism for free, rather than needing a second one built and maintained separately — the same "one mechanism, not two" principle already applied when the dispatcher was first designed against a persistent-cache instinct that was measured and rejected.

**Also decided in the same round:**
- **`graphify-out/` gitignore handling** — a new Rule 0b in `AGENT-STANDING-RULES.md` offers, once per project, to add `graphify-out/` to `.gitignore` if it isn't already there — asked explicitly, never done silently, and never re-asked after a "no" in the same session. A full relocation of `graphify-out/` into a `.dev-agent/`-style subfolder was seriously considered (including verifying what it would take to make `graphify` itself work identically from a new location) but rejected once it became clear gitignoring in place fully solves the actual client-visibility concern, at a fraction of the risk — `graphify/SKILL.md` has roughly 70 internal references to its own output location, none of which needed to change once relocation was taken off the table.
- **`AGENTS.md`** — reconsidered and left unchanged: stays at the project root, stays committed. Gitignoring it was considered for the same client-visibility reason, but `AGENTS.md`'s entire purpose is being a shared, committed file (OpenCode's own documentation says as much), so gitignoring it would work against what it's for. Documented as an easy two-command reversal (`echo "AGENTS.md" >> .gitignore` + `git rm --cached AGENTS.md`) if ever needed later — no tooling change required either way.

**Testing note distinct from every round before this one:** the `graphify` Step 2.6 addition is plain, self-contained Python — no agent instructions to walk through by hand. It was extracted verbatim from the actual file and run for real against five mock projects, including one built specifically to prove the manifest fix (Angular + TypeORM + Sequelize — undetectable under the old manifest, correctly detected under the new one). This caught a real bug before it shipped: a path-prefix inconsistency between root-level and nested directory entries in the stack-detection output, harmless for the substring-matching logic that consumes it but fixed anyway once found.

---

## Follow-up audit — manifest broadened a second time, fallback path brought back in sync, legacy footer removed

A deliberate, narrow follow-up pass on just `graphify` and `fix-bug`, not a general rewrite — investigate specific open questions, close what turns out to be real, leave what isn't.

**The manifest gap recurred, same failure class as before:** built a real mock project (NestJS + Vue + TanStack Vue Query) and ran the actual manifest-matching logic against it — confirmed NestJS was completely absent from the `backend` domain's `dependency_patterns`, same silent zero-coverage failure mode as the original TypeORM gap. Fixed the same way: `@nestjs/core` added to `backend`, `nuxt` added to `frontend`. This is the second time this specific list has needed broadening, not the first — worth being exact about the count rather than letting "broadened once" quietly go stale in the docs, which is exactly what happened until this entry was written.

**A second, smaller gap found in the same pass:** `coding-standards`' fallback detection path (used only if `graphify-out/.graphify_stack.json` is somehow missing) had its `find` commands checked against `path_patterns`' round-3 broadening — and had drifted out of sync. `path_patterns` recognized `prisma/`, `drizzle/`, `typeorm/`, `models/` directories; the fallback's `find` command only ever searched for `components`, `migrations`, `e2e`. Brought back in sync, verified against a real project with a `typeorm/` directory and no recognized schema file.

**`fix-bug`'s legacy `## Self-improvement` footer removed**, not just flagged — compared its exact text against `SELF-IMPROVEMENT-PROTOCOL.md` directly and confirmed it said nothing the injected pointer earlier in the same file didn't already cover more thoroughly. `setup.sh` no longer reports a redundant-footer skill as a result — the sample output in `01-SETUP.md` needed updating to match once this landed.

**`graphify` itself investigated and left untouched, on purpose:** installed the real `graphifyy` package directly and confirmed `query`/`path`/`explain` all take a genuine, working `--graph` flag — the tool was never hardcoded to a fixed path, closing an open question from much earlier in this project's history. No code issue was found, so no code was changed. Separately, attempted to reproduce the `graphify-out/graphify-out` duplicate-nesting anomaly reported early on, using a clean install and a real test project — could not reproduce it. Honest negative result, not claimed as fixed; most likely explanation is a stale, git-committed `graphify-out/` from before Rule 0b existed, now considerably less likely to recur.

---

## `graph-memory` protocol added (opt-in) — `graphify`'s own save-result/reflect wired into `fix-bug` and `plan-feature`

`graphify` has always shipped with a built-in, deterministic memory mechanism (`save-result`, `reflect`) that was never used by anything in this repo until now — discovered during the audit above, then deliberately tested for feasibility before being built into a feature, not assumed to be a good idea just because it existed.

**Feasibility tested for real before committing to building it:** installed the real package, ran actual `save-result`/`reflect` cycles, confirmed both commands run in roughly 100ms with no LLM call at all — genuinely cheap, not a hidden ongoing cost. Specifically tested the one scenario that would have made this unsafe to ship: renamed a function referenced by existing saved outcomes, rebuilt the graph, and confirmed the renamed node's structural reliability signal disappeared cleanly from `LESSONS.md` rather than persisting as stale-but-shown-reliable. One real, honestly-documented limitation from this test: the dropping itself produces no visible warning anywhere in the output.

**A fourth injected protocol, identical mechanism to `session-memory`, deliberately kept distinct in purpose:** three memory-flavored mechanisms now coexist on purpose, not by accident — self-improvement records that a *skill's instructions* were incomplete; session-memory avoids redundant re-checking *within one conversation*; graph-memory records whether a *specific part of the codebase graph* has reliably been useful, persisted *across* conversations and developers. `config/GRAPH-MEMORY-PROTOCOL.md` documents this distinction explicitly, given how easy three similarly-named mechanisms would be to blur together later.

**Scoped to `fix-bug` and `plan-feature` only — `coding-standards` deliberately excluded, not overlooked.** Checked its actual step structure before assuming it fit the same shape as the other two: it dispatches to a sub-skill and never receives a completion signal back, so there's no honest point in its own flow to record whether a domain match was actually correct. Forcing the pattern in anyway would mean recording outcomes the skill can't actually observe — the same "don't force a pattern where it doesn't fit" discipline already applied when `coding-standards-e2e`'s single-tool detection was reviewed and confirmed correct by design, not a gap, in the audit above.

**Each opted-in skill needs two marked points, not one** — `**Graph-memory:**` before relying on query results, and again once the real outcome is known — unlike `session-memory`'s single `**Session-reusable:**` marker. `fix-bug` (Step 4, Step 12) and `plan-feature` (Step 4, Step 7) both already had a clean query step and a clean final-report step, so both markers landed naturally rather than being forced in.

**A real mistake caught before delivery, not after:** the first attempt at packaging this change only staged the new protocol file, silently omitting the four modified files, and a lazy filtered verification check let that slip through once. Caught by insisting on a fully independent second verification pass with unfiltered output before calling it done.

---

## `coding-standards-tailwind` added — the first domain contributed by someone other than the original author

Adhil added a full new domain (design tokens, theme values, when to use a token vs. an arbitrary value), correctly following the manifest schema without being walked through it — including correctly setting `depends_on: ["frontend"]`, since a styling domain structurally requires a frontend to exist. Bumped the manifest to version 4. This is a distinct kind of event from the earlier manifest broadenings: those added tool names to an *existing* domain's detection list; this added a wholly new domain. Verified the wiring end to end with a real mock project (React + Tailwind), confirming both `frontend` and `tailwind` detect correctly together.

---

## `graphify affected` wired into `fix-bug` for blast-radius checking; `graph-memory` extended to record `coding-standards` guidance corrections

Two related additions. `fix-bug`'s Step 7 now runs `graphify affected` before finalizing a fix that changes an existing function's behavior — feasibility-tested first against a real multi-caller scenario before building, confirmed it correctly found all real callers. Framed strictly as information for the plan, never a reason to expand scope beyond what the bug report describes.

Separately, `graph-memory` was extended so `fix-bug` also records when a `coding-standards` domain's guidance turned out wrong mid-session — answering an open question from earlier about `coding-standards` having no way to observe the outcome of its own dispatch (it doesn't, but `fix-bug`, the skill that dispatches to it, does). Testing this changed the actual design: tagging a `save-result` entry with a domain name instead of a real graph node showed that `useful` outcomes tagged this way produce no visible lesson at all, only a silent count — so the instruction only records corrections and dead ends for domain guidance, never routine successes.

---

## Complex-project testing round — real multi-domain project, four confirmed findings, three closed

Built one deliberately complex test project (`megatest-shop`) touching all 7 `coding-standards` domains at once, rather than testing domains one at a time in isolated mock projects as every earlier round had. This surfaced findings a smaller test couldn't have: `graphify affected` misses callers inside anonymous callback functions entirely (the standard way Express/Hono/Fastify route handlers are written), `graphify`'s stack detection had zero Tailwind file-based awareness, graph queries are vocabulary-sensitive (a query using the task's natural wording can silently return nothing useful if it doesn't share vocabulary with the code's actual naming), and the knowledge graph has zero structural representation of Prisma schema content.

Three of the four got a real fix in the same round: Tailwind config file names added to `graphify`'s `NOTABLE_FILES` (a full fix, verified against both a config-file project and a pure-CSS-only Tailwind v4 project with no config file at all, to confirm the primary dependency-based path still covers that case); a retry-with-more-literal-terms instruction added to `fix-bug`, `plan-feature`, and `coding-standards`' query steps; and explicit instructions to read schema files directly added to `plan-feature`, `fix-bug`, and `coding-standards-database`, since the graph is confirmed blind to schema content. The `affected` anonymous-callback gap got a mitigation, not a full fix — a `grep`-based cross-check compared at the file level (not raw line count, which testing showed was misleading, since one real caller produces multiple grep matches). The actual defect lives inside `graphify`'s own call-graph extraction, a third-party package, out of scope for a direct patch here.

---

## Priority 3 audit — `typescript-conventions`, `webapp-conventions`, `skill-factory`, `skill-add`, `skill-update`, `eslint-rule-author`

The remaining unaudited skills, tested with the same rigor as every skill before them, not a lighter pass. Found and fixed one real bug: `skill-add`'s cross-reference rewriting (shared with `skill-update`, since both use the same underlying script) broke markdown links pointing at another imported skill. Built a real fake external skillset with a genuine cross-reference between two skills and ran the actual installer against it — the link came out with a broken path (a space, no `.md` extension) instead of a valid one. Root cause: the rewriter's replacement value for any path ending in `/SKILL.md` was always the informal "prose" form meant for plain-text mentions, even when the same text appeared inside a markdown link target. Fixed with a minimal, targeted change; re-verified against the same real scenario on an independent clone, and confirmed the fix carries through `skill-update`'s refresh flow too, since it reuses the same script.

Everything else tested came back genuinely working: `skill-factory`'s `scaffold_skill.py` against all 4 documented behaviors; `eslint-rule-author`'s bundled worked example and its Vitest-compatibility bridge, tested by actually installing the real `@typescript-eslint` toolchain and running the tests for real, not just reading the code. One non-bug worth a team decision, not a fix: `webapp-conventions` is explicitly scoped to SvelteKit, while every test project used throughout this whole project has been React-based — worth confirming this is still accurate to what the team actually builds.

---

## Current state snapshot (at time of writing)

20 skills at the repo root: `coding-standards` + its 7 domain sub-skills (including `coding-standards-tailwind`), `eslint-rule-author`, `first-principles-review`, `fix-bug`, `graphify`, `investigate-issue`, `plan-feature`, `skill-add`, `skill-factory`, `skill-update`, `sync-prs`, `typescript-conventions`, `webapp-conventions`. Four managed protocols: clarification and self-improvement unconditional; session-memory opt-in (`coding-standards`, `sync-prs`); graph-memory opt-in (`fix-bug`, `plan-feature`). Six standing rules (0, 0b, 1, 2, 3, and the meta-principle) in `AGENT-STANDING-RULES.md`. `coding-standards`' domain manifest at version 4, broadened three times (database/frontend for TypeORM/Sequelize/Angular/Astro; backend/frontend for NestJS/Nuxt; a wholly new domain, Tailwind, added rather than an existing one broadened), its detection fed by `graphify`'s own build rather than a separate pass. `fix-bug` additionally checks blast radius via `graphify affected` before finalizing a fix. `validate_skill.py` fully passes across all 20.


