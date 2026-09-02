# cloudkit-conventions

An Agent Skill that gives a coding agent a sane baseline for working with
**CloudKit** — grounded in Apple's official documentation and WWDC guidance
(`developer.apple.com/documentation/cloudkit`, WWDC23 "Sync to iCloud with
CKSyncEngine", WWDC21 "What's new in CloudKit", WWDC16 "CloudKit Best
Practices"), fetched and read directly while writing this skill.

It covers when to reach for `CKSyncEngine` vs. hand-rolled sync, record/zone
modeling, the private/shared/public database boundary (including the
backend-can't-query-CloudKit-directly boundary), `CKShare` sharing patterns
(zone-wide vs. root-record), push subscriptions, and `CKError` handling —
partial failures, server-dictated retry delays, conflict resolution, and
account-availability changes.

## Who it's for

Anyone writing or reviewing Swift code that touches CloudKit — sync engine
setup, `CKRecord`/`CKRecordZone` modeling, sharing flows, subscriptions, or
error handling. Assumes `swift-conventions` as the language-level layer
underneath it; this skill is CloudKit-specific on top of that.

## What it is

A single `SKILL.md` of guidance — no script. Point your agent at it while it
writes or reviews CloudKit code; it will reach for `CKSyncEngine` over manual
token plumbing on iOS 17+, model zones and sharing correctly from the start,
and handle `CKError` cases (especially `retryAfterSeconds`) instead of
looping blindly.

## Install

Follows the open [Agent Skills](https://agentskills.io) layout. Drop the
`cloudkit-conventions/` folder into your agent's skills directory, same as
any other skill in this repo — see the root `README.md` for per-agent paths.

## Usage

> Review this CloudKit sync code — are we handling partial failures?

> Set up sharing for this record type — should this be zone-wide or root-record sharing?

> Does this retry logic respect CloudKit's retry-after?

## License

See the repository this skill ships in.
