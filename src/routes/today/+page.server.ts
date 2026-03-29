// Two responsibilities:
//   1. load()   — fetch everything the Today view needs before render
//   2. actions  — handle all form submissions (tasks, events, inbox, day metadata)
//
// SvelteKit automatically re-runs load() after a successful action,
// so the page always reflects the latest DB state without manual refreshes.

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { eq, and, isNull } from 'drizzle-orm';

import { db } from '$lib/db';
import { days, tasks, events, inboxItems } from '$lib/db/schema';
import { DEFAULT_USER_ID } from '$lib/constants/user';
import { getTodayDateIST, getWeekdayIST, istInputToUTC } from '$lib/utils/dates';
import { DEFAULT_SCHEDULE } from '$lib/constants/defaults';
import { parseMessage } from '$lib/server/ai';

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

	// ── Fetch tasks, events, and inbox in parallel ────────────────────────────
	// Promise.all fires all three queries simultaneously — faster than sequential awaits.
	// isNull(inboxItems.convertedToTaskId) = only show items not yet converted to tasks
	const [todayTasks, todayEvents, todayInbox] = await Promise.all([
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
			.orderBy(inboxItems.createdAt)
	]);

	return { day, tasks: todayTasks, events: todayEvents, inboxItems: todayInbox };
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
		await db.update(days).set({ pomodoroSessions: current + 1 }).where(eq(days.id, dayId));
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
