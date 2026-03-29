# Requirements — Personal Productivity OS (v2)

This document covers the *technical* requirements: stack, constraints, non-functional expectations, and project standards.
For features (what the app does), see `features.md`.
For architecture and service design, see `architecture.md`.
For the database schema, see `data-model.md`.
For the phased build plan, see `build-order.md`.

---

## IMPORTANT: Learning-First Development

> **This is a learning project as much as a product.** Every implementation step must be explained clearly. The goal is not just to ship — it is to understand every decision made along the way.

### Rules for how we build

1. **Explain before writing code.** Before implementing any feature, briefly explain:
   - What we are building and why
   - What new concept, pattern, or tool is being introduced
   - How it fits into the broader architecture

2. **Annotate non-obvious code.** Any code that uses a new SvelteKit pattern, TypeScript feature, Drizzle query, or Supabase API must include a comment or explanation. Do not assume prior knowledge.

3. **Highlight important integrations.** When we wire up Telegram webhooks, set up Drizzle migrations, configure Vercel AI SDK, or connect Trigger.dev cron jobs — these are significant milestones. Flag them clearly and explain what is happening under the hood.

4. **Explain tradeoffs when they arise.** If there are two ways to do something, note both and explain why we picked one over the other. This is how engineers develop judgment.

5. **Unique or clever solutions get called out.** If we implement something non-standard (e.g., the Telegram conversation state machine, the streak calculation algorithm, the IST-aware cron), explain the reasoning in detail.

6. **Never copy-paste without understanding.** If a library requires boilerplate, explain what each part does. No magic.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend + Backend | SvelteKit | Latest |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| Icons | lucide-svelte | Latest |
| Charts | recharts (via svelte-recharts or direct) | Latest |
| ORM | Drizzle ORM | Latest |
| Database | PostgreSQL via Supabase | - |
| AI | Vercel AI SDK + Anthropic Claude | Latest |
| Messaging | Telegram Bot API (webhook mode) | - |
| Background Jobs | Trigger.dev | Latest |
| Deployment | Vercel (SvelteKit adapter) | - |
| PWA | vite-plugin-pwa | Latest |

### Why this stack? (reference)
- **SvelteKit over React**: Compile-time reactivity (no virtual DOM), full-stack in one framework, significantly less boilerplate. Svelte's mental model is closer to HTML/CSS/JS than React's abstraction layer — easier to reason about.
- **Drizzle over Prisma**: TypeScript-first schema (no `.prisma` file), no runtime client overhead, generates readable SQL, faster queries. Teaches you more about the database layer.
- **Supabase**: PostgreSQL + realtime subscriptions + Auth in one hosted service. Realtime means Telegram-created tasks appear on the dashboard instantly without polling.
- **Vercel AI SDK**: Provider-agnostic abstraction — swap Claude for GPT-4o without rewriting integration code. Handles streaming, tool use, and error handling.
- **Trigger.dev**: Cron jobs and background tasks that work with serverless deployments. Vercel functions can't run continuously, so Trigger.dev calls our API endpoints on schedule.
- **Telegram over WhatsApp**: Telegram Bot API is free, instant, and fully programmable. WhatsApp Business API requires Meta approval and costs per message.

---

## Design System

### Colors (CSS variables in app.css)
| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#0c0c0f` | Page background |
| `--bg-card` | `#161620` | Card / panel background |
| `--border` | `#1e1e2e` | All borders |
| `--text-primary` | `#e2e2e8` | Main text |
| `--text-muted` | `#6b6b7a` | Secondary / meta text |

### Fonts
```html
<!-- in app.html <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
```
- **DM Mono** — UI chrome, labels, inputs, meta text, code
- **Space Grotesk** — Headings, tab labels, display text

### Area Color Classes
Each area maps to a Tailwind color. Used for: borders, badges, chart bars, focus rings.
| Area | Tailwind base color |
|---|---|
| job (Lumeglobal) | `blue` |
| getfly | `purple` |
| mirai | `green` |
| vamoss | `orange` |
| fitness | `rose` |
| personal | `amber` |

---

## Project Structure (SvelteKit)

```
planner/
├── src/
│   ├── app.html                    — HTML shell (fonts, meta)
│   ├── app.css                     — Global styles, CSS variables
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts           — Drizzle table definitions
│   │   │   └── index.ts            — DB connection (server-only)
│   │   ├── server/
│   │   │   ├── ai.ts               — Claude / Vercel AI SDK wrapper
│   │   │   ├── telegram.ts         — Telegram Bot API client
│   │   │   └── notifications.ts    — Notification dispatch logic
│   │   ├── constants/
│   │   │   ├── areas.ts            — Area definitions (key, label, emoji, color)
│   │   │   ├── defaults.ts         — Default schedule, MVD hints, starter habits
│   │   │   └── healthTips.ts       — Curated health tip cards
│   │   └── utils/
│   │       ├── streaks.ts          — Streak calculation helpers
│   │       ├── dates.ts            — IST-aware date helpers
│   │       └── stats.ts            — Weekly stats computation
│   ├── routes/
│   │   ├── +layout.svelte          — NavBar, global layout wrapper
│   │   ├── +layout.server.ts       — Load user session, today's data
│   │   ├── today/
│   │   │   ├── +page.svelte        — Today view
│   │   │   └── +page.server.ts     — Load today's day row, tasks, events
│   │   ├── week/
│   │   │   ├── +page.svelte        — Week view
│   │   │   └── +page.server.ts     — Load full week data
│   │   ├── habits/
│   │   │   ├── +page.svelte        — Habits view
│   │   │   └── +page.server.ts     — Load habits + logs for week
│   │   ├── stats/
│   │   │   ├── +page.svelte        — Stats view
│   │   │   └── +page.server.ts     — Aggregate weekly stats
│   │   └── api/
│   │       ├── telegram/
│   │       │   └── +server.ts      — Telegram webhook receiver (POST)
│   │       ├── tasks/
│   │       │   └── +server.ts      — Task CRUD API
│   │       ├── events/
│   │       │   └── +server.ts      — Event CRUD API
│   │       └── ai/
│   │           └── briefing/
│   │               └── +server.ts  — AI daily briefing generation
├── trigger/
│   └── jobs/
│       ├── morningBriefing.ts      — 8am IST cron
│       ├── eventReminders.ts       — Every-minute reminder check
│       ├── habitReminders.ts       — 9pm IST cron
│       └── weeklyReview.ts         — Sunday 7pm IST cron
├── drizzle/
│   └── migrations/                 — Auto-generated migration files
├── drizzle.config.ts               — Drizzle Kit config
├── svelte.config.js                — SvelteKit config (Vercel adapter)
├── vite.config.ts                  — Vite + PWA plugin config
└── .env                            — Environment variables (never committed)
```

---

## Non-Functional Requirements

### Performance
- Today view initial load: < 500ms (server-side rendered)
- Task add / complete: optimistic UI update (no wait for server response)
- AI briefing: non-blocking (loads asynchronously, skeleton shown while generating)

### Reliability
- Telegram webhook failures: Telegram retries for 24h — idempotency keys on all writes
- AI failures: graceful fallback ("Briefing unavailable — have a great day")
- DB connection errors: shown as user-facing error with retry option

### Timezone
- All times stored as UTC in PostgreSQL
- All display times converted to IST (Asia/Kolkata, UTC+5:30) in the UI
- All cron schedules defined in IST
- A `dates.ts` utility handles all conversions consistently

### Security
- Telegram webhook endpoint verifies `X-Telegram-Bot-Api-Secret-Token` header
- API routes are server-only — never expose `DATABASE_URL` or `ANTHROPIC_API_KEY` to the client
- Environment variables accessed only via `$env/static/private` (SvelteKit's safe server-only env)
- No user auth in v1 (single user) — a hardcoded user ID is used

### Scalability (future-proofing)
- Multi-user ready: every table has a `user_id` column
- Auth scaffolding in place (Supabase Auth) but not activated in v1
- AI provider abstraction: adding OpenAI or Gemini requires only a new provider config, not code changes

### Accessibility
- Every emoji is paired with a visible text label
- Color is never the only signal (always paired with text or icon)
- Keyboard navigable (tab through all interactive elements)
- Focus rings visible on all inputs

---

## Environment Variables

```bash
# Database (Supabase)
DATABASE_URL=                    # PostgreSQL connection string
SUPABASE_URL=                    # Supabase project URL
SUPABASE_ANON_KEY=               # Public key (safe for client)
SUPABASE_SERVICE_ROLE_KEY=       # Secret key (server-only, never expose)

# Telegram
TELEGRAM_BOT_TOKEN=              # From @BotFather
TELEGRAM_WEBHOOK_SECRET=         # Random string — verified on each webhook call

# AI
ANTHROPIC_API_KEY=               # Claude API key

# Trigger.dev
TRIGGER_SECRET_KEY=              # From Trigger.dev dashboard

# App
PUBLIC_APP_URL=                  # Full URL (e.g. https://planner.vercel.app)
TIMEZONE=Asia/Kolkata            # Used in cron scheduling and display
```

---

## Constraints

- No localStorage or sessionStorage — all state in the database
- No CSS files separate from Tailwind — all styling via utility classes + `app.css` for variables
- No React — this is SvelteKit only
- No client-side secrets — all API keys server-only
- Single user in v1 — no login screen, no multi-tenancy (but schema supports it)
- Telegram only for messaging in v1 — WhatsApp is future scope
- Manual sleep logging only in v1 — no wearable/health app integration yet

---

## References

| Doc | Purpose |
|---|---|
| `features.md` | Complete feature list — what the app does |
| `architecture.md` | Stack decisions, service diagram, Telegram state machine |
| `data-model.md` | Database schema, all tables and columns |
| `build-order.md` | Phased build plan, ~60 tasks across 10 phases |
