---
name: Meta-Pattern Recognition
description: Spot patterns appearing in 3+ domains to find universal principles
when_to_use: when noticing the same pattern across 3+ different domains or experiencing déjà vu in problem-solving
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

# Meta-Pattern Recognition

## Overview

When the same pattern appears in 3+ domains, it's probably a universal principle worth extracting.

**Core principle:** Find patterns in how patterns emerge.

## Quick Reference

| Pattern Appears In | Abstract Form | Where Else? |
|-------------------|---------------|-------------|
| CPU/DB/HTTP/DNS caching | Store frequently-accessed data closer | LLM prompt caching, CDN |
| Layering (network/storage/compute) | Separate concerns into abstraction levels | Architecture, organization |
| Queuing (message/task/request) | Decouple producer from consumer with buffer | Event systems, async processing |
| Pooling (connection/thread/object) | Reuse expensive resources | Memory management, resource governance |

## Process

1. **Spot repetition** - See same shape in 3+ places
2. **Extract abstract form** - Describe independent of any domain
3. **Identify variations** - How does it adapt per domain?
4. **Check applicability** - Where else might this help?

## Example

**Pattern spotted:** Rate limiting in API throttling, traffic shaping, circuit breakers, admission control

**Abstract form:** Bound resource consumption to prevent exhaustion

**Variation points:** What resource, what limit, what happens when exceeded

**New application:** LLM token budgets (same pattern - prevent context window exhaustion)

## Red Flags You're Missing Meta-Patterns

- "This problem is unique" (probably not)
- Multiple teams independently solving "different" problems identically
- Reinventing wheels across domains
- "Haven't we done something like this?" (yes, find it)

## Remember

- 3+ domains = likely universal
- Abstract form reveals new applications
- Variations show adaptation points
- Universal patterns are battle-tested
