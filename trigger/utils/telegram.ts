// Telegram sendMessage for Trigger.dev tasks.
//
// Cannot import from src/lib/server/telegram.ts because that uses $env/dynamic/private.
// This version reads directly from process.env — same logic, different env source.

const getBaseUrl = () =>
	`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendMessage(
	chatId: string,
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
		const body = await res.text();
		console.error(`[telegram] sendMessage failed: ${res.status} — ${body}`);
	}
}
