# Content and authority

Code review can judge whether content *exists in a crawlable, attributable,
well-structured form*. It cannot judge expertise or reputation on its own.
Say which is which in the report.

## Helpful content checks

Google's people-first test (creating-helpful-content docs), applied per
priority page:

| Question | Look for in the code/output |
|---|---|
| **Who** created it? | Byline and author page where readers expect one; required for YMYL topics (health, money, legal, safety, civic) |
| **How** was it created? | Method, data source or first-hand experience shown where readers would ask; disclosure where AI assistance was material |
| **Why** does it exist? | Answers a real need rather than existing to catch search clicks (no keyword-swapped doorway pages) |

Then, in the rendered HTML (`seo-scan.mjs html`/`fetch`):

- The page's main question is answered near the top in server-rendered text.
- No placeholder copy (CONTENT-001), no copy duplicated across templates with
  only a city/product name swapped (doorway risk; claude-seo quality gates
  warn at 30+ such location pages and stop at 50+ without real local content).
- Thin output (HTML-THIN) is a prompt to look, not a verdict: a contact page is
  fine at 80 words, an article template is not. Word count is not a ranking
  factor.
- Dates and facts are current; stale "2023" copy on a page titled 2026 is a
  trust problem.

## Article templates

For blog/news/guide templates (CONTENT-002, SD-007):

- Visible author name linked to an author page (bio, credentials, profiles).
- Visible published and updated dates with `<time datetime="...">`.
- `Article`/`BlogPosting` JSON-LD with `headline`, `author` (`Person` with
  `url`), `datePublished`, `dateModified`, `image`; values identical to the
  visible ones.
- Breadcrumbs and links to related posts and to the commercial pages they
  support (internal linking).
- An updated date only changes when the content materially changes.

## On-site trust signals

Checkable from routes and templates (AUTH-001/002):

- About page: who runs the site, history, people and credentials.
- Contact page with real contact routes (and address for local businesses).
- Privacy policy and terms; return/shipping policy for shops.
- Author pages for anyone publishing articles.
- Outbound links that cite primary sources for claims and statistics.

## Entity signals

- `Organization` (or `Person`, `LocalBusiness`) JSON-LD on the home page with
  `name`, `url`, `logo` and `sameAs` pointing to **verified** profiles the
  organisation controls (LinkedIn, GitHub, Crunchbase, Wikipedia/Wikidata when
  they exist) (AUTH-003). Never invent profiles.
- The same name, description and positioning across the site, these profiles
  and directories; search and AI engines look for consistent descriptions.
- `Person` markup for authors with their profile `sameAs`.

## What needs external data

Authority is mostly off-site: referring domains, brand mentions, reviews,
press, Wikipedia presence. From code alone, report it as **not assessed**.
If the user provides data, use it and label it user-provided:

- Search Console (queries, pages, coverage), backlink exports, review counts.
- A connected SEO data connector (for example an Ahrefs or DataForSEO MCP) can
  supply referring domains and organic keywords; label tool numbers as
  estimates and compare against named peers rather than absolute thresholds
  (aaron-he-zhu CITE: authority is peer-relative; missing evidence is
  "unknown", never a fail).

## Anti-patterns

Do not recommend: fake reviews or ratings, invented authors or credentials,
self-serving review markup, hidden text, mass-produced pages with swapped
keywords, or chasing link schemes. All are spam-policy risks.
