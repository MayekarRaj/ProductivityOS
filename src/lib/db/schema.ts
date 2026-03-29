// All database tables defined here — Drizzle reads this file to:
// 1. Generate SQL migrations (drizzle-kit push / generate)
// 2. Provide fully-typed query results throughout the app
//
// Convention:
//   TypeScript property names → camelCase  (e.g. homeBase)
//   Database column names     → snake_case (e.g. home_base)
//   Drizzle maps between them automatically.

import {
	pgTable,
	uuid,
	text,
	boolean,
	date,
	timestamp,
	integer,
	jsonb,
	unique
} from 'drizzle-orm/pg-core';

// In drizzle-orm v0.30+, timestamptz was removed.
// Use timestamp({ withTimezone: true }) instead — same Postgres type, new API.
// We alias it so the rest of the file reads cleanly.
const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
import { relations } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────────────────────
// AREAS
// Dynamic life/work areas — previously hardcoded, now stored in DB so users
// can add, edit, suspend, or delete them over time.
// key = short slug (e.g. 'getfly') — referenced as a plain string in all other tables.
// color = key into COLOR_OPTIONS in areas.ts (e.g. 'purple').
// ─────────────────────────────────────────────────────────────────────────────
export const areas = pgTable(
	'areas',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		key: text('key').notNull(), // slug, unique per user
		label: text('label').notNull(),
		emoji: text('emoji').notNull().default('📌'),
		color: text('color').notNull().default('purple'), // e.g. 'purple', 'blue'
		suspended: boolean('suspended').notNull().default(false),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: timestamptz('created_at').notNull().defaultNow()
	},
	(table) => [unique('areas_user_key_unique').on(table.userId, table.key)]
);

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// Single user for now (v1), but every table has user_id for future multi-user.
// ─────────────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: text('email').unique(),
	// Telegram chat ID — set when user links their Telegram account via /start
	telegramChatId: text('telegram_chat_id').unique(),
	timezone: text('timezone').notNull().default('Asia/Kolkata'),
	createdAt: timestamptz('created_at').notNull().defaultNow()
});

// ─────────────────────────────────────────────────────────────────────────────
// DAYS
// One row per calendar date per user. Created on-demand when a day is first opened.
// ─────────────────────────────────────────────────────────────────────────────
export const days = pgTable(
	'days',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		// date type stores YYYY-MM-DD, no time component — perfect for "what day is it"
		date: date('date').notNull(),
		homeBase: text('home_base').notNull().default('getfly'),
		// Nullable — user may not set energy every day
		energy: text('energy'), // 'drained' | 'okay' | 'charged' | 'peak'
		note: text('note').notNull().default(''),
		mvdDone: boolean('mvd_done').notNull().default(false),
		pomodoroSessions: integer('pomodoro_sessions').notNull().default(0),
		// Sleep tracking — manual input (Phase 1f)
		sleepStart: timestamptz('sleep_start'),
		sleepEnd: timestamptz('sleep_end'),
		createdAt: timestamptz('created_at').notNull().defaultNow()
	},
	// Composite unique constraint — one day row per user per date
	(table) => [unique('days_user_date_unique').on(table.userId, table.date)]
);

// ─────────────────────────────────────────────────────────────────────────────
// TASKS
// One-off to-dos attached to a specific day. Distinct from Events (which have time).
// ─────────────────────────────────────────────────────────────────────────────
export const tasks = pgTable('tasks', {
	id: uuid('id').primaryKey().defaultRandom(),
	// userId is denormalized (also on day) for faster queries without a join
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	dayId: uuid('day_id')
		.notNull()
		.references(() => days.id, { onDelete: 'cascade' }),
	text: text('text').notNull(),
	area: text('area'), // nullable — defaults to day's homeBase in the UI
	done: boolean('done').notNull().default(false),
	// source tracks where the task came from — useful for Telegram/AI analytics
	source: text('source').notNull().default('web'), // 'web' | 'telegram' | 'ai'
	createdAt: timestamptz('created_at').notNull().defaultNow(),
	completedAt: timestamptz('completed_at') // set when done flips to true
});

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS
// Time-boxed items with a specific start time. Different from tasks:
//   Task  → "Review Getfly roadmap" (no specific time)
//   Event → "Client call at 3pm" (specific time, can have reminders)
// ─────────────────────────────────────────────────────────────────────────────
export const events = pgTable('events', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	dayId: uuid('day_id')
		.notNull()
		.references(() => days.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	// All times stored as UTC — displayed as IST in the UI
	startsAt: timestamptz('starts_at').notNull(),
	endsAt: timestamptz('ends_at'), // optional
	// remindAt: when Trigger.dev should send the Telegram reminder
	// Default: startsAt - 5 minutes (set at application layer)
	remindAt: timestamptz('remind_at'),
	reminded: boolean('reminded').notNull().default(false), // flip to true after sending
	area: text('area'),
	source: text('source').notNull().default('web'), // 'web' | 'telegram' | 'ai'
	createdAt: timestamptz('created_at').notNull().defaultNow()
});

// ─────────────────────────────────────────────────────────────────────────────
// HABITS
// Recurring habits tracked separately from one-off tasks.
// ─────────────────────────────────────────────────────────────────────────────
export const habits = pgTable('habits', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	area: text('area').notNull(),
	// frequency determines which days this habit is "due"
	frequency: text('frequency').notNull().default('daily'), // 'daily' | 'weekdays' | '3x' | 'custom'
	// customDays only used when frequency = 'custom', e.g. ['Mon', 'Wed', 'Fri']
	// text() array in Postgres — stored as {Mon,Wed,Fri}
	customDays: text('custom_days').array(),
	archived: boolean('archived').notNull().default(false), // soft delete
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamptz('created_at').notNull().defaultNow()
});

// ─────────────────────────────────────────────────────────────────────────────
// HABIT LOGS
// One row per habit per date. Absence = not yet logged.
// status: 'done' | 'skipped' | 'missed'
// 'skipped' = streak protection (max 1 per habit per week)
// ─────────────────────────────────────────────────────────────────────────────
export const habitLogs = pgTable(
	'habit_logs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		habitId: uuid('habit_id')
			.notNull()
			.references(() => habits.id, { onDelete: 'cascade' }),
		date: date('date').notNull(),
		status: text('status').notNull() // 'done' | 'skipped' | 'missed'
	},
	(table) => [unique('habit_logs_habit_date_unique').on(table.habitId, table.date)]
);

// ─────────────────────────────────────────────────────────────────────────────
// INBOX ITEMS
// Brain dump / quick capture. Not tied to a specific day.
// Items can be converted to tasks or deleted.
// ─────────────────────────────────────────────────────────────────────────────
export const inboxItems = pgTable('inbox_items', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	text: text('text').notNull(),
	source: text('source').notNull().default('web'), // 'web' | 'telegram'
	// When converted to a task, this gets set — item stays in DB for history
	convertedToTaskId: uuid('converted_to_task_id').references(() => tasks.id),
	createdAt: timestamptz('created_at').notNull().defaultNow()
});

// ─────────────────────────────────────────────────────────────────────────────
// SUNDAY REVIEWS
// One per week, identified by the Monday date of that week.
// ─────────────────────────────────────────────────────────────────────────────
export const sundayReviews = pgTable(
	'sunday_reviews',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		weekStartDate: date('week_start_date').notNull(), // always a Monday
		importantThings: text('important_things').notNull().default(''),
		deadlineShifts: text('deadline_shifts').notNull().default(''),
		fitnessPlan: text('fitness_plan').notNull().default(''),
		updatedAt: timestamptz('updated_at').notNull().defaultNow()
	},
	(table) => [unique('sunday_reviews_user_week_unique').on(table.userId, table.weekStartDate)]
);

// ─────────────────────────────────────────────────────────────────────────────
// TELEGRAM CONVERSATIONS
// Stores the current state of a multi-turn Telegram conversation.
// One row per user — updated as the conversation progresses.
// state machine: 'idle' → 'creating_task' → 'awaiting_date' → 'idle'
// ─────────────────────────────────────────────────────────────────────────────
export const telegramConversations = pgTable('telegram_conversations', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' })
		.unique(),
	state: text('state').notNull().default('idle'),
	// jsonb holds the partial data collected so far, e.g. { title: "meeting" }
	context: jsonb('context').default({}),
	updatedAt: timestamptz('updated_at').notNull().defaultNow()
});

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// Log of all notifications — scheduled and sent.
// Trigger.dev reads this to know what to send and when.
// ─────────────────────────────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	type: text('type').notNull(), // 'morning_briefing' | 'event_reminder' | 'habit_reminder' | 'weekly_review'
	scheduledAt: timestamptz('scheduled_at').notNull(),
	sentAt: timestamptz('sent_at'), // null = not yet sent
	payload: jsonb('payload').default({})
});

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONS
// Drizzle relations enable type-safe joins and nested queries.
// These don't create DB constraints — the references() above do that.
// ─────────────────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many, one }) => ({
	days: many(days),
	habits: many(habits),
	inboxItems: many(inboxItems),
	sundayReviews: many(sundayReviews),
	areas: many(areas),
	telegramConversation: one(telegramConversations, {
		fields: [users.id],
		references: [telegramConversations.userId]
	})
}));

export const daysRelations = relations(days, ({ one, many }) => ({
	user: one(users, { fields: [days.userId], references: [users.id] }),
	tasks: many(tasks),
	events: many(events)
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
	day: one(days, { fields: [tasks.dayId], references: [days.id] }),
	user: one(users, { fields: [tasks.userId], references: [users.id] })
}));

export const eventsRelations = relations(events, ({ one }) => ({
	day: one(days, { fields: [events.dayId], references: [days.id] }),
	user: one(users, { fields: [events.userId], references: [users.id] })
}));

export const habitsRelations = relations(habits, ({ one, many }) => ({
	user: one(users, { fields: [habits.userId], references: [users.id] }),
	logs: many(habitLogs)
}));

export const habitLogsRelations = relations(habitLogs, ({ one }) => ({
	habit: one(habits, { fields: [habitLogs.habitId], references: [habits.id] })
}));
