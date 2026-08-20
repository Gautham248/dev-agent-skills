# revenuecat-conventions

An Agent Skill that gives a coding agent a sane baseline for working with
**RevenueCat** — grounded in the official documentation
(`revenuecat.com/docs`), fetched and read directly while writing this
skill, not recalled from training data alone.

It covers checking entitlements via `CustomerInfo` (including the
empty-CustomerInfo-on-fresh-install edge case), driving paywalls from
`Offerings` instead of hardcoded product IDs, the
`restorePurchases`-vs-`syncPurchases` distinction (one triggers OS prompts
and must be user-initiated, the other doesn't), and backend webhook
integration — signature verification, fast-response-then-defer processing,
and why a client-supplied entitlement flag is never a valid basis for
server-side access control.

## Who it's for

Anyone writing or reviewing subscription/entitlement-gated code, paywall
UI, purchase-restoration flows, or a backend's RevenueCat webhook handler.

## What it is

A single `SKILL.md` of guidance — no script.

## Install

Follows the open [Agent Skills](https://agentskills.io) layout. Drop the
`revenuecat-conventions/` folder into your agent's skills directory, same
as any other skill in this repo — see the root `README.md` for per-agent
paths.

## Usage

> Review this paywall — are we hardcoding product IDs instead of using Offerings?

> Should this restore button use restorePurchases or syncPurchases?

> Does this webhook handler verify the RevenueCat signature?

## License

See the repository this skill ships in.
