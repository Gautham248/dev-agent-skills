#!/usr/bin/env python3
"""
pbxproj.py -- read Xcode projects without Xcode. Stdlib only.

- parse_old_plist(text): parser for the old-style (NeXTSTEP) plist format that
  project.pbxproj uses. plistlib can't read it.
- load_project(path): every native target in an .xcodeproj with its build
  settings resolved for one configuration (Release by default), following
  baseConfigurationReference .xcconfig files and their #include lines, and
  expanding $(VAR) / ${VAR} references.

Precedence (lowest to highest), matching Xcode:
    project xcconfig < project build settings < target xcconfig < target build settings
"""

import re
from pathlib import Path

# ----------------------------------------------------------------- old-style plist

_BARE_RE = re.compile(r"[^\s;,=(){}\"<>]+")


class _Parser:
    def __init__(self, text):
        self.s = text
        self.i = 0
        self.n = len(text)

    def _ws(self):
        s, n = self.s, self.n
        while self.i < n:
            c = s[self.i]
            if c.isspace():
                self.i += 1
            elif s.startswith("/*", self.i):
                j = s.find("*/", self.i + 2)
                self.i = n if j < 0 else j + 2
            elif s.startswith("//", self.i):
                j = s.find("\n", self.i)
                self.i = n if j < 0 else j + 1
            else:
                break

    def _expect(self, ch):
        self._ws()
        if self.i >= self.n or self.s[self.i] != ch:
            raise ValueError(f"expected {ch!r} at offset {self.i}")
        self.i += 1

    def value(self):
        self._ws()
        if self.i >= self.n:
            raise ValueError("unexpected end of input")
        c = self.s[self.i]
        if c == "{":
            return self._dict()
        if c == "(":
            return self._array()
        if c == '"':
            return self._quoted()
        if c == "<":
            j = self.s.find(">", self.i)
            raw = self.s[self.i:j + 1]
            self.i = j + 1
            return raw
        m = _BARE_RE.match(self.s, self.i)
        if not m:
            raise ValueError(f"unexpected {c!r} at offset {self.i}")
        self.i = m.end()
        return m.group(0)

    def _dict(self):
        self.i += 1
        out = {}
        while True:
            self._ws()
            if self.i < self.n and self.s[self.i] == "}":
                self.i += 1
                return out
            key = self.value()
            self._expect("=")
            out[key] = self.value()
            self._ws()
            if self.i < self.n and self.s[self.i] == ";":
                self.i += 1

    def _array(self):
        self.i += 1
        out = []
        while True:
            self._ws()
            if self.i < self.n and self.s[self.i] == ")":
                self.i += 1
                return out
            out.append(self.value())
            self._ws()
            if self.i < self.n and self.s[self.i] == ",":
                self.i += 1

    def _quoted(self):
        self.i += 1
        buf = []
        esc = {"n": "\n", "t": "\t", "r": "\r", '"': '"', "\\": "\\", "'": "'"}
        while self.i < self.n:
            c = self.s[self.i]
            if c == "\\" and self.i + 1 < self.n:
                nxt = self.s[self.i + 1]
                buf.append(esc.get(nxt, nxt))
                self.i += 2
                continue
            if c == '"':
                self.i += 1
                return "".join(buf)
            buf.append(c)
            self.i += 1
        raise ValueError("unterminated string")


def parse_old_plist(text):
    return _Parser(text).value()


# ----------------------------------------------------------------- xcconfig

_XC_INCLUDE = re.compile(r'^\s*#include\??\s+"([^"]+)"')
_XC_ASSIGN = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(\[[^\]]*\])?\s*=\s*(.*?)\s*;?\s*$")


def parse_xcconfig(path, _seen=None):
    """Return {KEY: value}. Conditional assignments apply only for sdk=iphoneos*."""
    _seen = _seen or set()
    path = Path(path)
    try:
        real = path.resolve()
    except OSError:
        return {}
    if real in _seen or not path.is_file():
        return {}
    _seen.add(real)
    out = {}
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        inc = _XC_INCLUDE.match(line)
        if inc:
            out.update(parse_xcconfig(path.parent / inc.group(1), _seen))
            continue
        code = line.split("//", 1)[0]
        m = _XC_ASSIGN.match(code)
        if not m:
            continue
        key, cond, value = m.group(1), m.group(2), m.group(3)
        if cond and "sdk=iphoneos" not in cond and "sdk=*" not in cond:
            continue
        out[key] = value
    return out


# ----------------------------------------------------------------- variable expansion

_VAR_RE = re.compile(r"\$[({]([A-Za-z0-9_]+)(?::([A-Za-z0-9_,]+))?[)}]")


def _modify(value, modifier):
    if not modifier:
        return value
    if "rfc1034identifier" in modifier:
        value = re.sub(r"[^A-Za-z0-9.-]", "-", value)
    if "c99extidentifier" in modifier:
        value = re.sub(r"[^A-Za-z0-9_]", "_", value)
    if "lower" in modifier:
        value = value.lower()
    if "upper" in modifier:
        value = value.upper()
    return value


def expand(value, settings, depth=0):
    """Expand $(VAR) / ${VAR}. Unknown variables are left in place."""
    if isinstance(value, list):
        value = " ".join(str(v) for v in value)
    if not isinstance(value, str) or depth > 10 or "$" not in value:
        return value.strip() if isinstance(value, str) else value

    def rep(m):
        name, mod = m.group(1), m.group(2)
        if name == "inherited":
            return ""
        if name in settings:
            return _modify(str(expand(settings[name], settings, depth + 1)), mod)
        return m.group(0)

    return _VAR_RE.sub(rep, value).strip()


# ----------------------------------------------------------------- projects

def _group_paths(objects, project_dir):
    """Map PBXFileReference id -> absolute Path, following <group> chains."""
    parent = {}
    for oid, obj in objects.items():
        if isinstance(obj, dict) and obj.get("isa") in ("PBXGroup", "PBXVariantGroup"):
            for child in obj.get("children", []):
                parent[child] = oid

    def path_of(oid, depth=0):
        obj = objects.get(oid, {})
        own = obj.get("path", "")
        tree = obj.get("sourceTree", "<group>")
        if tree == "SOURCE_ROOT":
            return project_dir / own
        if tree == "<absolute>":
            return Path(own)
        if tree != "<group>" or depth > 50:
            return None
        pid = parent.get(oid)
        base = path_of(pid, depth + 1) if pid else project_dir
        if base is None:
            return None
        return base / own if own else base

    return path_of


def _config(objects, list_id, wanted):
    clist = objects.get(list_id, {})
    configs = [objects.get(c, {}) for c in clist.get("buildConfigurations", [])]
    by_name = {c.get("name"): c for c in configs}
    if wanted in by_name:
        return by_name[wanted]
    default = clist.get("defaultConfigurationName")
    if default in by_name:
        return by_name[default]
    return configs[0] if configs else {}


def load_project(pbxproj_path, configuration="Release"):
    """Return {'project': str, 'targets': [...]} or None if unparseable."""
    pbxproj_path = Path(pbxproj_path)
    try:
        data = parse_old_plist(pbxproj_path.read_text(encoding="utf-8", errors="ignore"))
    except (ValueError, IndexError, OSError):
        return None
    if not isinstance(data, dict):
        return None
    objects = data.get("objects") or {}
    root = objects.get(data.get("rootObject"), {})
    if not root:
        return None
    xcodeproj = pbxproj_path.parent
    project_dir = xcodeproj.parent / root.get("projectDirPath", "")
    path_of = _group_paths(objects, project_dir)

    def xcconfig_settings(cfg):
        ref = cfg.get("baseConfigurationReference")
        if not ref:
            return {}, None
        p = path_of(ref)
        if p is None or not p.is_file():
            name = objects.get(ref, {}).get("path", "")
            hits = sorted(project_dir.rglob(Path(name).name)) if name else []
            p = hits[0] if hits else None
        return (parse_xcconfig(p), p) if p else ({}, None)

    proj_cfg = _config(objects, root.get("buildConfigurationList"), configuration)
    proj_xc, proj_xc_path = xcconfig_settings(proj_cfg)
    base = {
        "SRCROOT": str(project_dir), "PROJECT_DIR": str(project_dir),
        "PROJECT_NAME": xcodeproj.stem, "CONFIGURATION": proj_cfg.get("name", configuration),
    }
    base.update(proj_xc)
    base.update(proj_cfg.get("buildSettings") or {})

    targets = []
    for tid in root.get("targets", []):
        t = objects.get(tid, {})
        if t.get("isa") != "PBXNativeTarget":
            continue
        cfg = _config(objects, t.get("buildConfigurationList"), configuration)
        t_xc, t_xc_path = xcconfig_settings(cfg)
        settings = dict(base)
        settings["TARGET_NAME"] = t.get("name", "")
        settings.setdefault("PRODUCT_NAME", "$(TARGET_NAME)")
        settings.update(t_xc)
        settings.update(cfg.get("buildSettings") or {})
        resolved = {k: expand(v, settings) for k, v in settings.items()}
        plist = resolved.get("INFOPLIST_FILE") or ""
        plist_path = None
        if plist:
            cand = Path(plist) if Path(plist).is_absolute() else project_dir / plist
            plist_path = cand if cand.is_file() else None
        targets.append({
            "name": t.get("name", ""),
            "product_type": t.get("productType", ""),
            "configuration": cfg.get("name", configuration),
            "settings": resolved,
            "raw_settings": settings,
            "info_plist": plist_path,
            "xcconfigs": [str(p) for p in (proj_xc_path, t_xc_path) if p],
        })
    return {"project": str(xcodeproj), "project_dir": str(project_dir), "targets": targets}


APP = "com.apple.product-type.application"
WATCH_TYPES = {"com.apple.product-type.application.watchapp", "com.apple.product-type.application.watchapp2",
               "com.apple.product-type.application.watchapp2-container",
               "com.apple.product-type.watchkit-extension", "com.apple.product-type.watchkit2-extension"}
APP_CLIP_TYPES = {"com.apple.product-type.application.on-demand-install-capable"}
IMESSAGE_TYPES = {"com.apple.product-type.app-extension.messages",
                  "com.apple.product-type.app-extension.messages-sticker-pack",
                  "com.apple.product-type.application.messages"}
TEST_TYPES = {"com.apple.product-type.bundle.unit-test", "com.apple.product-type.bundle.ui-testing"}


def platforms(target):
    s = target["settings"]
    sdk = str(s.get("SDKROOT", "")).lower()
    supported = str(s.get("SUPPORTED_PLATFORMS", "")).lower().split()
    out = set(supported)
    if sdk and sdk != "auto":
        out.add(sdk)
    return out


def is_ios_app(target):
    if target["product_type"] != APP:
        return False
    plats = platforms(target)
    if not plats:
        return True          # SDKROOT unset: Xcode's iOS default
    if "iphoneos" in plats:
        return True
    return False


def companion_kind(target):
    pt = target["product_type"]
    if pt in WATCH_TYPES or (pt == APP and "watchos" in platforms(target)):
        return "watch_app"
    if pt in APP_CLIP_TYPES:
        return "app_clip"
    if pt in IMESSAGE_TYPES:
        return "imessage"
    return None
