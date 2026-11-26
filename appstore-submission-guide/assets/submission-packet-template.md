# App Store submission packet: <App name> <version>

**Prepared:** <YYYY-MM-DD> · **Reference snapshot:** 2026-11-26 · **Freshness check:** <passed /
newer items found: … / offline, values "as of 2026-11-26, verify">
**Scope:** <new app | update> · <iPhone | iPhone + iPad> · <free | paid | IAP | subscriptions> ·
Regions: <…>

## 1. Verdict: <Ready | Ready with decisions | Not ready>

**Blockers** (any P0 from the review, or a `fix first` row):
- <…>

**Decisions only you can make** (`decide` rows):
- <…>

## 2. Account prerequisites

| Item | Status | Action |
|---|---|---|
| Developer Program License Agreement (current revision) accepted | <…> | <…> |
| Paid Apps agreement, tax and banking (paid apps or IAP only) | <…> | <…> |
| EU trader status (DSA), if distributing in the EU | <…> | <…> |

## 3. App Store Connect, section by section

Each section uses these columns:

| Field | Drafted value | Evidence | Check | Action |
|---|---|---|---|---|

The Action column holds one of three values: `paste`, `decide` or `fix first`.

### 3.1 App Information
### 3.2 Pricing and availability (and the Digital Goods and Services questionnaire)
### 3.3 App Privacy

Data-type table: Type | Collected by | Linked | Tracking | Purposes | Evidence.

Manifest cross-check: <match | mismatches listed as `fix first`>.

### 3.4 Age rating

Per-item answers, with the minimum rating each answer forces and any regional ratings.

### 3.5 App Accessibility (voluntary)
### 3.6 App Compliance (DSA, medical devices, Korea, China mainland, Vietnam)
### 3.7 Version page (metadata, screenshots, previews)
### 3.8 Build and export compliance

- SDK, Xcode and deployment-target checks (with the April 2027 warning if relevant)
- The encryption decision and the Info.plist keys

### 3.9 In-app purchases and subscriptions
### 3.10 App Review Information

- **Contact:** <name> · <+country phone> · <email>
- **Demo account:** `<demo-username>` / `<demo-password>`. Expired-subscription account:
  `<expired-user>` / `<expired-password>`.
- **Attachments:** <document, and the guideline it addresses>

**Notes (paste-ready, under 4000 bytes):**
```
<filled notes template>
```

### 3.11 Release

<Manual | Automatic | Scheduled> · Phased release: <yes/no, and why>.

## 4. Asset checklist

- [ ] Screenshots: iPhone Dynamic Island (medium) **and** (large); iPad 13" if the app runs on iPad;
      no alpha; 1–10 per class
- [ ] App previews (optional): 15–30 s, at most 500 MB
- [ ] Privacy policy URL working, and linked inside the app
- [ ] Support URL working, with real contact details
- [ ] Terms of Use (EULA) link in the app and in the metadata (subscriptions)
- [ ] Validators: `validate_metadata.py` <OK / issues>, `check_screenshots.py` <OK / issues>

## 5. Open questions from Apple's own pages

<Conflicts and **open** items that affect this app: the screenshot required class, keyword and notes
units, …>

## 6. After you submit

- **Expected review time:** 50% within 24 h, 90% within 48 h.
- **If rejected:** reply in App Review messages first. Fix only the cited section. A Metadata Rejected
  status needs no new build.
- **Appeal:** one per rejection, citing the guideline point by point.
- **Expedite:** only for a critical bug or a dated event.
- **Phased release:** pause it if crash rates rise (up to 30 days in total).
