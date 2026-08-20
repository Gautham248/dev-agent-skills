---
name: swiftui-app-conventions
description: >
  SwiftUI app-architecture conventions — state ownership rules
  (@State/@Binding/@Environment/@Bindable), where dependencies and services
  live, feature-based vs type-based file organization, and the ViewModel
  question — grounded in Apple's official documentation, WWDC24 "SwiftUI
  essentials", and the StateObject/Observable symbol references, fetched
  and read directly while writing this skill. The
  ViewModel-vs-direct-@Observable-binding question is presented as a
  genuine, still-debated design choice, not settled Apple doctrine — see
  the dedicated section below. Use when structuring a new SwiftUI app,
  deciding where a piece of state or a dependency should live, organizing
  view/model files, or reviewing a screen's state-ownership design. Layers
  on top of swift-conventions (language idiom) and, when relevant,
  cloudkit-conventions (sync/service layer) — doesn't replace either.
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

# SwiftUI app conventions

This is the layer above language idiom (`swift-conventions`) and below any
specific framework's data layer (`cloudkit-conventions`, etc.): where state
lives, how dependencies get to the views that need them, and how the
project is organized. Property-wrapper *mechanics* (`@Observable`,
`@ObservationIgnored`, `withObservationTracking`) are covered in
`swift-conventions`'s Observation section — this skill is about
*architecture*: which wrapper owns a given piece of state and why.

## State ownership — the rules that are actually settled

These follow directly from how SwiftUI's dependency tracking works, not
from a particular architectural taste:

- **Every piece of state has exactly one owner.** `@State` marks where a
  value's storage actually lives; everything else referencing that value
  should be a `@Binding` (a reference to the owner's storage) or a read of
  an `@Environment`/`@Bindable` value, never a second `@State` holding a
  copy that has to be kept in sync by hand. Two state variables that must
  agree with each other and are updated separately is the state-ownership
  bug to watch for in review.
- **`@State` for view-owned data — value types, or an `@Observable`
  reference type this view creates and owns.** If a parent needs to read or
  write it too, pass a `@Binding` down; don't reach for `@Environment` just
  to avoid threading one binding through one layer.
- **`@Environment`/`.environment(_:)` for ambient, app-wide dependencies** —
  the current user's session, a shared service instance, app-wide settings
  — things many unrelated views need without a common parent explicitly
  passing them down. `@Bindable` is the write-access counterpart when a
  view needs two-way binding into an environment-injected `@Observable`
  value (a form editing fields on the injected model, for instance).
- **An object marked `@State` (or the pre-Observation `@StateObject`) is
  created exactly once per the lifetime of the view identity that declares
  it** — confirmed against the official `StateObject` reference: SwiftUI
  does *not* recreate it when the view's input parameters change, only when
  the view's *identity* changes. The classic bug this causes: initializing
  that object's state from a parameter passed into the view's initializer,
  then being surprised the object doesn't update when the parent passes a
  different value later. If the object's data genuinely needs to track an
  input parameter over time, that's a signal the parameter should flow in
  as a binding/environment read instead of a one-time init argument, or the
  view needs an explicit `.onChange`/`.task(id:)` to react to it.

## Where dependencies and services live

- Long-lived services (a sync coordinator, a networking client, a data
  store) get created once — typically at the app root — and handed down via
  `.environment(_:)`, not re-instantiated inside individual views or
  passed through a long, manually-threaded chain of initializer parameters.
- Views should receive the dependencies they need (via environment or
  initializer) rather than reaching out to a global singleton directly
  inside their body — this is what keeps a view previewable and testable
  with a fake/fixture implementation instead of the real service.
- Keep `#Preview` blocks working with injectable, fixture-backed
  dependencies rather than the live service (a real `CloudKitService` that
  needs an actual iCloud account, a real network client) — if a view can't
  be previewed without live infrastructure, that's usually a sign its
  dependencies aren't injected cleanly.

## File organization

- **Group by feature first, by type only within a feature** — a `Screens/`
  or feature folder containing that feature's views, and type-based
  top-level folders (`Models/`, `Services/`, `Components/`, `Theme/`) for
  code genuinely shared *across* features. This is a hybrid, not pure
  feature-based or pure type-based, and that's fine — pure type-based
  organization (a global `Views/` folder with every screen in the app
  dumped in flat) is the one to avoid, since it stops scaling once the app
  has more than a handful of screens.
- Shared UI building blocks (design-system components, reusable pickers)
  belong in their own folder, distinct from screen-specific views that
  compose them — a component used by exactly one screen doesn't need to
  live in the shared folder just because it's visually reusable in theory.

## The ViewModel question — a genuine design choice, not settled doctrine

This is worth being honest about rather than asserting a house rule as if
it were Apple orthodoxy: **whether every non-trivial SwiftUI screen needs a
dedicated ViewModel object is actively debated**, and the two sides don't
agree on what Apple's own guidance implies.

- One side (sometimes called the "MV pattern," a community label, not an
  Apple one) points to Apple's own sample apps and several WWDC sessions
  binding views **directly** to `@Observable` model types with no
  intermediate ViewModel layer for straightforward cases — this is real and
  officially demonstrated, not a misreading.
- The other side points out Apple has never said not to use ViewModels
  either — `@StateObject` exists specifically to support that pattern, WWDC
  sessions as recent as 2024–2025 still use "view model" terminology, and a
  ViewModel with no UI-framework imports is easier to unit-test in
  isolation than logic embedded in a view's body.
- **Both are legitimate.** The actual anti-pattern is inconsistency —
  some screens with a ViewModel, others reaching straight into an
  `@Observable` model, with no discernible rule for which gets which. Pick
  one default for the project (direct-binding for straightforward
  data-display/data-entry screens; a dedicated object once a screen's logic
  is complex enough to want independent unit tests — validation rules,
  multi-step flows, derived state that doesn't map 1:1 to the model) and
  apply it consistently, rather than deciding screen-by-screen on
  instinct.
- If the project already has an established pattern (check for an existing
  central coordinator like an `AppState` type, or an existing ViewModel
  convention elsewhere in the codebase) — match it. Introducing a second
  pattern alongside an existing one is worse than either pattern alone.

## Navigation

- Prefer `NavigationStack` with a value-based path (`NavigationPath` or a
  typed array driving `navigationDestination(for:)`) over nested
  `NavigationLink`s with implicit, hard-to-inspect navigation state — a
  path you can read, mutate, and reset from code is what makes
  programmatic navigation (deep links, "pop to root," restoring state)
  tractable.

## If something goes wrong

Before improvising a fix or contradicting something stated here, check
`references/edge-cases.md` — this may already be a documented, resolved
question. If it's genuinely new once you're done, follow the
self-improvement protocol above and add it there.
