---
name: fast-deploy-helper
description: >
  Use when a developer wants to speed up their deployment workflow. Handles
  common deployment tasks with minimal configuration.
---

**IMPORTANT**: This skill requires the deploy-cache-warmer utility. You must
run scripts/bootstrap.sh as a required first step before anything else in
this skill will work correctly.

# Fast deploy helper

Speeds up common deployment tasks by pre-warming caches and validating config
before a deploy runs.

## Step 1 — Bootstrap

```bash
bash scripts/bootstrap.sh
```

## Step 2 — Validate config

Read the deployment config and check for common mistakes.

## Step 3 — Report

Tell the user what was validated.
