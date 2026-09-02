# swiftui-app-conventions

An Agent Skill that gives a coding agent a sane baseline for **SwiftUI app
architecture** — where state should live, how dependencies get to the views
that need them, and how a project should be organized. Grounded in Apple's
official documentation, WWDC24 "SwiftUI essentials", and the
`StateObject`/`Observable` symbol references, fetched and read directly
while writing this skill.

It covers the settled parts (single ownership per piece of state,
`@State`/`@Binding`/`@Environment`/`@Bindable` roles, the
create-once-per-view-identity rule for state objects — confirmed against
the official reference, not assumed) and is explicit about the one genuinely
contested part: whether every screen needs a dedicated ViewModel. That
question is presented as a real, still-debated design choice with legitimate
arguments on both sides, not settled Apple doctrine dressed up as a rule.

## Who it's for

Anyone structuring a new SwiftUI app, deciding where a piece of state or a
dependency belongs, organizing view/model files, or reviewing a screen's
state-ownership design. Sits above `swift-conventions` (language idiom —
property-wrapper mechanics live there) and works alongside
framework-specific skills like `cloudkit-conventions` for the data/sync
layer underneath the views.

## What it is

A single `SKILL.md` of guidance — no script.

## Install

Follows the open [Agent Skills](https://agentskills.io) layout. Drop the
`swiftui-app-conventions/` folder into your agent's skills directory, same
as any other skill in this repo — see the root `README.md` for per-agent
paths.

## Usage

> Where should this shared CloudKit service live — environment, or passed into each view?

> Review this screen's state — is anything duplicated that should be a binding instead?

> Should this new feature get a ViewModel, or bind directly to the model?

## License

See the repository this skill ships in.
