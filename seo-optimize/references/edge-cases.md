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
