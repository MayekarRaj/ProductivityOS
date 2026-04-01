// Recurring event instance creation — shared by today and any other page that
// needs to materialise recurring events for a specific day.
//
// Pattern: "lazy instance creation"
//   - recurringEvents rows are templates (no day_id)
//   - When a day is loaded, this function checks which templates are due today
//     (by matching recurrenceDays against the weekday) and creates event rows
//     for any that don't already have one for that day.
//   - The rest of the app sees only normal events rows — no special handling needed.

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/db';
import { recurringEvents, events } from '$lib/db/schema';

/**
 * For a given day (identified by dayStr + dayId + weekday), ensures that all
 * active recurring events due on that weekday have an instance in the events table.
 * Idempotent — safe to call multiple times for the same day.
 *
 * @param userId    - The user's UUID
 * @param dayStr    - YYYY-MM-DD in IST (used to build full timestamps)
 * @param dayId     - UUID of the day row in the days table
 * @param weekday   - Abbreviated weekday in IST: 'Mon' | 'Tue' | … | 'Sun'
 */
export async function ensureRecurringInstances(
	userId: string,
	dayStr: string,
	dayId: string,
	weekday: string
): Promise<void> {
	// Fetch all active recurring event templates for this user
	const templates = await db
		.select()
		.from(recurringEvents)
		.where(and(eq(recurringEvents.userId, userId), eq(recurringEvents.active, true)));

	// Filter to only those due on today's weekday
	const dueToday = templates.filter((t) => t.recurrenceDays.includes(weekday));
	if (dueToday.length === 0) return;

	// Check which ones already have an instance for this day
	// (to avoid creating duplicates on repeated page loads)
	const existingInstances = await db
		.select({ recurringEventId: events.recurringEventId })
		.from(events)
		.where(
			and(
				eq(events.dayId, dayId),
				inArray(
					events.recurringEventId,
					dueToday.map((t) => t.id)
				)
			)
		);

	const alreadyCreated = new Set(existingInstances.map((e) => e.recurringEventId));
	const toCreate = dueToday.filter((t) => !alreadyCreated.has(t.id));
	if (toCreate.length === 0) return;

	// Build full UTC timestamps from the IST date string + HH:MM time strings.
	// Appending "+05:30" tells JS to interpret the time as IST.
	await db.insert(events).values(
		toCreate.map((t) => {
			const startsAt = new Date(`${dayStr}T${t.startsTime}:00+05:30`);
			const endsAt = t.endsTime ? new Date(`${dayStr}T${t.endsTime}:00+05:30`) : null;
			const remindAt = new Date(startsAt.getTime() - t.remindOffsetMin * 60 * 1000);
			return {
				userId,
				dayId,
				title: t.title,
				startsAt,
				endsAt,
				remindAt,
				area: t.area,
				source: 'web' as const,
				recurringEventId: t.id
			};
		})
	);
}
