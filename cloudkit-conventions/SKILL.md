---
name: cloudkit-conventions
description: >
  CloudKit framework conventions grounded in Apple's official documentation
  and WWDC guidance (developer.apple.com/documentation/cloudkit,
  WWDC23 "Sync to iCloud with CKSyncEngine", WWDC21 "What's new in CloudKit",
  WWDC16 "CloudKit Best Practices"), fetched and read directly while writing
  this skill. Covers CKSyncEngine vs manual sync, record zones, private vs
  shared vs public database boundaries, CKShare sharing patterns, push
  subscriptions, and CKError handling (partial failures, retry-after,
  conflict resolution). Use whenever writing or reviewing Swift code that
  touches CloudKit — CKRecord/CKRecordZone modeling, sync engine setup,
  CKShare/sharing flows, CKDatabaseSubscription, or CKError handling.
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

# CloudKit conventions

CloudKit is eventually-consistent, asynchronous, and network-dependent by
nature — code that treats a save/fetch as instantaneous or guaranteed to
succeed is the single most common source of CloudKit bugs. Everything below
follows from taking that seriously: prefer the framework's own higher-level
primitives over hand-rolled state machines, and treat every operation as
something that can partially fail, arrive out of order, or need a retry with
a server-dictated delay.

## Sync architecture — prefer CKSyncEngine for new code

For any app targeting iOS 17 / macOS 14 or later that isn't already using
Core Data + `NSPersistentCloudKitContainer`, **use `CKSyncEngine`**
(introduced WWDC23) rather than hand-rolling `CKDatabaseSubscription` +
`CKFetchDatabaseChangesOperation`/`CKFetchRecordZoneChangesOperation` +
manual `CKServerChangeToken` caching. This is Apple's own current guidance,
not just a convenience: CKSyncEngine handles push-notification listening,
fetch scheduling, retry/backoff, and change-token bookkeeping for you — the
amount of code you write shrinks to "hand it the records you changed" and
"persist the records it hands you back."

- **Trust the scheduler.** CKSyncEngine batches and schedules sync
  operations automatically in response to push notifications and app state
  changes. Reach for its manual-sync API only for a genuine explicit-refresh
  use case (pull-to-refresh), not as the default way of triggering sync.
- You still own local persistence — CKSyncEngine syncs `CKRecord`s, not your
  app's model types directly. Your code converts to/from `CKRecord` at the
  boundary and owns the local store (Core Data, SQLite, or otherwise).
- **CKSyncEngine relies on remote push notifications to work correctly.**
  It cannot be meaningfully tested in Simulator — push registration doesn't
  work there. Test real sync behavior on physical devices/Macs.
- If you're already on `NSPersistentCloudKitContainer` (Core Data-integrated
  sync), that's a legitimate alternative that already includes conflict
  merging via `NSMergePolicy` — don't introduce `CKSyncEngine` alongside it
  for the same data; pick one sync mechanism per store.
- Only reach for the manual, low-level API (`CKDatabaseSubscription` +
  `CKFetchDatabaseChangesOperation` + hand-cached `CKServerChangeToken`) when
  you have a concrete reason CKSyncEngine doesn't fit — supporting pre-iOS 17,
  or genuinely bespoke sync semantics it doesn't offer a hook for. If you're
  reviewing code that does this, ask why CKSyncEngine wasn't used before
  treating the manual token/subscription plumbing as correct by default.

## Records and zones

- **Never rely on the default record zone** for anything you might want to
  share or subscribe to later. `CKDatabaseSubscription` does not fire for
  the default zone — custom zones only. Create a custom `CKRecordZone` up
  front for any data that's meaningfully "a collection," not as a
  retrofit once sharing becomes a requirement.
- **Use `CKRecord.Reference` with `action: .deleteSelf`/parent references**
  to model hierarchical relationships (e.g. a task belonging to a list) —
  this is what lets CloudKit treat a record hierarchy as one shareable unit
  when you build a `CKShare` off the root record. A plain reference field
  with no parent semantics is fine for relationships you don't intend to
  share as a unit.
- **Large binary data goes in `CKAsset`, not inline in a record field.**
  Records have a size ceiling; assets are stored and transferred separately
  and don't count against it the same way.
- Batched record modifications (`CKModifyRecordsOperation` / the async
  `modifyRecords(saving:deleting:)`) can be atomic per zone — a failure in
  one item can fail the whole batch (`.batchRequestFailed` on the
  otherwise-valid items). Don't assume a large multi-record save either
  fully succeeds or fails item-by-item without checking which zone/atomicity
  mode you're in.

## Private, shared, and public database — know the boundary

- **Private database**: the signed-in user's own data. This is where you
  create zones, save the user's own records, and where they own any
  `CKShare` records they create.
- **Shared database**: not a separate copy of data — it's the current
  user's *window* into records other people have shared with them via
  `CKShare`. You read/write through it according to the permissions the
  owner granted; you don't own the underlying zone.
- **Public database**: has no custom zones at all, which means no
  `CKDatabaseSubscription`, no zone-based atomic batching, and no
  zone-based sharing. It's the wrong choice for most per-user app data —
  reach for it only for genuinely global, non-per-user content.
- **A backend service cannot directly query a user's private/shared
  CloudKit data the way it queries your own Postgres/Prisma tables** — that
  data lives in the user's iCloud account, not your infrastructure. If a
  server-side component needs to know something about CloudKit-synced data,
  that has to arrive through a different signal your app explicitly sends
  (a webhook, an API call your app makes after sync) — don't assume or
  write code as if the backend can reach into CloudKit and read a user's
  zone.

## Sharing (CKShare)

- **Prefer zone-wide sharing** (create the `CKShare` with a
  `recordZoneID`, not a specific root record) when your data model already
  partitions cleanly into zones — introduced WWDC21, and Apple's current
  recommended default over root-record sharing for new designs. Root-record
  sharing (a `CKShare` whose root is a specific `CKRecord`, sharing that
  record's parent-reference hierarchy) is still correct when the data
  genuinely doesn't zone-partition — check the property is a zone-wide
  share via `CKRecordNameZoneWideShare` before assuming which flavor you're
  looking at.
- The share record is the single source of truth for participants and
  permissions — set `publicPermission` deliberately (defaults to `.none`,
  which is correct: don't grant access wider than intended by relying on a
  library default).
- **Accepting a share is a distinct flow from creating one**: implement
  `windowScene(_:userDidAcceptCloudKitShareWith:)` (or the equivalent
  scene/app-delegate hook) to handle `CKShare.Metadata` when a participant
  taps an invite link, and verify `containerIdentifier` matches your app's
  known container before proceeding — a mismatched container is a sign of
  a malformed or malicious link, not something to silently accept.
- A participant stops participating by deleting the root record from their
  shared database (or via `UICloudSharingController`'s UI) — this does not
  delete the owner's original data, only the participant's access to it.
  Don't write code that assumes "participant deleted their copy" means "the
  data is gone."

## Push subscriptions

- `CKDatabaseSubscription` (subscribe to all changes in an entire private
  or shared database) is the subscription type most apps want — prefer it
  over per-query/per-zone subscriptions unless you have a narrow, specific
  reason to scope more tightly.
- Use a **silent push** (`shouldSendContentAvailable = true` on
  `CKNotificationInfo`) for sync-triggering notifications, not a
  user-visible alert — the alert is for cases where you actually want the
  user to see something immediately, which most sync events aren't.
- Requires `registerForRemoteNotifications()`, the Push Notifications +
  CloudKit + Background Modes (remote notifications) entitlements, and — as
  above — a real device to test, since Simulator can't register for remote
  push.
- If you're using `CKSyncEngine`, it manages subscription setup and
  listening for you — don't also hand-roll a `CKDatabaseSubscription` for
  the same data; that's redundant and a likely source of double-fetching.

## CKError handling

`CKError` is what you actually inspect — don't treat CloudKit failures as
opaque `Error`s to log and swallow. Key codes and what they mean for your
retry logic:

- **`.partialFailure`** — the operation as a whole "succeeded" but
  individual items failed. Inspect `error.partialErrorsByItemIDKey` (or the
  async API's per-item results) to find out *which* records failed and
  *why* — don't treat the whole batch as failed or as succeeded.
- **`.zoneBusy` / `.serviceUnavailable` / `.requestRateLimited`** — transient,
  server-side, and **carry a `retryAfterSeconds` you must respect**. Read
  that value and wait exactly that long before retrying; don't retry
  immediately, and don't invent your own fixed backoff that ignores what
  the server told you.
- **`.networkUnavailable` / `.networkFailure`** — retry once connectivity is
  actually back (e.g. via a network-reachability observer), not on a timer
  that fires regardless of whether the network recovered.
- **`.notAuthenticated`** (no signed-in iCloud account, or account changed) —
  degrade the relevant features gracefully rather than alerting/crashing;
  listen for `CKAccountChangedNotification` to know when an account becomes
  available again and re-enable those features then.
- **`.serverRecordChanged`** (an optimistic-concurrency conflict — someone
  else modified the record since you fetched it) — resolve deliberately
  using the record's `recordChangeTag` and an explicit merge/save policy;
  don't blindly force-overwrite with your local copy, and don't blindly
  discard it in favor of the server's, unless one of those really is
  correct for the data in question.
- **`.quotaExceeded`** — a real, user-facing condition (their iCloud storage
  is full), not a bug to retry past — surface it, don't loop on it.

## Testing and environments

- CloudKit has **separate development and production environments**
  (controlled by the `com.apple.developer.icloud-container-environment`
  entitlement) with independently deployed schemas. A `.zoneNotFound` or
  schema-mismatch error that only reproduces in TestFlight/production and
  not locally almost always means the zone or schema change was deployed to
  dev but not pushed to production — check the CloudKit Dashboard before
  assuming it's a code bug.
- Push-notification-dependent features (`CKSyncEngine`, `CKDatabaseSubscription`)
  cannot be fully exercised in Simulator — verify sync behavior on real
  hardware before considering it tested.

## If something goes wrong

Before improvising a fix or contradicting something stated here, check
`references/edge-cases.md` — this may already be a documented, resolved
question. If it's genuinely new once you're done, follow the
self-improvement protocol above and add it there.
