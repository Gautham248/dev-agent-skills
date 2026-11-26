#!/usr/bin/env python3
"""
harvest_evidence.py -- pull App Store submission evidence out of an iOS / iPadOS
repo (native, Flutter, React Native, Capacitor) and print it as JSON.

Usage:
    python3 harvest_evidence.py <repo-root> [--regions EU,US,JP,BR,AU,KR,CN,VN,FR,UK,EEA]

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
    "NSPrivacyAccessedAPICategoryFileTimestamp": r"\.creationDate\b|\.modificationDate\b|creationDateKey|"
                                                 r"contentModificationDateKey|\bfstat\(|\bstat\(|getattrlist",
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
        parts = set(p.relative_to(root).parts)
        if parts & {"Tests", "UITests"} or any(x.endswith(("Tests", "UITests")) for x in parts):
            continue
        out.append(p)
    # main app first: ios/Runner, ios/App, then shortest path
    out.sort(key=lambda p: (0 if re.search(r"ios/(Runner|App)/Info\.plist$", str(p)) else 1, len(p.parts)))
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
    files = list(walk(root, exts=SOURCE_EXTS))
    signals = {k: [] for k in SIGNALS}
    rr_used = {k: [] for k in REQUIRED_REASON_SRC}
    os_crypto, bundled_src = [], []
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
            if len(os_crypto) < MAX_HITS and OS_CRYPTO_RE.search(line):
                os_crypto.append(loc)
            if len(bundled_src) < MAX_HITS and BUNDLED_CRYPTO_SRC_RE.search(line):
                bundled_src.append(loc)
    return signals, rr_used, os_crypto, bundled_src, len(files)


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


def harvest(root, regions):
    plists = find_info_plists(root)
    settings = pbxproj_settings(root)
    has_project = bool(list(walk(root, names={"project.pbxproj"})))
    if not plists and not has_project:
        return {"status": "not_an_ios_project", "root": str(root),
                "message": "No Info.plist or Xcode project found (looked under ios/ too). "
                           "Ask for the path to the iOS app."}

    info = load_plist(plists[0]) if plists else {}
    info = info or {}
    infoplist_keys = settings.get("INFOPLIST_KEYS", {})
    flags = []

    def pick(key):
        v = info.get(key)
        return v if v is not None else infoplist_keys.get(key)

    usage = {k: v for k, v in info.items() if k.startswith("NS") and k.endswith("UsageDescription")}
    usage.update({k: v for k, v in infoplist_keys.items() if k.startswith("NS") and k.endswith("UsageDescription")})

    deps = parse_dependencies(root)
    sdks = manifest_sdks(deps)
    signals, rr_used, os_crypto, bundled_src, n_files = scan_sources(root)
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

    # --- deployment target ---
    targets = settings.get("IPHONEOS_DEPLOYMENT_TARGET", [])
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

    return {
        "status": "ok",
        "root": str(root),
        "regions": sorted(regions),
        "app": {
            "info_plists": [rel(root, p) for p in plists],
            "bundle_id": pick("CFBundleIdentifier") or settings.get("PRODUCT_BUNDLE_IDENTIFIER"),
            "version": pick("CFBundleShortVersionString") or settings.get("MARKETING_VERSION"),
            "deployment_targets": targets,
            "device_family": settings.get("TARGETED_DEVICE_FAMILY"),
            "required_device_capabilities": info.get("UIRequiredDeviceCapabilities"),
            "url_schemes": [s for t in info.get("CFBundleURLTypes", []) for s in t.get("CFBundleURLSchemes", [])],
            "source_files_scanned": n_files,
        },
        "export_compliance": {
            "plist_key": key, "status": status, "bundled_crypto": bundled,
            "bundled_crypto_source": bundled_src, "os_crypto_evidence": os_crypto,
            "suggested_answer": suggestion,
        },
        "privacy_manifests": {"app": app_manifests, "sdk": sdk_manifests,
                              "required_reason_apis_used": used, "manifest_sdks_present": sdks},
        "dependencies": deps,
        "usage_descriptions": usage,
        "capabilities": {"entitlements": entitlements(root), "storekit_products": storekit_products(root)},
        "signals": {k: v for k, v in signals.items() if v},
        "age_rating_hints": age_hints,
        "flags": flags,
    }


def main():
    parser = argparse.ArgumentParser(description="Harvest App Store submission evidence from an iOS repo.")
    parser.add_argument("repo")
    parser.add_argument("--regions", default="", help="comma-separated region codes, e.g. EU,US,FR")
    args = parser.parse_args()
    root = Path(args.repo).resolve()
    if not root.is_dir():
        print(f"Not a directory: {root}", file=sys.stderr)
        return 2
    regions = {r.strip().upper() for r in args.regions.split(",") if r.strip()}
    print(json.dumps(harvest(root, regions), indent=2, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
