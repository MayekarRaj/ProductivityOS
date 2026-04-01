// Weekly stats computation.
// All functions take raw DB rows and return structured data ready for the UI.

import type { AreaRow } from '$lib/constants/areas';
import { ENERGY_LEVELS } from '$lib/constants/defaults';
import { isDueOnDay } from '$lib/utils/habits';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DayStat = {
	date: string;
	weekday: string; // 'Mon', 'Tue', …
	tasksDone: number;
	tasksTotal: number;
	completionRate: number; // 0–1
	energyValue: number; // 1–4 (0 if not set)
	mvdDone: boolean;
	pomodoroSessions: number;
};

export type AreaStat = {
	key: string;
	label: string;
	emoji: string;
	tasksDone: number;
	tasksTotal: number;
};

export type HabitConsistency = {
	id: string;
	name: string;
	area: string;
	dueCount: number;
	doneCount: number;
	percent: number; // 0–100
};

export type FocusAreaStat = {
	key: string;
	label: string;
	emoji: string;
	sessions: number; // completed pomodoros linked to tasks in this area
};

export type SleepStat = {
	date: string;
	weekday: string;
	hours: number | null; // null = not logged
};

export type WeekStats = {
	// Summary cards
	tasksDoneTotal: number;
	mvdDays: number;
	habitsCompleted: number;
	pomodorosTotal: number;
	// Charts
	dayStats: DayStat[]; // 7 entries, Mon–Sun
	areaStats: AreaStat[]; // one per area that has tasks
	habitConsistency: HabitConsistency[]; // sorted worst → best
	sleepStats: SleepStat[]; // 7 entries, Mon–Sun (hours slept each night)
	avgSleepHours: number | null; // average over logged days (null if none logged)
	focusByArea: FocusAreaStat[]; // pomodoros per area (only areas with linked sessions)
	// Weekly wins
	wins: string[];
};

// ── Energy map ────────────────────────────────────────────────────────────────
const ENERGY_VALUE: Record<string, number> = Object.fromEntries(
	ENERGY_LEVELS.map((e) => [e.key, e.value])
);

// ── Main computation ──────────────────────────────────────────────────────────

export function computeWeekStats(
	weekDates: string[],
	dayRows: Array<{
		id: string;
		date: string;
		energy: string | null;
		mvdDone: boolean;
		pomodoroSessions: number;
		sleepStart: Date | null;
		sleepEnd: Date | null;
	}>,
	taskRows: Array<{ id: string; dayId: string; area: string | null; done: boolean }>,
	habitRows: Array<{ id: string; name: string; area: string; frequency: string; customDays: string[] | null }>,
	habitLogRows: Array<{ habitId: string; date: string; status: string }>,
	areas: AreaRow[],
	pomodoroLogRows: Array<{ taskId: string | null }> = []
): WeekStats {
	// ── Build lookup helpers ──────────────────────────────────────────────────
	const dayByDate = new Map(dayRows.map((d) => [d.date, d]));

	// Weekday abbreviation for each date (Mon, Tue, …)
	function weekdayOf(dateStr: string): string {
		return new Intl.DateTimeFormat('en-US', {
			timeZone: 'Asia/Kolkata',
			weekday: 'short'
		}).format(new Date(dateStr + 'T00:00:00+05:30'));
	}

	// ── 7-day per-day stats ───────────────────────────────────────────────────
	const dayStats: DayStat[] = weekDates.map((date) => {
		const day = dayByDate.get(date);
		const dayTasks = day ? taskRows.filter((t) => t.dayId === day.id) : [];
		const weekday = weekdayOf(date);

		return {
			date,
			weekday,
			tasksDone: dayTasks.filter((t) => t.done).length,
			tasksTotal: dayTasks.length,
			completionRate: dayTasks.length > 0 ? dayTasks.filter((t) => t.done).length / dayTasks.length : 0,
			energyValue: day?.energy ? (ENERGY_VALUE[day.energy] ?? 0) : 0,
			mvdDone: day?.mvdDone ?? false,
			pomodoroSessions: day?.pomodoroSessions ?? 0
		};
	});

	// ── Summary totals ────────────────────────────────────────────────────────
	const tasksDoneTotal = dayStats.reduce((s, d) => s + d.tasksDone, 0);
	const mvdDays = dayStats.filter((d) => d.mvdDone).length;
	const pomodorosTotal = dayStats.reduce((s, d) => s + d.pomodoroSessions, 0);
	const habitsCompleted = habitLogRows.filter((l) => l.status === 'done').length;

	// ── Area breakdown ────────────────────────────────────────────────────────
	// All tasks across the week, grouped by area
	const allWeekTasks = taskRows.filter((t) => {
		const day = dayRows.find((d) => d.id === t.dayId);
		return day && weekDates.includes(day.date);
	});

	const areaStats: AreaStat[] = areas.map((area) => {
		const areaTasksAll = allWeekTasks.filter((t) => (t.area ?? 'personal') === area.key);
		return {
			key: area.key,
			label: area.label,
			emoji: area.emoji,
			tasksDone: areaTasksAll.filter((t) => t.done).length,
			tasksTotal: areaTasksAll.length
		};
	}).filter((a) => a.tasksTotal > 0);

	// ── Habit consistency ─────────────────────────────────────────────────────
	const habitConsistency: HabitConsistency[] = habitRows.map((habit) => {
		// Days in this week where the habit was due
		const dueDates = weekDates.filter((date) =>
			isDueOnDay(habit.frequency, habit.customDays ?? null, weekdayOf(date))
		);
		// How many of those due days have a 'done' log
		const doneCount = dueDates.filter((date) => {
			const log = habitLogRows.find((l) => l.habitId === habit.id && l.date === date);
			return log?.status === 'done';
		}).length;

		return {
			id: habit.id,
			name: habit.name,
			area: habit.area,
			dueCount: dueDates.length,
			doneCount,
			percent: dueDates.length > 0 ? Math.round((doneCount / dueDates.length) * 100) : 0
		};
	}).sort((a, b) => a.percent - b.percent); // worst first

	// ── Focus by area ─────────────────────────────────────────────────────────
	// For each pomodoro log that has a linked task, look up the task's area and
	// count sessions per area. Logs with no taskId are counted as "unlinked".
	const taskById = new Map(taskRows.map((t) => [t.id, t]));

	const sessionsByArea = new Map<string, number>();
	for (const log of pomodoroLogRows) {
		if (!log.taskId) continue; // skip unlinked sessions
		const task = taskById.get(log.taskId);
		const areaKey = task?.area ?? 'personal';
		sessionsByArea.set(areaKey, (sessionsByArea.get(areaKey) ?? 0) + 1);
	}

	const focusByArea: FocusAreaStat[] = areas
		.filter((a) => sessionsByArea.has(a.key))
		.map((a) => ({
			key: a.key,
			label: a.label,
			emoji: a.emoji,
			sessions: sessionsByArea.get(a.key) ?? 0
		}))
		.sort((a, b) => b.sessions - a.sessions); // most focused first

	// ── Sleep stats ───────────────────────────────────────────────────────────
	// sleepStart/sleepEnd are timestamptz — duration = (sleepEnd - sleepStart) in hours.
	// Each day row holds the sleep for that MORNING (e.g. Monday row = Sunday night → Monday wake).
	const sleepStats: SleepStat[] = weekDates.map((date) => {
		const day = dayByDate.get(date);
		let hours: number | null = null;
		if (day?.sleepStart && day?.sleepEnd) {
			const ms = (day.sleepEnd as Date).getTime() - (day.sleepStart as Date).getTime();
			// Round to 1 decimal place
			hours = Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
			if (hours < 0) hours = null; // guard against bad data
		}
		return { date, weekday: weekdayOf(date), hours };
	});

	const loggedSleepDays = sleepStats.filter((s) => s.hours !== null);
	const avgSleepHours =
		loggedSleepDays.length > 0
			? Math.round((loggedSleepDays.reduce((s, d) => s + d.hours!, 0) / loggedSleepDays.length) * 10) / 10
			: null;

	// ── Weekly wins ───────────────────────────────────────────────────────────
	// Text snippets auto-generated from the data — no AI, just simple rules.
	const wins: string[] = [];

	if (tasksDoneTotal > 0) {
		wins.push(`Completed ${tasksDoneTotal} task${tasksDoneTotal > 1 ? 's' : ''} this week`);
	}
	if (mvdDays > 0) {
		wins.push(`Hit your MVD on ${mvdDays} out of 7 days`);
	}
	if (pomodorosTotal > 0) {
		wins.push(`Logged ${pomodorosTotal} pomodoro${pomodorosTotal > 1 ? 's' : ''} of focused work`);
	}
	if (habitsCompleted > 0) {
		wins.push(`Completed ${habitsCompleted} habit check-in${habitsCompleted > 1 ? 's' : ''}`);
	}
	// Highlight best habit
	const bestHabit = [...habitConsistency].sort((a, b) => b.percent - a.percent)[0];
	if (bestHabit && bestHabit.percent === 100) {
		wins.push(`${bestHabit.name} — perfect streak this week!`);
	}
	// Highlight consecutive MVD days
	const maxMvdStreak = longestTrueRun(dayStats.map((d) => d.mvdDone));
	if (maxMvdStreak >= 3) {
		wins.push(`${maxMvdStreak}-day MVD streak!`);
	}
	// Sleep win — averaged ≥ 7.5h
	if (avgSleepHours !== null && avgSleepHours >= 7.5) {
		wins.push(`Averaged ${avgSleepHours}h sleep — well rested week`);
	}

	return { tasksDoneTotal, mvdDays, habitsCompleted, pomodorosTotal, dayStats, areaStats, habitConsistency, sleepStats, avgSleepHours, focusByArea, wins };
}

// Helper: longest run of `true` values in an array
function longestTrueRun(arr: boolean[]): number {
	let max = 0;
	let cur = 0;
	for (const v of arr) {
		cur = v ? cur + 1 : 0;
		if (cur > max) max = cur;
	}
	return max;
}
