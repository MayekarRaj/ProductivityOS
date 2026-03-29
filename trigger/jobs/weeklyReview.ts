// Weekly review prompt — Sunday 7:00pm IST.
//
// Sends a prompt to do the Sunday review in the app.
// Sunday 7:00pm IST = Sunday 1:30pm UTC → cron "30 13 * * 0"

import { schedules } from '@trigger.dev/sdk/v3';
import { sendMessage } from '../utils/telegram';
import { getTelegramChatId } from '../utils/user';

export const weeklyReviewJob = schedules.task({
	id: 'weekly-review',
	// 1:30pm UTC on Sundays = 7:00pm IST on Sundays
	cron: '30 13 * * 0',

	run: async () => {
		const chatId = await getTelegramChatId();
		if (!chatId) return { skipped: 'no telegram linked' };

		await sendMessage(
			chatId,
			`📝 *Sunday Review time!*\n\nTake 10 minutes to reflect on the week:\n• What were the most important things you did?\n• What shifted or got delayed?\n• What's your fitness plan for next week?\n\nOpen the app → Week tab to fill in your review.`,
			'Markdown'
		);

		return { sent: true };
	}
});
