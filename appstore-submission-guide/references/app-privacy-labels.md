# App Privacy labels (nutrition labels) and privacy manifests

**Snapshot:** 2026-11-26.

**Sources** (all verified except where marked):
- https://developer.apple.com/app-store/app-privacy-details/
- privacy-manifest and required-reason JSON (developer.apple.com/tutorials/data/...)
- https://developer.apple.com/support/third-party-SDK-requirements/
- ASC Help "Manage app privacy" (search-snippet)

**Required to submit new apps and updates.** The label covers your own practices **and** those of
every third-party SDK in the app. Answers can be changed at any time without an app update. Changes
publish immediately, or when the product page goes live.

---

## Definitions that decide every answer

- **Collect:** data is sent off the device and kept longer than it takes to service the request in
  real time.
  - Not collected: data processed only on the device.
  - Not collected: data sent only to service a request and not retained.
- **Apple frameworks:** you aren't responsible for data Apple itself collects (MapKit, CloudKit, App
  Analytics). You are responsible for what **you** collect through them.
- **Linked to the user:** data is linked unless it was de-identified **before** collection, and you
  never re-link it. "Personal data" under privacy law always counts as linked.
- **Tracking:** linking app data about a user or device with **third-party data** for targeted ads or
  ad measurement, or sharing it with a data broker.
  - Not tracking: on-device-only linking, data-broker use solely for fraud or security, or credit
    reporting.
  - An SDK that reuses your users' data for ads elsewhere **is tracking**, even if you never use it
    for ads.
- **Web views:** declare data collected through web traffic, unless the user is browsing the open web.
- **Free-form text:** declare "Other User Content", or "Audio Data" for voice. A specific field such
  as an email address is declared as its specific type.

## Optional disclosure (all four must be true)

1. Not used for tracking, third-party ads, your own ads or marketing, or "other purposes".
2. Collected only occasionally, outside the primary function, and optional for the user.
3. Entered by the user in the app's UI, clearly, with a deliberate choice each time.
4. The user's name or account name appears next to the data in the form.

Data collected continuously after a one-time permission **must** be disclosed. Separate carve-outs
exist for product-improvement programs, regulated financial services and health research approved by
an ethics board.

## Data types

| Category | Types |
|---|---|
| Contact Info | Name; Email Address (including hashed); Phone Number (including hashed); Physical Address; Other User Contact Info |
| Health & Fitness | Health; Fitness |
| Financial Info | Payment Info; Credit Info; Other Financial Info |
| Location | Precise Location (3 or more decimal places); Coarse Location |
| Sensitive Info | Sensitive Info |
| Contacts | Contacts |
| User Content | Emails or Text Messages; Photos or Videos; Audio Data; Gameplay Content; Customer Support; Other User Content |
| Browsing History | Browsing History |
| Search History | Search History |
| Identifiers | User ID; Device ID |
| Purchases | Purchase History |
| Usage Data | Product Interaction; Advertising Data; Other Usage Data |
| Diagnostics | Crash Data; Performance Data; Other Diagnostic Data |
| Surroundings | Environment Scanning |
| Body | Hands; Head |
| Other Data | Other Data Types |

**Purposes:** Third-Party Advertising; Developer's Advertising or Marketing; Analytics; Product
Personalization; App Functionality; Other Purposes.

**Answers asked for each type:** is it linked to the user, is it used for tracking, and for which
purposes.

## SDK-to-label heuristics (draft only, always "verify against the vendor's disclosure")

| Signal in the repo | Usual label rows to consider |
|---|---|
| Firebase Analytics, Amplitude, Mixpanel, Segment, PostHog | Product Interaction, Device ID or User ID, Other Usage Data, for Analytics |
| Firebase Crashlytics, Sentry, Bugsnag | Crash Data, Performance Data, Other Diagnostic Data, for App Functionality or Analytics |
| AdMob, AppLovin, Unity Ads, IronSource, Meta Audience Network | Advertising Data, Device ID, Product Interaction, Coarse Location, for Third-Party Advertising; **likely tracking**, so App Tracking Transparency is required |
| AppsFlyer, Adjust, Branch, Kochava | Device ID, Advertising Data, Product Interaction, for Analytics or advertising; often tracking |
| FBSDKCoreKit / FBSDKLoginKit | Name, Email Address, User ID, Device ID; check its tracking behaviour |
| GoogleSignIn, Sign in with Apple, your own auth | Name, Email Address, User ID, for App Functionality |
| RevenueCat, StoreKit receipt validation on a server | Purchase History, User ID, for App Functionality |
| OneSignal, Firebase Messaging | Device ID (push token), User ID, for App Functionality |
| `CLLocationManager` plus location sent to a server | Precise or Coarse Location, by accuracy |
| Chat or messaging features | Emails or Text Messages, Other User Content |
| Photo upload | Photos or Videos |
| `WKWebView` loading your own domain | Whatever that site collects |

## Privacy manifest (`PrivacyInfo.xcprivacy`), verified keys

| Key | Type | Meaning |
|---|---|---|
| `NSPrivacyTracking` | Boolean | The app or SDK tracks. If true, `NSPrivacyTrackingDomains` is needed. |
| `NSPrivacyTrackingDomains` | array of strings | Domains used for tracking; blocked until the user grants ATT |
| `NSPrivacyCollectedDataTypes` | array of dictionaries | Each has `NSPrivacyCollectedDataType` (string), `NSPrivacyCollectedDataTypeLinked` (bool), `NSPrivacyCollectedDataTypeTracking` (bool) and `NSPrivacyCollectedDataTypePurposes` (array). The string constants are **open**; use Xcode's manifest editor to pick them. |
| `NSPrivacyAccessedAPITypes` | array of dictionaries | `NSPrivacyAccessedAPIType` plus `NSPrivacyAccessedAPITypeReasons` |

**The label and the manifests must agree.** Xcode merges every manifest into a privacy report
(Product, then Archive, then Generate Privacy Report). Compare it with the drafted label; any mismatch
is a `fix first` row.

## Required-reason APIs (approved reasons required to upload since 2024-05-01), verified

| Category | Covers | Reason codes |
|---|---|---|
| `NSPrivacyAccessedAPICategoryFileTimestamp` | `creationDate`, `modificationDate`, `stat`, `fstat`, `getattrlist` | DDA9.1 show timestamps to the user; C617.1 files inside the app, app group or container; 3B52.1 files the user granted access to; 0A2A.1 a third-party SDK wrapper |
| `NSPrivacyAccessedAPICategorySystemBootTime` | `systemUptime`, `mach_absolute_time()` | 35F9.1 measure elapsed time; 8FFB.1 absolute event timestamps (boot time never leaves the device); 3D61.1 an optional user-submitted bug report |
| `NSPrivacyAccessedAPICategoryDiskSpace` | `volumeAvailableCapacityKey`, `statfs`, ... | 85F4.1 show to the user; E174.1 check space before writing; 7D9E.1 a bug report; B728.1 a health-research app |
| `NSPrivacyAccessedAPICategoryActiveKeyboards` | `activeInputModes` | 3EC4.1 a custom keyboard app; 54BD.1 a UI that adapts to the active keyboard |
| `NSPrivacyAccessedAPICategoryUserDefaults` | `UserDefaults` | CA92.1 the app's own data; 1C8F.1 the same App Group; C56D.1 a third-party SDK wrapper; AC6B.1 MDM managed configuration |

## SDKs that need a privacy manifest (and a signature when used as a binary)

These rules apply when a new app includes one of these SDKs, or an update adds one. The list covers
any version, and SDKs that repackage these. You are responsible for all code an SDK brings in.

`scripts/harvest_evidence.py` holds this same list as `MANIFEST_SDKS`. Keep the two in sync.

- **Google and Firebase:** Abseil, BoringSSL / openssl_grpc, FirebaseABTesting, FirebaseAuth,
  FirebaseCore (plus CoreDiagnostics, CoreExtension, CoreInternal), FirebaseCrashlytics,
  FirebaseDynamicLinks, FirebaseFirestore, FirebaseInstallations, FirebaseMessaging,
  FirebaseRemoteConfig, GoogleDataTransport, GoogleSignIn, GoogleToolboxForMac, GoogleUtilities,
  grpcpp, GTMAppAuth, GTMSessionFetcher, leveldb, nanopb, Promises, FBLPromises, Protobuf.
- **Facebook:** FBAEMKit, FBSDKCoreKit (and _Basics), FBSDKLoginKit, FBSDKShareKit.
- **Flutter plugins:** connectivity_plus, device_info_plus, file_picker, Flutter,
  flutter_inappwebview, flutter_local_notifications, fluttertoast, geolocator_apple,
  image_picker_ios, package_info, package_info_plus, path_provider, path_provider_ios, share_plus,
  shared_preferences_ios, sqflite, url_launcher, url_launcher_ios, video_player_avfoundation,
  wakelock, webview_flutter_wkwebview.
- **Other:** AFNetworking, Alamofire, AppAuth, Capacitor, Charts, Cordova,
  DKImagePickerController, DKPhotoGallery, FMDB, hermes, IQKeyboardManager (and Swift), Kingfisher,
  Lottie, MBProgressHUD, OneSignal (plus Core, Extension, Outcomes), OpenSSL, OrderedSet,
  Reachability, RealmSwift, RxCocoa, RxRelay, RxSwift, SDWebImage, SnapKit, Starscream,
  SVProgressHUD, SwiftyGif, SwiftyJSON, Toast, UnityFramework.
