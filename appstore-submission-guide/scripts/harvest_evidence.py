#!/usr/bin/env python3
"""
harvest_evidence.py -- pull App Store submission evidence out of an iOS / iPadOS
repo (native, Flutter, React Native, Capacitor) and print it as JSON.

Usage:
    python3 harvest_evidence.py <repo-root> [--regions EU,US,JP,BR,AU,KR,CN,VN,FR,UK,EEA]
                                            [--target <app target name>]

Statuses: ok | needs_target_selection (re-run with --target) |
          generated_project (Expo, Flutter, React Native, Capacitor, XcodeGen, Tuist,
          Unity or .NET MAUI without a committed Xcode project) | not_an_ios_project.

It only reads files. Everything it reports is a pointer for the agent to open
and confirm -- never a final answer for a privacy label or questionnaire.
Exit code: 0 = harvested (or not_an_ios_project reported), 2 = bad input.
"""

import argparse
import json
import plistlib
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pbxproj  # noqa: E402
from check_screenshots import read_png  # noqa: E402

SKIP_DIRS = {".git", "node_modules", "Pods", "build", "DerivedData", "Carthage", ".build",
             "SourcePackages", ".dart_tool", ".symlinks", "vendor", ".gradle", "android"}
DEP_DIRS = {"Pods", "SourcePackages", ".build", "Carthage", "node_modules", ".symlinks"}
SOURCE_EXTS = {".swift", ".m", ".mm", ".h", ".dart", ".ts", ".tsx", ".js", ".jsx"}
MAX_HITS = 5

# Mirrors the SDK list in references/app-privacy-labels.md
# (https://developer.apple.com/support/third-party-SDK-requirements/).
MANIFEST_SDKS = [
    "Abseil", "AFNetworking", "Alamofire", "AppAuth", "BoringSSL", "openssl_grpc", "Capacitor", "Charts",
    "connectivity_plus", "Cordova", "device_info_plus", "DKImagePickerController", "DKPhotoGallery",
    "FBAEMKit", "FBLPromises", "FBSDKCoreKit", "FBSDKCoreKit_Basics", "FBSDKLoginKit", "FBSDKShareKit",
    "file_picker", "FirebaseABTesting", "FirebaseAuth", "FirebaseCore", "FirebaseCoreDiagnostics",
    "FirebaseCoreExtension", "FirebaseCoreInternal", "FirebaseCrashlytics", "FirebaseDynamicLinks",
    "FirebaseFirestore", "FirebaseInstallations", "FirebaseMessaging", "FirebaseRemoteConfig", "Flutter",
    "flutter_inappwebview", "flutter_local_notifications", "fluttertoast", "FMDB", "geolocator_apple",
    "GoogleDataTransport", "GoogleSignIn", "GoogleToolboxForMac", "GoogleUtilities", "grpcpp", "GTMAppAuth",
    "GTMSessionFetcher", "hermes", "image_picker_ios", "IQKeyboardManager", "IQKeyboardManagerSwift",
    "Kingfisher", "leveldb", "Lottie", "MBProgressHUD", "nanopb", "OneSignal", "OneSignalCore",
    "OneSignalExtension", "OneSignalOutcomes", "OpenSSL", "OrderedSet", "package_info",
    "package_info_plus", "path_provider", "path_provider_ios", "Promises", "Protobuf", "Reachability",
    "RealmSwift", "RxCocoa", "RxRelay", "RxSwift", "SDWebImage", "share_plus", "shared_preferences_ios",
    "SnapKit", "sqflite", "Starscream", "SVProgressHUD", "SwiftyGif", "SwiftyJSON", "Toast",
    "UnityFramework", "url_launcher", "url_launcher_ios", "video_player_avfoundation", "wakelock",
    "webview_flutter_wkwebview",
]
# Package identities (SPM / npm) that bundle listed SDKs under a different name.
SDK_ALIASES = {
    "firebase-ios-sdk": ["FirebaseCore", "FirebaseInstallations", "GoogleUtilities"],
    "facebook-ios-sdk": ["FBSDKCoreKit", "FBAEMKit"],
    "googlesignin-ios": ["GoogleSignIn"],
    "lottie-ios": ["Lottie"], "lottie-spm": ["Lottie"], "lottie-react-native": ["Lottie"],
    "realm-swift": ["RealmSwift"], "onesignal-ios-sdk": ["OneSignal"], "onesignal-xcframework": ["OneSignal"],
    "abseil-cpp-binary": ["Abseil"], "grpc-binary": ["grpcpp"], "gtm-session-fetcher": ["GTMSessionFetcher"],
    "appauth-ios": ["AppAuth"], "swiftyjson": ["SwiftyJSON"], "rxswift": ["RxSwift"],
    "@capacitor/core": ["Capacitor"], "@capacitor/ios": ["Capacitor"], "cordova-ios": ["Cordova"],
    "react-native": ["hermes"], "flutter": ["Flutter"],
}
_NORM = {re.sub(r"[^a-z0-9]", "", s.lower()): s for s in MANIFEST_SDKS}

BUNDLED_CRYPTO_RE = re.compile(r"^(openssl.*|boringssl.*|openssl_grpc|libsodium|sodium|swift-sodium|"
                               r"cryptoswift|tweetnacl.*|react-native-quick-crypto|pointycastle|cryptography)$",
                               re.IGNORECASE)
OS_CRYPTO_RE = re.compile(r"\bimport\s+(CryptoKit|CommonCrypto)\b|\bSecKeyCreate|\bSecItemAdd|"
                          r"\bCC_SHA256\b|\bCCCrypt\b")
BUNDLED_CRYPTO_SRC_RE = re.compile(r"\bimport\s+(CryptoSwift|Sodium|OpenSSL)\b|#include\s*<openssl/")

SIGNALS = {
    "sign_in": r"ASAuthorizationAppleIDProvider|GIDSignIn|LoginManager\(|Auth\.auth\(\)|signInWith|"
               r"\bsignIn\(|firebase_auth|@react-native-firebase/auth|google_sign_in",
    "third_party_login": r"GIDSignIn|FBSDKLoginKit|LoginManager\(|google_sign_in|flutter_facebook_auth|"
                         r"TwitterKit|LineSDK|KakaoSDK",
    "sign_in_with_apple": r"ASAuthorizationAppleIDProvider|sign_in_with_apple|AppleAuthentication",
    "account_deletion": r"(?i)delete[_ ]?account|deleteUser|account[_ ]?deletion|removeAccount",
    "web_view": r"WKWebView|SFSafariViewController|webview_flutter|react-native-webview|InAppBrowser",
    "location": r"CLLocationManager|geolocator|expo-location|react-native-geolocation",
    "location_sharing": r"(?i)(share|sharing|live)[_ ]?location|locationShar|findMyFriends|friendLocation",
    "ugc": r"(?i)report(User|Content|Post)|blockUser|userGeneratedContent|createPost|postComment|uploadPost",
    "messaging": r"(?i)\b(chat(Room|Message|Service)|sendMessage|conversation(Id|View))",
    "social": r"(?i)follow(er|ing)s?\b|friendRequest|addFriend|socialFeed|newsFeed",
    "dating": r"(?i)\bdating\b|swipe(Left|Right)|matchProfile|romantic|virtual[_ ]?companion|girlfriend|boyfriend",
    "loot_box": r"(?i)loot[_ ]?box|gacha|mystery[_ ]?box|random[_ ]?reward",
    "gambling": r"(?i)\bcasino\b|slot[_ ]?machine|roulette|blackjack|\bpoker\b|\bwager|sportsbook|betting",
    "ads": r"GADMobileAds|GoogleMobileAds|AppLovin|IronSource|UnityAds|FBAudienceNetwork|google_mobile_ads|"
           r"react-native-google-mobile-ads",
    "att": r"ATTrackingManager|app_tracking_transparency|requestTrackingAuthorization",
    "storekit": r"import\s+StoreKit|Product\.products|SKProductsRequest|Purchases\.shared|in_app_purchase|"
                r"react-native-iap|purchases_flutter|react-native-purchases",
    "age_assurance": r"DeclaredAgeRange|AgeRangeService|import\s+PermissionKit",
    "health": r"import\s+HealthKit|HKHealthStore|health_kit|react-native-health",
}
REQUIRED_REASON_SRC = {
    "NSPrivacyAccessedAPICategoryUserDefaults": r"\bUserDefaults\b|NSUserDefaults|shared_preferences|AsyncStorage",
    # File APIs only. A bare `.creationDate` is usually a model property (SwiftData, Core Data),
    # so match the FileManager / URL resource-key spellings instead.
    "NSPrivacyAccessedAPICategoryFileTimestamp": r"FileAttributeKey\.(creationDate|modificationDate)|"
                                                 r"\[\s*\.(creationDate|modificationDate)\s*\]|"
                                                 r"NSFile(Creation|Modification)Date|attributesOfItem\(|"
                                                 r"(creation|contentModification|contentAccess|attributeModification)"
                                                 r"DateKey|\b[fl]?stat\(|getattrlist",
    "NSPrivacyAccessedAPICategorySystemBootTime": r"systemUptime|mach_absolute_time",
    "NSPrivacyAccessedAPICategoryDiskSpace": r"volumeAvailableCapacity|systemFreeSize|\bstatfs\(|\bstatvfs\(",
    "NSPrivacyAccessedAPICategoryActiveKeyboards": r"activeInputModes",
}
AGE_HINTS = {
    "loot_box": ("Loot Boxes", "9+", {"AU": "16+", "BR": "18+"}),
    "gambling": ("Gambling or Simulated Gambling (decide which)", "18+ if real-money gambling", {}),
    "dating": ("Dating and Relationships", "18+", {"BR": "A18"}),
    "location_sharing": ("Shared Location", "no minimum in some regions", {"BR": "A16"}),
    "social": ("Social Media", "13+", {}),
    "web_view": ("Unrestricted Web Access (only if users can browse freely)", "16+", {}),
    "ugc": ("User-Generated Content", "see questionnaire", {}),
    "messaging": ("Messaging and Chat", "see questionnaire", {}),
    "ads": ("Advertising", "see questionnaire", {}),
}

# Purpose strings: (label, accepted Info.plist keys, source regex). A missing key fails the upload
# (ITMS-90683) or crashes at runtime when the permission is requested.
PURPOSE_RULES = [
    ("location", ("NSLocationWhenInUseUsageDescription", "NSLocationAlwaysAndWhenInUseUsageDescription"),
     r"CLLocationManager\(|requestWhenInUseAuthorization|requestAlwaysAuthorization|CLLocationUpdate"),
    ("location always", ("NSLocationAlwaysAndWhenInUseUsageDescription",), r"requestAlwaysAuthorization"),
    ("camera", ("NSCameraUsageDescription",),
     r"AVCaptureDevice|AVCaptureSession|sourceType\s*=\s*\.camera|UIImagePickerController\.SourceType\.camera"),
    ("microphone", ("NSMicrophoneUsageDescription",),
     r"AVAudioRecorder|requestRecordPermission|AVAudioApplication\.request"),
    ("photo library", ("NSPhotoLibraryUsageDescription",), r"PHPhotoLibrary\.requestAuthorization|PHAsset\.fetch"),
    ("photo library add", ("NSPhotoLibraryAddUsageDescription", "NSPhotoLibraryUsageDescription"),
     r"UIImageWriteToSavedPhotosAlbum|creationRequestForAsset|PHAssetCreationRequest"),
    ("contacts", ("NSContactsUsageDescription",), r"CNContactStore"),
    ("calendars", ("NSCalendarsUsageDescription", "NSCalendarsFullAccessUsageDescription",
                   "NSCalendarsWriteOnlyAccessUsageDescription"), r"EKEventStore"),
    ("bluetooth", ("NSBluetoothAlwaysUsageDescription",), r"CBCentralManager|CBPeripheralManager"),
    ("motion", ("NSMotionUsageDescription",), r"CMMotionActivityManager|CMPedometer"),
    ("speech recognition", ("NSSpeechRecognitionUsageDescription",), r"SFSpeechRecognizer"),
    ("Face ID", ("NSFaceIDUsageDescription",), r"\.deviceOwnerAuthentication(WithBiometrics)?\b"),
    ("health", ("NSHealthShareUsageDescription", "NSHealthUpdateUsageDescription"), r"HKHealthStore"),
    ("tracking", ("NSUserTrackingUsageDescription",), r"requestTrackingAuthorization"),
    ("local network", ("NSLocalNetworkUsageDescription",), r"NWBrowser|NetServiceBrowser|NWListener"),
    ("media library", ("NSAppleMusicUsageDescription",), r"MPMediaLibrary|MPMediaQuery"),
    ("NFC", ("NFCReaderUsageDescription",), r"NFCNDEFReaderSession|NFCTagReaderSession"),
    ("HomeKit", ("NSHomeKitUsageDescription",), r"HMHomeManager"),
]
# Cross-platform plugins that need the same keys (dependency name -> rule labels).
PURPOSE_DEPS = {
    "geolocator": ["location"], "geolocator_apple": ["location"], "location": ["location"],
    "camera": ["camera"], "image_picker": ["camera", "photo library"], "image_picker_ios": ["camera", "photo library"],
    "mobile_scanner": ["camera"], "local_auth": ["Face ID"], "flutter_contacts": ["contacts"],
    "contacts_service": ["contacts"], "record": ["microphone"], "flutter_sound": ["microphone"],
    "react-native-vision-camera": ["camera"], "react-native-image-picker": ["camera", "photo library"],
    "react-native-geolocation-service": ["location"], "@react-native-community/geolocation": ["location"],
    "react-native-contacts": ["contacts"], "react-native-biometrics": ["Face ID"],
}
TEST_DIR_NAMES = {"Tests", "UITests", "tests", "test", "__tests__", "Specs", "spec", "specs", "__mocks__"}
TEST_FILE_RE = re.compile(r"(Tests?|Spec|Mock)\.(swift|m|mm)$|\.(test|spec)\.[jt]sx?$|_test\.dart$")


def walk(root, exts=None, names=None, include_deps=False):
    stack = [root]
    while stack:
        d = stack.pop()
        try:
            entries = sorted(d.iterdir())
        except OSError:
            continue
        for p in entries:
            if p.is_dir():
                if p.name in SKIP_DIRS and not (include_deps and p.name in DEP_DIRS):
                    continue
                if p.is_symlink():
                    continue
                stack.append(p)
            elif (exts and p.suffix in exts) or (names and p.name in names):
                yield p


def is_test_path(root, p):
    parts = p.relative_to(root).parts
    dirs = parts[:-1]
    if any(d in TEST_DIR_NAMES or d.endswith(("Tests", "UITests", "Specs")) for d in dirs):
        return True
    return bool(TEST_FILE_RE.search(parts[-1]))


def rel(root, p):
    return str(p.relative_to(root))


def load_plist(path):
    try:
        with path.open("rb") as fh:
            return plistlib.load(fh)
    except Exception:
        return None


def find_info_plists(root):
    out = []
    for p in walk(root, names={"Info.plist"}):
        if is_test_path(root, p):
            continue
        out.append(p)

    # Fallback ordering when no Xcode target says which plist is the app's: a plist that
    # describes an app (not an extension, watch app or App Clip) wins, then ios/Runner|App,
    # then the shortest path.
    def rank(p):
        data = load_plist(p) or {}
        not_app = any(k in data for k in ("NSExtension", "WKApplication", "WKWatchKitApp", "NSAppClip",
                                         "WKCompanionAppBundleIdentifier"))
        if data.get("CFBundlePackageType") not in (None, "APPL", "$(PRODUCT_BUNDLE_PACKAGE_TYPE)"):
            not_app = True
        flutter_rn = re.search(r"ios/(Runner|App)/Info\.plist$", p.as_posix())
        return (1 if not_app else 0, 0 if flutter_rn else 1, len(p.parts), p.as_posix())

    out.sort(key=rank)
    return out


def pbxproj_settings(root):
    settings = {}
    for proj in walk(root, names={"project.pbxproj"}):
        text = proj.read_text(encoding="utf-8", errors="ignore")
        for key in ("PRODUCT_BUNDLE_IDENTIFIER", "MARKETING_VERSION", "IPHONEOS_DEPLOYMENT_TARGET",
                    "SDKROOT", "TARGETED_DEVICE_FAMILY"):
            vals = re.findall(rf"\b{key}\s*=\s*\"?([^\";]+)\"?;", text)
            if vals:
                settings.setdefault(key, sorted(set(v.strip() for v in vals)))
        for k, v in re.findall(r"\bINFOPLIST_KEY_(\w+)\s*=\s*\"?([^\";]*)\"?;", text):
            settings.setdefault("INFOPLIST_KEYS", {})[k] = v.strip()
    return settings


def parse_dependencies(root):
    deps = {}

    def add(name, source):
        deps.setdefault(name, source)

    for p in walk(root, names={"Package.resolved"}, include_deps=False):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        pins = data.get("pins") or (data.get("object") or {}).get("pins") or []
        for pin in pins:
            name = pin.get("identity") or pin.get("package") or ""
            if name:
                add(name, rel(root, p))
    for p in walk(root, names={"Podfile.lock"}):
        in_pods = False
        for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.startswith("PODS:"):
                in_pods = True
                continue
            if in_pods and line and not line.startswith(" "):
                break
            m = re.match(r"^  - \"?([^\s/\"(]+)", line)
            if in_pods and m:
                add(m.group(1), rel(root, p))
    for p in walk(root, names={"pubspec.lock"}):
        in_pkgs = False
        for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.startswith("packages:"):
                in_pkgs = True
                continue
            if in_pkgs and line and not line.startswith(" "):
                break
            m = re.match(r"^  ([A-Za-z0-9_]+):\s*$", line)
            if in_pkgs and m:
                add(m.group(1), rel(root, p))
    for p in walk(root, names={"package.json"}):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for name in (data.get("dependencies") or {}):
            add(name, rel(root, p))
    return deps


def manifest_sdks(deps):
    found = {}
    for name, source in deps.items():
        hits = list(SDK_ALIASES.get(name.lower(), []))
        norm = re.sub(r"[^a-z0-9]", "", name.lower())
        if norm in _NORM:
            hits.append(_NORM[norm])
        if name.lower().startswith("@react-native-firebase/"):
            hits += ["FirebaseCore", "GoogleUtilities"]
        for h in hits:
            found.setdefault(h, {"dependency": name, "declared_in": source})
    return found


def scan_sources(root):
    files = [f for f in walk(root, exts=SOURCE_EXTS) if not is_test_path(root, f)]
    signals = {k: [] for k in SIGNALS}
    rr_used = {k: [] for k in REQUIRED_REASON_SRC}
    os_crypto, bundled_src = [], []
    purpose = {label: [] for label, _, _ in PURPOSE_RULES}
    purpose_rx = [(label, re.compile(rx)) for label, _, rx in PURPOSE_RULES]
    compiled = {k: re.compile(v) for k, v in SIGNALS.items()}
    rr_compiled = {k: re.compile(v) for k, v in REQUIRED_REASON_SRC.items()}
    for f in files:
        try:
            lines = f.read_text(encoding="utf-8", errors="ignore").splitlines()
        except OSError:
            continue
        for i, line in enumerate(lines, 1):
            loc = f"{rel(root, f)}:{i}"
            for k, rx in compiled.items():
                if len(signals[k]) < MAX_HITS and rx.search(line):
                    signals[k].append(loc)
            for k, rx in rr_compiled.items():
                if len(rr_used[k]) < MAX_HITS and rx.search(line):
                    rr_used[k].append(loc)
            for label, rx in purpose_rx:
                if len(purpose[label]) < MAX_HITS and rx.search(line):
                    purpose[label].append(loc)
            if len(os_crypto) < MAX_HITS and OS_CRYPTO_RE.search(line):
                os_crypto.append(loc)
            if len(bundled_src) < MAX_HITS and BUNDLED_CRYPTO_SRC_RE.search(line):
                bundled_src.append(loc)
    return signals, rr_used, os_crypto, bundled_src, len(files), purpose


def privacy_manifests(root):
    app, sdk = [], []
    for p in walk(root, names={"PrivacyInfo.xcprivacy"}, include_deps=True):
        parts = set(p.relative_to(root).parts)
        data = load_plist(p) or {}
        entry = {
            "path": rel(root, p),
            "tracking": data.get("NSPrivacyTracking"),
            "tracking_domains": data.get("NSPrivacyTrackingDomains", []),
            "collected_data_types": [d.get("NSPrivacyCollectedDataType") for d in
                                     data.get("NSPrivacyCollectedDataTypes", []) if isinstance(d, dict)],
            "accessed_api_types": {d.get("NSPrivacyAccessedAPIType"): d.get("NSPrivacyAccessedAPITypeReasons", [])
                                   for d in data.get("NSPrivacyAccessedAPITypes", []) if isinstance(d, dict)},
        }
        (sdk if parts & DEP_DIRS else app).append(entry)
    return app, sdk


def entitlements(root):
    out = {}
    for p in walk(root, exts={".entitlements"}):
        data = load_plist(p) or {}
        out[rel(root, p)] = sorted(data.keys())
    return out


def storekit_products(root):
    products = []
    for p in walk(root, exts={".storekit"}):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for prod in data.get("products", []):
            products.append({"id": prod.get("productID"), "type": prod.get("type"), "file": rel(root, p)})
        for group in data.get("subscriptionGroups", []):
            for sub in group.get("subscriptions", []):
                products.append({"id": sub.get("productID"), "type": "AutoRenewable",
                                 "group": group.get("name"), "file": rel(root, p)})
    return products


def version_tuple(v):
    try:
        return tuple(int(x) for x in str(v).split(".")[:2])
    except ValueError:
        return None


GENERATED_HINTS = {
    "expo": "run `npx expo prebuild -p ios` (or read app.json / app.config.* for the values)",
    "react-native": "the ios/ folder is missing; restore or generate it",
    "flutter": "run `flutter create --platforms=ios .` or `flutter build ios --config-only`",
    "capacitor": "run `npx cap add ios` / `npx cap sync ios`",
    "xcodegen": "run `xcodegen generate`",
    "tuist": "run `tuist generate`",
    "unity": "export the Xcode project from Unity (Build Settings > iOS)",
    "maui": "build once for ios to produce the Xcode artifacts, or read the .csproj / Info.plist",
}


def detect_generated(root):
    """Cross-platform or generated projects with no committed Xcode project."""
    found, evidence, config = [], [], {}
    candidates = [root] + [d for d in sorted(root.iterdir()) if d.is_dir() and d.name not in SKIP_DIRS]
    for base in candidates[:40]:
        pkg = {}
        try:
            pkg = json.loads((base / "package.json").read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass
        deps = set((pkg.get("dependencies") or {})) | set((pkg.get("devDependencies") or {}))
        app_cfgs = [p for p in (base / "app.json", base / "app.config.js", base / "app.config.ts") if p.is_file()]
        if "expo" in deps or any("expo" in p.read_text(encoding="utf-8", errors="ignore") for p in app_cfgs):
            found.append("expo")
            evidence += [rel(root, p) for p in app_cfgs] or [rel(root, base / "package.json")]
            try:
                ios = json.loads((base / "app.json").read_text(encoding="utf-8")).get("expo", {}).get("ios", {})
                config = {k: ios.get(k) for k in ("bundleIdentifier", "buildNumber", "infoPlist",
                                                   "supportsTablet") if ios.get(k) is not None}
            except (OSError, json.JSONDecodeError, AttributeError):
                pass
        elif "react-native" in deps:
            found.append("react-native")
            evidence.append(rel(root, base / "package.json"))
        pubspec = base / "pubspec.yaml"
        if pubspec.is_file() and "flutter" in pubspec.read_text(encoding="utf-8", errors="ignore"):
            found.append("flutter")
            evidence.append(rel(root, pubspec))
        cap = [p for p in base.glob("capacitor.config.*") if p.is_file()]
        if cap:
            found.append("capacitor")
            evidence.append(rel(root, cap[0]))
        if (base / "project.yml").is_file():
            found.append("xcodegen")
            evidence.append(rel(root, base / "project.yml"))
        if (base / "Tuist").is_dir() or (base / "Project.swift").is_file():
            found.append("tuist")
            evidence.append(rel(root, base / ("Project.swift" if (base / "Project.swift").is_file() else "Tuist")))
        if (base / "ProjectSettings" / "ProjectVersion.txt").is_file():
            found.append("unity")
            evidence.append(rel(root, base / "ProjectSettings" / "ProjectVersion.txt"))
        for csproj in base.glob("*.csproj"):
            if re.search(r"net\d+\.\d+-ios", csproj.read_text(encoding="utf-8", errors="ignore")):
                found.append("maui")
                evidence.append(rel(root, csproj))
    kinds = list(dict.fromkeys(found))
    return kinds, list(dict.fromkeys(evidence)), config


def load_targets(root):
    projects = []
    for proj in walk(root, names={"project.pbxproj"}):
        if is_test_path(root, proj):
            continue
        loaded = pbxproj.load_project(proj)
        if loaded:
            projects.append(loaded)
    return projects


def plist_companion_kind(data):
    if any(k in data for k in ("WKApplication", "WKWatchKitApp", "WKCompanionAppBundleIdentifier")):
        return "watch_app"
    if "NSAppClip" in data:
        return "app_clip"
    point = (data.get("NSExtension") or {}).get("NSExtensionPointIdentifier", "")
    if point == "com.apple.message-payload-provider":
        return "imessage"
    return None


COMPANION_NOTES = {
    "watch_app": "Bundled Apple Watch app: App Store Connect needs Apple Watch screenshots (same size across "
                 "all localizations). Not covered by this skill.",
    "app_clip": "App Clip: needs App Clip experience metadata and its own header image. Not covered by this skill.",
    "imessage": "iMessage app/extension: needs iMessage screenshots. Not covered by this skill.",
}


def app_icon(root, icon_name):
    """Check the 1024x1024 App Store icon of the main app."""
    name = icon_name or "AppIcon"
    result = {"name": name, "format": None, "path": None, "issues": []}
    composer = [p for p in walk_dirs(root, f"{name}.icon")]
    sets = [p for p in walk_dirs(root, f"{name}.appiconset")]
    if composer:
        result.update(format="icon_composer", path=rel(root, composer[0]))
        return result
    if not sets:
        result["issues"].append("not_found")
        return result
    iconset = sets[0]
    result.update(format="appiconset", path=rel(root, iconset))
    try:
        contents = json.loads((iconset / "Contents.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        result["issues"].append("contents_unreadable")
        return result
    big = [i for i in contents.get("images", [])
           if i.get("size") == "1024x1024" and i.get("filename")
           and i.get("idiom") in ("ios-marketing", "universal")
           and not i.get("appearances")]                       # light/default variant only
    if not big:
        result["issues"].append("no_1024")
        return result
    png = iconset / big[0]["filename"]
    result["file"] = rel(root, png)
    info = read_png(png.read_bytes()) if png.is_file() else None
    if info is None:
        result["issues"].append("not_png")
    else:
        w, h, alpha = info
        if (w, h) != (1024, 1024):
            result["issues"].append(f"size_{w}x{h}")
        if alpha:
            result["issues"].append("alpha")
    return result


def walk_dirs(root, dirname):
    stack = [root]
    while stack:
        d = stack.pop()
        try:
            entries = sorted(d.iterdir())
        except OSError:
            continue
        for p in entries:
            if not p.is_dir() or p.is_symlink() or p.name in SKIP_DIRS:
                continue
            if p.name == dirname:
                yield p
            else:
                stack.append(p)


def harvest(root, regions, target_name=None):
    projects = load_targets(root)
    all_targets = [(pr, t) for pr in projects for t in pr["targets"]]
    apps = [(pr, t) for pr, t in all_targets if pbxproj.is_ios_app(t)]
    main = None
    if target_name:
        named = [(pr, t) for pr, t in all_targets if t["name"] == target_name]
        if not named:
            return {"status": "target_not_found", "root": str(root), "requested": target_name,
                    "candidates": [t["name"] for _, t in apps]}
        main = named[0]
    elif len(apps) > 1:
        return {"status": "needs_target_selection", "root": str(root),
                "candidates": [{"target": t["name"], "project": rel(root, Path(pr["project"])),
                                "bundle_id": t["settings"].get("PRODUCT_BUNDLE_IDENTIFIER")} for pr, t in apps],
                "message": "Several iOS app targets. Ask which one is being submitted, then re-run with "
                           "--target <name>."}
    elif apps:
        main = apps[0]

    plists = find_info_plists(root)
    has_project = bool(list(walk(root, names={"project.pbxproj"})))
    if not plists and not has_project:
        kinds, evidence, config = detect_generated(root)
        if kinds:
            return {"status": "generated_project", "root": str(root), "kinds": kinds, "evidence": evidence,
                    "config": config,
                    "message": "No committed Xcode project. Generate it first ("
                               + "; ".join(GENERATED_HINTS[k] for k in kinds)
                               + "), or draft from the config files and mark every value 'verify'."}
        return {"status": "not_an_ios_project", "root": str(root),
                "message": "No Info.plist or Xcode project found (looked under ios/ too). "
                           "Ask for the path to the iOS app."}

    legacy = pbxproj_settings(root)          # regex fallback when no target could be parsed
    if not main:
        xc_vars = {}
        for xc in walk(root, exts={".xcconfig"}):
            xc_vars.update(pbxproj.parse_xcconfig(xc))
        merged = {k: (v[0] if isinstance(v, list) and len(v) == 1 else v) for k, v in legacy.items()
                  if k != "INFOPLIST_KEYS"}
        merged.update({k: v for k, v in xc_vars.items() if k not in merged})
        legacy = {k: ([pbxproj.expand(x, merged) for x in v] if isinstance(v, list) else v)
                  for k, v in legacy.items()}
    if main:
        tsettings = main[1]["settings"]
        main_plist = main[1]["info_plist"]
        info = (load_plist(main_plist) or {}) if main_plist else {}
        info = {k: pbxproj.expand(v, tsettings) if isinstance(v, str) else v for k, v in info.items()}
        infoplist_keys = {k[len("INFOPLIST_KEY_"):]: v for k, v in tsettings.items()
                          if k.startswith("INFOPLIST_KEY_")}
        ordered = ([main_plist] if main_plist else []) + [p for p in plists if p != main_plist]
    else:
        tsettings = {}
        info = (load_plist(plists[0]) or {}) if plists else {}
        info = {k: pbxproj.expand(v, merged) if isinstance(v, str) else v for k, v in info.items()}
        infoplist_keys = legacy.get("INFOPLIST_KEYS", {})
        ordered = plists
    flags = []

    def pick(key):
        v = info.get(key)
        return v if v is not None else infoplist_keys.get(key)

    usage = {k: v for k, v in info.items() if k.startswith("NS") and k.endswith("UsageDescription")}
    usage.update({k: v for k, v in infoplist_keys.items() if k.startswith("NS") and k.endswith("UsageDescription")})
    purpose_keys_main = set(usage) | {k for k in list(info) + list(infoplist_keys) if k == "NFCReaderUsageDescription"}

    # Keys declared by other targets (extensions) -- used to tell "missing" from "declared elsewhere".
    other_keys = set()
    for pr, t in all_targets:
        if main and t is main[1]:
            continue
        data = load_plist(t["info_plist"]) if t["info_plist"] else {}
        other_keys |= set((data or {}).keys())
        other_keys |= {k[len("INFOPLIST_KEY_"):] for k in t["settings"] if k.startswith("INFOPLIST_KEY_")}

    deps = parse_dependencies(root)
    sdks = manifest_sdks(deps)
    signals, rr_used, os_crypto, bundled_src, n_files, purpose_hits = scan_sources(root)
    app_manifests, sdk_manifests = privacy_manifests(root)

    # --- export compliance ---
    key = pick("ITSAppUsesNonExemptEncryption")
    bundled = sorted({n for n in deps if BUNDLED_CRYPTO_RE.match(n.split("/")[-1])} |
                     {s for s in sdks if s in ("OpenSSL", "BoringSSL", "openssl_grpc")})
    if bundled or bundled_src:
        suggestion = ("Bundled non-OS cryptography found. Developer decides on CCATS / exemption "
                      "(flag as 'decide').")
        if "FR" in regions:
            suggestion += " Distributing in France: a French encryption declaration is required."
            flags.append({"id": "france_encryption_declaration",
                          "detail": f"Bundled crypto ({', '.join(bundled) or 'source imports'}) with France "
                                    f"distribution."})
    else:
        suggestion = ("OS-provided encryption only (or none): no documentation; "
                      "set ITSAppUsesNonExemptEncryption = NO.")
    if key is None or key == "":
        status = "unknown_key_missing"
        flags.append({"id": "export_key_missing",
                      "detail": "ITSAppUsesNonExemptEncryption not set; App Store Connect will ask the "
                                "encryption questions for every build. Do not assume 'exempt'."})
    else:
        status = f"declared_{str(key).lower()}"

    # --- privacy manifests / required-reason APIs ---
    declared = set()
    for m in app_manifests:
        declared |= set(k for k in m["accessed_api_types"] if k)
    used = {k: v for k, v in rr_used.items() if v}
    if not app_manifests:
        flags.append({"id": "app_manifest_missing",
                      "detail": "No PrivacyInfo.xcprivacy for the app itself. Required-reason APIs used: "
                                f"{', '.join(sorted(used)) or 'none detected'}."})
    else:
        missing = sorted(set(used) - declared)
        if missing:
            flags.append({"id": "required_reason_api_undeclared", "detail": ", ".join(missing)})
    if sdks:
        flags.append({"id": "sdks_require_manifest",
                      "detail": "Listed SDKs present; confirm each resolved version ships a privacy manifest "
                                "(and a signature if used as a binary): " + ", ".join(sorted(sdks))})
    if signals["att"] and app_manifests and not any(m["tracking"] for m in app_manifests):
        flags.append({"id": "tracking_manifest_mismatch",
                      "detail": "App requests ATT authorization but no app privacy manifest sets "
                                "NSPrivacyTracking = true. Make the manifest, the ATT prompt and the "
                                "'Used to Track You' label agree."})

    # --- purpose strings ---
    needed = {label: hits for label, hits in purpose_hits.items() if hits}
    for dep in deps:
        for label in PURPOSE_DEPS.get(dep, []):
            needed.setdefault(label, []).append(f"dependency {dep} ({deps[dep]})")
    rules = {label: keys for label, keys, _ in PURPOSE_RULES}
    for label, hits in sorted(needed.items()):
        keys = rules[label]
        if any(k in purpose_keys_main for k in keys):
            continue
        if any(k in other_keys for k in keys):
            flags.append({"id": "purpose_string_only_in_extension",
                          "detail": f"{label}: {' or '.join(keys)} is declared by another target, not the app. "
                                    f"Fine if only that target uses it; otherwise add it to the app. "
                                    f"Evidence: {', '.join(hits[:3])}"})
            continue
        flags.append({"id": "purpose_string_missing",
                      "detail": f"{label}: code uses it but {' or '.join(keys)} is not in the app's Info.plist "
                                f"or INFOPLIST_KEY_ settings. The upload fails (ITMS-90683) or the app "
                                f"crashes on the permission request. Evidence: {', '.join(hits[:3])}"})

    # --- deployment target (every iOS target, extensions included) ---
    if all_targets:
        targets = sorted({t["settings"].get("IPHONEOS_DEPLOYMENT_TARGET") for _, t in all_targets
                          if t["product_type"] not in pbxproj.TEST_TYPES
                          and t["settings"].get("IPHONEOS_DEPLOYMENT_TARGET")})
    else:
        targets = legacy.get("IPHONEOS_DEPLOYMENT_TARGET", [])
    vt = [version_tuple(t) for t in targets if version_tuple(t)]
    if vt:
        lowest = min(vt)
        if lowest < (13, 0):
            flags.append({"id": "deployment_target_below_13",
                          "detail": f"Lowest IPHONEOS_DEPLOYMENT_TARGET {targets}; uploads must target iOS 13+ "
                                    f"(since 2026-09-09)."})
        elif lowest < (15, 0):
            flags.append({"id": "deployment_target_below_15_april_2027",
                          "detail": "From April 2027 uploads must target iOS 15+ with the iOS 27 SDK."})

    # --- extensions and bundled companions ---
    extensions, companions = [], {}
    for pr, t in all_targets:
        if (main and t is main[1]) or t["product_type"] in pbxproj.TEST_TYPES:
            continue
        kind = pbxproj.companion_kind(t)
        extensions.append({"target": t["name"], "product_type": t["product_type"],
                           "bundle_id": t["settings"].get("PRODUCT_BUNDLE_IDENTIFIER"),
                           "info_plist": rel(root, t["info_plist"]) if t["info_plist"] else None})
        if kind:
            companions.setdefault(kind, t["name"])
    for p in plists:
        kind = plist_companion_kind(load_plist(p) or {})
        if kind:
            companions.setdefault(kind, rel(root, p))
    for kind, where in companions.items():
        flags.append({"id": f"bundled_{kind}", "detail": f"{COMPANION_NOTES[kind]} Found: {where}."})

    # --- app icon ---
    icon = None
    if has_project or plists:
        icon = app_icon(root, tsettings.get("ASSETCATALOG_COMPILER_APPICON_NAME"))
        if "alpha" in icon["issues"]:
            flags.append({"id": "app_icon_has_alpha",
                          "detail": f"{icon.get('file')}: the 1024x1024 App Store icon must not have an alpha "
                                    f"channel or transparency."})
        if "no_1024" in icon["issues"] or any(i.startswith("size_") for i in icon["issues"]):
            flags.append({"id": "app_icon_1024_missing",
                          "detail": f"{icon['path']}: no valid 1024x1024 App Store icon ({', '.join(icon['issues'])})."})
        if "not_found" in icon["issues"]:
            flags.append({"id": "app_icon_not_found",
                          "detail": f"No {icon['name']}.appiconset or {icon['name']}.icon found. Verify the "
                                    f"icon source (it may be generated at build time)."})

    # --- signals-driven flags ---
    if signals["ads"] and not signals["att"]:
        flags.append({"id": "ads_without_att", "detail": "Ad SDK usage but no ATTrackingManager request found."})
    if signals["sign_in"] and not signals["account_deletion"]:
        flags.append({"id": "verify_account_deletion",
                      "detail": "Sign-in found but no account-deletion code hint; verify 5.1.1(v)."})
    if signals["third_party_login"] and not signals["sign_in_with_apple"]:
        flags.append({"id": "verify_login_services_4_8",
                      "detail": "Third-party login without Sign in with Apple; verify an equivalent option "
                                "exists (4.8)."})
    if "US" in regions and not signals["age_assurance"]:
        flags.append({"id": "age_assurance_gap",
                      "detail": "US distribution but no Declared Age Range API / PermissionKit usage found "
                                "(Texas, Utah, Louisiana laws). Code change belongs to apple-appstore-reviewer."})

    age_hints = []
    for sig, (item, minimum, regional) in AGE_HINTS.items():
        if signals.get(sig):
            age_hints.append({"item": item, "minimum": minimum,
                              "regional": {r: v for r, v in regional.items() if r in regions},
                              "evidence": signals[sig]})

    def legacy_or(key):
        v = legacy.get(key)
        return v[0] if isinstance(v, list) and len(v) == 1 else v

    result_app_bundle = (pick("CFBundleIdentifier") if pick("CFBundleIdentifier") and "$" not in str(
        pick("CFBundleIdentifier")) else (tsettings.get("PRODUCT_BUNDLE_IDENTIFIER")
                                          or legacy_or("PRODUCT_BUNDLE_IDENTIFIER")
                                          or pick("CFBundleIdentifier")))
    if result_app_bundle and "$" in str(result_app_bundle):
        flags.append({"id": "bundle_id_unresolved",
                      "detail": f"Bundle ID '{result_app_bundle}' still contains a build variable; ask the "
                                f"developer for the real value (it may come from CI or a git-ignored xcconfig)."})

    return {
        "status": "ok",
        "root": str(root),
        "regions": sorted(regions),
        "app": {
            "target": main[1]["name"] if main else None,
            "project": rel(root, Path(main[0]["project"])) if main else None,
            "configuration": main[1]["configuration"] if main else None,
            "xcconfigs": [rel(root, Path(x)) for x in main[1]["xcconfigs"]] if main else [],
            "info_plists": [rel(root, p) for p in ordered],
            "bundle_id": result_app_bundle,
            "version": (pick("CFBundleShortVersionString") if pick("CFBundleShortVersionString") and "$" not in str(
                pick("CFBundleShortVersionString")) else None) or tsettings.get("MARKETING_VERSION")
                or legacy_or("MARKETING_VERSION"),
            "build": tsettings.get("CURRENT_PROJECT_VERSION") or info.get("CFBundleVersion"),
            "deployment_targets": targets,
            "device_family": tsettings.get("TARGETED_DEVICE_FAMILY") or legacy.get("TARGETED_DEVICE_FAMILY"),
            "required_device_capabilities": info.get("UIRequiredDeviceCapabilities"),
            "url_schemes": [s for t in info.get("CFBundleURLTypes", []) for s in t.get("CFBundleURLSchemes", [])],
            "source_files_scanned": n_files,
        },
        "extensions": extensions,
        "app_icon": icon,
        "export_compliance": {
            "plist_key": key, "status": status, "bundled_crypto": bundled,
            "bundled_crypto_source": bundled_src, "os_crypto_evidence": os_crypto,
            "suggested_answer": suggestion,
        },
        "privacy_manifests": {"app": app_manifests, "sdk": sdk_manifests,
                              "required_reason_apis_used": used, "manifest_sdks_present": sdks},
        "dependencies": deps,
        "usage_descriptions": usage,
        "purpose_string_usage": needed,
        "capabilities": {"entitlements": entitlements(root), "storekit_products": storekit_products(root)},
        "signals": {k: v for k, v in signals.items() if v},
        "age_rating_hints": age_hints,
        "flags": flags,
    }


def main():
    parser = argparse.ArgumentParser(description="Harvest App Store submission evidence from an iOS repo.")
    parser.add_argument("repo")
    parser.add_argument("--regions", default="", help="comma-separated region codes, e.g. EU,US,FR")
    parser.add_argument("--target", default=None, help="the app target to submit (when there are several)")
    args = parser.parse_args()
    root = Path(args.repo).resolve()
    if not root.is_dir():
        print(f"Not a directory: {root}", file=sys.stderr)
        return 2
    regions = {r.strip().upper() for r in args.regions.split(",") if r.strip()}
    print(json.dumps(harvest(root, regions, args.target), indent=2, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
