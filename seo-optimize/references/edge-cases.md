# Edge cases

Known edge cases for the seo-optimize skill and how to handle them. The agent
appends new ones here after real runs; see
`../../config/SELF-IMPROVEMENT-PROTOCOL.md` for what qualifies. The entries
below were found while building and testing the skill against real
scaffolded apps on 2026-11-04.

## 2026-11-04: `pkill -f "next start"` leaves the old server running

The Next.js production server process is named `next-server (vX)`, so
`pkill -f "next start"` does not stop it. The next `next start` on the same
port fails with `EADDRINUSE` (only visible in its log), and every later check
silently tests the **old** build. During testing this produced a false
conclusion ("htmlLimitedBots has no effect") until the stale process was found.
**Handle:** stop with `pkill -f next-server` (or kill the PID that holds the
port), confirm the port is free before restarting, and check the server log
for a successful start before fetching.

## 2026-11-04: create-next-app 16.4.5 scaffold enables cacheComponents

The scaffold's `next.config.ts` sets `cacheComponents: true`. A page that awaits
request-time data (`connection()`, `cookies()`, uncached `fetch`) outside
`<Suspense>` then fails the build ("Next.js encountered uncached or runtime
data during prerendering"). **Handle:** when proposing server-side data
fetching for SEO, wrap request-time parts in `<Suspense>` or cache the data
(`'use cache'`), and prefer `generateStaticParams` for content routes.

## 2026-11-04: Next.js streams metadata into body for AI user agents

With the default config, a dynamic `generateMetadata` route sent `<title>`,
description and canonical about 12 KB after `</head>` to GPTBot,
Claude-SearchBot, PerplexityBot and Googlebot; Bingbot got them in `<head>`.
Extending `htmlLimitedBots` (default pattern plus AI tokens) or prerendering
the route fixed it. See `stack-nextjs.md#streaming-metadata-and-ai-crawlers`.

## 2026-11-04: notFound() inside Suspense returns 200 + noindex

Documented Next.js behaviour, observed live: the made-up slug returned 200 with
`<meta name="robots" content="noindex">` for Googlebot and 404 for Bingbot.
The scanner reports this as HTML-SOFT404-NOINDEX (low), not HTML-SOFT404.

## 2026-11-04: Scaffold uses an API its own docs deprecate

create-next-app 16.4.5 renders `<Image priority />` although the bundled docs
deprecate `priority` in Next 16. META-025 is therefore info-level; mention it,
do not lead with it.

## 2026-11-04: Canonicals look broken under local preview

Canonicals derived from the request (`page.url.href` in SvelteKit, `headers()`
host in Next.js) render as `http://localhost:<port>/...` under `vite preview` or
`next start`. That is the evidence for META-012, not a test artefact to ignore,
but do not report "production canonicals are localhost". Report that the
canonical follows the request host and recommend a configured origin.

## 2026-11-04: Vite preview and SPA hosts answer robots.txt with index.html

Without `public/robots.txt`, the SPA fallback serves `index.html` (200,
`text/html`) for `/robots.txt` and `/sitemap.xml`. The fetch mode reports
LIVE-ROBOTS-HTML / LIVE-SITEMAP-TYPE and skips parsing the HTML as robots
rules.

## 2026-11-04: adapter-auto builds without an adapter output

In an environment adapter-auto does not recognise, `vite build` logs "Could
not detect a supported production environment" but still builds;
`vite preview` serves the app correctly for checks. Prerendered pages land in
`.svelte-kit/output/prerendered/pages/`.

## 2026-11-04: create-vite 9 title is the package name

The react-ts template sets `<title>` to the project/package name (for example
`vite-react`), not "Vite + React". META-002 treats a title equal to the
`package.json` name as a scaffold default.

## 2026-11-04: `dynamicParams = false` is rejected with cacheComponents

To make unknown slugs return 404 without a request-time lookup, the usual move
is `export const dynamicParams = false`. With `cacheComponents: true` the build
fails: "Route segment config dynamicParams is not compatible with
nextConfig.cacheComponents". **Handle:** with cacheComponents, keep
`generateStaticParams` + `notFound()`; unknown slugs then return 200 with
`noindex` (acceptable for Google). Use a Proxy check if a hard 404 is required.

## 2026-11-04: Apply cycle verified on the seeded Next.js app

Following the references (shared `lib/site.ts` origin constant, per-page
canonicals, spread `openGraph`, escaped JSON-LD helper, server-fetched
features list, prerendered blog posts, scoped proxy matcher, robots/sitemap
files, trust pages) closed every high and medium live finding: per-page
canonicals, title in `<head>` for GPTBot, robots.txt and sitemap.xml served
directly, real 404 at the root. Remaining items were the expected content
work (author/date on articles, Article JSON-LD).

## 2026-11-05: Seo component's title suffix double-brands already-branded titles

What happened: the `Seo.svelte` template in `stack-sveltekit.md#titles` derives
`fullTitle` as `` `${title} | ${SITE_NAME}` `` for every non-home page. On a site
whose page titles already contain the brand ("Meet the house at Creator House",
"Creator House: The Story Receiver"), adopting the template verbatim produces
"Meet the house at Creator House | Creator House". The skill gives no rule for
when the suffix is redundant.

What I did: dropped the suffix logic and passed each page's existing title
through verbatim, since the brand was already present in every title. Worth
checking before copying the template: if the site's existing `<title>` tags
already carry the brand name, omit the suffix rather than append a second copy.

## 2026-11-05: HTML-CANON-COLLIDE fires `high` on a deliberate legacy-URL stub

What happened: a site kept its old URL as a prerendered meta-refresh stub
canonicalising to the replacement page (the documented static-hosting substitute
for a 301). Once its relative canonical was made absolute — the correct fix for
HTML-CANON-BAD — the `html` scan escalated to `HTML-CANON-COLLIDE` at `high`:
"2 different pages declare the same canonical ... All but one are asking to be
dropped from the index." That is precisely the stub's purpose, so the rule is a
true positive by its own logic but a non-issue by design.

What I did: parked it with the reason rather than reporting it as a defect, and
recommended the real fix (a host-level 301 — `redirects` in `vercel.json` here —
which deletes the stub and closes the finding set outright) as separate,
out-of-scope work. When a collision's duplicate is a redirect stub rather than
two live pages, park it and point at the host redirect; don't chase the
canonical.

## 2026-11-06 — Live production can be an older build than the checked-out repo

What happened: Step 4 was run against the live production site (the app could
not be built locally without pulling secrets). Production reported no
canonical, no hreflang, `/robots.txt` and `/sitemap.xml` answered by the
locale catch-all as `text/html`, and the root layout's old default description
— all of which the repo had already fixed three days earlier in a commit that
was never deployed (the production deployment carried no git metadata: a CLI
deploy from somebody's local tree). Reporting those as code defects would have
sent the developer to fix files that were already correct.

What I did: before writing any finding, diffed the live `<head>` against what
the checked-out code would emit and checked the deployment's age and git
metadata (`vercel inspect <url> --json` → no `meta.githubCommitRef` means a CLI
deploy, so the branch is unknown). Findings then split into two piles:
"already fixed in the repo, just not deployed" and "genuinely missing from the
code". **Handle:** when Step 4 fetches a remote production host rather than a
local build, first establish which code version that host is running, and label
every live finding with the pile it belongs to. A live finding is evidence about
a deployment, not automatically about the repo.
