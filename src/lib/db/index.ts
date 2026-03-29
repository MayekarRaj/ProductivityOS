// ⚠️ SERVER ONLY — never import this in a .svelte file or client-side code
// SvelteKit will throw a build error if you try (because DATABASE_URL is private)

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DATABASE_URL } from '$env/static/private';
import * as schema from './schema';

// postgres() creates a connection pool.
// For Vercel serverless functions, we use the Supabase Transaction Pooler (port 6543)
// because serverless functions can't hold persistent DB connections — they spin up
// and down on every request. The pooler handles connection management for us.
const client = postgres(DATABASE_URL);

// drizzle() wraps the client and attaches our schema for type-safe queries.
// Passing { schema } enables relational queries (db.query.users.findMany etc.)
export const db = drizzle(client, { schema });
