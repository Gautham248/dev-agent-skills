# Rule catalog

Every rule ID `seo-scan` can emit. `scan` = static code analysis, `html` =
built/served HTML, `fetch` = live server checks. A test keeps this list in
sync with the scanner.

## Crawlability

| ID | Mode | Fires when |
|---|---|---|
| CRAWL-001 | scan | no robots.txt source (static file, app/robots.ts, robots.txt route) |
| CRAWL-002 | scan | robots disallows `/` for `*` (info if environment-gated) |
| CRAWL-003 | scan, fetch | robots.txt has no `Sitemap:` line |
| CRAWL-004 | scan, fetch | robots.txt blocks JS/CSS (`/_next`, `/_app`, `/assets`, `*.js`) |
| CRAWL-005 | scan | no sitemap source |
| CRAWL-006 | scan | sitemap has relative or localhost URLs |
| CRAWL-007 | scan | sitemap lists private-looking URLs |
| CRAWL-008 | scan | global noindex (root layout metadata, app.html, index.html) |
| CRAWL-009 | scan | CSR-only rendering (SPA without prerender, SvelteKit `ssr = false`, adapter-static fallback, React Router `ssr: false`) |
| CRAWL-010 | scan | route fetches its content client-side (`useEffect`/`onMount`) |
| CRAWL-011 | scan | navigation via click handlers or anchors without a real href |
| CRAWL-012 | scan | hash routing |
| CRAWL-013 | scan | host rewrites everything to index.html, or client catch-all 404 without noindex |
| CRAWL-014 | scan | dynamic route never calls notFound()/error(404)/notFound: true |
| CRAWL-015 | scan | no custom not-found / error page |
| CRAWL-016 | scan | proxy/middleware/hooks redirect on a matcher that includes robots.txt and sitemap.xml |
| CRAWL-017 | scan | SvelteKit `trailingSlash = 'ignore'` |
| CRAWL-018 | scan, fetch | robots.txt uses directives Google ignores (noindex, crawl-delay, host) |
| CRAWL-019 | scan | every sitemap entry uses `lastModified: new Date()` |

## Technical and on-page metadata

| ID | Mode | Fires when |
|---|---|---|
| META-001 | scan | no title source at all |
| META-002 | scan | scaffold title/description left in place (Create Next App, Vite package name, React App) |
| META-003 | scan | public routes without their own title, or root title without a template |
| META-004 | scan | identical literal titles on several routes |
| META-005 | scan | no description globally or on several routes |
| META-006 | scan | identical literal descriptions |
| META-009 | scan | public routes without a canonical |
| META-010 | scan | Next.js root layout canonical inherited by child routes |
| META-011 | scan | SPA `index.html` hard-codes a canonical |
| META-012 | scan | canonical built from the request URL (`page.url.href`) |
| META-014 | scan | Next.js openGraph overwritten by shallow merge (images dropped) or root `openGraph.url` inherited |
| META-015 | scan | Next.js `metadataBase` missing (high when relative URLs are used) |
| META-016 | scan | `<html>` without `lang` |
| META-017 | scan | no viewport meta (non-Next stacks) |
| META-018 | scan | deprecated `react-helmet` |
| META-019 | scan | `next/head` in App Router, or React Router `meta` exports without `<Meta />` |
| META-020 | scan | metadata exported from a `'use client'` file |
| META-021 | scan | React `<title>` with mixed text and expression |
| META-022 | scan | `metadata.keywords` (ignored by Google) |
| META-023 | scan | `document.title` assignment |
| META-024 | scan | localised app without hreflang |
| META-025 | scan | `next/image` `priority` on Next.js 16+ |
| META-026 | scan | `middleware.*` on Next.js 16 (renamed to proxy) |

## Structured data, images, performance

| ID | Mode | Fires when |
|---|---|---|
| SD-001 | scan | no JSON-LD anywhere |
| SD-002 | scan | JSON-LD serialised without escaping `<` |
| SD-003 | scan | retired rich-result types (HowTo, SpecialAnnouncement, ClaimReview, VehicleListing, EstimatedSalary, LearningVideo) |
| SD-004 | scan | FAQPage present (info: no Google rich result since 2026-05-07) |
| SD-005 | scan | JSON-LD injected client-side |
| SD-006 | scan | `@type` without `@context` in a file |
| SD-007 | scan | article routes without Article/BlogPosting JSON-LD |
| IMG-001 | scan | images without alt |
| IMG-002 | scan | `<img>` without width/height or sizing class/style |
| IMG-003 | scan | raw `<img>` in a Next.js app |
| IMG-004 | scan | hero/banner image lazy-loaded |
| IMG-005 | scan | Next.js app marks no image as high priority |
| PERF-001 | scan | render-blocking third-party script in the document head |
| PERF-002 | scan | Google Fonts without `display=swap` |
| PERF-003 | scan | hard-coded `http://` resource URLs |

## Content and authority

| ID | Mode | Fires when |
|---|---|---|
| CONTENT-001 | scan | lorem ipsum in components |
| CONTENT-002 | scan | article template without visible date or author |
| AUTH-001 | scan | no About and/or Contact route |
| AUTH-002 | scan | no privacy/terms route |
| AUTH-003 | scan | no Organization/Person entity markup, or no `sameAs` |

## GEO / AI search

| ID | Mode | Fires when |
|---|---|---|
| GEO-001 | scan, fetch | robots blocks a search crawler (Googlebot, Bingbot, OAI-SearchBot, Claude-SearchBot, PerplexityBot) |
| GEO-002 | scan, fetch | training tokens blocked (info: policy) |
| GEO-003 | scan | Next.js dynamic `generateMetadata` routes without `htmlLimitedBots` covering AI crawlers |
| GEO-004 | scan | site-wide nosnippet / max-snippet:0 |
| GEO-005 | scan | llms.txt present or absent (info, experimental) |
| GEO-006 | scan, fetch | named search-bot groups bypass `*` Disallow lines |

## Rendered HTML and live

| ID | Mode | Fires when |
|---|---|---|
| HTML-SHELL | html, fetch | empty app shell |
| HTML-THIN | html, fetch | under 150 words of visible text (info) |
| HTML-TITLE | html, fetch | no `<title>` |
| HTML-TITLE-DUP | html, fetch | same title on several pages |
| HTML-TITLE-LEN | html, fetch | title under 10 or over 65 characters (info) |
| HTML-TITLE-BODY | html, fetch | `<title>` after `</head>` |
| HTML-DESC | html, fetch | no description |
| HTML-DESC-DUP | html, fetch | same description on several pages |
| HTML-CANON-NONE | html, fetch | no canonical |
| HTML-CANON-MULTI | html, fetch | more than one canonical |
| HTML-CANON-BAD | html, fetch | canonical not absolute https (localhost flagged high) |
| HTML-CANON-COLLIDE | html, fetch | several pages share one canonical |
| HTML-NOINDEX | html, fetch | robots meta noindex |
| HTML-XROBOTS | fetch | `X-Robots-Tag: noindex` header |
| HTML-NOSNIPPET | html, fetch | nosnippet / max-snippet:0 |
| HTML-LANG | html, fetch | no `lang` |
| HTML-VIEWPORT | html, fetch | no viewport |
| HTML-H1 | html, fetch | no `<h1>` |
| HTML-H1-MULTI | html, fetch | several `<h1>` (info) |
| HTML-OG | html, fetch | og:title/og:image missing or og:image relative |
| HTML-ALT | html, fetch | images without alt |
| HTML-JSONLD-INVALID | html, fetch | JSON-LD does not parse |
| HTML-JSONLD-CONTEXT | html, fetch | JSON-LD without `@context` |
| HTML-JSONLD-RETIRED | html, fetch | retired rich-result type |
| HTML-STATUS | fetch | non-200 for an expected page |
| HTML-SOFT404 | fetch | made-up URL returns 200 |
| HTML-SOFT404-NOINDEX | fetch | made-up URL returns 200 with noindex |
| HTML-PROBE-REDIRECT | fetch | made-up URL redirects instead of 404 |
| LIVE-REDIRECT | fetch | robots.txt or sitemap.xml redirects |
| LIVE-MISSING | fetch | robots.txt or sitemap.xml non-200 |
| LIVE-ROBOTS-HTML | fetch | robots.txt served as HTML (SPA fallback) |
| LIVE-SITEMAP-TYPE | fetch | sitemap.xml not served as XML |
| LIVE-UA-STREAM | fetch | `<title>` placement differs by user agent / outside head |
| LIVE-UA-STATUS | fetch | status differs by user agent |
| LIVE-UA-CONTENT | fetch | content volume differs by user agent |
| STACK-000 | scan | no supported framework detected |
