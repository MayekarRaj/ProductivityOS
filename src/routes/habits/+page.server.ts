// Habits page — loads all habits with weekly heatmap data and provides
// actions to add, archive, log (check), and skip habits.

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { eq, and, inArray, gte } from 'drizzle-orm';

import { db } from '$lib/db';
import { habits, habitLogs } from '$lib/db/schema';
import { DEFAULT_USER_ID } from '$lib/constants/user';
import { STARTER_HABITS } from '$lib/constants/defaults';
import { getTodayDateIST, getWeekDatesIST, getWeekdayIST, getMondayOfWeekIST } from '$lib/utils/dates';
import { calculateStreak, isDueOnDay } from '$lib/utils/habits';

// ─── Types ────────────────────────────────────────────────────────────────────
type HabitRow = typeof habits.$inferSelect;
type LogRow = typeof habitLogs.$inferSelect;

// logMap: habitId → date → log row (for O(1) lookups in the UI)
export type LogMap = Record<string, Record<string, LogRow>>;

// ─── Load ─────────────────────────────────────────────────────────────────────
export const load: PageServerLoad = async () => {
	const todayStr = getTodayDateIST();
	const weekDates = getWeekDatesIST(); // Mon → Sun
	const todayWeekday = getWeekdayIST(); // 'Mon', 'Tue', …

	// ── 3.1: Get habits, seeding starter set if this is the user's first visit ─
	let habitRows: HabitRow[] = await db
		.select()
		.from(habits)
		.where(and(eq(habits.userId, DEFAULT_USER_ID), eq(habits.archived, false)))
		.orderBy(habits.sortOrder, habits.createdAt);

	// Also fetch archived habits (shown in a collapsed section)
	const archivedRows: HabitRow[] = await db
		.select()
		.from(habits)
		.where(and(eq(habits.userId, DEFAULT_USER_ID), eq(habits.archived, true)))
		.orderBy(habits.createdAt);

	if (habitRows.length === 0 && archivedRows.length === 0) {
		// First time — insert the pre-defined starter habits
		habitRows = await db
			.insert(habits)
			.values(
				STARTER_HABITS.map((h, i) => ({
					userId: DEFAULT_USER_ID,
					name: h.name,
					area: h.area,
					frequency: h.frequency,
					sortOrder: i
				}))
			)
			.returning();
	}

	const habitIds = habitRows.map((h) => h.id);

	// ── Fetch logs for last 30 days ───────────────────────────────────────────
	// We need 7 days for the heatmap + ~23 more for streak calculation.
	// Using en-CA for YYYY-MM-DD format (Intl is safer than manual offsets).
	const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
	const thirtyDaysAgoStr = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Kolkata',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(thirtyDaysAgo);

	const recentLogs: LogRow[] =
		habitIds.length > 0
			? await db
					.select()
					.from(habitLogs)
					.where(
						and(inArray(habitLogs.habitId, habitIds), gte(habitLogs.date, thirtyDaysAgoStr))
					)
			: [];

	// Build logMap for O(1) lookups: habitId → date → log row
	const logMap: LogMap = {};
	for (const log of recentLogs) {
		if (!logMap[log.habitId]) logMap[log.habitId] = {};
		logMap[log.habitId][log.date] = log;
	}

	// Compute streak per habit — also derived from recentLogs
	const streaks: Record<string, number> = {};
	for (const habit of habitRows) {
		const habitLogEntries = recentLogs.filter((l) => l.habitId === habit.id);
		streaks[habit.id] = calculateStreak(habitLogEntries);
	}

	// ── Compute completionRate: % of today's due habits that are logged 'done' ─
	// We need to know which habits are due today and how many are done.
	const dueTodayIds = habitRows
		.filter((h) => isDueOnDay(h.frequency, h.customDays ?? null, todayWeekday))
		.map((h) => h.id);
	const dueCount = dueTodayIds.length;
	const doneCount = dueTodayIds.filter((id) => logMap[id]?.[todayStr]?.status === 'done').length;
	const completionRate = dueCount > 0 ? Math.round((doneCount / dueCount) * 100) : 0;

	// ── Compute missedCount: habits logged as 'missed' this week ─────────────
	// recentLogs covers last 30 days so we just filter to current week dates.
	const weekStart = weekDates[0]; // Monday of current week (getWeekDatesIST returns Mon–Sun)
	const missedCount = recentLogs.filter(
		(l) => l.status === 'missed' && l.date >= weekStart && l.date <= todayStr
	).length;

	return { todayStr, weekDates, todayWeekday, habits: habitRows, archivedHabits: archivedRows, logMap, streaks, completionRate, missedCount };
};

// ─── Actions ──────────────────────────────────────────────────────────────────
export const actions: Actions = {
	// ── 3.3: Add a new habit ────────────────────────────────────────────────
	addHabit: async ({ request }) => {
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		const area = data.get('area') as string;
		const frequency = data.get('frequency') as string;
		// customDays is a comma-separated string from hidden input, e.g. "Mon,Wed,Fri"
		const customDaysRaw = (data.get('customDays') as string) ?? '';
		const customDays =
			frequency === 'custom' && customDaysRaw
				? customDaysRaw.split(',').filter(Boolean)
				: null;

		if (!name) return fail(400, { error: 'Habit name is required' });
		if (!area) return fail(400, { error: 'Area is required' });

		// sortOrder = current count (append to end)
		const existing = await db
			.select()
			.from(habits)
			.where(eq(habits.userId, DEFAULT_USER_ID));

		await db.insert(habits).values({
			userId: DEFAULT_USER_ID,
			name,
			area,
			frequency,
			customDays,
			sortOrder: existing.length
		});
	},

	// ── 3.4: Archive a habit (soft delete) ──────────────────────────────────
	archiveHabit: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		await db.update(habits).set({ archived: true }).where(eq(habits.id, id));
	},

	// Restore an archived habit back to the active list
	unarchiveHabit: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		await db.update(habits).set({ archived: false }).where(eq(habits.id, id));
	},

	// ── 3.5: Toggle today's log for a habit (done ↔ not logged) ─────────────
	// If no log exists today → create 'done' log
	// If log is 'done' today → delete it (uncheck)
	toggleLog: async ({ request }) => {
		const data = await request.formData();
		const habitId = data.get('habitId') as string;
		const todayStr = getTodayDateIST();

		const [existing] = await db
			.select()
			.from(habitLogs)
			.where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, todayStr)));

		if (!existing) {
			await db.insert(habitLogs).values({ habitId, date: todayStr, status: 'done' });
		} else if (existing.status === 'done') {
			await db.delete(habitLogs).where(eq(habitLogs.id, existing.id));
		}
		// If status is 'skipped', clicking check sets it to done
		else if (existing.status === 'skipped') {
			await db.update(habitLogs).set({ status: 'done' }).where(eq(habitLogs.id, existing.id));
		}
	},

	// ── 3.6: Skip today's log for a habit ───────────────────────────────────
	// Max 1 skip per habit per week — prevents streak farming.
	skipHabit: async ({ request }) => {
		const data = await request.formData();
		const habitId = data.get('habitId') as string;
		const todayStr = getTodayDateIST();
		const weekStartDate = getMondayOfWeekIST();

		// Check how many skips this habit already has this week
		const weekLogs = await db
			.select()
			.from(habitLogs)
			.where(and(eq(habitLogs.habitId, habitId), gte(habitLogs.date, weekStartDate)));

		const skipsThisWeek = weekLogs.filter((l) => l.status === 'skipped').length;
		if (skipsThisWeek >= 1) {
			return fail(400, { error: 'Already used 1 skip this week for this habit' });
		}

		// Upsert: replace any existing log for today with 'skipped'
		const [existing] = await db
			.select()
			.from(habitLogs)
			.where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, todayStr)));

		if (existing) {
			await db.update(habitLogs).set({ status: 'skipped' }).where(eq(habitLogs.id, existing.id));
		} else {
			await db.insert(habitLogs).values({ habitId, date: todayStr, status: 'skipped' });
		}
	}
};
