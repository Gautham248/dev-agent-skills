# seo-optimize

An agent skill that audits a custom-coded **React, Next.js or SvelteKit** site
for search and AI-search visibility from the codebase itself, verifies the
findings against what the production server actually returns, and hands back
prioritised, framework-native code changes. It covers crawlability, technical
and on-page SEO, content, on-site authority signals and GEO (AI Overviews,
ChatGPT search, Claude, Perplexity).

It combines the strongest parts of nine popular open-source SEO skills (see
`references/sources.md`) with a deterministic scanner none of them had: stack
and version detection, static rules, a rendered-HTML check and a live fetch
that compares how the site treats Googlebot and AI crawler user agents.

## Who it's for

Developers and coding agents working in a web app repo who want "why isn't
this ranking / being cited" answered with file:line evidence and diffs, not a
generic checklist.

## Prerequisites

- Node.js 18+ (the scanner uses `node:` built-ins and global `fetch`; no npm
  install).
- The target app's dependencies installed if you want version-matched docs and
  the rendered check (`npm install`, then the app's production build).

## Usage

In your agent harness, from inside an app repo:

```
/seo-optimize
"Run an SEO audit on this Next.js app and tell me what to fix first"
"Is our Vite SPA visible to ChatGPT and Perplexity?"
"Fix the canonicals and add a sitemap to this SvelteKit site"
```

Or run the scanner directly:

```bash
node seo-optimize/scripts/seo-scan.mjs detect .                 # stack, versions, routes, docs
node seo-optimize/scripts/seo-scan.mjs scan . --format md       # static findings
node seo-optimize/scripts/seo-scan.mjs html dist/ --format md   # built HTML
node seo-optimize/scripts/seo-scan.mjs fetch --url http://localhost:3000/,http://localhost:3000/blog/x --compare-ua --format md
node seo-optimize/scripts/seo-scan.mjs scan . --fail-on high    # CI gate (exit 1)
```

`fetch` only talks to localhost unless `--allow-remote` is passed; use it on
sites you own or are authorised to test.

## What it does not do

No ranking or citation promises, no keyword research or content writing, no
off-site authority scoring without data you provide, and no AI training-policy
decisions on the owner's behalf.

## Tests

```bash
node --test seo-optimize/scripts/tests/*.test.mjs
```

Unit tests write small fixture projects to a temp dir (one seeded defect per
rule, plus the fixed variant), the CLI tests run the real command, and the
fetch tests use a real local HTTP server. The skill was also run end to end
against scaffolded create-next-app 16.4.5, create-vite 9.3.3 and SvelteKit 3.1.1
apps; findings from those runs are in `references/edge-cases.md`.
