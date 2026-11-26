# Age rating questionnaire

**Snapshot:** 2026-11-26.

**Sources:**
- ASC Help "Age ratings values and definitions" (verified)
- "Set an app age rating" (verified, top of page)
- Apple news `?id=yxkh08us` (search-snippet)

Regional values (Australia, Brazil, Korea, Vietnam) are in `regional-requirements.md`.

---

## Values

- **4+, 9+, 13+, 16+, 18+ and Unrated.** The new values apply on OS 26 and later; earlier OS versions
  show their own mapping.
- **Unrated apps can't be published on the App Store.** They can still be distributed through
  alternative marketplaces or the web.
- **What makes an app Unrated:** graphic sexual content and nudity, or prolonged graphic or sadistic
  realistic violence.

## Where and when to edit it

- **Where:** App Information, then Age Ratings, then "Set Up Age Ratings" (or Edit).
- **Steps:** in-app controls and capabilities, then frequency answers per section, then age category
  or override, then an optional Age Suitability URL, then Save.
- **When it can change:** editable until you submit for review. Read-only during review, and locked
  after approval until the next version. App Review can ask for a new version to change it.

## Questionnaire (every item; answer each with evidence)

| Section | Items |
|---|---|
| In-App Controls | Parental Controls; Age Assurance |
| Capabilities | Unrestricted Web Access; User-Generated Content; Social Media; Social Media Disabled for Users Under 13 (requires at least a Declared Age Range API check); Messaging and Chat; **Shared Location (new)**; Advertising |
| Mature Themes | Profanity or Crude Humor; Horror/Fear Themes; Alcohol, Tobacco, or Drug Use or References; **Dating and Relationships (new)**: dating or relationship connections between real people, or a virtual companion engaging the user in sexual or romantic content, scripted or generated |
| Medical or Wellness | Medical or Treatment Information; Health or Wellness Topics |
| Sexuality or Nudity | Mature or Suggestive Themes; Sexual Content or Nudity; Graphic Sexual Content and Nudity |
| Violence | Cartoon or Fantasy Violence; Realistic Violence; Prolonged Graphic or Sadistic Realistic Violence; Guns or Other Weapons |
| Chance-Based Activities | Gambling; Simulated Gambling; Contests; Loot Boxes |

## Minimum rating each answer forces (verified)

| Answer | Minimum rating |
|---|---|
| Dating and Relationships | 18+ |
| Gambling | 18+ |
| Unrestricted Web Access | 16+ |
| Social Media | 13+ |
| Loot Boxes | 9+ (16+ in Australia, 18+ in Brazil) |
| Graphic sexual content and nudity; prolonged graphic or sadistic violence | Unrated |

## New descriptors: Shared Location and Dating and Relationships

- **Introduced:** in the questionnaire since 2026-11-16 (secondary: 9to5Mac, MacRumors).
- **When they must be answered:** on the next update or questionnaire edit, and **for all apps by
  2027-01-12**. (Apple news, search-snippet.)
- **Effect:** Dating and Relationships gives at least 18+. Shared Location may not change the minimum
  rating in some regions. Brazil: A16 for Shared Location, A18 for Dating and Relationships.

## Age category and overrides

| Option | Rule |
|---|---|
| Not Applicable | The default. |
| Made for Kids | Only if the calculated rating is 4+ or 9+. Not available on visionOS. **Can't be changed after approval**, and the Kids Category rules (1.3) stay in force even if you later deselect it. |
| Override to Higher Age Rating | For example when a custom EULA sets a higher minimum age. |
| Unrated | Only for EU alternative distribution. |
| Age Suitability URL | Optional. |

## How to draft answers from code

| Evidence | Item to answer |
|---|---|
| `WKWebView` or `SFSafariViewController` with a user-editable URL, or open navigation | Unrestricted Web Access |
| UGC upload, comments or feeds | User-Generated Content (also check the reviewer's 1.2 findings) |
| Follows or friend graphs, public profiles, feeds of other users | Social Media |
| Chat or messaging | Messaging and Chat |
| Location sent to other users (friend finder, live sharing) | Shared Location |
| Matching, swiping, dating profiles, AI companion persona with romance | Dating and Relationships |
| Random rewards bought with real or virtual currency | Loot Boxes (and 3.1.1 odds disclosure) |
| Casino mechanics without real money | Simulated Gambling |
| Real-money wagering | Gambling (and 5.3 licensing) |
| Ad SDKs | Advertising |

**When the code can't decide** (frequency of themes in content, artwork), write `decide` and explain
the frequency scale.
