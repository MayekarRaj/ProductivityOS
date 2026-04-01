// Two responsibilities:
//   1. load()   — fetch everything the Today view needs before render
//   2. actions  — handle all form submissions (tasks, events, inbox, day metadata)
//
// SvelteKit automatically re-runs load() after a successful action,
// so the page always reflects the latest DB state without manual refreshes.

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { eq, and, isNull, inArray } from 'drizzle-orm';

import { db } from '$lib/db';
import { days, tasks, events, inboxItems, recurringEvents, pomodoroLogs } from '$lib/db/schema';
import { DEFAULT_USER_ID } from '$lib/constants/user';
import { getTodayDateIST, getWeekdayIST, istInputToUTC, getYesterdayDateIST } from '$lib/utils/dates';
import { DEFAULT_SCHEDULE } from '$lib/constants/defaults';
import { parseMessage } from '$lib/server/ai';
import { ensureRecurringInstances } from '$lib/utils/recurring';

// ─── Load ────────────────────────────────────────────────────────────────────
// Called by SvelteKit before rendering the page.
// Return value becomes the `data` prop in +page.svelte.

export const load: PageServerLoad = async () => {
	const todayStr = getTodayDateIST(); // e.g. "2025-03-06"
	const weekday = getWeekdayIST(); //    e.g. "Thu"

	// ── Get or create today's day row ────────────────────────────────────────
	// We don't insert a row for every day at midnight (no cron needed).
	// Instead we create it lazily on first visit — "get or create" pattern.
	let [day] = await db
		.select()
		.from(days)
		.where(and(eq(days.userId, DEFAULT_USER_ID), eq(days.date, todayStr)));

	if (!day) {
		// First time opening today. Pick homeBase from the weekly schedule.
		const homeBase = DEFAULT_SCHEDULE[weekday] ?? 'getfly';
		[day] = await db
			.insert(days)
			.values({ userId: DEFAULT_USER_ID, date: todayStr, homeBase })
			.returning(); // .returning() gives us the freshly inserted row with DB defaults
	}

	// ── Create recurring event instances for today (if not already done) ─────
	// Idempotent — checks before inserting, safe to run on every page load.
	await ensureRecurringInstances(DEFAULT_USER_ID, todayStr, day.id, weekday);

	// ── Fetch tasks, events, inbox, and carry-forward in parallel ────────────
	// Promise.all fires all queries simultaneously — faster than sequential awaits.
	const yesterdayStr = getYesterdayDateIST();

	// Find yesterday's day row (may not exist if the app wasn't opened yesterday)
	const [yesterdayDay] = await db
		.select()
		.from(days)
		.where(and(eq(days.userId, DEFAULT_USER_ID), eq(days.date, yesterdayStr)));

	const [todayTasks, todayEvents, todayInbox, carriedTasks, recurringTemplates] = await Promise.all([
		db
			.select()
			.from(tasks)
			.where(and(eq(tasks.dayId, day.id), eq(tasks.userId, DEFAULT_USER_ID))),

		db
			.select()
			.from(events)
			.where(and(eq(events.dayId, day.id), eq(events.userId, DEFAULT_USER_ID)))
			.orderBy(events.startsAt), // sorted by start time ascending

		db
			.select()
			.from(inboxItems)
			.where(
				and(
					eq(inboxItems.userId, DEFAULT_USER_ID),
					isNull(inboxItems.convertedToTaskId) // hide converted items
				)
			)
			.orderBy(inboxItems.createdAt),

		// Yesterday's incomplete tasks — shown as carry-forward suggestions
		// Only fetched if yesterday's day row exists
		yesterdayDay
			? db
					.select()
					.from(tasks)
					.where(
						and(
							eq(tasks.dayId, yesterdayDay.id),
							eq(tasks.done, false) // only pending tasks
						)
					)
					.orderBy(tasks.createdAt)
			: Promise.resolve([]),

		// Recurring event templates — needed by the "Manage Recurring" UI section
		db
			.select()
			.from(recurringEvents)
			.where(and(eq(recurringEvents.userId, DEFAULT_USER_ID), eq(recurringEvents.active, true)))
			.orderBy(recurringEvents.createdAt)
	]);

	return { day, tasks: todayTasks, events: todayEvents, inboxItems: todayInbox, carriedTasks, recurringTemplates };
};

// ─── Actions ─────────────────────────────────────────────────────────────────
// SvelteKit routes form submissions to the matching action by name.
// <form method="POST" action="?/addTask"> → runs actions.addTask
//
// Each action receives a RequestEvent with request, params, locals, etc.
// fail(400, data) returns a 4xx response — SvelteKit surfaces it as `form` in the page.

export const actions: Actions = {
	// ── Tasks ──────────────────────────────────────────────────────────────
	addTask: async ({ request }) => {
		const data = await request.formData();
		const text = data.get('text') as string;
		const dayId = data.get('dayId') as string;
		const area = (data.get('area') as string) || null;

		if (!text?.trim()) return fail(400, { error: 'Task text is required' });

		await db.insert(tasks).values({
			userId: DEFAULT_USER_ID,
			dayId,
			text: text.trim(),
			area,
			source: 'web'
		});
	},

	toggleTask: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		// We receive the CURRENT done state so we can flip it
		const done = data.get('done') === 'true';

		await db
			.update(tasks)
			.set({
				done: !done,
				// completedAt = now when marking done, null when unchecking
				completedAt: !done ? new Date() : null
			})
			.where(eq(tasks.id, id));
	},

	deleteTask: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		// Clear the FK reference on any inbox item that was converted to this task.
		// Without this, Postgres blocks the delete because inbox_items.converted_to_task_id
		// still points here. The inbox item itself stays in the DB as history.
		await db
			.update(inboxItems)
			.set({ convertedToTaskId: null })
			.where(eq(inboxItems.convertedToTaskId, id));
		await db.delete(tasks).where(eq(tasks.id, id));
	},

	// ── Day metadata ────────────────────────────────────────────────────────
	setEnergy: async ({ request }) => {
		const data = await request.formData();
		const dayId = data.get('dayId') as string;
		const energy = data.get('energy') as string;
		await db.update(days).set({ energy }).where(eq(days.id, dayId));
	},

	toggleMvd: async ({ request }) => {
		const data = await request.formData();
		const dayId = data.get('dayId') as string;
		const current = data.get('current') === 'true';
		await db.update(days).set({ mvdDone: !current }).where(eq(days.id, dayId));
	},

	updateNote: async ({ request }) => {
		const data = await request.formData();
		const dayId = data.get('dayId') as string;
		const note = data.get('note') as string;
		await db.update(days).set({ note }).where(eq(days.id, dayId));
	},

	incrementPomodoro: async ({ request }) => {
		const data = await request.formData();
		const dayId = data.get('dayId') as string;
		const current = parseInt((data.get('current') as string) ?? '0');
		// Optional — null means "no specific task linked"
		const taskId = (data.get('taskId') as string) || null;

		// Run both writes in parallel — increment the day counter AND log the session
		await Promise.all([
			db.update(days).set({ pomodoroSessions: current + 1 }).where(eq(days.id, dayId)),
			db.insert(pomodoroLogs).values({
				userId: DEFAULT_USER_ID,
				dayId,
				taskId
			})
		]);
	},

	// ── Events ──────────────────────────────────────────────────────────────
	addEvent: async ({ request }) => {
		const data = await request.formData();
		const title = data.get('title') as string;
		const dayId = data.get('dayId') as string;
		// datetime-local input gives us "2025-03-06T14:30" — assumed IST, needs conversion
		const startsAtLocal = data.get('startsAt') as string;
		const endsAtLocal = (data.get('endsAt') as string) || null;
		const area = (data.get('area') as string) || null;
		// remindOffset is minutes before start; 0 = at event time, 5 = 5 min before, etc.
		const remindOffsetMin = parseInt((data.get('remindOffset') as string) ?? '5');

		if (!title?.trim()) return fail(400, { error: 'Event title is required' });
		if (!startsAtLocal) return fail(400, { error: 'Start time is required' });

		const startsAt = istInputToUTC(startsAtLocal);
		// Convert optional end time the same way — null if left blank
		const endsAt = endsAtLocal ? istInputToUTC(endsAtLocal) : null;
		// remindAt = startsAt minus the chosen offset
		const remindAt = new Date(startsAt.getTime() - remindOffsetMin * 60 * 1000);

		await db.insert(events).values({
			userId: DEFAULT_USER_ID,
			dayId,
			title: title.trim(),
			startsAt,
			endsAt,
			remindAt,
			area,
			source: 'web'
		});
	},

	deleteEvent: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		await db.delete(events).where(eq(events.id, id));
	},

	// ── Inbox ────────────────────────────────────────────────────────────────
	addInboxItem: async ({ request }) => {
		const data = await request.formData();
		const text = data.get('text') as string;
		if (!text?.trim()) return fail(400, { error: 'Item text is required' });

		await db.insert(inboxItems).values({
			userId: DEFAULT_USER_ID,
			text: text.trim(),
			source: 'web'
		});
	},

	deleteInboxItem: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		await db.delete(inboxItems).where(eq(inboxItems.id, id));
	},

	// Converts an inbox item into a task for today, keeping the inbox item for history
	convertInboxToTask: async ({ request }) => {
		const data = await request.formData();
		const itemId = data.get('itemId') as string;
		const text = data.get('text') as string;
		const dayId = data.get('dayId') as string;

		// Insert the task first so we have its ID
		const [newTask] = await db
			.insert(tasks)
			.values({ userId: DEFAULT_USER_ID, dayId, text: text.trim(), source: 'web' })
			.returning();

		// Mark the inbox item as converted — it disappears from the list
		// but stays in the DB for history / audit trail
		await db
			.update(inboxItems)
			.set({ convertedToTaskId: newTask.id })
			.where(eq(inboxItems.id, itemId));
	},

	// ── Recurring Events ─────────────────────────────────────────────────────
	// Creates a new recurring event template. Instances will be auto-generated
	// the next time a matching weekday is loaded.
	addRecurringEvent: async ({ request }) => {
		const data = await request.formData();
		const title = (data.get('title') as string)?.trim();
		const startsTime = data.get('startsTime') as string; // "HH:MM"
		const endsTime = (data.get('endsTime') as string) || null;
		const area = (data.get('area') as string) || null;
		const remindOffsetMin = parseInt((data.get('remindOffsetMin') as string) ?? '5');
		// recurrenceDays sent as multiple values: ['Mon', 'Wed', 'Fri']
		const recurrenceDays = data.getAll('recurrenceDays') as string[];

		if (!title) return fail(400, { error: 'Title is required' });
		if (recurrenceDays.length === 0) return fail(400, { error: 'Select at least one day' });
		if (!startsTime) return fail(400, { error: 'Start time is required' });

		await db.insert(recurringEvents).values({
			userId: DEFAULT_USER_ID,
			title,
			startsTime,
			endsTime,
			area,
			remindOffsetMin,
			recurrenceDays
		});
	},

	// Soft-deactivates (sets active = false) a recurring event template.
	// Existing instances already created are not deleted.
	deleteRecurringEvent: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		await db.update(recurringEvents).set({ active: false }).where(eq(recurringEvents.id, id));
	},

	// ── Carry Forward ────────────────────────────────────────────────────────
	// Moves an incomplete task from yesterday's day to today's day.
	// We just update day_id — the task itself (text, area, source) stays unchanged.
	carryForward: async ({ request }) => {
		const data = await request.formData();
		const taskId = data.get('taskId') as string;
		const todayDayId = data.get('todayDayId') as string;

		await db.update(tasks).set({ dayId: todayDayId }).where(eq(tasks.id, taskId));
	},

	// Moves ALL incomplete tasks from yesterday to today in one shot.
	// Accepts multiple taskId fields + a single todayDayId.
	carryAll: async ({ request }) => {
		const data = await request.formData();
		const taskIds = data.getAll('taskId') as string[];
		const todayDayId = data.get('todayDayId') as string;
		if (taskIds.length === 0) return;
		await db.update(tasks).set({ dayId: todayDayId }).where(inArray(tasks.id, taskIds));
	},

	// Dismisses a carry-forward task (permanently deletes it).
	// The user explicitly chose not to carry it forward.
	dismissCarried: async ({ request }) => {
		const data = await request.formData();
		const taskId = data.get('taskId') as string;
		// Clear any inbox item FK before deleting (same pattern as deleteTask)
		await db
			.update(inboxItems)
			.set({ convertedToTaskId: null })
			.where(eq(inboxItems.convertedToTaskId, taskId));
		await db.delete(tasks).where(eq(tasks.id, taskId));
	},

	// ── Sleep Logging ─────────────────────────────────────────────────────────
	// Accepts two time strings (HH:MM) from the right panel:
	//   bedTime  — time the user went to bed (treated as the PREVIOUS calendar day)
	//   wakeTime — time the user woke up (treated as TODAY)
	//
	// Sleep spans midnight, so we need to assemble two full IST timestamps:
	//   sleepStart = yesterday's date + bedTime  (e.g. 2025-03-05T23:30+05:30)
	//   sleepEnd   = today's date    + wakeTime  (e.g. 2025-03-06T07:00+05:30)
	logSleep: async ({ request }) => {
		const data = await request.formData();
		const dayId = data.get('dayId') as string;
		const bedTime = (data.get('bedTime') as string)?.trim();   // "23:30" or ""
		const wakeTime = (data.get('wakeTime') as string)?.trim(); // "07:00" or ""

		// Both fields must be provided together — partial input is ignored
		if (!bedTime || !wakeTime) {
			// If both are empty, clear the sleep fields (user wiped them out)
			if (!bedTime && !wakeTime) {
				await db.update(days).set({ sleepStart: null, sleepEnd: null }).where(eq(days.id, dayId));
			}
			return;
		}

		const todayStr = getTodayDateIST();
		const yesterdayStr = getYesterdayDateIST();

		// Bed time is on yesterday's calendar date — append IST offset
		const sleepStart = new Date(`${yesterdayStr}T${bedTime}:00+05:30`);
		// Wake time is on today's calendar date
		const sleepEnd = new Date(`${todayStr}T${wakeTime}:00+05:30`);

		await db.update(days).set({ sleepStart, sleepEnd }).where(eq(days.id, dayId));
	},

	// ── 9.5: Natural language task/event input ──────────────────────────────
	// Parses free-text input via AI and creates a task, event, or inbox item.
	// Returns nlResult — a short confirmation message shown below the input.
	nlTask: async ({ request }) => {
		const data = await request.formData();
		const text = (data.get('text') as string)?.trim();
		const dayId = data.get('dayId') as string;
		const todayStr = getTodayDateIST();

		if (!text) return fail(400, { nlResult: 'Please enter something.' });

		let parsed;
		try {
			parsed = await parseMessage(text, todayStr);
		} catch {
			return fail(500, { nlResult: 'AI unavailable. Try again or use the regular form.' });
		}

		if (parsed.intent === 'task' && parsed.task) {
			await db.insert(tasks).values({
				userId: DEFAULT_USER_ID,
				dayId,
				text: parsed.task.text,
				area: parsed.task.area,
				source: 'ai'
			});
			return { nlResult: `Task added: "${parsed.task.text}"` };
		}

		if (parsed.intent === 'event' && parsed.event) {
			if (parsed.event.timeStr) {
				const startsAt = new Date(`${parsed.event.date}T${parsed.event.timeStr}:00+05:30`);
				const remindAt = new Date(startsAt.getTime() - parsed.event.remindOffsetMin * 60 * 1000);
				await db.insert(events).values({
					userId: DEFAULT_USER_ID,
					dayId,
					title: parsed.event.title,
					startsAt,
					remindAt,
					area: parsed.event.area,
					source: 'ai'
				});
				return { nlResult: `Event added: "${parsed.event.title}" at ${parsed.event.timeStr}` };
			}
			// Event with no time — save to inbox with original text
			await db.insert(inboxItems).values({ userId: DEFAULT_USER_ID, text, source: 'ai' });
			return { nlResult: `Saved to inbox (no time specified for "${parsed.event.title}")` };
		}

		if (parsed.intent === 'inbox') {
			await db.insert(inboxItems).values({ userId: DEFAULT_USER_ID, text, source: 'ai' });
			return { nlResult: 'Saved to Brain Dump' };
		}

		return { nlResult: parsed.replyText || "Couldn't parse that. Try: 'review roadmap' or 'meeting at 3pm'" };
	}
};
