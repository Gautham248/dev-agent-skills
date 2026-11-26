# Edge cases: appstore-submission-guide

Real situations this skill ran into, appended in the dated format from
`../config/SELF-IMPROVEMENT-PROTOCOL.md`. Never rewrite or remove an entry.

Step 1 (freshness check) also appends here whenever an Apple page is newer than the 2026-11-26
snapshot. Name the stale reference row so the next editor can update it.


## 2026-11-26 — Bundle ID prefix lives in a git-ignored xcconfig

What happened: a real project (Ice Cubes) sets `PRODUCT_BUNDLE_IDENTIFIER =
$(BUNDLE_ID_PREFIX).IceCubesApp` and defines `BUNDLE_ID_PREFIX` in
`IceCubesApp-release.xcconfig` (Release) and in a git-ignored `IceCubesApp.xcconfig`
created from a `.template` (Debug). Reading build settings without the xcconfig gave an
unusable bundle ID.
What I did: the harvester resolves the Release configuration through
`baseConfigurationReference` and `#include`s. When the defining file isn't in the repo
(git-ignored, or injected by CI), it reports `bundle_id_unresolved`. **Handle:** ask the
developer for the real bundle ID; never paste a value that still contains `$(`.

## 2026-11-26 — App icon in Icon Composer format

What happened: the same project ships its icon as `AppIcon.icon` (Icon Composer, Xcode 26)
with no `AppIcon.appiconset`, so a 1024x1024 PNG check had nothing to read.
What I did: the harvester reports `app_icon.format = "icon_composer"` and skips the PNG
alpha and size checks. **Handle:** for this format, ask the developer to confirm the
exported App Store icon in Xcode's archive rather than checking pixels.
