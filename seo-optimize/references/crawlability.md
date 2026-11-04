# Crawlability and indexability

Order matters: a page that cannot be crawled, rendered and indexed cannot
rank or be cited, whatever its content. Check these before on-page work
(priority order from coreyhaines31/marketingskills `seo-audit`; six-layer
model from rampstackco `seo-technical`).

## robots.txt

- One deliberate policy, served at `/robots.txt` with status 200 and
  `text/plain`. A 5xx robots.txt is treated by Google as "disallow
  everything". A redirect to a login page, or an SPA fallback answering with
  HTML, means crawlers get no policy and no sitemap hint (LIVE-REDIRECT,
  LIVE-ROBOTS-HTML: both reproduced on real builds).
- `User-agent: *` + `Disallow: /` blocks the site (CRAWL-002). Generate the
  blanket block only for preview/staging builds, gated on a deploy variable.
- Do not block rendering resources: `/_next/` (Next.js), `/_app/` (SvelteKit),
  `/assets/` (Vite), `*.js`, `*.css` (CRAWL-004).
- Reference the sitemap with an absolute URL (CRAWL-003).
- Google ignores `noindex:`, `crawl-delay:` and `host:` lines (CRAWL-018).
  Keep pages out of the index with a robots meta tag or `X-Robots-Tag`, and
  remember a page blocked in robots.txt cannot be crawled, so its `noindex`
  is never seen.
- **Group selection:** a crawler obeys only the most specific group naming it.
  A `User-agent: OAI-SearchBot` group therefore replaces the `*` rules for that
  bot, including your private-path Disallows (GEO-006). Repeat them inside
  named groups.
- robots.txt is a request, not access control. Private paths need
  authentication; user-triggered AI fetchers may ignore robots.txt.
- AI crawler policy by purpose: see `geo-ai-search.md#crawler-policy`.

## Sitemaps

- List only canonical, indexable, 200-status URLs, all absolute on the
  production origin (CRAWL-006), no auth/account/admin paths (CRAWL-007).
- Generate from the same route/data source the site uses, with one origin
  constant. A hand-maintained sitemap drifts.
- `lastmod` only when accurate (CRAWL-019). `priority` and `changefreq` are
  ignored by Google.
- Limits: 50,000 URLs or 50 MB uncompressed per file; use a sitemap index
  beyond that.
- Serve with an XML content type (LIVE-SITEMAP-TYPE catches an HTML fallback).
- Submit in Search Console and Bing Webmaster Tools; IndexNow helps Bing and
  others pick up changes faster (Google does not use IndexNow).

## Status codes

- Missing content returns 404 (or 410), not a 200 page that says "not found"
  (soft 404, CRAWL-013/CRAWL-014, HTML-SOFT404). `seo-scan.mjs fetch` probes
  made-up URLs automatically.
- Framework tools: Next.js `notFound()`, SvelteKit `error(404)`, React Router
  `throw data(..., { status: 404 })`. For client-only SPAs, Google documents
  two options: redirect to a URL that returns 404, or add `noindex` to the
  client-rendered error view.
- Next.js special case: `notFound()` after streaming starts keeps 200 but adds
  `noindex` (acceptable for Google, HTML-SOFT404-NOINDEX).
- Unknown public URLs should not redirect to `/login` or `/`
  (HTML-PROBE-REDIRECT).
- Pages returning non-200 status codes may skip rendering in Google's
  pipeline, so do not rely on JS to change anything on an error page.
- Permanent moves: 301/308 to the final URL, one hop. Update internal links
  and the sitemap to the final URL rather than relying on redirects.

## Rendering

- Primary content, title, description, canonical, robots meta and JSON-LD
  belong in the **initial HTML** (Google JS SEO basics: SSR or prerendering is
  still recommended because not all bots run JavaScript; a canonical set by JS
  must match the raw HTML; a `noindex` in raw HTML may stop rendering
  entirely).
- Use the history API for routing, never `#` fragments (CRAWL-012).
- Lazy-loaded content must load without a scroll or click interaction.

## Links

Google follows `<a>` elements with an `href` only. Navigation through click
handlers on `div`/`span`/`button`, `href="#"` or `javascript:` links leaves the
target undiscovered from that page (CRAWL-011). Framework link components
(`next/link`, SvelteKit `<a>`, React Router `<Link>`) all render real anchors.

Internal linking: every indexable page linked from at least one other page
(no orphans), important pages within about three clicks of the home page,
descriptive anchor text rather than "click here", breadcrumbs on nested
templates.

## HTTPS

HTTPS everywhere with one 301 from `http://` and one host (`www` or apex);
no hard-coded `http://` asset URLs (PERF-003, mixed content). HSTS is good
practice; security headers are not ranking factors beyond HTTPS itself.

## International

Only for multilingual or multi-regional sites:

- `hreflang` alternates on every localised page, **self-referencing and
  reciprocal**, valid codes (`en-GB`, not `en-UK`), plus `x-default` for a
  fallback (META-024). One method per site: HTML `<link>`, HTTP headers, or
  sitemap `<xhtml:link>` (sitemap scales best beyond ~10 locales).
- Each locale page canonicalises to itself; never cross-locale canonicals.
- Locale in the path (`/de/…`), not cookies or `Accept-Language` detection
  (Googlebot sends no `Accept-Language` and crawls mostly from the US).
- Translate the main content, not only the chrome.
- Next.js: `alternates.languages` per page (it does not add the current locale
  automatically). SvelteKit: emit the `<link rel="alternate" hreflang>` tags
  from the Seo component.
