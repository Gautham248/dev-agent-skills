# GEO / AI search

GEO (generative engine optimisation), AEO and LLMO are working labels, not
standards. Google's position (AI features docs, updated 2025-12-10): there are
no additional requirements to appear in AI Overviews or AI Mode, and no new
machine-readable files, AI text files, markup or special schema are needed.
Other engines (ChatGPT search, Perplexity, Claude, Copilot) use their own
crawlers and indexes, so access and raw-HTML content matter more there.

Treat GEO as SEO fundamentals plus three code-level concerns: **can each AI
crawler get in, does it receive the content and metadata without running JS,
and are the pages easy to quote accurately.**

## Evidence levels

From kpab/seo-mastery `ai-search.md`; tag every GEO recommendation:

| Level | Examples | Reporting rule |
|---|---|---|
| High | crawler identities and robots.txt scope, indexability, snippet controls, initial-HTML content | cite the spec; eligibility is not selection |
| Medium | answer-first passages, original data, named authors, dates, entity clarity | a reasonable hypothesis, not a confirmed ranking factor |
| Experimental | llms.txt, AI-specific Markdown, chunking content for AI | optional experiment with a named consumer and a stop condition |

## Eligibility and controls

Google (High):

- A page must be indexed and snippet-eligible to be a supporting link in AI
  Overviews/AI Mode.
- `nosnippet`, `data-nosnippet`, `max-snippet` limit what can be shown and used;
  `noindex` removes the page. A site-wide `nosnippet`/`max-snippet:0` therefore
  keeps pages out of AI answers (GEO-004, HTML-NOSNIPPET).
- `Google-Extended` limits use for Gemini training/grounding in other Google
  products; it does **not** affect Search, AI Overviews or AI Mode.
- AI feature traffic is reported inside Search Console's Performance report
  ("Web").

## Crawler policy

Separate purposes, and check the right token for each claim (claude-seo
`seo-geo`; vendor docs fetched 2026-11-04):

| Token | Operator | Purpose | robots.txt |
|---|---|---|---|
| Googlebot | Google | Search, incl. AI Overviews/AI Mode | yes |
| Google-Extended | Google | Gemini training and grounding outside Search | yes (product token) |
| Bingbot | Microsoft | Bing, Copilot | yes |
| OAI-SearchBot | OpenAI | ChatGPT search results ("opted-out sites will not be shown in ChatGPT search answers") | yes |
| GPTBot | OpenAI | foundation-model training | yes |
| ChatGPT-User | OpenAI | user-initiated visits | "may not apply" |
| Claude-SearchBot | Anthropic | Claude search quality/indexing | yes |
| ClaudeBot | Anthropic | model training | yes |
| Claude-User | Anthropic | user-initiated retrieval | yes (Anthropic honours robots.txt for all three) |
| PerplexityBot | Perplexity | Perplexity search results; not training | yes |
| Perplexity-User | Perplexity | user-initiated fetches | generally ignores |
| CCBot, Applebot-Extended, Bytespider | various | training / dataset | yes |

Rules:

- Blocking a **search** crawler removes the site from that engine's answers
  (GEO-001, high). Blocking a **training** token is a licensing choice with no
  documented search effect (GEO-002, info). Ask the owner; never decide it.
- Default to a permissive `User-agent: *` group and add named groups only for
  deliberate exceptions. Remember named groups replace `*` rules for that bot
  (GEO-006).
- CDN/WAF bot protection is a separate gate: a 403 or challenge page blocks a
  crawler regardless of robots.txt. `seo-scan.mjs fetch --compare-ua` shows how
  the app treats each user-agent string (LIVE-UA-STATUS, LIVE-UA-CONTENT); the
  real bots' treatment needs WAF/server logs (spoofed UAs are not verified
  bots).
- Next.js dynamic routes stream metadata into `<body>` for AI user agents by
  default (GEO-003, LIVE-UA-STREAM). See
  `stack-nextjs.md#streaming-metadata-and-ai-crawlers` for the tested fixes.

## Raw-HTML content (agent readiness)

Most AI fetchers do not execute JavaScript. Everything a model needs to answer
accurately must be in the initial HTML as text:

- The page's main content (CRAWL-009/010, HTML-SHELL).
- Title, description, canonical, JSON-LD in `<head>`.
- Prices, plans, limits, specs and contact details as text on a public page,
  not only in images, calculators, client-fetched widgets or JSON-LD.
- Real HTTP status codes (404 for missing pages; no soft 404s).
- Semantic HTML (`main`, `nav`, `article`, labelled buttons and form fields)
  so agents using the accessibility tree can navigate.

## Citation-ready content

Medium evidence (editorial hypotheses supported by research such as the GEO
paper, KDD 2024, and engine guidance); verify locally, never promise uplift:

- **Answer first:** start each section with a direct 1-3 sentence answer to the
  question its heading asks, then detail.
- **Self-contained facts:** subject, number with unit, date and source in one
  sentence, so a quoted passage stays correct out of context.
- **Question-shaped headings** where natural; tables for comparisons, numbered
  lists for steps.
- **Sources and dates:** cite primary sources; show published and updated dates.
- **Original information:** first-party data, benchmarks, examples with
  methodology. Do not invent statistics to fill this.
- Google also says: do not chunk pages into fragments or write separate content
  for AI; write for people with clear structure.

## llms.txt

**Experimental.** A community proposal (llmstxt.org). Google says AI text files
are not needed for its AI features; no major engine has documented using it
for citations. Report presence or absence as info only (GEO-005). Add one only
for a named consumer (for example developer docs used by coding agents), keep
it in sync with canonical pages, and never put instructions aimed at models in
it.

## Measurement

Not assessable from code. If the user wants to track AI visibility:

- AI referrals in analytics (`chatgpt.com`, `perplexity.ai`, `claude.ai`,
  `gemini.google.com`, `copilot.microsoft.com`) undercount: many answers
  produce no click.
- Citation rate needs a fixed query set run repeatedly per engine, with counts
  ("cited 3/10"), dates and conditions recorded. One run is an anecdote.
- Google AI features traffic is inside Search Console "Web".

## Anti-patterns

Never recommend hidden text for LLMs, prompt-like instructions in page content,
AI-only doorway pages, fabricated sources, statistics, authors or reviews,
mass-generated FAQ pages, or schema that does not match visible content.
