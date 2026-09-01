# Edge Cases — better-auth-conventions

Accumulated real-world edge cases encountered while using this skill specifically.
Consult this file when something unexpected happens; append new entries per the
self-improvement protocol (dated, never rewriting or removing existing entries).

## 2026-09-01 — Don't annotate the auth client `any`; declare custom fields via `additionalFields`

What happened: `export const auth: any = betterAuth({...})` erased the entire
typed surface (`.api.*`, `$Infer.Session`) and forced downstream casts. The app's
`User` model has custom fields (`phone`, `avatarColor`, `authProvider`) that
Better Auth doesn't know about by default, so `session.user` had no typed `phone`
and the author reached for `any` instead of declaring them. Separately, dropping
`: any` and letting inference work hit TS2883 under `"declaration": true` because
the inferred type references Zod internals that can't be named in a `.d.ts`.

What I did: Declare the custom fields under `user.additionalFields`, marking
server-managed fields that carry a DB default (`avatarColor`, `authProvider`) as
`input: false` so they can't be client-set — the docs explicitly call this a
security issue for fields the user shouldn't control. Leave `auth` inferred (no
annotation) and use `typeof auth.$Infer.Session` for session types. If TS2883
appears, disable `declaration`/`composite` in tsconfig — the documented fix; a
backend service doesn't emit `.d.ts` anyway.
