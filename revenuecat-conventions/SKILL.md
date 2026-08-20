---
name: revenuecat-conventions
description: >
  RevenueCat conventions grounded in the official documentation
  (revenuecat.com/docs), fetched and read directly while writing this
  skill — entitlement checks via CustomerInfo, Offerings-driven paywalls,
  restorePurchases vs syncPurchases, the CustomerInfo update listener, and
  backend webhook integration (signature verification, don't trust
  client-reported entitlement state). Use whenever writing or reviewing
  code that checks subscription/entitlement status, presents a paywall,
  restores purchases, or handles RevenueCat webhooks on a backend.
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

# RevenueCat conventions

The recurring theme across most RevenueCat mistakes: treating entitlement
state as something the client owns and asserts, rather than something
RevenueCat is the source of truth for and the client/backend both merely
read. Everything below follows from that.

## Checking entitlement status

- **Check entitlements via `CustomerInfo`, not a hand-rolled flag.**
  `customerInfo.entitlements[id].isActive` is the actual check — don't
  cache your own "isPro" boolean somewhere and let it drift from what
  RevenueCat actually knows.
- **`getCustomerInfo()` is safe to call frequently** — the SDK caches the
  latest `CustomerInfo` and refreshes it in the background (roughly every 5
  minutes, or on purchase/restore), so most calls don't hit the network.
  Call it whenever the user is about to access something entitlement-gated,
  not just once at app launch.
- **A fresh install with no purchases yet has an *empty* `CustomerInfo`,
  not a "not entitled" error** — an entitlement simply won't be present in
  the dictionary rather than showing up as `false`. Code that only handles
  "entitlement present and inactive" and not "entitlement key absent
  entirely" will misbehave for new users.
- **Subscribe to CustomerInfo updates**, not just a one-time check at
  screen load — a user's entitlement can change from another device, a
  webhook-driven grant, or a background renewal, and the delegate/listener
  callback is how the UI stays correct without the user having to
  force-quit and reopen the app.

## Offerings and paywalls

- **Drive the paywall from `Offerings`, not hardcoded product identifiers.**
  The whole point of configuring products into an Offering on the
  RevenueCat dashboard is that the offer shown to a user can change
  remotely — a paywall that hardcodes a specific product ID instead of
  reading the current offering's packages defeats that and requires an app
  update to change pricing/packaging.
- A package can be included in an Offering purely for display (e.g. a
  consumable that doesn't map to any entitlement) — don't assume every
  package in an offering unlocks the same entitlement you're checking for.

## Restoring purchases — `restorePurchases` vs `syncPurchases`

These are not interchangeable, and picking the wrong one has a real UX
cost:

- **`restorePurchases()` can trigger OS-level sign-in prompts** and should
  only ever be called from explicit user interaction — a visible "Restore
  Purchases" button (paywall or settings screen), never automatically on
  app launch or in response to some other flow. Every app should have this
  button somewhere findable; it's the standard recovery path when a user's
  entitlement doesn't match their actual purchase (reinstalled the app,
  switched devices, changed app-user ID).
- **`syncPurchases()` is the programmatic equivalent that does not prompt**
  — reach for this when you need to trigger a re-sync from code (e.g. after
  detecting a mismatch) without surprising the user with a system dialog.
- When a restored purchase already belongs to a different app-user ID,
  RevenueCat decides whether to transfer it based on the configured
  transfer-behavior setting — don't assume a restore always succeeds
  cleanly for the currently-identified user without checking the resulting
  `CustomerInfo`.

## Backend integration — if the backend needs to know about entitlements

Skip this section if the backend never needs subscription awareness — not
every app needs server-side entitlement checks. If it does:

- **Prefer webhooks over polling RevenueCat's API per-request.** Calling
  the REST API on every premium-gated request adds latency and a scaling
  bottleneck; webhooks let RevenueCat push changes to the backend instead,
  keeping a local mirror of entitlement state that ordinary requests can
  check cheaply.
- **Verify every webhook.** Check the configured authorization header on
  every request, and — for real integrity guarantees, not just a shared
  secret in a header — enable HMAC signing and verify the
  `X-RevenueCat-Webhook-Signature` header (`t=<timestamp>,v1=<hmac_sha256>`,
  computed over `<timestamp>.<raw_json_body>`) before trusting the payload.
  An unverified webhook handler is a way for anyone who finds the URL to
  grant themselves entitlements.
- **Respond `200` quickly and defer processing** — RevenueCat expects a
  fast response and retries (up to 5 times, with increasing delay) on
  anything else; do the actual database update after sending the response,
  not before, so a slow downstream step doesn't look like a delivery
  failure and trigger needless retries.
- **Never trust a client-supplied entitlement flag** (`hasPremium: true` in
  a request body/header) as the backend's basis for access control — the
  backend's own webhook-synced state (or, failing that, a direct API call)
  is the source of truth; a client-asserted flag is trivially spoofable.
- `TEMPORARY_ENTITLEMENT_GRANT` is an edge case worth knowing about if the
  backend maintains its own entitlement mirror: RevenueCat can grant a
  short-lived (≤24h) entitlement when it temporarily can't validate a
  purchase with the store (e.g. a partial store outage), followed by either
  a real `INITIAL_PURCHASE` once validation succeeds or an `EXPIRATION` if
  it doesn't. If you're only using the SDK/API for entitlement checks this
  is already handled for you; only a backend keeping its own separate
  mirror needs to explicitly react to it.

## If something goes wrong

Before improvising a fix or contradicting something stated here, check
`references/edge-cases.md` — this may already be a documented, resolved
question. If it's genuinely new once you're done, follow the
self-improvement protocol above and add it there.
