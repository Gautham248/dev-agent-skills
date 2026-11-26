#!/usr/bin/env python3
"""
validate_metadata.py -- lint drafted App Store Connect metadata against Apple's
limits and the metadata guidelines (2.3.7, 2.3.8, 2.3.10, 3.1.x).

Usage:
    python3 validate_metadata.py <draft.json> [--json]

Input shape: see ../assets/metadata-draft.example.json.
Exit code: 0 = no errors (warnings allowed), 1 = errors, 2 = bad input.

Limits mirror references/asc-field-reference.md (snapshot 2026-11-26). Where a
limit's unit is still open (characters vs bytes), the stricter reading is
enforced and the message says so.
"""

import argparse
import json
import re
import sys
from pathlib import Path

# field -> (min_chars, max_chars, max_bytes). None = not enforced.
LOCALE_LIMITS = {
    "name": (2, 30, None),
    "subtitle": (None, 30, None),
    "promotional_text": (None, 170, None),
    "description": (None, 4000, None),
    "keywords": (None, 100, 100),     # unit open; Apple help (summary) says bytes
    "whats_new": (None, 4000, None),
}
REVIEW_NOTES_LIMIT = 4000            # app-level notes: unit open, enforce chars AND bytes
IAP_LIMITS = {
    "reference_name": (1, 64),
    "display_name": (2, 30),
    "description": (None, 45),
    "review_notes": (None, 4000),    # IAP review notes are characters (verified)
}
PRODUCT_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,100}$")
PHONE_RE = re.compile(r"^\+\d[\d\s\-().]{5,}$")
URL_RE = re.compile(r"^https?://\S+$", re.IGNORECASE)

PRICING_RE = re.compile(
    r"\b(free|sale|discount(?:ed)?|cheap|bargain|deal)\b|\d+\s?%\s?off\b|[$€£¥₹]\s?\d",
    re.IGNORECASE,
)
OTHER_PLATFORM_RE = re.compile(
    r"\b(android|google play|play store|windows phone|huawei appgallery|galaxy store|amazon appstore)\b",
    re.IGNORECASE,
)
KIDS_RE = re.compile(r"\bfor (kids|children)\b", re.IGNORECASE)


class Report:
    def __init__(self):
        self.items = []

    def error(self, where, msg, rule=None):
        self.items.append({"level": "error", "where": where, "message": msg, "rule": rule})

    def warn(self, where, msg, rule=None):
        self.items.append({"level": "warning", "where": where, "message": msg, "rule": rule})

    @property
    def errors(self):
        return [i for i in self.items if i["level"] == "error"]


def nbytes(text):
    return len(text.encode("utf-8"))


def words(text):
    return {w for w in re.findall(r"[^\W_]+", text.lower()) if len(w) > 1}


def check_length(report, where, value, min_c, max_c, max_b):
    n = len(value)
    if min_c is not None and n < min_c:
        report.error(where, f"{n} characters; minimum is {min_c}.")
    if max_c is not None and n > max_c:
        report.error(where, f"{n} characters; maximum is {max_c}.")
    if max_b is not None and nbytes(value) > max_b:
        report.error(where, f"{nbytes(value)} UTF-8 bytes; maximum is {max_b} bytes "
                            f"(Apple counts this field in bytes; non-ASCII uses 2-4 bytes per character).")


def check_keywords(report, where, keywords, name, subtitle):
    if not keywords:
        return
    parts = keywords.split(",")
    if any(p != p.strip() for p in parts):
        report.warn(where, "Spaces around commas waste bytes; use 'a,b,c'.")
    terms = [p.strip().lower() for p in parts]
    if any(not t for t in terms):
        report.warn(where, "Empty keyword entry (doubled or trailing comma).")
    seen = set()
    for t in terms:
        if t and t in seen:
            report.warn(where, f"Duplicate keyword '{t}' wastes bytes.")
        seen.add(t)
    if "app" in terms or "apps" in terms:
        report.warn(where, "'app' as a keyword adds nothing; Apple advises against it.")
    taken = words(name or "") | words(subtitle or "")
    repeated = sorted({w for t in terms for w in words(t)} & taken)
    if repeated:
        report.warn(where, f"Repeats words already indexed from name/subtitle: {', '.join(repeated)}.")


def validate_locale(report, locale, data, kids_category):
    base = f"locales.{locale}"
    for field, (mn, mx, mb) in LOCALE_LIMITS.items():
        value = data.get(field)
        if value is None:
            continue
        if not isinstance(value, str):
            report.error(f"{base}.{field}", "must be a string.")
            continue
        check_length(report, f"{base}.{field}", value, mn, mx, mb)

    name, subtitle = data.get("name", ""), data.get("subtitle", "")
    if not name:
        report.error(f"{base}.name", "App name is required.")
    for field in ("name", "subtitle", "keywords"):
        value = data.get(field) or ""
        m = PRICING_RE.search(value)
        if m:
            report.error(f"{base}.{field}", f"Pricing term '{m.group(0)}' is not allowed here, even if "
                                            f"the app is free.", "2.3.7")
    for field in ("name", "subtitle", "keywords", "description", "promotional_text", "whats_new"):
        value = data.get(field) or ""
        m = OTHER_PLATFORM_RE.search(value)
        if m:
            report.error(f"{base}.{field}", f"Mentions another platform/store ('{m.group(0)}').", "2.3.10")
        if not kids_category:
            m = KIDS_RE.search(value)
            if m:
                report.error(f"{base}.{field}", f"'{m.group(0)}' is reserved for the Kids Category.", "2.3.8")
    check_keywords(report, f"{base}.keywords", data.get("keywords") or "", name, subtitle)

    support = data.get("support_url")
    if not support:
        report.error(f"{base}.support_url", "Support URL is required.", "1.5")
    elif not URL_RE.match(support):
        report.error(f"{base}.support_url", "Must be a full URL including http:// or https://.")
    marketing = data.get("marketing_url")
    if marketing and not URL_RE.match(marketing):
        report.error(f"{base}.marketing_url", "Must be a full URL including http:// or https://.")


def validate_review(report, review):
    notes = review.get("notes")
    if notes:
        if len(notes) > REVIEW_NOTES_LIMIT:
            report.error("app_review.notes", f"{len(notes)} characters; maximum is {REVIEW_NOTES_LIMIT}.")
        elif nbytes(notes) > REVIEW_NOTES_LIMIT:
            report.error("app_review.notes", f"{nbytes(notes)} UTF-8 bytes; Apple Help (summary) states "
                                             f"{REVIEW_NOTES_LIMIT} bytes. Unit still open: enforcing the "
                                             f"stricter reading.")
    phone = review.get("contact_phone")
    if phone is not None and not PHONE_RE.match(phone):
        report.error("app_review.contact_phone", "Use international format starting with '+' and the "
                                                 "country code, e.g. +1 4155550100.")
    email = review.get("contact_email")
    if email is not None and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        report.error("app_review.contact_email", "Not a valid email address.")
    if review.get("sign_in_required") and not (review.get("demo_username") and review.get("demo_password")):
        report.error("app_review", "Sign-in is required but demo credentials are missing.", "2.1(a)")


def validate_iap(report, index, iap):
    where = f"iap[{index}]"
    pid = iap.get("product_id")
    if not pid:
        report.error(f"{where}.product_id", "Product ID is required.")
    elif not PRODUCT_ID_RE.match(pid):
        report.error(f"{where}.product_id", "Up to 100 characters: letters, digits, '.', '-', '_' only. "
                                            "Note: a Product ID can never be edited or reused.")
    for field, (mn, mx) in IAP_LIMITS.items():
        value = iap.get(field)
        if value is None:
            continue
        check_length(report, f"{where}.{field}", value, mn, mx, None)


def validate(draft):
    report = Report()
    if not isinstance(draft, dict):
        report.error("$", "Top level must be a JSON object.")
        return report
    kids = bool(draft.get("kids_category", False))
    locales = draft.get("locales") or {}
    if not locales:
        report.error("locales", "At least one locale (e.g. 'en-US') is required.")
    for locale, data in locales.items():
        validate_locale(report, locale, data or {}, kids)
    validate_review(report, draft.get("app_review") or {})
    for i, iap in enumerate(draft.get("iap") or []):
        validate_iap(report, i, iap)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    parser.add_argument("draft")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    args = parser.parse_args()
    try:
        draft = json.loads(Path(args.draft).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Cannot read draft: {exc}", file=sys.stderr)
        return 2
    report = validate(draft)
    if args.json:
        print(json.dumps({"ok": not report.errors, "items": report.items}, indent=2, ensure_ascii=False))
    else:
        for item in report.items:
            rule = f" [{item['rule']}]" if item["rule"] else ""
            print(f"{item['level'].upper():7} {item['where']}: {item['message']}{rule}")
        n_err, n_warn = len(report.errors), len(report.items) - len(report.errors)
        print(f"\n{'OK' if not n_err else 'FAIL'}: {n_err} error(s), {n_warn} warning(s).")
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
