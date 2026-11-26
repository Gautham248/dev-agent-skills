# After you submit

**Snapshot:** 2026-11-26.

**Sources:**
- ASC Help app and submission statuses, release options and phased release (search-snippet)
- App Review overview (verified)
- Review status page (search-snippet)
- Appeal page (verified)

---

## Review time

- **Use this wording:** Apple's goal is to review **at least 50% of submissions within 24 hours and
  90% within 48 hours**. Source: `/help/app-review/after-submitting-for-review/review-status`.
- **Older, conflicting wording:** `/distribute/app-review/` says "90% in under 24 hours". Treat it as
  superseded.
- **What slows a review:** complex apps take longer, as do repeated rejections under the same
  guideline and attempts to game review.
- **Order:** submissions aren't necessarily reviewed in the order they were sent.

## Statuses

**App and version statuses:**

| Status | Meaning / action |
|---|---|
| Prepare for Submission | Still being edited |
| Ready for Review | Added to a draft submission, not sent yet; media is locked |
| Waiting for Review | Received by Apple |
| In Review | Being reviewed. You can remove it from review (it becomes Developer Rejected). |
| Waiting for Export Compliance | Encryption documentation under review |
| Invalid Binary | The build fails a binary requirement; upload a new build |
| Accepted | This item passed, but others in the submission didn't; nothing publishes until all pass |
| Pending Developer Release | Approved; waiting for you to release (manual release) |
| Pending Apple Release | Waiting for the public OS release |
| Processing for Distribution | Going live within 24 hours |
| Ready for Distribution | Live, as long as the agreements are in effect |
| Rejected | See the App Review message |
| Metadata Rejected | Fix the metadata, then reply to App Review. No new build needed. |
| Developer Rejected | You pulled it; resubmit when ready |

**Submission statuses:** Waiting for Review, In Review, Processing, **Unresolved Issues** (one or more
items rejected; fix them or remove the items and continue with the rest), Rejected.

**Storefront problems to watch for:** Missing Tax Form, Cannot Sell App, ICP Filing Number Missing
(China mainland), Missing Game registration number (Vietnam).

## Responding to a rejection

1. **Read the App Review message** in App Store Connect (Apps, then App Review, then Messages). It
   names the guideline.
2. **If it's a misunderstanding,** reply in the message thread first with specifics: steps,
   credentials, a video.
3. **If it's a real issue,** map the guideline to the packet section and fix only that.
   - Metadata Rejected: edit the metadata and reply.
   - Binary issue: upload a new build and resubmit.
4. **Bug-fix submissions:** an update to a live app that fixes bugs isn't held back for unrelated
   guideline issues, except legal or safety ones. Accept the offer in the message and commit to
   fixing the issue in the next submission.

## Appeal to the App Review Board

- **When to appeal:** you believe the app complies and the rejection is a misunderstanding or unfair.
  - Not for: requests for more information, status checks, expedites, or reinstating a terminated
    account.
- **One appeal per rejected submission,** covering all cited guidelines.
- **Don't appeal after resubmitting** a fixed build.
- **What a strong appeal contains:** the specific guideline, then a point-by-point explanation of how
  the app complies, pointing to the demo account and screenshots or a video.
- An appeal doesn't guarantee reversal.

## Expedited review

For real urgency only. Request it through the Contact Us form, not an appeal. Abuse can get future
requests refused.
- **Critical bug fix:** include steps to reproduce it on the current live version.
- **Time-sensitive event:** include the event, its date, and your link to it.

## Release options (per version)

| Option | Behaviour |
|---|---|
| Manually release this version | Waits in Pending Developer Release. Release it with "Release This Version". Apple sends a reminder after 30 days. |
| Automatically release this version | Goes live once approved |
| Automatically release after App Review, no earlier than a date | Goes live once approved, but not before the date |

- Going live can take **up to 24 hours** to reach every storefront.
- When a pre-order is set up, the release is forced to manual.

## Phased release (updates only)

- **Schedule:** 7 days, reaching users with automatic updates in this order:

  | Day | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
  |---|---|---|---|---|---|---|---|
  | Share | 1% | 2% | 5% | 10% | 20% | 50% | 100% |

- **Pausing:** up to **30 days in total**, any number of times. It resumes on the day it stopped.
- **"Release to All Users"** finishes the rollout early.
- Manual App Store downloads always get the new version, regardless of the rollout.
- Removing the app from sale ends the phased release.
- **Recommend it for every update** unless the developer needs an immediate full rollout.
