---
name: Inversion Exercise
description: Flip core assumptions to reveal hidden constraints and alternative approaches - "what if the opposite were true?"
when_to_use: when stuck on unquestioned assumptions or feeling forced into "the only way" to do something
version: 1.1.0
---

<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->
Before doing anything else in this skill, read and follow the clarification protocol at:
/home/gautham/10xMinds/AI-Dev-Agent/dev-agent-skills/CLARIFICATION-PROTOCOL.md
<!-- END dev-agent-skills clarification protocol -->

<!-- BEGIN dev-agent-skills self-improvement protocol (managed by setup.sh -- do not edit this block manually; edit SELF-IMPROVEMENT-PROTOCOL.md instead) -->
While using this skill, and especially when you finish, read and follow the self-improvement protocol at:
/home/gautham/10xMinds/AI-Dev-Agent/dev-agent-skills/SELF-IMPROVEMENT-PROTOCOL.md
(Append real edge cases to this skill's own references/edge-cases.md — create it if missing. See the protocol file for what qualifies.)
<!-- END dev-agent-skills self-improvement protocol -->

# Inversion Exercise

## Overview

Flip every assumption and see what still works. Sometimes the opposite reveals the truth.

**Core principle:** Inversion exposes hidden assumptions and alternative approaches.

## Quick Reference

| Normal Assumption | Inverted | What It Reveals |
|-------------------|----------|-----------------|
| Cache to reduce latency | Add latency to enable caching | Debouncing patterns |
| Pull data when needed | Push data before needed | Prefetching, eager loading |
| Handle errors when occur | Make errors impossible | Type systems, contracts |
| Build features users want | Remove features users don't need | Simplicity >> addition |
| Optimize for common case | Optimize for worst case | Resilience patterns |

## Process

1. **List core assumptions** - What "must" be true?
2. **Invert each systematically** - "What if opposite were true?"
3. **Explore implications** - What would we do differently?
4. **Find valid inversions** - Which actually work somewhere?

## Example

**Problem:** Users complain app is slow

**Normal approach:** Make everything faster (caching, optimization, CDN)

**Inverted:** Make things intentionally slower in some places
- Debounce search (add latency → enable better results)
- Rate limit requests (add friction → prevent abuse)
- Lazy load content (delay → reduce initial load)

**Insight:** Strategic slowness can improve UX

## Red Flags You Need This

- "There's only one way to do this"
- Forcing solution that feels wrong
- Can't articulate why approach is necessary
- "This is just how it's done"

## Remember

- Not all inversions work (test boundaries)
- Valid inversions reveal context-dependence
- Sometimes opposite is the answer
- Question "must be" statements
