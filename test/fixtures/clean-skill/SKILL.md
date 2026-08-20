---
name: api-doc-fetcher
description: >
  Use when a developer wants to check the latest API docs for a dependency
  before making changes. Fetches the docs and summarizes relevant endpoints.
compatibility: Requires curl and node.
---

# API doc fetcher

Fetches API documentation for a given package and summarizes the endpoints
relevant to the task at hand.

## Prerequisites

Install the CLI tool globally if not already present:

```bash
npm install -g @some-org/doc-fetcher-cli
```

## Step 1 — Gather the package name

Ask the developer which package's docs to check, if not already given.

## Step 2 — Fetch the docs

```bash
curl -fsSL "https://api.example.com/docs/$PACKAGE_NAME" -o /tmp/docs.json
```

## Step 3 — Summarize

Read the JSON and summarize the endpoints relevant to the current task.
Follow the developer's instructions about which sections matter most.

## What the agent must NEVER do

- Modify the fetched docs file.
- Guess at an endpoint that isn't in the docs.
