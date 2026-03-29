# Build Order

Phased plan. Each phase should be independently usable before moving to the next.
Build one feature at a time. Verify it works before moving on.

---

## Phase 0 — Project Scaffold
*Goal: Empty app that runs locally and connects to the database.*

- [ ] 0.1 — Create new SvelteKit project with TypeScript (`npm create svelte@latest`)
- [ ] 0.2 — Install and configure Tailwind CSS
- [ ] 0.3 — Install Drizzle ORM + `postgres` driver
- [ ] 0.4 — Set up Supabase project, get connection string
- [ ] 0.5 — Write Drizzle schema (`src/lib/db/schema.ts`) — all tables from data-model.md
- [ ] 0.6 — Run first migration (`drizzle-kit push`)
- [ ] 0.7 — Install lucide-svelte, recharts
- [ ] 0.8 — Set up fonts (DM Mono + Space Grotesk via `app.html`)
- [ ] 0.9 — Create base layout: dark background, NavBar with 4 tabs
- [ ] 0.10 — Create placeholder pages: `/today`, `/week`, `/habits`, `/stats`
- [ ] 0.11 — Set up `src/lib/constants/areas.ts` (area definitions)
- [ ] 0.12 — Set up `src/lib/constants/defaults.ts` (MVD hints, default schedule, starter habits)

**Done when:** App loads, tabs navigate, DB connection works, areas/defaults accessible everywhere.

---

## Phase 1 — Today View (Core Loop)
*Goal: You can plan and track your day entirely in the web app.*

- [x] 1.1 — Auto-create `days` row for today on page load (with default home base)
- [x] 1.2 — Display: day name, date, home base badge
- [x] 1.3 — Energy check-in (emoji selector, saves to `days.energy`)
- [x] 1.4 — Task list: add, complete, delete
- [x] 1.5 — Task area tagging (dropdown, defaults to home base)
- [x] 1.6 — MVD checkbox with hint text for home base area
- [x] 1.7 — Events list for today (title, time, area badge)
- [x] 1.8 — Add event form (title, time, optional end time, remind offset)
- [x] 1.9 — Daily note textarea (autosaves)
- [x] 1.10 — Brain dump / Inbox (add item, convert to task, delete)

**Done when:** Full daily workflow works without Telegram or AI.

---

## Phase 2 — Week View
*Goal: See the full week at a glance and edit any day.*

- [x] 2.1 — 7-day grid (day cards with home base, task count, MVD status, energy)
- [x] 2.2 — Click day card → expand inline detail panel (tasks + events for that day)
- [x] 2.3 — Home base dropdown per day card
- [x] 2.4 — Sunday Review section (3 textarea prompts, saves to `sunday_reviews`)
- [x] 2.5 — "Today" highlight on current day card

**Done when:** Full week is visible and editable.

---

## Phase 3 — Habits
*Goal: Track recurring habits with streaks and a weekly heatmap.*

- [x] 3.1 — Seed starter habits for user on first load
- [x] 3.2 — Habit list with area color badge
- [x] 3.3 — Add habit form (name, area, frequency, custom days)
- [x] 3.4 — Delete / archive habit
- [x] 3.5 — Daily habit log: checkboxes for habits due today
- [x] 3.6 — Skip day button (streak protection, max 1/week per habit)
- [x] 3.7 — Weekly heatmap row (7 squares: done/missed/not-scheduled)
- [x] 3.8 — Streak count calculation and display

**Done when:** Habit tracking works end-to-end for the current week.

---

## Phase 4 — Pomodoro Timer
*Goal: In-app focus timer that tracks sessions per day.*

- [x] 4.1 — Circular countdown timer (SVG ring)
- [x] 4.2 — 25 min work / 5 min break cycle
- [x] 4.3 — Start / Pause / Reset controls
- [x] 4.4 — Auto-switch between work and break
- [x] 4.5 — Increment `days.pomodoro_sessions` on work session complete
- [x] 4.6 — Session count display ("3 pomodoros today")

**Done when:** Timer runs correctly and session count saves.

---

## Phase 5 — Stats View
*Goal: Weekly analytics visible at a glance.*

- [x] 5.1 — Summary cards: tasks done, MVD days, habits completed, pomodoros
- [x] 5.2 — Area breakdown bar chart (SVG, no library needed)
- [x] 5.3 — Energy vs completion line chart (SVG dual-line)
- [x] 5.4 — Habit consistency list (sorted by lowest completion %)
- [x] 5.5 — Weekly wins auto-generation (text snippets from data)

**Done when:** Stats view shows accurate data from the current week.

---

## Phase 6 — Telegram Bot (Receive & Respond)
*Goal: Send and receive messages from the bot. Core commands work.*

- [x] 6.1 — Create Telegram bot via @BotFather, get token
- [x] 6.2 — POST `/api/telegram` webhook endpoint (verify secret header)
- [x] 6.3 — Register webhook URL with Telegram (ngrok locally, Vercel URL in prod)
- [x] 6.4 — User linking: `/start` command → link telegram_chat_id to user
- [x] 6.5 — Echo test: any message → bot replies "Got it"
- [x] 6.6 — Morning briefing command: `/briefing` → shows today's tasks + events

**Done when:** You can send a message and get a reply from the bot.

---

## Phase 7 — AI Message Parsing (Claude)
*Goal: Natural language → structured data saved to DB.*

- [x] 7.1 — Install Vercel AI SDK (`@ai-sdk/anthropic`)
- [x] 7.2 — Create AI service module (`src/lib/server/ai.ts`)
- [x] 7.3 — Intent classification prompt (task / event / inbox / query)
- [x] 7.4 — Entity extraction: task text, area, day, time, remind offset
- [x] 7.5 — Conversation state machine (load/save from `telegram_conversations`)
- [x] 7.6 — Multi-turn: ask for missing fields ("What time is the meeting?")
- [x] 7.7 — Confirmation message + DB save
- [x] 7.8 — Inbox capture: ambiguous messages → saved to `inbox_items`

**Example flows to test:**
```
"add a task to review Getfly roadmap today"
→ { intent: task, text: "Review Getfly roadmap", area: "getfly", day: today }

"schedule a meeting with Mirai team at 3pm tomorrow"
→ { intent: event, title: "Mirai team meeting", starts_at: tomorrow 3pm IST, remind_at: 2:55pm }

"remind me to drink water"
→ bot: "Sure! When should I remind you?"
→ "every day at 9am"
→ creates recurring habit log reminder
```

**Done when:** You can create tasks and events via natural language on Telegram.

---

## Phase 8 — Notifications & Cron Jobs (Trigger.dev)
*Goal: Automated reminders arrive on Telegram at the right times.*

- [x] 8.1 — Set up Trigger.dev project, install SDK
- [x] 8.2 — Event reminder job: every minute, query `events WHERE remind_at <= NOW() AND reminded = false`
- [x] 8.3 — Morning briefing cron: 8:00am IST daily → summary of day's tasks + events
- [x] 8.4 — Habit reminder cron: 9:00pm IST daily → list unchecked habits for today
- [x] 8.5 — Weekly review prompt: Sunday 7:00pm IST → prompt to do Sunday review
- [x] 8.6 — Pre-event reminder: 5 min before `starts_at` → "Meeting in 5 minutes"

**Done when:** You receive the morning briefing without opening the app, and event reminders arrive on time.

---

## Phase 9 — AI Features in Web App
*Goal: AI-powered assistance directly in the dashboard.*

- [x] 9.1 — Daily briefing card on Today view (AI-generated, based on tasks + energy + habits)
- [x] 9.2 — Smart task suggestions (included in briefing response)
- [x] 9.3 — Health tip cards (daily rotation, 7 curated tips)
- [x] 9.4 — Weekly review auto-draft (AI pre-fills Sunday review based on week data)
- [x] 9.5 — Natural language task input on web ("I need to call mom tomorrow afternoon")

**Done when:** AI makes the app noticeably smarter, not just decorative.

---

## Phase 10 — PWA + Polish
*Goal: App is installable on mobile and feels production-grade.*

- [x] 10.1 — Install and configure `vite-plugin-pwa`
- [x] 10.2 — Service worker + offline support (Workbox pre-caches all assets + fonts)
- [x] 10.3 — Web app manifest (SVG icon, name, theme color, standalone display)
- [x] 10.4 — Install prompt on mobile (handled by browser via manifest)
- [x] 10.5 — Smooth transitions between tabs (View Transitions API cross-fade)
- [x] 10.6 — Loading bar during navigation ($navigating store + CSS animation)
- [x] 10.7 — Empty states for all views (already present per-section)
- [x] 10.8 — Mobile-responsive layout (safe-area-inset for notched iPhones, viewport-fit=cover)

**Done when:** App installs on your phone and works smoothly offline.

---

## Future Scope (Not in Current Build)

- Multi-user auth (Supabase Auth)
- WhatsApp Business API integration
- Apple Health / Google Fit import for sleep data
- Calendar sync (Google Calendar → import events)
- Go microservice extraction for AI/Telegram processing
- Voice message parsing from Telegram (Whisper API)
- Recurring events
- Weekly/monthly reports via email

---

## Current Priority (Ship This First)

The minimum loop to use daily:
1. Phase 0 — Scaffold
2. Phase 1 — Today View
3. Phase 6 — Telegram (basic)
4. Phase 7 — AI parsing
5. Phase 8 — Cron reminders

Everything else adds value but isn't blocking daily use.
