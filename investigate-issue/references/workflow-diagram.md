# investigate-issue — Workflow Diagram

The full flow of `SKILL.md`, as agreed in the skill specification.

```mermaid
flowchart TD
    A["Invoke: 'Investigate issue #N'"] --> B["Step 1 — Understand the issue<br/>gh: fetch title, body, comments, labels<br/>Restate the problem in 1–2 sentences"]
    B --> C{"Issue exists<br/>and is open?"}
    C -- "No / closed" --> C1["Report state and STOP<br/>(no code changes)"]
    C -- "Yes" --> D["Step 2 — Check linked PRs<br/>(GraphQL: closedByPullRequestsReferences)"]

    D --> E{"Open linked<br/>PR exists?"}

    %% Branch A — PR exists
    E -- "Yes" --> F["Branch A — Review the PR<br/>Diff vs. issue requirements<br/>Cover every changed file"]
    F --> G["Full review report in CHAT ONLY<br/>(nothing posted to GitHub)"]
    G --> H{"User explicitly insists<br/>on continuing to fix?"}
    H -- "No (default)" --> I["Done — review report delivered"]
    H -- "Yes" --> K

    %% Merged/closed PR flag
    E -- "No, but a merged/closed<br/>linked PR exists" --> J["Flag: issue may be stale"] --> K
    E -- "No linked PR at all" --> K

    %% Branch B — assignee gate
    K{"Step 4 — Assignee?"}
    K -- "Assigned to ME<br/>(authenticated gh user)" --> M
    K -- "Unassigned" --> M
    K -- "Assigned to SOMEONE ELSE" --> L{"User explicitly<br/>confirms proceed?"}
    L -- "No" --> L1["STOP — report assignee status"]
    L -- "Yes" --> M

    %% Classification
    M{"Step 5 — Classify the issue"}
    M -- "Bug" --> N["Delegate to fix-bug skill<br/>graph query → minimal fix<br/>→ branch → commit"]
    M -- "Feature" --> O{"Issue description<br/>sufficient as spec?"}
    M -- "Neither<br/>(question / discussion)" --> P["Report findings — no code changes"]

    O -- "No" --> Q["Ask targeted questions<br/>(clarification protocol)"] --> O
    O -- "Yes" --> R["Delegate to plan-feature skill<br/>graph queries → structured plan<br/>(no implementation code)"]

    N --> S["Open PR with 'Fixes #N'<br/>(never merge, never close the issue)"]
    R --> R1["Post plan on the EXISTING issue<br/>as a comment (no new issue)"]
    S --> T["Step 7 — Report back in chat<br/>PR URL or plan link, issue state,<br/>assignee status, confidence"]
    R1 --> T

    %% Multiple PRs edge case
    F -.multiple open linked PRs.-> F2["Review most recently updated,<br/>list the others in the report"]
```

## Guardrails (apply everywhere)

- Never merges a PR, never closes the issue, never pushes to main.
- Review reports go to chat only — nothing is posted to GitHub in Branch A.
- No code work while an open linked PR exists or another person's
  assignment is unconfirmed.
- Never creates a new issue — the feature plan is a comment on the
  existing one.
