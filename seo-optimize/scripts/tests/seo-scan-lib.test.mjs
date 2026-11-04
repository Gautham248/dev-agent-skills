// seo-optimize/scripts/tests/seo-scan-lib.test.mjs
//
// Each fixture is a small but realistic project written to a temp dir: the
// files a scaffolder produces plus one seeded SEO defect at a time, so every
// rule is tested for both "fires on the defect" and "stays quiet on the fix".
// Real scaffolded apps (create-next-app, create-vite, sv create) were also
// scanned end to end during development; see references/edge-cases.md.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";

import {
  stripJsComments, findTags, parseAttrs, topLevelKeys, valueOfKey, majorOf,
  parseRobotsTxt, robotsFromCode, loadProject, detectStack, nextAppRoutes,
  svelteKitRoutes, reactRoutes, scanProject, analyzeHtml, htmlFindings,
  fetchPages, summarize, toMarkdown, findWorkspaceApps,
} from "../seo-scan-lib.mjs";

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seo-scan-test-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, typeof content === "string" ? content : JSON.stringify(content, null, 2));
  }
  return dir;
}
const ids = (r) => r.findings.map((f) => f.id);
const find = (r, id) => r.findings.filter((f) => f.id === id);

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

test("stripJsComments removes comments but keeps strings, URLs and JSX apostrophes", () => {
  const src = `const u = "https://x.com"; // trailing\n/* block\n noindex */ const t = <p>Don't stop</p>; // c\nconst k = 'a//b';`;
  const out = stripJsComments(src);
  assert.match(out, /https:\/\/x\.com/);
  assert.doesNotMatch(out, /noindex/);
  assert.doesNotMatch(out, /trailing/);
  assert.match(out, /Don't stop/);
  assert.match(out, /'a\/\/b'/);
  assert.equal(out.split("\n").length, src.split("\n").length);
});

test("findTags tolerates arrow functions inside JSX attributes", () => {
  const src = `<div onClick={() => a > b && router.push('/x')} className="c">hi</div><img src="/a.png" alt="" />`;
  const tags = findTags(src, ["div", "img"]);
  assert.equal(tags.length, 2);
  const a = parseAttrs(tags[0].attrs);
  assert.match(a.onClick.expr, /router\.push/);
  assert.equal(parseAttrs(tags[1].attrs).alt.value, "");
});

test("parseAttrs records spreads and svelte shorthand", () => {
  assert.equal(parseAttrs(` {...props} src="x"`).__spread, true);
  assert.equal(parseAttrs(` {alt} src={src}`).alt.expr, "alt");
});

test("topLevelKeys / valueOfKey only see top-level keys", () => {
  const obj = `{ title: { default: 'Acme', template: '%s | Acme' }, openGraph: { title: 'x', images: ['/og.png'] }, description: "Hi, there" }`;
  const keys = topLevelKeys(obj);
  assert.deepEqual([...keys.keys()].sort(), ["description", "openGraph", "title"]);
  assert.equal(valueOfKey(obj, "description").text, '"Hi, there"');
  assert.ok(valueOfKey(valueOfKey(obj, "openGraph").text, "images"));
});

test("majorOf handles ranges and exact versions", () => {
  assert.equal(majorOf("^16.4.5"), 16);
  assert.equal(majorOf("~3.1.0"), 3);
  assert.equal(majorOf("workspace:*"), null);
});

test("parseRobotsTxt groups consecutive user-agents and collects sitemaps", () => {
  const r = parseRobotsTxt("User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /\nDisallow: /admin\nSitemap: https://a.com/sitemap.xml\nCrawl-delay: 5");
  assert.equal(r.groups.length, 2);
  assert.deepEqual(r.groups[0].agents, ["GPTBot", "ClaudeBot"]);
  assert.deepEqual(r.sitemaps, ["https://a.com/sitemap.xml"]);
  assert.equal(r.other[0].key, "crawl-delay");
});

test("robotsFromCode reads literal rules from app/robots.ts", () => {
  const r = robotsFromCode(`export default function robots() { return { rules: [{ userAgent: '*', allow: '/', disallow: ['/_next/', '/admin'] }, { userAgent: ['OAI-SearchBot'], disallow: '/' }], sitemap: 'https://a.com/sitemap.xml' } }`);
  assert.equal(r.groups.length, 2);
  assert.deepEqual(r.groups[0].rules.map((x) => x.path), ["/", "/_next/", "/admin"]);
  assert.deepEqual(r.groups[1].agents, ["OAI-SearchBot"]);
});

// ---------------------------------------------------------------------------
// Detection and routes
// ---------------------------------------------------------------------------

const NEXT_BASE = {
  "package.json": { name: "n", dependencies: { next: "16.4.5", react: "19.3.1", "react-dom": "19.3.1" } },
  "tsconfig.json": "{}",
  "next.config.ts": "export default {}",
};

test("detectStack: Next App Router, routes skip groups/private/slots", () => {
  const dir = project({
    ...NEXT_BASE,
    "app/layout.tsx": "export default function L({children}){return <html lang='en'><body>{children}</body></html>}",
    "app/page.tsx": "export default function P(){return <h1>Hi</h1>}",
    "app/(marketing)/pricing/page.tsx": "export default function P(){return null}",
    "app/_components/x/page.tsx": "x",
    "app/@modal/login/page.tsx": "x",
    "app/blog/[slug]/page.tsx": "x",
    "app/dashboard/page.tsx": "x",
  });
  const p = loadProject(dir);
  const st = detectStack(p);
  assert.equal(st.framework, "nextjs");
  assert.equal(st.variant, "app-router");
  assert.equal(st.language, "ts");
  const routes = nextAppRoutes(p, "app").map((r) => r.route).sort();
  assert.deepEqual(routes, ["/", "/blog/[slug]", "/dashboard", "/pricing"]);
  assert.equal(nextAppRoutes(p, "app").find((r) => r.route === "/dashboard").private, true);
});

test("detectStack: SvelteKit 3 with config in vite.config, routes strip groups", () => {
  const dir = project({
    "package.json": { devDependencies: { "@sveltejs/kit": "^3.1.1", svelte: "^5.57.3", vite: "^8.3.5" } },
    "vite.config.ts": "import { sveltekit } from '@sveltejs/kit/vite'; export default { plugins: [sveltekit()] }",
    "src/app.html": '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1" />%sveltekit.head%</head><body>%sveltekit.body%</body></html>',
    "src/routes/+page.svelte": "<h1>x</h1>",
    "src/routes/(app)/about/+page.svelte": "x",
    "src/routes/blog/[slug]/+page.svelte": "x",
  });
  const p = loadProject(dir);
  const st = detectStack(p);
  assert.equal(st.framework, "sveltekit");
  assert.equal(st.variant, "sveltekit-3");
  assert.equal(st.rendering.mode, "server-rendered");
  assert.deepEqual(svelteKitRoutes(p).map((r) => r.route).sort(), ["/", "/about", "/blog/[slug]"]);
});

test("detectStack: Vite React SPA is csr-only unless a prerender tool is present", () => {
  const base = {
    "package.json": { dependencies: { react: "^19.3.1", "react-dom": "^19.3.1", "react-router": "^8.5.1" }, devDependencies: { vite: "^8.3.5" } },
    "index.html": '<!doctype html><html lang="en"><head><title>Acme</title></head><body><div id="root"></div></body></html>',
    "src/main.tsx": "import { createBrowserRouter } from 'react-router'; const r = createBrowserRouter([{ path: '/', element: null }, { path: '/about', element: null }, { path: 'blog/:slug', element: null }, { path: '*', element: null }]);",
  };
  const p1 = loadProject(project(base));
  const st1 = detectStack(p1);
  assert.equal(st1.framework, "react-spa");
  assert.equal(st1.rendering.mode, "csr-only");
  assert.deepEqual(reactRoutes(p1).map((r) => r.route).sort(), ["/", "/about", "/blog/:slug"]);
  const p2 = loadProject(project({ ...base, "package.json": { dependencies: { react: "^19", "react-dom": "^19" }, devDependencies: { vite: "^8", "vite-react-ssg": "^1" } } }));
  assert.equal(detectStack(p2).rendering.mode, "prerendered");
});

test("findWorkspaceApps lists app packages in a monorepo", () => {
  const dir = project({
    "package.json": { name: "root", private: true },
    "apps/web/package.json": { name: "web", dependencies: { next: "16" } },
    "apps/site/package.json": { name: "site", devDependencies: { "@sveltejs/kit": "3" } },
    "packages/ui/package.json": { name: "ui", dependencies: { react: "19" } },
  });
  const apps = findWorkspaceApps(dir).map((a) => `${a.dir}:${a.kind}`).sort();
  assert.deepEqual(apps, ["apps/site:sveltekit", "apps/web:nextjs"]);
});

// ---------------------------------------------------------------------------
// Next.js rules
// ---------------------------------------------------------------------------

test("Next: scaffold metadata, inherited root canonical, missing robots/sitemap", () => {
  const dir = project({
    ...NEXT_BASE,
    "app/layout.tsx": `import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
  alternates: { canonical: "/" },
};
export default function RootLayout({ children }) { return <html lang="en"><body>{children}</body></html>; }`,
    "app/page.tsx": "export default function Page(){ return <main><h1>Home</h1></main> }",
    "app/pricing/page.tsx": "export default function Page(){ return <main><h1>Pricing</h1></main> }",
    "app/about/page.tsx": "export const metadata = { title: 'About' };\nexport default function Page(){ return null }",
  });
  const r = scanProject(dir);
  assert.ok(find(r, "META-002").length >= 2, "scaffold title + description");
  const canon = find(r, "META-010")[0];
  assert.equal(canon.severity, "high");
  assert.match(canon.message, /\/pricing/);
  assert.match(canon.message, /\/about/);
  assert.ok(ids(r).includes("CRAWL-001"));
  assert.ok(ids(r).includes("CRAWL-005"));
  assert.ok(ids(r).includes("META-003"), "routes without own title");
  assert.ok(ids(r).includes("META-015"), "metadataBase missing");
});

test("Next: per-page canonical + metadataBase + robots/sitemap files keep it quiet", () => {
  const dir = project({
    ...NEXT_BASE,
    "app/layout.tsx": `export const metadata = { metadataBase: new URL("https://acme.com"), title: { default: "Acme", template: "%s | Acme" }, description: "Acme builds rockets for small teams." };
export default function RootLayout({ children }) { return <html lang="en"><body>{children}</body></html>; }`,
    "app/page.tsx": "export const metadata = { title: 'Home', description: 'Home page of Acme.', alternates: { canonical: '/' } };\nexport default function Page(){ return <h1>Home</h1> }",
    "app/pricing/page.tsx": "export const metadata = { title: 'Pricing', description: 'Plans.', alternates: { canonical: '/pricing' } };\nexport default function Page(){ return <h1>Pricing</h1> }",
    "app/robots.ts": "export default function robots(){ return { rules: { userAgent: '*', allow: '/' }, sitemap: 'https://acme.com/sitemap.xml' } }",
    "app/sitemap.ts": "export default function sitemap(){ return [{ url: 'https://acme.com/' }, { url: 'https://acme.com/pricing' }] }",
    "app/not-found.tsx": "export default function NF(){ return <h1>Not found</h1> }",
  });
  const r = scanProject(dir);
  for (const id of ["META-010", "META-002", "META-003", "META-015", "CRAWL-001", "CRAWL-005", "CRAWL-002", "META-009", "META-004"]) {
    assert.ok(!ids(r).includes(id), `${id} should not fire: ${JSON.stringify(find(r, id))}`);
  }
});

test("Next: robots.ts disallow-all is critical, env-gated is info", () => {
  const files = { ...NEXT_BASE, "app/layout.tsx": "export default function L({children}){return <html lang='en'>{children}</html>}", "app/page.tsx": "x" };
  const hard = scanProject(project({ ...files, "app/robots.ts": "export default function robots(){ return { rules: { userAgent: '*', disallow: '/' } } }" }));
  assert.equal(find(hard, "CRAWL-002")[0].severity, "critical");
  const gated = scanProject(project({ ...files, "app/robots.ts": "export default function robots(){ if (process.env.VERCEL_ENV !== 'production') return { rules: { userAgent: '*', disallow: '/' } }; return { rules: { userAgent: '*', allow: '/' } } }" }));
  assert.equal(find(gated, "CRAWL-002")[0].severity, "info");
});

test("Next: client-component metadata, next/head in app, client fetch, missing notFound", () => {
  const dir = project({
    ...NEXT_BASE,
    "app/layout.tsx": "export const metadata = { title: { default: 'A', template: '%s | A' } };\nexport default function L({children}){return <html lang='en'>{children}</html>}",
    "app/page.tsx": `"use client";
import { useEffect, useState } from "react";
export const metadata = { title: "Home" };
export default function Page(){ const [d,setD]=useState(null); useEffect(()=>{ fetch('/api/x').then(r=>r.json()).then(setD) },[]); return <div>{d}</div> }`,
    "app/old/page.tsx": "import Head from 'next/head';\nexport default function P(){ return <Head><title>Old</title></Head> }",
    "app/blog/[slug]/page.tsx": "export default async function P({ params }){ const { slug } = await params; const post = await getPost(slug); return <h1>{post?.title}</h1> }",
  });
  const r = scanProject(dir);
  assert.ok(ids(r).includes("META-020"));
  assert.ok(ids(r).includes("META-019"));
  assert.ok(ids(r).includes("CRAWL-010"));
  assert.ok(ids(r).includes("CRAWL-014"));
});

test("Next: openGraph shallow-merge drops images; GEO-003 for dynamic generateMetadata", () => {
  const dir = project({
    ...NEXT_BASE,
    "app/layout.tsx": "export const metadata = { metadataBase: new URL('https://a.com'), title: { default: 'A', template: '%s | A' }, openGraph: { images: ['/og.png'] } };\nexport default function L({children}){return <html lang='en'>{children}</html>}",
    "app/page.tsx": "export const metadata = { title: 'Home', openGraph: { title: 'Home' } };\nexport default function P(){return null}",
    "app/blog/[slug]/page.tsx": "import { notFound } from 'next/navigation';\nexport async function generateMetadata({ params }) { const { slug } = await params; const p = await getPost(slug); return { title: p.title, description: p.excerpt }; }\nexport default async function P({ params }){ const p = await getPost((await params).slug); if (!p) notFound(); return <h1>{p.title}</h1> }",
  });
  const r = scanProject(dir);
  assert.ok(find(r, "META-014").some((f) => /shallow/.test(f.message)));
  assert.ok(ids(r).includes("GEO-003"));
  assert.ok(!ids(r).includes("CRAWL-014"), "notFound() present");
  const withBots = scanProject(project({ ...NEXT_BASE, "next.config.ts": "export default { htmlLimitedBots: /GPTBot/ }", "app/layout.tsx": "export default function L({children}){return <html lang='en'>{children}</html>}", "app/blog/[slug]/page.tsx": "export async function generateMetadata(){ return { title: 'x' } }\nexport default function P(){return null}" }));
  assert.ok(!ids(withBots).includes("GEO-003"));
});

test("Next: proxy matcher that does not exclude robots/sitemap", () => {
  const dir = project({
    ...NEXT_BASE,
    "app/layout.tsx": "export default function L({children}){return <html lang='en'>{children}</html>}",
    "app/page.tsx": "x",
    "proxy.ts": "import { NextResponse } from 'next/server';\nexport function proxy(req){ if(!req.cookies.get('s')) return NextResponse.redirect(new URL('/login', req.url)) }\nexport const config = { matcher: ['/(.*)'] }",
  });
  assert.ok(ids(scanProject(dir)).includes("CRAWL-016"));
  const ok = project({
    ...NEXT_BASE,
    "app/layout.tsx": "export default function L({children}){return <html lang='en'>{children}</html>}",
    "app/page.tsx": "x",
    "proxy.ts": "import { NextResponse } from 'next/server';\nexport function proxy(req){ return NextResponse.redirect(new URL('/login', req.url)) }\nexport const config = { matcher: ['/((?!_next/static|robots.txt|sitemap.xml).*)'] }",
  });
  assert.ok(!ids(scanProject(ok)).includes("CRAWL-016"));
});

test("robots: AI search bot blocked is high, training bots are info, asset block is high", () => {
  const dir = project({
    ...NEXT_BASE,
    "app/layout.tsx": "export default function L({children}){return <html lang='en'>{children}</html>}",
    "app/page.tsx": "x",
    "public/robots.txt": "User-agent: GPTBot\nDisallow: /\n\nUser-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: *\nDisallow: /_next/\nAllow: /\n",
  });
  const r = scanProject(dir);
  assert.equal(find(r, "GEO-001")[0].severity, "high");
  assert.match(find(r, "GEO-001")[0].message, /OAI-SearchBot/);
  assert.equal(find(r, "GEO-002")[0].severity, "info");
  assert.ok(ids(r).includes("CRAWL-004"));
  assert.ok(ids(r).includes("CRAWL-003"));
});

// ---------------------------------------------------------------------------
// SvelteKit rules
// ---------------------------------------------------------------------------

const SK_BASE = {
  "package.json": { devDependencies: { "@sveltejs/kit": "^3.1.1", svelte: "^5.57.3", vite: "^8.3.5" } },
  "vite.config.ts": "import { sveltekit } from '@sveltejs/kit/vite'; export default { plugins: [sveltekit()] }",
  "src/app.html": '<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />%sveltekit.head%</head><body>%sveltekit.body%</body></html>',
};

test("SvelteKit: no svelte:head anywhere, root ssr=false, onMount fetch, dynamic load without 404", () => {
  const dir = project({
    ...SK_BASE,
    "src/routes/+layout.ts": "export const ssr = false;",
    "src/routes/+page.svelte": "<h1>Home</h1>",
    "src/routes/about/+page.svelte": "<script>import { onMount } from 'svelte'; let d; onMount(async () => { d = await fetch('/api').then(r => r.json()) });</script><p>{d}</p>",
    "src/routes/blog/[slug]/+page.svelte": "<script>let { data } = $props();</script><h1>{data.title}</h1>",
    "src/routes/blog/[slug]/+page.server.ts": "export async function load({ params }) { const post = await db.get(params.slug); return { post }; }",
  });
  const r = scanProject(dir);
  assert.equal(find(r, "CRAWL-009")[0].severity, "critical");
  assert.ok(ids(r).includes("META-001"));
  assert.ok(ids(r).includes("CRAWL-010"));
  assert.ok(ids(r).includes("CRAWL-014"));
  assert.ok(ids(r).includes("CRAWL-015"));
});

test("SvelteKit: Seo component imported via #lib covers routes; page.url canonical flagged", () => {
  const dir = project({
    ...SK_BASE,
    "src/lib/Seo.svelte": `<script lang="ts">import { page } from '$app/state'; let { title, description } = $props();</script>
<svelte:head><title>{title} | Acme</title><meta name="description" content={description} /><link rel="canonical" href={page.url.href} /></svelte:head>`,
    "src/routes/+page.svelte": "<script>import Seo from '#lib/Seo.svelte';</script><Seo title=\"Home\" description=\"Acme home\" /><h1>Home</h1>",
    "src/routes/about/+page.svelte": "<script>import Seo from '#lib/Seo.svelte';</script><Seo title=\"About\" description=\"About Acme\" /><h1>About</h1>",
    "src/routes/+error.svelte": "<h1>Error</h1>",
    "static/robots.txt": "User-agent: *\nAllow: /\nSitemap: https://acme.com/sitemap.xml\n",
    "src/routes/sitemap.xml/+server.ts": "export function GET(){ return new Response(`<urlset><url><loc>https://acme.com/</loc></url></urlset>`, { headers: { 'content-type': 'application/xml' } }) }",
  });
  const r = scanProject(dir);
  for (const id of ["META-001", "META-003", "META-005", "META-009", "CRAWL-001", "CRAWL-005", "CRAWL-015"]) {
    assert.ok(!ids(r).includes(id), `${id} should not fire: ${JSON.stringify(find(r, id))}`);
  }
  assert.ok(ids(r).includes("META-012"), "canonical from page.url");
});

test("SvelteKit: adapter-static fallback and trailingSlash ignore", () => {
  const dir = project({
    ...SK_BASE,
    "vite.config.ts": "import adapter from '@sveltejs/adapter-static'; import { sveltekit } from '@sveltejs/kit/vite'; export default { plugins: [sveltekit({ adapter: adapter({ fallback: '200.html' }) })] }",
    "src/routes/+layout.ts": "export const trailingSlash = 'ignore';",
    "src/routes/+page.svelte": "<svelte:head><title>Home</title></svelte:head>",
  });
  const r = scanProject(dir);
  assert.match(find(r, "CRAWL-009")[0].message, /fallback/);
  assert.ok(ids(r).includes("CRAWL-017"));
});

// ---------------------------------------------------------------------------
// React SPA rules
// ---------------------------------------------------------------------------

test("React SPA: scaffold title, csr-only, static canonical, hash router, rewrite soft 404", () => {
  const dir = project({
    "package.json": { dependencies: { react: "^19.3.1", "react-dom": "^19.3.1", "react-router": "^8.5.1" }, devDependencies: { vite: "^8.3.5" } },
    "index.html": '<!doctype html><html><head><title>Vite + React + TS</title><link rel="canonical" href="https://acme.com/" /></head><body><div id="root"></div></body></html>',
    "src/main.tsx": "import { createHashRouter } from 'react-router'; createHashRouter([{ path: '/', element: null }, { path: '/about', element: null }]);",
    "src/Nav.tsx": "export default function Nav(){ const navigate = useNavigate(); return <div onClick={() => navigate('/about')}>About</div> }",
    "vercel.json": { rewrites: [{ source: "/(.*)", destination: "/index.html" }] },
  });
  const r = scanProject(dir);
  assert.ok(ids(r).includes("META-002"));
  assert.equal(find(r, "CRAWL-009")[0].severity, "critical");
  assert.ok(ids(r).includes("META-011"));
  assert.ok(ids(r).includes("CRAWL-012"));
  assert.ok(ids(r).includes("CRAWL-013"));
  assert.ok(ids(r).includes("CRAWL-011"));
  assert.ok(ids(r).includes("META-016"));
  assert.ok(ids(r).includes("META-003"), "no per-route metadata");
});

test("React: <title> with mixed text and expression (React 19 single-string rule)", () => {
  const dir = project({
    "package.json": { dependencies: { react: "^19.3.1", "react-dom": "^19.3.1" }, devDependencies: { vite: "^8" } },
    "index.html": '<!doctype html><html lang="en"><head><title>Acme</title><meta name="description" content="x"><meta name="viewport" content="width=device-width"></head><body><div id="root"></div></body></html>',
    "src/Page.tsx": "export default function P({ n }){ return <><title>Results page {n}</title><h1>R</h1></> }",
    "src/Ok.tsx": "export default function P({ n }){ return <><title>{`Results page ${n}`}</title><h1>R</h1></> }",
  });
  const hits = find(scanProject(dir), "META-021");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].file, "src/Page.tsx");
});

// ---------------------------------------------------------------------------
// Generic rules
// ---------------------------------------------------------------------------

test("Structured data: unescaped JSON.stringify, retired types, FAQPage info, no @context", () => {
  const dir = project({
    ...NEXT_BASE,
    "app/layout.tsx": "export default function L({children}){return <html lang='en'>{children}</html>}",
    "app/page.tsx": `const ld = { "@context": "https://schema.org", "@type": "HowTo", name: "x" };
export default function P(){ return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} /> }`,
    "app/faq/page.tsx": `const ld = { "@context": "https://schema.org", "@type": "FAQPage" };
export default function P(){ return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\\\u003c') }} /> }`,
    "app/org/page.tsx": `const ld = { "@type": "Organization", name: "A" };
export default function P(){ return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\\\u003c') }} /> }`,
  });
  const r = scanProject(dir);
  assert.equal(find(r, "SD-002").length, 1, "only the unescaped one");
  assert.ok(find(r, "SD-003").some((f) => /HowTo/.test(f.message)));
  assert.equal(find(r, "SD-004")[0].severity, "info");
  assert.ok(find(r, "SD-006").some((f) => f.file === "app/org/page.tsx"));
  assert.ok(ids(r).includes("AUTH-003"), "Organization without sameAs");
});

test("Images: missing alt, missing dimensions, lazy hero; commented-out code is ignored", () => {
  const dir = project({
    "package.json": { dependencies: { react: "^19", "react-dom": "^19" }, devDependencies: { vite: "^8" } },
    "index.html": '<html lang="en"><head><title>A</title></head><body><div id="root"></div></body></html>',
    "src/Hero.tsx": `export default function Hero(){ return <section>
  <img src="/hero.jpg" loading="lazy" alt="Team" width="1200" height="600" />
  <img src="/b.png" />
  {/* <img src="/commented.png" /> */}
</section> }`,
  });
  const r = scanProject(dir);
  assert.match(find(r, "IMG-001")[0].message, /^1 image/);
  assert.match(find(r, "IMG-002")[0].message, /^1 <img>/);
  assert.ok(ids(r).includes("IMG-004"));
});

test("Content/authority: missing trust pages, article template without author/date, lorem ipsum", () => {
  const dir = project({
    ...NEXT_BASE,
    "app/layout.tsx": "export default function L({children}){return <html lang='en'>{children}</html>}",
    "app/page.tsx": "export default function P(){ return <p>Lorem ipsum dolor sit amet</p> }",
    "app/pricing/page.tsx": "x",
    "app/features/page.tsx": "x",
    "app/blog/[slug]/page.tsx": "import { notFound } from 'next/navigation'; export default async function P({params}){ const post = await getPost((await params).slug); if(!post) notFound(); return <article><h1>{post.title}</h1><div>{post.body}</div></article> }",
  });
  const r = scanProject(dir);
  assert.ok(ids(r).includes("AUTH-001"));
  assert.ok(ids(r).includes("AUTH-002"));
  assert.ok(ids(r).includes("CONTENT-002"));
  assert.ok(ids(r).includes("CONTENT-001"));
  assert.ok(ids(r).includes("SD-007"));
});

test("--only filters by pillar and results are severity-sorted", () => {
  const dir = project({ ...NEXT_BASE, "app/layout.tsx": "export default function L({children}){return <html>{children}</html>}", "app/page.tsx": "x" });
  const r = scanProject(dir, { only: "geo" });
  assert.ok(r.findings.length > 0);
  assert.ok(r.findings.every((f) => f.pillar === "geo"));
  const all = scanProject(dir).findings.map((f) => f.severity);
  const order = ["critical", "high", "medium", "low", "info"];
  assert.deepEqual(all, [...all].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
});

// ---------------------------------------------------------------------------
// HTML mode
// ---------------------------------------------------------------------------

test("analyzeHtml extracts head facts, JSON-LD, words and shell", () => {
  const f = analyzeHtml(`<!doctype html><html lang="en"><head><title>Pricing | Acme</title><meta name="description" content="Plans &amp; prices"><link rel="canonical" href="https://acme.com/pricing"><meta property="og:title" content="P"><meta property="og:image" content="/og.png"><meta name="viewport" content="width=device-width"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product"}</script></head><body><h1>Pricing</h1><p>Three plans for teams.</p><img src="a.png"></body></html>`);
  assert.equal(f.title, "Pricing | Acme");
  assert.equal(f.description, "Plans & prices");
  assert.deepEqual(f.canonicals, ["https://acme.com/pricing"]);
  assert.deepEqual(f.jsonLd[0].types, ["Product"]);
  assert.equal(f.h1s.length, 1);
  assert.equal(f.imgsMissingAlt, 1);
  assert.equal(f.shellRoot, false);
  assert.ok(f.titleInHead);
  const shell = analyzeHtml('<html><head><title>Vite + React</title></head><body><div id="root"></div><script type="module" src="/x.js"></script></body></html>');
  assert.equal(shell.shellRoot, true);
  assert.equal(shell.words, 0);
});

test("htmlFindings: shell, canonical collisions, duplicate titles, streamed title, invalid JSON-LD", () => {
  const page = (title, canon, extra = "") => ({ label: title, facts: analyzeHtml(`<html lang="en"><head><meta name="viewport" content="x"><title>${title}</title><link rel="canonical" href="${canon}"></head><body><h1>x</h1>${extra}</body></html>`) });
  const pages = [
    page("Acme", "https://acme.com/"),
    { ...page("Acme", "https://acme.com/"), label: "about" },
    { label: "shell", facts: analyzeHtml('<html><head><title>S</title></head><body><div id="root"></div></body></html>') },
    { label: "streamed", facts: analyzeHtml('<html lang="en"><head><meta name="viewport" content="x"></head><body><title>Late</title><h1>x</h1></body></html>') },
    { label: "badld", facts: analyzeHtml('<html lang="en"><head><title>B</title><script type="application/ld+json">{"@type": "Thing",}</script></head><body></body></html>') },
  ];
  const fs_ = htmlFindings(pages).map((f) => f.id);
  for (const id of ["HTML-SHELL", "HTML-CANON-COLLIDE", "HTML-TITLE-DUP", "HTML-TITLE-BODY", "HTML-JSONLD-INVALID", "HTML-LANG"]) assert.ok(fs_.includes(id), id);
});

// ---------------------------------------------------------------------------
// Live fetch against a real local HTTP server
// ---------------------------------------------------------------------------

test("fetchPages: soft-404 probe, robots redirect, UA-dependent streamed title", async () => {
  const server = http.createServer((req, res) => {
    const ua = req.headers["user-agent"] || "";
    if (req.url === "/robots.txt") { res.writeHead(307, { location: "/login" }); return res.end(); }
    if (req.url === "/sitemap.xml") { res.writeHead(200, { "content-type": "text/html" }); return res.end("<html><body>app</body></html>"); }
    res.writeHead(200, { "content-type": "text/html" });
    const head = /Googlebot/.test(ua) ? "<title>Post</title>" : "";
    const late = /Googlebot/.test(ua) ? "" : "<title>Post</title>";
    res.end(`<html lang="en"><head><meta name="viewport" content="x">${head}</head><body>${late}<h1>Post</h1><p>${"word ".repeat(200)}</p></body></html>`);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  try {
    const result = await fetchPages([`http://127.0.0.1:${port}/blog/post`], { uas: ["googlebot", "gptbot"] });
    const got = result.findings.map((f) => f.id);
    assert.ok(got.includes("HTML-SOFT404"), "200 on made-up URL");
    assert.ok(got.includes("LIVE-REDIRECT"), "robots.txt redirected");
    assert.ok(got.includes("LIVE-SITEMAP-TYPE"), "sitemap served as html");
    assert.ok(got.includes("LIVE-UA-STREAM"), "gptbot title outside head");
    await assert.rejects(fetchPages(["https://example.com/"]), /allow-remote/);
  } finally {
    server.close();
  }
});

test("summarize/toMarkdown produce clusters and a table", () => {
  const dir = project({
    ...NEXT_BASE,
    "app/layout.tsx": "export const metadata = { title: 'Create Next App', description: 'Generated by create next app', alternates: { canonical: '/' } };\nexport default function L({children}){return <html>{children}</html>}",
    "app/page.tsx": "x", "app/a/page.tsx": "x",
  });
  const r = scanProject(dir);
  const s = summarize(r.findings);
  assert.ok(s.topClusters.some((c) => c.cluster === "root-layout"));
  const md = toMarkdown(r);
  assert.match(md, /\| Sev \| ID \|/);
  assert.match(md, /Shared root causes/);
});

test("fetchPages: robots.txt served by an SPA fallback, noindex soft-404 downgraded", async () => {
  const server = http.createServer((req, res) => {
    if (req.url.includes("seo-scan-probe")) { res.writeHead(200, { "content-type": "text/html" }); return res.end('<html lang="en"><head><meta name="robots" content="noindex"><title>Missing</title></head><body><h1>Not found</h1></body></html>'); }
    res.writeHead(200, { "content-type": "text/html" });
    res.end('<html lang="en"><head><meta name="viewport" content="x"><title>App</title></head><body><div id="root"></div></body></html>');
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  try {
    const result = await fetchPages([`http://127.0.0.1:${port}/`]);
    const got = result.findings.map((f) => f.id);
    assert.ok(got.includes("LIVE-ROBOTS-HTML"));
    assert.ok(!got.includes("CRAWL-003"), "html fallback is not parsed as robots.txt");
    assert.ok(got.includes("HTML-SOFT404-NOINDEX"));
    assert.ok(!got.includes("HTML-SOFT404"));
    assert.ok(got.includes("HTML-SHELL"));
  } finally {
    server.close();
  }
});

test("findings are de-duplicated when one component serves many routes", () => {
  const dir = project({
    ...SK_BASE,
    "src/lib/Seo.svelte": "<script>import { page } from '$app/state'; let { title } = $props();</script><svelte:head><title>{title}</title><link rel=\"canonical\" href={page.url.href} /></svelte:head>",
    "src/routes/+page.svelte": "<script>import Seo from '#lib/Seo.svelte';</script><Seo title=\"Home\" />",
    "src/routes/a/+page.svelte": "<script>import Seo from '#lib/Seo.svelte';</script><Seo title=\"A\" />",
    "src/routes/b/+page.svelte": "<script>import Seo from '#lib/Seo.svelte';</script><Seo title=\"B\" />",
  });
  assert.equal(find(scanProject(dir), "META-012").length, 1);
});

test("Next: proxy scoped to private sections is not flagged", () => {
  const dir = project({
    ...NEXT_BASE,
    "app/layout.tsx": "export default function L({children}){return <html lang='en'>{children}</html>}",
    "app/page.tsx": "x",
    "proxy.ts": "import { NextResponse } from 'next/server';\nexport function proxy(req){ return NextResponse.redirect(new URL('/login', req.url)) }\nexport const config = { matcher: ['/dashboard/:path*', '/account/:path*'] }",
  });
  assert.ok(!ids(scanProject(dir)).includes("CRAWL-016"));
  const root = project({
    ...NEXT_BASE,
    "app/layout.tsx": "export default function L({children}){return <html lang='en'>{children}</html>}",
    "app/page.tsx": "x",
    "proxy.ts": "import { NextResponse } from 'next/server';\nexport function proxy(req){ return NextResponse.redirect(new URL('/login', req.url)) }\nexport const config = { matcher: ['/:path*'] }",
  });
  assert.ok(ids(scanProject(root)).includes("CRAWL-016"));
});

test("SvelteKit {@html} JSON-LD: escaped form is not flagged, raw form is", () => {
  const ok = project({ ...SK_BASE, "src/routes/+page.svelte": "<script>const ld = { '@context': 'https://schema.org', '@type': 'Organization' };</script><svelte:head><title>x</title>{@html `<script type=\"application/ld+json\">${JSON.stringify(ld).replace(/</g, '\\\\u003c')}</script>`}</svelte:head>" });
  assert.ok(!ids(scanProject(ok)).includes("SD-002"));
  const bad = project({ ...SK_BASE, "src/routes/+page.svelte": "<script>const ld = { '@context': 'https://schema.org', '@type': 'Organization' };</script><svelte:head><title>x</title>{@html '<script type=\"application/ld+json\">' + JSON.stringify(ld) + '</script>'}</svelte:head>" });
  assert.ok(ids(scanProject(bad)).includes("SD-002"));
});
