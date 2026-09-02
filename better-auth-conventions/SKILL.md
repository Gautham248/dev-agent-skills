---
name: better-auth-conventions
description: >
  Better Auth conventions grounded in the official documentation
  (better-auth.com/docs), fetched and read directly while writing this
  skill — plugin config/migration pairing, session and cookie-cache
  tradeoffs, social sign-on (including the native-iOS Apple Sign-In
  audience gotcha), email OTP, and Bearer/JWT token usage. Use whenever
  writing or reviewing backend auth config, sign-in/sign-up flows, session
  handling, or social-provider setup that uses Better Auth.
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

# Better Auth conventions

Auth code is security-sensitive by nature — get it subtly wrong and the
failure mode is silent (an attacker gets in, or a legitimate user gets
locked out) rather than a crash you'd notice in testing. The rules below
lean toward the framework's own documented defaults and explicit
configuration over ad-hoc token handling.

## Core config: `betterAuth()` is the single source of truth

- All server-side behavior — providers, plugins, session policy, database —
  is configured once in the `betterAuth({...})` call, typically in
  `auth.ts`. Don't scatter auth-adjacent config (token expiry, provider
  credentials) elsewhere in the codebase; if it affects auth behavior, it
  belongs in this object.
- **Every plugin has a server half and, usually, a matching client half.**
  Adding `twoFactor()` (or `emailOTP()`, `bearer()`, etc.) to the server's
  `plugins` array without adding the corresponding `*Client()` plugin to
  `createAuthClient({ plugins: [...] })` on the client leaves the client
  unable to call the new endpoints — check both sides were updated
  together, not just the one that was top of mind.
- **Adding or changing a plugin usually requires a schema migration** — new
  plugins commonly need new tables/columns. Run `npx auth generate` (schema
  only, for manual migration) or `npx auth migrate` after any plugin
  change; a PR that adds a plugin but touches no migration is a signal to
  check whether one was actually needed, not proof it wasn't.
- **Server-side auth calls go through `auth.api.*`, not the client
  functions.** `authClient.signIn.email(...)` is for the client; the
  server-side equivalent is `auth.api.signInEmail({...})`. Calling client
  methods from server code (or vice versa) is a category error, not a style
  preference — flag it if you see it.

## Sessions

- Default session model is a signed cookie (`session_token`) that identifies
  a server-side session row — not a self-contained JWT. Don't assume the
  cookie itself carries trustworthy claims to read directly; validate via
  `auth.api.getSession({ headers })` on every request that needs identity,
  server-side.
- **`session.cookieCache` trades correctness for fewer DB round-trips** —
  when enabled, a revoked session can remain valid on other devices until
  the cache's `maxAge` expires, because the server can't reach into another
  device's browser to invalidate its cached cookie early. For anything
  where immediate revocation actually matters (an admin forcibly ending a
  compromised session, a "sign out everywhere" action), either disable
  `cookieCache`, use a short `maxAge` (seconds, not minutes), or pass
  `disableCookieCache: true` on that specific check — don't assume
  `revokeSession` is instantaneous everywhere once caching is on.
- **Session freshness (`session.freshAge`, default 1 day) is a distinct
  concept from expiration** — some endpoints should require a session
  created recently (a "fresh" login), not merely a session that hasn't
  expired yet. Use this for sensitive actions (changing an email, deleting
  an account) rather than hand-rolling a "confirm your password again"
  reimplementation of the same idea.
- Set `expiresIn`/`updateAge` explicitly via the `session` config rather
  than relying on defaults you haven't confirmed (7-day expiry, 1-day
  rolling refresh) — sensible values, but state them, don't assume them
  silently in review.

## Social sign-on

- Configure providers under `socialProviders` in `betterAuth({...})`; the
  client calls `signIn.social({ provider, ... })`.
- **On native platforms (iOS/Android), `signIn.social` does not
  auto-navigate** — handle the post-auth navigation yourself; this differs
  from the redirect-based web flow.
- **Prefer the `idToken` flow for native sign-in** (the native SDK — Apple's
  `AuthenticationServices`, Google's native SDK — gets the token on-device,
  then it's handed to `signIn.social({ provider, idToken: { token, nonce } })`
  for server-side verification) over redirecting a mobile user out to a
  web-based OAuth flow. Only `google`, `apple`, and `facebook` support the
  `idToken` path.

### Apple Sign-In specifics (native iOS) — read this before touching Apple config

Apple's native flow has a specific, well-documented failure mode that isn't
obvious from generic OAuth knowledge:

- **On native iOS, the ID token's audience is your app's bundle ID, not
  your Apple Service ID.** If only `clientId` (the Service ID, used for the
  web flow) is configured and a native ID token is verified against it,
  verification fails with `JWTClaimValidationFailed: unexpected "aud" claim
  value`. **Set `appBundleIdentifier`** to the app's bundle ID for native
  verification to succeed. If you need both web and native Apple Sign-In to
  work simultaneously, use `clientId: string[]` or `audience: string[]`
  with both values rather than relying on `appBundleIdentifier` alone.
- Add `https://appleid.apple.com` to `trustedOrigins` — required for
  Apple's flow to communicate with your app.
- **Apple sends the user's `email` claim only on the very first
  authorization** — every subsequent sign-in from the same user omits it,
  and there's no Apple endpoint to fetch it after the fact. Persist the
  email from that first authorization; don't write code that expects Apple
  to keep supplying it, and don't treat a missing email on a later sign-in
  as an error condition.
- If generating the Apple client-secret JWT yourself (rather than via
  Better Auth's config-driven generation), it **cannot expire more than six
  months out** — Apple rejects longer-lived ones outright. A hardcoded
  expiry near that ceiling is a renewal task waiting to be forgotten, not a
  one-time setup step.

## Email OTP

- Implement `sendVerificationOTP({ email, otp, type })` and branch on
  `type` (`"sign-in"`, `"email-verification"`, `"forget-password"`, etc.) —
  don't send the same email copy for every OTP purpose; the recipient needs
  to know what the code is actually for.
- **Don't `await` the email-send call in the OTP handler** — the documented
  reasoning is timing-attack resistance: an awaited send makes response
  latency observably different between "OTP genuinely sent" and "silently
  skipped" paths (e.g. an unregistered address), which leaks information an
  attacker can use for account enumeration. Fire-and-forget the send (with
  its own error handling/logging), and on serverless platforms use the
  platform's background-task mechanism (e.g. `waitUntil`) so the function
  doesn't get frozen before the send completes.

## Bearer tokens and JWT — they are not the same thing

- **The `bearer` plugin** issues a session token via a `set-auth-token`
  response header on sign-in; the client stores it and sends it back as
  `Authorization: Bearer <token>`. This is still the same session-token
  concept as the cookie flow, just carried differently — useful when a
  client can't rely on cookies (native apps, cross-origin API clients).
- **The `jwt` plugin is a different mechanism for a different purpose** —
  it exists for external services that need a JWKS-verifiable JWT, not as a
  session replacement. Don't reach for the JWT plugin just because a bearer
  token was needed; use `bearer` for "authenticate API requests to our own
  backend," and `jwt` only when a separate service needs to verify a token
  independently via JWKS.
- Either way, the server verifies via `auth.api.getSession({ headers })` —
  the presence of a token in the header is not itself proof of anything
  until it's actually validated against the auth instance.

## If something goes wrong

Before improvising a fix or contradicting something stated here, check
`references/edge-cases.md` — this may already be a documented, resolved
question. If it's genuinely new once you're done, follow the
self-improvement protocol above and add it there.
