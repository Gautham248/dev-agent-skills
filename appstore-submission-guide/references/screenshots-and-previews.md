# Screenshots and app previews

**Snapshot:** 2026-11-26.

**Sources:**
- ASC Help "Screenshot specifications" (verified, with the required-class wording search-snippet)
- "App preview specifications" (verified, with resolutions and count search-snippet)

`scripts/check_screenshots.py` holds the same size table as `SIZE_CLASSES`. When you change one,
change the other.

---

## General rules (verified)

- 1–10 screenshots per size class. Files must be `.jpeg`, `.jpg` or `.png`.
- **No alpha channel or transparency.**
- If the UI is the same across sizes, supply only the highest required resolution and App Store
  Connect scales it down.
- Screenshots must show the app in use, not just title art, a login screen or a splash screen
  (2.3.3). Overlays and captions are fine.
- Content must suit a 4+ audience (2.3.8).
- No prices or "Free" in the image text (2.3.7), including text inside the UI shown in the screenshot.
- No other platforms (2.3.10).
- Use fictional account data (2.3.9).

## Which classes are required

- **iPhone:** "At least one screenshot for iPhone with Dynamic Island (medium display)".
  (search-snippet)
- **iPad:** a 13" display screenshot, required if the app runs on iPad.
- **Conflict:** the Face ID (large) section says it is "Required if app runs on iPhone and screenshots
  for iPhone with Dynamic Island (large display) aren't provided."
  - **Recommend supplying both Dynamic Island (medium) and Dynamic Island (large).** That satisfies
    either reading.
  - Tell the developer the page conflicts, and link it.

## Size classes (portrait; landscape is the swap unless listed)

| Folder name (convention) | Class | Portrait sizes | Landscape exceptions | Requirement / fallback |
|---|---|---|---|---|
| `iphone-duo-outer` | iPhone Duo (outer) | 1398×2034 | | Optional now. **Required from April 2027 for apps using the iOS 27.1 SDK or later.** Adds a "made for iPhone Duo" badge. |
| `iphone-duo-inner` | iPhone Duo (inner) | 2007×2853 | | As above |
| `iphone-6.9` | Dynamic Island (large) | 1260×2736, 1290×2796, 1320×2868 | | Falls back to scaled Face ID (large). **Recommended.** |
| `iphone-6.5` | Face ID (large) | 1284×2778, 1242×2688 | | Conditionally required (see the conflict above) |
| `iphone-6.3` | Dynamic Island (medium) | 1179×2556, 1206×2622 | | **Required** |
| `iphone-6.1` | Face ID (medium) | 1170×2532, 1125×2436, 1080×2340 | | Falls back to Dynamic Island (medium) |
| `iphone-5.5` | Home Button (large) | 1242×2208 | | Falls back to Face ID (medium) |
| `iphone-4.7` | Home Button (medium) | 750×1334 | | Falls back to Home Button (large) |
| `iphone-4` | Home Button (4") | 640×1096, 640×1136 | 1136×600, 1136×640 | Falls back to Home Button (medium) |
| `iphone-3.5` | Home Button (3.5") | 640×920, 640×960 | 960×600, 960×640 | Falls back to Home Button (4") |
| `ipad-13` | iPad 13" | 2064×2752, 2048×2732 | | **Required if the app runs on iPad** |
| `ipad-12.9` | iPad 12.9" (2nd gen) | 2048×2732 | | Falls back to scaled 13" |
| `ipad-11` | iPad 11" | 1488×2266, 1512×2316, 1668×2420, 1668×2388, 1640×2360 | | Falls back to scaled 13" |
| `ipad-10.5` | iPad 10.5" | 1668×2224 | | Falls back to scaled 12.9" |
| `ipad-9.7` | iPad 9.7" | 1536×2008, 1536×2048, 768×1004, 768×1024 | 2048×1496, 2048×1536, 1024×748, 1024×768 | Falls back to 10.5" |

**Inch labels are this skill's folder convention only.** Apple's page names classes by display type
("Dynamic Island (medium)"), not by inches.

**2048×2732 is valid for both the 13" and the 12.9" iPad.** Put such screenshots in the folder for the
class they're meant for. Without a folder, the checker reports them as ambiguous rather than rejecting
them.

## Not covered by this skill (detected only)

| Platform | Sizes |
|---|---|
| Mac | 1280×800, 1440×900, 2560×1600, 2880×1800 |
| Apple TV | 1920×1080, 3840×2160 |
| Apple Vision Pro | 3840×2160 |
| Apple Watch | 422×514, 410×502, 416×496, 396×484, 368×448, 312×390 |

A bundled watch app needs Watch screenshots at one size, used consistently across localizations.

## App previews

**Verified:**
- H.264 (`.mov`, `.m4v`, `.mp4`) or ProRes 422 HQ (`.mov`).
- Up to 500 MB, 15–30 seconds long.
- The default poster frame is at 5 seconds. Processing takes up to 24 hours.
- Portrait or landscape for iOS.
- Previews show before screenshots.
- Content must be screen captures of the app only. Narration and overlays are allowed (2.3.4).

**Search-snippet, confirm before relying on it:**
- Up to 3 previews per size class and language.
- H.264 at about 10–12 Mbps, 30 fps max, stereo AAC 256 kbps at 44.1 or 48 kHz.
- Accepted resolutions (portrait / landscape):

| Device class | Resolution |
|---|---|
| iPhone Duo, Dynamic Island, Face ID | 886×1920 / 1920×886 |
| iPhone Home Button (large), 4" | 1080×1920 / 1920×1080 |
| iPhone Home Button (medium) | 750×1334 / 1334×750 |
| iPad 13", 11", 10.5" | 1200×1600 / 1600×1200 |
| iPad 9.7" | 900×1200 / 1200×900 |

Use the accepted resolution, not the device's native resolution.
