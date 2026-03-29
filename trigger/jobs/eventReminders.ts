// Event reminder job — runs every minute.
//
// Finds events where remind_at has passed but the reminder hasn't been sent yet,
// sends a Telegram message, then marks the event as reminded.
//
// This covers both 8.2 (event reminders) and 8.6 (pre-event reminders) —
// the remind_at field is set at event creation (default: 5 min before start).

import { schedules } from '@trigger.dev/sdk/v3';
import { lte, eq, and } from 'drizzle-orm';
import { db, events } from '../utils/db';
import { sendMessage } from '../utils/telegram';
import { getTelegramChatId } from '../utils/user';

export const eventReminderJob = schedules.task({
	id: 'event-reminders',
	// Run every minute
	cron: '* * * * *',

	run: async () => {
		const chatId = await getTelegramChatId();
		if (!chatId) return { skipped: 'no telegram linked' };

		// Find all events whose remind_at has passed and haven't been reminded yet
		const pending = await db
			.select()
			.from(events)
			.where(
				and(
					lte(events.remindAt, new Date()),
					eq(events.reminded, false)
				)
			);

		if (pending.length === 0) return { sent: 0 };

		for (const event of pending) {
			const now = new Date();
			const startsAt = new Date(event.startsAt);
			const minsUntil = Math.round((startsAt.getTime() - now.getTime()) / 60000);

			let message: string;
			if (minsUntil <= 0) {
				message = `🔔 *${event.title}* is starting now!`;
			} else if (minsUntil <= 60) {
				message = `🔔 *${event.title}* starts in ${minsUntil} min`;
			} else {
				message = `🔔 Reminder: *${event.title}*`;
			}

			await sendMessage(chatId, message, 'Markdown');

			// Mark as reminded so we don't send again
			await db
				.update(events)
				.set({ reminded: true })
				.where(eq(events.id, event.id));
		}

		return { sent: pending.length };
	}
});
