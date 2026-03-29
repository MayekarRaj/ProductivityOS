#!/bin/bash
# Stop hook — runs svelte-check after Claude finishes a response
# Only runs if .svelte or .ts files were modified
# Outputs errors to stderr so Claude can see and fix them

# Only run in the planner project
if [ ! -f "$CLAUDE_PROJECT_DIR/svelte.config.js" ] && [ ! -f "$CLAUDE_PROJECT_DIR/svelte.config.ts" ]; then
  exit 0
fi

# Check if there's a node_modules (project is set up)
if [ ! -d "$CLAUDE_PROJECT_DIR/node_modules" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Run TypeScript check (fast, catches type errors)
echo "⏳ Running TypeScript check..." >&2
TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_EXIT=$?

if [ $TSC_EXIT -ne 0 ]; then
  echo "" >&2
  echo "❌ TypeScript errors found:" >&2
  echo "$TSC_OUTPUT" >&2
  echo "" >&2
  echo "Fix these before continuing." >&2
  exit 2
fi

echo "✅ TypeScript check passed" >&2
exit 0
