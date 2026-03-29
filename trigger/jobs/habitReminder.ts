// Habit reminder cron — 9:00pm IST daily.
//
// Checks which habits were due today but not yet logged, sends a nudge.
// IST = UTC+5:30, so 9:00pm IST = 3:30pm UTC → cron "30 15 * * *"

import { schedules } from '@trigger.dev/sdk/v3';
import { eq, and } from 'drizzle-orm';
import { db, habits, habitLogs } from '../utils/db';
import { sendMessage } from '../utils/telegram';
import { getTelegramChatId, DEFAULT_USER_ID } from '../utils/user';

function getTodayIST(): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Kolkata',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date());
}

// Returns abbreviated weekday in IST: "Mon", "Tue", etc.
function getWeekdayIST(): string {
	return new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Kolkata',
		weekday: 'short'
	}).format(new Date());
}

// Whether a habit is due on a given weekday based on its frequency
function isDueToday(
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
			// Mon, Wed, Fri by convention
			return ['Mon', 'Wed', 'Fri'].includes(weekday);
		case 'custom':
			return (customDays ?? []).includes(weekday);
		default:
			return false;
	}
}

export const habitReminderJob = schedules.task({
	id: 'habit-reminder',
	// 3:30pm UTC = 9:00pm IST
	cron: '30 15 * * *',

	run: async () => {
		const chatId = await getTelegramChatId();
		if (!chatId) return { skipped: 'no telegram linked' };

		const todayStr = getTodayIST();
		const weekday = getWeekdayIST();

		// Get all active habits for the user
		const allHabits = await db
			.select()
			.from(habits)
			.where(and(eq(habits.userId, DEFAULT_USER_ID), eq(habits.archived, false)));

		// Filter to habits due today
		const dueToday = allHabits.filter((h) =>
			isDueToday(h.frequency, h.customDays ?? null, weekday)
		);

		if (dueToday.length === 0) return { skipped: 'no habits due today' };

		// Get logs for today — these are the ones already done
		const todayLogs = await db
			.select()
			.from(habitLogs)
			.where(eq(habitLogs.date, todayStr));

		const loggedHabitIds = new Set(todayLogs.map((l) => l.habitId));

		// Habits due today that haven't been logged yet
		const pending = dueToday.filter((h) => !loggedHabitIds.has(h.id));

		if (pending.length === 0) {
			await sendMessage(chatId, `✅ All habits done for today! Great work.`);
			return { allDone: true };
		}

		const lines = [`🔁 *${pending.length} habit${pending.length > 1 ? 's' : ''} left for today:*`];
		for (const habit of pending) lines.push(`  • ${habit.name}`);
		lines.push('\nOpen the app to log them!');

		await sendMessage(chatId, lines.join('\n'), 'Markdown');
		return { sent: true, pending: pending.length };
	}
});
