# Data Model

All tables use UUID primary keys and include `created_at` timestamps.
Timezone for all `timestamptz` fields: stored as UTC, displayed in IST (Asia/Kolkata, UTC+5:30).

---

## Entity Relationship Overview

```
users
  └── days          (one user → many days, one per calendar date)
        ├── tasks   (one day → many tasks)
        └── events  (one day → many events)
  ├── habits        (one user → many habits)
  │     └── habit_logs (one habit → one log per date)
  ├── inbox_items
  ├── sunday_reviews (one per week)
  ├── telegram_conversations (one active state per user)
  └── notifications
```

---

## Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `email` | text unique | for future auth |
| `telegram_chat_id` | bigint unique nullable | set when user links Telegram |
| `timezone` | text | default `'Asia/Kolkata'` |
| `created_at` | timestamptz | |

---

### `days`
One row per calendar date per user. Created on demand (when user opens a day).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `date` | date | |
| `home_base` | text | area key: `job` \| `getfly` \| `mirai` \| `vamoss` \| `fitness` \| `personal` |
| `energy` | text nullable | `drained` \| `okay` \| `charged` \| `peak` |
| `note` | text | default `''` |
| `mvd_done` | boolean | default `false` |
| `pomodoro_sessions` | int | default `0` |
| `created_at` | timestamptz | |
| UNIQUE | `(user_id, date)` | |

**Default home base by weekday** (applied when creating a new day row):
```
Mon → getfly | Tue → mirai | Wed → getfly
Thu → vamoss | Fri → getfly | Sat → personal | Sun → fitness
```

---

### `tasks`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | denormalized for easy queries |
| `day_id` | uuid FK → days | |
| `text` | text | |
| `area` | text nullable | area key, defaults to day's `home_base` |
| `done` | boolean | default `false` |
| `source` | text | `web` \| `telegram` \| `ai` |
| `created_at` | timestamptz | |
| `completed_at` | timestamptz nullable | set when `done` flips to true |

---

### `events`
Distinct from tasks — events have a specific time and can trigger reminders.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `day_id` | uuid FK → days | |
| `title` | text | |
| `starts_at` | timestamptz | specific time in UTC |
| `ends_at` | timestamptz nullable | |
| `remind_at` | timestamptz nullable | when to fire the reminder |
| `reminded` | boolean | default `false` — set true after reminder sent |
| `area` | text nullable | area key |
| `source` | text | `web` \| `telegram` \| `ai` |
| `created_at` | timestamptz | |

**Reminder default:** `remind_at = starts_at - 5 minutes` (user can override).

---

### `habits`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `name` | text | |
| `area` | text | area key |
| `frequency` | text | `daily` \| `weekdays` \| `3x` \| `custom` |
| `custom_days` | text[] nullable | e.g. `['Mon','Wed','Fri']` — used when frequency = `custom` |
| `archived` | boolean | default `false` — soft delete |
| `sort_order` | int | for user-defined ordering |
| `created_at` | timestamptz | |

**Starter habits** (seeded per user on first load):
```
Workout         → fitness  → daily
Read / Study    → personal → daily
Morning routine → personal → daily
Drink water     → fitness  → daily
Wind down       → personal → daily
```

---

### `habit_logs`
One row per habit per date. Absence of a row = not yet logged.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `habit_id` | uuid FK → habits | |
| `date` | date | |
| `status` | text | `done` \| `skipped` \| `missed` |
| UNIQUE | `(habit_id, date)` | |

**Skip day logic:** `skipped` status preserves the streak. Max 1 skip per habit per week enforced at application layer.

**Streak calculation** (application layer, not stored):
```
Walk backwards from today.
Count consecutive days where status = 'done' OR 'skipped'.
Stop at first 'missed' or unlogged scheduled day.
```

---

### `inbox_items`
Brain dump / quick capture. Not tied to a specific day.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `text` | text | |
| `source` | text | `web` \| `telegram` |
| `converted_to_task_id` | uuid nullable FK → tasks | set when converted |
| `created_at` | timestamptz | |

---

### `sunday_reviews`
One row per week (week identified by the Monday date).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `week_start_date` | date | always a Monday |
| `important_things` | text | default `''` |
| `deadline_shifts` | text | default `''` |
| `fitness_plan` | text | default `''` |
| `updated_at` | timestamptz | |
| UNIQUE | `(user_id, week_start_date)` | |

---

### `telegram_conversations`
Stores active conversation state for multi-turn flows.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `state` | text | `idle` \| `creating_task` \| `creating_event` \| `awaiting_date` \| `awaiting_time` \| `awaiting_confirm` |
| `context` | jsonb | partial data collected so far (e.g. `{ title: "meeting", area: "getfly" }`) |
| `updated_at` | timestamptz | |
| UNIQUE | `(user_id)` | one active conversation per user |

---

### `notifications`
Log of all notifications scheduled and sent.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `type` | text | `morning_briefing` \| `event_reminder` \| `habit_reminder` \| `weekly_review` |
| `scheduled_at` | timestamptz | when it should be sent |
| `sent_at` | timestamptz nullable | null = not yet sent |
| `payload` | jsonb | message content, related IDs |

---

## Drizzle Schema Notes

- All tables defined in `src/lib/db/schema.ts`
- Migrations managed with `drizzle-kit`
- Connection via `postgres` (node-postgres) pooled through Supabase

---

## Indexes to Add

```sql
-- Fast lookup of today's data
CREATE INDEX ON days (user_id, date);
CREATE INDEX ON tasks (day_id);
CREATE INDEX ON events (day_id);
CREATE INDEX ON events (remind_at) WHERE reminded = false;

-- Telegram lookup
CREATE INDEX ON users (telegram_chat_id);

-- Habit logs for streak calc
CREATE INDEX ON habit_logs (habit_id, date);
```
