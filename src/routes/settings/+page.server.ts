import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/db';
import { areas, tasks, events, habits, users } from '$lib/db/schema';
import { DEFAULT_USER_ID } from '$lib/constants/user';

// Slugify a label into a key: "My Area" → "my_area"
function toKey(label: string): string {
	return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export const actions: Actions = {
	// ── Add a new area ────────────────────────────────────────────────────────
	addArea: async ({ request }) => {
		const data = await request.formData();
		const label = (data.get('label') as string)?.trim();
		const emoji = (data.get('emoji') as string)?.trim() || '📌';
		const color = data.get('color') as string;

		if (!label) return fail(400, { error: 'Label is required' });
		if (!color) return fail(400, { error: 'Color is required' });

		const key = toKey(label);
		if (!key) return fail(400, { error: 'Label must contain letters or numbers' });

		// Check for key collision
		const [existing] = await db
			.select()
			.from(areas)
			.where(and(eq(areas.userId, DEFAULT_USER_ID), eq(areas.key, key)));
		if (existing) return fail(400, { error: `An area with key "${key}" already exists` });

		const allAreas = await db.select().from(areas).where(eq(areas.userId, DEFAULT_USER_ID));

		await db.insert(areas).values({
			userId: DEFAULT_USER_ID,
			key,
			label,
			emoji,
			color,
			sortOrder: allAreas.length
		});
	},

	// ── Update label / emoji / color ─────────────────────────────────────────
	updateArea: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		const label = (data.get('label') as string)?.trim();
		const emoji = (data.get('emoji') as string)?.trim() || '📌';
		const color = data.get('color') as string;

		if (!label) return fail(400, { error: 'Label is required' });

		await db.update(areas).set({ label, emoji, color }).where(eq(areas.id, id));
	},

	// ── Suspend (hide from pickers but keep history) ─────────────────────────
	suspendArea: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		await db.update(areas).set({ suspended: true }).where(eq(areas.id, id));
	},

	// ── Unsuspend ────────────────────────────────────────────────────────────
	unsuspendArea: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		await db.update(areas).set({ suspended: false }).where(eq(areas.id, id));
	},

	// ── Reorder areas by drag-and-drop ───────────────────────────────────────
	// Receives a JSON array of area IDs in the new order.
	reorderAreas: async ({ request }) => {
		const data = await request.formData();
		const ordered = JSON.parse((data.get('ordered') as string) ?? '[]') as string[];
		// Update sortOrder for each area in parallel
		await Promise.all(
			ordered.map((id, index) =>
				db.update(areas).set({ sortOrder: index }).where(eq(areas.id, id))
			)
		);
	},

	// ── Update default schedule ───────────────────────────────────────────────
	updateSchedule: async ({ request }) => {
		const data = await request.formData();
		const workdayStart = (data.get('workdayStart') as string) || '09:00';
		const workdayEnd = (data.get('workdayEnd') as string) || '18:00';
		await db.update(users).set({ workdayStart, workdayEnd }).where(eq(users.id, DEFAULT_USER_ID));
	},

	// ── Update preferences (autoFocusMode, weekendThreshold) ─────────────────
	updatePreferences: async ({ request }) => {
		const data = await request.formData();
		const autoFocusMode = data.get('autoFocusMode') === 'true';
		const weekendThreshold = (data.get('weekendThreshold') as string) || '14:00';
		await db.update(users).set({ autoFocusMode, weekendThreshold }).where(eq(users.id, DEFAULT_USER_ID));
	},

	// ── Delete — only allowed if no tasks, events, or habits reference it ────
	deleteArea: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		const key = data.get('key') as string;

		// Check for references across all three tables
		const [refTask] = await db.select().from(tasks).where(eq(tasks.area, key)).limit(1);
		const [refEvent] = await db.select().from(events).where(eq(events.area, key)).limit(1);
		const [refHabit] = await db.select().from(habits).where(eq(habits.area, key)).limit(1);

		if (refTask || refEvent || refHabit) {
			return fail(400, {
				deleteError: `"${key}" is still referenced by existing tasks, events, or habits. Suspend it instead.`
			});
		}

		await db.delete(areas).where(eq(areas.id, id));
	}
};
