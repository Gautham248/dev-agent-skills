# Sources and provenance

Built 2026-11-04 by reading the actual repositories (cloned at their default
branch that day) and fetching the official docs below. Use this file to see
where a rule comes from, and to re-check claims when they age.

## Open-source skills read and what was borrowed

| Repository | Borrowed | Left out (and why) |
|---|---|---|
| coreyhaines31/marketingskills (`seo-audit`, `ai-seo` + references) | Audit priority order (crawl, technical, on-page, content, authority); title patterns by page type; international/hreflang checklist; AI crawler purposes; "proof as text" and pricing-as-text agent readiness; untrusted-fetch rule | Marketing-context interview, vendor tool lists, monthly citation-tracking workflow (not code-level) |
| AgriciDaniel/claude-seo (`seo-technical`, `seo-geo`, `seo-agentic`, `seo-schema`, `seo-content`, quality gates) | Per-claim crawler table ("check the right bot for the claim"); honest-reporting rules (score only what was measured, no ranking promises); JS-SEO canonical/noindex rules; retired schema type list; Who/How/Why test; doorway-page thresholds | Python script runtime, Google API/DataForSEO extensions, PDF reporting, 0-100 scores |
| rampstackco/claude-skills-seo (`seo-technical`, `seo-aeo-geo`, `seo-site-health-audit`) | Stack-agnostic layered model; issue-impact table (mechanism x effort); cluster fixes; park list; "a stated gap is a complete answer" | Ahrefs-dependent orchestration |
| kpab/seo-mastery-agent-skills (`ai-search.md`, `audit-workflow.md`) | Evidence levels (High/Medium/Experimental); eligibility vs selection; six-field finding format; llms.txt as experimental; untrusted-content boundary | Astro and Cloudflare edge guides (out of scope) |
| daniel-amekpoagbe/react-seo-skills | Version-aware rule ("this may not be the Next.js you know"); ask for real details or leave TODO placeholders; never repeat SEO code; React 19 native metadata vs react-helmet-async; CSR warning | Keyword clustering workflow |
| chongdashu/cc-skills (`site-metadata-generator`) | Codebase-first workflow (detect framework, audit current state, page types, then implement) | Its FAQ/HowTo rich-result claims (outdated), keywords meta |
| andrehfp/tinyplate (`seo-technical`) | Middleware blocking robots/sitemap; `metadataBase` for OG; environment-gated robots | Meta keywords array; `priority` values in sitemaps (ignored by Google) |
| aaron-he-zhu/aaron-marketing-skills (`technical-seo-checker`, `domain-authority-auditor`) | Measured / user-provided / estimated labels; unknown is not a fail; authority is peer-relative; CDN edge overrides | 40/80-item scoring runtimes |
| addyosmani/web-quality-skills (`seo`) | Fix the source and re-run the same checks; multiple H1 is not a failure; title length is a lint, not a rule | Lighthouse MCP dependency |

## Official documentation used (fetched 2026-11-04)

- Next.js docs shipped in `next@16.4.5` (`dist/docs`): metadata-and-og-images,
  generate-metadata (merging, metadataBase, streaming), json-ld guide,
  htmlLimitedBots, not-found (streaming status), proxy (middleware rename),
  image (`priority` deprecation), cacheComponents. Default bot list read from
  `dist/shared/lib/router/utils/html-bots.js`.
- svelte.dev: `docs/kit/seo`, `page-options`, `adapter-static`,
  `migrating-to-sveltekit-3` (llms.txt variants).
- react.dev: `reference/react-dom/components/title`, `meta`.
- React Router docs shipped in `react-router@8.5.1` (`docs/`): how-to/meta,
  pre-rendering, spa, status; start/framework/route-module.
- Google Search Central: JavaScript SEO basics (updated 2026-03-04); AI
  features and your website (updated 2025-12-10); FAQPage rich result
  retirement notice (2026-05-07, reported by Search Engine Journal
  2026-05-10).
- OpenAI crawlers (developers.openai.com/api/docs/bots), Anthropic crawlers
  (support.claude.com/en/articles/8896518), Perplexity crawlers
  (docs.perplexity.ai/docs/resources/perplexity-crawlers).

## Verified by experiment (not only by docs)

Real scaffolds: create-next-app@16.4.5, create-vite@9.3.3 (react-ts) with
react-router@8.5.1, sv@1.2.0 (SvelteKit 3.1.1). Seeded defects were built,
served with the production server and checked with `seo-scan fetch`:
inherited root canonical, shallow-merged openGraph, unescaped JSON-LD breakout,
client-fetched content, proxy redirecting robots/sitemap, soft 404s on dynamic
routes, request-derived canonicals, SPA fallback answering robots.txt and
sitemap.xml, and Next.js streamed metadata per user agent (including the two
fixes). Details in `edge-cases.md` and `stack-nextjs.md`.

## Re-check when stale

Crawler names and purposes, Google's supported rich-result types, Next.js
`htmlLimitedBots` defaults and SvelteKit major-version changes move fastest.
If this file is more than about six months old, re-fetch those sources before
relying on the tables.
