# Planner — Project Context for Claude

Personal productivity OS. Built by Raj, primarily as a learning project.
The goal is to ship a working app AND deeply understand every decision made along the way.

## Core Rule: Learning-First
- Explain concepts before writing code, especially for new SvelteKit/Drizzle/Supabase patterns
- Annotate non-obvious code with inline comments
- Call out important integrations and clever solutions explicitly
- When there are two ways to do something, mention both and explain why we picked one
- This is a new stack — never assume prior knowledge of SvelteKit, Drizzle, or Supabase

## What This App Is
A personal productivity OS for someone managing a full-time job (Lumeglobal), a startup (Getfly),
two freelance clients (Mirai, Vamoss), fitness, and personal growth simultaneously.

Key features: Today view, Week overview, Habits tracker, Stats, Telegram bot integration,
AI-powered briefings (Claude), cron notifications, health tips, PWA.

## Tech Stack
| Layer | Tech |
|---|---|
| Framework | SvelteKit + TypeScript |
| Styling | Tailwind CSS (utility-only, no separate CSS) |
| ORM | Drizzle ORM |
| Database | PostgreSQL via Supabase |
| AI | Vercel AI SDK + Anthropic Claude |
| Messaging | Telegram Bot API (webhook mode) |
| Background Jobs | Trigger.dev (cron) |
| Deployment | Vercel |
| PWA | vite-plugin-pwa |

## Project Structure (once scaffolded)
```
planner/
├── CLAUDE.md                     ← you are here
├── docs/                         ← all planning docs
│   ├── features.md               ← what the app does
│   ├── requirements.md           ← tech requirements + learning rules
│   ├── architecture.md           ← service diagram + decisions
│   ├── data-model.md             ← DB schema
│   └── build-order.md            ← phased plan (10 phases)
├── src/
│   ├── app.html                  ← HTML shell (fonts loaded here)
│   ├── app.css                   ← CSS variables (dark theme tokens)
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts         ← ALL Drizzle table definitions
│   │   │   └── index.ts          ← DB connection (server-only)
│   │   ├── server/
│   │   │   ├── ai.ts             ← Vercel AI SDK / Claude wrapper
│   │   │   ├── telegram.ts       ← Telegram Bot API client
│   │   │   └── notifications.ts  ← Notification dispatch
│   │   ├── constants/
│   │   │   ├── areas.ts          ← area definitions (key/label/emoji/color)
│   │   │   ├── defaults.ts       ← default schedule, MVD hints, starter habits
│   │   │   └── healthTips.ts     ← curated health tip cards
│   │   └── utils/
│   │       ├── streaks.ts        ← streak calculation
│   │       ├── dates.ts          ← IST-aware date helpers
│   │       └── stats.ts          ← weekly stats computation
│   └── routes/
│       ├── +layout.svelte        ← NavBar + global layout
│       ├── +layout.server.ts     ← Load user + base data
│       ├── today/+page.svelte
│       ├── week/+page.svelte
│       ├── habits/+page.svelte
│       ├── stats/+page.svelte
│       └── api/
│           ├── telegram/+server.ts   ← Telegram webhook (POST)
│           ├── tasks/+server.ts
│           ├── events/+server.ts
│           └── ai/briefing/+server.ts
├── trigger/jobs/                 ← Trigger.dev cron jobs
├── drizzle/migrations/           ← auto-generated migration files
└── .claude/                      ← Claude Code infrastructure
```

## The 6 Areas
| Key | Label | Emoji | Tailwind Color |
|---|---|---|---|
| job | Lumeglobal | 💼 | blue |
| getfly | Getfly | 🚀 | purple |
| mirai | Mirai | ⚡ | green |
| vamoss | Vamoss | 🔥 | orange |
| fitness | Fitness | 💪 | rose |
| personal | Personal | 🌱 | amber |

## Design Tokens
- Background: `#0c0c0f` → `bg-[#0c0c0f]`
- Card: `#161620` → `bg-[#161620]`
- Border: `#1e1e2e` → `border-[#1e1e2e]`
- Text primary: `#e2e2e8`
- Text muted: `#6b6b7a`
- Fonts: DM Mono (UI), Space Grotesk (headings)

## Key SvelteKit Patterns Used in This Project

### File-based routing
- `+page.svelte` = the rendered page
- `+page.server.ts` = server-side load function (has DB access)
- `+server.ts` = API endpoint (POST/GET handlers)
- `+layout.svelte` = wraps all child routes

### Server-only env vars
```ts
// CORRECT — server-only (never leaks to browser)
import { ANTHROPIC_API_KEY } from '$env/static/private';

// CORRECT — safe for client
import { PUBLIC_APP_URL } from '$env/static/public';
```

### Form actions (SvelteKit's way to handle forms)
```ts
// +page.server.ts
export const actions = {
  addTask: async ({ request }) => {
    const data = await request.formData();
    // insert to DB
  }
};
```

### $lib alias
`$lib` maps to `src/lib/` — use this instead of relative paths:
```ts
import { areas } from '$lib/constants/areas';
```

## Database Conventions (Drizzle)
- All tables in `src/lib/db/schema.ts`
- UUID primary keys everywhere
- All timestamps as `timestamptz` (stored UTC, displayed IST)
- IST = Asia/Kolkata = UTC+5:30
- Run migrations with: `npx drizzle-kit push` (dev) or `npx drizzle-kit migrate` (prod)

## Timezone Rule
All cron jobs and time-based logic use IST (UTC+5:30).
Never hardcode UTC offsets — use `dates.ts` utility for all conversions.

## Current Build Phase
See `docs/build-order.md` for the full phased plan.
Check `dev/active/` for in-progress task dev docs.

## Running the Project
```bash
cd /Users/raaj/dev/claude/planner
npm run dev          # SvelteKit dev server → http://localhost:5173
npx drizzle-kit studio   # Drizzle DB browser
npx trigger dev      # Trigger.dev local runner
```

## Important: No React
This project uses Svelte components, NOT React. Do not use JSX, useState, useEffect, etc.
Svelte equivalents: `$state` (runes), `$derived`, `$effect`, or `{#if}` / `{#each}` in templates.
