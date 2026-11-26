# Feature plan: App Store submission guide (companion to apple-appstore-reviewer)

**Repository:** dev-agent-skills (local checkout, branch `feat/expand-app-store-review-skill`)
**Requested by:** Gautham Krishna N
**Date:** 2026-11-26
**Research snapshot:** Apple pages read 2026-11-26. App Review Guidelines "Last Updated: October 16, 2026".
**Revision 2:** incorporates `docs/plans/appstore-revised.md` (second research pass, same date).

---

## What this feature does

Today `apple-appstore-reviewer` only audits the codebase for rejection risk. This plan adds a
companion skill, **`appstore-submission-guide`**. It walks a developer through the whole App Store
Connect submission: account prerequisites, every form section and field, assets, build and
compliance questions, App Review Information, and what to do after submitting.

For each field it explains the rules, limits and gotchas, and **drafts a paste-ready value grounded in
the codebase**: name, subtitle, keywords, description, App Privacy label answers, age-rating
questionnaire answers, the export-compliance answer and review notes. Anything the code cannot
prove is marked for the developer to decide. The skill never enters anything into App Store Connect.

## How it fits the existing codebase

- `apple-appstore-reviewer/` is imported from `github/awesome-copilot` and tracked in
  `.skillsets.json`. `skill-update` re-imports it, so it is **left untouched**. The new skill is a
  sibling folder at the repo root, like every other skill.
- **Handoff runs both ways, and the guide runs automatically.** Every time `apple-appstore-reviewer`
  is invoked, `appstore-submission-guide` runs right after the review report, with that report as
  input.
  - **How it is wired:** the reviewer's own file can't be edited (upstream would overwrite it).
    Instead, the new skill declares `companion-of: apple-appstore-reviewer` in its frontmatter, and
    `setup.sh` injects a managed "companion skills" block into the reviewer's `SKILL.md`.
  - **Why it survives updates:** `setup.sh` already manages blocks inside that file, and `skill-update`
    re-runs `setup.sh` after each re-import, so the block is re-injected every time.
  - **The other direction:** when the guide is invoked on its own, it invokes the reviewer as its
    compliance gate. Its `description` triggers ("submit to the App Store", "fill App Store Connect",
    "privacy nutrition label", "age rating", "review notes", "app got rejected") keep it
    discoverable by itself.
  - **Loop guard:** when the reviewer hands off to the guide, the guide reuses the report it was given
    and does not invoke the reviewer again.
- **Layout follows `seo-optimize/`.** It has a lean `SKILL.md`, topic files under `references/`
  loaded only when needed, a `references/sources.md` provenance file with a fetch date, a
  `references/edge-cases.md`, and deterministic checks in `scripts/`.
- `setup.sh` injects the clarification and self-improvement protocol blocks and regenerates the
  README skills table (`scripts/regen-readme.mjs`). Neither is hand-edited.

## Implementation steps

### 0. Seed `sources.md` and close the remaining gaps

**Seed the provenance file first.**
- Move `docs/plans/appstore-revised.md` to `appstore-submission-guide/references/sources.md`. It is
  already the second research pass, written in the right shape.
- Merge in the first pass's URLs, which it leaves out but other reference files rely on:
  - App Privacy details, and the required-reason API and privacy-manifest pages
  - every App Review Guidelines section, and the "complete review" page
  - the App Review overview, and the appeal, expedite and bug-fix pages
  - EU trader status (DSA) and Regulated Medical Devices
  - the Digital Goods and Services questionnaire and Accessibility Nutrition Labels
  - app and submission statuses, release options and phased release
  - platform version information, and the app and compliance information pages
  - the third-party SDK requirements and account-deletion pages
- Tag every row with one of the file's four flags: **verified**, **search-snippet**, **secondary**
  or **open**.

**Already resolved by the second pass; no fetch needed:**
- The in-app purchase field list.
- Both export-compliance Info.plist keys.
- Screenshot sizes for Mac, Apple TV, Vision Pro and Watch.

**Still open.** Fetch each item, or read it in a browser, and update its `sources.md` row before
writing the reference file that depends on it:
- The Required / Localized / Editable marks per field in "Required, localizable, and editable
  properties".
- The `NSPrivacyCollectedDataTypes` inner keys ("Describing data use in privacy manifests").
- **Keyword limit unit, characters or bytes.** Until resolved, validate as bytes.
- **App-level App Review Notes limit unit.** Until resolved, enforce both 4000 characters and 4000
  bytes.
- **App name limit (2–30).** Carried from the first pass, not re-read.
- The Korea and Vietnam regional age-rating tables.
- US storefront rules for external purchase links, and the current EU alternative terms (guideline
  3.1.1(a)).
- The screenshot "required size class" conflict (see `screenshots-and-previews.md` below).
- App preview "up to 3 per size" and the accepted preview resolutions. These came from a summary in
  the first pass; mark them **search-snippet** until re-read.

### 1. Skill entry point: `appstore-submission-guide/SKILL.md`

- **Frontmatter:** `name` and a trigger-rich `description`, including when *not* to use it (pure code
  audit goes to `apple-appstore-reviewer`, ASO keyword research is out of scope). Add
  `session-memory: true` so a long submission walk can resume.
- **Step 0, scope interview** (closed questions). New app or update? Platforms (iOS/iPadOS only)?
  Monetization (free, paid, IAP, subscriptions)? Is any IAP being submitted for the first time? Login
  or account creation? UGC? Kids Category? Loot boxes or gambling-style mechanics? Location
  sharing, dating features or social features?
  - **Distribution regions,** each of which changes the walk:
    - EU: trader status (DSA).
    - US: Texas, Utah or Louisiana state age laws.
    - Japan: alternative payments.
    - Brazil and Australia: regional age ratings.
    - Korea, China mainland, Vietnam: regional compliance fields.
    - EEA, UK, US: regulated medical device declarations.
    - France: the encryption declaration.
- **Step 1, freshness check.** Fetch the five URLs in `sources.md`'s "Freshness-check URLs" table:
  - the guidelines' "Last Updated" date
  - `/news/upcoming-requirements/`
  - `/ios/submit/`, the only page with the April 2027 iOS 15 minimum
  - `/news/`
  - `/help/app-review/`

  Compare each to the snapshot date and flag anything newer. If something is newer, add a dated
  entry to `edge-cases.md` and tell the developer to update the matching `sources.md` row. Offline,
  use the snapshot and label every dated value "as of 2026-11-26, verify". Never block on this step.
- **How confident a drafted value can sound depends on its `sources.md` flag:**
  - **verified:** stated plainly.
  - **search-snippet:** stated with "confirm on Apple's page".
  - **secondary:** only as context, never as a requirement.
  - **open:** shown as an unresolved question; for limits, apply the stricter reading.
- **Step 2, compliance gate.** If the reviewer handed off to this skill, or its report already exists
  this session, reuse that report and **do not re-invoke the reviewer** (loop guard). Otherwise
  invoke `apple-appstore-reviewer` first. Any P0 finding makes the readiness verdict "Not ready". The
  walk continues so the developer still gets the drafts.
- **Step 3, evidence harvest.** Run `scripts/harvest_evidence.py`, then read the files it points at.
- **Step 4, form walk** in App Store Connect order. Each section loads its reference file and outputs
  one row per field: value, evidence, limit check, and whether the developer must act.
  1. Account prerequisites: agreements, tax and banking, DSA trader status (required for EU), DPLA
     acceptance.
  2. App Information: name, subtitle, bundle ID, SKU, primary language, categories, content rights,
     license agreement, privacy policy URL and privacy choices URL.
  3. Pricing and availability, and the Digital Goods and Services questionnaire where it appears.
     If the app is sold in Japan, check the alternative-payment and link-out rules in
     `regional-requirements.md`.
  4. App Privacy labels, plus a cross-check against `PrivacyInfo.xcprivacy` and the SDK list.
  5. Age rating questionnaire:
     - The new Shared Location and Dating and Relationships declarations, required for all apps by
       2027-01-12.
     - The rating mappings, and the triggers that make an app Unrated.
     - The "Social Media Disabled for Users Under 13" option, which needs a Declared Age Range API
       check.
     - Made for Kids.
     - Regional ratings for Australia, Brazil and Korea, from `regional-requirements.md`.
     - Age assurance for the Texas, Utah and Louisiana laws, if the app is sold in the US.
  6. App Accessibility (Nutrition Labels). Currently voluntary; only declare a feature if users can
     complete all common tasks with it.
  7. App Compliance: DSA, Regulated Medical Devices, Korea, China mainland and Vietnam, as applicable
     (details in `regional-requirements.md`).
  8. Version page: screenshots and previews, promotional text, description, keywords, support and
     marketing URLs, version, copyright, What's New.
  9. Build and export compliance, plus the SDK and Xcode floor (see the requirements timeline).
  10. In-App Purchases and subscriptions. The first IAP of each type must go with a new app version,
      and each new subscription group needs at least one subscription.
  11. App Review Information: contact details, a demo account (and an expired-subscription account if
      the app sells subscriptions), notes, and attachments or required documentation by guideline.
  12. Version release (manual, automatic, or scheduled) and phased release.
- **Step 5, validate the drafts.** Run `scripts/validate_metadata.py`, and `scripts/check_screenshots.py`
  if a screenshots folder exists. Fix the drafts and re-run until clean, or report what remains.
- **Step 6, output.** Fill `assets/submission-packet-template.md` with a readiness verdict and
  blockers, a section-by-section field table, a review-notes draft, an asset checklist, open
  decisions for the developer, and an "after you submit" playbook.
- **Step 7, after submission (on request).** Use `references/after-submission.md` for statuses,
  replying to App Review messages, appeals (one per rejection, cite the guideline), expedited review,
  and bug-fix submissions.
- **Never-do list:** never enter or submit anything in App Store Connect; never invent label or
  rating answers without evidence; never present a dated value without its date; never edit app
  code. Code fixes go back to the reviewer's "next pass".

### 2. Reference files (progressive disclosure)

Each file opens with its source URLs and "as of 2026-11-26".

- `references/asc-field-reference.md`: every field by location, with required status, limit,
  localizable, editability and gotchas.
  - Name: 2–30 chars, editable until submitted.
  - Subtitle: 30. Promotional text: 170, changeable without a new version.
  - Description: 4000, plain text. Keywords: 100, comma-separated; unit **open**, validated as bytes.
  - What's New: 4000, updates only.
  - App Review Notes: 4000; unit **open**, so both 4000 characters and 4000 bytes are enforced.
  - Copyright: format like "2026 Example, Inc.".
  - Phone: international format with a leading "+".
  - Bundle ID: locked after the first build. SKU: locked after creation.
  - Made for Kids: locked after approval.
  - **In-app purchase fields (verified):**
    - Reference Name: 64 characters, editable at any time without review.
    - Product ID: 100 characters (letters, numbers, `-`, `.`, `_`). It can't be edited after saving
      or reused, even after deletion, and iOS and macOS need separate IDs.
    - IAP Review Notes: 4000 **characters**.
    - Promotion or win-back image: 1024×1024 JPG or PNG, 72 dpi, RGB, flattened, no rounded corners.
    - App Review screenshot: must meet a supported screenshot spec, and can be replaced but not
      removed once uploaded.
    - Display Name: 2–30 characters, localizable. Description: up to 45 characters, localizable.
    - Localized changes need review, and the old text stays live until the new text is approved.
    - **Conflict:** the first pass's product-page figures were 35 and 55 characters. Use the App
      Store Connect field reference (30 and 45) and note the conflict.
- `references/metadata-guidelines.md`: the guidelines that govern metadata, mapped to fields.
  - 2.1(a)/(b): final build, demo account, backend live, IAPs visible.
  - 2.3.1–2.3.14, including the new 2.3.14 creative assets rule (Oct 2026).
  - 2.5.19, new: no hidden, dormant or undocumented features.
  - 3.1.1, 3.1.2 (Terms of Use and privacy links in metadata and in the app), 4.1, 4.8, 5.1.1(i),
    5.1.1(v), 5.1.2, 5.2, 5.3.
- `references/app-privacy-labels.md`: the full data-type and purpose taxonomy; the definitions of
  "collect", "linked" and "tracking"; the four optional-disclosure criteria; web-view and free-text
  rules. It also covers SDK-to-data-type mapping heuristics (analytics, crash reporting, ads,
  attribution, auth SDKs), `PrivacyInfo.xcprivacy` keys, the five required-reason API categories with
  their reason codes, and the list of SDKs that need a privacy manifest and signature.
- `references/age-rating.md`:
  - **Values:** 4+, 9+, 13+, 16+, 18+ and Unrated. An Unrated app can't be published on the App Store.
    Unrated is triggered by graphic sexual content and nudity, or by prolonged graphic or sadistic
    violence. The new values apply on OS 26 and later.
  - **Questionnaire,** every category and item: In-App Controls; Capabilities (including "Social
    Media Disabled for Users Under 13", which needs a Declared Age Range API check); Mature Themes;
    Medical or Wellness; Sexuality or Nudity; Violence; Chance-Based Activities.
  - **Mappings:**
    - Dating and Relationships: 18+. Gambling: 18+.
    - Social media: 13+. Unrestricted web access: 16+.
    - Loot boxes: 9+ (Australia 16+, Brazil 18+).
  - **The new descriptors:** Shared Location and Dating and Relationships, required on the next
    update or questionnaire change, and for all apps by 2027-01-12.
  - **Also:** Made for Kids, the Age Suitability URL, and when an edit needs a new version.
  - Regional values live in `regional-requirements.md`.
- `references/export-compliance.md`, a decision tree with both Info.plist keys:
  - **No encryption, or only the OS's encryption:** no documentation. Set
    `ITSAppUsesNonExemptEncryption` so the questions aren't asked on every upload.
  - **A standard algorithm the app bundles itself (not from the OS):** a French declaration is
    needed, but only when distributing in France. Banking and medical apps are exempt there.
  - **Documentation required:** fill in the App Description and availability first, then upload in
    App Encryption Documentation before review. Apple expects about two business days to clear it.
    After approval, set `ITSEncryptionExportComplianceCode` to the key Apple issues.
  - **CCATS:** whether the EAR requires one is the developer's call. The skill flags the question; it
    doesn't answer it.
  - **Status:** "Waiting for Export Compliance".
- `references/screenshots-and-previews.md`:
  - **Screenshots:** 1–10 per size class, JPEG or PNG, no alpha channel. Use the full size table
    from `sources.md` with correct labels:
    - Dynamic Island large: 6.9".
    - Face ID large: 6.5".
    - Dynamic Island medium: 6.3".
    - The fallback chain for each class.
  - **Required classes:** Dynamic Island (medium), and iPad 13" if the app runs on iPad.
    - **Surface Apple's conflict.** The Face ID (large) section says it is required when Dynamic
      Island (large) shots are missing. Recommend supplying both medium and large classes, which
      satisfies either reading.
  - **Landscape exceptions:** for 4", 3.5" and 9.7" the landscape sizes are not swapped portrait
    sizes (for example 1136×600 and 2048×1496). Use an explicit table.
  - **Ambiguous size:** 2048×2732 is valid for both the 13" and the 12.9" iPad, so a folder naming
    convention is needed (see the scripts).
  - **iPhone Duo:** 1398×2034 outer and 2007×2853 inner. Optional now; required from April 2027 for
    apps using the iOS 27.1 SDK or later. Adds a "made for iPhone Duo" badge.
  - **Not covered:** Mac, Apple TV, Vision Pro and Watch sizes are listed for detection only. A
    bundled watch app needs Watch screenshots.
  - **Previews (verified):** H.264 or ProRes 422 HQ, at most 500 MB, 15–30 s, 5 s poster frame. macOS
    and tvOS previews are landscape only.
  - **Previews (search-snippet):** up to 3 per size, and the accepted resolutions.
  - **Content rules:** guidelines 2.3.3 and 2.3.4.
- `references/review-notes-and-demo-accounts.md`: Apple's "complete review" checklist (concept,
  what changed, devices tested, external services, regional differences, hardware video), demo
  account rules, demo mode, MFA codes, and the documentation-by-guideline table (medical, crypto,
  finance, gambling, third-party IP, health research, kids ads, VPN). Plus a notes template.
- `references/requirements-timeline.md`: dated requirements, each with its source URL.
  - Xcode 26 / iOS 26 SDK since 2026-04-28.
  - Minimum deployment target iOS 13 since 2026-09-09.
  - **April 2027:** iOS and iPadOS 27 SDK **and an iOS 15 target**; tvOS, visionOS and watchOS 27
    SDKs. The source is `/ios/submit/`; the news post leaves out the iOS 15 target, and the Upcoming
    Requirements page doesn't list it.
  - April 2027: iPhone Duo screenshots for apps using the iOS 27.1 SDK or later.
  - Updated age-rating responses required since 2026-01-31; new descriptors due 2027-01-12.
  - DSA trader status: updates since 2024-10-16, removal from the EU App Store since 2025-02-17.
  - Required-reason APIs since 2024-05-01.
  - Game Center entitlement and App Store Connect configuration since 2023-08-16.
  - US state age-assurance laws: Utah from 2026-05-06, Louisiana from 2026-07-01, and Texas in force
    since its injunction was lifted on 2026-06-03.
  - Accessibility Nutrition Labels currently voluntary.
- `references/after-submission.md`: app, submission and item statuses; review-time expectations;
  App Review messages; Metadata Rejected; appeals to the App Review Board; expedited review (critical
  bug or event); bug-fix submissions; release options; and the phased-release schedule
  (1/2/5/10/20/50/100% over 7 days, up to 30 days of pauses).
  - **Review times:** 50% within 24 hours and 90% within 48 hours, cited to the review-status page.
    The App Review overview page has older, conflicting wording ("90% in under 24 hours"); note it as
    superseded.
- `references/regional-requirements.md` (new), one section per region with its source URL:
  - **EU:** trader status (DSA).
  - **US states (Texas SB2420, Utah, Louisiana):** new accounts are covered. Check for the Declared
    Age Range API (iOS 26 or later), PermissionKit's Significant Change API, the StoreKit age-rating
    property and App Store Server Notifications. These are code checks, so the skill reports them as
    evidence gaps and hands them back to the reviewer's "next pass".
  - **Japan (MSCA):**
    - Alternative payments and link-outs are always shown alongside In-App Purchase.
    - Users under 18 need a parental gate.
    - Users under 13 can't be linked out to a website for transactions.
    - Kids Category apps can't link out for transactions.
    - Commissions are out of scope; link the newsroom post.
  - **Brazil:**
    - Official MJSP ratings override self-ratings.
    - Shared Location gives A16 and Dating and Relationships gives A18, and loot boxes give 18+.
    - Fixed-odds betting needs an SPA license. Put it in the review notes and attachments, under
      guideline 5.3.4.
  - **Australia:** loot boxes give 16+, and infrequent simulated gambling gives R 18+.
  - **Korea:** RCN, and the regional age table (**open**).
  - **Vietnam:** game license, and the regional age table (**open**).
  - **China mainland:** ICP filing.
  - **EEA, UK, US:** regulated medical device status.
  - **France:** encryption declaration, which points to `export-compliance.md`.
- `references/sources.md`: seeded in step 0. Holds every URL from both passes, the snapshot date, the
  four-level flags, the freshness-check URL table and the open gaps.
- `references/edge-cases.md`: starts empty, per the self-improvement protocol.

### 3. Deterministic scripts (Python stdlib only, matching `plan-feature/scripts/verify_plan_paths.py`)

- `scripts/harvest_evidence.py <repo>` outputs JSON with:
  - From `Info.plist` (via `plistlib`): bundle ID, version, `ITSAppUsesNonExemptEncryption`,
    `NS*UsageDescription` keys, `UIRequiredDeviceCapabilities`, URL schemes.
  - Every `PrivacyInfo.xcprivacy` file and its declared keys.
  - Dependencies from `Package.resolved`, `Podfile.lock`, `pubspec.lock` and `package.json`, matched
    against the SDK list that requires privacy manifests.
  - `.storekit` products, entitlements (Sign in with Apple, push, App Groups, Game Center), and
    signals for sign-in, UGC, web views and location sharing.
  - **Crypto:** bundled crypto libraries (OpenSSL, BoringSSL, libsodium, CryptoSwift and similar)
    versus Apple's own (CryptoKit, CommonCrypto, Security). This feeds the export-compliance tree.
  - **Age-rating signals:** loot boxes or gacha, gambling, dating, location sharing and social
    features.
  - **Age assurance:** imports of the Declared Age Range API and PermissionKit.
- `scripts/validate_metadata.py <draft.json>` checks the metadata drafts:
  - Character and byte limits per field. A limit whose unit is **open** is checked against both
    readings.
  - Pricing terms in name, subtitle or keywords ("free", "sale", "% off", currency amounts).
  - Keywords: duplicates of words in the name or subtitle, the word "app", spaces after commas.
  - Other-platform names (2.3.10), "For Kids"/"For Children" outside the Kids Category (2.3.8).
  - Phone format and URL protocol.
  - **In-app purchase drafts:** Reference Name 64, Product ID 100 with its allowed characters, Display
    Name 2–30, Description 45, Review Notes 4000 characters.
- `scripts/check_screenshots.py <dir>` reads PNG and JPEG headers with no PIL and checks:
  - Dimensions against an explicit portrait-and-landscape table. Landscape is not derived by
    swapping.
  - The alpha channel on PNGs, file type, and 1–10 images per size class.
  - **Folder convention:** screenshots go in folders named after their size class (for example
    `ipad-13/` and `ipad-12.9/`), so 2048×2732 resolves to one class. Without the folder, an
    ambiguous size is reported as ambiguous, not rejected.
  - **Out-of-scope platforms:** Mac, Apple TV, Vision Pro and Watch sizes are reported as "detected,
    not covered" instead of invalid.

### 4. Tests

These are the cases "tested" means for the validators. Generate them with `generate-tests` once the
scripts exist.

- **validate_metadata, name:** 30 characters passes, 31 fails, 1 fails, empty fails.
  - 30 emoji or CJK characters pass the character limit (name is counted in characters, not bytes).
- **Keywords:** exactly 100 ASCII bytes passes; 101 fails.
  - 34 Japanese characters (102 UTF-8 bytes) fail even though the character count is under 100.
  - A keyword repeating a word from the name is flagged; so is "free" in any casing.
  - "photo editor,photo editor" (a duplicate keyword) is flagged.
- **Subtitle:** "Free Photo Editor" is flagged (2.3.7). "Freelance invoices" is not, because matching
  is on word boundaries.
- **Description:** "Also on Android" is flagged (2.3.10). 4000 characters passes; 4001 fails.
- **App Review Notes:** 4000 ASCII characters pass; 4001 fail. 4000 Japanese characters (12,000
  bytes) fail the byte reading while the unit is **open**.
- **In-app purchase fields:**
  - Product ID `com.app pro` (contains a space) fails; a 100-character ID passes; 101 fails.
  - Display Name: 30 characters pass, 31 fail, 1 fails.
  - Description: 45 characters pass, 46 fail.
  - Reference Name: 64 pass, 65 fail.
  - IAP Review Notes: 4000 Japanese characters pass (the limit is in characters).
- **Other formats:** phone "+1 4155550100" passes, "4155550100" fails; Support URL without
  `https://` fails.
- **check_screenshots:** 1320×2868 PNG passes; 1320×2867 fails; a PNG with an alpha channel fails;
  2868×1320 (landscape) passes; 11 images in one size class fails; a `.heic` file fails.
  - 1136×600 passes as 4" landscape; 1136×640 passes as well.
  - 2048×2732 in `ipad-13/` passes as 13". The same file with no class folder is reported as
    ambiguous, not rejected.
  - 1280×800 is reported as "Mac, not covered", not invalid.
  - 2007×2853 is recognised as iPhone Duo (inner).
- **harvest_evidence:**
  - An Info.plist without `ITSAppUsesNonExemptEncryption` reports export compliance as "unknown",
    not "exempt".
  - Firebase in `Package.resolved` with no `PrivacyInfo.xcprivacy` reports the manifest as missing.
  - A repo with no Info.plist exits cleanly with an explicit "not an iOS project" result.
  - **Export compliance:**
    - CryptoKit only, with `ITSAppUsesNonExemptEncryption` absent: "OS-provided encryption; no
      documentation; set the key".
    - OpenSSL in `Podfile.lock` and France among the regions: the French declaration is flagged.
    - OpenSSL with no France distribution: no French flag.
  - **Age assurance:** US distribution with no Declared Age Range API import is flagged as an
    age-assurance gap. The same repo distributed outside the US is not flagged.
  - **Age rating:** a loot-box signal with Brazil among the regions drafts 18+ for Brazil; the same
    signal elsewhere drafts 9+.
- **setup.sh companion injection:**
  - The first run injects exactly one block into `apple-appstore-reviewer/SKILL.md`. A second run
    leaves the file byte-identical.
  - Removing `companion-of` from the guide and re-running removes the block.
  - Two skills declaring the same target produce one block listing both.
  - `companion-of: does-not-exist` prints a warning and changes no file.
  - A skill whose `companion-of` names itself is rejected.
  - After `skill-update` re-imports the reviewer (simulate: restore the upstream SKILL.md, then run
    `setup.sh`), the block is present again.
- **Loop guard, manual check:** invoking the reviewer runs the guide exactly once, and the guide does
  not start a second review.

### 5. Auto-trigger: companion injection in `setup.sh`

- **New frontmatter key, `companion-of: <skill-name>`,** declared by the companion itself. Add
  `companion-of: apple-appstore-reviewer` to `appstore-submission-guide/SKILL.md`.
- **New pass in `setup.sh`,** next to `inject_protocol_pointers`. It scans every skill's frontmatter
  for `companion-of`, groups companions by target, and writes one managed block into each target's
  `SKILL.md`, between `<!-- BEGIN dev-agent-skills companion skills (managed by setup.sh ...) -->`
  and `<!-- END dev-agent-skills companion skills -->`, placed after the existing protocol blocks.
  - **Block text:** "After you deliver this skill's report, invoke `appstore-submission-guide` with
    the skill tool, passing the report as its compliance-gate input. That skill must not re-invoke
    this one."
  - **Same rules as the session-memory and graph-memory blocks:** refresh in place, never duplicate,
    and remove the block when no skill declares the target any more.
  - **Missing target:** warn and skip.
  - **Summary line:** add one to the `setup.sh` output.
- **Survives updates:** `skill-update/scripts/update-skillsets.sh` already runs `setup.sh` at the
  end, so the block comes back after every upstream refresh. With `--skip-setup` it stays missing
  until `setup.sh` runs. Document that in the frontmatter-key docs.
- **Document the key** in `docs/CONTRIBUTING.md`, next to `session-memory` and `graph-memory`.

### 6. Wire-up

- Run `bash setup.sh` to inject the protocol and companion blocks, symlink the skill and regenerate
  the README table.
- Run `graphify update .`.
- Add a line to `docs/HISTORY.md`.

## Files to change

| File | Change |
|---|---|
| `README.md` | Skills-table row for the new skill, regenerated by `setup.sh` (no hand edit) |
| `docs/HISTORY.md` | One entry recording the new skill and its research snapshot date |
| `setup.sh` | New companion-injection pass driven by the `companion-of` frontmatter key |
| `docs/CONTRIBUTING.md` | Document the `companion-of` frontmatter key |
| `apple-appstore-reviewer/SKILL.md` | Gains a managed companion block, **written only by `setup.sh`** (never hand-edited) |

## Files to create

| File | Purpose |
|---|---|
| `appstore-submission-guide/SKILL.md` | Entry point: triggers, scope interview, freshness check, reviewer gate, form walk, output, never-do list |
| `appstore-submission-guide/README.md` | Short human-facing overview, like sibling skills |
| `appstore-submission-guide/references/asc-field-reference.md` | Every ASC field: location, required status, limit, localizable, editability, gotchas |
| `appstore-submission-guide/references/metadata-guidelines.md` | Guideline-to-field mapping (2.1, 2.3.x, 2.5.19, 3.1.x, 4.x, 5.x) |
| `appstore-submission-guide/references/app-privacy-labels.md` | Privacy label taxonomy, definitions, SDK mapping, privacy manifest and required-reason codes |
| `appstore-submission-guide/references/age-rating.md` | Rating values, questionnaire, new descriptors and their deadline, regional notes |
| `appstore-submission-guide/references/export-compliance.md` | Encryption decision tree, Info.plist key, documentation upload |
| `appstore-submission-guide/references/screenshots-and-previews.md` | iPhone/iPad screenshot and preview specs, fallback chain, content rules |
| `appstore-submission-guide/references/review-notes-and-demo-accounts.md` | Complete-review checklist, demo accounts, documentation table, notes template |
| `appstore-submission-guide/references/requirements-timeline.md` | Dated SDK, Xcode, deployment-target and policy requirements |
| `appstore-submission-guide/references/after-submission.md` | Statuses, messages, appeals, expedite, bug-fix, release options, phased release |
| `appstore-submission-guide/references/regional-requirements.md` | EU DSA; US state age laws; Japan MSCA; Brazil, Australia, Korea, Vietnam, China mainland; medical device regions; France encryption |
| `appstore-submission-guide/references/sources.md` | Provenance, moved from `docs/plans/appstore-revised.md` (see the note below) and merged with the first pass's URLs |
| `appstore-submission-guide/references/edge-cases.md` | Self-improvement log (starts empty) |
| `appstore-submission-guide/scripts/harvest_evidence.py` | Pull submission-relevant facts out of the iOS repo as JSON |
| `appstore-submission-guide/scripts/validate_metadata.py` | Lint drafted metadata against limits and guideline rules |
| `appstore-submission-guide/scripts/check_screenshots.py` | Validate screenshot dimensions, format, alpha and count |
| `appstore-submission-guide/assets/submission-packet-template.md` | The output document the skill fills in |
| `appstore-submission-guide/assets/metadata-draft.example.json` | Input shape for `validate_metadata.py` |

**Move:** `docs/plans/appstore-revised.md` becomes `appstore-submission-guide/references/sources.md`
(`git mv`, then merge the first pass's URLs). It isn't listed in the tables above because the
path-check script only validates "change" and "create" paths.

## Risks and open questions

- **The facts go stale.** Apple changes limits, sizes and deadlines often; 2.3.14, 2.5.19 and the new
  age-rating descriptors all landed in Oct–Nov 2026. This is mitigated by the dated `sources.md`,
  Step 1's freshness check, and labelling every dated value.
- **Some values are unverified.** Several came from search snippets or summaries rather than the
  page itself (see step 0 and the flags in `sources.md`). Anything still **open** at ship time must
  be shown as an open question in the packet, never as a rule.
- **Apple's own pages conflict:**
  - which screenshot size class is required
  - IAP display name and description limits (30/45 vs 35/55)
  - review-time wording
  - April 2027 minimums missing from the Upcoming Requirements page

  The skill surfaces each conflict and recommends the choice that satisfies both readings. It never
  silently picks one.
- **Regional rules change fastest.** The US state laws went through an injunction and a reversal
  within one year. Every row in `regional-requirements.md` carries its date and source, and Step 1's
  `/news/` fetch is the main way to catch changes.
- **Privacy labels are the main liability.** Drafting App Privacy answers from code can under-report
  what server-side or SDK-side code collects. Each drafted answer must cite its evidence. Anything
  inferred only from an SDK's presence is labelled "verify with the SDK vendor's disclosure", never
  stated as fact.
- **Auto-trigger depends on `setup.sh` having run.** If someone runs `skill-update --skip-setup` and
  never runs `setup.sh`, the reviewer runs without the handoff until it does. This is the same
  exposure the existing protocol blocks already have.
- **Every review now becomes a submission walk.** A developer who only wanted a code audit also gets
  the scope interview. The guide's Step 0 should let them stop with one closed question ("Continue to
  the submission walk, or stop at the review?").
- **Overlap with the reviewer.** The reviewer already drafts "Suggested Reviewer Notes". The new skill
  reuses that draft as input instead of writing a competing one.

## What this plan does NOT cover

- Any hand edit to `apple-appstore-reviewer/`, and any change to `.skillsets.json`. The reviewer
  only gains the `setup.sh`-managed companion block.
- macOS, tvOS, visionOS and watchOS submission specifics; TestFlight beta review; App Store Connect
  API or fastlane automation; ASO keyword research; EU alternative marketplaces and
  notarization-only distribution.
- Japan MSCA business terms and commissions (linked only), and CCATS classification decisions
  (flagged for the developer, not answered).
- Implementing age-assurance APIs. The skill reports missing Declared Age Range API or PermissionKit
  use as an evidence gap; the code change belongs to the reviewer's "next pass".
- Entering or submitting anything in App Store Connect, and editing the target app's code.

---
> 📋 This plan was generated by an AI agent based on the current codebase.
> Verify file paths and assumptions before starting implementation.
