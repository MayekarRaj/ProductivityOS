Create structured dev documentation for a new task or feature.

## Usage
```
/dev-docs <task-name>
```
Example: `/dev-docs scaffold-sveltekit-project`

## What This Does

Creates a three-file dev doc set in `dev/active/<task-name>/`:
1. `<task-name>-plan.md` — Strategic plan with phases and acceptance criteria
2. `<task-name>-context.md` — Key decisions, important files, session progress
3. `<task-name>-tasks.md` — Checklist for tracking progress

These files survive context resets — Claude reads them to resume work instantly.

## Instructions for Claude

When this command is invoked:

1. **Understand the task** from the argument (e.g. "scaffold-sveltekit-project")
2. **Check** `docs/build-order.md` for the relevant phase details
3. **Check** `docs/requirements.md`, `docs/architecture.md`, `docs/data-model.md` for context
4. **Create the directory**: `dev/active/<task-name>/`
5. **Write three files**:

### plan.md structure
```markdown
# <Task Name> — Implementation Plan

## What We're Building
[1-2 sentences]

## Why This Matters
[learning value + product value]

## New Concepts Introduced
[list any new patterns/tools this task introduces — SvelteKit, Drizzle, etc.]

## Implementation Phases

### Phase 1: [Name] — Est. [time]
- [ ] Task 1.1 — Description
  - Acceptance: [what done looks like]
- [ ] Task 1.2 — Description
  - Acceptance: [what done looks like]

### Phase 2: [Name]
...

## Files Touched
[list files that will be created or modified]

## Key Decisions to Make
[any choices that need user input before starting]
```

### context.md structure
```markdown
# <Task Name> — Context

## SESSION PROGRESS
Last updated: [date]

### ✅ COMPLETED
[nothing yet]

### 🟡 IN PROGRESS
[what to start with]

### ⚠️ BLOCKERS / QUESTIONS
[anything unclear]

## Key Files
[list files relevant to this task with one-line descriptions]

## Important Decisions Made
[empty to start]

## Quick Resume Instructions
1. Read this file
2. Check tasks.md for current status
3. Continue from the IN PROGRESS item above
```

### tasks.md structure
```markdown
# <Task Name> — Task Checklist

## Phase 1: [Name] ⏳ NOT STARTED
- [ ] Task 1.1
- [ ] Task 1.2

## Phase 2: [Name] ⏳ NOT STARTED
- [ ] Task 2.1
```

6. **Confirm** to the user what was created and which task to start with.
