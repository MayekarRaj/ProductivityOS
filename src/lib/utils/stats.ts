// Weekly stats computation.
// All functions take raw DB rows and return structured data ready for the UI.

import { AREAS, type AreaKey } from '$lib/constants/areas';
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
	colorText: string;
	colorBg: string;
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
	}>,
	taskRows: Array<{ dayId: string; area: string | null; done: boolean }>,
	habitRows: Array<{ id: string; name: string; area: string; frequency: string; customDays: string[] | null }>,
	habitLogRows: Array<{ habitId: string; date: string; status: string }>
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

	const areaStats: AreaStat[] = AREAS.map((area) => {
		const areaKey = area.key as AreaKey;
		const areaTasksAll = allWeekTasks.filter((t) => (t.area ?? 'personal') === areaKey);
		return {
			key: areaKey,
			label: area.label,
			emoji: area.emoji,
			colorText: area.color.text,
			colorBg: area.color.bg,
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

	return { tasksDoneTotal, mvdDays, habitsCompleted, pomodorosTotal, dayStats, areaStats, habitConsistency, wins };
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
