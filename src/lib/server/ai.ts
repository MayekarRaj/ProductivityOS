// AI service module — Groq-powered message parsing.
//
// Uses Groq's API directly via fetch (OpenAI-compatible format).
// We skip the Vercel AI SDK for this module because its structured output
// support requires json_schema which Groq only supports on specific models.
//
// Instead: we send the model a JSON schema in the system prompt and ask it
// to respond with a JSON object. Then we parse and validate the response.

import { env } from '$env/dynamic/private';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AreaKey = 'job' | 'getfly' | 'mirai' | 'vamoss' | 'fitness' | 'personal';

export interface ParsedMessage {
	intent: 'task' | 'event' | 'inbox' | 'unclear';
	task?: {
		text: string;
		area: AreaKey | null;
		date: string; // YYYY-MM-DD
	};
	event?: {
		title: string;
		area: AreaKey | null;
		date: string; // YYYY-MM-DD
		timeStr: string | null; // HH:MM 24h, null if not mentioned
		endTimeStr: string | null;
		remindOffsetMin: number;
	};
	missingFields: string[]; // e.g. ["time"] triggers multi-turn follow-up
	replyText: string; // used when clarification is needed
}

// ─── callGroq ────────────────────────────────────────────────────────────────
// Raw fetch to Groq chat completions with response_format: json_object.
// The model is instructed to return JSON matching our schema.

async function callGroq(systemPrompt: string, userMessage: string): Promise<string> {
	const res = await fetch(GROQ_API_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.GROQ_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: MODEL,
			// json_object tells Groq to return valid JSON — supported by all models
			response_format: { type: 'json_object' },
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userMessage }
			],
			temperature: 0.1 // low temperature = more deterministic output
		})
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Groq API error ${res.status}: ${body}`);
	}

	const data = await res.json();
	return data.choices[0].message.content;
}

// ─── parseMessage ─────────────────────────────────────────────────────────────
// Takes a raw Telegram message and today's IST date string.
// Returns structured intent + entity data.

export async function parseMessage(userText: string, todayStr: string): Promise<ParsedMessage> {
	const systemPrompt = `You are a productivity assistant parsing messages for a personal planner app.
Today's date: ${todayStr} (IST, Asia/Kolkata timezone)

The user's 6 life/work areas (use exact keys):
- job       → Lumeglobal (full-time job)
- getfly    → Getfly (his startup)
- mirai     → Mirai (freelance client)
- vamoss    → Vamoss (freelance client)
- fitness   → Fitness & health
- personal  → Personal growth

Respond ONLY with a JSON object matching this exact structure:
{
  "intent": "task" | "event" | "inbox" | "unclear",
  "task": { "text": string, "area": string|null, "date": "YYYY-MM-DD" } | null,
  "event": { "title": string, "area": string|null, "date": "YYYY-MM-DD", "timeStr": "HH:MM"|null, "endTimeStr": "HH:MM"|null, "remindOffsetMin": number } | null,
  "missingFields": string[],
  "replyText": string
}

Rules:
- intent=task: a to-do with no specific time ("add task", "remind me to", "I need to")
- intent=event: something at a specific time ("meeting", "call", "at 3pm", "schedule")
- intent=inbox: vague or uncertain — save for later review
- intent=unclear: cannot parse — set replyText to ask for clarification
- For events, if no time mentioned: set timeStr to null and add "time" to missingFields
- Dates: "today"=${todayStr}, "tomorrow"=next day. Default to today if unspecified.
- Times: "3pm"="15:00", "3:30pm"="15:30", "9am"="09:00"
- Default remindOffsetMin to 5
- Area: match company/area names to keys. null if unclear.
- task and event fields: set to null when not relevant to the intent`;

	const raw = await callGroq(systemPrompt, userText);
	const parsed = JSON.parse(raw) as ParsedMessage;

	// Ensure arrays are never undefined
	if (!parsed.missingFields) parsed.missingFields = [];
	if (!parsed.replyText) parsed.replyText = '';

	return parsed;
}

// ─── generateDailyBriefing ────────────────────────────────────────────────────
// Called from the /api/ai/briefing endpoint when the user clicks "Generate".
// Returns a short contextual briefing + 2-3 task suggestions for the day.

export async function generateDailyBriefing(context: {
	homeBase: string;
	homeBaseLabel: string;
	energy: string | null;
	pendingTasks: string[];
	events: Array<{ title: string; time: string }>;
	todayStr: string;
}): Promise<{ briefing: string; suggestions: string[] }> {
	const systemPrompt = `You are a personal productivity coach for a builder managing multiple projects (startup, freelance clients, fitness, personal growth).
Generate a short daily briefing and task suggestions.
Respond ONLY with JSON: {"briefing": string, "suggestions": string[]}
- briefing: 2-3 sentences. Practical, specific to the data. Reference real tasks/events if present.
- suggestions: exactly 2-3 short action phrases tailored to the home base area. No fluff.`;

	const userMsg = `Date: ${context.todayStr}
Home base: ${context.homeBaseLabel} (${context.homeBase})
Energy: ${context.energy ?? 'not set'}
Pending tasks (${context.pendingTasks.length}): ${context.pendingTasks.slice(0, 6).join(' | ') || 'none'}
Events: ${context.events.map((e) => `${e.title} at ${e.time}`).join(', ') || 'none'}`;

	const raw = await callGroq(systemPrompt, userMsg);
	const parsed = JSON.parse(raw);
	return {
		briefing: parsed.briefing ?? '',
		suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : []
	};
}

// ─── generateSundayReviewDraft ────────────────────────────────────────────────
// Pre-fills the three Sunday review prompts based on the week's data.

export async function generateSundayReviewDraft(context: {
	weekStart: string;
	weekEnd: string;
	tasksDone: number;
	mvdDays: number;
	habitsCompleted: number;
	pomodoros: number;
	topAreas: string[];
	dayNotes: string[];
}): Promise<{ importantThings: string; deadlineShifts: string; fitnessPlan: string }> {
	const systemPrompt = `You are helping write a personal Sunday weekly review.
Generate honest, reflective text for 3 prompts based on the week's data.
Respond ONLY with JSON: {"importantThings": string, "deadlineShifts": string, "fitnessPlan": string}
- Each field: 2-4 sentences, first-person ("I"), specific, not overly positive.
- importantThings: what was actually accomplished or mattered.
- deadlineShifts: what slipped, got delayed, or changed — be candid.
- fitnessPlan: practical fitness/wellness plan for next week.`;

	const userMsg = `Week: ${context.weekStart} → ${context.weekEnd}
Tasks done: ${context.tasksDone}
MVD days: ${context.mvdDays}/7
Habits logged: ${context.habitsCompleted}
Pomodoros: ${context.pomodoros}
Most active areas: ${context.topAreas.join(', ') || 'none recorded'}
Day notes: ${context.dayNotes.filter(Boolean).join(' | ') || 'none'}`;

	const raw = await callGroq(systemPrompt, userMsg);
	const parsed = JSON.parse(raw);
	return {
		importantThings: parsed.importantThings ?? '',
		deadlineShifts: parsed.deadlineShifts ?? '',
		fitnessPlan: parsed.fitnessPlan ?? ''
	};
}

// ─── parseTimeOnly ────────────────────────────────────────────────────────────
// Used in multi-turn: when the bot asked "What time?" and the user replies
// with just "3pm" or "half past 2", extract just the time string.

export async function parseTimeOnly(userText: string): Promise<string | null> {
	const raw = await callGroq(
		'Extract a time from the user message and return JSON: {"timeStr": "HH:MM"} in 24h format, or {"timeStr": null} if no time found.',
		userText
	);
	const parsed = JSON.parse(raw) as { timeStr: string | null };
	return parsed.timeStr ?? null;
}
