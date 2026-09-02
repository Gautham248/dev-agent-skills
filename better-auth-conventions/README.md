# better-auth-conventions

An Agent Skill that gives a coding agent a sane baseline for working with
**Better Auth** — grounded in the official documentation
(`better-auth.com/docs`), fetched and read directly while writing this
skill, not recalled from training data alone.

It covers the plugin config/schema-migration pairing, session and
cookie-cache tradeoffs (including the "revocation isn't instant with
caching on" gotcha), social sign-on with a specific focus on the native-iOS
Apple Sign-In audience mismatch (`appBundleIdentifier` vs. Service ID
`clientId`), email OTP's timing-attack-avoidance rule, and the distinction
between the Bearer and JWT plugins.

## Who it's for

Anyone writing or reviewing backend auth config, sign-in/sign-up flows, or
social-provider setup that uses Better Auth — particularly useful for a
mixed native-app + web-backend project, since the Apple Sign-In section
covers exactly that boundary.

## What it is

A single `SKILL.md` of guidance — no script. Point your agent at it while
it writes or reviews Better Auth config or auth flows; it will catch the
plugin/client pairing gap, the cookie-cache revocation tradeoff, and the
native Apple `aud` claim mismatch before they ship as bugs.

## Install

Follows the open [Agent Skills](https://agentskills.io) layout. Drop the
`better-auth-conventions/` folder into your agent's skills directory, same
as any other skill in this repo — see the root `README.md` for per-agent
paths.

## Usage

> Review this auth.ts config — did we wire the plugin's client half too?

> Set up Apple Sign-In for the iOS app talking to this Better Auth backend.

> Does this OTP handler avoid the timing-attack pitfall?

## License

See the repository this skill ships in.
