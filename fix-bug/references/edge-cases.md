# Edge cases

Known edge cases encountered when running the fix-bug skill, and how to handle them.
This file is updated automatically by Hermes when new edge cases are discovered.

---

## 2026-06-08 — Graphify fails on non-code files

**Condition:** Repository contains `.toml`, `.sql`, `.lockb`, `.env`, or image
files. Graphify requires an LLM API key to process these.

**Handling:**
1. First try passing `GEMINI_API_KEY` — free tier at aistudio.google.com.
2. If the key is unavailable, find and remove the non-code files from the local
   clone before running `graphify extract`. The remote repo is unaffected.
3. Common offenders: `supabase/config.toml`, `*.sql` migrations, `bun.lockb`,
   `README.md`, image files in `src/assets/` or `public/`.

---

## 2026-06-08 — Knowledge graph query returns wrong file (tsconfig vs source)

**Condition:** Query terms like "URL", "link", or "connection" match TypeScript
`baseUrl` config in `tsconfig.json` or `tsconfig.app.json`, which ranks higher
than the actual application config file because tsconfig files have many nodes.

**Handling:**
When the top result is a `tsconfig*.json` file and the bug is about an
application-level URL or connection string, skip it and look at the next
candidate. `tsconfig.baseUrl` is a TypeScript path alias, not an application URL.

---

## 2026-06-08 — OpenRouter API key does not work with Graphify

**Condition:** Using an OpenRouter API key as `ANTHROPIC_API_KEY` for Graphify
extraction fails with `401 invalid x-api-key`.

**Handling:**
Graphify calls `api.anthropic.com` directly. OpenRouter keys are not accepted.
Use a native Anthropic API key, or use a Gemini API key (`GEMINI_API_KEY`) from
Google AI Studio (free tier) instead.
