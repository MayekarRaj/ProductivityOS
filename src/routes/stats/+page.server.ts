import type { PageServerLoad } from './$types';
import { eq, and, inArray, gte } from 'drizzle-orm';
import { db } from '$lib/db';
import { days, tasks, habits, habitLogs } from '$lib/db/schema';
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

	const [weekTasks, activeHabits, weekHabitLogs] = await Promise.all([
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
			.where(gte(habitLogs.date, weekStartDate))
	]);

	const stats = computeWeekStats(weekDates, weekDayRows, weekTasks, activeHabits, weekHabitLogs);

	return { todayStr, weekDates, weekStartDate, stats };
};
