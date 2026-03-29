// Telegram Bot API client — thin wrapper around the HTTP API.
//
// Telegram's Bot API is just REST — no SDK needed.
// Every call is: POST https://api.telegram.org/bot<TOKEN>/<method>
//
// We only need two things for Phase 6:
//   sendMessage — send a text reply to a chat
//   the Update type — shape of incoming webhook payloads

import { env } from '$env/dynamic/private';

// Computed at call time so it picks up the env var even if loaded after bundle start
const getBaseUrl = () => `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

// ─── Types ────────────────────────────────────────────────────────────────────
// Telegram sends us an "Update" object on each incoming message.
// We only type the fields we actually use — no need to type the full spec.

export interface TelegramUpdate {
	update_id: number;
	message?: TelegramMessage;
}

export interface TelegramMessage {
	message_id: number;
	chat: { id: number };
	from?: { id: number; username?: string; first_name?: string };
	text?: string; // undefined for photos, stickers, etc.
	date: number; // unix timestamp
}

// ─── sendMessage ─────────────────────────────────────────────────────────────
// Sends a plain-text (or Markdown) message to a Telegram chat.
//
// parse_mode: 'Markdown' lets us use *bold*, `code`, etc. in replies.
// We default to plain text and opt-in per call.

export async function sendMessage(
	chatId: number,
	text: string,
	parseMode: 'Markdown' | 'HTML' | undefined = undefined
): Promise<void> {
	const res = await fetch(`${getBaseUrl()}/sendMessage`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			chat_id: chatId,
			text,
			...(parseMode && { parse_mode: parseMode })
		})
	});

	if (!res.ok) {
		// Log but don't throw — a failed reply shouldn't crash the webhook handler.
		// Telegram will retry the webhook if we return a non-2xx status, which
		// would cause an infinite loop. Always return 200, log errors server-side.
		const body = await res.text();
		console.error(`[telegram] sendMessage failed: ${res.status} — ${body}`);
	}
}
