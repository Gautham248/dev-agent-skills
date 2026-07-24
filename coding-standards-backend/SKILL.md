---
name: coding-standards-backend
description: >
  Company backend conventions for API endpoints, middleware, and background
  jobs -- file-based endpoint structure, access-tier routing groups, the
  validate-authorize-service-respond handler shape, request-scoped
  dependency injection via context, and thin background-job files with
  service-layer logic. Use when adding or changing an API endpoint,
  middleware, or a background/cron job. Does NOT cover database schema or
  queries -- see coding-standards-database.
---

<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->
Before doing anything else in this skill, read and follow the clarification protocol at:
../config/CLARIFICATION-PROTOCOL.md
<!-- END dev-agent-skills clarification protocol -->

<!-- BEGIN dev-agent-skills self-improvement protocol (managed by setup.sh -- do not edit this block manually; edit SELF-IMPROVEMENT-PROTOCOL.md instead) -->
While using this skill, and especially when you finish, read and follow the self-improvement protocol at:
../config/SELF-IMPROVEMENT-PROTOCOL.md
(Append real edge cases to this skill's own references/edge-cases.md — create it if missing. See the protocol file for what qualifies.)
<!-- END dev-agent-skills self-improvement protocol -->

# Coding Standards -- Backend

Universal rules were already applied by the coding-standards dispatcher before this skill was invoked.

## Base rules
### Backend

- **File-based endpoints** exporting named HTTP-method handlers with the
  framework's handler type.
- **Access tiers are encoded structurally in the routing layer**, enforced by
  middleware — e.g. route groups `(public)`, `(secure)`, `(admin)`,
  `(premium)`, or your framework's router mounts/guards. Placing a file in a
  group *is* the authorization declaration; per-handler checks are the last
  line, not the mechanism.
- **Handler shape: validate → authorize → call service → shape response.**
  Request validation runs first via shared helpers. Success responses use the
  framework's JSON helper with the resource under a named key (e.g.
  `json({ resource })`); failures use its error helper with a status and
  message (e.g. `error(status, message)`) — error bodies always carry a
  `message` field.
- **Request-scoped dependencies (DB client, user) arrive via the request
  context** (e.g. `locals`), injected by middleware — handlers never
  construct their own.
- **Fat handlers are a smell**: multi-step business logic belongs in the
  service layer (`lib/server/services/`).
- **Cross-cutting concerns are a middleware sequence** (tracing → security
  headers → timing → auth → tier gating), each handler doing one thing; the
  standard security-header set is applied by one middleware with why-comments.
- **Background jobs are thin**: one file per job exporting a worker
  registration and a scheduler; queue name is a `JOB_NAME` constant; cron
  schedules pinned to UTC with a comment explaining the timing; singleton
  keys prevent double-firing. Job logic lives in a service.

## Deeper reference: endpoint structure and error handling
## 7. Server / API Standards *(if the project exposes an HTTP API)*

- **API endpoints are file-based** and export named HTTP-method handlers with the framework's handler type.
- **Access tiers are encoded structurally in the routing layer**, not per-handler checks — in the reference framework, route groups `(public)`, `(secure)`, `(admin)`, `(premium)` with middleware inspecting the route ID; in other stacks, router mounts or module-level guards playing the same role. Placing a file in a group *is* the authorization declaration.
- **Cross-cutting concerns are a sequence of small middleware handlers** (tracing → CORS/security headers → timing → auth → tier gating), each doing one thing.
- **Request validation happens first, via shared helpers**, before any business logic (reference-framework handler shown; the shape is framework-agnostic):

```ts
export const POST: RequestHandler = async ({ locals: { db, user }, request }) => {
  const payload = await validateRequest(request, createThingSchema);
  if (!user) return error(401, 'Unauthorized');
  ...
  return json({ thing });
};
```

- **Responses**: success via the framework's JSON helper with the resource under a named key; failures via the framework's error helper with a status and message. Error bodies always carry a `message` field.
- **Request-scoped dependencies (DB client, user) arrive through the request context** (e.g. `locals`, `req.context`), injected by middleware — handlers never construct their own.
- **Business logic lives in the service layer**; route handlers orchestrate: validate → authorize → call service → shape response. Long multi-step logic in a handler is a smell.
- **Centralized URL builders** define every internal path and API URL as constants or typed factory functions (`api.thing.pick({ id })`). Neither client nor server hardcodes path strings.
- **A standard security-header set is applied to every response by one middleware handler** — clickjacking protection (CSP `frame-ancestors` + `X-Frame-Options` fallback), `X-Content-Type-Options: nosniff`, a restrictive `Referrer-Policy` and `Permissions-Policy`, and HSTS set only when the request was already HTTPS (so local dev isn't broken). Each header carries a why-comment.

### Background Jobs *(if the project has scheduled/queued work)*

- **One file per job** (`jobs/<name>.job.ts`), each exporting exactly two functions: a worker registration (`registerXWorker`) and a scheduler (`scheduleX`).
- **The queue name is a module-level constant** (`JOB_NAME`), used for the queue, the schedule, and singleton keys — never repeated as a literal.
- **Jobs are thin**: the worker body is a single call into a service function; all logic lives in the service layer.
- **Schedules are cron expressions pinned to UTC**, with a comment explaining the business reason for the timing (reference job library shown):

```ts
await pgBoss.schedule(JOB_NAME, '0 3 * * 2-6', {}, { tz: 'UTC', singletonKey: JOB_NAME });
// Tue–Sat at 03:00 UTC, after the previous trading day's prices are ingested.
```

- **Singleton keys prevent duplicate scheduling/execution**; a deploy-kickoff `send` with a time-boxed singleton (`singletonSeconds`) runs the job once on deployment without double-firing across instances. Use your job library's equivalent deduplication primitive.

## 10. Error Handling (universal)

- **Guard clauses for expected failures** (unauthorized, not found) — handled early, before business logic, using the framework's error mechanism where one exists.
- **Normalized result objects instead of exceptions** at API boundaries: check `response.ok`, read a typed `message` from the body.
- **Custom error classes** where an exception must carry structure (`class APIHTTPError extends Error` wrapping the full response).
- **Per-item try/catch in batch loops** — one failed item logs and continues; the batch reports totals at the end.
- **Telemetry-aware error paths** *(if tracing is configured)*: spans record exceptions and set error status in catch blocks, then rethrow.
- **Logging discipline**: `console.error` for failures with the caught error object, `console.info` for lifecycle events, both with a `[context]:` prefix. `console.log` is lint-banned outside scripts.
- User-facing errors are short, actionable sentences; raw error internals are never shown to users.
- Retry is user-initiated — no automatic retry loops in application code.

