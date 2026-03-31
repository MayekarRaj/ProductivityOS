// IST = Asia/Kolkata = UTC+5:30
// All time-related functions in this file are IST-aware.
//
// Key concept: JavaScript's Date is always UTC internally.
// The Intl API lets us "view" that UTC instant in any timezone,
// so we use Intl.DateTimeFormat everywhere instead of manually
// adding/subtracting hours. Never hardcode +5.5 — IST is a half-hour offset.

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns today's date as YYYY-MM-DD in IST.
 *
 * Why not new Date().toISOString().split('T')[0]?
 * That gives the UTC date. At 23:45 UTC on March 6,
 * it's already 05:15 IST on March 7 — completely different day.
 * This function returns the correct IST date.
 */
export function getTodayDateIST(): string {
	const now = new Date();
	// 'en-CA' gives us YYYY-MM-DD format naturally
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: IST_TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
}

/**
 * Returns abbreviated weekday for a date string in IST.
 * e.g. "Mon", "Tue", ... "Sun"
 *
 * @param dateStr - YYYY-MM-DD string (optional — defaults to today)
 */
export function getWeekdayIST(dateStr?: string): string {
	// If dateStr is provided, parse it as IST midnight to avoid UTC day-shift.
	// Appending "+05:30" tells JS to interpret this as IST, not local time.
	const date = dateStr ? new Date(dateStr + 'T00:00:00+05:30') : new Date();
	return new Intl.DateTimeFormat('en-US', {
		timeZone: IST_TIMEZONE,
		weekday: 'short'
	}).format(date);
}

/**
 * Formats a YYYY-MM-DD date string as long human-readable text.
 * e.g. "Friday, March 6"
 */
export function formatDateLong(dateStr: string): string {
	const date = new Date(dateStr + 'T00:00:00+05:30');
	return new Intl.DateTimeFormat('en-US', {
		timeZone: IST_TIMEZONE,
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	}).format(date);
}

/**
 * Formats a UTC timestamp as HH:MM in IST.
 * Works with both Date objects and ISO strings.
 *
 * e.g. a UTC Date of 07:30 UTC → "13:00" IST
 */
export function formatTimeIST(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	return new Intl.DateTimeFormat('en-US', {
		timeZone: IST_TIMEZONE,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).format(d);
}

/**
 * Converts a datetime-local input value (IST) to a UTC Date.
 *
 * Why is this needed? HTML <input type="datetime-local"> gives us "2025-03-06T14:30"
 * with NO timezone info. JS would parse this as LOCAL server time (UTC).
 * Since our users are in IST, we must explicitly tell JS this is +05:30.
 */
export function istInputToUTC(localValue: string): Date {
	return new Date(localValue + ':00+05:30');
}

/**
 * Returns the Monday of the current IST week as YYYY-MM-DD.
 *
 * Why Monday? Our week grid runs Mon–Sun (ISO week convention).
 * Also used as the weekStartDate key in sunday_reviews.
 */
export function getMondayOfWeekIST(): string {
	const todayStr = getTodayDateIST();
	// Parse as IST midnight so we operate on the correct calendar day
	const today = new Date(todayStr + 'T00:00:00+05:30');

	// Get abbreviated weekday in IST — same Intl approach as getWeekdayIST()
	const weekdayShort = new Intl.DateTimeFormat('en-US', {
		timeZone: IST_TIMEZONE,
		weekday: 'short'
	}).format(today);

	// ISO week: Mon=0 … Sat=5, Sun=6
	// We subtract this many days from today to land on Monday
	const isoOffset: Record<string, number> = {
		Mon: 0,
		Tue: 1,
		Wed: 2,
		Thu: 3,
		Fri: 4,
		Sat: 5,
		Sun: 6
	};
	const offset = isoOffset[weekdayShort] ?? 0;
	const monday = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);

	return new Intl.DateTimeFormat('en-CA', {
		timeZone: IST_TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(monday);
}

/**
 * Returns the 7 dates (Mon–Sun) of the current IST week as YYYY-MM-DD strings.
 *
 * Index 0 = Monday, Index 6 = Sunday.
 * Used by the week view to build the day grid.
 */
export function getWeekDatesIST(): string[] {
	const mondayStr = getMondayOfWeekIST();
	const monday = new Date(mondayStr + 'T00:00:00+05:30');

	return Array.from({ length: 7 }, (_, i) => {
		const d = new Date(monday.getTime() + i * 24 * 60 * 60 * 1000);
		return new Intl.DateTimeFormat('en-CA', {
			timeZone: IST_TIMEZONE,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).format(d);
	});
}

/**
 * Returns yesterday's date as YYYY-MM-DD in IST.
 * Used by carry-forward: find incomplete tasks from the previous calendar day.
 */
export function getYesterdayDateIST(): string {
	const todayStr = getTodayDateIST();
	const today = new Date(todayStr + 'T00:00:00+05:30');
	const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: IST_TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(yesterday);
}

/**
 * Returns a greeting based on IST hour.
 * "Good morning" / "Good afternoon" / "Good evening" / "Good night"
 */
export function getGreetingIST(): string {
	const hourStr = new Intl.DateTimeFormat('en-US', {
		timeZone: IST_TIMEZONE,
		hour: 'numeric',
		hour12: false
	}).format(new Date());

	const hour = parseInt(hourStr);

	if (hour < 12) return 'Good morning';
	if (hour < 17) return 'Good afternoon';
	if (hour < 21) return 'Good evening';
	return 'Good night';
}
