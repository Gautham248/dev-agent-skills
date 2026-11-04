# SvelteKit SEO reference

Grounded in svelte.dev docs (`seo`, `page-options`, `adapter-static`,
`migrating-to-sveltekit-3`, fetched 2026-11-04) and a real `sv create`
(SvelteKit 3.1.1, Svelte 5.57) app built and served with `vite preview`.

SvelteKit adds **no** title, description or canonical by default. Everything
SEO-relevant in `<head>` comes from `<svelte:head>` blocks you write.

## SvelteKit 3 vs 2 (check `variant` from detect)

| Topic | 2.x | 3.x |
|---|---|---|
| Config | `svelte.config.js` (`kit: {...}`) | options passed to `sveltekit({...})` in `vite.config.*`; `svelte.config.js` no longer read |
| Page state | `$app/stores` (`$page.url`) | `$app/state` (`page.url`, no `$`); `page.url` is readonly |
| Lib alias | `$lib` | `#lib` (package.json `imports`) |
| Environment | `$app/environment` | `$app/env` |
| Public origin | `prerender.origin`, adapter-node `ORIGIN` env | `paths.origin` |
| External redirects | `redirect(303, 'https://…')` | needs `{ external: true }` |
| Error helper | `error(404, message)` | second argument must be a string |

Write code for the installed major; do not mix `$app/stores` into a v3 app.

## App html

`src/app.html` is the document shell:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

- Keep `lang` (META-016) and viewport (META-017). For multiple locales, set
  `lang` per request in `handle` with `transformPageChunk` replacing a
  `%lang%` placeholder.
- Never hard-code `noindex` here (CRAWL-008): it applies to every page.

## Titles

Two maintainable patterns. Pick one and use it everywhere.

**A. One `Seo` component, rendered by each page** (explicit, easy to audit):

```svelte
<!-- src/lib/Seo.svelte (SvelteKit 3; use $lib and $app/stores + $page in 2.x) -->
<script lang="ts">
  import { page } from '$app/state';
  import { SITE_URL, SITE_NAME } from '#lib/site'; // TODO(seo): real origin

  let { title, description, image = '/og.png', type = 'website', noindex = false }:
    { title: string; description: string; image?: string; type?: string; noindex?: boolean } = $props();

  const canonical = $derived(new URL(page.url.pathname, SITE_URL).href);
  const fullTitle = $derived(page.url.pathname === '/' ? title : `${title} | ${SITE_NAME}`);
</script>

<svelte:head>
  <title>{fullTitle}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  {#if noindex}<meta name="robots" content="noindex" />{/if}
  <meta property="og:type" content={type} />
  <meta property="og:title" content={fullTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={new URL(image, SITE_URL).href} />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>
```

```svelte
<!-- src/routes/pricing/+page.svelte -->
<script lang="ts">
  import Seo from '#lib/Seo.svelte';
</script>

<Seo title="Pricing" description="TODO(seo): what the plans include and who they suit." />
```

**B. Data-driven head in the root layout** (the SEO docs' suggested pattern):
each `load` returns `seo: { title, description }` and `src/routes/+layout.svelte`
renders `<svelte:head>` from `page.data.seo`. Every route's `load` must then
provide it, or it silently inherits the previous/default values.

The scanner treats a page as covered when its own `<svelte:head>` has a title,
when it renders an imported component with `<svelte:head>` and passes `title`,
or when a layout head reads `page.data` and the route's load returns `title`.

## Canonical

Build canonicals from a **configured origin + `page.url.pathname`**, never
`page.url.href` (META-012). `page.url` comes from the request: behind a reverse
proxy it can be `http://` or an internal host, and when served locally it is
`localhost`. Observed live: a component using `page.url.href` emitted
`http://localhost:4175/about` under `vite preview` (HTML-CANON-BAD). Set
`paths.origin` (3.x) or `prerender.origin` / adapter-node `ORIGIN` (2.x) so
prerendering and SSR know the public origin as well.

Drop query strings from canonicals unless they change the content.

## Rendering

Page options (`+page.ts`, `+page.server.ts`, `+layout.ts`, `+layout.server.ts`):

| Option | SEO effect |
|---|---|
| `ssr = false` | the route is an empty shell; in the root layout the whole app becomes an SPA (CRAWL-009 critical) |
| `csr = false` | no JS shipped, HTML only: fine for SEO |
| `prerender = true` | static HTML at build (best for marketing/docs/blog pages); dynamic routes need `entries()` or links from prerendered pages |
| `prerender = 'auto'` | prerendered and kept in the SSR manifest |

- Fetch page content in `load` (`+page.ts` / `+page.server.ts`), not `onMount`
  (CRAWL-010; observed live: `/pricing` loading plans in `onMount` served 1
  word of text).
- **adapter-static with `fallback`** is SPA mode; the adapter docs warn of
  large negative SEO and performance impact. Prerender every public page
  (`export const prerender = true` in the root `+layout.ts` plus `entries()`)
  and keep the fallback only for app-only routes.
- Browser-only code goes in `onMount` or `+page.svelte`, not module scope of
  universal `load` files (page options that are not literals make SvelteKit
  import the module on the server).

## URLs

- `trailingSlash` defaults to `'never'` (`/about/` redirects to `/about`). Keep
  canonicals and sitemap entries in the same form. `'ignore'` makes `/x` and
  `/x/` separate URLs (CRAWL-017).
- With adapter-static, match `trailingSlash` to how the host serves files
  (`'always'` writes `about/index.html`).

## Errors

- Dynamic routes: throw `error(404, 'Not found')` from `load` when the record
  is missing (CRAWL-014; observed live: `/blog/<made-up>` returned 200).
- Add `src/routes/+error.svelte` with navigation (CRAWL-015). Status codes stay
  correct.

## Sitemap and robots

```ts
// src/routes/sitemap.xml/+server.ts
import { SITE_URL } from '#lib/site';
import { getAllPosts } from '#lib/server/posts';

export const prerender = true; // if the content is known at build time

export async function GET() {
  const posts = await getAllPosts();
  const urls = ['/', '/pricing', '/about', ...posts.map((p) => `/blog/${p.slug}`)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${new URL(u, SITE_URL).href}</loc></url>`).join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'content-type': 'application/xml' } });
}
```

- `static/robots.txt` is the simplest robots source; the `sv create` scaffold
  ships an allow-all one without a `Sitemap:` line (CRAWL-003).
- For environment-specific robots, use `src/routes/robots.txt/+server.ts`.

## Hooks

`src/hooks.server.ts` `handle` runs for every request, including
`/robots.txt` and `/sitemap.xml`. Auth redirects must skip them and public
routes (CRAWL-016). Verify with `seo-scan.mjs fetch` (LIVE-REDIRECT).

## JSON-LD

Render inside `<svelte:head>` with `{@html}` and escape `<`:

```svelte
<svelte:head>
  {@html `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`}
</svelte:head>
```

Build the objects in one module (`#lib/jsonld.ts`).
