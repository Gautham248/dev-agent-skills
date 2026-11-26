# Dated requirements

**Snapshot:** 2026-11-26. Re-check on every run (SKILL.md Step 1). Sorted newest first.

| Effective | Requirement | Source | Flag |
|---|---|---|---|
| **2027-04** | iOS and iPadOS apps built with the **iOS & iPadOS 27 SDK** or later **and targeting iOS 15** or later. tvOS, visionOS and watchOS need their 27 SDKs. | https://developer.apple.com/ios/submit/ (the news post `?id=k1mtkt1k` leaves out the iOS 15 target; the Upcoming Requirements page doesn't list it) | search-snippet |
| **2027-04** | iPhone Duo screenshots required for apps using the iOS 27.1 SDK or later | Screenshot specifications | verified |
| **2027-01-12** | Shared Location and Dating and Relationships age-rating declarations completed for all apps | Apple news `?id=yxkh08us` | search-snippet |
| 2027-01-01 | California sales tax on certain categories (SaaS, App Store software, dating, boosting) | Apple news, 2026-11-17 | search-snippet |
| 2026-11-16 | New age-rating descriptors appear in the questionnaire; required on the next update or questionnaire edit | Apple news | secondary (date) |
| 2026-10-16 | Guidelines revised: new 2.3.14 (creative assets), new 2.5.19 (hidden features), 1.2 and 3.1.1(a) changes | Apple news `?id=92th7e5i` | verified |
| 2026-10-13 | Revised Apple Developer Program License Agreement; accept it in the account | Apple news | search-snippet |
| **2026-09-09** | iOS and iPadOS apps uploaded must **target iOS 13 or later** | Upcoming Requirements | verified |
| 2026-07-01 | Louisiana age-assurance law for new accounts | Apple news `?id=f5zj08ey` | search-snippet |
| 2026-06-03 | Texas SB2420 injunction lifted; new Texas accounts covered | Apple news `?id=sg176nne` | search-snippet |
| 2026-05-06 | Utah age-assurance law for new accounts | Apple news `?id=f5zj08ey` | search-snippet |
| **2026-04-28** | Built with **Xcode 26** or later, using an OS 26 SDK | Upcoming Requirements | verified |
| 2026-01-31 | Responses to the updated age-rating questions required | Upcoming Requirements | verified |
| 2025-02-17 | Apps without verified EU trader status removed from the EU App Store | Upcoming Requirements | verified |
| 2024-10-16 | EU trader status required to submit updates for EU distribution | Upcoming Requirements | verified |
| 2024-05-01 | Approved reasons required for required-reason APIs, including in SDKs | Upcoming Requirements | verified |
| 2023-08-16 | Game Center entitlement and App Store Connect setup required for Game Center features | Upcoming Requirements | verified |

**Ongoing, with no date set:**
- **Accessibility Nutrition Labels:** voluntary now; will become required with "ample time" given.
  (search-snippet)
- **Regulated medical device status:** no deadline set; some regions need regulator registration
  first. (search-snippet)

## How to use this in the packet

1. **Build checks (Step 4.9):** compare the project's `SDKROOT`/Xcode version and
   `IPHONEOS_DEPLOYMENT_TARGET` with the bolded rows. If a submission or the next update could land
   after April 2027, warn about the iOS 15 / iOS 27 SDK floor now.
2. **Showing dates:** always print the "as of" date next to a requirement.
3. **If Step 1 found anything newer,** say so before this table.
