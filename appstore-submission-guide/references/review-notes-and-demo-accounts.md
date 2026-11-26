# App Review Information: notes, demo accounts, documentation

**Snapshot:** 2026-11-26.

**Sources:**
- https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review (verified)
- https://developer.apple.com/distribute/app-review/ (verified)
- Guidelines 2.1 and 2.3.1(a)

**"Incomplete submissions will be rejected."** Everything below goes in the App Review Information
section of the version page: Notes, Sign-in, Contact and Attachment.

---

## What the notes must cover (Apple's list)

1. **New app:** the concept, its purpose and audience, and the business model.
2. **Update:** what changed, and **where in the app to find each new feature**. Generic text is
   rejected under 2.3.1(a).
3. **Devices and OS versions** you tested on.
4. **External services** the core features depend on: data providers, authentication, payment
   processors, AI services.
5. **Required hardware:** attach a **video** of the app pairing with and using the physical device.
   It must be filmed, not a screen recording.
6. **Regional differences** in features or content, or a statement that the app behaves the same
   everywhere.
7. **Non-obvious features and every in-app purchase:** how to reach each one, and why any configured
   purchase can't be found (2.1(b)).
8. **Hidden or remotely configured behaviour:** disclose any feature flags or server-driven features.
   Undisclosed dormant features breach **2.5.19**.

## Demo accounts

- **Credentials must work at submission time and must not expire.** Credentials that change before
  review starts get the submission rejected.
- **More than one role** (admin and member, buyer and seller): add the extra accounts in Notes.
- **Auto-renewing subscriptions:** provide an account whose subscription has **expired**, so the
  reviewer can test the whole purchase flow.
- **MFA or one-time codes:** put a static code, or instructions, in Notes. Otherwise Apple may need a
  call, which typically takes **3–5 business days**.
- **SSO-only login:** give demo details for that identity provider.
- **Demo mode instead of an account:** allowed for sensitive-data or highly regulated apps, with
  Apple's prior approval (2.1(a)). It must show the full feature set.
- **Never paste real customer credentials.** The packet uses placeholders such as
  `<demo-username>`.

## Documentation by guideline

These go in Attachment and are referenced in Notes.

| Feature | Guideline | Documents |
|---|---|---|
| Diagnosis or treatment claims | 1.4.1 | Regulatory clearance (FDA, CE or CFDA), or a test report or peer-reviewed study |
| Cannabis or dispensary | 1.4.3 | Dispensary license |
| Crime reporting | 1.7 | Partnership with local law enforcement, on official letterhead |
| Crypto exchange or wallet | 3.1.5 | Exchange license per region, partnership documents, a legal opinion |
| Financial services or loans | 3.2.1, 3.2.2 | Partnership with the licensed institution, loan or business license |
| Third-party IP, sports, music, streaming | 4.1, 5.2.1, 5.2.3 | Trademark or rights documents, contracts or emails |
| Health research | 5.1.3 | Ethics board (IRB) approval and the consent form |
| Gambling, lotteries, real-money gaming | 5.3.3, 5.3.4 | Gambling license per storefront. Brazil fixed-odds betting needs an SPA license. |
| Kids apps with third-party ads | 1.3 | The ad network's published Kids policy, including human review of ad creatives |
| An individual submitting where a legal entity is required | 5.1.1(ix) | The entity's documents, or resubmit from an organization account |
| VPN | 5.4 | VPN license for each territory that requires one |

## Notes template (fill in; stay under 4000 bytes)

```
APP OVERVIEW
<What the app does, for whom, business model — 2–3 sentences.>

WHAT'S NEW IN THIS VERSION        (updates only)
- <Feature> — reach it via <Tab > Screen > Button>.

HOW TO REVIEW
1. Sign in with the demo account above (role: <role>).
   Additional account: <user> / <password> (role: <role>).
2. <Steps to the core feature.>
3. In-App Purchases: <where each product appears; sandbox notes>.
   Expired-subscription account: <user> / <password>.

PERMISSIONS
- <Camera/Location/...>: used for <purpose>, requested when <moment>.

ACCOUNT DELETION
Settings > Account > Delete Account (deletes account and personal data; <timing>).

EXTERNAL SERVICES
<Auth/payment/AI providers the core flow depends on.>

TESTED ON
<Devices / OS versions.>

REGIONAL DIFFERENCES
<None | details>.

ATTACHMENTS
<Docs/video attached and the guideline each addresses.>
```

## Contact

Give a name, an email address, and a phone number in international format (`+<country code>`). App
Review uses it, so keep it monitored during the review.

## Appointments

App Review offers 30-minute video appointments for guideline questions. Use one before submitting
anything borderline.
