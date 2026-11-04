# Next.js SEO reference

Grounded in the docs shipped inside `next@16.4.5` (`node_modules/next/dist/docs/`)
and in tests run against a real `create-next-app@16.4.5` build (see
`edge-cases.md`). **Always re-read the bundled docs for the installed version
before writing code**: the API moves between majors.

Version checkpoints:

| Version | Change that affects SEO code |
|---|---|
| 13.2+ | App Router Metadata API (`metadata`, `generateMetadata`); `next/head` does nothing in `app/` |
| 15 | `params` / `searchParams` are Promises (`await params`) |
| 15.2+ | Streaming metadata for dynamic routes, `htmlLimitedBots` |
| 16 | `middleware` renamed to `proxy` (`proxy.ts`); `next/image` `priority` deprecated in favour of `preload` (docs suggest `loading="eager"` or `fetchPriority="high"` in most cases); `cacheComponents` (partial prerendering) on in the scaffold |

## Titles

- Root `app/layout.tsx`: `title: { default: 'Brand', template: '%s | Brand' }`
  plus a real `description`. `title.default` is required with a template.
- Each indexable page exports `metadata` (static) or `generateMetadata`
  (data-driven) with its own `title` and `description`.
- `title.template` applies to **child** segments only, not the segment that
  defines it; `title.absolute` ignores parent templates (use it for the home
  page if the brand should not repeat).
- `metadata` and `generateMetadata` are **Server Component only**. Exported
  from a `'use client'` file they are ignored (rule META-020).
- `metadata.keywords` renders a keywords meta tag that Google ignores. Do not
  spend effort on it.
- Memoise the record fetch shared by `generateMetadata` and the page with
  React `cache()` (docs, "Memoizing data requests").

```tsx
// app/blog/[slug]/page.tsx  (Next 15+: params is a Promise)
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPost } from "@/lib/posts"; // wrapped in React cache()

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: { ...sharedOpenGraph, type: "article", title: post.title, publishedTime: post.publishedAt, modifiedTime: post.updatedAt },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  // ...
}
```

## Root layout

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/site"; // one origin constant, TODO(seo) if unknown

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: "TODO(seo): one sentence on what the site offers and for whom.",
  openGraph: sharedOpenGraph, // export const sharedOpenGraph = { siteName, images: ['/og.png'] }
  // no alternates.canonical here: see "Metadata inheritance"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
```

- `<html lang>` must be set here (META-016). For i18n, set it from the locale
  segment in `app/[locale]/layout.tsx`.
- Next adds `charset` and `viewport` automatically; do not duplicate them.

## Metadata inheritance

From the `generateMetadata` docs, "Merging": metadata objects from each segment
are **shallowly** merged, and a child that does not set a field **inherits**
the parent's value. Two bugs follow directly, both confirmed on a real
build:

1. **Canonical in the root layout** (`alternates: { canonical: '/' }`) is
   inherited by every page that does not set its own `alternates`, so those
   pages all declare the home page as canonical (META-010; observed live:
   `/pricing` and `/blog/first-flight` emitted `https://<site>` as canonical).
   Fix: remove it from the root; set `alternates.canonical` per page as a
   relative path (resolved against `metadataBase`).
2. **Page-level `openGraph` replaces the root `openGraph` object**, so a page
   that sets only `openGraph.title` loses the root `images` (META-014; observed
   live: `/pricing` had no `og:image`). Fix: spread a shared object
   (`openGraph: { ...sharedOpenGraph, title }`) or use `opengraph-image.*`
   file conventions, which apply per segment.

Also inherited: `robots`. A root `robots: { index: false }` noindexes the whole
site (CRAWL-008); gate it on the deployment environment instead.

- `metadataBase`: set once in the root layout. Without it, relative URL fields
  fail the build (docs). Use an env-driven constant, not `VERCEL_URL`
  preview hosts, for canonicals.
- With `'use cache'` on `generateMetadata`, return `metadataBase` as a string
  (URL objects are not serialisable, per docs).

## Robots and sitemap files

`app/robots.ts` and `app/sitemap.ts` (or `.js`) are route handlers cached by
default. Keep them pure functions of config and data.

```ts
// app/robots.ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const isProd = process.env.VERCEL_ENV === "production"; // or your own deploy flag
  if (!isProd) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/account/"] },
      // Only if the owner decided to opt out of model training:
      // { userAgent: ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"], disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
```

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getAllPosts } from "@/lib/posts";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts();
  return [
    { url: `${SITE_URL}/` },
    { url: `${SITE_URL}/pricing` },
    ...posts.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
```

- `lastModified: new Date()` on every entry is noise (CRAWL-019); use the real
  update time or omit it.
- Large sites: `generateSitemaps()` for a sitemap index (docs).
- Do not block `/_next/` in robots: Google needs JS/CSS to render (CRAWL-004).

## JSON-LD

Docs (`01-app/02-guides/json-ld.md`): render a native `<script
type="application/ld+json">` in the page or layout (not `next/script`), and
escape `<` because `JSON.stringify` does not sanitise:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
/>
```

Observed on a real build: an Organization `name` containing `</script>`
serialised without the escape terminated the script tag, the JSON-LD stopped
parsing and the remainder became live HTML (SD-002 / HTML-JSONLD-INVALID).
`schema-dts` gives types. Put builders in one module (`lib/jsonld.ts`).

## Rendering

- Primary content must be in the server HTML. A `'use client'` page that
  fetches in `useEffect` ships an empty list or spinner to crawlers
  (CRAWL-010; observed live: `/features` had 1 word of text). Fetch in an async
  Server Component and pass data to a client child for interactivity.
- `output: 'export'` produces static HTML; dynamic routes then need
  `generateStaticParams`.

## Streaming metadata and AI crawlers

What the docs say: for dynamically rendered pages, Next.js streams metadata
after the initial UI; bots in `htmlLimitedBots` get blocking metadata in
`<head>`; prerendered pages never stream metadata. The default list
(`next/dist/shared/lib/router/utils/html-bots.js`, 16.4.5) covers Bingbot,
Google's non-rendering crawlers (`*-Google`, `Google-*`), social unfurlers and
a few others. It does **not** include `Googlebot` (which renders JS) or any AI
crawler.

Tested on next@16.4.5, `cacheComponents: true`, `next start`, a
`generateMetadata` route that awaits request-time data inside `<Suspense>`:

| Setup | GPTBot / Claude-SearchBot / PerplexityBot | Googlebot | Bingbot |
|---|---|---|---|
| Default config | `<title>`, description and canonical streamed into `<body>` (~12 KB after `</head>`) | in `<body>` (renders JS, so fine for Google) | in `<head>` |
| `htmlLimitedBots` = default pattern + AI tokens | in `<head>` | in `<body>` | in `<head>` |
| Route prerendered (`generateStaticParams` + `'use cache'`) | in `<head>` | in `<head>` | in `<head>` |

Whether a given AI fetcher reads `<title>` from the body is undocumented;
treat streamed metadata as a medium-severity GEO risk on routes you want
cited, and fix it one of two ways:

1. **Preferred:** prerender the route (`generateStaticParams`, cached data).
   This also improves TTFB and works for every client.
2. Extend `htmlLimitedBots`. Setting it **replaces** the default list, so
   include the default pattern:

```ts
// next.config.ts
const AI_BOTS = "GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-SearchBot|Claude-User|PerplexityBot|Perplexity-User";
// Copy the default from node_modules/next/dist/shared/lib/router/utils/html-bots.js for your version:
const NEXT_DEFAULT = "[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight";
const nextConfig = { htmlLimitedBots: new RegExp(`${NEXT_DEFAULT}|${AI_BOTS}`, "i") };
export default nextConfig;
```

Verify after deploying with `seo-scan.mjs fetch --compare-ua`. Bots on the list
get a blocking render, which costs them TTFB, so do not add browsers.

## Not found

- Dynamic routes must call `notFound()` when the record is missing (CRAWL-014;
  observed live: `/blog/<made-up>` returned 200 with an empty template).
- Docs (`not-found.md`): if `notFound()` runs **after streaming has started**
  (inside `<Suspense>`), the response keeps status 200 and Next injects
  `<meta name="robots" content="noindex">`. Observed live: Googlebot got 200 +
  noindex, Bingbot (HTML-limited) got 404. Google honours the noindex; resolve
  the record before streaming (outside `<Suspense>`, or prerender known params)
  if a real 404 matters.
- Add `app/not-found.tsx` with navigation (CRAWL-015).

## Proxy and middleware

`proxy.ts` (16+; `middleware.ts` before) runs for metadata routes too. An auth
redirect on a broad matcher sends `/robots.txt` and `/sitemap.xml` to the login
page (CRAWL-016; observed live: both returned 307 to `/login`), and redirects
every unknown URL to login instead of 404 (HTML-PROBE-REDIRECT). Exclude them:

```ts
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|llms.txt|opengraph-image|twitter-image).*)"],
};
```

Better still, match only the private sections (`["/dashboard/:path*", "/account/:path*"]`).

## Images

- Use `next/image` for content images (IMG-003); it requires `alt` and sizes,
  lazy-loads by default.
- Mark the LCP image eagerly: Next 16 deprecated `priority`; the docs suggest
  `loading="eager"` or `fetchPriority="high"` in most cases, or `preload`
  (META-025). Note: the create-next-app 16.4.5 scaffold itself still uses
  `priority`.
- Use `opengraph-image.(png|tsx)` files for share images (absolute URLs are
  generated for you).

## Pages Router

- `next/head` in each page or, better, one `<Seo title description canonical />`
  component used everywhere; `<Html lang>` in `pages/_document`.
- Dynamic pages: return `{ notFound: true }` from `getStaticProps` /
  `getServerSideProps` for missing records.
- Sitemap: `next-sitemap` or a `pages/sitemap.xml.ts` route with
  `getServerSideProps` writing XML.
