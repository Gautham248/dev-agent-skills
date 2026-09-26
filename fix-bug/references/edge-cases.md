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

## 2026-07-30 — A pending attempt could be superseded twice, corrupting the ledger

**Condition:** `appendAttempt`'s validation checked whether the target
attempt's own `outcome` field was `"pending"` before allowing a
`supersedes` reference. But records are append-only — a superseded
attempt's outcome field never changes, it stays `"pending"` on disk
forever. So the check always passed for any attempt that started pending,
and a second `--supersedes N` call succeeded silently, producing a ledger
where two different records both claimed to resolve the same attempt
number.

**Handling:** The correct check scans for an *earlier* record that already
has `supersedes: N`, not the target record's own outcome field. Found by
manually running the CLI end-to-end through the exact resolve-then-
re-resolve sequence, not by the unit tests alone — the original unit tests
only covered a single supersede per attempt and never exercised a second
one against the same target. A regression test now covers this explicitly.
## 2026-09-24 — The correct fix IS a file deletion, which the guardrails forbid

What happened: the bug's actual remedy was to remove a whole feature, not edit it
— two API route files had to be deleted (`app/api/otp/send/route.ts`,
`app/api/otp/verify/route.ts`) along with the client half that called them. But
"Delete any file" is listed under this skill's *What the agent must NEVER do*, with
no documented fallback.
What I did: Treated the guardrail as authoritative and surfaced the conflict instead
of quietly working around it — presented the deletions as a flagged item in the Step
7b plan, named the alternative (leave the routes returning `410 Gone`), explained why
that alternative is worse (dead public endpoints that mint codes nobody reads), and
waited for an explicit go-ahead. Note two things for next time: (a) the guardrail is
about unrequested deletions, so an explicitly approved deletion is fine, but it must
be *explicitly* approved in the plan, not inferred from a general "fix it"; and (b) a
deletion approved this way cannot be re-`git add`ed afterwards — `git rm` already
stages it, and a later `git add <deleted-path>` fails with "pathspec did not match
any files", which can abort a multi-path `git add` and leave the rest unstaged.
Check `git diff --cached --stat` after staging rather than assuming it worked.

## 2026-09-24 — In local-checkout mode the graph comes from the local checkout, which can predate the branch under fix

What happened: Step 3's paths (`/app/data/graphs/<owner>__<repo>`, SHA-file staleness
check) all assume the dev-agent-service mode. Step 0 correctly determined we were in
a teammate's own checkout instead, so the graph was the project's existing
`graphify-out/graph.json` — built from the *local* checkout, which was sitting on a
different, older branch than the one being fixed. Every file in scope for the fix was
newer than the graph, so `graphify query` returned zero nodes for them and
`graphify affected` answered "No unique node match for --files".
What I did: Did not treat the empty result as "no relevant code" and did not fall
back to guessing. Confirmed the files were genuinely absent from the graph (grep the
query output for the exact paths) and stated plainly that the graph could not inform
this fix, then used direct file reads plus `git grep` for blast radius. Recorded the
graph query outcome as `dead_end`, not `useful`. Also note a fresh `git worktree` of
the target branch is the right place to make the change — it keeps the developer's
own branch untouched — but its `node_modules` is absent, so install once before
running anything, and gitignored generated files (e.g. `next-env.d.ts`, framework
build types) must be copied in or the type checker reports large numbers of bogus
"cannot find module" errors against the *unmodified* tree.

## 2026-09-24 — Distinguishing an introduced build failure from a pre-existing one

What happened: Step 9's verification (`pnpm build`) failed at homepage prerender
with a deliberately opaque production error ("The specific message is omitted in
production builds"). The changed files were reachable from the homepage's import
graph, so the failure could not be dismissed as unrelated on inspection alone.
What I did: Instead of guessing or reporting it as caused by the fix, built a second
throwaway worktree at the *untouched* target commit and ran the same build there. It
failed with the identical error and the identical digest (`265885447`) — same digest
means the same error instance, which is what makes this attribution conclusive rather
than merely suggestive. Reported it as pre-existing and unrelated, with the evidence,
and did not attempt to fix out-of-scope breakage. Worth doing whenever a build/test
fails in a repo with no CI: cost is one extra build, and it is the difference between
a truthful "not green, here is why it is not mine" and an inaccurate claim either way.
Related gotcha: piping a build to `tail` swallows the build's exit code — read
`${PIPESTATUS[0]}`, not `$?`, or the failure looks like a success.

## 2026-09-24 — `drizzle-kit generate` demands a connection string it never uses

What happened: adding a table meant generating a migration, but `drizzle.config.ts`
throws "Set DATABASE_URL_UNPOOLED (preferred) or DATABASE_URL before running
drizzle-kit" if neither is set — and a fresh worktree has no `.env`. `db:generate`
only writes a file; it does not connect.
What I did: Supplied a syntactically valid placeholder
(`DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder pnpm
db:generate`), which satisfied the config guard and generated the migration without
touching any database. Do this rather than copying a real `.env` into a worktree —
that spreads live credentials into more places, and in this repo the real
`DATABASE_URL` points at production. Also expect `pnpm db:generate` in a fresh
worktree to run a full `pnpm install` first, and verify the generated SQL is purely
additive before trusting it.
## 2026-09-24 — Diagnosing a connectivity failure from a single resolver produced a confidently wrong answer

What happened: a build failed with `getaddrinfo ENOTFOUND <store>.myshopify.com`. I ran
`dig`/`nslookup` through the machine's default resolver, got NXDOMAIN, confirmed a couple
of control hosts resolved, and concluded the configured store had been deleted — then
told the developer that their Shopify store no longer existed and that the config pointed
at a dead host. **All of that was wrong.** The store was live and was in fact the
production storefront. Re-testing showed the machine's own resolver returns a bogus
NXDOMAIN for the *CNAME target* every `*.myshopify.com` host resolves through
(`shops.myshopify.com`), while `8.8.8.8`, `1.1.1.1` and `9.9.9.9` all resolved it fine.
Forcing the resolved IP with `curl --resolve` returned `301 -> https://<the real domain>/`,
i.e. the store was healthy the whole time. The developer pushed back with a one-line
correction and was right.
What I did (after the correction, and what to do first next time): three checks, in order,
before ever asserting a host is gone. (1) Resolve through at least one *public* resolver,
not just the local one — `dig @8.8.8.8` and `dig @1.1.1.1`. (2) Read the response flags:
the bogus answer came back with `status: NXDOMAIN` for a name that exists **and** the `aa`
(authoritative-answer) flag set on a recursive query, which is a contradiction and a clear
tell the resolver cannot be trusted. (3) Verify over HTTP, bypassing DNS if necessary with
`curl --resolve <host>:443:<ip>` — a resolution failure is not evidence about whether a
service exists, only that this machine cannot reach it. Also, for `*.myshopify.com`
specifically: the wildcard CNAME means DNS presence proves nothing in *either* direction —
even a deliberately fake handle returns the same CNAME — so only an HTTP request separates
a real store from Shopify's "Store unavailable" page. Use a fake handle as a control.
Cost of not doing this: I told a developer their production store was deleted when it was
fine, which is exactly the class of wrong-but-confident claim that erodes trust in every
other finding in the same report.

## 2026-09-24 — "Build fails" may be two independent causes; fix the one that is code

What happened: the same build failure had a second, independent cause that only became
visible after the first was understood. The immediate cause was environmental (the DNS
fault above). But underneath it was a genuine code weakness: the curated homepage sections
called `Promise.all(items.map((item) => getProduct(handle)))` with no error handling, and
`getProduct` is a `"use cache"` function that throws when the fetch fails — so *any*
Shopify outage aborted the entire production build, and worst of all hid behind one opaque
prerender error naming no section.
What I did: Fixed the code cause even though the environment was also broken, because the
code cause is the one that makes every future deploy fragile — a build that cannot complete
because a third-party API blipped cannot ship *anything*. Resolved each failed product read
to `undefined`, which the existing `composeSlides` already drops, so one dead handle costs
one slide and a full outage costs the section. The broken local DNS then became a useful
fault-injection harness: it proved the degradation path works under a real outage, and the
build went from dying at `/[locale]/page` to exit 0 with all 59 pages generated. Useful
pattern: when a log line reports a swallowed section, log *one* line per section naming the
dropped handles and carrying the first caught error — a per-item log for a total outage is
N lines of noise, and no log at all makes an outage invisible.
## 2026-09-24 — Reporting a "blocker" from a session note instead of checking the system

What happened: a previous session's log ended with "the developer must set AUTH_SECRET
in the Vercel project env for deployed environments". I read that, wrote it into a
decision record as an outstanding production blocker, and then told the developer to
"check Production and Preview" — presenting an unverified claim as a finding. When I
finally checked directly (`npx vercel env ls production` / `env ls preview`, which list
env var *names* without values), `AUTH_SECRET` was already set in **both** environments,
added nine days earlier. The task I had been asked to do as a result — add the env var
— was a no-op, and the developer's instruction to "fix the blockers" was partly built on
my own bad information.
What I did: Reported the correction plainly rather than quietly skipping the no-op, and
did not touch the Vercel env. The generalisable rule: **a note that something needs
doing is not evidence that it is still undone.** Session logs, TODOs, and decision
records are all snapshots of a past moment; anything with an external system of record
behind it (env vars, deployed config, DNS, a remote's branch state) has to be re-checked
against that system before it is reported as outstanding. Two cheap re-checks that cost
seconds and would have prevented this: `vercel env ls` for env vars, and the CLI's own
`whoami`/`project ls` to confirm which project and environments are actually in play.
Related trap in the same area: the stored Vercel token's `expiresAt` was a 1970 epoch —
reading it convinced me CLI auth was dead, but the CLI silently refreshed via the stored
`refreshToken` and worked fine. Test the CLI, don't read its token file and predict.

## 2026-09-24 — Names in a data table are not evidence about use

What happened: the brief was "delete the unwanted admin accounts", listing three:
`admin`, `sTest`, `test2`. The obvious reading — keep `admin`, delete anything with
"test" in it — would have deleted `sTest`, which turned out to be **the account that had
made every content edit in the system** (2 product overrides, 4 newly-created rows, 10
curated rows), while the account actually called `admin` had never edited anything.
What I did: Before proposing a deletion, checked what each account *owned* rather than
what it was called — a per-account count of rows referencing that id via foreign keys —
and presented the table to the developer with the recommendation inverted by the
evidence. Also checked the FK behaviour first (`ON DELETE SET NULL` on all of them), so
I could state accurately that deleting the wrong account would lose edit provenance but
no content. The developer confirmed keeping `sTest`, and the counts were identical
before and after the delete, which is what proved no provenance was lost. Rule: for any
destructive cleanup driven by a name pattern, cheaply quantify what each candidate owns
first — and when the evidence contradicts the naming, say so instead of following the
pattern.
## 2026-09-24 — Three platform assumptions asserted instead of verified, in one session

What happened: across one working session I made three claims about third-party
platform behaviour, presented them as findings, and was wrong or unverified on all
three. (1) A build failed with ENOTFOUND and I concluded the developer's Shopify store
had been deleted — the store was live; this machine's resolver was broken. (2) I listed
"AUTH_SECRET missing from Vercel" as a production blocker from a stale session note —
it had been set nine days earlier. (3) I raised "the rate limiter trusts the leftmost
x-forwarded-for entry, so it is bypassable" as a `should`, then fixed the code to prefer
x-real-ip instead — and only afterwards read Vercel's docs, which say `x-forwarded-for`
is **overwritten by the platform specifically to prevent IP spoofing** (so the original
code was already safe and the finding was a false alarm), and that `x-real-ip` is
"identical to x-forwarded-for" (so the fix changed nothing), while the header that
actually survives a proxy in front of Vercel is `x-vercel-forwarded-for`.
What I did: Corrected each in the open rather than quietly moving on, and the third
correction produced a better fix than either the original or my first attempt. The
pattern worth generalising: **anything you know about a third-party platform is a
hypothesis until this session read its documentation.** A sentence like "the platform
sets X so a client cannot forge it" or "this host is gone" or "this env var is unset"
is a *claim*, and it is cheap to test — `curl` the host, `web_fetch` the vendor's docs
page, list the env var. When a finding's whole severity rests on such a claim, verify
the claim before writing the finding, not after shipping the fix: the cost of checking
is one command, and the cost of not checking is a confident finding that is wrong plus
a code change built on top of it. Note also the asymmetry that made (3) expensive —
having asserted the vulnerability, I then *changed working code* to address it, so a
false alarm became a real diff; an unverified finding does not stay contained in the
review.
