# Architecture

## Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend + Backend | SvelteKit + TypeScript | Compile-time reactivity, full-stack in one framework, file-based routing, SSR out of the box |
| Styling | Tailwind CSS | Utility-first, no separate CSS files, consistent design tokens |
| ORM | Drizzle ORM | TypeScript-first, zero overhead, SQL-like query builder, great migrations |
| Database | PostgreSQL via Supabase | Managed Postgres + realtime subscriptions + Auth (future) + generous free tier |
| AI | Vercel AI SDK + Claude (Anthropic) | Provider-agnostic abstraction, streaming support, easy to swap providers |
| Messaging | Telegram Bot API (webhook mode) | Free, instant setup, two-way, works on serverless |
| Background Jobs | Trigger.dev | Cron jobs + event-driven tasks, works with Vercel serverless, free tier |
| Deployment | Vercel | Native SvelteKit adapter, serverless functions, preview environments |
| PWA | vite-plugin-pwa | Offline support, installable on mobile |

---

## Service Architecture

```
┌─────────────────────────────────────────────────────┐
│                    User's Browser                    │
│              SvelteKit App (PWA)                     │
│         Svelte components + Tailwind                 │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS (fetch / form actions)
┌──────────────────────▼──────────────────────────────┐
│                 Vercel (SvelteKit)                   │
│                                                      │
│  ┌─────────────────┐   ┌──────────────────────────┐ │
│  │  Page Routes    │   │  API Routes (+server.ts)  │ │
│  │  /today         │   │  POST /api/telegram       │ │
│  │  /week          │   │  POST /api/ai/parse       │ │
│  │  /habits        │   │  GET  /api/days           │ │
│  │  /stats         │   │  POST /api/tasks          │ │
│  └─────────────────┘   │  POST /api/events         │ │
│                        │  ...                       │ │
│                        └──────────────┬─────────────┘ │
└─────────────────────────────────────┬─┘
                    │                 │
       ┌────────────▼───┐   ┌─────────▼──────────┐
       │   Supabase     │   │   Anthropic API     │
       │  PostgreSQL    │   │   (Claude)          │
       │  + Realtime    │   │   via Vercel AI SDK │
       └────────────────┘   └────────────────────┘
                    │
       ┌────────────▼───────────────────────────────┐
       │              Trigger.dev                    │
       │                                             │
       │  ┌──────────────┐  ┌─────────────────────┐ │
       │  │ Cron: 8am IST│  │ Cron: every minute  │ │
       │  │ Morning      │  │ Check pending        │ │
       │  │ briefing     │  │ event reminders      │ │
       │  └──────────────┘  └─────────────────────┘ │
       │  ┌──────────────┐  ┌─────────────────────┐ │
       │  │ Cron: 9pm IST│  │ Cron: Sun 7pm IST   │ │
       │  │ Habit        │  │ Weekly review        │ │
       │  │ reminders    │  │ prompt               │ │
       │  └──────────────┘  └─────────────────────┘ │
       └───────────────────────┬────────────────────┘
                               │
               ┌───────────────▼────────────────┐
               │         Telegram Bot API        │
               │   Sends messages to your phone  │
               │   Receives your replies via     │
               │   webhook → /api/telegram       │
               └─────────────────────────────────┘
```

---

## Data Flow: Telegram Message → Dashboard

```
You type "schedule a meeting with Getfly team at 5pm tomorrow"
        │
        ▼
Telegram Bot API
        │ webhook POST
        ▼
/api/telegram (SvelteKit server route)
        │
        ├─ Look up user by telegram_chat_id
        ├─ Load conversation state from DB (telegram_conversations table)
        │
        ▼
Claude AI (via Vercel AI SDK)
  System prompt: "You are a productivity assistant. Extract intent and data."
  Input: message + conversation history + current state
  Output: { intent: "create_event", data: { title: "Getfly team meeting", starts_at: "...", remind_at: "..." } }
        │
        ▼
SvelteKit API route
  - Creates event in DB
  - Sets remind_at = starts_at - 5 minutes
  - Responds to Telegram: "Got it! Meeting added for tomorrow at 5pm. I'll remind you at 4:55pm."
        │
        ▼
Supabase Realtime
  - DB change triggers realtime event
  - Browser receives event
  - Dashboard updates live (new event appears)
```

---

## Data Flow: Reminder Notification

```
Trigger.dev cron (every minute, IST-aware)
        │
        ▼
Query: SELECT events WHERE remind_at <= NOW() AND reminded = false
        │
  ┌─────┴──────┐
  │  For each  │
  │   event    │
  └─────┬──────┘
        │
        ▼
Telegram Bot API
  Sends: "⏰ Reminder: Getfly team meeting in 5 minutes"
        │
        ▼
Update events SET reminded = true WHERE id = ...
```

---

## Telegram Conversation State Machine

Telegram messages go through a state machine to handle multi-turn conversations:

```
         ┌──────┐
    ┌────►│ IDLE │◄────────────────────┐
    │    └──┬───┘                      │
    │       │ user sends message       │
    │       ▼                          │
    │   AI classifies intent           │
    │       │                          │
    │  ┌────┴──────────────────────┐   │
    │  │                           │   │
    │  ▼                           ▼   │
    │ CREATE_TASK            CREATE_EVENT
    │  │                           │   │
    │  │ "what day?"         "what time?" (if missing)
    │  │                           │   │
    │  ▼                           ▼   │
    │ AWAITING_DATE        AWAITING_TIME
    │  │                           │   │
    │  └──────────┬────────────────┘   │
    │             │ all data collected  │
    │             ▼                    │
    │       Save to DB                 │
    │       Confirm to user            │
    └──────────────────────────────────┘
```

Conversation state is stored in `telegram_conversations` table so it survives server restarts.

---

## Key Architectural Decisions

### Why webhooks over long-polling for Telegram?
Vercel is serverless — no persistent process. Webhooks let Telegram call *us* when a message arrives, which maps perfectly to serverless functions. No always-on server needed.

### Why Supabase Realtime?
When a task is created via Telegram, it should appear on the dashboard immediately without the user refreshing. Supabase streams DB changes to subscribed clients over WebSocket.

### Why Trigger.dev for cron?
Vercel cron jobs require a paid plan and have limited scheduling options. Trigger.dev has a generous free tier, better observability, retry logic, and works by calling our Vercel API endpoints on schedule.

### Why Drizzle over Prisma?
Drizzle is schema-first in TypeScript (no separate `.prisma` file), has no runtime overhead, generates plain SQL you can inspect, and is significantly faster. Prisma is more beginner-friendly but Drizzle teaches you more about the database layer.

### Why not a separate Go backend?
We opted for SvelteKit's server routes to keep the codebase unified and reduce operational complexity. The design keeps business logic in clearly isolated service modules — extracting to Go later is straightforward if needed.

---

## Environment Variables

```bash
# Supabase
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# AI
ANTHROPIC_API_KEY=

# Trigger.dev
TRIGGER_SECRET_KEY=

# App
PUBLIC_APP_URL=
TIMEZONE=Asia/Kolkata
```

---

## Local Development Setup

```
SvelteKit dev server     → http://localhost:5173
Supabase local           → supabase start (Docker)
Telegram webhooks        → ngrok http 5173
                           Set webhook URL via BotFather
Trigger.dev              → trigger dev (local runner)
```
