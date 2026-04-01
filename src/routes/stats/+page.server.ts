import type { PageServerLoad, Actions } from './$types';
import { eq, and, inArray, gte } from 'drizzle-orm';
import { db } from '$lib/db';
import { days, tasks, habits, habitLogs, areas, users, pomodoroLogs } from '$lib/db/schema';
import { DEFAULT_USER_ID } from '$lib/constants/user';
import { getTodayDateIST, getWeekDatesIST, getMondayOfWeekIST } from '$lib/utils/dates';
import { computeWeekStats } from '$lib/utils/stats';

export const load: PageServerLoad = async () => {
	const todayStr = getTodayDateIST();
	const weekDates = getWeekDatesIST();
	const weekStartDate = getMondayOfWeekIST();

	// Fetch all week day rows, tasks, active habits, and this week's habit logs
	const weekDayRows = await db
		.select()
		.from(days)
		.where(and(eq(days.userId, DEFAULT_USER_ID), inArray(days.date, weekDates)));

	const dayIds = weekDayRows.map((d) => d.id);

	const [weekTasks, activeHabits, weekHabitLogs, userAreas, weekPomodoroLogs] = await Promise.all([
		dayIds.length > 0
			? db.select().from(tasks).where(inArray(tasks.dayId, dayIds))
			: Promise.resolve([]),

		db
			.select()
			.from(habits)
			.where(and(eq(habits.userId, DEFAULT_USER_ID), eq(habits.archived, false))),

		db
			.select()
			.from(habitLogs)
			.where(gte(habitLogs.date, weekStartDate)),

		db
			.select()
			.from(areas)
			.where(eq(areas.userId, DEFAULT_USER_ID))
			.orderBy(areas.sortOrder, areas.createdAt),

		// Pomodoro logs for this week — used for focus-by-area breakdown
		dayIds.length > 0
			? db.select({ taskId: pomodoroLogs.taskId }).from(pomodoroLogs).where(inArray(pomodoroLogs.dayId, dayIds))
			: Promise.resolve([])
	]);

	const stats = computeWeekStats(weekDates, weekDayRows, weekTasks, activeHabits, weekHabitLogs, userAreas, weekPomodoroLogs);

	// ── Prev-week comparison ──────────────────────────────────────────────────
	const prevWeekDates = weekDates.map((d) => {
		const date = new Date(d + 'T00:00:00+05:30');
		date.setDate(date.getDate() - 7);
		return date.toISOString().slice(0, 10);
	});

	const prevWeekDayRows = await db
		.select()
		.from(days)
		.where(and(eq(days.userId, DEFAULT_USER_ID), inArray(days.date, prevWeekDates)));

	const prevDayIds = prevWeekDayRows.map((d) => d.id);
	const [prevWeekTasks, prevWeekHabitLogs] = await Promise.all([
		prevDayIds.length > 0
			? db.select().from(tasks).where(inArray(tasks.dayId, prevDayIds))
			: Promise.resolve([]),
		db.select().from(habitLogs).where(gte(habitLogs.date, prevWeekDates[0]))
	]);

	const prevStats = computeWeekStats(
		prevWeekDates, prevWeekDayRows, prevWeekTasks,
		activeHabits, prevWeekHabitLogs, userAreas
	);

	return { todayStr, weekDates, weekStartDate, stats, prevStats };
};

// ─── Actions ──────────────────────────────────────────────────────────────────
export const actions: Actions = {
	updateFocus: async ({ request }) => {
		const data = await request.formData();
		const currentFocus = (data.get('currentFocus') as string) ?? '';
		await db.update(users).set({ currentFocus }).where(eq(users.id, DEFAULT_USER_ID));
	}
};
