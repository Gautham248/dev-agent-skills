# Regional requirements

**Snapshot:** 2026-11-26. Regional rules change fastest; Step 1's `/news/` fetch is the main way to
catch updates. Each section lists its source and flag.

Only load the sections for the regions the developer named in Step 0.

---

## EU: trader status (Digital Services Act)

Source: ASC Help, "Manage EU DSA trader requirements". Upcoming Requirements. Flag: search-snippet,
with the dates verified.

- **What's at stake:** without verified trader status, apps are removed from the EU App Store (since
  2025-02-17), and updates for EU distribution can't be submitted (since 2024-10-16).
- **Where:**
  - account level: Business, then Agreements, then Compliance, then Digital Services Act
  - app level: General, then App Compliance, then Digital Services Act
  - roles: Account Holder or Admin
- **What a trader must provide:**
  - an address (an organization's address comes from its D-U-N-S Number; an individual can use an
    address or a P.O. Box)
  - **both** a phone number and an email address, each verified by a code
  - payment details
  - a certification of EU-law compliance
  - a document proving the business name and address
  - optionally, a Labels and Markings URL
- **Visibility:** trader details are shown on the EU product page.
- **Declaring "non-trader":** EU consumer-protection rights won't apply to contracts with you.

## US states: age-assurance laws

Source: Apple news `?id=btkirlj8`, `?id=8jzbigf4`, `?id=sg176nne`, `?id=f5zj08ey`. Flag: search-snippet.

| State | Effective for new accounts |
|---|---|
| Texas (SB2420) | In force since the injunction was lifted on 2026-06-03 |
| Utah | 2026-05-06 |
| Louisiana | 2026-07-01 |

**Apple's expected implementation:**
- the **Declared Age Range API** (iOS 26, iPadOS 26 and macOS 26 or later)
- the **Significant Change API** (PermissionKit), for significant app changes that need parental
  consent
- the StoreKit **age rating property**
- App Store Server Notifications

**This skill's job is to flag, not fix.** With US distribution, report any API that isn't imported as
an **age-assurance evidence gap**. Implementing it belongs to `apple-appstore-reviewer`'s next pass.
The "Social Media Disabled for Users Under 13" questionnaire item also needs at least a Declared Age
Range API check.

## Japan: Mobile Software Competition Act (MSCA)

Source: Apple Newsroom 2025-12. Flag: search-snippet (regional mirrors read; re-read the US URL).

- **Alternative payments and link-outs are allowed** in Japan. They are always shown alongside
  In-App Purchase.
- **Users under 18** must pass a parental gate before using alternative payments or link-outs.
- **Users under 13** can't be sent to a website for transactions.
- **Kids Category apps** can't link out for transactions.
- **Out of scope:** business terms and commissions. Link the newsroom post instead.
- **In the packet:** this affects Step 4.3 (pricing and the Digital Goods and Services questionnaire)
  and the review notes (explain the payment options per region).

## US storefront: external purchase links

Source: guideline 3.1.1(a) and 3.1.3. Flag: search-snippet.

- **US storefront:** apps may include buttons, external links or other calls to action to other
  purchase methods without an entitlement.
- **Elsewhere:** that needs the StoreKit External Purchase Link entitlement for the storefront.
- **Current EU alternative terms:** **open**. Link the guideline; don't summarize terms.

## Brazil

Source: age-ratings page and Apple news. Flag: verified, except the news items (search-snippet).

- **Official ratings win:** ratings from the Ministry of Justice (MJSP) override the developer's
  self-rating.
- **Self-rating scale:** AL, A6, A10, then upward.
- **Fixed ratings:**
  - Shared Location: **A16**
  - Dating and Relationships: **A18**
  - Loot boxes: **18+**

  A lower official rating can be requested from the MJSP, for example for parent-child location
  sharing.
- **Fixed-odds betting:** needs a Brazilian **SPA license**. Put the license details in the review
  notes and attach the documents (guideline 5.3.4).

## Australia

Source: age-ratings page. Flag: verified.

- Loot boxes give **16+**.
- Infrequent simulated gambling gives **R 18+**.

## Korea

Source: age-ratings page. Flag: search-snippet.

- **Ratings:** All, 12+, 15+, 19+.
- **RCN (Rating Classification Number):** App Review may ask for one. Apps with frequent or intense
  simulated gambling are available in Korea **only** with an RCN.
- **RCN options:** Suitable for all ages, 12+, 15+, or Not permitted for juveniles.
- **Organizations distributing in Korea** must complete the Korea availability field.

## Vietnam

Source: age-ratings page; ASC "App and compliance information". Flag: search-snippet.

- **Ratings:** 00+, 12+, 16+, 18+.
- **Games** need a game license; without it the storefront status is "Missing Game registration
  number".

## China mainland

Source: ASC "App and compliance information". Flag: search-snippet.

- **ICP filing number** required for apps that need one. Without it the storefront status is "ICP
  Filing Number Missing" or "Invalid".
- Some app types need additional approvals.

## EEA, UK, US: regulated medical device status

Source: ASC Help "Declare regulated medical device status". Flag: search-snippet.

- **Who must declare:** apps in these regions with a primary or secondary category of **Health &
  Fitness or Medical**, or marked "frequent" for Medical or Treatment Information in the age-rating
  questionnaire.
- **Where:** App Compliance, then Regulated Medical Devices. Answer Yes or No. For Yes, each region
  needs:
  - the EU Manufacturer SRN or FDA Owner/Operator Number
  - an instructions-for-use URL
  - a use statement
  - safety information
- **Deadline:** none set. Some regions need regulator registration first. Roles: Account Holder or
  Admin.

## France: encryption declaration

See `export-compliance.md`. Needed only for encryption not provided by the OS, and only when
distributing in France.
