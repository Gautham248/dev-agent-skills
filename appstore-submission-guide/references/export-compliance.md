# Export compliance (encryption)

**Snapshot:** 2026-11-26.

**Sources:**
- ASC Help "Overview of export compliance" (verified)
- "Determine and upload app encryption documentation" (search-snippet)
- "Export compliance documentation for encryption" (search-snippet)
- Xcode Help (search-snippet)

**What it covers:** any app that uses, accesses, contains, implements or incorporates encryption needs
an export compliance determination. That includes HTTPS through the OS, so in practice almost every
app. Deciding whether the US Export Administration Regulations (EAR) require a CCATS classification is
the **developer's** responsibility. This skill flags the question; it never answers it.

---

## Decision tree

```
Does the app use encryption at all (including HTTPS/TLS via URLSession, CryptoKit, Keychain)?
├─ No ──────────────────────────────► Set ITSAppUsesNonExemptEncryption = NO. No documentation.
└─ Yes
   ├─ Only encryption provided by Apple's OS (URLSession/TLS, CryptoKit, CommonCrypto, Security)?
   │    └─► No documentation required. Set ITSAppUsesNonExemptEncryption = NO
   │        so the questions aren't asked on every upload.
   ├─ Industry-standard algorithm NOT provided by the OS (bundled OpenSSL, BoringSSL, libsodium, ...)?
   │    ├─ Distributing in France? ─► French encryption declaration required (search-snippet)
   │    │                              (banking and medical apps are exempt there).
   │    └─ Otherwise ─────────────► Developer decides on CCATS / exemption; flag as `decide`.
   └─ Proprietary or non-standard algorithm?
        └─► Documentation required: upload in App Encryption Documentation before review,
            wait for approval (Apple expects ~2 business days), then set
            ITSEncryptionExportComplianceCode = <key Apple issues> and
            ITSAppUsesNonExemptEncryption = YES.
```

## Info.plist keys

| Key | Value | When |
|---|---|---|
| `ITSAppUsesNonExemptEncryption` | Boolean | Always set it. With `NO`, App Store Connect stops asking the questions on every build. |
| `ITSEncryptionExportComplianceCode` | string (the key Apple issues) | Only after Apple approves uploaded documentation |

**If the key is missing,** App Store Connect asks the encryption questions for every uploaded build. A
build waiting on the answer can't be submitted. Report it as an evidence gap with the drafted answer,
never as "exempt" by assumption.

## Uploading documentation

- **Before uploading:** fill in the App Description field and set App Store availability.
- **Where:** App Information, then App Encryption Documentation, then +. Answer the dialog, upload the
  file and Save. A build missing the information shows a "Manage" link under Distribution or
  TestFlight.
- **Roles:** Account Holder, Admin or App Manager.
- **Status:** while Apple reviews the documentation the app shows "Waiting for Export Compliance".

## France

The main controlled items are Secure Storage, Secure Communications and Security Anti-Virus apps;
banking and medical apps are exempt. Detail comes from ANSSI. A declaration is needed only for
encryption that **isn't** provided by the OS and only when distributing in France. (search-snippet)
