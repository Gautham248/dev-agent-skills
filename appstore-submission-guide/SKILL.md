---
name: appstore-submission-guide
description: Guides an iOS or iPadOS developer through the whole App Store Connect submission and drafts paste-ready values from the codebase -- app name, subtitle, keywords, description, App Privacy nutrition label answers, age rating questionnaire, export compliance, accessibility labels, screenshots, In-App Purchase metadata, App Review notes and demo account, release options -- then checks them against Apple's current limits and guidelines. Use when someone says "submit my app to the App Store", "help me fill out App Store Connect", "what goes in the privacy nutrition label", "age rating questionnaire", "export compliance question", "write App Review notes", "screenshot sizes", "prepare for App Review", or "my app got rejected, what now". Runs automatically after apple-appstore-reviewer. Does NOT audit code for rejection risk on its own (that is apple-appstore-reviewer), does not do ASO keyword research, and never enters or submits anything in App Store Connect.
session-memory: true
companion-of: apple-appstore-reviewer
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

<!-- BEGIN dev-agent-skills session-memory protocol (managed by setup.sh -- do not edit this block manually; edit SESSION-MEMORY-PROTOCOL.md instead) -->
This skill opted in to session-memory (session-memory: true). Whenever you reach a step
marked 'Session-reusable:' below, read and follow the session-memory protocol at:
../config/SESSION-MEMORY-PROTOCOL.md
<!-- END dev-agent-skills session-memory protocol -->

# App Store submission guide

This skill walks a developer through an App Store Connect submission, section by section, and hands
back a **submission packet**. The packet holds a readiness verdict, a drafted value for every field
(each with its evidence and a limit check), the App Review notes, an asset checklist, the decisions
only the developer can make, and an after-submission playbook.

**The most important rule:** never state a value as true without evidence. A privacy-label answer, an
age-rating answer or an export-compliance answer drafted without evidence can get an app rejected or
removed. If the codebase can't prove it, write it as a question for the developer, never as a fact.

## When this applies

- **Runs after `apple-appstore-reviewer`.** That skill's file carries a block managed by `setup.sh`
  that hands its report to this skill.
- **Runs on its own** for any of the trigger phrases in the description.
- **Does not apply to:**
  - a code-only rejection audit (use `apple-appstore-reviewer`)
  - macOS, tvOS, visionOS or watchOS-specific submission
  - TestFlight beta review
  - App Store Connect API or fastlane automation
  - keyword research
  - EU alternative marketplaces or notarization-only distribution

  Say so and stop if one of these is the actual request.

## What this skill never does

- Enter, upload or submit anything in App Store Connect. The developer does that.
- Edit the app's code. Code fixes belong to `apple-appstore-reviewer`'s "next pass".
- Invent a privacy-label, age-rating or encryption answer without evidence.
- Present a dated value (a limit, a deadline, an SDK floor) without its date and source flag.
- Re-invoke `apple-appstore-reviewer` when that skill's report was handed in, or a report for the
  current commit already exists this session. This guard stops the two skills from calling each other
  in a loop.
- Write demo-account passwords, MFA secrets or contact details into any file or into session memory.

## How to treat a value from `references/`

Every fact in `references/` carries a source flag. Its wording in the packet depends on the flag:

| Flag | How to present it |
|---|---|
| **verified** | State it plainly, with the date. |
| **search-snippet** | State it, followed by "confirm on Apple's page", with the link. |
| **secondary** | Context only, never as a requirement. |
| **open** | Present it as an unresolved question. For a limit, apply the stricter reading. |

Every reference file opens with its snapshot date: **2026-11-26**, App Review Guidelines last updated
2026-10-16.

## Instructions

### Step 0: Decide whether to continue, then scope the walk

**If the reviewer handed off to this skill,** its report starts with a handoff line:

```
handoff: from=apple-appstore-reviewer; reviewed_at=<ISO 8601>; commit=<git HEAD or "unknown">
```

Ask one closed question first: "The review is done. Continue to the App Store submission walk, or stop
here?" If the developer says stop, stop. **If no one can answer** (a subagent, CI or any
non-interactive run), stop at the review and print one line: "Run `appstore-submission-guide` to
continue to the submission walk."

**If a walk is already in progress this session** (session memory has completed sections) and the
reviewer hands off again, for example after code fixes, resume the walk. Re-run only Step 2's verdict
and the sections whose evidence changed; don't restart the interview.

**Pick the mode before the interview:**

- **Rejection response** (the developer pasted an App Review message, or says the app was rejected):
  skip Steps 1-6 and go to Step 7.
- **One section** (for example only the privacy labels or only the age rating): ask only the scope
  questions that section needs, run Step 3, then walk that section alone.
- **New app** or **update:** the full walk below.

Then ask the scope questions below in a single message, as closed questions. If an answer is already
clear from the conversation or the code, state it instead of asking.

1. **New app, or an update to a live app?**
2. **Monetization:** free, paid, in-app purchases or subscriptions? Is this the **first** IAP of its
   type? The first one must be submitted with an app version.
3. **Accounts:** login, account creation, or third-party or social sign-in?
4. **Content:** UGC, social features, messaging, location sharing, dating features, loot boxes or
   gambling-style mechanics, unrestricted web access, medical or health content? Kids Category?
5. **Distribution regions.** Each one changes the walk:

   | Region | What it adds |
   |---|---|
   | EU | Trader status (DSA) |
   | US | Texas, Utah or Louisiana state age laws |
   | Japan | Alternative payments and link-outs |
   | Brazil, Australia | Regional age ratings |
   | Korea, China mainland, Vietnam | Regional compliance fields |
   | EEA, UK, US | Regulated medical device declaration |
   | France | Encryption declaration |

6. **Assets:** is there a screenshots folder, and which devices does the app support (iPhone only, or
   iPhone and iPad)?

**If the developer answers vaguely** ("whatever", "all regions"), propose a concrete default and get a
yes. For example: "I'll assume worldwide distribution, which includes the EU, US, Japan, Brazil,
Korea and France. OK?"

### Step 1: Freshness check

**Session-reusable:** the result can be reused within this session. Apple's pages don't change
because of anything this skill does.

Fetch the five URLs in the "Freshness-check URLs" table of `references/sources.md`:

- The App Review Guidelines: compare the "Last Updated" date with 2026-10-16.
- Upcoming Requirements, and `/ios/submit/` for the April 2027 minimums: look for any requirement
  not in `references/requirements-timeline.md`.
- `/news/`: look for any item dated after 2026-11-26 that touches age ratings, privacy, metadata,
  regional laws or screenshots.
- `/help/app-review/`: check the review-time wording.

**If something is newer,** tell the developer what changed and treat the newer Apple page as the
source of truth over `references/`. Add a dated entry to `references/edge-cases.md` saying which
reference row is stale.

**If a fetch fails** (offline, or the page needs JavaScript), continue with the snapshot. Label every
dated value in the packet "as of 2026-11-26, verify". Never block on this step.

### Step 2: Compliance gate

- **The reviewer's report was handed in:** reuse it. **Do not invoke `apple-appstore-reviewer`
  again.**
- **A report already exists this session:** reuse it only if its `commit` matches the current
  `git rev-parse HEAD` (or the developer confirms nothing changed). A report for an older commit is
  stale: invoke the reviewer again.
- **The report has no P0/P1/P2 severities you can parse:** show it, ask which findings block the
  submission, and continue.
- **Otherwise:** invoke `apple-appstore-reviewer` with the skill tool, wait for its report, then
  continue.

Any **P0** finding makes the readiness verdict **Not ready**. Keep walking anyway so the developer
gets the drafts. Its draft "Suggested Reviewer Notes" become the starting point for Step 4.11;
don't write a competing draft.

### Step 3: Harvest evidence from the codebase

**Session-reusable:** this skill never edits code. Re-run it only if the developer says they changed
`Info.plist`, entitlements, privacy manifests or dependencies since.

```bash
python3 scripts/harvest_evidence.py <app-repo-root> --regions <comma-separated region codes> [--target <name>]
```

Region codes: `EU`, `US`, `JP`, `BR`, `AU`, `KR`, `CN`, `VN`, `FR`, `UK`, `EEA`.

The script prints JSON:

- **`app`:** the main app target, its configuration and xcconfig files, bundle ID, version, build
  number and deployment targets. Values are resolved from build settings, `.xcconfig` files and
  `$(VAR)` references for the Release configuration.
- **`extensions`:** every other target (extensions, watch app, App Clip) with its bundle ID.
- **`app_icon`:** the 1024x1024 App Store icon: format (`appiconset` or `icon_composer`) and issues.
- **`export_compliance`:** the plist key, crypto libraries, and a suggested answer.
- **`privacy_manifests`:** manifests found, plus SDKs that need a manifest but have none.
- **`dependencies`:** the dependency list.
- **`usage_descriptions`:** usage-description strings of the main app.
- **`purpose_string_usage`:** code (or plugins) that needs a usage description, with evidence.
- **`capabilities`:** entitlements and capabilities.
- **`signals`:** sign-in, UGC, web views, location sharing, loot boxes, dating, social and
  age-assurance APIs.
- **`flags`:** problems to raise.

Then open the specific files the JSON points to before drafting from them. The scripts show where to
look; they don't replace reading the code.

**Other statuses:**

- **`needs_target_selection`:** several iOS app targets. Ask which one is being submitted (closed
  question listing `candidates`), then re-run with `--target`.
- **`target_not_found`:** the `--target` name doesn't exist; offer the listed candidates.
- **`generated_project`:** Expo, React Native, Flutter, Capacitor, XcodeGen, Tuist, Unity or .NET MAUI
  with no committed Xcode project. Show the `message` (how to generate it). If the developer doesn't
  want to, draft from `config` and the config files, and mark every value "verify".
- **`not_an_ios_project`:** say so and ask for the right path. Don't guess.

**Flags that block the upload** go in the packet as `fix first`: `purpose_string_missing`,
`app_icon_has_alpha`, `app_icon_1024_missing`, `deployment_target_below_13`,
`required_reason_api_undeclared`. **Flags that need a decision:** `bundle_id_unresolved`,
`purpose_string_only_in_extension`, `tracking_manifest_mismatch`, `app_icon_not_found`.
**`bundled_watch_app`, `bundled_app_clip`, `bundled_imessage`:** list the extra assets as "not covered
by this skill" in the asset checklist.

### Step 4: Walk the submission form, in App Store Connect order

For each section, read the reference file named in brackets. Output one row per field:

| Field | Drafted value | Evidence (file:line or "developer input") | Limit / rule check | Action |
|---|---|---|---|---|

The Action column holds one of three values: `paste`, `decide` or `fix first`.

1. **Account prerequisites** [`regional-requirements.md`]: Paid Apps agreement, tax and banking
   (paid apps and IAPs only), the current Apple Developer Program License Agreement accepted,
   and EU trader status (needed for EU distribution).
2. **App Information** [`asc-field-reference.md`, `metadata-guidelines.md`]:
   - name, subtitle, bundle ID, SKU, primary language
   - primary and secondary category, content rights, license agreement
   - privacy policy URL and privacy choices URL
   - the Digital Goods and Services questionnaire, if it appears
3. **Pricing and availability** [`asc-field-reference.md`, `regional-requirements.md`]: price,
   storefronts, and pre-orders. For Japan, check the alternative-payment and link-out rules. For the
   US storefront, external purchase links are allowed under 3.1.1(a) (search-snippet).
4. **App Privacy** [`app-privacy-labels.md`]:
   - **Draft:** derive data types, purposes, "linked" and "tracking" from the evidence, then
     cross-check against every `PrivacyInfo.xcprivacy` file.
   - **SDK-only inferences:** a data type known only because an SDK is present is labelled "verify
     against [vendor]'s privacy disclosure".
   - **Mismatches:** where the manifest and the label disagree, flag it as `fix first`.
5. **Age rating** [`age-rating.md`, `regional-requirements.md`]: answer every questionnaire item,
   each answer with its evidence.
   - **New declarations:** Shared Location and Dating and Relationships, required for all apps by
     2027-01-12.
   - **Rating triggers:** state the minimum rating each answer forces, and whether any answer makes
     the app Unrated (which blocks App Store publication).
   - **Regional ratings:** Australia, Brazil, Korea and Vietnam, where those regions are in scope.
   - **US state age laws:** with US distribution, report an age-assurance evidence gap if the
     Declared Age Range API isn't used. The code change goes back to the reviewer.
6. **App Accessibility** [`asc-field-reference.md`]: currently voluntary. Draft a declaration only for
   features the code shows working across all common tasks. Otherwise, write `decide`.
7. **App Compliance** [`regional-requirements.md`]: EU trader status, Regulated Medical Devices, and
   Korea, China mainland and Vietnam fields, as applicable.
8. **Version page** [`asc-field-reference.md`, `metadata-guidelines.md`,
   `screenshots-and-previews.md`]:
   - screenshots and previews
   - promotional text, description, keywords
   - support URL and marketing URL
   - version, copyright, What's New (updates only)
9. **Build and export compliance** [`export-compliance.md`, `requirements-timeline.md`]:
   - Check the build is made with Xcode 26 / iOS 26 SDK or later.
   - Check the deployment target is iOS 13 or later, and warn about the April 2027 floor (iOS 27 SDK,
     iOS 15 target).
   - Walk the encryption decision tree.
10. **In-App Purchases and subscriptions** [`asc-field-reference.md`]:
    - Draft each product's fields.
    - Remind the developer that a first IAP of each type must go in the same submission as an app
      version, and that each new subscription group needs at least one subscription.
    - With subscriptions, require an expired-subscription demo account.
11. **App Review Information** [`review-notes-and-demo-accounts.md`]:
    - contact details and the demo account (placeholders, never real credentials)
    - notes, starting from the reviewer's draft
    - required documentation for regulated features, by guideline number
12. **Version release** [`after-submission.md`]: manual, automatic or scheduled release, and whether to
    use phased release. For an update, recommend phased release unless the developer has a reason not
    to.

### Step 5: Validate the drafts

Write the drafted text fields to a JSON file in the shape of `assets/metadata-draft.example.json`,
then run:

```bash
python3 scripts/validate_metadata.py <draft.json>
python3 scripts/check_screenshots.py <screenshots-dir>   # only if a screenshots folder exists
```

Fix each error in the draft and re-run until clean. Report anything you can't fix, such as an app
name that is too generic or a decision the developer owns, as an open item. Warnings are judgment
calls: keep or change them, and say which.

For screenshots, one folder per size class (`iphone-6.9/`, `iphone-6.3/`, `ipad-13/`, ...) avoids
ambiguity. The size classes are listed in `references/screenshots-and-previews.md`.

### Step 6: Deliver the submission packet

Fill `assets/submission-packet-template.md` and give it to the developer. Save it to a file only if
asked. Lead with the verdict:

- **Ready:** no P0s, no `fix first` rows.
- **Ready with decisions:** only `decide` rows remain.
- **Not ready:** any P0 or `fix first` row, each listed.

### Step 7: After submission (only when asked)

Use `references/after-submission.md` when the developer asks about any of these:

- statuses and review times
- replying to App Review messages, or a Metadata Rejected status
- appealing to the App Review Board (one appeal per rejection; cite the guideline; point to the demo
  account and screenshots)
- expedited review (a critical bug or a dated event)
- bug-fix submissions, or phased-release pauses

For a rejection, map the cited guideline to the relevant packet section and redraft only that
section.

## Edge cases and error handling

- **No iOS project found:** report `not_an_ios_project` from Step 3 and ask for the path. Never
  harvest from a guessed directory.
- **A Flutter, React Native or Capacitor app:** look for `ios/Runner/Info.plist` or
  `ios/<App>/Info.plist`. The script searches these paths.
- **Several app targets:** the script returns `needs_target_selection`; ask, then re-run with
  `--target`. Extensions, the watch app and the App Clip are listed under `extensions`; their
  manifests ship in the same build.
- **Apple's pages conflict** (screenshot required class, IAP name limits, review times): say so and
  recommend the option that satisfies both readings. Never silently pick one. Details are in
  `references/sources.md`.
- **The developer pastes real credentials:** don't repeat them in the packet; use placeholders.

## If something goes wrong

Before improvising a fix, check `references/edge-cases.md`. The problem may already be documented and
solved. If it's genuinely new once you're done, follow the self-improvement protocol and add it there.
