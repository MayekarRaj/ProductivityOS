// Week view — loads 7 days of data in one go and provides actions for
// updating home base per day and saving the Sunday review.

import type { PageServerLoad, Actions } from './$types';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '$lib/db';
import { days, tasks, events, sundayReviews } from '$lib/db/schema';
import { DEFAULT_USER_ID } from '$lib/constants/user';
import { getTodayDateIST, getWeekDatesIST, getMondayOfWeekIST } from '$lib/utils/dates';
import { generateSundayReviewDraft } from '$lib/server/ai';
import { AREAS_MAP } from '$lib/constants/areas';
import type { AreaKey } from '$lib/constants/areas';

// ─── Types ────────────────────────────────────────────────────────────────────
// Inferred from the query results — Drizzle gives us fully-typed rows.
type DayRow = typeof days.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;
type EventRow = typeof events.$inferSelect;

export type DayData = {
	day: DayRow | null; // null if this date has never been opened
	tasks: TaskRow[];
	events: EventRow[];
};

// ─── Load ─────────────────────────────────────────────────────────────────────
export const load: PageServerLoad = async () => {
	const todayStr = getTodayDateIST();
	const weekDates = getWeekDatesIST(); // ['2026-03-23', ..., '2026-03-29'] Mon→Sun
	const weekStartDate = getMondayOfWeekIST(); // 'YYYY-MM-DD' (Monday) — key for sunday_reviews

	// Single query for all day rows this week (instead of 7 separate queries)
	const weekDayRows = await db
		.select()
		.from(days)
		.where(and(eq(days.userId, DEFAULT_USER_ID), inArray(days.date, weekDates)));

	const dayIds = weekDayRows.map((d) => d.id);

	// Fetch tasks, events, and sunday review for this week in parallel
	const [weekTasks, weekEvents, sundayReview] = await Promise.all([
		// Guard against inArray([]) — Postgres rejects it as a syntax error
		dayIds.length > 0
			? db.select().from(tasks).where(inArray(tasks.dayId, dayIds))
			: Promise.resolve([] as TaskRow[]),

		dayIds.length > 0
			? db
					.select()
					.from(events)
					.where(inArray(events.dayId, dayIds))
					.orderBy(events.startsAt)
			: Promise.resolve([] as EventRow[]),

		db
			.select()
			.from(sundayReviews)
			.where(
				and(
					eq(sundayReviews.userId, DEFAULT_USER_ID),
					eq(sundayReviews.weekStartDate, weekStartDate)
				)
			)
			.then((rows) => rows[0] ?? null)
	]);

	// Build a map from date string → { day, tasks, events }
	// Days with no DB row yet get day: null and empty arrays.
	const dayMap: Record<string, DayData> = {};
	for (const date of weekDates) {
		const day = weekDayRows.find((d) => d.date === date) ?? null;
		dayMap[date] = {
			day,
			tasks: day ? weekTasks.filter((t) => t.dayId === day.id) : [],
			events: day ? weekEvents.filter((e) => e.dayId === day.id) : []
		};
	}

	return { weekDates, todayStr, weekStartDate, dayMap, sundayReview };
};

// ─── Actions ──────────────────────────────────────────────────────────────────
export const actions: Actions = {
	// Sets (or creates) the home base for a specific day.
	// If the day row doesn't exist yet, we create it now.
	setHomeBase: async ({ request }) => {
		const data = await request.formData();
		const date = data.get('date') as string;
		const homeBase = data.get('homeBase') as string;

		const [existing] = await db
			.select()
			.from(days)
			.where(and(eq(days.userId, DEFAULT_USER_ID), eq(days.date, date)));

		if (existing) {
			await db.update(days).set({ homeBase }).where(eq(days.id, existing.id));
		} else {
			// Lazy-create the day row — same pattern as the Today view
			await db.insert(days).values({ userId: DEFAULT_USER_ID, date, homeBase });
		}
	},

	// Upserts the Sunday review for this week.
	// weekStartDate is always the Monday of the week (our convention).
	saveSundayReview: async ({ request }) => {
		const data = await request.formData();
		const weekStartDate = data.get('weekStartDate') as string;
		const importantThings = (data.get('importantThings') as string) ?? '';
		const deadlineShifts = (data.get('deadlineShifts') as string) ?? '';
		const fitnessPlan = (data.get('fitnessPlan') as string) ?? '';

		const [existing] = await db
			.select()
			.from(sundayReviews)
			.where(
				and(
					eq(sundayReviews.userId, DEFAULT_USER_ID),
					eq(sundayReviews.weekStartDate, weekStartDate)
				)
			);

		if (existing) {
			await db
				.update(sundayReviews)
				.set({ importantThings, deadlineShifts, fitnessPlan, updatedAt: new Date() })
				.where(eq(sundayReviews.id, existing.id));
		} else {
			await db.insert(sundayReviews).values({
				userId: DEFAULT_USER_ID,
				weekStartDate,
				importantThings,
				deadlineShifts,
				fitnessPlan
			});
		}
	},

	// ── 9.4: Generate a Sunday review draft using AI ─────────────────────────
	// Collects this week's data and asks Groq to pre-fill the three prompts.
	// Returns the draft as form data so the Svelte page can populate textareas.
	generateSundayDraft: async () => {
		const weekDates = getWeekDatesIST();
		const weekStartDate = getMondayOfWeekIST();

		const weekDayRows = await db
			.select()
			.from(days)
			.where(and(eq(days.userId, DEFAULT_USER_ID), inArray(days.date, weekDates)));

		const dayIds = weekDayRows.map((d) => d.id);
		const weekTasks =
			dayIds.length > 0 ? await db.select().from(tasks).where(inArray(tasks.dayId, dayIds)) : [];

		// Summarise: tasks done, MVD days, notes, top areas
		const tasksDone = weekTasks.filter((t) => t.done).length;
		const mvdDays = weekDayRows.filter((d) => d.mvdDone).length;
		const dayNotes = weekDayRows.map((d) => d.note).filter(Boolean);

		// Top 2 areas by task count
		const areaCounts: Record<string, number> = {};
		for (const t of weekTasks) {
			const key = t.area ?? 'personal';
			areaCounts[key] = (areaCounts[key] ?? 0) + 1;
		}
		const topAreas = Object.entries(areaCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 2)
			.map(([key]) => AREAS_MAP[key as AreaKey]?.label ?? key);

		const pomodorosTotal = weekDayRows.reduce((s, d) => s + d.pomodoroSessions, 0);

		let draft;
		try {
			draft = await generateSundayReviewDraft({
				weekStart: weekDates[0],
				weekEnd: weekDates[6],
				tasksDone,
				mvdDays,
				habitsCompleted: 0, // habit logs not loaded here — keep it simple
				pomodoros: pomodorosTotal,
				topAreas,
				dayNotes
			});
		} catch {
			return { draftError: 'AI unavailable. Try again shortly.' };
		}

		return { draft };
	}
};
