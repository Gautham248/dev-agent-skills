# App Store Connect field reference

**Snapshot:** 2026-11-26. Each section ends with its source flags (see `sources.md`).

**Limits whose unit is open are enforced at the stricter reading** (both characters and bytes) by
`scripts/validate_metadata.py`. The validator's limit table must match this file. When you change one,
change the other.

---

## Roles

| Task | Roles that can do it |
|---|---|
| Submitting a version, privacy answers, export documentation, in-app purchases | Account Holder, Admin or App Manager |
| EU trader status (DSA) and the medical device declaration | Account Holder or Admin |
| Accessibility labels | Also Finance and Marketing |

## Account prerequisites (before the first submission)

- **Apple Developer Program License Agreement:** the current version accepted. A new revision was
  posted 2026-10-13 and must be accepted in the account. (search-snippet)
- **Paid Apps agreement, tax forms and banking:** needed for paid apps and in-app purchases. Without
  them, the storefront status reads "Missing Tax Form" or "Cannot Sell App". (search-snippet)
- **EU trader status:** see `regional-requirements.md`.

## App Information (app level)

These fields can be entered at any time but are submitted for review with the next version. (Apple
footnote, search-snippet.)

| Field | Limit / rule | Gotchas | Flag |
|---|---|---|---|
| Name | 2–30 characters | Must be unique on the store. No prices or other apps' names (2.3.7). Editable until submitted. | max verified (2.3.7); min search-snippet |
| Subtitle | 30 characters | No prices, no references to other apps, no unverifiable claims (2.3.7). | verified (product page) |
| Bundle ID | must match Xcode | Can't change after a build is uploaded. | search-snippet |
| SKU | letters, digits, `-`, `.`, `_`; can't start with `-`, `.` or `_` | Internal only. Can't change after the app is created. | search-snippet |
| Primary language | from the list | Sets the default metadata language. Changeable. | search-snippet |
| Primary / secondary category | from the list; games can add 1–2 subcategories | Pick the most accurate; Apple may change it (2.3.5). Search indexes both. | verified |
| Content Rights | declaration | Third-party content requires the rights (5.2). | search-snippet |
| Age Rating | questionnaire | See `age-rating.md`. Applies across platforms. | verified |
| Made for Kids | age band | Only when the calculated rating is 4+ or 9+. Can't be changed once approved. | search-snippet |
| License Agreement | Apple standard EULA or custom | A custom EULA's minimum age can force a rating override. | search-snippet |
| Privacy Policy URL | URL | **Required** for iOS. Must also be reachable inside the app (5.1.1(i)). | verified |
| Privacy Choices URL | URL | Optional. | verified |
| App Store Server Notifications URL | URL | Optional; only for apps with in-app purchases. | search-snippet |
| Digital Goods and Services questionnaire | Yes/No, then payment options per region | Appears only for some apps. If it doesn't appear, no action is needed. EU answers lock for 12 months. | search-snippet |

## Version page (per version)

| Field | Limit / rule | Gotchas | Flag |
|---|---|---|---|
| Screenshots | 1–10 per size class | See `screenshots-and-previews.md`. Can't be edited in "Ready for Review". | verified |
| App previews | up to 3 per size class and language | See `screenshots-and-previews.md`. | search-snippet |
| Promotional text | 170 characters | Changeable at any time without a new version. Not indexed for search. | verified |
| Description | 4000 characters, plain text (no HTML) | Must match the app (2.3). If features need an extra purchase, say so (2.3.2). Name framework use, e.g. HealthKit (2.5.1). | search-snippet |
| Keywords | **100 bytes** (comma-separated) | No spaces after commas. Don't repeat words from the name, subtitle or category; avoid plurals of included words, "app", trademarks and competitor names. Non-ASCII uses 2–3 bytes per character. | search-snippet (unit) |
| Support URL | URL with protocol | **Required.** Must lead to real contact information (1.5). A broken link is a top rejection cause. | verified |
| Marketing URL | URL with protocol | Optional. | search-snippet |
| Version | string | Shown on the product page. Must match the build's marketing version. | search-snippet |
| Copyright | e.g. "2026 Example, Inc." | Apple adds the © symbol. | search-snippet |
| What's New | 4000 characters | **Updates only.** Describe significant changes (2.3.12). A generic note is fine for bug fixes. | search-snippet |
| Routing app coverage file | `.geojson`, a single MultiPolygon | Routing apps only. | search-snippet |

## App Review Information (per version, not shown to customers)

| Field | Limit / rule | Gotchas | Flag |
|---|---|---|---|
| Contact name, phone, email | Phone in international format starting with `+` and the country code | Must be current (Before You Submit). | search-snippet |
| Sign-in required + username / password | A demo account that **must not expire** | Credentials that expire before review starts cause rejection. Add more account types in Notes. Provide an expired-subscription account for auto-renewing subscriptions. Put any MFA code in Notes. | verified (complete-review) |
| Notes | **4000 bytes** | Concept, what changed and where, devices tested, external services, regional differences, how to reach in-app purchases. See `review-notes-and-demo-accounts.md`. | search-snippet (unit) |
| Attachment | file | Required documentation for regulated features, or a hardware demo video (a real video, not a screen recording). | verified |

## Accessibility Nutrition Labels

- **Voluntary for now.** Apple says it will become required for new apps and updates, with "ample
  time" given; no date is set.
- **Nine features:** VoiceOver, Voice Control, Larger Text (200% or more), Dark Interface,
  Differentiate Without Color Alone, Sufficient Contrast, Reduced Motion, Captions, Audio
  Descriptions.
- **Declare a feature only if users can complete all common tasks with it.** Answers are given per
  device (Yes/No, then the features).
- **Accessibility URL:** optional. Published answers can take up to 24 hours to show.

Flag: search-snippet.

## In-app purchases and subscriptions

Flag for the field rows below: **verified** (ASC in-app purchase information page).

| Field | Limit / rule |
|---|---|
| Reference Name | Up to 64 characters. Editable at any time without review. |
| Product ID | Up to 100 characters: letters, digits, `-`, `.`, `_`. Can't be edited after saving, and **can't be reused**, even after deletion. iOS and macOS need separate IDs. |
| Display Name (localizable) | 2–30 characters |
| Description (localizable) | Up to 45 characters |
| Review Notes | Up to 4000 **characters** |
| Promotion / win-back image | 1024×1024 JPG or PNG, 72 dpi, RGB, flattened, no rounded corners |
| App Review screenshot | Must meet a supported screenshot spec. Can be replaced but **not removed** once uploaded. |

**Conflict:** the product-page article gives 35 characters for the display name and 55 for the
description. Use the field reference above (30 and 45) and mention the conflict.

**Submission rules** (verified unless marked):

- The **first** consumable, non-consumable, auto-renewable subscription and non-renewing subscription
  must each be submitted **with a new app version**. After the first of a type is approved, more of
  that type can be submitted on their own, as long as the app has an approved version.
- Each new subscription group must be submitted with at least one of its subscriptions.
- Up to 200 items per submission. (search-snippet)
- In-app purchases with content hosting can no longer be submitted.
- In-app purchases aren't supported on Apple Watch.
- Localized changes need review; the old text stays live until the new text is approved.
- Every configured in-app purchase must be visible and working for the reviewer, or the notes must say
  why it isn't (2.1(b)).

## Submission mechanics

Flag: search-snippet.

1. **Add the version to a submission.** Apps, then the app, then the version in the sidebar.
   - Confirm the correct **Build** is attached.
   - Click **Add for Review**, choose a draft submission or create one.
   - The status becomes "Ready for Review".
2. **Add other items** to the same draft: in-app purchases, subscriptions, in-app events, custom
   product pages.
3. **Submit for Review.** The status becomes "Waiting for Review".
4. **Limits on parallel submissions:**
   - one app-version submission under review per platform at a time
   - at most two submissions in review: one with a version, and one with items only
