# Edge Cases — backend

Accumulated real-world edge cases encountered while using this skill specifically.
Consult this file when something unexpected happens; append new entries per the
self-improvement protocol (dated, never rewriting or removing existing entries).

<!-- No entries yet. -->

## 2026-09-01 — Routes must not issue raw DB/ORM queries directly

What happened: Route handlers reached into `req.db` for single, cheap lookups
(e.g. `req.db.task.findUnique({ where: { id } })` as an existence check before a
404) alongside heavier inline tag CRUD. The skill says "business logic lives in
the service layer" and "fat handlers are a smell", but a single one-line DB
query reads as neither — so it slipped past the existing guidance.

What I did: Treat "no raw DB/ORM calls in route handlers" as an absolute rule,
not just a "multi-step logic" smell — even a one-line existence check becomes a
service function (`taskExists`, `getTask`, `getTags`, …). Routes only
orchestrate: validate → authorize → call service → shape response.
