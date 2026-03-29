Update dev docs before a context reset or at the end of a session.

## Usage
```
/dev-docs-update
```

## What This Does

Finds the active dev doc in `dev/active/` and updates all three files to reflect current state.
Call this when approaching context limits or wrapping up a work session.

## Instructions for Claude

1. **Find active docs**: `ls dev/active/` — pick the most recently modified task
2. **Check git status**: `git diff --name-only HEAD` or `git status` to see what changed
3. **Update `context.md`**:
   - Update `SESSION PROGRESS` section with today's date
   - Move completed items to ✅ COMPLETED
   - Update 🟡 IN PROGRESS to what's actually in progress
   - Note any new blockers or decisions made
   - Update "Key Files" if new files were created
4. **Update `tasks.md`**:
   - Check boxes for completed tasks `[x]`
   - Update phase status labels (⏳ NOT STARTED → 🟡 IN PROGRESS → ✅ COMPLETE)
   - Add any new tasks discovered during implementation
5. **Update `plan.md`** only if scope changed significantly
6. **Confirm** to the user: "Dev docs updated. Your next session can resume from: [specific task]"

## Good Time to Run This
- Approaching context limit (you'll see a warning)
- End of a coding session
- After completing a full phase
- Before switching to a different task
