// GET /api/ai/briefing
// Called client-side from the Today view when the user clicks "Generate briefing".
// Reads today's data from the DB, calls Groq, returns { briefing, suggestions }.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/db';
import { days, tasks, events } from '$lib/db/schema';
import { DEFAULT_USER_ID } from '$lib/constants/user';
import { getTodayDateIST, formatTimeIST } from '$lib/utils/dates';
import { areaFor } from '$lib/constants/areas';
import { areas } from '$lib/db/schema';
import { generateDailyBriefing } from '$lib/server/ai';

export const GET: RequestHandler = async () => {
	const todayStr = getTodayDateIST();

	const [day] = await db
		.select()
		.from(days)
		.where(and(eq(days.userId, DEFAULT_USER_ID), eq(days.date, todayStr)));

	if (!day) {
		return json({
			briefing: "No plan set for today yet. Add some tasks to get started!",
			suggestions: ["Set your home base for today", "Add your top 3 tasks", "Check your habits"]
		});
	}

	const [pendingTasks, todayEvents, userAreas] = await Promise.all([
		db.select().from(tasks).where(and(eq(tasks.dayId, day.id), eq(tasks.done, false))),
		db.select().from(events).where(eq(events.dayId, day.id)).orderBy(events.startsAt),
		db.select().from(areas).where(eq(areas.userId, DEFAULT_USER_ID))
	]);

	const homeArea = areaFor(day.homeBase, userAreas);

	const result = await generateDailyBriefing({
		homeBase: day.homeBase,
		homeBaseLabel: homeArea?.label ?? day.homeBase,
		energy: day.energy,
		pendingTasks: pendingTasks.map((t) => t.text),
		events: todayEvents.map((e) => ({ title: e.title, time: formatTimeIST(e.startsAt) })),
		todayStr,
		areaKeys: userAreas.map((a) => a.key)
	});

	return json(result);
};
