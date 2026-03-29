// This load function runs on EVERY page load because it's in the root layout.
// Its only job right now: make sure our single user exists before any page
// tries to reference user_id in a query.
//
// In multi-user apps this is where you'd validate a session cookie
// and redirect to /login if not authenticated.

import type { LayoutServerLoad } from './$types';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { DEFAULT_USER_ID } from '$lib/constants/user';

export const load: LayoutServerLoad = async () => {
	// INSERT ... ON CONFLICT DO NOTHING
	// Safe to call on every request — if the user already exists, it's a no-op.
	// This is the "upsert user on first visit" pattern for single-user apps.
	await db
		.insert(users)
		.values({
			id: DEFAULT_USER_ID,
			timezone: 'Asia/Kolkata'
		})
		.onConflictDoNothing();

	// Return empty for now.
	// In Phase 9 (auth) we'd return { user } so child load functions can access it
	// via parent() without hitting the DB again.
	return {};
};
