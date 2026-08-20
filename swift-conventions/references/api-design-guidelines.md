# Swift API Design Guidelines (distilled)

Source: [swift.org/documentation/api-design-guidelines](https://www.swift.org/documentation/api-design-guidelines/)
— the official Swift.org guidelines, not a third-party interpretation.
Fetched and read in full to write this reference; this is a condensed,
paraphrased distillation organized for quick lookup while writing or
reviewing API surface, not a copy of the original page. Read the source
directly for anything this summary doesn't resolve.

This applies to anything that becomes part of an API another piece of code
calls: function/method/initializer signatures, parameter names, type names,
protocol names — public or not, since internal code is still "used" by the
rest of the module.

## The one fundamental rule

**Clarity at the point of use beats brevity.** A declaration is written once
and used many times — optimize for the call site reading clearly, not for
the declaration being short. Never judge a name by the declaration alone;
always check how it reads in an actual call.

## Naming for clear usage

- **Include every word needed to avoid ambiguity at the call site**, even if
  it makes the declaration longer. `employees.remove(at: x)` is unambiguous;
  `employees.remove(x)` reads as "remove the element equal to x," which is
  wrong.
- **Omit words that don't add information at the call site** — most often,
  words that just repeat the parameter's type. `allViews.removeElement(cancelButton)`
  → `allViews.remove(cancelButton)`; `Element` told the reader nothing `remove`
  didn't already convey.
- **Name parameters and associated types by role, not by type.** `var
  string = "Hello"` should be `var greeting = "Hello"`. A parameter named
  `widgetFactory` should be named for what it does in this context, e.g.
  `supplier`, unless the type name genuinely is the role.
- **Compensate for weak typing.** When a parameter's type is `Any`,
  `AnyObject`, `NSObject`, or a bare `Int`/`String`, the type alone won't
  convey intent at the call site — precede it with a role-describing noun:
  `addObserver(_:forKeyPath:)`, not `add(_:for:)`.

## Naming for fluent, grammatical call sites

- Prefer names where the call reads as an English phrase: `x.insert(y, at:
  z)` reads "x, insert y at z." It's fine for fluency to degrade after the
  first argument or two when later arguments are secondary to the call's
  meaning.
- **Factory methods start with `make`**: `x.makeIterator()`.
- **The first argument to an initializer or factory method should not read
  as continuing the base name as a phrase** — `Color(red: 32, green: 64,
  blue: 128)`, not `Color(havingRGBValuesRed: 32, ...)`. In practice this
  means the first argument gets a label unless the call is a value-preserving
  type conversion (see Argument Labels below).
- **Name by side effect.** No side effect → noun phrase: `x.distance(to:
  y)`, `i.successor()`. Has a side effect → imperative verb phrase:
  `print(x)`, `x.sort()`, `x.append(y)`.
- **Mutating/nonmutating pairs get consistent naming.** When the operation is
  naturally a verb, the mutating form uses the imperative and the
  nonmutating form adds "ed"/"ing": `x.sort()` / `z = x.sorted()`;
  `x.stripNewlines()` / `t.strippingNewlines()` (use "ing" when "ed" isn't
  grammatical because the verb takes a direct object). When the operation is
  naturally a noun, the nonmutating form uses the noun and the mutating form
  gets a `form` prefix: `y = x.union(z)` / `x.formUnion(z)`.
- **Boolean methods and properties read as assertions**: `x.isEmpty`,
  `line1.intersects(line2)` — not `x.empty` or a bare noun used as a flag.
- **Protocols that describe what something *is* read as nouns** (`Collection`).
  **Protocols that describe a *capability* use `-able`, `-ible`, or `-ing`**
  (`Equatable`, `ProgressReporting`).
- Types, properties, variables, and constants read as nouns generally.

## Terminology

- Prefer the common word over the technical term unless the technical term
  is genuinely more precise (don't say "epidermis" if "skin" works).
- If you do use a term of art, use it exactly as the field uses it — don't
  invent a new meaning for an established term.
- **Avoid abbreviations**, especially non-standard ones — an abbreviation's
  meaning should be findable by a plain web search.
- **Embrace precedent over simplification.** `Array`, not a simplified
  `List` — programmers already know `Array`. Within a domain, a precedented
  term (`sin(x)`) beats an explanatory phrase even if the explanatory phrase
  is more beginner-friendly.

## General conventions

- **Document the complexity of any computed property that isn't O(1)** —
  people assume property access is free.
- **Prefer methods and properties to free functions.** Free functions are
  for: no obvious `self` (`min(x, y, z)`), unconstrained generics
  (`print(x)`), or established domain notation (`sin(x)`).
- **Case conventions**: `UpperCamelCase` for types/protocols, everything else
  `lowerCamelCase`. Acronyms that are conventionally all-caps in English stay
  uniformly cased: `utf8Bytes`, `isRepresentableAsASCII`, `userSMTPServer` —
  not partially cased.
- **Methods can share a base name** when they do essentially the same thing
  (`Shape.contains(Point)` / `contains(Shape)` / `contains(LineSegment)`) or
  operate in genuinely separate domains. They should **not** share a name
  when the semantics differ (`Database.index()` rebuilding an index vs.
  `index(_:inTable:)` looking up a row is a naming bug, not acceptable
  overloading). Never overload on return type alone — it creates ambiguity
  under type inference.

## Parameters

- **Choose parameter names to make documentation read naturally** — even
  though they don't appear at the call site, they're what a reader sees in
  the generated docs and in Xcode's parameter hints. `filter(_ predicate:
  ...)` reads well as "elements that satisfy `predicate`"; `filter(_
  includedInResult: ...)` doesn't.
- **Use default parameter values** for anything with one commonly-used
  value, instead of a family of overloads. A single method with defaults is
  easier to learn and use correctly than `compare(_:)`,
  `compare(_:options:)`, `compare(_:options:range:)`,
  `compare(_:options:range:locale:)` as four separately-documented siblings.
- **Put defaulted parameters toward the end** of the parameter list —
  non-defaulted parameters are usually more essential to the call's meaning.

## Argument labels

- **Omit labels when arguments can't usefully be distinguished**: `min(a,
  b)`, `zip(a, b)`.
- **Value-preserving initializer conversions omit the first label**:
  `String(someUInt32)`, `UInt32(someInt16)` (widening). **Narrowing
  conversions get a label describing the narrowing**: `UInt32(truncating:
  someUInt64)`, `UInt32(saturating: someUInt64)`.
- **If the first argument forms part of a prepositional phrase, label it**,
  normally starting at the preposition: `x.removeBoxes(havingLength: 12)`.
  Exception: when the first two arguments are really one abstraction, start
  the label after the preposition instead — `a.moveTo(x: b, y: c)`, not
  `a.move(toX: b, y: c)`.
- **If the first argument otherwise forms part of a grammatical phrase with
  the base name, omit its label**: `x.addSubview(y)`. Get the phrase's
  *meaning* right, not just its grammar — `view.dismiss(false)` reads as
  legal but says nothing about what `false` means.
- **Label everything else.**
- **Name closure parameters and label tuple members** where they appear in
  a public signature — they carry documentation value and give named access
  to tuple members, even though closure argument labels aren't callable at
  the use site.

## Documentation comments

- Write a `///` doc comment for every public declaration; if you can't
  describe what it does simply, that's a signal the API itself may be
  designed wrong.
- **Begin with a summary** — usually one sentence fragment ending in a
  period, not a full sentence starting with "This method...". Describe what
  a function *does*/*returns*, what a subscript *accesses*, what an
  initializer *creates*, what anything else *is*.
- Continue with additional paragraphs/bullets only if needed, using
  recognized markup (`- Parameter`, `- Parameters:`, `- Returns:`, `- Throws:`,
  `- Note:`, etc.).

## Special cases

- **Be careful with unconstrained polymorphism** (`Any`, `AnyObject`,
  unconstrained generics) — an overload set that looks unambiguous can
  collapse when a generic parameter resolves to `Any` (e.g. `append(_:)` vs
  `append<S: Sequence>(_:)` becomes ambiguous once `Element == Any`, since a
  single `Any` element and a sequence of `Any` elements look alike). Name
  the second overload explicitly (`append(contentsOf:)`) to remove the
  ambiguity — writing the doc comment first often surfaces exactly this kind
  of issue.
