// Telegram webhook endpoint — POST /api/telegram
//
// How webhooks work:
//   1. We register our URL with Telegram (once, via their API).
//   2. Every time someone messages our bot, Telegram POSTs an Update JSON here.
//   3. We must respond with HTTP 200 quickly (< 5s), or Telegram retries.
//
// Security: Telegram lets you set a secret token when registering the webhook.
// It sends it back as X-Telegram-Bot-Api-Secret-Token on every request.
// We reject anything that doesn't match — prevents spoofed webhook calls.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { eq, and } from 'drizzle-orm';

import { db } from '$lib/db';
import { users, tasks, events, days, inboxItems, telegramConversations } from '$lib/db/schema';
import { DEFAULT_USER_ID } from '$lib/constants/user';
import { sendMessage, type TelegramUpdate } from '$lib/server/telegram';
import { parseMessage, parseTimeOnly } from '$lib/server/ai';
import { getTodayDateIST, formatTimeIST, istInputToUTC } from '$lib/utils/dates';

export const POST: RequestHandler = async ({ request }) => {
	// ── 1. Verify the secret header ──────────────────────────────────────────
	const secret = request.headers.get('x-telegram-bot-api-secret-token');
	if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
		return new Response('Forbidden', { status: 403 });
	}

	// ── 2. Parse the Update payload ──────────────────────────────────────────
	let update: TelegramUpdate;
	try {
		update = await request.json();
	} catch {
		return new Response('Bad Request', { status: 400 });
	}

	const message = update.message;
	if (!message?.text) return json({ ok: true });

	const chatId = message.chat.id;
	const text = message.text.trim();

	// ── 3. Route to command handlers ─────────────────────────────────────────
	// Structured commands are parsed deterministically (no LLM).
	// Natural language falls through to the AI handler.
	if (text.startsWith('/start')) {
		await handleStart(chatId);
	} else if (text.startsWith('/briefing')) {
		await handleBriefing(chatId);
	} else if (text.startsWith('/task ')) {
		await handleTaskCommand(chatId, text.slice(6).trim());
	} else if (text.startsWith('/event ')) {
		await handleEventCommand(chatId, text.slice(7).trim());
	} else if (text === '/help') {
		await handleHelp(chatId);
	} else {
		// Natural language — goes through Groq AI parser + state machine
		await handleMessage(chatId, text);
	}

	return json({ ok: true });
};

// ─── Conversation state helpers ───────────────────────────────────────────────
// The telegram_conversations table stores one row per user.
// `state` tracks where we are in a multi-turn flow.
// `context` (jsonb) holds partial data between turns.
//
// States:
//   idle                — normal, parse each message fresh
//   awaiting_event_time — got event title but no time, waiting for user's reply

interface PendingEvent {
	title: string;
	area: string | null;
	date: string;
	endTimeStr: string | null;
	remindOffsetMin: number;
}

interface ConversationContext {
	pendingEvent?: PendingEvent;
}

async function getConversation(): Promise<{ state: string; context: ConversationContext }> {
	const [conv] = await db
		.select()
		.from(telegramConversations)
		.where(eq(telegramConversations.userId, DEFAULT_USER_ID));

	if (!conv) {
		// First time — create the row
		const [created] = await db
			.insert(telegramConversations)
			.values({ userId: DEFAULT_USER_ID, state: 'idle', context: {} })
			.returning();
		return { state: created.state, context: (created.context as ConversationContext) ?? {} };
	}

	return { state: conv.state, context: (conv.context as ConversationContext) ?? {} };
}

async function setConversation(state: string, context: ConversationContext): Promise<void> {
	await db
		.insert(telegramConversations)
		.values({ userId: DEFAULT_USER_ID, state, context })
		.onConflictDoUpdate({
			target: telegramConversations.userId,
			set: { state, context, updatedAt: new Date() }
		});
}

async function resetConversation(): Promise<void> {
	await setConversation('idle', {});
}

// ─── getOrCreateDay ───────────────────────────────────────────────────────────
// Shared pattern: ensure a days row exists for a given YYYY-MM-DD date.
// Returns the existing row or creates a new one with default homeBase.

async function getOrCreateDay(dateStr: string) {
	const [existing] = await db
		.select()
		.from(days)
		.where(and(eq(days.userId, DEFAULT_USER_ID), eq(days.date, dateStr)));

	if (existing) return existing;

	const [created] = await db
		.insert(days)
		.values({ userId: DEFAULT_USER_ID, date: dateStr, homeBase: 'getfly' })
		.returning();

	return created;
}

// ─── handleMessage ────────────────────────────────────────────────────────────
// The main AI-powered handler. Called for every non-command message.
// Implements a 2-state machine: idle and awaiting_event_time.

async function handleMessage(chatId: number, text: string): Promise<void> {
	const { state, context } = await getConversation();

	// ── State: awaiting_event_time ──────────────────────────────────────────
	// The previous turn got an event but no time. We asked "What time?".
	// This message should contain the time.

	if (state === 'awaiting_event_time' && context.pendingEvent) {
		const timeStr = await parseTimeOnly(text);

		if (!timeStr) {
			await sendMessage(chatId, "I couldn't read that as a time. Try something like \"3pm\" or \"14:30\".");
			return;
		}

		// Merge time into the saved partial event and save it
		await saveEvent(chatId, { ...context.pendingEvent, timeStr });
		await resetConversation();
		return;
	}

	// ── State: idle ─────────────────────────────────────────────────────────
	// Parse the message fresh with Claude

	const todayStr = getTodayDateIST();
	let parsed;

	try {
		parsed = await parseMessage(text, todayStr);
	} catch (err) {
		console.error('[ai] parseMessage failed:', err);
		await sendMessage(chatId, "Sorry, I couldn't process that. Try again.");
		return;
	}

	switch (parsed.intent) {
		case 'task': {
			if (!parsed.task) {
				await sendMessage(chatId, parsed.replyText || "Couldn't extract the task. Try again.");
				return;
			}
			const day = await getOrCreateDay(parsed.task.date);
			await db.insert(tasks).values({
				userId: DEFAULT_USER_ID,
				dayId: day.id,
				text: parsed.task.text,
				area: parsed.task.area,
				source: 'telegram'
			});
			const isToday = parsed.task.date === todayStr;
			await sendMessage(
				chatId,
				`✅ Task added${isToday ? ' for today' : ` for ${parsed.task.date}`}: *${parsed.task.text}*`,
				'Markdown'
			);
			break;
		}

		case 'event': {
			if (!parsed.event) {
				await sendMessage(chatId, parsed.replyText || "Couldn't extract the event. Try again.");
				return;
			}

			// Time is missing — ask and save partial state for next turn
			if (parsed.missingFields.includes('time') || !parsed.event.timeStr) {
				await setConversation('awaiting_event_time', {
					pendingEvent: {
						title: parsed.event.title,
						area: parsed.event.area,
						date: parsed.event.date,
						endTimeStr: parsed.event.endTimeStr,
						remindOffsetMin: parsed.event.remindOffsetMin
					}
				});
				await sendMessage(chatId, `What time is *${parsed.event.title}*?`, 'Markdown');
				return;
			}

			// All data present — save immediately
			await saveEvent(chatId, { ...parsed.event, timeStr: parsed.event.timeStr });
			break;
		}

		case 'inbox': {
			// Ambiguous or vague — save to inbox for later review
			const itemText = text;
			await db.insert(inboxItems).values({
				userId: DEFAULT_USER_ID,
				text: itemText,
				source: 'telegram'
			});
			await sendMessage(chatId, `📥 Saved to inbox: *${itemText}*\n\nOpen the app to process it.`, 'Markdown');
			break;
		}

		case 'unclear': {
			await sendMessage(chatId, parsed.replyText || "I didn't understand that. Try:\n• \"add task review roadmap\"\n• \"meeting with client at 3pm\"\n• /briefing");
			break;
		}
	}
}

// ─── saveEvent ────────────────────────────────────────────────────────────────
// Shared between direct save (all fields present) and multi-turn save (after asking for time).
// Builds the UTC timestamps and inserts the event row.

async function saveEvent(
	chatId: number,
	eventData: PendingEvent & { timeStr: string }
): Promise<void> {
	const day = await getOrCreateDay(eventData.date);

	// Combine date + time into IST datetime string, then convert to UTC
	// istInputToUTC expects "YYYY-MM-DDTHH:MM"
	const startsAt = istInputToUTC(`${eventData.date}T${eventData.timeStr}`);
	const endsAt = eventData.endTimeStr
		? istInputToUTC(`${eventData.date}T${eventData.endTimeStr}`)
		: null;
	const remindAt = new Date(startsAt.getTime() - eventData.remindOffsetMin * 60 * 1000);

	await db.insert(events).values({
		userId: DEFAULT_USER_ID,
		dayId: day.id,
		title: eventData.title,
		area: eventData.area,
		startsAt,
		endsAt,
		remindAt,
		source: 'telegram'
	});

	const timeDisplay = formatTimeIST(startsAt);
	const isToday = eventData.date === getTodayDateIST();
	const dayLabel = isToday ? 'today' : eventData.date;

	await sendMessage(
		chatId,
		`📅 Event added for ${dayLabel} at ${timeDisplay}: *${eventData.title}*`,
		'Markdown'
	);
}

// ─── /start ──────────────────────────────────────────────────────────────────

async function handleStart(chatId: number): Promise<void> {
	await db
		.update(users)
		.set({ telegramChatId: String(chatId) })
		.where(eq(users.id, DEFAULT_USER_ID));

	await sendMessage(
		chatId,
		`✅ *Linked!* Your Telegram is now connected to your Planner.\n\nTry /briefing to see today's schedule, or just tell me what to add.`,
		'Markdown'
	);
}

// ─── /briefing ───────────────────────────────────────────────────────────────

async function handleBriefing(chatId: number): Promise<void> {
	const todayStr = getTodayDateIST();

	const [day] = await db
		.select()
		.from(days)
		.where(and(eq(days.userId, DEFAULT_USER_ID), eq(days.date, todayStr)));

	if (!day) {
		await sendMessage(chatId, "No plan for today yet. Open the app first to create today's entry.");
		return;
	}

	const [todayTasks, todayEvents] = await Promise.all([
		db.select().from(tasks).where(eq(tasks.dayId, day.id)),
		db.select().from(events).where(eq(events.dayId, day.id)).orderBy(events.startsAt)
	]);

	const lines: string[] = [`📅 *Briefing for today*`];

	if (todayEvents.length > 0) {
		lines.push('\n🗓 *Schedule*');
		for (const event of todayEvents) {
			const time = formatTimeIST(event.startsAt);
			const end = event.endsAt ? ` → ${formatTimeIST(event.endsAt)}` : '';
			lines.push(`  ${time}${end} — ${event.title}`);
		}
	}

	const pending = todayTasks.filter((t) => !t.done);
	const done = todayTasks.filter((t) => t.done);

	if (pending.length > 0) {
		lines.push('\n📋 *Tasks*');
		for (const task of pending) lines.push(`  • ${task.text}`);
	}

	if (done.length > 0) {
		lines.push(`\n✓ ${done.length} task${done.length > 1 ? 's' : ''} completed`);
	}

	if (todayEvents.length === 0 && pending.length === 0) {
		lines.push('\nNothing planned yet. Open the app to add tasks and events.');
	}

	await sendMessage(chatId, lines.join('\n'), 'Markdown');
}

// ─── /task <text> [| area] [| day] ───────────────────────────────────────────
// Deterministic task creation — no LLM needed.
//
// Format:  /task review roadmap
//          /task review roadmap | getfly
//          /task review roadmap | getfly | tomorrow
//
// Fields:  text (required) | area (optional) | day offset (optional)
//   day accepts: today, tomorrow, or a number like +2

async function handleTaskCommand(chatId: number, args: string): Promise<void> {
	// Split on | and trim each part
	const parts = args.split('|').map((p) => p.trim());
	const text = parts[0];
	if (!text) {
		await sendMessage(chatId, 'Usage: `/task <text> | <area> | <day>`\nExample: `/task review roadmap | getfly | tomorrow`', 'Markdown');
		return;
	}

	const area = parseAreaArg(parts[1]);
	const date = parseDayArg(parts[2]);

	const day = await getOrCreateDay(date);
	await db.insert(tasks).values({
		userId: DEFAULT_USER_ID,
		dayId: day.id,
		text,
		area,
		source: 'telegram'
	});

	const todayStr = getTodayDateIST();
	const dayLabel = date === todayStr ? 'today' : date;
	await sendMessage(chatId, `✅ Task added for ${dayLabel}: *${text}*`, 'Markdown');
}

// ─── /event <title> | <time> [| area] [| remind_offset_min] ─────────────────
// Deterministic event creation — no LLM needed.
//
// Format:  /event Mirai call | 3pm
//          /event Mirai call | 3pm | mirai
//          /event Mirai call | 3pm | mirai | 15
//          /event Mirai call | 3pm-4pm | mirai

async function handleEventCommand(chatId: number, args: string): Promise<void> {
	const parts = args.split('|').map((p) => p.trim());
	const title = parts[0];
	const timeArg = parts[1];

	if (!title || !timeArg) {
		await sendMessage(chatId, 'Usage: `/event <title> | <time> | <area> | <remind_min>`\nExample: `/event Mirai call | 3pm | mirai`', 'Markdown');
		return;
	}

	// Support "3pm-4pm" as a shorthand for start-end time
	const timeParts = timeArg.split('-');
	const timeStr = parseTimeArg(timeParts[0].trim());
	const endTimeStr = timeParts[1] ? parseTimeArg(timeParts[1].trim()) : null;

	if (!timeStr) {
		await sendMessage(chatId, `Couldn't parse time "${timeArg}". Try formats like: 3pm, 14:30, 9am`);
		return;
	}

	const area = parseAreaArg(parts[2]);
	const remindOffsetMin = parts[3] ? parseInt(parts[3]) || 5 : 5;
	const date = getTodayDateIST();

	await saveEvent(chatId, { title, area, date, timeStr, endTimeStr, remindOffsetMin });
}

// ─── /help ───────────────────────────────────────────────────────────────────

async function handleHelp(chatId: number): Promise<void> {
	await sendMessage(
		chatId,
		`*Commands*

/briefing — today's tasks and events

*Structured (instant, no AI):*
/task review roadmap
/task review roadmap | getfly | tomorrow

/event Mirai call | 3pm
/event Mirai call | 3pm | mirai
/event Mirai call | 3pm-4pm | mirai | 15

*Natural language (via AI):*
"add task review Getfly roadmap today"
"schedule a meeting with Mirai at 3pm"
"need to think about pricing" → saved to inbox

*Areas:* job · getfly · mirai · vamoss · fitness · personal`,
		'Markdown'
	);
}

// ─── Argument parsers ─────────────────────────────────────────────────────────
// Small helpers used by the structured command handlers.

// Validates an area key — returns null if unrecognised
function parseAreaArg(raw: string | undefined): string | null {
	if (!raw) return null;
	const valid = ['job', 'getfly', 'mirai', 'vamoss', 'fitness', 'personal'];
	const lower = raw.toLowerCase().trim();
	return valid.includes(lower) ? lower : null;
}

// Parses "today" / "tomorrow" / "+N" into a YYYY-MM-DD IST date string
function parseDayArg(raw: string | undefined): string {
	const today = getTodayDateIST();
	if (!raw) return today;
	const lower = raw.toLowerCase().trim();
	if (lower === 'today' || lower === '') return today;

	// Calculate offset from today's IST date
	let offset = 0;
	if (lower === 'tomorrow') offset = 1;
	else if (lower === 'yesterday') offset = -1;
	else if (/^[+-]?\d+$/.test(lower)) offset = parseInt(lower);

	if (offset === 0) return today;
	// Add offset days — parse as IST midnight to avoid UTC day-shift
	const base = new Date(today + 'T00:00:00+05:30');
	base.setDate(base.getDate() + offset);
	return base.toISOString().split('T')[0];
}

// Parses "3pm", "3:30pm", "14:30", "9am" → "HH:MM" (24h)
// Returns null if unparseable
function parseTimeArg(raw: string): string | null {
	if (!raw) return null;
	const s = raw.toLowerCase().trim();

	// Already 24h format: "14:30"
	const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
	if (h24) {
		const h = parseInt(h24[1]);
		const m = parseInt(h24[2]);
		if (h >= 0 && h <= 23 && m >= 0 && m <= 59)
			return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
	}

	// 12h format: "3pm", "3:30pm", "3:30 pm"
	const h12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
	if (h12) {
		let h = parseInt(h12[1]);
		const m = parseInt(h12[2] ?? '0');
		const ampm = h12[3];
		if (ampm === 'pm' && h !== 12) h += 12;
		if (ampm === 'am' && h === 12) h = 0;
		if (h >= 0 && h <= 23 && m >= 0 && m <= 59)
			return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
	}

	return null;
}
