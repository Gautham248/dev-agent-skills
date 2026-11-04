# React (Vite SPA and React Router) SEO reference

Grounded in react.dev (`title`, `meta` component references, fetched
2026-11-04), the docs shipped in `react-router@8.5.1`
(`node_modules/react-router/docs/`), and a real `create-vite@9.3.3`
react-ts app built and served with `vite preview`.

## The core limitation

A default Vite (or Create React App) SPA serves the same `index.html` with an
empty `<div id="root"></div>` for every URL. Observed live: all routes returned
0 words of text and the scaffold title; a made-up URL returned 200
(HTML-SHELL, HTML-SOFT404). Google renders JavaScript later from a queue and
recommends server-side rendering or prerendering because "not all bots run
JavaScript" (Google JS SEO basics, updated 2026-03-04). Most AI fetchers,
social unfurlers and link previewers read only the initial HTML.

So for any page that should rank or be cited, the real fix is **content in the
initial HTML**: prerender or server-render. Metadata libraries alone do not
make a client-only SPA crawlable.

## CSR and prerendering

Options, from least to most change:

| Option | When it fits | Notes |
|---|---|---|
| Prerender at build (React Router framework `prerender`, `vite-react-ssg`, a prerender plugin) | marketing pages, docs, blogs with known URLs | static HTML per route; dynamic routes need their paths listed |
| React Router framework mode with `ssr: true` | data-driven public pages | loaders run on the server; real status codes via `data(…, { status: 404 })` |
| Move public pages to Next.js or SvelteKit | large content sites | keep the authenticated app as an SPA if needed |
| Stay CSR | authenticated dashboards only | add `noindex`, keep them out of the sitemap |

Keep `CRAWL-009` critical until Step 4 shows real content in the HTML.

## React 19 metadata elements

React 19 hoists `<title>`, `<meta>` and `<link>` rendered anywhere in the tree
into `<head>` (react.dev). Rules from the docs:

- Render **one** `<title>` at a time. Two at once gives undefined behaviour for
  browsers and search engines.
- `<title>` children must be **a single string**. `<title>Results {n}</title>`
  is two children and errors; use `<title>{`Results ${n}`}</title>` (META-021).
- `<meta itemProp>` and `<title>` inside `<svg>` are not hoisted.

```tsx
// src/components/Seo.tsx  (one place for head tags)
import { SITE_URL, SITE_NAME } from "../site"; // TODO(seo): real origin

export function Seo({ title, description, path }: { title: string; description: string; path: string }) {
  const url = new URL(path, SITE_URL).href;
  return (
    <>
      <title>{`${title} | ${SITE_NAME}`}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:url" content={url} />
    </>
  );
}
```

In a CSR-only SPA these tags appear only after JS runs, so they only help
crawlers that render (Googlebot). Combine with prerendering.

- **react-helmet-async**: use it for React 16-18, or when you need its API or
  SSR context handling; wrap the app in `HelmetProvider`.
- **react-helmet** (non-async) is unmaintained; replace it (META-018).
- `document.title = …` only exists after JS runs (META-023).

## Index html

`index.html` is the fallback head for every route in a SPA:

- Replace the scaffold title. create-vite@9 sets it to the **package name**
  (`<title>vite-react</title>`), CRA to "React App" (META-002).
- Add a site-level `<meta name="description">` and keep `lang` and viewport.
- **Do not hard-code a canonical** in `index.html` (META-011): every route
  would declare the same canonical, and Google expects a JS-changed canonical
  to match the raw one.
- No `noindex` here unless the whole app is private.

Static `public/robots.txt` and `public/sitemap.xml` are served as files; when
they are missing, the SPA fallback answers `/robots.txt` with `index.html`
(observed live: `text/html`, LIVE-ROBOTS-HTML; sitemap likewise,
LIVE-SITEMAP-TYPE).

## Soft 404s

Hosts configured with "rewrite everything to `/index.html`" (vercel.json
rewrites, Netlify `/* /index.html 200`, Firebase/Azure navigation fallback)
answer every unknown URL with 200 (CRAWL-013). Google's documented SPA fixes:
redirect to a URL the server answers with 404, or render
`<meta name="robots" content="noindex">` in the client-side NotFound view:

```tsx
function NotFound() {
  return (<><meta name="robots" content="noindex" /><title>Page not found</title><h1>Page not found</h1></>);
}
```

Prerendered builds can instead list known routes and let the host 404 the rest.

## Links

Use `<Link to>` / `<a href>` for navigation. Click handlers on `div`/`span`
(`onClick={() => navigate('/x')}`) are invisible to crawlers (CRAWL-011;
reproduced in the test app). Never use `HashRouter`/`createHashRouter` for
public pages (CRAWL-012): Google does not index fragment URLs separately.

## React Router framework

From the shipped docs (`how-to/meta.md`, `start/framework/route-module.md`,
`how-to/pre-rendering.md`, `how-to/spa.md`, `how-to/status.md`):

- Since React 19, React Router recommends the built-in `<title>`/`<meta>`
  elements over the route module `meta` export.
- If routes use `export function meta()`, `app/root` must render `<Meta />` in
  `<head>` or the tags never appear (META-019). The **last matching route's**
  meta replaces (does not merge with) parent meta.
- `meta` can emit JSON-LD (`{ "script:ld+json": {...} }`) and canonicals
  (`{ tagName: "link", rel: "canonical", href }`).
- `prerender: true` in `react-router.config.ts` prerenders static paths only;
  list dynamic paths explicitly (or via the async `prerender({ getStaticPaths })`
  form). Output goes to `build/client/<path>/index.html`.
- `ssr: false` is SPA mode: only the root route is prerendered into
  `index.html` (CRAWL-009 unless other paths are prerendered).
- Missing records: `throw data("Not Found", { status: 404 })` from the loader.
- Set `<html lang>` in `app/root` (META-016).
