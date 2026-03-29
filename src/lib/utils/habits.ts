// Habit utility functions shared between the web app and cron jobs.

/**
 * Returns whether a habit is due on a given abbreviated weekday ("Mon", "Tue", …).
 *
 * frequency values:
 *   daily    → every day
 *   weekdays → Mon–Fri only
 *   3x       → Mon, Wed, Fri by convention
 *   custom   → whichever days are listed in customDays
 */
export function isDueOnDay(
	frequency: string,
	customDays: string[] | null,
	weekday: string
): boolean {
	switch (frequency) {
		case 'daily':
			return true;
		case 'weekdays':
			return !['Sat', 'Sun'].includes(weekday);
		case '3x':
			return ['Mon', 'Wed', 'Fri'].includes(weekday);
		case 'custom':
			return (customDays ?? []).includes(weekday);
		default:
			return false;
	}
}

/**
 * Calculates the current streak for a habit given its recent log entries.
 *
 * Strategy: sort logs newest-first, count consecutive "done" or "skipped"
 * entries from the top. A "missed" log breaks the streak.
 * Days with no log are simply absent (not scheduled or future) — they don't break it.
 *
 * @param logs - habit_logs rows for this habit, any date range
 * @returns integer streak count
 */
export function calculateStreak(logs: Array<{ date: string; status: string }>): number {
	const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
	let streak = 0;
	for (const log of sorted) {
		if (log.status === 'done' || log.status === 'skipped') {
			streak++;
		} else {
			// 'missed' breaks the chain
			break;
		}
	}
	return streak;
}

/**
 * Returns the display status of a habit for a specific date.
 *
 *   done         → logged as done
 *   skipped      → skipped (streak protection)
 *   missed       → was due, no log, date is in the past
 *   pending      → due today, not yet logged
 *   future       → scheduled but date hasn't arrived yet
 *   not-scheduled → habit isn't due on that weekday
 */
export type HeatmapStatus = 'done' | 'skipped' | 'missed' | 'pending' | 'future' | 'not-scheduled';

export function heatmapStatus(
	frequency: string,
	customDays: string[] | null,
	weekday: string,
	date: string,
	todayStr: string,
	log: { status: string } | null | undefined
): HeatmapStatus {
	if (!isDueOnDay(frequency, customDays, weekday)) return 'not-scheduled';
	if (log) return log.status as HeatmapStatus;
	if (date < todayStr) return 'missed';
	if (date === todayStr) return 'pending';
	return 'future';
}
