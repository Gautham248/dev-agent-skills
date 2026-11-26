#!/usr/bin/env python3
"""
check_screenshots.py -- validate App Store screenshots: format, dimensions per
size class, alpha channel, and the 1-10 per class count. Stdlib only (no PIL).

Usage:
    python3 check_screenshots.py <screenshots-dir> [--ipad] [--json]

Folder convention: put each class's screenshots in a folder named after the
class key below (e.g. iphone-6.3/, ipad-13/), optionally nested under a locale
folder. Without a class folder, the class is inferred from the dimensions;
a size valid for several classes is reported as ambiguous, not rejected.

Size table mirrors references/screenshots-and-previews.md (snapshot 2026-11-26).
Exit code: 0 = no errors, 1 = errors, 2 = bad input.
"""

import argparse
import json
import struct
import sys
from collections import defaultdict
from pathlib import Path

# key -> (label, portrait sizes, explicit landscape sizes or None = swap portrait)
SIZE_CLASSES = {
    "iphone-duo-outer": ("iPhone Duo (outer)", [(1398, 2034)], None),
    "iphone-duo-inner": ("iPhone Duo (inner)", [(2007, 2853)], None),
    "iphone-6.9": ("iPhone Dynamic Island (large)", [(1260, 2736), (1290, 2796), (1320, 2868)], None),
    "iphone-6.5": ("iPhone Face ID (large)", [(1284, 2778), (1242, 2688)], None),
    "iphone-6.3": ("iPhone Dynamic Island (medium)", [(1179, 2556), (1206, 2622)], None),
    "iphone-6.1": ("iPhone Face ID (medium)", [(1170, 2532), (1125, 2436), (1080, 2340)], None),
    "iphone-5.5": ("iPhone Home Button (large)", [(1242, 2208)], None),
    "iphone-4.7": ("iPhone Home Button (medium)", [(750, 1334)], None),
    "iphone-4": ("iPhone Home Button (4\")", [(640, 1096), (640, 1136)], [(1136, 600), (1136, 640)]),
    "iphone-3.5": ("iPhone Home Button (3.5\")", [(640, 920), (640, 960)], [(960, 600), (960, 640)]),
    "ipad-13": ("iPad 13\"", [(2064, 2752), (2048, 2732)], None),
    "ipad-12.9": ("iPad 12.9\" (2nd gen)", [(2048, 2732)], None),
    "ipad-11": ("iPad 11\"", [(1488, 2266), (1512, 2316), (1668, 2420), (1668, 2388), (1640, 2360)], None),
    "ipad-10.5": ("iPad 10.5\"", [(1668, 2224)], None),
    "ipad-9.7": ("iPad 9.7\"", [(1536, 2008), (1536, 2048), (768, 1004), (768, 1024)],
                 [(2048, 1496), (2048, 1536), (1024, 748), (1024, 768)]),
}
REQUIRED_IPHONE = "iphone-6.3"
RECOMMENDED_IPHONE = "iphone-6.9"
REQUIRED_IPAD = "ipad-13"

OUT_OF_SCOPE = {
    "Mac": [(1280, 800), (1440, 900), (2560, 1600), (2880, 1800)],
    "Apple TV": [(1920, 1080), (3840, 2160)],
    "Apple Vision Pro": [(3840, 2160)],
    "Apple Watch": [(422, 514), (410, 502), (416, 496), (396, 484), (368, 448), (312, 390)],
}
IMAGE_EXTS = {".png", ".jpg", ".jpeg"}
MAX_PER_CLASS = 10


def accepted_sizes(key):
    _, portrait, landscape = SIZE_CLASSES[key]
    land = landscape if landscape is not None else [(h, w) for (w, h) in portrait]
    return set(portrait) | set(land)


def read_png(data):
    """Return (width, height, has_alpha) or None."""
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    width, height = struct.unpack(">II", data[16:24])
    color_type = data[25]
    has_alpha = color_type in (4, 6)
    pos = 8
    while pos + 8 <= len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        ctype = data[pos + 4:pos + 8]
        if ctype == b"tRNS":
            has_alpha = True
        if ctype == b"IEND":
            break
        pos += 12 + length
    return width, height, has_alpha


def read_jpeg(data):
    """Return (width, height, False) or None."""
    if data[:2] != b"\xff\xd8":
        return None
    pos = 2
    while pos + 4 <= len(data):
        if data[pos] != 0xFF:
            pos += 1
            continue
        marker = data[pos + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            pos += 2
            continue
        length = struct.unpack(">H", data[pos + 2:pos + 4])[0]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            height, width = struct.unpack(">HH", data[pos + 5:pos + 9])
            return width, height, False
        pos += 2 + length
    return None


def image_info(path):
    data = path.read_bytes()
    return read_png(data) or read_jpeg(data)


def class_from_path(path, root):
    for part in path.relative_to(root).parts[:-1]:
        if part in SIZE_CLASSES:
            return part
    return None


def check(root, ipad=False):
    items, per_class = [], defaultdict(list)

    def add(level, file, msg):
        items.append({"level": level, "file": str(file), "message": msg})

    files = [p for p in sorted(root.rglob("*")) if p.is_file() and not p.name.startswith(".")]
    if not files:
        add("error", root, "No files found.")
    for path in files:
        rel = path.relative_to(root)
        if path.suffix.lower() not in IMAGE_EXTS:
            add("error", rel, f"Unsupported file type '{path.suffix}'. Use .png, .jpg or .jpeg.")
            continue
        info = image_info(path)
        if info is None:
            add("error", rel, "Not a readable PNG/JPEG (extension does not match content?).")
            continue
        w, h, alpha = info
        if alpha:
            add("error", rel, "Has an alpha channel/transparency; App Store Connect rejects it. Flatten it.")
        declared = class_from_path(path, root)
        if declared:
            if (w, h) in accepted_sizes(declared):
                per_class[declared].append(rel)
            else:
                add("error", rel, f"{w}x{h} is not a valid size for {SIZE_CLASSES[declared][0]} "
                                  f"(folder '{declared}').")
            continue
        matches = [k for k in SIZE_CLASSES if (w, h) in accepted_sizes(k)]
        if len(matches) == 1:
            per_class[matches[0]].append(rel)
        elif len(matches) > 1:
            add("warning", rel, f"{w}x{h} is ambiguous ({', '.join(matches)}). Put it in a class folder.")
        else:
            other = [p for p, sizes in OUT_OF_SCOPE.items()
                     if (w, h) in set(sizes) | {(b, a) for (a, b) in sizes}]
            if other:
                add("warning", rel, f"{w}x{h} matches {'/'.join(other)}: detected, not covered by this skill.")
            else:
                add("error", rel, f"{w}x{h} matches no App Store screenshot size.")

    for key, members in per_class.items():
        if len(members) > MAX_PER_CLASS:
            add("error", key, f"{len(members)} screenshots; maximum is {MAX_PER_CLASS} per size class "
                              f"(per locale).")
    if files and not per_class.get(REQUIRED_IPHONE):
        add("error", REQUIRED_IPHONE, "No screenshots for iPhone Dynamic Island (medium), the required "
                                      "iPhone class.")
    if files and not per_class.get(RECOMMENDED_IPHONE):
        add("warning", RECOMMENDED_IPHONE, "No Dynamic Island (large) screenshots. Apple's page conflicts on "
                                           "whether Face ID (large) is then required; supplying both medium "
                                           "and large avoids the question.")
    if ipad and not per_class.get(REQUIRED_IPAD):
        add("error", REQUIRED_IPAD, "App runs on iPad but there are no 13\" iPad screenshots.")
    summary = {k: len(v) for k, v in sorted(per_class.items())}
    return items, summary


def main():
    parser = argparse.ArgumentParser(description="Validate App Store screenshots.")
    parser.add_argument("directory")
    parser.add_argument("--ipad", action="store_true", help="the app runs on iPad (13\" class required)")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    root = Path(args.directory)
    if not root.is_dir():
        print(f"Not a directory: {root}", file=sys.stderr)
        return 2
    items, summary = check(root, ipad=args.ipad)
    errors = [i for i in items if i["level"] == "error"]
    if args.json:
        print(json.dumps({"ok": not errors, "classes": summary, "items": items}, indent=2))
    else:
        for i in items:
            print(f"{i['level'].upper():7} {i['file']}: {i['message']}")
        print("\nPer class: " + (", ".join(f"{k}={v}" for k, v in summary.items()) or "none"))
        print(f"{'OK' if not errors else 'FAIL'}: {len(errors)} error(s), {len(items) - len(errors)} warning(s).")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
