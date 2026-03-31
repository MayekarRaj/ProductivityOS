import type { LayoutServerLoad } from './$types';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/db';
import { users, areas } from '$lib/db/schema';
import { DEFAULT_USER_ID } from '$lib/constants/user';
import { INITIAL_AREAS } from '$lib/constants/areas';

export const load: LayoutServerLoad = async () => {
	// Ensure the default user exists on every request (no-op if already there)
	await db.insert(users).values({ id: DEFAULT_USER_ID, timezone: 'Asia/Kolkata' }).onConflictDoNothing();

	// Fetch the user row so all pages have access to preferences (workdayStart, currentFocus, etc.)
	const [user] = await db.select().from(users).where(eq(users.id, DEFAULT_USER_ID));

	// Load all areas (active + suspended) for this user
	let areaRows = await db
		.select()
		.from(areas)
		.where(eq(areas.userId, DEFAULT_USER_ID))
		.orderBy(areas.sortOrder, areas.createdAt);

	// Seed the 6 default areas on first run
	if (areaRows.length === 0) {
		areaRows = await db
			.insert(areas)
			.values(INITIAL_AREAS.map((a) => ({ ...a, userId: DEFAULT_USER_ID })))
			.returning();
	}

	// Return user and areas to all child pages — every page gets data.user and data.areas automatically
	return { user, areas: areaRows };
};
