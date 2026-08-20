# Google Swift Style Guide (distilled) — opt-in, not universal

Source: [google.github.io/swift](https://google.github.io/swift/) — Google's
own Swift style guide, used across Swift projects at Google and the basis
for their `swift-format` tool. Fetched and read in full to write this
reference; condensed and paraphrased here, not copied.

**This entire file is opinionated house style, not universal Swift
practice.** Apply it only when the project actually follows it — a
`.swift-format` config, a `swiftformat`/`swiftlint` config that mirrors these
rules, an explicit mention of "Google style," or a direct request. Absent
that signal, don't impose these formatting choices on a project that hasn't
adopted them; use whatever the project's existing code already does, or fall
back to the language-guide/API-design-guidelines baseline in the main
`SKILL.md`. Google's guide itself adopts the official Swift API Design
Guidelines wholesale for naming — that part isn't Google-specific, see
`api-design-guidelines.md`.

## File and source basics

- One `.swift` file per primary type, named after that type. An extension
  adding protocol conformance to an existing type goes in
  `TypeName+ProtocolName.swift`; multiple extensions can share
  `TypeName+Additions.swift`.
- UTF-8, no tabs, no Unicode escape sequences mixed with literal non-ASCII
  code points in the same string literal (pick one style per string).
- Imports: whole modules preferred over individual declarations; grouped as
  (1) module imports, (2) individual-declaration imports, (3) `@testable`
  imports — each group lexicographically sorted, one blank line between
  groups, never line-wrapped.

## Formatting

- **100-column limit**, except unbreakable text (e.g. a long URL in a
  comment), `import` lines, and generated code.
- **K&R braces**: no line break before `{` (except forced by wrapping rules),
  a line break after it, `} else {` stays on one line.
- **No semicolons** anywhere except inside a string literal or comment.
- **One statement per line**, except a line ending in a block with 0–1
  statements (`guard let value = value else { return 0 }` is fine).
- **Trailing commas are required** in array/dictionary literals laid out
  vertically (one element per line) — keeps diffs clean when items are
  added later.
- **`switch` cases indent at the same level as `switch`**, statements inside
  a case indent +2 from that.
- **One enum case per line** — the comma-delimited form is allowed only when
  no case has an associated/raw value, all fit on one line, and the names
  are self-explanatory.
- **Horizontal alignment is forbidden** except genuinely tabular data —
  don't pad property declarations to line up types, it creates a
  maintenance burden every time a new member changes the widest column.
- **No parentheses around the top-level condition** of `if`/`guard`/`while`/`switch`:
  `if x == 0 { ... }`, not `if (x == 0) { ... }`.
- Non-documentation comments always use `//`, never `/* ... */`.

## Trailing closures

- If a function has exactly one closure argument and it's last, always call
  it with trailing closure syntax — except where that would be ambiguous
  between two overloads differing only in closure-argument label (fix by
  differentiating the base name instead, not by giving up trailing-closure
  syntax) or where it would misparse as a control-flow body (`if let x =
  list.first(where: { ... })` needs the label, not a trailing closure).
- Never overload two functions so they differ *only* in the label of a
  closure parameter — it makes trailing-closure syntax ambiguous.
- Multiple closure arguments on one call: none use trailing syntax, all are
  labeled inside the parens.
- Trailing-closure calls with no other arguments never carry empty `()`
  after the function name: `[1,2,3].map { $0 * $0 }`, not `.map() { ... }`.

## Naming (beyond the official API Design Guidelines)

- **Access control does the hiding, not naming conventions.** Don't reach
  for a leading underscore to signal "private" — use `private`/`fileprivate`
  itself. A leading underscore is reserved for the rare case where a
  declaration must be `public` for language/module reasons but isn't meant
  to be called by clients.
- **Initializer arguments that map directly to a stored property share that
  property's name**, disambiguated with explicit `self.`: `init(name:
  String) { self.name = name }` — not a renamed parameter like `otherName`.
- **Static/class properties that return an instance of the declaring type
  aren't suffixed with the type name**: `UIColor.red`, not
  `UIColor.redColor`; `URLSession.shared`, not `URLSession.sharedSession`.
- **Global constants are `lowerCamelCase`**, no Hungarian-notation prefix
  (`g`/`k`) and no `SCREAMING_SNAKE_CASE`.
- **Delegate methods follow Cocoa-style linguistic conventions**: the
  delegate's source object is always the first argument. A `Void`-returning
  method with only that argument reads as `<SourceType><VerbPhrase>`, e.g.
  `scrollViewDidBeginScrolling(_ scrollView: UIScrollView)`. Additional
  arguments keep the source-type base name and label the second argument
  with the event/query, e.g. `tableView(_:willDisplayCell:forRowAt:)`.

## Programming practices

- **Sentinel values are avoided** (a `-1` "not found" index) in favor of
  `Optional` — the type system can't distinguish a sentinel from a valid
  result, but it can distinguish `nil` from a value.
- **`Optional` is also acceptable for a single, obvious failure reason**
  (`Int17.init?(_ string:)` failing because the string isn't a valid
  integer) — reserve full `Error` types for when there are multiple
  distinguishable failure states.
- Testing "is this optional non-nil" without using the value is written as
  `if value != nil`, not `if let _ = value` — the latter reads as unwrapping
  something that's then discarded, which obscures intent.
- **`try!` is forbidden** outside tests, with one narrow exception: a single
  expression that would only throw due to programmer error and could be
  evaluated context-free in the REPL (a regex literal known-valid at compile
  time). Anything dynamic or user-derived must use `do`/`catch` or `try?`
  instead.
- **Force-unwrap/force-cast are discouraged**; when used outside tests, a
  comment must state the invariant that makes it safe. Bare, unexplained
  `!` is a review flag.
- **Implicitly-unwrapped optionals** are limited to: UI objects whose
  lifetime tracks the UI lifecycle rather than the owning object's lifetime
  (`@IBOutlet`, views set up in `viewDidLoad`), Objective-C interop lacking
  nullability annotations (minimize how far these propagate through your own
  code), and test fixtures set up in `setUp()`.
- **Nesting over naming conventions** for scoped types: an error enum
  belonging to one type nests inside it (`Parser.Error`) rather than living
  at top level as `ParserError`.
- **An empty-case `enum` is the idiomatic namespace** for grouped constants
  or helpers — no `private init()` boilerplate needed, unlike a `struct`
  used the same way.
- **`guard` for early exit** is preferred over an inverted `if` — it keeps
  failure conditions next to their trigger and keeps the main logic flush
  left instead of nested.
- **`for`-`where`** replaces a loop body that's a single `if` testing one
  condition: `for item in collection where item.hasProperty { ... }`.
- **No case that does nothing but `fallthrough`** — combine the case
  patterns with a comma or range instead.
- **Trapping arithmetic (`+`, `-`, `*`) is the default**; masking operators
  (`&+`, `&-`, `&*`) are reserved for genuinely modular domains (hashing,
  crypto, big-integer implementations) where overflow is expected, and
  should be commented as such.
- New operators and operator overloading are permitted only when the
  operator has real precedent in the problem domain and is a readability
  win over a named method — not as a shorthand for an otherwise-unrelated
  operation.

## Documentation comments

- `///` line comments only, never `/** ... */` block form.
- Single-sentence summary first (may span lines, but keep it short —
  move detail to a following paragraph instead of a long first sentence).
- Use the singular `- Parameter name:` form for exactly one parameter, the
  plural `- Parameters:` nested-list form for more than one — don't mix.
- `- Parameter`/`- Returns`/`- Throws`, in that order; omit `Parameter(s)`/`Returns`
  only when the one-line summary already says everything they would.
- Every `open`/`public` declaration and member gets a doc comment, with
  narrow exceptions: self-explanatory enum cases, protocol-requirement
  implementations/overrides that don't add new behavior, most test
  code, and extension declarations themselves (document the extension only
  if it adds real clarifying information beyond "adds X conformance").
