# Sources: appstore-submission-guide

**Snapshot date:** 2026-11-26. All pages below were fetched or read on this date unless noted.
**App Review Guidelines:** "Last Updated: October 16, 2026" (recorded during the revision 1 research pass).

Flags:
- **verified**: read on the page itself on the snapshot date.
- **search-snippet**: confirmed from Apple's page text as returned by a search engine. Re-read the full
  page before relying on it for edge cases.
- **secondary**: from press coverage that quotes Apple. Use it only where an Apple page is linked.
- **open**: not yet verified.

When the freshness check finds a newer page, append a dated entry to `edge-cases.md` and update the
matching row here.

---

## Freshness-check URLs (fetch on every run)

| URL | Why |
|---|---|
| https://developer.apple.com/app-store/review/guidelines/ | "Last Updated" date |
| https://developer.apple.com/news/upcoming-requirements/ | Dated upload requirements |
| https://developer.apple.com/ios/submit/ | April 2027 minimums (**not** listed on Upcoming Requirements) |
| https://developer.apple.com/news/ | New announcements (age ratings, regional laws) |
| https://developer.apple.com/help/app-review/ | Review status and timing wording |

---

## Screenshot specifications (verified)

URL: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/

- 1–10 screenshots per device size; `.jpeg`, `.jpg` or `.png`.
- Images can't include alpha channels or transparencies.
- **Required:** iPhone with Dynamic Island (medium display), plus iPad 13" if the app supports iPadOS.
- **Ambiguity:** the "iPhone with Face ID (large display)" section says it is required if the app runs
  on iPhone and Dynamic Island (large) screenshots aren't provided. That conflicts with the summary
  above. Treat Dynamic Island (medium) as required and surface the conflict.
- If the UI is consistent across sizes, provide the highest required resolution and App Store Connect
  scales down.
- **Ambiguous dimensions:** 2048×2732 is listed for both 13" and 12.9" iPad. The checker needs a folder
  or manifest convention.

Every size below is listed in portrait; the landscape size is the same pair swapped, unless a row says
otherwise.

| Class | Sizes (portrait) | Requirement / fallback |
|---|---|---|
| iPhone Duo | 1398×2034 (outer), 2007×2853 (inner) | Required from April 2027 for apps using the iOS 27.1 SDK or later. Adds a "made for iPhone Duo" badge. |
| iPhone Dynamic Island (large) | 1260×2736, 1290×2796, 1320×2868 | Falls back to scaled Face ID (large) |
| iPhone Face ID (large) | 1284×2778, 1242×2688 | See ambiguity above |
| iPhone Dynamic Island (medium) | 1179×2556, 1206×2622 | **Required** (summary). Falls back to scaled Face ID (large) |
| iPhone Face ID (medium) | 1170×2532, 1125×2436, 1080×2340 | Falls back to scaled Dynamic Island (medium) |
| iPhone Home Button (large) | 1242×2208 | Falls back to scaled Face ID (medium) |
| iPhone Home Button (medium) | 750×1334 | Falls back to scaled Home Button (large) |
| iPhone 4" | 640×1096, 640×1136 | Landscape: 1136×600, 1136×640 |
| iPhone 3.5" | 640×920, 640×960 | Landscape: 960×600, 960×640 |
| iPad 13" | 2064×2752, 2048×2732 | **Required if the app runs on iPad** |
| iPad 12.9" | 2048×2732 | Falls back to scaled 13" |
| iPad 11" | 1488×2266, 1512×2316, 1668×2420, 1668×2388, 1640×2360 | Falls back to scaled 13" |
| iPad 10.5" | 1668×2224 | Falls back to scaled 12.9" |
| iPad 9.7" | 1536×2008, 1536×2048, 768×1004, 768×1024 | Landscape: 2048×1496, 2048×1536, 1024×748, 1024×768 |

**Not covered by this skill, recorded for detection:**

| Platform | Sizes | Note |
|---|---|---|
| Mac | 1280×800, 1440×900, 2560×1600, 2880×1800 | 16:10 aspect ratio |
| Apple TV | 1920×1080, 3840×2160 | |
| Apple Vision Pro | 3840×2160 | |
| Apple Watch | 422×514, 410×502, 416×496, 396×484, 368×448, 312×390 | Use the same size consistently across all localizations. Needed if a watch app is bundled. |

## App preview specifications (verified via search-snippet)

URL: https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications

- Formats: H.264 or ProRes 422 (HQ only).
- Maximum file size: 500 MB. Length: 15–30 s. Default poster frame: 5 s.
- Portrait or landscape (macOS and tvOS previews are landscape only).

## Age ratings (verified)

URL: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/

**Values:** 4+, 9+, 13+, 16+, 18+, Unrated.
- An Unrated app can't be published on the App Store, though it may be published on alternative app
  marketplaces or websites.
- Unrated is triggered by graphic sexual content and nudity, or by prolonged graphic or sadistic
  realistic violence.
- Ratings may vary by OS version: the new values apply on OS 26 or later.

**Questionnaire categories:**
- In-App Controls: Parental Controls, Age Assurance.
- Capabilities:
  - Unrestricted Web Access, User-Generated Content
  - Social Media, Social Media Disabled for Users Under 13 (requires at least a Declared Age Range API
    check)
  - Messaging and Chat, Shared Location, Advertising
- Mature Themes: Profanity or Crude Humor; Horror/Fear; Alcohol, Tobacco or Drug Use; Dating and
  Relationships (including a virtual companion engaging in sexual or romantic content, scripted or
  generated).
- Medical or Wellness: Medical or Treatment Information; Health or Wellness Topics.
- Sexuality or Nudity: Mature or Suggestive Themes; Sexual Content or Nudity; Graphic Sexual Content
  and Nudity.
- Violence: Cartoon or Fantasy; Realistic; Prolonged Graphic or Sadistic; Guns or Other Weapons.
- Chance-Based Activities: Gambling; Simulated Gambling; Contests; Loot Boxes.

**Notable mappings:**
- Dating and Relationships gives 18+.
- Social media gives 13+.
- Unrestricted web access gives 16+.
- Gambling gives 18+.
- Loot boxes give 9+, but 16+ in Australia and 18+ in Brazil (see below).

**Regional values:**
- **Australia:** loot boxes give 16+; infrequent simulated gambling gives R 18+.
- **Brazil:**
  - Official MJSP ratings override self-ratings.
  - Self-rated values: AL, A6, A10, and higher.
  - Fixed-odds betting apps need a Brazilian SPA license; put the license details in App Review Notes
    and attach the documents. See guideline 5.3.4.
- **Korea, Vietnam:** see the gap-closing pass below. Korea is All/12+/15+/19+; Vietnam is
  00+/12+/16+/18+ (search-snippet).

## New age-rating descriptors (verified via Apple news, search-snippet)

URL: https://developer.apple.com/news/?id=yxkh08us

- Shared Location and Dating and Relationships must be declared in the questionnaire.
- The questionnaire changes from 2026-11-16 (secondary: 9to5Mac, MacRumors).
- Declarations are required on the next update or questionnaire change, and **for all apps by
  2027-01-12**.
- Dating and Relationships gives a minimum of 18+. Shared Location may not change the minimum rating
  in some regions.
- Brazil: A16 for Shared Location, A18 for Dating and Relationships. A lower official rating can be
  requested from the MJSP (for example, parent-child location sharing).

## Upcoming requirements (verified)

URL: https://developer.apple.com/news/upcoming-requirements/

| Since | Requirement |
|---|---|
| 2026-09-09 | iOS and iPadOS apps uploaded to App Store Connect must target iOS 13 or later |
| 2026-04-28 | Build with Xcode 26 or later, using the iOS, iPadOS, tvOS, visionOS or watchOS 26 SDK |
| 2026-01-31 | Responses to the updated age-rating questions were required to avoid interrupted updates |
| 2025-02-17 | Apps without DSA trader status are removed from the EU App Store until status is verified |
| 2024-10-16 | DSA trader status required to submit updates for apps distributed in the EU |
| 2024-05-01 | Approved reasons required for listed APIs (including in third-party SDKs) to upload |
| 2023-08-16 | Game Center entitlement and App Store Connect configuration required for Game Center features |

## April 2027 minimums (search-snippet)

URL: https://developer.apple.com/ios/submit/ (also https://developer.apple.com/news/?id=k1mtkt1k)

- From April 2027, iOS and iPadOS apps must be built with the iOS and iPadOS 27 SDK or later **and
  target iOS 15 or later**.
- tvOS, visionOS and watchOS apps must be built with their 27 SDKs.
- The news post omits the iOS 15 target; the `/ios/submit/` page includes it.

## Export compliance (verified, plus search-snippet)

URLs:
- https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance (verified)
- https://developer.apple.com/help/app-store-connect/manage-app-information/determine-and-upload-app-encryption-documentation (search-snippet)
- https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption (search-snippet)
- https://help.apple.com/xcode/mac/current/en.lproj/dev0dc15d044.html (search-snippet)

Facts:
- **When it applies.** Any app that uses, accesses, contains, implements or incorporates encryption
  needs an export compliance determination. That includes standard algorithms, the OS's crypto, and
  proprietary algorithms.
- **The developer's responsibility.** It is the developer's job to decide whether the EAR requires a
  CCATS. France separately controls encryption apps; banking and medical apps are exempt there.
- **No documentation required.** Set `ITSAppUsesNonExemptEncryption` in Info.plist to skip the
  questions.
- **Documentation required.**
  - Upload in the App Encryption Documentation section before submitting for review.
  - Fill in the App Description field and set availability first.
  - Apple expects about **two business days** to clear complete information.
  - After approval, add the issued key as `ITSEncryptionExportComplianceCode`.
- **OS-provided encryption only.** No documentation is needed. An industry-standard algorithm not
  provided by the OS needs the French declaration only when distributing in France.

## In-App Purchase information (verified)

URL: https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-information

| Field | Limit / rule |
|---|---|
| Reference Name | Up to 64 characters; editable at any time without review |
| Product ID | Up to 100 characters: letters, numbers, hyphens, periods, underscores. Not editable after saving; never reusable within the app, even after deletion. iOS and macOS need separate IDs. |
| Review Notes | Up to 4000 **characters** |
| Image (promotion, win-back) | JPG or PNG, 1024×1024, 72 dpi, RGB, flattened, no rounded corners |
| App Review Screenshot | Must meet a supported screenshot spec; can be updated but not removed once uploaded |
| Display Name (localizable) | 2–30 characters |
| Description (localizable) | Up to 45 characters |

Localized changes require review; the existing text stays live until the new text is approved.

## Review times (verified via search-snippet; Apple's pages conflict)

- https://developer.apple.com/help/app-review/after-submitting-for-review/review-status: the goal is at
  least 50% of submissions within 24 hours and 90% within 48 hours. **Use this one.**
- https://developer.apple.com/distribute/app-review: says 90% of submissions are reviewed in under
  24 hours on average. This is older wording.

## US state age-assurance laws (Apple news, search-snippet)

| URL | Fact |
|---|---|
| https://developer.apple.com/news/?id=btkirlj8 | Texas SB2420 announced, initially effective 2026-01-01 |
| https://developer.apple.com/news/?id=8jzbigf4 | A district court injunction suspended enforcement of SB2420 |
| https://developer.apple.com/news/?id=sg176nne | 2026-06-03: the injunction was lifted. New Texas accounts are subject to the law. Implement the Declared Age Range API, the Significant Change API (PermissionKit), the StoreKit age rating property and App Store Server Notifications. |
| https://developer.apple.com/news/?id=f5zj08ey | Utah from 2026-05-06 and Louisiana from 2026-07-01 for new accounts. Brazil: loot boxes give 18+. Also covers Australia and Singapore. |

The Declared Age Range API is available on iOS 26, iPadOS 26 and macOS 26 or later.

## Japan MSCA (Apple Newsroom, search-snippet)

URL: https://www.apple.com/newsroom/2025/12/apple-announces-changes-to-ios-in-japan/ (regional mirrors
were read; re-read the US URL)

- App Store apps in Japan may offer alternative payment processing and/or link out to a website.
  These are always shown alongside In-App Purchase.
- Users under 18 must pass a parental gate before using alternative payments or link-outs.
- Users under 13 can't be sent to a website for transactions.
- Kids Category apps can't link out for transactions.
- Business terms (commissions) changed. **Out of scope** for the packet: link to the newsroom post.

---

## Gap-closing pass (2026-11-26, build day)

These items were open in revision 2 and were re-fetched before the reference files were written.
"search-snippet" here means the text came from a model summary of the Apple page, not a verbatim
read. Confirm it in a browser before treating it as settled.

| Item | Result | URL | Flag |
|---|---|---|---|
| Keyword limit unit | "up to 100 bytes" | https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information | search-snippet |
| App Review Notes limit | "up to 4000 bytes" | same | search-snippet |
| App name limit | At least 2 and no more than 30 characters (summary). Guideline 2.3.7 verbatim: "App names must be limited to 30 characters." | https://developer.apple.com/help/app-store-connect/reference/app-information/app-information | search-snippet (min); verified (max) |
| `NSPrivacyCollectedDataTypes` inner keys | `NSPrivacyCollectedDataType` (string), `NSPrivacyCollectedDataTypeLinked` (bool), `NSPrivacyCollectedDataTypeTracking` (bool), `NSPrivacyCollectedDataTypePurposes` (array of strings). The string constants are **not** listed in the article body. | https://developer.apple.com/tutorials/data/documentation/bundleresources/describing-data-use-in-privacy-manifests.json | verified (keys); open (constants) |
| Korea age ratings | All, 12+, 15+, 19+. Frequent or intense simulated gambling is available in Korea only with an RCN. | https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/ | search-snippet |
| Vietnam age ratings | 00+, 12+, 16+, 18+ | same | search-snippet |
| Required iPhone screenshot class | "At least one screenshot for iPhone with Dynamic Island (medium display)". Face ID (large) is "Required if app runs on iPhone and screenshots for iPhone with Dynamic Island (large display) aren't provided." | screenshot-specifications page | search-snippet; conflict stands |
| US external purchase links | 3.1.1(a): entitlements "are not required for developers to include buttons, external links, or other calls to action in their United States storefront apps." Outside the US storefront, no CTAs to non-IAP purchasing without an entitlement. 3.1.3(a) repeats the US exemption for reader apps. | https://developer.apple.com/app-store/review/guidelines/ | search-snippet |
| Required / Localized / Editable marks | Column headers verified; the check marks can't be read through the fetch tool | required-localizable-and-editable-properties page | open |

---

## Revision 1 sources (2026-11-26)

These pages were read in the first research pass and back the reference files listed with each
group. Flags are as recorded in that pass.

**App Review and guidelines**

All of these back `metadata-guidelines.md`, `review-notes-and-demo-accounts.md` and
`after-submission.md`.

| URL | Flag |
|---|---|
| https://developer.apple.com/app-store/review/guidelines/ (all sections, "Last Updated: October 16, 2026") | verified (long page; some sections summarized) |
| https://developer.apple.com/news/?id=92th7e5i (Oct 16, 2026 guideline changes: 2.3.14, 2.5.19, 1.2, 3.1.1(a)) | verified |
| https://developer.apple.com/distribute/app-review/ (common rejections, appeals, expedite, bug-fix submissions, appointments) | verified |
| https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review | verified |
| https://developer.apple.com/help/app-review/after-submitting-for-review/appeal-to-the-app-review-board | verified |
| https://developer.apple.com/app-store/submitting/ (pre-submission list, April 2027 minimums) | verified |

**App Store Connect**

| URL | Backs | Flag |
|---|---|---|
| .../help/app-store-connect/reference/app-information/platform-version-information | `asc-field-reference.md` | search-snippet |
| .../help/app-store-connect/reference/app-information/app-information ("App and compliance information") | `asc-field-reference.md` | search-snippet |
| .../help/app-store-connect/manage-submissions-to-app-review/submit-an-app | `SKILL.md` form walk | search-snippet |
| .../help/app-store-connect/manage-submissions-to-app-review/overview-of-submitting-for-review | `after-submission.md` | search-snippet |
| .../help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase | `asc-field-reference.md` (first IAP must ship with a version) | verified (key sentences) |
| .../help/app-store-connect/reference/app-information/app-and-submission-statuses | `after-submission.md` | search-snippet |
| .../help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option | `after-submission.md` | search-snippet |
| .../help/app-store-connect/update-your-app/release-a-version-update-in-phases | `after-submission.md` | search-snippet |
| .../help/app-store-connect/manage-app-information/manage-app-privacy | `app-privacy-labels.md` | search-snippet |
| .../help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels (and manage page) | `asc-field-reference.md` | search-snippet |
| .../help/app-store-connect/manage-app-information/declare-regulated-medical-device-status | `regional-requirements.md` | search-snippet |
| .../help/app-store-connect/manage-app-information/complete-the-digital-goods-and-services-questionnaire | `asc-field-reference.md` | search-snippet |
| .../help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements | `regional-requirements.md` | search-snippet |
| .../help/app-store-connect/manage-app-information/set-an-app-age-rating | `age-rating.md` | verified (top of page) |

**Privacy and accounts**

| URL | Backs | Flag |
|---|---|---|
| https://developer.apple.com/app-store/app-privacy-details/ | `app-privacy-labels.md` | verified (full page) |
| https://developer.apple.com/tutorials/data/documentation/bundleresources/privacy-manifest-files.json | `app-privacy-labels.md` | verified |
| https://developer.apple.com/tutorials/data/documentation/bundleresources/describing-use-of-required-reason-api.json (and the `nsprivacyaccessedapitype` JSON) | `app-privacy-labels.md` (reason codes) | verified |
| https://developer.apple.com/support/third-party-SDK-requirements/ | `app-privacy-labels.md` (SDK list) | verified |
| https://developer.apple.com/support/offering-account-deletion-in-your-app/ | `metadata-guidelines.md` (5.1.1(v)) | verified |

**Store presence**

| URL | Backs | Flag |
|---|---|---|
| https://developer.apple.com/app-store/product-page/ | `asc-field-reference.md` (name, subtitle, promo, keywords guidance) | verified |
| https://developer.apple.com/app-store/search/ | `asc-field-reference.md` (keyword rules) | verified |
| https://developer.apple.com/app-store/subscriptions/ | `metadata-guidelines.md` (3.1.2 disclosure) | verified (top); summary below the cutoff |

---

## Open gaps (not yet verified)

- ASC Help "Required, localizable, and editable properties": the marks per field. Use a browser.
- Privacy-manifest data-type and purpose string constants. Use Xcode's privacy-manifest editor, or
  Apple's "describing data use" page in a browser.
- Keyword (100 bytes) and App Review Notes (4000 bytes) units: search-snippet only. Validators enforce
  the stricter reading, both characters and bytes.
- The screenshot "required class" conflict. Recommend supplying both Dynamic Island (medium) and
  (large).
- The current EU alternative terms (guideline 3.1.1(a) entitlements by storefront).
- Schedule 2 of the Apple Developer Program License Agreement (subscription disclosure wording).