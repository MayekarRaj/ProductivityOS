// Drizzle DB connection for Trigger.dev tasks.
//
// Trigger.dev tasks run outside SvelteKit — no $env/dynamic/private, no $lib aliases.
// We connect to the DB directly via process.env and use relative imports for the schema.

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../src/lib/db/schema';

// Each task invocation gets a fresh connection.
// postgres-js handles pooling internally.
const client = postgres(process.env.DATABASE_URL!, { max: 5 });

export const db = drizzle(client, { schema });
export * from '../../src/lib/db/schema';
