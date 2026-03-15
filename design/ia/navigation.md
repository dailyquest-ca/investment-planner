# Finpath Navigation

## Purpose

This document is the repository-level source of truth for top-level navigation and workflow boundaries.

Use it when changing:
- routes
- top navigation labels
- planner section grouping
- dashboard / plan / track / settings responsibilities

## Top-level structure

- `Dashboard`
  - Landing view
  - Shows current snapshot, key milestones, and quick entry into primary workflows
- `Plan`
  - Sandbox modeling workflow
  - Users change assumptions, compare futures, and optimize outcomes
- `Track`
  - Actual-progress workflow
  - Users record real balances and compare actual progress against the chosen plan
- `Settings`
  - Preferences, sync, defaults, region/profile choices, and non-workflow configuration

## Route map

- `/` → `Dashboard`
- `/plan` → `Plan`
- `/track` → `Track`
- `/settings` → `Settings`

## Workflow boundaries

### Dashboard

- Summary-first
- Should not become a second planner
- Can link into `Plan` and `Track`

### Plan

- Primary job: model possible futures
- Keep results visible while editing assumptions
- Organize inputs by user task, not raw data structure
- Current planner sections:
  - `Budget`
  - `Housing`
  - `Investments`
  - `Retirement`

### Track

- Primary job: show actual progress and adherence to the selected plan
- Should use actual/historical data, not just scenario assumptions
- Future tracking features should live here before being added elsewhere

### Settings

- Holds preferences and defaults that affect the app globally
- Do not bury settings inside planner panels unless they are truly workflow-specific

## Naming guidance

- Use concise noun-based labels in navigation.
- Keep labels consistent across nav, page headings, and links.
- Preferred top-level labels for this repo:
  - `Dashboard`
  - `Plan`
  - `Track`
  - `Settings`

## Guardrails

- Do not merge `Plan` and `Track` back into one long page.
- Do not add new top-level sections casually; prefer fitting work into the existing shell first.
- If a new feature changes the app's information architecture, update this document and any affected project rules in the same task.
