// Helpers to look up the single user and their Telegram chat ID.

import { eq } from 'drizzle-orm';
import { db, users } from './db';

// Single-user app — this ID is seeded in the DB
export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

// Returns the user's Telegram chat ID, or null if the bot hasn't been linked yet.
// All cron jobs should call this first and bail if null — no point sending reminders
// to a chat that doesn't exist.
export async function getTelegramChatId(): Promise<string | null> {
	const [user] = await db
		.select({ telegramChatId: users.telegramChatId })
		.from(users)
		.where(eq(users.id, DEFAULT_USER_ID));

	return user?.telegramChatId ?? null;
}
