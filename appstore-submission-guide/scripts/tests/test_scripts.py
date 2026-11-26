#!/usr/bin/env python3
"""Tests for the appstore-submission-guide scripts. Stdlib only.

Run:  python3 -m unittest discover -s appstore-submission-guide/scripts/tests -v
"""

import json
import plistlib
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRIPTS))

import check_screenshots as cs  # noqa: E402
import harvest_evidence as he  # noqa: E402
import validate_metadata as vm  # noqa: E402


# ---------------------------------------------------------------- helpers

def png_bytes(w, h, alpha=False):
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    color_type = 6 if alpha else 2
    ihdr = struct.pack(">IIBBBBB", w, h, 8, color_type, 0, 0, 0)
    # IDAT content is irrelevant to the header reader; keep files tiny.
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(b"\x00")) + chunk(b"IEND", b"")


def jpeg_bytes(w, h):
    sof = b"\xff\xc0" + struct.pack(">HBHHB", 11, 8, h, w, 1) + b"\x01\x11\x00"
    return b"\xff\xd8" + b"\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00" + b"\x00" * 9 + sof + b"\xff\xd9"


def locale(**over):
    base = {"name": "Trailhead", "subtitle": "Plan offline hikes", "keywords": "trail,map,gps",
            "description": "Plan hikes.", "support_url": "https://example.com/support"}
    base.update(over)
    return base


def draft(loc=None, **top):
    d = {"locales": {"en-US": loc or locale()}}
    d.update(top)
    return d


def msgs(report, where_prefix):
    return [i for i in report.items if i["where"].startswith(where_prefix)]


def errors_at(report, where_prefix):
    return [i for i in msgs(report, where_prefix) if i["level"] == "error"]


# ---------------------------------------------------------------- validate_metadata

class NameTests(unittest.TestCase):
    def check(self, name):
        return errors_at(vm.validate(draft(locale(name=name))), "locales.en-US.name")

    def test_30_chars_passes(self):
        self.assertEqual(self.check("A" * 30), [])

    def test_31_chars_fails(self):
        self.assertTrue(self.check("A" * 31))

    def test_1_char_fails(self):
        self.assertTrue(self.check("A"))

    def test_empty_fails(self):
        self.assertTrue(self.check(""))

    def test_30_cjk_chars_pass_character_limit(self):
        self.assertEqual(self.check("山" * 30), [])


class KeywordTests(unittest.TestCase):
    def check(self, kw, **loc):
        return vm.validate(draft(locale(keywords=kw, **loc)))

    def test_exactly_100_ascii_bytes_passes(self):
        kw = (",".join(f"word{i:02d}" for i in range(10)) + "," + "x" * 100)[:100]  # padded to 100 bytes
        self.assertEqual(len(kw.encode()), 100)
        self.assertEqual(errors_at(self.check(kw), "locales.en-US.keywords"), [])

    def test_101_bytes_fails(self):
        kw = "a" * 101
        self.assertTrue(errors_at(self.check(kw), "locales.en-US.keywords"))

    def test_34_japanese_chars_fail_on_bytes(self):
        kw = "山" * 34  # 102 UTF-8 bytes, 34 characters
        errs = errors_at(self.check(kw), "locales.en-US.keywords")
        self.assertTrue(any("bytes" in e["message"] for e in errs))

    def test_name_word_repeated_is_flagged(self):
        r = self.check("trailhead,map", name="Trailhead")
        self.assertTrue(any("Repeats words" in i["message"] for i in msgs(r, "locales.en-US.keywords")))

    def test_free_any_casing_is_flagged(self):
        for kw in ("FREE,map", "Free,map", "map,free"):
            errs = errors_at(self.check(kw), "locales.en-US.keywords")
            self.assertTrue(any(e["rule"] == "2.3.7" for e in errs), kw)

    def test_duplicate_keyword_is_flagged(self):
        r = self.check("photo editor,photo editor")
        self.assertTrue(any("Duplicate keyword" in i["message"] for i in msgs(r, "locales.en-US.keywords")))


class SubtitleAndDescriptionTests(unittest.TestCase):
    def test_free_photo_editor_flagged(self):
        r = vm.validate(draft(locale(subtitle="Free Photo Editor")))
        self.assertTrue(any(e["rule"] == "2.3.7" for e in errors_at(r, "locales.en-US.subtitle")))

    def test_freelance_not_flagged(self):
        r = vm.validate(draft(locale(subtitle="Freelance invoices")))
        self.assertEqual(errors_at(r, "locales.en-US.subtitle"), [])

    def test_android_in_description_flagged(self):
        r = vm.validate(draft(locale(description="Also on Android")))
        self.assertTrue(any(e["rule"] == "2.3.10" for e in errors_at(r, "locales.en-US.description")))

    def test_description_4000_passes_4001_fails(self):
        ok = vm.validate(draft(locale(description="a" * 4000)))
        bad = vm.validate(draft(locale(description="a" * 4001)))
        self.assertEqual(errors_at(ok, "locales.en-US.description"), [])
        self.assertTrue(errors_at(bad, "locales.en-US.description"))

    def test_for_kids_outside_kids_category(self):
        r = vm.validate(draft(locale(subtitle="Puzzles for Kids")))
        self.assertTrue(any(e["rule"] == "2.3.8" for e in errors_at(r, "locales.en-US.subtitle")))
        r2 = vm.validate(draft(locale(subtitle="Puzzles for Kids"), kids_category=True))
        self.assertEqual([e for e in errors_at(r2, "locales.en-US.subtitle") if e["rule"] == "2.3.8"], [])


class ReviewAndFormatTests(unittest.TestCase):
    def test_review_notes_4000_ascii_passes_4001_fails(self):
        ok = vm.validate(draft(app_review={"notes": "a" * 4000}))
        bad = vm.validate(draft(app_review={"notes": "a" * 4001}))
        self.assertEqual(errors_at(ok, "app_review.notes"), [])
        self.assertTrue(errors_at(bad, "app_review.notes"))

    def test_review_notes_4000_japanese_fail_byte_reading(self):
        r = vm.validate(draft(app_review={"notes": "山" * 4000}))
        self.assertTrue(any("bytes" in e["message"] for e in errors_at(r, "app_review.notes")))

    def test_phone_format(self):
        ok = vm.validate(draft(app_review={"contact_phone": "+1 4155550100"}))
        bad = vm.validate(draft(app_review={"contact_phone": "4155550100"}))
        self.assertEqual(errors_at(ok, "app_review.contact_phone"), [])
        self.assertTrue(errors_at(bad, "app_review.contact_phone"))

    def test_support_url_without_protocol_fails(self):
        r = vm.validate(draft(locale(support_url="example.com/support")))
        self.assertTrue(errors_at(r, "locales.en-US.support_url"))

    def test_sign_in_required_without_credentials(self):
        r = vm.validate(draft(app_review={"sign_in_required": True}))
        self.assertTrue(any(e["rule"] == "2.1(a)" for e in errors_at(r, "app_review")))


class IapTests(unittest.TestCase):
    def check(self, **iap):
        base = {"product_id": "com.example.pro", "reference_name": "Pro", "display_name": "Pro",
                "description": "All features"}
        base.update(iap)
        return vm.validate(draft(iap=[base]))

    def test_product_id_with_space_fails(self):
        self.assertTrue(errors_at(self.check(product_id="com.app pro"), "iap[0].product_id"))

    def test_product_id_100_passes_101_fails(self):
        self.assertEqual(errors_at(self.check(product_id="a" * 100), "iap[0].product_id"), [])
        self.assertTrue(errors_at(self.check(product_id="a" * 101), "iap[0].product_id"))

    def test_display_name_bounds(self):
        self.assertEqual(errors_at(self.check(display_name="a" * 30), "iap[0].display_name"), [])
        self.assertTrue(errors_at(self.check(display_name="a" * 31), "iap[0].display_name"))
        self.assertTrue(errors_at(self.check(display_name="a"), "iap[0].display_name"))

    def test_description_45_passes_46_fails(self):
        self.assertEqual(errors_at(self.check(description="a" * 45), "iap[0].description"), [])
        self.assertTrue(errors_at(self.check(description="a" * 46), "iap[0].description"))

    def test_reference_name_64_passes_65_fails(self):
        self.assertEqual(errors_at(self.check(reference_name="a" * 64), "iap[0].reference_name"), [])
        self.assertTrue(errors_at(self.check(reference_name="a" * 65), "iap[0].reference_name"))

    def test_iap_review_notes_counted_in_characters(self):
        self.assertEqual(errors_at(self.check(review_notes="山" * 4000), "iap[0].review_notes"), [])


class ExampleDraftTests(unittest.TestCase):
    def test_bundled_example_is_clean(self):
        example = SCRIPTS.parent / "assets" / "metadata-draft.example.json"
        report = vm.validate(json.loads(example.read_text(encoding="utf-8")))
        self.assertEqual(report.errors, [])


# ---------------------------------------------------------------- check_screenshots

class ScreenshotTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def put(self, relpath, data):
        p = self.root / relpath
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        return relpath

    def file_items(self, items, relpath, level=None):
        return [i for i in items if i["file"] == relpath and (level is None or i["level"] == level)]

    def test_1320x2868_png_passes(self):
        f = self.put("a.png", png_bytes(1320, 2868))
        items, summary = cs.check(self.root)
        self.assertEqual(self.file_items(items, f), [])
        self.assertEqual(summary.get("iphone-6.9"), 1)

    def test_1320x2867_fails(self):
        f = self.put("a.png", png_bytes(1320, 2867))
        items, _ = cs.check(self.root)
        self.assertTrue(self.file_items(items, f, "error"))

    def test_png_with_alpha_fails(self):
        f = self.put("a.png", png_bytes(1320, 2868, alpha=True))
        items, _ = cs.check(self.root)
        self.assertTrue(any("alpha" in i["message"] for i in self.file_items(items, f, "error")))

    def test_landscape_swap_passes(self):
        f = self.put("a.png", png_bytes(2868, 1320))
        items, _ = cs.check(self.root)
        self.assertEqual(self.file_items(items, f), [])

    def test_jpeg_dimensions_read(self):
        f = self.put("a.jpg", jpeg_bytes(1206, 2622))
        items, summary = cs.check(self.root)
        self.assertEqual(self.file_items(items, f), [])
        self.assertEqual(summary.get("iphone-6.3"), 1)

    def test_eleven_in_one_class_fails(self):
        for n in range(11):
            self.put(f"iphone-6.3/{n}.png", png_bytes(1206, 2622))
        items, _ = cs.check(self.root)
        self.assertTrue(any(i["file"] == "iphone-6.3" and i["level"] == "error" for i in items))

    def test_heic_fails(self):
        f = self.put("a.heic", b"\x00" * 16)
        items, _ = cs.check(self.root)
        self.assertTrue(self.file_items(items, f, "error"))

    def test_4_inch_landscape_exceptions(self):
        a = self.put("a.png", png_bytes(1136, 600))
        b = self.put("b.png", png_bytes(1136, 640))
        items, summary = cs.check(self.root)
        self.assertEqual(self.file_items(items, a) + self.file_items(items, b), [])
        self.assertEqual(summary.get("iphone-4"), 2)

    def test_ipad_2048x2732_in_folder_resolves(self):
        f = self.put("ipad-13/a.png", png_bytes(2048, 2732))
        items, summary = cs.check(self.root, ipad=True)
        self.assertEqual(self.file_items(items, f), [])
        self.assertEqual(summary.get("ipad-13"), 1)

    def test_ipad_2048x2732_without_folder_is_ambiguous_not_rejected(self):
        f = self.put("a.png", png_bytes(2048, 2732))
        items, _ = cs.check(self.root)
        found = self.file_items(items, f)
        self.assertTrue(found)
        self.assertTrue(all(i["level"] == "warning" and "ambiguous" in i["message"] for i in found))

    def test_mac_size_detected_not_covered(self):
        f = self.put("a.png", png_bytes(1280, 800))
        items, _ = cs.check(self.root)
        found = self.file_items(items, f)
        self.assertTrue(found and found[0]["level"] == "warning" and "Mac" in found[0]["message"])

    def test_iphone_duo_inner_recognised(self):
        self.put("a.png", png_bytes(2007, 2853))
        _, summary = cs.check(self.root)
        self.assertEqual(summary.get("iphone-duo-inner"), 1)

    def test_missing_required_iphone_class_is_error(self):
        self.put("a.png", png_bytes(1320, 2868))
        items, _ = cs.check(self.root)
        self.assertTrue(any(i["file"] == "iphone-6.3" and i["level"] == "error" for i in items))


# ---------------------------------------------------------------- harvest_evidence

class HarvestTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, relpath, text):
        p = self.root / relpath
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")

    def plist(self, relpath="App/Info.plist", **keys):
        data = {"CFBundleIdentifier": "com.example.app", "CFBundleShortVersionString": "1.0"}
        data.update(keys)
        p = self.root / relpath
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(plistlib.dumps(data))

    def flag_ids(self, result):
        return {f["id"] for f in result["flags"]}

    def test_not_an_ios_project(self):
        self.write("README.md", "hello")
        self.assertEqual(he.harvest(self.root, set())["status"], "not_an_ios_project")

    def test_missing_export_key_is_unknown_not_exempt(self):
        self.plist()
        r = he.harvest(self.root, set())
        self.assertEqual(r["export_compliance"]["status"], "unknown_key_missing")
        self.assertIn("export_key_missing", self.flag_ids(r))

    def test_cryptokit_only_suggests_no_documentation(self):
        self.plist()
        self.write("App/Crypto.swift", "import CryptoKit\nlet k = SymmetricKey(size: .bits256)\n")
        r = he.harvest(self.root, {"FR"})
        ec = r["export_compliance"]
        self.assertIn("no documentation", ec["suggested_answer"])
        self.assertIn("ITSAppUsesNonExemptEncryption = NO", ec["suggested_answer"])
        self.assertTrue(ec["os_crypto_evidence"])
        self.assertNotIn("france_encryption_declaration", self.flag_ids(r))

    def test_openssl_with_france_flags_declaration(self):
        self.plist(ITSAppUsesNonExemptEncryption=True)
        self.write("Podfile.lock", "PODS:\n  - OpenSSL-Universal (1.1.1)\n\nDEPENDENCIES:\n  - OpenSSL-Universal\n")
        r = he.harvest(self.root, {"FR"})
        self.assertIn("france_encryption_declaration", self.flag_ids(r))
        self.assertEqual(r["export_compliance"]["status"], "declared_true")

    def test_openssl_without_france_no_french_flag(self):
        self.plist()
        self.write("Podfile.lock", "PODS:\n  - OpenSSL-Universal (1.1.1)\n")
        r = he.harvest(self.root, {"US"})
        self.assertNotIn("france_encryption_declaration", self.flag_ids(r))
        self.assertIn("CCATS", r["export_compliance"]["suggested_answer"])

    def test_firebase_without_app_manifest(self):
        self.plist()
        self.write("App.xcworkspace/xcshareddata/swiftpm/Package.resolved",
                   json.dumps({"pins": [{"identity": "firebase-ios-sdk", "location": "x"}], "version": 2}))
        self.write("App/Settings.swift", "UserDefaults.standard.set(1, forKey: \"k\")\n")
        r = he.harvest(self.root, set())
        ids = self.flag_ids(r)
        self.assertIn("app_manifest_missing", ids)
        self.assertIn("sdks_require_manifest", ids)
        self.assertIn("FirebaseCore", r["privacy_manifests"]["manifest_sdks_present"])

    def test_undeclared_required_reason_api(self):
        self.plist()
        manifest = {"NSPrivacyTracking": False, "NSPrivacyAccessedAPITypes": [
            {"NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
             "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]}]}
        (self.root / "App").mkdir(exist_ok=True)
        (self.root / "App/PrivacyInfo.xcprivacy").write_bytes(plistlib.dumps(manifest))
        self.write("App/A.swift", "UserDefaults.standard\nlet t = ProcessInfo.processInfo.systemUptime\n")
        r = he.harvest(self.root, set())
        flag = [f for f in r["flags"] if f["id"] == "required_reason_api_undeclared"]
        self.assertTrue(flag)
        self.assertIn("SystemBootTime", flag[0]["detail"])
        self.assertNotIn("UserDefaults", flag[0]["detail"])

    def test_us_without_declared_age_range_flags_gap(self):
        self.plist()
        self.write("App/A.swift", "import SwiftUI\n")
        self.assertIn("age_assurance_gap", self.flag_ids(he.harvest(self.root, {"US"})))
        self.assertNotIn("age_assurance_gap", self.flag_ids(he.harvest(self.root, {"EU"})))

    def test_us_with_declared_age_range_no_gap(self):
        self.plist()
        self.write("App/A.swift", "import DeclaredAgeRange\n")
        self.assertNotIn("age_assurance_gap", self.flag_ids(he.harvest(self.root, {"US"})))

    def test_loot_box_brazil_vs_elsewhere(self):
        self.plist()
        self.write("App/Shop.swift", "func openLootBox() {}\n")
        br = [h for h in he.harvest(self.root, {"BR"})["age_rating_hints"] if h["item"] == "Loot Boxes"][0]
        us = [h for h in he.harvest(self.root, {"US"})["age_rating_hints"] if h["item"] == "Loot Boxes"][0]
        self.assertEqual(br["regional"].get("BR"), "18+")
        self.assertEqual(us["minimum"], "9+")
        self.assertEqual(us["regional"], {})

    def test_flutter_layout_detected(self):
        self.plist("ios/Runner/Info.plist")
        self.write("pubspec.lock", "packages:\n  geolocator_apple:\n    dependency: transitive\n")
        r = he.harvest(self.root, set())
        self.assertEqual(r["status"], "ok")
        self.assertEqual(r["app"]["info_plists"][0], "ios/Runner/Info.plist")
        self.assertIn("geolocator_apple", r["privacy_manifests"]["manifest_sdks_present"])

    def test_deployment_target_floor(self):
        self.write("App.xcodeproj/project.pbxproj", "IPHONEOS_DEPLOYMENT_TARGET = 12.0;\n")
        self.assertIn("deployment_target_below_13", self.flag_ids(he.harvest(self.root, set())))

    def test_ads_without_att(self):
        self.plist()
        self.write("App/Ads.swift", "GADMobileAds.sharedInstance().start()\n")
        self.assertIn("ads_without_att", self.flag_ids(he.harvest(self.root, set())))


if __name__ == "__main__":
    unittest.main()
