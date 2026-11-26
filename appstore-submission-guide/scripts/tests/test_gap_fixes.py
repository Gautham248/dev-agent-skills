#!/usr/bin/env python3
"""Regression tests for the gap fixes: target-aware harvesting, xcconfig resolution,
generated projects, companions, purpose strings, app icon, validator and screenshot
additions. Stdlib only.

Run:  python3 -m unittest discover -s appstore-submission-guide/scripts/tests -v
"""

import json
import plistlib
import struct
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import check_screenshots as cs  # noqa: E402
import harvest_evidence as he  # noqa: E402
import pbxproj  # noqa: E402
import validate_metadata as vm  # noqa: E402
from test_scripts import draft, jpeg_bytes, locale, png_bytes  # noqa: E402

APP = "com.apple.product-type.application"
EXT = "com.apple.product-type.app-extension"


# ---------------------------------------------------------------- fixtures

def _plist_value(v):
    if isinstance(v, dict):
        return "{" + " ".join(f"{_plist_value(k)} = {_plist_value(x)};" for k, x in v.items()) + "}"
    if isinstance(v, list):
        return "(" + ", ".join(_plist_value(x) for x in v) + ")"
    return '"' + str(v).replace("\\", "\\\\").replace('"', '\\"') + '"'


def pbxproj_text(targets, project_settings=None, project_xcconfig=None):
    """targets: [{'name', 'type', 'settings', 'xcconfig'(optional path relative to project dir)}]"""
    objects, n = {}, [0]

    def oid():
        n[0] += 1
        return f"{n[0]:024X}"

    group_children = []

    def xc_ref(path):
        if not path:
            return None
        rid = oid()
        objects[rid] = {"isa": "PBXFileReference", "path": path, "sourceTree": "<group>"}
        group_children.append(rid)
        return rid

    def config_list(settings, xcconfig):
        cid, lid = oid(), oid()
        cfg = {"isa": "XCBuildConfiguration", "name": "Release", "buildSettings": settings or {}}
        ref = xc_ref(xcconfig)
        if ref:
            cfg["baseConfigurationReference"] = ref
        objects[cid] = cfg
        objects[lid] = {"isa": "XCConfigurationList", "buildConfigurations": [cid],
                        "defaultConfigurationName": "Release"}
        return lid

    tids = []
    for t in targets:
        tid = oid()
        objects[tid] = {"isa": "PBXNativeTarget", "name": t["name"], "productType": t["type"],
                        "buildConfigurationList": config_list(t.get("settings"), t.get("xcconfig"))}
        tids.append(tid)
    gid, rid = oid(), oid()
    objects[gid] = {"isa": "PBXGroup", "children": group_children, "sourceTree": "<group>"}
    objects[rid] = {"isa": "PBXProject", "mainGroup": gid, "targets": tids, "projectDirPath": "",
                    "buildConfigurationList": config_list(project_settings, project_xcconfig)}
    body = {"archiveVersion": "1", "objectVersion": "77", "objects": objects, "rootObject": rid}
    return "// !$*UTF8*$!\n" + _plist_value(body) + "\n"


class Repo(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, relpath, text):
        p = self.root / relpath
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
        return p

    def write_bytes(self, relpath, data):
        p = self.root / relpath
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        return p

    def plist(self, relpath, **keys):
        self.write_bytes(relpath, plistlib.dumps(keys))

    def project(self, targets, **kw):
        self.write("App.xcodeproj/project.pbxproj", pbxproj_text(targets, **kw))

    def harvest(self, regions=(), target=None):
        return he.harvest(self.root, set(regions), target)

    def flag_ids(self, result):
        return {f["id"] for f in result["flags"]}


# ---------------------------------------------------------------- pbxproj parser

class ParserTests(unittest.TestCase):
    def test_old_style_plist(self):
        text = '// !$*UTF8*$!\n{ a = 1; /* c */ b = ( x, "y z", ); c = { "k" = "v\\"q"; }; }'
        self.assertEqual(pbxproj.parse_old_plist(text), {"a": "1", "b": ["x", "y z"], "c": {"k": 'v"q'}})

    def test_expand_nested_and_modifier(self):
        s = {"A": "$(B).x", "B": "${C}", "C": "My App"}
        self.assertEqual(pbxproj.expand("$(A)", s), "My App.x")
        self.assertEqual(pbxproj.expand("$(C:rfc1034identifier)", s), "My-App")
        self.assertEqual(pbxproj.expand("$(MISSING).y", s), "$(MISSING).y")

    def test_xcconfig_include_and_conditionals(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / "base.xcconfig").write_text("PREFIX = com.base\nTEAM = T1\n")
            (d / "rel.xcconfig").write_text('#include "base.xcconfig"\nPREFIX = com.real // note\n'
                                            "SDK_ONLY[sdk=macosx*] = mac\nSDK_ONLY[sdk=iphoneos*] = ios\n")
            got = pbxproj.parse_xcconfig(d / "rel.xcconfig")
        self.assertEqual(got["PREFIX"], "com.real")
        self.assertEqual(got["TEAM"], "T1")
        self.assertEqual(got["SDK_ONLY"], "ios")


# ---------------------------------------------------------------- harvester: targets

class TargetTests(Repo):
    def test_main_plist_deeper_than_extension_plist(self):
        self.plist("MyApp/Supporting/Info.plist", CFBundleIdentifier="com.x.app",
                   ITSAppUsesNonExemptEncryption=True, NSLocationWhenInUseUsageDescription="x")
        self.plist("MyWidget/Info.plist", CFBundleIdentifier="com.x.app.widget", NSExtension={})
        self.project([
            {"name": "MyApp", "type": APP, "settings": {"INFOPLIST_FILE": "MyApp/Supporting/Info.plist",
                                                         "SDKROOT": "iphoneos"}},
            {"name": "MyWidget", "type": EXT, "settings": {"INFOPLIST_FILE": "MyWidget/Info.plist"}},
        ])
        r = self.harvest()
        self.assertEqual(r["app"]["target"], "MyApp")
        self.assertEqual(r["app"]["info_plists"][0], "MyApp/Supporting/Info.plist")
        self.assertEqual(r["export_compliance"]["status"], "declared_true")
        self.assertIn("NSLocationWhenInUseUsageDescription", r["usage_descriptions"])

    def test_fallback_without_project_prefers_app_plist_over_extension(self):
        self.plist("MyApp/Supporting/Info.plist", CFBundleIdentifier="com.x.app", ITSAppUsesNonExemptEncryption=True)
        self.plist("MyWidget/Info.plist", CFBundleIdentifier="com.x.app.widget", NSExtension={})
        r = self.harvest()
        self.assertEqual(r["app"]["info_plists"][0], "MyApp/Supporting/Info.plist")
        self.assertEqual(r["export_compliance"]["status"], "declared_true")

    def test_generated_infoplist_keys_come_from_the_app_target_only(self):
        self.project([
            {"name": "App", "type": APP, "settings": {
                "GENERATE_INFOPLIST_FILE": "YES", "INFOPLIST_KEY_ITSAppUsesNonExemptEncryption": "NO",
                "PRODUCT_BUNDLE_IDENTIFIER": "com.x.app", "MARKETING_VERSION": "2.0",
                "CURRENT_PROJECT_VERSION": "41"}},
            {"name": "Share", "type": EXT, "settings": {
                "INFOPLIST_KEY_ITSAppUsesNonExemptEncryption": "YES",
                "INFOPLIST_KEY_NSCameraUsageDescription": "ext"}},
        ])
        r = self.harvest()
        self.assertEqual(r["export_compliance"]["status"], "declared_no")
        self.assertNotIn("NSCameraUsageDescription", r["usage_descriptions"])
        self.assertEqual((r["app"]["bundle_id"], r["app"]["version"], r["app"]["build"]), ("com.x.app", "2.0", "41"))
        self.assertEqual([e["target"] for e in r["extensions"]], ["Share"])

    def test_bundle_id_resolved_through_xcconfig(self):
        self.write("Config/Base.xcconfig", "BUNDLE_ID_PREFIX = com.base\n")
        self.write("Config/Release.xcconfig", '#include "Base.xcconfig"\nBUNDLE_ID_PREFIX = com.real\n')
        self.project([{"name": "App", "type": APP, "xcconfig": "Config/Release.xcconfig",
                       "settings": {"PRODUCT_BUNDLE_IDENTIFIER": "$(BUNDLE_ID_PREFIX).app"}}])
        r = self.harvest()
        self.assertEqual(r["app"]["bundle_id"], "com.real.app")
        self.assertEqual(r["app"]["xcconfigs"], ["Config/Release.xcconfig"])
        self.assertNotIn("bundle_id_unresolved", self.flag_ids(r))

    def test_plist_variables_expanded_with_target_settings(self):
        self.plist("App/Info.plist", CFBundleIdentifier="$(PRODUCT_BUNDLE_IDENTIFIER)",
                   CFBundleShortVersionString="$(MARKETING_VERSION)")
        self.project([{"name": "App", "type": APP, "settings": {
            "INFOPLIST_FILE": "App/Info.plist", "PRODUCT_BUNDLE_IDENTIFIER": "com.x.app", "MARKETING_VERSION": "3.1"}}])
        r = self.harvest()
        self.assertEqual((r["app"]["bundle_id"], r["app"]["version"]), ("com.x.app", "3.1"))

    def test_unresolved_bundle_id_is_flagged(self):
        self.project([{"name": "App", "type": APP,
                       "settings": {"PRODUCT_BUNDLE_IDENTIFIER": "$(BUNDLE_ID_PREFIX).app"}}])
        self.assertIn("bundle_id_unresolved", self.flag_ids(self.harvest()))

    def test_two_app_targets_need_selection(self):
        self.project([
            {"name": "Consumer", "type": APP, "settings": {"PRODUCT_BUNDLE_IDENTIFIER": "com.x.consumer"}},
            {"name": "Business", "type": APP, "settings": {"PRODUCT_BUNDLE_IDENTIFIER": "com.x.business"}},
            {"name": "MacApp", "type": APP, "settings": {"SDKROOT": "macosx"}},
        ])
        r = self.harvest()
        self.assertEqual(r["status"], "needs_target_selection")
        self.assertEqual({c["target"] for c in r["candidates"]}, {"Consumer", "Business"})
        picked = self.harvest(target="Business")
        self.assertEqual((picked["status"], picked["app"]["bundle_id"]), ("ok", "com.x.business"))
        self.assertEqual(self.harvest(target="Nope")["status"], "target_not_found")

    def test_extension_deployment_target_counts(self):
        self.project([
            {"name": "App", "type": APP, "settings": {"IPHONEOS_DEPLOYMENT_TARGET": "16.0"}},
            {"name": "Widget", "type": EXT, "settings": {"IPHONEOS_DEPLOYMENT_TARGET": "12.0"}},
        ])
        self.assertIn("deployment_target_below_13", self.flag_ids(self.harvest()))


# ---------------------------------------------------------------- harvester: companions, generated

class CompanionAndGeneratedTests(Repo):
    def test_watch_app_and_app_clip_targets_flagged(self):
        self.project([
            {"name": "App", "type": APP, "settings": {"SDKROOT": "iphoneos"}},
            {"name": "Watch", "type": APP, "settings": {"SDKROOT": "watchos"}},
            {"name": "Clip", "type": "com.apple.product-type.application.on-demand-install-capable"},
        ])
        r = self.harvest()
        self.assertEqual(r["status"], "ok")
        self.assertEqual(r["app"]["target"], "App")
        self.assertTrue({"bundled_watch_app", "bundled_app_clip"} <= self.flag_ids(r))

    def test_imessage_extension_detected_from_plist(self):
        self.plist("App/Info.plist", CFBundleIdentifier="com.x")
        self.plist("Msg/Info.plist", CFBundleIdentifier="com.x.msg",
                   NSExtension={"NSExtensionPointIdentifier": "com.apple.message-payload-provider"})
        self.assertIn("bundled_imessage", self.flag_ids(self.harvest()))

    def test_expo_without_ios_folder(self):
        self.write("package.json", json.dumps({"dependencies": {"expo": "^52.0.0", "react-native": "0.76.0"}}))
        self.write("app.json", json.dumps({"expo": {"ios": {"bundleIdentifier": "com.a", "buildNumber": "7"}}}))
        r = self.harvest()
        self.assertEqual(r["status"], "generated_project")
        self.assertIn("expo", r["kinds"])
        self.assertEqual(r["config"]["bundleIdentifier"], "com.a")
        self.assertIn("prebuild", r["message"])

    def test_flutter_without_ios_folder(self):
        self.write("pubspec.yaml", "name: a\ndependencies:\n  flutter:\n    sdk: flutter\n")
        r = self.harvest()
        self.assertEqual((r["status"], r["kinds"]), ("generated_project", ["flutter"]))

    def test_xcodegen_project(self):
        self.write("project.yml", "name: App\n")
        self.assertEqual(self.harvest()["kinds"], ["xcodegen"])

    def test_plain_repo_is_still_not_ios(self):
        self.write("README.md", "hi")
        self.assertEqual(self.harvest()["status"], "not_an_ios_project")


# ---------------------------------------------------------------- harvester: source scanning

class SourceScanTests(Repo):
    def setUp(self):
        super().setUp()
        self.plist("App/Info.plist", CFBundleIdentifier="com.x")

    def rr(self):
        return self.harvest()["privacy_manifests"]["required_reason_apis_used"]

    def test_swiftdata_creation_date_is_not_a_file_timestamp(self):
        self.write("App/List.swift", "@Query(sort: \\Draft.creationDate, order: .reverse) var drafts: [Draft]\n"
                                     "let d = item.modificationDate\n")
        self.assertNotIn("NSPrivacyAccessedAPICategoryFileTimestamp", self.rr())

    def test_file_attribute_creation_date_is_a_file_timestamp(self):
        self.write("App/Files.swift", "let a = try FileManager.default.attributesOfItem(atPath: p)\n"
                                      "let d = a[.creationDate] as? Date\n")
        self.assertIn("NSPrivacyAccessedAPICategoryFileTimestamp", self.rr())

    def test_resource_key_is_a_file_timestamp(self):
        self.write("App/Files.swift", "let v = try url.resourceValues(forKeys: [.contentModificationDateKey])\n")
        self.assertIn("NSPrivacyAccessedAPICategoryFileTimestamp", self.rr())

    def test_test_code_is_not_evidence(self):
        self.write("AppTests/LocTests.swift", "let m = CLLocationManager()\n")
        self.write("Packages/Feed/Tests/FeedTests/FollowTests.swift", "let followers = 1\n")
        self.write("web/__tests__/x.test.ts", "UserDefaults\n")
        r = self.harvest()
        self.assertNotIn("location", r["signals"])
        self.assertNotIn("social", r["signals"])
        self.assertNotIn("purpose_string_missing", self.flag_ids(r))


# ---------------------------------------------------------------- harvester: purpose strings, tracking

class PurposeStringTests(Repo):
    def test_missing_location_key_is_flagged(self):
        self.plist("App/Info.plist", CFBundleIdentifier="com.x")
        self.write("App/Loc.swift", "let m = CLLocationManager()\nm.requestWhenInUseAuthorization()\n")
        flags = [f for f in self.harvest()["flags"] if f["id"] == "purpose_string_missing"]
        self.assertTrue(flags)
        self.assertIn("NSLocationWhenInUseUsageDescription", flags[0]["detail"])
        self.assertIn("App/Loc.swift:1", flags[0]["detail"])

    def test_declared_key_is_not_flagged(self):
        self.plist("App/Info.plist", CFBundleIdentifier="com.x", NSCameraUsageDescription="Scan receipts")
        self.write("App/Cam.swift", "let s = AVCaptureSession()\n")
        self.assertNotIn("purpose_string_missing", self.flag_ids(self.harvest()))

    def test_generated_infoplist_key_counts(self):
        self.project([{"name": "App", "type": APP, "settings": {
            "INFOPLIST_KEY_NSCameraUsageDescription": "Scan receipts"}}])
        self.write("App/Cam.swift", "let s = AVCaptureSession()\n")
        self.assertNotIn("purpose_string_missing", self.flag_ids(self.harvest()))

    def test_key_only_in_extension(self):
        self.project([
            {"name": "App", "type": APP},
            {"name": "Share", "type": EXT, "settings": {"INFOPLIST_KEY_NSPhotoLibraryUsageDescription": "x"}},
        ])
        self.write("Share/Pick.swift", "PHPhotoLibrary.requestAuthorization { _ in }\n")
        ids = self.flag_ids(self.harvest())
        self.assertIn("purpose_string_only_in_extension", ids)
        self.assertNotIn("purpose_string_missing", ids)

    def test_flutter_plugin_needs_key(self):
        self.plist("ios/Runner/Info.plist", CFBundleIdentifier="com.x")
        self.write("pubspec.lock", "packages:\n  geolocator:\n    dependency: \"direct main\"\n")
        flags = [f for f in self.harvest()["flags"] if f["id"] == "purpose_string_missing"]
        self.assertTrue(flags and "dependency geolocator" in flags[0]["detail"])

    def test_att_without_tracking_in_manifest(self):
        self.plist("App/Info.plist", CFBundleIdentifier="com.x", NSUserTrackingUsageDescription="ads")
        self.write_bytes("App/PrivacyInfo.xcprivacy", plistlib.dumps({"NSPrivacyTracking": False}))
        self.write("App/Ads.swift", "ATTrackingManager.requestTrackingAuthorization { _ in }\n")
        ids = self.flag_ids(self.harvest())
        self.assertIn("tracking_manifest_mismatch", ids)
        self.assertNotIn("purpose_string_missing", ids)


# ---------------------------------------------------------------- harvester: app icon

class AppIconTests(Repo):
    def iconset(self, alpha=False, size=1024):
        base = "App/Assets.xcassets/AppIcon.appiconset/"
        self.write(base + "Contents.json", json.dumps({"images": [
            {"filename": "icon.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"}]}))
        self.write_bytes(base + "icon.png", png_bytes(size, size, alpha=alpha))
        self.plist("App/Info.plist", CFBundleIdentifier="com.x")

    def test_clean_icon(self):
        self.iconset()
        r = self.harvest()
        self.assertEqual((r["app_icon"]["format"], r["app_icon"]["issues"]), ("appiconset", []))

    def test_icon_with_alpha(self):
        self.iconset(alpha=True)
        self.assertIn("app_icon_has_alpha", self.flag_ids(self.harvest()))

    def test_icon_wrong_size(self):
        self.iconset(size=512)
        self.assertIn("app_icon_1024_missing", self.flag_ids(self.harvest()))

    def test_icon_composer_format(self):
        self.write("AppIcon.icon/icon.json", "{}")
        self.plist("App/Info.plist", CFBundleIdentifier="com.x")
        r = self.harvest()
        self.assertEqual(r["app_icon"]["format"], "icon_composer")
        self.assertNotIn("app_icon_not_found", self.flag_ids(r))

    def test_icon_name_from_build_setting(self):
        self.write("App/Assets.xcassets/ProIcon.appiconset/Contents.json", json.dumps({"images": []}))
        self.project([{"name": "App", "type": APP, "settings": {"ASSETCATALOG_COMPILER_APPICON_NAME": "ProIcon"}}])
        r = self.harvest()
        self.assertEqual(r["app_icon"]["name"], "ProIcon")
        self.assertIn("app_icon_1024_missing", self.flag_ids(r))

    def test_no_icon(self):
        self.plist("App/Info.plist", CFBundleIdentifier="com.x")
        self.assertIn("app_icon_not_found", self.flag_ids(self.harvest()))


# ---------------------------------------------------------------- validator additions

def items(report, where, level=None):
    return [i for i in report.items if i["where"].startswith(where) and (level is None or i["level"] == level)]


class ValidatorGapTests(unittest.TestCase):
    def test_ideographic_comma_duplicates_and_warning(self):
        r = vm.validate(draft(locale(name="写真編集", keywords="写真、写真、フィルター")))
        msgs = " ".join(i["message"] for i in items(r, "locales.en-US.keywords"))
        self.assertIn("Duplicate keyword '写真'", msgs)
        self.assertIn("ASCII commas", msgs)

    def test_non_english_pricing_terms(self):
        for word in ("Kostenlos bearbeiten", "Éditeur gratuit", "無料の写真", "免费编辑", "무료 편집"):
            r = vm.validate(draft(locale(subtitle=word)))
            self.assertTrue(items(r, "locales.en-US.subtitle", "error"), word)

    def test_words_containing_pricing_terms_pass(self):
        for word in ("Freelance invoices", "Promotional planner", "Saleswoman CRM"):
            r = vm.validate(draft(locale(subtitle=word)))
            self.assertFalse(items(r, "locales.en-US.subtitle", "error"), word)

    def test_update_requires_whats_new(self):
        r = vm.validate(draft(locale(), is_update=True, version="1.1", live_version="1.0"))
        self.assertTrue(items(r, "locales.en-US.whats_new", "error"))

    def test_whats_new_on_first_version_warns(self):
        r = vm.validate(draft(locale(whats_new="Hello"), is_update=False))
        self.assertTrue(items(r, "locales.en-US.whats_new", "warning"))

    def test_version_must_exceed_live(self):
        base = locale(whats_new="Fixes")
        self.assertTrue(items(vm.validate(draft(base, is_update=True, version="1.0", live_version="1.2")),
                              "version", "error"))
        self.assertTrue(items(vm.validate(draft(base, is_update=True, version="1.2", live_version="1.2.0")),
                              "version", "error"))
        self.assertFalse(items(vm.validate(draft(base, is_update=True, version="1.10", live_version="1.9")),
                               "version", "error"))

    def test_invalid_version_format(self):
        self.assertTrue(items(vm.validate(draft(locale(), version="1.0b")), "version", "error"))

    def test_copyright(self):
        self.assertTrue(items(vm.validate(draft(locale(), copyright="https://example.com")), "copyright", "error"))
        self.assertTrue(items(vm.validate(draft(locale(), copyright="Example Inc.")), "copyright", "warning"))
        self.assertFalse(items(vm.validate(draft(locale(), copyright="2026 Example, Inc.")), "copyright"))


# ---------------------------------------------------------------- screenshot additions

def jpeg_with(w, h, components=3, orientation=None):
    comp = b"".join(bytes([i + 1, 0x11, 0]) for i in range(components))
    sof = b"\xff\xc0" + struct.pack(">HBHHB", 8 + 3 * components, 8, h, w, components) + comp
    app1 = b""
    if orientation:
        tiff = b"MM\x00\x2a" + struct.pack(">I", 8) + struct.pack(">H", 1) + \
               struct.pack(">HHIH", 0x0112, 3, 1, orientation) + b"\x00\x00" + b"\x00\x00\x00\x00"
        payload = b"Exif\x00\x00" + tiff
        app1 = b"\xff\xe1" + struct.pack(">H", len(payload) + 2) + payload
    return b"\xff\xd8" + app1 + sof + b"\xff\xd9"


class ScreenshotGapTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_cmyk_jpeg_warns(self):
        (self.root / "a.jpg").write_bytes(jpeg_with(1206, 2622, components=4))
        found, _ = cs.check(self.root)
        self.assertTrue(any("CMYK" in i["message"] for i in found))

    def test_exif_orientation_swaps_dimensions(self):
        (self.root / "a.jpg").write_bytes(jpeg_with(2622, 1206, orientation=6))
        found, summary = cs.check(self.root)
        self.assertEqual(summary.get("iphone-6.3"), 1)
        self.assertTrue(any("EXIF orientation 6" in i["message"] for i in found))

    def test_plain_jpeg_unchanged(self):
        self.assertEqual(cs.read_jpeg(jpeg_bytes(1206, 2622)), (1206, 2622, False))


if __name__ == "__main__":
    unittest.main()
