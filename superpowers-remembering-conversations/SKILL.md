---
name: Remembering Conversations
description: Search previous Claude Code conversations for facts, patterns, decisions, and context using semantic or text search
when_to_use: when partner mentions past discussions, debugging familiar issues, or seeking historical context about decisions and patterns
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

# Remembering Conversations

Search archived conversations using semantic similarity or exact text matching.

**Core principle:** Search before reinventing.

**Announce:** "I'm searching previous conversations for [topic]."

**Setup:** See INDEXING.md

## When to Use

**Search when:**
- Your human partner mentions "we discussed this before"
- Debugging similar issues
- Looking for architectural decisions or patterns
- Before implementing something familiar

**Don't search when:**
- Info in current conversation
- Question about current codebase (use Grep/Read)

## In-Session Use

**Always use subagents** (50-100x context savings). See superpowers-using-skills for workflow.

**Manual/CLI use:** Direct search (below) for humans outside Claude Code sessions.

## Direct Search (Manual/CLI)

**Tool:** `superpowers-remembering-conversations/tool/search-conversations`

**Modes:**
```bash
search-conversations "query"              # Vector similarity (default)
search-conversations --text "exact"       # Exact string match
search-conversations --both "query"       # Both modes
```

**Flags:**
```bash
--after YYYY-MM-DD    # Filter by date
--before YYYY-MM-DD   # Filter by date
--limit N             # Max results (default: 10)
--help                # Full usage
```

**Examples:**
```bash
# Semantic search
search-conversations "React Router authentication errors"

# Find git SHA
search-conversations --text "a1b2c3d4"

# Time range
search-conversations --after 2025-09-01 "refactoring"
```

Returns: project, date, conversation summary, matched exchange, similarity %, file path.

**For details:** Run `search-conversations --help`
