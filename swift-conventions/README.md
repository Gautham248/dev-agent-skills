# swift-conventions

An Agent Skill that gives a coding agent a sane **Swift convention baseline**
— grounded in three sources fetched and read directly while building this
skill, not recalled from training data alone:

1. [The Swift Programming Language](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/) (TSPL) — the language guide.
2. The official [Swift API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/) — naming and API design.
3. Apple's [Observation framework documentation](https://developer.apple.com/documentation/observation) — the `@Observable` macro and related standard-library APIs (Swift 5.9+).
4. [Google's Swift Style Guide](https://google.github.io/swift/) — formatting/style, applied only opt-in.

It covers safe optional unwrapping, typed error handling with `throws`,
value-vs-reference type selection (`struct`/`enum` vs `class`), ARC/retain-cycle
avoidance in closures (including the verified weak-vs-unowned distinction),
the `@Observable`/`@ObservationIgnored`/`withObservationTracking` observation
APIs, protocol-oriented design, access control (all six levels, including
`package`), naming/API design, and closure/control-flow idioms. Google's
style guide is bundled as a full reference but is explicitly opt-in — the
skill only applies it when the project has adopted it or the person asks for
it by name. Deliberately out of scope: framework-specific guidance beyond
core language/stdlib (SwiftUI view modifiers, UIKit, etc.) — Apple's full
documentation site covers every framework it ships, and absorbing all of it
isn't what a language-conventions skill is for.

## Who it's for

Anyone writing or reviewing Swift — iOS/macOS/watchOS/visionOS app code,
Swift Package Manager targets, or command-line Swift. It assumes nothing
beyond the core language; it's the layer underneath framework-specific
conventions (SwiftUI, UIKit, etc.), not a replacement for them.

## What it is

A dispatcher `SKILL.md` plus two reference files — no script.
`references/api-design-guidelines.md` and `references/google-style-guide.md`
hold the full distillations so the main file stays under Claude's
progressive-disclosure budget; the dispatcher applies the universal baseline
and the API guidelines always, and only loads the Google style guide when
the project signals it wants that specific house style.

## A note on "conventions"

Conventions are project choices, not universal law. This skill marks the
broadly-agreed practices (don't force-unwrap, use `weak self` in stored
closures, default to value types, follow the official naming guidelines)
separately from the explicitly opt-in ones (Google's formatting style,
`private` over `fileprivate`). Treat the opt-in parts as defaults to confirm
against your own project's SwiftLint/SwiftFormat config, not as rules handed
down from outside.

## Install

Follows the open [Agent Skills](https://agentskills.io) layout. Drop the
`swift-conventions/` folder into your agent's skills directory.

**Portable (recommended for repos shared across agents):**

```bash
mkdir -p .agents/skills
cp -R swift-conventions .agents/skills/
```

**Per-agent personal/project paths:**

| Agent | Personal | Project |
|---|---|---|
| Claude Code | `~/.claude/skills/swift-conventions/` | `.claude/skills/swift-conventions/` |
| Cursor | native global path | `.agents/skills/swift-conventions/` or `.cursor/skills/swift-conventions/` |
| OpenCode | `~/.config/opencode/skills/swift-conventions/` | `.agents/skills/swift-conventions/` or `.opencode/skills/swift-conventions/` |
| Codex | `~/.codex/skills/swift-conventions/` | `.agents/skills/swift-conventions/` |
| Gemini CLI | installer-managed | `.agents/skills/swift-conventions/` |

Discovery, metadata, and invocation UI differ between these agents; this skill
relies only on the cross-agent `name` + `description` frontmatter. Feature depth
is not identical across platforms.

> Built and verified against **Claude Code**. Other agents implementing the
> Agent Skills format should load it too, but are not independently tested here.

## Usage

> Review this view model — are we force-unwrapping anywhere that could fail?

> Write this network layer following our Swift conventions.

> Does this closure risk a retain cycle?

## License

See the repository this skill ships in.
