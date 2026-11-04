# Triage and reporting

## Three separate labels

Never collapse them into one score.

| Label | Values | Meaning |
|---|---|---|
| severity | critical, high, medium, low, info | impact **if** the finding is true. critical: blocks crawling/indexing site-wide; high: blocks or misdirects indexing/citation for important pages; medium: weakens ranking/CTR/citation for many pages; low: small or local; info: policy decision or park |
| evidence | high, medium, experimental | how well-established the SEO claim behind the rule is (documented by an engine/framework vs good practice vs unproven) |
| confidence | certain, likely, verify | how sure the detection is. `verify` must be confirmed in rendered HTML before it is reported as fact |

Number provenance: label every metric **measured** (tool/output), **user-provided**
or **estimated**. Missing data is "not assessed", never 0 or a guess.

## Impact and effort

Adapted from rampstackco `seo-site-health-audit/references/issue-impact-table.md`:

| Issue | Mechanism | Typical effort in code |
|---|---|---|
| noindex / robots block on indexable pages | high | S: one layout or config file |
| Canonical pointing elsewhere (inherited, collided, localhost) | high | S-M: per-page canonical helper |
| Content or metadata missing from initial HTML | high | M-L: move fetch server-side, prerender |
| Soft 404s / wrong status codes | high | S-M: notFound/error(404), host config |
| robots.txt/sitemap redirected or served as HTML | high | S: matcher/static file |
| AI search crawler blocked | high | S |
| Missing/duplicate titles on templates | medium | S-M: template + data |
| No sitemap / bad sitemap URLs | medium | S |
| Non-crawlable navigation | medium | S |
| Structured data missing on key templates | medium | S-M |
| Hreflang errors | high on multilingual sites | M |
| Missing descriptions, OG images | low | S |
| Image alt/dimensions | low SEO, high accessibility | S |
| Title/description length lint, multiple valid H1s, keywords meta | park | |

## Clusters

Findings share a `cluster` key (root-layout, robots, per-route-metadata,
seo-component, structured-data, index-html, proxy, ...). One shared fix
usually closes the whole cluster: a root layout change, a `Seo` component, a
sitemap generator, a proxy matcher. Report the cluster fix once with the list
of findings it closes; never present twenty per-page edits when one
template edit does it. `seo-scan` prints the largest clusters as "shared root
causes".

## Park list

Note these in one line with the reason, do not pad the top fixes with them:
title/description length warnings on non-priority pages; multiple valid H1s;
`meta keywords`; uppercase/underscore URLs already redirected; schema
warnings (not errors) on types without rich results; llms.txt absence.

## Rendered HTML checks

`seo-scan.mjs html <dir>` and `seo-scan.mjs fetch --url ...` check what the
server actually sends:

| ID | Checks |
|---|---|
| HTML-SHELL | empty root element with almost no text: content needs JS |
| HTML-TITLE / -DUP / -LEN / -BODY | missing, duplicated across pages, length lint, emitted after `</head>` |
| HTML-DESC / -DESC-DUP | missing or duplicated descriptions |
| HTML-CANON-NONE / -MULTI / -BAD / -COLLIDE | missing, several, non-https/localhost, many pages sharing one canonical |
| HTML-NOINDEX / HTML-XROBOTS / HTML-NOSNIPPET | robots meta, `X-Robots-Tag` header, snippet limits |
| HTML-LANG / HTML-VIEWPORT / HTML-H1 / HTML-OG / HTML-ALT | document basics |
| HTML-JSONLD-INVALID / -CONTEXT / -RETIRED | JSON-LD that does not parse, lacks `@context`, or uses retired types |
| HTML-THIN | little visible text (info; judge by page type) |
| HTML-STATUS | non-200 for a page you expected to be indexable |
| HTML-SOFT404 / -SOFT404-NOINDEX / -PROBE-REDIRECT | made-up URL answered 200, 200 + noindex, or redirected |
| LIVE-REDIRECT / LIVE-MISSING / LIVE-ROBOTS-HTML / LIVE-SITEMAP-TYPE | robots.txt and sitemap.xml served correctly |
| LIVE-UA-STREAM / LIVE-UA-STATUS / LIVE-UA-CONTENT | user-agent dependent metadata placement, status or content |

When a static finding and a rendered check disagree, report the rendered
result and say the static match was a false positive.

## Report template

```markdown
## SEO audit: <app> (<framework> <version>, <rendering mode>)

Scope: <routes/templates checked>. Rendered check: <run / not run (reason)>.
Assumptions: <origin, priority pages, AI training policy, TODO(seo) placeholders>.

### Top fixes
1. **<Finding>** (<severity>, evidence: <level>)
   - Impact: <what it does to crawling/indexing/citation>
   - Current state: <file:line, or fetched output: status/title/canonical>
   - Change: <diff in the project's language and framework idiom>
   - Closes: <rule IDs in this cluster>
   - Verify: <command, e.g. seo-scan fetch --url ... shows canonical https://site/pricing>
2. ...

### Other findings
- Crawlability: <ID: one line> ...
- Technical / on-page: ...
- Content: ...
- Authority (on-site): ...
- GEO / AI search: ...

### Parked
- <item: reason>

### Not assessed
- Off-site authority, field Core Web Vitals, index coverage, AI citation rates:
  <what data or access would unlock each>
```

## Verifying fixes

After applying: build, re-run `scan` and the same `fetch`/`html` command, and
show before/after for each finding. Indexing and citation outcomes depend on
recrawls (days to months, per Google); report them as pending, not done.
