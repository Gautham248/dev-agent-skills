# Guidelines that govern submission metadata

**Snapshot:** 2026-11-26. App Review Guidelines "Last Updated: October 16, 2026".
**Source:** https://developer.apple.com/app-store/review/guidelines/. Verified, but some long sections
were model-summarized, so quote short and confirm exact wording on the page before citing it in an
appeal.

Code-level guideline checks belong to `apple-appstore-reviewer`. This file covers only what shows up
in the submission package: metadata, App Store Connect answers, review notes and documents.

---

## Before You Submit (Apple's checklist, paraphrased)

1. Test for crashes and bugs on device.
2. All app information and metadata are complete and accurate.
3. Contact information is current.
4. App Review has full access: an active demo account or a full-featured demo mode, plus any
   hardware or resources it needs (credentials, a sample QR code).
5. Backend services are live during review.
6. Non-obvious features and in-app purchases are explained in the review notes, with documentation
   where appropriate.
7. Required documentation is attached for features that need regulatory approval.

## Guideline-to-field map

| Guideline | Rule | Packet field(s) |
|---|---|---|
| 2.1(a) | A final build with all metadata and working URLs, no placeholder text, demo account, backend on. A demo mode can replace an account only with Apple's prior approval. | Review notes, demo account, URLs |
| 2.1(b) | In-app purchases complete, visible to the reviewer and working; otherwise explain in the notes | IAP section, review notes |
| 2.2 | No demos, betas or trials on the store; use TestFlight | Name, description |
| 2.3 | Metadata, privacy info, screenshots and previews reflect the core experience and stay current | All metadata |
| 2.3.1(a) | Describe new features specifically in the review notes; generic descriptions are rejected | Review notes, What's New |
| 2.3.2 | Say whether featured items need extra purchases; promoted IAPs need proper names, screenshots and descriptions | Description, screenshots, IAP metadata |
| 2.3.3 | Screenshots show the app in use, not just title art, a login page or a splash screen | Screenshots |
| 2.3.4 | Previews use only screen captures of the app; narration and overlays are allowed | App previews |
| 2.3.5 | The most accurate category | Category |
| 2.3.6 | Answer the age-rating questions honestly | Age rating |
| 2.3.7 | Unique name (30 characters max); no prices, trademarks, popular app names or irrelevant terms in the name, subtitle, keywords, screenshots or previews; the subtitle must not reference other apps or make unverifiable claims | Name, subtitle, keywords, screenshots |
| 2.3.8 | Metadata (including IAP icons) suits a 4+ audience even if the app is rated higher. "For Kids" and "For Children" are reserved for the Kids Category. Keep names and icons consistent. | All visual metadata, name |
| 2.3.9 | Rights to all icon, screenshot and preview material; fictional account data, never real people | Screenshots, previews |
| 2.3.10 | No other mobile platforms, their names or icons, or alternative marketplaces in the metadata | Description, screenshots |
| 2.3.11 | Pre-orders are complete and delivered as advertised | Availability |
| 2.3.12 | What's New describes significant changes | What's New |
| 2.3.13 | In-app events: correct event type, accurate metadata and dates, working deep link | In-app events |
| **2.3.14 (new, 2026-10-16)** | Creative assets (product page headers, search-result assets): relevant to the app, suitable for all audiences, no misleading references, unverifiable claims or specific or discounted prices | Creative assets, custom product pages |
| 2.5.1 | Public APIs only; state intended framework use in the description (e.g. HealthKit) | Description |
| **2.5.19 (new, 2026-10-16)** | No hidden, dormant or undocumented features. Apps that change after approval ("bait-and-switch") can be removed, and the developer removed from the program. | Review notes (disclose everything), description |
| 3.1.1 | Digital unlocks use in-app purchase; disclose loot-box odds before purchase; non-subscription trials are $0 IAP items with a clear duration | IAP metadata, review notes |
| 3.1.1(a) | US storefront: external links and calls to action are allowed without an entitlement. Elsewhere they need the StoreKit External Purchase Link entitlement. (search-snippet) | Description, review notes |
| 3.1.2 | Subscriptions: at least 7 days, work across the user's devices, clearly describe what's included. Links to **Terms of Use (EULA) and the Privacy Policy** must be in the app **and** in the metadata. | License Agreement / description, privacy URL |
| 4.1 | No copycats or impersonation; another brand needs written permission | Name, icon, screenshots, attachments |
| 4.3 | No duplicate apps; a saturated category needs real differentiation | Description, review notes |
| 4.8 | Third-party or social primary login needs an equivalent privacy-preserving option (name and email only, private email allowed) | Review notes (explain the login options) |
| 5.1.1(i) | Privacy policy link in App Store Connect **and** in the app. It covers what data is collected and how, all uses, third-party sharing, retention and deletion, and how to revoke consent. | Privacy Policy URL |
| 5.1.1(v) | Apps with account creation must offer **in-app account deletion**. Deactivation alone isn't enough. A web link is fine if it goes straight to the deletion page. | Review notes (where deletion lives) |
| 5.1.2 | Disclose third-party sharing, including third-party AI, and get consent; use App Tracking Transparency for tracking | App Privacy, review notes |
| 5.2 | Own or license all content; don't imply Apple endorsement | Content Rights, attachments |
| 5.3 | Sweepstakes need official rules stating Apple isn't a sponsor; real-money gaming needs licenses per location, geo-restriction and a free download | Review notes, attachments |
| 5.4 | VPN: organization developer, `NEVPNManager`, data disclosure before purchase; license per territory where required | Review notes, attachments |

## Top rejection causes (App Review overview page)

- **Guideline 2.1 accounts for over 40%** of unresolved issues.
- **Most common causes:**
  - crashes
  - broken support or privacy links
  - placeholder content
  - incomplete App Review Information (no demo account, no hardware video)
  - a privacy policy missing required content
  - missing purpose strings
  - inaccurate screenshots
  - minimum functionality (4.2), spam (4.3), copycats (4.1)
  - misleading metadata (2.3)
  - kids apps with ads that lack the ad network's kids policy
  - unauthorized third-party content
  - unlicensed regulated services
  - regulated apps submitted by an individual rather than the required legal entity

## Account deletion details

Source: https://developer.apple.com/support/offering-account-deletion-in-your-app/ (verified).

- **Deletion:** must be easy to find, typically in account settings, and delete the account and its
  personal data. Shared UGC must also be removed. Guest accounts must be deletable.
- **Timing and retention:** say how long deletion takes and what is retained.
- **Not allowed:** a customer-service-only deletion flow, except in regulated industries.
- **Sign in with Apple:** revoke tokens through the REST API.
- **Subscriptions:** tell users that billing continues through Apple until they cancel. Link to
  `showManageSubscriptions` or https://apps.apple.com/account/subscriptions.
