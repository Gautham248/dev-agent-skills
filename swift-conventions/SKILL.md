---
name: swift-conventions
description: >
  A Swift language convention baseline grounded in four verified official
  sources: The Swift Programming Language guide (docs.swift.org/swift-book),
  the official Swift API Design Guidelines (swift.org), Apple's Observation
  framework docs (developer.apple.com), and Google's Swift Style Guide
  (google.github.io/swift, applied only when the project opts in). Covers
  optionals, error handling, value vs reference types, ARC/memory
  management, the @Observable macro and Observation framework,
  protocol-oriented design, access control (including `package`),
  naming/API design, and formatting. Use whenever writing or reviewing
  .swift files, iOS/macOS/watchOS/visionOS app code, Swift Package Manager
  targets, or any code that unwraps optionals, models domain types, tracks
  observable state, designs a function/type's public surface, or manages
  object lifetime.
---

<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->
Before doing anything else in this skill, read and follow the clarification protocol at:
../config/CLARIFICATION-PROTOCOL.md
<!-- END dev-agent-skills clarification protocol -->

<!-- BEGIN dev-agent-skills self-improvement protocol (managed by setup.sh -- do not edit this block manually; edit SELF-IMPROVEMENT-PROTOCOL.md instead) -->
While using this skill, and especially when you finish, read and follow the self-improvement protocol at:
../config/SELF-IMPROVEMENT-PROTOCOL.md
(Append real edge cases to this skill's own references/edge-cases.md — create it if missing. See the protocol file for what qualifies.)
<!-- END dev-agent-skills self-improvement protocol -->

# Swift conventions

## Sources and how this skill is organized

This skill draws on four sources, each fetched and read directly (not
recalled from training data alone) when this skill was written:

1. **The Swift Programming Language** (TSPL) — the language guide at
   `docs.swift.org/swift-book`, source repo `swiftlang/swift-book`. The
   Universal baseline below is distilled from it.
2. **Swift API Design Guidelines** — the official naming/API rules at
   `swift.org/documentation/api-design-guidelines`. Full distillation in
   `references/api-design-guidelines.md`.
3. **Apple's Observation framework documentation** —
   `developer.apple.com/documentation/observation` and its official
   migration guide. Folded into the Universal baseline below (Observation
   section) since it's a standard-library feature (`import Observation`),
   not framework-specific UI guidance.
4. **Google Swift Style Guide** — `google.github.io/swift`, a specific
   company's formatting/style conventions built on top of (1) and (2). Full
   distillation in `references/google-style-guide.md`. **This one is opt-in,
   not universal** — see Step 3 below.

**Scope note**: `developer.apple.com/documentation` hosts Apple's entire API
surface — every framework, from HealthKit to WidgetKit. This skill only
draws from the parts that are core-language or standard-library level
(Observation). It does not attempt to absorb framework-specific docs
(SwiftUI view modifiers, UIKit view controllers, etc.) — that's out of scope
for a language-conventions skill and would belong in separate,
framework-specific skills if ever needed. If a task touches SwiftUI, UIKit,
or another Apple framework beyond core language/stdlib usage, treat this
skill as the layer underneath that framework's own conventions, not a
replacement for framework-specific guidance.

## Step 1 — Apply the Universal baseline (always)

Prefer code that makes illegal states unrepresentable — optionals that are
actually unwrapped, value types by default, errors that are typed and
handled — over force-unwraps and implicitly-unwrapped shortcuts that just
move the crash to runtime.

### Optionals

- Never force-unwrap (`!`) or use implicitly-unwrapped optionals (`T!`) for
  a value that can plausibly be `nil` at runtime.
- Prefer `if let` / `guard let` to unwrap; use `guard let ... else { return }`
  for early exit rather than nesting the rest of the function inside `if let`.
- Use optional chaining (`a?.b?.c`) to walk a chain without nested `if let`s
  when you only need the final value. Use `??` to supply a genuine default.
- `T!` has one legitimate common use: a property genuinely `nil` for a
  brief, well-defined window (e.g. an `@IBOutlet` populated after `init` but
  before first use) — not a general way to avoid `?`.
- Model "value that legitimately doesn't exist yet" with `Optional`, not a
  sentinel (`-1`, empty string, `NSNotFound`) — the compiler enforces `nil`
  handling and can't enforce sentinel handling.

```swift
// No — crashes if the lookup ever misses
let user = users[id]!

// Yes — the caller decides what "missing" means
guard let user = users[id] else {
    throw LookupError.userNotFound(id)
}
```

### Error handling

- Use `throws`/`try`/`catch` for failures the caller should be able to
  distinguish and react to. Model error cases as an `enum` conforming to
  `Error`, with associated values carrying whatever context the catch site
  needs — not a bare `NSError` or a stringly-typed error.
- Reach for `Optional` instead when "absent" is itself a valid, unremarkable
  outcome (`Dictionary` subscript, `first(where:)`) — not every failure is
  an error.
- `try?` discards the error entirely — only use it when the caller truly
  doesn't need to know *why* it failed. **On a network/database
  deserialization call specifically, bare `try?` is a real diagnosability
  problem, not just a style preference** — a malformed API response fails
  silently with no trace of what was actually wrong, which turns a
  five-minute log-read into a from-scratch repro. Prefer `do { ... } catch
  { logger.debug("...: \(error)"); return nil }` (or the `throws`
  equivalent) over a bare `try?` wherever the failure reason has any
  debugging value — which for a decode of external/untrusted data, it
  almost always does.
- `try!` asserts infallibility and crashes if wrong — treat it like
  force-unwrap. Reserve it for cases genuinely provably infallible (a regex
  literal known-valid at compile time); prefer `try?` or `do`/`catch`
  otherwise. Never use `throws` for ordinary control flow.

```swift
enum DecodingError: Error {
    case missingField(String)
    case invalidFormat(field: String, value: String)
}

func parse(_ json: [String: Any]) throws -> Profile {
    guard let name = json["name"] as? String else {
        throw DecodingError.missingField("name")
    }
    // ...
}
```

### Formatters and other expensive-to-instantiate Foundation types

`DateFormatter`, `ISO8601DateFormatter`, and `NumberFormatter` are
genuinely expensive to construct — their initializers do real work
(locale/calendar/timezone resolution), not cheap struct setup. Code that
allocates one of these **inside a function body that runs per-element**
(a `map`/`forEach` closure, a loop body, a hot parsing path) pays that
construction cost on every call, which is easy to miss because it's
syntactically valid, correctly-behaving Swift — the bug is a performance
one, not a correctness one, so it doesn't show up in tests or a normal
read of the diff.

- Hoist the formatter to a `static let` (or an instance property that
  outlives the loop) instead of instantiating it inside the loop/closure
  body. `static let` is lazily initialized and thread-safe by construction
  in Swift, so this is strictly better than a loop-local instance, not
  just faster.
- `DateFormatter`/`NumberFormatter` instances are not safe to share across
  threads if mutated concurrently (changing `.dateFormat` etc. after
  creation) — a single shared `static let` used read-only (configured once,
  never mutated after) is fine; a shared *mutable-configuration* formatter
  touched from multiple threads is not.

```swift
// No — constructs a new ISO8601DateFormatter on every element
let dates = strings.map { ISO8601DateFormatter().date(from: $0) }

// Yes — one instance, reused
enum LioDate {
    static let iso8601 = ISO8601DateFormatter()
    static func parse(_ strings: [String]) -> [Date?] {
        strings.map { iso8601.date(from: $0) }
    }
}
```

### Keychain accessibility

Every `SecItemAdd`/`SecItemUpdate` query dictionary should set
`kSecAttrAccessible` **explicitly** — don't rely on the implicit default.
Confirmed against Apple's own documentation and forum guidance rather than
assumed: the SDK's default when the attribute is omitted is
`kSecAttrAccessibleWhenUnlocked`, which is reasonably secure but has a
specific, easy-to-miss failure mode: it makes the item **inaccessible
whenever the device is locked**, including during background execution.

- **If the item needs to be read during background work** (a background
  App Refresh task, a silent-push-triggered CloudKit sync, anything that
  can run while the device is locked) — `kSecAttrAccessibleWhenUnlocked`
  (the default) will make that background work fail whenever it happens to
  run while the device is locked. Use an `AfterFirstUnlock` variant
  instead, which stays accessible from first unlock after boot until the
  next reboot, including while subsequently locked.
- **Prefer the `ThisDeviceOnly` variants** (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`,
  `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`) unless the item
  genuinely needs to travel via iCloud Keychain sync or an encrypted device
  backup/restore — most app-specific credentials (an auth session token, a
  local encryption key) don't need that portability and are safer without
  it.
- **Never use `kSecAttrAccessibleAlways`** (accessible even when the
  device is locked, deprecated) — there's no legitimate reason for new code
  to reach for it over an `AfterFirstUnlock` variant.
- The choice isn't one-size-fits-all — state which level a given Keychain
  item uses and why (background-availability need vs. sync/backup need) in
  review, rather than treating "some `kSecAttrAccessible` value is present"
  as sufficient on its own.

### Value vs reference types

- Default to `struct`/`enum` for model/data types. Reach for `class`
  specifically when you need reference semantics: shared mutable state,
  identity (`===`), inheritance, or Objective-C interop.
- A `struct` of value-type properties gets `Equatable`, `Hashable`, and a
  memberwise `init` largely for free via synthesis — a `class` doesn't.
- A `struct` that stores a `class` property still shares that inner
  reference across copies. If that sharing is unintentional, wrap the
  mutable class in a value type or make it immutable.
- Use `enum` with associated values for a closed set of mutually exclusive
  states, instead of a struct with several optionals only sometimes
  populated together — the enum makes invalid combinations unrepresentable.

```swift
// No — three optionals that can be inconsistently populated
struct RequestState {
    var data: Data?
    var error: Error?
    var isLoading: Bool
}

// Yes — only one state can exist at a time, by construction
enum RequestState {
    case idle, loading, success(Data), failure(Error)
}
```

### Memory management (ARC)

- Swift uses ARC for `class` instances. Retain cycles are a real bug,
  mainly through closures and parent/child object graphs.
- Any closure *stored* (not just called immediately) by an object it also
  references — a saved completion handler, a registered callback, an
  `@escaping` closure captured by a long-lived object — needs a capture
  list: `[weak self]` in the common case, `[unowned self]` only when `self`
  is provably guaranteed to outlive the closure's execution.
- After `[weak self]`, unwrap with `guard let self else { return }` at the
  top rather than repeating `self?.` everywhere.
- **Choosing weak vs. unowned** (verified against the ARC chapter): use
  `weak` when the referenced instance can legitimately be deallocated first
  — i.e. it can have a shorter lifetime than the referrer. Use `unowned`
  when the two instances are guaranteed to have the same or a longer
  lifetime and one should never outlive the other; accessing a deallocated
  `unowned` reference is a runtime crash, not a graceful `nil`.
- Two objects holding strong references to each other (e.g. a delegate/parent
  pattern implemented with strong references both ways) is a retain cycle —
  mark one side `weak` (or `unowned` if it can never be `nil` during the
  relationship). Delegate properties are `weak` by convention for this reason.
- `@escaping` on a closure parameter means it can outlive the call — treat
  that as your cue to think about capture lists at the call site.

```swift
class ProfileLoader {
    var onComplete: ((Profile) -> Void)?

    func load() {
        api.fetchProfile { [weak self] result in
            guard let self else { return }
            if case .success(let profile) = result {
                self.onComplete?(profile)
            }
        }
    }
}
```

### Protocols and extensions (protocol-oriented design)

- Prefer a `protocol` (optionally with a `protocol extension` default
  implementation) over a base `class` with subclasses, when only behavior is
  shared, not stored state or identity.
- Use `extension` to organize a type's conformances and grouped
  functionality separately from its main declaration.
- Constrain generics with `where` clauses / protocol requirements rather
  than accepting `Any` and casting back down.
- A protocol with associated types can't be used as a standalone existential
  directly in older Swift — use a generic constrained by the protocol, or
  `some`/`any` (Swift 5.7+), rather than hand-rolled type erasure unless the
  project's minimum Swift version requires it.

### Access control

Six access levels, narrowest to widest: `private` → `fileprivate` →
`internal` (the implicit default) → **`package`** → `public` → `open`.
`package` (Swift 5.9+) sits between `internal` and `public`: visible across
every module in the same package, but not outside it — the right level for
APIs shared between your own SwiftPM targets/modules without exposing them
as public API to external consumers.

- Default new declarations to the narrowest level that works. Don't leave
  everything at the implicit `internal` default without considering whether
  it should be narrower.
- **A `public` type defaults to `internal` members**, not public ones — you
  opt each member into the wider surface explicitly. This is deliberate: it
  stops a type's internals from becoming public API by accident.
- **Guiding principle**: no entity can be defined in terms of another entity
  with a more restrictive access level — a public function can't return a
  type that's only internal.
- `open` applies only to classes/class members and, unlike `public`, permits
  subclassing/overriding from outside the defining module — marking
  something `open` is a deliberate statement that external subclassing was
  designed for.
- **Opinionated:** prefer `private` over `fileprivate` unless two types in
  the same file genuinely need to share access to each other's members —
  `fileprivate` is easy to reach for out of habit and quietly widens the
  surface more than intended.
- Mark a `class` `final` unless it's explicitly designed for subclassing.

### Observation (Swift 5.9+ / iOS 17, macOS 14, watchOS 10, tvOS 17+)

The `Observation` module (`import Observation`) is a standard-library observer
pattern, not a SwiftUI-only feature — it works with UIKit and plain Swift
code too, via `withObservationTracking`. Verified against Apple's official
migration guide plus the framework's own symbol-reference pages.

- **`@Observable` replaces `ObservableObject` + `@Published`** on a `class`.
  No property wrapper is needed on individual properties — observability is
  determined by the property's accessibility to the observer, not a wrapper.
  `@Observable` cannot be applied to a `struct`, `enum`, or `actor` — class
  only.
- **`@ObservationIgnored`** opts a specific stored property out of tracking
  — use it for properties an observer shouldn't trigger updates for (e.g.
  internal bookkeeping state, not UI-relevant).
- In SwiftUI specifically: pair `@Observable` types with `@State`/`@Environment`
  instead of `@StateObject`/`@EnvironmentObject`, and `@Bindable` instead of
  `@ObservedObject` when a view needs a two-way binding into the type. A view
  only re-renders when a property it actually reads in `body` changes —
  finer-grained than `ObservableObject`, where any `@Published` change
  re-renders every observer regardless of what that observer's `body` reads.
- **Outside SwiftUI**, use `withObservationTracking(_:onChange:)` directly:
  the `apply` closure's property reads are what gets tracked, and `onChange`
  fires once on the first subsequent change to any of them. It is
  **one-shot** — if you need continuous observation, re-invoke
  `withObservationTracking` again from inside `onChange`, not a single
  registration that keeps firing.
- `ObservationRegistrar` is the low-level storage the macro generates calls
  to (`access`/`withMutation`) — write code against it directly only when
  implementing observation manually (e.g. a type that can't use the macro);
  `@Observable` handles this for the common case.
- Migrate incrementally — `@Observable` types and `ObservableObject` types
  can coexist in one app; there's no need for a wholesale rewrite.

### Naming and API design

Follow the official Swift API Design Guidelines — full distillation in
`references/api-design-guidelines.md`, load it when writing or reviewing any
function/type/protocol signature, not just for a quick naming question. The
headline rule: **clarity at the point of use beats brevity** — judge a name
by how a real call reads, not by the declaration alone. Quick hits:
`UpperCamelCase` types/protocols, `lowerCamelCase` everything else; Boolean
names read as assertions (`isEmpty`); mutating/nonmutating pairs get
`sort()`/`sorted()`-style naming; omit an argument label only when the call
reads as a clear grammatical phrase without it.

### Closures and control flow

- Trailing closure syntax when a function's last parameter is a closure and
  there's exactly one.
- Prefer `guard` for preconditions/early exits; reserve nested `if` for
  logic that's genuinely branching.
- Prefer `switch` over chained `if`/`else if` for enum cases — the compiler
  enforces exhaustiveness (or an explicit `default`).
- For `async`/`await` code (Swift 5.5+), don't wrap an `async` function in a
  manual completion-handler + semaphore/callback bridge unless interop with
  pre-concurrency code genuinely requires it.

## Step 2 — Apply the API Design Guidelines when writing or reviewing API surface

Any time the task defines or changes a function signature, initializer,
type name, protocol, or parameter list — not just "is this a public API" —
load `references/api-design-guidelines.md` and check the new/changed
signature against it. This is the guide that determines whether a name
reads clearly at the call site, which argument gets a label, and how a
mutating/nonmutating pair should be named.

## Step 3 — Decide whether Google's Style Guide applies (opt-in, not automatic)

Google's guide (`references/google-style-guide.md`) is one company's
formatting and style convention, not universal Swift practice — don't apply
it by default. Apply it when:

- The project has a `.swift-format` config, or a `swiftlint`/`swiftformat`
  config whose rules mirror it (100-column limit, K&R braces, no
  semicolons, required trailing commas on vertical literals are the
  telltale signals).
- The person explicitly asks for "Google style" or references this guide.
- The existing codebase already visibly follows it (check a few files
  before assuming).

If none of those hold, use whatever formatting convention the project's
existing code already follows, or fall back to the Universal baseline above
plus the API Design Guidelines — don't impose Google's opinions on a project
that hasn't adopted them. If it's ambiguous which applies, ask once rather
than guessing.

## When conventions here conflict with a linter

If the project already has SwiftLint/SwiftFormat rules configured, those win
for anything mechanical the linter actually enforces. This skill is for the
judgment calls a linter can't make — which type to reach for, when a
force-unwrap is actually safe, how to shape an error enum, whether a name
reads clearly — not a substitute for one.

## If something goes wrong

Before improvising a fix or contradicting something stated here, check
`references/edge-cases.md` — this may already be a documented, resolved
question. If it's genuinely new once you're done, follow the
self-improvement protocol above and add it there.

## References

- `references/api-design-guidelines.md` — full distillation of the official
  Swift API Design Guidelines. Load for any naming/signature decision.
- `references/google-style-guide.md` — full distillation of Google's Swift
  Style Guide. Opt-in only, see Step 3.
- `references/edge-cases.md` — accumulated real-world edge cases; check it
  when something unexpected happens during use, created via the
  self-improvement protocol above.

Observation framework guidance is folded directly into the Universal
baseline above rather than a separate reference file — it's a compact,
stable set of rules (one macro, one ignore-attribute, one tracking function,
one registrar type), unlike the two larger guideline documents above.
